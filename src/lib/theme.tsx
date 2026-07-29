"use client"

import { createContext, useContext, useEffect, useState } from "react"

export interface ThemePreset {
  id: string
  name: string
  icon: string
  dark: boolean
  colors: {
    bg: string       // 背景色
    card: string     // 卡片色
    primary: string  // 主色调
    accent: string   // 强调色
  }
}

export const themes: ThemePreset[] = [
  { id: "default", name: "默认", icon: "○", dark: false, colors: { bg: "#ffffff", card: "#ffffff", primary: "#18181b", accent: "#f4f4f5" } },
  { id: "dark", name: "暗夜", icon: "●", dark: true, colors: { bg: "#0b1120", card: "#1e293b", primary: "#e2e8f0", accent: "#334155" } },
  { id: "ocean", name: "海洋", icon: "◉", dark: false, colors: { bg: "#f0f7ff", card: "#ffffff", primary: "#2563eb", accent: "#dbeafe" } },
  { id: "forest", name: "森林", icon: "◈", dark: false, colors: { bg: "#f0fdf4", card: "#ffffff", primary: "#16a34a", accent: "#dcfce7" } },
  { id: "sunset", name: "日落", icon: "◎", dark: true, colors: { bg: "#1c1017", card: "#2d1a24", primary: "#f59e0b", accent: "#3d2533" } },
  { id: "sakura", name: "樱花", icon: "◇", dark: false, colors: { bg: "#fdf2f8", card: "#ffffff", primary: "#db2777", accent: "#fce7f3" } },
  { id: "minimal", name: "极简", icon: "□", dark: false, colors: { bg: "#fafafa", card: "#ffffff", primary: "#09090b", accent: "#e5e5e5" } },
  { id: "slate", name: "墨绿", icon: "◧", dark: true, colors: { bg: "#0f172a", card: "#1e293b", primary: "#64748b", accent: "#334155" } },
]

type ThemeContextType = {
  theme: ThemePreset
  setThemeId: (id: string) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: themes[0],
  setThemeId: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemePreset>(themes[0])
  const [mounted, setMounted] = useState(false)

  const applyTheme = (t: ThemePreset) => {
    document.documentElement.setAttribute("data-theme", t.id)
    document.documentElement.classList.toggle("dark", t.dark)
    localStorage.setItem("theme-id", t.id)
  }

  useEffect(() => {
    setMounted(true)
    const storedId = localStorage.getItem("theme-id") || "default"
    const t = themes.find((x) => x.id === storedId) || themes[0]
    setTheme(t)
    applyTheme(t)
  }, [])

  const setThemeId = (id: string) => {
    const t = themes.find((x) => x.id === id) || themes[0]
    setTheme(t)
    applyTheme(t)
  }

  if (!mounted) return <>{children}</>

  return (
    <ThemeContext.Provider value={{ theme, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)