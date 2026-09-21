# GenZGames by Arivup Paathai — GenZGames Port

This project keeps the existing GenZGames Android identity and splash/launcher assets, but replaces the old multi-game frontend with the GenZGames flow from GenZShorts.

## Included now

- Google SSO at the top of the app
- Separate GenZGames wallet
- Sudoku (100 levels)
  - 3 lives
  - rewarded ad for Hint
  - rewarded ad to restore 3 lives / continue
  - rewarded ad to unlock the next level
  - locally cached in-progress board so the same level resumes after the ad/app return
  - one-time reward per verified level
- Gold Mine
  - one gold coin per second
  - 300 coins in 5 minutes
  - no per-second Firestore writes: backend stores cycle start and collection only
- Base game reward: ₹0.05
- First successful game earning: ₹1.00 total (₹0.05 game reward + ₹0.95 one-time welcome bonus)
- First redemption minimum: ₹1.00
- Later redemption minimum: ₹5.00
- One pending redemption at a time
- One UPI ID cannot be linked to two different user accounts
- Admin-only redemption panel
- Admin receives an in-app notification when a redemption is requested
- Admin can reveal the protected UPI, transfer the amount, enter payment reference, and mark Paid
- User receives an in-app notification such as “₹X has been credited to your UPI ID …”
- Rejected redemption is returned to the user's game balance
- Existing GenZGames rewarded-ad unit retained
- Existing GenZGames adaptive banner-ad unit retained across the app

## Android identity retained

- Application ID: `com.arivuppaathai.sudoku`
- Firebase project: `multi-games-hub`
- Existing `android/app/google-services.json`
- Existing launcher icons and native splash resources
- Existing AdMob app ID

The uploaded ZIP did not contain the `Arivuppaathai_sudoku` JKS itself. Keep using your existing JKS when creating the signed Play Store release.

## First setup after unzip

From the project root:

```bash
npm install
npm --prefix functions install
```

Create a 32-byte payout-encryption key (64 hex characters):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated value, then run:

```bash
firebase functions:secrets:set PAYOUT_ENCRYPTION_KEY --project multi-games-hub
```

Paste the generated 64-character value when Firebase prompts for the secret.

Build and deploy the backend/rules:

```bash
npm run functions:build
firebase deploy --only functions,firestore:rules --project multi-games-hub
```

Build/sync Android:

```bash
npm run build
npx cap sync android
npx cap open android
```

## Make your account admin

1. Sign in to GenZGames once with the Google account you want to use as admin.
2. Open Firestore in Firebase Console.
3. Open `users/{yourUid}`.
4. Change `role` from `user` to `admin` (or `super_admin`).
5. Keep `accountStatus` as `active`.
6. Reopen/sign in again. The **Admin** button is shown only for admin/super_admin accounts.

## Google SSO

Google Sign-In must be enabled in Firebase Authentication for `multi-games-hub`. The Android Firebase app must also contain the SHA fingerprints for the JKS you use to sign `com.arivuppaathai.sudoku`. If your existing Google SSO already works for this app/Firebase project, no additional change is needed.

## Reward rules

Every new verified Sudoku level or completed 5-minute mining cycle has a ₹0.05 base reward. The first successful earning on the account also gets a one-time ₹0.95 welcome bonus, so the first earning totals ₹1.00 and can immediately use the first ₹1.00 redemption path. Replays cannot earn a second reward.

## Important build note

The source and Cloud Functions TypeScript were type-checked in the generated project. The sandbox contained Windows-origin `node_modules`, so a local Linux Vite bundle could not use Rollup's Linux optional binary. Running `npm install` on your Windows project installs the correct dependencies before `npm run build`.
