# Development setup

## Fix: "SocketTimeoutException: failed to connect to /192..."

This happens when the app (device or emulator) cannot reach the Metro bundler on your machine—often when using a **physical device over WiFi** or when the bundler URL is wrong.

### Recommended: use USB + ADB reverse

1. Connect your Android device with **USB debugging** enabled.
2. In the project folder run:
   ```bash
   npm run adb-reverse
   ```
   This forwards the device’s `localhost:8081` to your machine’s Metro port.
3. Start Metro (if not already running):
   ```bash
   npm run start
   ```
4. Run the app:
   ```bash
   npx expo run:android
   ```
   Or open the existing dev build; it will load the bundle from localhost and avoid the timeout.

### If you must use WiFi

- Ensure the phone and computer are on the **same WiFi** (no guest / isolated network).
- On Linux, allow Metro’s port in the firewall:
  ```bash
  sudo ufw allow 8081/tcp
  sudo ufw reload
  ```
- Clear Expo cache and restart:
  ```bash
  rm -rf .expo
  npm run start:clear
  ```
- Then run the app again.

### Tunnel mode (works across networks)

If USB and same-WiFi still fail, use Expo’s tunnel so the device reaches Metro via the internet:

```bash
npx expo start --tunnel
```

Then open the app on the device; it will connect to the URL shown in the terminal.
