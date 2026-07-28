"use client"

import { useEffect, useRef } from "react"

interface FlowPath {
  points: { x: number; y: number }[]
  phase: number
}

interface Particle {
  pathIdx: number
  t: number
  speed: number
  size: number
  alpha: number
}

export function ParticlesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pathsRef = useRef<FlowPath[]>([])
  const particlesRef = useRef<Particle[]>([])
  const animRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!

    function buildPaths(w: number, h: number): FlowPath[] {
      const paths: FlowPath[] = []
      for (let i = 0; i < 8; i++) {
        const pts: { x: number; y: number }[] = []
        const startY = (h / 9) * (i + 1)
        const amp = 40 + Math.sin(i * 1.7) * 25
        const freq = 0.004 + (i % 3) * 0.001
        for (let j = 0; j <= 120; j++) {
          const t = j / 120
          const x = t * w * 1.2 - w * 0.1
          const wave1 = Math.sin(x * freq + i * 1.2) * amp
          const wave2 = Math.sin(x * freq * 0.7 + i * 0.9) * amp * 0.5
          pts.push({ x, y: startY + wave1 + wave2 })
        }
        paths.push({ points: pts, phase: i * 0.3 })
      }
      for (let i = 0; i < 5; i++) {
        const pts: { x: number; y: number }[] = []
        const startX = (w / 6) * (i + 1) + (Math.random() - 0.5) * 60
        for (let j = 0; j <= 80; j++) {
          const t = j / 80
          const y = t * h * 1.1 - h * 0.05
          const drift = Math.sin(t * Math.PI * 3 + i) * 30
          pts.push({ x: startX + drift, y })
        }
        paths.push({ points: pts, phase: i * 0.5 })
      }
      return paths
    }

    function spawnParticles(paths: FlowPath[], count: number): Particle[] {
      const arr: Particle[] = []
      for (let i = 0; i < count; i++) {
        arr.push({
          pathIdx: Math.floor(Math.random() * paths.length),
          t: Math.random(),
          speed: 0.0006 + Math.random() * 0.0012,
          size: 0.5 + Math.random() * 1.2,
          alpha: 0.2 + Math.random() * 0.6,
        })
      }
      return arr
    }

    function getPathPos(path: FlowPath, t: number) {
      const len = path.points.length
      const idx = t * (len - 1)
      const i0 = Math.floor(idx)
      const i1 = Math.min(i0 + 1, len - 1)
      const frac = idx - i0
      return {
        x: path.points[i0].x + (path.points[i1].x - path.points[i0].x) * frac,
        y: path.points[i0].y + (path.points[i1].y - path.points[i0].y) * frac,
      }
    }

    let frame = 0
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      pathsRef.current = buildPaths(canvas.width, canvas.height)
      particlesRef.current = spawnParticles(pathsRef.current, 600)
    }
    resize()
    window.addEventListener("resize", resize)

    const animate = () => {
      frame++
      const w = canvas.width; const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const paths = pathsRef.current
      const particles = particlesRef.current

      for (let pi = 0; pi < paths.length; pi++) {
        const path = paths[pi]; const pts = path.points
        if (pts.length < 2) continue
        for (let i = 0; i < pts.length - 2; i += 2) {
          const t0 = i / (pts.length - 1)
          const alpha = 0.03 + Math.sin(t0 * Math.PI * 2 + path.phase + frame * 0.002) * 0.025
          if (alpha <= 0) continue
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i+2].x, pts[i+2].y)
          ctx.strokeStyle = "rgba(255,255,255," + Math.max(0, alpha).toFixed(3) + ")"
          ctx.lineWidth = 0.6; ctx.stroke()
        }
        for (let i = 0; i < pts.length - 1; i++) {
          const alpha = 0.08 + Math.sin(i * 0.05 - frame * 0.008 + path.phase) * 0.06
          if (alpha <= 0) continue
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[i+1].x, pts[i+1].y)
          ctx.strokeStyle = "rgba(255,255,255," + Math.max(0, alpha).toFixed(3) + ")"
          ctx.lineWidth = 0.3; ctx.stroke()
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]; const path = paths[p.pathIdx]
        if (!path || path.points.length < 2) continue
        p.t += p.speed
        if (p.t >= 1) {
          p.t = 0; p.pathIdx = Math.floor(Math.random() * paths.length)
          p.speed = 0.0006 + Math.random() * 0.0012
          p.size = 0.5 + Math.random() * 1.2
          p.alpha = 0.2 + Math.random() * 0.6
        }
        const pos = getPathPos(path, p.t)
        const flicker = 0.7 + Math.sin(frame * 0.05 + i) * 0.3
        const a = Math.min(1, p.alpha * flicker)
        ctx.beginPath(); ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(255,255,255," + a.toFixed(3) + ")"
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />
}
