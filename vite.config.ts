import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 打包成單一 HTML：雙擊 dist/index.html 就能玩
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { target: 'es2020', assetsInlineLimit: 100000000 },
});
