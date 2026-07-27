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