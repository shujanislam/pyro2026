'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, CheckCircle, AlertCircle, FileText, Stethoscope, Volume2, Loader2, ShieldAlert, Shield } from 'lucide-react'
import DragDropZone from './DragDropZone'
import FileList from './FileList'
import { analyzeMedicalDocument, analyzeMedicalInsuranceDocs } from '@/lib/actions'
import { SUPPORTED_LANGUAGES } from '@/lib/elevenlabs'
import { fetchTtsMp3 } from '@/utils/tts'

interface DragDropModalProps {
  isOpen: boolean
  onClose: () => void
}

interface AnalysisResult {
  fileName: string
  analysis?: string
  error?: string
  success: boolean
}

type TabType = 'lab_reports' | 'discharge_summary' | 'insurance'

interface TabConfig {
  id: TabType
  name: string
  icon: React.ReactNode
  description: string
  descBg: string
  descBorder: string
  descText: string
  supportedFormats: string
  acceptConfig: {
    'image/*'?: string[]
    'application/pdf'?: string[]
    'application/msword'?: string[]
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'?: string[]
  }
}

const TAB_CONFIG: Record<TabType, TabConfig> = {
  lab_reports: {
    id: 'lab_reports',
    name: 'Lab Reports',
    icon: <Stethoscope className="w-4 h-4" />,
    description:
      'Upload blood tests, urine reports, imaging results, or any lab report. Our AI explains what each value means for you in plain, simple language.',
    descBg: 'bg-teal-50',
    descBorder: 'border-teal-200',
    descText: 'text-teal-900',
    supportedFormats: 'Images (JPG, PNG, WebP) and PDFs',
    acceptConfig: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
    },
  },
  discharge_summary: {
    id: 'discharge_summary',
    name: 'Discharge & Rx',
    icon: <FileText className="w-4 h-4" />,
    description:
      'Upload hospital discharge summaries, doctor notes, or prescriptions to understand your diagnosis, medications, and follow-up care in simple terms.',
    descBg: 'bg-blue-50',
    descBorder: 'border-blue-200',
    descText: 'text-blue-900',
    supportedFormats: 'Images (JPG, PNG, WebP), PDFs, DOC, DOCX',
    acceptConfig: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
    },
  },
  insurance: {
    id: 'insurance',
    name: 'Insurance',
    icon: <Shield className="w-4 h-4" />,
    description:
      'Upload your insurance policy along with a hospital estimate, lab report, or prescription. Our AI checks coverage, flags likely rejections, and tells you what to do next.',
    descBg: 'bg-purple-50',
    descBorder: 'border-purple-200',
    descText: 'text-purple-900',
    supportedFormats: 'Images (JPG, PNG, WebP), PDFs, DOC, DOCX',
    acceptConfig: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
    },
  },
}

export default function DragDropModal({ isOpen, onClose }: DragDropModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('lab_reports')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [language, setLanguage] = useState('en')
  const [context, setContext] = useState('')
  const [privacyAck, setPrivacyAck] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [ttsError, setTtsError] = useState<string | null>(null)

  const activeTabConfig = TAB_CONFIG[activeTab]

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedFiles((prev) => [...prev, ...acceptedFiles])
    setIsDragActive(false)
  }, [])

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAnalyze = async () => {
    if (uploadedFiles.length === 0 || !privacyAck) return

    setIsLoading(true)
    try {
      const formData = new FormData()
      uploadedFiles.forEach((file) => {
        formData.append('files', file)
      })

      let response
      if (activeTab === 'insurance') {
        response = await analyzeMedicalInsuranceDocs(formData)
      } else {
        response = await analyzeMedicalDocument(formData, language, context)
      }

      if (response.success && response.data) {
        setAnalysisResults(response.data)
        setShowResults(true)
      } else {
        setAnalysisResults([{
          fileName: 'Error',
          error: response.error || 'Failed to analyze document',
          success: false,
        }])
        setShowResults(true)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'
      setAnalysisResults([{ fileName: 'Error', error: errorMessage, success: false }])
      setShowResults(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePlayAudio = async (text: string) => {
    setIsGeneratingAudio(true)
    setTtsError(null)
    try {
      // Routes automatically: Assamese → ElevenLabs, all others → Edge TTS
      const blob = await fetchTtsMp3({ text, language })
      setAudioUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
    } catch (ttsErr) {
      setTtsError(ttsErr instanceof Error ? ttsErr.message : 'Audio generation failed')
    } finally {
      setIsGeneratingAudio(false)
    }
  }

  const handleReset = () => {
    setUploadedFiles([])
    setAnalysisResults([])
    setShowResults(false)
    setAudioUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
    setTtsError(null)
    setIsGeneratingAudio(false)
    setContext('')
    setPrivacyAck(false)
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    handleReset()
  }


  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-60"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-70 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">

              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg sm:text-2xl font-bold text-gray-900 leading-tight">
                    Medical Document Explainer
                  </h2>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
                {/* Disclaimer badge */}
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800">
                    <strong>Not medical advice.</strong> This tool helps you understand documents. Always consult your doctor for clinical decisions.
                  </p>
                </div>
              </div>

              {/* Tabs */}
              {!showResults && (
                <div className="border-b border-gray-200 px-4 sm:px-6 pt-4">
                  <div className="flex gap-1 sm:gap-6 overflow-x-auto scrollbar-none">
                    {Object.values(TAB_CONFIG).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`pb-4 text-xs sm:text-sm font-semibold transition-all relative whitespace-nowrap px-1 sm:px-0 ${
                          activeTab === tab.id
                            ? 'text-teal-600'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {tab.icon}
                          {tab.name}
                        </div>
                        {activeTab === tab.id && (
                          <motion.div
                            layoutId="underline"
                            className="absolute bottom-0 left-0 right-0 h-1 bg-teal-400"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="px-4 sm:px-6 py-5 space-y-5">
                {showResults ? (
                  // ── Results View ──────────────────────────────────────
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      Explanation Results
                    </h3>

                    {/* Prominent disclaimer */}
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                      <p className="text-xs text-amber-800">
                        <strong>Not medical advice.</strong> Always consult your doctor before taking any action.
                      </p>
                    </div>

                    {/* Audio player — manual trigger */}
                    <div className="flex items-center gap-3 p-3 bg-teal-50 border border-teal-200 rounded-lg min-h-13">
                      <Volume2 className="w-5 h-5 text-teal-600 shrink-0" />
                      {isGeneratingAudio && (
                        <div className="flex items-center gap-2 text-sm text-teal-700">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating audio explanation…
                        </div>
                      )}
                      {!isGeneratingAudio && audioUrl && (
                        <audio controls src={audioUrl} className="flex-1 h-8" />
                      )}
                      {!isGeneratingAudio && !audioUrl && !ttsError && (
                        <button
                          onClick={() => {
                            const first = analysisResults.find((r) => r.success && r.analysis)
                            if (first?.analysis) handlePlayAudio(first.analysis)
                          }}
                          disabled={!analysisResults.some((r) => r.success && r.analysis)}
                          className="text-sm font-semibold text-teal-700 hover:text-teal-900 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          ▶ Play Audio Explanation
                        </button>
                      )}
                      {ttsError && (
                        <span className="text-sm text-red-600">{ttsError}</span>
                      )}
                    </div>

                    {/* Result cards */}
                    {analysisResults.map((result, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-lg border ${
                          result.success
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 mt-1">
                            {result.success ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 mb-2">
                              {result.fileName}
                            </p>
                            <div
                              className={`text-sm whitespace-pre-wrap ${
                                result.success ? 'text-gray-700' : 'text-red-700'
                              }`}
                            >
                              {result.success ? result.analysis : `Error: ${result.error}`}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  // ── Upload View ───────────────────────────────────────
                  <>
                    {/* Description */}
                    <div className={`${activeTabConfig.descBg} border ${activeTabConfig.descBorder} rounded-lg p-4`}>
                      <p className={`text-sm ${activeTabConfig.descText}`}>
                        {activeTabConfig.description}
                      </p>
                    </div>

                    {/* Language selector (medical tabs only) */}
                    {activeTab !== 'insurance' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Language
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                      >
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    )}

                    {/* Context / symptoms (medical tabs only) */}
                    {activeTab !== 'insurance' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Context / Symptoms{' '}
                        <span className="font-normal text-gray-500">(optional)</span>
                      </label>
                      <textarea
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                        placeholder="e.g. I have been feeling tired. Doctor asked to check thyroid levels…"
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                      />
                    </div>
                    )}

                    {/* Privacy notice */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs text-red-800">
                        <strong>Privacy Notice:</strong> Do NOT upload documents containing personal identifiable information (full name, date of birth, Aadhaar / ID numbers, phone, or address). Crop or cover sensitive details before uploading.
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={privacyAck}
                          onChange={(e) => setPrivacyAck(e.target.checked)}
                          className="w-4 h-4 rounded accent-teal-500"
                        />
                        <span className="text-xs font-semibold text-red-900">
                          I have removed personal information from this document
                        </span>
                      </label>
                    </div>

                    {/* Drag Drop Zone */}
                    <DragDropZone
                      onDrop={onDrop}
                      isDragActive={isDragActive}
                      acceptConfig={activeTabConfig.acceptConfig}
                    />

                    {/* Supported Formats */}
                    <div className="text-center text-xs text-gray-500 space-y-1">
                      <p>Supported: {activeTabConfig.supportedFormats}</p>
                      <p>Max file size: 10MB each</p>
                    </div>

                    {/* File List */}
                    <FileList
                      files={uploadedFiles}
                      onRemoveFile={removeFile}
                      isLoading={isLoading}
                    />
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-end gap-2 sm:gap-3 z-10">
                <button
                  onClick={showResults ? () => { handleReset(); onClose() } : onClose}
                  className="flex-1 sm:flex-none px-6 py-2.5 text-gray-700 font-semibold border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  disabled={isLoading}
                >
                  {showResults ? 'Close' : 'Cancel'}
                </button>
                {!showResults && (
                  <button
                    onClick={handleAnalyze}
                    disabled={uploadedFiles.length === 0 || isLoading || !privacyAck}
                    className={`flex-1 sm:flex-none px-6 py-2.5 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      uploadedFiles.length === 0 || isLoading || !privacyAck
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-teal-500 text-white hover:bg-teal-600'
                    }`}
                  >
                    {isLoading && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-4 h-4"
                      >
                        <Upload className="w-4 h-4" />
                      </motion.div>
                    )}
                    {isLoading ? 'Analyzing...' : 'Explain Document'}
                  </button>
                )}
                {showResults && (
                  <button
                    onClick={handleReset}
                    className="flex-1 sm:flex-none px-6 py-2.5 font-semibold rounded-lg bg-teal-500 text-white hover:bg-teal-600 transition-colors"
                  >
                    Analyze Another
                  </button>
                )}
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

