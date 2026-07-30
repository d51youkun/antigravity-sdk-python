/**
 * Cloudflare Pages Function — /api/* を Python バックエンドへプロキシ。
 * iPad から同一オリジンで API を呼べるようにする。
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const backend = env.BACKEND_URL;

  if (!backend) {
    return Response.json(
      {
        detail:
          "BACKEND_URL が未設定です。Cloudflare Pages の環境変数に API URL を設定してください。",
      },
      { status: 503 },
    );
  }

  const src = new URL(request.url);
  const target = new URL(src.pathname + src.search, backend.replace(/\/$/, ""));

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cf-connecting-ip");

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const upstream = await fetch(target.toString(), init);
    const outHeaders = new Headers(upstream.headers);
    for (const [key, value] of Object.entries(CORS)) {
      outHeaders.set(key, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    });
  } catch (err) {
    return Response.json(
      { detail: `バックエンド接続エラー: ${err.message}` },
      { status: 502 },
    );
  }
}
