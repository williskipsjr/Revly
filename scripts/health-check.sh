#!/usr/bin/env bash
# Curl the three service health endpoints. Usage: bash scripts/health-check.sh
set -uo pipefail

check() {
  local name="$1" url="$2"
  printf '%-18s ' "${name}:"
  if curl -fsS --max-time 3 "$url" 2>/dev/null; then
    echo
  else
    echo "DOWN ($url)"
  fi
}

check "decision-engine"   "http://localhost:8080/health"
check "diagnosis-service" "http://localhost:8000/health"
check "dashboard"         "http://localhost:3000/api/health"
