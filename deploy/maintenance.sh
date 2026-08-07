#!/bin/sh
set -e

cd "$(dirname "$0")"

flag="maintenance/prod.on"

case "${1:-}" in
	on)
		mkdir -p maintenance
		: > "$flag"
		echo "prod maintenance page is UP"
		;;
	off)
		rm -f "$flag"
		echo "prod maintenance page is DOWN"
		;;
	status)
		if [ -f "$flag" ]; then
			echo "UP"
		else
			echo "DOWN"
		fi
		;;
	*)
		echo "usage: maintenance.sh on|off|status" >&2
		exit 1
		;;
esac
