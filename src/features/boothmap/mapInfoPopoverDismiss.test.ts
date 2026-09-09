import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { keepsPopoverOpen } from "./MapInfoPopover";

/** closest만 흉내 내는 최소 대상. 브라우저 DOM 없이 판정만 확인한다. */
function target(matches: string | null) {
  return {
    closest(selector: string) {
      return matches === selector ? {} : null;
    },
  } as unknown as EventTarget;
}

describe("keepsPopoverOpen", () => {
  it("지도 도구 안을 누르면 말풍선을 닫지 않는다", () => {
    assert.equal(keepsPopoverOpen(target("[data-map-tools]")), true);
  });

  it("지도 빈 곳이나 목록을 누르면 말풍선을 닫는다", () => {
    assert.equal(keepsPopoverOpen(target(null)), false);
  });

  it("closest가 없는 대상(문서 등)도 닫는 쪽으로 본다", () => {
    assert.equal(keepsPopoverOpen({} as EventTarget), false);
    assert.equal(keepsPopoverOpen(null), false);
  });
});
