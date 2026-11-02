// Thu nhỏ ảnh món ngay trên trình duyệt trước khi tải lên: ảnh điện thoại 4–8 MB còn khoảng 60–120 KB,
// App quầy tải nhanh hơn và máy chủ không phải lưu ảnh gốc.

const MAX_SIDE = 640;

export async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Hãy chọn một tệp ảnh (JPG, PNG hoặc WebP)');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Không đọc được ảnh này, hãy thử ảnh khác');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không nén được ảnh'))), 'image/jpeg', 0.82),
  );
}
