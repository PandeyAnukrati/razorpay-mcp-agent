import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import gsap from "gsap"
import { MessageSquare } from "lucide-react"

export function Landing() {
  const navigate = useNavigate()
  const landingRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className="relative flex min-h-svh items-center justify-center p-6">
      {/* Background ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[40%] left-[50%] h-[60%] w-[80%] -translate-x-[50%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(48,94,255,0.08),transparent_60%)]"></div>
      </div>

      {/* Top Left Logo */}
      <div className="absolute top-6 left-6 z-10">
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

      {/* Landing Card */}
      <div
        ref={landingRef}
        className="mx-auto flex w-full max-w-2xl flex-col text-center z-10"
      >
        <h1 className="bg-gradient-to-r from-foreground via-foreground/90 to-[#305EFF] bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl md:text-6xl">
          Razorpay Support
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
          Search our knowledge base, explore developer docs, or connect with
          our support agents.
        </p>

        <div className="mt-10 flex justify-center">
          <Button
            onClick={handleStartChat}
            className="h-13 px-8 rounded-2xl bg-[#305EFF] text-base font-semibold text-white shadow-lg shadow-[#305EFF]/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-[#305EFF]/30 active:scale-[0.98]"
          >
            <MessageSquare className="mr-2.5 h-5 w-5" />
            Start an agent chat
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Landing
