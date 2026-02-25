'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, CheckCircle, AlertCircle, Image as ImageIcon, FileText, Volume2, Loader2, Download } from 'lucide-react'
import DragDropZone from './DragDropZone'
import FileList from './FileList'
import { analyzeFoodLabel, analyzeMedicalInsuranceDocs } from '@/lib/actions'
import { fetchTtsMp3 } from '@/utils/tts'

/* ── Supported languages ─────────────────────────────── */
const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'as', label: 'Assamese (ElevenLabs)' },
  { code: 'bn', label: 'Bengali' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'kn', label: 'Kannada' },
  { code: 'mr', label: 'Marathi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'pa', label: 'Punjabi' },
] as const

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

type TabType = 'food' | 'insurance'

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
  food: {
    id: 'food',
    name: 'Food Labels',
    icon: <ImageIcon className="w-4 h-4" />,
    description:
      'Upload food label images or PDFs. Our AI will extract nutritional information, ingredients, allergens, and provide health insights.',
    descBg: 'bg-amber-50',
    descBorder: 'border-amber-200',
    descText: 'text-amber-900',
    supportedFormats: 'Images (JPG, PNG, GIF, WebP) and PDFs',
    acceptConfig: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
    },
  },
  insurance: {
    id: 'insurance',
    name: 'Medical Insurance',
    icon: <FileText className="w-4 h-4" />,
    description:
      "Upload your medical insurance documents (insurance cards, policy documents, benefits summaries). We'll help you understand your coverage details and benefits.",
    descBg: 'bg-blue-50',
    descBorder: 'border-blue-200',
    descText: 'text-blue-900',
    supportedFormats: 'Images (JPG, PNG, GIF, WebP), PDFs, DOC, DOCX',
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
  const [activeTab, setActiveTab] = useState<TabType>('food')
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [isDragActive, setIsDragActive] = useState(false)
  const [language, setLanguage] = useState('en')

  // Single combined audio player state
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

  /** Generate a single MP3 from all successful analysis texts */
  const generateAudio = async (results: AnalysisResult[]) => {
    const combinedText = results
      .filter((r) => r.success && r.analysis)
      .map((r) => r.analysis)
      .join('\n\n')

    if (!combinedText.trim()) return

    setIsGeneratingAudio(true)
    setTtsError(null)

    try {
      const blob = await fetchTtsMp3({ text: combinedText, language })
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate audio'
      setTtsError(msg)
    } finally {
      setIsGeneratingAudio(false)
    }
  }

  const handleAnalyze = async () => {
    if (uploadedFiles.length === 0) return

    setIsLoading(true)
    try {
      // Clean up previous audio
      if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null) }
      setTtsError(null)

      const formData = new FormData()
      uploadedFiles.forEach((file) => {
        formData.append('files', file)
      })

      let response

      if (activeTab === 'food') {
        response = await analyzeFoodLabel(formData, language)
      } else {
        response = await analyzeMedicalInsuranceDocs(formData)
      }

      if (response.success && response.data) {
        setAnalysisResults(response.data)
        setShowResults(true)
        // Fire TTS generation in the background
        void generateAudio(response.data)
      } else {
        setAnalysisResults([
          {
            fileName: 'Error',
            error: response.error || 'Failed to analyze files',
            success: false,
          },
        ])
        setShowResults(true)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred'
      setAnalysisResults([
        {
          fileName: 'Error',
          error: errorMessage,
          success: false,
        },
      ])
      setShowResults(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setTtsError(null)
    setIsGeneratingAudio(false)
    setUploadedFiles([])
    setAnalysisResults([])
    setShowResults(false)
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
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-2xl font-bold text-gray-900">
                  Document Analysis
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Tabs */}
              {!showResults && (
                <div className="border-b border-gray-200 px-6 pt-4">
                  <div className="flex gap-8">
                    {Object.values(TAB_CONFIG).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`pb-4 font-semibold transition-all relative ${
                          activeTab === tab.id
                            ? 'text-lime-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {tab.icon}
                          {tab.name}
                        </div>
                        {activeTab === tab.id && (
                          <motion.div
                            layoutId="underline"
                            className="absolute bottom-0 left-0 right-0 h-1 bg-lime-400"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="p-6 space-y-6">
                {showResults ? (
                  // Results View
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      Analysis Results
                    </h3>

                    {/* Combined audio player */}
                    <div className="flex flex-col gap-2 p-3 bg-lime-50 border border-lime-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Volume2 className="w-5 h-5 text-lime-600 shrink-0" />
                        {isGeneratingAudio && (
                          <div className="flex items-center gap-2 text-sm text-lime-700">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating voice preview ({language === 'as' ? 'ElevenLabs' : 'edge-tts'})…
                          </div>
                        )}
                        {!isGeneratingAudio && audioUrl && (
                          <audio controls src={audioUrl} className="flex-1 h-8" />
                        )}
                        {!isGeneratingAudio && !audioUrl && !ttsError && (
                          <span className="text-sm text-lime-600">No audio generated</span>
                        )}
                        {ttsError && (
                          <span className="text-sm text-red-600">{ttsError}</span>
                        )}
                      </div>
                      {!isGeneratingAudio && audioUrl && (
                        <a
                          href={audioUrl}
                          download="analysis.mp3"
                          className="inline-flex items-center gap-2 self-start px-4 py-1.5 text-sm font-semibold rounded-lg bg-lime-400 text-black hover:bg-lime-500 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download MP3
                        </a>
                      )}
                    </div>

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
                                result.success
                                  ? 'text-gray-700'
                                  : 'text-red-700'
                              }`}
                            >
                              {result.success
                                ? result.analysis
                                : `Error: ${result.error}`}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  // Upload View
                  <>
                    {/* Description */}
                    <div
                      className={`${activeTabConfig.descBg} border ${activeTabConfig.descBorder} rounded-lg p-4`}
                    >
                      <p className={`text-sm ${activeTabConfig.descText}`}>
                        {activeTabConfig.description}
                      </p>
                    </div>

                    {/* Language selector (food tab only) */}
                    {activeTab === 'food' && (
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-semibold text-gray-700 shrink-0">
                          Voice language
                        </label>
                        <select
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-lime-400"
                        >
                          {SUPPORTED_LANGUAGES.map((lang) => (
                            <option key={lang.code} value={lang.code}>
                              {lang.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

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
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3 z-10">
                <button
                  onClick={
                    showResults ? () => { handleReset(); onClose(); } : onClose
                  }
                  className="px-6 py-2 text-gray-700 font-semibold border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  disabled={isLoading}
                >
                  {showResults ? 'Close' : 'Cancel'}
                </button>
                {!showResults && (
                  <button
                    onClick={handleAnalyze}
                    disabled={uploadedFiles.length === 0 || isLoading}
                    className={`px-6 py-2 font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                      uploadedFiles.length === 0 || isLoading
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-lime-400 text-black hover:bg-lime-500'
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
                    {isLoading ? 'Analyzing...' : 'Analyze Files'}
                  </button>
                )}
                {showResults && (
                  <button
                    onClick={handleReset}
                    className="px-6 py-2 font-semibold rounded-lg bg-lime-400 text-black hover:bg-lime-500 transition-colors"
                  >
                    Analyze More
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
