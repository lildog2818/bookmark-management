"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "@/lib/theme"

interface Particle {
  x: number; y: number
  vx: number; vy: number
  size: number; alpha: number
  phase: number
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return { r, g, b }
}

export function ParticlesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animRef = useRef<number>(0)
  const { theme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext("2d")!
    let w = 0, h = 0, frame = 0

    function spawn(count: number) {
      const arr: Particle[] = []
      for (let i = 0; i < count; i++) {
        arr.push({
          x: Math.random() * w * 1.2 - w * 0.1,
          y: Math.random() * h * 1.1 - h * 0.05,
          vx: -(0.08 + Math.random() * 0.15),
          vy: 0.04 + Math.random() * 0.12,
          size: 1.2 + Math.random() * 2.0,
          alpha: 0.15 + Math.random() * 0.5,
          phase: Math.random() * Math.PI * 2,
        })
      }
      return arr
    }

    const resize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
      particlesRef.current = spawn(400)
    }
    resize()
    window.addEventListener("resize", resize)

    const animate = () => {
      frame++; ctx.clearRect(0, 0, w, h)
      const pts = particlesRef.current

      // 根据主题决定粒子颜色
      const isDark = theme.dark
      const rgb = hexToRgb(theme.colors.primary)
      const particleColor = isDark
        ? `rgba(${rgb.r},${rgb.g},${rgb.b},`
        : `rgba(${rgb.r},${rgb.g},${rgb.b},`

      // Dynamic flow lines
      for (let li = 0; li < 14; li++) {
        const baseY = h * 0.06 + (li / 14) * h * 0.82
        const amp = 20 + Math.sin(li * 0.9) * 12
        const freq = 0.005 + (li % 4) * 0.001
        const phaseOff = li * 0.7 + frame * 0.002
        ctx.beginPath(); let first = true
        for (let j = 0; j <= 80; j++) {
          const t = j / 80
          const x = w * 1.15 - t * w * 1.3
          const wave = Math.sin(x * freq + phaseOff) * amp + Math.sin(x * freq * 0.5 + phaseOff * 1.3) * amp * 0.4
          const y = baseY + t * h * 0.3 + wave * 0.5
          if (first) { ctx.moveTo(x, y); first = false } else ctx.lineTo(x, y)
        }
        const la = isDark
          ? 0.03 + Math.sin(frame * 0.004 + li * 0.8) * 0.025
          : 0.015 + Math.sin(frame * 0.004 + li * 0.8) * 0.012
        ctx.strokeStyle = `${particleColor}${Math.max(0.01, la).toFixed(3)})`
        ctx.lineWidth = 0.5; ctx.stroke()
      }

      // Particles
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        p.x += p.vx; p.y += p.vy
        p.x += Math.sin(frame * 0.008 + p.phase + i * 0.1) * 0.15
        p.y += Math.cos(frame * 0.01 + p.phase + i * 0.07) * 0.1
        if (p.x < -w * 0.1 || p.y > h * 1.1) {
          p.x = w * 1.05 + Math.random() * w * 0.1
          p.y = -h * 0.05 + Math.random() * h * 0.1
          p.vx = -(0.08 + Math.random() * 0.15)
          p.vy = 0.04 + Math.random() * 0.12
          p.alpha = 0.15 + Math.random() * 0.5
          p.phase = Math.random() * Math.PI * 2
        }
        const flicker = 0.75 + Math.sin(frame * 0.04 + i * 0.5) * 0.25
        const a = Math.min(1, p.alpha * flicker)
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `${particleColor}${a.toFixed(3)})`
        ctx.fill()
      }

      // Connections
      for (let i = 0; i < pts.length; i += 3) {
        for (let j = i + 3; j < pts.length; j += 3) {
          const dx = pts[i].x - pts[j].x
          const dy = pts[i].y - pts[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 70) {
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y)
            ctx.strokeStyle = `${particleColor}${((1 - dist / 70) * 0.05).toFixed(3)})`
            ctx.lineWidth = 0.3; ctx.stroke()
          }
        }
      }
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize) }
  }, [theme])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none -z-10" />
}