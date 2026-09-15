/** Domain token from a PL/pgSQL raise ("TAMPER_SUSPECTED: mock…") or the SQLSTATE, else the message. */
export class ApiError extends Error {
  constructor(public code: string, message: string, public retryable = false) { super(message); }
}
const tokenRe = /^([A-Z][A-Z0-9_]{2,})(?::|$)/;

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const anyE = e as { message?: string; code?: string; status?: number; name?: string } | null;
  const msg = anyE?.message ?? String(e);
  if (anyE?.name === "TypeError" || /network request failed|fetch failed|Failed to fetch/i.test(msg)) return new ApiError("NETWORK", msg, true);
  const token = tokenRe.exec(msg)?.[1];
  if (token) return new ApiError(token, msg);
  if (anyE?.code && /^P0/.test(anyE.code)) return new ApiError(anyE.code, msg);
  if (anyE?.status && anyE.status >= 500) return new ApiError("SERVER", msg, true);
  if (anyE?.status === 401 || anyE?.code === "PGRST301") return new ApiError("UNAUTHORIZED", msg);
  return new ApiError(anyE?.code ?? "ERROR", msg);
}
