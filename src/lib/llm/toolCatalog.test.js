import { describe, it, expect } from "vitest";
import { toAnthropicTools, toOpenAiCompatibleTools } from "./toolCatalog.js";

// Real bug: a user pasted a Google Drive link straight into the chat
// message (not attached to any project's own "links" array) and the model
// apologized vaguely instead of actually reading it — because
// read_project_link's own description told it the tool was ONLY for a
// project's links array, even though the underlying implementation
// (localTools.js's readProjectLinkTool, a plain fetch()) never actually
// enforced that restriction. Fixed by broadening the description so the
// model knows it can (and should) call this for any URL, including one the
// user just shared directly.
describe("toolCatalog: read_project_link now covers any URL, not just a project's own links array", () => {
  it("toAnthropicTools' read_project_link description no longer restricts itself to a project's links array", () => {
    const tool = toAnthropicTools().find((t) => t.name === "read_project_link");
    expect(tool).toBeDefined();
    expect(tool.description).toMatch(/ANY URL/);
    expect(tool.description).toMatch(/pasted\/shared directly in this conversation/);
  });

  it("toOpenAiCompatibleTools' read_project_link description matches (same shared catalog)", () => {
    const tool = toOpenAiCompatibleTools().find((t) => t.function.name === "read_project_link");
    expect(tool).toBeDefined();
    expect(tool.function.description).toMatch(/ANY URL/);
  });

  it("the url parameter's own description no longer says 'the exact URL from the project's links array' as the only source", () => {
    const tool = toAnthropicTools().find((t) => t.name === "read_project_link");
    expect(tool.input_schema.properties.url.description).toMatch(/a URL the user directly gave you in this conversation/);
  });
});
