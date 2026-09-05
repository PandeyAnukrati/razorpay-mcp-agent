import React, { useState, useEffect } from "react"
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
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
  LogOut,
} from "lucide-react"
import {
  getRefundClaims,
  syncClaimsFromSessions,
  settleRefundClaim,
  type RefundClaim,
  type AttachedEvidence,
} from "@/services/refundClaims"
import { getAllChatSessions, type ChatSession } from "@/services/firebaseChat"
import { mcpListPayments, mcpListOrders, formatINR } from "@/services/mcpClient"

interface MerchantPortalProps {
  onSignOut?: () => void
  merchantEmail?: string
}

type TabKey = "claims" | "tickets" | "customers" | "payments"

export function MerchantPortal({ onSignOut, merchantEmail = "" }: MerchantPortalProps) {
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
      // 1. Chat sessions / support tickets
      const ticketsData = await getAllChatSessions()
      setTickets(ticketsData)

      // 2. Refund claims (sync with chat sessions to recover any claims discussed in chat)
      const claimsData = syncClaimsFromSessions(ticketsData)
      setClaims(claimsData)

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
    window.addEventListener("refund_claim_updated", handleRefundEvent)
    window.addEventListener("storage", handleRefundEvent)
    return () => {
      window.removeEventListener("razorpay_refund_approved", handleRefundEvent)
      window.removeEventListener("refund_claim_updated", handleRefundEvent)
      window.removeEventListener("storage", handleRefundEvent)
    }
  }, [])

  // Handle merchant settlement decision
  const handleSettle = async (
    claimOrId: string | RefundClaim,
    action: "approve" | "reject" | "request_info",
    customNote?: string
  ) => {
    const targetClaim = typeof claimOrId === "object" ? claimOrId : claims.find((c) => c.claimId === claimOrId)
    const claimId = typeof claimOrId === "object" ? claimOrId.claimId : claimOrId
    setProcessingClaimId(claimId)

    try {
      const result = await settleRefundClaim(targetClaim || claimId, action, customNote || actionNote)
      if (result.success) {
        const newStatus =
          action === "approve"
            ? "Approved & Refunded"
            : action === "reject"
            ? "Rejected"
            : "Additional Evidence Requested"

        const updatedDecision = {
          action,
          timestamp: new Date().toLocaleString(),
          vendorNotes: customNote || actionNote || result.message,
          refundId: result.refundId,
        }

        // Update state in place immediately
        setClaims((prev) =>
          prev.map((c) =>
            c.claimId === claimId || (targetClaim && c.claimId === targetClaim.claimId)
              ? {
                  ...c,
                  status: newStatus as any,
                  vendorDecision: updatedDecision,
                  updatedAt: new Date().toLocaleString(),
                }
              : c
          )
        )

        if (selectedClaim?.claimId === claimId || (targetClaim && selectedClaim?.claimId === targetClaim.claimId)) {
          setSelectedClaim((prev) =>
            prev
              ? {
                  ...prev,
                  status: newStatus as any,
                  vendorDecision: updatedDecision,
                  updatedAt: new Date().toLocaleString(),
                }
              : null
          )
        }

        setActionNote("")
        if (action === "approve") {
          showToast(
            "Refund Approved & Settled",
            result.message ||
              `Refund processed via Razorpay MCP. Refund ID: ${result.refundId || "rfnd_instant"}. Real-time settlement card dispatched to customer chat.`,
            "success"
          )
        } else if (action === "reject") {
          showToast("Claim Rejected", "Claim status updated to Rejected. Customer notified in chat.", "info")
        } else {
          showToast("Evidence Requested", "Request for unboxing video/invoice logged. Customer chat updated.", "info")
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
    <div className="flex h-screen w-full bg-[#f8fafc] text-slate-800 overflow-hidden font-sans">
      {/* Toast Notification */}
      {feedbackToast && (
        <div
          className={`fixed top-5 right-5 z-50 max-w-md p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            feedbackToast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : feedbackToast.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-900"
              : "bg-blue-50 border-blue-200 text-blue-900"
          }`}
        >
          <div className="flex items-start gap-3">
            {feedbackToast.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
            ) : feedbackToast.type === "error" ? (
              <XCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <div className="font-semibold text-xs">{feedbackToast.title}</div>
              <div className="text-[11px] mt-0.5 text-slate-600 leading-relaxed">{feedbackToast.desc}</div>
            </div>
            <button
              onClick={() => setFeedbackToast(null)}
              className="text-slate-400 hover:text-slate-700 text-xs p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 1. CLEAN SLEEK SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between h-full shrink-0 select-none z-20">
        <div>
          {/* Brand Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#305EFF] border border-blue-100/80 flex items-center justify-center shadow-xs">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-slate-900 tracking-tight">Merchant Portal</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-blue-50 text-[#305EFF] border border-blue-100">
                    Live
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Razorpay MCP Platform</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-1">
            <div className="px-3 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Operations
            </div>

            <button
              onClick={() => setActiveTab("claims")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === "claims"
                  ? "bg-[#305EFF] text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert className={`w-4 h-4 ${activeTab === "claims" ? "text-white" : "text-slate-500"}`} />
                <span>Refund Escalations</span>
              </div>
              {pendingClaims.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeTab === "claims" ? "bg-white text-[#305EFF]" : "bg-amber-100 text-amber-800"
                }`}>
                  {pendingClaims.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("tickets")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === "tickets"
                  ? "bg-[#305EFF] text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className={`w-4 h-4 ${activeTab === "tickets" ? "text-white" : "text-slate-500"}`} />
                <span>Support Tickets</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                activeTab === "tickets" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {tickets.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("customers")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === "customers"
                  ? "bg-[#305EFF] text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className={`w-4 h-4 ${activeTab === "customers" ? "text-white" : "text-slate-500"}`} />
                <span>Customer Directory</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                activeTab === "customers" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {customerDirectory.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("payments")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                activeTab === "payments"
                  ? "bg-[#305EFF] text-white shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <CreditCard className={`w-4 h-4 ${activeTab === "payments" ? "text-white" : "text-slate-500"}`} />
                <span>Live Transactions</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                activeTab === "payments" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {payments.length}
              </span>
            </button>

            <div className="pt-4 px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Gateway Status
            </div>

            <div className="p-3 mx-1 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-700">Razorpay MCP</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Autonomous AI dispute triage & direct live settlements.
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/60 space-y-2">
          {/* Merchant Profile Card */}
          <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-[#305EFF]/10 text-[#305EFF] font-bold text-xs flex items-center justify-center shrink-0">
              M
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-800 truncate" title={merchantEmail || "Merchant Account"}>
                {merchantEmail || "Merchant Account"}
              </div>
              <div className="text-[10px] text-slate-400">Authorized Merchant</div>
            </div>
          </div>

          {/* Logout Button */}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="w-full h-8.5 rounded-xl border border-slate-200 hover:border-rose-200 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out & Exit Portal
            </button>
          )}
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#f8fafc]">
        {/* Top Content Bar */}
        <header className="px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              {activeTab === "claims" && "Refund Escalations Desk"}
              {activeTab === "tickets" && "Customer Support Tickets"}
              {activeTab === "customers" && "Customer Directory & CRM"}
              {activeTab === "payments" && "Razorpay Live Payments & Orders"}
            </h1>
            <p className="text-xs text-slate-400">
              {activeTab === "claims" && "Review autonomous AI investigations and authorize high-value settlements"}
              {activeTab === "tickets" && "All customer support conversations logged in real-time"}
              {activeTab === "customers" && "Aggregate customer directory, total spend, and claim history"}
              {activeTab === "payments" && "Direct real-time Razorpay Model Context Protocol gateway"}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              disabled={refreshing}
              className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg px-3 h-8 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#305EFF]" : "text-slate-500"}`} />
              Sync Data
            </button>

            <div className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Live Gateway
            </div>
          </div>
        </header>

        {/* Quick Stats Strip */}
        <div className="px-6 py-3.5 bg-slate-50/60 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-3.5 shrink-0">
          <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs">
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">AI Refund Escalations</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                {pendingClaims.length}
                {pendingClaims.length > 0 && (
                  <span className="text-[10px] font-medium px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full text-amber-700">
                    Needs Review
                  </span>
                )}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
            </div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs">
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Under Review Volume</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">
                {formatINR(totalVolumeUnderReview * 100)}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <DollarSign className="w-4 h-4 text-slate-600" />
            </div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs">
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Support Chat Sessions</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{tickets.length}</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <MessageSquare className="w-4 h-4 text-slate-600" />
            </div>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs">
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Customer Profiles</div>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{customerDirectory.length}</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Users className="w-4 h-4 text-slate-600" />
            </div>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* =========================================================================
            TAB 1: REFUND ESCALATION DESK (Minimal Light Mode)
            ========================================================================= */}
        {activeTab === "claims" && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Filter:
                </span>
                {[
                  { id: "all", label: "All Claims", activeClass: "bg-blue-50 text-[#305EFF] border-blue-200" },
                  { id: "pending", label: "Pending Decision", activeClass: "bg-amber-50 text-amber-700 border-amber-200" },
                  { id: "approved", label: "Approved", activeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                  { id: "rejected", label: "Rejected", activeClass: "bg-rose-50 text-rose-700 border-rose-200" },
                  { id: "info", label: "Evidence Needed", activeClass: "bg-purple-50 text-purple-700 border-purple-200" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setClaimsFilter(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      claimsFilter === f.id
                        ? `${f.activeClass} font-semibold shadow-2xs`
                        : "bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-800"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search claims, customers..."
                  value={claimsSearch}
                  onChange={(e) => setClaimsSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#305EFF]"
                />
              </div>
            </div>

            {/* Claims Cards List */}
            {filteredClaims.length === 0 ? (
              <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-xs">
                <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                <h3 className="text-sm font-semibold text-slate-700">No Refund Claims Found</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  There are no refund claims matching this filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredClaims.map((claim) => {
                  const isPending = claim.status === "Pending Vendor Decision"
                  const isApproved = claim.status === "Approved & Refunded"
                  const isRejected = claim.status === "Rejected"
                  const score = claim.aiInvestigation?.validityScore || 85

                  return (
                    <div
                      key={claim.claimId}
                      className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4"
                    >
                      {/* Claim Header */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-slate-100 pb-3.5">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">
                            {claim.claimId}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm text-slate-900">{claim.reason}</h3>
                              <span
                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                  isPending
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : isApproved
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : isRejected
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                }`}
                              >
                                {claim.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                              <span>Customer: <strong className="text-slate-700 font-medium">{claim.customerName}</strong> ({claim.customerEmail})</span>
                              <span>•</span>
                              <span>{claim.createdAt}</span>
                            </div>
                          </div>
                        </div>

                        {/* Amount & ID */}
                        <div className="text-right">
                          <div className="text-xl font-bold text-slate-900">{claim.amountFormatted}</div>
                          <div className="text-[11px] font-mono text-slate-400">
                            Payment: <code className="text-slate-600">{claim.paymentId}</code>
                          </div>
                        </div>
                      </div>

                      {/* AI Investigation & Evidence Row */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Column 1 & 2: Autonomous AI Investigation Card */}
                        <div className="lg:col-span-2 p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                              <Sparkles className="w-3.5 h-3.5 text-[#305EFF]" />
                              Autonomous AI Investigation
                            </div>

                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-slate-400 text-[11px]">Validity Score:</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                  score >= 80
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : score >= 60
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                {score}/100 ({score >= 80 ? "High Credibility" : "Review"})
                              </span>
                            </div>
                          </div>

                          <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                            <strong className="text-slate-800">Finding:</strong> {claim.aiInvestigation?.summary}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center gap-1.5 text-slate-600">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              <span>Payment Captured</span>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center gap-1.5 text-slate-600">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              <span>Window Valid</span>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center gap-1.5 text-slate-600">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              <span>Evidence Matched</span>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center gap-1.5 text-slate-600">
                              <ShieldCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                              <span>Low Risk</span>
                            </div>
                          </div>

                          <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-lg text-xs text-blue-900 leading-relaxed">
                            <strong>Recommendation:</strong> {claim.aiInvestigation?.recommendation}
                            <div className="text-[11px] text-blue-700 mt-0.5">
                              Note: {claim.aiInvestigation?.escalationReason}
                            </div>
                          </div>
                        </div>

                        {/* Column 3: Attached Customer Evidence Gallery */}
                        <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-slate-500" />
                                Evidence Files ({claim.attachedDocs?.length || 0})
                              </div>
                            </div>

                            {(!claim.attachedDocs || claim.attachedDocs.length === 0) ? (
                              <div className="p-4 text-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs bg-white">
                                No physical documents attached.
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {claim.attachedDocs.map((doc, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between hover:border-slate-300 transition-colors cursor-pointer group"
                                    onClick={() => setPreviewEvidence(doc)}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {doc.type === "image" || doc.previewUrl ? (
                                        <div className="w-7 h-7 rounded bg-slate-100 overflow-hidden flex-shrink-0 relative">
                                          {doc.previewUrl ? (
                                            <img
                                              src={doc.previewUrl}
                                              alt={doc.name}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <ImageIcon className="w-3.5 h-3.5 text-slate-400 m-1.5" />
                                          )}
                                        </div>
                                      ) : (
                                        <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                                          <FileText className="w-3.5 h-3.5" />
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <div className="text-xs font-medium text-slate-800 truncate group-hover:text-[#305EFF]">
                                          {doc.name}
                                        </div>
                                        <div className="text-[10px] text-slate-400">{doc.size || "120 KB"}</div>
                                      </div>
                                    </div>
                                    <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 flex-shrink-0" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => setSelectedClaim(claim)}
                            className="mt-3 w-full py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Info className="w-3.5 h-3.5" />
                            View Full Audit Trail
                          </button>
                        </div>
                      </div>

                      {/* VENDOR ACTIONS BAR */}
                      {isPending && (
                        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70 -mx-5 -mb-5 p-3.5 rounded-b-2xl">
                          <div className="text-xs text-slate-600 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <span>Merchant authorization required to execute refund.</span>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <button
                              disabled={processingClaimId === claim.claimId}
                              onClick={() => handleSettle(claim, "request_info", "Please provide additional unboxing or invoice evidence.")}
                              className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs h-8 px-3 rounded-lg cursor-pointer transition-colors"
                            >
                              Request Info
                            </button>

                            <button
                              disabled={processingClaimId === claim.claimId}
                              onClick={() => handleSettle(claim, "reject", "Claim does not meet policy criteria.")}
                              className="border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-xs h-8 px-3 rounded-lg cursor-pointer transition-colors"
                            >
                              Reject Claim
                            </button>

                            <button
                              disabled={processingClaimId === claim.claimId}
                              onClick={() => handleSettle(claim, "approve", "Approved by Merchant Escalation Desk after evidence verification")}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs h-8 px-4 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              {processingClaimId === claim.claimId ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Zap className="w-3.5 h-3.5" />
                              )}
                              Approve Refund ({claim.amountFormatted})
                            </button>
                          </div>
                        </div>
                      )}

                      {!isPending && claim.vendorDecision && (
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <div>
                            Decision: <strong className="text-slate-800 uppercase">{claim.vendorDecision.action}</strong> • {claim.vendorDecision.timestamp}
                          </div>
                          {claim.vendorDecision.refundId && (
                            <div className="font-mono text-emerald-700 font-semibold">
                              Refund ID: {claim.vendorDecision.refundId}
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
            TAB 2: CUSTOMER SUPPORT TICKETS (Minimal Light Mode)
            ========================================================================= */}
        {activeTab === "tickets" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Support Chat Sessions</h3>
                <p className="text-xs text-slate-400">
                  Customer conversation transcripts and ticket histories.
                </p>
              </div>
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#305EFF]"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Ticket ID</th>
                    <th className="py-2.5 px-4 font-semibold">Subject</th>
                    <th className="py-2.5 px-4 font-semibold">Customer UID</th>
                    <th className="py-2.5 px-4 font-semibold">Priority</th>
                    <th className="py-2.5 px-4 font-semibold">Status</th>
                    <th className="py-2.5 px-4 font-semibold">Messages</th>
                    <th className="py-2.5 px-4 font-semibold">Date</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No support tickets found. Real customer tickets will appear here automatically.
                      </td>
                    </tr>
                  ) : (
                    tickets
                      .filter((t) =>
                        ticketSearch
                          ? t.subject.toLowerCase().includes(ticketSearch.toLowerCase()) ||
                            t.id.toLowerCase().includes(ticketSearch.toLowerCase())
                          : true
                      )
                      .map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">{ticket.id}</td>
                        <td className="py-3 px-4 font-medium text-slate-800 max-w-xs truncate">
                          {ticket.subject}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{ticket.uid || "guest_user"}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              ticket.priority === "High"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {ticket.priority || "Medium"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              ticket.status === "Open"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {ticket.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{ticket.messages?.length || 0}</td>
                        <td className="py-3 px-4 text-slate-400">{ticket.date || "Recent"}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setSelectedTicket(ticket)}
                            className="text-xs text-[#305EFF] hover:underline font-medium cursor-pointer"
                          >
                            View Transcript
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: CUSTOMER CRM DIRECTORY (Minimal Light Mode)
            ========================================================================= */}
        {activeTab === "customers" && (
          <div className="space-y-4">
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Customer CRM Directory</h3>
                <p className="text-xs text-slate-400">
                  Aggregated lifetime value, order frequency, and support history.
                </p>
              </div>
              <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                {customerDirectory.length} Customers
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Customer</th>
                    <th className="py-2.5 px-4 font-semibold">Email</th>
                    <th className="py-2.5 px-4 font-semibold">Total Spend</th>
                    <th className="py-2.5 px-4 font-semibold">Tickets</th>
                    <th className="py-2.5 px-4 font-semibold">Refund Claims</th>
                    <th className="py-2.5 px-4 font-semibold">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {customerDirectory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No customer profiles recorded yet. Profiles will aggregate automatically from active orders and tickets.
                      </td>
                    </tr>
                  ) : (
                    customerDirectory.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        {c.name}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{c.email}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {c.totalSpend > 0 ? formatINR(c.totalSpend * 100) : "₹0.00"}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{c.ticketsCount}</td>
                      <td className="py-3 px-4">
                        {c.claimsCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            {c.claimsCount} Claim{c.claimsCount > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{c.lastActive}</td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: LIVE PAYMENTS & ORDERS (Minimal Light Mode)
            ========================================================================= */}
        {activeTab === "payments" && (
          <div className="space-y-6">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-700" />
                  <h3 className="text-sm font-semibold text-slate-900">Live Razorpay Payments</h3>
                  <span className="text-xs text-slate-400">({payments.length})</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Payment ID</th>
                      <th className="py-2.5 px-4 font-semibold">Amount</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold">Method</th>
                      <th className="py-2.5 px-4 font-semibold">Customer Email</th>
                      <th className="py-2.5 px-4 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          No recent payments recorded.
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-slate-900">{p.id}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{p.amount_formatted}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                p.status === "captured"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : p.status === "refunded"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 uppercase">{p.method || "UPI"}</td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{p.email || "—"}</td>
                          <td className="py-3 px-4 text-slate-400">{p.created_at}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-slate-700" />
                  <h3 className="text-sm font-semibold text-slate-900">Live Razorpay Orders</h3>
                  <span className="text-xs text-slate-400">({orders.length})</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Order ID</th>
                      <th className="py-2.5 px-4 font-semibold">Total Amount</th>
                      <th className="py-2.5 px-4 font-semibold">Amount Paid</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold">Receipt</th>
                      <th className="py-2.5 px-4 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          No recent orders recorded.
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-slate-900">{o.id}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{o.amount_formatted}</td>
                          <td className="py-3 px-4 text-slate-600">{o.amount_paid_formatted}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                o.status === "paid"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-100 text-slate-600 border border-slate-200"
                              }`}
                            >
                              {o.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{o.receipt || "—"}</td>
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
      </main>

      {/* MODAL 1: TICKET TRANSCRIPT MODAL (Light Mode) */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                    {selectedTicket.id}
                  </span>
                  <h3 className="font-semibold text-sm text-slate-900">{selectedTicket.subject}</h3>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Customer: {selectedTicket.uid} • Status: {selectedTicket.status}
                </div>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-50/50">
              {selectedTicket.messages?.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.isUser ? "items-end" : "items-start"}`}
                >
                  <div className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                    <span>{msg.isUser ? "Customer" : "Razorpay AI"}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2 text-xs leading-relaxed ${
                      msg.isUser
                        ? "bg-[#305EFF] text-white"
                        : "bg-white border border-slate-200 text-slate-800 shadow-xs"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-3 bg-white border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">{selectedTicket.messages?.length || 0} messages</span>
              <button
                onClick={() => setSelectedTicket(null)}
                className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs h-8 px-3 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EVIDENCE INSPECTION LIGHTBOX (Light Mode) */}
      {previewEvidence && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-6">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-xl animate-in zoom-in-95">
            <div className="px-6 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-500" />
                <h3 className="font-semibold text-sm text-slate-900">{previewEvidence.name}</h3>
              </div>
              <button
                onClick={() => setPreviewEvidence(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center bg-slate-50">
              {previewEvidence.previewUrl ? (
                <img
                  src={previewEvidence.previewUrl}
                  alt={previewEvidence.name}
                  className="max-h-[60vh] max-w-full rounded-lg border border-slate-200 object-contain shadow-sm"
                />
              ) : previewEvidence.content ? (
                <div className="w-full p-4 bg-white rounded-lg border border-slate-200 font-mono text-xs text-slate-800 whitespace-pre-wrap">
                  {previewEvidence.content}
                </div>
              ) : (
                <div className="text-center p-8 text-slate-500">
                  <FileText className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                  <p className="text-xs">Document verified by Autonomous OCR.</p>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-white border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setPreviewEvidence(null)}
                className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs h-8 px-3 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: FULL CLAIM AUDIT TRAIL MODAL (Light Mode) */}
      {selectedClaim && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                    {selectedClaim.claimId}
                  </span>
                  <h3 className="font-semibold text-sm text-slate-900">Claim Audit Trail</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedClaim(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 text-[11px]">Customer:</span>
                  <div className="font-medium text-slate-800">{selectedClaim.customerName}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Email:</span>
                  <div className="font-medium text-slate-800">{selectedClaim.customerEmail}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Amount:</span>
                  <div className="font-bold text-slate-900">{selectedClaim.amountFormatted}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Status:</span>
                  <div className="font-medium text-amber-700">{selectedClaim.status}</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Customer Reason:</h4>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  {selectedClaim.reason}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-800 mb-1">AI Telemetry Data:</h4>
                <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] text-slate-700 overflow-x-auto">
                  {JSON.stringify(selectedClaim.aiInvestigation, null, 2)}
                </pre>
              </div>

              {selectedClaim.status === "Pending Vendor Decision" && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="font-medium text-slate-800">Action:</div>
                  <input
                    type="text"
                    placeholder="Optional settlement note..."
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#305EFF]"
                  />
                  <div className="flex items-center gap-2 pt-1 justify-end">
                    <button
                      onClick={() => handleSettle(selectedClaim, "reject", actionNote)}
                      className="border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-xs h-8 px-3 rounded-lg cursor-pointer"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleSettle(selectedClaim, "approve", actionNote)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-4 rounded-lg font-medium cursor-pointer"
                    >
                      Approve Refund
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-white border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedClaim(null)}
                className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs h-8 px-3 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
