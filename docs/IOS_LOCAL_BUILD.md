# iOS Local Release Build

Build and run a release version of XamLeydi on your iPhone **without** uploading to EAS servers.

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| macOS | Xcode only runs on macOS |
| Xcode 15+ | Install from the App Store |
| CocoaPods | `sudo gem install cocoapods` (or via Homebrew) |
| Apple Developer account | Free account works for device testing; paid account needed for distribution |
| EAS CLI | `npm install -g eas-cli` |
| Physical iPhone (optional) | Or use the iOS Simulator |

---

## 1. Environment Variables

Create a `.env` file (or export in your shell) with any secrets you need at build time:

```bash
# .env (not committed)
GOOGLE_MAPS_API_KEY=AIza...your_key_here
```

The dynamic Expo config (`app.config.js`) will inject this into the iOS build.

> **Tip:** For EAS cloud builds, set secrets via `eas secret:create`.

---

## 2. Quick Commands

```bash
# Install dependencies
npm install

# Generate native projects (runs expo prebuild)
npx expo prebuild --clean

# Build iOS release locally via EAS
npm run build:ios:local

# — OR — open in Xcode for manual archive / device run
npm run ios:open
```

---

## 3. Running on a Physical Device

1. Connect your iPhone via USB.
2. Open the workspace in Xcode:
   ```bash
   open ios/XamLeydi.xcworkspace
   ```
3. Select your device in the toolbar.
4. Choose **Product → Run** (⌘R) for a debug build, or **Product → Archive** for a release `.ipa`.

> First-time device registration may require trusting the developer profile on the iPhone:  
> **Settings → General → VPN & Device Management → [Your Apple ID] → Trust**.

---

## 4. EAS Local Build (Recommended)

EAS can build the app **locally** on your Mac using the `--local` flag, producing a `.app` (simulator) or `.ipa` (device).

```bash
# Simulator build (fast, no code-signing)
eas build --platform ios --profile development --local

# Device build (requires Apple credentials)
eas build --platform ios --profile production --local
```

The output artifact is saved in the current directory.

---

## 5. Troubleshooting

| Issue | Fix |
|-------|-----|
| **"No bundle URL present"** | Run `npx expo start` in another terminal, or build in Release mode. |
| **CocoaPods errors** | `cd ios && pod install --repo-update` |
| **Code-signing errors** | Ensure your Apple ID is added in Xcode → Preferences → Accounts; let Xcode manage signing. |
| **Google Maps blank on iOS** | The app now uses Apple Maps on iOS by default. If you want Google Maps, add `GOOGLE_MAPS_API_KEY` and ensure the Google Maps iOS SDK is linked. |

---

## 6. Useful Scripts (package.json)

| Script | Description |
|--------|-------------|
| `npm run ios` | Run dev client on iOS Simulator |
| `npm run ios:open` | Open Xcode workspace |
| `npm run build:ios` | EAS cloud build (iOS) |
| `npm run build:ios:local` | EAS local build (iOS, on your Mac) |

---

Happy building! 🍏
