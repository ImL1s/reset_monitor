import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("codex-resets history corpus", () => {
  it("has enough events with ids and text", () => {
    const raw = JSON.parse(
      readFileSync(
        join(root, "fixtures/corpus/codex-resets-history.json"),
        "utf8",
      ),
    );
    assert.ok(raw.events.length >= 30);
    for (const e of raw.events) {
      assert.match(e.tweet_id, /^\d+$/);
      assert.ok(e.text.length > 20);
      assert.ok(e.tweet_url.includes(e.tweet_id));
    }
  });
});
