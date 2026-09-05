#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import "dotenv/config"
import Razorpay from "razorpay"

// 1. Initialize Razorpay Client with Environment Credentials
const KEY_ID = process.env.RAZORPAY_KEY_ID || ""
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || ""

const hasValidKeys = Boolean(
  KEY_ID &&
  KEY_SECRET &&
  !KEY_ID.includes("YOUR_KEY_ID") &&
  !KEY_SECRET.includes("YOUR_KEY_SECRET") &&
  (KEY_ID.startsWith("rzp_test_") || KEY_ID.startsWith("rzp_live_"))
)

let rzp = null
if (hasValidKeys) {
  try {
    rzp = new Razorpay({
      key_id: KEY_ID,
      key_secret: KEY_SECRET,
    })
    console.error(`[Razorpay MCP] Connected with Key ID: ${KEY_ID.substring(0, 10)}...`)
  } catch (err) {
    console.error(`[Razorpay MCP] Failed to initialize Razorpay SDK: ${err.message}`)
  }
} else {
  console.error(
    `[Razorpay MCP] Notice: No active Razorpay keys detected in .env. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.`
  )
}

function checkClient() {
  if (!rzp) {
    throw new Error(
      "Razorpay API credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file."
    )
  }
  return rzp
}

function formatPaiseToINR(paise) {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
}

// 2. Create MCP Server
const server = new McpServer({
  name: "razorpay-mcp-server",
  version: "2.0.0",
})

// Tool 1: list_payments
server.tool(
  "list_payments",
  "Fetch live payment transactions directly from Razorpay API.",
  {
    status: z
      .enum(["all", "captured", "failed", "refunded", "authorized"])
      .optional()
      .describe("Filter payments by status"),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe("Number of payments to fetch (default 10)"),
  },
  async ({ status = "all", limit = 10 }) => {
    try {
      const client = checkClient()
      const res = await client.payments.all({ count: limit })
      let items = res.items || []
      if (status && status !== "all") {
        items = items.filter((p) => p.status === status)
      }

      const payments = items.map((p) => ({
        id: p.id,
        amount: formatPaiseToINR(p.amount),
        currency: p.currency,
        status: p.status,
        method: p.method,
        email: p.email,
        contact: p.contact,
        order_id: p.order_id,
        description: p.description,
        created_at: new Date(p.created_at * 1000).toLocaleString(),
        error_description: p.error_description || null,
      }))

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                source: "razorpay_api",
                count: payments.length,
                status_filter: status,
                payments,
              },
              null,
              2
            ),
          },
        ],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Razorpay API Error: ${err.message}` }],
      }
    }
  }
)

// Tool 2: get_payment
server.tool(
  "get_payment",
  "Fetch details of a specific payment by ID directly from Razorpay API.",
  {
    payment_id: z.string().describe("The Razorpay payment ID (e.g. pay_...)"),
  },
  async ({ payment_id }) => {
    try {
      const client = checkClient()
      const payment = await client.payments.fetch(payment_id.trim())
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                source: "razorpay_api",
                ...payment,
                formatted_amount: formatPaiseToINR(payment.amount),
                formatted_fee: formatPaiseToINR(payment.fee || 0),
                formatted_tax: formatPaiseToINR(payment.tax || 0),
              },
              null,
              2
            ),
          },
        ],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Razorpay API Error fetching ${payment_id}: ${err.message}` }],
      }
    }
  }
)

// Tool 3: list_orders
server.tool(
  "list_orders",
  "List merchant orders directly from Razorpay API.",
  {
    limit: z.number().min(1).max(100).optional().describe("Number of orders to fetch"),
  },
  async ({ limit = 10 }) => {
    try {
      const client = checkClient()
      const res = await client.orders.all({ count: limit, expand: [] })
      const orders = (res.items || []).map((o) => ({
        id: o.id,
        amount: formatPaiseToINR(o.amount),
        amount_paid: formatPaiseToINR(o.amount_paid),
        amount_due: formatPaiseToINR(o.amount_due),
        currency: o.currency,
        receipt: o.receipt,
        status: o.status,
        attempts: o.attempts,
        created_at: new Date(o.created_at * 1000).toLocaleString(),
      }))

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ source: "razorpay_api", count: orders.length, orders }, null, 2),
          },
        ],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Razorpay API Error: ${err.message}` }],
      }
    }
  }
)

// Tool 4: get_order
server.tool(
  "get_order",
  "Look up an order by order ID from Razorpay API.",
  {
    order_id: z.string().describe("Razorpay order ID (e.g. order_...)"),
  },
  async ({ order_id }) => {
    try {
      const client = checkClient()
      const order = await client.orders.fetch(order_id.trim())
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                source: "razorpay_api",
                ...order,
                formatted_amount: formatPaiseToINR(order.amount),
                formatted_amount_paid: formatPaiseToINR(order.amount_paid),
                formatted_amount_due: formatPaiseToINR(order.amount_due),
              },
              null,
              2
            ),
          },
        ],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Razorpay API Error fetching order ${order_id}: ${err.message}` }],
      }
    }
  }
)

// Tool 4b: create_order
server.tool(
  "create_order",
  "Create a new live unpaid order in Razorpay API.",
  {
    amount: z.number().describe("Order amount in INR (e.g. 1499)"),
    currency: z.string().optional().default("INR").describe("Currency code (default INR)"),
    receipt: z.string().optional().describe("Receipt identifier for the order"),
    description: z.string().optional().describe("Product or plan description"),
  },
  async ({ amount, currency = "INR", receipt, description }) => {
    try {
      const client = checkClient()
      const amountInPaise = Math.round(amount * 100)
      const res = await client.orders.create({
        amount: amountInPaise,
        currency,
        receipt: receipt || `rcpt_${Date.now().toString().slice(-6)}`,
        notes: description ? { description } : {},
      })
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                source: "razorpay_api",
                status: "created",
                order: res,
                formatted_amount: formatPaiseToINR(res.amount),
                formatted_amount_due: formatPaiseToINR(res.amount_due),
                formatted_amount_paid: formatPaiseToINR(res.amount_paid),
              },
              null,
              2
            ),
          },
        ],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Razorpay API Error creating order: ${err.message}` }],
      }
    }
  }
)


// Tool 5: list_refunds
server.tool(
  "list_refunds",
  "List refunds directly from Razorpay API.",
  {
    payment_id: z.string().optional().describe("Filter refunds by payment ID"),
    limit: z.number().optional().describe("Count of refunds"),
  },
  async ({ payment_id, limit = 10 }) => {
    try {
      const client = checkClient()
      const res = await client.refunds.all({ count: limit })
      let items = res.items || []
      if (payment_id) {
        items = items.filter((r) => r.payment_id === payment_id.trim())
      }
      const refunds = items.map((r) => ({
        id: r.id,
        payment_id: r.payment_id,
        amount: formatPaiseToINR(r.amount),
        currency: r.currency,
        status: r.status,
        speed: r.speed_requested,
        created_at: new Date(r.created_at * 1000).toLocaleString(),
      }))

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ source: "razorpay_api", count: refunds.length, refunds }, null, 2),
          },
        ],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Razorpay API Error: ${err.message}` }],
      }
    }
  }
)

// Tool 6: get_refund
server.tool(
  "get_refund",
  "Fetch details of a refund by ID from Razorpay API.",
  {
    refund_id: z.string().describe("Refund ID (e.g. rfnd_...)"),
  },
  async ({ refund_id }) => {
    try {
      const client = checkClient()
      const refund = await client.refunds.fetch(refund_id.trim())
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                source: "razorpay_api",
                ...refund,
                formatted_amount: formatPaiseToINR(refund.amount),
              },
              null,
              2
            ),
          },
        ],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Razorpay API Error fetching refund ${refund_id}: ${err.message}` }],
      }
    }
  }
)

// Tool 7: create_refund
server.tool(
  "create_refund",
  "Issue a live refund for a payment via Razorpay API.",
  {
    payment_id: z.string().describe("Payment ID to refund"),
    amount: z.number().optional().describe("Amount to refund in paise (omit for full refund)"),
    reason: z.string().optional().describe("Reason for issuing refund"),
  },
  async ({ payment_id, amount, reason = "Merchant refund" }) => {
    try {
      const client = checkClient()
      const payload = { notes: { reason } }
      if (amount) payload.amount = amount
      const res = await client.payments.refund(payment_id.trim(), payload)
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                source: "razorpay_api",
                success: true,
                message: `Refund initiated successfully for payment ${payment_id}`,
                refund: res,
              },
              null,
              2
            ),
          },
        ],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Razorpay Refund Error: ${err.message}` }],
      }
    }
  }
)

// Tool 8: list_settlements
server.tool(
  "list_settlements",
  "Fetch merchant settlements directly from Razorpay API.",
  {
    limit: z.number().optional().describe("Count of settlements to fetch"),
  },
  async ({ limit = 10 }) => {
    try {
      const client = checkClient()
      if (!client.settlements) {
        return {
          content: [{ type: "text", text: "Settlements endpoint requires linked Razorpay Route/Bank access." }],
        }
      }
      const res = await client.settlements.all({ count: limit })
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ source: "razorpay_api", settlements: res.items || [] }, null, 2),
          },
        ],
      }
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Razorpay API Error: ${err.message}` }],
      }
    }
  }
)

// Start Stdio transport
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("[Razorpay MCP] Server running on stdio transport (Pure Live API mode)")
}

main().catch((err) => {
  console.error("[Razorpay MCP] Fatal error:", err)
  process.exit(1)
})
