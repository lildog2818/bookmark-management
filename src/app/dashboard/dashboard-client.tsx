"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { signOut } from "next-auth/react"
import { useTheme } from "@/lib/theme"
import {
  Plus, Search, LogOut, Bookmark,
  Folder as FolderIcon, ChevronRight, ChevronDown,
  Upload, Download, Trash2, X, Sun, Moon,
  FolderPlus, ExternalLink, LayoutGrid, PanelLeftClose,
} from "lucide-react"

interface Folder { id: string; name: string; color: string | null; icon: string | null; parentId: string | null }
interface Bookmark { id: string; title: string; url: string; description: string | null; favicon: string | null; order: number; folderId: string | null }
interface Props { folders: Folder[]; bookmarks: Bookmark[]; userId: string }
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
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const draggedBmRef = useRef<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showDedup, setShowDedup] = useState(false)
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [selectedDedupIds, setSelectedDedupIds] = useState<Set<string>>(new Set())
  const [dedupLoading, setDedupLoading] = useState(false)
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())

  // ── 数据准备 ──
  const rootFolders = folders.filter((f) => !f.parentId)
  const childFoldersMap = new Map<string, Folder[]>()
  for (const f of folders) { const pid = f.parentId || "__root__"; if (!childFoldersMap.has(pid)) childFoldersMap.set(pid, []); childFoldersMap.get(pid)!.push(f) }
  const bookmarksByFolder = new Map<string, Bookmark[]>()
  for (const bm of bookmarks) { if (!bm.folderId) continue; if (!bookmarksByFolder.has(bm.folderId)) bookmarksByFolder.set(bm.folderId, []); bookmarksByFolder.get(bm.folderId)!.push(bm) }
  const searchMatch = (b: Bookmark) => b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.url.toLowerCase().includes(searchQuery.toLowerCase())
  const filteredBookmarks = searchQuery ? bookmarks.filter(searchMatch) : bookmarks
  const rootBookmarks = filteredBookmarks.filter((b) => !b.folderId)
  const filteredBookmarksByFolder = new Map<string, Bookmark[]>()
  for (const bm of filteredBookmarks) { if (!bm.folderId) continue; if (!filteredBookmarksByFolder.has(bm.folderId)) filteredBookmarksByFolder.set(bm.folderId, []); filteredBookmarksByFolder.get(bm.folderId)!.push(bm) }

  // ── 操作函数 ──
  const toggleCollapse = (id: string) => setCollapsedFolders((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleExpand = (id: string) => setExpandedFolders((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const moveBookmark = useCallback(async (id: string, folderId: string | null) => {
    setBookmarks((prev) => prev.map((b) => b.id === id ? { ...b, folderId } : b))
    try { await fetch("/api/bookmarks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, folderId }) }) }
    catch { const r = await fetch("/api/bookmarks"); if (r.ok) setBookmarks(await r.json()) }
  }, [])

  const editBookmark = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const bm = bookmarks.find((b) => b.id === id)
    if (!bm) return
    const title = prompt("修改书签名称：", bm.title)
    if (title === null) return
    const url = prompt("修改书签 URL：", bm.url)
    if (url === null) return
    try {
      const res = await fetch("/api/bookmarks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, title: title.trim(), url: url.trim() }) })
      if (res.ok) setBookmarks((prev) => prev.map((b) => b.id === id ? { ...b, title: title.trim(), url: url.trim() } : b))
    } catch {}
  }, [bookmarks])

    const deleteBookmark = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); if (!confirm("确认删除这个书签？")) return
    try { await fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); setBookmarks((prev) => prev.filter((b) => b.id !== id)) } catch {}
  }, [])

  const deleteFolder = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); if (!confirm("确认删除这个文件夹及其所有书签？")) return
    try {
      await fetch("/api/folders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
      const fRes = await fetch("/api/folders"); if (fRes.ok) setFolders(await fRes.json())
      const bRes = await fetch("/api/bookmarks"); if (bRes.ok) setBookmarks(await bRes.json())
    } catch {}
  }, [])

  const createFolder = useCallback(async () => {
    const name = prompt("请输入文件夹名称："); if (!name?.trim()) return
    try {
      const res = await fetch("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), parentId: null }) })
      if (res.ok) { const fRes = await fetch("/api/folders"); if (fRes.ok) setFolders(await fRes.json()) }
    } catch {}
  }, [])

  const createBookmark = useCallback(async () => {
    const url = prompt("请输入书签 URL："); if (!url) return
    const title = prompt("请输入书签标题：")
    try {
      const res = await fetch("/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, url, folderId: selectedFolderId }) })
      if (res.ok) { const bm = await res.json(); setBookmarks((prev) => [...prev, bm]) }
    } catch {}
  }, [selectedFolderId])

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true); setImportResult(null)
    try {
      const formData = new FormData(); formData.append("file", file)
      const res = await fetch("/api/bookmarks/import", { method: "POST", body: formData })
      const data = await res.json()
      if (res.ok) {
        setImportResult(`成功导入 ${data.foldersCreated} 个文件夹和 ${data.bookmarksCreated} 个书签`)
        const [fR, bR] = await Promise.all([fetch("/api/folders"), fetch("/api/bookmarks")])
        if (fR.ok) setFolders(await fR.json()); if (bR.ok) setBookmarks(await bR.json())
      } else setImportResult(`导入失败：${data.error}`)
    } catch { setImportResult("导入失败，请检查文件格式") }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = "" }
  }, [])

  const handleDetectDuplicates = useCallback(async () => {
    setDedupLoading(true)
    try { const res = await fetch("/api/bookmarks/detect-duplicates", { method: "POST" }); if (res.ok) { const d = await res.json(); setDuplicates(d.duplicates || []); setSelectedDedupIds(new Set()); setShowDedup(true) } } catch {}
    setDedupLoading(false)
  }, [])

  const handleDeleteDedup = useCallback(async () => {
    if (selectedDedupIds.size === 0) return
    const ids = Array.from(selectedDedupIds)
    try {
      await Promise.all(ids.map((id) => fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })))
      setBookmarks((prev) => prev.filter((b) => !selectedDedupIds.has(b.id)))
      setDuplicates((prev) => prev.map((g) => ({ ...g, bookmarks: g.bookmarks.filter((b: any) => !selectedDedupIds.has(b.id)) })).filter((g: any) => g.bookmarks.length > 1))
      setSelectedDedupIds(new Set())
    } catch {}
  }, [selectedDedupIds])

  // ── 拖拽辅助 ──
  const dragProps = (folderId: string) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverFolderId(folderId) },
    onDragLeave: () => setDragOverFolderId(null),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); const id = draggedBmRef.current; if (id) moveBookmark(id, folderId === "__root__" ? null : folderId); setDragOverFolderId(null) },
  })
  const isOver = (id: string) => dragOverFolderId === id

  // ── 卡片视图 ──
  function renderBookmarkRow(bm: Bookmark) {
    return (
      <div key={bm.id} draggable
        onDragStart={() => { draggedBmRef.current = bm.id }}
        onDragEnd={() => { draggedBmRef.current = null; setDragOverFolderId(null) }}
        className="group flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-grab active:cursor-grabbing">
        <div onClick={() => window.open(bm.url, "_blank")} className="flex flex-1 cursor-pointer items-center gap-3 min-w-0">
          {bm.favicon ? <img src={bm.favicon} alt="" className="h-4 w-4 shrink-0" /> : <Bookmark className="h-4 w-4 shrink-0 text-primary/50" />}
          <span className="flex-1 truncate text-sm font-medium">{bm.title || bm.url}</span>
        </div>
        <button onClick={(e) => editBookmark(bm.id, e)} className="shrink-0 p-1 text-muted-foreground/30 opacity-0 hover:text-foreground group-hover:opacity-100" title="编辑">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
        <button onClick={(e) => deleteBookmark(bm.id, e)} className="shrink-0 p-1 text-muted-foreground/30 opacity-0 hover:text-destructive group-hover:opacity-100" title="删除">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  function renderSubFoldersInCard(parentId: string, depth = 0) {
    const children = childFoldersMap.get(parentId) || []
    return children.map((f) => {
      const bms = filteredBookmarksByFolder.get(f.id) || []
      const isCollapsed = collapsedFolders.has(f.id)
      return (
        <div key={f.id} style={{ marginLeft: `${depth * 16}px` }}>
          <div {...dragProps(f.id)} className={`group flex items-center gap-1 px-3 py-1.5 ${isOver(f.id) ? "bg-primary/10" : ""}`}>
            <button onClick={() => toggleCollapse(f.id)} className="p-0.5 text-muted-foreground/60 hover:text-foreground">
              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <FolderIcon className="h-4 w-4 shrink-0" style={{ color: f.color || undefined }} />
            <span className="text-sm text-muted-foreground">{f.name}</span>
            <span className="text-xs text-muted-foreground/40">{bms.length}</span>
            <button onClick={(e) => deleteFolder(f.id, e)} className="ml-auto p-1 text-muted-foreground/30 opacity-0 hover:text-destructive group-hover:opacity-100" title="删除文件夹">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {!isCollapsed && (
            <div className="ml-4 pl-2" style={{ borderLeft: "1px solid var(--border)" }}>
              {bms.map(renderBookmarkRow)}
              {renderSubFoldersInCard(f.id, depth + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  function renderCardView() {
    if (filteredBookmarks.length === 0) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <Bookmark className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-sm text-muted-foreground">
              {searchQuery ? "没有找到匹配的书签" : "还没有书签，点击上方按钮添加或导入浏览器书签"}
            </p>
          </div>
        </div>
      )
    }

    const allCards = [
      ...(rootBookmarks.length > 0 ? [{ type: "root" as const, data: rootBookmarks }] : []),
      ...rootFolders.map((f) => ({ type: "folder" as const, data: f })),
    ]

    return (
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {allCards.map((card, ci) => (
            <div key={ci}
              {...(card.type === "folder" ? dragProps(card.data.id) : dragProps("__root__"))}
              className={`bg-card transition-shadow ${isOver(card.type === "folder" ? card.data.id : "__root__") ? "ring-2 ring-primary" : ""}`}
              style={{ border: "1px solid var(--border)" }}>
              {card.type === "root" ? (
                <>
                  <div className="flex items-center gap-2 px-4 pt-4 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
                    <Bookmark className="h-4 w-4 text-muted-foreground/50" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">未分类</span>
                    <span className="ml-auto text-xs text-muted-foreground/40">{card.data.length}</span>
                  </div>
                  <div className="pb-2">{card.data.map(renderBookmarkRow)}</div>
                </>
              ) : (
                <>
                  <div className="group flex items-center gap-2 px-4 pt-4 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
                    <FolderIcon className="h-4 w-4 shrink-0" style={{ color: card.data.color || undefined }} />
                    <span className="text-sm font-semibold">{card.data.name}</span>
                    {(filteredBookmarksByFolder.get(card.data.id)?.length || 0) > 0 && (
                      <span className="text-xs text-muted-foreground/40">{filteredBookmarksByFolder.get(card.data.id)?.length}</span>
                    )}
                    <button onClick={(e) => deleteFolder(card.data.id, e)} className="ml-auto p-1 text-muted-foreground/30 opacity-0 hover:text-destructive group-hover:opacity-100" title="删除文件夹">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="pb-2">
                    {(() => {
                      const bms = filteredBookmarksByFolder.get(card.data.id) || []
                      const subs = childFoldersMap.get(card.data.id) || []
                      const hasSub = subs.some((sf) => { const sfb = filteredBookmarksByFolder.get(sf.id) || []; return sfb.length > 0 || (childFoldersMap.get(sf.id) || []).length > 0 })
                      if (bms.length === 0 && !hasSub) return <p className="px-4 py-6 text-xs text-muted-foreground/40">空文件夹</p>
                      return <>{bms.map(renderBookmarkRow)}{renderSubFoldersInCard(card.data.id)}</>
                    })()}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── 文件夹树视图 ──
  function renderTreeSidebar() {
    const renderTree = (list: Folder[], depth = 0) =>
      list.map((f) => {
        const children = childFoldersMap.get(f.id) || []
        const isExpanded = expandedFolders.has(f.id)
        const isSelected = selectedFolderId === f.id
        return (
          <div key={f.id}>
            <div {...dragProps(f.id)} className={`group flex items-center ${isOver(f.id) ? "bg-primary/10" : ""}`}>
              <button onClick={() => { setSelectedFolderId(f.id); if (children.length > 0) toggleExpand(f.id) }}
                className={`flex w-full items-center gap-1 px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}`}
                style={{ paddingLeft: `${8 + depth * 14}px` }}>
                {children.length > 0 ? (isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />) : <span className="w-3" />}
                <FolderIcon className="h-4 w-4 shrink-0" style={{ color: f.color || undefined }} />
                <span className="truncate">{f.name}</span>
                {(bookmarksByFolder.get(f.id)?.length || 0) > 0 && <span className="ml-auto text-xs text-muted-foreground/40">{bookmarksByFolder.get(f.id)?.length}</span>}
              </button>
            </div>
            {isExpanded && children.length > 0 && <div>{renderTree(children, depth + 1)}</div>}
          </div>
        )
      })

    return (
      <aside className="hidden w-56 shrink-0 bg-sidebar-bg lg:flex lg:flex-col" style={{ borderRight: "1px solid var(--border)" }}>
        <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">文件夹</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div {...dragProps("__root__")} className={isOver("__root__") ? "bg-primary/10" : ""}>
            <button onClick={() => setSelectedFolderId(null)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted ${selectedFolderId === null ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}`}>
              <Bookmark className="h-4 w-4" /> 全部书签
            </button>
          </div>
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
        <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          {displayBookmarks.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Bookmark className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-sm text-muted-foreground">{searchQuery ? "没有找到匹配的书签" : "这个文件夹是空的"}</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-7xl">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {displayBookmarks.map((bm) => (
                  <div key={bm.id} draggable
                    onDragStart={() => { draggedBmRef.current = bm.id }}
                    onDragEnd={() => { draggedBmRef.current = null; setDragOverFolderId(null) }}
                    onClick={() => window.open(bm.url, "_blank")}
                    className="group relative cursor-pointer bg-card p-4 hover:bg-muted/30 cursor-grab active:cursor-grabbing"
                    style={{ border: "1px solid var(--border)" }}>
                    <div className="flex items-start gap-3">
                      {bm.favicon ? <img src={bm.favicon} alt="" className="mt-0.5 h-5 w-5" /> : <Bookmark className="mt-0.5 h-5 w-5 shrink-0 text-primary/60" />}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-medium">{bm.title || bm.url}</h3>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{bm.url}</p>
                        {bm.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/70">{bm.description}</p>}
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteBookmark(bm.id, e) }}
                      className="absolute right-2 top-2 p-1 text-muted-foreground/30 opacity-0 hover:text-destructive group-hover:opacity-100" title="删除">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── 主渲染 ──
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)", background: "var(--header-bg)" }}>
        <h1 className="mr-2 hidden text-sm font-bold tracking-tight sm:block"><span className="text-primary">Bookmark</span></h1>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索书签..."
            className="w-full bg-muted/50 px-3 py-1.5 pl-9 text-sm outline-none focus:bg-muted transition-colors placeholder:text-muted-foreground/50" />
        </div>

        <span className="whitespace-nowrap text-xs text-muted-foreground/60">{filteredBookmarks.length}/{bookmarks.length}</span>

        <div className="flex items-center gap-1">
          <button onClick={() => setViewMode(viewMode === "card" ? "tree" : "card")}
            className="p-1.5 text-muted-foreground/60 hover:text-foreground transition-colors" title={viewMode === "card" ? "文件夹视图" : "卡片视图"}>
            {viewMode === "card" ? <PanelLeftClose className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          </button>
          <div className="mx-1 h-4 w-px bg-border/50" />
          <button onClick={createBookmark} className="flex items-center gap-1 bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="h-3.5 w-3.5" /> 书签
          </button>
          <button onClick={createFolder} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
            <FolderPlus className="h-3.5 w-3.5" /> 文件夹
          </button>
          <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={handleImport} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={importing}
            className="px-2.5 py-1.5 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"><Upload className="h-3.5 w-3.5" /></button>
          <div className="relative group">
            <button className="px-2.5 py-1.5 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"><Download className="h-3.5 w-3.5" /></button>
            <div className="absolute right-0 top-full z-50 mt-1 hidden w-28 bg-card py-1 shadow group-hover:block" style={{ border: "1px solid var(--border)" }}>
              <a href="/api/bookmarks/export?format=html" className="block px-3 py-1.5 text-xs hover:bg-muted">导出 HTML</a>
              <a href="/api/bookmarks/export?format=json" className="block px-3 py-1.5 text-xs hover:bg-muted">导出 JSON</a>
            </div>
          </div>
          <button onClick={handleDetectDuplicates} disabled={dedupLoading}
            className="px-2.5 py-1.5 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
          <div className="mx-1 h-4 w-px bg-border/50" />
          <button onClick={toggleTheme} className="p-1.5 text-muted-foreground/60 hover:text-foreground transition-colors">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={() => signOut()} className="p-1.5 text-muted-foreground/60 hover:text-foreground transition-colors"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      {importResult && (
        <div className="px-6 py-2 text-sm bg-muted/30" style={{ borderBottom: "1px solid var(--border)" }}>
          {importResult}
          <button onClick={() => setImportResult(null)} className="ml-2 font-medium text-muted-foreground hover:text-foreground">关闭</button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        {viewMode === "card" ? renderCardView() : renderTreeView()}
      </main>

      {/* 去重面板 */}
      {showDedup && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-12" onClick={() => setShowDedup(false)}>
          <div className="w-full max-w-2xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="font-semibold">去重管理</h3>
              <button onClick={() => setShowDedup(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-5">
              {duplicates.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">没有发现重复书签 🎉</p> : (
                <div className="space-y-3">
                  {duplicates.map((group, gi) => (
                    <div key={gi} className="p-4" style={{ border: "1px solid var(--border)" }}>
                      <p className="mb-2 truncate text-xs font-medium text-muted-foreground" title={group.url}>{group.url}</p>
                      <div className="space-y-1">
                        {group.bookmarks.map((bm: any) => (
                          <label key={bm.id} className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted ${selectedDedupIds.has(bm.id) ? "bg-destructive/5 line-through opacity-60" : ""}`}>
                            <input type="checkbox" checked={selectedDedupIds.has(bm.id)}
                              onChange={(e) => { setSelectedDedupIds((prev) => { const n = new Set(prev); e.target.checked ? n.add(bm.id) : n.delete(bm.id); return n }) }} className="shrink-0 accent-primary" />
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
              <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--border)" }}>
                <button onClick={() => { setSelectedDedupIds((prev) => { const n = new Set(prev); duplicates.forEach((g: any) => { g.bookmarks.slice(1).forEach((bm: any) => n.add(bm.id)) }); return n }) }}
                  className="text-xs text-muted-foreground hover:text-foreground">保留每组第一个</button>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedDedupIds(new Set())} className="px-3 py-1.5 text-xs hover:bg-muted transition-colors">取消选择</button>
                  <button onClick={handleDeleteDedup} disabled={selectedDedupIds.size === 0}
                    className="bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">删除选中 ({selectedDedupIds.size})</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
