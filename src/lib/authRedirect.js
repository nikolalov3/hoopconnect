// Single source of truth for auth redirect URLs (OAuth callbacks + password reset).
//
// Web / PWA: the current origin (https://hoopconnect.pl) — works today.
// When the app is packaged with Capacitor, window.location.origin becomes
// capacitor://localhost / http://localhost, which Google/Apple won't redirect to
// and Supabase won't allowlist. At that point, switch the native branch below to a
// registered Universal Link / App Link (or custom scheme), add it to
// Supabase Auth → Redirect URLs, and handle the callback via @capacitor/app's
// appUrlOpen. Keeping it here makes that a one-line change instead of touching
// every auth call site.
export function authRedirectUrl() {
  // TODO(capacitor): if (window.Capacitor?.isNativePlatform?.()) return 'https://hoopconnect.pl/auth-callback'
  return window.location.origin
}
