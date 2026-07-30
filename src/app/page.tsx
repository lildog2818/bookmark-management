import Link from "next/link"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* 导航栏 */}
      <header className="fixed top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-primary">Bookmark</span> Manager
          </h1>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
            >
              注册
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero 区域 */}
        <section className="relative flex min-h-[60vh] sm:min-h-[80vh] flex-col items-center justify-center overflow-hidden px-6 pt-16">
          {/* 背景装饰 */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute right-1/4 top-1/4 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="absolute bottom-1/4 left-1/4 h-56 w-56 rounded-full bg-purple-500/10 blur-3xl" />
          </div>

          <div className="animate-slide-up max-w-3xl text-center">
            <h2 className="bg-gradient-to-r from-primary via-blue-500 to-purple-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-5xl">
              优雅地管理您的书签
            </h2>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed text-muted-foreground">
              导入浏览器书签、分类整理、快速搜索，随时随地访问您的收藏。
              支持 Chrome / Firefox / Edge 书签导入。
            </p>
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link
                href="/register"
                className="rounded-lg bg-primary px-8 py-3 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl hover:-translate-y-0.5"
              >
                开始使用
              </Link>
              <Link
                href="/login"
                className="rounded-lg border bg-card px-8 py-3 text-base font-medium shadow-sm transition-all hover:bg-muted hover:-translate-y-0.5"
              >
                登录
              </Link>
            </div>
          </div>
        </section>

        {/* 特性区域 */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 pb-16 sm:pb-24">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
            {[{
              icon: "📂",
              title: "分类整理",
              desc: "无限层级文件夹，拖拽排序，一目了然",
            },
            {
              icon: "🔍",
              title: "快速搜索",
              desc: "标题 + URL 全文搜索，秒级找到任何书签",
            },
            {
              icon: "📤",
              title: "导入导出",
              desc: "支持 Chrome / Firefox / Edge / Safari 书签格式",
            },
            {
              icon: "🎨",
              title: "多款主题",
              desc: "8 种主题预设，自由切换，日夜舒适",
            },
            {
              icon: "🔗",
              title: "去重管理",
              desc: "自动检测重复书签，批量清理",
            },
            {
              icon: "💀",
              title: "死链检测",
              desc: "检测失效链接，标注错误类型，及时清理",
            },
            {
              icon: "⭐",
              title: "收藏文件夹",
              desc: "专属收藏夹，书签复制不移动，排除查重",
            },
            {
              icon: "📊",
              title: "书签统计",
              desc: "查看使用数据，掌握书签分布情况",
            },
            {
              icon: "🌐",
              title: "网页搜索",
              desc: "内置多搜索引擎，支持自定义引擎",
            },
            ].map((item, i) => (
              <div
                key={i}
                className="animate-slide-up group rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <span className="text-2xl">{item.icon}</span>
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
