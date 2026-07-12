import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig } from 'vite';

/**
 * Name a built chunk after its source file (path under resources/js), with no content
 * hash — so the output is `assets/pages/contacts/index.js` instead of `index-CuUOa15I.js`.
 * Shared/vendor chunks have no source file; they fall back to their chunk name.
 */
function chunkNameFromSource(chunkInfo: { facadeModuleId?: string | null }): string {
    const id = chunkInfo.facadeModuleId;
    if (id) {
        const match = id
            .replace(/\\/g, '/')
            .match(/resources\/js\/(.+)\.(?:tsx|ts|jsx|js)$/);
        if (match) {
            return `assets/${match[1]}.js`;
        }
    }

    return 'assets/[name].js';
}

export default defineConfig({
    /** Pre-bundle heavy deps so dev client never hits stale `504 Outdated Optimize Dep`. */
    optimizeDeps: {
        include: [
            'chart.js',
            'html2canvas',
            'jspdf',
            'react-chartjs-2',
        ],
    },
    build: {
        /** Smaller initial page JS; heavy libs cache separately across navigations. */
        chunkSizeWarningLimit: 1200,
        rollupOptions: {
            output: {
                // Name built files after their source (no content hash) so output is
                // stable and recognizable, e.g. `app.js` / `pages/contacts/index.js`.
                entryFileNames: 'assets/[name].js',
                chunkFileNames: chunkNameFromSource,
                assetFileNames: 'assets/[name][extname]',
                manualChunks(id) {
                    if (id.includes('node_modules/@inertiajs/')) {
                        return 'vendor-inertia';
                    }
                    if (
                        id.includes('node_modules/chart.js') ||
                        id.includes('node_modules/react-chartjs-2')
                    ) {
                        return 'vendor-charts';
                    }
                    if (id.includes('node_modules/@dnd-kit/')) {
                        return 'vendor-dnd';
                    }
                    if (id.includes('node_modules/lucide-react')) {
                        return 'vendor-icons';
                    }
                },
            },
        },
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
            fonts: [
                bunny('Outfit', {
                    weights: [400, 500, 600, 700],
                }),
            ],
        }),
        inertia(),
        react({
            // Wayfinder-generated `*.ts` route/action modules are not React; running the
            // React compiler on them can break closures (e.g. `queryParams is not defined`).
            exclude: [
                /\/node_modules\//,
                /\/resources\/js\/routes\//,
                /\/resources\/js\/actions\//,
            ],
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
            command: 'php artisan wayfinder:generate-safe',
        }),
    ],
});
