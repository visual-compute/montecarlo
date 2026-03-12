import { useEffect, useRef, useState } from 'react'
import { PathTracer } from '../gl/PathTracer'

type Mode = 'uniform' | 'direct'

interface Props {
  mode: Mode
  scene: number
  samples: number
  running: boolean
  resetToken: number
  onComplete?: () => void
}

const RES_W = 640
const RES_H = 480
const MAX_SAMPLES_PER_FRAME = 8

function targetDurationSeconds(samples: number): number {
  if (samples <= 4) return 3.5
  if (samples <= 16) return 5.5
  if (samples <= 64) return 7.5
  if (samples <= 256) return 10
  if (samples <= 1024) return 13
  return 16
}

export function SceneCanvas({ mode, scene, samples, running, resetToken, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ptRef = useRef<PathTracer | null>(null)
  const animRef = useRef(0)
  const sampleBudgetRef = useRef(0)
  const lastTickRef = useRef(0)
  const completionSentRef = useRef(false)
  const [spp, setSpp] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      ptRef.current = new PathTracer(canvas, mode, scene)
      ptRef.current.setTargetSamples(samples)
      setSpp(0)
    } catch (error) {
      console.error('PathTracer init:', error)
    }

    return () => {
      ptRef.current?.dispose()
      ptRef.current = null
    }
  }, [mode, scene])

  useEffect(() => {
    const pt = ptRef.current
    if (!pt) return

    pt.setScene(scene)
    pt.setTargetSamples(samples)
    sampleBudgetRef.current = 0
    lastTickRef.current = 0
    completionSentRef.current = false
    setSpp(0)
  }, [scene, samples, resetToken])

  useEffect(() => {
    const pt = ptRef.current
    if (!pt) return

    if (!running) {
      cancelAnimationFrame(animRef.current)
      sampleBudgetRef.current = 0
      lastTickRef.current = 0
      return
    }

    const samplesPerSecond = samples / targetDurationSeconds(samples)

    const loop = (now: number) => {
      animRef.current = requestAnimationFrame(loop)

      if (lastTickRef.current === 0) {
        lastTickRef.current = now
      }

      const dt = now - lastTickRef.current
      lastTickRef.current = now

      sampleBudgetRef.current += (dt / 1000) * samplesPerSecond

      const pendingSamples = Math.min(
        Math.floor(sampleBudgetRef.current),
        MAX_SAMPLES_PER_FRAME,
      )

      if (pendingSamples > 0) {
        const before = pt.currentFrame
        const after = pt.renderBatch(pendingSamples)
        sampleBudgetRef.current -= after - before
        setSpp(after)
      }

      if (pt.done) {
        cancelAnimationFrame(animRef.current)
        if (!completionSentRef.current) {
          completionSentRef.current = true
          onComplete?.()
        }
      }
    }

    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [running, samples, onComplete])

  const isUniform = mode === 'uniform'
  const showIdleOverlay = !running && spp === 0

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        width={RES_W}
        height={RES_H}
        className="absolute inset-0 w-full h-full"
        style={{ background: '#000' }}
      />

      <div className="absolute top-4 left-5">
        <p
          className="text-[10px] font-medium tracking-[0.2em] uppercase"
          style={{ color: isUniform ? 'rgba(255,100,100,0.5)' : 'rgba(100,220,190,0.5)' }}
        >
          {isUniform ? 'Uniform Hemisphere' : 'Direct Light'}
        </p>
      </div>

      {(running || spp > 0) && (
        <div
          className="absolute top-4 right-5 font-mono text-[11px]"
          style={{
            color: spp >= samples ? 'rgba(100,220,190,0.7)' : 'rgba(255,255,255,0.3)',
          }}
        >
          {spp} spp
        </div>
      )}

      {showIdleOverlay && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          <p className="font-mono text-sm" style={{ color: 'rgba(255,255,255,0.15)' }}>
            {isUniform ? 'p(\u03c9) = 1 / 2\u03c0' : 'p(y) = 1 / A'}
          </p>
        </div>
      )}
    </div>
  )
}
