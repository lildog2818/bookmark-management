export interface FolderType {
  id: string
  name: string
  color: string | null
  icon: string | null
  userId: string
  parentId: string | null
  children?: FolderType[]
  bookmarks?: BookmarkType[]
  createdAt: string
  updatedAt: string
}

export interface BookmarkType {
  id: string
  title: string
  url: string
  description: string | null
  favicon: string | null
  order: number
  userId: string
  folderId: string | null
  createdAt: string
  updatedAt: string
}

export interface UserType {
  id: string
  email: string
  name: string | null
}