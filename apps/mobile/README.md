# aphno.ai — mobile & web app

One Expo (React Native) codebase that runs as a **web app** and a **downloadable
Android/iOS app**. Talks to `@aphno/api`.

## Configure

Copy `.env.example` to `apps/mobile/.env` and set:

```
EXPO_PUBLIC_API_URL=http://localhost:4000        # web dev
# EXPO_PUBLIC_API_URL=http://192.168.0.98:4000   # physical device / APK (use your LAN IP)
# EXPO_PUBLIC_API_URL=https://api.aphno.app       # production

EXPO_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com   # Google sign-in
```

A real device (or an installed APK) **cannot reach `localhost`** — point it at
your machine's LAN IP or a deployed API.

**Google sign-in** needs `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (a Web OAuth client ID
from the Google Cloud Console). It must be the **same** value as `GOOGLE_CLIENT_ID`
on the API — the backend verifies the token's audience against it. Set the same
value in the Vercel project's env vars for the deployed web app.

## Run the web app

```bash
pnpm --filter @aphno/mobile web       # → http://localhost:8081
```

## Run on a phone (Expo Go)

```bash
pnpm --filter @aphno/mobile start      # scan the QR code with Expo Go
```

## Build a downloadable app (EAS)

Requires a free Expo account (`npx expo login`).

```bash
cd apps/mobile
npx eas-cli build --platform android --profile preview   # → installable .apk
npx eas-cli build --platform ios     --profile preview   # → .ipa (needs Apple account)
```

`preview` produces a direct-install APK. `production` produces a Play Store
`.aab`. Build profiles live in `eas.json`.

## What's inside

- `App.tsx` — lightweight auth-gated navigator (login → groups → group detail)
- `src/api/client.ts` — typed API client (shares Zod types with the backend)
- `src/state/auth.tsx` — session restore + sign in/out
- `src/screens/` — Login (phone OTP), Groups, GroupDetail (balances, expenses,
  one-tap UPI settle-up)
