import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'happy-dom',
        globals: true,
        setupFiles: ['./tests/setup.ts'],
        exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
        alias: {
            '@': path.resolve(__dirname, './'),
        },
        server: {
            deps: {
                inline: [/@asamuzakjp\/css-color/, /@csstools\/css-calc/],
            },
        },
    },
});
