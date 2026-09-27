import { z } from "zod";
import { infrai, type MetricPoint } from "./infrai.js";

export const handoffRequestSchema = z.object({
  orderId: z.string().min(1),
  sellerId: z.string().min(1),
  buyerId: z.string().min(1),
  sellerAssets: z.array(
    z.object({
      assetId: z.string().min(1),
      kind: z.enum(["download", "license", "instructions"]),
      ready: z.boolean(),
    }),
  ).min(1),
  buyerUpdates: z.array(
    z.object({
      updateId: z.string().min(1),
      acknowledged: z.boolean(),
    }),
  ).min(1),
});

export type HandoffRequest = z.infer<typeof handoffRequestSchema>;

export type HandoffDecision = {
  orderId: string;
  status: "ready_for_buyer" | "awaiting_seller" | "awaiting_buyer";
  readyAssetCount: number;
  pendingBuyerUpdateCount: number;
};

export function decideOrderHandoff(input: HandoffRequest): HandoffDecision {
  const readyAssetCount = input.sellerAssets.filter((asset) => asset.ready).length;
  const pendingBuyerUpdateCount = input.buyerUpdates.filter(
    (update) => !update.acknowledged,
  ).length;
  const hasPendingAsset = readyAssetCount !== input.sellerAssets.length;

  return {
    orderId: input.orderId,
    status: hasPendingAsset
      ? "awaiting_seller"
      : pendingBuyerUpdateCount > 0
        ? "awaiting_buyer"
        : "ready_for_buyer",
    readyAssetCount,
    pendingBuyerUpdateCount,
  };
}

function metricPoints(
  input: HandoffRequest,
  decision: HandoffDecision,
  timestamp: string,
): MetricPoint[] {
  const tags = {
    seller_id: input.sellerId,
    handoff_status: decision.status,
  };
  return [
    {
      name: "marketplace.order_handoff",
      type: "counter",
      value: 1,
      tags,
      timestamp,
    },
    {
      name: "marketplace.seller_assets_ready",
      type: "gauge",
      value: decision.readyAssetCount,
      tags,
      timestamp,
    },
    {
      name: "marketplace.buyer_updates_pending",
      type: "gauge",
      value: decision.pendingBuyerUpdateCount,
      tags,
      timestamp,
    },
  ];
}

export async function handoffOrder(input: HandoffRequest): Promise<HandoffDecision> {
  const decision = decideOrderHandoff(input);
  const timestamp = new Date().toISOString();
  const points = metricPoints(input, decision, timestamp);

  await Promise.all(
    points.map((point) =>
      infrai.metrics.report(
        point,
        `${input.orderId}:${decision.status}:${point.name}`,
      ),
    ),
  );
  return decision;
}
