# SimLoad for Android and iOS

A Flutter app that puts the whole SimLoad simulator on your phone, working offline. It bundles the production web build and runs it in a WebView, so the app has every feature of the website and stays in step with it. That includes the engine, scenarios, planner, charts and chaos tools.

## How it works

- `tool/build_web.sh` builds `apps/web` with `VITE_BASE=/` and copies it into `assets/web`, leaving out source maps and the service worker.
- At launch, `lib/local_server.dart` serves those files from `http://127.0.0.1` on a fixed port. It listens on loopback only, so nothing leaves the device. A real origin (rather than `file://`) lets the ES modules and the simulation's Web Workers load as they do on the website. A fixed port keeps `localStorage`, and with it the autosaved design, from one launch to the next.
- `lib/bridge.dart` adds a small script to the page before the app's own code. It passes the things a WebView can't do on its own to native code:

  | In the web app                      | In the mobile app                                                                            |
  | ----------------------------------- | -------------------------------------------------------------------------------------------- |
  | Export design / Download report     | Opens the share sheet with the file (save to Files, Drive, email, …)                         |
  | Printable report (PDF)              | Opens the system print dialog, with Save as PDF                                              |
  | Copy share link                     | Copies a `https://simload.webappslab.com/#z=…` link that opens for anyone                    |
  | Import…                             | Opens the system file picker                                                                 |
  | Links to other sites                | Open in the browser                                                                          |
  | Service worker and "Offline" badge  | Not used. The files are already on the device, and a cache would keep old builds after updates |

The web app's own phone layout (under 900px wide) handles small screens.

## Run it

Requirements: Node 22 and pnpm 10 (for the web build), [Flutter](https://docs.flutter.dev/get-started/install) 3.47 or newer, plus Android Studio (for Android) or Xcode (for iOS).

```bash
mobile/tool/build_web.sh     # build the web app and copy it into mobile/assets/web
cd mobile
flutter pub get
flutter run                  # on a connected phone or emulator
```

Run `tool/build_web.sh` again whenever the web app changes. The copied build is git-ignored. If you skip this step, the app opens with a message saying so.

## Build

```bash
flutter build apk --release      # Android: build/app/outputs/flutter-apk/app-release.apk
flutter build appbundle          # Android: for Google Play
flutter build ipa                # iOS: needs a Mac, Xcode and an Apple developer account
```

Release builds are signed with the debug key so they install on any phone for testing. Before publishing to Google Play, set up a release key ([Flutter's guide](https://docs.flutter.dev/deployment/android#sign-the-app)).

The `Mobile app` GitHub workflow builds the web app, analyses and tests the Flutter app, and builds the APK on every push. You can download the APK from the workflow run's artifacts.

## Checks

```bash
dart format lib test
flutter analyze
flutter test
```

The tests cover the local server: loopback only, `index.html` with the bridge injected, content types, the left-out service worker, rejected path tricks and the port fallback. They also cover file-name cleaning for downloads.

## Platform settings

- Android: `res/xml/network_security_config.xml` allows plain HTTP to `127.0.0.1` only. The `INTERNET` permission is needed to open the local socket.
- iOS: `NSAllowsLocalNetworking` in `Info.plist` does the same.
