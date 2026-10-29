import { describe, it, expect } from "vitest";
import { appendCaret } from "@/lib/rehypeTypingCaret";

const el = (tagName, children = []) => ({ type: "element", tagName, properties: {}, children });
const text = (value) => ({ type: "text", value });
const root = (...children) => ({ type: "root", children });
const isCaret = (n) => n?.tagName === "span" && n.properties.className.includes("chat-cursor-blink");

describe("appendCaret", () => {
  it("puts the caret inside the last paragraph, after its text", () => {
    const tree = root(el("p", [text("First")]), text("\n"), el("p", [text("This will archive the 3 finished tasks i")]));
    appendCaret(tree);
    const p = tree.children[2];
    expect(p.children.map((c) => c.type === "text" ? c.value : "CARET")).toEqual(["This will archive the 3 finished tasks i", "CARET"]);
    expect(tree.children).toHaveLength(3);
  });

  it("goes into the last item of a trailing list", () => {
    const tree = root(el("ul", [text("\n"), el("li", [text("one")]), text("\n"), el("li", [el("p", [text("two")])]), text("\n")]));
    appendCaret(tree);
    const li = tree.children[0].children[3];
    expect(isCaret(li.children[0].children[1])).toBe(true);
  });

  it("follows inline formatting to the end of the text", () => {
    const tree = root(el("p", [text("Moved to "), el("strong", [text("Nov 14")])]));
    appendCaret(tree);
    expect(isCaret(tree.children[0].children[1].children[1])).toBe(true);
  });

  it("never enters a code block (the tool-log renderer reads it as text)", () => {
    const tree = root(el("pre", [el("code", [text("plan · 2 steps")])]));
    appendCaret(tree);
    expect(tree.children[0].children[0].children).toHaveLength(1);
    expect(isCaret(tree.children[1])).toBe(true);
  });

  it("handles an empty message", () => {
    const tree = root();
    appendCaret(tree);
    expect(isCaret(tree.children[0])).toBe(true);
  });
});
