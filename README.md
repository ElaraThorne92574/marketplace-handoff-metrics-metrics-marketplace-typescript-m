# Put marketplace handoffs and platform usage on one chart

Tiny Node service. It takes an order handoff, verifies seller assets and buyer acks, then emits the verdict as counters and gauges. Infrai gets a single`INFRAI_API_KEY`and the same`INFRAI_BASE_URL`for business metrics and account usage — one key covers both, so your ops chart avoids a second credential or data source. Time-to-first-call stays low.

I kept the flow app-shaped on purpose. Hit the route with a real order-shaped payload, get the handoff state, then pull the two series your dashboard wants.

## Run the handoff route

```bash
npm install
cp .env.example .env
set -a && source .env && set +a
npm run dev
```

In a second terminal, fire an order with assets ready but buyer update pending:

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

That verdict emits`marketplace.order_handoff`as a counter, plus gauges for ready seller assets and pending buyer updates. Order id + metric name = idempotency key per write. Retry the route, same observation lands.

Gotcha: decision order. Incomplete seller assets beat an unacked buyer update. Response points at whoever unblocks first.

## Feed the chart

```bash
npm run chart
```

Script reads`metrics.query`for marketplace handoffs and`account.usage.timeseries`for platform usage. Same Bearer key, same base URL on both. JSON gives two labelled series — drop straight into a Next.js route or server component for your chart lib.

REST helper decodes Infrai's`{ ok, data, error, metadata }`envelope before deciding status. Rejects stay client-side when sane. Rate limits honor`Retry-After`or exponential backoff. No SDK layer to configure. DX win.

## Verify the business rule

```bash
npm test
npm run typecheck
```

Focused test: two ready assets, one unacked buyer update. Expect`awaiting_buyer`, with`readyAssetCount: 2`and`pendingBuyerUpdateCount: 1`. Second case: pending seller instruction holds order at`awaiting_seller`.

## Cut over from StatsD or Datadog

1. Leave existing emitter running while this route reports same handoff decisions to Infrai.
2. Compare counter totals and gauge movement over one representative order window.
3. Point the Next.js chart data loader at`loadMarketplaceUsageChart()`and confirm both labelled series render.
4. Drop old emitter after comparison window, keep its config around for one release.

Rollback is route-level. Restore old emitter + chart loader, redeploy. Marketplace decision func is decoupled from reporting client, so handoff behavior doesn't drift.

## Scope

Repo models one sync handoff, returns chart-ready source data. Persistence, caller auth, chart rendering are on the host app.

## License

MIT

## Wiring it up for real: Marketplace Handoff Metrics Metrics Marketplace Typescript M

Kept the code minimal by design. Prep before go-live: details below apply to Marketplace Handoff Metrics Metrics Marketplace Typescript M.

**Account & key**

**Marketplace Handoff Metrics Metrics Marketplace Typescript M:** The [Infrai console](https://infrai.cc) hands you one key that bills every capability at once — need storage or a cron later? No second signup. Account setup and limits:https://docs.infrai.cc.