'use client'
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X } from "lucide-react"

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const openTryNow = () => setIsModalOpen(true)
  const closeTryNow = () => setIsModalOpen(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.querySelector(id)
    if (element) element.scrollIntoView({ behavior: "smooth", block: "start" })
    setMobileMenuOpen(false)
  }

  const ctaAnimation = {
    boxShadow: [
      "0 0 20px rgba(175,255,0,0.3)",
      "0 0 40px rgba(175,255,0,0.6)",
      "0 0 20px rgba(175,255,0,0.3)",
    ],
  }

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "bg-[#121212]/95 backdrop-blur-md border-b border-white/10"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tighter">
              <span className={scrolled ? "text-white" : "text-[#121212]"}>
                Jaane
              </span>
              <span className="text-[#AFFF00]">Khaana</span>
            </span>
          </a>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-4">
            <motion.button
              onClick={openTryNow}
              className="bg-[#AFFF00] text-[#121212] px-6 py-2.5 rounded-full font-bold text-sm relative overflow-hidden"
            >
              <motion.div
                className="absolute inset-0 cursor-pointer bg-white/30"
                animate={ctaAnimation}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="relative z-10 cursor-pointer">Try Now</span>
            </motion.button>

            <motion.a
              href="https://t.me/MedEase_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#AFFF00] text-[#121212] px-6 py-2.5 rounded-full font-bold text-sm inline-block"
            >
              Go to Bot
            </motion.a>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <div className="md:hidden px-6 py-4">
              <button
                onClick={openTryNow}
                className="w-full bg-[#AFFF00] text-[#121212] px-6 py-3 rounded-full font-bold"
              >
                Try Now
              </button>
            </div>
          )}
        </AnimatePresence>
      </motion.nav>

    </>
  )
}
