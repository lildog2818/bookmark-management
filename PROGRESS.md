# 涔︾绠＄悊 Web 搴旂敤 鈥?椤圭洰鎬荤粨

## 馃寪 鍩烘湰淇℃伅

| 椤圭洰 | 鍐呭 |
|------|------|
| 缃戝潃 | https://bookmark-management.vercel.app |
| GitHub | https://github.com/lildog2818/bookmark-management |
| 鎶€鏈爤 | Next.js 16 + Tailwind CSS v4 + TypeScript |
| 鏁版嵁搴?| Neon PostgreSQL锛堟柊鍔犲潯鑺傜偣锛屽厤璐?5GB锛墊
| ORM | Prisma |
| 璁よ瘉 | NextAuth v5锛堥偖绠卞瘑鐮?+ bcryptjs锛墊
| 閮ㄧ讲 | Vercel锛堝厤璐瑰椁愶級|

## 鉁?宸插畬鎴愬姛鑳?
- [x] 椤圭洰鍒濆鍖栵紙Next.js + Tailwind + TypeScript锛?- [x] 鏁版嵁搴撻厤缃紙Prisma + Neon PostgreSQL锛?- [x] 鐢ㄦ埛娉ㄥ唽 / 鐧诲綍锛堥偖绠卞瘑鐮侊級
- [x] 鏂囦欢澶圭鐞嗭紙鏃犻檺灞傜骇宓屽锛?- [x] 涔︾澧炲垹鏀癸紙鏍囬銆乁RL銆佹弿杩帮級
- [x] 宸︿晶鏂囦欢澶规爲 + 鍙充晶涔︾鍗＄墖甯冨眬
- [x] 鏍囬 + URL 鍏ㄦ枃鎼滅储
- [x] 娴忚鍣ㄤ功绛?HTML 瀵煎叆锛圕hrome / Firefox / Edge锛?- [x] 鏆楄壊妯″紡
- [x] Vercel 閮ㄧ讲涓婄嚎

## 鈴?寰呭畬鎴?
- [ ] 瀵煎嚭涔︾锛圚TML / JSON 鏍煎紡锛?- [ ] 鎷栨嫿绉诲姩涔︾鍒版枃浠跺す
- [ ] 姝婚摼妫€娴?- [ ] 鍘婚噸绠＄悊
- [ ] 鍒嗕韩閾炬帴

## 馃敡 Vercel 鐜鍙橀噺閰嶇疆

| 鍙橀噺鍚?| 璇存槑 |
|--------|------|
| `DATABASE_URL` | Neon PostgreSQL 杩炴帴瀛楃涓?|
| `NEXTAUTH_SECRET` | 浠绘剰闅忔満瀛楃涓诧紙鐢ㄤ簬 JWT 鍔犲瘑锛?|
| `NEXTAUTH_URL` | `https://bookmark-management.vercel.app` |

## 馃搧 椤圭洰鐩綍缁撴瀯

```
bookmark_management/
鈹溾攢鈹€ prisma/
鈹?  鈹斺攢鈹€ schema.prisma          # 鏁版嵁搴撴ā鍨?鈹溾攢鈹€ src/
鈹?  鈹溾攢鈹€ app/
鈹?  鈹?  鈹溾攢鈹€ page.tsx           # 棣栭〉锛圠anding锛?鈹?  鈹?  鈹溾攢鈹€ layout.tsx         # 鏍瑰竷灞€
鈹?  鈹?  鈹溾攢鈹€ globals.css        # 鍏ㄥ眬鏍峰紡 + 涓婚鍙橀噺
鈹?  鈹?  鈹溾攢鈹€ (auth)/
鈹?  鈹?  鈹?  鈹溾攢鈹€ login/page.tsx
鈹?  鈹?  鈹?  鈹斺攢鈹€ register/page.tsx
鈹?  鈹?  鈹溾攢鈹€ dashboard/
鈹?  鈹?  鈹?  鈹溾攢鈹€ page.tsx       # 鏈嶅姟绔粍浠讹紙鏁版嵁鑾峰彇锛?鈹?  鈹?  鈹?  鈹斺攢鈹€ dashboard-client.tsx  # 瀹㈡埛绔氦浜掔粍浠?鈹?  鈹?  鈹斺攢鈹€ api/
鈹?  鈹?      鈹溾攢鈹€ auth/
鈹?  鈹?      鈹?  鈹溾攢鈹€ [...nextauth]/route.ts
鈹?  鈹?      鈹?  鈹斺攢鈹€ register/route.ts
鈹?  鈹?      鈹溾攢鈹€ bookmarks/
鈹?  鈹?      鈹?  鈹溾攢鈹€ route.ts
鈹?  鈹?      鈹?  鈹斺攢鈹€ import/route.ts
鈹?  鈹?      鈹斺攢鈹€ folders/route.ts
鈹?  鈹溾攢鈹€ lib/
鈹?  鈹?  鈹溾攢鈹€ auth.ts            # NextAuth 閰嶇疆
鈹?  鈹?  鈹溾攢鈹€ prisma.ts          # Prisma 瀹㈡埛绔疄渚?鈹?  鈹?  鈹斺攢鈹€ utils.ts           # cn() 宸ュ叿鍑芥暟
鈹?  鈹斺攢鈹€ types/
鈹?      鈹溾攢鈹€ index.ts           # 绫诲瀷瀹氫箟
鈹?      鈹斺攢鈹€ next-auth.d.ts     # NextAuth 绫诲瀷鎵╁睍
鈹溾攢鈹€ .env                       # 鐜鍙橀噺锛堜笉鎻愪氦鍒?Git锛?鈹溾攢鈹€ .gitignore
鈹溾攢鈹€ package.json
鈹溾攢鈹€ next.config.ts
鈹溾攢鈹€ tsconfig.json
鈹斺攢鈹€ postcss.config.mjs
```
