"use client"

import { useEffect } from "react"
import { useAudioVisualizer } from "@/hooks/use-audio-visualizer"

interface AudioEqualizerProps {
  isPlaying: boolean
  dominantColors?: [number, number, number][]
  className?: string
}

export function AudioEqualizer({ isPlaying, dominantColors, className = "w-full h-24 mt-4" }: AudioEqualizerProps) {
  const { canvasRef, startVisualizer, stopVisualizer } = useAudioVisualizer({
    fftSize: 128,
    barCount: 64,
    smoothingTimeConstant: 0.8,
  })

  useEffect(() => {
    if (isPlaying) {
      startVisualizer(dominantColors)
    } else {
      stopVisualizer()
    }

    return () => stopVisualizer()
  }, [isPlaying, dominantColors, startVisualizer, stopVisualizer])

  return (
    <div className={`relative z-10 ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full rounded-lg" />
    </div>
  )
}
