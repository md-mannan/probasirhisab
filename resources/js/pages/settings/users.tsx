import { Form, Head, router, usePage } from '@inertiajs/react';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
    destroy,
    password as userPasswordRoute,
    store as usersStore,
} from '@/routes/settings/users';

type RowUser = {
    id: number;
    name: string;
    email: string;
    role: string;
    role_label: string;
};

type RoleOpt = { value: string; label: string };

type CreateUserFieldsProps = {
    errors: {
        name?: string;
        email?: string;
        password?: string;
        password_confirmation?: string;
        role?: string;
    };
    canAssignRoles: RoleOpt[];
    mode: 'wizard' | 'all';
    wizardStep: 1 | 2 | 3;
};

function CreateUserFields({
    errors,
    canAssignRoles,
    mode,
    wizardStep,
}: CreateUserFieldsProps) {
    const hidePanel = (step: 1 | 2 | 3): string =>
        mode === 'wizard' && wizardStep !== step ? 'hidden' : '';

    return (
        <div className="space-y-4">
            <div
                className={`grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-0 ${hidePanel(1)}`}
            >
                <FieldWithErrorSlot
                    label="Name"
                    htmlFor="nu_name"
                    error={errors.name}
                >
                    <Input
                        id="nu_name"
                        name="name"
                        required
                        autoComplete="name"
                    />
                </FieldWithErrorSlot>
                <FieldWithErrorSlot
                    label="Email"
                    htmlFor="nu_email"
                    error={errors.email}
                >
                    <Input
                        id="nu_email"
                        name="email"
                        type="email"
                        required
                        autoComplete="username"
                    />
                </FieldWithErrorSlot>
            </div>

            <div
                className={`grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-0 ${hidePanel(2)}`}
            >
                <FieldWithErrorSlot
                    label="Password"
                    htmlFor="nu_password"
                    error={errors.password}
                >
                    <Input
                        id="nu_password"
                        name="password"
                        type="password"
                        required
                        autoComplete="new-password"
                    />
                </FieldWithErrorSlot>
                <FieldWithErrorSlot
                    label="Confirm password"
                    htmlFor="nu_password_confirmation"
                    error={errors.password_confirmation}
                >
                    <Input
                        id="nu_password_confirmation"
                        name="password_confirmation"
                        type="password"
                        required
                        autoComplete="new-password"
                    />
                </FieldWithErrorSlot>
            </div>

            <div className={`grid max-w-md gap-1.5 ${hidePanel(3)}`}>
                <Label htmlFor="nu_role">Role</Label>
                <select
                    id="nu_role"
                    name="role"
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs ring-offset-background transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {canAssignRoles.map((r) => (
                        <option key={r.value} value={r.value}>
                            {r.label}
                        </option>
                    ))}
                </select>
                <InputError message={errors.role} />
            </div>
        </div>
    );
}

/** Keeps label/input baselines aligned when only one column shows an error (CSS Grid + equal column stretch). */
function FieldWithErrorSlot({
    label,
    htmlFor,
    error,
    children,
}: {
    label: string;
    htmlFor: string;
    error?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex h-full min-h-0 flex-col gap-1.5">
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
            <div className="">
                <InputError message={error} />
            </div>
        </div>
    );
}

export default function UsersSettings({
    users,
    roleOptions,
    canAssignRoles,
}: {
    users: RowUser[];
    roleOptions: RoleOpt[];
    canAssignRoles: RoleOpt[];
}) {
    const { auth } = usePage().props;

    const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<RowUser | null>(null);
    const [passwordDialogUser, setPasswordDialogUser] =
        useState<RowUser | null>(null);
    const [createUserOpen, setCreateUserOpen] = useState(false);
    const [createWizardStep, setCreateWizardStep] = useState<1 | 2 | 3>(1);

    const openRemoveConfirm = (user: RowUser): void => {
        setRemoveTarget(user);
        setRemoveDialogOpen(true);
    };

    const handleRemoveDialogOpenChange = (open: boolean): void => {
        setRemoveDialogOpen(open);

        if (!open) {
            setRemoveTarget(null);
        }
    };

    const handleRemoveConfirm = (): void => {
        if (!removeTarget) {
            return;
        }

        router.delete(destroy.url({ user: removeTarget.id }), {
            preserveScroll: true,
        });
    };

    return (
        <>
            <Head title="Users" />

            <h1 className="sr-only">Users</h1>

            <div className="space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <Heading
                        variant="small"
                        title="Users & roles"
                        description="Super admins manage admins and users; admins can add normal users only."
                    />
                    <Button
                        type="button"
                        className="shrink-0 sm:mt-0.5"
                        onClick={() => {
                            setCreateWizardStep(1);
                            setCreateUserOpen(true);
                        }}
                    >
                        <Plus className="size-4" />
                        Add user
                    </Button>
                </div>

                <section className="space-y-2">
                    <h2 className="text-sm font-medium text-foreground">
                        Team
                    </h2>
                    <ul className="divide-y divide-border rounded-lg border border-border/70">
                        {users.map((u) => {
                            const canActOnUser =
                                u.id !== auth.user?.id &&
                                !(
                                    auth.user?.role === 'admin' &&
                                    u.role !== 'user'
                                );

                            return (
                                <li
                                    key={u.id}
                                    className="flex flex-wrap items-center gap-3 px-4 py-3 first:rounded-t-lg last:rounded-b-lg"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium">
                                            {u.name}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {u.email}
                                        </p>
                                    </div>
                                    <select
                                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                                        value={u.role}
                                        disabled={
                                            u.id === auth.user?.id ||
                                            (auth.user?.role === 'admin' &&
                                                u.role !== 'user')
                                        }
                                        onChange={(e) => {
                                            router.patch(
                                                `/settings/users/${u.id}/role`,
                                                { role: e.target.value },
                                                { preserveScroll: true },
                                            );
                                        }}
                                    >
                                        {roleOptions.map((r) => (
                                            <option
                                                key={r.value}
                                                value={r.value}
                                            >
                                                {r.label}
                                            </option>
                                        ))}
                                    </select>
                                    {canActOnUser && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="shrink-0 text-muted-foreground hover:text-foreground"
                                            title="Set password for this user"
                                            aria-label={`Set password for ${u.name}`}
                                            onClick={() =>
                                                setPasswordDialogUser(u)
                                            }
                                        >
                                            <KeyRound className="size-4" />
                                        </Button>
                                    )}
                                    {canActOnUser && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="shrink-0 text-destructive hover:text-destructive"
                                            onClick={() =>
                                                openRemoveConfirm(u)
                                            }
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            </div>

            <Dialog
                open={createUserOpen}
                onOpenChange={(open) => {
                    setCreateUserOpen(open);

                    if (!open) {
                        setCreateWizardStep(1);
                    }
                }}
            >
                <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
                    <Form
                        id="create-user-wizard-form"
                        action={usersStore.url()}
                        method="post"
                        options={{ preserveScroll: true }}
                        resetOnSuccess
                        className="flex max-h-[inherit] min-h-0 flex-1 flex-col overflow-hidden"
                        onSuccess={() => {
                            setCreateUserOpen(false);
                            setCreateWizardStep(1);
                        }}
                    >
                        {({ processing, errors }) => {
                            const hasValidationErrors =
                                Object.keys(errors).length > 0;

                            const goNext = (): void => {
                                const formEl = document.getElementById(
                                    'create-user-wizard-form',
                                );

                                if (!(formEl instanceof HTMLFormElement)) {
                                    return;
                                }

                                const fd = new FormData(formEl);

                                if (createWizardStep === 1) {
                                    if (
                                        !String(fd.get('name') ?? '').trim() ||
                                        !String(fd.get('email') ?? '').trim()
                                    ) {
                                        return;
                                    }
                                }

                                if (createWizardStep === 2) {
                                    const pw = String(fd.get('password') ?? '');
                                    const pwc = String(
                                        fd.get('password_confirmation') ??
                                            '',
                                    );

                                    if (!pw || pw !== pwc) {
                                        return;
                                    }
                                }

                                setCreateWizardStep((s) => {
                                    if (s >= 3) {
                                        return s;
                                    }

                                    return (s + 1) as 1 | 2 | 3;
                                });
                            };

                            const stepLabel =
                                createWizardStep === 1
                                    ? 'Profile'
                                    : createWizardStep === 2
                                      ? 'Password'
                                      : 'Role';

                            return (
                                <>
                                    <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
                                        <DialogTitle>Add user</DialogTitle>
                                        <DialogDescription className="flex flex-wrap items-center justify-between gap-2">
                                            <span>
                                                {hasValidationErrors ? (
                                                    <>
                                                        Review all fields and
                                                        fix any errors below.
                                                    </>
                                                ) : (
                                                    <>
                                                        Step{' '}
                                                        {createWizardStep} of
                                                        3 — {stepLabel}
                                                    </>
                                                )}
                                            </span>
                                            {!hasValidationErrors ? (
                                                <span className="tabular-nums text-muted-foreground">
                                                    {createWizardStep}/3
                                                </span>
                                            ) : null}
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                                        <CreateUserFields
                                            errors={errors}
                                            canAssignRoles={canAssignRoles}
                                            mode={
                                                hasValidationErrors
                                                    ? 'all'
                                                    : 'wizard'
                                            }
                                            wizardStep={createWizardStep}
                                        />
                                    </div>

                                    <DialogFooter className="shrink-0 flex-wrap gap-2 border-t px-6 py-4">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setCreateUserOpen(false)
                                            }
                                        >
                                            Cancel
                                        </Button>
                                        {!hasValidationErrors &&
                                            createWizardStep > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setCreateWizardStep(
                                                            (s) =>
                                                                (s > 1
                                                                    ? s - 1
                                                                    : s) as
                                                                    | 1
                                                                    | 2
                                                                    | 3,
                                                        )
                                                    }
                                                >
                                                    Back
                                                </Button>
                                            )}
                                        {!hasValidationErrors &&
                                            createWizardStep < 3 && (
                                                <Button
                                                    type="button"
                                                    onClick={goNext}
                                                >
                                                    Next
                                                </Button>
                                            )}
                                        {(hasValidationErrors ||
                                            createWizardStep === 3) && (
                                            <Button
                                                type="submit"
                                                disabled={processing}
                                            >
                                                Create user
                                            </Button>
                                        )}
                                    </DialogFooter>
                                </>
                            );
                        }}
                    </Form>
                </DialogContent>
            </Dialog>

            <Dialog
                open={passwordDialogUser !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPasswordDialogUser(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    {passwordDialogUser && (
                        <Form
                            key={passwordDialogUser.id}
                            action={userPasswordRoute.url({
                                user: passwordDialogUser.id,
                            })}
                            method="patch"
                            options={{ preserveScroll: true }}
                            onSuccess={() => setPasswordDialogUser(null)}
                            resetOnSuccess
                        >
                            {({ errors, processing }) => (
                                <>
                                    <DialogHeader>
                                        <DialogTitle>Set password</DialogTitle>
                                        <DialogDescription>
                                            Set a new login password for{' '}
                                            <span className="font-medium text-foreground">
                                                {passwordDialogUser.name}
                                            </span>{' '}
                                            ({passwordDialogUser.email}).
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-3 py-1">
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="team_user_password">
                                                New password
                                            </Label>
                                            <Input
                                                id="team_user_password"
                                                name="password"
                                                type="password"
                                                required
                                                autoComplete="new-password"
                                            />
                                            <InputError
                                                message={errors.password}
                                            />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="team_user_password_confirmation">
                                                Confirm password
                                            </Label>
                                            <Input
                                                id="team_user_password_confirmation"
                                                name="password_confirmation"
                                                type="password"
                                                required
                                                autoComplete="new-password"
                                            />
                                            <InputError
                                                message={
                                                    errors.password_confirmation
                                                }
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setPasswordDialogUser(null)
                                            }
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                        >
                                            Save password
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={removeDialogOpen}
                onOpenChange={handleRemoveDialogOpenChange}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove user?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {removeTarget
                                ? `${removeTarget.name} will lose access immediately. This cannot be undone.`
                                : ''}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            onClick={handleRemoveConfirm}
                            className={cn(
                                'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
                            )}
                        >
                            Remove user
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

UsersSettings.layout = {
    breadcrumbs: [
        {
            title: 'Users',
            href: '/settings/users',
        },
    ],
};
