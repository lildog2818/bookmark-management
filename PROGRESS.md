# 书签管理 Web 应用 — 项目总结

## 基本信息
| 项目 | 内容 |
|------|------|
| 网址 | https://bookmark-management.vercel.app |
| GitHub | https://github.com/lildog2818/bookmark-management |
| 技术栈 | Next.js 16 + Tailwind CSS v4 + TypeScript |
| 数据库 | Neon PostgreSQL（新加坡节点，免费 5GB）|
| ORM | Prisma |
| 认证 | NextAuth v5（邮箱密码 + bcryptjs）|
| 部署 | Vercel（免费套餐）|

## 已完成功能
- [x] 项目初始化（Next.js + Tailwind + TypeScript）
- [x] 数据库配置（Prisma + Neon PostgreSQL）
- [x] 用户注册 / 登录（邮箱密码）
- [x] 文件夹管理（无限层级嵌套）
- [x] 书签增删改（标题、URL、描述）
- [x] 左侧文件夹树 + 右侧书签卡片布局
- [x] 标题 + URL 全文搜索
- [x] 浏览器书签 HTML 导入（Chrome / Firefox / Edge）
- [x] 暗色模式
- [x] Vercel 部署上线
- [x] 导出书签（HTML / JSON 格式）
- [x] 拖拽移动书签到文件夹
- [x] 去重管理
- [x] 手动明暗主题切换 + 登录/注册页美化
- [x] 卡片式布局（瀑布流交错排列）
- [x] 文件夹卡片折叠/展开
- [x] 书签多选模式（批量删除 + 批量移动到文件夹）
- [x] 书签拖拽排序（同一文件夹内）
- [x] 文件夹编辑（名称 + 优先级排序）
- [x] 文件夹拖拽排序

## Vercel 环境变量配置
| 变量名 | 说明 |
|--------|------|
| `DATABASE_URL` | Neon PostgreSQL 连接字符串 |
| `NEXTAUTH_SECRET` | 任意随机字符串（用于 JWT 加密） |
| `NEXTAUTH_URL` | `https://bookmark-management.vercel.app` |

## 项目目录结构
```
bookmark_management/
├── prisma/
│   └── schema.prisma          # 数据库模型
├── src/
│   ├── app/
│   │   ├── page.tsx           # 首页（Landing）
│   │   ├── layout.tsx         # 根布局
│   │   ├── globals.css        # 全局样式 + 主题变量
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── dashboard/
│   │   │   ├── page.tsx       # 服务端组件（数据获取）
│   │   │   └── dashboard-client.tsx  # 客户端交互组件（~350行）
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── auth/register/route.ts
│   │       ├── bookmarks/route.ts
│   │       ├── bookmarks/export/route.ts
│   │       ├── bookmarks/import/route.ts
│   │       ├── bookmarks/detect-duplicates/route.ts
│   │       ├── bookmarks/reorder/route.ts
│   │       ├── folders/route.ts
│   │       └── folders/reorder/route.ts
│   ├── lib/
│   │   ├── auth.ts            # NextAuth 配置
│   │   ├── prisma.ts          # Prisma 客户端实例
│   │   ├── theme.tsx          # 主题切换 Context
│   │   └── utils.ts           # cn() 工具函数
│   └── types/
│       ├── index.ts
│       └── next-auth.d.ts
├── .env
├── package.json
└── next.config.ts
```
