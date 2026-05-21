#!/usr/bin/env bash
set -euo pipefail

SERENA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export UV_CACHE_DIR="${SERENA_DIR}/uv-cache"

exec uvx -p 3.13 --from serena-agent@latest --prerelease=allow serena-hooks "$@"

