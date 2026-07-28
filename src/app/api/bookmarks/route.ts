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
    orderBy: [{ lastUsedAt: "desc" }, { order: "asc" }],
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
    const body = await req.json()
    const { id, title, url, folderId } = body as Record<string, string | null | undefined>
    if (!id) return NextResponse.json({ error: "缺少书签 ID" }, { status: 400 })

    const sets: string[] = ['"lastUsedAt" = NOW()']
    const params: (string | null)[] = []

    if (folderId !== undefined) {
      if (folderId) {
        const folder = await prisma.folder.findFirst({
          where: { id: folderId, userId: session.user.id },
        })
        if (!folder) return NextResponse.json({ error: "文件夹不存在" }, { status: 403 })
      }
      params.push(folderId || null)
      sets.push('"folderId" = $' + params.length)
    }

    if (url !== undefined && url !== null) {
      if (!validateUrl(url)) return NextResponse.json({ error: "仅支持 http/https 链接" }, { status: 400 })
      if (url.length > 2048) return NextResponse.json({ error: "URL 过长" }, { status: 400 })
      params.push(url)
      sets.push('"url" = $' + params.length)
    }

    if (title !== undefined) {
      params.push(String(title).slice(0, 500))
      sets.push('"title" = $' + params.length)
    }

    params.push(id, session.user.id)
    const sql = 'UPDATE "Bookmark" SET ' + sets.join(", ") + ' WHERE "id" = $' + (params.length - 1) + ' AND "userId" = $' + params.length

    await prisma.$executeRawUnsafe(sql, ...params)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("PATCH error:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "更新失败" }, { status: 500 })
  }
}