---
title: Nextcloud 安裝預覽生成器
tags:
  - Nextcloud
categories: Nextcloud
keywords: 'Nextcloud Preview Generator,Nextcloud 預覽圖,Nextcloud 影片縮圖,HEIC 預覽,preview:generate-all,preview:pre-generate'
description: 在 Nextcloud 安裝 Preview Generator，設定圖片、影片與 HEIC 預覽，並安排背景生成和清理預覽快取。
cover: /img/background/nextcloud.png
abbrlink: aba6d71
comments: true
date: 2023-08-28 10:02:35
updated: 2026-10-04 04:47:09
---

想在 Nextcloud 瀏覽檔案時直接看到圖片和影片的縮圖，可以安裝 Preview Generator，先把預覽圖產生好。

Nextcloud 本身就能在開啟檔案時生成預覽；Preview Generator 會把這些工作提前放到背景執行。照片很多、伺服器生成縮圖較慢時，先生成預覽可以減少開啟資料夾時的等待，也會多用一些儲存空間。

下面以 Linux 的 `/var/www/nextcloud` 和 `www-data` 示範。使用其他路徑、PHP 執行帳號或容器時，換成自己的設定，並在實際執行 Nextcloud PHP 的環境中操作即可。

## 執行前先確認環境

`occ` 要由 Nextcloud 的 PHP 執行帳號操作，PHP CLI 版本也應與網頁端一致。先進入安裝目錄，確認能讀取站台狀態：

```bash
cd /var/www/nextcloud

sudo -u www-data php occ status
php --ini
```

Debian／Ubuntu 常見帳號是 `www-data`，其他系統可能使用 `apache`、`http`，或自行設定的帳號。容器部署則透過該環境提供的命令，以相同身分執行 `php occ`。詳見 [Nextcloud occ 官方文件](https://docs.nextcloud.com/server/stable/admin_manual/occ_command.html#running-occ)。

### PHP CLI 的記憶體與 APCu

在 PHP CLI 實際載入的 `php.ini` 中，可以參考以下設定：

```ini
memory_limit = 1024M
apc.enable_cli = 1
```

`memory_limit` 是單一 PHP 程序的記憶體上限，`1024M` 可作為處理大量照片時的起點，再依伺服器資源調整。多個程序同時生成預覽時，總用量仍可能超過這個數字。

如果 Nextcloud 使用 APCu 作為本機快取，CLI 也要啟用 `apc.enable_cli`。臨時執行時可在 `php` 後加上 `-d apc.enable_cli=1`；例如 `sudo -u www-data php -d apc.enable_cli=1 occ status`。

這兩項設定可參考 [nextcloud-custom 的 PHP 配置](https://github.com/hmes98318/nextcloud-custom/blob/6d7c02efbbf5d4b58dfd260c402c67d96afbc2c0/overlay/php/php.ini)。網頁端與 CLI 可能載入不同的配置，請以 `php --ini` 的結果確認 CLI 設定。

## 安裝 Preview Generator

以管理員登入 Nextcloud，進入「應用程式」，搜尋 **Preview Generator**，點擊「下載並啟用」。安裝前先查看 [App Store 的版本相容性](https://apps.nextcloud.com/apps/previewgenerator)，使用符合自己 Nextcloud 版本的發行版。

![Nextcloud 應用程式商店中的 Preview Generator](/img/blogs/aba6d71/previewGenerator.png)

也可以在 Nextcloud 安裝目錄用 `occ` 安裝：

```bash
sudo -u www-data php occ app:install previewgenerator
sudo -u www-data php occ list preview
```

已安裝但尚未啟用時，改用 `app:enable previewgenerator`。

目前專案仍將加密功能列為使用限制；啟用 Nextcloud 伺服器端加密的站台，請先確認 [Preview Generator 的 Known issues](https://github.com/nextcloud/previewgenerator#known-issues)。

## 配置 Nextcloud 預覽

先備份 `config/config.php`，再將以下設定合併到既有的 `$CONFIG` 陣列內。範例包含常用圖片、文字、影片與 HEIC 預覽；只需要一般圖片預覽時，可移除 `Movie`、`HEIC` 和兩個影片工具路徑。

```php
// 預覽生成與資源上限
'enable_previews' => true,
'preview_max_x' => 2048,
'preview_max_y' => 2048,
'preview_max_filesize_image' => 50,
'preview_max_memory' => 256,

// 影片預覽工具，路徑依實際安裝位置調整
'preview_ffmpeg_path' => '/usr/bin/ffmpeg',
'preview_ffprobe_path' => '/usr/bin/ffprobe',

// 保留常用格式，另啟用影片與 HEIC 預覽
'enabledPreviewProviders' => [
  'OC\Preview\BMP',
  'OC\Preview\GIF',
  'OC\Preview\JPEG',
  'OC\Preview\Krita',
  'OC\Preview\MarkDown',
  'OC\Preview\OpenDocument',
  'OC\Preview\PNG',
  'OC\Preview\TXT',
  'OC\Preview\WebP',
  'OC\Preview\XBitmap',
  'OC\Preview\Movie',
  'OC\Preview\HEIC',
],
```

### 尺寸與記憶體上限

| 參數 | 範例值與用途 |
| --- | --- |
| `enable_previews` | `true`，啟用 Nextcloud 預覽功能。 |
| `preview_max_x`、`preview_max_y` | 最大寬、高各 2048 像素，限制預覽圖尺寸，不會改動原始檔案。 |
| `preview_max_filesize_image` | GD 圖片預覽的檔案大小上限，範例為 50 MB。大型圖片被略過時，可以檢查這項設定。 |
| `preview_max_memory` | GD 圖片預覽的記憶體估算上限，範例為 256 MB；它與 PHP 的 `memory_limit` 分別控制不同限制。 |

`enabledPreviewProviders` 會取代預設的 provider 清單。若原本已使用其他格式或 Imaginary 預覽服務，合併時要保留對應項目；只加上影片 provider 而刪掉其他項目，會讓那些格式失去預覽支援。

參數的完整定義與各版本預設值，參考 [Nextcloud 預覽配置](https://docs.nextcloud.com/server/stable/admin_manual/configuration_files/previews_configuration.html) 和 [預覽相關配置參數](https://docs.nextcloud.com/server/stable/admin_manual/configuration_server/config_sample_php_parameters.html#previews)。

### 影片與 HEIC 所需的工具

影片使用 `OC\Preview\Movie`，由 FFmpeg 擷取畫面。先依作業系統安裝 [FFmpeg](https://ffmpeg.org/download.html)，再確認 `ffmpeg`、`ffprobe` 的實際位置，以及 PHP 執行帳號能否使用：

```bash
command -v ffmpeg
command -v ffprobe

sudo -u www-data /usr/bin/ffmpeg -version
sudo -u www-data /usr/bin/ffprobe -version
```

HEIC／HEIF 預覽需要 PHP 的 Imagick 擴充與具備 HEIC 解碼能力的 ImageMagick。可以從 CLI 檢查：

```bash
sudo -u www-data php -r 'if (extension_loaded("imagick")) { print_r(Imagick::queryFormats("HEI*")); } else { echo "Imagick is not enabled\n"; }'
```

結果應包含 `HEIC`，再用實際的手機照片測試。格式是否能解碼，也受安裝的圖片函式庫與編碼支援影響。

影片等額外 provider 預設未啟用，官方文件也提醒它們的效能與支援限制；依實際需要啟用即可，參考 [官方預覽格式說明](https://docs.nextcloud.com/server/stable/admin_manual/configuration_files/previews_configuration.html)。若 CLI 能生成、網頁端卻不能，還要確認網頁端的 PHP 擴充、執行權限與 `disable_functions` 設定。

修改完成後先檢查語法：

```bash
php -l config/config.php
```

如果使用 `opcache.validate_timestamps=0`，更新 App 或修改 PHP 配置後，記得重啟 PHP-FPM 或對應的 PHP 服務，讓新設定生效。

## 設定要預先生成的尺寸

Nextcloud 的 `preview_max_x`、`preview_max_y` 控制整個預覽系統的尺寸上限；Preview Generator 的 App 設定則決定要提前生成哪些尺寸。先用較少的尺寸，通常可以節省生成時間與儲存空間：

```bash
sudo -u www-data php occ config:app:set previewgenerator squareSizes --value="64 256"
sudo -u www-data php occ config:app:set previewgenerator fillWidthHeightSizes --value="256 1024"
sudo -u www-data php occ config:app:set previewgenerator widthSizes --value=""
sudo -u www-data php occ config:app:set previewgenerator heightSizes --value=""
```

這組設定會提前生成 64、256 像素的正方形縮圖，以及較長邊為 256、1024 像素、保留比例的預覽。其他需要的尺寸仍可在使用時生成。

`squareSizes`、`fillWidthHeightSizes`、`widthSizes`、`heightSizes` 使用空白分隔的尺寸，支援 64、256、1024、4096 等 4 的次方值。`--value=""` 表示不預先生成該類尺寸；刪除設定則會恢復內建預設值。

需要 4096 像素預覽時，也要把 `preview_max_x`、`preview_max_y` 調整到至少 4096。使用 Memories 時，可再依需要加入 `coverWidthHeightSizes`；詳見 [Preview Generator 的尺寸設定](https://github.com/nextcloud/previewgenerator#available-configuration-options)。

## 第一次生成預覽

安裝與設定完成後，執行一次完整生成，處理已經存放在 Nextcloud 的檔案：

```bash
sudo -u www-data php occ preview:generate-all -vv
```

`-vv` 會顯示較詳細的處理資訊。第一次要掃描現有檔案，資料量大時可能執行很久；我之前約 60 萬筆資料，等了快三天才全部生成完成。這是當時的耗時紀錄，實際時間仍取決於檔案格式、尺寸、硬體和預覽設定。

先挑一個帳號或資料夾測試，也比較容易確認格式與資源用量：

```bash
# 只處理 alice 的檔案
sudo -u www-data php occ preview:generate-all alice -vv

# 只處理指定資料夾
sudo -u www-data php occ preview:generate-all --path="/alice/files/Photos" -vv
```

`alice` 要換成帳號 ID，路徑則使用 `/帳號ID/files/資料夾` 的格式。新版指令也支援 `--workers`；CLI 有 `pcntl` 擴充且資源足夠時，可從 `--workers=2` 試起，再觀察 CPU、記憶體與磁碟負載。

要略過整個資料夾及其子目錄，可在該資料夾建立空白的 `.nomedia` 檔案。指令與選項以 `php occ help preview:generate-all` 和 [專案使用說明](https://github.com/nextcloud/previewgenerator#commands) 為準。

## 背景預覽工作

`preview:generate-all` 用於第一次處理現有檔案；之後新增或修改的檔案，由背景工作或 `preview:pre-generate` 處理。下面兩種方式擇一使用。

### 使用 Nextcloud 的 Cron

先確認 Nextcloud 的背景工作使用 **Cron** 模式：

```bash
sudo -u www-data php occ background:cron
```

如果尚未安排 `cron.php`，用 PHP 執行帳號的 crontab 新增排程：

```bash
sudo crontab -u www-data -e
```

每五分鐘執行一次，PHP 與 Nextcloud 路徑要換成自己的位置：

```cron
*/5 * * * * /usr/bin/php -d apc.enable_cli=1 -f /var/www/nextcloud/cron.php
```

已有 `cron.php` 的 Cron、systemd timer 或其他排程時，保留現有安排即可。詳見 [Nextcloud 背景工作官方文件](https://docs.nextcloud.com/server/stable/admin_manual/configuration_server/background_jobs_configuration.html#cron)。

Preview Generator 新版內建預覽背景工作，可以直接沿用 Nextcloud Cron。若之前停用過，重新啟用並設定每次的處理上限：

```bash
sudo -u www-data php occ config:app:set previewgenerator job_disabled --type boolean --value false
sudo -u www-data php occ config:app:set previewgenerator job_max_execution_time --type integer --value 300
sudo -u www-data php occ config:app:set previewgenerator job_max_previews --type integer --value 0
```

`job_max_execution_time=300` 將單次工作限制在五分鐘，`job_max_previews=0` 則不限制該次生成的預覽數量。兩項限制同時存在時，先達到的限制會結束當次工作。這個方式需要 Cron 模式，不能只依賴 AJAX 或 Webcron。

### 獨立排程 preview:pre-generate

想自己安排執行時段，或預覽佇列持續累積時，也可以獨立排程 `preview:pre-generate`。例如在同一個 PHP 執行帳號的 crontab，每五分鐘執行一次：

```cron
*/5 * * * * /usr/bin/php -d apc.enable_cli=1 /var/www/nextcloud/occ preview:pre-generate
```

確認獨立排程能執行後，再停用 App 內建的預覽背景工作：

```bash
sudo -u www-data php occ config:app:set previewgenerator job_disabled --type boolean --value true
```

`job_disabled` 只停用 Preview Generator 的內建預覽工作，`cron.php` 仍要保留，供 Nextcloud 其他背景工作使用。若安裝環境已安排 `preview:pre-generate`，沿用該排程即可。

手動執行與查看佇列時，可用：

```bash
sudo -u www-data php occ preview:pre-generate -vv
sudo -u www-data php occ preview:queue-stats
```

若佇列長期清不完，先確認排程、檔案格式與錯誤記錄，再調整執行時段或處理上限。各項背景工作設定，參考 [Preview Generator 的配置說明](https://github.com/nextcloud/previewgenerator#available-configuration-options)。

## 清理與重新生成預覽

改過尺寸、品質或 provider，需要重新生成快取時，**Nextcloud 31 及之後的版本**可使用 `preview:cleanup` 清除已生成的預覽。

清理前先備份，暫停預覽生成工作，並確認沒有生成程序正在執行。使用獨立排程時先暫停該排程；使用 App 內建背景工作時，先將 `job_disabled` 設為 `true`。

```bash
sudo -u www-data php occ preview:cleanup
```

這個指令清除的是預覽快取，原始檔案會保留。清理後，Nextcloud 可以在開啟檔案時重新生成；如果要提前全部產生，再執行：

```bash
sudo -u www-data php occ preview:generate-all -vv
```

完成後恢復原先的排程。使用 App 內建背景工作時把 `job_disabled` 改回 `false`；獨立排程則維持 `true`，並恢復自己的排程。

預覽清理不是日常必要的工作。較舊版本沒有這個指令時，請依該版本文件處理；目前版本的操作參考 [Nextcloud 官方 preview:cleanup 說明](https://docs.nextcloud.com/server/stable/admin_manual/occ_files.html#preview-cleanup)。

## 預覽沒有生成時的檢查方向

| 情況 | 先檢查的項目 |
| --- | --- |
| 找不到 `preview:generate-all` | Preview Generator 是否安裝並啟用、是否用正確的 Nextcloud 路徑執行 `occ`。 |
| 圖片只顯示檔案圖示 | `enable_previews`、provider 清單、`preview_max_filesize_image` 和 `preview_max_memory`。 |
| 影片沒有縮圖 | FFmpeg／ffprobe 路徑、PHP 執行權限、`proc_open` 是否被停用，以及實際影片是否可解碼。 |
| HEIC 沒有縮圖 | Imagick 擴充和 `Imagick::queryFormats("HEI*")` 的結果。 |
| 手動能生成，新增檔案卻沒有預覽 | Cron 模式、排程是否持續執行、`job_disabled` 是否符合採用的排程方式。 |
| PHP 記憶體不足 | CLI 的 `memory_limit`、圖片尺寸，以及同時執行的程序數量。 |

測試時先用少量檔案，配合 `-vv` 輸出和 Nextcloud 的錯誤記錄確認原因，再處理整個站台。

## 相關文章

- [Nextcloud 應用程式推薦](/posts/726d0fcd/)
- [打造自己的雲端硬碟：Nextcloud 部署教學](/posts/4e1d9a72/)
- [Nextcloud 提高檔案上傳大小上限](/posts/99b26485/)
