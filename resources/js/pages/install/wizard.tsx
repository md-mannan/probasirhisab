import { Form, Head, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    CircleDot,
    Database,
    Palette,
    Rocket,
    ShieldCheck,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
    fieldError,
    firstStepWithErrors,
    validateFullInstall,
    validateInstallStep,
} from '@/lib/install-validation';
import { cn } from '@/lib/utils';
import type { InstallTranslations, LocaleMeta } from '@/types/install-i18n';
import { interpolateTemplate } from '@/types/install-i18n';

function scrollToFirstFieldError(
    errs: Record<string, string>,
    step: number,
): void {
    const orderByStep: Record<number, string[]> = {
        1: ['app_name', 'app_url', 'logo'],
        2: ['db_host', 'db_port', 'db_database', 'db_username', 'db_password'],
        3: [
            'admin_name',
            'admin_email',
            'admin_password',
            'admin_password_confirmation',
        ],
    };

    const keys = orderByStep[step];

    if (!keys) {
        return;
    }

    const firstKey = keys.find((k) => errs[k] !== undefined && errs[k] !== '');

    if (!firstKey) {
        return;
    }

    const root = document.getElementById('install-wizard-form');
    const el =
        root?.querySelector<HTMLElement>(
            `[name="${firstKey}"]`,
        ) ?? document.getElementById(firstKey);

    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

type Requirements = {
    php: boolean;
    php_version: string;
    writable_storage: boolean;
    env_present: boolean;
};

const STEP_ORDER = [
    'requirements',
    'application',
    'database',
    'admin',
] as const;

const STEP_ICONS = {
    requirements: ShieldCheck,
    application: Palette,
    database: Database,
    admin: Rocket,
} as const;

export default function InstallWizard({
    requirements,
    t,
    availableLocales,
    locale,
}: {
    requirements: Requirements;
    t: InstallTranslations;
    availableLocales: Record<string, LocaleMeta>;
    locale: string;
}) {
    const ready = useMemo(
        () =>
            requirements.php &&
            requirements.writable_storage &&
            requirements.env_present,
        [requirements],
    );

    const [driver, setDriver] = useState<'mysql' | 'sqlite'>('sqlite');
    const [step, setStep] = useState(0);
    const [clientErrors, setClientErrors] = useState<Record<string, string>>(
        {},
    );
    const page = usePage<{ errors?: Partial<Record<string, string | string[]>> }>();
    /** Field → error-bag signature when user cleared that field (see `fieldError` in install-validation). */
    const [dismissedAtSig, setDismissedAtSig] = useState<
        Record<string, string>
    >({});

    const steps = useMemo(
        () =>
            STEP_ORDER.map((id) => ({
                id,
                title: t.steps[id].title,
                description: t.steps[id].description,
                icon: STEP_ICONS[id],
            })),
        [t],
    );
    const STEP_COUNT = steps.length;

    const getInstallForm = (): HTMLFormElement | null =>
        document.getElementById(
            'install-wizard-form',
        ) as HTMLFormElement | null;

    const goBack = () => {
        setClientErrors({});
        setStep((s) => Math.max(s - 1, 0));
    };

    const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
        const form = e.currentTarget;
        const fd = new FormData(form);
        const errs = validateFullInstall(fd, t.validation);

        if (Object.keys(errs).length === 0) {
            setClientErrors({});

            return;
        }

        e.preventDefault();
        setClientErrors(errs);
        const first = firstStepWithErrors(errs);

        if (first !== null) {
            setStep(first);
        }
    };

    const slidePct = (100 / STEP_COUNT) * step;

    return (
        <>
            <Head title={t.meta.head_title} />

            <div className="relative min-h-screen overflow-hidden bg-muted/30">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,hsl(var(--primary)/0.18),transparent_55%),radial-gradient(ellipse_90%_60%_at_100%_50%,hsl(var(--primary)/0.08),transparent_45%)]"
                />

                <div className="relative mx-auto grid min-h-screen max-w-6xl lg:grid-cols-[minmax(240px,300px)_1fr] lg:gap-0">
                    {/* Sidebar — desktop */}
                    <aside className="relative hidden h-full min-h-screen flex-col border-border/60 bg-linear-to-b from-card via-muted/20 to-muted/40 px-5 py-8 shadow-[inset_-1px_0_0_0_hsl(var(--border)/0.6)] lg:flex">
                        {/* Brand */}
                        <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                                    <CircleDot className="size-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                                        {t.brand.setup}
                                    </p>
                                    <p className="truncate text-sm font-semibold tracking-tight">
                                        Probasirhisab
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Steps */}
                        <nav
                            className="relative mt-6 flex flex-col gap-2"
                            aria-label={t.nav.installation_steps}
                        >
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {t.nav.steps}
                            </p>
                            <ul className="flex list-none flex-col gap-2 p-0">
                                {steps.map((s, i) => {
                                    const Icon = s.icon;
                                    const done = i < step;
                                    const active = i === step;

                                    return (
                                        <li key={s.id} className="p-0">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (i <= step || ready) {
                                                        setClientErrors({});
                                                setStep(i);
                                                    }
                                                }}
                                                disabled={
                                                    !ready && i > 0 && step === 0
                                                }
                                                className={cn(
                                                    'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                                                    active &&
                                                        'border-primary/35 bg-primary/10 shadow-sm',
                                                    !active &&
                                                        done &&
                                                        'border-border/80 bg-muted/20 hover:bg-muted/40',
                                                    !active &&
                                                        !done &&
                                                        'border-transparent bg-muted/15 hover:bg-muted/30',
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        'flex size-8 shrink-0 items-center justify-center rounded-lg border text-[11px] font-semibold tabular-nums',
                                                        done &&
                                                            'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                                                        active &&
                                                            !done &&
                                                            'border-primary/40 bg-primary/15 text-primary',
                                                        !active &&
                                                            !done &&
                                                            'border-border bg-background text-muted-foreground',
                                                    )}
                                                >
                                                    {done ? (
                                                        <CheckCircle2 className="size-4" />
                                                    ) : (
                                                        <Icon className="size-4" />
                                                    )}
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="block text-xs font-medium leading-snug">
                                                        {s.title}
                                                    </span>
                                                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                                                        {s.description}
                                                    </span>
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </nav>

                        <p className="mt-auto border-t border-border/60 pt-4 text-[11px] leading-relaxed text-muted-foreground">
                            {t.brand.footer_note}
                        </p>
                    </aside>

                    {/* Main column */}
                    <main className="flex flex-col px-4 py-6 sm:px-6 lg:py-9">
                        {/* Mobile step indicator */}
                        <div className="mb-4 flex items-center justify-between gap-2 lg:hidden">
                            <span className="text-xs font-medium text-muted-foreground">
                                {interpolateTemplate(t.nav.mobile_step, {
                                    current: step + 1,
                                    total: STEP_COUNT,
                                })}
                            </span>
                            <div className="flex gap-1">
                                {steps.map((_, i) => (
                                    <span
                                        key={i}
                                        className={cn(
                                            'h-1.5 flex-1 rounded-full transition-colors',
                                            i <= step
                                                ? 'bg-primary'
                                                : 'bg-muted',
                                        )}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="mx-auto w-full max-w-2xl flex-1">
                            <div className="mb-4 lg:mb-6">
                                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                                    {steps[step].title}
                                </h1>
                                <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
                                    {steps[step].description}
                                </p>
                            </div>

                            <Form
                                id="install-wizard-form"
                                action="/install"
                                method="post"
                                encType="multipart/form-data"
                                noValidate
                                className="flex flex-col"
                                onSubmit={handleFormSubmit}
                                onKeyDown={(e) => {
                                    // Prevent accidental form submit while navigating steps (e.g. pressing Enter in an input).
                                    if (
                                        e.key === 'Enter' &&
                                        step < STEP_COUNT - 1 &&
                                        (e.target as HTMLElement | null)?.tagName !==
                                            'TEXTAREA'
                                    ) {
                                        e.preventDefault();
                                    }
                                }}
                            >
                                {({
                                    processing,
                                    errors: formErrors,
                                    clearErrors,
                                }) => {
                                    const pageFieldErrors = (page.props
                                        .errors ?? {}) as Partial<
                                        Record<string, string | string[]>
                                    >;
                                    const formFieldErrors =
                                        (formErrors ?? {}) as Partial<
                                            Record<string, string | string[]>
                                        >;
                                    const serverErrors = {
                                        ...pageFieldErrors,
                                        ...formFieldErrors,
                                    };
                                    const serverErrorsSig =
                                        JSON.stringify(serverErrors);

                                    const clearFieldError = (key: string) => {
                                        (
                                            clearErrors as (
                                                field: string,
                                            ) => void
                                        )(key);
                                        setDismissedAtSig((prev) => ({
                                            ...prev,
                                            [key]: serverErrorsSig,
                                        }));
                                        setClientErrors((prev) => {
                                            if (!(key in prev)) {
                                                return prev;
                                            }

                                            const next = { ...prev };
                                            delete next[key];

                                            return next;
                                        });
                                    };

                                    const handleContinue = () => {
                                        if (step === 0) {
                                            if (!ready) {
                                                return;
                                            }

                                            setClientErrors({});
                                            setStep(1);

                                            return;
                                        }

                                        const form = getInstallForm();

                                        if (!form) {
                                            return;
                                        }

                                        (
                                            clearErrors as () => void
                                        )();

                                        const fd = new FormData(form);
                                        const errs = validateInstallStep(
                                            step,
                                            fd,
                                            t.validation,
                                        );
                                        setClientErrors(errs);

                                        if (Object.keys(errs).length > 0) {
                                            requestAnimationFrame(() =>
                                                scrollToFirstFieldError(
                                                    errs,
                                                    step,
                                                ),
                                            );

                                            return;
                                        }

                                        setClientErrors({});
                                        setStep((s) =>
                                            Math.min(s + 1, STEP_COUNT - 1),
                                        );
                                    };

                                    return (
                                        <Card className="gap-0 overflow-hidden border-border/80 py-0 shadow-md">
                                            <input
                                                type="hidden"
                                                name="app_locale"
                                                value={locale}
                                            />
                                            <div className="overflow-hidden">
                                                <div
                                                    className={cn(
                                                        'flex transition-transform duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none',
                                                    )}
                                                    style={{
                                                        width: `${STEP_COUNT * 100}%`,
                                                        transform: `translateX(-${slidePct}%)`,
                                                    }}
                                                >
                                                    {/* Step 0 — Requirements */}
                                                    <section className="w-1/4 shrink-0 px-5 py-1">
                                                        <CardHeader className="px-0 pt-1 pb-3">
                                                            <CardTitle className="text-base">
                                                                {
                                                                    t
                                                                        .requirements
                                                                        .system_checks
                                                                }
                                                            </CardTitle>
                                                            <CardDescription>
                                                                {
                                                                    t
                                                                        .requirements
                                                                        .intro
                                                                }
                                                            </CardDescription>
                                                        </CardHeader>
                                                        <CardContent className="space-y-4 px-0">
                                                            <div className="grid gap-2 sm:max-w-xs">
                                                                <Label>
                                                                    {
                                                                        t
                                                                            .language
                                                                            .label
                                                                    }
                                                                </Label>
                                                                <Select
                                                                    value={
                                                                        locale
                                                                    }
                                                                    onValueChange={(
                                                                        code,
                                                                    ) => {
                                                                        router.post(
                                                                            '/install/locale',
                                                                            {
                                                                                locale: code,
                                                                            },
                                                                            {
                                                                                preserveScroll:
                                                                                    true,
                                                                            },
                                                                        );
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="w-full">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {Object.entries(
                                                                            availableLocales,
                                                                        ).map(
                                                                            ([
                                                                                code,
                                                                                meta,
                                                                            ]) => (
                                                                                <SelectItem
                                                                                    key={
                                                                                        code
                                                                                    }
                                                                                    value={
                                                                                        code
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        meta.native
                                                                                    }{' '}
                                                                                    (
                                                                                    {
                                                                                        meta.label
                                                                                    }
                                                                                    )
                                                                                </SelectItem>
                                                                            ),
                                                                        )}
                                                                    </SelectContent>
                                                                </Select>
                                                                <p className="text-[11px] text-muted-foreground">
                                                                    {
                                                                        t
                                                                            .language
                                                                            .hint
                                                                    }
                                                                </p>
                                                            </div>
                                                            <ul className="space-y-2 text-xs">
                                                                <li
                                                                    className={cn(
                                                                        'flex items-center justify-between rounded-md border px-3 py-2.5',
                                                                        requirements.php
                                                                            ? 'border-emerald-500/30 bg-emerald-500/5'
                                                                            : 'border-destructive/40 bg-destructive/5',
                                                                    )}
                                                                >
                                                                    <span>
                                                                        {
                                                                            t
                                                                                .requirements
                                                                                .php_version
                                                                        }
                                                                    </span>
                                                                    <span
                                                                        className={cn(
                                                                            'tabular-nums',
                                                                            requirements.php
                                                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                                                : 'text-destructive',
                                                                        )}
                                                                    >
                                                                        {
                                                                            requirements.php_version
                                                                        }
                                                                    </span>
                                                                </li>
                                                                <li
                                                                    className={cn(
                                                                        'flex items-center justify-between rounded-md border px-3 py-2.5',
                                                                        requirements.writable_storage
                                                                            ? 'border-emerald-500/30 bg-emerald-500/5'
                                                                            : 'border-destructive/40 bg-destructive/5',
                                                                    )}
                                                                >
                                                                    <span>
                                                                        {
                                                                            t
                                                                                .requirements
                                                                                .writable
                                                                        }
                                                                    </span>
                                                                    <CheckCircle2
                                                                        className={cn(
                                                                            'size-4',
                                                                            requirements.writable_storage
                                                                                ? 'text-emerald-600'
                                                                                : 'text-destructive',
                                                                        )}
                                                                    />
                                                                </li>
                                                                <li
                                                                    className={cn(
                                                                        'flex items-center justify-between rounded-md border px-3 py-2.5',
                                                                        requirements.env_present
                                                                            ? 'border-emerald-500/30 bg-emerald-500/5'
                                                                            : 'border-destructive/40 bg-destructive/5',
                                                                    )}
                                                                >
                                                                    <span>
                                                                        {
                                                                            t
                                                                                .requirements
                                                                                .env_file
                                                                        }
                                                                    </span>
                                                                    <CheckCircle2
                                                                        className={cn(
                                                                            'size-4',
                                                                            requirements.env_present
                                                                                ? 'text-emerald-600'
                                                                                : 'text-destructive',
                                                                        )}
                                                                    />
                                                                </li>
                                                            </ul>
                                                            {!ready && (
                                                                <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
                                                                    {
                                                                        t
                                                                            .requirements
                                                                            .fix_hint
                                                                    }
                                                                </p>
                                                            )}
                                                        </CardContent>
                                                    </section>

                                                    {/* Step 1 — Application */}
                                                    <section className="w-1/4 shrink-0 px-5 py-1">
                                                        <CardHeader className="px-0 pt-1 pb-3">
                                                            <CardTitle className="text-base">
                                                                {
                                                                    t
                                                                        .application_step
                                                                        .workspace
                                                                }
                                                            </CardTitle>
                                                            <CardDescription>
                                                                {
                                                                    t
                                                                        .application_step
                                                                        .workspace_hint
                                                                }
                                                            </CardDescription>
                                                        </CardHeader>
                                                        <CardContent className="grid gap-4 px-0 sm:grid-cols-2">
                                                            <div className="grid gap-2 sm:col-span-2">
                                                                <Label htmlFor="app_name">
                                                                    {
                                                                        t
                                                                            .application_step
                                                                            .app_name
                                                                    }
                                                                </Label>
                                                                <Input
                                                                    id="app_name"
                                                                    name="app_name"
                                                                    required
                                                                    placeholder={
                                                                        t
                                                                            .application_step
                                                                            .placeholder_company
                                                                    }
                                                                    defaultValue="Probasirhisab"
                                                                    onChange={() =>
                                                                        clearFieldError(
                                                                            'app_name',
                                                                        )
                                                                    }
                                                                />
                                                                <InputError
                                                                    message={fieldError(
                                                                        serverErrors,
                                                                        clientErrors,
                                                                        'app_name',
                                                                        dismissedAtSig,
                                                                        serverErrorsSig,
                                                                    )}
                                                                />
                                                            </div>
                                                            <div className="grid gap-2 sm:col-span-2">
                                                                <Label htmlFor="app_url">
                                                                    {
                                                                        t
                                                                            .application_step
                                                                            .app_url
                                                                    }
                                                                </Label>
                                                                <Input
                                                                    id="app_url"
                                                                    name="app_url"
                                                                    type="url"
                                                                    placeholder={
                                                                        t
                                                                            .application_step
                                                                            .placeholder_url
                                                                    }
                                                                    onChange={() =>
                                                                        clearFieldError(
                                                                            'app_url',
                                                                        )
                                                                    }
                                                                />
                                                                <InputError
                                                                    message={fieldError(
                                                                        serverErrors,
                                                                        clientErrors,
                                                                        'app_url',
                                                                        dismissedAtSig,
                                                                        serverErrorsSig,
                                                                    )}
                                                                />
                                                            </div>
                                                            <div className="grid gap-2 sm:col-span-2">
                                                                <Label htmlFor="logo">
                                                                    {
                                                                        t
                                                                            .application_step
                                                                            .logo
                                                                    }
                                                                </Label>
                                                                <Input
                                                                    id="logo"
                                                                    name="logo"
                                                                    type="file"
                                                                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                                                    className="cursor-pointer text-sm file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs file:font-medium"
                                                                    onChange={() =>
                                                                        clearFieldError(
                                                                            'logo',
                                                                        )
                                                                    }
                                                                />
                                                                <InputError
                                                                    message={fieldError(
                                                                        serverErrors,
                                                                        clientErrors,
                                                                        'logo',
                                                                        dismissedAtSig,
                                                                        serverErrorsSig,
                                                                    )}
                                                                />
                                                            </div>
                                                        </CardContent>
                                                    </section>

                                                    {/* Step 2 — Database */}
                                                    <section className="w-1/4 shrink-0 px-5 py-1">
                                                        <CardHeader className="px-0 pt-1 pb-3">
                                                            <CardTitle className="text-base">
                                                                {t.steps.database.title}
                                                            </CardTitle>
                                                            <CardDescription>
                                                                {
                                                                    t
                                                                        .database_step
                                                                        .intro
                                                                }
                                                            </CardDescription>
                                                        </CardHeader>
                                                        <CardContent className="space-y-4 px-0">
                                                            <input
                                                                type="hidden"
                                                                name="db_driver"
                                                                value={driver}
                                                            />
                                                            <div className="grid gap-2 sm:max-w-xs">
                                                                <Label>
                                                                    {
                                                                        t
                                                                            .database_step
                                                                            .driver
                                                                    }
                                                                </Label>
                                                                <Select
                                                                    value={
                                                                        driver
                                                                    }
                                                                    onValueChange={(
                                                                        v,
                                                                    ) => {
                                                                        setDriver(
                                                                            v as
                                                                                | 'mysql'
                                                                                | 'sqlite',
                                                                        );
                                                                        clearFieldError(
                                                                            'db',
                                                                        );
                                                                        clearFieldError(
                                                                            'db_database',
                                                                        );
                                                                        clearFieldError(
                                                                            'db_host',
                                                                        );
                                                                        clearFieldError(
                                                                            'db_port',
                                                                        );
                                                                        clearFieldError(
                                                                            'db_username',
                                                                        );
                                                                        clearFieldError(
                                                                            'db_password',
                                                                        );
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="w-full">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="sqlite">
                                                                            {
                                                                                t
                                                                                    .database_step
                                                                                    .driver_sqlite
                                                                            }
                                                                        </SelectItem>
                                                                        <SelectItem value="mysql">
                                                                            {
                                                                                t
                                                                                    .database_step
                                                                                    .driver_mysql
                                                                            }
                                                                        </SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            {driver ===
                                                            'sqlite' ? (
                                                                <div className="grid gap-2">
                                                                    <Label htmlFor="db_database">
                                                                        {
                                                                            t
                                                                                .database_step
                                                                                .sqlite_file
                                                                        }
                                                                    </Label>
                                                                    <Input
                                                                        id="db_database"
                                                                        name="db_database"
                                                                        required
                                                                        placeholder={
                                                                            t
                                                                                .database_step
                                                                                .placeholder_sqlite
                                                                        }
                                                                        defaultValue="database.sqlite"
                                                                        onChange={() =>
                                                                            clearFieldError(
                                                                                'db_database',
                                                                            )
                                                                        }
                                                                    />
                                                                    <InputError
                                                                        message={fieldError(
                                                                            serverErrors,
                                                                            clientErrors,
                                                                            'db_database',
                                                                            dismissedAtSig,
                                                                            serverErrorsSig,
                                                                        )}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="grid gap-4 sm:grid-cols-2">
                                                                    <div className="grid gap-2 sm:col-span-2">
                                                                        <Label htmlFor="db_host">
                                                                            {
                                                                                t
                                                                                    .database_step
                                                                                    .mysql_host
                                                                            }
                                                                        </Label>
                                                                        <Input
                                                                            id="db_host"
                                                                            name="db_host"
                                                                            required
                                                                            defaultValue="127.0.0.1"
                                                                            onChange={() =>
                                                                                clearFieldError(
                                                                                    'db_host',
                                                                                )
                                                                            }
                                                                        />
                                                                        <InputError
                                                                            message={fieldError(
                                                                                serverErrors,
                                                                                clientErrors,
                                                                                'db_host',
                                                                                dismissedAtSig,
                                                                                serverErrorsSig,
                                                                            )}
                                                                        />
                                                                    </div>
                                                                    <div className="grid gap-2">
                                                                        <Label htmlFor="db_port">
                                                                            {
                                                                                t
                                                                                    .database_step
                                                                                    .mysql_port
                                                                            }
                                                                        </Label>
                                                                        <Input
                                                                            id="db_port"
                                                                            name="db_port"
                                                                            type="number"
                                                                            defaultValue={
                                                                                3306
                                                                            }
                                                                            onChange={() =>
                                                                                clearFieldError(
                                                                                    'db_port',
                                                                                )
                                                                            }
                                                                        />
                                                                        <InputError
                                                                            message={fieldError(
                                                                                serverErrors,
                                                                                clientErrors,
                                                                                'db_port',
                                                                                dismissedAtSig,
                                                                                serverErrorsSig,
                                                                            )}
                                                                        />
                                                                    </div>
                                                                    <div className="grid gap-2">
                                                                        <Label htmlFor="db_database_mysql">
                                                                            {
                                                                                t
                                                                                    .database_step
                                                                                    .mysql_database
                                                                            }
                                                                        </Label>
                                                                        <Input
                                                                            id="db_database_mysql"
                                                                            name="db_database"
                                                                            required
                                                                            onChange={() =>
                                                                                clearFieldError(
                                                                                    'db_database',
                                                                                )
                                                                            }
                                                                        />
                                                                        <InputError
                                                                            message={fieldError(
                                                                                serverErrors,
                                                                                clientErrors,
                                                                                'db_database',
                                                                                dismissedAtSig,
                                                                                serverErrorsSig,
                                                                            )}
                                                                        />
                                                                    </div>
                                                                    <div className="grid gap-2 sm:col-span-2">
                                                                        <Label htmlFor="db_username">
                                                                            {
                                                                                t
                                                                                    .database_step
                                                                                    .mysql_username
                                                                            }
                                                                        </Label>
                                                                        <Input
                                                                            id="db_username"
                                                                            name="db_username"
                                                                            required
                                                                            onChange={() =>
                                                                                clearFieldError(
                                                                                    'db_username',
                                                                                )
                                                                            }
                                                                        />
                                                                        <InputError
                                                                            message={fieldError(
                                                                                serverErrors,
                                                                                clientErrors,
                                                                                'db_username',
                                                                                dismissedAtSig,
                                                                                serverErrorsSig,
                                                                            )}
                                                                        />
                                                                    </div>
                                                                    <div className="grid gap-2 sm:col-span-2">
                                                                        <Label htmlFor="db_password">
                                                                            {
                                                                                t
                                                                                    .database_step
                                                                                    .mysql_password
                                                                            }
                                                                        </Label>
                                                                        <Input
                                                                            id="db_password"
                                                                            name="db_password"
                                                                            type="password"
                                                                            onChange={() =>
                                                                                clearFieldError(
                                                                                    'db_password',
                                                                                )
                                                                            }
                                                                        />
                                                                        <InputError
                                                                            message={fieldError(
                                                                                serverErrors,
                                                                                clientErrors,
                                                                                'db_password',
                                                                                dismissedAtSig,
                                                                                serverErrorsSig,
                                                                            )}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <InputError
                                                                message={fieldError(
                                                                    serverErrors,
                                                                    clientErrors,
                                                                    'db',
                                                                    dismissedAtSig,
                                                                    serverErrorsSig,
                                                                )}
                                                            />
                                                        </CardContent>
                                                    </section>

                                                    {/* Step 3 — Admin */}
                                                    <section className="w-1/4 shrink-0 px-5 py-1">
                                                        <CardHeader className="px-0 pt-1 pb-3">
                                                            <CardTitle className="text-base">
                                                                {
                                                                    t.admin_step
                                                                        .super_admin
                                                                }
                                                            </CardTitle>
                                                            <CardDescription>
                                                                {
                                                                    t.admin_step
                                                                        .intro
                                                                }
                                                            </CardDescription>
                                                        </CardHeader>
                                                        <CardContent className="grid gap-4 px-0 sm:grid-cols-2">
                                                            <div className="grid gap-2 sm:col-span-2">
                                                                <Label htmlFor="admin_name">
                                                                    {
                                                                        t.admin_step
                                                                            .name
                                                                    }
                                                                </Label>
                                                                <Input
                                                                    id="admin_name"
                                                                    name="admin_name"
                                                                    required
                                                                    autoComplete="name"
                                                                    onChange={() =>
                                                                        clearFieldError(
                                                                            'admin_name',
                                                                        )
                                                                    }
                                                                />
                                                                <InputError
                                                                    message={fieldError(
                                                                        serverErrors,
                                                                        clientErrors,
                                                                        'admin_name',
                                                                        dismissedAtSig,
                                                                        serverErrorsSig,
                                                                    )}
                                                                />
                                                            </div>
                                                            <div className="grid gap-2 sm:col-span-2">
                                                                <Label htmlFor="admin_email">
                                                                    {
                                                                        t.admin_step
                                                                            .email
                                                                    }
                                                                </Label>
                                                                <Input
                                                                    id="admin_email"
                                                                    name="admin_email"
                                                                    type="email"
                                                                    required
                                                                    autoComplete="username"
                                                                    onChange={() =>
                                                                        clearFieldError(
                                                                            'admin_email',
                                                                        )
                                                                    }
                                                                />
                                                                <InputError
                                                                    message={fieldError(
                                                                        serverErrors,
                                                                        clientErrors,
                                                                        'admin_email',
                                                                        dismissedAtSig,
                                                                        serverErrorsSig,
                                                                    )}
                                                                />
                                                            </div>
                                                            <div className="grid gap-2 sm:col-span-2">
                                                                <Label htmlFor="admin_password">
                                                                    {
                                                                        t.admin_step
                                                                            .password
                                                                    }
                                                                </Label>
                                                                <PasswordInput
                                                                    id="admin_password"
                                                                    name="admin_password"
                                                                    required
                                                                    autoComplete="new-password"
                                                                    onChange={() =>
                                                                        clearFieldError(
                                                                            'admin_password',
                                                                        )
                                                                    }
                                                                />
                                                                <InputError
                                                                    message={fieldError(
                                                                        serverErrors,
                                                                        clientErrors,
                                                                        'admin_password',
                                                                        dismissedAtSig,
                                                                        serverErrorsSig,
                                                                    )}
                                                                />
                                                            </div>
                                                            <div className="grid gap-2 sm:col-span-2">
                                                                <Label htmlFor="admin_password_confirmation">
                                                                    {
                                                                        t.admin_step
                                                                            .password_confirmation
                                                                    }
                                                                </Label>
                                                                <PasswordInput
                                                                    id="admin_password_confirmation"
                                                                    name="admin_password_confirmation"
                                                                    required
                                                                    autoComplete="new-password"
                                                                    onChange={() =>
                                                                        clearFieldError(
                                                                            'admin_password_confirmation',
                                                                        )
                                                                    }
                                                                />
                                                                <InputError
                                                                    message={fieldError(
                                                                        serverErrors,
                                                                        clientErrors,
                                                                        'admin_password_confirmation',
                                                                        dismissedAtSig,
                                                                        serverErrorsSig,
                                                                    )}
                                                                />
                                                            </div>
                                                        </CardContent>
                                                    </section>
                                                </div>
                                            </div>

                                            <CardFooter className="flex flex-col gap-3 border-t bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex w-full gap-2 sm:w-auto">
                                                    {step > 0 && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            onClick={goBack}
                                                            disabled={
                                                                processing
                                                            }
                                                            className="flex-1 sm:flex-none"
                                                        >
                                                            <ArrowLeft className="mr-2 size-4" />
                                                            {t.buttons.back}
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className="flex w-full gap-2 sm:w-auto sm:justify-end">
                                                    {step < STEP_COUNT - 1 ? (
                                                        <Button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleContinue();
                                                            }}
                                                            disabled={
                                                                (!ready &&
                                                                    step ===
                                                                        0) ||
                                                                processing
                                                            }
                                                            className="flex-1 sm:min-w-[140px]"
                                                        >
                                                            {t.buttons.continue}
                                                            <ArrowRight className="ml-2 size-4" />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            type="submit"
                                                            disabled={
                                                                !ready ||
                                                                processing
                                                            }
                                                            className="flex-1 sm:min-w-[200px]"
                                                        >
                                                            {processing && (
                                                                <Spinner />
                                                            )}
                                                            {t.buttons.finish}
                                                        </Button>
                                                    )}
                                                </div>
                                            </CardFooter>
                                        </Card>
                                    );
                                }}
                            </Form>
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}
