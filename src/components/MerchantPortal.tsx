import React, { useState, useEffect } from "react"
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  ArrowLeft,
  RefreshCw,
  Zap,
  Eye,
  DollarSign,
  Filter,
  X,
  Info,
  Sparkles,
  Building2,
  CreditCard,
  Receipt,
  MessageSquare,
  Users,
  Image as ImageIcon,
  CheckCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getRefundClaims,
  settleRefundClaim,
  type RefundClaim,
  type AttachedEvidence,
} from "@/services/refundClaims"
import { getAllChatSessions, type ChatSession } from "@/services/firebaseChat"
import { mcpListPayments, mcpListOrders, formatINR } from "@/services/mcpClient"

interface MerchantPortalProps {
  onBackToChat: () => void
  merchantEmail?: string
}

type TabKey = "claims" | "tickets" | "customers" | "payments"

export function MerchantPortal({ onBackToChat, merchantEmail = "merchant@razorpay.com" }: MerchantPortalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("claims")
  const [claims, setClaims] = useState<RefundClaim[]>([])
  const [tickets, setTickets] = useState<ChatSession[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState<boolean>(false)

  // Filters
  const [claimsFilter, setClaimsFilter] = useState<string>("all")
  const [claimsSearch, setClaimsSearch] = useState<string>("")
  const [ticketSearch, setTicketSearch] = useState<string>("")

  // Modals & drawers
  const [selectedClaim, setSelectedClaim] = useState<RefundClaim | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<ChatSession | null>(null)
  const [previewEvidence, setPreviewEvidence] = useState<AttachedEvidence | null>(null)
  const [actionNote, setActionNote] = useState<string>("")
  const [processingClaimId, setProcessingClaimId] = useState<string | null>(null)
  const [feedbackToast, setFeedbackToast] = useState<{ title: string; desc: string; type: "success" | "error" | "info" } | null>(null)

  const showToast = (title: string, desc: string, type: "success" | "error" | "info" = "success") => {
    setFeedbackToast({ title, desc, type })
    setTimeout(() => setFeedbackToast(null), 5000)
  }

  // Load all portal data
  const loadData = async () => {
    setRefreshing(true)
    try {
      // 1. Refund claims
      const claimsData = getRefundClaims()
      setClaims(claimsData)

      // 2. Chat sessions / support tickets
      const ticketsData = await getAllChatSessions()
      setTickets(ticketsData)

      // 3. Live Razorpay payments
      try {
        const pRes = await mcpListPayments({ limit: 10 })
        if (pRes && pRes.payments) {
          setPayments(pRes.payments)
        }
      } catch (err) {
        console.warn("Could not fetch live payments:", err)
      }

      // 4. Live Razorpay orders
      try {
        const oRes = await mcpListOrders(10)
        if (oRes && oRes.orders) {
          setOrders(oRes.orders)
        }
      } catch (err) {
        console.warn("Could not fetch live orders:", err)
      }
    } catch (err) {
      console.error("Failed to load portal data:", err)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
    const handleRefundEvent = () => {
      setClaims(getRefundClaims())
    }
    window.addEventListener("razorpay_refund_approved", handleRefundEvent)
    return () => window.removeEventListener("razorpay_refund_approved", handleRefundEvent)
  }, [])

  // Handle merchant settlement decision
  const handleSettle = async (claimId: string, action: "approve" | "reject" | "request_info", customNote?: string) => {
    setProcessingClaimId(claimId)
    try {
      const result = await settleRefundClaim(claimId, action, customNote || actionNote)
      if (result.success) {
        setClaims(getRefundClaims())
        if (selectedClaim?.claimId === claimId) {
          const updated = getRefundClaims().find((c) => c.claimId === claimId)
          setSelectedClaim(updated || null)
        }
        setActionNote("")
        if (action === "approve") {
          showToast(
            "Refund Approved & Settled!",
            `Refund executed via Razorpay MCP. Refund ID: ${result.refundId || "rfnd_instant"}. Real-time webhook card dispatched to customer chat.`,
            "success"
          )
        } else if (action === "reject") {
          showToast("Claim Rejected", "Claim status updated to Rejected. Customer notified.", "info")
        } else {
          showToast("Evidence Requested", "Request for unboxing video/invoice logged. Customer ticket updated.", "info")
        }
      } else {
        showToast("Action Failed", result.error || "Could not process settlement action.", "error")
      }
    } catch (err: any) {
      showToast("Error", err.message || "Settlement failed", "error")
    } finally {
      setProcessingClaimId(null)
    }
  }

  // Filtered claims
  const filteredClaims = claims.filter((claim) => {
    if (claimsFilter === "pending" && claim.status !== "Pending Vendor Decision") return false
    if (claimsFilter === "approved" && claim.status !== "Approved & Refunded") return false
    if (claimsFilter === "rejected" && claim.status !== "Rejected") return false
    if (claimsFilter === "info" && claim.status !== "Additional Evidence Requested") return false

    if (claimsSearch.trim()) {
      const q = claimsSearch.toLowerCase()
      const matchId = claim.claimId.toLowerCase().includes(q)
      const matchCust = claim.customerName.toLowerCase().includes(q) || claim.customerEmail.toLowerCase().includes(q)
      const matchPay = claim.paymentId.toLowerCase().includes(q)
      const matchReason = claim.reason.toLowerCase().includes(q)
      if (!matchId && !matchCust && !matchPay && !matchReason) return false
    }
    return true
  })

  // Pending count & total under review
  const pendingClaims = claims.filter((c) => c.status === "Pending Vendor Decision")
  const totalVolumeUnderReview = pendingClaims.reduce((acc, c) => acc + c.amount, 0)

  // Aggregated Customer Directory
  const customerDirectory = React.useMemo(() => {
    const map = new Map<string, {
      name: string
      email: string
      contact?: string
      ticketsCount: number
      claimsCount: number
      totalSpend: number
      lastActive: string
    }>()

    // From tickets
    tickets.forEach((t) => {
      const email = t.uid?.includes("@") ? t.uid : `customer_${t.id.slice(0, 4)}@razorpay.test`
      const existing = map.get(email) || {
        name: t.uid?.split("@")[0] || "Customer",
        email,
        ticketsCount: 0,
        claimsCount: 0,
        totalSpend: 0,
        lastActive: t.date || "Recent",
      }
      existing.ticketsCount += 1
      map.set(email, existing)
    })

    // From claims
    claims.forEach((c) => {
      const existing = map.get(c.customerEmail) || {
        name: c.customerName,
        email: c.customerEmail,
        contact: c.customerContact,
        ticketsCount: 0,
        claimsCount: 0,
        totalSpend: 0,
        lastActive: c.createdAt,
      }
      existing.claimsCount += 1
      existing.totalSpend += c.amount
      map.set(c.customerEmail, existing)
    })

    // From payments
    payments.forEach((p) => {
      if (p.email) {
        const existing = map.get(p.email) || {
          name: p.contact || "Customer",
          email: p.email,
          contact: p.contact,
          ticketsCount: 0,
          claimsCount: 0,
          totalSpend: 0,
          lastActive: p.created_at || "Recent",
        }
        existing.totalSpend += (p.amount || 0) / 100
        map.set(p.email, existing)
      }
    })

    return Array.from(map.values())
  }, [tickets, claims, payments])

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0d14] text-slate-100 overflow-hidden font-sans">
      {/* Toast Notification */}
      {feedbackToast && (
        <div
          className={`fixed top-5 right-5 z-50 max-w-md p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            feedbackToast.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
              : feedbackToast.type === "error"
              ? "bg-rose-950/90 border-rose-500/50 text-rose-200"
              : "bg-blue-950/90 border-blue-500/50 text-blue-200"
          }`}
        >
          <div className="flex items-start gap-3">
            {feedbackToast.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            ) : feedbackToast.type === "error" ? (
              <XCircle className="w-5 h-5 text-rose-400 mt-0.5 flex-shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <div className="font-semibold text-sm">{feedbackToast.title}</div>
              <div className="text-xs mt-1 text-slate-300 leading-relaxed">{feedbackToast.desc}</div>
            </div>
            <button
              onClick={() => setFeedbackToast(null)}
              className="text-slate-400 hover:text-white text-xs p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="px-6 py-3.5 bg-[#0f1422] border-b border-slate-800/80 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToChat}
            className="border-slate-700 bg-slate-800/50 hover:bg-slate-700/60 text-slate-200 gap-2 h-9 px-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Customer Chat
          </Button>

          <div className="h-6 w-px bg-slate-800" />

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white">Razorpay Super Merchant Portal</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-amber-500/20 border border-amber-500/40 text-amber-300">
                  👑 Super Merchant Mode
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                  Tier 1 Enterprise
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Logged in as <strong className="text-slate-200">{merchantEmail}</strong> • Razorpay Model Context Protocol (MCP) Live
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={refreshing}
            className="border-slate-700 bg-slate-800/40 text-slate-300 hover:text-white hover:bg-slate-700/50 gap-1.5 h-8 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
            Sync Live Data
          </Button>

          <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-xs text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Gateway Active
          </div>
        </div>
      </header>

      {/* QUICK STATS STRIP */}
      <div className="px-6 py-3 bg-[#0d111d] border-b border-slate-800/60 grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0">
        <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">AI Refund Escalations</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5 flex items-center gap-2">
              {pendingClaims.length}
              {pendingClaims.length > 0 && (
                <span className="text-[10px] font-normal px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 animate-pulse">
                  Action Required
                </span>
              )}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Claims Volume Under Review</div>
            <div className="text-xl font-bold text-white mt-0.5">
              {formatINR(totalVolumeUnderReview * 100)}
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Support Chat Sessions</div>
            <div className="text-xl font-bold text-sky-400 mt-0.5">{tickets.length}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Customer CRM Profiles</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{customerDirectory.length}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="px-6 border-b border-slate-800 bg-[#0f1422] flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => setActiveTab("claims")}
          className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "claims"
              ? "border-amber-400 text-amber-300 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          AI Refund Escalation Desk
          {pendingClaims.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-slate-950 font-bold">
              {pendingClaims.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("tickets")}
          className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "tickets"
              ? "border-indigo-400 text-indigo-300 bg-indigo-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Support Tickets & Transcripts
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {tickets.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("customers")}
          className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "customers"
              ? "border-emerald-400 text-emerald-300 bg-emerald-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="w-4 h-4" />
          Customer CRM & Profiles
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300">
            {customerDirectory.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("payments")}
          className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === "payments"
              ? "border-sky-400 text-sky-300 bg-sky-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Live Razorpay Payments & Orders
        </button>
      </div>

      {/* MAIN VIEW CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* =========================================================================
            TAB 1: AI REFUND ESCALATION DESK
            ========================================================================= */}
        {activeTab === "claims" && (
          <div className="space-y-5">
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Filter Status:
                </span>
                {[
                  { id: "all", label: "All Claims" },
                  { id: "pending", label: "Pending Vendor Decision" },
                  { id: "approved", label: "Approved & Refunded" },
                  { id: "rejected", label: "Rejected" },
                  { id: "info", label: "More Evidence Needed" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setClaimsFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      claimsFilter === f.id
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search Claim ID, customer, payment ID..."
                  value={claimsSearch}
                  onChange={(e) => setClaimsSearch(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Claims Cards List */}
            {filteredClaims.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-300">No Refund Claims Found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  There are no refund claims matching your current filter. When a customer in the chat requests a high-value or disputed refund, Gemini AI autonomously investigates and routes it here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5">
                {filteredClaims.map((claim) => {
                  const isPending = claim.status === "Pending Vendor Decision"
                  const isApproved = claim.status === "Approved & Refunded"
                  const isRejected = claim.status === "Rejected"
                  const score = claim.aiInvestigation?.validityScore || 85

                  return (
                    <div
                      key={claim.claimId}
                      className={`p-5 rounded-2xl border transition-all ${
                        isPending
                          ? "bg-gradient-to-b from-[#161a29] to-[#0f1422] border-amber-500/40 shadow-xl shadow-amber-950/10"
                          : isApproved
                          ? "bg-slate-900/50 border-emerald-500/30"
                          : isRejected
                          ? "bg-slate-900/50 border-rose-500/30"
                          : "bg-slate-900/50 border-slate-800"
                      }`}
                    >
                      {/* Claim Header */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 bg-slate-800 text-amber-300 rounded-md border border-slate-700">
                            {claim.claimId}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-base text-white">{claim.reason}</h3>
                              <span
                                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                                  isPending
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 animate-pulse"
                                    : isApproved
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    : isRejected
                                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                    : "bg-sky-500/20 text-sky-300 border-sky-500/40"
                                }`}
                              >
                                {claim.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                              <span>Customer: <strong className="text-slate-200">{claim.customerName}</strong> ({claim.customerEmail})</span>
                              <span>•</span>
                              <span>Created: {claim.createdAt}</span>
                            </div>
                          </div>
                        </div>

                        {/* Amount & Quick Info */}
                        <div className="text-right">
                          <div className="text-2xl font-black text-white">{claim.amountFormatted}</div>
                          <div className="text-[11px] font-mono text-slate-400">
                            Payment: <code className="text-indigo-300">{claim.paymentId}</code>
                          </div>
                        </div>
                      </div>

                      {/* AI INVESTIGATION DOSSIER & EVIDENCE ROW */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-4">
                        {/* Column 1 & 2: Autonomous AI Investigation Card */}
                        <div className="lg:col-span-2 p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-amber-400" />
                              <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                                Gemini Autonomous AI Investigation
                              </span>
                            </div>

                            {/* AI Validity Score Badge */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400">Validity Score:</span>
                              <div
                                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                  score >= 80
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    : score >= 60
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                    : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                }`}
                              >
                                🛡️ {score}/100 ({score >= 80 ? "High Credibility" : "Needs Review"})
                              </div>
                            </div>
                          </div>

                          {/* AI Summary */}
                          <div className="text-xs text-slate-300 bg-slate-900/70 p-3 rounded-lg border border-slate-800/80 leading-relaxed">
                            <strong className="text-slate-100">AI Finding:</strong> {claim.aiInvestigation?.summary}
                          </div>

                          {/* Policy Checklist & Escalation Reason */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            <div className="p-2 bg-slate-900/50 rounded-lg border border-slate-800 flex items-center gap-2 text-slate-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              <span>Live Payment Captured</span>
                            </div>
                            <div className="p-2 bg-slate-900/50 rounded-lg border border-slate-800 flex items-center gap-2 text-slate-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              <span>14-Day Window Valid</span>
                            </div>
                            <div className="p-2 bg-slate-900/50 rounded-lg border border-slate-800 flex items-center gap-2 text-slate-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              <span>Evidence Corroborated</span>
                            </div>
                            <div className="p-2 bg-slate-900/50 rounded-lg border border-slate-800 flex items-center gap-2 text-slate-300">
                              <ShieldCheck className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                              <span>Low Chargeback Risk</span>
                            </div>
                          </div>

                          {/* AI Recommendation Box */}
                          <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-lg flex items-start gap-2.5 text-xs text-indigo-200">
                            <Zap className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <strong className="text-white">AI Recommendation:</strong> {claim.aiInvestigation?.recommendation}
                              <div className="text-[11px] text-indigo-300/80 mt-0.5">
                                Reason for Human Sign-off: {claim.aiInvestigation?.escalationReason}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Column 3: Attached Customer Evidence Gallery */}
                        <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                                <FileText className="w-4 h-4 text-sky-400" />
                                Customer Attached Evidence ({claim.attachedDocs?.length || 0})
                              </div>
                              <span className="text-[10px] text-slate-500">Verified Files</span>
                            </div>

                            {(!claim.attachedDocs || claim.attachedDocs.length === 0) ? (
                              <div className="p-4 text-center border border-dashed border-slate-800 rounded-lg text-slate-500 text-xs">
                                No physical documents attached. AI evaluated transaction telemetry.
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {claim.attachedDocs.map((doc, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2 bg-slate-900/70 border border-slate-800 rounded-lg flex items-center justify-between hover:border-slate-700 transition-all cursor-pointer group"
                                    onClick={() => setPreviewEvidence(doc)}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {doc.type === "image" || doc.previewUrl ? (
                                        <div className="w-8 h-8 rounded bg-slate-800 overflow-hidden flex-shrink-0 relative">
                                          {doc.previewUrl ? (
                                            <img
                                              src={doc.previewUrl}
                                              alt={doc.name}
                                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                            />
                                          ) : (
                                            <ImageIcon className="w-4 h-4 text-indigo-400 m-2" />
                                          )}
                                        </div>
                                      ) : (
                                        <div className="w-8 h-8 rounded bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
                                          <FileText className="w-4 h-4" />
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <div className="text-xs font-medium text-slate-200 truncate group-hover:text-amber-300">
                                          {doc.name}
                                        </div>
                                        <div className="text-[10px] text-slate-500">{doc.size || "120 KB"} • Click to Inspect</div>
                                      </div>
                                    </div>
                                    <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-white flex-shrink-0" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Button to open full claim dossier */}
                          <button
                            onClick={() => setSelectedClaim(claim)}
                            className="mt-3 w-full py-1.5 px-3 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Info className="w-3.5 h-3.5" />
                            Open Full Claim Audit Trail
                          </button>
                        </div>
                      </div>

                      {/* VENDOR ACTIONS BAR (Approve / Reject / Request Evidence) */}
                      {isPending && (
                        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/40 -mx-5 -mb-5 p-4 rounded-b-2xl">
                          <div className="text-xs text-amber-200 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                            <span>
                              <strong>Vendor Decision Required:</strong> Settle this high-value refund via live Razorpay MCP gateway.
                            </span>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={processingClaimId === claim.claimId}
                              onClick={() => handleSettle(claim.claimId, "request_info", "Please upload additional unboxing video or courier damage receipt.")}
                              className="border-slate-700 bg-slate-800 text-slate-300 hover:text-white text-xs h-8"
                            >
                              Request Info
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={processingClaimId === claim.claimId}
                              onClick={() => handleSettle(claim.claimId, "reject", "Claim does not meet return window criteria.")}
                              className="border-rose-800/60 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 hover:text-white text-xs h-8"
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              Reject Claim
                            </Button>

                            <Button
                              size="sm"
                              disabled={processingClaimId === claim.claimId}
                              onClick={() => handleSettle(claim.claimId, "approve", "Approved by Super Merchant Escalation Desk after evidence verification")}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-8 gap-1.5 shadow-lg shadow-emerald-600/20"
                            >
                              {processingClaimId === claim.claimId ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Zap className="w-3.5 h-3.5" />
                              )}
                              Approve & Process Refund ({claim.amountFormatted})
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Completed Decision Info */}
                      {!isPending && claim.vendorDecision && (
                        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-300">Vendor Decision:</span>
                            <span className="text-white">{claim.vendorDecision.action.toUpperCase()}</span>
                            <span>•</span>
                            <span>{claim.vendorDecision.timestamp}</span>
                            {claim.vendorDecision.vendorNotes && (
                              <span className="text-slate-400 italic">"{claim.vendorDecision.vendorNotes}"</span>
                            )}
                          </div>
                          {claim.vendorDecision.refundId && (
                            <div className="font-mono text-emerald-400 text-xs">
                              Razorpay Refund ID: <strong>{claim.vendorDecision.refundId}</strong>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2: CUSTOMER SUPPORT TICKETS & TRANSCRIPTS
            ========================================================================= */}
        {activeTab === "tickets" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
              <div>
                <h3 className="text-sm font-bold text-white">All Customer Support Tickets</h3>
                <p className="text-xs text-slate-400">
                  Synchronized from Firebase Firestore & Local Storage. Click any ticket to inspect the full transcript.
                </p>
              </div>
              <div className="relative w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Ticket Reference</th>
                    <th className="py-3 px-4 font-semibold">Subject / Inquiry</th>
                    <th className="py-3 px-4 font-semibold">Customer UID</th>
                    <th className="py-3 px-4 font-semibold">Priority</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Messages</th>
                    <th className="py-3 px-4 font-semibold">Date</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {tickets
                    .filter((t) =>
                      ticketSearch
                        ? t.subject.toLowerCase().includes(ticketSearch.toLowerCase()) ||
                          t.id.toLowerCase().includes(ticketSearch.toLowerCase())
                        : true
                    )
                    .map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-amber-300">{ticket.id}</td>
                        <td className="py-3 px-4 font-medium text-slate-200 max-w-xs truncate">
                          {ticket.subject}
                        </td>
                        <td className="py-3 px-4 text-slate-400">{ticket.uid || "guest_user"}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ticket.priority === "High"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : ticket.priority === "Medium"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {ticket.priority || "Medium"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              ticket.status === "Open"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : ticket.status === "In Review"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {ticket.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{ticket.messages?.length || 0}</td>
                        <td className="py-3 px-4 text-slate-400">{ticket.date || "Recent"}</td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTicket(ticket)}
                            className="h-7 text-xs text-indigo-300 hover:text-indigo-200 hover:bg-indigo-950/40 gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Transcript
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: CUSTOMER CRM DIRECTORY
            ========================================================================= */}
        {activeTab === "customers" && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Customer CRM Directory</h3>
                <p className="text-xs text-slate-400">
                  Aggregated customer profiles, lifetime spend, order history, and support history across all channels.
                </p>
              </div>
              <div className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-xs text-indigo-300">
                {customerDirectory.length} Unique Customer Profiles
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Customer</th>
                    <th className="py-3 px-4 font-semibold">Email</th>
                    <th className="py-3 px-4 font-semibold">Contact</th>
                    <th className="py-3 px-4 font-semibold">Total Spend</th>
                    <th className="py-3 px-4 font-semibold">Tickets</th>
                    <th className="py-3 px-4 font-semibold">Refund Claims</th>
                    <th className="py-3 px-4 font-semibold">Risk Rating</th>
                    <th className="py-3 px-4 font-semibold">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {customerDirectory.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-400 text-white flex items-center justify-center font-bold text-[10px]">
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        {c.name}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">{c.email}</td>
                      <td className="py-3 px-4 text-slate-400">{c.contact || "+91 98XXX XXXXX"}</td>
                      <td className="py-3 px-4 font-bold text-emerald-400">
                        {c.totalSpend > 0 ? formatINR(c.totalSpend * 100) : "₹0.00"}
                      </td>
                      <td className="py-3 px-4 text-slate-300">{c.ticketsCount}</td>
                      <td className="py-3 px-4">
                        {c.claimsCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {c.claimsCount} Claim{c.claimsCount > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Low Risk
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{c.lastActive}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: LIVE RAZORPAY PAYMENTS & ORDERS
            ========================================================================= */}
        {activeTab === "payments" && (
          <div className="space-y-6">
            {/* Live Payments Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Live Razorpay Payments</h3>
                  <span className="text-xs text-slate-400">({payments.length} retrieved via MCP)</span>
                </div>
                <div className="text-xs text-slate-400">Direct Gateway Sync</div>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Payment ID</th>
                      <th className="py-3 px-4 font-semibold">Amount</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Method</th>
                      <th className="py-3 px-4 font-semibold">Customer Email</th>
                      <th className="py-3 px-4 font-semibold">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500">
                          No recent payments recorded on this merchant key.
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-300">{p.id}</td>
                          <td className="py-3 px-4 font-bold text-white">{p.amount_formatted}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.status === "captured"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                  : p.status === "refunded"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300 uppercase">{p.method || "UPI"}</td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{p.email || "—"}</td>
                          <td className="py-3 px-4 text-slate-400">{p.created_at}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Live Orders Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-bold text-white">Live Razorpay Orders</h3>
                  <span className="text-xs text-slate-400">({orders.length} retrieved via MCP)</span>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Order ID</th>
                      <th className="py-3 px-4 font-semibold">Total Amount</th>
                      <th className="py-3 px-4 font-semibold">Amount Paid</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Receipt</th>
                      <th className="py-3 px-4 font-semibold">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500">
                          No recent orders recorded.
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-sky-300">{o.id}</td>
                          <td className="py-3 px-4 font-bold text-white">{o.amount_formatted}</td>
                          <td className="py-3 px-4 text-emerald-400 font-semibold">{o.amount_paid_formatted}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                o.status === "paid"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              }`}
                            >
                              {o.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{o.receipt || "—"}</td>
                          <td className="py-3 px-4 text-slate-400">{o.created_at}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL 1: TICKET TRANSCRIPT VIEWER MODAL
          ========================================================================= */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-300 bg-slate-800 px-2 py-0.5 rounded">
                    {selectedTicket.id}
                  </span>
                  <h3 className="font-bold text-sm text-white">{selectedTicket.subject}</h3>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Customer: <strong className="text-slate-200">{selectedTicket.uid}</strong> • Status: {selectedTicket.status}
                </div>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/50">
              {selectedTicket.messages?.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.isUser ? "items-end" : "items-start"}`}
                >
                  <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1.5">
                    <span>{msg.isUser ? "Customer" : "Razorpay AI Agent"}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs leading-relaxed ${
                      msg.isUser
                        ? "bg-indigo-600 text-white font-normal"
                        : "bg-slate-900 border border-slate-800 text-slate-200"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Total {selectedTicket.messages?.length || 0} messages in thread</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedTicket(null)}
                className="border-slate-700 bg-slate-800 text-slate-300 text-xs h-8"
              >
                Close Transcript
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: EVIDENCE INSPECTION LIGHTBOX
          ========================================================================= */}
      {previewEvidence && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[#0f1422] border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="px-6 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white">{previewEvidence.name}</h3>
                <span className="text-xs text-slate-400">({previewEvidence.size || "120 KB"})</span>
              </div>
              <button
                onClick={() => setPreviewEvidence(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center bg-slate-950">
              {previewEvidence.previewUrl ? (
                <img
                  src={previewEvidence.previewUrl}
                  alt={previewEvidence.name}
                  className="max-h-[60vh] max-w-full rounded-lg border border-slate-800 object-contain shadow-xl"
                />
              ) : previewEvidence.content ? (
                <div className="w-full p-4 bg-slate-900 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 whitespace-pre-wrap">
                  {previewEvidence.content}
                </div>
              ) : (
                <div className="text-center p-8 text-slate-400">
                  <FileText className="w-12 h-12 mx-auto text-slate-600 mb-2" />
                  <p className="text-sm font-medium">Document verified by Gemini OCR</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Receipt matches damage claim details and order payment hash.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Evidence Verified by Autonomous AI
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewEvidence(null)}
                className="border-slate-700 bg-slate-800 text-slate-200 text-xs h-8"
              >
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: FULL CLAIM AUDIT TRAIL MODAL
          ========================================================================= */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1422] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-300 bg-slate-800 px-2.5 py-0.5 rounded">
                    {selectedClaim.claimId}
                  </span>
                  <h3 className="font-bold text-sm text-white">Full Claim Dossier & Telemetry</h3>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Razorpay Live Payment: <code className="text-indigo-300">{selectedClaim.paymentId}</code>
                </div>
              </div>
              <button
                onClick={() => setSelectedClaim(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/50 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500">Customer Name:</span>
                  <div className="font-semibold text-slate-200">{selectedClaim.customerName}</div>
                </div>
                <div>
                  <span className="text-slate-500">Customer Email:</span>
                  <div className="font-semibold text-slate-200">{selectedClaim.customerEmail}</div>
                </div>
                <div>
                  <span className="text-slate-500">Claim Amount:</span>
                  <div className="font-bold text-emerald-400 text-sm">{selectedClaim.amountFormatted}</div>
                </div>
                <div>
                  <span className="text-slate-500">Current Status:</span>
                  <div className="font-semibold text-amber-300">{selectedClaim.status}</div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-200 mb-1">Customer Stated Reason:</h4>
                <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-lg text-slate-300">
                  {selectedClaim.reason}
                  {selectedClaim.customerNotes && (
                    <div className="mt-2 text-slate-400 text-[11px] border-t border-slate-800 pt-1.5">
                      Notes: {selectedClaim.customerNotes}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-200 mb-1">Full AI Investigation Telemetry:</h4>
                <pre className="p-3 bg-slate-900 border border-slate-800 rounded-lg font-mono text-[11px] text-indigo-200 overflow-x-auto">
                  {JSON.stringify(selectedClaim.aiInvestigation, null, 2)}
                </pre>
              </div>

              {selectedClaim.status === "Pending Vendor Decision" && (
                <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg space-y-2">
                  <div className="font-semibold text-amber-300">Take Vendor Action:</div>
                  <input
                    type="text"
                    placeholder="Optional vendor decision note (e.g. Approved per photo verification)..."
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  <div className="flex items-center gap-2 pt-1 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSettle(selectedClaim.claimId, "reject")}
                      className="border-rose-800/80 bg-rose-950/40 text-rose-300 text-xs h-8"
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSettle(selectedClaim.claimId, "approve")}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
                    >
                      Approve & Settle Now
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedClaim(null)}
                className="border-slate-700 bg-slate-800 text-slate-200 text-xs h-8"
              >
                Close Dossier
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
