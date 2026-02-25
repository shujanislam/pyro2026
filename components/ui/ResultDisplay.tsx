'use client'
import { motion } from 'framer-motion'
import { CheckCircle, AlertCircle, Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface AnalysisResult {
  fileName: string
  analysis?: string
  error?: string
  success: boolean
}

interface ResultDisplayProps {
  results: AnalysisResult[]
}

export default function ResultDisplay({ results }: ResultDisplayProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="space-y-4">
      {results.map((result, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`rounded-xl p-6 ${
            result.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              {result.success ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 mb-3">
                {result.fileName}
              </h3>
              <div
                className={`text-sm leading-relaxed whitespace-pre-wrap ${
                  result.success ? 'text-gray-700' : 'text-red-700'
                }`}
              >
                {result.success ? result.analysis : `Error: ${result.error}`}
              </div>
              {result.success && (
                <button
                  onClick={() =>
                    handleCopy(result.analysis || '', index)
                  }
                  className="mt-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {copiedIndex === index ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-green-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
