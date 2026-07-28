"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useTheme } from "@/lib/theme"
import { Sun, Moon } from "lucide-react"

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { theme, toggle } = useTheme()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const formData = new FormData(e.currentTarget)
    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const password = formData.get("password") as string
    const confirm = formData.get("confirmPassword") as string
    if (password !== confirm) { setError("两次密码不一致"); setLoading(false); return }
    if (password.length < 6) { setError("密码至少 6 位"); setLoading(false); return }
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "注册失败"); setLoading(false); return }
      router.push("/login")
    } catch {
      setError("网络错误，请重试")
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-purple-500/15 blur-3xl" />
      </div>

      <button
        onClick={toggle}
        className="fixed right-4 top-4 z-50 rounded-lg border bg-card p-2 shadow-sm transition-colors hover:bg-muted"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="animate-scale-in w-full max-w-sm rounded-2xl border bg-card/80 p-8 shadow-xl backdrop-blur-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">创建账号</h1>
          <p className="mt-1 text-sm text-muted-foreground">注册以开始管理您的书签</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium">昵称</label>
            <input id="name" name="name" type="text"
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="您的昵称" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium">邮箱</label>
            <input id="email" name="email" type="email" required
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="your@email.com" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium">密码</label>
            <input id="password" name="password" type="password" required
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="至少 6 位" />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium">确认密码</label>
            <input id="confirmPassword" name="confirmPassword" type="password" required
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="再次输入密码" />
          </div>

          {error && (
            <p className="animate-fade-in rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50"
          >
            {loading ? "注册中..." : "注册"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          已有账号？{" "}
          <Link href="/login" className="font-medium text-primary transition-colors hover:text-primary/80">登录</Link>
        </p>
      </div>
    </div>
  )
}
