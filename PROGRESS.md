# 书签管理 Web 应用 — 项目总结

## 基本信息
| 项目 | 内容 |
|------|------|
| 网址 | https://bookmark-management-lovat.vercel.app |
| GitHub | https://github.com/lildog2818/bookmark-management |
| 技术栈 | Next.js 16 + Tailwind CSS v4 + TypeScript |
| 数据库 | Neon PostgreSQL |
| ORM | Prisma |
| 认证 | NextAuth v5（邮箱密码 + bcryptjs）|
| 部署 | Vercel（免费套餐）|

## 已完成功能
### 核心功能
- [x] 项目初始化（Next.js + Tailwind + TypeScript）
- [x] 数据库配置（Prisma + Neon PostgreSQL）
- [x] 用户注册 / 登录（邮箱密码）
- [x] 文件夹管理（无限层级嵌套）
- [x] 书签增删改（标题、URL、描述）
- [x] 左侧文件夹树 + 右侧书签卡片布局（两种视图：卡片瀑布流 / 文件夹树）
- [x] 标题 + URL 全文搜索
- [x] 浏览器书签 HTML 导入（Chrome / Firefox / Edge）
- [x] 暗色模式
- [x] Vercel 部署上线
- [x] 导出书签（HTML / JSON 格式）
- [x] 拖拽移动书签到文件夹
- [x] 去重管理（检测 + 批量删除重复书签）
- [x] 手动明暗主题切换 + 登录/注册页美化
- [x] 瀑布流卡片布局（交错紧凑排列）
- [x] 文件夹卡片折叠/展开
- [x] 书签多选模式（批量删除 + 批量移动到文件夹）
- [x] 书签拖拽排序（同一文件夹内）
- [x] 文件夹编辑（名称 + 优先级排序）
- [x] 文件夹拖拽排序

### 视觉与交互增强
- [x] 引入 shadcn/ui 组件库（@base-ui/react + Tailwind CSS 4）
- [x] 所有原生 prompt()/confirm() 替换为 Dialog/AlertDialog 组件
- [x] 创建/编辑书签和文件夹使用标准 Dialog 表单
- [x] 删除确认使用 AlertDialog
- [x] 书架编辑/删除按钮 hover 时显示
- [x] 文件夹编辑/删除按钮始终可见
- [x] 极简黑白科技粒子流动背景（canvas 动画）
- [x] 粒子右上→左下流动，鼠标交互避开
- [x] 粒子连接线网络效果
- [x] 卡片视图添加网页搜索框（支持多搜索引擎）
- [x] 网页搜索框居中，暗色模式适配
- [x] 自定义搜索引擎添加功能
- [x] 卡片视图瀑布流排列（CSS columns）

### 修复的 Bug
- [x] Dialog JSX 不在 return 内导致无法渲染（含添加搜索引擎对话框重复 9 次）
- [x] 书签按钮不可见（opacity 修复）
- [x] Tree view 中书签缺少编辑按钮
- [x] 添加搜索引擎对话框不在 return 内无法打开
- [x] 文件夹优先级编辑后不立即生效
- [x] signOut 跳转到错误域名
- [x] 粒子背景遮挡卡片（z-index 修复）
- [x] 粒子方向修改（右上→左下）
- [x] 卡片布局从固定网格改为瀑布流紧凑排列
- [x] 暗色模式下搜索引擎下拉菜单文字不可见
- [x] 未使用导入清理（ExternalLink, ChevronUp）

## Vercel 环境变量配置
| 变量名 | 说明 |
|--------|------|
| DATABASE_URL | Neon PostgreSQL 连接字符串 |
| NEXTAUTH_SECRET | 任意随机字符串（用于 JWT 加密）|
| NEXTAUTH_URL | https://bookmark-management-lovat.vercel.app |

## 项目目录结构
```
bookmark_management/
├── prisma/
│   └── schema.prisma          # 数据库模型
├── src/
│   ├── app/
│   │   ├── page.tsx           # 首页（Landing）
│   │   ├── layout.tsx         # 根布局（Tooltip + Particles 集成）
│   │   ├── globals.css        # 全局样式 + 主题变量 + shadcn 集成
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── dashboard/
│   │   │   ├── page.tsx       # 服务端组件（数据获取）
│   │   │   └── dashboard-client.tsx  # 客户端交互组件
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
│   ├── components/
│   │   ├── particles-background.tsx  # 粒子背景动画
│   │   └── ui/                       # shadcn/ui 组件
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── dialog.tsx
│   │       ├── alert-dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── select.tsx
│   │       └── tooltip.tsx
│   ├── lib/
│   │   ├── auth.ts            # NextAuth 配置
│   │   ├── prisma.ts          # Prisma 客户端实例
│   │   ├── theme.tsx          # 主题切换 Context
│   │   └── utils.ts           # cn() 工具函数
│   └── types/
│       ├── index.ts
│       └── next-auth.d.ts
├── components.json            # shadcn/ui 配置
├── AGENTS.md
├── PROGRESS.md
├── .env
├── package.json
└── next.config.ts
```
