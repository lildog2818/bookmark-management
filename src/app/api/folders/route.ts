import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  try {
    const { name, parentId, color } = await req.json()
    const folder = await prisma.folder.create({
      data: {
        name,
        color: color || null,
        parentId: parentId || null,
        userId: session.user.id,
      },
    })
    return NextResponse.json(folder, { status: 201 })
  } catch {
    return NextResponse.json({ error: "创建失败" }, { status: 500 })
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  const folders = await prisma.folder.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(folders)
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  try {
    const { id } = await req.json()
    await prisma.folder.deleteMany({
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
    const { id, name, priority } = await req.json()
    if (!id) return NextResponse.json({ error: "缺少文件夹 ID" }, { status: 400 })

    const data: any = {}
    if (name !== undefined) data.name = name
    if (priority !== undefined) data.priority = priority

    await prisma.folder.updateMany({
      where: { id, userId: session.user.id },
      data,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 500 })
  }
}