import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import svgLoader from 'vite-svg-loader'

// Local: base `/`. GitHub Pages project site: VITE_BASE=/cross-stitch/
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [
    vue(),
    Components({
      dirs: ['src/components', 'src/assets'],
      extensions: ['vue', 'svg'],
      directoryAsNamespace: true,
      dts: 'src/components.d.ts',
      importPathTransform: (path) =>
        path.endsWith('.svg') ? `${path}?component` : path,
    }),
    svgLoader({
      svgoConfig: {
        plugins: [
          {
            name: 'preset-default',
            params: {
              overrides: {
                removeViewBox: false,
              },
            },
          },
        ],
      },
    }),
  ],
})
