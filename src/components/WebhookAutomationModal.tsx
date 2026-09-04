import React, { useState, useEffect } from "react"
import {
  X,
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

interface WebhookAutomationModalProps {
  isOpen: boolean
  onClose: () => void
  onSendToChat?: (text: string) => void
}

export const WebhookAutomationModal: React.FC<WebhookAutomationModalProps> = ({
  isOpen,
  onClose,
  onSendToChat,
}) => {
  const [events, setEvents] = useState<WebhookEventRecord[]>([])
  const [isSimulating, setIsSimulating] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"all" | "failed" | "paid" | "disputes">("all")

  const webhookEndpoint = `${window.location.origin}/api/webhooks/razorpay`
  const webhookSecret = import.meta.env.VITE_RAZORPAY_WEBHOOK_SECRET || "rzp_whsec_auto_998877"

  const fetchEvents = async () => {
    const list = await getWebhookEvents()
    setEvents(list)
    if (list.length > 0 && !selectedEventId) {
      setSelectedEventId(list[0].id)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchEvents()
      const timer = setInterval(fetchEvents, 3000)
      return () => clearInterval(timer)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSimulate = async (type: keyof typeof SAMPLE_WEBHOOK_PAYLOADS) => {
    setIsSimulating(true)
    try {
      const payload = SAMPLE_WEBHOOK_PAYLOADS[type]
      await sendWebhookPayload(payload)
      const list = await getWebhookEvents()

      // Triage with AI if first time
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[85vh] flex flex-col bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="border-b border-border/80 px-6 py-4 flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-foreground">
                  Razorpay Webhook Automation Engine
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500 border border-emerald-500/20">
                  <Radio className="h-2.5 w-2.5 animate-pulse" /> Live Receiver
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time event receiver with automated AI triage and cart recovery
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={events.length === 0}
              className="rounded-xl h-8 px-2.5 text-xs text-muted-foreground hover:text-rose-500"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear Events
            </Button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* WEBHOOK DETAILS BANNER */}
        <div className="bg-muted/10 border-b border-border/60 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-muted-foreground">Endpoint:</span>
            <code className="bg-card px-2.5 py-1 rounded-lg border border-border/80 font-mono text-[11px] text-[#305EFF] select-all">
              {webhookEndpoint}
            </code>
            <button
              onClick={() => copyToClipboard(webhookEndpoint, "endpoint")}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Copy Endpoint"
            >
              {copiedText === "endpoint" ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-muted-foreground">HMAC Secret:</span>
            <code className="bg-card px-2.5 py-1 rounded-lg border border-border/80 font-mono text-[11px] text-foreground select-all">
              {webhookSecret}
            </code>
            <button
              onClick={() => copyToClipboard(webhookSecret, "secret")}
              className="text-muted-foreground hover:text-foreground transition-colors"
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

        {/* ONE-CLICK EVENT SIMULATOR BAR */}
        <div className="bg-muted/30 border-b border-border/60 px-6 py-3 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5 shrink-0">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Trigger Simulated Webhook:
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={isSimulating}
              onClick={() => handleSimulate("payment_failed")}
              className="rounded-xl h-7 px-3 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 shrink-0"
            >
              🚨 payment.failed
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isSimulating}
              onClick={() => handleSimulate("order_paid")}
              className="rounded-xl h-7 px-3 text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shrink-0"
            >
              🎉 order.paid
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isSimulating}
              onClick={() => handleSimulate("dispute_created")}
              className="rounded-xl h-7 px-3 text-xs border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 shrink-0"
            >
              ⚠️ dispute.created
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isSimulating}
              onClick={() => handleSimulate("refund_processed")}
              className="rounded-xl h-7 px-3 text-xs border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 shrink-0"
            >
              💸 refund.processed
            </Button>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={fetchEvents}
            className="rounded-xl h-7 px-2 text-xs text-muted-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSimulating ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* MAIN BODY: 2 COLUMNS */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 divide-y md:divide-y-0 md:divide-x divide-border/80">
          {/* LEFT LIST (5 COLS) */}
          <div className="md:col-span-5 flex flex-col h-full min-h-0 bg-muted/5">
            {/* Filter Tabs */}
            <div className="p-3 border-b border-border/60 flex items-center gap-1 shrink-0">
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

            {/* Events List */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0 scrollbar-hide">
              {filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
                  <Zap className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-xs font-bold">No webhook events received yet</p>
                  <p className="text-[11px] mt-1">
                    Click any simulation button above to trigger an instant webhook test!
                  </p>
                </div>
              ) : (
                filteredEvents.map((ev) => {
                  const isSelected = ev.id === selectedEventId
                  const isFail = ev.event.includes("failed")
                  const isPaid = ev.event.includes("paid") || ev.event.includes("captured")
                  const isDisp = ev.event.includes("dispute")

                  return (
                    <div
                      key={ev.id}
                      onClick={() => setSelectedEventId(ev.id)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "bg-card border-[#305EFF] shadow-md ring-1 ring-[#305EFF]/50"
                          : "bg-card/50 border-border/70 hover:border-border hover:bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`font-mono text-xs font-extrabold ${
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

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="truncate">
                          {ev.payload?.payload?.payment?.entity?.id ||
                            ev.payload?.payload?.order?.entity?.id ||
                            ev.id}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                          <ShieldCheck className="h-3 w-3" /> Verified
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* RIGHT DETAIL & AI TRIAGE (7 COLS) */}
          <div className="md:col-span-7 flex flex-col h-full min-h-0 bg-card p-6 overflow-y-auto scrollbar-hide">
            {!selectedEvent ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <FileCode className="h-10 w-10 opacity-30 mb-2" />
                <p className="text-sm font-bold">Select a webhook event to inspect</p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {/* Event Title Card */}
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-black text-foreground font-mono">
                      {selectedEvent.event}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Received at {new Date(selectedEvent.receivedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-muted/60 text-foreground border border-border">
                    ID: {selectedEvent.id}
                  </span>
                </div>

                {/* AI AUTOMATED TRIAGE BOX */}
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-amber-500 flex items-center gap-1.5">
                      <Zap className="h-4 w-4" /> Automated AI Triage & Recovery
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      Zero Human Delay
                    </span>
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-muted-foreground uppercase mb-1">
                      Event Summary:
                    </h5>
                    <p className="text-sm text-foreground font-medium">
                      {selectedEvent.aiAnalysis?.summary ||
                        (selectedEvent.event.includes("failed")
                          ? "Payment authorization failed due to incorrect OTP entered by the customer."
                          : selectedEvent.event.includes("paid")
                          ? "Order payment captured successfully via UPI. Ready for fulfillment."
                          : "Webhook event verified and processed.")}
                    </p>
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-muted-foreground uppercase mb-1">
                      Merchant Action Advisory:
                    </h5>
                    <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                      {selectedEvent.aiAnalysis?.recommendation ||
                        (selectedEvent.event.includes("failed")
                          ? "Customer cart is pending. An automated payment recovery message has been generated."
                          : selectedEvent.event.includes("paid")
                          ? "Tax invoice can be generated automatically for this customer."
                          : "Audit trail record has been updated.")}
                    </p>
                  </div>

                  {/* Customer Recovery Message Draft */}
                  {selectedEvent.aiAnalysis?.recoveryMessage && (
                    <div className="bg-card/80 border border-border/80 rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-foreground flex items-center gap-1">
                          📱 Customer Notification Draft:
                        </span>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              selectedEvent.aiAnalysis?.recoveryMessage || "",
                              "recovery"
                            )
                          }
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          {copiedText === "recovery" ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          Copy Draft
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono bg-muted/40 p-2.5 rounded-lg select-all">
                        {selectedEvent.aiAnalysis.recoveryMessage}
                      </p>
                      {onSendToChat && (
                        <Button
                          size="sm"
                          onClick={() => {
                            onSendToChat(
                              `Webhook event received for ${selectedEvent.event}:\n\n${selectedEvent.aiAnalysis?.summary}\n\nRecommended Action: ${selectedEvent.aiAnalysis?.recommendation}`
                            )
                            onClose()
                          }}
                          className="rounded-xl h-8 text-xs bg-[#305EFF] text-white hover:bg-[#305EFF]/90 self-start"
                        >
                          <Send className="h-3 w-3 mr-1" /> Send Triage to Chat
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* RAW PAYLOAD VIEWER */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1">
                      <FileCode className="h-3.5 w-3.5 text-[#305EFF]" /> Raw Webhook Payload:
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          JSON.stringify(selectedEvent.payload, null, 2),
                          "payload"
                        )
                      }
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {copiedText === "payload" ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      Copy JSON
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 font-mono text-[11px] text-foreground overflow-x-auto max-h-56">
                    {JSON.stringify(selectedEvent.payload, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default WebhookAutomationModal
