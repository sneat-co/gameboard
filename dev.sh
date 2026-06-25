#!/usr/bin/env bash
#
# Start the full gameboard.localhost local stack in one terminal.
# See README "Full-site preview". Five processes; Ctrl-C stops them all.
#
#   1. Firebase emulators (auth :9099, firestore :8080, UI :8070)
#   2. sneat-go backend API (:4300)
#   3. Angular app dev server, served under /app/ (:4301)
#   4. Astro landing dev server (:4321)
#   5. Caddy reverse proxy -> https://gameboard.localhost:8443/
#
# This repo (gameboard) holds frontend/ and landings/. The backend and
# Firebase config are sibling checkouts under the same parent (sneat-co/):
#   gameboard (this repo) · sneat-go · sneat-firebase
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # gameboard
PARENT="$(dirname "$ROOT")"                            # sneat-co

FIREBASE_DIR="$PARENT/sneat-firebase/firebase"
GO_DIR="$PARENT/sneat-go"
APP_DIR="$ROOT/frontend"
LANDING_DIR="$ROOT/landings"

# The app on localhost uses @sneat/app's emulator config: projectId
# 'local-sneat-app' + the 'demo-' prefix => 'demo-local-sneat-app'. The
# emulators and the go backend MUST use this same id or data won't line up.
PROJECT="demo-local-sneat-app"

for d in "$FIREBASE_DIR" "$GO_DIR" "$APP_DIR"; do
	[ -d "$d" ] || { echo "ERROR: expected sibling repo not found: $d" >&2; exit 1; }
done

# Caddy on :8443 so it runs WITHOUT sudo. Derived from the committed Caddyfile
# (which binds :443) so the source stays the single source of truth.
CADDYFILE_DEV="$(mktemp -t gameboard-caddyfile)"
sed 's/^gameboard\.localhost {/gameboard.localhost:8443 {/' "$LANDING_DIR/Caddyfile" >"$CADDYFILE_DEV"

PIDS=()

cleanup() {
	trap - EXIT INT TERM
	echo
	echo "==> Stopping gameboard stack..."
	for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
	# `go run` leaves its compiled child on :4300; ng/firebase may linger.
	# Free every port the stack uses so a re-run starts clean.
	for port in 4300 4301 4321 8080 9099 8070 8085 8443; do
		lsof -ti tcp:"$port" 2>/dev/null | xargs kill 2>/dev/null || true
	done
	rm -f "$CADDYFILE_DEV"
}
trap cleanup EXIT INT TERM

# Run a command in $dir, prefixing each output line with [label].
# perl keeps the prefix live (line-buffered); macOS sed/awk would block-buffer.
start() {
	local label="$1" dir="$2"; shift 2
	( cd "$dir" && exec "$@" ) 2>&1 | perl -ne 'BEGIN{$|=1} print "['"$label"'] $_" ' &
	PIDS+=($!)
}

# Wait until something is listening on a TCP port (or give up after ~40s).
wait_port() {
	local port="$1" name="$2" i=0
	until nc -z 127.0.0.1 "$port" 2>/dev/null; do
		i=$((i + 1))
		[ "$i" -ge 80 ] && { echo "WARN: $name (:$port) not up after 40s, continuing"; return; }
		sleep 0.5
	done
}

echo "==> gameboard local stack — project '$PROJECT'"
echo "    One-time setup if you haven't: 'caddy trust' (trust the local CA)."
echo "    Safari doesn't resolve *.localhost — add '127.0.0.1 gameboard.localhost' to /etc/hosts."
echo

# 1. Firebase emulators first — the backend connects to them on startup.
start emu "$FIREBASE_DIR" firebase emulators:start --only auth,firestore --project "$PROJECT"
wait_port 8080 "firestore emulator"

# 2. Backend API — point its Firebase SDKs at the emulators.
start go "$GO_DIR" env \
	GOOGLE_CLOUD_PROJECT="$PROJECT" \
	FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
	FIRESTORE_EMULATOR_HOST=localhost:8080 \
	go run ./cmd/sneatserver

# 3. Angular app under /app/ (matches the Caddy route and the build baseHref).
# This is an Nx workspace (no angular.json), so use `nx serve`, not bare
# `ng serve` (which errors: "not available ... outside a workspace"). The
# @angular/build:dev-server executor spells the option --servePath.
start app "$APP_DIR" pnpm exec nx serve gameboard-app --servePath=/app/ --host 127.0.0.1 --port 4301

# 4. Astro landing at the root.
start landing "$LANDING_DIR" pnpm dev --host 127.0.0.1

# 5. Reverse proxy. Wait for the upstreams so early requests don't 502.
wait_port 4321 "landing"
wait_port 4301 "app"
# --adapter caddyfile: the temp config isn't named "Caddyfile", so Caddy can't
# auto-detect the format and would otherwise parse it as JSON and fail on '#'.
start caddy "$LANDING_DIR" caddy run --adapter caddyfile --config "$CADDYFILE_DEV"

echo
echo "==> Up. Open:"
echo "      landing  https://gameboard.localhost:8443/"
echo "      app      https://gameboard.localhost:8443/app/"
echo "      emu UI   http://127.0.0.1:8070/"
echo "    Ctrl-C to stop everything."
echo

# Keep the script in the foreground; exit (and clean up) if any child dies.
wait -n 2>/dev/null || wait
