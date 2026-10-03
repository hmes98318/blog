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
| [gulpfile.js](../gulpfile.js) | HTML、CSS、JavaScript 壓縮 |
| [eslint.config.mjs](../eslint.config.mjs) | ESLint flat config 與程式碼格式 |
| [Dockerfile](../Dockerfile) | Node.js 建置階段與 Nginx 靜態網站映像 |
| [compose.yaml](../compose.yaml) | 本機容器建置與 `4000:80` 埠對應 |
| [.dockerignore](../.dockerignore) | 排除本機依賴、產物、快取與 agent 文件 |
| [ci.yml](../.github/workflows/ci.yml) | 在 main push 與 pull request 執行 lint、建置 |
| [deploy.yml](../.github/workflows/deploy.yml) | 推送 Git tag 時建置並發布 Docker image |

`_config.yml` 以 [Hexo 官方 starter 範本](https://github.com/hexojs/hexo-starter/blob/master/_config.yml) 為底稿；`_config.butterfly.yml` 以已安裝 Butterfly 套件的完整 `_config.yml` 為底稿。兩份檔案保留預設選項、註解與範例，本站修改直接套用到對應欄位。

程式碼高亮使用 `syntax_highlighter: highlight.js`。Butterfly 的頁尾版權與結構化資料設定為 `footer.copyright.enable`、`structured_data.enable`；分享項目使用 `x`。

文章網址為 `posts/:abbrlink/`。建置產生 `atom.xml`、`sitemap.xml` 與 `search.xml`；搜尋介面另由主題的 `search.use` 控制。

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
