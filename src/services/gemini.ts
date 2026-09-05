import {
  mcpGetPayment,
  mcpListPayments,
  mcpGetOrder,
  mcpGetRefunds,
  mcpGetSettlements,
  mcpGetDisputes,
  mcpCreatePaymentLink,
  mcpCreateOrder,
} from "./mcpClient"
import { createRefundClaim } from "./refundClaims"

export type AttachedDocument = {
  name: string
  type?: string
  size?: string
  content?: string
}

export type ChatMessage = {
  text: string
  isUser: boolean
}

// User-provided API key from .env (Tier 1 key)
const PRIMARY_GEMINI_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim()
const FALLBACK_GEMINI_KEY = "AIzaSyAtkF3Otrj9rmmcYaAlp3YUd_qf923da9Q"
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
const CANDIDATE_MODELS = ["gemini-flash-latest", "gemini-3.7-flash", "gemini-2.5-flash"]

const RAZORPAY_TOOL_DECLARATIONS = [
  {
    name: "get_payment_details",
    description:
      "Fetch detailed information for a specific Razorpay payment ID (e.g. pay_...). Returns status, amount, method, customer details, and error reasons if failed.",
    parameters: {
      type: "object",
      properties: {
        payment_id: {
          type: "string",
          description: "The payment ID, starting with pay_",
        },
      },
      required: ["payment_id"],
    },
  },
  {
    name: "search_payments",
    description:
      "Search or list payments by status (all, captured, failed, refunded, authorized), customer name/email, or free text query.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by status: 'captured', 'failed', 'refunded', 'authorized', or 'all'",
        },
        query: {
          type: "string",
          description: "Search keyword in customer name, email, description, or order ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of records to return (default 5)",
        },
      },
    },
  },
  {
    name: "get_order_details",
    description: "Look up order information by Razorpay order ID (e.g. order_...).",
    parameters: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "The order ID, starting with order_",
        },
      },
      required: ["order_id"],
    },
  },
  {
    name: "create_order",
    description:
      "Create a new live unpaid order on Razorpay for a specified amount in INR, receipt identifier, and description.",
    parameters: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "Order amount in Indian Rupees (₹), e.g. 1499",
        },
        receipt: {
          type: "string",
          description: "Receipt or invoice reference ID (e.g. rcpt_101)",
        },
        description: {
          type: "string",
          description: "Product description or plan name for the order",
        },
      },
      required: ["amount"],
    },
  },
  {
    name: "get_refund_status",
    description: "Retrieve refund status for a specific refund ID (rfnd_...) or payment ID (pay_...).",
    parameters: {
      type: "object",
      properties: {
        payment_id: {
          type: "string",
          description: "The payment ID to find refunds for",
        },
      },
    },
  },
  {
    name: "get_settlements_info",
    description: "List recent payout settlements deposited into the merchant's bank account.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_disputes_info",
    description: "List customer disputes or chargebacks needing merchant evidence.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_payment_link",
    description:
      "Generate a live Razorpay payment link and scannable UPI QR code to pay for an unpaid order or specified amount.",
    parameters: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "The order ID to pay for, e.g. order_TXGPnb2izSqLLF",
        },
        amount: {
          type: "number",
          description: "Amount in Indian Rupees (₹), e.g. 1499. Optional if order_id is provided.",
        },
        description: {
          type: "string",
          description: "Reason or description of the payment",
        },
      },
    },
  },
  {
    name: "investigate_and_escalate_refund",
    description:
      "Autonomous AI Refund Claim Investigator: Evaluates a customer refund request against payment status, customer-attached evidence documents, and merchant return policies. If the claim amount is high-value (> ₹1,000) or requires merchant sign-off, synthesizes an Escalation Claim Dossier with an AI validity score (0-100), policy checks, and forwards it to the Merchant Portal for final human settlement.",
    parameters: {
      type: "object",
      properties: {
        payment_id: {
          type: "string",
          description: "The payment ID to be refunded (e.g. pay_TYLbzTtDsBE2o0)",
        },
        order_id: {
          type: "string",
          description: "Associated Razorpay order ID (e.g. order_TYLbFFXmszuIQa) if available",
        },
        amount: {
          type: "number",
          description: "Refund claim amount in INR (e.g. 5000)",
        },
        reason: {
          type: "string",
          description: "Customer stated reason for the refund (e.g. defective product, duplicate charge, logistics damage)",
        },
        customer_name: {
          type: "string",
          description: "Customer full name",
        },
        customer_email: {
          type: "string",
          description: "Customer contact email address",
        },
        validity_score: {
          type: "number",
          description: "AI calculated validity score from 0 to 100 based on transaction verification and evidence match",
        },
        risk_level: {
          type: "string",
          enum: ["Low", "Medium", "High"],
          description: "AI fraud / chargeback risk assessment",
        },
        ai_summary: {
          type: "string",
          description: "Concise summary of findings from transaction inspection and attached evidence",
        },
        recommendation: {
          type: "string",
          description: "AI recommendation for the merchant (e.g. Approve 100% refund, Reject due to policy expiry)",
        },
        escalation_reason: {
          type: "string",
          description: "Why this claim requires merchant sign-off (e.g. Amount > ₹1,000 high-value threshold)",
        },
      },
      required: ["payment_id", "amount", "reason"],
    },
  },
]

/**
 * Executes a function call generated by Gemini directly via Razorpay MCP tools.
 */
async function executeRazorpayTool(
  name: string,
  args: any,
  attachedDocs?: AttachedDocument[]
): Promise<any> {
  switch (name) {
    case "get_payment_details":
      return await mcpGetPayment(args.payment_id || "")

    case "search_payments":
      return await mcpListPayments({
        status: args.status,
        query: args.query,
        limit: args.limit || 6,
      })

    case "get_order_details":
      return await mcpGetOrder(args.order_id || "")

    case "create_order":
      return await mcpCreateOrder({
        amount: args.amount,
        receipt: args.receipt,
        notes: args.description ? { description: args.description } : undefined,
      })

    case "create_payment_link":
      return await mcpCreatePaymentLink({
        order_id: args.order_id,
        amount: args.amount,
        description: args.description,
      })

    case "get_refund_status":
      return await mcpGetRefunds(args.payment_id)

    case "get_settlements_info":
      return await mcpGetSettlements()

    case "get_disputes_info":
      return await mcpGetDisputes()

    case "investigate_and_escalate_refund": {
      const claim = createRefundClaim({
        paymentId: args.payment_id,
        orderId: args.order_id,
        amount: Number(args.amount) || 0,
        customerName: args.customer_name,
        customerEmail: args.customer_email,
        reason: args.reason,
        attachedDocs: attachedDocs && attachedDocs.length > 0 ? attachedDocs : undefined,
        aiInvestigation: {
          validityScore: args.validity_score,
          riskLevel: args.risk_level,
          summary: args.ai_summary,
          recommendation: args.recommendation,
          escalationReason: args.escalation_reason,
        },
      })
      return {
        source: "ai_refund_escalation_engine",
        claim_id: claim.claimId,
        payment_id: claim.paymentId,
        amount_formatted: claim.amountFormatted,
        status: claim.status,
        validity_score: claim.aiInvestigation.validityScore,
        risk_level: claim.aiInvestigation.riskLevel,
        summary: claim.aiInvestigation.summary,
        recommendation: claim.aiInvestigation.recommendation,
        escalation_reason: claim.aiInvestigation.escalationReason,
        vendor_portal_synced: true,
        message: `Claim ${claim.claimId} registered. Full AI Dossier and customer evidence dispatched to Merchant Portal for authorization.`,
      }
    }

    default:
      return { error: `MCP Tool '${name}' not recognized.` }
  }
}

let preferredKey: string | null = null
let preferredModel: string | null = null

async function postToGemini(body: any, apiKey: string, modelName: string) {
  const url = `${BASE_URL}/models/${modelName}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res
}

/**
 * Calls Google Gemini API with fallback resilience across Tier 1 / backup keys and modern Flash models.
 */
async function callGeminiWithFallback(body: any): Promise<{ data: any; activeKey: string; activeModel: string }> {
  // If we already discovered an active key & model in this session, attempt it first
  if (preferredKey && preferredModel) {
    try {
      const res = await postToGemini(body, preferredKey, preferredModel)
      if (res.ok) {
        const data = await res.json()
        if (data.candidates?.[0]?.content) {
          return { data, activeKey: preferredKey, activeModel: preferredModel }
        }
      }
    } catch {
      // Re-run discovery
    }
  }

  const candidateKeys = [PRIMARY_GEMINI_KEY, FALLBACK_GEMINI_KEY].filter(Boolean)
  if (candidateKeys.length === 0) {
    throw new Error("No Gemini API key configured. Please set VITE_GEMINI_API_KEY in your .env file.")
  }

  let lastError = "Unable to connect to Gemini."

  for (const key of candidateKeys) {
    for (const model of CANDIDATE_MODELS) {
      try {
        const res = await postToGemini(body, key, model)
        if (res.ok) {
          const data = await res.json()
          if (data.candidates?.[0]?.content) {
            preferredKey = key
            preferredModel = model
            return { data, activeKey: key, activeModel: model }
          }
        } else {
          lastError = await res.text()
        }
      } catch (err: any) {
        lastError = err.message
      }
    }
  }

  throw new Error(`Gemini API Error: ${lastError}`)
}

// Track Gemini quota status to enable instantaneous fallback
export let isGeminiQuotaExhausted = false

export function resetGeminiQuotaStatus() {
  isGeminiQuotaExhausted = false
}

export function getGeminiQuotaStatus(): boolean {
  return isGeminiQuotaExhausted
}

/**
 * Executes Google Gemini 2.5 Flash with full Model Context Protocol tools.
 * Features multi-turn tool calling, structured Markdown tables, status badges,
 * instant Razorpay Checkout buttons, and scannable UPI QR codes.
 */
export async function getGeminiSupportResponse(
  query: string,
  history: ChatMessage[],
  attachedDocs: AttachedDocument[] = []
): Promise<string> {
  // Format conversation history for Gemini: role 'user' or 'model'
  const contents: any[] = []
  for (const msg of history) {
    if (msg.text && msg.text.trim()) {
      contents.push({
        role: msg.isUser ? "user" : "model",
        parts: [{ text: msg.text }],
      })
    }
  }

  // Append user's current query
  contents.push({
    role: "user",
    parts: [{ text: query }],
  })

  // Format attached document evidence if provided
  let docContextPrompt = ""
  if (attachedDocs.length > 0) {
    docContextPrompt = "\n\n### User-Attached Evidence Documents:\n"
    for (const doc of attachedDocs) {
      docContextPrompt += `\n--- Document: "${doc.name}" (${doc.size || "Unknown size"}) ---\n`
      if (doc.content) {
        const preview =
          doc.content.length > 8000
            ? doc.content.slice(0, 8000) + "\n...[truncated]"
            : doc.content
        docContextPrompt += `${preview}\n`
      } else {
        docContextPrompt += `(File attached by user: ${doc.name})\n`
      }
    }
    docContextPrompt +=
      "\nYou can use the details from these attached documents to analyze logs, receipts, order numbers, error codes, and customer inquiries.\n"
  }

  const systemInstruction = {
    parts: [
      {
        text: `You are an elite, highly capable Razorpay AI Support & Autonomous Payment Operations Agent powered directly by the Razorpay Model Context Protocol (MCP).
You have real-time autonomous access to live Razorpay tools:
- 'get_payment_details': Inspect a transaction (status, amount, method, customer details, failure reasons, fee, tax, RRN).
- 'search_payments': Find transactions by status (captured, failed, refunded, authorized), customer email/phone, or query keywords.
- 'get_order_details': View order total, paid amount, amount due, receipt ID, and attempts.
- 'create_order': Generate a new live order in INR.
- 'create_payment_link': Create an instant live payment link and scannable UPI QR code for an unpaid order or specified amount.
- 'get_refund_status': Check refund records, speed (normal/instant), and ARN numbers.
- 'get_settlements_info': View merchant payout settlement batches, UTR reference numbers, and bank deposit status.
- 'get_disputes_info': Check customer chargebacks, dispute phase, evidence deadlines, and contest status.
- 'investigate_and_escalate_refund': Autonomous AI refund investigation engine. Evaluates transaction status, customer evidence/receipts/photos, and policy rules. For claims exceeding ₹1,000 or requiring merchant review, generates an Escalation Dossier and dispatches it to the Merchant Portal.

OPERATIONAL RULES & PROTOCOL:
1. TOOL CALLING:
   - Always execute the appropriate tool when asked about transactions, payments, orders, refunds, settlements, disputes, or creating payment links.
   - If the user asks to pay for an unpaid order or wants a payment link / QR code, execute 'create_payment_link' with the order_id.
   - For general Razorpay questions, provide clear, authoritative guidance based on official Razorpay documentation.

2. AUTONOMOUS REFUND INVESTIGATION & ESCALATION PROTOCOL:
   - When a user asks for a refund, return, or compensation:
     a) FIRST, lookup the payment using 'get_payment_details' (or 'search_payments') to verify that the payment is captured and obtain the amount and method.
     b) SECOND, inspect any attached customer documents/evidence (damage photos, courier slips, invoices).
     c) THIRD, evaluate against the High-Value Threshold (> ₹1,000):
        - If the amount is > ₹1,000, DO NOT finalize an automated refund directly.
        - Call 'investigate_and_escalate_refund' with the payment_id, amount, customer reason, calculated validity_score (0-100), risk_level, ai_summary, and recommendation.
        - Present the customer with a structured Investigation Dossier in Markdown:
          | Field | AI Investigation Finding |
          | :--- | :--- |
          | **Claim Reference** | \`REF-CLAIM-XXXX\` |
          | **Payment ID** | \`pay_...\` |
          | **Amount** | **₹X,XXX.00** |
          | **AI Validity Score** | 🛡️ **XX% (High Validity)** |
          | **Risk Level** | 🟢 Low Risk |
          | **Escalation Status** | ⏳ Forwarded to Merchant Portal for Sign-Off |
        - Inform the customer that their claim and evidence have been sent to the vendor's escalation desk, and they will receive an immediate confirmation once approved!

3. PAYMENT LINKS & UPI QR CODES:
   - When 'create_payment_link' is called or when providing payment access:
     a) Always present the payment link clearly as a clickable button formatted as:
        [💳 Pay ₹AMOUNT Now with Razorpay](PAYMENT_URL)
        (Our client automatically renders this as an interactive 1-click Razorpay Checkout button!)
     b) Always display the scannable UPI QR code using standard Markdown image syntax:
        ![Scan to Pay with UPI](QR_CODE_IMAGE_URL)
        (Our client automatically renders an interactive UPI card with Google Pay, PhonePe, Paytm, and BHIM logos!)
     c) Mention that customers can either scan the QR code using any UPI app or click the button to pay via Cards or NetBanking.

4. RESPONSE FORMATTING (STRICT GITHUB-FLAVORED MARKDOWN):
   - Start with a concise 1-2 sentence Executive Summary summarizing the status.
   - Whenever presenting payment, order, refund, settlement, or dispute records, ALWAYS use structured Markdown Tables:
     | Field | Details |
     | :--- | :--- |
     | **Transaction ID** | \`pay_...\` |
     | **Amount** | **₹1,499.00** |
     | **Status** | 🟢 **Captured** |
     | **Payment Method** | UPI / Card / NetBanking |
     | **Customer** | Name (email@example.com) |
     | **Date & Time** | DD Mon YYYY, HH:MM AM/PM |
   - Use status badges for visual clarity:
     - 🟢 **Captured** / **Paid** / **Settled**
     - 🔴 **Failed** / **Refunded**
     - 🟡 **Created (Unpaid)** / **Authorized** / **Pending**
     - 🔵 **Under Review** / **Dispute**
   - For failed payments: State the root cause in plain English (e.g. bank downtime, insufficient funds, incorrect OTP) and offer actionable merchant recovery steps.
   - For settlements: Highlight the UTR number and expected bank credit timeline.
   - For disputes: State the evidence submission deadline and recommended documents.

5. MULTILINGUAL & TONE:
   - Professional, courteous, proactive, and directly helpful.
   - Automatically match the user's language (English, Hindi, Hinglish, etc.).${docContextPrompt}`,
      },
    ],
  }

  const tools = [{ functionDeclarations: RAZORPAY_TOOL_DECLARATIONS }]

  try {
    // Multi-turn tool execution loop (up to 3 turns)
    const MAX_TOOL_TURNS = 3
    let turnCount = 0

    while (turnCount < MAX_TOOL_TURNS) {
      turnCount++
      const { data: responseData } = await callGeminiWithFallback({
        contents,
        systemInstruction,
        tools,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2500,
        },
      })

      const candidate = responseData.candidates?.[0]
      if (!candidate || !candidate.content) {
        throw new Error("No valid response candidate returned by Gemini.")
      }

      const parts = candidate.content.parts || []
      const functionCalls = parts.filter((p: any) => p.functionCall)

      // If no function calls, extract generated text and return!
      if (functionCalls.length === 0) {
        const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text)
        if (textParts.length > 0) {
          return textParts.join("\n").trim()
        }
        throw new Error("No text response generated by Gemini.")
      }

      // Add model's tool calls to conversation history
      contents.push(candidate.content)

      // Execute all tool calls in parallel
      const toolResponses = await Promise.all(
        functionCalls.map(async (callPart: any) => {
          const { name, args } = callPart.functionCall
          const toolResult = await executeRazorpayTool(name, args || {}, attachedDocs)
          return {
            functionResponse: {
              name,
              response: toolResult,
            },
          }
        })
      )

      // Feed function responses back to conversation history
      contents.push({
        role: "user",
        parts: toolResponses,
      })
    }

    throw new Error("Gemini reached maximum tool turns without concluding.")
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes("429") ||
        err.message.includes("RESOURCE_EXHAUSTED") ||
        err.message.includes("quota"))
    ) {
      isGeminiQuotaExhausted = true
    }
    console.error("[AI] Gemini execution error:", err.message)
    throw new Error(`Gemini API Error: ${err.message}`)
  }
}

