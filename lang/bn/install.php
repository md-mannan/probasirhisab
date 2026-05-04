<?php

return [

    'meta' => [
        'title' => 'ইনস্টল',
        'head_title' => 'ইনস্টল',
    ],

    'brand' => [
        'setup' => 'সেটআপ',
        'footer_note' => 'সেটআপ শেষে আপনি লগইন করে সেটিংস থেকে অ্যাডমিন আমন্ত্রণ করতে পারবেন।',
    ],

    'nav' => [
        'steps' => 'ধাপ',
        'installation_steps' => 'ইনস্টলেশনের ধাপ',
        'mobile_step' => 'ধাপ :current / :total',
    ],

    'language' => [
        'label' => 'ভাষা',
        'hint' => 'এটি সম্পূর্ণ অ্যাপের ডিফল্ট ভাষা হবে (.env এ সংরক্ষিত)।',
    ],

    'steps' => [
        'requirements' => [
            'title' => 'প্রয়োজনীয়তা',
            'description' => 'পরিবেশ পরীক্ষা',
        ],
        'application' => [
            'title' => 'অ্যাপ্লিকেশন',
            'description' => 'নাম ও ব্র্যান্ডিং',
        ],
        'database' => [
            'title' => 'ডাটাবেস',
            'description' => 'সংযোগের বিবরণ',
        ],
        'admin' => [
            'title' => 'সুপার অ্যাডমিন',
            'description' => 'প্রথম অ্যাকাউন্ট',
        ],
    ],

    'requirements' => [
        'system_checks' => 'সিস্টেম পরীক্ষা',
        'intro' => 'চালিয়ে যাওয়ার আগে এগুলো পাস করতে হবে।',
        'php_version' => 'PHP 8.3+',
        'writable' => 'লিখনযোগ্য স্টোরেজ ও ক্যাশ',
        'env_file' => 'পরিবেশ ফাইল',
        'fix_hint' => 'চালিয়ে যাওয়ার আগে উপরের ব্যর্থ পরীক্ষাগুলো ঠিক করুন।',
    ],

    'application_step' => [
        'workspace' => 'ওয়ার্কস্পেস',
        'workspace_hint' => 'হেডার ও ব্রাউজার শিরোনামে দেখাবে।',
        'app_name' => 'অ্যাপ্লিকেশনের নাম',
        'app_url' => 'অ্যাপ URL (ঐচ্ছিক)',
        'logo' => 'লোগো (ঐচ্ছিক)',
        'placeholder_company' => 'আমার প্রতিষ্ঠান',
        'placeholder_url' => 'https://app.example.com',
    ],

    'database_step' => [
        'intro' => 'দ্রুত লোকাল সেটআপের জন্য SQLite, প্রোডাকশনে MySQL ব্যবহার করুন।',
        'driver' => 'ড্রাইভার',
        'sqlite_file' => 'ডাটাবেস ফাইল (প্রজেক্ট / database এর অধীনে)',
        'mysql_host' => 'হোস্ট',
        'mysql_port' => 'পোর্ট',
        'mysql_database' => 'ডাটাবেসের নাম',
        'mysql_username' => 'ব্যবহারকারীর নাম',
        'mysql_password' => 'পাসওয়ার্ড',
        'driver_sqlite' => 'SQLite (ফাইল)',
        'driver_mysql' => 'MySQL / MariaDB',
        'placeholder_sqlite' => 'database.sqlite',
    ],

    'admin_step' => [
        'super_admin' => 'সুপার অ্যাডমিন',
        'intro' => 'পূর্ণ অ্যাক্সেস; পরে অ্যাডমিন ও ব্যবহারকারী তৈরি করা যাবে।',
        'name' => 'নাম',
        'email' => 'ইমেইল',
        'password' => 'পাসওয়ার্ড',
        'password_confirmation' => 'পাসওয়ার্ড নিশ্চিত করুন',
    ],

    'buttons' => [
        'back' => 'পিছনে',
        'continue' => 'চালিয়ে যান',
        'finish' => 'ইনস্টলেশন শেষ করুন',
    ],

    'validation' => [
        'app_name_required' => 'অ্যাপ্লিকেশনের নাম প্রয়োজন।',
        'app_name_max' => 'অ্যাপ্লিকেশনের নাম সর্বোচ্চ :max অক্ষর হতে পারে।',
        'app_url_max' => 'URL সর্বোচ্চ :max অক্ষর হতে পারে।',
        'app_url_invalid' => 'সঠিক URL লিখুন (http:// বা https:// সহ)।',
        'logo_max' => 'লোগো সর্বোচ্চ ২০৪৮ KB হতে হবে।',
        'logo_type' => 'লোগো PNG, JPG, SVG, অথবা WebP হতে হবে।',
        'db_database_required_sqlite' => 'ডাটাবেস ফাইলের পথ প্রয়োজন।',
        'db_database_required_mysql' => 'ডাটাবেসের নাম প্রয়োজন।',
        'db_database_max' => 'সর্বোচ্চ :max অক্ষর হতে পারে।',
        'db_host_required' => 'হোস্ট প্রয়োজন।',
        'db_host_max' => 'হোস্ট সর্বোচ্চ :max অক্ষর হতে পারে।',
        'db_port_range' => 'পোর্ট ১ থেকে ৬৫৫৩৫ এর মধ্যে একটি সংখ্যা হতে হবে।',
        'db_username_required' => 'ব্যবহারকারীর নাম প্রয়োজন।',
        'db_username_max' => 'ব্যবহারকারীর নাম সর্বোচ্চ :max অক্ষর হতে পারে।',
        'admin_name_required' => 'নাম প্রয়োজন।',
        'admin_name_max' => 'নাম সর্বোচ্চ :max অক্ষর হতে পারে।',
        'admin_email_required' => 'ইমেইল প্রয়োজন।',
        'admin_email_max' => 'ইমেইল সর্বোচ্চ :max অক্ষর হতে পারে।',
        'admin_email_invalid' => 'সঠিক ইমেইল ঠিকানা লিখুন।',
        'admin_password_required' => 'পাসওয়ার্ড প্রয়োজন।',
        'admin_password_min' => 'পাসওয়ার্ড কমপক্ষে :min অক্ষরের হতে হবে।',
        'admin_password_confirmation_required' => 'পাসওয়ার্ড নিশ্চিত করুন।',
        'admin_password_confirmation_mismatch' => 'পাসওয়ার্ড মিলছে না।',
    ],

];
