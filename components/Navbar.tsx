'use client'
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X } from "lucide-react"
import DragDropModal from "./ui/DragDropModal"

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const openTryNow = () => {
    setIsModalOpen(true)
    setMobileMenuOpen(false)
  }
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

  const iconColor = scrolled ? "text-white" : "text-[#121212]"

  return (
    <>
      <DragDropModal isOpen={isModalOpen} onClose={closeTryNow} />
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
          scrolled
            ? "bg-[#121212]/95 backdrop-blur-md border-b border-white/10"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-xl sm:text-2xl font-black tracking-tighter">
              <span className={scrolled ? "text-white" : "text-[#121212]"}>
                Med
              </span>
              <span className="text-teal-500">Clarity</span>
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
            className={`md:hidden p-2 rounded-lg hover:bg-black/10 transition-colors ${iconColor}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className={`md:hidden overflow-hidden border-t ${
                scrolled ? "border-white/10 bg-[#121212]/95" : "border-gray-200 bg-white"
              }`}
            >
              <div className="px-4 py-4 flex flex-col gap-3">
                <button
                  onClick={() => { openTryNow(); setMobileMenuOpen(false) }}
                  className="w-full bg-[#AFFF00] text-[#121212] px-6 py-3 rounded-full font-bold text-sm"
                >
                  Try Now
                </button>
                <a
                  href="https://t.me/MedEase_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full text-center border-2 px-6 py-3 rounded-full font-bold text-sm ${
                    scrolled ? "border-white/30 text-white" : "border-gray-300 text-gray-800"
                  }`}
                >
                  Go to Bot
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

    </>
  )
}
