import { auth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 })

  const format = req.nextUrl.searchParams.get("format") || "json"

  try {
    const [folders, bookmarks] = await Promise.all([
      prisma.folder.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.bookmark.findMany({
        where: { userId: session.user.id },
        orderBy: { order: "asc" },
      }),
    ])

    if (format === "html") {
      const html = generateHtmlExport(folders, bookmarks)
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="bookmarks-${new Date().toISOString().slice(0, 10)}.html"`,
        },
      })
    }

    // JSON 格式 —— 构建树形结构
    const tree = buildFolderTree(folders, bookmarks, null)
    return NextResponse.json(tree)
  } catch (error) {
    console.error("导出失败:", error)
    return NextResponse.json({ error: "导出失败" }, { status: 500 })
  }
}

interface FlatFolder {
  id: string
  name: string
  color: string | null
  icon: string | null
  parentId: string | null
}

interface FlatBookmark {
  id: string
  title: string
  url: string
  description: string | null
  favicon: string | null
  order: number
  folderId: string | null
}

interface TreeNode {
  id: string
  name: string
  color: string | null
  icon: string | null
  children: TreeNode[]
  bookmarks: FlatBookmark[]
}

function buildFolderTree(
  folders: FlatFolder[],
  bookmarks: FlatBookmark[],
  parentId: string | null,
): TreeNode[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .map((folder) => ({
      id: folder.id,
      name: folder.name,
      color: folder.color,
      icon: folder.icon,
      children: buildFolderTree(folders, bookmarks, folder.id),
      bookmarks: bookmarks.filter((b) => b.folderId === folder.id),
    }))
}

function generateHtmlExport(
  folders: FlatFolder[],
  bookmarks: FlatBookmark[],
): string {
  const rootBookmarks = bookmarks.filter((b) => !b.folderId)
  const tree = buildFolderTree(folders, bookmarks, null)

  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>书签</TITLE>
<H1>书签</H1>
<DL><p>
`
  html += renderFolderDl(tree)
  html += `    <HR>`
  for (const b of rootBookmarks) {
    html += renderBookmarkDt(b)
  }
  html += `</DL><p>`

  return html
}

function renderFolderDl(nodes: TreeNode[]): string {
  let result = ""
  for (const node of nodes) {
    const addDate = Math.floor(Date.now() / 1000)
    result += `    <DT><H3 ADD_DATE="${addDate}">${escapeHtml(node.name)}</H3>\n`
    result += `    <DL><p>\n`
    for (const b of node.bookmarks) {
      result += renderBookmarkDt(b)
    }
    result += renderFolderDl(node.children)
    result += `    </DL><p>\n`
  }
  return result
}

function renderBookmarkDt(b: FlatBookmark): string {
  const addDate = Math.floor(Date.now() / 1000)
  return `        <DT><A HREF="${escapeHtml(b.url)}" ADD_DATE="${addDate}">${escapeHtml(b.title)}</A>\n`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
