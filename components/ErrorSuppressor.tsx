'use client';

import { useEffect } from 'react';

export default function ErrorSuppressor() {
    useEffect(() => {
        const originalError = console.error;
        console.error = function (...args) {
            // Suppress Autodesk Viewer resource missing errors from triggering Next.js error overlay
            if (args[0]) {
                const msg = typeof args[0] === 'string' ? args[0] : (args[0].message || args[0].toString());
                if (typeof msg === 'string' && msg.includes('Failed to fetch resource')) {
                    return;
                }
            }
            // Also suppress "undefined" console.errors which sometimes come from the viewer
            if (args[0] === undefined && args.length === 1) {
                return;
            }

            originalError.apply(console, args);
        };

        return () => {
            console.error = originalError;
        };
    }, []);

    return null;
}
