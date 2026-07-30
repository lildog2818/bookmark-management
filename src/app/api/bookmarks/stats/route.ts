import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // 并行执行所有独立查询
    const [
      totalBookmarks,
      totalFolders,
      uncategorizedBookmarks,
      recentBookmarks,
      latestBookmarks,
      mostVisitedBookmarks,
      folderStats,
    ] = await Promise.all([
      prisma.bookmark.count({ where: { userId } }),
      prisma.folder.count({ where: { userId } }),
      prisma.bookmark.count({ where: { userId, folderId: null } }),
      prisma.bookmark.count({ where: { userId, createdAt: { gte: sevenDaysAgo } } }),
      prisma.bookmark.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, title: true, url: true, favicon: true, createdAt: true } }),
      prisma.bookmark.findMany({ where: { userId, lastUsedAt: { not: null } }, orderBy: { lastUsedAt: 'desc' }, take: 10, select: { id: true, title: true, url: true, favicon: true, lastUsedAt: true } }),
      prisma.folder.findMany({ where: { userId }, select: { id: true, name: true, color: true, isFavorite: true, _count: { select: { bookmarks: true } } } }),
    ])

    return NextResponse.json({
      totalBookmarks,
      totalFolders,
      uncategorizedBookmarks,
      recentBookmarks,
      latestBookmarks,
      mostVisitedBookmarks,
      folderStats: folderStats.map(f => ({
        id: f.id,
        name: f.name,
        color: f.color,
        isFavorite: f.isFavorite,
        count: f._count.bookmarks
      }))
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
