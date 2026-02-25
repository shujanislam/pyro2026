'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { X, Upload, File, Image as ImageIcon } from 'lucide-react'

interface DragDropModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function DragDropModal({ isOpen, onClose }: DragDropModalProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadedFiles((prev) => [...prev, ...acceptedFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
    },
  })

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAnalyze = () => {
    if (uploadedFiles.length > 0) {
      console.log('Analyzing files:', uploadedFiles)
      // TODO: Implement file analysis logic here
      alert(`Analyzing ${uploadedFiles.length} file(s)...`)
    }
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="w-4 h-4" />
    }
    return <File className="w-4 h-4" />
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
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Analyze Your Food Label</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Drag Drop Zone */}
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                    isDragActive
                      ? 'border-lime-400 bg-lime-50'
                      : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <motion.div
                    animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <Upload className={`w-12 h-12 ${isDragActive ? 'text-lime-400' : 'text-gray-400'}`} />
                    <div>
                      <p className="text-lg font-semibold text-gray-900">
                        {isDragActive ? 'Drop your files here' : 'Drag & drop your files here'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        or click to select files
                      </p>
                    </div>
                    <div className="text-xs text-gray-500 mt-2 space-y-1">
                      <p>Supported: Images (JPG, PNG, GIF, WebP) and PDFs</p>
                      <p>Max file size: 10MB each</p>
                    </div>
                  </motion.div>
                </div>

                {/* File List */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900">
                      Uploaded Files ({uploadedFiles.length})
                    </h3>
                    <div className="space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <motion.div
                          key={`${file.name}-${index}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex-shrink-0 text-gray-400">
                              {getFileIcon(file)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {(file.size / 1024).toFixed(2)} KB
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Info Text */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    Our AI will analyze the nutritional information, ingredients, and allergens from your food labels.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2 text-gray-700 font-semibold border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={uploadedFiles.length === 0}
                  className={`px-6 py-2 font-semibold rounded-lg transition-colors ${
                    uploadedFiles.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-lime-400 text-black hover:bg-lime-500'
                  }`}
                >
                  Analyze Files
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
