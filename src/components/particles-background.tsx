"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "@/lib/theme"

interface Particle {
  x: number; y: number
  vx: number; vy: number
  size: number; alpha: number
  life: number; maxLife: number
}

export function ParticlesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const animRef = useRef<number>(0)
  const { theme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const onMouse = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
    }
    window.addEventListener("mousemove", onMouse)
    window.addEventListener("mouseleave", () => {
      mouseRef.current.x = -1000; mouseRef.current.y = -1000
    })

    const isDark = theme === "dark"

    const spawn = (count: number) => {
      const w = canvas.width; const h = canvas.height
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4 - 0.15,
          size: Math.random() * 2.5 + 1,
          alpha: Math.random() * 0.5 + 0.15,
          life: 0, maxLife: Math.random() * 300 + 200,
        })
      }
    }
    spawn(80)

    const animate = () => {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      const w = canvas!.width; const h = canvas!.height
      const part = particlesRef.current
      const mx = mouseRef.current.x; const my = mouseRef.current.y

      for (let i = part.length - 1; i >= 0; i--) {
        const p = part[i]
        p.x += p.vx; p.y += p.vy
        p.life++
        p.alpha = Math.max(0, p.alpha - 0.001)

        const dx = p.x - mx; const dy = p.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 120) {
          const force = (120 - dist) / 120 * 0.8
          p.vx += (dx / dist) * force * 0.05
          p.vy += (dy / dist) * force * 0.05
        }

        p.vx *= 0.99; p.vy *= 0.99

        if (p.x < -20) p.x = w + 20
        if (p.x > w + 20) p.x = -20
        if (p.y < -20) p.y = h + 20
        if (p.y > h + 20) p.y = -20

        if (p.life > p.maxLife || p.alpha <= 0) {
          p.x = Math.random() * w
          p.y = h + 10
          p.vx = (Math.random() - 0.5) * 0.4
          p.vy = (Math.random() - 0.5) * 0.4 - 0.15
          p.alpha = Math.random() * 0.5 + 0.15
          p.life = 0
          p.maxLife = Math.random() * 300 + 200
        }

        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx!.fillStyle = isDark
          ? "rgba(148, 163, 184, " + p.alpha + ")"
          : "rgba(59, 130, 246, " + p.alpha * 0.6 + ")"
        ctx!.fill()
      }

      for (let i = 0; i < part.length; i++) {
        for (let j = i + 1; j < part.length; j++) {
          const dx = part[i].x - part[j].x
          const dy = part[i].y - part[j].y
          const dist2 = Math.sqrt(dx * dx + dy * dy)
          if (dist2 < 100) {
            ctx!.beginPath()
            ctx!.moveTo(part[i].x, part[i].y)
            ctx!.lineTo(part[j].x, part[j].y)
            const alpha = (1 - dist2 / 100) * 0.15
            ctx!.strokeStyle = isDark
              ? "rgba(148, 163, 184, " + alpha + ")"
              : "rgba(59, 130, 246, " + alpha * 0.5 + ")"
            ctx!.lineWidth = 0.5
            ctx!.stroke()
          }
        }
      }

      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onMouse)
    }
  }, [theme])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  )
}