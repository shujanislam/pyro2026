'use client'
import { motion, useScroll, useTransform, useSpring } from "framer-motion"
import { useRef, useState } from "react"
import DragDropModal from "./ui/DragDropModal"

const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 }

export default function Hero() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  })

  const rawY = useTransform(scrollYProgress, [0, 1], [0, 200])
  const y = useSpring(rawY, springConfig)

  const rawTextX1 = useTransform(scrollYProgress, [0, 1], [0, -100])
  const textX1 = useSpring(rawTextX1, springConfig)

  const rawTextX2 = useTransform(scrollYProgress, [0, 1], [0, 100])
  const textX2 = useSpring(rawTextX2, springConfig)

  const rawScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.9])
  const scale = useSpring(rawScale, springConfig)

  const rawOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0])
  const opacity = useSpring(rawOpacity, springConfig)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const openTryNow = () => setIsModalOpen(true)
  const closeTryNow = () => setIsModalOpen(false)

  return (
    <>
      <DragDropModal isOpen={isModalOpen} onClose={closeTryNow} />
      <section
      id="hero"
      ref={ref}
      className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-white"
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-linear-to-br from-white via-teal-50/20 to-white" />

      <motion.div
        className="absolute top-20 left-10 w-24 h-24 rounded-full bg-teal-400/20 blur-3xl"
        animate={{
          x: [0, 30, 0],
          y: [0, -20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-40 right-20 w-32 h-32 rounded-full bg-teal-300/10 blur-3xl"
        animate={{
          x: [0, -40, 0],
          y: [0, 30, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-12 w-full">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Text Content */}
          <motion.div style={{ opacity }} className="space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0, duration: 0.8 }}
              className="inline-flex items-center gap-2 bg-black text-white px-3 py-1.5 rounded-full text-xs font-mono tracking-wider"
            >
              <motion.span
                className="w-2 h-2 bg-teal-400 rounded-full"
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              AI-POWERED MEDICAL CLARITY
            </motion.div>

            <div className="space-y-1 overflow-hidden">
              <motion.h1
                style={{ x: textX1 }}
                className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter text-black leading-[0.9] overflow-hidden"
              >
                <motion.span
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.8 }}
                  className="inline-block"
                >
                  MEDICAL DOCS
                </motion.span>
              </motion.h1>
              <motion.h1
                style={{ x: textX2 }}
                className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter text-black leading-[0.9] overflow-hidden"
              >
                <motion.span
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="inline-block text-teal-500"
                >
                  EXPLAINED
                </motion.span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-lg md:text-xl font-mono text-gray-600 tracking-tight pt-2 max-w-md"
              >
                Upload lab reports or discharge summaries. Get plain-language explanations in your language.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="flex flex-wrap gap-3 pt-2"
            >
              <motion.button
                onClick={openTryNow}
                className="bg-black text-teal-400 px-6 py-3 rounded-full font-bold text-sm tracking-wide flex items-center gap-2 group relative overflow-hidden hover:bg-gray-900"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div
                  className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent -translate-x-full"
                  whileHover={{ x: "200%" }}
                  transition={{ duration: 0.6 }}
                />
                <span className="relative z-10">Test Free</span>
                <motion.svg
                  className="w-4 h-4 relative z-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  initial={{ x: 0 }}
                  whileHover={{ x: 4 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </motion.svg>
              </motion.button>
              <motion.button
                className="border-2 border-black text-black px-6 py-3 rounded-full font-bold text-sm tracking-wide relative overflow-hidden"
                whileHover={{ scale: 1.02, backgroundColor: "#000", color: "#2dd4bf" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const demoSection = document.querySelector('#demo');
                  if (demoSection) demoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                Watch Demo
              </motion.button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="flex flex-wrap gap-4 pt-2"
            >
              {["AI Analysis", "10 Indian Languages", "Voice Readout", "Privacy First"].map((benefit, i) => (
                <motion.div
                  key={benefit}
                  className="flex items-center gap-2 text-xs font-mono text-gray-600"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                >
                  <div className="w-1.5 h-1.5 bg-teal-400 rounded-full" />
                  {benefit}
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right side - Image/Doctor (hidden on mobile, shown md+) */}
          <motion.div style={{ y, scale }} className="relative hidden lg:flex justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
              className="relative"
            >
              <motion.div
                className="absolute inset-0 bg-teal-400/30 blur-[80px] rounded-full scale-75"
                animate={{
                  scale: [0.75, 0.85, 0.75],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />

              <motion.div
                animate={{
                  y: [0, -15, 0],
                  rotate: [0, 2, 0],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <img
                  src="/bg.png"
                  alt="AI Doctor - MedEase"
                  className="relative z-10 drop-shadow-2xl w-full max-w-sm h-auto"
                />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>

      </div>

      </section>

    </>
  )
}
