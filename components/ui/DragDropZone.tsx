'use client'
import { motion } from 'framer-motion'
import { useDropzone, DropzoneOptions } from 'react-dropzone'
import { Upload } from 'lucide-react'

interface DragDropZoneProps {
  onDrop: (files: File[]) => void
  isDragActive: boolean
  acceptConfig: DropzoneOptions['accept']
}

export default function DragDropZone({
  onDrop,
  isDragActive,
  acceptConfig,
}: DragDropZoneProps) {
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: acceptConfig,
  })

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
        isDragActive
          ? 'border-teal-400 bg-teal-50'
          : 'border-gray-300 hover:border-gray-400 bg-gray-50'
      }`}
    >
      <input {...getInputProps()} />
      <motion.div
        animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
        className="flex flex-col items-center gap-3"
      >
        <Upload
          className={`w-12 h-12 ${
            isDragActive ? 'text-teal-400' : 'text-gray-400'
          }`}
        />
        <div>
          <p className="text-lg font-semibold text-gray-900">
            {isDragActive ? 'Drop your files here' : 'Drag & drop your files here'}
          </p>
          <p className="text-sm text-gray-500 mt-1">or click to select files</p>
        </div>
      </motion.div>
    </div>
  )
}
