"use client"

import { useState, useCallback, useRef } from "react"
import { signOut } from "next-auth/react"
import { FolderPlus, Plus, Search, LogOut, Bookmark, Folder as FolderIcon, ChevronRight, ChevronDown, Upload, Download } from "lucide-react"

interface Folder {
  id: string
  name: string
  color: string | null
  icon: string | null
  parentId: string | null
}

interface Bookmark {
  id: string
  title: string
  url: string
  description: string | null
  favicon: string | null
  order: number
  folderId: string | null
}

interface Props {
  folders: Folder[]
  bookmarks: Bookmark[]
  userId: string
}

export function DashboardClient({ folders: initialFolders, bookmarks: initialBookmarks }: Props) {
  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [showFolderInput, setShowFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredBookmarks = bookmarks.filter((b) => {
    const matchFolder = selectedFolderId ? b.folderId === selectedFolderId : true
    const matchSearch = searchQuery
      ? b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.url.toLowerCase().includes(searchQuery.toLowerCase())
      : true
    return matchFolder && matchSearch
  })

  const rootFolders = folders.filter((f) => !f.parentId)
  const childFolders = (parentId: string) => folders.filter((f) => f.parentId === parentId)

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const createFolder = useCallback(async () => {
    if (!newFolderName.trim()) return
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName, parentId: null }),
      })
      if (res.ok) {
        const folder = await res.json()
        setFolders((prev) => [...prev, folder])
        setNewFolderName("")
        setShowFolderInput(false)
      }
    } catch {
      // ignore
    }
  }, [newFolderName])

  const createBookmark = useCallback(async () => {
    const url = prompt("请输入书签 URL：")
    if (!url) return
    const title = prompt("请输入书签标题：")
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, url, folderId: selectedFolderId }),
      })
      if (res.ok) {
        const bookmark = await res.json()
        setBookmarks((prev) => [...prev, bookmark])
      }
    } catch {
      // ignore
    }
  }, [selectedFolderId])

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/bookmarks/import", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setImportResult(`✅ 成功导入 ${data.foldersCreated} 个文件夹和 ${data.bookmarksCreated} 个书签`)
        // 刷新页面数据
        const [foldersRes, bookmarksRes] = await Promise.all([
          fetch("/api/folders"),
          fetch("/api/bookmarks"),
        ])
        if (foldersRes.ok) setFolders(await foldersRes.json())
        if (bookmarksRes.ok) setBookmarks(await bookmarksRes.json())
      } else {
        setImportResult(`❌ 导入失败：${data.error}`)
      }
    } catch {
      setImportResult("❌ 导入失败，请检查文件格式")
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [])

  function renderFolderTree(folderList: Folder[], depth = 0) {
    return folderList.map((folder) => {
      const children = childFolders(folder.id)
      const hasChildren = children.length > 0
      const isExpanded = expandedFolders.has(folder.id)
      const isSelected = selectedFolderId === folder.id

      return (
        <div key={folder.id}>
          <button
            onClick={() => {
              setSelectedFolderId(folder.id)
              if (hasChildren) toggleFolder(folder.id)
            }}
            className={`flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted ${
              isSelected ? "bg-muted font-medium" : ""
            }`}
            style={{ paddingLeft: `${12 + depth * 16}px` }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />
            ) : (
              <span className="w-3" />
            )}
            <FolderIcon className="h-4 w-4 shrink-0" style={{ color: folder.color || undefined }} />
            <span className="truncate">{folder.name}</span>
          </button>
          {hasChildren && isExpanded && (
            <div>{renderFolderTree(children, depth + 1)}</div>
          )}
        </div>
      )
    })
  }

  return (
    <div className="flex h-screen">
      {/* 左侧边栏 */}
      <aside className="flex w-64 flex-col border-r bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">📑 书签管理</h2>
          <button
            onClick={() => signOut()}
            className="rounded-md p-1.5 hover:bg-muted"
            title="退出登录"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => { setSelectedFolderId(null); setSearchQuery("") }}
            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted ${
              !selectedFolderId && !searchQuery ? "bg-muted font-medium" : ""
            }`}
          >
            <Bookmark className="h-4 w-4" />
            全部书签
          </button>

          <div className="mt-2">
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-xs font-medium text-muted-foreground">文件夹</span>
              <button
                onClick={() => setShowFolderInput(!showFolderInput)}
                className="rounded-md p-0.5 hover:bg-muted"
              >
                <FolderPlus className="h-4 w-4" />
              </button>
            </div>

            {showFolderInput && (
              <div className="px-2 pb-2">
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createFolder()}
                    placeholder="文件夹名称"
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    autoFocus
                  />
                  <button
                    onClick={createFolder}
                    className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                  >
                    确认
                  </button>
                </div>
              </div>
            )}

            <div className="mt-1">
              {renderFolderTree(rootFolders)}
            </div>
          </div>
        </div>
      </aside>

      {/* 右侧主区域 */}
      <main className="flex flex-1 flex-col">
        <header className="flex items-center gap-4 border-b px-6 py-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索书签..."
              className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={createBookmark}
            className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            新建书签
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {importing ? "导入中..." : "导入"}
          </button>
          <div className="relative group">
            <button
              onClick={() => window.open("/api/bookmarks/export?format=html", "_blank")}
              className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
              title="导出 HTML"
            >
              <Download className="h-4 w-4" />
            </button>
            <div className="absolute right-0 top-full z-50 mt-1 hidden w-32 rounded-md border bg-card shadow-lg group-hover:block">
              <a
                href="/api/bookmarks/export?format=html"
                className="block rounded-t-md px-3 py-2 text-sm hover:bg-muted"
              >
                导出 HTML
              </a>
              <a
                href="/api/bookmarks/export?format=json"
                className="block rounded-b-md px-3 py-2 text-sm hover:bg-muted"
              >
                导出 JSON
              </a>
            </div>
          </div>
        </header>

        {importResult && (
          <div className="border-b px-6 py-2 text-sm">
            {importResult}
            <button
              onClick={() => setImportResult(null)}
              className="ml-2 text-muted-foreground hover:text-foreground"
            >
              关闭
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {filteredBookmarks.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Bookmark className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  {searchQuery ? "没有找到匹配的书签" : "还没有书签，点击上方按钮添加或导入浏览器书签"}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredBookmarks.map((bookmark) => (
                <a
                  key={bookmark.id}
                  href={bookmark.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-lg border p-4 hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {bookmark.favicon ? (
                      <img src={bookmark.favicon} alt="" className="mt-0.5 h-5 w-5 rounded" />
                    ) : (
                      <Bookmark className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-medium group-hover:text-primary">
                        {bookmark.title || bookmark.url}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {bookmark.url}
                      </p>
                      {bookmark.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {bookmark.description}
                        </p>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}