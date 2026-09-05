export const onRequest: any = async (context: any) => {
  const url = new URL(context.request.url)
  const targetPath = url.pathname.replace(/^\/api\/claude/, "")
  const targetUrl = `https://api.anthropic.com/v1${targetPath}${url.search}`

  // Handle CORS Preflight
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
      },
    })
  }

  const modifiedHeaders = new Headers(context.request.headers)
  modifiedHeaders.delete("host")

  // Inject server-side Anthropic API key if configured in Cloudflare Pages environment/secrets
  const serverKey = context.env?.ANTHROPIC_API_KEY || context.env?.VITE_ANTHROPIC_API_KEY
  if (serverKey) {
    modifiedHeaders.set("x-api-key", serverKey)
  }

  const response = await fetch(targetUrl, {
    method: context.request.method,
    headers: modifiedHeaders,
    body: ["GET", "HEAD"].includes(context.request.method) ? undefined : context.request.body,
  })

  const responseHeaders = new Headers(response.headers)
  responseHeaders.set("Access-Control-Allow-Origin", "*")

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}
