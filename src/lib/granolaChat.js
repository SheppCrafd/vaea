// What Vaea Chat gets about Granola for one request. The browser refreshes
// the token here (and saves the result) because Granola rotates refresh
// tokens: if the server refreshed instead, this device's copy would stop
// working. Only the short-lived access token is sent, never the refresh
// token, same "sent per request, not stored" rule as the other connectors.
import { loadGranolaConnection, saveGranolaConnection, isGranolaConnected } from "@/lib/granolaConnection";
import { refreshGranolaTokens } from "@/lib/granolaOAuth";

const MIN_LIFETIME_MS = 10 * 60 * 1000;

export async function granolaForChat() {
  const connection = await loadGranolaConnection();
  if (!isGranolaConnected(connection)) return {};
  try {
    let current = connection;
    if (!current.expiresAt || current.expiresAt < Date.now() + MIN_LIFETIME_MS) {
      current = await refreshGranolaTokens(current);
      await saveGranolaConnection(current);
    }
    return { accessToken: current.accessToken, emailAddress: current.emailAddress, plan: current.plan };
  } catch {
    // A failed refresh reads as "not connected" for this request; the
    // Meetings tab and Settings show the real error.
    return {};
  }
}
