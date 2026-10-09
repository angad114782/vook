# Deploying Vook (frontend + API) to the VPS

Every push to the `frontend` branch runs `.github/workflows/deploy.yml`. It builds the app and the API, **checks the server is ready first**, uploads and restarts the API, and only then replaces the website files. If the server is not set up yet, the run stops with a plain message and **the live site is not changed**.

```
Browser ──► Nginx (influencersfeed.com)
              ├─ /            → static files in /var/www/influencersfeed.com/dist
              ├─ /api/        → Vook API on 127.0.0.1:4000   (systemd service `vook-api`)
              └─ /socket.io/  → same API (live notifications)
                                   └─ MongoDB Atlas
```

## One-time setup (do these once, on the VPS, as root)

### 1. Node.js 24
The API needs Node 24 or newer in `/usr/bin/node`.
```bash
node -v        # must print v24 or higher
```
If not, install it (NodeSource or your usual way) and make sure `/usr/bin/node` points to it.

### 2. A user and folders
```bash
useradd --system --home /var/lib/vook --shell /usr/sbin/nologin vook
mkdir -p /var/lib/vook/uploads /etc/vook /var/www/influencersfeed.com/server
chown -R vook:vook /var/lib/vook
```

### 3. The secret settings file
Copy `deploy/server.env.example` to `/etc/vook/server.env` and fill it in.
```bash
nano /etc/vook/server.env
chmod 640 /etc/vook/server.env && chown root:vook /etc/vook/server.env
```
You must set:
- `MONGODB_URI`: your Atlas connection string. In Atlas → **Network Access**, add the VPS's public IP.
- `MONGODB_DB`: use a **new** name such as `vook` (not the demo database).
- `SECRETS_KEY`: run `openssl rand -base64 32` and paste the result. **Keep a copy somewhere safe** (a password manager). Without it, saved payment and email passwords cannot be read again.
- `CORS_ORIGIN`: `https://influencersfeed.com` (your real address).
- Leave `SEED_DEMO=false`, `COOKIE_SECURE=true`, `HOST=127.0.0.1`.

### 4. The service
```bash
cp deploy/vook-api.service /etc/systemd/system/vook-api.service   # or paste its contents
systemctl daemon-reload
systemctl enable vook-api
```
(It starts for the first time when the workflow deploys. You do not need to start it now.)

### 5. Nginx
Open the Nginx file for influencersfeed.com and add the blocks from `deploy/nginx-vook.conf` **inside** the existing `server { ... }`: the `/api/` and `/socket.io/` proxies, `client_max_body_size`, and the `try_files ... /index.html` line for `/`.
```bash
nginx -t && systemctl reload nginx
```

### 6. GitHub secrets (already there)
`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` already exist for the old frontend-only deploy. Nothing new is needed. The SSH user must be allowed to run `systemctl`, `nginx` and `npm` (root is simplest).

### 7. Deploy, then create the first admin
Push to `frontend` (or Actions → *Deploy Vook* → *Run workflow*). When it is green, create the first real Super Admin **on the VPS**:
```bash
cd /var/www/influencersfeed.com/server
set -a; . /etc/vook/server.env; set +a
ADMIN_PASSWORD='a-long-password-with-1-number' node dist/seed/createAdminCli.js "Your Name" you@yourdomain.com
```
(The password is read from `ADMIN_PASSWORD`, not typed after the command, so it stays out of your shell history. Use at least 12 characters with letters and a number.)

Sign in at `https://influencersfeed.com/login`, then turn on two-step sign-in under *Account security*. After that, create companies and plans from the Super Admin screens.

## What the server will NOT do in production
- No demo data and no `Demo@123` accounts (`SEED_DEMO` is off by default when `NODE_ENV=production`).
- No one-click developer sign-in (it only works in development, on localhost).
- The API listens only on `127.0.0.1`, so it can be reached only through Nginx.

## Day to day
- **Deploy:** push to `frontend`.
- **Logs:** `journalctl -u vook-api -f`
- **Restart:** `systemctl restart vook-api`
- **Health:** `curl http://127.0.0.1:4000/ready` on the VPS
- **Roll back:** in GitHub, re-run the workflow on the last good commit (Actions → pick the run → *Re-run all jobs*), or push a revert.
- **Backups:** Atlas takes them (check your plan). Uploaded files are in `/var/lib/vook/uploads`; include that folder in your VPS backup.

## Checks that run before anything is uploaded
API contract file up to date · frontend build (includes type-check) · API type-check · API build. The API's own test suite needs a MongoDB and is run on your computer (`cd server && npm test`), not in this workflow.
