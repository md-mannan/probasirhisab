import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig } from 'vite';

/**
 * Name a built JS chunk/entry after its source file (path under resources/js), with no
 * content hash — so output is `assets/app.js`, `assets/pages/contacts/index.js` instead
 * of `app-CuUOa15I.js`. Shared/vendor chunks (no source facade) fall back to their name.
 * Everything lives under `assets/js/` so a JS stem can never collide with a same-named
 * non-JS asset entry (e.g. the `app.css` entry), which would otherwise bump `app.js`
 * to `app2.js`.
 */
function jsNameFromSource(chunkInfo: { facadeModuleId?: string | null; name: string }): string {
    const id = chunkInfo.facadeModuleId;
    if (id) {
        const match = id
            .replace(/\\/g, '/')
            .match(/resources\/js\/(.+)\.(?:tsx|ts|jsx|js)$/);
        if (match) {
            return `assets/js/${match[1]}.js`;
        }
    }

    return `assets/js/${chunkInfo.name}.js`;
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
                // JS entries/chunks are named after their source file with no content
                // hash — `assets/js/app.js`, `assets/js/pages/contacts/index.js`.
                entryFileNames: jsNameFromSource,
                chunkFileNames: jsNameFromSource,
                // Rolldown dedups output by basename stem (ignoring extension), so the
                // `app.css` entry would otherwise reserve `app` and bump the JS entry to
                // `app2.js`. Route the app stylesheet to a distinct `styles` basename;
                // other assets keep their name + a cache-busting hash.
                assetFileNames(assetInfo) {
                    const name = assetInfo.names?.[0] ?? '';
                    if (/\.css$/.test(name)) {
                        return 'assets/css/styles-[hash][extname]';
                    }

                    return 'assets/[name]-[hash][extname]';
                },
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
