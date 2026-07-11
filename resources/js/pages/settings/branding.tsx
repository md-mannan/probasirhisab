import { Head, router, usePage } from '@inertiajs/react';
import { ImageOff, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    destroy as brandingDestroy,
    update as brandingUpdate,
} from '@/routes/settings/branding';

type Props = {
    logoUrl: string | null;
};

type PageProps = {
    branding?: { appName?: string };
    errors: Record<string, string>;
};

export default function Branding({ logoUrl }: Props) {
    const { branding, errors } = usePage<PageProps>().props;
    const appName = branding?.appName ?? 'App';

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Revoke the object URL when it changes or the component unmounts.
    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const clearPreview = () => {
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

    const shownSrc = previewUrl ?? logoUrl ?? undefined;

    const onPick = () => fileInputRef.current?.click();

    const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        // Local preview.
        setPreviewUrl((prev) => {
            if (prev) {
                URL.revokeObjectURL(prev);
            }

            return URL.createObjectURL(file);
        });

        // Upload immediately (multipart).
        router.post(
            brandingUpdate.url(),
            { logo: file },
            {
                forceFormData: true,
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onSuccess: () => clearPreview(),
                onFinish: () => setProcessing(false),
            },
        );
    };

    const onRemove = () => {
        router.delete(brandingDestroy.url(), {
            preserveScroll: true,
            onSuccess: () => clearPreview(),
        });
    };

    return (
        <>
            <Head title="Branding" />

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Branding"
                    description="Set the logo shown in the sidebar and on sign-in screens."
                />

                <div
                    className={cn(
                        'rounded-xl border border-border/70 bg-card p-6 shadow-sm',
                        'sm:p-8',
                    )}
                >
                    <div className="grid gap-8 lg:grid-cols-[minmax(0,13rem)_1fr] lg:items-start">
                        <div className="flex flex-col items-center gap-4 lg:items-start">
                            <p className="text-center text-sm font-medium lg:w-full lg:text-left">
                                App logo
                            </p>
                            <div
                                className={cn(
                                    'flex size-32 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/30 shadow-sm',
                                )}
                            >
                                {shownSrc ? (
                                    <img
                                        src={shownSrc}
                                        alt={`${appName} logo`}
                                        className="size-full object-contain"
                                    />
                                ) : (
                                    <ImageOff
                                        aria-hidden
                                        className="size-8 text-muted-foreground/60"
                                    />
                                )}
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                name="logo"
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                onChange={onFileChange}
                            />

                            <div className="flex w-full max-w-52 flex-col gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onPick}
                                    disabled={processing}
                                >
                                    <Upload className="mr-2 size-4" />
                                    {logoUrl ? 'Replace logo' : 'Choose image'}
                                </Button>

                                {logoUrl ? (
                                    <ConfirmDeleteDialog
                                        title="Remove logo?"
                                        description="The app will fall back to the default mark until a new logo is uploaded."
                                        confirmLabel="Remove logo"
                                        onConfirm={onRemove}
                                        disabled={processing}
                                        trigger={
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="text-destructive hover:text-destructive"
                                            >
                                                Remove logo
                                            </Button>
                                        }
                                    />
                                ) : null}
                            </div>
                        </div>

                        <div className="space-y-3 text-sm text-muted-foreground">
                            <p>
                                Upload a square logo for the best result. JPG,
                                PNG, or WebP, up to 2&nbsp;MB.
                            </p>
                            <p>
                                The logo appears in the sidebar header and on the
                                sign-in and installer screens. Changes apply
                                immediately for everyone.
                            </p>
                            <InputError message={errors.logo} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
