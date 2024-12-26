import path from 'path'

/** @type {import('tailwindcss').Config} */
export default {
    // @see https://github.com/vitejs/vite/discussions/12305#discussioncomment-5217387
    content: [path.resolve(__dirname, './index.html'), path.resolve(__dirname, './src/**/*.{js,ts,jsx,tsx}')],
    theme: {
        extend: {},
    },
    plugins: [],
}
