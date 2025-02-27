export default {
    root: './',
    publicDir: 'public',
    server: {
        port: 5173,
        strictPort: true,
        open: true,
        mimeTypes: {
            'application/wasm': ['wasm']
        }
    },
    preview: {
        port: 4173,
        open: true
    },
    build: {
        outDir: 'dist'
    },
    assetsInclude: ['**/*.wasm'] // Explicitly include WASM files
};