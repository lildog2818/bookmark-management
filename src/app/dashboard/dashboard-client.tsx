"use client"

import { useState, useCallback, useRef } from "react"
import { signOut } from "next-auth/react"
import { useTheme } from "@/lib/theme"
import {
  Plus, Search, LogOut, Bookmark,
  Folder as FolderIcon, ChevronRight, ChevronDown,
  Upload, Download, Trash2, X, Sun, Moon,
  FolderPlus, LayoutGrid, PanelLeftClose, CheckSquare, Scan, Loader2, Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"

interface Folder { id: string; name: string; color: string | null; icon: string | null; parentId: string | null; priority: number }
interface Bookmark { id: string; title: string; url: string; description: string | null; favicon: string | null; order: number; folderId: string | null }
interface Props { folders: Folder[]; bookmarks: Bookmark[]; userId: string }
type ViewMode = "card" | "tree"

export function DashboardClient({ folders: initialFolders, bookmarks: initialBookmarks }: Props) {
  const { theme, toggle: toggleTheme } = useTheme()
  const [folders, setFolders] = useState<Folder[]>(initialFolders)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks)
  const [viewMode, setViewMode] = useState<ViewMode>("card")
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [webQuery, setWebQuery] = useState("")
  const [customEngines, setCustomEngines] = useState<{ id: string; name: string; url: string }[]>([])
  const [showAddEngine, setShowAddEngine] = useState(false)
  const [newEngineName, setNewEngineName] = useState("")
  const [newEngineUrl, setNewEngineUrl] = useState("")
  const [webEngine, setWebEngine] = useState("bing")
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
  const [collapsedSubFolders, setCollapsedSubFolders] = useState<Set<string>>(new Set())
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [selectedBmIds, setSelectedBmIds] = useState<Set<string>>(new Set())

  // Dialog states
  const [showCreateBookmark, setShowCreateBookmark] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [showEditBookmark, setShowEditBookmark] = useState(false)
  const [showEditFolder, setShowEditFolder] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "bookmark" | "folder" | "selected"; id?: string } | null>(null)

  // Form states
  const [bmFormUrl, setBmFormUrl] = useState("")
  const [bmFormTitle, setBmFormTitle] = useState("")
  const [folderFormName, setFolderFormName] = useState("")
  const [folderPriority, setFolderPriority] = useState(0)

  const rootFolders = folders.filter((f) => !f.parentId).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  const childFoldersMap = new Map<string, Folder[]>()
  for (const f of folders) { const pid = f.parentId || "__root__"; if (!childFoldersMap.has(pid)) childFoldersMap.set(pid, []); childFoldersMap.get(pid)!.push(f) }
  const bookmarksByFolder = new Map<string, Bookmark[]>()
  for (const bm of bookmarks) { if (!bm.folderId) continue; if (!bookmarksByFolder.has(bm.folderId)) bookmarksByFolder.set(bm.folderId, []); bookmarksByFolder.get(bm.folderId)!.push(bm) }
  const searchMatch = (b: Bookmark) => b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.url.toLowerCase().includes(searchQuery.toLowerCase())
  const filteredBookmarks = searchQuery ? bookmarks.filter(searchMatch) : bookmarks
  const rootBookmarks = filteredBookmarks.filter((b) => !b.folderId)
  const filteredBookmarksByFolder = new Map<string, Bookmark[]>()
  for (const bm of filteredBookmarks) { if (!bm.folderId) continue; if (!filteredBookmarksByFolder.has(bm.folderId)) filteredBookmarksByFolder.set(bm.folderId, []); filteredBookmarksByFolder.get(bm.folderId)!.push(bm) }

  const toggleCollapse = (id: string) => setCollapsedSubFolders((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleExpand = (id: string) => setExpandedFolders((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const moveBookmark = useCallback(async (id: string, folderId: string | null) => {
    setBookmarks((prev) => prev.map((b) => b.id === id ? { ...b, folderId } : b))
    try { await fetch("/api/bookmarks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, folderId }) }) }
    catch { const r = await fetch("/api/bookmarks"); if (r.ok) setBookmarks(await r.json()) }
  }, [])

  const moveMultipleBookmarks = useCallback(async (ids: string[], folderId: string | null) => {
    setBookmarks((prev) => prev.map((b) => ids.includes(b.id) ? { ...b, folderId } : b))
    try { await Promise.all(ids.map((id) => fetch("/api/bookmarks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, folderId }) }))) }
    catch { const r = await fetch("/api/bookmarks"); if (r.ok) setBookmarks(await r.json()) }
    setSelectedBmIds(new Set()); setSelectMode(false)
  }, [])

  const openEditBookmark = useCallback((bm: Bookmark) => {
    setBmFormUrl(bm.url); setBmFormTitle(bm.title || ""); setEditingBookmark(bm); setShowEditBookmark(true)
  }, [])

  const confirmEditBookmark = useCallback(async () => {
    if (!editingBookmark) return
    const id = editingBookmark.id
    try {
      const res = await fetch("/api/bookmarks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, title: bmFormTitle.trim(), url: bmFormUrl.trim() }) })
      if (res.ok) setBookmarks((prev) => prev.map((b) => b.id === id ? { ...b, title: bmFormTitle.trim(), url: bmFormUrl.trim() } : b))
    } catch {}
    setShowEditBookmark(false); setEditingBookmark(null); setBmFormUrl(""); setBmFormTitle("")
  }, [editingBookmark, bmFormUrl, bmFormTitle])

  const handleDeleteBookmark = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); setDeleteConfirm({ type: "bookmark", id })
  }, [])

  const confirmDeleteBookmark = useCallback(async () => {
    if (!deleteConfirm || deleteConfirm.type !== "bookmark" || !deleteConfirm.id) return
    const id = deleteConfirm.id
    try { await fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); setBookmarks((prev) => prev.filter((b) => b.id !== id)) } catch {}
    setDeleteConfirm(null)
  }, [deleteConfirm])

  const confirmDeleteSelected = useCallback(async () => {
    if (!deleteConfirm || deleteConfirm.type !== "selected") return
    try { await Promise.all(Array.from(selectedBmIds).map((id) => fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }))) } catch {}
    setBookmarks((prev) => prev.filter((b) => !selectedBmIds.has(b.id)))
    setSelectedBmIds(new Set()); setSelectMode(false)
    setDeleteConfirm(null)
  }, [selectedBmIds, deleteConfirm])

  const getDescendantIds = (parentId: string): string[] => {
    const ids: string[] = []; const children = childFoldersMap.get(parentId) || []
    for (const child of children) { ids.push(child.id); ids.push(...getDescendantIds(child.id)) }
    return ids
  }

  const openEditFolder = useCallback((f: Folder) => {
    setFolderFormName(f.name); setFolderPriority(f.priority ?? 0); setEditingFolder(f); setShowEditFolder(true)
  }, [])

  const confirmEditFolder = useCallback(async () => {
    if (!editingFolder) return
    const id = editingFolder.id
    try {
      await fetch("/api/folders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name: folderFormName.trim(), priority: folderPriority }) })
      setFolders((prev) => prev.map((x) => x.id === id ? { ...x, name: folderFormName.trim(), priority: folderPriority } : x))
    } catch {}
    setShowEditFolder(false); setEditingFolder(null); setFolderFormName(""); setFolderPriority(0)
  }, [editingFolder, folderFormName, folderPriority])
  const handleDeleteFolder = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); setDeleteConfirm({ type: "folder", id })
  }, [])

  const confirmDeleteFolder = useCallback(async () => {
    if (!deleteConfirm || deleteConfirm.type !== "folder" || !deleteConfirm.id) return
    const id = deleteConfirm.id
    try {
      const allIds = [id, ...getDescendantIds(id)]
      await Promise.all(allIds.map((fid) => fetch("/api/folders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: fid }) })))
      const fRes = await fetch("/api/folders"); if (fRes.ok) setFolders(await fRes.json())
      const bRes = await fetch("/api/bookmarks"); if (bRes.ok) setBookmarks(await bRes.json())
    } catch {}
    setDeleteConfirm(null)
  }, [deleteConfirm, getDescendantIds])

  const handleCreateFolder = useCallback(async () => {
    if (!folderFormName.trim()) return
    try { const res = await fetch("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: folderFormName.trim(), parentId: null }) })
      if (res.ok) { const fRes = await fetch("/api/folders"); if (fRes.ok) setFolders(await fRes.json()) } } catch {}
    setShowCreateFolder(false); setFolderFormName("")
  }, [folderFormName])

  const handleCreateBookmark = useCallback(async () => {
    if (!bmFormUrl.trim()) return
    try { const res = await fetch("/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: bmFormTitle.trim() || null, url: bmFormUrl.trim(), folderId: selectedFolderId }) })
      if (res.ok) { const bm = await res.json(); setBookmarks((prev) => [...prev, bm]) } } catch {}
    setShowCreateBookmark(false); setBmFormUrl(""); setBmFormTitle("")
  }, [selectedFolderId, bmFormUrl, bmFormTitle])
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return; setImporting(true); setImportResult(null)
    try { const fd = new FormData(); fd.append("file", file); const r = await fetch("/api/bookmarks/import", { method: "POST", body: fd }); const d = await r.json()
      if (r.ok) { setImportResult(`成功导入 ${d.foldersCreated} 个文件夹和 ${d.bookmarksCreated} 个书签`); const [fR, bR] = await Promise.all([fetch("/api/folders"), fetch("/api/bookmarks")]); if (fR.ok) setFolders(await fR.json()); if (bR.ok) setBookmarks(await bR.json()) }
      else setImportResult(`导入失败：${d.error}`) } catch { setImportResult("导入失败，请检查文件格式") } finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = "" }
  }, [])

  const handleDetectDuplicates = useCallback(async () => {
    setDedupLoading(true)
    try { const r = await fetch("/api/bookmarks/detect-duplicates", { method: "POST" }); if (r.ok) { const d = await r.json(); setDuplicates(d.duplicates || []); setSelectedDedupIds(new Set()); setShowDedup(true) } } catch {}
    setDedupLoading(false)
  }, [])

  const handleDeleteDedup = useCallback(async () => {
    if (selectedDedupIds.size === 0) return
    const ids = Array.from(selectedDedupIds)
    try { await Promise.all(ids.map((id) => fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }))) } catch {}
    setBookmarks((prev) => prev.filter((b) => !selectedDedupIds.has(b.id)))
    setDuplicates((prev) => prev.map((g) => ({ ...g, bookmarks: g.bookmarks.filter((b: any) => !selectedDedupIds.has(b.id)) })).filter((g: any) => g.bookmarks.length > 1))
    setSelectedDedupIds(new Set())
  }, [selectedDedupIds])

  const dragProps = (folderId: string) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverFolderId(folderId) },
    onDragLeave: () => setDragOverFolderId(null),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); const srcId = draggedBmRef.current; if (!srcId) return; const tf = folderId === "__root__" ? null : folderId; if (selectMode && selectedBmIds.has(srcId)) { moveMultipleBookmarks(Array.from(selectedBmIds), tf) } else { moveBookmark(srcId, tf) }; setDragOverFolderId(null) },
  })
  const isOver = (id: string) => dragOverFolderId === id

  const handleReorder = useCallback(async (folderId: string | null, bmIds: string[]) => {
    try { await fetch("/api/bookmarks/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId, bookmarkIds: bmIds }) }) } catch {}
  }, [])

  function renderBookmarkRow(bm: Bookmark) {
    const isSel = selectedBmIds.has(bm.id)


  return (
      <div key={bm.id} className={`group flex items-center px-3 py-2 border-b border-border/30 last:border-0 ${isSel ? "bg-primary/5" : "hover:bg-muted/40"}`}>
        {selectMode && (<input type="checkbox" checked={isSel} onChange={() => { setSelectedBmIds((prev) => { const n = new Set(prev); n.has(bm.id) ? n.delete(bm.id) : n.add(bm.id); return n }) }} className="mr-2 shrink-0 accent-primary" />)}
        <div {...(!selectMode ? { draggable: true, onDragStart: () => { draggedBmRef.current = bm.id; (window as any).__dragSrcFolder = bm.folderId }, onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move" }, onDrop: (e: React.DragEvent) => { e.stopPropagation(); const srcId = draggedBmRef.current; const srcFolder = (window as any).__dragSrcFolder; if (!srcId || srcId === bm.id || srcFolder !== bm.folderId) return; setBookmarks((prev) => { const fb = prev.filter((x) => x.folderId === bm.folderId); const si = fb.findIndex((x) => x.id === srcId); const di = fb.findIndex((x) => x.id === bm.id); if (si < 0 || di < 0) return prev; const item = prev.find((x) => x.id === srcId)!; fb.splice(si, 1); fb.splice(di, 0, item); handleReorder(bm.folderId, fb.map((x) => x.id)); return prev.map((x) => ({ ...x, order: fb.findIndex((y) => y.id === x.id) })) }); draggedBmRef.current = null; setDragOverFolderId(null) }, onDragEnd: () => { draggedBmRef.current = null; setDragOverFolderId(null) } } : {})} className="flex flex-1 cursor-pointer items-center min-w-0" onClick={() => { if (!selectMode) window.open(bm.url, "_blank") }}>
          <span className="truncate text-sm font-medium">{bm.title || bm.url}</span>
        </div>
        {!selectMode && (<><button onClick={(e) => { e.stopPropagation(); openEditBookmark(bm) }} className="shrink-0 p-1.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-foreground"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
        <button onClick={(e) => handleDeleteBookmark(bm.id, e)} className="shrink-0 p-1.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></>)}
      </div>
    )
  }

  function renderSubFoldersInCard(parentId: string, depth = 0) {
    const children = childFoldersMap.get(parentId) || []
    return children.map((f) => {
      const bms = filteredBookmarksByFolder.get(f.id) || []; const isCollapsed = collapsedSubFolders.has(f.id)

  return (
        <div key={f.id} style={{ marginLeft: `${depth * 16}px` }}>
          <div {...dragProps(f.id)} className={`group flex items-center gap-1 px-3 py-1.5 ${isOver(f.id) ? "bg-primary/10" : ""}`}>
            <button onClick={() => toggleCollapse(f.id)} className="p-0.5 text-muted-foreground/60 hover:text-foreground">{isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button>
            <FolderIcon className="h-4 w-4 shrink-0" style={{ color: f.color || undefined }} /><span className="text-sm text-muted-foreground">{f.name}</span><span className="text-xs text-muted-foreground/40">{bms.length}</span>
            <button onClick={(e) => { e.stopPropagation(); openEditFolder(f) }} className="p-1 text-muted-foreground/30 opacity-100 hover:text-foreground" title="编辑"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button><button onClick={(e) => handleDeleteFolder(f.id, e)} className="ml-auto p-1 text-muted-foreground/30 opacity-100 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
          {!isCollapsed && (<div className="ml-4 pl-2" style={{ borderLeft: "1px solid var(--border)" }}>{bms.map(renderBookmarkRow)}{renderSubFoldersInCard(f.id, depth + 1)}</div>)}
        </div>
      )
    })
  }
    const handleFolderReorder = useCallback(async (fIds: string[]) => {
    try { await fetch("/api/folders/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderIds: fIds }) }) } catch {}
  }, [])

  const dragCardRef = useRef<string | null>(null)

  const handleWebSearch = useCallback((e: React.KeyboardEvent) => { if (e.key === 'Enter' && webQuery.trim()) { const allEngines = { ...searchEngines }; for (const ce of customEngines) { allEngines[ce.id as keyof typeof allEngines] = { name: ce.name, url: ce.url } }; const engine = allEngines[webEngine as keyof typeof allEngines]; if (engine) { window.open(engine.url + encodeURIComponent(webQuery.trim()), '_blank'); setWebQuery('') } } }, [webQuery, webEngine, customEngines])

  const searchEngines = { google: { name: "Google", url: "https://www.google.com/search?q=" }, bing: { name: "Bing", url: "https://www.bing.com/search?q=" }, duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=" }, baidu: { name: "百度", url: "https://www.baidu.com/s?wd=" } }
  function renderCardView() {
    if (filteredBookmarks.length === 0) {

  return (<div className="flex h-full items-center justify-center"><div className="text-center"><Bookmark className="mx-auto h-12 w-12 text-muted-foreground/30" /><p className="mt-4 text-sm text-muted-foreground">{searchQuery ? "没有找到匹配的书签" : "还没有书签"}</p></div></div>)
    }
    const allCards: ({ type: "root"; data: Bookmark[] } | { type: "folder"; data: Folder })[] = [
      ...rootFolders.map((f) => ({ type: "folder" as const, data: f })),
      ...(rootBookmarks.length > 0 ? [{ type: "root" as const, data: rootBookmarks }] : []),
    ]

  return (
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        {/* Web Search */}
        <div className="mb-4 flex items-center gap-2 py-2 px-3 bg-muted/30 rounded-lg mx-auto" style={{ border: "1px solid var(--border)", maxWidth: "520px" }}>
          <Globe className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          <input type="text" value={webQuery} onChange={(e) => setWebQuery(e.target.value)} onKeyDown={handleWebSearch}
            placeholder="搜索网页..." className="flex-1 bg-transparent px-2 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
          <select value={webEngine} onChange={(e) => setWebEngine(e.target.value)}
            className="bg-muted/50 text-xs text-foreground outline-none cursor-pointer py-1 px-2 rounded hover:bg-muted/80">
            <option value="google" style={{ color: "#fff", background: "#1e293b" }}>Google</option>
            <option value="bing" style={{ color: "#fff", background: "#1e293b" }}>Bing</option>
            <option value="duckduckgo" style={{ color: "#fff", background: "#1e293b" }}>DuckDuckGo</option>
            <option value="baidu" style={{ color: "#fff", background: "#1e293b" }}>百度</option>
            {customEngines.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
          </select>
          <button onClick={() => setShowAddEngine(true)} className="text-muted-foreground/40 hover:text-foreground p-1" title="添加搜索引擎"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg></button>
        </div>
        {selectMode && (
          <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-muted/50" style={{ border: "1px solid var(--border)", breakInside: "avoid-column", marginBottom: "1.25rem" }}>
            <button onClick={() => { setSelectedBmIds(new Set()); setSelectMode(false) }} className="text-xs text-muted-foreground hover:text-foreground">取消</button>
            <span className="text-xs text-muted-foreground">已选 {selectedBmIds.size} 项</span>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setDeleteConfirm({ type: "selected" })} disabled={selectedBmIds.size === 0} className="px-3 py-1.5 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">删除选中</button>
              <button onClick={() => { const f = prompt("目标文件夹 ID（留空=未分类）："); moveMultipleBookmarks(Array.from(selectedBmIds), f || null) }} disabled={selectedBmIds.size === 0} className="px-3 py-1.5 text-xs font-medium border hover:bg-muted disabled:opacity-50">移动到...</button>
            </div>
          </div>
        )}
        <div className="px-4 py-6 lg:px-8" style={{ columnCount: 3, columnGap: "1.25rem" }}>
          {allCards.map((card, ci) => {
            const isFolder = card.type === "folder"
            const cardId = isFolder ? card.data.id : "__root__"
            const isCollapsed = collapsedCards.has(cardId)

  return (
              <div key={isFolder ? card.data.id : "root"}
                        {...dragProps(cardId)}
                className={`bg-card transition-shadow ${isOver(cardId) ? "ring-2 ring-primary" : ""} ${isFolder ? "cursor-grab active:cursor-grabbing" : ""}`}
                style={{ border: "1px solid var(--border)", breakInside: "avoid-column", marginBottom: "1.25rem" }}>
                {card.type === "root" ? (
                  <><div className="flex items-center gap-2 px-4 pt-3 pb-2 cursor-pointer hover:bg-muted/20" onClick={() => setCollapsedCards((prev) => { const n = new Set(prev); n.has("__root__") ? n.delete("__root__") : n.add("__root__"); return n })} style={{ borderBottom: isCollapsed ? "none" : "1px solid var(--border)" }}>
                    <button onClick={(e) => { e.stopPropagation(); setCollapsedCards((prev) => { const n = new Set(prev); n.has("__root__") ? n.delete("__root__") : n.add("__root__"); return n }) }} className="p-0.5 text-muted-foreground/50 hover:text-foreground">{isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button><Bookmark className="h-4 w-4 text-muted-foreground/50" /><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">未分类</span><span className="ml-auto text-xs text-muted-foreground/40">{card.data.length}</span>
                  </div>{!isCollapsed && <div className="pb-1">{card.data.map(renderBookmarkRow)}</div>}</>
                ) : (
                  <><div className="group flex items-center gap-2 px-4 pt-3 pb-2 cursor-pointer hover:bg-muted/20" onClick={() => setCollapsedCards((prev) => { const n = new Set(prev); n.has(card.data.id) ? n.delete(card.data.id) : n.add(card.data.id); return n })}
                    style={{ borderBottom: isCollapsed ? "none" : "1px solid var(--border)" }}>
                    <button onClick={(e) => { e.stopPropagation(); setCollapsedCards((prev) => { const n = new Set(prev); n.has(card.data.id) ? n.delete(card.data.id) : n.add(card.data.id); return n }) }} className="p-0.5 text-muted-foreground/50 hover:text-foreground">
                      {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <FolderIcon className="h-4 w-4 shrink-0" style={{ color: card.data.color || undefined }} />
                    <span className="text-sm font-semibold">{card.data.name}</span>
                    {(filteredBookmarksByFolder.get(card.data.id)?.length || 0) > 0 && <span className="text-xs text-muted-foreground/40">{filteredBookmarksByFolder.get(card.data.id)?.length}</span>}
                    <button onClick={(e) => { e.stopPropagation(); openEditFolder(card.data) }} className="p-1 text-muted-foreground/30 opacity-100 hover:text-foreground" title="编辑"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button><button onClick={(e) => handleDeleteFolder(card.data.id, e)} className="p-1 text-muted-foreground/30 opacity-100 hover:text-destructive" title="删除"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {!isCollapsed && (<div className="pb-1">{(() => { const bms = filteredBookmarksByFolder.get(card.data.id) || []; const subs = childFoldersMap.get(card.data.id) || []; const hasSub = subs.some((sf) => { const sfb = filteredBookmarksByFolder.get(sf.id) || []; return sfb.length > 0 || (childFoldersMap.get(sf.id) || []).length > 0 }); if (bms.length === 0 && !hasSub) return <p className="px-4 py-6 text-xs text-muted-foreground/40">空文件夹</p>; return <>{bms.map(renderBookmarkRow)}{renderSubFoldersInCard(card.data.id)}</> })()}</div>)}
                  </>)}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
function renderTreeSidebar() {
    const renderTree = (list: Folder[], depth = 0) => list.map((f) => {
      const children = childFoldersMap.get(f.id) || []; const isExpanded = expandedFolders.has(f.id); const isSelected = selectedFolderId === f.id

  return (<div key={f.id}><div {...dragProps(f.id)} className={`group flex items-center ${isOver(f.id) ? "bg-primary/10" : ""}`}>
        <div className="flex w-full items-center">
          <button onClick={() => { setSelectedFolderId(f.id); if (children.length > 0) toggleExpand(f.id) }}
            className={`flex w-full items-center gap-1 px-2 py-1.5 text-sm hover:bg-muted ${isSelected ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}`}
            style={{ paddingLeft: `${8 + depth * 14}px` }}>
            {children.length > 0 ? (isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />) : <span className="w-3" />}
            <FolderIcon className="h-4 w-4 shrink-0" style={{ color: f.color || undefined }} /><span className="truncate">{f.name}</span>
            {(bookmarksByFolder.get(f.id)?.length || 0) > 0 && <span className="ml-auto text-xs text-muted-foreground/40">{bookmarksByFolder.get(f.id)?.length}</span>}
          </button>
          <button onClick={(e) => { e.stopPropagation(); openEditFolder(f) }} className="p-1 text-muted-foreground/30 opacity-100 hover:text-foreground" title="编辑"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button><button onClick={(e) => handleDeleteFolder(f.id, e)} className="shrink-0 p-1.5 text-muted-foreground/30 opacity-100 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div></div>
        {isExpanded && children.length > 0 && <div>{renderTree(children, depth + 1)}</div>}</div>)
    })

  return (
      <aside className="hidden w-56 shrink-0 bg-sidebar-bg lg:flex lg:flex-col" style={{ borderRight: "1px solid var(--border)" }}>
        <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}><h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">文件夹</h2></div>
        <div className="flex-1 overflow-y-auto p-2">
          <div {...dragProps("__root__")} className={isOver("__root__") ? "bg-primary/10" : ""}>
            <button onClick={() => setSelectedFolderId(null)} className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted ${selectedFolderId === null ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}`}>
              <Bookmark className="h-4 w-4" /> 全部书签</button>
          </div>
          <div className="mt-1">{renderTree(rootFolders)}</div>
        </div>
      </aside>
    )
  }

  function renderTreeView() {
    const display = selectedFolderId ? bookmarks.filter((b) => b.folderId === selectedFolderId && (!searchQuery || searchMatch(b))) : filteredBookmarks

  return (
      <div className="flex flex-1 overflow-hidden">
        {renderTreeSidebar()}
        <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          {display.length === 0 ? (<div className="flex h-full items-center justify-center"><div className="text-center"><Bookmark className="mx-auto h-12 w-12 text-muted-foreground/30" /><p className="mt-4 text-sm text-muted-foreground">{searchQuery ? "没有匹配" : "空的"}</p></div></div>
          ) : (<div className="mx-auto max-w-7xl"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {display.map((bm) => (
              <div key={bm.id} draggable onDragStart={() => { draggedBmRef.current = bm.id }} onDragEnd={() => { draggedBmRef.current = null; setDragOverFolderId(null) }}
                onClick={() => { if (!selectMode) window.open(bm.url, "_blank") }} className="group relative cursor-pointer bg-card p-4 hover:bg-muted/30 cursor-grab active:cursor-grabbing" style={{ border: "1px solid var(--border)", breakInside: "avoid-column", marginBottom: "1.25rem" }}>
                <div className="flex items-start gap-3">
                  {bm.favicon ? <img src={bm.favicon} alt="" className="mt-0.5 h-5 w-5" /> : <Bookmark className="mt-0.5 h-5 w-5 shrink-0 text-primary/60" />}
                  <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-medium">{bm.title || bm.url}</h3><p className="mt-0.5 truncate text-xs text-muted-foreground">{bm.url}</p></div>
                </div>
                <div className="absolute right-2 top-2 flex gap-1"><button onClick={(e) => { e.stopPropagation(); openEditBookmark(bm) }} className="p-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-foreground"><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button><button onClick={(e) => { e.stopPropagation(); handleDeleteBookmark(bm.id, e) }} className="p-1 text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></div>
              </div>
            ))}
          </div></div>)}
        </div>
      </div>
    )
  }




  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border)", background: "var(--header-bg)" }}>
        <h1 className="mr-2 hidden text-sm font-bold tracking-tight sm:block"><span className="text-primary">Bookmark</span></h1>
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索书签..." className="w-full bg-muted/50 px-3 py-1.5 pl-9 text-sm outline-none focus:bg-muted transition-colors placeholder:text-muted-foreground/70" /></div>
        <span className="whitespace-nowrap text-xs text-muted-foreground/60">{filteredBookmarks.length}/{bookmarks.length}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setViewMode(viewMode === "card" ? "tree" : "card")} className="p-1.5 text-muted-foreground/60 hover:text-foreground" title={viewMode === "card" ? "文件夹" : "卡片"}>
            {viewMode === "card" ? <PanelLeftClose className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}</button>
          <button onClick={() => { setSelectMode(!selectMode); if (selectMode) setSelectedBmIds(new Set()) }}
            className={`p-1.5 transition-colors ${selectMode ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"}`} title="多选模式"><CheckSquare className="h-4 w-4" /></button>
          <div className="mx-1 h-4 w-px bg-border/50" />
          <button onClick={() => setShowCreateBookmark(true)} className="flex items-center gap-1 bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-3.5 w-3.5" /> 书签</button>
          <button onClick={() => setShowCreateFolder(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"><FolderPlus className="h-3.5 w-3.5" /> 文件夹</button>
          <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={handleImport} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="px-2.5 py-1.5 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted disabled:opacity-50"><Upload className="h-3.5 w-3.5" /></button>
          <div className="relative group"><button className="px-2.5 py-1.5 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted"><Download className="h-3.5 w-3.5" /></button>
            <div className="absolute right-0 top-full z-50 mt-1 hidden w-28 bg-card py-1 shadow group-hover:block" style={{ border: "1px solid var(--border)", breakInside: "avoid-column", marginBottom: "1.25rem" }}>
              <a href="/api/bookmarks/export?format=html" className="block px-3 py-1.5 text-xs hover:bg-muted">导出 HTML</a>
              <a href="/api/bookmarks/export?format=json" className="block px-3 py-1.5 text-xs hover:bg-muted">导出 JSON</a></div></div>
          <Tooltip><TooltipTrigger onClick={handleDetectDuplicates} disabled={dedupLoading} className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors">{dedupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scan className="h-3.5 w-3.5" />}<span className="hidden sm:inline">去重</span></TooltipTrigger><TooltipContent>检测并清理重复书签</TooltipContent></Tooltip>
          <div className="mx-1 h-4 w-px bg-border/50" />
          <button onClick={toggleTheme} className="p-1.5 text-muted-foreground/60 hover:text-foreground">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          <button onClick={() => signOut({ callbackUrl: "/" })} className="p-1.5 text-muted-foreground/60 hover:text-foreground"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>
      {importResult && (<div className="px-6 py-2 text-sm bg-muted/30" style={{ borderBottom: "1px solid var(--border)" }}>{importResult}<button onClick={() => setImportResult(null)} className="ml-2 font-medium text-muted-foreground hover:text-foreground">关闭</button></div>)}
      <main className="flex-1 overflow-y-auto">{viewMode === "card" ? renderCardView() : renderTreeView()}</main>

            <Dialog open={showDedup} onOpenChange={(o) => { if (!o) setShowDedup(false) }}>
        <DialogContent className="max-w-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>去重管理</DialogTitle>
            <DialogDescription>选择要删除的重复书签</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto">
            {duplicates.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">没有发现重复书签 🎉</p> : (
              <div className="space-y-3">{duplicates.map((group, gi) => (
                <div key={gi} className="rounded-lg border p-4">
                  <p className="mb-2 truncate text-xs font-medium text-muted-foreground" title={group.url}>{group.url}</p>
                  {group.bookmarks.map((bm: any) => (
                    <label key={bm.id} className={"flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted " + (selectedDedupIds.has(bm.id) ? "bg-destructive/5 line-through opacity-60" : "")}>
                      <input type="checkbox" checked={selectedDedupIds.has(bm.id)} onChange={(e) => { setSelectedDedupIds((prev) => { const n = new Set(prev); e.target.checked ? n.add(bm.id) : n.delete(bm.id); return n }) }} className="shrink-0 accent-primary" />
                      <span className="flex-1 truncate">{bm.title || bm.url}</span>
                    </label>
                  ))}
                </div>
              ))}</div>
            )}
          </div>
          {duplicates.length > 0 && (
            <div className="flex items-center justify-between border-t pt-4">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedDedupIds((prev) => { const n = new Set(prev); duplicates.forEach((g: any) => { g.bookmarks.slice(1).forEach((bm: any) => n.add(bm.id)) }); return n }) }}>保留每组第一个</Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedDedupIds(new Set())}>取消选择</Button>
                <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteDedup} disabled={selectedDedupIds.size === 0}>删除选中 ({selectedDedupIds.size})</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
  {/* Create Bookmark Dialog */}
  <Dialog open={showCreateBookmark} onOpenChange={(o) => { if (!o) { setShowCreateBookmark(false); setBmFormUrl(""); setBmFormTitle("") } }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>添加书签</DialogTitle>
        <DialogDescription>输入书签的 URL 和标题</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor="url">URL</Label>
          <Input id="url" value={bmFormUrl} onChange={(e) => setBmFormUrl(e.target.value)} placeholder="https://example.com" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="title">标题（可选）</Label>
          <Input id="title" value={bmFormTitle} onChange={(e) => setBmFormTitle(e.target.value)} placeholder="书签标题" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => { setShowCreateBookmark(false); setBmFormUrl(""); setBmFormTitle("") }}>取消</Button>
        <Button onClick={handleCreateBookmark} disabled={!bmFormUrl.trim()}>添加</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  {/* Create Folder Dialog */}
  <Dialog open={showCreateFolder} onOpenChange={(o) => { if (!o) { setShowCreateFolder(false); setFolderFormName("") } }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>新建文件夹</DialogTitle>
        <DialogDescription>输入文件夹名称</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor="folderName">名称</Label>
          <Input id="folderName" value={folderFormName} onChange={(e) => setFolderFormName(e.target.value)} placeholder="文件夹名称" onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder() }} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => { setShowCreateFolder(false); setFolderFormName("") }}>取消</Button>
        <Button onClick={handleCreateFolder} disabled={!folderFormName.trim()}>创建</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  {/* Edit Bookmark Dialog */}
  <Dialog open={showEditBookmark} onOpenChange={(o) => { if (!o) { setShowEditBookmark(false); setEditingBookmark(null); setBmFormUrl(""); setBmFormTitle("") } }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>编辑书签</DialogTitle>
        <DialogDescription>修改书签的 URL 和标题</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor="editUrl">URL</Label>
          <Input id="editUrl" value={bmFormUrl} onChange={(e) => setBmFormUrl(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="editTitle">标题</Label>
          <Input id="editTitle" value={bmFormTitle} onChange={(e) => setBmFormTitle(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => { setShowEditBookmark(false); setEditingBookmark(null); setBmFormUrl(""); setBmFormTitle("") }}>取消</Button>
        <Button onClick={confirmEditBookmark} disabled={!bmFormUrl.trim()}>保存</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  {/* Edit Folder Dialog */}
  <Dialog open={showEditFolder} onOpenChange={(o) => { if (!o) { setShowEditFolder(false); setEditingFolder(null); setFolderFormName(""); setFolderPriority(0) } }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>编辑文件夹</DialogTitle>
        <DialogDescription>修改文件夹名称</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor="editFolderName">名称</Label>
          <Input id="editFolderName" value={folderFormName} onChange={(e) => setFolderFormName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmEditFolder() }} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="folderPriority">优先级</Label>
          <Input id="folderPriority" type="number" value={folderPriority} onChange={(e) => setFolderPriority(parseInt(e.target.value) || 0)} />
          <p className="text-xs text-muted-foreground">数字越大，排序越靠前</p>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => { setShowEditFolder(false); setEditingFolder(null); setFolderFormName(""); setFolderPriority(0) }}>取消</Button>
        <Button onClick={confirmEditFolder} disabled={!folderFormName.trim()}>保存</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>


  
  {/* Add Search Engine Dialog */}
  <Dialog open={showAddEngine} onOpenChange={(o) => { if (!o) { setShowAddEngine(false); setNewEngineName(""); setNewEngineUrl("") } }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>添加搜索引擎</DialogTitle>
        <DialogDescription>输入搜索引擎名称和搜索URL（用 {'{query}'} 表示关键词位置）</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor="engineName">名称</Label>
          <Input id="engineName" value={newEngineName} onChange={(e) => setNewEngineName(e.target.value)} placeholder="例如: 知乎" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="engineUrl">搜索 URL</Label>
          <Input id="engineUrl" value={newEngineUrl} onChange={(e) => setNewEngineUrl(e.target.value)} placeholder="例如: https://www.zhihu.com/search?q=" />
          <p className="text-xs text-muted-foreground">{'{query}'} 会自动替换为关键词</p>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => { setShowAddEngine(false); setNewEngineName(""); setNewEngineUrl("") }}>取消</Button>
        <Button onClick={() => { if (newEngineName.trim() && newEngineUrl.trim()) { const id = "custom_" + Date.now(); setCustomEngines((prev) => [...prev, { id, name: newEngineName.trim(), url: newEngineUrl.trim() }]); setShowAddEngine(false); setNewEngineName(""); setNewEngineUrl("") } }} disabled={!newEngineName.trim() || !newEngineUrl.trim()}>添加</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/* Delete Confirmation AlertDialog */}
  <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null) }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>确认删除</AlertDialogTitle>
        <AlertDialogDescription>
          {deleteConfirm?.type === "bookmark" && "确定要删除这个书签吗？此操作不可撤销。"}
          {deleteConfirm?.type === "folder" && "确定要删除这个文件夹及其所有子文件夹和书签吗？此操作不可撤销。"}
          {deleteConfirm?.type === "selected" && ("确定要删除选中的 " + selectedBmIds.size + " 个书签吗？此操作不可撤销。")}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>取消</AlertDialogCancel>
        <AlertDialogAction onClick={() => {
          if (deleteConfirm?.type === "bookmark") confirmDeleteBookmark()
          else if (deleteConfirm?.type === "folder") confirmDeleteFolder()
          else if (deleteConfirm?.type === "selected") confirmDeleteSelected()
        }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
          删除
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
    </div>
  )
}






















