// Ảnh món (FR-11): chủ quán tải lên từ Web quản trị, App quầy hiện trên nút món.
// Ảnh gửi thẳng dạng nhị phân (content-type image/*), Web quản trị thu nhỏ trước khi gửi.

import type { FastifyInstance } from 'fastify';
import { ownerOnly } from '../lib/auth';
import { badRequest, notFound } from '../lib/errors';
import { audit, prisma } from '../lib/prisma';
import { MAX_IMAGE_BYTES, imageExt, readImage, removeImage, saveImage } from '../lib/uploads';
import { idParam } from '../lib/validate';

export async function imageRoutes(app: FastifyInstance) {
  app.addContentTypeParser(/^image\//, { parseAs: 'buffer', bodyLimit: MAX_IMAGE_BYTES }, (_req, body, done) => done(null, body));

  app.put('/menu-items/:id/image', { preHandler: ownerOnly, bodyLimit: MAX_IMAGE_BYTES }, async (req) => {
    const { id } = idParam.parse(req.params);
    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item || !item.active) throw notFound('món');
    const buf = req.body;
    const ext = Buffer.isBuffer(buf) ? imageExt(buf) : null;
    if (!ext) throw badRequest('NOT_AN_IMAGE', 'Tệp không phải ảnh JPG, PNG hoặc WebP');
    const file = await saveImage('mon', id, buf as Buffer, ext);
    const updated = await prisma.menuItem.update({ where: { id }, data: { imageFile: file } });
    await removeImage(item.imageFile);
    await audit(prisma, req.user.sub, 'UPDATE', 'menu_item', id, { imageFile: file });
    return updated;
  });

  app.delete('/menu-items/:id/image', { preHandler: ownerOnly }, async (req) => {
    const { id } = idParam.parse(req.params);
    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item || !item.active) throw notFound('món');
    const updated = await prisma.menuItem.update({ where: { id }, data: { imageFile: null } });
    await removeImage(item.imageFile);
    await audit(prisma, req.user.sub, 'UPDATE', 'menu_item', id, { imageFile: null });
    return updated;
  });

  // Không cần đăng nhập: thẻ <img> không gửi được token. Tên tệp ngẫu nhiên, ảnh món không phải dữ liệu nhạy cảm.
  app.get('/uploads/:file', async (req, reply) => {
    const { file } = req.params as { file: string };
    const img = await readImage(file);
    if (!img) throw notFound('ảnh');
    return reply
      .header('content-type', img.type)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('x-content-type-options', 'nosniff')
      .send(img.data);
  });
}
