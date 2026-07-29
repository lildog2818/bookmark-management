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

    // 只将这些状态码视为死链（明确表示页面不存在或已删除）
    const DEAD_STATUS_CODES = new Set([404, 410, 451])

    for (let i = 0; i < bookmarksToCheck.length; i += batchSize) {
      const batch = bookmarksToCheck.slice(i, i + batchSize)

      const results = await Promise.all(
        batch.map(async (bookmark) => {
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), timeout)

            // 使用 GET 请求（很多站点不支持 HEAD）+ 真实浏览器 UA
            const response = await fetch(bookmark.url, {
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

            // 只将明确表示"页面不存在"的状态码视为死链
            if (DEAD_STATUS_CODES.has(response.status)) {
              return { ...bookmark, status: response.status }
            }
            return null
          } catch (error: any) {
            // 网络错误和超时不计为死链（可能是代理/网络问题，不代表链接失效）
            return null
          }
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
