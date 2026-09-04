import React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { openRazorpayCheckout } from "@/services/razorpayCheckout"

interface MarkdownRendererProps {
  content: string
  className?: string
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = "",
}) => {
  // Dynamically detect any order ID and amount in this message
  const orderIdMatch = content.match(/order_[a-zA-Z0-9]{10,}/)
  const dynamicOrderId = orderIdMatch ? orderIdMatch[0] : "order_TXGPnb2izSqLLF"

  const amountMatch = content.match(/₹\s*([0-9,]+(\.[0-9]{2})?)/)
  const dynamicAmount = amountMatch
    ? parseFloat(amountMatch[1].replace(/,/g, ""))
    : 1499

  return (
    <div className={`prose prose-sm max-w-none text-current leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Paragraphs
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,

          // Headings
          h1: ({ children }) => (
            <h1 className="text-lg font-extrabold text-foreground mb-2 mt-3 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-foreground mb-2 mt-3 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold text-foreground mb-1.5 mt-2.5 first:mt-0">
              {children}
            </h3>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="my-2 ml-4 list-disc space-y-1 marker:text-[#305EFF]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-4 list-decimal space-y-1 marker:text-[#305EFF] font-medium">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,

          // Bold & Strong
          strong: ({ children }) => (
            <strong className="font-extrabold text-foreground">{children}</strong>
          ),

          // Inline & Block Code
          pre: ({ children }: any) => (
            <pre className="my-2.5 overflow-x-auto rounded-xl bg-muted/60 p-3 font-mono text-xs text-foreground border border-border/80">
              {children}
            </pre>
          ),
          code: ({ children, className, ...props }: any) => {
            return (
              <code
                className={`rounded-md bg-foreground/10 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-[#305EFF] dark:text-blue-400 select-all ${className || ""}`}
                {...props}
              >
                {children}
              </code>
            )
          },

          // Tables
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-border/80 shadow-xs">
              <table className="w-full text-left text-xs border-collapse divide-y divide-border/80">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/40 font-bold text-foreground">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border/50 bg-card/30">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-muted/20 transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 font-extrabold text-foreground">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2 text-foreground/90 font-medium">{children}</td>
          ),

          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-3 border-[#305EFF] bg-blue-500/5 pl-3 py-1 text-xs italic text-muted-foreground rounded-r-lg">
              {children}
            </blockquote>
          ),

          // Horizontal rule
          hr: () => <hr className="my-3 border-border/60" />,

          // Links & Payment Buttons
          a: ({ href, children }: any) => {
            const isPaymentLink = href?.includes("rzp.io")
            if (isPaymentLink) {
              return (
                <button
                  type="button"
                  onClick={() => {
                    openRazorpayCheckout({
                      orderId: dynamicOrderId,
                      amount: dynamicAmount,
                      description: `Payment for ${dynamicOrderId}`,
                    })
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold px-4 py-2 text-xs shadow-md transition-all my-1.5 cursor-pointer border border-emerald-500"
                >
                  <span>💳 {children}</span>
                  <span className="text-[10px] bg-emerald-700/80 px-2 py-0.5 rounded-md font-mono">
                    Open Razorpay
                  </span>
                </button>
              )
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-[#305EFF] dark:text-blue-400 font-bold underline hover:text-[#305EFF]/80 transition-colors"
              >
                {children}
              </a>
            )
          },

          // Scannable QR Codes & Images
          img: ({ src, alt }: any) => {
            const isQr =
              src?.includes("qr-code") ||
              alt?.toLowerCase().includes("qr") ||
              alt?.toLowerCase().includes("pay")

            if (isQr) {
              return (
                <span className="my-3 flex flex-col items-center justify-center">
                  <span className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xl inline-flex flex-col items-center max-w-[260px]">
                    <img
                      src={src}
                      alt={alt || "Payment QR Code"}
                      className="w-48 h-48 object-contain rounded-lg"
                      loading="lazy"
                    />
                    <span className="mt-2.5 flex flex-col items-center gap-0.5 text-center">
                      <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                        📱 Scan to Pay with Any UPI App
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">
                        Google Pay • PhonePe • Paytm • BHIM
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        openRazorpayCheckout({
                          orderId: dynamicOrderId,
                          amount: dynamicAmount,
                        })
                      }}
                      className="mt-3 w-full py-2 rounded-xl bg-[#305EFF] hover:bg-[#305EFF]/90 active:scale-95 text-white font-extrabold text-xs shadow-sm transition-all text-center cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>💳 Pay ₹{dynamicAmount.toLocaleString("en-IN")} on This Device</span>
                    </button>
                  </span>
                </span>
              )
            }

            return (
              <img
                src={src}
                alt={alt || ""}
                className="my-2 rounded-xl max-w-full h-auto border border-border"
                loading="lazy"
              />
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownRenderer
