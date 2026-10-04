# GymApp

A private workout and body-weight tracker for Android. Plan your week, follow guided workouts,
and track your progress — everything stays on your phone. No account, no ads, no tracking.

Based on [openGym](https://github.com/DuarteSantos8/openGym) by Duarte Santos.

## Build

Needs Node 20+ and Android Studio (for the SDK and its bundled Java 21).

```sh
cd frontend
npm install
npm test
npm run build:mobile                 # web bundle + sync into android/
cd android
./gradlew assembleDebug              # installable APK: app/build/outputs/apk/debug/
./gradlew bundleRelease              # Play Store bundle: app/build/outputs/bundle/release/
```

On Windows, point `JAVA_HOME` at `C:\Program Files\Android\Android Studio\jbr` and use
`gradlew.bat`. Release builds are signed with `android/upload-keystore.jks` via
`android/keystore.properties` — both stay out of git; keep a copy somewhere safe.
Bump `versionCode` in `android/app/build.gradle` before every Play upload.

`npm run demo` runs the app in a browser with example data. `node scripts/render-icons.mjs`
re-renders the icon, splash and Play Store graphics from `resources/icon.svg`.

## License

[GNU AGPL v3.0](LICENSE). Third-party notices, including the exercise dataset's terms, are in
[NOTICE.md](NOTICE.md). Privacy policy: [PRIVACY.md](PRIVACY.md).
