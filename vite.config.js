import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import viteCompression from 'vite-plugin-compression' // Ø¶ØºØ· Gzip/Brotli
import { visualizer } from 'rollup-plugin-visualizer' // Ù„ØªØ­Ù„ÙŠÙ„ Ø­Ø¬Ù… Ø§Ù„Ø¨Ø§Ù†Ø¯Ù„

export default defineConfig({
    server: {
        proxy: {
            '/rest': {
                target: 'https://sys.diaastore.cloud',
                changeOrigin: true,
                secure: false,
            },
            '/functions': {
                target: 'https://sys.diaastore.cloud',
                changeOrigin: true,
                secure: false,
            },
            '/realtime': {
                target: 'wss://sys.diaastore.cloud',
                changeOrigin: true,
                secure: false,
                ws: true,
            },
        }
    },
    plugins: [
        react(),
        viteCompression({
            algorithm: 'brotliCompress', // Ø§Ù„Ø£ÙØ¶Ù„ (Brotli)
            ext: '.br',
            deleteOriginFile: false, // ÙŠØ®Ù„ÙŠ Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø£ØµÙ„ÙŠ Ù…ÙˆØ¬ÙˆØ¯ ÙƒÙ…Ø§Ù†
        }),
        viteCompression({
            algorithm: 'gzip',
            ext: '.gz',
            deleteOriginFile: false,
        }),
        visualizer({ open: false, filename: 'stats.html' })
    ],
    base: '/',
    build: {
        target: 'esnext',
        minify: 'esbuild', // Ø¶ØºØ· JS & CSS (Ù…Ø¯Ù…Ø¬ Ù…Ø¹ Vite)
        cssCodeSplit: true, // ÙŠØ¹Ù…Ù„ Code Splitting Ù„Ù„Ù€ CSS
        rollupOptions: {
            output: {
                manualChunks: {
                    react:   ['react', 'react-dom'],                      // React core â€” changes rarely
                    charts:  ['chart.js', 'react-chartjs-2'],             // Charting â€” heavy, lazy-load worthy
                    vendor:  ['lucide-react', 'sweetalert2', 'xlsx'],     // Utility libs
                },
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    },
})

// deployed: 2026-06-04
