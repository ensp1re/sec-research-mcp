import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DERIVATION, MISSINGNESS } from "./constants/numeric.js";
import { ERROR_CODE } from "./constants/error.js";
import { JOB_STATE } from "./constants/job.js";
import { PERIOD_KIND, REVISION_POLICY } from "./constants/period.js";
import { RETENTION_MODE } from "./constants/dataset.js";
import { CHART_KIND, MISSING_VALUES_POLICY } from "./constants/artifact.js";

function uniqueValues(record: Record<string, string>): string[] {
  const values = Object.values(record);
  return [...new Set(values)];
}

describe("domain constants", () => {
  it("keeps missingness distinct from zero and from derivation", () => {
    const missing = uniqueValues(MISSINGNESS);
    assert.equal(missing.length, Object.keys(MISSINGNESS).length);
    assert.equal(missing.includes("0"), false);
    assert.equal(missing.includes("zero"), false);
    assert.equal(missing.includes(DERIVATION.REPORTED), false);
    assert.equal(missing.includes(DERIVATION.DERIVED), false);
  });

  it("keeps revision policies and period kinds unique", () => {
    assert.equal(uniqueValues(REVISION_POLICY).length, 3);
    assert.equal(REVISION_POLICY.AS_OF, "as_of");
    assert.equal(PERIOD_KIND.DISCRETE_QUARTER, "discrete_quarter");
    assert.equal((Object.values(PERIOD_KIND) as string[]).includes("quarter"), false);
  });

  it("keeps job terminal states distinct from intermediate states", () => {
    const values = uniqueValues(JOB_STATE);
    assert.equal(values.length, Object.keys(JOB_STATE).length);
    assert.deepEqual(
      [JOB_STATE.RETRY_WAIT, JOB_STATE.CANCEL_REQUESTED].sort(),
      ["cancel_requested", "retry_wait"],
    );
    assert.equal(values.includes("success"), false);
  });

  it("exports the planned tool error codes", () => {
    assert.equal(ERROR_CODE.ENTITY_AMBIGUOUS, "entity_ambiguous");
    assert.equal(ERROR_CODE.AVAILABILITY_PRECISION_INSUFFICIENT, "availability_precision_insufficient");
    assert.equal(uniqueValues(ERROR_CODE).length, Object.keys(ERROR_CODE).length);
  });

  it("defaults chart missing values to an explicit gap", () => {
    assert.equal(MISSING_VALUES_POLICY.GAP, "gap");
    assert.equal(Object.keys(MISSING_VALUES_POLICY).length, 1);
    assert.equal(CHART_KIND.GROUPED_BAR, "grouped_bar");
  });

  it("keeps scratch and pinned retention distinct", () => {
    assert.notEqual(RETENTION_MODE.SCRATCH, RETENTION_MODE.PINNED);
  });
});
