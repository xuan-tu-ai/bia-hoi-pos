import { defineConfig } from 'vitest/config';
import { BaseSequencer, type TestSpecification } from 'vitest/node';

/**
 * Các file test dùng chung một CSDL test và nối tiếp nhau (mở bàn, thanh toán, thay keg...),
 * nên chạy theo thứ tự tên file: 01-…, 02-…
 */
class ByFileName extends BaseSequencer {
  async sort(files: TestSpecification[]) {
    return [...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  }
}

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/env.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    sequence: { sequencer: ByFileName },
  },
});
