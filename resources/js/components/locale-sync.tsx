import { getInitialPageFromDOM } from '@inertiajs/core';
import { router } from '@inertiajs/react';
import { useEffect } from 'react';

const APP_ROOT_ID = 'app';

function applyLocaleFromProps(props: Record<string, unknown>) {
    const raw = props.locale;
    const locale = typeof raw === 'string' ? raw : 'en';
    document.documentElement.lang = locale;
    document.documentElement.classList.toggle('locale-bn', locale === 'bn');
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Syncs `lang` and Bengali font class. Must not use `usePage` — `withApp` in
 * `app.tsx` wraps the Inertia `<App>` from the outside, so this component is
 * outside Inertia's page context.
 */
export default function LocaleSync() {
    useEffect(() => {
        const initial = getInitialPageFromDOM(APP_ROOT_ID) as
            | { props?: Record<string, unknown> }
            | null
            | undefined;
        if (initial?.props) {
            applyLocaleFromProps(initial.props);
        }

        const offNavigate = router.on('navigate', (event) => {
            applyLocaleFromProps(
                event.detail.page.props as Record<string, unknown>,
            );
        });
        const offSuccess = router.on('success', (event) => {
            applyLocaleFromProps(
                event.detail.page.props as Record<string, unknown>,
            );
        });

        return () => {
            offNavigate();
            offSuccess();
        };
    }, []);

    return null;
}
