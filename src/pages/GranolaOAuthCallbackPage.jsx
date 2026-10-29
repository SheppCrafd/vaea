import { NotebookPen } from "lucide-react";
import OAuthCallbackPage from "@/pages/OAuthCallbackPage";
import { exchangeCodeForTokens } from "@/lib/granolaOAuth";
import { saveGranolaConnection } from "@/lib/granolaConnection";
import { callTool, resultText } from "@/lib/granolaMcp";

// Exchanges the code, then asks Granola which account signed in and on which
// plan. Granola answers "user has not created a Granola account yet" when the
// sign-in used a different Google/Microsoft account than the Granola app;
// that stops the connection with a message saying what to do. Any other
// lookup failure still saves the connection (the address is only a label).
async function connect(params) {
  const tokens = await exchangeCodeForTokens(params);
  let emailAddress = "";
  let plan = "";
  let connection = tokens;
  try {
    const out = await callTool(tokens, "get_account_info");
    connection = out.connection;
    const text = resultText(out.result);
    const info = out.result.structuredContent;
    emailAddress = info?.email || text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] || "";
    plan = info?.mcp_plan || text.match(/mcp_plan\W{0,4}([\w-]+)/i)?.[1] || "";
  } catch (err) {
    if (/not created a Granola account/i.test(err.message)) {
      throw new Error("This sign-in isn't linked to a Granola account. Connect again and sign in with the same Google or Microsoft 365 account you use in the Granola app.");
    }
  }
  await saveGranolaConnection({ ...connection, emailAddress, plan });
}

export default function GranolaOAuthCallbackPage() {
  return <OAuthCallbackPage Icon={NotebookPen} message="Connecting Granola…" connect={connect} />;
}
