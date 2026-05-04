import { Form, Head, Link, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import DeleteUser from '@/components/delete-user';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { edit, update } from '@/routes/profile';
import { send } from '@/routes/verification';
import type { Auth } from '@/types/auth';
import type { SettingsTranslations } from '@/types/settings-i18n';

type Props = {
    mustVerifyEmail: boolean;
    status?: string;
    t: SettingsTranslations;
};

function initialsFromName(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);

    const letters = parts.map((p) => p[0]?.toUpperCase() ?? '').join('');

    return letters || '?';
}

export default function Profile({ mustVerifyEmail, status, t }: Props) {
    const {
        auth,
        availableLocales,
        locale: appLocale,
    } = usePage<{ auth: Auth }>().props;
    const tp = t.profile;

    const resolvedLocale = String(auth.user.locale ?? appLocale ?? 'en');

    const [name, setName] = useState(auth.user.name);
    const [email, setEmail] = useState(auth.user.email);
    const [locale, setLocale] = useState(resolvedLocale);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [removeAvatar, setRemoveAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setLocale(resolvedLocale);
    }, [resolvedLocale]);

    useEffect(() => {
        setName(auth.user.name);
        setEmail(auth.user.email);
    }, [auth.user.name, auth.user.email, auth.user.updated_at]);

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    useEffect(() => {
        setPreviewUrl((prev) => {
            if (prev) {
                URL.revokeObjectURL(prev);
            }

            return null;
        });
        setRemoveAvatar(false);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [auth.user.updated_at]);

    const localeEntries = useMemo(
        () => Object.entries(availableLocales),
        [availableLocales],
    );

    const displayAvatarSrc =
        previewUrl ??
        (removeAvatar ? undefined : (auth.user.avatar ?? undefined));

    const showRemovePhoto =
        Boolean(previewUrl) || (Boolean(auth.user.avatar) && !removeAvatar);

    const onPickFile = (): void => {
        fileInputRef.current?.click();
    };

    const onFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        setRemoveAvatar(false);
        setPreviewUrl((prev) => {
            if (prev) {
                URL.revokeObjectURL(prev);
            }

            return URL.createObjectURL(file);
        });
    };

    const onRemovePhoto = (): void => {
        setRemoveAvatar(true);
        setPreviewUrl((prev) => {
            if (prev) {
                URL.revokeObjectURL(prev);
            }

            return null;
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <>
            <Head title={tp.head_title} />

            <h1 className="sr-only">{tp.sr_only}</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title={tp.heading_title}
                    description={tp.heading_description}
                />

                <div
                    className={cn(
                        'rounded-xl border border-border/70 bg-card p-6 shadow-sm',
                        'sm:p-8',
                    )}
                >
                    <Form
                        action={update.url()}
                        method="post"
                        encType="multipart/form-data"
                        options={{
                            preserveScroll: true,
                            // @ts-expect-error Inertia visits support `forceFormData`; Form component typings omit it.
                            forceFormData: true,
                        }}
                        className="space-y-8"
                    >
                        {({ processing, errors }) => (
                            <>
                                <input
                                    type="hidden"
                                    name="_method"
                                    value="patch"
                                />
                                {removeAvatar ? (
                                    <input
                                        type="hidden"
                                        name="remove_avatar"
                                        value="1"
                                    />
                                ) : null}

                                <div className="mb-2 grid gap-8 lg:grid-cols-[minmax(0,11rem)_1fr] lg:items-start">
                                    <div className="flex flex-col items-center gap-4 lg:items-start">
                                        <p className="text-center text-sm font-medium lg:w-full lg:text-left">
                                            {tp.photo}
                                        </p>
                                        <Avatar
                                            className={cn(
                                                'size-28 shadow-md ring-2 ring-border/60 sm:size-32',
                                                'overflow-hidden rounded-full',
                                            )}
                                        >
                                            <AvatarImage
                                                src={displayAvatarSrc}
                                                alt={tp.photo_preview_alt}
                                            />
                                            <AvatarFallback
                                                className={cn(
                                                    'rounded-full bg-muted text-lg font-semibold text-muted-foreground',
                                                    'sm:text-xl',
                                                )}
                                            >
                                                {initialsFromName(name)}
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="flex w-full max-w-44 flex-col gap-2">
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                name="avatar"
                                                accept="image/jpeg,image/png,image/webp"
                                                className="sr-only"
                                                onChange={onFileChange}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="w-full"
                                                onClick={onPickFile}
                                                disabled={processing}
                                            >
                                                {tp.photo_choose}
                                            </Button>
                                            {showRemovePhoto ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full text-muted-foreground hover:text-destructive"
                                                    onClick={onRemovePhoto}
                                                    disabled={processing}
                                                >
                                                    {tp.photo_remove}
                                                </Button>
                                            ) : null}
                                            <p className="text-center text-xs text-muted-foreground lg:text-left">
                                                {tp.photo_hint}
                                            </p>
                                            <InputError
                                                message={errors.avatar}
                                            />
                                        </div>
                                    </div>

                                    <div className="min-w-0 space-y-6">
                                        <div className="grid gap-6 sm:grid-cols-2">
                                            <div className="grid gap-2 sm:col-span-1">
                                                <Label htmlFor="name">
                                                    {tp.name}
                                                </Label>

                                                <Input
                                                    id="name"
                                                    className="w-full max-w-full"
                                                    value={name}
                                                    onChange={(e) =>
                                                        setName(e.target.value)
                                                    }
                                                    name="name"
                                                    required
                                                    autoComplete="name"
                                                    placeholder={
                                                        tp.placeholder_name
                                                    }
                                                />

                                                <InputError
                                                    message={errors.name}
                                                />
                                            </div>

                                            <div className="grid gap-2 sm:col-span-1">
                                                <Label htmlFor="email">
                                                    {tp.email}
                                                </Label>

                                                <Input
                                                    id="email"
                                                    type="email"
                                                    className="w-full max-w-full"
                                                    value={email}
                                                    onChange={(e) =>
                                                        setEmail(e.target.value)
                                                    }
                                                    name="email"
                                                    required
                                                    autoComplete="username"
                                                    placeholder={
                                                        tp.placeholder_email
                                                    }
                                                />

                                                <InputError
                                                    message={errors.email}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid max-w-xl gap-2">
                                            <Label htmlFor="locale">
                                                {tp.language}
                                            </Label>
                                            <p className="text-sm text-muted-foreground">
                                                {tp.language_hint}
                                            </p>
                                            <input
                                                type="hidden"
                                                name="locale"
                                                value={locale}
                                            />
                                            <Select
                                                value={locale}
                                                onValueChange={setLocale}
                                            >
                                                <SelectTrigger
                                                    id="locale"
                                                    className="w-full"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {localeEntries.map(
                                                        ([code, meta]) => (
                                                            <SelectItem
                                                                key={code}
                                                                value={code}
                                                            >
                                                                {meta.native} (
                                                                {meta.label})
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <InputError
                                                message={errors.locale}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {mustVerifyEmail &&
                                    auth.user.email_verified_at === null && (
                                        <div className="border-t border-border/60 pt-6">
                                            <p className="text-sm text-muted-foreground">
                                                {tp.unverified_lead}{' '}
                                                <Link
                                                    href={send()}
                                                    as="button"
                                                    className="text-foreground underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current! dark:decoration-neutral-500"
                                                >
                                                    {tp.resend_verification}
                                                </Link>
                                            </p>

                                            {status ===
                                                'verification-link-sent' && (
                                                <div className="mt-2 text-sm font-medium text-green-600">
                                                    {tp.verification_sent}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-2">
                                    <Button
                                        disabled={processing}
                                        data-test="update-profile-button"
                                    >
                                        {tp.save}
                                    </Button>
                                </div>
                            </>
                        )}
                    </Form>
                </div>
            </div>

            <DeleteUser />
        </>
    );
}

Profile.layout = (props: Props) => ({
    breadcrumbs: [
        {
            title: props.t.profile.breadcrumb,
            href: edit(),
        },
    ],
});
