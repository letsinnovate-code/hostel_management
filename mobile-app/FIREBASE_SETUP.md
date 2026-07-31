# Firebase Setup Instructions

## ⚠️ Important: Configuration Files Required

To complete the Firebase Cloud Messaging setup, you need to add Firebase configuration files to this directory.

### Steps to Complete Setup:

1. **Create/Access Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create a new project or select existing one

2. **Add Android App**
   - Click "Add app" → Select Android
   - Package name: `com.hostelzify.app`
   - Download `google-services.json`
   - **Place it in this directory** (`mobile-app/`)

3. **Add iOS App** (Optional)
   - Click "Add app" → Select iOS
   - Bundle ID: `com.hostelzify.app`
   - Download `GoogleService-Info.plist`
   - **Place it in this directory** (`mobile-app/`)

4. **Enable Cloud Messaging**
   - Go to Project Settings → Cloud Messaging
   - Copy the Server Key (needed for backend)

### After Adding Config Files:

Run the following commands:

```bash
# Generate native projects with Firebase
npx expo prebuild --clean

# Run on Android
npx expo run:android

# Or run on iOS
npx expo run:ios
```

### ⚠️ Note About Expo Go

Firebase Cloud Messaging **does not work in Expo Go**. You must use a development build:
- The commands above will create a development build
- This is a one-time setup
- After the initial build, you can use `npx expo start --dev-client`

### Backend Update Required

The backend also needs to be updated to use Firebase Admin SDK for sending notifications. The Server Key from Firebase Console will be needed.

---

## Current Status

✅ Firebase packages installed
✅ app.json configured with Firebase plugins
✅ FirebaseNotificationService created
✅ AuthContext updated to use Firebase

⏳ **Waiting for:** Firebase configuration files (`google-services.json` and optionally `GoogleService-Info.plist`)
