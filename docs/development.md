# Blog 開發資料

環境要求、指令與套件版本以 [package.json](../package.json) 為準；實際安裝版本由 [package-lock.json](../package-lock.json) 鎖定。

## 環境與操作

Node.js 版本記錄在 [.nvmrc](../.nvmrc)。建置需要安裝 `devDependencies`。

```sh
npm ci
npm run server
```

| 指令 | 用途 |
| --- | --- |
| `npm run server` | 本機預覽，預設為 `http://localhost:4000` |
| `npm run clean` | 清除 Hexo 快取與 `public/` |
| `npm run build` | Hexo 產生靜態網站，再由 Gulp 壓縮 HTML、CSS、JavaScript |
| `npm run lint` | 檢查 JavaScript 與程式碼格式 |
| `npm run lint:fix` | 自動修正可修復的 lint 問題 |
| `npm run deploy` | 清除、建置並發布至 GitHub 的 `gh-page` 分支 |

## 套件用途

| 套件 | 用途 |
| --- | --- |
| `hexo`、`hexo-theme-butterfly` | 靜態網站產生器與主題 |
| `hexo-renderer-marked`、`hexo-renderer-pug`、`hexo-renderer-stylus` | Markdown、Pug 模板與 Stylus 樣式渲染 |
| `hexo-generator-index`、`hexo-generator-archive`、`hexo-generator-category`、`hexo-generator-tag` | 首頁、分頁、歸檔、分類與標籤頁 |
| `hexo-generator-feed` | Atom feed |
| `hexo-generator-searchdb` | 本地搜尋索引 |
| `hexo-generator-sitemap` | Sitemap |
| `hexo-abbrlink` | 固定文章網址 |
| `hexo-filter-nofollow` | 外部連結屬性 |
| `hexo-wordcount` | 字數與閱讀時間 |
| `hexo-server`、`hexo-deployer-git` | 本機預覽與 Git 發布 |
| `gulp` | 建置後的壓縮流程 |
| `gulp-clean-css`、`gulp-html-minifier-terser`、`gulp-terser` | CSS、HTML 與 JavaScript 壓縮 |
| `eslint`、`@eslint/js` | 程式碼檢查 |
| `@stylistic/eslint-plugin`、`globals` | 格式規則與執行環境全域變數 |

Gulp 與 ESLint 相關套件位於 `devDependencies`。`allowScripts` 記錄已檢查的 `hexo-util` 安裝腳本，用來產生程式碼高亮的語言索引。

## 配置資料

| 檔案 | 管理內容 |
| --- | --- |
| [_config.yml](../_config.yml) | Hexo 完整預設配置與本站的網站資訊、文章渲染、產生器及 Git 發布設定 |
| [_config.butterfly.yml](../_config.butterfly.yml) | Butterfly 完整預設配置與本站的主題設定 |
| [scripts/seo.js](../scripts/seo.js) | 各類頁面的 SEO metadata、JSON-LD 與 `llms.txt` 產生流程 |
| [gulpfile.js](../gulpfile.js) | HTML、CSS、JavaScript 壓縮 |
| [eslint.config.mjs](../eslint.config.mjs) | ESLint flat config 與程式碼格式 |
| [Dockerfile](../Dockerfile) | Node.js 建置階段與 Nginx 靜態網站映像 |
| [compose.yaml](../compose.yaml) | 本機容器建置與 `4000:80` 埠對應 |
| [.dockerignore](../.dockerignore) | 排除本機依賴、產物、快取與 agent 文件 |
| [ci.yml](../.github/workflows/ci.yml) | 在 main push 與 pull request 執行 lint、建置 |
| [deploy.yml](../.github/workflows/deploy.yml) | 推送 Git tag 時建置並發布 Docker image |

`_config.yml` 以 [Hexo 官方 starter 範本](https://github.com/hexojs/hexo-starter/blob/master/_config.yml) 為底稿；`_config.butterfly.yml` 以已安裝 Butterfly 套件的完整 `_config.yml` 為底稿。兩份檔案保留預設選項、註解與範例，本站修改直接套用到對應欄位。

程式碼高亮使用 `syntax_highlighter: highlight.js`。Butterfly 的頁尾版權與結構化資料設定為 `footer.copyright.enable`、`structured_data.enable`；分享項目使用 `x`。本站由 `scripts/seo.js` 統一產生 JSON-LD，取代 Butterfly 5.7 在非文章頁輸出的空白區塊，並遵循 `structured_data.enable` 開關。

文章網址為 `posts/:abbrlink/`。建置產生 `atom.xml`、`sitemap.xml`、`search.xml` 與 `llms.txt`；搜尋介面另由主題的 `search.use` 控制。

## SEO 與文章維護

文章 front matter 的 `title`、`description`、`keywords` 分別管理標題、可讀摘要與主題詞。標題清楚說明主題即可，不必列出所有工具或功能；開頭保留作者原有的問題、經過與語氣，避免每篇都加制式導讀。摘要用自然的句子說明內容，不寫成關鍵字清單。關鍵字依實際內容選擇，不加入文章未涵蓋的版本、測試結果或功能。`keywords` 用於結構化資料；[Google 不使用 meta keywords 作為排名訊號](https://developers.google.com/search/docs/crawling-indexing/special-tags#unsupported-tags-and-attributes)。

首頁文章卡片使用 `index_post_content.method: 1` 顯示手寫摘要；作者欄描述獨立設定，保留原有自我介紹。文章版權區與 JSON-LD 的作者連結指向公開 GitHub 個人頁面。

`updated_option: date` 讓未填寫 `updated` 的文章沿用原發布日期，避免 Git checkout 或檔案時間變動被誤認為內容更新。實質修改教學時，明確填寫 `updated`，保留原 `date` 與 `abbrlink`。

`scripts/seo.js` 透過 Hexo 的 `template_locals` 與 `after_render:html` filter 補上首頁分頁、歸檔、分類與標籤頁的專屬標題及摘要。JSON-LD 使用 `WebSite`、`Person`、`WebPage`／`CollectionPage`、`BlogPosting` 與 `BreadcrumbList`，文章摘要、分類、主題詞和日期都取自同一份內容。404 頁加入 `noindex, follow`，不輸出 JSON-LD。

`llms.txt` 從已發布文章的標題、摘要與固定網址產生，提供內容索引，不複製整篇教學。此檔案是給支援它的工具使用；Google 的 AI 搜尋不要求此檔案，也沒有額外的排名加成。現有 `robots.txt` 允許公開頁面爬取，並指向 sitemap。

| 文章網址 | 主要搜尋意圖 |
| --- | --- |
| `/posts/4e1d9a72/` | Nextcloud Docker Compose 部署 |
| `/posts/726d0fcd/` | Nextcloud 應用程式推薦與安裝設定 |
| `/posts/efd7b7b9/` | Nextcloud Nginx HTTPS 反向代理 |
| `/posts/811961c1/` | TrueNAS CORE Nextcloud Jail 遷移（已棄用紀錄） |
| `/posts/aba6d71/` | Nextcloud Preview Generator 安裝、背景排程與預覽清理 |
| `/posts/99b26485/` | Nextcloud 大檔案上傳、分塊設定與 504 排查 |
| `/posts/c25d04b3/` | Nextcloud 登入 IP 鎖定與內網排查 |
| `/posts/48d8abb/` | Proxmox VE LVM 磁碟重新命名 |
| `/posts/c0ed975c/` | Proxmox VE IDE、SATA、VirtIO、SCSI 磁碟效能比較 |
| `/posts/8d1a9329/` | Rocky Linux 9 更換 Mirror 與 DNF 快取 |
| `/posts/dd600bd3/` | Rocky Linux 9 編譯 Nginx Brotli 模組 |
| `/posts/c7d1d524/` | Verdaccio Docker Compose npm 私有 Registry |
| `/posts/d756239/` | APC UPS 電池充電異常維修紀錄 |

建置後檢查各 HTML 的唯一標題、摘要、canonical、JSON-LD 可解析性與內部連結，並確認 feed、sitemap、搜尋索引及 `llms.txt` 包含預期文章。正式發布後的收錄、查詢曝光、點擊與 rich result 資格須以 Search Console 和 Google Rich Results Test 驗證，本機建置無法確認搜尋成效。

參考：[Google 標題指南](https://developers.google.com/search/docs/appearance/title-link)、[摘要指南](https://developers.google.com/search/docs/appearance/snippet)、[Article 結構化資料](https://developers.google.com/search/docs/appearance/structured-data/article)、[AI 搜尋指南](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)、[Hexo filters](https://hexo.io/api/filter)。

## 容器與發布

```sh
docker compose up -d --build
```

容器透過 `http://localhost:4000` 提供靜態網站。Docker 發布流程使用 `DOCKER_REGISTRY`、`DOCKER_IMAGE`、`DOCKER_USERNAME`、`DOCKER_PASSWORD` 四個 GitHub Actions secrets，產生 Git tag 對應的 image tag 與 `latest`。

## 驗證

```sh
npm run lint
npm run clean
npm run build
```

開發規範從 [AGENTS.md](../AGENTS.md) 進入；必要功能檢查與測試政策見 [testing.md](standards/blog/testing.md)。
