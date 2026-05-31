#!/usr/bin/env bash
# ── Diagnose: login connection failure ─────────────────────────────
# Tests connectivity to the auth endpoint and reports what's failing.
# Usage: ./scripts/diagnose-login.sh [API_URL]

set -euo pipefail

API_URL="${1:-http://localhost:8080/api/v1}"
AUTH_URL="$API_URL/auth/login"

echo "╔══ DIAGNOSE LOGIN CONNECTION ═══════════════════════════════╗"
echo "║ Target:  $AUTH_URL"
echo "╟───────────────────────────────────────────────────────────╢"

# ── Step 1: TCP connectivity ──────────────────────────────────────
echo -n "║ 1. TCP port … "
HOST="$(echo "$API_URL" | sed -n 's|^https\?://\([^:/]*\).*|\1|p')"
PORT="$(echo "$API_URL" | sed -n 's|^https\?://[^:]*:\([0-9]*\).*|\1|p')"
PORT="${PORT:-80}"

if command -v nc &>/dev/null; then
  if nc -z -w 3 "$HOST" "$PORT" 2>/dev/null; then
    echo "✓ port $PORT open on $HOST"
  else
    echo "✗ connection refused (port $PORT on $HOST)"
    echo "║"
    echo "║    Is the server running?"
    echo "║    Try: lsof -i :$PORT   or   netstat -an | grep $PORT"
    echo "╚═══════════════════════════════════════════════════════════╝"
    exit 1
  fi
else
  echo "? (nc not available — skipping TCP check)"
fi

# ── Step 2: HTTP preflight (OPTIONS) ──────────────────────────────
echo -n "║ 2. CORS preflight … "
OPTIONS_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -X OPTIONS "$AUTH_URL" \
  -H "Origin: http://localhost:4200" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  --connect-timeout 5 --max-time 10 2>&1 || echo "000")

if [ "$OPTIONS_CODE" = "000" ]; then
  echo "✗ no response (curl error — server may not speak HTTP here)"
elif [ "$OPTIONS_CODE" -ge 200 ] && [ "$OPTIONS_CODE" -lt 400 ]; then
  echo "✓ HTTP $OPTIONS_CODE (CORS preflight OK)"
else
  echo "⚠ HTTP $OPTIONS_CODE (preflight returned non-OK)"
fi

# ── Step 3: Actual login request ──────────────────────────────────
echo -n "║ 3. POST login … "

LOGIN_RESPONSE=$(curl -s -w '\n%{http_code}' \
  -X POST "$AUTH_URL" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:4200" \
  -d '{"identificador":"test@test.com","senha":"wrong"}' \
  --connect-timeout 5 --max-time 15 2>&1 || echo "000")

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -1)
BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "000" ]; then
  echo "✗ NO RESPONSE — curl could not connect"
  echo "║"
  echo "║    Common causes:"
  echo "║    • Wrong URL. Is the server at $API_URL ?"
  echo "║    • Server not running. Check with: curl $API_URL/health"
  echo "║    • Firewall / VPN blocking the port"
  echo "║    • Server listening on a different interface (0.0.0.0 vs 127.0.0.1)"
  echo "╚═══════════════════════════════════════════════════════════╝"
  exit 1
elif [ "$HTTP_CODE" = "401" ]; then
  echo "✓ HTTP 401 (credentials rejected — expected with wrong password)"
elif [ "$HTTP_CODE" = "200" ]; then
  echo "✓ HTTP 200 (login succeeded — check credentials!)"
elif [ "$HTTP_CODE" -ge 500 ]; then
  echo "✗ HTTP $HTTP_CODE (server error)"
  echo "║    Response body:"
  echo "$BODY" | sed 's/^/║      /'
else
  echo "⚠ HTTP $HTTP_CODE"
  echo "║    Response body:"
  echo "$BODY" | sed 's/^/║      /'
fi

# ── Step 4: Test with user's actual credentials (read from stdin) ─
echo "╟───────────────────────────────────────────────────────────╢"
echo "║"
echo -n "║ 4. Test with YOUR credentials? (paste email): "
read -r USER_EMAIL
echo -n "║                        (paste password): "
read -rs USER_PASS
echo ""

FULL_RESPONSE=$(curl -s -w '\n%{http_code}' \
  -X POST "$AUTH_URL" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:4200" \
  -d "{\"identificador\":\"$USER_EMAIL\",\"senha\":\"$USER_PASS\"}" \
  --connect-timeout 5 --max-time 15 2>&1 || echo "000")

FULL_CODE=$(echo "$FULL_RESPONSE" | tail -1)
FULL_BODY=$(echo "$FULL_RESPONSE" | sed '$d')

if [ "$FULL_CODE" = "401" ]; then
  echo "║    ✗ HTTP 401 — credentials rejected by server"
  echo "║      Check: is this user registered? Is the password correct?"
elif [ "$FULL_CODE" = "200" ]; then
  echo "║    ✓ HTTP 200 — login SUCCEEDED via curl!"
  echo "║"
  echo "║       The API is working. If the Angular app still fails:"
  echo "║       → CORS headers are likely missing on the server."
  echo "║       → Check browser DevTools → Network tab for the exact error."
  echo "║       → The server must return: Access-Control-Allow-Origin"
elif [ "$FULL_CODE" = "000" ]; then
  echo "║    ✗ Connection failed entirely"
else
  echo "║    HTTP $FULL_CODE"
  echo "║    $(echo "$FULL_BODY" | head -5)"
fi

echo "╚═══════════════════════════════════════════════════════════╝"
