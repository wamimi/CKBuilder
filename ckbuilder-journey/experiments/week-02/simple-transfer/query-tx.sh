#!/usr/bin/env bash

set -euo pipefail

TX_HASH="${1:-}"
RPC_URL="${2:-http://127.0.0.1:28114}"

if [ -z "$TX_HASH" ]; then
  echo "Usage: ./query-tx.sh <tx_hash> [rpc_url]"
  exit 1
fi

curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": 42,
    \"jsonrpc\": \"2.0\",
    \"method\": \"get_transaction\",
    \"params\": [\"$TX_HASH\"]
  }" | jq
