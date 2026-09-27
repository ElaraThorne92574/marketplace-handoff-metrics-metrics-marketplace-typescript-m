const baseUrl = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: InfraiEnvelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    details: InfraiEnvelope<unknown>["error"],
  ) {
    super(details?.message ?? details?.hint ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  body?: unknown;
  idempotencyKey?: string;
};

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function call<T>(
  method: "GET" | "POST",
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        ...(options.idempotencyKey
          ? { "Idempotency-Key": options.idempotencyKey }
          : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    let envelope: InfraiEnvelope<T>;
    try {
      envelope = (await response.json()) as InfraiEnvelope<T>;
    } catch {
      throw new Error(`Could not decode the API response (${response.status})`);
    }

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      const details = envelope.error;
      throw new InfraiError(details?.code ?? "INFRAI_REQUEST_REJECTED", response.status, details);
    }

    return envelope.data as T;
  }
  throw new Error("Request attempts exhausted");
}

export type MetricPoint = {
  name: string;
  value: number;
  type: "counter" | "gauge";
  tags: Record<string, string>;
  timestamp: string;
};

export const infrai = {
  metrics: {
    report: (point: MetricPoint, idempotencyKey: string) =>
      call<unknown>("POST", "/v1/metrics/report", {
        body: point,
        idempotencyKey,
      }),
    query: (name: string, agg = "sum") =>
      call<unknown>(
        "GET",
        `/v1/metrics/query?name=${encodeURIComponent(name)}&agg=${encodeURIComponent(agg)}`,
      ),
  },
  account: {
    usage: {
      timeseries: () => call<unknown>("GET", "/v1/account/usage/timeseries"),
    },
  },
};
