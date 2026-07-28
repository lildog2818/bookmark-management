import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "缺少书签 ID" }, { status: 400 })

    await prisma.bookmark.updateMany({
      where: { id, userId: session.user.id },
      data: { lastUsedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 })
  }
}