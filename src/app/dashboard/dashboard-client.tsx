"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { signOut } from "next-auth/react"
import { useTheme } from "@/lib/theme"
import {
  FolderPlus, Plus, Search, LogOut, Bookmark,
  Folder as FolderIcon, ChevronRight, ChevronDown,
  Upload, Download, Trash2, X, Sun, Moon,
  LayoutGrid, List, PanelLeft,
} from "lucide-react"

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

type ViewMode = "grid" | "list"

export function DashboardClient({ folders: initialFolders, bookmarks: initialBookmarks }: Props) {
  const { theme, toggle: toggleTheme } = useTheme()
  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [showFolderInput, setShowFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const draggedBookmarkRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showDedup, setShowDedup] = useState(false)
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [selectedDedupIds, setSelectedDedupIds] = useState<Set<string>>(new Set())
  const [dedupLoading, setDedupLoading] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Close mobile sidebar on resize
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setMobileSidebarOpen(false) }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

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
    } catch {}
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
    } catch {}
  }, [selectedFolderId])

  const moveBookmark = useCallback(async (bookmarkId: string, targetFolderId: string | null) => {
    setBookmarks((prev) =>
      prev.map((b) => (b.id === bookmarkId ? { ...b, folderId: targetFolderId } : b))
    )
    try {
      await fetch("/api/bookmarks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bookmarkId, folderId: targetFolderId }),
      })
    } catch {
      const res = await fetch("/api/bookmarks")
      if (res.ok) setBookmarks(await res.json())
    }
  }, [])

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/bookmarks/import", { method: "POST", body: formData })
      const data = await res.json()
      if (res.ok) {
        setImportResult(`成功导入 ${data.foldersCreated} 个文件夹和 ${data.bookmarksCreated} 个书签`)
        const [foldersRes, bookmarksRes] = await Promise.all([
          fetch("/api/folders"),
          fetch("/api/bookmarks"),
        ])
        if (foldersRes.ok) setFolders(await foldersRes.json())
        if (bookmarksRes.ok) setBookmarks(await bookmarksRes.json())
      } else {
        setImportResult(`导入失败：${data.error}`)
      }
    } catch {
      setImportResult("导入失败，请检查文件格式")
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [])

  const handleDetectDuplicates = useCallback(async () => {
    setDedupLoading(true)
    try {
      const res = await fetch("/api/bookmarks/detect-duplicates", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setDuplicates(data.duplicates || [])
        setSelectedDedupIds(new Set())
        setShowDedup(true)
      }
    } catch {}
    setDedupLoading(false)
  }, [])

  const handleDeleteDedup = useCallback(async () => {
    if (selectedDedupIds.size === 0) return
    const ids = Array.from(selectedDedupIds)
    try {
      await Promise.all(
        ids.map((id) =>
          fetch("/api/bookmarks", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          })
        )
      )
      setBookmarks((prev) => prev.filter((b) => !selectedDedupIds.has(b.id)))
      setDuplicates((prev) =>
        prev
          .map((g) => ({ ...g, bookmarks: g.bookmarks.filter((b: any) => !selectedDedupIds.has(b.id)) }))
          .filter((g: any) => g.bookmarks.length > 1)
      )
      setSelectedDedupIds(new Set())
    } catch {}
  }, [selectedDedupIds])

  function renderFolderTree(folderList: Folder[], depth = 0) {
    return folderList.map((folder) => {
      const children = childFolders(folder.id)
      const hasChildren = children.length > 0
      const isExpanded = expandedFolders.has(folder.id)
      const isSelected = selectedFolderId === folder.id

      return (
        <div key={folder.id}>
          <div
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverFolderId(folder.id) }}
            onDragLeave={() => setDragOverFolderId(null)}
            onDrop={(e) => { e.preventDefault(); const id = draggedBookmarkRef.current; if (id) moveBookmark(id, folder.id); setDragOverFolderId(null) }}
          >
            <button
              onClick={() => { setSelectedFolderId(folder.id); if (hasChildren) toggleFolder(folder.id); if (window.innerWidth < 1024) setMobileSidebarOpen(false) }}
              className={`flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted ${
                isSelected ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
              } ${dragOverFolderId === folder.id ? "ring-2 ring-primary" : ""}`}
              style={{ paddingLeft: `${12 + depth * 16}px` }}
            >
              {hasChildren ? (
                isExpanded ? <ChevronDown className="h-3 w-3 shrink-0 transition-transform" /> : <ChevronRight className="h-3 w-3 shrink-0" />
              ) : (
                <span className="w-3" />
              )}
              <FolderIcon className="h-4 w-4 shrink-0" style={{ color: folder.color || undefined }} />
              <span className="truncate">{folder.name}</span>
            </button>
          </div>
          {hasChildren && isExpanded && (
            <div className="animate-fade-in">{renderFolderTree(children, depth + 1)}</div>
          )}
        </div>
      )
    })
  }

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between border-b px-4 py-3">
        {!sidebarCollapsed && <h2 className="text-sm font-bold tracking-tight"><span className="text-primary">Bookmark</span></h2>}
        <div className="flex items-center gap-1">
          <button onClick={() => { toggleTheme() }} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="切换主题">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={() => signOut()} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="退出登录">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverFolderId("__root__") }}
          onDragLeave={() => setDragOverFolderId(null)}
          onDrop={(e) => { e.preventDefault(); const id = draggedBookmarkRef.current; if (id) moveBookmark(id, null); setDragOverFolderId(null) }}
        >
          <button
            onClick={() => { setSelectedFolderId(null); setSearchQuery(""); if (window.innerWidth < 1024) setMobileSidebarOpen(false) }}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted ${
              !selectedFolderId && !searchQuery ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
            } ${dragOverFolderId === "__root__" ? "ring-2 ring-primary" : ""}`}
          >
            <Bookmark className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <>全部书签</>}
          </button>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between px-3 py-1">
            {!sidebarCollapsed && <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">文件夹</span>}
            <button onClick={() => setShowFolderInput(!showFolderInput)} className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <FolderPlus className="h-4 w-4" />
            </button>
          </div>

          {showFolderInput && !sidebarCollapsed && (
            <div className="animate-fade-in px-2 pb-2">
              <div className="flex gap-1">
                <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createFolder()} placeholder="名称"
                  className="w-full rounded-lg border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" autoFocus />
                <button onClick={createFolder} className="rounded-lg bg-primary px-2 py-1 text-xs text-primary-foreground">确认</button>
              </div>
            </div>
          )}

          <div className="mt-1">{renderFolderTree(rootFolders)}</div>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 移动端遮罩 */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden animate-fade-in" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* 左侧边栏 */}
      <aside className={`${
        sidebarCollapsed ? "w-14" : "w-64"
      } hidden lg:flex flex-col border-r bg-sidebar-bg transition-all duration-300 z-30`}>
        {sidebarContent}
      </aside>

      {/* 移动端侧边栏 */}
      <aside className={`${
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      } fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r bg-sidebar-bg shadow-2xl transition-transform duration-300 lg:hidden`}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-bold"><span className="text-primary">Bookmark</span> Manager</h2>
          <button onClick={() => setMobileSidebarOpen(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {/* Simplified mobile sidebar with same folder tree */}
          <button
            onClick={() => { setSelectedFolderId(null); setSearchQuery(""); setMobileSidebarOpen(false) }}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted ${
              !selectedFolderId && !searchQuery ? "bg-muted font-medium" : "text-muted-foreground"
            }`}
          >
            <Bookmark className="h-4 w-4" /> 全部书签
          </button>
          <div className="mt-3">
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">文件夹</span>
              <button onClick={() => setShowFolderInput(!showFolderInput)} className="rounded-lg p-1 hover:bg-muted">
                <FolderPlus className="h-4 w-4" />
              </button>
            </div>
            {showFolderInput && (
              <div className="px-2 pb-2">
                <div className="flex gap-1">
                  <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createFolder()} placeholder="名称"
                    className="w-full rounded-lg border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring" autoFocus />
                  <button onClick={createFolder} className="rounded-lg bg-primary px-2 py-1 text-xs text-primary-foreground">确认</button>
                </div>
              </div>
            )}
            <div className="mt-1">{renderFolderTree(rootFolders)}</div>
          </div>
        </div>
      </aside>

      {/* 右侧主区域 */}
      <main className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center gap-2 border-b bg-header-bg backdrop-blur-md px-4 py-2.5 lg:px-6">
          {/* 移动端菜单 + 侧边栏折叠 */}
          <button onClick={() => setMobileSidebarOpen(true)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted lg:hidden">
            <Search className="h-4 w-4" />
          </button>
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted lg:block" title="切换侧边栏">
            <PanelLeft className="h-4 w-4" />
          </button>

          {/* 搜索框 */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索书签..." className="w-full rounded-lg border border-input bg-background py-1.5 pl-9 pr-3 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          {/* 书签计数 */}
          {!sidebarCollapsed && (
            <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
              {filteredBookmarks.length} / {bookmarks.length}
            </span>
          )}

          {/* 操作栏 */}
          <div className="flex items-center gap-1">
            {/* 视图切换 */}
            <button onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title={viewMode === "grid" ? "列表视图" : "网格视图"}>
              {viewMode === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </button>

            <div className="mx-1 h-5 w-px bg-border" />

            <button onClick={createBookmark}
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md">
              <Plus className="h-3.5 w-3.5" /> 新建
            </button>

            <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={handleImport} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={importing}
              className="rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
              <Upload className="h-3.5 w-3.5" />
            </button>

            <div className="relative group">
              <button className="rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <Download className="h-3.5 w-3.5" />
              </button>
              <div className="absolute right-0 top-full z-50 mt-1 hidden w-28 rounded-lg border bg-card py-1 shadow-lg group-hover:block animate-scale-in">
                <a href="/api/bookmarks/export?format=html" className="block px-3 py-1.5 text-xs hover:bg-muted">导出 HTML</a>
                <a href="/api/bookmarks/export?format=json" className="block px-3 py-1.5 text-xs hover:bg-muted">导出 JSON</a>
              </div>
            </div>

            <button onClick={handleDetectDuplicates} disabled={dedupLoading}
              className="rounded-lg border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        {importResult && (
          <div className="animate-slide-up border-b bg-muted/30 px-6 py-2 text-sm">
            {importResult}
            <button onClick={() => setImportResult(null)} className="ml-2 font-medium text-muted-foreground hover:text-foreground">关闭</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {filteredBookmarks.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center animate-fade-in">
                <Bookmark className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-sm text-muted-foreground">
                  {searchQuery ? "没有找到匹配的书签" : "还没有书签，点击上方按钮添加或导入浏览器书签"}
                </p>
              </div>
            </div>
          ) : (
            <div className={
              viewMode === "grid"
                ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "flex flex-col gap-2"
            }>
              {filteredBookmarks.map((bookmark, i) => (
                <div
                  key={bookmark.id}
                  draggable
                  onDragStart={(e) => { draggedBookmarkRef.current = bookmark.id; e.dataTransfer.effectAllowed = "move" }}
                  onDragEnd={() => { draggedBookmarkRef.current = null; setDragOverFolderId(null) }}
                  onClick={() => window.open(bookmark.url, "_blank")}
                  className={`cursor-pointer transition-all hover:-translate-y-0.5 ${
                    viewMode === "grid"
                      ? "animate-slide-up rounded-xl border bg-card p-4 shadow-sm hover:border-primary/30 hover:shadow-md"
                      : "animate-fade-in flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5 shadow-sm hover:border-primary/30 hover:shadow-sm"
                  }`}
                  style={{ animationDelay: `${Math.min(i * 0.03, 0.3)}s` }}
                >
                  {viewMode === "grid" ? (
                    <div className="flex items-start gap-3">
                      {bookmark.favicon ? (
                        <img src={bookmark.favicon} alt="" className="mt-0.5 h-5 w-5 rounded" />
                      ) : (
                        <Bookmark className="mt-0.5 h-5 w-5 shrink-0 text-primary/60" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-medium">{bookmark.title || bookmark.url}</h3>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{bookmark.url}</p>
                        {bookmark.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/70">{bookmark.description}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {bookmark.favicon ? (
                        <img src={bookmark.favicon} alt="" className="h-4 w-4 shrink-0 rounded" />
                      ) : (
                        <Bookmark className="h-4 w-4 shrink-0 text-primary/60" />
                      )}
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="truncate text-sm font-medium">{bookmark.title || bookmark.url}</span>
                        <span className="hidden truncate text-xs text-muted-foreground sm:inline">{bookmark.url}</span>
                      </div>
                      {bookmark.description && (
                        <span className="hidden truncate text-xs text-muted-foreground/60 md:inline max-w-[200px]">{bookmark.description}</span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 去重面板 */}
      {showDedup && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-12 animate-fade-in" onClick={() => setShowDedup(false)}>
          <div className="w-full max-w-2xl rounded-xl border bg-card shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h3 className="font-semibold">去重管理</h3>
              <button onClick={() => setShowDedup(false)} className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-5">
              {duplicates.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">没有发现重复书签 🎉</p>
              ) : (
                <div className="space-y-3">
                  {duplicates.map((group, gi) => (
                    <div key={gi} className="animate-slide-up rounded-xl border p-4" style={{ animationDelay: `${gi * 0.05}s` }}>
                      <p className="mb-2 truncate text-xs font-medium text-muted-foreground" title={group.url}>{group.url}</p>
                      <div className="space-y-1">
                        {group.bookmarks.map((bm: any) => (
                          <label key={bm.id} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted ${
                            selectedDedupIds.has(bm.id) ? "bg-destructive/5 line-through opacity-60" : ""
                          }`}>
                            <input type="checkbox" checked={selectedDedupIds.has(bm.id)}
                              onChange={(e) => { setSelectedDedupIds((prev) => { const next = new Set(prev); if (e.target.checked) next.add(bm.id); else next.delete(bm.id); return next }) }}
                              className="shrink-0 accent-primary" />
                            <span className="flex-1 truncate">{bm.title || bm.url}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {duplicates.length > 0 && (
              <div className="flex items-center justify-between border-t px-5 py-3">
                <button onClick={() => { setSelectedDedupIds((prev) => { const next = new Set(prev); duplicates.forEach((g: any) => { g.bookmarks.slice(1).forEach((bm: any) => next.add(bm.id)) }); return next }) }}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground">保留每组第一个</button>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedDedupIds(new Set())} className="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-muted">取消选择</button>
                  <button onClick={handleDeleteDedup} disabled={selectedDedupIds.size === 0}
                    className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50">删除选中 ({selectedDedupIds.size})</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
