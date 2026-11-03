# Kopela AI Trader — Android release readiness

## Automated Android build
The Android workflow builds a debug APK and release AAB. A Play Store upload requires a signed AAB. The workflow signs only when the repository's GitHub Actions secrets are configured.

## Set up signing securely
Create a dedicated Android upload keystore locally. Never commit the keystore or passwords to this repository. Configure these repository Actions secrets:
- `ANDROID_KEYSTORE_BASE64`: base64 encoding of the keystore file
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Keep a secure offline backup of the keystore and credentials. If Play App Signing is used, Google manages the app-signing key; this keystore is the upload key. Do not send signing credentials in chat.

## Play Console checklist
Before production release, the owner must provide/confirm:
- Store title, short and full descriptions, category, support contact and developer identity
- High-resolution app icon, feature graphic, phone screenshots (and tablet assets if targeting tablets)
- Public privacy policy URL and in-app privacy disclosures
- Data Safety answers, ads declaration, target audience/children declaration, content rating questionnaire
- App access/test credentials if reviewer login is required
- Financial features/trading declarations and country availability
- Internal/closed testing and any account-specific testing requirements shown in Play Console

Do not submit declarations without reviewing the actual app behavior, data collection, and third-party services.

## Current product scope
The mobile layout receives touch-size and small-screen layout refinements. Broker execution remains disabled unless the separate backend integration is implemented, validated, and enabled. Do not market simulated controls as live trading.
