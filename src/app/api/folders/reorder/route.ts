import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })
  try {
    const { folderIds } = await req.json()
    if (!Array.isArray(folderIds)) return NextResponse.json({ error: "参数错误" }, { status: 400 })
    await Promise.all(folderIds.map((id: string, i: number) =>
      prisma.folder.updateMany({ where: { id, userId: session.user.id }, data: { order: i } })
    ))
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: "排序失败" }, { status: 500 }) }
}
