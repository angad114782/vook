#!/usr/bin/env bash
# Vook VPS helper. Run it on the VPS as the user GitHub deploys with (usually root):
#
#   curl -fsSL https://raw.githubusercontent.com/angad114782/vook/frontend/deploy/server-setup.sh | bash
#
# It checks everything the deploy needs, does the safe parts for you (installs pm2, makes folders, creates the settings
# file with a fresh SECRETS_KEY) and prints what is still left for you. It never overwrites a settings file that exists,
# never edits Nginx, and never installs Node. Run it as many times as you like.
set -u

ENV_FILE="${VOOK_ENV_FILE:-/etc/vook/server.env}"
UPLOADS="${VOOK_UPLOADS:-/var/lib/vook/uploads}"
APP_DIR="${VOOK_APP_DIR:-/var/www/influencersfeed.com}"
TODO=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
todo() { printf '  \033[31m✗\033[0m %s\n' "$1"; TODO=$((TODO + 1)); }
note() { printf '  · %s\n' "$1"; }

echo "Vook server check"

echo; echo "1. Node.js and pm2"
NODE_OK=0
if command -v node >/dev/null 2>&1 && node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)'; then ok "Node.js $(node -v)"; NODE_OK=1
else todo "Node.js 24 or newer is needed (found: $(node -v 2>/dev/null || echo none)). Install it, then run this again."; fi
if command -v pm2 >/dev/null 2>&1; then ok "pm2 $(pm2 -v 2>/dev/null)"
elif [ "$NODE_OK" = 1 ] && [ "${SKIP_PM2_INSTALL:-0}" != 1 ]; then
  if npm install -g pm2 >/dev/null 2>&1 && command -v pm2 >/dev/null 2>&1; then ok "pm2 was not there, so it was installed ($(pm2 -v))"; else todo "pm2 could not be installed. Run: npm install -g pm2"; fi
else todo "pm2 is missing. Run: npm install -g pm2"; fi

echo; echo "2. Folders"
if mkdir -p "$UPLOADS" "$(dirname "$ENV_FILE")" "$APP_DIR/server" 2>/dev/null; then ok "$UPLOADS and $APP_DIR/server are ready"; else todo "Could not create folders. Run this as root (or the deploy user with sudo)."; fi

echo; echo "3. Settings file $ENV_FILE"
if [ ! -f "$ENV_FILE" ]; then
  KEY="$(openssl rand -base64 32 2>/dev/null)"
  if [ -z "$KEY" ]; then todo "openssl is missing, so SECRETS_KEY could not be made. Install openssl and run this again.";
  else
    umask 077
    cat > "$ENV_FILE" <<ENVEOF
NODE_ENV=production
PORT=4000
HOST=127.0.0.1
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=vook
CORS_ORIGIN=https://influencersfeed.com
COOKIE_SECURE=true
TRUST_PROXY=1
SECRETS_KEY=$KEY
SEED_DEMO=false
BOT_GUARD=auto
UPLOAD_DIR=$UPLOADS
MAX_UPLOAD_MB=10
LOG_LEVEL=info
ENVEOF
    chmod 600 "$ENV_FILE"
    ok "Created $ENV_FILE with a new SECRETS_KEY. Copy that line to a password manager now."
  fi
fi
if [ -f "$ENV_FILE" ]; then
  val() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2-; }
  URI="$(val MONGODB_URI)"
  case "$URI" in
    ""|*USER:PASSWORD*) todo "Put your real Atlas connection string in MONGODB_URI (edit $ENV_FILE). Also allow this server's IP in Atlas → Network Access." ;;
    mongodb*) ok "MONGODB_URI is set" ;;
    *) todo "MONGODB_URI should start with mongodb:// or mongodb+srv://" ;;
  esac
  [ -n "$(val SECRETS_KEY)" ] && ok "SECRETS_KEY is set (keep a safe copy)" || todo "SECRETS_KEY is empty. Run: openssl rand -base64 32  and paste it in $ENV_FILE"
  [ "$(val SEED_DEMO)" = "false" ] && ok "SEED_DEMO=false (no demo accounts)" || todo "Set SEED_DEMO=false in $ENV_FILE"
  [ "$(val COOKIE_SECURE)" = "true" ] && ok "COOKIE_SECURE=true" || todo "Set COOKIE_SECURE=true in $ENV_FILE"
  [ "$(val HOST)" = "127.0.0.1" ] && ok "HOST=127.0.0.1 (only Nginx can reach the API)" || todo "Set HOST=127.0.0.1 in $ENV_FILE"
  case "$(val CORS_ORIGIN)" in https://*) ok "CORS_ORIGIN=$(val CORS_ORIGIN)" ;; *) todo "Set CORS_ORIGIN to your https address in $ENV_FILE" ;; esac
  PERM="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE" 2>/dev/null)"
  case "$PERM" in 600|640|400) ok "File permissions $PERM" ;; *) chmod 600 "$ENV_FILE" 2>/dev/null && ok "Permissions tightened to 600" || todo "Run: chmod 600 $ENV_FILE" ;; esac
fi

echo; echo "4. Nginx"
if command -v nginx >/dev/null 2>&1; then
  if nginx -T 2>/dev/null | grep -q "proxy_pass http://127.0.0.1:4000"; then ok "Nginx already sends /api/ to the API"
  else todo "Add the blocks from deploy/nginx-vook.conf inside your server { } block, then run: nginx -t && systemctl reload nginx"; fi
else todo "nginx is not installed here."; fi

echo; echo "5. Start on reboot, and the API itself"
if command -v pm2 >/dev/null 2>&1; then
  if systemctl is-enabled "pm2-$(id -un)" >/dev/null 2>&1; then ok "pm2 starts again after a reboot"
  else todo "Run: pm2 startup   (it prints one command; copy it and run it)"; fi
  if pm2 describe vook-api >/dev/null 2>&1; then
    pm2 describe vook-api 2>/dev/null | grep -q "online" && ok "vook-api is running under pm2" || todo "vook-api exists but is not online. See: pm2 logs vook-api"
    curl -fsS http://127.0.0.1:4000/ready >/dev/null 2>&1 && ok "The API answers on /ready" || todo "The API does not answer on /ready. See: pm2 logs vook-api"
  else note "vook-api is not started yet. The first deploy (GitHub → Actions → Run workflow) starts it."; fi
fi

echo
if [ "$TODO" = 0 ]; then echo "All set. Run the deploy workflow (or push to the frontend branch)."; else echo "$TODO thing(s) left (the ✗ lines above). Fix them, run this script again, then run the deploy."; fi
exit 0
