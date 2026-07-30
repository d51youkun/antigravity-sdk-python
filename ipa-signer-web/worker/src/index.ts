import { Container } from "@cloudflare/containers";

/** Python FastAPI (uvicorn :8000) を Cloudflare Container で実行 */
export class IpaSignerApi extends Container {
  defaultPort = 8000;
  /** 認証セッション維持のため、アイドル後もしばらく起動したまま */
  sleepAfter = "30m";

  override onStart() {
    console.log("[ipa-signer-api] container started");
  }

  override onError(error: unknown) {
    console.error("[ipa-signer-api] container error", error);
  }
}

export interface Env {
  ASSETS: Fetcher;
  API: DurableObjectNamespace<IpaSignerApi>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api")) {
      const container = env.API.getByName("api");
      return container.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
