import assert from "node:assert/strict";
import test from "node:test";
import { decideOrderHandoff } from "../src/order_handoff.js";

test("holds the handoff until the buyer acknowledges the latest update", () => {
  const decision = decideOrderHandoff({
    orderId: "order_1042",
    sellerId: "seller_7",
    buyerId: "buyer_12",
    sellerAssets: [
      { assetId: "asset_download", kind: "download", ready: true },
      { assetId: "asset_license", kind: "license", ready: true },
    ],
    buyerUpdates: [
      { updateId: "update_delivery", acknowledged: true },
      { updateId: "update_license", acknowledged: false },
    ],
  });

  assert.deepEqual(decision, {
    orderId: "order_1042",
    status: "awaiting_buyer",
    readyAssetCount: 2,
    pendingBuyerUpdateCount: 1,
  });
});

test("hands off only after every seller asset is ready", () => {
  const decision = decideOrderHandoff({
    orderId: "order_1043",
    sellerId: "seller_7",
    buyerId: "buyer_15",
    sellerAssets: [
      { assetId: "asset_download", kind: "download", ready: true },
      { assetId: "asset_instructions", kind: "instructions", ready: false },
    ],
    buyerUpdates: [{ updateId: "update_delivery", acknowledged: true }],
  });

  assert.equal(decision.status, "awaiting_seller");
  assert.equal(decision.readyAssetCount, 1);
});
