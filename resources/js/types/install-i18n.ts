/** Mirrors PHP lang install.php files and config locales (keys only). */

export type LocaleMeta = {
    label: string;
    native: string;
};

export type InstallValidationMessages = {
    app_name_required: string;
    app_name_max: string;
    app_url_max: string;
    app_url_invalid: string;
    logo_max: string;
    logo_type: string;
    db_database_required_sqlite: string;
    db_database_required_mysql: string;
    db_database_max: string;
    db_host_required: string;
    db_host_max: string;
    db_port_range: string;
    db_username_required: string;
    db_username_max: string;
    admin_name_required: string;
    admin_name_max: string;
    admin_email_required: string;
    admin_email_max: string;
    admin_email_invalid: string;
    admin_password_required: string;
    admin_password_min: string;
    admin_password_confirmation_required: string;
    admin_password_confirmation_mismatch: string;
};

export type InstallTranslations = {
    meta: { title: string; head_title: string };
    brand: { setup: string; footer_note: string };
    nav: { steps: string; installation_steps: string; mobile_step: string };
    language: { label: string; hint: string };
    steps: Record<
        'requirements' | 'application' | 'database' | 'admin',
        { title: string; description: string }
    >;
    requirements: {
        system_checks: string;
        intro: string;
        php_version: string;
        writable: string;
        env_file: string;
        fix_hint: string;
    };
    application_step: {
        workspace: string;
        workspace_hint: string;
        app_name: string;
        app_url: string;
        logo: string;
        placeholder_company: string;
        placeholder_url: string;
    };
    database_step: {
        intro: string;
        driver: string;
        sqlite_file: string;
        mysql_host: string;
        mysql_port: string;
        mysql_database: string;
        mysql_username: string;
        mysql_password: string;
        driver_sqlite: string;
        driver_mysql: string;
        placeholder_sqlite: string;
    };
    admin_step: {
        super_admin: string;
        intro: string;
        name: string;
        email: string;
        password: string;
        password_confirmation: string;
    };
    buttons: { back: string; continue: string; finish: string };
    validation: InstallValidationMessages;
};

/** Replace :max, :min etc. (Laravel-style) in strings from PHP. */
export function interpolateTemplate(
    template: string,
    vars: Record<string, string | number>,
): string {
    let s = template;

    for (const [key, value] of Object.entries(vars)) {
        s = s.replaceAll(`:${key}`, String(value));
    }

    return s;
}
