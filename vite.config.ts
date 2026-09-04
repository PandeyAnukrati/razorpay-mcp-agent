import path from "path"
import crypto from "crypto"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

function razorpayWebhookPlugin() {
  const webhookEvents: any[] = []

  return {
    name: "razorpay-webhook-middleware",
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        // 1. Webhook Ingestion Receiver
        if (req.url?.startsWith("/api/webhooks/razorpay") && req.method === "POST") {
          let body = ""
          req.on("data", (chunk: any) => {
            body += chunk
          })
          req.on("end", () => {
            try {
              const signature = req.headers["x-razorpay-signature"]
              const secret =
                process.env.RAZORPAY_WEBHOOK_SECRET ||
                process.env.VITE_RAZORPAY_WEBHOOK_SECRET ||
                "rzp_whsec_auto_998877"

              let isSignatureValid = false
              if (signature) {
                const expected = crypto
                  .createHmac("sha256", secret)
                  .update(body)
                  .digest("hex")
                isSignatureValid = signature === expected
              } else {
                // Allow unverified in local simulator mode
                isSignatureValid = true
              }

              const payload = JSON.parse(body || "{}")
              const eventRecord = {
                id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                event: payload.event || "unknown.event",
                payload,
                signatureValid: isSignatureValid,
                receivedAt: new Date().toISOString(),
              }

              webhookEvents.unshift(eventRecord)
              if (webhookEvents.length > 50) webhookEvents.pop()

              res.setHeader("Content-Type", "application/json")
              res.statusCode = 200
              res.end(
                JSON.stringify({
                  status: "ok",
                  eventId: eventRecord.id,
                  signatureValid: isSignatureValid,
                })
              )
            } catch (err: any) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: err.message }))
            }
          })
          return
        }

        // 2. Fetch Webhook Events Feed
        if (req.url?.startsWith("/api/webhooks/events") && req.method === "GET") {
          res.setHeader("Content-Type", "application/json")
          res.statusCode = 200
          res.end(JSON.stringify({ events: webhookEvents }))
          return
        }

        // 3. Clear Webhook Events
        if (req.url?.startsWith("/api/webhooks/events/clear") && req.method === "POST") {
          webhookEvents.length = 0
          res.setHeader("Content-Type", "application/json")
          res.statusCode = 200
          res.end(JSON.stringify({ status: "cleared" }))
          return
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), razorpayWebhookPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api/razorpay": {
        target: "https://api.razorpay.com/v1",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/razorpay/, ""),
      },
      "/api/claude": {
        target: "https://api.anthropic.com/v1",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/claude/, ""),
      },
    },
  },
})
