import Link from "next/link"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold">📑 书签管理</h1>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-md px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              注册
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-2xl text-center space-y-6">
          <h2 className="text-4xl font-bold tracking-tight">
            优雅地管理您的书签
          </h2>
          <p className="text-lg text-muted-foreground">
            导入浏览器书签、分类整理、快速搜索，随时随地访问您的收藏。
            支持 Chrome / Firefox / Edge 书签导入。
          </p>

          <div className="flex justify-center gap-4">
            <Link
              href="/register"
              className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              免费开始使用
            </Link>
            <Link
              href="/login"
              className="rounded-md border px-6 py-3 text-sm font-medium hover:bg-muted"
            >
              登录
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-12 text-left">
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold mb-2">📂 分类整理</h3>
              <p className="text-sm text-muted-foreground">
                无限层级文件夹，拖拽整理，一目了然
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold mb-2">🔍 快速搜索</h3>
              <p className="text-sm text-muted-foreground">
                标题+URL 全文搜索，秒级找到任何书签
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold mb-2">📤 导入导出</h3>
              <p className="text-sm text-muted-foreground">
                支持主流浏览器书签格式，无缝迁移
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}