import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ["http:", "https:"].includes(parsed.protocol)
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  try {
    const { title, url, description, folderId } = await req.json()
    if (!url) return NextResponse.json({ error: "URL 必填" }, { status: 400 })

    // URL 协议验证：仅允许 http/https
    if (!validateUrl(url)) {
      return NextResponse.json({ error: "仅支持 http/https 链接" }, { status: 400 })
    }

    // 长度限制
    if (url.length > 2048) {
      return NextResponse.json({ error: "URL 过长" }, { status: 400 })
    }
    const safeTitle = (title || url).slice(0, 500)

    // 验证 folderId 归属（如果提供）
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, userId: session.user.id },
      })
      if (!folder) {
        return NextResponse.json({ error: "文件夹不存在" }, { status: 403 })
      }
    }

    const bookmark = await prisma.bookmark.create({
      data: {
        title: safeTitle,
        url,
        description: description?.slice(0, 1000) || null,
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
    const { id, title, url, folderId } = await req.json()
    if (!id) return NextResponse.json({ error: "缺少书签 ID" }, { status: 400 })

    // 构建更新数据
    const data: Record<string, unknown> = {}

    if (folderId !== undefined) {
      // 验证目标 folderId 归属
      if (folderId) {
        const folder = await prisma.folder.findFirst({
          where: { id: folderId, userId: session.user.id },
        })
        if (!folder) {
          return NextResponse.json({ error: "文件夹不存在" }, { status: 403 })
        }
      }
      data.folderId = folderId || null
    }

    if (url !== undefined) {
      if (!validateUrl(url)) {
        return NextResponse.json({ error: "仅支持 http/https 链接" }, { status: 400 })
      }
      if (url.length > 2048) {
        return NextResponse.json({ error: "URL 过长" }, { status: 400 })
      }
      data.url = url
    }

    if (title !== undefined) {
      data.title = String(title).slice(0, 500)
    }

    const result = await prisma.bookmark.updateMany({
      where: { id, userId: session.user.id },
      data,
    })

    if (result.count === 0) {
      return NextResponse.json({ error: "书签不存在或无权限" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 })
  }
}