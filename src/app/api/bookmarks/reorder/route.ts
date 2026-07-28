import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  try {
    const { folderId, bookmarkIds } = await req.json()
    if (!Array.isArray(bookmarkIds)) return NextResponse.json({ error: "参数错误" }, { status: 400 })

    // Update order for each bookmark based on its position in the array
    await Promise.all(
      bookmarkIds.map((id: string, index: number) =>
        prisma.bookmark.updateMany({
          where: { id, userId: session.user.id },
          data: { order: index, folderId: folderId || null },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("排序失败:", error)
    return NextResponse.json({ error: "排序失败" }, { status: 500 })
  }
}
