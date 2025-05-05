"use client"

import { useRef, useState, useEffect, useCallback } from "react"

type VisualizerOptions = {
  fftSize?: number
  smoothingTimeConstant?: number
  barCount?: number
}

export function useAudioVisualizer(options: VisualizerOptions = {}) {
  const { fftSize = 128, smoothingTimeConstant = 0.8, barCount = 64 } = options

  const [audioData, setAudioData] = useState<number[]>(new Array(barCount).fill(0))
  const audioDataRef = useRef<number[]>(new Array(barCount).fill(0))
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number>(0)
  const isActiveRef = useRef(false)
  const dominantColorsRef = useRef<[number, number, number][] | undefined>(undefined)

  const initializeAudio = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        analyserRef.current = audioContextRef.current.createAnalyser()
        analyserRef.current.fftSize = fftSize
        analyserRef.current.smoothingTimeConstant = smoothingTimeConstant
      } catch (error) {
        console.error("Error initializing audio context:", error)
      }
    }
  }, [fftSize, smoothingTimeConstant])

  const drawEqualizer = useCallback((canvas: HTMLCanvasElement, dominantColors?: [number, number, number][]) => {
    if (!analyserRef.current) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Make sure canvas dimensions match its display size
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width
    canvas.height = height

    // Get frequency data
    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Generate simulated data for visual effect
    const simulatedData = Array.from({ length: barCount }, (_, i) => {
      const baseValue = dataArray[i % dataArray.length] || 0
      return Math.min(255, baseValue + Math.random() * 50)
    })

    // Only update audio data if values have changed significantly
    const hasSignificantChange = simulatedData.some((value, index) => 
      Math.abs(value - audioDataRef.current[index]) > 10
    )
    
    if (hasSignificantChange) {
      audioDataRef.current = simulatedData
      // Use requestAnimationFrame to batch state updates
      requestAnimationFrame(() => {
        if (isActiveRef.current) {
          setAudioData(simulatedData)
        }
      })
    }

    // Draw bars
    const barWidth = width / simulatedData.length
    const barMargin = 2

    // Get colors from dominant colors if available
    let gradient
    if (dominantColors && dominantColors.length > 0) {
      gradient = ctx.createLinearGradient(0, height, 0, 0)
      gradient.addColorStop(0, `rgba(${dominantColors[0][0]}, ${dominantColors[0][1]}, ${dominantColors[0][2]}, 0.8)`)
      gradient.addColorStop(
        1,
        `rgba(${dominantColors[dominantColors.length - 1][0]}, ${dominantColors[dominantColors.length - 1][1]}, ${dominantColors[dominantColors.length - 1][2]}, 0.8)`,
      )
    } else {
      gradient = ctx.createLinearGradient(0, height, 0, 0)
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)")
      gradient.addColorStop(1, "rgba(200, 200, 200, 0.8)")
    }

    ctx.fillStyle = gradient

    simulatedData.forEach((value, i) => {
      const barHeight = (value / 255) * height
      const x = i * barWidth + barMargin / 2
      const y = height - barHeight

      // Rounded rectangle for each bar
      ctx.beginPath()
      const radius = 2
      ctx.moveTo(x + radius, y)
      ctx.lineTo(x + barWidth - barMargin - radius, y)
      ctx.quadraticCurveTo(x + barWidth - barMargin, y, x + barWidth - barMargin, y + radius)
      ctx.lineTo(x + barWidth - barMargin, y + barHeight - radius)
      ctx.quadraticCurveTo(x + barWidth - barMargin, y + barHeight, x + barWidth - barMargin - radius, y + barHeight)
      ctx.lineTo(x + radius, y + barHeight)
      ctx.quadraticCurveTo(x, y + barHeight, x, y + barHeight - radius)
      ctx.lineTo(x, y + radius)
      ctx.quadraticCurveTo(x, y, x + radius, y)
      ctx.closePath()
      ctx.fill()
    })
  }, [barCount]) // Remove audioData from dependencies

  const startVisualizer = useCallback((dominantColors?: [number, number, number][]) => {
    if (isActiveRef.current) return
    isActiveRef.current = true
    initializeAudio()
    dominantColorsRef.current = dominantColors

    const animate = () => {
      if (!isActiveRef.current || !canvasRef.current) return
      drawEqualizer(canvasRef.current, dominantColorsRef.current)
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()
  }, [initializeAudio, drawEqualizer])

  const stopVisualizer = useCallback(() => {
    isActiveRef.current = false
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      stopVisualizer()
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close()
      }
    }
  }, [stopVisualizer])

  return {
    canvasRef,
    audioData,
    startVisualizer,
    stopVisualizer,
  }
}
