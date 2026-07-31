# Push notifications setup

## Error: "Unable to retrieve the FCM server key for the recipient's app"

This happens when **Expo** tries to send push notifications to **Android** devices. Expo’s servers need your **Firebase (FCM) credentials** to deliver to Android.

---

## Two different JSON files (don’t mix them up)

| File | Purpose | Has `type`, `private_key`, `client_email`? |
|------|--------|-------------------------------------------|
| **google-services.json** | Android app config (package name, API keys). Lives in `mobile-app/`. | **No** – Expo will reject it for FCM. |
| **Service account key JSON** | Used for FCM V1 and backend Firebase Admin. Downloaded from Firebase Console. | **Yes** – this is what Expo needs. |

Expo’s “Upload a new service account key” must be the **service account key**, not `google-services.json`.

---

## Fix: Upload FCM V1 service account to Expo

### Option 1: Use the backend’s service account (same Firebase project)

This repo already has a service account key at the **backend** root:

- Path: **`../service-account.json`** from `mobile-app/`  
  i.e. **`hostel_zack/service-account.json`** (same Firebase project as `google-services.json`).

When EAS asks for the file, use that path:

```bash
cd mobile-app
npx eas credentials
```

Then:

1. **Android** → **production** (or your profile).
2. **Manage your Google Service Account Key for Push Notifications (FCM V1)**.
3. **Set up a Google Service Account Key for FCM V1** → **Upload a new service account key**.
4. When prompted for the path, pass the **service account** file, **not** `google-services.json`:

   ```text
   Path: ../service-account.json
   ```

   Or use the full path to `hostel_zack/service-account.json`.

### Option 2: Create a new service account key in Firebase

Only if you don’t want to use the backend key:

1. [Firebase Console](https://console.firebase.google.com) → project **hostelzify**.
2. **Project settings** (gear) → **Service accounts**.
3. **Generate new private key** → download the JSON (e.g. `hostelzify-fcm-key.json`).
4. In EAS: **Upload a new service account key** and select **this** file (the one with `"type": "service_account"`, `"private_key"`, `"client_email"`).

#### 3. Confirm

- Re-send a test notification (e.g. `./send_notification.sh`).
- If it still fails, ensure the Firebase project and app (e.g. `com.hostelzify.app`) match the one in `google-services.json` and that the service account has the right permissions.

### Alternative: Use FCM from your backend only

If the app registers the **FCM token** (from Firebase) with your backend, the backend can send via **Firebase Admin** and does **not** need Expo to have FCM credentials.

- The app already registers the FCM token on login (see `AuthContext` + `FirebaseNotificationService`).
- Backend broadcast prefers **FCM** when the stored token is an FCM token, and only uses **Expo** when the token is an Expo token.
- So if students have **FCM token** stored (e.g. after logging in on a dev build with Firebase), notifications go through your server and the Expo FCM error does not apply. Students who only have an **Expo push token** (e.g. from `NotificationService` / Expo Go) still require FCM to be configured in Expo as above.
