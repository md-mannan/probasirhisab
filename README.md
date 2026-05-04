# Probasirhisab

Laravel + Inertia (React) app.

## Deploy on shared cPanel (recommended: Git deployment)

### 1) Create the database (MySQL)
- cPanel → **MySQL® Databases**
  - Create a database
  - Create a database user
  - Add user to database with **ALL PRIVILEGES**

### 2) Upload / deploy the code
#### Option A — cPanel “Git Version Control” (recommended)
1. Push your code to GitHub/GitLab.
2. cPanel → **Git Version Control** → **Create**
   - Clone URL: your repo URL
   - Repository Path: e.g. `/home/<cpanel_user>/repositories/probasirhisab`
3. Make sure your repo has `cpanel.yml` in the root.
4. In the repository page click:
   - **Update from Remote**
   - **Deploy HEAD Commit**

> If cPanel says it cannot deploy, it usually means:\n+> - `cpanel.yml` is missing, or\n+> - the server repo has uncommitted changes. Check via Terminal/SSH: `git status`.

#### Option B — Upload ZIP (manual)
Upload the project files to a folder outside `public_html` (recommended), e.g.:
`/home/<cpanel_user>/apps/probasirhisab`

### 3) Set the web root to the `public/` folder
You must serve the Laravel app from the `public/` directory.

Common approaches on shared hosting:
- **Best**: set the domain/subdomain document root directly to:\n+  `/home/<cpanel_user>/apps/probasirhisab/public`
- If you cannot change document root: keep app outside `public_html` and put only the `public/` contents inside the domain root, then adjust paths.\n+  (Changing document root is strongly preferred.)

### 4) Create `.env`
Copy `.env.example` to `.env` and fill values:

- **APP_ENV**: `production`
- **APP_DEBUG**: `false`
- **APP_URL**: your site URL
- **DB_CONNECTION**: `mysql`
- **DB_HOST / DB_PORT / DB_DATABASE / DB_USERNAME / DB_PASSWORD**: from step (1)

Then generate the app key:

```bash
php artisan key:generate
```

### 5) Install dependencies
From cPanel → **Terminal** (or SSH), run in the project root:

```bash
composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
```

### 6) Build frontend assets (Vite)
You have two choices:

#### A) Build on the server (only if Node/NPM is available)

```bash
npm ci
npm run build
```

#### B) Build locally and deploy `public/build`
Run locally:

```bash
npm ci
npm run build
```

Then upload/commit the generated `public/build` output (depending on your deployment workflow).

### 7) Run migrations + caches

```bash
php artisan migrate --force
php artisan config:cache
php artisan route:cache || true
php artisan view:cache
php artisan event:cache || true
```

### 8) Storage link + permissions

```bash
php artisan storage:link || true
```

Ensure these are writable by PHP:
- `storage/`
- `bootstrap/cache/`

On shared cPanel, permissions are commonly `775` for directories (varies by host). If you see “permission denied”, ask hosting support for the correct permissions/ownership.

### 9) Queue / scheduler (optional)
If you use the scheduler, add a cron job in cPanel:

```bash
* * * * * /usr/local/bin/php /home/<cpanel_user>/apps/probasirhisab/artisan schedule:run >> /dev/null 2>&1
```

If you use queues on shared hosting, prefer the **database** queue driver and run a supervisor/cron-based worker if available.

## First-time setup (in browser)
Open your site and follow the installer:
- `/install`

## Troubleshooting

### “Vite manifest not found” / blank page
- Run `npm run build` (or upload `public/build`).
- Make sure `public/build/manifest.json` exists on the server.

### 500 error
- Check `storage/logs/laravel.log`
- Ensure `storage/` and `bootstrap/cache/` are writable.
- Confirm `.env` values (APP_KEY, DB credentials).

### cPanel Git “cannot deploy”
- Ensure `cpanel.yml` is in repo root and committed.
- On server repo: `git status` must be clean.

