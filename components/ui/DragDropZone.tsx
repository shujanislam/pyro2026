'use client'
import { motion } from 'framer-motion'
import { useDropzone, DropzoneOptions } from 'react-dropzone'
import { Cloud, Upload } from 'lucide-react'

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
      className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-200 ${
        isDragActive
          ? 'border-lime-400 bg-lime-50 scale-105'
          : 'border-gray-300 hover:border-lime-400 bg-white hover:bg-gray-50'
      }`}
    >
      <input {...getInputProps()} />
      <motion.div
        animate={isDragActive ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          animate={isDragActive ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: isDragActive ? 0.5 : 0.3 }}
        >
          {isDragActive ? (
            <Cloud className="w-16 h-16 text-lime-400" />
          ) : (
            <Upload className="w-16 h-16 text-gray-400" />
          )}
        </motion.div>
        <div>
          <p className="text-xl font-bold text-gray-900">
            {isDragActive ? 'Drop here!' : 'Drop your photos here'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            or click to browse
          </p>
        </div>
      </motion.div>
    </div>
  )
}
