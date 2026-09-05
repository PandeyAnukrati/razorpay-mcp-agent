import React, { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import gsap from "gsap"
import { MessageSquare, Building2, X } from "lucide-react"

export function Landing() {
  const navigate = useNavigate()
  const landingRef = useRef<HTMLDivElement>(null)

  // Merchant Login Modal state
  const [isMerchantModalOpen, setIsMerchantModalOpen] = useState(false)
  const [merchantEmail, setMerchantEmail] = useState("")
  const [merchantPassword, setMerchantPassword] = useState("")
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

  // Merchant Form Submit
  const handleMerchantSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!merchantEmail || !merchantEmail.trim()) {
      setErrorMsg("Please enter your merchant email address.")
      return
    }
    const email = merchantEmail.trim()
    try {
      localStorage.setItem("rzp_merchant_logged_in", "true")
      localStorage.setItem("rzp_merchant_email", email)
      localStorage.setItem("rzp_current_view", "merchant")
    } catch {}
    setIsMerchantModalOpen(false)
    navigate("/dashboard", { state: { view: "merchant" } })
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center p-6 bg-[#f8fafc] text-slate-900 transition-colors duration-300 font-sans">
      {/* Background subtle ambient effect */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[40%] left-[50%] h-[60%] w-[80%] -translate-x-[50%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(48,94,255,0.06),transparent_70%)]"></div>
      </div>

      {/* TOP BAR: Left Logo & Top-Right Merchant Login */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 sm:px-10 py-6">
        {/* Top Left Logo */}
        <div className="flex items-center gap-3">
          <img
            src="/razorpay.svg"
            alt="Razorpay Logo"
            className="h-6 w-auto"
          />
        </div>

        {/* TOP RIGHT: Minimal Light Merchant Login Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMerchantModalOpen(true)}
            className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium text-xs shadow-xs flex items-center gap-2 transition-all cursor-pointer hover:border-slate-300"
          >
            <Building2 className="h-3.5 w-3.5 text-[#305EFF]" />
            <span>Merchant Login</span>
          </button>
        </div>
      </header>

      {/* Landing Card */}
      <div
        ref={landingRef}
        className="mx-auto flex w-full max-w-2xl flex-col text-center z-10 pt-10"
      >
        <span className="inline-block mx-auto mb-4 px-3 py-1 rounded-full text-xs font-semibold bg-[#305EFF]/10 text-[#305EFF] border border-[#305EFF]/15">
          Model Context Protocol • Autonomous AI Agent
        </span>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900">
          Razorpay <span className="text-[#305EFF]">Support</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base text-slate-500 sm:text-lg leading-relaxed">
          Search our knowledge base, explore developer docs, or connect directly with
          our autonomous Gemini AI support agents.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <Button
            onClick={handleStartChat}
            className="w-full sm:w-auto h-12 px-7 rounded-2xl bg-[#305EFF] hover:bg-[#254bdb] text-sm font-medium text-white shadow-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Start an agent chat
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsMerchantModalOpen(true)}
            className="w-full sm:w-auto h-12 px-6 rounded-2xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm transition-all cursor-pointer shadow-xs"
          >
            <Building2 className="mr-2 h-4 w-4 text-slate-500" />
            Merchant Portal Access
          </Button>
        </div>
      </div>

      {/* MINIMAL LIGHT MODE MERCHANT LOGIN MODAL */}
      {isMerchantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-fade">
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xl max-w-md w-full overflow-hidden text-slate-800 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-white">
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
                  setErrorMsg("")
                }}
                className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-600">
                  {errorMsg}
                </div>
              )}

              {/* Merchant Login Form */}
              <form onSubmit={handleMerchantSubmit} autoComplete="off" className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Merchant Email
                  </label>
                  <input
                    type="email"
                    name="merchant_login_email"
                    autoComplete="off"
                    value={merchantEmail}
                    onChange={(e) => setMerchantEmail(e.target.value)}
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
                    value={merchantPassword}
                    onChange={(e) => setMerchantPassword(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#305EFF] focus:ring-1 focus:ring-[#305EFF]"
                    placeholder="••••••••••••"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMerchantModalOpen(false)
                      setErrorMsg("")
                    }}
                    className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs h-9 px-3.5 rounded-lg cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    onClick={handleMerchantSubmit}
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

export default Landing
