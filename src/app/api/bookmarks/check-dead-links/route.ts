import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: session.user.id },
      select: { id: true, url: true, title: true },
    })

    const deadLinks: Array<{ id: string; url: string; title: string; status: number | string }> = []
    const batchSize = 5
    const timeout = 5000

    for (let i = 0; i < bookmarks.length; i += batchSize) {
      const batch = bookmarks.slice(i, i + batchSize)
      
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
            return { ...bookmark, status: 'error' }
          }
        })
      )
      
      deadLinks.push(...results.filter((r): r is NonNullable<typeof r> => r !== null))
    }

    return NextResponse.json({
      total: bookmarks.length,
      deadCount: deadLinks.length,
      deadLinks,
    })
  } catch (error) {
    console.error("Dead link check error:", error)
    return NextResponse.json({ error: "检测失败" }, { status: 500 })
  }
}
