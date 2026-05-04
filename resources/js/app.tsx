import { createInertiaApp } from '@inertiajs/react';
import LocaleSync from '@/components/locale-sync';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name.startsWith('install/'):
                return null;
            case name.startsWith('errors/'):
                return null;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                <LocaleSync />
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: '#6366f1',
        includeCSS: true,
        showSpinner: true,
    },
});

// This will set light / dark mode on load...
initializeTheme();
