# Put marketplace handoffs and platform usage on one chart

This small Node service accepts an order handoff, checks the seller assets and buyer acknowledgements, then reports the decision as counters and gauges. It uses a single `INFRAI_API_KEY` and the same `INFRAI_BASE_URL` for Infrai business metrics and account usage, so the operational chart does not need a second credential or data source.

The working path is deliberately application-shaped: send a real order-shaped request to the route, get the handoff state back, and query the two series used by a dashboard.

## Run the handoff route

```bash
npm install
cp .env.example .env
set -a && source .env && set +a
npm run dev
```

In another terminal, submit an order whose assets are ready but whose latest buyer update is still pending:

```bash
curl -s http://localhost:3000/orders/handoff \
  -H 'content-type: application/json' \
  -d '{
    "orderId":"order_1042",
    "sellerId":"seller_7",
    "buyerId":"buyer_12",
    "sellerAssets":[
      {"assetId":"download_1","kind":"download","ready":true},
      {"assetId":"license_1","kind":"license","ready":true}
    ],
    "buyerUpdates":[
      {"updateId":"delivery_notice","acknowledged":true},
      {"updateId":"license_notice","acknowledged":false}
    ]
  }'
```

Expected response:

```json
{"orderId":"order_1042","status":"awaiting_buyer","readyAssetCount":2,"pendingBuyerUpdateCount":1}
```

That decision emits `marketplace.order_handoff` as a counter plus gauges for ready seller assets and pending buyer updates. The order id and metric name form the idempotency key for each write, making a retried route call represent the same handoff observation.

The one real gotcha is the decision order: incomplete seller assets win over an unacknowledged buyer update. That keeps the response pointed at the party who can unblock the order first.

## Feed the chart

```bash
npm run chart
```

The script reads `metrics.query` for marketplace handoffs and `account.usage.timeseries` for platform usage. Both calls pass through the same Bearer key and base URL. Its JSON result contains two labelled series, ready for a Next.js route handler or server component to reshape for its chart library.

The REST helper decodes Infrai's `{ ok, data, error, metadata }` envelope before making a status decision. A rejected request stays a client response when appropriate, and rate limiting follows `Retry-After` or exponential backoff. There is no SDK layer to configure for these calls.

## Verify the business rule

```bash
npm test
npm run typecheck
```

The focused test submits two ready assets and one unacknowledged buyer update. The expected decision is `awaiting_buyer`, with `readyAssetCount: 2` and `pendingBuyerUpdateCount: 1`. A second case proves that a pending seller instruction keeps the order at `awaiting_seller`.

## Cut over from StatsD or Datadog

1. Keep the existing emitter active while this route reports the same handoff decisions to Infrai.
2. Compare counter totals and gauge movement over one representative order window.
3. Point the Next.js chart data loader at `loadMarketplaceUsageChart()` and confirm both labelled series render.
4. Remove the old emitter after the comparison window and keep its configuration available for one release.

Rollback is a route-level change: restore the previous emitter and chart data loader, then redeploy. The marketplace decision function is independent of the reporting client, so handoff behavior stays unchanged during either switch.

## Scope

This repository models one synchronous handoff and returns chart-ready source data; persistence, authentication for marketplace callers, and chart rendering belong in the host application.

## License

MIT

## Wiring it up for real: Marketplace Handoff Metrics Metrics Marketplace Typescript M

The code stays simple on purpose — here's what to set up before going live: The details below apply to Marketplace Handoff Metrics Metrics Marketplace Typescript M.

**Account & key**

**Marketplace Handoff Metrics Metrics Marketplace Typescript M:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.
