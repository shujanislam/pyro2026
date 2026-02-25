'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, CheckCircle, AlertCircle, FileText, Stethoscope, Volume2, Loader2, ShieldAlert, Shield, Pill, CalendarPlus, Clock, Calendar, Mail, Send } from 'lucide-react'
import DragDropZone from './DragDropZone'
import FileList from './FileList'
import { analyzeMedicalDocument, analyzeMedicalInsuranceDocs, analyzePrescription } from '@/lib/actions'
import type { MedicineSchedule } from '@/lib/actions'
import { downloadICS, hasCalendarEligibleMedicines } from '@/utils/ics'
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

type TabType = 'lab_reports' | 'discharge_summary' | 'insurance' | 'prescription'

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

const TIMING_LABEL: Record<string, string> = {
  '08:00': 'Morning (8:00 AM)',
  '09:00': 'Morning (9:00 AM)',
  '12:00': 'Noon (12:00 PM)',
  '14:00': 'Afternoon (2:00 PM)',
  '16:00': 'Evening (4:00 PM)',
  '18:00': 'Evening (6:00 PM)',
  '20:00': 'Night (8:00 PM)',
  '22:00': 'Bedtime (10:00 PM)',
}

function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${suffix}`
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
  prescription: {
    id: 'prescription',
    name: 'Med Reminders',
    icon: <Pill className="w-4 h-4" />,
    description:
      'Upload a prescription to extract your medicine schedule. Download a .ics calendar file to add reminders directly to Google Calendar, Apple Calendar, or Outlook.',
    descBg: 'bg-emerald-50',
    descBorder: 'border-emerald-200',
    descText: 'text-emerald-900',
    supportedFormats: 'Images (JPG, PNG, WebP) and PDFs',
    acceptConfig: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
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
  const [medicineSchedules, setMedicineSchedules] = useState<MedicineSchedule[]>([])
  const [isDownloadingICS, setIsDownloadingICS] = useState(false)
  const [emailAddress, setEmailAddress] = useState('')
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

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

      if (activeTab === 'prescription') {
        // Prescription → structured medicine data → ICS export
        const response = await analyzePrescription(formData)
        if (response.success && response.medicines) {
          setMedicineSchedules(response.medicines)
          setShowResults(true)
        } else {
          setAnalysisResults([{
            fileName: 'Error',
            error: response.error || 'Failed to extract prescription data',
            success: false,
          }])
          setShowResults(true)
        }
      } else {
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

  const handleDownloadICS = () => {
    if (!hasCalendarEligibleMedicines(medicineSchedules)) return
    setIsDownloadingICS(true)
    try {
      downloadICS(medicineSchedules, 'medicine-reminders.ics')
    } finally {
      setTimeout(() => setIsDownloadingICS(false), 1000)
    }
  }

  const handleEmailICS = async () => {
    if (!emailAddress.trim() || isSendingEmail) return
    setIsSendingEmail(true)
    setEmailSent(false)
    setEmailError(null)
    try {
      const res = await fetch('/api/calendar/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddress.trim(), medicines: medicineSchedules }),
      })
      const data = await res.json()
      if (data.success) {
        setEmailSent(true)
      } else {
        setEmailError(data.error ?? 'Failed to send email')
      }
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setIsSendingEmail(false)
    }
  }

  const handleReset = () => {
    setUploadedFiles([])
    setAnalysisResults([])
    setMedicineSchedules([])
    setShowResults(false)
    setAudioUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
    setTtsError(null)
    setIsGeneratingAudio(false)
    setContext('')
    setPrivacyAck(false)
    setEmailAddress('')
    setEmailSent(false)
    setEmailError(null)
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
                  activeTab === 'prescription' ? (
                    // ── Prescription / Medicine Reminder Results ─────────
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                          <Pill className="w-5 h-5 text-emerald-600" />
                          Medicine Schedule
                        </h3>
                        {hasCalendarEligibleMedicines(medicineSchedules) && (
                          <motion.button
                            onClick={handleDownloadICS}
                            disabled={isDownloadingICS}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                          >
                            {isDownloadingICS ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CalendarPlus className="w-4 h-4" />
                            )}
                            {isDownloadingICS ? 'Preparing…' : 'Download .ics Calendar'}
                          </motion.button>
                        )}
                      </div>

                      {/* Download + Email section */}
                      {hasCalendarEligibleMedicines(medicineSchedules) && (
                        <div className="space-y-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                            <CalendarPlus className="w-3.5 h-3.5" />
                            Add to your calendar
                          </p>
                          <p className="text-xs text-emerald-900">
                            <strong>Option 1 — Download:</strong> Save the .ics file, then open it.
                            Google Calendar, Apple Calendar & Outlook will offer to import all reminders.
                          </p>
                          {/* Divider */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 border-t border-emerald-300" />
                            <span className="text-xs text-emerald-700 font-medium">or</span>
                            <div className="flex-1 border-t border-emerald-300" />
                          </div>
                          <p className="text-xs text-emerald-900">
                            <strong>Option 2 — Email:</strong> Send the .ics file to your inbox so you can
                            open it on any device.
                          </p>
                          {/* Email input row */}
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
                              <input
                                type="email"
                                value={emailAddress}
                                onChange={(e) => { setEmailAddress(e.target.value); setEmailSent(false); setEmailError(null) }}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleEmailICS() }}
                                placeholder="your@email.com"
                                className="w-full pl-9 pr-3 py-2 text-sm border border-emerald-300 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                disabled={isSendingEmail}
                              />
                            </div>
                            <motion.button
                              onClick={handleEmailICS}
                              disabled={!emailAddress.trim() || isSendingEmail}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.97 }}
                              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                            >
                              {isSendingEmail ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                              {isSendingEmail ? 'Sending…' : 'Send'}
                            </motion.button>
                          </div>
                          {/* Feedback */}
                          {emailSent && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-2 text-xs text-emerald-800 font-medium"
                            >
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                              Email sent! Open the attachment to add reminders to your calendar.
                            </motion.div>
                          )}
                          {emailError && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-2 text-xs text-red-700 font-medium"
                            >
                              <AlertCircle className="w-4 h-4" />
                              {emailError}
                            </motion.div>
                          )}
                        </div>
                      )}

                      {/* Disclaimer */}
                      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-800">
                          <strong>Not medical advice.</strong> Always follow your doctor&apos;s instructions.
                          Timings shown are extracted or inferred from the prescription.
                        </p>
                      </div>

                      {/* Medicine cards */}
                      {medicineSchedules.length === 0 && (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                          No medicines could be extracted. Please try a clearer image of the prescription.
                        </div>
                      )}

                      {medicineSchedules.map((med, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="p-4 rounded-xl border border-emerald-200 bg-white shadow-sm"
                        >
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 mt-1 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                              <Pill className="w-4 h-4 text-emerald-700" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <p className="font-bold text-gray-900 text-sm leading-tight">{med.name}</p>
                              <div className="flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-2.5 py-0.5">
                                  <Calendar className="w-3 h-3" />
                                  {med.duration}
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-800 border border-purple-200 rounded-full px-2.5 py-0.5">
                                  {med.frequency}
                                </span>
                              </div>
                              {med.timings.length > 0 ? (
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reminder times</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {med.timings.map((t) => (
                                      <span
                                        key={t}
                                        className="inline-flex items-center gap-1 text-xs font-mono bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg px-2.5 py-1"
                                      >
                                        <Clock className="w-3 h-3" />
                                        {fmt12(t)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400 italic">No timing info — not added to calendar</p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                  // ── Standard Document Results ──────────────────────────
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
                  )
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
                    {activeTab !== 'insurance' && activeTab !== 'prescription' && (
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
                    {activeTab !== 'insurance' && activeTab !== 'prescription' && (
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
                    {isLoading ? 'Analyzing...' : activeTab === 'prescription' ? 'Extract Schedule' : 'Explain Document'}
                  </button>
                )}
                {showResults && activeTab === 'prescription' && hasCalendarEligibleMedicines(medicineSchedules) && (
                  <motion.button
                    onClick={handleDownloadICS}
                    disabled={isDownloadingICS}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex-1 sm:flex-none px-6 py-2.5 font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white transition-colors flex items-center justify-center gap-2"
                  >
                    {isDownloadingICS ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4" />}
                    {isDownloadingICS ? 'Preparing…' : 'Download .ics'}
                  </motion.button>
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

