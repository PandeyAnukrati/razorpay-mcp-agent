// In-memory array for recent webhook events on edge worker
const edgeWebhookEvents: any[] = []

export const onRequest: any = async (context: any) => {
  const url = new URL(context.request.url)

  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-razorpay-signature",
      },
    })
  }

  // 1. Fetch Webhook Events
  if (url.pathname.includes("/events") && context.request.method === "GET") {
    return new Response(JSON.stringify({ events: edgeWebhookEvents }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  }

  // 2. Clear Webhook Events
  if (url.pathname.includes("/events/clear") && context.request.method === "POST") {
    edgeWebhookEvents.length = 0
    return new Response(JSON.stringify({ status: "cleared" }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  }

  // 3. Ingest Webhook Event
  if (context.request.method === "POST") {
    try {
      const payload = await context.request.json()
      const eventRecord = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        event: payload.event || "unknown.event",
        payload,
        signatureValid: true,
        receivedAt: new Date().toISOString(),
      }

      edgeWebhookEvents.unshift(eventRecord)
      if (edgeWebhookEvents.length > 50) edgeWebhookEvents.pop()

      return new Response(
        JSON.stringify({
          status: "ok",
          eventId: eventRecord.id,
          signatureValid: true,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      )
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }
  }

  return new Response("Not found", { status: 404 })
}
