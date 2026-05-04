/** Client-side rules aligned with `InstallController` / Laravel validation. */

import type { InstallValidationMessages } from '@/types/install-i18n';
import { interpolateTemplate } from '@/types/install-i18n';

const MAX_SHORT = 100;
const MAX_MEDIUM = 255;
const LOGO_MAX_BYTES = 2048 * 1024;

export type DbDriver = 'mysql' | 'sqlite';

export function parseInstallFormData(fd: FormData): {
    app_name: string;
    app_url: string;
    db_driver: string;
    db_host: string;
    db_port: string;
    db_database: string;
    db_username: string;
    db_password: string;
    admin_name: string;
    admin_email: string;
    admin_password: string;
    admin_password_confirmation: string;
} {
    return {
        app_name: String(fd.get('app_name') ?? '').trim(),
        app_url: String(fd.get('app_url') ?? '').trim(),
        db_driver: String(fd.get('db_driver') ?? ''),
        db_host: String(fd.get('db_host') ?? '').trim(),
        db_port: String(fd.get('db_port') ?? '').trim(),
        db_database: String(fd.get('db_database') ?? '').trim(),
        db_username: String(fd.get('db_username') ?? '').trim(),
        db_password: String(fd.get('db_password') ?? ''),
        admin_name: String(fd.get('admin_name') ?? '').trim(),
        admin_email: String(fd.get('admin_email') ?? '').trim(),
        admin_password: String(fd.get('admin_password') ?? ''),
        admin_password_confirmation: String(
            fd.get('admin_password_confirmation') ?? '',
        ),
    };
}

function validateLogo(
    fd: FormData,
    vm: InstallValidationMessages,
): Record<string, string> {
    const logo = fd.get('logo');

    if (!(logo instanceof File) || logo.size === 0) {
        return {};
    }

    const err: Record<string, string> = {};

    if (logo.size > LOGO_MAX_BYTES) {
        err.logo = vm.logo_max;
    }

    const allowed = new Set([
        'image/jpeg',
        'image/png',
        'image/svg+xml',
        'image/webp',
    ]);

    if (logo.type && !allowed.has(logo.type)) {
        err.logo = vm.logo_type;
    }

    return err;
}

export function validateInstallStep(
    step: number,
    fd: FormData,
    vm: InstallValidationMessages,
): Record<string, string> {
    const v = parseInstallFormData(fd);
    const driver: DbDriver =
        v.db_driver === 'mysql' ? 'mysql' : 'sqlite';
    const err: Record<string, string> = {};

    if (step === 1) {
        if (!v.app_name) {
            err.app_name = vm.app_name_required;
        } else if (v.app_name.length > MAX_SHORT) {
            err.app_name = interpolateTemplate(vm.app_name_max, {
                max: MAX_SHORT,
            });
        }

        if (v.app_url.length > MAX_MEDIUM) {
            err.app_url = interpolateTemplate(vm.app_url_max, {
                max: MAX_MEDIUM,
            });
        } else if (v.app_url) {
            const ok = (() => {
                try {
                    const u = new URL(v.app_url);

                    return u.protocol === 'http:' || u.protocol === 'https:';
                } catch {
                    return false;
                }
            })();

            if (!ok) {
                err.app_url = vm.app_url_invalid;
            }
        }

        Object.assign(err, validateLogo(fd, vm));

        return err;
    }

    if (step === 2) {
        if (!v.db_database) {
            err.db_database =
                driver === 'sqlite'
                    ? vm.db_database_required_sqlite
                    : vm.db_database_required_mysql;
        } else if (v.db_database.length > MAX_MEDIUM) {
            err.db_database = interpolateTemplate(vm.db_database_max, {
                max: MAX_MEDIUM,
            });
        }

        if (driver === 'mysql') {
            if (!v.db_host) {
                err.db_host = vm.db_host_required;
            } else if (v.db_host.length > MAX_MEDIUM) {
                err.db_host = interpolateTemplate(vm.db_host_max, {
                    max: MAX_MEDIUM,
                });
            }

            if (v.db_port === '') {
                err.db_port = vm.db_port_range;
            } else {
                const p = Number.parseInt(v.db_port, 10);

                if (
                    Number.isNaN(p) ||
                    p < 1 ||
                    p > 65535
                ) {
                    err.db_port = vm.db_port_range;
                }
            }

            if (!v.db_username) {
                err.db_username = vm.db_username_required;
            } else if (v.db_username.length > MAX_MEDIUM) {
                err.db_username = interpolateTemplate(vm.db_username_max, {
                    max: MAX_MEDIUM,
                });
            }
        }

        return err;
    }

    if (step === 3) {
        if (!v.admin_name) {
            err.admin_name = vm.admin_name_required;
        } else if (v.admin_name.length > MAX_MEDIUM) {
            err.admin_name = interpolateTemplate(vm.admin_name_max, {
                max: MAX_MEDIUM,
            });
        }

        if (!v.admin_email) {
            err.admin_email = vm.admin_email_required;
        } else if (v.admin_email.length > MAX_MEDIUM) {
            err.admin_email = interpolateTemplate(vm.admin_email_max, {
                max: MAX_MEDIUM,
            });
        } else if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.admin_email)
        ) {
            err.admin_email = vm.admin_email_invalid;
        }

        if (!v.admin_password) {
            err.admin_password = vm.admin_password_required;
        } else if (v.admin_password.length < 8) {
            err.admin_password = interpolateTemplate(vm.admin_password_min, {
                min: 8,
            });
        }

        if (!v.admin_password_confirmation) {
            err.admin_password_confirmation =
                vm.admin_password_confirmation_required;
        } else if (
            v.admin_password !== v.admin_password_confirmation
        ) {
            err.admin_password_confirmation =
                vm.admin_password_confirmation_mismatch;
        }

        return err;
    }

    return err;
}

/** Full form validation before POST (all wizard steps). */
export function validateFullInstall(
    fd: FormData,
    vm: InstallValidationMessages,
): Record<string, string> {
    return {
        ...validateInstallStep(1, fd, vm),
        ...validateInstallStep(2, fd, vm),
        ...validateInstallStep(3, fd, vm),
    };
}

/** First step index (1–3) that contains an error key, or null. */
export function stepForField(field: string): 1 | 2 | 3 | null {
    if (
        field === 'app_name' ||
        field === 'app_url' ||
        field === 'logo'
    ) {
        return 1;
    }

    if (
        field.startsWith('db_') ||
        field === 'db'
    ) {
        return 2;
    }

    if (field.startsWith('admin_')) {
        return 3;
    }

    return null;
}

export function firstStepWithErrors(
    errs: Record<string, string>,
): 1 | 2 | 3 | null {
    const keys = Object.keys(errs);

    if (keys.length === 0) {
        return null;
    }

    const steps = keys
        .map(stepForField)
        .filter((s): s is 1 | 2 | 3 => s !== null);

    if (steps.length === 0) {
        return null;
    }

    return Math.min(...steps) as 1 | 2 | 3;
}

export function fieldError(
    server: Partial<Record<string, string | string[]>>,
    client: Record<string, string>,
    key: string,
    /** Keys marked dismissed for this `serverSig` only (user edited after that response). */
    dismissedAtSig?: Record<string, string>,
    serverSig?: string,
): string | undefined {
    if (
        dismissedAtSig &&
        serverSig !== undefined &&
        dismissedAtSig[key] === serverSig
    ) {
        return client[key];
    }

    const s = server[key];

    if (s !== undefined && s !== null) {
        return Array.isArray(s) ? s[0] : s;
    }

    return client[key];
}
