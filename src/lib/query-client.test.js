import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { MutationObserver } from "@tanstack/react-query";

vi.mock("@/components/ui/use-toast", () => ({ toast: vi.fn() }));
import { toast } from "@/components/ui/use-toast";
import { queryClientInstance } from "@/lib/query-client";

const fail = (options) =>
  new MutationObserver(queryClientInstance, { retry: false, ...options }).mutate().catch(() => {});

describe("global mutation error toast", () => {
  beforeEach(() => toast.mockClear());

  it("uses the error's own title first", async () => {
    const err = Object.assign(new Error("Reconnect it in Settings, then try again."), { title: "Couldn't reach your vault" });
    await fail({ mutationFn: () => Promise.reject(err), meta: { errorTitle: "Couldn't add task" } });
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0]).toMatchObject({ title: "Couldn't reach your vault", description: "Reconnect it in Settings, then try again." });
  });

  it("falls back to the hook's meta.errorTitle, then a generic title", async () => {
    await fail({ mutationFn: () => Promise.reject(new Error("disk full")), meta: { errorTitle: "Couldn't create area" } });
    await fail({ mutationFn: () => Promise.reject(new Error("disk full")) });
    expect(toast.mock.calls.map((c) => c[0].title)).toEqual(["Couldn't create area", "Couldn't save that change"]);
  });

  it("stays out of the way of a hook that handles its own errors", async () => {
    await fail({ mutationFn: () => Promise.reject(new Error("x")), onError: () => {} });
    expect(toast).not.toHaveBeenCalled();
  });
});

// A per-call `.mutate(vars, { onError })` can't be seen by the global
// handler, so it double-toasted every failure. Keep it from coming back.
describe("no per-call onError on mutate()", () => {
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(jsx?|tsx?)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
    }
  };
  walk(path.resolve(__dirname, ".."));

  it("finds none", () => {
    const offenders = [];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      let i = -1;
      while ((i = src.indexOf(".mutate(", i + 1)) !== -1) {
        // Walk to the matching close paren of this call.
        let depth = 0;
        let j = i + ".mutate".length;
        for (; j < src.length; j++) {
          if (src[j] === "(") depth++;
          else if (src[j] === ")" && --depth === 0) break;
        }
        if (/\bonError\s*:/.test(src.slice(i, j))) offenders.push(`${path.relative(process.cwd(), f)}:${src.slice(0, i).split("\n").length}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
