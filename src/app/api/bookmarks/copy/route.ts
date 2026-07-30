import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  try {
    const { bookmarkIds, folderId } = await req.json()
    if (!bookmarkIds?.length || !folderId) {
      return NextResponse.json({ error: "缺少参数" }, { status: 400 })
    }

    // 验证文件夹归属
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId: session.user.id },
    })
    if (!folder) {
      return NextResponse.json({ error: "文件夹不存在" }, { status: 403 })
    }

    // 获取要复制的书签
    const bookmarks = await prisma.bookmark.findMany({
      where: { id: { in: bookmarkIds }, userId: session.user.id },
    })

    // 批量创建副本
    const created = await Promise.all(
      bookmarks.map((bm) =>
        prisma.bookmark.create({
          data: {
            title: bm.title,
            url: bm.url,
            description: bm.description,
            notes: bm.notes,
            favicon: bm.favicon,
            folderId,
            userId: session.user.id,
          },
        })
      )
    )

    return NextResponse.json({ success: true, count: created.length })
  } catch (error) {
    console.error("复制书签失败:", error)
    return NextResponse.json({ error: "复制失败" }, { status: 500 })
  }
}