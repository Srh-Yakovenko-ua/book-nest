#!/bin/sh

code() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "$1" 2>/dev/null || echo "---"
}
api() {
  curl -sS --max-time 8 "$1" 2>/dev/null || echo '{"status":"down"}'
}

echo ""
echo "  book-nest — health"
echo ""
printf "  dev  web   %s   %s\n" "$(code https://dev.book-nest.net/en)" "https://dev.book-nest.net"
printf "  dev  api   %s\n" "$(api https://dev.book-nest.net/api/health)"
echo ""
printf "  prod web   %s   %s\n" "$(code https://book-nest.net/en)" "(— if undeployed)"
printf "  prod api   %s\n" "$(api https://book-nest.net/api/health)"
echo ""
printf "  mail       %s   %s\n" "$(code https://mail.book-nest.net)" "(401 = up, auth required)"
echo ""
