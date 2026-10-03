---
title: Nextcloud 應用程式推薦
tags:
  - Nextcloud
categories: Nextcloud
keywords: 'Nextcloud 應用程式推薦,Nextcloud App,Notes,Contacts,Preview Generator,Nextcloud 兩步驟驗證'
description: 我目前使用的 Nextcloud 應用程式清單，從筆記、通訊錄到照片與媒體工具，附上安裝方式和需要另外配置的項目。
cover: /img/background/nextcloud.png
abbrlink: 726d0fcd
comments: true
date: 2026-10-04 04:24:48
updated: 2026-10-04 04:47:09
---

我的 Nextcloud 除了存放檔案，也裝了筆記、通訊錄、照片預覽和媒體工具。下面整理目前使用的應用程式，以及剛架好站台時可以先安裝哪些。

## 我目前使用的應用程式

| App | 用途與配置重點 |
| --- | --- |
| [Audio Player](https://apps.nextcloud.com/apps/audioplayer) `audioplayer` | 建立音樂庫與線上播放；大音樂庫要預留掃描時間。 |
| [Camera RAW Previews](https://apps.nextcloud.com/apps/camerarawpreviews) `camerarawpreviews` | 增加相機 RAW 預覽；先以自己的相機格式驗證支援。 |
| [Contacts](https://apps.nextcloud.com/apps/contacts) `contacts` | 通訊錄與 CardDAV 同步；反向代理需正確處理 `/.well-known/carddav`。 |
| [Diagramming](https://apps.nextcloud.com/apps/drawio) `drawio` | 在檔案介面編輯 draw.io 圖表；依資料需求選擇編輯器服務位置。 |
| [HEIC/HEIF Image Converter](https://apps.nextcloud.com/apps/imageconverter) `imageconverter` | 轉換 HEIC／HEIF；確認底層圖片函式庫可解碼實際檔案。 |
| [Metadata](https://apps.nextcloud.com/apps/metadata) `metadata` | 查看圖片、音訊等檔案的中繼資料；適合檢查 EXIF 資訊。 |
| [Notes](https://apps.nextcloud.com/apps/notes) `notes` | Markdown 筆記與裝置同步，適合先安裝的小型工具。 |
| [Preview Generator](https://apps.nextcloud.com/apps/previewgenerator) `previewgenerator` | 在背景預先產生縮圖，減少開啟照片列表時的等待；會增加儲存占用。 |
| [Registration](https://apps.nextcloud.com/apps/registration) `registration` | 自助註冊；先完成 SMTP，並設定註冊範圍、審核與預設配額。私人站台沒有開放註冊需求時可不安裝。 |
| [Automated media conversion](https://apps.nextcloud.com/apps/workflow_media_converter) `workflow_media_converter` | 使用 Flow 規則觸發媒體轉檔；依賴 FFmpeg，會增加 CPU 與暫存空間使用。 |

照片相關的幾個 App 各有用途：Preview Generator 負責預先產生縮圖，Camera RAW Previews 增加 RAW 格式的預覽支援，HEIC/HEIF Image Converter 則用來轉換檔案。安裝後仍要用自己的相機或手機檔案確認格式支援。

Contacts 的 CardDAV 同步需要正確處理服務探索；使用反向代理時，可對照 [Nextcloud 設定 Nginx 反向代理](/posts/efd7b7b9/)。

## 推薦先安裝哪些

剛開始使用時，可以先裝 **Notes**，把筆記放進自己的 Nextcloud。需要同步通訊錄時再加 **Contacts**；照片很多、打開資料夾常常要等縮圖時，可以考慮 **Preview Generator**，設定方式放在下方。

除了上面目前使用的 App，以下幾個也可以依需求考慮：

| App | 適合的用途 |
| --- | --- |
| [Calendar](https://apps.nextcloud.com/apps/calendar) `calendar` | 管理行事曆，透過 CalDAV 同步到其他裝置，可與 Contacts 一起使用。 |
| [Tasks](https://apps.nextcloud.com/apps/tasks) `tasks` | 管理待辦事項、期限與清單，適合把工作安排留在 Nextcloud。 |
| [Deck](https://apps.nextcloud.com/apps/deck) `deck` | 用看板與卡片整理專案，適合需要追蹤工作進度或多人協作時使用。 |

音樂、RAW 預覽與自動轉檔，等有對應檔案或工作流程時再加。Registration 則適合要開放自助註冊的站台，先完成郵件、審核與配額設定，再讓其他人申請帳號。

## 安裝與版本相容性

使用管理員選單進入「應用程式」，查看詳細資訊並點擊「下載並啟用」。以 Notes 為例，商店會提供符合這台 Nextcloud 版本的發行版。

![在應用程式商店安裝 Notes](/img/blogs/4e1d9a72/apps-notes.jpg)

安裝與升級前，查看 App Store 的 Releases 表格中對應自己 Nextcloud 版本的發行版，以及 App 所需的系統工具。清單中的 App 不一定同時支援最新的 Nextcloud；以各商店頁面的資料為準，保留相容性檢查。

### 使用 occ 安裝

以下以 Linux 為例，在 Nextcloud 安裝目錄執行，將路徑與 `www-data` 換成自己的安裝位置和 PHP 執行帳號：

```bash
cd /var/www/nextcloud

sudo -u www-data php occ app:install notes
sudo -u www-data php occ app:install contacts
sudo -u www-data php occ app:list
```

使用 [Nextcloud 部署教學](/posts/4e1d9a72/) 的 Docker Compose 時，在 `compose.yaml` 所在目錄以容器內的 PHP 執行相同命令，例如：

```bash
docker compose exec --user www-data nextcloud php occ app:install notes
docker compose exec --user www-data nextcloud php occ app:list
```

CLI 若因 APCu 未啟用而無法執行，可依 [occ 官方文件](https://docs.nextcloud.com/server/stable/admin_manual/occ_command.html) 在 CLI 配置啟用 `apc.enable_cli`，或在 `php` 後加上 `-d apc.enable_cli=1`。

如果 PHP 配置使用 `opcache.validate_timestamps=0`，安裝或更新 App 後要重啟 PHP 服務，讓網頁端載入新程式。部署教學使用的 image 屬於這種情況，可執行 `docker compose restart nextcloud`。

### AppAPI 的部署服務提示

AppAPI 用於管理 Ex-Apps，也就是透過外部容器執行的應用程式。上面列出的 PHP App 不需要另外建立這個部署服務。沒有使用 Ex-Apps 時，若管理總覽提示缺少 deployment daemon，可依需求停用 `app_api`。

準備使用 Ex-Apps 時，再依 [Nextcloud AppAPI 文件](https://docs.nextcloud.com/server/stable/admin_manual/exapps_management/AppAPIAndExternalApps.html) 配置部署服務。

## 啟用兩步驟驗證

我也建議把兩步驟驗證設好。新版 Nextcloud 已將 TOTP provider 納入 Server 發行套件，可直接啟用：

```bash
sudo -u www-data php occ app:enable twofactor_totp
```

接著由使用者在「個人設定 → 安全性」配置驗證器，並保存備援碼。

TOTP 的商店頁面保留的是早期獨立發行版本，更新會隨 Nextcloud Server 提供，參考 [Two-Factor TOTP Provider 說明](https://apps.nextcloud.com/apps/twofactor_totp)。

## 配置 Preview Generator

Preview Generator 需要配合 Nextcloud 的預覽設定與背景排程。完整步驟整理在 [Nextcloud 安裝預覽生成器](/posts/aba6d71/)，包括影片與 HEIC 所需的工具、首次生成，以及預覽快取的清理方式。

排程可以使用 App 內建背景工作，或獨立執行 `preview:pre-generate`。如果安裝環境已有預覽排程，請對照 [背景預覽工作](/posts/aba6d71/#背景預覽工作) 的設定，避免重複安排。

## 相關文章

- [打造自己的雲端硬碟：Nextcloud 部署教學](/posts/4e1d9a72/)
- [Nextcloud 設定 Nginx 反向代理](/posts/efd7b7b9/)
