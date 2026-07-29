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

    // 总书签数
    const totalBookmarks = await prisma.bookmark.count({
      where: { userId }
    })

    // 总文件夹数
    const totalFolders = await prisma.folder.count({
      where: { userId }
    })

    // 未分类书签数
    const uncategorizedBookmarks = await prisma.bookmark.count({
      where: {
        userId,
        folderId: null
      }
    })

    // 最近7天添加的书签
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentBookmarks = await prisma.bookmark.count({
      where: {
        userId,
        createdAt: {
          gte: sevenDaysAgo
        }
      }
    })

    // 最近添加的书签（最多10个）
    const latestBookmarks = await prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        url: true,
        favicon: true,
        createdAt: true
      }
    })

    // 最常访问的书签（按 lastUsedAt 排序，最多10个）
    const mostVisitedBookmarks = await prisma.bookmark.findMany({
      where: {
        userId,
        lastUsedAt: { not: null }
      },
      orderBy: { lastUsedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        url: true,
        favicon: true,
        lastUsedAt: true
      }
    })

    // 每个文件夹的书签数量
    const folderStats = await prisma.folder.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        color: true,
        _count: {
          select: { bookmarks: true }
        }
      }
    })

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
