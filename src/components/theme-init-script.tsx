"use client"

import { useEffect } from "react"
import { themes } from "@/lib/theme"

/**
 * 在客户端 hydration 前设置 data-theme 和 dark class，
 * 防止页面加载时出现主题闪烁（FOUC）。
 */
export function ThemeInitScript() {
  useEffect(() => {
    const storedId = localStorage.getItem("theme-id")
    if (storedId) {
      const t = themes.find((x) => x.id === storedId)
      if (t) {
        document.documentElement.setAttribute("data-theme", t.id)
        document.documentElement.classList.toggle("dark", t.dark)
        return
      }
    }
    // 默认主题
    document.documentElement.setAttribute("data-theme", "default")
    document.documentElement.classList.remove("dark")
  }, [])

  return null
}