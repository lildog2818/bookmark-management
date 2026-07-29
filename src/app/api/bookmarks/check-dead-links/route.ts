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
    const timeout = 3000

    for (let i = 0; i < bookmarksToCheck.length; i += batchSize) {
      const batch = bookmarksToCheck.slice(i, i + batchSize)
      
      const results = await Promise.all(
        batch.map(async (bookmark) => {
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), timeout)
            
            const response = await fetch(bookmark.url, {
              method: 'HEAD',
              signal: controller.signal,
              redirect: 'follow',
              headers: {
                'User-Agent': 'Bookmark-Manager/1.0'
              }
            })
            
            clearTimeout(timeoutId)
            
            if (!response.ok) {
              return { ...bookmark, status: response.status }
            }
            return null
          } catch (error: any) {
            if (error.name === 'AbortError') {
              return { ...bookmark, status: 'timeout' }
            }
            // 网络错误也视为死链
            return { ...bookmark, status: 'error' }
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
