# Besoooo

This repository contains two connected parts:

- The GitHub Pages web app in the repository root.
- The Android app source in `android-app/`.

The Android app opens the GitHub Pages site in a WebView and handles Firebase Cloud Messaging notifications natively.

## Notification Source

Use `android-app/` for notification work, not the generated APK file.

Important files:

- `android-app/app/src/main/AndroidManifest.xml`
- `android-app/app/src/main/java/com/besoooo/app/MainActivity.java`
- `android-app/app/src/main/java/com/besoooo/app/FirebaseMessagingService.java`
- `android-app/app/google-services.json`

The app subscribes to the Firebase topic `all`, so you can send a notification to all installed apps from Firebase Cloud Messaging by targeting topic `all`.

## Build Android APK

Open `android-app/` in Android Studio, or build from PowerShell:

```powershell
cd android-app
.\gradlew.bat assembleDebug
```

Do not commit local signing files such as `release.jks`.
