# LINE 官方帳號 品牌診斷機器人（純 Supabase 版）

> **2026/08 更新**：診斷流程已改成「單題漸進式量表」版本——關鍵字觸發後，機器人一次問一題（共 7 題），
> 每題用 4 個程度按鈕作答（非常有感／有一點／還好／不是我的情況），答完最後一題直接產出
> 深色卡片風格的百分比條狀圖診斷結果。
>
> 如果你是**已經照舊版本部署過**的專案，先執行 `migration_add_quiz_columns.sql` 幫資料表補欄位
> （不會刪掉舊資料），全新安裝則直接執行 `schema.sql` 即可。

不用 Render / Zeabur，webhook 直接跑在 **Supabase Edge Functions**（Deno runtime），
狀態資料也存在同一個 Supabase 專案的 Postgres，全部東西都在 Supabase 裡。

## 一、建立 LINE Messaging API 頻道

1. 到 [LINE Developers Console](https://developers.line.biz/console/) 建立 Provider → 建立 **Messaging API** Channel
2. 取得 `Channel secret`（Basic settings 分頁）
3. 產生 `Channel access token (long-lived)`（Messaging API 分頁）
4. 把「自動應答訊息」「加入好友歡迎訊息」都關掉，Webhook URL 先留空，等第三步部署完再回來填

## 二、建立資料表

1. 到你的 Supabase 專案 → SQL Editor
2. 貼上並執行 `schema.sql`

## 三、部署 Edge Function

需要先安裝 [Supabase CLI](https://supabase.com/docs/guides/cli)：

```bash
npm install -g supabase
```

登入並連結你的專案：

```bash
supabase login
cd lineoa-diagnosis-supabase
supabase link --project-ref your-project-ref
```

`your-project-ref` 在 Supabase 專案的 Settings → General 可以找到，記得也把它填進 `supabase/config.toml` 的 `project_id`。

設定環境變數（secrets）：

```bash
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=你的channel_access_token
supabase secrets set LINE_CHANNEL_SECRET=你的channel_secret
```

> `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 不用自己設定，Edge Functions 執行環境會自動注入。
>
> 這個版本**不需要外部預約連結**：診斷結果最後的按鈕是「我想進一步了解」，點擊後會直接在同一個 LINE 聊天室送出訊息，
> 你可以在 LINE 官方帳號後台的聊天室看到並人工回覆，全程不會跳轉到任何其他頁面。

部署：

```bash
supabase functions deploy line-webhook
```

（`supabase/config.toml` 裡已經設定 `verify_jwt = false`，因為 LINE 不會帶 Supabase 的登入 JWT，
如果你用的 CLI 版本不吃這個設定，改用 `supabase functions deploy line-webhook --no-verify-jwt`）

## 四、把 Webhook URL 填回 LINE

部署完成後，你的 webhook 網址會是：

```
https://<your-project-ref>.supabase.co/functions/v1/line-webhook
```

回到 LINE Developers Console → Messaging API 分頁 → Webhook URL 貼上這個網址 → 按「Verify」確認回傳成功 → 打開「Use webhook」開關。

## 五、測試

用手機掃 LINE Developers Console 上的 QR code 加自己的官方帳號好友，
應該會馬上收到歡迎訊息並開始問「主要服務的客戶類型」。

要看 log 除錯：

```bash
supabase functions logs line-webhook
```

## 六、（選用）改用 GitHub Actions 自動部署

如果不想每次改完程式碼都手動打 `supabase functions deploy`，可以設定 GitHub Actions，
之後只要 `git push` 到 `main` 分支，就會自動部署到 Supabase。

1. 把整個專案推到一個 GitHub repo（`.github/workflows/deploy.yml` 已經幫你寫好了）
2. 拿一組 Supabase **Access Token**：
   - 到 [Supabase Dashboard](https://supabase.com/dashboard) → 右上角頭像 → **Account** → **Access Tokens**
   - 點 **Generate new token**，複製產生出來的值（只會顯示一次，記得存起來）
3. 到你的 GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，新增兩組：
   - `SUPABASE_ACCESS_TOKEN`：剛剛複製的 access token
   - `SUPABASE_PROJECT_ID`：你的 Supabase 專案 ref（跟 `config.toml` 裡的 `project_id` 一樣，例如 `dephqbwfvbrawytlzuau`）
4. 之後只要修改程式碼、`git push` 到 `main`，GitHub Actions 就會自動觸發部署，
   可以到 repo 的 **Actions** 分頁看部署進度跟結果

> 注意：這個 workflow 只負責部署程式碼本身，**不會**幫你設定 `LINE_CHANNEL_ACCESS_TOKEN` 這類 secrets——
> 那些屬於敏感資料，建議還是手動用 `supabase secrets set` 設定一次就好，不要放進 GitHub repo 或 workflow 裡。

## 七、內容客製化

- `supabase/functions/line-webhook/questions.ts`：8 個問題文案、分類、每個分類的診斷段落文字 — **建議先改這裡**成你自己的服務語氣
- `supabase/functions/line-webhook/diagnosis.ts`：分數計算邏輯
- `supabase/functions/line-webhook/questions.ts`：7 題題目、分類、每個分類的診斷段落文字 — **建議先改這裡**成你自己的服務語氣，也可以增減題目數量
- `supabase/functions/line-webhook/diagnosis.ts`：分類計分邏輯（每個分類取平均百分比，由高到低排序）
- `supabase/functions/line-webhook/line-messages.ts`：Flex Message 排版（品牌色、單題卡片、結果條狀圖、CTA 按鈕文字）
- `handler.ts` 裡的 `request_consult`：使用者點擊 CTA 按鈕後，機器人在聊天室裡回覆的內容

修改程式碼後，重新部署一次即可生效：

```bash
supabase functions deploy line-webhook
```

## 八、之後可以加的優化方向

- `line_diagnosis_results` 這張表可以直接在 Supabase Table Editor 看，或串 Supabase 的 Database Webhooks 同步到 Google Sheet
- 加一個「重新測驗」的 postback，讓使用者可以重來
- 用 LINE 的 Rich Menu 取代文字選單，讓「開始診斷」更顯眼
- 診斷結果加一句「加你好友之後幾天內會收到更完整的品牌檢核清單」，之後可以再寫一個 Supabase 排程函式（`pg_cron` + Edge Function）做後續推播
- 使用者點「我想進一步了解」後，除了自動回覆，也可以在 `line_sessions` 加一個 `wants_consult boolean` 欄位標記起來，方便你之後在 Table Editor 篩選出「有意願的名單」直接主動聯繫
