#!/bin/bash

# Check status of Expo push notification receipts.
# Usage: ./check_receipts.sh <RECEIPT_ID> [RECEIPT_ID2 ...]
# Status: ok | error | DeviceNotRegistered | MessageTooBig

API_BASE="${API_BASE:-http://localhost:4000/api}"
RECEIPTS_URL="$API_BASE/owner/notifications/receipts"
AUTH_TOKEN="${AUTH_TOKEN:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5N2IyYWQ4MDQ4ZWFiNjVmNWNjYjNmMyIsImlhdCI6MTc3MDEyMDIwMywiZXhwIjoxNzcwNzI1MDAzfQ.-DlutMcwA7lWod87Rh5K39MJFbSWDL9KEv2YmQlTXTs}"

if [ $# -eq 0 ]; then
  echo "Usage: $0 <RECEIPT_ID> [RECEIPT_ID2 ...]"
  echo "Receipt IDs are returned in the broadcast response as receiptIds[]. Run send_notification.sh and copy ids from the response."
  exit 1
fi

IDS=$(IFS=,; echo "$*")
echo "Checking receipt status for: $IDS"
curl -s -X GET "$RECEIPTS_URL?ids=$IDS" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json"

echo ""
