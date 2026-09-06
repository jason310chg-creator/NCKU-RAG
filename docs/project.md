# 一、專案目標

> Scope update (2026-09-07): the approved Phase 2 specification supersedes any
> password-login or broader Phase 2 suggestions in this historical roadmap.
> Phase 2A is Google OAuth only, exact active-email allowlist, database sessions,
> UUID User/Role preservation, server DAL/RBAC, bootstrap and minimal UI/CI.
> See `docs/auth.md` and `docs/timeline.md`. Stop after Phase 2A; Phase 2B–2D need
> their own acceptance and authorization. No push, merge or deployment is authorized.

> Implementation note (2026-09-06): this document describes the overall product
> roadmap, not completed functionality. The current Phase 1 scope is read-only
> public document list/detail APIs. See `docs/api.md` for the implemented contract
> and `docs/timeline.md` for verified status. The public list does not accept the
> historical `status` parameter below: status is always published and visibility
> is always public. API parameter/response names use snake_case throughout.

## 專案名稱

資訊系問答資料提供平台 / Knowledge Base Data Platform

## 核心目標

建立一個後台系統，讓管理者可以維護系上常見問題、文件、公告、活動資訊、學長姐經驗等資料，並透過統一格式與 API 提供給未來的 RAG 問答系統使用。

## 第一階段不做的事

第一階段先不做：

* AI 聊天機器人
* 自動回答問題
* 複雜推薦系統
* 多模型串接
* 高度自動化爬蟲
* 自動判斷資料真假

第一階段只做：

> **資料建立、資料管理、資料分類、資料版本、資料查詢 API。**

---

# 二、使用者角色

至少需要三種角色。

| 角色         | 權限                        |
| ---------- | ------------------------- |
| Admin 管理員  | 可新增、編輯、刪除所有資料；管理使用者；發布資料  |
| Editor 編輯者 | 可新增、編輯資料，但發布可能需要 Admin 核准 |
| Viewer 檢視者 | 只能查看已發布資料，不能修改            |

如果要簡化，第一版可以只做：

* Admin
* Editor

---

# 三、資料類型

平台需要支援幾種資料型態。

## 1. 問答型資料 FAQ

適合用來放常見問題。

例如：

* 大一需要買筆電嗎？
* Pizza 會是什麼？
* 資訊週什麼時候？
* 推甄要什麼時候開始準備？

資料欄位：

| 欄位         | 說明     |
| ---------- | ------ |
| Question   | 問題     |
| Answer     | 答案     |
| Category   | 分類     |
| Tags       | 標籤     |
| Source     | 資料來源   |
| Visibility | 可見對象   |
| Updated At | 最後更新時間 |

---

## 2. 文件型資料 Document

適合放 PDF、Word、簡報、公告、活動企劃書。

支援格式建議：

* PDF
* DOCX
* PPTX，可選
* TXT
* Markdown
* Google Doc 連結，可選
* 網頁 URL，可選

文件上傳後，系統要儲存：

| 欄位          | 說明                  |
| ----------- | ------------------- |
| Title       | 文件標題                |
| File        | 原始檔案                |
| Parsed Text | 解析後文字               |
| Category    | 分類                  |
| Tags        | 標籤                  |
| Source Type | 官方公告／系學會整理／學長姐經驗／其他 |
| Valid From  | 生效日期                |
| Valid Until | 失效日期，可選             |
| Status      | 草稿／已發布／封存           |
| Version     | 版本                  |
| Owner       | 負責人                 |

---

## 3. 連結型資料 Link Resource

適合放官方網站、表單、社團連結、活動報名連結。

例如：

* 系辦網站
* 選課系統
* 學校行事曆
* 系學會 IG
* 技術社團 Discord
* 活動報名表

欄位：

| 欄位              | 說明        |
| --------------- | --------- |
| Title           | 連結名稱      |
| URL             | 網址        |
| Description     | 說明        |
| Category        | 分類        |
| Tags            | 標籤        |
| Source Owner    | 來源單位      |
| Last Checked At | 最後確認時間    |
| Status          | 有效／失效／待確認 |

---

## 4. 結構化資訊 Structured Info

適合放固定資料，例如：

* 系辦位置
* 系辦開放時間
* 系學會幹部名單
* 活動時間
* 場地資訊
* 常用聯絡窗口

欄位可用 key-value 形式：

| 欄位         | 說明   |
| ---------- | ---- |
| Key        | 資料名稱 |
| Value      | 資料內容 |
| Category   | 分類   |
| Visibility | 可見對象 |
| Updated At | 更新時間 |

---

# 四、資料分類設計

資料要能分成「全校性」與「資訊系內部」。

## 主分類

建議第一層分類如下：

| 主分類                 | 說明           |
| ------------------- | ------------ |
| school_general      | 全校性資訊        |
| department_cs       | 資訊系內部資訊      |
| student_association | 系學會資訊        |
| career              | 升學、實習、職涯     |
| activities          | 活動資訊         |
| technical_resources | 技術社團、競賽、專案資源 |
| freshman            | 新生 FAQ       |

---

## 第二層分類範例

### 全校性資訊

* 教務選課
* 學務生活
* 獎助學金
* 場地借用
* 圖書館
* 校園網路
* 宿舍交通

### 資訊系內部資訊

* 課程與修課
* 畢業門檻
* 系辦與設備
* 系上活動
* 學長姐經驗
* 技術社團
* 系學會公告

---

# 五、資料狀態流程

每筆資料需要有狀態，不然以後資料會亂。

建議狀態：

| 狀態            | 說明          |
| ------------- | ----------- |
| Draft 草稿      | 尚未公開        |
| Review 待審核    | 編輯完成，等待確認   |
| Published 已發布 | 可供 RAG 系統讀取 |
| Archived 封存   | 舊資料，不再提供回答  |
| Expired 過期    | 超過有效期限      |

基本流程：

> 新增資料 → 草稿 → 審核 → 發布 → 更新版本 → 封存或過期

第一版如果想簡化，可以只做：

* Draft
* Published
* Archived

---

# 六、每筆資料必備欄位

這是最重要的規格。
不管是 FAQ、文件、連結，都應該有共同欄位。

## Common Metadata

```json
{
  "id": "uuid",
  "title": "資料標題",
  "content_type": "faq | document | link | structured",
  "category": "department_cs",
  "subcategory": "course",
  "tags": ["修課", "大一", "必修"],
  "source_type": "official | student_association | senior_experience | external | unknown",
  "source_name": "資訊系系辦",
  "source_url": "https://example.com",
  "visibility": "public | department_only | admin_only",
  "status": "draft | published | archived",
  "owner": "負責人",
  "created_at": "2026-05-13T10:00:00+08:00",
  "updated_at": "2026-05-13T10:00:00+08:00",
  "valid_from": "2026-05-13",
  "valid_until": null,
  "version": 1
}
```

---

# 七、資料來源可信度

因為 RAG 很容易把錯誤資料講得很像真的，所以資料來源要分等級。

建議每筆資料都有 `source_type`：

| source_type         | 說明             |
| ------------------- | -------------- |
| official            | 學校、系辦、教務處等官方來源 |
| student_association | 系學會整理          |
| senior_experience   | 學長姐經驗          |
| community           | 社團或學生社群提供      |
| external            | 外部網站           |
| unknown             | 未確認來源          |

未來 AI 回答時可以根據來源加註：

> 這是官方規定
> 這是系學會整理
> 這是學長姐經驗，不代表官方規定

這個設計很重要。
g
---

# 八、後台功能需求

工程師需要做一個 Admin Dashboard。

## 1. 登入系統

基本需求：

* 帳號密碼登入
* 管理員可新增使用者
* 不同角色有不同權限

進階可選：

* Google OAuth 登入
* 學校信箱登入限制

---

## 2. 資料列表頁

管理者可以看到所有資料。

功能：

* 搜尋標題
* 依分類篩選
* 依狀態篩選
* 依資料類型篩選
* 依更新時間排序
* 依負責人篩選

列表欄位：

* 標題
* 類型
* 分類
* 狀態
* 來源
* 最後更新時間
* 負責人

---

## 3. 新增／編輯資料

需要表單讓管理者新增資料。

基本欄位：

* 標題
* 內容
* 分類
* 標籤
* 來源類型
* 來源連結
* 可見對象
* 狀態
* 有效期限
* 備註

---

## 4. 檔案上傳

文件型資料需要支援上傳。

需求：

* 可上傳 PDF、DOCX、TXT、Markdown
* 系統保存原始檔案
* 系統嘗試解析文字
* 管理者可以檢視解析後文字
* 管理者可以手動修改解析後文字
* 檔案大小限制，例如 20MB

---

## 5. 版本管理

資料被修改時要留下版本。

至少要記錄：

* 修改者
* 修改時間
* 修改前內容
* 修改後內容
* 版本號

簡化版可以只做：

* 每次修改時 version +1
* 保留 updated_at 和 updated_by

正式版可以做完整 revision history。

---

## 6. 發布控制

只有 Published 狀態的資料會提供給 RAG 系統。

這點要明確寫給工程師：

> API 預設只回傳 status = published 的資料。

---

# 九、API 規格

這個平台的核心價值是提供資料給未來 RAG 系統，所以 API 很重要。

## 1. 取得資料列表

```http
GET /api/v1/documents
```

Query parameters：

| 參數            | 說明                                 |
| ------------- | ---------------------------------- |
| category      | 主分類                                |
| subcategory   | 子分類                                |
| tag           | 標籤                                 |
| content_type  | faq / document / link / structured |
| updated_after | 只取某時間後更新的資料                        |
| status        | 預設 published                       |
| limit         | 筆數                                 |
| offset        | 分頁                                 |

Response：

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "大一需要買筆電嗎？",
      "content_type": "faq",
      "category": "freshman",
      "subcategory": "equipment",
      "tags": ["新生", "筆電"],
      "source_type": "student_association",
      "status": "published",
      "updated_at": "2026-05-13T10:00:00+08:00"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 100
  }
}
```

---

## 2. 取得單筆資料

```http
GET /api/v1/documents/{id}
```

Response：

```json
{
  "id": "uuid",
  "title": "大一需要買筆電嗎？",
  "content": "建議大一資訊系學生準備一台筆電...",
  "content_type": "faq",
  "category": "freshman",
  "subcategory": "equipment",
  "tags": ["新生", "筆電", "程式設計"],
  "source_type": "student_association",
  "source_name": "系學會整理",
  "source_url": null,
  "visibility": "public",
  "status": "published",
  "version": 3,
  "updated_at": "2026-05-13T10:00:00+08:00"
}
```

---

## 3. 搜尋資料

```http
GET /api/v1/search?q=選課
```

第一版可以做 keyword search。
之後再做 semantic search。

Response：

```json
{
  "query": "選課",
  "results": [
    {
      "id": "uuid",
      "title": "加退選時間說明",
      "snippet": "加退選時間依教務處公告為準...",
      "category": "school_general",
      "source_type": "official",
      "updated_at": "2026-05-13T10:00:00+08:00"
    }
  ]
}
```

---

## 4. 給 RAG 使用的資料匯出 API

這支 API 專門給未來 RAG indexing 使用。

```http
GET /api/v1/rag/export
```

回傳所有已發布且有效的資料。

Response：

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Pizza 會介紹",
      "text": "Pizza 會是資訊系傳統活動...",
      "metadata": {
        "category": "activities",
        "subcategory": "department_event",
        "tags": ["Pizza會", "系上活動"],
        "source_type": "student_association",
        "source_name": "系學會",
        "updated_at": "2026-05-13T10:00:00+08:00",
        "version": 2
      }
    }
  ]
}
```

這支 API 很重要。
未來 RAG 系統只要定期呼叫它，就可以更新知識庫。

---

# 十、RAG 友善格式

即使第一階段不做 AI，也要先把資料格式設計成 RAG 友善。

每筆資料最好能輸出：

| 欄位          | 說明         |
| ----------- | ---------- |
| id          | 唯一識別       |
| title       | 標題         |
| text        | 主要文字內容     |
| metadata    | 分類、來源、更新時間 |
| source_url  | 來源連結       |
| source_type | 來源可信度      |
| updated_at  | 更新時間       |
| valid_until | 過期時間       |
| visibility  | 可見範圍       |

未來 RAG 回答時才能做到：

* 引用來源
* 避免使用過期資料
* 區分官方規定和學長姐經驗
* 依分類搜尋
* 依使用者身份限制資料

---

# 十一、資料庫設計建議

可以先用 PostgreSQL。

## documents table

```sql
documents (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  content_type TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  source_type TEXT,
  source_name TEXT,
  source_url TEXT,
  visibility TEXT DEFAULT 'public',
  status TEXT DEFAULT 'draft',
  owner_id UUID,
  valid_from DATE,
  valid_until DATE,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## tags table

```sql
tags (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
)
```

## document_tags table

```sql
document_tags (
  document_id UUID,
  tag_id UUID
)
```

## files table

```sql
files (
  id UUID PRIMARY KEY,
  document_id UUID,
  file_name TEXT,
  file_type TEXT,
  file_url TEXT,
  file_size INTEGER,
  parsed_text TEXT,
  uploaded_at TIMESTAMP
)
```

## users table

```sql
users (
  id UUID PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  role TEXT,
  created_at TIMESTAMP
)
```

---

# 十二、系統架構建議

第一版可以很簡單。

## 建議架構

```text
Admin Web Dashboard
        ↓
Backend API
        ↓
PostgreSQL Database
        ↓
File Storage
        ↓
RAG Export API
```

## 可用技術

前端：

* Next.js / React
* Vue 也可以

後端：

* FastAPI
* Node.js / NestJS
* Django

資料庫：

* PostgreSQL

檔案儲存：

* 本機 storage
* NAS
* S3 compatible storage
* Cloudflare R2

部署：

* Docker Compose
* VPS
* NAS Docker
* Render / Railway / Fly.io

如果是學生專案，我會建議：

> Next.js + PostgreSQL + Docker Compose

或：

> FastAPI + PostgreSQL + React

---

# 十三、權限與安全需求

至少要有：

* 登入後才能進後台
* API key 保護 RAG export API
* 不同角色權限不同
* 刪除資料要二次確認
* 保留操作紀錄
* 不要把私人資料公開給 RAG
* 文件上傳要限制檔案大小與格式

重要規則：

> RAG export API 只能輸出 status = published 且 visibility 允許的資料。

---

# 十四、第一階段 MVP 功能

如果要工程師先做最小可行版本，我建議這樣切。

## MVP 必做

1. 管理員登入
2. 新增 FAQ 資料
3. 新增文件資料
4. 上傳 PDF / DOCX / TXT
5. 資料分類與標籤
6. 草稿／發布／封存狀態
7. 資料搜尋
8. 資料列表
9. 單筆資料查看
10. RAG export API

## MVP 可不做

* Google OAuth
* 完整版本差異比較
* 自動爬蟲
* Semantic search
* Embedding
* Chatbot UI
* 多語言
* 複雜審核流程

---

# 十五、驗收標準

工程師做完後，你可以用這些標準驗收。

## 基本驗收

* 管理員可以登入後台
* 可以新增一筆 FAQ
* 可以新增一筆文件
* 可以上傳 PDF
* 可以設定分類、標籤、來源、狀態
* 可以把資料設為 Published
* API 可以取得 Published 資料
* Archived 資料不會被 RAG export API 取出
* 可以搜尋資料標題與內容
* 可以看到資料最後更新時間
* 可以知道資料來源是 official 還是 student_association

## RAG 驗收

呼叫：

```http
GET /api/v1/rag/export
```

必須拿到類似：

```json
{
  "id": "...",
  "title": "...",
  "text": "...",
  "metadata": {
    "category": "...",
    "tags": ["..."],
    "source_type": "...",
    "updated_at": "..."
  }
}
```

---

# 十六、可以直接給工程師的簡短版需求

你可以把下面這段直接丟給工程師：

> 我想先做一個通用的資料提供平台，未來會接到 RAG 問答系統，但第一階段先不做聊天機器人。
>
> 平台需要有後台，讓管理員可以新增、編輯、分類、標註、上傳與發布資料。資料類型包含 FAQ、文件、連結與結構化資訊。每筆資料都需要有標題、內容、分類、標籤、來源類型、來源連結、狀態、可見範圍、負責人、更新時間與版本。
>
> 系統需要支援草稿、已發布、封存等狀態。只有已發布且未過期的資料會透過 API 提供給未來 RAG 系統。
>
> 需要提供 REST API，包括資料列表、單筆資料、搜尋資料，以及專門給 RAG 使用的 export API。RAG export API 要回傳純文字內容與 metadata，包含分類、標籤、來源、更新時間與版本。
>
> 第一階段不需要做 AI 回答、不需要 embedding、不需要 semantic search，但資料格式要設計成未來可以接 RAG。
>
> 技術架構可以使用 React / Next.js 作為前端，FastAPI 或 Node.js 作為後端，PostgreSQL 作為資料庫，檔案可先存在本機或物件儲存空間。請先依照 MVP 估算開發時程與費用。

---

# 十七、我建議你對工程師的核心要求

你不要一開始要求他做「AI 系統」，而是要求他做：

> **一個 RAG-ready 的資料管理後台。**

這句很重要。

因為如果你一開始說「我要做 RAG」，工程師可能會直接跳去 LangChain、向量資料庫、Chatbot、Embedding，結果資料管理沒做好。

正確順序應該是：

> 資料管理平台
> → 資料清洗與格式化
> → RAG indexing
> → 問答介面
> → 權限與回饋機制
> → 持續更新流程

你現在要做的是第一步。

# 十八、開發規範

遵守一律使用 TDD 開發，每次建立新功能時，優先製作 test-case 開發後充分測試程式碼

開發過程中，除非產品已經上線，當需要重構專案某些部分例如資料欄位，優先直接清除掉所有資料，不要去建立遷移至新格式的程式碼，會增加維護困難度

禁止在開發過程使用 fallback 有錯誤請直接完整輸出錯誤，禁止隱藏隱性的錯誤 (null / default data etc...)

每次開發東西都需要先制定一份 timeline 看看做到哪個部分，或是選用的技術等等的，供開發者方便查看

開發過程請使用最正規，一般人會使用得開發/除錯方式，例如當今天需要npm但是沒有這東西，請你不要自己去仿冒自己寫package.json那種如，請你明確告訴使用者請安裝工具或是請你幫忙安裝，或是假如沒有 docker 也是
