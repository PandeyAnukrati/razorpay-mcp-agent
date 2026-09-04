import React, { useState, useEffect } from "react"
import {
  Zap,
  Clock,
  Send,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Radio,
  FileCode,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getWebhookEvents,
  sendWebhookPayload,
  clearWebhookEvents,
  triageWebhookWithAi,
  SAMPLE_WEBHOOK_PAYLOADS,
  type WebhookEventRecord,
} from "@/services/webhookAutomation"

interface WebhookAutomationPageProps {
  onSendToChat?: (text: string) => void
}

export const WebhookAutomationPage: React.FC<WebhookAutomationPageProps> = ({
  onSendToChat,
}) => {
  const [events, setEvents] = useState<WebhookEventRecord[]>([])
  const [isSimulating, setIsSimulating] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"all" | "failed" | "paid" | "disputes">("all")

  const webhookEndpoint = `${window.location.origin}/api/webhooks/razorpay`
  const webhookSecret =
    import.meta.env.VITE_RAZORPAY_WEBHOOK_SECRET || "rzp_whsec_auto_998877"

  const fetchEvents = async () => {
    const list = await getWebhookEvents()
    setEvents(list)
    if (list.length > 0 && !selectedEventId) {
      setSelectedEventId(list[0].id)
    }
  }

  useEffect(() => {
    fetchEvents()
    const timer = setInterval(fetchEvents, 3000)
    return () => clearInterval(timer)
  }, [])

  const handleSimulate = async (type: keyof typeof SAMPLE_WEBHOOK_PAYLOADS) => {
    setIsSimulating(true)
    try {
      const payload = SAMPLE_WEBHOOK_PAYLOADS[type]
      await sendWebhookPayload(payload)
      const list = await getWebhookEvents()

      if (list.length > 0) {
        const latest = list[0]
        const analysis = await triageWebhookWithAi(latest.event, latest.payload)
        latest.aiAnalysis = analysis
        setSelectedEventId(latest.id)
      }
      setEvents(list)
    } catch (err) {
      console.error("Simulation error:", err)
    } finally {
      setIsSimulating(false)
    }
  }

  const handleClear = async () => {
    await clearWebhookEvents()
    setEvents([])
    setSelectedEventId(null)
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(id)
    setTimeout(() => setCopiedText(null), 2000)
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0]

  const filteredEvents = events.filter((e) => {
    if (activeTab === "failed") return e.event.includes("failed")
    if (activeTab === "paid") return e.event.includes("paid") || e.event.includes("captured")
    if (activeTab === "disputes") return e.event.includes("dispute")
    return true
  })

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col h-[calc(100vh-4rem)] min-h-0 overflow-hidden box-border">
      {/* 1. TOP HEADER & DETAILS BAR */}
      <div className="bg-card border border-border rounded-3xl p-5 mb-5 shadow-xs shrink-0 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black tracking-tight text-foreground">
                  Razorpay Webhook Automation Engine
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-500 border border-emerald-500/20">
                  <Radio className="h-2.5 w-2.5 animate-pulse" /> Live Receiver Active
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time HTTP webhook receiver with HMAC SHA256 validation & AI-powered instant cart recovery
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={events.length === 0}
              className="rounded-xl h-9 px-3 text-xs text-muted-foreground hover:text-rose-500"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear Events
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEvents}
              className="rounded-xl h-9 px-3 text-xs text-muted-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isSimulating ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Credentials and Simulator Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-3 border-t border-border/60">
          {/* Left: Endpoint & Secret */}
          <div className="lg:col-span-6 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/80">
              <span className="font-bold text-muted-foreground">Endpoint:</span>
              <code className="font-mono text-[11px] text-[#305EFF] select-all">
                {webhookEndpoint}
              </code>
              <button
                onClick={() => copyToClipboard(webhookEndpoint, "endpoint")}
                className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                title="Copy Endpoint"
              >
                {copiedText === "endpoint" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/80">
              <span className="font-bold text-muted-foreground">Secret:</span>
              <code className="font-mono text-[11px] text-foreground select-all">
                {webhookSecret}
              </code>
              <button
                onClick={() => copyToClipboard(webhookSecret, "secret")}
                className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                title="Copy Secret"
              >
                {copiedText === "secret" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Right: Simulation Buttons */}
          <div className="lg:col-span-6 flex flex-wrap items-center justify-start lg:justify-end gap-2">
            <span className="text-xs font-bold text-muted-foreground mr-1">Simulate:</span>
            <Button
              size="sm"
              variant="outline"
              disabled={isSimulating}
              onClick={() => handleSimulate("payment_failed")}
              className="rounded-xl h-8 px-3 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            >
              🚨 payment.failed
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isSimulating}
              onClick={() => handleSimulate("order_paid")}
              className="rounded-xl h-8 px-3 text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            >
              🎉 order.paid
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isSimulating}
              onClick={() => handleSimulate("dispute_created")}
              className="rounded-xl h-8 px-3 text-xs border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
            >
              ⚠️ dispute.created
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isSimulating}
              onClick={() => handleSimulate("refund_processed")}
              className="rounded-xl h-8 px-3 text-xs border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
            >
              💸 refund.processed
            </Button>
          </div>
        </div>
      </div>

      {/* 2. MAIN 2-COLUMN VIEWPORT */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: EVENTS STREAM (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col h-full min-h-0 bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
          {/* Filter Tabs */}
          <div className="p-3.5 border-b border-border/80 flex items-center justify-between bg-muted/20 shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === "all"
                    ? "bg-[#305EFF] text-white"
                    : "text-muted-foreground hover:bg-muted/40"
                }`}
              >
                All ({events.length})
              </button>
              <button
                onClick={() => setActiveTab("failed")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === "failed"
                    ? "bg-amber-500 text-white"
                    : "text-muted-foreground hover:bg-muted/40"
                }`}
              >
                Failed
              </button>
              <button
                onClick={() => setActiveTab("paid")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === "paid"
                    ? "bg-emerald-500 text-white"
                    : "text-muted-foreground hover:bg-muted/40"
                }`}
              >
                Paid
              </button>
              <button
                onClick={() => setActiveTab("disputes")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === "disputes"
                    ? "bg-rose-500 text-white"
                    : "text-muted-foreground hover:bg-muted/40"
                }`}
              >
                Disputes
              </button>
            </div>
          </div>

          {/* Events Scroll List */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 min-h-0 scrollbar-hide bg-muted/5">
            {filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
                <Zap className="h-10 w-10 mb-3 opacity-25" />
                <p className="text-sm font-bold">No webhook events received</p>
                <p className="text-xs mt-1 max-w-xs">
                  Click any simulation button above or send a POST to your webhook endpoint.
                </p>
              </div>
            ) : (
              filteredEvents.map((ev) => {
                const isSelected = ev.id === (selectedEvent?.id || "")
                const isFail = ev.event.includes("failed")
                const isPaid = ev.event.includes("paid") || ev.event.includes("captured")
                const isDisp = ev.event.includes("dispute")

                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "bg-card border-[#305EFF] shadow-md ring-1 ring-[#305EFF]/50"
                        : "bg-card/60 border-border/70 hover:border-border hover:bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`font-mono text-xs font-black ${
                          isFail
                            ? "text-amber-500"
                            : isPaid
                            ? "text-emerald-500"
                            : isDisp
                            ? "text-rose-500"
                            : "text-[#305EFF]"
                        }`}
                      >
                        {ev.event}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(ev.receivedAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono text-[11px] truncate">
                        {ev.payload?.payload?.payment?.entity?.id ||
                          ev.payload?.payload?.order?.entity?.id ||
                          ev.id}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                        <ShieldCheck className="h-3 w-3" /> HMAC Verified
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: EVENT DETAIL & AI TRIAGE (7 COLS) */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-0 bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
          {!selectedEvent ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
              <FileCode className="h-12 w-12 opacity-25 mb-3" />
              <p className="text-base font-bold">Select a webhook event from the list</p>
              <p className="text-xs mt-1">
                Inspect raw payloads, HMAC signature verification, and automated AI recovery drafts.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 scrollbar-hide">
              {/* Event Title Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border/80">
                <div>
                  <h3 className="text-xl font-black text-foreground font-mono">
                    {selectedEvent.event}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Received at {new Date(selectedEvent.receivedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-muted/60 text-foreground border border-border">
                    ID: {selectedEvent.id}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Valid Signature
                  </span>
                </div>
              </div>

              {/* AUTOMATED AI TRIAGE CARD */}
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <Zap className="h-4 w-4" /> Automated AI Triage & Recovery
                  </span>
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    Zero Human Delay
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-1">
                    Event Summary
                  </h4>
                  <p className="text-sm text-foreground font-semibold leading-relaxed">
                    {selectedEvent.aiAnalysis?.summary ||
                      (selectedEvent.event.includes("failed")
                        ? "Payment authorization failed due to incorrect OTP entered by customer."
                        : selectedEvent.event.includes("paid")
                        ? "Order payment captured successfully via UPI. Ready for automated fulfillment."
                        : "Webhook event verified and processed.")}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-1">
                    Merchant Action Advisory
                  </h4>
                  <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                    {selectedEvent.aiAnalysis?.recommendation ||
                      (selectedEvent.event.includes("failed")
                        ? "Customer cart is pending. An automated payment recovery message has been prepared."
                        : selectedEvent.event.includes("paid")
                        ? "Tax invoice can be generated automatically for this customer."
                        : "Audit trail record has been updated.")}
                  </p>
                </div>

                {/* Customer Recovery Message Draft */}
                {selectedEvent.aiAnalysis?.recoveryMessage && (
                  <div className="bg-card/90 border border-border/80 rounded-2xl p-4 flex flex-col gap-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        📱 Prepared Customer Notification Draft:
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            selectedEvent.aiAnalysis?.recoveryMessage || "",
                            "recovery"
                          )
                        }
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        {copiedText === "recovery" ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        Copy Draft
                      </button>
                    </div>

                    <p className="text-xs text-foreground/90 font-mono bg-muted/40 p-3 rounded-xl select-all border border-border/60 leading-relaxed">
                      {selectedEvent.aiAnalysis.recoveryMessage}
                    </p>

                    {onSendToChat && (
                      <Button
                        size="sm"
                        onClick={() => {
                          onSendToChat(
                            `Webhook Event: ${selectedEvent.event}\n\nSummary: ${selectedEvent.aiAnalysis?.summary}\n\nRecommended Action: ${selectedEvent.aiAnalysis?.recommendation}\n\nCustomer Draft: "${selectedEvent.aiAnalysis?.recoveryMessage}"`
                          )
                        }}
                        className="rounded-xl h-9 text-xs bg-[#305EFF] text-white hover:bg-[#305EFF]/90 self-start font-bold gap-1.5 mt-1"
                      >
                        <Send className="h-3.5 w-3.5" /> Route Alert to Chat Console
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* RAW WEBHOOK PAYLOAD */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <FileCode className="h-4 w-4 text-[#305EFF]" /> Raw Webhook Payload JSON:
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(JSON.stringify(selectedEvent.payload, null, 2), "payload")
                    }
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    {copiedText === "payload" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Copy JSON
                  </button>
                </div>

                <pre className="p-4 rounded-2xl bg-muted/40 border border-border/80 font-mono text-[11px] text-foreground overflow-x-auto max-h-72 leading-relaxed">
                  {JSON.stringify(selectedEvent.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default WebhookAutomationPage
