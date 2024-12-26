import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: '../../build/web',
    },
    // @see https://github.com/vitejs/vite/discussions/12305#discussioncomment-5217387
    css: {
        postcss: {
            plugins: [tailwindcss({ config: path.resolve(__dirname, './tailwind.config.js') }), autoprefixer()],
        },
    },
})
