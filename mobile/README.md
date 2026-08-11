# starcamp.lifeadventure mobile release

Native iOS and Android store projects for the production Starcamp service at
`https://starcamp-life-adventure.vercel.app`.

## Release identity

- App name: `starcamp.lifeadventure`
- iOS Bundle ID: `starcamp.lifeadventure`
- Android Application ID: `starcamp.lifeadventure`
- Version: `1.0.0`
- Build / version code: `1`

## iOS

Open `ios/StarcampLifeAdventure.xcodeproj` in Xcode, select the Apple Developer
team, create the matching App Store Connect app, archive, validate and upload.
The app contains native navigation, pull-to-refresh, sharing and haptic feedback.

## Android

Open `android` in Android Studio, allow Gradle to sync, create an upload key,
then build a signed Android App Bundle. The project targets API 36 and contains
native navigation, pull-to-refresh, sharing and haptic feedback.

Never commit signing certificates, keystores, passwords, API keys or App Store
Connect private keys to source control.
