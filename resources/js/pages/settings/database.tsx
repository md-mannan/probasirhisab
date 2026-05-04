import { Form, Head } from '@inertiajs/react';
import { Database, Download } from 'lucide-react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { edit, download, restore } from '@/routes/settings/database';

type Props = {
    driverLabel: string;
    supportsBackup: boolean;
    supportsRestore: boolean;
    backupHint: string | null;
    restoreHint: string | null;
    mysqlBackupScopeDescription: string | null;
    confirmPhrase: string;
};

export default function DatabaseSettings({
    driverLabel,
    supportsBackup,
    supportsRestore,
    backupHint,
    restoreHint,
    mysqlBackupScopeDescription,
    confirmPhrase,
}: Props) {
    const restoreAccept =
        driverLabel === 'SQLite' ? '.sqlite' : '.sql';

    return (
        <>
            <Head title="Database backup" />

            <h1 className="sr-only">Database backup</h1>

            <div className="space-y-10">
                <Heading
                    variant="small"
                    title="Database backup & restore"
                    description={`${driverLabel} — Super admins and admins can download a backup or restore from a previous backup file. Restore replaces all application data irreversibly.`}
                />

                <section className="space-y-3 rounded-lg border border-border/70 bg-card p-6">
                    <div className="flex items-start gap-3">
                        <Download
                            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                            aria-hidden
                        />
                        <div className="min-w-0 flex-1 space-y-2">
                            <h2 className="text-sm font-medium">
                                Download backup
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {driverLabel === 'SQLite'
                                    ? 'Downloads a copy of your SQLite database file.'
                                    : (mysqlBackupScopeDescription ??
                                      'Creates an SQL dump using mysqldump (single transaction).')}
                            </p>
                            {backupHint ? (
                                <p className="text-sm text-amber-700 dark:text-amber-400">
                                    {backupHint}
                                </p>
                            ) : null}
                            <div>
                                {supportsBackup ? (
                                    <Button asChild>
                                        <a href={download.url()}>
                                            <Download className="mr-2 size-4" />
                                            Download backup
                                        </a>
                                    </Button>
                                ) : (
                                    <Button type="button" disabled>
                                        <Download className="mr-2 size-4" />
                                        Download backup
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="space-y-4 rounded-lg border border-destructive/30 bg-card p-6">
                    <div className="flex items-start gap-3">
                        <Database
                            className="mt-0.5 size-5 shrink-0 text-destructive"
                            aria-hidden
                        />
                        <div className="min-w-0 flex-1 space-y-4">
                            <div>
                                <h2 className="text-sm font-medium text-destructive">
                                    Restore from backup
                                </h2>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    This overwrites the live database. All users
                                    should stop using the app during restore.
                                    You must confirm your password and type the
                                    confirmation phrase exactly.
                                </p>
                                {restoreHint ? (
                                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                                        {restoreHint}
                                    </p>
                                ) : null}
                            </div>

                            <Form
                                action={restore.url()}
                                method="post"
                                encType="multipart/form-data"
                                options={{
                                    preserveScroll: true,
                                }}
                                className="space-y-4"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="space-y-2">
                                            <Label htmlFor="backup_file">
                                                Backup file ({restoreAccept})
                                            </Label>
                                            <Input
                                                id="backup_file"
                                                name="backup"
                                                type="file"
                                                accept={restoreAccept}
                                                disabled={
                                                    !supportsRestore ||
                                                    processing
                                                }
                                                required={supportsRestore}
                                            />
                                            <InputError
                                                message={errors.backup}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="current_password">
                                                Your password
                                            </Label>
                                            <Input
                                                id="current_password"
                                                name="current_password"
                                                type="password"
                                                autoComplete="current-password"
                                                disabled={
                                                    !supportsRestore ||
                                                    processing
                                                }
                                                required={supportsRestore}
                                            />
                                            <InputError
                                                message={
                                                    errors.current_password
                                                }
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="confirm_restore">
                                                Type{' '}
                                                <span className="font-mono">
                                                    {confirmPhrase}
                                                </span>{' '}
                                                to confirm
                                            </Label>
                                            <Input
                                                id="confirm_restore"
                                                name="confirm_restore"
                                                type="text"
                                                autoComplete="off"
                                                disabled={
                                                    !supportsRestore ||
                                                    processing
                                                }
                                                required={supportsRestore}
                                                className="font-mono"
                                            />
                                            <InputError
                                                message={
                                                    errors.confirm_restore
                                                }
                                            />
                                        </div>

                                        <div>
                                            <Button
                                                type="submit"
                                                variant="destructive"
                                                disabled={
                                                    !supportsRestore ||
                                                    processing
                                                }
                                            >
                                                {processing
                                                    ? 'Restoring…'
                                                    : 'Restore database'}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </Form>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}

DatabaseSettings.layout = {
    breadcrumbs: [
        {
            title: 'Database',
            href: edit.url(),
        },
    ],
};
