import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatWaitMinutes } from "../../lib/formatWaitMinutes";

describe("formatWaitMinutes", () => {
  it("0과 null을 구분한다", () => {
    assert.equal(formatWaitMinutes(0), "0분");
    assert.equal(formatWaitMinutes(null), "정보 없음");
    assert.equal(formatWaitMinutes(undefined), "정보 없음");
    assert.equal(formatWaitMinutes(12), "12분");
  });
});
