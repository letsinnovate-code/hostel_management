#!/bin/bash

# Create SuperAdmin user via API
# Usage: ./scripts/create-superadmin.sh
# Override via env: API_URL, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME, SUPERADMIN_PHONE

API_URL="${API_URL:-http://localhost:4000/api}"
EMAIL="${SUPERADMIN_EMAIL:-superadmin@hostelzack.com}"
PASSWORD="${SUPERADMIN_PASSWORD:-admin123}"
NAME="${SUPERADMIN_NAME:-Super Admin}"
PHONE="${SUPERADMIN_PHONE:-9999999999}"

echo "Creating SuperAdmin at $API_URL"
echo "Email: $EMAIL"
echo "---"

curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$NAME\",
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"role\": \"superadmin\",
    \"phone\": \"$PHONE\"
  }" | jq .

if [ $? -eq 0 ]; then
  echo "---"
  echo "Done. Login at http://localhost:3000/superadmin/login with the email and password above."
fi
