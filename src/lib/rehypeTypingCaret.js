// Puts the typing caret at the end of the last line of text, inside the
// rendered markdown. Rendered as a sibling after <ReactMarkdown>, the caret
// started a new line under the last block (a <p> or a list), so it sat alone
// at the bottom instead of following the last letter.
//
// Walks to the deepest last element that holds text and appends the caret
// there. Stops before code blocks: Vaea's tool-log renderer reads a code
// block's children as plain text, so the caret goes after the block instead.

export const CARET_CLASSES = ["inline-block", "w-[7px]", "h-[13px]", "bg-primary/70", "align-middle", "ml-0.5", "chat-cursor-blink"];

const STOP = new Set(["pre", "code", "br", "hr", "img", "input", "table"]);

function caretNode() {
  return { type: "element", tagName: "span", properties: { className: CARET_CLASSES, ariaHidden: "true" }, children: [] };
}

function lastMeaningful(children = []) {
  for (let i = children.length - 1; i >= 0; i--) {
    const c = children[i];
    if (c.type === "text" && !c.value.trim()) continue;
    if (c.type === "comment") continue;
    return c;
  }
  return null;
}

export function appendCaret(tree) {
  let node = tree;
  for (;;) {
    const last = lastMeaningful(node.children);
    if (!last || last.type !== "element" || STOP.has(last.tagName)) break;
    node = last;
  }
  node.children = [...(node.children || []), caretNode()];
  return tree;
}

export default function rehypeTypingCaret() {
  return (tree) => {
    appendCaret(tree);
  };
}
