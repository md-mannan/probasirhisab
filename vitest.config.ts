import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': resolve(__dirname, './resources/js'),
        },
    },
    test: {
        include: ['resources/js/**/*.test.ts', 'resources/js/**/*.test.tsx'],
        environment: 'node',
    },
});
