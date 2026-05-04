import { Link, usePage } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { cn } from '@/lib/utils';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    const { branding } = usePage().props;

    return (
        <div
            className={cn(
                'flex min-h-svh flex-col items-center justify-center p-6 md:p-10',
                'bg-linear-to-b from-muted/50 via-background to-background font-sans',
            )}
        >
            <div className="w-full max-w-[420px]">
                <div
                    className={cn(
                        'rounded-2xl border border-border/70 bg-card p-8 shadow-sm',
                        'ring-1 ring-black/4 dark:ring-white/6',
                    )}
                >
                    <div className="flex flex-col gap-8">
                        <div className="flex flex-col items-center gap-6 text-center">
                            <Link
                                href={home()}
                                aria-label={
                                    branding.appName
                                        ? `${branding.appName} — ${title}`
                                        : title
                                }
                                className="flex flex-col items-center gap-3 rounded-xl ring-offset-background transition-opacity outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <div className="flex h-16 max-h-16 w-full max-w-[220px] items-center justify-center">
                                    {branding.logoUrl ? (
                                        <img
                                            src={branding.logoUrl}
                                            alt={branding.appName}
                                            className="max-h-16 w-auto max-w-full rounded-full object-contain"
                                        />
                                    ) : (
                                        <AppLogoIcon className="size-12 shrink-0 rounded-full fill-current text-primary" />
                                    )}
                                </div>
                                {branding.appName ? (
                                    <span className="max-w-full truncate text-sm font-semibold tracking-tight text-foreground">
                                        {branding.appName}
                                    </span>
                                ) : null}
                            </Link>

                            <div className="w-full space-y-2 border-t border-border/60 pt-6">
                                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                                    {title}
                                </h1>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    {description}
                                </p>
                            </div>
                        </div>
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
