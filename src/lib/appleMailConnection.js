// Connection details for a user's Apple/iCloud Mail account. Different
// trust shape from Gmail/Outlook: Apple has no public OAuth API for iCloud
// Mail — access is via IMAP using an app-specific password the user
// generates themselves at appleid.apple.com, not a redirect-based consent
// screen. Same local-only storage discipline as every other connection
// here (deviceStorage, never sent to Vaea's servers at rest).
import { readKey, writeKey, removeKey } from "@/lib/deviceStorage";

export const APPLE_MAIL_CONNECTION_KEY = "vaea_apple_mail";

export const DEFAULTS = {
  emailAddress: "",
  appSpecificPassword: "",
};

export async function loadAppleMailConnection() {
  try {
    const stored = await readKey(APPLE_MAIL_CONNECTION_KEY);
    return { ...DEFAULTS, ...(stored || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveAppleMailConnection(connection) {
  try {
    await writeKey(APPLE_MAIL_CONNECTION_KEY, { ...DEFAULTS, ...connection });
  } catch {
    // best-effort — the connection just won't survive a reload
  }
}

export async function clearAppleMailConnection() {
  try {
    await removeKey(APPLE_MAIL_CONNECTION_KEY);
  } catch {
    // best-effort
  }
}

export function isAppleMailConnected(connection) {
  return !!(connection?.emailAddress && connection?.appSpecificPassword);
}
