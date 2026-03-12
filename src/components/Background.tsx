import { useRef, useEffect, useCallback } from 'react'
import { AtmosphereRenderer } from '../gl/Atmosphere'

export function Background() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<AtmosphereRenderer | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    rendererRef.current = new AtmosphereRenderer(canvas)
    return () => {
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!rendererRef.current) return
    const nx = e.clientX / window.innerWidth
    const ny = 1 - e.clientY / window.innerHeight // flip Y for GL
    rendererRef.current.setMouse(nx, ny)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0 }}
      onMouseMove={handleMouseMove}
    />
  )
}
