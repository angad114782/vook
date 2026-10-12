#!/usr/bin/env bash
# Vook go-live helper. Run on the VPS as root, ONCE, before the first deploy:
#
#   curl -fsSL https://raw.githubusercontent.com/angad114782/vook/frontend/deploy/go-live.sh | REMOVE_OLD=yes bash
#   (leave out REMOVE_OLD=yes to do only steps 1 and 2 and keep the old backend running)
#
# What it does, in order:
#   1. Runs the server check/setup (Node, pm2, folders, settings file with a fresh SECRETS_KEY).
#   2. Adds the /api and /socket.io routes to the Nginx site of your domain (backs the file up first, tests, and
#      puts the old file back if Nginx rejects the change).
#   3. Only if you wrote REMOVE_OLD=yes: backs up the OLD Prisma backend (pm2 "vook-backend", /var/www/vook/backend),
#      stops it and moves its folder aside. Nothing is deleted for good; you remove the backup folder yourself later.
# It never touches your other apps (bhiwadi, ncr, nypay, realestate ...), and it is safe to run again.
set -u

DOMAIN="${VOOK_DOMAIN:-influencersfeed.com}"
ENV_FILE="${VOOK_ENV_FILE:-/etc/vook/server.env}"
NGINX_DIR="${VOOK_NGINX_DIR:-/etc/nginx}"
OLD_NAME="${VOOK_OLD_PM2_NAME:-vook-backend}"
OLD_DIR="${VOOK_OLD_DIR:-/var/www/vook/backend}"
SETUP_URL="https://raw.githubusercontent.com/angad114782/vook/frontend/deploy/server-setup.sh"
BACKUP_ROOT="${VOOK_BACKUP_ROOT:-/root}"
STAMP="$(date +%Y%m%d-%H%M%S)"
LEFT=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; LEFT=$((LEFT + 1)); }
note() { printf '  · %s\n' "$1"; }

echo "== Step 1: server check and setup"
if [ -n "${VOOK_SETUP_SCRIPT:-}" ]; then bash "$VOOK_SETUP_SCRIPT"; else curl -fsSL "$SETUP_URL" | bash; fi
PORT="$(grep -E '^PORT=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2)"; PORT="${PORT:-4000}"

echo; echo "== Step 2: Nginx routes for $DOMAIN (API on port $PORT)"
if ! command -v nginx >/dev/null 2>&1 && [ -z "${VOOK_FAKE_NGINX:-}" ]; then bad "nginx is not installed here."; else
  mkdir -p "$NGINX_DIR/snippets"
  SNIPPET="$NGINX_DIR/snippets/vook-api.conf"
  cat > "$SNIPPET" <<SNIP
# Vook API routes. Included from the server block of $DOMAIN. Port comes from PORT in /etc/vook/server.env.
client_max_body_size 12m;

location /api/ {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 70s;
}

location /socket.io/ {
    proxy_pass http://127.0.0.1:$PORT;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 3600s;
}
SNIP
  ok "Wrote $SNIPPET"
  BACKUP="$BACKUP_ROOT/nginx-backup-$STAMP"; mkdir -p "$BACKUP" || bad "Could not create $BACKUP"
  RESULT="$(DOMAIN="$DOMAIN" NGINX_DIR="$NGINX_DIR" BACKUP="$BACKUP" SNIPPET="$SNIPPET" python3 - 2>&1 <<'PY'
import os, re, shutil, glob
domain, nd, backup, snippet = (os.environ[k] for k in ("DOMAIN", "NGINX_DIR", "BACKUP", "SNIPPET"))
include = f"include {snippet};"
files = sorted(set(glob.glob(f"{nd}/sites-enabled/*") + glob.glob(f"{nd}/conf.d/*.conf") + [f"{nd}/nginx.conf"]))
changed, seen_block = [], False
for path in files:
    if not os.path.isfile(path): continue
    text = open(path).read()
    if "server_name" not in text or domain not in text: continue
    # find top-level "server { ... }" blocks by brace matching
    blocks, i = [], 0
    while True:
        m = re.search(r"\bserver\s*\{", text[i:])
        if not m: break
        start = i + m.start(); depth, j = 0, start + m.end() - m.start() - 1
        for k in range(j, len(text)):
            if text[k] == "{": depth += 1
            elif text[k] == "}":
                depth -= 1
                if depth == 0: blocks.append((start, k)); i = k + 1; break
        else: break
    pick = []
    for s, e in blocks:
        b = text[s:e]
        names = " ".join(re.findall(r"server_name\s+([^;]+);", b))
        if domain not in names.split(): continue
        pick.append((s, e, "443" in b))
    if not pick: continue
    has_tls = any(t for _, _, t in pick)
    targets = [(s, e) for s, e, t in pick if t or not has_tls]
    new, shift = text, 0
    for s, e in targets:
        block = text[s:e]
        if snippet in block: seen_block = True; continue
        if re.search(r"location\s+(\^~\s+)?/api\b", block):
            print(f"SKIP {path}: it already has its own /api location; add the proxy by hand (see deploy/nginx-vook.conf)"); continue
        pos = e + shift
        new = new[:pos] + f"\n    {include}\n" + new[pos:]; shift += len(f"\n    {include}\n")
    if new != text:
        shutil.copy2(path, os.path.join(backup, os.path.basename(path)))
        open(path, "w").write(new); changed.append(path)
for c in changed: print("PATCHED", c)
if not changed and seen_block: print("ALREADY done")
if not changed and not seen_block and not any(l.startswith("SKIP") for l in []): print("NONE")
PY
)"
  echo "$RESULT" | while IFS= read -r line; do case "$line" in SKIP*) note "$line" ;; esac; done
  if echo "$RESULT" | grep -q "^PATCHED"; then
    echo "$RESULT" | grep "^PATCHED" | while read -r _ f; do note "Edited $f (original saved in $BACKUP)"; done
    if nginx -t >/dev/null 2>&1; then nginx -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null; ok "Nginx accepted the change and was reloaded"
    else
      echo "$RESULT" | grep "^PATCHED" | while read -r _ f; do cp "$BACKUP/$(basename "$f")" "$f"; done
      bad "Nginx rejected the change, so the original files were put back. Add the blocks by hand from deploy/nginx-vook.conf."
    fi
  elif echo "$RESULT" | grep -qE "Traceback|Error"; then bad "Could not edit Nginx ($(echo "$RESULT" | tail -1)). Nothing was changed. Add the blocks by hand from deploy/nginx-vook.conf."
  elif echo "$RESULT" | grep -q "^ALREADY"; then ok "Nginx already includes the Vook routes"
  elif echo "$RESULT" | grep -q "^SKIP"; then bad "Add the /api and /socket.io blocks to the $DOMAIN site by hand (see deploy/nginx-vook.conf)."
  else bad "No Nginx site with server_name $DOMAIN was found. Tell me the domain (run with VOOK_DOMAIN=your.domain) or add the blocks by hand."; fi
fi

echo; echo "== Step 3: the old backend ($OLD_NAME)"
if [ "${REMOVE_OLD:-no}" != "yes" ]; then
  note "Skipped. To back it up and retire it, run again as:  curl -fsSL https://raw.githubusercontent.com/angad114782/vook/frontend/deploy/go-live.sh | REMOVE_OLD=yes bash"
elif ! command -v pm2 >/dev/null 2>&1; then bad "pm2 is missing, so the old process cannot be stopped."
else
  if [ -d "$OLD_DIR" ]; then
    SAVE="$BACKUP_ROOT/vook-old-backend-$STAMP"; mkdir -p "$SAVE" && chmod 700 "$SAVE"
    if tar --exclude=node_modules -czf "$SAVE/backend.tar.gz" -C "$(dirname "$OLD_DIR")" "$(basename "$OLD_DIR")" 2>/dev/null && [ -s "$SAVE/backend.tar.gz" ]; then
      ok "Backed up $OLD_DIR (without node_modules) to $SAVE/backend.tar.gz"
      pm2 describe "$OLD_NAME" >/dev/null 2>&1 && pm2 describe "$OLD_NAME" > "$SAVE/pm2-describe.txt" 2>/dev/null
      if pm2 describe "$OLD_NAME" >/dev/null 2>&1; then pm2 delete "$OLD_NAME" >/dev/null 2>&1 && ok "Stopped and removed pm2 process $OLD_NAME" || bad "Could not remove pm2 process $OLD_NAME"; else note "pm2 has no process called $OLD_NAME"; fi
      pm2 save >/dev/null 2>&1
      if mv "$OLD_DIR" "$(dirname "$OLD_DIR")/_old-backend-$STAMP"; then ok "Moved the old folder to $(dirname "$OLD_DIR")/_old-backend-$STAMP (delete it yourself when you are sure)"; else bad "Could not move $OLD_DIR"; fi
    else bad "The backup failed, so nothing was removed."; fi
  else note "$OLD_DIR does not exist; nothing to back up."; pm2 describe "$OLD_NAME" >/dev/null 2>&1 && { pm2 delete "$OLD_NAME" >/dev/null 2>&1; pm2 save >/dev/null 2>&1; ok "Removed pm2 process $OLD_NAME"; }; fi
  note "The old backend's database (Prisma / SQL) is NOT touched."
fi

echo
if [ "$LEFT" = 0 ]; then echo "Done here. Next: GitHub → Actions → Deploy Vook → Run workflow. When it is green, create the first admin (deploy/README.md, step 7)."
else echo "$LEFT thing(s) need you (the ✗ lines). Fix them, run this again, then run the deploy workflow."; fi
exit 0
