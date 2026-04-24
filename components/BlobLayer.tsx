'use client'

import React, { useEffect, useRef, useState } from 'react'

const BLOB_COUNT = 50
const SPREAD = 38  // vw/vh -- how far each corner cluster roams

interface Corner {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  hueBase: number
}

const CORNERS: Corner[] = [
  { xMin: 0,           xMax: SPREAD,      yMin: 0,           yMax: SPREAD,      hueBase: 0  },
  { xMin: 94 - SPREAD, xMax: 94,          yMin: 0,           yMax: SPREAD,      hueBase: 28 },
  { xMin: 0,           xMax: SPREAD,      yMin: 88 - SPREAD, yMax: 88,          hueBase: 56 },
  { xMin: 94 - SPREAD, xMax: 94,          yMin: 88 - SPREAD, yMax: 88,          hueBase: 84 },
]

interface BlobConfig {
  cornerIdx: number
  width: number
  height: number
  hueOffset: number
  opacity: number
  initialX: number
  initialY: number
  initialRadius: string
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function randomRadius(): string {
  const v = (): number => Math.floor(rand(28, 73))
  const a = v(), b = v(), c = v(), d = v()
  return `${a}% ${100 - a}% ${b}% ${100 - b}% / ${c}% ${d}% ${100 - d}% ${100 - c}%`
}

function generateConfigs(): BlobConfig[] {
  return Array.from({ length: BLOB_COUNT }, (_, i) => {
    const cornerIdx = i % 4
    const c = CORNERS[cornerIdx]
    const isBig = i % 3 !== 0
    return {
      cornerIdx,
      width:  Math.round(rand(isBig ? 130 : 70, isBig ? 260 : 130)),
      height: Math.round(rand(isBig ? 110 : 60, isBig ? 230 : 120)),
      hueOffset: c.hueBase + Math.round(rand(-18, 18)),
      opacity: rand(0.08, 0.18),
      initialX: rand(c.xMin, c.xMax),
      initialY: rand(c.yMin, c.yMax),
      initialRadius: randomRadius(),
    }
  })
}

export default function BlobLayer() {
  const [mounted, setMounted] = useState(false)

  // useRef for one-time init -- useMemo is not stable under React Strict Mode
  const configsRef = useRef<BlobConfig[] | null>(null)
  if (!configsRef.current) configsRef.current = generateConfigs()
  const configs = configsRef.current

  const blobRefs   = useRef<(HTMLElement | null)[]>([])
  // one slot per blob -- keeps memory flat at exactly BLOB_COUNT IDs
  const blobTimers = useRef<(ReturnType<typeof setTimeout> | null)[]>(
    new Array(BLOB_COUNT).fill(null)
  )

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    blobRefs.current.forEach((el, i) => {
      if (!el) return
      const c = CORNERS[configs[i].cornerIdx]

      function animate(): void {
        const moveDur  = rand(1.2, 4.5)
        const morphDur = rand(1.5, 5.0)
        el!.style.transition   = `transform ${moveDur.toFixed(2)}s ease-in-out, border-radius ${morphDur.toFixed(2)}s ease-in-out`
        el!.style.transform    = `translate(${rand(c.xMin, c.xMax).toFixed(1)}vw, ${rand(c.yMin, c.yMax).toFixed(1)}vh)`
        el!.style.borderRadius = randomRadius()
        blobTimers.current[i]  = setTimeout(animate, moveDur * 1000)
      }

      blobTimers.current[i] = setTimeout(animate, rand(0, 600))
    })

    return () => {
      blobTimers.current.forEach(id => { if (id !== null) clearTimeout(id) })
      blobTimers.current = new Array(BLOB_COUNT).fill(null)
    }
  }, [mounted])

  if (!mounted) return null

  return (
    <div aria-hidden="true">
      {configs.map((cfg, i) => (
        <div
          key={i}
          className="aurora-blob"
          ref={el => { blobRefs.current[i] = el }}
          style={{
            width:        cfg.width,
            height:       cfg.height,
            '--background': `hsl(calc(var(--theme-hue) + ${cfg.hueOffset}), 55%, 62%)`,
            background:   'var(--background)',
            opacity:      cfg.opacity,
            transform:    `translate(${cfg.initialX.toFixed(1)}vw, ${cfg.initialY.toFixed(1)}vh)`,
            borderRadius: cfg.initialRadius,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
