import { describe, it, expect, vi } from "vitest";
import { withFsaRetry } from "./deviceStorage.js";

describe("withFsaRetry", () => {
  it("returns the first successful attempt's result without retrying", async () => {
    const fn = vi.fn(async () => "ok");
    const result = await withFsaRetry(fn, { attempts: 3, delayMs: 0 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure and succeeds within the attempt budget", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new DOMException("An operation that depends on state cached in an interface object was made but the state had changed since it was read from disk.");
      return "recovered";
    });
    const result = await withFsaRetry(fn, { attempts: 3, delayMs: 0 });
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the last error once every attempt is exhausted, without masking a persistent failure", async () => {
    const fn = vi.fn(async () => {
      throw new Error("Device folder not connected.");
    });
    await expect(withFsaRetry(fn, { attempts: 3, delayMs: 0 })).rejects.toThrow("Device folder not connected.");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
