import React, { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import gsap from "gsap"
import { MessageSquare, Building2, Zap, X } from "lucide-react"

export function Landing() {
  const navigate = useNavigate()
  const landingRef = useRef<HTMLDivElement>(null)

  // Merchant Login Modal state
  const [isMerchantModalOpen, setIsMerchantModalOpen] = useState(false)
  const [merchantEmail, setMerchantEmail] = useState("merchant@razorpay.com")
  const [merchantPassword, setMerchantPassword] = useState("SuperMerchant2026!")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    if (landingRef.current) {
      gsap.fromTo(
        landingRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }
      )
    }
  }, [])

  const handleStartChat = () => {
    if (landingRef.current) {
      gsap.to(landingRef.current, {
        opacity: 0,
        y: -30,
        duration: 0.4,
        ease: "power2.in",
        onComplete: () => {
          navigate("/auth")
        },
      })
    } else {
      navigate("/auth")
    }
  }

  // 1-Click Quick Super Merchant Login
  const handleQuickSuperMerchantLogin = () => {
    localStorage.setItem("rzp_merchant_logged_in", "true")
    localStorage.setItem("rzp_merchant_email", "merchant@razorpay.com")
    localStorage.setItem("rzp_current_view", "merchant")
    setIsMerchantModalOpen(false)
    navigate("/dashboard")
  }

  // Manual Merchant Form Submit
  const handleMerchantSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!merchantEmail.trim() || !merchantPassword.trim()) {
      setErrorMsg("Please enter both email and password.")
      return
    }
    localStorage.setItem("rzp_merchant_logged_in", "true")
    localStorage.setItem("rzp_merchant_email", merchantEmail.trim())
    localStorage.setItem("rzp_current_view", "merchant")
    setIsMerchantModalOpen(false)
    navigate("/dashboard")
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center p-6 bg-[#f8fafc] dark:bg-[#070a13] text-foreground transition-colors duration-300">
      {/* Background ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[40%] left-[50%] h-[60%] w-[80%] -translate-x-[50%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(48,94,255,0.08),transparent_60%)]"></div>
      </div>

      {/* TOP BAR: Left Logo & Top-Right Merchant Login */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 sm:px-10 py-6">
        {/* Top Left Logo */}
        <div className="flex items-center gap-3">
          <img
            src="/razorpay.svg"
            alt="Razorpay Logo"
            className="h-6 w-auto dark:hidden"
          />
          <img
            src="/Untitled design (14).svg"
            alt="Razorpay Logo"
            className="hidden h-6 w-auto dark:block"
          />
        </div>

        {/* TOP RIGHT: Prominent Super Merchant Login Button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsMerchantModalOpen(true)}
            className="h-10 px-4 rounded-xl border border-amber-500/40 bg-card hover:bg-muted text-amber-500 dark:text-amber-400 font-bold text-xs shadow-md shadow-amber-500/10 flex items-center gap-2 transition-all duration-200 hover:scale-[1.03] cursor-pointer hover:border-amber-500"
          >
            <Building2 className="h-4 w-4 text-amber-500" />
            <span className="font-bold">👑 Merchant Login</span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
              Super Merchant
            </span>
          </Button>
        </div>
      </header>

      {/* Landing Card */}
      <div
        ref={landingRef}
        className="mx-auto flex w-full max-w-2xl flex-col text-center z-10 pt-10"
      >
        <span className="inline-block mx-auto mb-4 px-3 py-1 rounded-full text-xs font-semibold bg-[#305EFF]/10 text-[#305EFF] border border-[#305EFF]/20">
          Model Context Protocol • Autonomous AI Agent
        </span>

        <h1 className="bg-gradient-to-r from-foreground via-foreground/90 to-[#305EFF] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl md:text-6xl">
          Razorpay Support
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground sm:text-lg leading-relaxed">
          Search our knowledge base, explore developer docs, or connect directly with
          our autonomous Gemini AI support agents.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            onClick={handleStartChat}
            className="w-full sm:w-auto h-13 px-8 rounded-2xl bg-[#305EFF] text-base font-semibold text-white shadow-lg shadow-[#305EFF]/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-[#305EFF]/30 active:scale-[0.98] cursor-pointer"
          >
            <MessageSquare className="mr-2.5 h-5 w-5" />
            Start an agent chat
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsMerchantModalOpen(true)}
            className="w-full sm:w-auto h-13 px-6 rounded-2xl border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold text-sm transition-all duration-300 cursor-pointer"
          >
            <Building2 className="mr-2 h-4 w-4 text-amber-500" />
            Super Merchant Portal Access
          </Button>
        </div>
      </div>

      {/* SUPER MERCHANT LOGIN MODAL */}
      {isMerchantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade">
          <div className="bg-[#0f1422] border border-slate-700/80 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-100 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="border-b border-slate-800/90 px-6 py-5 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">Super Merchant Portal</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Enterprise Tier
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Customer tickets, AI refund escalation desk & live Razorpay CRM.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsMerchantModalOpen(false)
                  setErrorMsg("")
                }}
                className="h-8 w-8 rounded-full border border-slate-700 bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Seeded Super Merchant Credentials Callout */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-slate-900 border border-amber-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    👑 Seeded Super Merchant Credentials
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 font-mono">
                    Pre-configured
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Email:</span>
                    <strong className="text-slate-200">merchant@razorpay.com</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Password:</span>
                    <strong className="text-slate-200">SuperMerchant2026!</strong>
                  </div>
                </div>

                {/* 1-Click Quick Login Button */}
                <Button
                  type="button"
                  onClick={handleQuickSuperMerchantLogin}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 gap-2 mt-1 cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-slate-950 fill-current" />
                  ⚡ 1-Click Quick-Login as Super Merchant
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">or sign in manually</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                  {errorMsg}
                </div>
              )}

              {/* Manual Login Form */}
              <form onSubmit={handleMerchantSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Merchant Email
                  </label>
                  <input
                    type="email"
                    value={merchantEmail}
                    onChange={(e) => setMerchantEmail(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-700 bg-slate-950 px-4 text-xs text-white focus:outline-none focus:border-amber-400"
                    placeholder="merchant@razorpay.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={merchantPassword}
                    onChange={(e) => setMerchantPassword(e.target.value)}
                    className="w-full h-10 rounded-xl border border-slate-700 bg-slate-950 px-4 text-xs text-white focus:outline-none focus:border-amber-400"
                    placeholder="••••••••••••"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsMerchantModalOpen(false)
                      setErrorMsg("")
                    }}
                    className="border-slate-700 bg-slate-800 text-slate-300 text-xs h-9 px-4 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-5 cursor-pointer"
                  >
                    Enter Merchant Portal →
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Landing
