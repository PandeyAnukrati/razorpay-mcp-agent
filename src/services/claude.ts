/**
 * Anthropic Claude Support Service (COMMENTED OUT - PURE GEMINI RUNTIME)
 * 
 * All requests route 100% directly to Google Gemini 2.5 Flash with full
 * Razorpay Model Context Protocol (MCP) tool execution.
 */

import { getGeminiSupportResponse } from "./gemini"

export type ChatMessage = {
  text: string
  isUser: boolean
}

export type AttachedDocument = {
  name: string
  type?: string
  size?: string
  content?: string
}

/**
 * Legacy Claude entrypoint redirected to Google Gemini 2.5 Flash
 */
export async function getClaudeSupportResponse(
  query: string,
  history: ChatMessage[],
  attachedDocs: AttachedDocument[] = []
): Promise<string> {
  // Pure Gemini Mode: Claude is completely decommissioned.
  // All traffic routes directly to Google Gemini 2.5 Flash.
  return await getGeminiSupportResponse(query, history, attachedDocs)
}

/* =========================================================================
 * PREVIOUS ANTHROPIC CLAUDE IMPLEMENTATION (DECOMMISSIONED & COMMENTED OUT)
 * =========================================================================
 * 
 * import {
 *   mcpGetPayment,
 *   mcpListPayments,
 *   mcpGetOrder,
 *   mcpGetRefunds,
 *   mcpGetSettlements,
 *   mcpGetDisputes,
 *   mcpCreatePaymentLink,
 *   mcpCreateOrder,
 * } from "./mcpClient"
 * 
 * const CLAUDE_API_KEY = (import.meta.env.VITE_ANTHROPIC_API_KEY || "").trim()
 * const CLAUDE_MODEL = "claude-haiku-4-5-20251001"
 * const ANTHROPIC_DIRECT_URL = "https://api.anthropic.com/v1/messages"
 * const PROXY_CLAUDE_URL = "/api/claude/messages"
 * 
 * async function postClaudeMessage(body: any, headers: Record<string, string>): Promise<Response> {
 *   if (headers["x-api-key"]) {
 *     try {
 *       const directRes = await fetch(ANTHROPIC_DIRECT_URL, {
 *         method: "POST",
 *         headers,
 *         body: JSON.stringify(body),
 *       })
 *       if (directRes.status !== 405) {
 *         return directRes
 *       }
 *     } catch (directErr) {
 *       console.warn("[Claude Service] Direct Anthropic API call failed:", directErr)
 *     }
 *   }
 *   return await fetch(PROXY_CLAUDE_URL, {
 *     method: "POST",
 *     headers,
 *     body: JSON.stringify(body),
 *   })
 * }
 * ========================================================================= */
