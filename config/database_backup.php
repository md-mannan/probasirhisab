<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Upload limits
    |--------------------------------------------------------------------------
    |
    | Maximum uploaded backup size (kilobytes) for restore operations.
    |
    */

    'max_upload_kilobytes' => (int) env('DB_BACKUP_MAX_UPLOAD_KB', 512_000),

    /*
    |--------------------------------------------------------------------------
    | Restore toggle
    |--------------------------------------------------------------------------
    |
    | When false, restore is disabled regardless of role (backup download may
    | still work). Useful as an emergency kill-switch in production.
    |
    */

    'restore_enabled' => filter_var(env('DB_BACKUP_RESTORE_ENABLED', true), FILTER_VALIDATE_BOOLEAN),

    /*
    |--------------------------------------------------------------------------
    | Confirmation phrase
    |--------------------------------------------------------------------------
    |
    | Exact text an admin must type before restore runs (case-sensitive).
    |
    */

    'confirm_phrase' => env('DB_BACKUP_CONFIRM_PHRASE', 'RESTORE'),

    /*
    |--------------------------------------------------------------------------
    | Client binaries
    |--------------------------------------------------------------------------
    |
    | Optional absolute paths to mysqldump / mysql when they are not on PATH.
    |
    */

    'binaries' => [
        'mysqldump' => env('MYSQLDUMP_PATH'),
        'mysql' => env('MYSQL_PATH'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Timeouts
    |--------------------------------------------------------------------------
    |
    | Maximum seconds for mysqldump / mysql restore subprocesses.
    |
    */

    'process_timeout_seconds' => (int) env('DB_BACKUP_PROCESS_TIMEOUT', 3600),

    /*
    |--------------------------------------------------------------------------
    | MySQL / MariaDB: what to dump
    |--------------------------------------------------------------------------
    |
    | By default only “essential” application tables are dumped (smaller,
    | safer backups). Set DB_BACKUP_ESSENTIAL_ONLY=false to dump the whole
    | database except tables listed in excluded_tables.
    |
    | Table names are verified against the schema before mysqldump runs.
    |
    */

    'mysql' => [
        'essential_only' => filter_var(env('DB_BACKUP_ESSENTIAL_ONLY', true), FILTER_VALIDATE_BOOLEAN),

        /*
         * Whitelist when essential_only is true. Laravel migrations history is
         * included so restores stay aligned with schema.
         */
        'essential_tables' => [
            'migrations',
            'exchange_rate_settings',
            'users',
            'categories',
            'contacts',
            'transactions',
            'ledger_entries',
            'transaction_settlements',
            'contact_transaction',
        ],

        /*
         * When essential_only is false, full DB dump minus these tables.
         */
        'excluded_tables' => [
            'sessions',
            'cache',
            'cache_locks',
            'jobs',
            'job_batches',
            'failed_jobs',
            'password_reset_tokens',
        ],
    ],

];
