import type { z } from 'zod';

export const DUCO_API = 'https://server.duinocoin.com';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'server' | 'shape' | 'timeout',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The envelope every Duino-Coin endpoint wraps its payload in. */
type Envelope = { success?: boolean; result?: unknown; message?: unknown };

/*
  The whole reason this function exists.

  Duino-Coin signals failure with HTTP 200 and `success: false`, so `response.ok` is
  not a usable success test — `{"success": false, "message": "User banned"}` would
  otherwise sail through as valid data. Every read goes through here.
*/
export function unwrap(body: unknown): unknown {
  if (body === null || typeof body !== 'object') {
    throw new ApiError('Response was not a JSON object', 'shape');
  }
  const env = body as Envelope;

  if (env.success === false) {
    const msg = typeof env.message === 'string' ? env.message : 'Request rejected';
    throw new ApiError(msg, 'server');
  }
  // /statistics answers with a bare object and no envelope at all.
  return 'result' in env ? env.result : body;
}

export async function getJson<T>(
  path: string,
  schema: z.ZodType<T>,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 20_000 } = opts;
  const timer = new AbortController();
  const timeout = setTimeout(() => timer.abort(), timeoutMs);

  // Caller-driven aborts (unmount, username change) must also cancel the request.
  const onAbort = () => timer.abort();
  opts.signal?.addEventListener('abort', onAbort);

  let res: Response;
  try {
    res = await fetch(`${DUCO_API}${path}`, {
      signal: timer.signal,
      headers: { accept: 'application/json' },
    });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    throw new ApiError(
      timer.signal.aborted ? `Timed out after ${timeoutMs}ms` : `Network error: ${String(err)}`,
      timer.signal.aborted ? 'timeout' : 'network',
    );
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener('abort', onAbort);
  }

  // A non-200 here is a genuine transport/proxy failure rather than an app error,
  // since the app's own errors arrive as 200s.
  if (!res.ok) throw new ApiError(`HTTP ${res.status} for ${path}`, 'network');

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(`Malformed JSON from ${path}`, 'shape');
  }

  const parsed = schema.safeParse(unwrap(body));
  if (!parsed.success) {
    throw new ApiError(`Unexpected shape from ${path}: ${parsed.error.issues[0]?.message}`, 'shape');
  }
  return parsed.data;
}
