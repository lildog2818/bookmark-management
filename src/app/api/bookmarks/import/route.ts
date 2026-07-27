import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextResponse } from "next/server"

interface ParsedFolder {
  name: string
  parentIndex: number | null
  index: number
}

interface ParsedBookmark {
  title: string
  url: string
  folderIndex: number | null
}

function parseBookmarkHTML(html: string): { folders: ParsedFolder[]; bookmarks: ParsedBookmark[] } {
  const folders: ParsedFolder[] = []
  const bookmarks: ParsedBookmark[] = []
  const folderStack: number[] = []
  let currentFolderIndex: number | null = null

  // 按行解析
  const lines = html.split("\n")
  const folderPattern = /<H3[^>]*>(.*?)<\/H3>/i
  const linkPattern = /<A\s+HREF="([^"]*)"[^>]*(?:ICON="([^"]*)")?[^>]*>(.*?)<\/A>/i
  const dlStartPattern = /<DL>/i
  const dlEndPattern = /<\/DL>/i

  for (const line of lines) {
    const trimmed = line.trim()

    if (folderPattern.test(trimmed)) {
      const match = trimmed.match(folderPattern)
      if (match) {
        const folderIndex = folders.length
        folders.push({
          name: match[1].trim(),
          parentIndex: currentFolderIndex,
          index: folderIndex,
        })
        folderStack.push(folderIndex)
        currentFolderIndex = folderIndex
      }
    } else if (linkPattern.test(trimmed)) {
      const match = trimmed.match(linkPattern)
      if (match) {
        bookmarks.push({
          title: match[3].trim() || match[1],
          url: match[1],
          folderIndex: currentFolderIndex,
        })
      }
    } else if (dlEndPattern.test(trimmed)) {
      folderStack.pop()
      currentFolderIndex = folderStack.length > 0 ? folderStack[folderStack.length - 1] : null
    }
  }

  return { folders, bookmarks }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "请上传书签文件" }, { status: 400 })
    }

    const html = await file.text()
    const { folders: parsedFolders, bookmarks: parsedBookmarks } = parseBookmarkHTML(html)

    // 创建文件夹映射
    const folderIdMap = new Map<number, string>()

    // 先创建所有文件夹（按层级顺序）
    for (const pf of parsedFolders) {
      const folder = await prisma.folder.create({
        data: {
          name: pf.name,
          userId: session.user.id,
          parentId: pf.parentIndex !== null ? folderIdMap.get(pf.parentIndex) || null : null,
        },
      })
      folderIdMap.set(pf.index, folder.id)
    }

    // 批量创建书签
    let createdCount = 0
    for (const pb of parsedBookmarks) {
      await prisma.bookmark.create({
        data: {
          title: pb.title,
          url: pb.url,
          userId: session.user.id,
          folderId: pb.folderIndex !== null ? folderIdMap.get(pb.folderIndex) || null : null,
        },
      })
      createdCount++
    }

    return NextResponse.json({
      success: true,
      foldersCreated: parsedFolders.length,
      bookmarksCreated: createdCount,
    })
  } catch (err) {
    console.error("Import error:", err)
    return NextResponse.json({ error: "导入失败，请检查文件格式" }, { status: 500 })
  }
}