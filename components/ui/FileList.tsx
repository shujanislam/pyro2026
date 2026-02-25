'use client'
import { motion } from 'framer-motion'
import { X, File, Image as ImageIcon } from 'lucide-react'

interface FileListProps {
  files: File[]
  onRemoveFile: (index: number) => void
  isLoading?: boolean
}

export default function FileList({
  files,
  onRemoveFile,
  isLoading = false,
}: FileListProps) {
  if (files.length === 0) {
    return null
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="w-4 h-4" />
    }
    return <File className="w-4 h-4" />
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900">
        Uploaded Files ({files.length})
      </h3>
      <div className="space-y-2">
        {files.map((file, index) => (
          <motion.div
            key={`${file.name}-${index}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 text-gray-400">
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
              onClick={() => onRemoveFile(index)}
              disabled={isLoading}
              className="shrink-0 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
