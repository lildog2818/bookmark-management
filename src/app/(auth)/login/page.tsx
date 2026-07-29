"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useTheme, themes } from "@/lib/theme"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { theme, setThemeId } = useTheme()
  const [showPicker, setShowPicker] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const result = await signIn("credentials", { email, password, redirect: false })
    if (result?.error) {
      setError("邮箱或密码错误")
      setLoading(false)
    } else {
      router.push("/dashboard")
      router.refresh()
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-purple-500/15 blur-3xl" />
      </div>

      {/* 主题切换 */}
      <div className="fixed right-4 top-4 z-50">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="rounded-lg border bg-card p-2 shadow-sm transition-colors hover:bg-muted"
        >
          <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: theme.colors.primary, borderColor: theme.dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }} />
        </button>
        {showPicker && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
            <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border bg-card py-1 shadow-lg">
              {themes.map((t) => (
                <button key={t.id} onClick={() => { setThemeId(t.id); setShowPicker(false) }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted ${theme.id === t.id ? 'bg-muted font-medium' : ''}`}>
                  <div className="h-4 w-4 shrink-0 rounded-full border" style={{ backgroundColor: t.colors.primary, borderColor: t.dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }} />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 登录卡片 */}
      <div className="animate-scale-in w-full max-w-sm rounded-2xl border bg-card/80 p-8 shadow-xl backdrop-blur-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">欢迎回来</h1>
          <p className="mt-1 text-sm text-muted-foreground">登录以管理您的书签</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium">
              邮箱
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium">
              密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="animate-fade-in rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          还没有账号？{" "}
          <Link href="/register" className="font-medium text-primary transition-colors hover:text-primary/80">
            注册
          </Link>
        </p>
      </div>
    </div>
  )
}
