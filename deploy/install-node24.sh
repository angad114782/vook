#!/usr/bin/env bash
# Puts Node.js 24 in its own folder (default /opt/node24) so the Vook API can use it WITHOUT touching the Node that
# your other apps use. Checks the download against the official checksum. Safe to run again: does nothing if Node 24 is there.
set -eu
DIR="${VOOK_NODE_DIR:-/opt/node24}"

have24() { [ -x "$DIR/bin/node" ] && [ "$("$DIR/bin/node" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 24 ]; }
if [ "${VOOK_NODE_NO_RUN:-0}" != 1 ] && have24; then echo "Node.js $("$DIR/bin/node" -v) is already in $DIR"; exit 0; fi

command -v curl >/dev/null 2>&1 || { echo "curl is needed to download Node.js"; exit 1; }
case "$(uname -m)" in x86_64) ARCH=x64 ;; aarch64|arm64) ARCH=arm64 ;; *) echo "Unsupported CPU: $(uname -m)"; exit 1 ;; esac

BASE="https://nodejs.org/dist/latest-v24.x"
SUMS="$(curl -fsSL "$BASE/SHASUMS256.txt")"
FILE="$(printf '%s\n' "$SUMS" | grep -oE "node-v24[0-9.]*-linux-$ARCH\.tar\.xz" | head -1)"
[ -n "$FILE" ] || { echo "Could not find a Node.js 24 download for $ARCH"; exit 1; }
WANT="$(printf '%s\n' "$SUMS" | grep " $FILE\$" | awk '{print $1}')"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
echo "Downloading $FILE ..."
curl -fsSL "$BASE/$FILE" -o "$TMP/$FILE"
if command -v sha256sum >/dev/null 2>&1; then GOT="$(sha256sum "$TMP/$FILE" | awk '{print $1}')"; else GOT="$(shasum -a 256 "$TMP/$FILE" | awk '{print $1}')"; fi
[ "$GOT" = "$WANT" ] || { echo "Checksum does not match, so nothing was installed."; exit 1; }
echo "Checksum OK"

mkdir -p "$DIR"
tar -xJf "$TMP/$FILE" -C "$DIR" --strip-components=1 || { echo "Could not unpack Node.js. Install xz-utils (apt install xz-utils) and run this again."; exit 1; }
if [ "${VOOK_NODE_NO_RUN:-0}" = 1 ]; then echo "Unpacked to $DIR (not run: test mode)"; else echo "Installed Node.js $("$DIR/bin/node" -v) in $DIR"; fi
