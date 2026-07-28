import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  try {
    const { title, url, description, folderId } = await req.json()
    if (!url) return NextResponse.json({ error: "URL 必填" }, { status: 400 })

    const bookmark = await prisma.bookmark.create({
      data: {
        title: title || url,
        url,
        description: description || null,
        folderId: folderId || null,
        userId: session.user.id,
      },
    })
    return NextResponse.json(bookmark, { status: 201 })
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 })
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: session.user.id },
    orderBy: { order: "asc" },
  })
  return NextResponse.json(bookmarks)
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  try {
    const { id } = await req.json()
    await prisma.bookmark.deleteMany({
      where: { id, userId: session.user.id },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "删除失败" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  try {
    const { id, folderId } = await req.json()
    if (!id) return NextResponse.json({ error: "缺少书签 ID" }, { status: 400 })

    const bookmark = await prisma.bookmark.updateMany({
      where: { id, userId: session.user.id },
      data: { folderId: folderId || null },
    })

    if (bookmark.count === 0) {
      return NextResponse.json({ error: "书签不存在或无权限" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 })
  }
}