<?php

return [

    'meta' => [
        'title' => 'Install',
        'head_title' => 'Install',
    ],

    'brand' => [
        'setup' => 'Setup',
        'footer_note' => 'After setup you can log in and invite admins from Settings.',
    ],

    'nav' => [
        'steps' => 'Steps',
        'installation_steps' => 'Installation steps',
        'mobile_step' => 'Step :current of :total',
    ],

    'language' => [
        'label' => 'Language',
        'hint' => 'This becomes the default language for the whole app (saved to .env).',
    ],

    'steps' => [
        'requirements' => [
            'title' => 'Requirements',
            'description' => 'Environment checks',
        ],
        'application' => [
            'title' => 'Application',
            'description' => 'Name & branding',
        ],
        'database' => [
            'title' => 'Database',
            'description' => 'Connection details',
        ],
        'admin' => [
            'title' => 'Super admin',
            'description' => 'First account',
        ],
    ],

    'requirements' => [
        'system_checks' => 'System checks',
        'intro' => 'These must pass before you can continue.',
        'php_version' => 'PHP 8.3+',
        'writable' => 'Writable storage & cache',
        'env_file' => 'Environment file',
        'fix_hint' => 'Fix the failed checks above before continuing.',
    ],

    'application_step' => [
        'workspace' => 'Workspace',
        'workspace_hint' => 'Shown in the header and browser title.',
        'app_name' => 'Application name',
        'app_url' => 'App URL (optional)',
        'logo' => 'Logo (optional)',
        'placeholder_company' => 'My company',
        'placeholder_url' => 'https://app.example.com',
    ],

    'database_step' => [
        'intro' => 'Use SQLite for a quick local setup, or MySQL for production.',
        'driver' => 'Driver',
        'sqlite_file' => 'Database file (under project / database)',
        'mysql_host' => 'Host',
        'mysql_port' => 'Port',
        'mysql_database' => 'Database name',
        'mysql_username' => 'Username',
        'mysql_password' => 'Password',
        'driver_sqlite' => 'SQLite (file)',
        'driver_mysql' => 'MySQL / MariaDB',
        'placeholder_sqlite' => 'database.sqlite',
    ],

    'admin_step' => [
        'super_admin' => 'Super admin',
        'intro' => 'Full access; can create admins and users later.',
        'name' => 'Name',
        'email' => 'Email',
        'password' => 'Password',
        'password_confirmation' => 'Confirm password',
    ],

    'buttons' => [
        'back' => 'Back',
        'continue' => 'Continue',
        'finish' => 'Finish installation',
    ],

    'validation' => [
        'app_name_required' => 'Application name is required.',
        'app_name_max' => 'Application name must be at most :max characters.',
        'app_url_max' => 'URL must be at most :max characters.',
        'app_url_invalid' => 'Enter a valid URL (include http:// or https://).',
        'logo_max' => 'Logo must be 2048 KB or less.',
        'logo_type' => 'Logo must be PNG, JPG, SVG, or WebP.',
        'db_database_required_sqlite' => 'Database file path is required.',
        'db_database_required_mysql' => 'Database name is required.',
        'db_database_max' => 'Must be at most :max characters.',
        'db_host_required' => 'Host is required.',
        'db_host_max' => 'Host must be at most :max characters.',
        'db_port_range' => 'Port must be a number between 1 and 65535.',
        'db_username_required' => 'Username is required.',
        'db_username_max' => 'Username must be at most :max characters.',
        'admin_name_required' => 'Name is required.',
        'admin_name_max' => 'Name must be at most :max characters.',
        'admin_email_required' => 'Email is required.',
        'admin_email_max' => 'Email must be at most :max characters.',
        'admin_email_invalid' => 'Enter a valid email address.',
        'admin_password_required' => 'Password is required.',
        'admin_password_min' => 'Password must be at least :min characters.',
        'admin_password_confirmation_required' => 'Confirm your password.',
        'admin_password_confirmation_mismatch' => 'Password confirmation does not match.',
    ],

];
