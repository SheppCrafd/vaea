// Connection details for a user's Granola account (meeting notes), reached
// through Granola's MCP server. Saved through deviceStorage like every other
// connector, so it lives wherever the user keeps their data.
import { createDeviceKeyStore } from "@/lib/deviceKeyStore";

export const DEFAULTS = {
  clientId: "",
  accessToken: "",
  refreshToken: "",
  expiresAt: 0,
  emailAddress: "",
  // Granola's mcp_plan from get_account_info (e.g. "free", "business"):
  // what the user can read follows it. Empty when Granola didn't say.
  plan: "",
};

const store = createDeviceKeyStore("vaea_granola", DEFAULTS);

export const loadGranolaConnection = store.load;
export const saveGranolaConnection = store.save;
export const clearGranolaConnection = store.clear;

// Free Granola plans share the last 30 days of notes and no transcripts.
export function isFreeGranolaPlan(plan) {
  return /free|basic/i.test(plan || "");
}

export function isGranolaConnected(connection) {
  return !!(connection?.clientId && connection?.accessToken);
}

// The client ID Granola issued to this browser origin (Dynamic Client
// Registration). Kept apart from the connection so Disconnect doesn't force a
// fresh registration on the next Connect.
const registrationStore = createDeviceKeyStore("vaea_granola_client", { clientId: "", redirectUri: "" });

export const loadGranolaRegistration = registrationStore.load;
export const saveGranolaRegistration = registrationStore.save;
