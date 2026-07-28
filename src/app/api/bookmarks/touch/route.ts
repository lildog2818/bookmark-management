import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "缺少书签 ID" }, { status: 400 })

    await prisma.$executeRaw`UPDATE "Bookmark" SET "lastUsedAt" = NOW() WHERE "id" = ${id} AND "userId" = ${session.user.id}`

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("Touch error:", e instanceof Error ? e.message : e)
    return NextResponse.json({ error: "更新失败" }, { status: 500 })
  }
}