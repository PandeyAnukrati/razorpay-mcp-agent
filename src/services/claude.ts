/**
 * Anthropic Claude Support Service
 * 
 * High-performance fallback with full Model Context Protocol tool calling.
 */

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
import { getGeminiSupportResponse } from "./gemini"

export type ChatMessage = {
  text: string
  isUser: boolean
}

const CLAUDE_API_KEY =
  import.meta.env.VITE_ANTHROPIC_API_KEY ||
  """"

const CLAUDE_MODEL = "claude-haiku-4-5-20251001"
const ANTHROPIC_DIRECT_URL = "https://api.anthropic.com/v1/messages"
const PROXY_CLAUDE_URL = "/api/claude/messages"

/**
 * Robust fetcher: calls direct Anthropic API with direct browser CORS support,
 * and falls back to proxy URL if direct network request fails.
 */
async function postClaudeMessage(body: any, headers: Record<string, string>): Promise<Response> {
  // 1. Direct Anthropic API call (supports CORS natively with anthropic-dangerous-direct-browser-access)
  try {
    const directRes = await fetch(ANTHROPIC_DIRECT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
    // If not a 405 Method Not Allowed, return response
    if (directRes.status !== 405) {
      return directRes
    }
  } catch (directErr) {
    console.warn("[Claude Service] Direct Anthropic API call failed, attempting proxy fallback:", directErr)
  }

  // 2. Fallback to proxy (works in Vite dev server or Cloudflare Pages Function)
  return await fetch(PROXY_CLAUDE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

const CLAUDE_TOOLS = [
  {
    name: "get_payment_details",
    description:
      "Fetch detailed information for a specific Razorpay payment ID (e.g. pay_...). Returns status, amount, method, customer details, and error reasons if failed.",
    input_schema: {
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
    input_schema: {
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
    input_schema: {
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
    description: "Create a new live unpaid order on Razorpay for a specified amount in INR.",
    input_schema: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "Order amount in Indian Rupees (₹), e.g. 1499",
        },
        receipt: {
          type: "string",
          description: "Receipt or invoice reference ID",
        },
        description: {
          type: "string",
          description: "Product description or plan name",
        },
      },
      required: ["amount"],
    },
  },
  {
    name: "get_refund_status",
    description: "Retrieve refund status for a specific refund ID (rfnd_...) or payment ID (pay_...).",
    input_schema: {
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
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_disputes_info",
    description: "List customer disputes or chargebacks needing merchant evidence.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_payment_link",
    description:
      "Generate a live Razorpay payment link and scannable UPI QR code to pay for an unpaid order or specified amount.",
    input_schema: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "The order ID, e.g. order_TXGPnb2izSqLLF",
        },
        amount: {
          type: "number",
          description: "The amount in Indian Rupees (₹), e.g. 1499. Optional if order_id is given.",
        },
        description: {
          type: "string",
          description: "Short reason or item name for payment",
        },
      },
    },
  },
]

async function executeRazorpayTool(name: string, args: any): Promise<any> {
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
    default:
      return { error: `Tool '${name}' not implemented.` }
  }
}

export type AttachedDocument = {
  name: string
  type?: string
  size?: string
  content?: string
}

/**
 * Calls Anthropic Claude API with Tool Calling enabled and attached document context
 */
export async function getClaudeSupportResponse(
  query: string,
  history: ChatMessage[],
  attachedDocs: AttachedDocument[] = []
): Promise<string> {
  const messages: any[] = []

  // Clean history for Anthropic: must start with 'user' and strictly alternate
  for (const msg of history) {
    if (msg.text && msg.text.trim()) {
      const role = msg.isUser ? "user" : "assistant"
      if (messages.length === 0 && role !== "user") {
        continue // Skip leading assistant greeting
      }
      if (messages.length > 0 && messages[messages.length - 1].role === role) {
        messages[messages.length - 1].content += "\n" + msg.text
      } else {
        messages.push({ role, content: msg.text })
      }
    }
  }

  // Append user query
  if (messages.length > 0 && messages[messages.length - 1].role === "user") {
    messages[messages.length - 1].content += "\n" + query
  } else {
    messages.push({ role: "user", content: query })
  }

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

  const system = `You are an intelligent, expert Razorpay Support & Merchant Virtual Agent powered directly by the Razorpay Model Context Protocol (MCP).
You have access to live MCP tools:
- 'get_payment_details': Fetch full payment details (e.g. pay_...).
- 'search_payments': Find transactions by status (captured, failed, refunded), customer email, or keyword.
- 'get_order_details': View order totals, paid amounts, and receipt IDs.
- 'create_order': Create a new live unpaid order on Razorpay with amount, receipt, and description.
- 'create_payment_link': Generate a live Razorpay payment checkout link and UPI QR code to pay for an order or amount.
- 'get_refund_status': Check refund records.
- 'get_settlements_info': View bank settlement payouts and UTR numbers.
- 'get_disputes_info': Check chargebacks and evidence deadlines.

Always execute these tools when asked about transactions, payments, orders, refunds, settlements, disputes, or when the user wants to pay.
Multilingual support: Automatically match the user's language (English, Hindi, etc.).

Payment & QR Code Instructions:
When the user wants to pay for an unpaid order, or asks for a payment link or QR code:
1. Always invoke 'create_payment_link' with the order_id.
2. Present the live payment link clearly as a clickable link.
3. Display the scannable QR code using markdown image syntax:
   ![Scan to Pay with UPI](qr_code_image_url)
4. State that they can scan the QR code using any UPI app (GPay, PhonePe, Paytm, BHIM) or click the link to pay with Card or NetBanking.

Formatting Guidelines:
- Always format details using clean, structured GitHub Flavored Markdown with proper newlines.
- When showing order, payment, or settlement details, present them as a clean Markdown table:
  | Field | Value |
  |---|---|
  | Order ID | order_... |
  | Status | Created |
  | Amount | ₹499.00 |
- If using bullet points, always put each bullet on a separate new line with an empty line before and after.
- State exact amounts in Indian Rupees (₹), transaction IDs, payment methods, customer names, and clear explanations.
- Keep responses concise, polite, professional, and visually structured.${docContextPrompt}`

  const headers: Record<string, string> = {
    "x-api-key": CLAUDE_API_KEY,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
    "content-type": "application/json",
  }

  try {
    // 1. First Call to Claude
    const res1 = await postClaudeMessage(
      {
        model: CLAUDE_MODEL,
        max_tokens: 1000,
        system,
        tools: CLAUDE_TOOLS,
        messages,
      },
      headers
    )

    if (!res1.ok) {
      const errText = await res1.text()
      throw new Error(`Claude API returned status ${res1.status}: ${errText}`)
    }

    const data1 = await res1.json()
    const content = data1.content || []

    // Check for tool use
    const toolUseBlock = content.find((block: any) => block.type === "tool_use")

    if (toolUseBlock) {
      const { id: toolUseId, name, input } = toolUseBlock
      const toolOutput = await executeRazorpayTool(name, input)

      // Add assistant's tool use response to messages
      messages.push({
        role: "assistant",
        content,
      })

      // Add user's tool result to messages
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUseId,
            content: JSON.stringify(toolOutput),
          },
        ],
      })

      // 2. Second Call to Claude to generate natural answer
      const res2 = await postClaudeMessage(
        {
          model: CLAUDE_MODEL,
          max_tokens: 1000,
          system,
          tools: CLAUDE_TOOLS,
          messages,
        },
        headers
      )

      if (!res2.ok) {
        const errText2 = await res2.text()
        throw new Error(`Claude API step 2 returned status ${res2.status}: ${errText2}`)
      }

      const data2 = await res2.json()
      const textBlock = (data2.content || []).find((b: any) => b.type === "text")
      if (textBlock && textBlock.text) {
        return textBlock.text.trim()
      }
    }

    // Direct text block
    const directText = content.find((b: any) => b.type === "text")
    if (directText && directText.text) {
      return directText.text.trim()
    }

    throw new Error("No text response received from Claude.")
  } catch (claudeErr: any) {
    console.warn("[Claude Service] Claude request failed, attempting Gemini Flash fallback:", claudeErr.message)
    try {
      return await getGeminiSupportResponse(query, history, attachedDocs)
    } catch (geminiErr: any) {
      console.error("[Claude Service] Both Claude and Gemini fallbacks failed:", geminiErr)
      throw claudeErr
    }
  }
}
