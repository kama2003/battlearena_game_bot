import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { env } from "../config/env";
import { getProxyAgent } from "./proxyAgent";

export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

/**
 * Calls apps/api's /api/admin/* routes, authenticated with a shared secret
 * (see apps/api/src/modules/admin/routes.ts) rather than a per-user JWT.
 * Uses Node's http(s) directly instead of fetch so the same proxy agent
 * grammY needs in a sandboxed dev environment (see proxyAgent.ts) also
 * covers this call; in a normal deployment (Render, a VPS) there's no
 * proxy and this behaves like a plain request.
 */
export async function callAdminApi<T>(
  path: string,
  options: { method?: "GET" | "PATCH" | "POST"; body?: unknown } = {},
): Promise<T> {
  const url = new URL(path, env.API_URL);
  const isHttps = url.protocol === "https:";
  const bodyText = options.body !== undefined ? JSON.stringify(options.body) : undefined;

  return new Promise((resolve, reject) => {
    const req = (isHttps ? httpsRequest : httpRequest)(
      url,
      {
        method: options.method ?? "GET",
        agent: isHttps ? getProxyAgent() : undefined,
        headers: {
          "X-Admin-Secret": env.ADMIN_API_SECRET,
          // Fastify's JSON body parser rejects an empty body when
          // Content-Type says application/json (400, before the route even
          // runs) — only send it when there's an actual body to parse.
          ...(bodyText
            ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyText) }
            : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk: Buffer) => (raw += chunk));
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          let parsed: unknown;
          try {
            parsed = raw ? JSON.parse(raw) : undefined;
          } catch {
            parsed = undefined;
          }
          if (status >= 400) {
            const message =
              (parsed as { error?: { message?: string } })?.error?.message ?? `HTTP ${status}`;
            reject(new AdminApiError(message, status));
            return;
          }
          resolve(parsed as T);
        });
      },
    );
    req.on("error", reject);
    if (bodyText) req.write(bodyText);
    req.end();
  });
}
