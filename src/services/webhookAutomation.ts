/**
 * Razorpay Webhook Automation & AI Triage Service
 */

import { getClaudeSupportResponse } from "./claude"

export interface WebhookEventRecord {
  id: string
  event: string
  payload: any
  signatureValid: boolean
  receivedAt: string
  aiAnalysis?: {
    summary: string
    recommendation: string
    recoveryMessage?: string
    severity: "info" | "warning" | "critical"
    suggestedAction: string
  }
}

export const WEBHOOK_SECRET_DEFAULT =
  import.meta.env.VITE_RAZORPAY_WEBHOOK_SECRET || "rzp_whsec_auto_998877"

/**
 * Fetch all received webhook events from local receiver
 */
export async function getWebhookEvents(): Promise<WebhookEventRecord[]> {
  try {
    const res = await fetch("/api/webhooks/events")
    if (!res.ok) return []
    const data = await res.json()
    return data.events || []
  } catch (err) {
    console.error("Failed to fetch webhook events:", err)
    return []
  }
}

/**
 * Send an event payload to the local webhook endpoint
 */
export async function sendWebhookPayload(
  payload: any,
  signature?: string
): Promise<{ status: string; eventId?: string; signatureValid?: boolean }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (signature) {
    headers["x-razorpay-signature"] = signature
  }

  const res = await fetch("/api/webhooks/razorpay", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error(`Webhook endpoint returned ${res.status}`)
  }

  return await res.json()
}

/**
 * Clear received webhook events history
 */
export async function clearWebhookEvents(): Promise<void> {
  await fetch("/api/webhooks/events/clear", { method: "POST" })
}

/**
 * AI-powered automated triage for incoming Razorpay webhook events
 */
export async function triageWebhookWithAi(
  event: string,
  payload: any
): Promise<NonNullable<WebhookEventRecord["aiAnalysis"]>> {
  const prompt = `Analyze this incoming Razorpay webhook event:
Event Name: "${event}"
Payload JSON:
${JSON.stringify(payload, null, 2)}

Provide an automated triage decision in JSON format with:
1. "summary": 1-2 sentence description of what happened.
2. "recommendation": Merchant-facing advisory on what action to take.
3. "recoveryMessage": A customer-facing notification (e.g. WhatsApp/Email retry message if failed, or confirmation if paid).
4. "severity": "info", "warning", or "critical".
5. "suggestedAction": 2-4 word action button label (e.g. "Send Recovery Link", "Submit Evidence", "View Settlement").

Respond ONLY with valid JSON.`

  try {
    const aiResponse = await getClaudeSupportResponse(prompt, [])
    const cleanedJson = aiResponse.replace(/```json/g, "").replace(/```/g, "").trim()
    const parsed = JSON.parse(cleanedJson)
    return {
      summary: parsed.summary || "Event received and verified.",
      recommendation: parsed.recommendation || "No immediate action required.",
      recoveryMessage: parsed.recoveryMessage,
      severity: parsed.severity || (event.includes("failed") ? "warning" : "info"),
      suggestedAction: parsed.suggestedAction || "View Details",
    }
  } catch (err) {
    // Fallback deterministic triage if AI is offline
    if (event.includes("failed")) {
      const errDesc =
        payload?.payload?.payment?.entity?.error_description || "Customer payment declined"
      const errCode = payload?.payload?.payment?.entity?.error_code || "PAYMENT_FAILED"
      return {
        summary: `Payment failed due to ${errCode}: ${errDesc}.`,
        recommendation: "Send an automated payment retry link to recover this cart.",
        recoveryMessage: `Hi there, your recent payment attempt encountered an issue (${errDesc}). Click here to retry securely: https://rzp.io/l/retry`,
        severity: "warning",
        suggestedAction: "Send Recovery Link",
      }
    }

    if (event.includes("captured") || event.includes("paid")) {
      const amount = (payload?.payload?.payment?.entity?.amount || 149900) / 100
      return {
        summary: `Payment of ₹${amount.toFixed(2)} was successfully captured.`,
        recommendation: "Order is paid. Generate invoice and initiate fulfillment.",
        recoveryMessage: `Payment confirmed! Your order is being processed. Thank you for your business.`,
        severity: "info",
        suggestedAction: "Generate Invoice",
      }
    }

    if (event.includes("dispute")) {
      return {
        summary: "Customer dispute/chargeback has been filed with issuing bank.",
        recommendation: "Submit proof of delivery and payment receipt before deadline.",
        severity: "critical",
        suggestedAction: "Submit Evidence",
      }
    }

    return {
      summary: `Received webhook event: ${event}`,
      recommendation: "Event processed and logged to audit trail.",
      severity: "info",
      suggestedAction: "Acknowledge",
    }
  }
}

/**
 * Predefined realistic test payloads for live simulation
 */
export const SAMPLE_WEBHOOK_PAYLOADS = {
  payment_failed: {
    event: "payment.failed",
    entity: "event",
    contains: ["payment"],
    created_at: Math.floor(Date.now() / 1000),
    payload: {
      payment: {
        entity: {
          id: "pay_FAIL_" + Math.random().toString(36).substring(2, 8).toUpperCase(),
          amount: 149900,
          currency: "INR",
          status: "failed",
          order_id: "order_TXGPnb2izSqLLF",
          invoice_id: null,
          method: "card",
          amount_refunded: 0,
          description: "Cloud Developer Suite - Pro Plan",
          card_id: "card_sample_987",
          bank: null,
          wallet: null,
          email: "aryan.sharma@example.com",
          contact: "+919876543210",
          error_code: "BAD_REQUEST_ERROR",
          error_description: "Payment was declined by customer bank due to incorrect OTP entered.",
          error_source: "customer",
          error_step: "payment_authorization",
          error_reason: "payment_failed",
        },
      },
    },
  },

  order_paid: {
    event: "order.paid",
    entity: "event",
    contains: ["order", "payment"],
    created_at: Math.floor(Date.now() / 1000),
    payload: {
      order: {
        entity: {
          id: "order_TXGPnb2izSqLLF",
          entity: "order",
          amount: 149900,
          amount_paid: 149900,
          amount_due: 0,
          currency: "INR",
          receipt: "rcpt_mcp_002",
          status: "paid",
          attempts: 1,
        },
      },
      payment: {
        entity: {
          id: "pay_SUCC_" + Math.random().toString(36).substring(2, 8).toUpperCase(),
          amount: 149900,
          currency: "INR",
          status: "captured",
          order_id: "order_TXGPnb2izSqLLF",
          method: "upi",
          vpa: "aryan@okaxis",
          email: "aryan.sharma@example.com",
          contact: "+919876543210",
        },
      },
    },
  },

  dispute_created: {
    event: "dispute.created",
    entity: "event",
    contains: ["dispute"],
    created_at: Math.floor(Date.now() / 1000),
    payload: {
      dispute: {
        entity: {
          id: "disp_" + Math.random().toString(36).substring(2, 8),
          payment_id: "pay_TXGPhf3WFTuSv1",
          amount: 49900,
          currency: "INR",
          reason_code: "fraudulent",
          status: "under_review",
          respond_by: Math.floor(Date.now() / 1000) + 86400 * 5,
        },
      },
    },
  },

  refund_processed: {
    event: "refund.processed",
    entity: "event",
    contains: ["refund", "payment"],
    created_at: Math.floor(Date.now() / 1000),
    payload: {
      refund: {
        entity: {
          id: "rfnd_" + Math.random().toString(36).substring(2, 8),
          amount: 49900,
          currency: "INR",
          payment_id: "pay_TXGPhf3WFTuSv1",
          status: "processed",
          speed_processed: "optimum",
        },
      },
    },
  },
}
