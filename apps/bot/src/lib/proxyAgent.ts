import { HttpsProxyAgent } from "https-proxy-agent";

/**
 * grammY's Node fetch config takes a plain http(s).Agent (see
 * baseFetchConfig in grammy/out/platform.node.js) — it doesn't inspect
 * HTTPS_PROXY/HTTP_PROXY itself the way `curl` does. Most deployments have
 * direct internet access and don't need this at all, but some run behind a
 * forced egress proxy (e.g. a sandboxed dev environment), where outbound
 * requests must go through it or they hang until they time out.
 */
export function getProxyAgent() {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  return proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
}
