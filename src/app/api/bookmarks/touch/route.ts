import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    console.log("[touch] 未登录")
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  try {
    const { id } = await req.json()
    console.log("[touch] 收到请求", { id, userId: session.user.id })

    if (!id) {
      console.log("[touch] 缺少 id")
      return NextResponse.json({ error: "缺少书签 ID" }, { status: 400 })
    }

    // 先用 findFirst 确认书签存在
    const bm = await prisma.bookmark.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, title: true },
    })
    console.log("[touch] findFirst 结果:", bm)

    if (!bm) {
      console.log("[touch] 书签不存在或无权限")
      return NextResponse.json({ error: "书签不存在" }, { status: 404 })
    }

    // 用 Prisma ORM 直接更新
    const result = await prisma.bookmark.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    })
    console.log("[touch] update 结果:", { id: result.id, lastUsedAt: result.lastUsedAt })

    return NextResponse.json({ success: true, lastUsedAt: result.lastUsedAt })
  } catch (e) {
    console.error("[touch] 错误:", e)
    return NextResponse.json({ error: "更新失败" }, { status: 500 })
  }
}