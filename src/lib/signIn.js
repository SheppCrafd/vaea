import { base44 } from "@/api/base44Client";
import { LOGIN_PENDING_KEY } from "@/lib/app-params";

// Every provider sign-in starts here. It notes in this tab's sessionStorage
// that a sign-in is under way, and app-params.js accepts the ?access_token=
// the provider sends back only when that note is present. A link carrying
// someone else's token (to sign a visitor into the attacker's account) is
// ignored.
export function startProviderSignIn(provider, fromUrl) {
  try {
    sessionStorage.setItem(LOGIN_PENDING_KEY, String(Date.now()));
  } catch {
    // Without sessionStorage the returned token can't be accepted; the
    // person can still sign in with email and password.
  }
  base44.auth.loginWithProvider(provider, fromUrl);
}
