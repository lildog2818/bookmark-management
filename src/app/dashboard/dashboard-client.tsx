"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { signOut } from "next-auth/react"
import { useTheme } from "@/lib/theme"
import {
  Plus, Search, LogOut, Bookmark,
  Folder as FolderIcon, ChevronRight, ChevronDown,
  Upload, Download, Trash2, X, Sun, Moon,
  FolderPlus, ExternalLink, LayoutGrid, PanelLeftClose, PanelLeft,
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

type ViewMode = "card" | "tree"

export function DashboardClient({ folders: initialFolders, bookmarks: initialBookmarks }: Props) {
  const { theme, toggle: toggleTheme } = useTheme()
  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks)
  const [viewMode, setViewMode] = useState<ViewMode>("card")
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showDedup, setShowDedup] = useState(false)
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [selectedDedupIds, setSelectedDedupIds] = useState<Set<string>>(new Set())
  const [dedupLoading, setDedupLoading] = useState(false)
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())

  // ─── 数据准备 ───
  const rootFolders = folders.filter((f) => !f.parentId)
  const childFoldersMap = new Map<string, Folder[]>()
  for (const f of folders) {
    const pid = f.parentId || "__root__"
    if (!childFoldersMap.has(pid)) childFoldersMap.set(pid, [])
    childFoldersMap.get(pid)!.push(f)
  }

  const bookmarksByFolder = new Map<string, Bookmark[]>()
  for (const bm of bookmarks) {
    if (!bm.folderId) continue
    if (!bookmarksByFolder.has(bm.folderId)) bookmarksByFolder.set(bm.folderId, [])
    bookmarksByFolder.get(bm.folderId)!.push(bm)
  }

  // 搜索筛选
  const searchMatch = (b: Bookmark) =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.url.toLowerCase().includes(searchQuery.toLowerCase())

  const filteredBookmarks = searchQuery ? bookmarks.filter(searchMatch) : bookmarks
  const rootBookmarks = filteredBookmarks.filter((b) => !b.folderId)
  const filteredBookmarksByFolder = new Map<string, Bookmark[]>()
  for (const bm of filteredBookmarks) {
    if (!bm.folderId) continue
    if (!filteredBookmarksByFolder.has(bm.folderId)) filteredBookmarksByFolder.set(bm.folderId, [])
    filteredBookmarksByFolder.get(bm.folderId)!.push(bm)
  }

  // ─── 操作函数 ───
  const toggleCollapse = (id: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleExpand = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

  // ─── 渲染函数 ───

  function renderBookmarkRow(bm: Bookmark) {
    return (
      <div key={bm.id}
        onClick={() => window.open(bm.url, "_blank")}
        className="group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted/60"
      >
        {bm.favicon ? (
          <img src={bm.favicon} alt="" className="h-4 w-4 shrink-0 rounded" />
        ) : (
          <Bookmark className="h-4 w-4 shrink-0 text-primary/50" />
        )}
        <span className="flex-1 truncate text-sm">{bm.title || bm.url}</span>
        <span className="hidden truncate text-xs text-muted-foreground/50 md:block max-w-[180px]">{bm.url}</span>
        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    )
  }

  function renderBookmarkCard(bm: Bookmark) {
    return (
      <div key={bm.id}
        onClick={() => window.open(bm.url, "_blank")}
        className="animate-slide-up group cursor-pointer rounded-xl border bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5"
      >
        <div className="flex items-start gap-3">
          {bm.favicon ? (
            <img src={bm.favicon} alt="" className="mt-0.5 h-5 w-5 rounded" />
          ) : (
            <Bookmark className="mt-0.5 h-5 w-5 shrink-0 text-primary/60" />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium">{bm.title || bm.url}</h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{bm.url}</p>
            {bm.description && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/70">{bm.description}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── 卡片视图 ───
  function renderCardView() {
    if (filteredBookmarks.length === 0) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center animate-fade-in">
            <Bookmark className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-sm text-muted-foreground">
              {searchQuery ? "没有找到匹配的书签" : "还没有书签，点击上方按钮添加或导入浏览器书签"}
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* 未分类书签 */}
        {rootBookmarks.length > 0 && (
          <div className="animate-slide-up overflow-hidden rounded-xl border-2 border-dashed bg-card/50 shadow-sm">
            <div className="flex items-center gap-2 border-b border-dashed bg-muted/20 px-4 py-2.5">
              <Bookmark className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              <span className="text-sm font-semibold text-muted-foreground">未分类</span>
              <span className="ml-auto text-xs text-muted-foreground/50">{rootBookmarks.length}</span>
            </div>
            <div className="p-1.5">{rootBookmarks.map(renderBookmarkRow)}</div>
          </div>
        )}

        {/* 文件夹卡片 */}
        {rootFolders.map((folder) => {
          const bms = filteredBookmarksByFolder.get(folder.id) || []
          const subs = childFoldersMap.get(folder.id) || []
          const hasSub = subs.some((sf) => {
            const sfb = filteredBookmarksByFolder.get(sf.id) || []
            return sfb.length > 0 || (childFoldersMap.get(sf.id) || []).length > 0
          })
          return (
            <div key={folder.id} className="animate-slide-up overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5"
                style={{ borderLeftColor: folder.color || undefined, borderLeftWidth: folder.color ? 3 : 0 }}>
                <FolderIcon className="h-4 w-4 shrink-0" style={{ color: folder.color || undefined }} />
                <span className="text-sm font-semibold">{folder.name}</span>
                {bms.length > 0 && <span className="ml-auto text-xs text-muted-foreground/50">{bms.length}</span>}
              </div>
              <div className="p-1.5">
                {bms.length === 0 && !hasSub ? (
                  <p className="py-4 text-center text-xs text-muted-foreground/40">空文件夹</p>
                ) : (
                  <>
                    {bms.map(renderBookmarkRow)}
                    {/* 子文件夹 */}
                    {renderSubFoldersInCard(folder.id)}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  function renderSubFoldersInCard(parentId: string, depth = 0) {
    const children = childFoldersMap.get(parentId) || []
    return children.map((f) => {
      const bms = filteredBookmarksByFolder.get(f.id) || []
      const grandChildren = childFoldersMap.get(f.id) || []
      const isCollapsed = collapsedFolders.has(f.id)
      return (
        <div key={f.id} className="animate-fade-in" style={{ marginLeft: `${depth * 12}px` }}>
          <button onClick={() => toggleCollapse(f.id)}
            className="flex w-full items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50">
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            <FolderIcon className="h-3 w-3" style={{ color: f.color || undefined }} />
            <span className="truncate">{f.name}</span>
            {bms.length > 0 && <span className="ml-auto">{bms.length}</span>}
          </button>
          {!isCollapsed && (
            <div className="ml-3 border-l pl-1.5">
              {bms.map(renderBookmarkRow)}
              {renderSubFoldersInCard(f.id, depth + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  // ─── 文件夹树视图 ───
  function renderTreeSidebar() {
    const renderTree = (list: Folder[], depth = 0) =>
      list.map((f) => {
        const children = childFoldersMap.get(f.id) || []
        const isExpanded = expandedFolders.has(f.id)
        const isSelected = selectedFolderId === f.id
        return (
          <div key={f.id}>
            <button onClick={() => { setSelectedFolderId(f.id); if (children.length > 0) toggleExpand(f.id) }}
              className={`flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted ${
                isSelected ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
              }`}
              style={{ paddingLeft: `${8 + depth * 14}px` }}>
              {children.length > 0 ? (
                isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />
              ) : <span className="w-3" />}
              <FolderIcon className="h-4 w-4 shrink-0" style={{ color: f.color || undefined }} />
              <span className="truncate">{f.name}</span>
              {(bookmarksByFolder.get(f.id)?.length || 0) > 0 && (
                <span className="ml-auto text-xs text-muted-foreground/40">{bookmarksByFolder.get(f.id)?.length}</span>
              )}
            </button>
            {isExpanded && children.length > 0 && (
              <div className="animate-fade-in">{renderTree(children, depth + 1)}</div>
            )}
          </div>
        )
      })

    return (
      <aside className="hidden w-56 shrink-0 border-r bg-sidebar-bg lg:flex lg:flex-col">
        <div className="border-b px-3 py-2.5">
          <h2 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">文件夹</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <button onClick={() => setSelectedFolderId(null)}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted ${
              selectedFolderId === null ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
            }`}>
            <Bookmark className="h-4 w-4" />
            全部书签
          </button>
          <div className="mt-1">{renderTree(rootFolders)}</div>
        </div>
      </aside>
    )
  }

  function renderTreeView() {
    const displayBookmarks = selectedFolderId
      ? bookmarks.filter((b) => b.folderId === selectedFolderId && (!searchQuery || searchMatch(b)))
      : filteredBookmarks

    return (
      <div className="flex flex-1 overflow-hidden">
        {renderTreeSidebar()}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {displayBookmarks.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center animate-fade-in">
                <Bookmark className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-sm text-muted-foreground">
                  {searchQuery ? "没有找到匹配的书签" : "这个文件夹是空的"}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayBookmarks.map(renderBookmarkCard)}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── 主渲染 ───
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-2 border-b bg-header-bg backdrop-blur-md px-4 py-2.5">
        <h1 className="mr-2 hidden text-sm font-bold tracking-tight sm:block">
          <span className="text-primary">Bookmark</span>
        </h1>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索书签..."
            className="w-full rounded-lg border border-input bg-background py-1.5 pl-9 pr-3 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {filteredBookmarks.length}/{bookmarks.length}
        </span>

        <div className="flex items-center gap-1">
          {/* 视图切换 */}
          <button onClick={() => setViewMode(viewMode === "card" ? "tree" : "card")}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={viewMode === "card" ? "文件夹视图" : "卡片视图"}>
            {viewMode === "card" ? <PanelLeftClose className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          </button>

          <div className="mx-1 h-5 w-px bg-border" />

          <button onClick={createBookmark}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md">
            <Plus className="h-3.5 w-3.5" /> 新建
          </button>

          <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={handleImport} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={importing}
            className="rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
            <Upload className="h-3.5 w-3.5" />
          </button>

          <div className="relative group">
            <button className="rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Download className="h-3.5 w-3.5" />
            </button>
            <div className="absolute right-0 top-full z-50 mt-1 hidden w-28 rounded-lg border bg-card py-1 shadow-lg group-hover:block animate-scale-in">
              <a href="/api/bookmarks/export?format=html" className="block px-3 py-1.5 text-xs hover:bg-muted">导出 HTML</a>
              <a href="/api/bookmarks/export?format=json" className="block px-3 py-1.5 text-xs hover:bg-muted">导出 JSON</a>
            </div>
          </div>

          <button onClick={handleDetectDuplicates} disabled={dedupLoading}
            className="rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50">
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          <div className="mx-1 h-5 w-px bg-border" />

          <button onClick={toggleTheme}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={() => signOut()}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {importResult && (
        <div className="animate-slide-up border-b bg-muted/30 px-6 py-2 text-sm">
          {importResult}
          <button onClick={() => setImportResult(null)} className="ml-2 font-medium text-muted-foreground hover:text-foreground">关闭</button>
        </div>
      )}

      <main className="flex-1 overflow-hidden">
        {viewMode === "card" ? renderCardView() : renderTreeView()}
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
