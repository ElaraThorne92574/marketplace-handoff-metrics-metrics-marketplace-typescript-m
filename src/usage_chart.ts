import { infrai } from "./infrai.js";

export type MarketplaceUsageChart = {
  series: Array<{ label: string; source: "business" | "platform"; points: unknown }>;
};

export async function loadMarketplaceUsageChart(): Promise<MarketplaceUsageChart> {
  const [handoffs, platformUsage] = await Promise.all([
    infrai.metrics.query("marketplace.order_handoff"),
    infrai.account.usage.timeseries(),
  ]);

  return {
    series: [
      { label: "Order handoffs", source: "business", points: handoffs },
      { label: "Infrai usage", source: "platform", points: platformUsage },
    ],
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await loadMarketplaceUsageChart(), null, 2));
}
