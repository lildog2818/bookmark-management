import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: session.user.id },
    })

    // Group by normalized URL
    const groups = new Map<string, typeof bookmarks>()
    for (const bm of bookmarks) {
      const key = bm.url.trim().toLowerCase()
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(bm)
    }

    // Only return groups with duplicates
    const duplicates = Array.from(groups.entries())
      .filter(([, list]) => list.length > 1)
      .map(([url, list]) => ({
        url,
        count: list.length,
        bookmarks: list.sort((a, b) => a.id.localeCompare(b.id)),
      }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      total: duplicates.length,
      duplicates,
    })
  } catch (error) {
    console.error("检测重复失败:", error)
    return NextResponse.json({ error: "检测失败" }, { status: 500 })
  }
}
