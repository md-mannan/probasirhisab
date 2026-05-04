import type { Auth } from '@/types/auth';

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            locale: string;
            availableLocales: Record<string, { label: string; native: string }>;
            name: string;
            branding: {
                appName: string;
                logoUrl: string | null;
            };
            canManageUsers: boolean;
            auth: Auth;
            sidebarOpen: boolean;
            [key: string]: unknown;
        };
    }
}
