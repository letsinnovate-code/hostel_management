#!/bin/bash

# Configuration
API_BASE="${API_BASE:-http://localhost:4000/api}"
BROADCAST_URL="$API_BASE/owner/notifications/broadcast"
RECEIPTS_URL="$API_BASE/owner/notifications/receipts"
# You need a valid Owner Authentication Token here.
# Login as owner at http://localhost:3000 (or your web URL), then get the token from network tab / storage.
AUTH_TOKEN="${AUTH_TOKEN:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5N2IyYWQ4MDQ4ZWFiNjVmNWNjYjNmMyIsImlhdCI6MTc3MDYyODMyNiwiZXhwIjoxNzcxMjMzMTI2fQ.yCgY9F-an9oNaNn1tkmX1ld65RdwN6yAuT4pUEvQULc}"

# Device tokens: Students get FCM + Expo push token when they log in (Expo enables receipt status: ok | DeviceNotRegistered | MessageTooBig).
# Owner can see who has notifications On/Off at: http://localhost:3000/owner/students/presence
#
# If you see "Unable to retrieve the FCM server key" / InvalidCredentials from Expo:
#   Upload your Firebase FCM V1 service account to Expo so Expo can deliver to Android.
#   See: mobile-app/PUSH_SETUP.md

echo "Sending broadcast notification to all students (FCM + Expo when available)..."

RESP=$(curl -s -X POST "$BROADCAST_URL" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Attendance Check",
    "body": "Please mark your attendance now!",
    "data": {
      "type": "attendance_check",
      "screen": "AttendanceScreen"
    }
  }')

echo "$RESP"

# If we have receipt IDs (Expo), check status: ok | error | DeviceNotRegistered | MessageTooBig
if command -v jq &>/dev/null; then
  RECEIPT_IDS=$(echo "$RESP" | jq -r '.receiptIds[]? // empty' 2>/dev/null | tr '\n' ',')
  if [ -n "$RECEIPT_IDS" ]; then
    RECEIPT_IDS="${RECEIPT_IDS%,}"
    echo ""
    echo "Checking Expo receipt status..."
    curl -s -X GET "$RECEIPTS_URL?ids=$RECEIPT_IDS" \
      -H "Authorization: Bearer $AUTH_TOKEN" | jq .
  fi
else
  echo ""
  echo "Tip: Install 'jq' to auto-check receipt status (ok | DeviceNotRegistered | MessageTooBig)."
  echo "Or run: ./check_receipts.sh <RECEIPT_ID> [RECEIPT_ID2 ...]"
fi

echo -e "\nDone."
