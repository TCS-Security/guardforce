/** Domain token from a PL/pgSQL raise ("TAMPER_SUSPECTED: mock…") or the SQLSTATE, else the message. */
export class ApiError extends Error {
  constructor(public code: string, message: string, public retryable = false) { super(message); }
}
const tokenRe = /^([A-Z][A-Z0-9_]{2,})(?::|$)/;

/**
 * Postgres classes that mean "ask again", not "no": connection exceptions (08), insufficient
 * resources (53), operator intervention such as a cancelled statement (57), and the two
 * concurrency retries (40001 serialization failure, 40P01 deadlock).
 */
const retryableSqlState = /^(08|53|57)|^40001$|^40P01$/;

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const anyE = e as { message?: string; code?: string; status?: number; statusCode?: number; name?: string } | null;
  const msg = anyE?.message ?? String(e);
  if (anyE?.name === "TypeError" || /network request failed|fetch failed|Failed to fetch/i.test(msg)) return new ApiError("NETWORK", msg, true);
  const token = tokenRe.exec(msg)?.[1];
  if (token) return new ApiError(token, msg);
  if (anyE?.code && /^P0/.test(anyE.code)) return new ApiError(anyE.code, msg);
  // A PostgrestError has no `status`: a transport failure arrives with the HTTP status in `code`
  // ("503"), a thrown fetch response with it in `status`. Read both, because a 5xx is the server
  // having a bad moment and the outbox must keep the write rather than resolve it as rejected.
  const status = anyE?.status ?? anyE?.statusCode ?? (anyE?.code && /^\d{3}$/.test(anyE.code) ? Number(anyE.code) : undefined);
  if (status != null && status >= 500) return new ApiError("SERVER", msg, true);
  if (status === 401 || anyE?.code === "PGRST301") return new ApiError("UNAUTHORIZED", msg);
  if (anyE?.code && retryableSqlState.test(anyE.code)) return new ApiError(anyE.code, msg, true);
  return new ApiError(anyE?.code ?? "ERROR", msg);
}
