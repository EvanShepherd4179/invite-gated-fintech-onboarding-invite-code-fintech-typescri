import assert from "node:assert/strict";
import test from "node:test";
import { InviteBook } from "./onboarding_service.ts";

test("an invite accepts once, then records the used decision", () => {
  const book = new InviteBook([{ code: "CHECKOUT-42", expiresAt: 2000 }]);
  assert.deepEqual(book.consume("CHECKOUT-42", 1000), { accepted: true, reason: "invite-accepted" });
  assert.deepEqual(book.consume("CHECKOUT-42", 1000), { accepted: false, reason: "invite-used" });
  assert.deepEqual(book.decide("MISSING", 1000), { accepted: false, reason: "invalid-invite" });
});
