// Connection details for a user's Apple/iCloud Mail account. Different
// trust shape from Gmail/Outlook: Apple has no public OAuth API for iCloud
// Mail — access is via IMAP using an app-specific password the user
// generates themselves at appleid.apple.com, not a redirect-based consent
// screen. Same local-only storage discipline as every other connection
// here (deviceStorage, never sent to Vaea's servers at rest).
import { createDeviceKeyStore } from "@/lib/deviceKeyStore";

export const DEFAULTS = {
  emailAddress: "",
  appSpecificPassword: "",
};

const store = createDeviceKeyStore("vaea_apple_mail", DEFAULTS);

export const loadAppleMailConnection = store.load;
export const saveAppleMailConnection = store.save;
export const clearAppleMailConnection = store.clear;

export function isAppleMailConnected(connection) {
  return !!(connection?.emailAddress && connection?.appSpecificPassword);
}
