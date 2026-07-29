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

// Safari 导出 .plist 格式解析
// 结构: WebBookmarkTypeList = 文件夹, WebBookmarkTypeLeaf = 书签
function parseSafariPlist(xml: string): { folders: ParsedFolder[]; bookmarks: ParsedBookmark[] } {
  const folders: ParsedFolder[] = []
  const bookmarks: ParsedBookmark[] = []
  const folderStack: number[] = []
  let currentFolderIndex: number | null = null

  // 将 XML 按标签切分为 token 数组
  const tokens = xml.split(/(<[^>]+>)/g).filter((t) => t.trim())

  let currentType = "" // "folder" | "bookmark" | ""
  let folderName = ""
  let pendingTitle = ""
  let pendingUrl = ""
  let inURIDict = false
  let skipTopLevel = true // 跳过 Safari 顶层 "Bookmarks" 根节点

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim()
    if (!token) continue

    if (token === "<dict>") {
      // 进入一个 dict 块
    } else if (token === "</dict>") {
      // 结束一个 dict 块
      if (currentType === "bookmark" && pendingUrl) {
        bookmarks.push({
          title: pendingTitle || pendingUrl,
          url: pendingUrl,
          folderIndex: currentFolderIndex,
        })
      }
      currentType = ""
      pendingTitle = ""
      pendingUrl = ""
      inURIDict = false
    } else if (token === "<array>") {
      // 进入 children 数组
      if (currentType === "folder" && folderName) {
        if (skipTopLevel && folderStack.length === 0) {
          // Safari 第一个文件夹是顶层 "Bookmarks" 或 "BookmarkBar" 的容器
          // 跳过它，但把它的子文件夹作为根级别
          skipTopLevel = false
          // 不创建这个文件夹，但把它作为当前上下文
          folderStack.push(-1) // 用 -1 标记跳过
          currentFolderIndex = null
        } else {
          const idx = folders.length
          folders.push({
            name: folderName,
            parentIndex: currentFolderIndex,
            index: idx,
          })
          folderStack.push(idx)
          currentFolderIndex = idx
        }
        folderName = ""
      }
    } else if (token === "</array>") {
      // 退出 children 数组
      if (folderStack.length > 0) {
        const popped = folderStack.pop()!
        if (popped === -1) {
          // 恢复跳过状态
          currentFolderIndex = null
        } else {
          currentFolderIndex = folderStack.length > 0 ? folderStack[folderStack.length - 1] : null
          if (currentFolderIndex === -1) currentFolderIndex = null
        }
      }
    } else if (token === "<key>") {
      const keyValue = tokens[i + 1]?.trim() || ""
      if (keyValue === "WebBookmarkType") {
        // 下一个 <string> 的值决定类型
        const stringValue = tokens[i + 4]?.trim() || "" // 跳过 </key>, <string>, 值, </string>
        if (stringValue === "WebBookmarkTypeList") {
          currentType = "folder"
        } else if (stringValue === "WebBookmarkTypeLeaf") {
          currentType = "bookmark"
        }
      } else if (keyValue === "Title" && currentType === "folder") {
        const stringValue = tokens[i + 4]?.trim() || ""
        folderName = stringValue
      } else if (keyValue === "URLString" && currentType === "bookmark") {
        const stringValue = tokens[i + 4]?.trim() || ""
        pendingUrl = stringValue
      } else if (keyValue === "URIDictionary") {
        inURIDict = true
      } else if (keyValue === "title" && inURIDict) {
        const stringValue = tokens[i + 4]?.trim() || ""
        pendingTitle = stringValue
      }
    }
  }

  return { folders, bookmarks }
}

// 检测文件格式：plist 以 <?xml 或 <plist 开头
function detectFormat(content: string): "html" | "plist" {
  const head = content.trim().slice(0, 200).toLowerCase()
  if (head.includes("<plist") || head.includes("<?xml") && head.includes("plist")) {
    return "plist"
  }
  return "html"
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  try {
    // 读取 body 大小限制（5MB）
    const contentLength = req.headers.get("content-length")
    if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "文件不能超过 5MB" }, { status: 400 })
    }
    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "请上传书签文件" }, { status: 400 })
    }

    // 文件大小校验
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "文件不能超过 5MB" }, { status: 400 })
    }
    const html = await file.text()
    const format = detectFormat(html)
    const { folders: parsedFolders, bookmarks: parsedBookmarks } =
      format === "plist" ? parseSafariPlist(html) : parseBookmarkHTML(html)

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