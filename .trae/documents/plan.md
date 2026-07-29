# 书签描述与笔记功能实现计划

## 概述
为书签添加"描述"和"笔记"两个文本字段。描述用于简要说明书签内容，笔记用于记录个人批注/收藏原因。

## 当前状态
- `Bookmark` 模型已有 `description String?` 字段，但前端未使用
- API POST 已处理 `description`，但 PATCH 未处理
- 前端 Bookmark interface 未包含 `description`，无 `notes` 字段
- 创建/编辑表单均无描述和笔记输入

## 实现步骤

### 1. 数据库 Schema 变更
**文件**: `prisma/schema.prisma`

在 `Bookmark` 模型中新增 `notes` 字段（`description` 已存在，无需修改）：

```prisma
notes    String?
```

运行 `npx prisma migrate dev --name add-notes-field` 生成迁移。

### 2. API 层适配
**文件**: `src/app/api/bookmarks/route.ts`

- **POST**：已有 `description` 处理，新增 `notes` 字段读取，限制 2000 字符
- **PATCH**：新增 `description`（限 1000 字符）和 `notes`（限 2000 字符）的更新支持

### 3. 前端适配
**文件**: `src/app/dashboard/dashboard-client.tsx`

#### 3.1 类型定义
- `Bookmark` interface 增加 `description: string | null` 和 `notes: string | null`

#### 3.2 表单状态
- 新增 `bmFormDescription` 和 `bmFormNotes` 两个 state

#### 3.3 创建书签 Dialog
- 在标题输入框下方新增"描述（可选）"短文本输入框
- 在文件夹选择下方新增"笔记（可选）"多行文本域（textarea）

#### 3.4 编辑书签 Dialog
- 同样新增"描述"和"笔记"输入
- `openEditBookmark` 中初始化这两个字段

#### 3.5 提交逻辑
- `handleCreateBookmark` 和 `confirmEditBookmark` 传递 `description` 和 `notes`

#### 3.6 书签展示
- **卡片视图** `renderBookmarkRow`：标题下方显示描述（1行截断），再下方显示笔记摘要（1行截断），用 `text-muted-foreground` 样式区分
- **树形视图**书签卡片：同样在标题下方展示描述和笔记

#### 3.7 重置逻辑
- 所有关闭 Dialog 的回调中重置 `bmFormDescription` 和 `bmFormNotes`

## 涉及文件
| 文件 | 变更 |
|------|------|
| `prisma/schema.prisma` | 增加 `notes String?` |
| `src/app/api/bookmarks/route.ts` | POST 加 notes；PATCH 加 description + notes |
| `src/app/dashboard/dashboard-client.tsx` | 类型、状态、表单、展示 |

## 验证
1. `npx prisma migrate dev` 迁移成功
2. 创建书签时填写描述和笔记，保存后展示正确
3. 编辑书签时修改描述和笔记，更新成功
4. 不填写时与之前行为一致
