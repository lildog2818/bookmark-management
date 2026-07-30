"use client"

import { useState, useCallback, useRef, useMemo } from "react"
import { signOut } from "next-auth/react"
import { useTheme, themes } from "@/lib/theme"
import {
  Plus, Search, LogOut, Bookmark,
  Folder as FolderIcon, ChevronRight, ChevronDown,
  Upload, Download, Trash2, X,
  FolderPlus, LayoutGrid, PanelLeftClose, CheckSquare, Scan, Loader2, Globe,
  BarChart3, Link2Off, Menu, Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

// ── 类型定义 ──
interface Folder { id: string; name: string; color: string | null; icon: string | null; parentId: string | null; priority: number; isFavorite: boolean }
interface Bookmark { id: string; title: string; url: string; description: string | null; favicon: string | null; order: number; folderId: string | null }
interface Props { folders: Folder[]; bookmarks: Bookmark[]; userId: string }
type ViewMode = "card" | "tree"

interface DuplicateGroup { url: string; count: number; bookmarks: Bookmark[] }
interface StatsData {
  totalBookmarks: number; totalFolders: number; uncategorizedBookmarks: number
  recentBookmarks: number; latestBookmarks: { id: string; title: string; url: string; favicon: string | null; createdAt: string }[]
  mostVisitedBookmarks: { id: string; title: string; url: string; favicon: string | null; lastUsedAt: string }[]
  folderStats: { id: string; name: string; color: string | null; isFavorite: boolean; count: number }[]
}
interface DeadLink { id: string; url: string; title: string; status: number | string }

// ── 模块级常量（避免每次渲染重建） ──
const SEARCH_ENGINES: Record<string, { name: string; url: string }> = {
  google: { name: "Google", url: "https://www.google.com/search?q=" },
  bing: { name: "Bing", url: "https://www.bing.com/search?q=" },
  duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
  baidu: { name: "百度", url: "https://www.baidu.com/s?wd=" },
}

function distributeIntoColumns<T>(items: T[], cols: number, getWeight: (item: T) => number): T[][] {
  const result: T[][] = Array.from({ length: cols }, () => [])
  const colWeights: number[] = Array(cols).fill(0)
  for (const item of items) {
    let minIdx = 0
    for (let j = 1; j < cols; j++) {
      if (colWeights[j] < colWeights[minIdx]) minIdx = j
    }
    result[minIdx].push(item)
    colWeights[minIdx] += getWeight(item)
  }
  return result
}

const DEAD_LINK_LABELS: Record<string, string> = {
  ENOTFOUND: "域名不存在", ECONNREFUSED: "连接被拒", ENETUNREACH: "网络不可达",
  "521": "521 源站宕机", "522": "522 连接超时", "523": "523 源站不可达",
  "524": "524 网关超时", "525": "525 SSL握手失败", "526": "526 SSL证书无效",
  "527": "527 Railgun错误", "530": "530 源站DNS错误",
}

const FOLDER_ICON_COLOR = (c: string | null) => (c && c !== "#3b82f6") ? c : undefined
const FolderTypeIcon = ({ f, className = "h-4 w-4 shrink-0" }: { f: { isFavorite: boolean; color: string | null }; className?: string }) =>
  f.isFavorite ? <Star className={className} style={{ color: "rgb(234, 179, 8)" }} /> : <FolderIcon className={className} style={{ color: FOLDER_ICON_COLOR(f.color) }} />

// ── 组件 ──
export function DashboardClient({ folders: initialFolders, bookmarks: initialBookmarks }: Props) {
  const { theme, setThemeId } = useTheme()
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
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([])
  const [selectedDedupIds, setSelectedDedupIds] = useState<Set<string>>(new Set())
  const [dedupLoading, setDedupLoading] = useState(false)
  const [collapsedSubFolders, setCollapsedSubFolders] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [selectedBmIds, setSelectedBmIds] = useState<Set<string>>(new Set())

  const [showStats, setShowStats] = useState(false)
  const [statsData, setStatsData] = useState<StatsData | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [showDeadLinks, setShowDeadLinks] = useState(false)
  const [deadLinks, setDeadLinks] = useState<DeadLink[]>([])
  const [deadLinksLoading, setDeadLinksLoading] = useState(false)

  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [showMobileExport, setShowMobileExport] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)

  const [showCreateBookmark, setShowCreateBookmark] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null)
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [showEditBookmark, setShowEditBookmark] = useState(false)
  const [showEditFolder, setShowEditFolder] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "bookmark" | "folder" | "selected"; id?: string } | null>(null)

  const [bmFormUrl, setBmFormUrl] = useState("")
  const [bmFormTitle, setBmFormTitle] = useState("")
  const [bmFormFolderId, setBmFormFolderId] = useState<string | null>(null)
  const [folderFormName, setFolderFormName] = useState("")
  const [folderPriority, setFolderPriority] = useState(0)
  const [folderFormIsFavorite, setFolderFormIsFavorite] = useState(false)

  // ── useMemo：派生数据，避免每次渲染重建 ──
  const rootFolders = useMemo(
    () => folders.filter((f) => !f.parentId).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)),
    [folders],
  )

  const childFoldersMap = useMemo(() => {
    const m = new Map<string, Folder[]>()
    for (const f of folders) {
      const pid = f.parentId || "__root__"
      if (!m.has(pid)) m.set(pid, [])
      m.get(pid)!.push(f)
    }
    return m
  }, [folders])

  const bookmarksByFolder = useMemo(() => {
    const m = new Map<string, Bookmark[]>()
    for (const bm of bookmarks) {
      if (!bm.folderId) continue
      if (!m.has(bm.folderId)) m.set(bm.folderId, [])
      m.get(bm.folderId)!.push(bm)
    }
    return m
  }, [bookmarks])

  const filteredBookmarks = useMemo(() => {
    if (!searchQuery) return bookmarks
    const q = searchQuery.toLowerCase()
    return bookmarks.filter((b) => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q))
  }, [bookmarks, searchQuery])

  const rootBookmarks = useMemo(() => filteredBookmarks.filter((b) => !b.folderId), [filteredBookmarks])

  const filteredBookmarksByFolder = useMemo(() => {
    const m = new Map<string, Bookmark[]>()
    for (const bm of filteredBookmarks) {
      if (!bm.folderId) continue
      if (!m.has(bm.folderId)) m.set(bm.folderId, [])
      m.get(bm.folderId)!.push(bm)
    }
    return m
  }, [filteredBookmarks])

  const searchMatch = useCallback(
    (b: Bookmark) => b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.url.toLowerCase().includes(searchQuery.toLowerCase()),
    [searchQuery],
  )

  const toggleCollapse = (id: string) => setCollapsedSubFolders((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleExpand = (id: string) => setExpandedFolders((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── 数据操作 ──
  const refetchData = useCallback(async () => {
    const [fR, bR] = await Promise.all([fetch("/api/folders"), fetch("/api/bookmarks")])
    if (fR.ok) setFolders(await fR.json())
    if (bR.ok) setBookmarks(await bR.json())
  }, [])

  const moveBookmark = useCallback(async (id: string, folderId: string | null) => {
    setBookmarks((prev) => prev.map((b) => b.id === id ? { ...b, folderId } : b))
    try {
      const res = await fetch("/api/bookmarks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, folderId }) })
      if (!res.ok) await refetchData()
    } catch { await refetchData() }
  }, [refetchData])

  const moveMultipleBookmarks = useCallback(async (ids: string[], folderId: string | null) => {
    setBookmarks((prev) => prev.map((b) => ids.includes(b.id) ? { ...b, folderId } : b))
    try {
      const results = await Promise.all(ids.map((id) => fetch("/api/bookmarks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, folderId }) })))
      if (results.some((r) => !r.ok)) await refetchData()
    } catch { await refetchData() }
    setSelectedBmIds(new Set()); setSelectMode(false)
  }, [refetchData])

  const openEditBookmark = (bm: Bookmark) => {
    setBmFormUrl(bm.url); setBmFormTitle(bm.title || ""); setBmFormFolderId(bm.folderId)
    setEditingBookmark(bm); setShowEditBookmark(true)
  }

  const confirmEditBookmark = useCallback(async () => {
    if (!editingBookmark) return
    const { id } = editingBookmark
    const title = bmFormTitle.trim()
    const url = bmFormUrl.trim()
    const folderId = bmFormFolderId
    try {
      const res = await fetch("/api/bookmarks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, title, url, folderId }) })
      if (res.ok) setBookmarks((prev) => prev.map((b) => b.id === id ? { ...b, title, url, folderId } : b))
    } catch { /* ignore */ }
    setShowEditBookmark(false); setEditingBookmark(null); setBmFormUrl(""); setBmFormTitle(""); setBmFormFolderId(null)
  }, [editingBookmark, bmFormUrl, bmFormTitle, bmFormFolderId])

  const handleDeleteBookmark = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setDeleteConfirm({ type: "bookmark", id }) }

  const confirmDeleteBookmark = useCallback(async () => {
    if (!deleteConfirm || deleteConfirm.type !== "bookmark" || !deleteConfirm.id) return
    const { id } = deleteConfirm
    try { await fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }) } catch { /* ignore */ }
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
    setDeleteConfirm(null)
  }, [deleteConfirm])

  const confirmDeleteSelected = useCallback(async () => {
    if (!deleteConfirm || deleteConfirm.type !== "selected") return
    const ids = Array.from(selectedBmIds)
    try { await Promise.all(ids.map((id) => fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }))) } catch { /* ignore */ }
    setBookmarks((prev) => prev.filter((b) => !selectedBmIds.has(b.id)))
    setSelectedBmIds(new Set()); setSelectMode(false)
    setDeleteConfirm(null)
  }, [selectedBmIds, deleteConfirm])

  const getDescendantIds = useCallback((parentId: string): string[] => {
    const ids: string[] = []
    const children = childFoldersMap.get(parentId) || []
    for (const child of children) { ids.push(child.id); ids.push(...getDescendantIds(child.id)) }
    return ids
  }, [childFoldersMap])

  const openEditFolder = (f: Folder) => {
    setFolderFormName(f.name); setFolderPriority(f.priority ?? 0); setEditingFolder(f); setShowEditFolder(true)
  }

  const confirmEditFolder = useCallback(async () => {
    if (!editingFolder) return
    const { id } = editingFolder
    const name = folderFormName.trim()
    try {
      await fetch("/api/folders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name, priority: folderPriority }) })
      setFolders((prev) => prev.map((x) => x.id === id ? { ...x, name, priority: folderPriority } : x))
    } catch { /* ignore */ }
    setShowEditFolder(false); setEditingFolder(null); setFolderFormName(""); setFolderPriority(0)
  }, [editingFolder, folderFormName, folderPriority])

  const handleDeleteFolder = (id: string, e: React.MouseEvent) => { e.stopPropagation(); setDeleteConfirm({ type: "folder", id }) }

  const confirmDeleteFolder = useCallback(async () => {
    if (!deleteConfirm || deleteConfirm.type !== "folder" || !deleteConfirm.id) return
    const { id } = deleteConfirm
    try {
      const allIds = [id, ...getDescendantIds(id)]
      await Promise.all(allIds.map((fid) => fetch("/api/folders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: fid }) })))
      await refetchData()
    } catch { /* ignore */ }
    setDeleteConfirm(null)
  }, [deleteConfirm, getDescendantIds, refetchData])

  const handleCreateFolder = useCallback(async () => {
    if (!folderFormName.trim()) return
    try {
      const res = await fetch("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: folderFormName.trim(), parentId: null, isFavorite: folderFormIsFavorite }) })
      if (res.ok) await refetchData()
    } catch { /* ignore */ }
    setShowCreateFolder(false); setFolderFormName(""); setFolderFormIsFavorite(false)
  }, [folderFormName, folderFormIsFavorite, refetchData])

  const handleCreateBookmark = useCallback(async () => {
    if (!bmFormUrl.trim()) return
    try {
      const res = await fetch("/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: bmFormTitle.trim() || null, url: bmFormUrl.trim(), folderId: bmFormFolderId }) })
      if (res.ok) { const bm = await res.json(); setBookmarks((prev) => [...prev, bm]) }
    } catch { /* ignore */ }
    setShowCreateBookmark(false); setBmFormUrl(""); setBmFormTitle(""); setBmFormFolderId(null)
  }, [bmFormFolderId, bmFormUrl, bmFormTitle])

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true); setImportResult(null)
    try {
      const fd = new FormData(); fd.append("file", file)
      const r = await fetch("/api/bookmarks/import", { method: "POST", body: fd })
      const d = await r.json()
      if (r.ok) { setImportResult(`成功导入 ${d.foldersCreated} 个文件夹和 ${d.bookmarksCreated} 个书签`); await refetchData() }
      else setImportResult(`导入失败：${d.error}`)
    } catch { setImportResult("导入失败，请检查文件格式") }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = "" }
  }, [refetchData])

  const handleDetectDuplicates = useCallback(async () => {
    setDedupLoading(true)
    try {
      const r = await fetch("/api/bookmarks/detect-duplicates", { method: "POST" })
      if (r.ok) { const d = await r.json(); setDuplicates(d.duplicates || []); setSelectedDedupIds(new Set()); setShowDedup(true) }
    } catch { /* ignore */ }
    setDedupLoading(false)
  }, [])

  const handleDeleteDedup = useCallback(async () => {
    if (selectedDedupIds.size === 0) return
    const ids = Array.from(selectedDedupIds)
    try { await Promise.all(ids.map((id) => fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }))) } catch { /* ignore */ }
    setBookmarks((prev) => prev.filter((b) => !selectedDedupIds.has(b.id)))
    setDuplicates((prev) => prev.map((g) => ({ ...g, bookmarks: g.bookmarks.filter((b) => !selectedDedupIds.has(b.id)) })).filter((g) => g.bookmarks.length > 1))
    setSelectedDedupIds(new Set())
  }, [selectedDedupIds])

  const handleShowStats = useCallback(async () => {
    setStatsLoading(true); setShowStats(true)
    try { const r = await fetch("/api/bookmarks/stats"); if (r.ok) setStatsData(await r.json()) } catch { /* ignore */ }
    setStatsLoading(false)
  }, [])

  const handleCheckDeadLinks = useCallback(async () => {
    setDeadLinksLoading(true); setShowDeadLinks(true)
    try { const r = await fetch("/api/bookmarks/check-dead-links", { method: "POST" }); if (r.ok) { const d = await r.json(); setDeadLinks(d.deadLinks || []) } } catch { /* ignore */ }
    setDeadLinksLoading(false)
  }, [])

  const handleReorder = useCallback(async (folderId: string | null, bmIds: string[]) => {
    try { await fetch("/api/bookmarks/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId, bookmarkIds: bmIds }) }) } catch { /* ignore */ }
  }, [])

  const handleFolderReorder = useCallback(async (fIds: string[]) => {
    try { await fetch("/api/folders/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderIds: fIds }) }) } catch { /* ignore */ }
  }, [])

  const handleWebSearch = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || !webQuery.trim()) return
    const allEngines = { ...SEARCH_ENGINES }
    for (const ce of customEngines) allEngines[ce.id] = { name: ce.name, url: ce.url }
    const engine = allEngines[webEngine]
    if (engine) { window.open(engine.url + encodeURIComponent(webQuery.trim()), "_blank", "noopener,noreferrer"); setWebQuery("") }
  }, [webQuery, webEngine, customEngines])

  // ── 拖拽辅助 ──
  const dragProps = useCallback((folderId: string) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverFolderId(folderId) },
    onDragLeave: () => setDragOverFolderId(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      const srcId = draggedBmRef.current; if (!srcId) return
      const tf = folderId === "__root__" ? null : folderId
      if (selectMode && selectedBmIds.has(srcId)) moveMultipleBookmarks(Array.from(selectedBmIds), tf)
      else moveBookmark(srcId, tf)
      setDragOverFolderId(null)
    },
  }), [selectMode, selectedBmIds, moveMultipleBookmarks, moveBookmark])

  const isOver = useCallback((id: string) => dragOverFolderId === id, [dragOverFolderId])

  // ── 渲染函数 ──
  function renderBookmarkRow(bm: Bookmark) {
    const isSel = selectedBmIds.has(bm.id)
    const handleDragStart = () => { draggedBmRef.current = bm.id; (window as any).__dragSrcFolder = bm.folderId }
    const handleDragEnd = () => { draggedBmRef.current = null; setDragOverFolderId(null) }
    const handleRowDrop = (e: React.DragEvent) => {
      e.stopPropagation()
      const srcId = draggedBmRef.current
      const srcFolder = (window as any).__dragSrcFolder
      if (!srcId || srcId === bm.id || srcFolder !== bm.folderId) return
      setBookmarks((prev) => {
        const fb = prev.filter((x) => x.folderId === bm.folderId)
        const si = fb.findIndex((x) => x.id === srcId)
        const di = fb.findIndex((x) => x.id === bm.id)
        if (si < 0 || di < 0) return prev
        const item = fb.splice(si, 1)[0]
        fb.splice(di, 0, item)
        handleReorder(bm.folderId, fb.map((x) => x.id))
        return prev.map((x) => ({ ...x, order: fb.findIndex((y) => y.id === x.id) }))
      })
      draggedBmRef.current = null; setDragOverFolderId(null)
    }
    const handleClick = () => {
      if (selectMode) return
      fetch("/api/bookmarks/touch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: bm.id }) })
        .then((r) => r.json()).then((d) => { if (d.success) setBookmarks((prev) => { const arr = [...prev]; const idx = arr.findIndex((x) => x.id === bm.id); if (idx >= 0) { const [item] = arr.splice(idx, 1); arr.unshift(item) } return arr }) }).catch(() => {})
      window.open(bm.url, "_blank", "noopener,noreferrer")
    }

    return (
      <div key={bm.id} className={`group flex items-center px-3 py-2 border-b border-border/30 last:border-0 ${isSel ? "bg-primary/5" : "hover:bg-muted/40"}`}>
        {selectMode && (
          <input type="checkbox" checked={isSel} onChange={() => setSelectedBmIds((prev) => { const n = new Set(prev); n.has(bm.id) ? n.delete(bm.id) : n.add(bm.id); return n })}
            className="mr-2 shrink-0 accent-primary" />
        )}
        <div
          {...(!selectMode ? { draggable: true, onDragStart: handleDragStart, onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move" }, onDrop: handleRowDrop, onDragEnd: handleDragEnd } : {})}
          className="flex flex-1 cursor-pointer items-center min-w-0"
          onClick={handleClick}
        >
          <span className="truncate text-sm font-medium">{bm.title || bm.url}</span>
        </div>
        {!selectMode && (<>
          <button onClick={(e) => { e.stopPropagation(); openEditBookmark(bm) }} className="shrink-0 p-2 text-muted-foreground/40 bm-actions sm:opacity-0 sm:group-hover:opacity-100 hover:text-foreground">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button onClick={(e) => handleDeleteBookmark(bm.id, e)} className="shrink-0 p-2 text-muted-foreground/40 bm-actions sm:opacity-0 sm:group-hover:opacity-100 hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>)}
      </div>
    )
  }

  function renderSubFoldersInCard(parentId: string, depth = 0) {
    const children = childFoldersMap.get(parentId) || []
    return children.map((f) => {
      const bms = filteredBookmarksByFolder.get(f.id) || []
      const isCollapsed = collapsedSubFolders.has(f.id)
      return (
        <div key={f.id} style={{ marginLeft: `${depth * 16}px` }}>
          <div {...dragProps(f.id)} className={`group flex items-center gap-1 px-3 py-1.5 ${isOver(f.id) ? "bg-primary/10" : ""}`}>
            <button onClick={() => toggleCollapse(f.id)} className="p-0.5 text-muted-foreground/60 hover:text-foreground">
              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <FolderTypeIcon f={f} />
            <span className="text-sm text-muted-foreground">{f.name}</span>
            <span className="text-xs text-muted-foreground/40">{bms.length}</span>
            <button onClick={(e) => { e.stopPropagation(); openEditFolder(f) }} className="p-2 text-muted-foreground/30 opacity-100 hover:text-foreground" title="编辑">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button onClick={(e) => handleDeleteFolder(f.id, e)} className="ml-auto p-2 text-muted-foreground/30 opacity-100 hover:text-destructive">
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
            <p className="mt-4 text-sm text-muted-foreground">{searchQuery ? "没有找到匹配的书签" : "还没有书签"}</p>
          </div>
        </div>
      )
    }

    const allCards: ({ type: "root"; data: Bookmark[] } | { type: "folder"; data: Folder })[] = [
      ...rootFolders.map((f) => ({ type: "folder" as const, data: f })),
      ...(rootBookmarks.length > 0 ? [{ type: "root" as const, data: rootBookmarks }] : []),
    ]

    function getCardWeight(card: typeof allCards[0]): number {
      if (card.type === "root") return Math.max(card.data.length, 1)
      const bms = bookmarksByFolder.get(card.data.id) || []
      const subs = childFoldersMap.get(card.data.id) || []
      return Math.max(bms.length + subs.length, 1)
    }

    function renderCard(card: typeof allCards[0]) {
      const isFolder = card.type === "folder"
      const cardId = isFolder ? card.data.id : "__root__"
      return (
        <div key={isFolder ? card.data.id : "root"}
          {...dragProps(cardId)}
          className={`w-full bg-card transition-shadow ${isOver(cardId) ? "ring-2 ring-primary" : ""} ${isFolder ? "cursor-grab active:cursor-grabbing" : ""}`}
          style={{ border: "1px solid var(--border)" }}>
          {card.type === "root" ? (
            <>
              <div className="flex items-center gap-2 px-4 pt-3 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <Bookmark className="h-4 w-4 text-muted-foreground/50" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">未分类</span>
                <span className="ml-auto text-xs text-muted-foreground/40">{card.data.length}</span>
              </div>
              <div className="pb-1">{card.data.map(renderBookmarkRow)}</div>
            </>
          ) : (
            <>
              <div className="group flex items-center gap-2 px-4 pt-3 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <FolderTypeIcon f={card.data} />
                <span className="text-sm font-semibold">{card.data.name}</span>
                <button onClick={(e) => { e.stopPropagation(); openEditFolder(card.data) }} className="p-2 text-muted-foreground/30 opacity-100 hover:text-foreground" title="编辑">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
                <button onClick={(e) => handleDeleteFolder(card.data.id, e)} className="p-2 text-muted-foreground/30 opacity-100 hover:text-destructive" title="删除">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="pb-1">
                {(() => {
                  const bms = filteredBookmarksByFolder.get(card.data.id) || []
                  const subs = childFoldersMap.get(card.data.id) || []
                  const hasSub = subs.some((sf) => {
                    const sfb = filteredBookmarksByFolder.get(sf.id) || []
                    return sfb.length > 0 || (childFoldersMap.get(sf.id) || []).length > 0
                  })
                  if (bms.length === 0 && !hasSub) return <p className="px-4 py-6 text-xs text-muted-foreground/40">空文件夹</p>
                  return <>{bms.map(renderBookmarkRow)}{renderSubFoldersInCard(card.data.id)}</>
                })()}
              </div>
            </>
          )}
        </div>
      )
    }

    return (
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        {/* Web Search */}
        <div className="mb-4 flex items-center gap-2 py-2 px-3 bg-muted/30 rounded-lg mx-auto" style={{ border: "1px solid var(--border)", maxWidth: "520px" }}>
          <Globe className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          <input type="text" value={webQuery} onChange={(e) => setWebQuery(e.target.value)} onKeyDown={handleWebSearch}
            placeholder="搜索网页..." className="flex-1 bg-transparent px-2 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/70" />
          <Select value={webEngine} onValueChange={(v) => setWebEngine(v || "bing")}>
            <SelectTrigger size="sm" className="bg-muted/50 border-0 text-xs text-foreground h-7 min-w-[52px] gap-0.5 shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="google">Google</SelectItem><SelectItem value="bing">Bing</SelectItem>
              <SelectItem value="duckduckgo">DuckDuckGo</SelectItem><SelectItem value="baidu">百度</SelectItem>
              {customEngines.map((e) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
            </SelectContent>
          </Select>
          <button onClick={() => setShowAddEngine(true)} className="text-muted-foreground/40 hover:text-foreground p-1 shrink-0" title="添加搜索引擎">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
        {selectMode && (
          <div className="mb-4 flex items-center gap-3 px-4 py-2.5 bg-muted/50" style={{ border: "1px solid var(--border)" }}>
            <button onClick={() => { setSelectedBmIds(new Set()); setSelectMode(false) }} className="text-xs text-muted-foreground hover:text-foreground">取消</button>
            <span className="text-xs text-muted-foreground">已选 {selectedBmIds.size} 项</span>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setDeleteConfirm({ type: "selected" })} disabled={selectedBmIds.size === 0} className="px-3 py-1.5 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">删除选中</button>
              <button onClick={() => setShowMoveDialog(true)} disabled={selectedBmIds.size === 0} className="px-3 py-1.5 text-xs font-medium border hover:bg-muted disabled:opacity-50">移动到...</button>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-4 px-3 py-4 sm:hidden">{allCards.map(renderCard)}</div>
        <div className="hidden sm:grid lg:hidden grid-cols-2 gap-4 px-4 py-6">
          {distributeIntoColumns(allCards, 2, getCardWeight).map((col, ci) => (
            <div key={ci} className="flex flex-col gap-4">{col.map(renderCard)}</div>
          ))}
        </div>
        <div className="hidden lg:grid grid-cols-3 gap-4 px-8 py-6">
          {distributeIntoColumns(allCards, 3, getCardWeight).map((col, ci) => (
            <div key={ci} className="flex flex-col gap-4">{col.map(renderCard)}</div>
          ))}
        </div>
      </div>
    )
  }

  function renderTreeSidebar() {
    const renderTree = (list: Folder[], depth = 0) => list.map((f) => {
      const children = childFoldersMap.get(f.id) || []
      const isExpanded = expandedFolders.has(f.id)
      const isSelected = selectedFolderId === f.id
      return (
        <div key={f.id}>
          <div {...dragProps(f.id)} className={`group flex items-center ${isOver(f.id) ? "bg-primary/10" : ""}`}>
            <div className="flex w-full items-center">
              <button onClick={() => { setSelectedFolderId(f.id); if (children.length > 0) toggleExpand(f.id); setShowMobileSidebar(false) }}
                className={`flex w-full items-center gap-1 px-2 py-2 text-sm hover:bg-muted ${isSelected ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}`}
                style={{ paddingLeft: `${8 + depth * 14}px` }}>
                {children.length > 0 ? (isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />) : <span className="w-3" />}
                <FolderTypeIcon f={f} />
                <span className="truncate">{f.name}</span>
              </button>
              <button onClick={(e) => { e.stopPropagation(); openEditFolder(f) }} className="p-2 text-muted-foreground/30 opacity-100 hover:text-foreground" title="编辑">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
              <button onClick={(e) => handleDeleteFolder(f.id, e)} className="shrink-0 p-2 text-muted-foreground/30 opacity-100 hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {isExpanded && children.length > 0 && <div>{renderTree(children, depth + 1)}</div>}
        </div>
      )
    })

    return (
      <>
        <aside className="hidden w-56 shrink-0 bg-sidebar-bg lg:flex lg:flex-col" style={{ borderRight: "1px solid var(--border)" }}>
          <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">文件夹</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div {...dragProps("__root__")} className={isOver("__root__") ? "bg-primary/10" : ""}>
              <button onClick={() => setSelectedFolderId(null)} className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted ${selectedFolderId === null ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}`}>
                <Bookmark className="h-4 w-4" /> 全部书签
              </button>
            </div>
            <div className="mt-1">{renderTree(rootFolders)}</div>
          </div>
        </aside>
        {showMobileSidebar && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setShowMobileSidebar(false)} />
            <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar-bg lg:hidden flex flex-col shadow-xl" style={{ borderRight: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between px-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">文件夹</h2>
                <button onClick={() => setShowMobileSidebar(false)} className="p-2 text-muted-foreground/60 hover:text-foreground"><X className="h-5 w-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <div {...dragProps("__root__")} className={isOver("__root__") ? "bg-primary/10" : ""}>
                  <button onClick={() => { setSelectedFolderId(null); setShowMobileSidebar(false) }} className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted ${selectedFolderId === null ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}`}>
                    <Bookmark className="h-4 w-4" /> 全部书签
                  </button>
                </div>
                <div className="mt-1">{renderTree(rootFolders)}</div>
              </div>
            </aside>
          </>
        )}
      </>
    )
  }

  function renderTreeView() {
    const display = selectedFolderId
      ? bookmarks.filter((b) => b.folderId === selectedFolderId && (!searchQuery || searchMatch(b)))
      : filteredBookmarks

    return (
      <div className="flex flex-1 overflow-hidden">
        {renderTreeSidebar()}
        <div className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          {display.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Bookmark className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-sm text-muted-foreground">{searchQuery ? "没有匹配" : "空的"}</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-7xl">
              <div className="mb-3 lg:hidden">
                <button onClick={() => setShowMobileSidebar(true)} className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
                  <FolderIcon className="h-3.5 w-3.5" />
                  {selectedFolderId ? folders.find((f) => f.id === selectedFolderId)?.name || "文件夹" : "全部书签"}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {display.map((bm) => (
                  <div key={bm.id} draggable
                    onDragStart={() => { draggedBmRef.current = bm.id }}
                    onDragEnd={() => { draggedBmRef.current = null; setDragOverFolderId(null) }}
                    onClick={() => {
                      if (selectMode) return
                      fetch("/api/bookmarks/touch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: bm.id }) })
                        .then((r) => r.json()).then((d) => { if (d.success) setBookmarks((prev) => { const arr = [...prev]; const idx = arr.findIndex((x) => x.id === bm.id); if (idx >= 0) { const [item] = arr.splice(idx, 1); arr.unshift(item) } return arr }) }).catch(() => {})
                      window.open(bm.url, "_blank", "noopener,noreferrer")
                    }}
                    className="group relative cursor-pointer bg-card p-4 hover:bg-muted/30 cursor-grab active:cursor-grabbing"
                    style={{ border: "1px solid var(--border)" }}>
                    <div className="flex items-start gap-3">
                      {bm.favicon ? <img src={bm.favicon} alt="" className="mt-0.5 h-5 w-5" /> : <Bookmark className="mt-0.5 h-5 w-5 shrink-0 text-primary/60" />}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-medium">{bm.title || bm.url}</h3>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{bm.url}</p>
                      </div>
                    </div>
                    <div className="absolute right-2 top-2 flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); openEditBookmark(bm) }} className="p-2 text-muted-foreground/30 bm-actions sm:opacity-0 sm:group-hover:opacity-100 hover:text-foreground">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteBookmark(bm.id, e) }} className="p-2 text-muted-foreground/30 bm-actions sm:opacity-0 sm:group-hover:opacity-100 hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
        <div className="relative flex-1 min-w-0 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索书签..."
            className="w-full bg-muted/50 px-2 py-1.5 pl-8 sm:px-3 sm:pl-9 text-sm outline-none focus:bg-muted transition-colors placeholder:text-muted-foreground/70" />
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <button onClick={() => setViewMode(viewMode === "card" ? "tree" : "card")} className="p-2 text-muted-foreground/60 hover:text-foreground" title={viewMode === "card" ? "文件夹" : "卡片"}>
            {viewMode === "card" ? <PanelLeftClose className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          </button>
          <button onClick={() => { setSelectMode(!selectMode); if (selectMode) setSelectedBmIds(new Set()) }}
            className={`p-2 transition-colors ${selectMode ? "text-primary" : "text-muted-foreground/60 hover:text-foreground"}`} title="多选模式">
            <CheckSquare className="h-4 w-4" />
          </button>
          <div className="mx-1 h-4 w-px bg-border/50" />
          <button onClick={() => setShowCreateBookmark(true)} className="flex items-center gap-1 bg-primary px-2 py-1.5 sm:px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">书签</span>
          </button>
          <button onClick={() => setShowCreateFolder(true)} className="flex items-center gap-1 px-2 py-1.5 sm:px-3 text-xs font-medium text-muted-foreground hover:bg-muted">
            <FolderPlus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">文件夹</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".html,.htm,.plist" onChange={handleImport} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="hidden sm:inline-flex px-2.5 py-1.5 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted disabled:opacity-50 items-center justify-center">
            <Upload className="h-3.5 w-3.5" />
          </button>
          <div className="relative group hidden sm:block">
            <button className="px-2.5 py-1.5 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted"><Download className="h-3.5 w-3.5" /></button>
            <div className="absolute right-0 top-full z-50 mt-1 hidden w-28 bg-card py-1 shadow group-hover:block" style={{ border: "1px solid var(--border)" }}>
              <a href="/api/bookmarks/export?format=html" className="block px-3 py-1.5 text-xs hover:bg-muted">导出 HTML</a>
              <a href="/api/bookmarks/export?format=json" className="block px-3 py-1.5 text-xs hover:bg-muted">导出 JSON</a>
            </div>
          </div>
          <Tooltip><TooltipTrigger onClick={handleDetectDuplicates} disabled={dedupLoading} className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors">{dedupLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scan className="h-3.5 w-3.5" />}<span className="hidden sm:inline">去重</span></TooltipTrigger><TooltipContent>检测并清理重复书签</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger onClick={handleShowStats} className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"><BarChart3 className="h-3.5 w-3.5" /><span className="hidden sm:inline">统计</span></TooltipTrigger><TooltipContent>查看书签统计信息</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger onClick={handleCheckDeadLinks} disabled={deadLinksLoading} className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors">{deadLinksLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2Off className="h-3.5 w-3.5" />}<span className="hidden sm:inline">死链</span></TooltipTrigger><TooltipContent>检测失效的书签链接</TooltipContent></Tooltip>
          <div className="mx-1 h-4 w-px bg-border/50 hidden sm:block" />

          {/* Mobile menu */}
          <div className="relative sm:hidden">
            <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="p-2 text-muted-foreground/60 hover:text-foreground"><Menu className="h-4 w-4" /></button>
            {showMobileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => { setShowMobileMenu(false); setShowMobileExport(false) }} />
                <div className="absolute right-0 top-full z-50 mt-1 w-44 bg-card py-1 shadow-lg" style={{ border: "1px solid var(--border)" }}>
                  <button onClick={() => { setShowMobileMenu(false); handleShowStats() }} className="flex w-full items-center gap-2 px-4 py-3 text-sm hover:bg-muted"><BarChart3 className="h-4 w-4" />统计</button>
                  <button onClick={() => { setShowMobileMenu(false); handleDetectDuplicates() }} disabled={dedupLoading} className="flex w-full items-center gap-2 px-4 py-3 text-sm hover:bg-muted disabled:opacity-50">{dedupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scan className="h-4 w-4" />}去重</button>
                  <button onClick={() => { setShowMobileMenu(false); handleCheckDeadLinks() }} disabled={deadLinksLoading} className="flex w-full items-center gap-2 px-4 py-3 text-sm hover:bg-muted disabled:opacity-50">{deadLinksLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}死链</button>
                  <div className="mx-2 my-1 h-px bg-border/50" />
                  <button onClick={() => { setShowMobileMenu(false); fileInputRef.current?.click() }} disabled={importing} className="flex w-full items-center gap-2 px-4 py-3 text-sm hover:bg-muted disabled:opacity-50"><Upload className="h-4 w-4" />导入</button>
                  <div>
                    <button onClick={() => setShowMobileExport(!showMobileExport)} className="flex w-full items-center gap-2 px-4 py-3 text-sm hover:bg-muted"><Download className="h-4 w-4" />导出</button>
                    {showMobileExport && (
                      <div className="bg-muted/30">
                        <a href="/api/bookmarks/export?format=html" className="flex items-center gap-2 pl-10 pr-4 py-2.5 text-sm hover:bg-muted">导出 HTML</a>
                        <a href="/api/bookmarks/export?format=json" className="flex items-center gap-2 pl-10 pr-4 py-2.5 text-sm hover:bg-muted">导出 JSON</a>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Theme picker */}
          <div className="relative">
            <button onClick={() => setShowThemePicker(!showThemePicker)} className="p-2 text-muted-foreground/60 hover:text-foreground" title="主题">
              <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: theme.colors.primary, borderColor: theme.dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)" }} />
            </button>
            {showThemePicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowThemePicker(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-44 bg-card py-1 shadow-lg" style={{ border: "1px solid var(--border)" }}>
                  {themes.map((t) => (
                    <button key={t.id} onClick={() => { setThemeId(t.id); setShowThemePicker(false) }}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-muted ${theme.id === t.id ? "bg-muted font-medium" : ""}`}>
                      <div className="h-5 w-5 shrink-0 rounded-full border" style={{ backgroundColor: t.colors.primary, borderColor: t.dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)" }} />
                      <span>{t.name}</span>
                      {theme.id === t.id && <span className="ml-auto text-xs text-primary">&#10003;</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={() => signOut({ callbackUrl: "/" })} className="p-2 text-muted-foreground/60 hover:text-foreground"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      {importResult && (
        <div className="px-6 py-2 text-sm bg-muted/30" style={{ borderBottom: "1px solid var(--border)" }}>
          {importResult}
          <button onClick={() => setImportResult(null)} className="ml-2 font-medium text-muted-foreground hover:text-foreground">关闭</button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">{viewMode === "card" ? renderCardView() : renderTreeView()}</main>

      {/* ── 对话框 ── */}

      {/* 去重 */}
      <Dialog open={showDedup} onOpenChange={(o) => { if (!o) setShowDedup(false) }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>去重管理</DialogTitle>
            <DialogDescription>选择要删除的重复书签</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto">
            {duplicates.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">没有发现重复书签</p>
            ) : (
              <div className="space-y-3">
                {duplicates.map((group, gi) => (
                  <div key={gi} className="rounded-lg border p-4">
                    <p className="mb-2 truncate text-xs font-medium text-muted-foreground" title={group.url}>{group.url}</p>
                    {group.bookmarks.map((bm) => (
                      <label key={bm.id} className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted ${selectedDedupIds.has(bm.id) ? "bg-destructive/5 line-through opacity-60" : ""}`}>
                        <input type="checkbox" checked={selectedDedupIds.has(bm.id)} onChange={(e) => { setSelectedDedupIds((prev) => { const n = new Set(prev); e.target.checked ? n.add(bm.id) : n.delete(bm.id); return n }) }} className="shrink-0 accent-primary" />
                        <span className="flex-1 truncate">{bm.title || bm.url}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          {duplicates.length > 0 && (
            <div className="flex items-center justify-between border-t pt-4">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedDedupIds((prev) => { const n = new Set(prev); duplicates.forEach((g) => { g.bookmarks.slice(1).forEach((bm) => n.add(bm.id)) }); return n }) }}>保留每组第一个</Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedDedupIds(new Set())}>取消选择</Button>
                <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteDedup} disabled={selectedDedupIds.size === 0}>删除选中 ({selectedDedupIds.size})</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 创建书签 */}
      <Dialog open={showCreateBookmark} onOpenChange={(o) => { if (!o) { setShowCreateBookmark(false); setBmFormUrl(""); setBmFormTitle(""); setBmFormFolderId(null) } }} modal={false}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加书签</DialogTitle><DialogDescription>输入书签的 URL 和标题</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="url">URL</Label><Input id="url" value={bmFormUrl} onChange={(e) => setBmFormUrl(e.target.value)} placeholder="https://example.com" /></div>
            <div className="grid gap-2"><Label htmlFor="title">标题（可选）</Label><Input id="title" value={bmFormTitle} onChange={(e) => setBmFormTitle(e.target.value)} placeholder="书签标题" /></div>
            <div className="grid gap-2">
              <Label htmlFor="folderSelect">文件夹</Label>
              <Select value={bmFormFolderId ?? ""} onValueChange={(v) => setBmFormFolderId(v || null)}>
                <SelectTrigger className="w-full bg-muted/50 text-foreground">{bmFormFolderId ? <span>{folders.find((f) => f.id === bmFormFolderId)?.name || bmFormFolderId}</span> : <span className="text-muted-foreground">未分类</span>}</SelectTrigger>
                <SelectContent><SelectItem value="">未分类</SelectItem>{rootFolders.map((f) => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateBookmark(false); setBmFormUrl(""); setBmFormTitle(""); setBmFormFolderId(null) }}>取消</Button>
            <Button onClick={handleCreateBookmark} disabled={!bmFormUrl.trim()}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建文件夹 */}
      <Dialog open={showCreateFolder} onOpenChange={(o) => { if (!o) { setShowCreateFolder(false); setFolderFormName(""); setFolderFormIsFavorite(false) } }} modal={false}>
        <DialogContent>
          <DialogHeader><DialogTitle>新建文件夹</DialogTitle><DialogDescription>输入文件夹名称</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="folderName">名称</Label><Input id="folderName" value={folderFormName} onChange={(e) => setFolderFormName(e.target.value)} placeholder="文件夹名称" onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder() }} /></div>
            <div className="grid gap-2">
              <Label>文件夹类型</Label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setFolderFormIsFavorite(false)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-md border text-sm transition-colors ${!folderFormIsFavorite ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:bg-muted text-muted-foreground"}`}>
                  <FolderIcon className="h-4 w-4" /> 普通文件夹
                </button>
                <button type="button" onClick={() => setFolderFormIsFavorite(true)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-md border text-sm transition-colors ${folderFormIsFavorite ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:bg-muted text-muted-foreground"}`}>
                  <Star className="h-4 w-4" /> 收藏文件夹
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateFolder(false); setFolderFormName(""); setFolderFormIsFavorite(false) }}>取消</Button>
            <Button onClick={handleCreateFolder} disabled={!folderFormName.trim()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑书签 */}
      <Dialog open={showEditBookmark} onOpenChange={(o) => { if (!o) { setShowEditBookmark(false); setEditingBookmark(null); setBmFormUrl(""); setBmFormTitle("") } }} modal={false}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑书签</DialogTitle><DialogDescription>修改书签的 URL 和标题</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="editUrl">URL</Label><Input id="editUrl" value={bmFormUrl} onChange={(e) => setBmFormUrl(e.target.value)} /></div>
            <div className="grid gap-2"><Label htmlFor="editTitle">标题</Label><Input id="editTitle" value={bmFormTitle} onChange={(e) => setBmFormTitle(e.target.value)} /></div>
            <div className="grid gap-2">
              <Label htmlFor="editFolderSelect">文件夹</Label>
              <Select value={bmFormFolderId ?? ""} onValueChange={(v) => setBmFormFolderId(v || null)}>
                <SelectTrigger className="w-full bg-muted/50 text-foreground">{bmFormFolderId ? <span>{folders.find((f) => f.id === bmFormFolderId)?.name || bmFormFolderId}</span> : <span className="text-muted-foreground">未分类</span>}</SelectTrigger>
                <SelectContent><SelectItem value="">未分类</SelectItem>{rootFolders.map((f) => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditBookmark(false); setEditingBookmark(null); setBmFormUrl(""); setBmFormTitle(""); setBmFormFolderId(null) }}>取消</Button>
            <Button onClick={confirmEditBookmark} disabled={!bmFormUrl.trim()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑文件夹 */}
      <Dialog open={showEditFolder} onOpenChange={(o) => { if (!o) { setShowEditFolder(false); setEditingFolder(null); setFolderFormName(""); setFolderPriority(0) } }} modal={false}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑文件夹</DialogTitle><DialogDescription>修改文件夹名称</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="editFolderName">名称</Label><Input id="editFolderName" value={folderFormName} onChange={(e) => setFolderFormName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmEditFolder() }} /></div>
            <div className="grid gap-2"><Label htmlFor="folderPriority">优先级</Label><Input id="folderPriority" type="number" value={folderPriority} onChange={(e) => setFolderPriority(parseInt(e.target.value) || 0)} /><p className="text-xs text-muted-foreground">数字越大，排序越靠前</p></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditFolder(false); setEditingFolder(null); setFolderFormName(""); setFolderPriority(0) }}>取消</Button>
            <Button onClick={confirmEditFolder} disabled={!folderFormName.trim()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 添加搜索引擎 */}
      <Dialog open={showAddEngine} onOpenChange={(o) => { if (!o) { setShowAddEngine(false); setNewEngineName(""); setNewEngineUrl("") } }} modal={false}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加搜索引擎</DialogTitle><DialogDescription>输入搜索引擎名称和搜索URL</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="engineName">名称</Label><Input id="engineName" value={newEngineName} onChange={(e) => setNewEngineName(e.target.value)} placeholder="例如: 知乎" /></div>
            <div className="grid gap-2"><Label htmlFor="engineUrl">搜索 URL</Label><Input id="engineUrl" value={newEngineUrl} onChange={(e) => setNewEngineUrl(e.target.value)} placeholder="例如: https://www.zhihu.com/search?q=" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddEngine(false); setNewEngineName(""); setNewEngineUrl("") }}>取消</Button>
            <Button onClick={() => { if (newEngineName.trim() && newEngineUrl.trim()) { const id = "custom_" + Date.now(); setCustomEngines((prev) => [...prev, { id, name: newEngineName.trim(), url: newEngineUrl.trim() }]); setShowAddEngine(false); setNewEngineName(""); setNewEngineUrl("") } }} disabled={!newEngineName.trim() || !newEngineUrl.trim()}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 移动到文件夹 */}
      <Dialog open={showMoveDialog} onOpenChange={(o) => { if (!o) setShowMoveDialog(false) }}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm">
          <DialogHeader><DialogTitle>移动到文件夹</DialogTitle><DialogDescription>选择目标文件夹</DialogDescription></DialogHeader>
          <div className="max-h-60 overflow-y-auto -mx-4 px-4">
            <button onClick={() => { moveMultipleBookmarks(Array.from(selectedBmIds), null); setShowMoveDialog(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors">未分类</button>
            {rootFolders.map((f) => (
              <button key={f.id} onClick={() => { moveMultipleBookmarks(Array.from(selectedBmIds), f.id); setShowMoveDialog(false) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors flex items-center gap-2">
                <FolderTypeIcon f={f} />
                <span>{f.name}</span>
              </button>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowMoveDialog(false)}>取消</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === "bookmark" && "确定要删除这个书签吗？此操作不可撤销。"}
              {deleteConfirm?.type === "folder" && "确定要删除这个文件夹及其所有子文件夹和书签吗？此操作不可撤销。"}
              {deleteConfirm?.type === "selected" && `确定要删除选中的 ${selectedBmIds.size} 个书签吗？此操作不可撤销。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (deleteConfirm?.type === "bookmark") confirmDeleteBookmark()
              else if (deleteConfirm?.type === "folder") confirmDeleteFolder()
              else if (deleteConfirm?.type === "selected") confirmDeleteSelected()
            }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 统计 */}
      <Dialog open={showStats} onOpenChange={(o) => { if (!o) { setShowStats(false); setStatsData(null) } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader><DialogTitle>书签统计</DialogTitle><DialogDescription>查看你的书签使用情况</DialogDescription></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {statsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : statsData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border p-3 text-center"><div className="text-2xl font-bold text-primary">{statsData.totalBookmarks}</div><div className="text-xs text-muted-foreground">总书签数</div></div>
                  <div className="rounded-lg border p-3 text-center"><div className="text-2xl font-bold text-primary">{statsData.totalFolders}</div><div className="text-xs text-muted-foreground">文件夹数</div></div>
                  <div className="rounded-lg border p-3 text-center"><div className="text-2xl font-bold text-primary">{statsData.uncategorizedBookmarks}</div><div className="text-xs text-muted-foreground">未分类</div></div>
                  <div className="rounded-lg border p-3 text-center"><div className="text-2xl font-bold text-primary">{statsData.recentBookmarks}</div><div className="text-xs text-muted-foreground">近7天新增</div></div>
                </div>
                {statsData.folderStats && statsData.folderStats.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">文件夹分布</h3>
                    <div className="space-y-1.5">
                      {statsData.folderStats.map((f) => (
                        <div key={f.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                          <FolderTypeIcon f={f} />
                          <span className="flex-1 text-sm truncate">{f.name}</span>
                          <span className="text-xs text-muted-foreground">{f.count} 个书签</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {statsData.latestBookmarks && statsData.latestBookmarks.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">最近添加</h3>
                    <div className="space-y-1">
                      {statsData.latestBookmarks.map((bm) => (
                        <a key={bm.id} href={bm.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors">
                          {bm.favicon ? <img src={bm.favicon} alt="" className="h-4 w-4 shrink-0" /> : <Bookmark className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
                          <span className="flex-1 truncate">{bm.title || bm.url}</span>
                          <span className="text-xs text-muted-foreground">{new Date(bm.createdAt).toLocaleDateString("zh-CN")}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {statsData.mostVisitedBookmarks && statsData.mostVisitedBookmarks.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">最近访问</h3>
                    <div className="space-y-1">
                      {statsData.mostVisitedBookmarks.map((bm) => (
                        <a key={bm.id} href={bm.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors">
                          {bm.favicon ? <img src={bm.favicon} alt="" className="h-4 w-4 shrink-0" /> : <Bookmark className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
                          <span className="flex-1 truncate">{bm.title || bm.url}</span>
                          <span className="text-xs text-muted-foreground">{new Date(bm.lastUsedAt).toLocaleDateString("zh-CN")}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">加载失败</p>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { setShowStats(false); setStatsData(null) }}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 死链检测 */}
      <Dialog open={showDeadLinks} onOpenChange={(o) => { if (!o) { setShowDeadLinks(false); setDeadLinks([]) } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader><DialogTitle>死链检测</DialogTitle><DialogDescription>检测无法访问的书签链接</DialogDescription></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {deadLinksLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">正在检测链接，请稍候...</p></div>
            ) : deadLinks.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">所有链接都正常</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">发现 {deadLinks.length} 个失效链接</p>
                {deadLinks.map((link) => (
                  <div key={link.id} className="flex items-center gap-2 rounded-md border p-3">
                    <Link2Off className="h-4 w-4 shrink-0 text-destructive" />
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 hover:text-primary transition-colors">
                      <p className="text-sm font-medium truncate">{link.title || link.url}</p>
                      <p className="text-xs text-muted-foreground truncate hover:text-primary">{link.url}</p>
                    </a>
                    <span className="shrink-0 text-xs text-destructive">{DEAD_LINK_LABELS[String(link.status)] || String(link.status)}</span>
                    <Button variant="ghost" size="sm" onClick={async () => {
                      try {
                        await fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: link.id }) })
                        setDeadLinks((prev) => prev.filter((l) => l.id !== link.id))
                        setBookmarks((prev) => prev.filter((b) => b.id !== link.id))
                      } catch { /* ignore */ }
                    }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { setShowDeadLinks(false); setDeadLinks([]) }}>关闭</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}