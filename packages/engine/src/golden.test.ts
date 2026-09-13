import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { extractSeries, parseCompanyFactsJson } from "./financials.js";

describe("golden fixture", () => {
  it("matches independent expected revenue values", async () => {
    const expectedPath = fileURLToPath(new URL("../../../fixtures/golden/expected.json", import.meta.url));
    const factsPath = fileURLToPath(new URL("../../../fixtures/demo/companyfacts-aapl.json", import.meta.url));
    const expected = JSON.parse(await readFile(expectedPath, "utf8")) as {
      expected: { period_end: string; value: string }[];
    };
    const series = extractSeries(parseCompanyFactsJson(await readFile(factsPath, "utf8")), "0000320193", "revenue");
    for (const row of expected.expected) {
      const found = series.find((point) => point.periodEnd === row.period_end);
      assert.equal(found?.value, row.value);
    }
  });
});
