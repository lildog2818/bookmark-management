import { hash } from "bcryptjs"
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: "邮箱和密码必填" }, { status: 400 })
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email) || email.length > 254) {
      return NextResponse.json({ error: "邮箱格式无效" }, { status: 400 })
    }

    // 密码强度验证（服务端兜底）
    if (password.length < 8) {
      return NextResponse.json({ error: "密码至少需要 8 个字符" }, { status: 400 })
    }

    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) {
      // 防用户枚举：返回通用消息
      return NextResponse.json({ error: "注册失败，请重试" }, { status: 400 })
    }

    const hashedPassword = await hash(password, 12)

    // 名称清理：去除 HTML 标签，限制长度
    const sanitizedName = (name || email.split("@")[0])
      .replace(/<[^>]*>/g, "")
      .slice(0, 100)

    await prisma.user.create({
      data: {
        email,
        name: sanitizedName,
        password: hashedPassword,
      },
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 })
  }
}