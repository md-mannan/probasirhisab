import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig } from 'vite';

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
