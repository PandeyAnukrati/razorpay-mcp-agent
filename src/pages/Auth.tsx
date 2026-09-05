import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import gsap from "gsap"
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  CheckCircle,
  Building2,
} from "lucide-react"
import { auth } from "@/lib/firebase"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth"

export function Auth() {
  const navigate = useNavigate()
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Refs for GSAP transitions
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  // Form fields
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")

  // Animate Auth Panel entry when it mounts
  useEffect(() => {
    if (leftPanelRef.current) {
      gsap.fromTo(
        leftPanelRef.current,
        { x: "-100%", opacity: 0 },
        { x: "0%", opacity: 1, duration: 0.8, ease: "power3.out" }
      )
    }
    if (rightPanelRef.current) {
      gsap.fromTo(
        rightPanelRef.current,
        { x: 50, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.1 }
      )
    }
  }, [])

  const handleBack = () => {
    const tl = gsap.timeline({
      onComplete: () => {
        navigate("/")
      },
    })

    if (leftPanelRef.current) {
      tl.to(
        leftPanelRef.current,
        { x: "-100%", opacity: 0, duration: 0.5, ease: "power3.in" },
        0
      )
    }
    if (rightPanelRef.current) {
      tl.to(
        rightPanelRef.current,
        { x: 50, opacity: 0, duration: 0.5, ease: "power3.in" },
        0
      )
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Simple validation
    if (!email || !password) {
      setError("Please fill in all required fields.")
      return
    }
    if (!isLogin && !name) {
      setError("Please fill in all registration fields.")
      return
    }

    setIsLoading(true)
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password)
        if (userCredential.user) {
          await updateProfile(userCredential.user, {
            displayName: name,
          })
        }
      }
      setIsSuccess(true)
    } catch (err: any) {
      let msg = "An unexpected error occurred."
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        msg = "Invalid email or password."
      } else if (err.code === "auth/email-already-in-use") {
        msg = "This email is already registered."
      } else if (err.code === "auth/weak-password") {
        msg = "Password should be at least 6 characters."
      } else if (err.code === "auth/invalid-email") {
        msg = "Please enter a valid email address."
      } else {
        msg = err.message || msg
      }
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError("")
    setIsLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      setIsSuccess(true)
    } catch (err: any) {
      setError(err.message || "Failed to sign in with Google.")
    } finally {
      setIsLoading(false)
    }
  }


  const toggleFlow = () => {
    setIsLogin(!isLogin)
    setError("")
    setEmail("")
    setPassword("")
    setName("")
    setIsSuccess(false)
  }

  const handleContinue = () => {
    navigate("/dashboard")
  }

  return (
    <div className="flex min-h-svh flex-col lg:flex-row w-full bg-background transition-colors duration-300 overflow-hidden">
      {/* Left Panel: Visuals & Branding (50% Width) */}
      <div
        ref={leftPanelRef}
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-[#305EFF] to-[#eef2ff] dark:from-[#305EFF] dark:to-[#0a0f1d] text-slate-900 dark:text-white relative overflow-hidden"
      >
        {/* Background Gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_40%)]"></div>
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 blur-3xl"></div>

        {/* Brand Logo */}
        <div className="relative z-10">
          <img
            src="/razorpay.svg"
            alt="Razorpay Logo"
            className="h-7 w-auto dark:hidden"
          />
          <img
            src="/Untitled design (14).svg"
            alt="Razorpay Logo White"
            className="hidden h-7 w-auto dark:block"
          />
        </div>

        {/* Brand Pitch Content */}
        <div className="relative z-10 my-auto max-w-lg flex flex-col gap-6">
          <span className="inline-flex w-fit items-center rounded-full bg-[#305EFF]/10 dark:bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#305EFF] dark:text-white backdrop-blur-md">
            Dedicated Support Desk
          </span>
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl text-slate-900 dark:text-white">
            The business banking platform built for scaling startups.
          </h2>

          <ul className="flex flex-col gap-4 text-slate-700 dark:text-white/80 text-sm">
            <li className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
              <span>
                Access 24/7 priority support with our specialist agents.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
              <span>
                Real-time resolution dashboard for all transaction inquiries.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
              <span>
                Secure end-to-end multi-factor authenticated portal.
              </span>
            </li>
          </ul>
        </div>

        {/* Trust Footer */}
        <div className="relative z-10 text-slate-500 dark:text-white/60 text-xs">
          <p>© 2026 Razorpay Software Pvt. Ltd. All rights reserved.</p>
        </div>
      </div>

      {/* Right Panel: Auth Form (50% Width) */}
      <div
        ref={rightPanelRef}
        className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16 bg-card relative"
      >
        {/* Absolute Back Arrow */}
        <button
          onClick={handleBack}
          className="absolute top-6 left-6 lg:left-16 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all duration-200 hover:bg-muted/55 hover:text-foreground"
          title="Back to Landing Page"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>

        {/* Top Right Merchant Login Button */}
        <div className="absolute top-6 right-6 lg:right-16 flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              localStorage.setItem("rzp_merchant_logged_in", "true")
              localStorage.setItem("rzp_current_view", "merchant")
              navigate("/dashboard", { state: { view: "merchant" } })
            }}
            className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-medium text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Building2 className="h-3.5 w-3.5 text-slate-500" />
            <span>Merchant Login</span>
          </Button>
        </div>

        {/* Top Logo for mobile view only */}
        <div className="lg:hidden absolute top-7 right-6">
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
        </div>

        {/* Internal Centered Form Container */}
        <div className="mx-auto w-full max-w-sm">
          {/* SUCCESS VIEW */}
          {isSuccess ? (
            <div className="text-center py-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="h-10 w-10 animate-bounce" />
              </div>
              <h2 className="mt-6 text-2xl font-extrabold tracking-tight">
                Success!
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {isLogin
                  ? "You have successfully signed in to Razorpay Support."
                  : "Your Razorpay Support account has been created successfully."}
              </p>
              <Button
                onClick={handleContinue}
                className="mt-8 h-11 w-full rounded-2xl bg-[#305EFF] font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#305EFF]/90"
              >
                Continue to Dashboard
              </Button>
            </div>
          ) : (
            /* AUTHENTICATION FORM VIEW */
            <div className="flex flex-col gap-6">
              {/* Title Headers */}
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
                  {isLogin ? "Welcome back" : "Create account"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {isLogin
                    ? "Sign in to access your support dashboard"
                    : "Join Razorpay Support to track your tickets"}
                </p>
              </div>

              {/* Social Buttons */}
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card text-sm font-semibold text-foreground transition-all duration-200 hover:bg-muted/50 disabled:opacity-55"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </div>

              {/* Separator */}
              <div className="relative my-6 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/80"></div>
                </div>
                <span className="relative bg-card px-3 text-[11px] font-bold text-muted-foreground/60 uppercase">
                  Or email address
                </span>
              </div>

              {/* Form fields */}
              <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-4">
                {error && (
                  <div className="rounded-2xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
                    {error}
                  </div>
                )}

                {!isLogin && (
                  <>
                    {/* Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-muted-foreground">
                        Full Name
                      </label>
                      <div className="relative flex items-center rounded-2xl border border-border bg-muted/20 transition-all duration-200 focus-within:border-[#305EFF] focus-within:ring-2 focus-within:ring-[#305EFF]/20">
                        <User className="absolute left-4 h-4.5 w-4.5 text-muted-foreground/60" />
                        <input
                          type="text"
                          placeholder="John Doe"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-11 w-full bg-transparent pl-11 pr-4 text-sm font-medium outline-none"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    Email Address
                  </label>
                  <div className="relative flex items-center rounded-2xl border border-border bg-muted/20 transition-all duration-200 focus-within:border-[#305EFF] focus-within:ring-2 focus-within:ring-[#305EFF]/20">
                    <Mail className="absolute left-4 h-4.5 w-4.5 text-muted-foreground/60" />
                    <input
                      type="email"
                      id="support_user_email"
                      name="support_user_email"
                      autoComplete="off"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 w-full bg-transparent pl-11 pr-4 text-sm font-medium outline-none"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-muted-foreground">
                      Password
                    </label>
                    {isLogin && (
                      <a
                        href="#"
                        className="text-xs font-bold text-[#305EFF] hover:underline"
                      >
                        Forgot password?
                      </a>
                    )}
                  </div>
                  <div className="relative flex items-center rounded-2xl border border-border bg-muted/20 transition-all duration-200 focus-within:border-[#305EFF] focus-within:ring-2 focus-within:ring-[#305EFF]/20">
                    <Lock className="absolute left-4 h-4.5 w-4.5 text-muted-foreground/60" />
                    <input
                      type={showPassword ? "text" : "password"}
                      id="support_user_password"
                      name="support_user_password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 w-full bg-transparent pl-11 pr-11 text-sm font-medium outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 text-muted-foreground/60 transition-colors duration-200 hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4.5 w-4.5" />
                      ) : (
                        <Eye className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 h-11 w-full rounded-2xl bg-[#305EFF] font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#305EFF]/90"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isLogin ? (
                    "Sign In"
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>

              {/* Toggle Footer */}
              <div className="mt-2 text-center text-sm">
                <span className="text-muted-foreground text-xs">
                  {isLogin
                    ? "New to Razorpay Support? "
                    : "Already have an account? "}
                </span>
                <button
                  onClick={toggleFlow}
                  className="text-xs font-bold text-[#305EFF] hover:underline"
                >
                  {isLogin ? "Create account" : "Sign In"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Auth
