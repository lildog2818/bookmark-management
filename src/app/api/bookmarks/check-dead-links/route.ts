import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

export const maxDuration = 60 // Vercel 允许的最大执行时间（秒）

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: session.user.id },
      select: { id: true, url: true, title: true },
    })

    // 限制检查数量，避免超时
    const bookmarksToCheck = bookmarks.slice(0, 50)
    const deadLinks: Array<{ id: string; url: string; title: string; status: number | string }> = []
    const batchSize = 3
    const timeout = 5000

    // 死链状态码：404/410/451 = 页面不存在/已删除；521-530 = Cloudflare 源站错误
    const DEAD_STATUS_CODES = new Set([404, 410, 451, 521, 522, 523, 524, 525, 526, 527, 530])

    async function checkUrl(url: string): Promise<number | string | null> {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          }
        })
        clearTimeout(timeoutId)
        if (DEAD_STATUS_CODES.has(response.status)) return response.status
        return null
      } catch (error: unknown) {
        clearTimeout(timeoutId)
        // DNS 解析失败或连接被拒 → 域名/服务器确实不可达，视为死链
        const err = error as { cause?: { code?: string }; code?: string }
        const code = err?.cause?.code || err?.code || ''
        if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ENETUNREACH') {
          return code
        }
        // 超时等不计为死链（可能是网络问题）
        return null
      }
    }

    for (let i = 0; i < bookmarksToCheck.length; i += batchSize) {
      const batch = bookmarksToCheck.slice(i, i + batchSize)

      const results = await Promise.all(
        batch.map(async (bookmark) => {
          // 先检查完整 URL
          const status = await checkUrl(bookmark.url)
          if (status !== null) return { ...bookmark, status }

          // 如果 URL 包含 hash，去掉 hash 后检查 base URL
          // hash 路由不发送到服务器，需要检查 base URL 是否可达
          const hashIndex = bookmark.url.indexOf('#')
          if (hashIndex > 0) {
            const baseUrl = bookmark.url.slice(0, hashIndex)
            const baseStatus = await checkUrl(baseUrl)
            if (baseStatus !== null) return { ...bookmark, status: baseStatus }
          }

          return null
        })
      )

      deadLinks.push(...results.filter((r): r is NonNullable<typeof r> => r !== null))
    }

    return NextResponse.json({
      total: bookmarks.length,
      checked: bookmarksToCheck.length,
      deadCount: deadLinks.length,
      deadLinks,
    })
  } catch (error) {
    console.error("Dead link check error:", error)
    return NextResponse.json({ error: "检测失败" }, { status: 500 })
  }
}
