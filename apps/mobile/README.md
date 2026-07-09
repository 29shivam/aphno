# APHNO — mobile & web app

One Expo (React Native) codebase that runs as a **web app** and a **downloadable
Android/iOS app**. Talks to `@aphno/api`.

## Configure

Set the API base URL in `apps/mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:4000        # web dev
# EXPO_PUBLIC_API_URL=http://192.168.0.98:4000   # physical device / APK (use your LAN IP)
# EXPO_PUBLIC_API_URL=https://api.aphno.app       # production
```

A real device (or an installed APK) **cannot reach `localhost`** — point it at
your machine's LAN IP or a deployed API.

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
