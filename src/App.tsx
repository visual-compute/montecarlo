import { useState, useCallback } from 'react'
import { Background } from './components/Background'
import { SceneCanvas } from './components/SceneCanvas'

const PRESETS = [1, 4, 16, 64, 256, 1024, 4096]
const SCENES = [
  { id: 0, label: 'Lecture' },
  { id: 1, label: 'Studio' },
  { id: 2, label: 'Gallery' },
  { id: 3, label: 'Noir' },
  { id: 4, label: 'Cyber' },
  { id: 5, label: 'Sunset' },
]

export default function App() {
  const [samples, setSamples] = useState(16)
  const [scene, setScene] = useState(0)
  const [running, setRunning] = useState(false)
  const [resetToken, setResetToken] = useState(0)
  const [hasRender, setHasRender] = useState(false)

  const handleStartOrRestart = useCallback(() => {
    if (hasRender) {
      setResetToken(token => token + 1)
    }
    setHasRender(true)
    setRunning(true)
  }, [hasRender])

  const handleComplete = useCallback(() => setRunning(false), [])

  const handleSampleChange = useCallback((n: number) => {
    setSamples(n)
    setHasRender(false)
    setRunning(false)
    setResetToken(token => token + 1)
  }, [])

  const handleSceneChange = useCallback((id: number) => {
    setScene(id)
    setHasRender(false)
    setRunning(false)
    setResetToken(token => token + 1)
  }, [])

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Atmospheric background — behind everything */}
      <Background />

      {/* Two halves — edge to edge */}
      <div className="absolute inset-0 z-10 flex">
        {/* Left: uniform */}
        <div className="w-1/2 h-full" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <SceneCanvas mode="uniform" scene={scene} samples={samples} running={running} resetToken={resetToken} onComplete={handleComplete} />
        </div>
        {/* Right: direct */}
        <div className="w-1/2 h-full">
          <SceneCanvas mode="direct" scene={scene} samples={samples} running={running} resetToken={resetToken} onComplete={handleComplete} />
        </div>
      </div>

      {/* Floating center controls */}
      <div className="absolute z-20 left-1/2 -translate-x-1/2 flex flex-col items-center"
        style={{ bottom: 28 }}>

        <div className="flex items-center gap-1 mb-2"
          style={{
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(12px)',
            borderRadius: 4,
            padding: '5px 8px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
          {SCENES.map(option => (
            <button
              key={option.id}
              onClick={() => handleSceneChange(option.id)}
              className="text-[10px] min-w-12 h-7 px-2 rounded-sm transition-all duration-150 cursor-pointer"
              style={{
                background: scene === option.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: scene === option.id ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
                border: 'none',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Sample selector + Start/Restart */}
        <div className="flex items-center gap-1"
          style={{
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
            borderRadius: 4,
            padding: '6px 8px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
          {PRESETS.map(n => (
            <button
              key={n}
              onClick={() => handleSampleChange(n)}
              className="font-mono text-[10px] min-w-9 h-7 px-2 rounded-sm transition-all duration-150 cursor-pointer"
              style={{
                background: samples === n ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: samples === n ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
                border: 'none',
              }}
            >
              {n}
            </button>
          ))}

          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />

          <button
            onClick={handleStartOrRestart}
            disabled={running}
            className="text-[10px] font-medium tracking-[0.12em] uppercase h-7 px-3 rounded-sm transition-all duration-150"
            style={{
              background: running ? 'transparent' : (hasRender ? 'transparent' : 'rgba(255,255,255,0.1)'),
              border: 'none',
              color: running ? 'rgba(255,255,255,0.2)' : (hasRender ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)'),
              cursor: running ? 'default' : 'pointer',
            }}
            onMouseEnter={e => {
              if (running) return
              e.currentTarget.style.background = 'rgba(255,255,255,0.14)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.9)'
            }}
            onMouseLeave={e => {
              if (running) return
              e.currentTarget.style.background = hasRender ? 'transparent' : 'rgba(255,255,255,0.1)'
              e.currentTarget.style.color = hasRender ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)'
            }}
          >
            {running ? 'Rendering\u2026' : (hasRender ? 'Restart' : 'Start')}
          </button>
        </div>
      </div>
    </div>
  )
}
