-- 将现有的默认蓝色文件夹颜色设为 NULL
UPDATE "Folder" SET "color" = NULL WHERE "color" = '#3b82f6';

-- 移除 color 列的默认值
ALTER TABLE "Folder" ALTER COLUMN "color" DROP DEFAULT;

-- 移除 icon 列的默认值
ALTER TABLE "Folder" ALTER COLUMN "icon" DROP DEFAULT;