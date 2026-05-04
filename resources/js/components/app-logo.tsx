import { usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { cn } from '@/lib/utils';

type Props = {
    /** When `sidebar`, label hides in collapsed icon mode; logo scales with sidebar state. */
    placement?: 'header' | 'sidebar';
};

export default function AppLogo({ placement = 'header' }: Props) {
    const { branding } = usePage().props;

    return (
        <>
            <div
                className={cn(
                    'flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-transparent',
                    'size-8 min-h-0 min-w-0',
                    placement === 'sidebar' &&
                        'group-data-[state=expanded]:size-9',
                )}
            >
                {branding.logoUrl ? (
                    <img
                        src={branding.logoUrl}
                        alt=""
                        className={cn(
                            'max-h-full max-w-full object-contain p-0.5',
                            placement === 'sidebar' &&
                                'group-data-[state=collapsed]:p-0',
                        )}
                    />
                ) : (
                    <AppLogoIcon
                        className={cn(
                            'shrink-0 fill-current',
                            placement === 'sidebar'
                                ? 'size-[22px] text-sidebar-foreground group-data-[state=expanded]:size-5'
                                : 'size-5 text-foreground',
                        )}
                    />
                )}
            </div>
            <div
                className={cn(
                    'ml-1 grid min-w-0 flex-1 text-left text-sm',
                    placement === 'sidebar' &&
                        'group-data-[state=collapsed]:hidden',
                )}
            >
                <span className="truncate leading-tight font-semibold">
                    {branding.appName}
                </span>
            </div>
        </>
    );
}
