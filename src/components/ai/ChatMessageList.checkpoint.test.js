import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import ChatMessageList from "./ChatMessageList.jsx";

const base = { session_id: "s", role: "assistant" };
const render = (messages, props = {}) =>
  renderToString(createElement(ChatMessageList, { messages, newMessageIds: new Set(), onConfirm: () => {}, onCancel: () => {}, ...props })).replaceAll("<!-- -->", "");

describe("ChatMessageList checkpoints and holds", () => {
  it("shows an auto-approved change's checkpoint by name, with Revert", () => {
    const html = render(
      [{ ...base, id: "m1", content: "Deleting the project.", tool_log_detail: {
        checkpoint: { id: "c1", label: 'Deleted project "Q1 Newsletter" from Marketing' },
        auto_approved: "Checked 1 step against your board: every item exists, and a checkpoint can undo all of it.",
      } }],
      { onRevert: () => {} }
    );
    expect(html).toContain("Auto-approved.");
    expect(html).toContain("Checkpoint: Deleted project &quot;Q1 Newsletter&quot; from Marketing");
    expect(html).toContain(">Revert<");
  });

  it("shows Reverted once it has been undone", () => {
    const html = render(
      [{ ...base, id: "m1", content: "Done.", tool_log_detail: { checkpoint: { id: "c1", label: "Added 3 tasks" }, reverted_at: "2026-10-30" } }],
      { onRevert: () => {} }
    );
    expect(html).toContain("Reverted");
    expect(html).not.toContain(">Revert<");
  });

  it("says why a plan is waiting", () => {
    const html = render([{ ...base, id: "m1", content: "This will send it.", pending_action: {
      actions: [{ action: "SEND_GMAIL_MESSAGE", args: {} }],
      hold_reason: "This chat read email, so changes to your connected apps wait for your yes.",
    } }]);
    expect(html).toContain("This chat read email, so changes to your connected apps wait for your yes.");
    expect(html).toContain("Yes, do it");
  });
});
