import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const folders = await prisma.folder.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  })

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId: session.user.id },
    orderBy: { order: "asc" },
  })

  return (
    <DashboardClient
      folders={JSON.parse(JSON.stringify(folders))}
      bookmarks={JSON.parse(JSON.stringify(bookmarks))}
      userId={session.user.id}
    />
  )
}