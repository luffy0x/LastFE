export class RequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = "RequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = RequestInit & { timeoutMs?: number };

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return response.json();

  return response.text();
}

export async function request<T>(
  input: string,
  options: RequestOptions = {},
): Promise<T> {
  const { timeoutMs = 8000, signal: callerSignal, ...init } = options;
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(callerSignal?.reason);

  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeout = setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    timeoutMs,
  );

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const payload = await parseResponse(response);

    if (!response.ok) {
      const body =
        typeof payload === "object" && payload !== null
          ? (payload as Record<string, unknown>)
          : {};
      throw new RequestError(
        typeof body.message === "string"
          ? body.message
          : `请求失败 (${response.status})`,
        response.status,
        typeof body.code === "string" ? body.code : "REQUEST_FAILED",
        payload,
      );
    }

    return payload as T;
  } finally {
    clearTimeout(timeout);
    callerSignal?.removeEventListener("abort", abortFromCaller);
  }
}
