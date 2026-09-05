import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
// Claude commented out - pure Gemini runtime
// import { getClaudeSupportResponse } from "@/services/claude"
import { getGeminiSupportResponse } from "@/services/gemini"
import { MarkdownRenderer } from "@/components/MarkdownRenderer"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import gsap from "gsap"
import {
  LogOut,
  Send,
  Sparkles,
  ArrowLeft,
  Loader2,
  PlusCircle,
  History,
  UploadCloud,
  FileText,
  FileCode,
  FileImage,
  Paperclip,
  Trash2,
  File,
  Database,
  Copy,
  Check,
  X,
  CreditCard,
  RotateCcw,
  Receipt,
  Key,
  ShieldCheck,
  RefreshCw,
  Zap,
  Building2,
} from "lucide-react"
import { WebhookAutomationPage } from "@/components/WebhookAutomationPage"
import { MerchantPortal } from "@/components/MerchantPortal"
import { getRefundClaims } from "@/services/refundClaims"
import { getWebhookEvents } from "@/services/webhookAutomation"
import {
  getRazorpayCredentials,
  saveRazorpayCredentials,
  clearRazorpayCredentials,
  mcpListPayments,
  mcpListOrders,
  mcpGetRefunds,
  type RazorpayCredentials,
} from "@/services/mcpClient"
import {
  type ChatSession,
  type Message,
  type UploadedFile,
  getInitialDefaultSession,
  subscribeToUserSessions,
  saveSessionToFirebase,
  deleteSessionFromFirebase,
  migrateLocalStorageToFirestore,
} from "@/services/firebaseChat"

function safeStorageGet(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore quota error
  }
}

function safeStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string) || "")
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<any>(() => auth.currentUser)
  const [currentView, setCurrentView] = useState<"menu" | "chat" | "sessions-list" | "webhooks" | "merchant">(() => {
    const fromState = (location.state as any)?.view
    if (fromState === "merchant") return "merchant"
    return (safeStorageGet("rzp_current_view", "menu") as any)
  })
  const [backView, setBackView] = useState<"menu" | "sessions-list">(() => {
    const saved = safeStorageGet("rzp_back_view", "menu")
    return saved === "sessions-list" ? "sessions-list" : "menu"
  })

  // Super Merchant State & Seeded Access
  const [isMerchantLoggedIn, setIsMerchantLoggedIn] = useState<boolean>(() => {
    return safeStorageGet("rzp_merchant_logged_in", "false") === "true"
  })
  const [merchantEmail, setMerchantEmail] = useState<string>(() => {
    return safeStorageGet("rzp_merchant_email", "")
  })
  const [isMerchantModalOpen, setIsMerchantModalOpen] = useState<boolean>(false)
  const [loginEmailInput, setLoginEmailInput] = useState<string>("")
  const [loginPasswordInput, setLoginPasswordInput] = useState<string>("")
  const [loginError, setLoginError] = useState<string>("")
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return safeStorageGet("rzp_active_session_id", "") || "CHAT-MCP-01"
  })
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const cached = safeStorageGet("rzp_cached_sessions", "")
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return [getInitialDefaultSession(auth.currentUser?.uid || "guest_user")]
  })

  // Automatically keep cached sessions updated in localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      try {
        const clean = sessions.map((s) => ({
          ...s,
          files: (s.files || []).map((f) => ({ ...f, previewUrl: undefined })),
        }))
        safeStorageSet("rzp_cached_sessions", JSON.stringify(clean))
      } catch (err) {
        console.warn("Could not cache sessions locally:", err)
      }
    }
  }, [sessions])

  // Sync view when navigating with location state or storage
  useEffect(() => {
    const targetView = (location.state as any)?.view || safeStorageGet("rzp_current_view", "")
    if (targetView === "merchant" && currentView !== "merchant") {
      setIsMerchantLoggedIn(true)
      setCurrentView("merchant")
    }
  }, [location])

  // Keep navigation view and active session synced safely
  useEffect(() => {
    safeStorageSet("rzp_current_view", currentView)
  }, [currentView])

  useEffect(() => {
    safeStorageSet("rzp_back_view", backView)
  }, [backView])

  useEffect(() => {
    if (activeSessionId) {
      safeStorageSet("rzp_active_session_id", activeSessionId)
    } else {
      safeStorageRemove("rzp_active_session_id")
    }
  }, [activeSessionId])

  const [inputText, setInputText] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  // Razorpay MCP Client & Credentials State
  const [creds, setCreds] = useState<RazorpayCredentials>(getRazorpayCredentials())
  const [isKeySettingsOpen, setIsKeySettingsOpen] = useState(false)
  const [inputKeyId, setInputKeyId] = useState(creds.keyId)
  const [inputKeySecret, setInputKeySecret] = useState(creds.keySecret)
  const [keySaveMsg, setKeySaveMsg] = useState<string | null>(null)

  // Live MCP Explorer State
  const [isDataModalOpen, setIsDataModalOpen] = useState(false)
  const [datasetTab, setDatasetTab] = useState<"payments" | "orders" | "refunds">("payments")
  const [livePayments, setLivePayments] = useState<any[]>([])
  const [liveOrders, setLiveOrders] = useState<any[]>([])
  const [liveRefunds, setLiveRefunds] = useState<any[]>([])
  const [isLoadingMcp, setIsLoadingMcp] = useState(false)
  const [mcpError, setMcpError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const dashboardRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const processedWebhookIdsRef = useRef<Set<string>>(new Set())

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0]
  const activeMessages = activeSession ? activeSession.messages : []
  const activeFiles = activeSession ? activeSession.files : []

  // Load & subscribe to chat sessions in Firebase Firestore for authenticated user
  useEffect(() => {
    let unsubscribeSessions: (() => void) | undefined

    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser)

        // 1. One-time migration: migrate legacy localStorage sessions to Firestore and clear quota
        await migrateLocalStorageToFirestore(authUser.uid)

        // 2. Real-time subscription to Firestore sessions
        unsubscribeSessions = subscribeToUserSessions(
          authUser.uid,
          (loadedSessions) => {
            if (!loadedSessions || loadedSessions.length === 0) return

            setSessions((prevSessions) => {
              // Intelligent Merge: Do not let a stale remote snapshot wipe out newly sent local messages!
              const merged = loadedSessions.map((remote) => {
                const local = prevSessions.find((s) => s.id === remote.id)
                if (!local) return remote

                // If local has more messages than remote, keep local's extra messages!
                if (local.messages.length > remote.messages.length) {
                  const remoteMsgIds = new Set(remote.messages.map((m) => m.id))
                  const unsynced = local.messages.filter((m) => !remoteMsgIds.has(m.id))
                  return {
                    ...remote,
                    messages: [...remote.messages, ...unsynced],
                  }
                }
                return remote
              })

              // Preserve any newly created local sessions that haven't hit the server yet
              const remoteIds = new Set(loadedSessions.map((s) => s.id))
              const localOnlySessions = prevSessions.filter((s) => !remoteIds.has(s.id))
              return [...localOnlySessions, ...merged]
            })

            // Restore active session or pick the first available
            setActiveSessionId((prevActive) => {
              if (prevActive && loadedSessions.some((s) => s.id === prevActive)) {
                return prevActive
              }
              const savedActiveId = safeStorageGet("rzp_active_session_id", "")
              if (savedActiveId && loadedSessions.some((s) => s.id === savedActiveId)) {
                return savedActiveId
              }
              return prevActive || loadedSessions[0]?.id || "CHAT-MCP-01"
            })
          },
          (err) => {
            console.warn("Firestore subscription error, remaining in resilient local mode:", err)
          }
        )
      } else {
        if (unsubscribeSessions) unsubscribeSessions()
        setUser(null)
        // Keep existing sessions in memory/cache so chat NEVER vanishes even if logged out or guest!
      }
    })

    return () => {
      if (unsubscribeSessions) unsubscribeSessions()
      unsubscribeAuth()
    }
  }, [])

  // Listen for real-time merchant refund approval events dispatched across tabs/components
  useEffect(() => {
    const handleRefundApproved = (e: any) => {
      const detail = e.detail
      if (!detail?.claim) return
      const { claim, refundId } = detail

      setSessions((prev) =>
        prev.map((s) => {
          const isTarget =
            s.id === claim.sessionId ||
            s.messages.some((m) => m.text?.includes(claim.claimId) || m.text?.includes(claim.paymentId))
          if (!isTarget) return s

          const alreadyHasSettledMsg = s.messages.some(
            (m) => m.id === `msg-settled-${claim.claimId}` || (refundId && m.text.includes(refundId))
          )
          if (alreadyHasSettledMsg) return s

          const newMsg: Message = {
            id: `msg-settled-${claim.claimId}`,
            text: `🎉 **Merchant Authorization Approved & Refund Issued!**\n\nThe merchant has reviewed your refund claim (**${claim.claimId}**) and authorized the settlement.\n\n| Field | Settlement Details |\n| :--- | :--- |\n| **Claim Reference** | \`${claim.claimId}\` |\n| **Refund ID** | \`${refundId}\` |\n| **Payment ID** | \`${claim.paymentId}\` |\n| **Amount** | **${claim.amountFormatted}** |\n| **Status** | 🟢 **Approved & Refunded** |\n| **Settlement Mode** | ⚡ Instant Merchant Settlement |\n\nThe amount has been reversed back to your original payment method. Thank you for your patience!`,
            isUser: false,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          }

          return {
            ...s,
            status: "Resolved",
            messages: [...s.messages, newMsg],
          }
        })
      )
    }

    window.addEventListener("razorpay_refund_approved", handleRefundApproved)
    return () => {
      window.removeEventListener("razorpay_refund_approved", handleRefundApproved)
    }
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeMessages, isTyping])

  // GSAP View Transitions
  useEffect(() => {
    if (dashboardRef.current) {
      gsap.fromTo(
        dashboardRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }
      )
    }
  }, [currentView])

  // Real-time Webhook Ingestion Listener: Drops payment & order events instantly into chat
  useEffect(() => {
    let isMounted = true

    const checkNewWebhooks = async () => {
      try {
        const events = await getWebhookEvents()
        if (!isMounted || !events || events.length === 0) return

        setSessions((prev) => {
          if (!prev || prev.length === 0) return prev

          const currentSession = prev.find((s) => s.id === activeSessionId) || prev[0]
          if (!currentSession) return prev

          // Check which events are not yet in currentSession messages
          const toAdd: Message[] = []
          for (const ev of [...events].reverse()) {
            const p = ev.payload?.payload?.payment?.entity
            const o = ev.payload?.payload?.order?.entity
            const paymentId = p?.id
            const orderId = p?.order_id || o?.id

            // Check if already in this session's messages
            const alreadyInSession = currentSession.messages.some(
              (m) =>
                m.id === `wh-notice-${ev.id}` ||
                (paymentId && m.text.includes(paymentId)) ||
                (orderId && m.text.includes(orderId) && m.text.includes("Payment Confirmed")) ||
                m.text.includes(ev.id)
            )

            if (!alreadyInSession && !processedWebhookIdsRef.current.has(ev.id)) {
              processedWebhookIdsRef.current.add(ev.id)

              const isPaid = ev.event.includes("paid") || ev.event.includes("captured")
              const isFail = ev.event.includes("failed")
              const isRefund = ev.event.includes("refund")
              const isDispute = ev.event.includes("dispute")

              let messageMarkdown = ""
              const r = ev.payload?.payload?.refund?.entity
              const d = ev.payload?.payload?.dispute?.entity

              if (isPaid) {
                const amountFormatted = p?.amount
                  ? `₹${(p.amount / 100).toFixed(2)}`
                  : o?.amount
                  ? `₹${(o.amount / 100).toFixed(2)}`
                  : "₹1,499.00"

                messageMarkdown = `🎉 **Payment Confirmed via Razorpay Webhook**\n\n| Field | Value |\n|---|---|\n| **Webhook Event** | \`${ev.event}\` |\n| **Payment ID** | \`${p?.id || "pay_live_captured"}\` |\n| **Order ID** | \`${p?.order_id || o?.id || "order_TXGPnb2izSqLLF"}\` |\n| **Amount Paid** | **${amountFormatted}** |\n| **Payment Method** | ${p?.method ? p.method.toUpperCase() : "UPI / Card"} |\n| **Status** | 🟢 **Captured (Success)** |\n| **Verification** | HMAC SHA256 Signature Verified |\n\n✅ Your payment was successfully received and captured by Razorpay. Your order is now marked as **PAID**!`
              } else if (isFail) {
                const errDesc = p?.error_description || "Customer payment authorization was declined."
                const errCode = p?.error_code || "BAD_REQUEST_ERROR"
                const amountFormatted = p?.amount ? `₹${(p.amount / 100).toFixed(2)}` : "₹1,499.00"

                messageMarkdown = `🚨 **Payment Failed Alert via Razorpay Webhook**\n\n| Field | Value |\n|---|---|\n| **Webhook Event** | \`${ev.event}\` |\n| **Payment ID** | \`${p?.id || "pay_live_failed"}\` |\n| **Order ID** | \`${p?.order_id || "N/A"}\` |\n| **Amount Attempted** | ${amountFormatted} |\n| **Status** | 🔴 **Failed** |\n| **Error Code** | \`${errCode}\` |\n| **Reason** | ${errDesc} |\n\n⚠️ Would you like me to generate a new payment link or QR code to retry?`
              } else if (isRefund) {
                const amountFormatted = r?.amount ? `₹${(r.amount / 100).toFixed(2)}` : "₹499.00"
                messageMarkdown = `💸 **Refund Processed via Razorpay Webhook**\n\n| Field | Value |\n|---|---|\n| **Refund ID** | \`${r?.id || "rfnd_live"}\` |\n| **Payment ID** | \`${r?.payment_id || "N/A"}\` |\n| **Amount Refunded** | ${amountFormatted} |\n| **Status** | 🟢 **Processed** |\n\nReversal has been completed and will reflect in the customer's bank account.`
              } else if (isDispute) {
                messageMarkdown = `⚠️ **Dispute Alert via Razorpay Webhook**\n\n| Field | Value |\n|---|---|\n| **Dispute ID** | \`${d?.id || "disp_live"}\` |\n| **Payment ID** | \`${d?.payment_id || "N/A"}\` |\n| **Amount** | ₹${((d?.amount || 0) / 100).toFixed(2)} |\n| **Reason** | \`${d?.reason_code || "fraudulent"}\` |\n| **Status** | Under Review |\n\nAction required: Merchant evidence is needed before the deadline.`
              } else {
                messageMarkdown = `⚡ **Razorpay Webhook Received**\n\nEvent: \`${ev.event}\` (HMAC Verified)`
              }

              toAdd.push({
                id: `wh-notice-${ev.id}`,
                text: messageMarkdown,
                isUser: false,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })
            }
          }

          if (toAdd.length === 0) return prev

          // Switch to chat view so user immediately sees the confirmation
          setCurrentView("chat")

          const next = prev.map((s) => {
            if (s.id === currentSession.id) {
              const updated = {
                ...s,
                messages: [...s.messages, ...toAdd],
              }
              if (user?.uid) {
                saveSessionToFirebase(user.uid, updated).catch(console.error)
              }
              return updated
            }
            return s
          })
          return next
        })
      } catch (err) {
        console.warn("Webhook chat poller check error:", err)
      }
    }

    const interval = setInterval(checkNewWebhooks, 1500)
    checkNewWebhooks()

    const onPaymentSuccess = () => {
      setTimeout(checkNewWebhooks, 300)
    }
    window.addEventListener("razorpay_checkout_success", onPaymentSuccess)

    return () => {
      isMounted = false
      clearInterval(interval)
      window.removeEventListener("razorpay_checkout_success", onPaymentSuccess)
    }
  }, [activeSessionId, user])

  // Fetch live MCP data directly from Razorpay API when Explorer is opened
  const fetchLiveMcpData = async () => {
    setIsLoadingMcp(true)
    setMcpError(null)
    try {
      const pRes = await mcpListPayments({ limit: 12 })
      if (pRes.error) {
        setMcpError(pRes.error)
      } else {
        setLivePayments(pRes.payments || [])
      }

      const oRes = await mcpListOrders(12)
      if (!oRes.error) {
        setLiveOrders(oRes.orders || [])
      }

      const rRes = await mcpGetRefunds()
      if (!rRes.error) {
        setLiveRefunds(rRes.refunds || [])
      }
    } catch (err: any) {
      setMcpError(err.message || "Failed to query Razorpay API.")
    } finally {
      setIsLoadingMcp(false)
    }
  }

  useEffect(() => {
    if (isDataModalOpen) {
      fetchLiveMcpData()
    }
  }, [isDataModalOpen])

  const handleSignOut = async () => {
    try {
      await auth.signOut()
      navigate("/auth")
    } catch (err) {
      console.error("Sign out failed:", err)
    }
  }

  const handleStartNewChat = async () => {
    const currentUid = user?.uid || "guest_user"
    const newId = `CHAT-${Math.floor(1000 + Math.random() * 9000)}`
    const newSession: ChatSession = {
      id: newId,
      uid: currentUid,
      subject: "New Support Chat",
      status: "Open",
      priority: "Medium",
      date: "Today",
      messages: [
        {
          id: "init",
          text: "Hello! I am your Razorpay support agent connected to live MCP tools. What payment or order can I inspect for you?",
          isUser: false,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ],
      files: [],
    }

    setSessions((prev) => [newSession, ...prev.filter((s) => s.id !== newId)])
    setActiveSessionId(newId)
    setBackView("menu")
    setCurrentView("chat")

    if (user?.uid) {
      await saveSessionToFirebase(user.uid, newSession).catch(console.error)
    }
  }

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId)
    setBackView("sessions-list")
    setCurrentView("chat")
  }

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== sessionId)
      if (remaining.length === 0) {
        return [getInitialDefaultSession(user?.uid || "guest_user")]
      }
      return remaining
    })
    if (activeSessionId === sessionId) {
      const remaining = sessions.filter((s) => s.id !== sessionId)
      setActiveSessionId(remaining[0]?.id || "CHAT-MCP-01")
    }
    if (user?.uid) {
      await deleteSessionFromFirebase(user.uid, sessionId).catch(console.error)
    }
  }

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault()
    saveRazorpayCredentials(inputKeyId, inputKeySecret)
    const updated = getRazorpayCredentials()
    setCreds(updated)
    setKeySaveMsg("Credentials saved! Direct Razorpay MCP active.")
    setTimeout(() => {
      setKeySaveMsg(null)
      setIsKeySettingsOpen(false)
      fetchLiveMcpData()
    }, 1500)
  }

  const handleClearKeys = () => {
    clearRazorpayCredentials()
    setInputKeyId("")
    setInputKeySecret("")
    setCreds(getRazorpayCredentials())
    setLivePayments([])
    setLiveOrders([])
    setLiveRefunds([])
    setKeySaveMsg("Credentials cleared.")
    setTimeout(() => setKeySaveMsg(null), 2000)
  }

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleQuickAsk = (question: string) => {
    setInputText(question)
    setIsDataModalOpen(false)
    if (currentView !== "chat") {
      if (sessions.length > 0) {
        setActiveSessionId(sessions[0].id)
        setCurrentView("chat")
      } else {
        handleStartNewChat()
      }
    }
  }

  const handleOpenMerchantPortal = () => {
    if (isMerchantLoggedIn) {
      setCurrentView("merchant")
    } else {
      setIsMerchantModalOpen(true)
    }
  }

  const handleMerchantFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!loginEmailInput || !loginEmailInput.trim()) {
      setLoginError("Please enter your merchant email address.")
      return
    }
    const email = loginEmailInput.trim()
    setIsMerchantLoggedIn(true)
    setMerchantEmail(email)
    safeStorageSet("rzp_merchant_logged_in", "true")
    safeStorageSet("rzp_merchant_email", email)
    safeStorageSet("rzp_current_view", "merchant")
    setIsMerchantModalOpen(false)
    setLoginError("")
    setCurrentView("merchant")
  }

  const handleGoBack = () => {
    if (currentView === "chat") {
      if (backView === "sessions-list") {
        setCurrentView("sessions-list")
        setBackView("menu")
      } else {
        setCurrentView("menu")
        setBackView("menu")
      }
      return
    }

    if (currentView === "webhooks") {
      setCurrentView("menu")
      setBackView("menu")
      return
    }

    if (currentView === "sessions-list") {
      setCurrentView("menu")
      setBackView("menu")
      return
    }

    setCurrentView("menu")
    setBackView("menu")
  }

  const handleSendAutomationAlert = (text: string) => {
    const alertMsg: Message = {
      id: `wh-alert-${Date.now()}`,
      text: `⚡ **Automated Webhook Event Triage**\n\n${text}`,
      isUser: false,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }
    setSessions((prev) => {
      const targetId = activeSessionId || prev[0]?.id || "CHAT-MCP-01"
      let alertSession: ChatSession | undefined
      const next = prev.map((s) => {
        if (s.id === targetId) {
          alertSession = {
            ...s,
            messages: [...s.messages, alertMsg],
          }
          return alertSession
        }
        return s
      })
      if (user?.uid && alertSession) {
        saveSessionToFirebase(user.uid, alertSession).catch(console.error)
      }
      return next
    })
    setCurrentView("chat")
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return

    const targetSessionId = activeSessionId || sessions[0]?.id || "CHAT-MCP-01"
    if (!activeSessionId) {
      setActiveSessionId(targetSessionId)
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }

    const currentMessages = activeMessages
    const currentSubject = activeSession?.subject || "New Support Chat"
    const updatedSubject =
      currentSubject === "New Support Chat"
        ? userMsg.text.length > 35
          ? userMsg.text.substring(0, 35) + "..."
          : userMsg.text
        : currentSubject

    // Update session state & Firebase Firestore
    let userSessionToSave: ChatSession | undefined
    let hasUpdated = false
    const updatedWithUser = sessions.map((s) => {
      if (s.id === targetSessionId) {
        hasUpdated = true
        userSessionToSave = {
          ...s,
          subject: updatedSubject,
          messages: [...s.messages, userMsg],
        }
        return userSessionToSave
      }
      return s
    })

    if (!hasUpdated) {
      userSessionToSave = {
        id: targetSessionId,
        uid: user?.uid || "guest_user",
        subject: updatedSubject,
        status: "Open",
        priority: "Medium",
        date: "Today",
        messages: [userMsg],
        files: [],
      }
      setSessions([userSessionToSave, ...sessions])
    } else {
      setSessions(updatedWithUser)
    }

    if (user?.uid && userSessionToSave) {
      saveSessionToFirebase(user.uid, userSessionToSave).catch(console.error)
    }

    setInputText("")
    setIsTyping(true)

    try {
      // Pure Google Gemini 2.5 Flash with Razorpay MCP tool calling
      const reply = await getGeminiSupportResponse(
        userMsg.text,
        currentMessages,
        activeFiles.map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
          content: f.content,
        }))
      )
      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: reply,
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }

      let agentSessionToSave: ChatSession | undefined
      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id === targetSessionId) {
            agentSessionToSave = {
              ...s,
              messages: [...s.messages, agentMsg],
            }
            return agentSessionToSave
          }
          return s
        })
        if (user?.uid && agentSessionToSave) {
          saveSessionToFirebase(user.uid, agentSessionToSave).catch(console.error)
        }

        if (
          reply.includes("Forwarded to Merchant Portal") ||
          reply.includes("dispatched directly to the merchant's escalation desk") ||
          reply.includes("Escalation Status") ||
          reply.includes("REF-CLAIM")
        ) {
          setTimeout(() => getRefundClaims(), 50)
        }

        return next
      })
    } catch (err: any) {
      console.error("Gemini / MCP error:", err)
      const fallbackReply = `⚠️ Razorpay MCP Response: ${
        err.message || "Please verify your Razorpay Key ID and Secret in MCP Settings."
      }`
      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: fallbackReply,
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }
      let fallbackSessionToSave: ChatSession | undefined
      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id === targetSessionId) {
            fallbackSessionToSave = {
              ...s,
              messages: [...s.messages, agentMsg],
            }
            return fallbackSessionToSave
          }
          return s
        })
        if (user?.uid && fallbackSessionToSave) {
          saveSessionToFirebase(user.uid, fallbackSessionToSave).catch(console.error)
        }
        return next
      })
    } finally {
      setIsTyping(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    const targetSessionId = activeSessionId || sessions[0]?.id || "CHAT-MCP-01"
    if (!fileList) return

    const filesArray = Array.from(fileList)

    for (const file of filesArray) {
      const sizeInMB = file.size / (1024 * 1024)
      const sizeStr =
        sizeInMB < 0.1
          ? `${Math.round(file.size / 1024)} KB`
          : `${sizeInMB.toFixed(1)} MB`

      let fileType: "image" | "pdf" | "code" | "other" = "other"
      if (file.type.startsWith("image/")) fileType = "image"
      else if (file.type === "application/pdf") fileType = "pdf"
      else if (
        file.name.endsWith(".json") ||
        file.name.endsWith(".xml") ||
        file.name.endsWith(".log") ||
        file.name.endsWith(".txt") ||
        file.name.endsWith(".csv") ||
        file.name.endsWith(".js") ||
        file.name.endsWith(".ts")
      ) {
        fileType = "code"
      }

      const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      let fileContent: string | undefined = undefined
      let previewUrl: string | undefined = undefined

      try {
        if (
          fileType === "code" ||
          file.type.startsWith("text/") ||
          file.name.endsWith(".log") ||
          file.name.endsWith(".json") ||
          file.name.endsWith(".csv") ||
          file.name.endsWith(".txt")
        ) {
          const rawText = await readFileAsText(file)
          fileContent =
            rawText.length > 25000
              ? rawText.substring(0, 25000) + "\n...[truncated]"
              : rawText
        } else if (fileType === "image") {
          try {
            previewUrl = URL.createObjectURL(file)
          } catch {
            // fallback
          }
          fileContent = `[Image evidence attached: ${file.name}, size: ${sizeStr}]`
        } else {
          try {
            const rawText = await readFileAsText(file)
            fileContent =
              rawText.length > 25000
                ? rawText.substring(0, 25000) + "\n...[truncated]"
                : rawText
          } catch {
            fileContent = `[Document evidence attached: ${file.name}, size: ${sizeStr}]`
          }
        }
      } catch (err) {
        console.warn("Could not read file content:", err)
        fileContent = `[File attached: ${file.name}, size: ${sizeStr}]`
      }

      const newFile: UploadedFile = {
        id: fileId,
        name: file.name,
        size: sizeStr,
        type: fileType,
        status: "Uploaded",
        previewUrl,
        content: fileContent,
      }

      const noticeMsg: Message = {
        id: `notice-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        text: `📎 **Evidence detected:** \`${file.name}\` (${sizeStr})\n\nI have analyzed and loaded this document into our conversation context. You may now continue the chat and ask questions based on this evidence.`,
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }

      let fileSessionToSave: ChatSession | undefined
      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id === targetSessionId) {
            fileSessionToSave = {
              ...s,
              files: [...s.files, newFile],
              messages: [...s.messages, noticeMsg],
            }
            return fileSessionToSave
          }
          return s
        })
        if (user?.uid && fileSessionToSave) {
          saveSessionToFirebase(user.uid, fileSessionToSave).catch(console.error)
        }
        return next
      })
    }

    if (e.target) e.target.value = ""
  }

  const handleDeleteFile = (fileId: string) => {
    const targetSessionId = activeSessionId || sessions[0]?.id || "CHAT-MCP-01"
    let deletedFileSession: ChatSession | undefined
    setSessions((prev) => {
      const next = prev.map((s) => {
        if (s.id === targetSessionId) {
          deletedFileSession = { ...s, files: s.files.filter((f) => f.id !== fileId) }
          return deletedFileSession
        }
        return s
      })
      if (user?.uid && deletedFileSession) {
        saveSessionToFirebase(user.uid, deletedFileSession).catch(console.error)
      }
      return next
    })
  }

  const getFileIcon = (type: "image" | "pdf" | "code" | "other") => {
    switch (type) {
      case "image":
        return <FileImage className="h-4.5 w-4.5 text-[#305EFF]" />
      case "pdf":
        return <FileText className="h-4.5 w-4.5 text-rose-500" />
      case "code":
        return <FileCode className="h-4.5 w-4.5 text-amber-500" />
      default:
        return <File className="h-4.5 w-4.5 text-slate-500" />
    }
  }

  // Dedicated Merchant Portal View - Completely isolates Merchant from Customer Chat
  if (isMerchantLoggedIn || currentView === "merchant") {
    return (
      <MerchantPortal
        merchantEmail={merchantEmail}
        onSignOut={() => {
          setIsMerchantLoggedIn(false)
          safeStorageRemove("rzp_merchant_logged_in")
          safeStorageRemove("rzp_merchant_email")
          safeStorageSet("rzp_current_view", "menu")
          navigate("/")
        }}
      />
    )
  }

  return (
    <div
      ref={dashboardRef}
      className={`w-full bg-[#f8fafc] dark:bg-[#070a13] text-foreground transition-colors duration-300 flex flex-col ${
        currentView === "chat" || currentView === "webhooks"
          ? "h-screen max-h-screen overflow-hidden"
          : "min-h-svh"
      }`}
    >
      {/* 1. HEADER */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/80 backdrop-blur-md h-16 shrink-0">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {currentView !== "menu" && (
              <button
                type="button"
                onClick={handleGoBack}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground transition-all duration-200 hover:bg-muted/70 shadow-xs cursor-pointer shrink-0"
                title="Go Back"
              >
                <ArrowLeft className="h-4.5 w-4.5" />
              </button>
            )}
            <div
              onClick={() => {
                setCurrentView("menu")
                setBackView("menu")
              }}
              className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
              title="Return to Main Menu"
            >
              <img
                src="/razorpay.svg"
                alt="Razorpay Logo"
                className="h-5 w-auto dark:hidden"
              />
              <img
                src="/Untitled design (14).svg"
                alt="Razorpay Logo"
                className="hidden h-5 w-auto dark:block"
              />
              <span className="hidden sm:inline-flex rounded-full bg-[#305EFF]/10 px-2.5 py-0.5 text-xs font-semibold text-[#305EFF]">
                MCP Agent Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Direct MCP Status & Settings Button */}
            <Button
              variant="outline"
              onClick={() => setIsKeySettingsOpen(true)}
              className={`h-9 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all duration-200 ${
                creds.isConfigured
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              <Key className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {creds.isConfigured ? "MCP Live Connected" : "Configure MCP Keys"}
              </span>
              <span
                className={`h-2 w-2 rounded-full ${
                  creds.isConfigured ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              ></span>
            </Button>

            {/* Live MCP Explorer Button */}
            <Button
              variant="outline"
              onClick={() => setIsDataModalOpen(true)}
              className="h-9 rounded-xl border-[#305EFF]/30 bg-[#305EFF]/5 hover:bg-[#305EFF]/10 text-xs font-bold text-[#305EFF] flex items-center gap-2 transition-all duration-200"
            >
              <Database className="h-3.5 w-3.5 text-[#305EFF]" />
              <span className="hidden sm:inline">Live Razorpay API</span>
              <span className="sm:hidden">API Data</span>
            </Button>

            {/* Webhook Automations Engine Button */}
            <Button
              variant="outline"
              onClick={() => {
                if (currentView !== "webhooks") {
                  setCurrentView("webhooks")
                } else {
                  setCurrentView("menu")
                }
              }}
              className={`h-9 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all duration-200 ${
                currentView === "webhooks"
                  ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                  : "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Webhook Automations</span>
              <span className="md:hidden">Webhooks</span>
            </Button>

            {/* Merchant Portal Button */}
            <Button
              variant="outline"
              onClick={handleOpenMerchantPortal}
              className="h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs hover:border-slate-300 text-xs font-medium flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
            >
              <Building2 className="h-3.5 w-3.5 text-[#305EFF]" />
              <span className="hidden lg:inline">Merchant Login</span>
              <span className="lg:hidden">Merchant</span>
            </Button>

            <Button
              variant="outline"
              onClick={handleSignOut}
              className="h-9 rounded-xl border-border bg-card hover:bg-muted text-xs font-semibold text-foreground"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* 2. BODY CONTENT ROUTING */}
      {currentView === "menu" && (
        <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 max-w-4xl mx-auto w-full">
          <div className="text-center space-y-3 mb-12">
            <span className="text-[11px] font-extrabold tracking-widest text-[#305EFF] uppercase bg-[#305EFF]/10 px-3 py-1 rounded-full">
              Model Context Protocol (Pure API)
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Razorpay Intelligent Support Agent
            </h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Direct live connection to Razorpay's API via standardized MCP tools.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
            {/* Card 1: Start New Chat */}
            <div
              onClick={handleStartNewChat}
              className="group relative flex flex-col justify-between p-8 rounded-3xl border border-border/80 bg-card hover:border-[#305EFF]/50 shadow-sm hover:shadow-xl hover:shadow-[#305EFF]/5 transition-all duration-300 cursor-pointer overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#305EFF]/5 rounded-full blur-2xl group-hover:bg-[#305EFF]/10 transition-all duration-300 pointer-events-none" />
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#305EFF]/10 text-[#305EFF] mb-6 group-hover:scale-105 transition-transform duration-200">
                  <PlusCircle className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">New Support Request</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ask questions about any payment ID, customer charge, or refund status directly.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-xs font-bold text-[#305EFF]">
                <span>Launch Assistant</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

            {/* Card 2: Previous Requests */}
            <div
              onClick={() => setCurrentView("sessions-list")}
              className="group relative flex flex-col justify-between p-8 rounded-3xl border border-border/80 bg-card hover:border-[#305EFF]/50 shadow-sm hover:shadow-xl hover:shadow-[#305EFF]/5 transition-all duration-300 cursor-pointer overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 rounded-full blur-2xl group-hover:bg-slate-500/10 transition-all duration-300 pointer-events-none" />
              <div>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-6 group-hover:scale-105 transition-transform duration-200">
                  <History className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Previous Requests</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Browse previous conversations and inspect resolved queries.
                </p>
              </div>
              <div className="mt-8 flex items-center justify-between text-xs font-bold text-muted-foreground group-hover:text-foreground">
                <span>View {sessions.length} Saved Chats</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>

          </div>
        </main>
      )}

      {currentView === "chat" && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-4rem)] min-h-0 overflow-hidden box-border">
          {/* LEFT 2 COLS: CHAT CONSOLE */}
          <div className="lg:col-span-2 flex flex-col h-full min-h-0 bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="border-b border-border/80 px-6 py-4 flex items-center justify-between bg-muted/20 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className={`h-2.5 w-2.5 rounded-full ${creds.isConfigured ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></div>
                <h3 className="font-bold text-sm">
                  {activeSession ? activeSession.subject : "Agent Chat Console"}
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-[#305EFF]" /> Pure MCP Live Tools
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-muted/5 min-h-0 scrollbar-hide">
              {activeMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.isUser ? "max-w-[75%] self-end items-end" : "max-w-[85%] self-start items-start"
                  }`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.isUser
                        ? "bg-[#305EFF] text-white rounded-tr-none"
                        : "bg-muted/40 border border-border/60 text-foreground rounded-tl-none shadow-xs"
                    }`}
                  >
                    {msg.isUser ? (
                      msg.text
                    ) : (
                      <MarkdownRenderer content={msg.text} />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 font-semibold mt-1 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              ))}

              {isTyping && (
                <div className="self-start flex flex-col items-start max-w-[75%]">
                  <div className="rounded-2xl rounded-tl-none border border-border/60 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#305EFF]" />
                    <span>Querying Razorpay API via MCP...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Test Prompt Chips */}
            <div className="px-5 pt-3 pb-2 border-t border-border/40 bg-muted/10 flex items-center gap-2 overflow-x-auto scrollbar-hide text-xs shrink-0">
              <span className="text-[10px] font-extrabold uppercase text-muted-foreground/70 shrink-0 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-[#305EFF]" /> Quick MCP:
              </span>
              <button
                type="button"
                onClick={() => setInputText("List my recent payments and their current statuses")}
                className="shrink-0 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-[#305EFF] hover:text-[#305EFF] transition-colors"
              >
                💳 List Recent Payments
              </button>
              <button
                type="button"
                onClick={() => setInputText("Show me recent orders and amounts")}
                className="shrink-0 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-blue-500 hover:text-blue-500 transition-colors"
              >
                📦 Recent Orders
              </button>
              <button
                type="button"
                onClick={() => setInputText("Are there any refunds processed on my account?")}
                className="shrink-0 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-purple-500 hover:text-purple-500 transition-colors"
              >
                🔄 Check Refunds
              </button>
              <button
                type="button"
                onClick={() => setInputText("What is the status of my payouts and bank settlements?")}
                className="shrink-0 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-emerald-500 hover:text-emerald-500 transition-colors"
              >
                🏦 Settlements
              </button>
              <button
                type="button"
                onClick={() => setInputText("What is the status of unpaid order order_TXfhmQiRp3WqK7?")}
                className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                🔍 Inspect Unpaid Order
              </button>
              <button
                type="button"
                onClick={() => setInputText("Generate a payment link and QR code to pay for order_TXfhmQiRp3WqK7")}
                className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                ⚡ Pay Order (Link & QR)
              </button>
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t border-border/80 bg-background/50 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                placeholder="Ask about any payment ID, order ID, or refund status..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isTyping}
                className="flex-1 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground/60 text-foreground"
              />
              <Button
                type="submit"
                disabled={!inputText.trim() || isTyping}
                className="h-10 w-10 rounded-2xl bg-[#305EFF] text-white hover:bg-[#305EFF]/90 flex items-center justify-center p-0 transition-transform active:scale-95 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>

          {/* RIGHT 1 COL: ATTACHED EVIDENCE (FIXED SIDEBAR) */}
          <div className="flex flex-col h-full min-h-0 bg-card border border-border rounded-3xl overflow-hidden shadow-sm shrink-0">
            <div className="border-b border-border/80 px-6 py-4 flex items-center justify-between bg-muted/20 shrink-0">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-[#305EFF]" />
                <h4 className="font-bold text-sm">Attached Evidence</h4>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                {activeFiles.length} files
              </span>
            </div>

            <div className="p-4 border-b border-border/60 bg-muted/5 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/80 hover:border-[#305EFF]/50 rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 bg-background/50 hover:bg-[#305EFF]/5 group"
              >
                <UploadCloud className="h-6 w-6 text-muted-foreground group-hover:text-[#305EFF] mb-2 transition-colors" />
                <p className="text-xs font-bold text-foreground">Click to attach logs or receipts</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">PNG, PDF, JSON up to 10MB</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5 min-h-0 scrollbar-hide">
              {activeFiles.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground/60">
                  <FileText className="h-8 w-8 mb-2 stroke-1" />
                  <p className="text-xs font-semibold">No files attached yet</p>
                  <p className="text-[10px] mt-1 max-w-[180px]">
                    Upload transaction receipts, logs, or error traces.
                  </p>
                </div>
              ) : (
                activeFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 rounded-2xl border border-border/70 bg-background/60 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                        {getFileIcon(file.type)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate max-w-[140px]">
                          {file.name}
                        </p>
                        <span className="text-[10px] text-muted-foreground">{file.size}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteFile(file.id)}
                      className="text-muted-foreground/60 hover:text-destructive p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      )}

      {currentView === "sessions-list" && (
        <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">Support Requests</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Saved conversations on this device ({sessions.length} chats)
              </p>
            </div>
            <Button
              onClick={handleStartNewChat}
              className="h-10 rounded-2xl bg-[#305EFF] text-white hover:bg-[#305EFF]/90 text-xs font-bold gap-2 px-4 shadow-sm"
            >
              <PlusCircle className="h-4 w-4" /> New Request
            </Button>
          </div>

          <div className="flex-1 bg-card border border-border rounded-3xl overflow-hidden shadow-sm flex flex-col">
            <div className="divide-y divide-border/60 overflow-y-auto">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 hover:bg-muted/30 cursor-pointer transition-colors duration-200"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[#305EFF]">{session.id}</span>
                      <span className="rounded-full bg-emerald-500/10 text-emerald-500 px-2 py-0.5 text-[9px] font-extrabold uppercase">
                        {session.status}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-foreground group-hover:text-[#305EFF] transition-colors">
                      {session.subject}
                    </h4>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground font-semibold">
                      {session.messages.length} messages
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      className="text-muted-foreground hover:text-rose-500 p-2 rounded-xl hover:bg-rose-500/10 transition-colors"
                      title="Delete Session"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* 2.4 WEBHOOK AUTOMATION FULL PAGE */}
      {currentView === "webhooks" && (
        <WebhookAutomationPage onSendToChat={handleSendAutomationAlert} />
      )}


      {/* 3. LIVE RAZORPAY MCP EXPLORER MODAL */}
      {isDataModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade">
          <div className="bg-card border border-border rounded-3xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="border-b border-border/80 px-6 py-5 flex items-center justify-between bg-muted/20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#305EFF]/10 text-[#305EFF]">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-foreground">Razorpay Live API Explorer</h3>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        creds.isConfigured
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-amber-500/10 text-amber-500"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          creds.isConfigured ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                        }`}
                      ></span>
                      {creds.isConfigured ? "Live Direct API" : "Keys Not Set"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Data queried live from api.razorpay.com using Model Context Protocol tools.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchLiveMcpData}
                  disabled={isLoadingMcp}
                  className="h-8 rounded-xl text-xs font-bold gap-1.5 px-3 border-border bg-card hover:bg-muted"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingMcp ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsDataModalOpen(false)
                    setIsKeySettingsOpen(true)
                  }}
                  className="h-8 rounded-xl text-xs font-bold gap-1.5 px-3 border-border bg-card hover:bg-muted"
                >
                  <Key className="h-3.5 w-3.5 text-[#305EFF]" />
                  <span>Keys</span>
                </Button>
                <button
                  onClick={() => setIsDataModalOpen(false)}
                  className="h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="px-6 py-3 border-b border-border/60 bg-muted/10 flex items-center gap-2 shrink-0">
              <button
                onClick={() => setDatasetTab("payments")}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  datasetTab === "payments"
                    ? "bg-[#305EFF] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <CreditCard className="h-3.5 w-3.5" /> Payments ({livePayments.length})
              </button>
              <button
                onClick={() => setDatasetTab("orders")}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  datasetTab === "orders"
                    ? "bg-[#305EFF] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Receipt className="h-3.5 w-3.5" /> Orders ({liveOrders.length})
              </button>
              <button
                onClick={() => setDatasetTab("refunds")}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  datasetTab === "refunds"
                    ? "bg-[#305EFF] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Refunds ({liveRefunds.length})
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-0 scrollbar-hide">
              {mcpError && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-600 dark:text-amber-400">
                  <p className="font-bold">Razorpay Notice:</p>
                  <p className="mt-0.5">{mcpError}</p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsDataModalOpen(false)
                      setIsKeySettingsOpen(true)
                    }}
                    className="mt-3 h-7 text-xs bg-[#305EFF] text-white rounded-lg px-3 font-bold"
                  >
                    Open API Key Settings
                  </Button>
                </div>
              )}

              {isLoadingMcp ? (
                <div className="py-16 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-[#305EFF]" />
                  <p className="text-xs font-semibold">Connecting to api.razorpay.com...</p>
                </div>
              ) : (
                <>
                  {datasetTab === "payments" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {livePayments.length === 0 && !mcpError ? (
                        <div className="col-span-2 py-12 text-center text-xs text-muted-foreground">
                          No payments found on this account yet.
                        </div>
                      ) : (
                        livePayments.map((p) => (
                          <div
                            key={p.id}
                            className="border border-border/70 bg-muted/10 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-[#305EFF]/40 transition-colors"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-xs font-extrabold text-foreground">
                                    {p.id}
                                  </span>
                                  <button
                                    onClick={() => handleCopyId(p.id)}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    {copiedId === p.id ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                    p.status === "captured"
                                      ? "bg-emerald-500/10 text-emerald-500"
                                      : p.status === "failed"
                                      ? "bg-rose-500/10 text-rose-500"
                                      : "bg-purple-500/10 text-purple-500"
                                  }`}
                                >
                                  {p.status}
                                </span>
                              </div>
                              <p className="text-base font-extrabold text-foreground mt-2">
                                {p.amount_formatted}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Method: <span className="uppercase font-semibold">{p.method}</span> •{" "}
                                {p.customer_email || "Customer"}
                              </p>
                              {p.error && (
                                <p className="text-[10px] text-rose-500 mt-1 font-semibold">
                                  Error: {p.error}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleQuickAsk(`Can you check the details of payment ${p.id}?`)}
                              className="h-8 rounded-xl text-xs font-bold text-[#305EFF] border-[#305EFF]/30 hover:bg-[#305EFF]/10"
                            >
                              <Sparkles className="mr-1 h-3.5 w-3.5" /> Ask AI About Payment
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {datasetTab === "orders" && (
                    <div className="space-y-3">
                      {liveOrders.length === 0 && !mcpError ? (
                        <div className="py-12 text-center text-xs text-muted-foreground">
                          No orders created yet.
                        </div>
                      ) : (
                        liveOrders.map((o) => (
                          <div
                            key={o.id}
                            className="border border-border/70 bg-muted/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-extrabold text-foreground">{o.id}</span>
                                <span className="rounded-full bg-blue-500/10 text-blue-500 px-2 py-0.5 text-[10px] font-extrabold uppercase">
                                  {o.status}
                                </span>
                              </div>
                              <p className="text-sm font-extrabold text-foreground mt-1">
                                {o.amount_formatted} (Paid: {o.amount_paid_formatted})
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleQuickAsk(`What is the current status of order ${o.id}?`)}
                              className="h-8 rounded-xl text-xs font-bold text-[#305EFF] border-[#305EFF]/30 hover:bg-[#305EFF]/10"
                            >
                              <Sparkles className="mr-1 h-3.5 w-3.5" /> Ask AI
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {datasetTab === "refunds" && (
                    <div className="space-y-3">
                      {liveRefunds.length === 0 && !mcpError ? (
                        <div className="py-12 text-center text-xs text-muted-foreground">
                          No refunds on file.
                        </div>
                      ) : (
                        liveRefunds.map((r) => (
                          <div
                            key={r.id}
                            className="border border-border/70 bg-muted/10 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div>
                              <span className="font-mono text-xs font-extrabold text-purple-500">{r.id}</span>
                              <p className="text-sm font-extrabold text-foreground mt-1">
                                {r.amount_formatted} for payment {r.payment_id}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleQuickAsk(`Verify refund ${r.id} on payment ${r.payment_id}`)}
                              className="h-8 rounded-xl text-xs font-bold text-[#305EFF] border-[#305EFF]/30 hover:bg-[#305EFF]/10"
                            >
                              <Sparkles className="mr-1 h-3.5 w-3.5" /> Ask AI
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. RAZORPAY API KEYS & MCP SETTINGS MODAL */}
      {isKeySettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade">
          <div className="bg-card border border-border rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="border-b border-border/80 px-6 py-5 flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground">Razorpay API Credentials</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Direct Model Context Protocol</p>
                </div>
              </div>
              <button
                onClick={() => setIsKeySettingsOpen(false)}
                className="h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {keySaveMsg && (
              <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <Check className="h-4 w-4" /> {keySaveMsg}
              </div>
            )}

            <form onSubmit={handleSaveKeys} className="p-6 space-y-4">
              <div className="rounded-2xl border border-border/70 bg-muted/10 p-4 text-xs text-muted-foreground leading-relaxed space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span>Pure Live MCP Protocol</span>
                </div>
                <p>
                  Zero database caching or mock datasets. All tools communicate directly with
                  Razorpay's API. Paste your Test Key (`rzp_test_...`) and Key Secret from your{" "}
                  <a
                    href="https://dashboard.razorpay.com/app/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#305EFF] underline font-bold"
                  >
                    Razorpay Dashboard
                  </a>
                  .
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Razorpay Key ID
                </label>
                <input
                  type="text"
                  placeholder="rzp_test_xxxxxxxxxxxxxx"
                  value={inputKeyId}
                  onChange={(e) => setInputKeyId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border bg-card px-4 text-xs font-mono outline-none focus:border-[#305EFF] text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Razorpay Key Secret
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••••••••••••••"
                  value={inputKeySecret}
                  onChange={(e) => setInputKeySecret(e.target.value)}
                  className="w-full h-11 rounded-xl border border-border bg-card px-4 text-xs font-mono outline-none focus:border-[#305EFF] text-foreground"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                {creds.isConfigured ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClearKeys}
                    className="h-10 rounded-xl border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-bold px-4"
                  >
                    Clear Keys
                  </Button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    Enter keys to enable live queries
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsKeySettingsOpen(false)}
                    className="h-10 rounded-xl text-xs font-bold px-4"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="h-10 rounded-xl bg-[#305EFF] text-white hover:bg-[#305EFF]/90 text-xs font-bold px-5"
                  >
                    Save Credentials
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MERCHANT LOGIN MODAL - MINIMAL LIGHT MODE */}
      {isMerchantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-fade">
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl max-w-md w-full overflow-hidden text-slate-800 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#305EFF] border border-blue-100/60">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Merchant Portal</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-[#305EFF] border border-blue-100">
                      Standard
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Customer tickets, refund claims & live Razorpay CRM.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsMerchantModalOpen(false)
                  setLoginError("")
                }}
                className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {loginError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-600">
                  {loginError}
                </div>
              )}

              {/* Merchant Login Form */}
              <form onSubmit={handleMerchantFormSubmit} autoComplete="off" className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Merchant Email
                  </label>
                  <input
                    type="email"
                    name="merchant_login_email"
                    autoComplete="off"
                    value={loginEmailInput}
                    onChange={(e) => setLoginEmailInput(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#305EFF] focus:ring-1 focus:ring-[#305EFF]"
                    placeholder="merchant@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    name="merchant_login_password"
                    autoComplete="current-password"
                    value={loginPasswordInput}
                    onChange={(e) => setLoginPasswordInput(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#305EFF] focus:ring-1 focus:ring-[#305EFF]"
                    placeholder="••••••••••••"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMerchantModalOpen(false)
                      setLoginError("")
                    }}
                    className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs h-9 px-3.5 rounded-lg cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    onClick={handleMerchantFormSubmit}
                    className="bg-[#305EFF] hover:bg-[#254bdb] text-white font-medium text-xs h-9 px-4 rounded-lg shadow-sm cursor-pointer transition-colors"
                  >
                    Enter Merchant Portal →
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
