
import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';
import { resolve } from 'path';

export default defineConfig({
  plugins: [glsl()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        animate: resolve(__dirname, 'animate.html'),
        render: resolve(__dirname, 'render.html'),
        cube: resolve(__dirname, 'cube.html'),
      },
    },
  },
});
