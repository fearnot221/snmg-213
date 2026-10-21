# SNMG 213

中央大學工二機房網站重構：Astro 靜態網站＋GitHub Pages＋Pages CMS。

- 前台：https://fearnot221.github.io/snmg-213/
- 管理入口：https://fearnot221.github.io/snmg-213/admin/
- 圖文編輯器：https://app.pagescms.org/fearnot221/snmg-213/main
- Repo：https://github.com/fearnot221/snmg-213
- 部署紀錄：https://github.com/fearnot221/snmg-213/actions

## 不需要自架伺服器的內容管理

1. 到 Pages CMS，使用 GitHub 登入。
2. 安裝 Pages CMS GitHub App，選擇 **Only select repositories → snmg-213**。
3. 選擇 `fearnot221 / snmg-213 / main`。
4. 使用「文章與公告」新增或編輯文章，使用「網站內容與聯絡資訊」修改網站介紹與表單連結。
5. 儲存會直接產生 commit。GitHub Actions 檢查、建置成功後，自動更新 GitHub Pages；通常需要幾分鐘，實際時間以 Actions 為準。

這是第三方託管的 Git 內容編輯器，需要 GitHub repo 寫入授權。未登入或未授權者無法寫入。首次登入與授權由 repo 擁有者完成，本專案沒有網站管理員密碼，也不會要求你把 GitHub token 填進網站。

不想使用第三方編輯器時，也可以直接在 GitHub 編輯內容檔案並提交 commit，或本機修改後 push。

## 內容格式

- `src/content/posts/*.json`：每篇文章一個檔案，`body` 為 Markdown 文字；Pages CMS 提供圖文編輯器。
- `src/content/site/settings.json`：網站標題、介紹、聯絡資訊與服務表單。
- `public/images/uploads/`：Pages CMS 上傳圖片與檔案的位置。
- `.pages.yml`：內容欄位、分類、圖片與 commit 設定。

文章必要欄位：`title`、`slug`、`category`、`summary`、`date`（YYYY-MM-DD）、`published`（布林）、`pinned`（布林）、`body`。`source` 是可選的原文網址。

`published: false` 不會輸出到網站。**這個 repo 是公開的，草稿原始內容與 Git 歷史仍可從 GitHub 閱讀，請勿提交機密資料。** 真正需要保密的草稿請先留在私人文件。

未來日期的文章要等下一次 build 才會公開。工作流程每日台灣時間約 00:05 排程重建，也會在每次 main branch push 時重建；GitHub 排程可能延遲，沒有準時發布保證。可由 Actions 手動執行。GitHub 可能停用長期無活動 repo 的排程，請在需要日期發布時檢查工作流程是否啟用。

舊文章保留原網址 slug，請避免任意更改，否則既有連結會失效。新的重複 slug、無效日期、危險網址或必要欄位缺漏會導致 build 失敗，既有線上版本則繼續提供服務。錯誤訊息可在 Actions 查看。

CMS 媒體儲存 `/images/uploads/...`。建置會自動補上 `/snmg-213` 子路徑；也支援外部 HTTPS 圖片。請補上圖片替代文字。

## 本機開發

需求：Node.js 22.23.4 以上，建議 Node 24。

```sh
npm ci
npm run dev -- --port 4321
```

本機網址也是子路徑：http://localhost:4321/snmg-213/

```sh
npm run check
npm run build
npm test
npm start
```

測試涵蓋檔案內容驗證、草稿／未來文章排除、置頂排序、網址安全、Markdown XSS 清理、GitHub Pages 子路徑與所有建置頁面／資源連結。測試需先 build。

## 發布與更換網域

`.github/workflows/deploy.yml` 在 main push 後執行檢查、build、測試並部署。GitHub repo 的 Settings → Pages 必須選 GitHub Actions，環境為 `github-pages`。

目前 `astro.config.mjs`：`site: https://fearnot221.github.io`、`base: /snmg-213`。未變更學校正式網站 DNS。正式切換學校網域時，修改 site 與 base、更新 GitHub Pages 自訂網域及 DNS，再重新 build。

GitHub Pages 僅儲存靜態檔案。已移除前一版的 Node 服務、SQLite 寫入、網站密碼、session 與 API。前一版的本機 `.env` 和 `data/` 如仍存在，僅保留為未追蹤的本機舊資料，不會被讀取，也不會推上 repo。

## 原站遷移限制

七篇文章目前是核對後的摘要，日期 `2026-10-22` 為匯入日，不是原始發布日。全文與附件尚待補齊。值班表與成員資訊保留原站入口，未自行編造當學期資料；正式取代原網域之前，需要補齊或保留可用的歷史站址。

`public/images/joining.jpg` 為原站使用的機櫃示意圖，並非已核實的團隊或 213 室實拍；原站未提供原始授權資訊，正式用途請確認使用權或替換為自有影像。

視覺方向與檢查限制見 `DESIGN.md`。目前先發布前台預覽，尚未宣稱符合國際獎項評審標準。
