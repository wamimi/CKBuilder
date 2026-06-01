#!/usr/bin/env bash

set -euo pipefail

TX_HASH="${1:-}"
INDEX="${2:-0x0}"
RPC_URL="${3:-http://127.0.0.1:28114}"

if [ -z "$TX_HASH" ]; then
  echo "Usage: ./query-live-cell.sh <tx_hash> [index] [rpc_url]"
  exit 1
fi

curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": 42,
    \"jsonrpc\": \"2.0\",
    \"method\": \"get_live_cell\",
    \"params\": [
      {
        \"tx_hash\": \"$TX_HASH\",
        \"index\": \"$INDEX\"
      },
      true
    ]
  }" | jq
