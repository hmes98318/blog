---
title: 打造自己的雲端硬碟：Nextcloud 部署教學
tags:
  - Nextcloud
  - Docker
  - MariaDB
  - Redis
categories: Nextcloud
keywords: 'Nextcloud Docker Compose 部署,自架雲端硬碟,nextcloud-custom,MariaDB,Redis,Nextcloud 備份與更新,Cloudflare 分塊上傳'
description: 把 Nextcloud 架在自己的伺服器上，讓手機和電腦同步檔案。這裡用 Docker Compose 搭配 nextcloud-custom，備份與更新的做法也放在一起。
cover: /img/background/nextcloud.png
abbrlink: 4e1d9a72
comments: true
date: 2026-10-03 22:00:00
updated: 2026-10-04 04:47:09
---

想擁有 Google Drive、Dropbox 的便利，又不想把重要資料全交給第三方服務嗎？Nextcloud 可以讓你在自己的伺服器上，建立一套真正由自己掌控的雲端硬碟。

除了檔案同步與分享，Nextcloud 也支援照片管理、通訊錄、行事曆、筆記等功能，手機、電腦與瀏覽器都能存取。

這篇文章會從零開始部署 Nextcloud，完成基本設定、同步與外部存取，並處理備份和更新，建置一套可日常使用的自架雲端環境。

## 部署架構與版本

本篇使用 Docker Compose 搭配我維護的 [hmes98318/nextcloud-custom](https://github.com/hmes98318/nextcloud-custom) 建置 Nextcloud 站台，image 固定為 `ghcr.io/hmes98318/nextcloud-custom:32.0.15`。資料庫使用 MariaDB，快取與檔案鎖交給 Redis，設定、使用者檔案與額外安裝的 app 則透過宿主機目錄持久化。

基本架構包含三個 Compose 服務：

```text
瀏覽器／同步客戶端
        │
        ▼
Nextcloud 容器：Nginx + PHP-FPM + Cron
        ├── MariaDB：帳號、檔案索引、分享與應用程式資料
        ├── Redis：快取與檔案鎖
        └── 宿主機目錄：config、data、custom_apps
```

image 已內建提供 Nextcloud 網頁的 Nginx。宿主機可以直接對外服務、且 80／443 沒有被其他服務占用時，在這個 Nginx 配置正式憑證即可。若已有統一管理網域和憑證的入口、或 Nextcloud 位於內網，再增加外部反向代理；設定見 [Nextcloud 設定 Nginx 反向代理](/posts/efd7b7b9/)。

**Public IP 只解決網路可達性，正式對外仍要配置 HTTPS。** 本篇先用綁定本機的 HTTP 完成安裝，再選擇直接 HTTPS 或反向代理。

| 項目 | 本篇使用的版本／配置 |
| --- | --- |
| Nextcloud | `ghcr.io/hmes98318/nextcloud-custom:32.0.15` |
| MariaDB | `mariadb:10.11`，追蹤 10.11 系列修補版 |
| Redis | `redis:8.0.3`，與 repository 的 Compose 範例一致 |
| PHP、Nginx | image 內附 PHP 8.3.33、Nginx 1.30.5 |
| 持久化 | 全部使用宿主機目錄 bind mount |

Nextcloud 32 官方支援 MariaDB 10.6、10.11、11.4，其中推薦 10.11，因此這裡選用 10.11。資料庫必須使用 InnoDB、`READ COMMITTED`，並停用 binary logging 或使用 `ROW` 格式。不要直接把資料庫 tag 換成 `latest`，升級時要重新確認目標 Nextcloud 的 [系統需求](https://docs.nextcloud.com/server/32/admin_manual/installation/system_requirements.html)。

命令以 Linux、Bash 與 Docker Compose v2 以上為例。小型站台可先準備 2 核心、4 GiB RAM，再依 PHP 程序、資料庫、預覽與轉檔的實際使用量調整；這是起步配置，不是容量保證。文章中的安裝截圖來自 Docker Desktop 的 Linux 容器測試站。

本文實測使用 Nextcloud 32.0.15、MariaDB 10.11.19 與 Redis 8.0.3，驗證安裝、Cron、Notes、Preview Generator、分塊上傳、HTTPS 代理、SQL 備份還原，以及同版本 image 的維護腳本與容器重建。正式網域的憑證申請、Cloudflare 回源及跨版本資料遷移，仍須在對應環境驗證。

## nextcloud-custom 做了哪些調整

以下依照 `32.0.15` image 及其對應的 [repository commit](https://github.com/hmes98318/nextcloud-custom/tree/6d7c02efbbf5d4b58dfd260c402c67d96afbc2c0) 整理：

| 調整 | 用途與注意事項 |
| --- | --- |
| Nginx + PHP-FPM + Supervisor | 同一個容器啟動網頁、PHP、Cron 等程序，不需另外部署 PHP-FPM 或排程容器。Dockerfile 以 PHP FPM image 為基底，下載並驗證 Nextcloud 發行檔。 |
| Brotli、gzip 與靜態資源快取 | 壓縮 CSS、JavaScript 等回應，並為靜態資源配置快取期限。是否提升速度仍取決於網路與檔案類型。 |
| 大檔案與逾時配置 | Nginx 的 `client_max_body_size`、PHP 的上傳配置提高至 `100G`，多項讀寫逾時提高至 3600 秒。其他代理、配額與儲存容量仍會限制上傳。 |
| OPcache、APCu 與 Redis 擴充 | 減少重複編譯與快取查詢的成本。Redis 服務及 Nextcloud 快取設定仍須自行完成。 |
| FFmpeg、Imagick、EXIF 等工具 | 提供影片預覽、圖片處理及相關 app 所需的部分依賴；不代表所有 RAW、HEIC 或 Office 格式都能直接處理。 |
| 每五分鐘的 Cron | 已排程 `cron.php` 與 `occ preview:pre-generate`。後者須先安裝 Preview Generator。 |
| `nextcloud-upgrade` | 執行 `occ upgrade`、補資料庫欄位／索引／主鍵、執行三次 Cron，最後檢查狀態與 app。它不負責下載新 image。 |

有幾個與部署直接相關的差異：

- 這個 image 使用 PHP 的 entrypoint，沒有官方 Nextcloud Docker image 的自動安裝及資料複製流程。`MYSQL_HOST`、`NEXTCLOUD_ADMIN_USER` 等官方 image 的初始化環境變數，不能直接套用到這裡。
- Nextcloud 程式已放在 `/var/www/html`。**不要把空白目錄掛載到整個 `/var/www/html`**，否則會遮住程式，也會讓換 image 更新失效。
- 內附 HTTPS 使用自簽憑證；正式部署要換成自己的有效憑證。
- 原配置的 PHP-FPM 會啟動 80 個程序、最多 400 個，OPcache 為 2048 MiB。以下範例改用較小的數值，避免小型主機啟動時占用過多記憶體。
- 內附 `real-ip.conf` 信任整個 `10.0.0.0/8`，範例會覆蓋此設定，讓直接存取時不信任外部傳入的 `X-Forwarded-For`。
- image 內附 Fail2ban，但 Docker 網路的封鎖位置與權限需另行規劃。本範例停用其 Nextcloud jail，不把「程序有啟動」視為封鎖已生效。

repository 原本的 Compose 使用外部資料庫、NFS 與私有環境配置。下面改成可獨立部署的 MariaDB、Redis 與本機目錄。

## 建立部署目錄

```bash
sudo mkdir -p /srv/nextcloud
sudo chown "$(id -u):$(id -g)" /srv/nextcloud
cd /srv/nextcloud

git clone https://github.com/hmes98318/nextcloud-custom.git repository
git -C repository checkout 6d7c02efbbf5d4b58dfd260c402c67d96afbc2c0

mkdir -p config data custom_apps mariadb redis nginx php php-fpm fail2ban
```

這裡保留 repository 供查閱原始配置，部署使用預先建置的 GHCR image。若本機已下載 `32.0.15`，啟動時會使用現有 image。

部署目錄會是：

```text
/srv/nextcloud/
├── compose.yaml
├── .env
├── repository/               # 查閱 image 原始碼
├── config/config.php         # Nextcloud 系統設定，須可寫入
├── data/                     # 使用者檔案、預覽、Nextcloud 記錄
├── custom_apps/              # 從應用程式商店安裝的 app
├── mariadb/                  # 資料庫檔案
├── redis/                    # Redis 持久化資料
├── nginx/nextcloud.conf
├── nginx/nextcloud.inc
├── nginx/real-ip.conf
├── php/zz-tuning.ini
├── php-fpm/nextcloud.conf
└── fail2ban/nextcloud.local
```

`data` 與 `mariadb` 都要保留；只有使用者檔案、沒有資料庫，無法還原原本的帳號、分享與索引。`custom_apps` 也要獨立掛載，避免重建容器後遺失下載的 app。

### 密碼與環境變數

在部署目錄執行下列命令，各產生一組不同的密碼：

```bash
umask 077
cat > .env <<EOF
NEXTCLOUD_BIND_IP=127.0.0.1
NEXTCLOUD_HTTP_PORT=8080
MARIADB_ROOT_PASSWORD=$(openssl rand -hex 24)
MARIADB_PASSWORD=$(openssl rand -hex 24)
REDIS_PASSWORD=$(openssl rand -hex 24)
EOF
umask 022
```

`.env` 用於 Compose 的變數替換，並不會自動把 Redis 密碼寫進 Nextcloud。稍後還要配置 `config.php`。不要把 `.env`、`config.php` 或備份上傳至公開 repository。

此範例使用十六進位密碼，也方便稍後用 Bash 載入 `.env`。自行改用含 `$`、空白或其他特殊字元的密碼時，要確認 [Compose 變數與引號規則](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)，不要直接照抄 shell 載入方式。

## Docker Compose 配置

建立 `compose.yaml`：

```yaml
name: nextcloud

services:
  nextcloud:
    image: ghcr.io/hmes98318/nextcloud-custom:32.0.15
    restart: unless-stopped
    environment:
      TZ: Asia/Taipei
    ports:
      - "${NEXTCLOUD_BIND_IP:-127.0.0.1}:${NEXTCLOUD_HTTP_PORT:-8080}:80"
    volumes:
      - ./config:/var/www/html/config
      - ./data:/var/www/html/nextclouddata
      - ./custom_apps:/var/www/html/custom_apps
      - ./nginx/nextcloud.conf:/etc/nginx/conf.d/nextcloud.http.conf:ro
      - ./nginx/nextcloud.inc:/etc/nginx/conf.d/nextcloud.inc:ro
      - ./nginx/real-ip.conf:/etc/nginx/conf.d/real-ip.conf:ro
      - ./php/zz-tuning.ini:/usr/local/etc/php/conf.d/zz-tuning.ini:ro
      - ./php-fpm/nextcloud.conf:/usr/local/etc/php-fpm.d/nextcloud.conf:ro
      - ./fail2ban/nextcloud.local:/etc/fail2ban/jail.d/nextcloud.local:ro
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  db:
    image: mariadb:10.11
    restart: unless-stopped
    environment:
      TZ: Asia/Taipei
      MARIADB_ROOT_PASSWORD: ${MARIADB_ROOT_PASSWORD:?set MARIADB_ROOT_PASSWORD in .env}
      MARIADB_DATABASE: nextcloud
      MARIADB_USER: nextcloud
      MARIADB_PASSWORD: ${MARIADB_PASSWORD:?set MARIADB_PASSWORD in .env}
    command:
      - --transaction-isolation=READ-COMMITTED
      - --binlog-format=ROW
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
    volumes:
      - ./mariadb:/var/lib/mysql
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 20
      start_period: 30s

  redis:
    image: redis:8.0.3
    restart: unless-stopped
    environment:
      TZ: Asia/Taipei
      REDISCLI_AUTH: ${REDIS_PASSWORD:?set REDIS_PASSWORD in .env}
    command:
      - redis-server
      - --appendonly
      - "yes"
      - --requirepass
      - ${REDIS_PASSWORD:?set REDIS_PASSWORD in .env}
      - --maxmemory
      - 512mb
      - --maxmemory-policy
      - noeviction
    volumes:
      - ./redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10
```

MariaDB 與 Redis 沒有對宿主機發布連接埠，只由 Compose 內部網路存取。資料庫使用官方 image 的 [healthcheck.sh](https://mariadb.com/docs/server/server-management/automated-mariadb-deployment-and-administration/docker-and-mariadb/using-healthcheck-sh)，初始化完成後才啟動 Nextcloud。

Redis 同時存放快取與檔案鎖，因此這裡選擇 `noeviction`，不讓記憶體不足時自動淘汰鎖。超過 `maxmemory` 會拒絕部分寫入，必須監看用量並增加容量；512 MiB 不是所有站台都足夠。AOF 與程序額外記憶體也不完全包含在這個限制內，詳見 [Redis eviction 說明](https://redis.io/docs/latest/develop/reference/eviction/)。

### Nginx：先用本機 HTTP 安裝

建立 `nginx/nextcloud.conf`：

```nginx
upstream php-handler {
    server unix:/var/run/nextcloud-php-fpm.sock;
}

server {
    listen 80 default_server;
    listen [::]:80;
    server_name _;

    include /etc/nginx/conf.d/nextcloud.inc;
}
```

`nextcloud.inc` 已處理 PHP、WebDAV、靜態資源，以及禁止直接存取 `config`、`data`、`nextclouddata` 等路徑。從上述固定 commit 複製這個檔案，並調整這版 image 會觸發管理總覽警告的 `X-Robots-Tag`：

```bash
cp repository/overlay/nginx/conf.d/nextcloud.inc nginx/nextcloud.inc
sed -i '/X-Robots-Tag/s/"none"/"noindex, nofollow"/' nginx/nextcloud.inc
```

其餘規則保留。這個本機檔案會覆蓋 image 內的 include；日後換 image 時，要對照新版 `nextcloud.inc`，同步必要的路由與安全修正。HTTP virtual host 則避免初次安裝被導向 image 的自簽 HTTPS。

建立 `nginx/real-ip.conf`，直接存取時保留為只有註解的檔案：

```nginx
# Direct access: do not trust incoming X-Forwarded-For headers.
# When adding a reverse proxy, trust only its actual source IP.
```

反向代理情境下，讓 PHP 保留代理的來源 IP，再由 Nextcloud 的 `trusted_proxies` 判斷轉送標頭，配置方式見 [反向代理教學](/posts/efd7b7b9/)。

### PHP 與 PHP-FPM

建立 `php/zz-tuning.ini`。檔名以 `zz-` 開頭，讓這些數值在 image 原本的 `php.ini` 之後載入：

```ini
[PHP]
memory_limit=512M
post_max_size=100G
upload_max_filesize=100G
max_execution_time=3600
max_input_time=3600
date.timezone=Asia/Taipei

[opcache]
opcache.memory_consumption=256
opcache.interned_strings_buffer=32
```

建立 `php-fpm/nextcloud.conf`：

```ini
[www]
user = www-data
group = www-data

listen = /var/run/nextcloud-php-fpm.sock
listen.owner = www-data
listen.group = nginx
listen.mode = 0660

pm = dynamic
pm.max_children = 8
pm.start_servers = 2
pm.min_spare_servers = 2
pm.max_spare_servers = 4
pm.max_requests = 500

php_admin_value[session.save_path] = "/var/www/nextcloud-sessions-tmp"
env[PATH] = $PATH
```

`memory_limit` 是每個 PHP 工作的上限，OPcache 則為共享記憶體，不能只看單一數值估算整個站台用量。`pm.max_children` 要依實際 PHP 程序占用、MariaDB 與預覽工作預留空間。

image 設定 `opcache.validate_timestamps=0`，所以改動 PHP 程式或更新 app 後要重啟 Nextcloud，讓網頁端載入新程式。修改 PHP／PHP-FPM 配置後也要重啟。

建立 `fail2ban/nextcloud.local`：

```ini
[nextcloud]
enabled = false
```

### 首次安裝的 config.php

建立 `config/config.php`，先指定 app 安裝路徑。安裝精靈會在這個檔案補上資料庫、實例識別碼與其他設定：

```php
<?php
$CONFIG = [
  'apps_paths' => [
    [
      'path' => '/var/www/html/apps',
      'url' => '/apps',
      'writable' => false,
    ],
    [
      'path' => '/var/www/html/custom_apps',
      'url' => '/custom_apps',
      'writable' => true,
    ],
  ],
  'default_language' => 'zh_TW',
];
```

安裝前執行以下命令，補上 `CAN_INSTALL` 並配置權限。**這段只用於首次建立的空白站台。** image 中的 `www-data` 為 UID／GID 33：

```bash
docker compose config --quiet

docker compose run --rm --no-deps --entrypoint sh nextcloud -c '
  touch /var/www/html/config/CAN_INSTALL
  chown -R 33:33 /var/www/html/config /var/www/html/nextclouddata /var/www/html/custom_apps
  chmod 0750 /var/www/html/config /var/www/html/nextclouddata /var/www/html/custom_apps
  chmod 0640 /var/www/html/config/config.php
  nginx -t
  php-fpm -t
'

docker compose up -d
docker compose ps
```

掛載整個 `config` 目錄會遮住 image 原本的 `CAN_INSTALL`。缺少此檔案時，首次安裝會出現 `Configuration was not read or initialized correctly`。安裝成功後 Nextcloud 會自行移除此標記，之後重建容器不要再建立它。

`config` 必須可由 `www-data` 寫入；Nextcloud 安裝、`occ` 與部分管理設定都會更新它，不要把整個設定目錄掛成唯讀。Linux 若使用 NFS 或 SELinux，也要依該儲存方式調整權限。

## 網頁安裝流程

在宿主機瀏覽器開啟 `http://127.0.0.1:8080`。若使用遠端 Linux 主機，可先建立 SSH tunnel：

```bash
ssh -L 8080:127.0.0.1:8080 your-user@your-server
```

表單填入：

| 欄位 | 填寫內容 |
| --- | --- |
| 管理員帳號／密碼 | 自行建立，例如帳號 `ncadmin` |
| 資料儲存位置 | `/var/www/html/nextclouddata`，對應宿主機的 `./data` |
| 資料庫類型 | MySQL/MariaDB |
| 資料庫使用者 | `nextcloud` |
| 資料庫密碼 | `.env` 中的 `MARIADB_PASSWORD`，不是 root 密碼 |
| 資料庫名稱 | `nextcloud` |
| 資料庫主機 | `db:3306` |

`db` 是 Compose 服務名稱；在 Nextcloud 容器裡填 `localhost` 會連到自己，並不是 MariaDB 容器。

![Nextcloud 安裝：指定 MariaDB 與持久化資料路徑](/img/blogs/4e1d9a72/installation.jpg)

點擊「安裝」後等候完成，不要重複提交。接著會顯示推薦的 app，可以先跳過，再依需求安裝。Office、Talk 等功能還有各自的後端需求，不必在初次部署時全部啟用。

![初次安裝後的推薦應用程式](/img/blogs/4e1d9a72/recommended-apps.jpg)

## 配置 Redis、Cron 與 config.php

### 用 occ 配置 Redis

以下命令在 `/srv/nextcloud` 執行。**先寫入 Redis 連線資料，再啟用 Redis 快取與鎖**，避免配置到一半時 Nextcloud 嘗試用錯誤的位址或空白密碼連線：

```bash
# 適用於前面產生的十六進位密碼 .env
set -a
. ./.env
set +a

docker compose exec --user www-data nextcloud php occ config:system:set redis host --value redis
docker compose exec --user www-data nextcloud php occ config:system:set redis port --type integer --value 6379
docker compose exec --user www-data nextcloud php occ config:system:set redis password --value "$REDIS_PASSWORD" --quiet

docker compose exec --user www-data nextcloud php occ config:system:set memcache.local --value '\OC\Memcache\APCu'
docker compose exec --user www-data nextcloud php occ config:system:set memcache.distributed --value '\OC\Memcache\Redis'
docker compose exec --user www-data nextcloud php occ config:system:set memcache.locking --value '\OC\Memcache\Redis'

docker compose exec --user www-data nextcloud php occ config:system:set default_phone_region --value TW
docker compose exec --user www-data nextcloud php occ config:system:set maintenance_window_start --type integer --value 18
docker compose exec --user www-data nextcloud php occ config:system:set overwrite.cli.url --value http://127.0.0.1:8080
docker compose exec --user www-data nextcloud php occ background:cron
docker compose restart nextcloud
```

`maintenance_window_start=18` 使用 UTC，對應臺灣時間隔日 02:00～06:00，讓部分非即時背景作業安排在這段時間。一般 Cron 仍每五分鐘執行；這個欄位不會取代排程。參考 [官方背景作業說明](https://docs.nextcloud.com/server/32/admin_manual/configuration_server/background_jobs_configuration.html)。

image 已有兩條每五分鐘的排程，無須在宿主機再排一份：

```cron
*/5 * * * * php --define apc.enable_cli=1 -f /var/www/html/cron.php
*/5 * * * * php /var/www/html/occ preview:pre-generate -v
```

若尚未安裝 Preview Generator，第二條會回報找不到命令；可安裝該 app，或自訂掛載 `www-data` 的 crontab 只保留第一條。修改部署前先確認自己要使用哪一種預覽方式。

用管理員選單進入「管理設定 → 基本設定」，確認背景作業為「Cron（建議）」，而且最近有執行紀錄：

![確認 Cron 模式與最近執行時間](/img/blogs/4e1d9a72/background-jobs.jpg)

也可以手動驗證：

```bash
docker compose exec --user www-data nextcloud php -d apc.enable_cli=1 -f cron.php
docker compose exec --user www-data nextcloud php occ status
docker compose exec redis redis-cli ping
```

Redis 應回覆 `PONG`；`REDISCLI_AUTH` 已由 Compose 設定。這只能證明 Redis 可連線，若要確認 Nextcloud 有使用它，可在操作檔案後查看 `redis-cli info stats` 的連線、命令與命中數。

### config.php 的重要欄位

容器內的 `/var/www/html/config/config.php` 對應宿主機 `./config/config.php`。下列是安裝後可合併到原本 `$CONFIG` 陣列的項目，**不要用這段覆蓋整份設定**：

在 Linux 宿主機可用 `sudoedit config/config.php` 編輯。由於設定目錄已交給 `www-data`，一般使用者直接開檔可能會遇到權限不足。

```php
'trusted_domains' => [
  '127.0.0.1:8080',
  'cloud.example.com',
],
'overwrite.cli.url' => 'https://cloud.example.com',
'default_language' => 'zh_TW',
'default_phone_region' => 'TW',
'maintenance_window_start' => 18,

'memcache.local' => '\OC\Memcache\APCu',
'memcache.distributed' => '\OC\Memcache\Redis',
'memcache.locking' => '\OC\Memcache\Redis',
'redis' => [
  'host' => 'redis',
  'port' => 6379,
  'password' => '填入 .env 的 REDIS_PASSWORD',
],

'files.chunked_upload.max_size' => 20971520,
```

- `trusted_domains`：填使用者實際存取的網域或 IP，可包含連接埠；不包含 `https://` 或路徑。
- `overwrite.cli.url`：提供 Cron、通知等命令列工作使用的完整站台 URL。等正式 HTTPS 可用後，再改成正式網址。
- `default_language`：新使用者的預設語言；使用者仍可自行選擇，不需以 `force_language` 強制全站語言。
- `memcache.local`：使用 APCu；`memcache.distributed` 與 `memcache.locking` 使用 Redis。說明見 [官方快取配置](https://docs.nextcloud.com/server/32/admin_manual/configuration_server/caching_configuration.html)。

安裝產生的 `instanceid`、`passwordsalt`、`secret`、資料庫連線與 `datadirectory` 必須保留。不要把其他站台的設定整份複製過來，也不要在更新時重新產生這些值。SMTP、配額、分享政策與預覽尺寸則依自己的需求調整。

修改後檢查語法並重啟：

```bash
docker compose exec nextcloud php -l /var/www/html/config/config.php
docker compose restart nextcloud
docker compose exec --user www-data nextcloud php occ status
```

## 宿主機直接提供 HTTPS

以下使用 `cloud.example.com`，請全部替換成自己的網域。DNS A／AAAA 要指向可達的宿主機；若有 NAT，將 TCP 80、443 轉送到這台主機。這一段使用宿主機已安裝的 Certbot，安裝方式見 [Certbot 官方網站](https://certbot.eff.org/)。

先確認宿主機 80 沒有被其他服務占用，再取得憑證：

```bash
cd /srv/nextcloud
docker compose stop nextcloud
sudo certbot certonly --standalone -d cloud.example.com
```

這個方式由 Certbot 暫時使用 80 驗證網域，無須再加一個反向代理。若開啟 Cloudflare proxy，驗證方式及回源設定要配合調整；初次部署可先用 DNS-only 確認直連。

將 `nginx/nextcloud.conf` 改為：

```nginx
upstream php-handler {
    server unix:/var/run/nextcloud-php-fpm.sock;
}

server {
    listen 80 default_server;
    listen [::]:80;
    server_name cloud.example.com;
    return 301 https://cloud.example.com$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name cloud.example.com;
    http2 on;

    ssl_certificate /etc/letsencrypt/live/cloud.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cloud.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    include /etc/nginx/conf.d/nextcloud.inc;
    add_header Strict-Transport-Security "max-age=15768000" always;
}
```

注意 HSTS 與 `nextcloud.inc` 中的其他 `add_header` 放在同一個 server 範圍，避免因 Nginx 的 header 繼承規則遺失其他安全標頭。只有所有子網域都已使用 HTTPS 時，才考慮加入 `includeSubDomains`。

在 `compose.yaml` 的 `nextcloud` 服務，將原本 `ports` 替換為下列兩行，並在原本的 `volumes` **增加**憑證掛載；其餘掛載與設定保留：

```yaml
    ports:
      - "80:80"
      - "443:443"
    # 在既有 volumes 清單中增加：
    # - /etc/letsencrypt:/etc/letsencrypt:ro
```

掛載整個 `/etc/letsencrypt`，讓 `live/` 指向 `archive/` 的符號連結與續期結果都可讀取。不要只掛載單一憑證檔案。這時 `.env` 的 HTTP bind 變數已不再使用。

```bash
docker compose run --rm --no-deps --entrypoint nginx nextcloud -t
docker compose up -d nextcloud
docker compose exec --user www-data nextcloud php occ config:system:set trusted_domains 1 --value cloud.example.com
docker compose exec --user www-data nextcloud php occ config:system:set overwrite.cli.url --value https://cloud.example.com
```

從瀏覽器確認憑證、登入與檔案操作。若正式 HTTPS 已可從容器內解析並連線，管理總覽的自我檢查也應能執行。

Standalone 續期時同樣需要空出宿主機 80，續期完成後再啟動容器。將 hook 存成可執行檔，讓宿主機既有的 Certbot 自動續期服務使用：

```bash
sudo install -d /etc/letsencrypt/renewal-hooks/pre /etc/letsencrypt/renewal-hooks/post

sudo tee /etc/letsencrypt/renewal-hooks/pre/nextcloud-stop >/dev/null <<'EOF'
#!/bin/sh
docker compose -f /srv/nextcloud/compose.yaml stop nextcloud
EOF

sudo tee /etc/letsencrypt/renewal-hooks/post/nextcloud-start >/dev/null <<'EOF'
#!/bin/sh
docker compose -f /srv/nextcloud/compose.yaml up -d nextcloud
EOF

sudo chmod 0755 /etc/letsencrypt/renewal-hooks/pre/nextcloud-stop /etc/letsencrypt/renewal-hooks/post/nextcloud-start
sudo certbot renew --dry-run
```

這兩個 hook 適用於專門服務此站台的 Certbot；同一台若有其他憑證，要調整 hook 範圍。續期驗證會短暫停止 Nextcloud。若不能接受中斷，可改用 DNS challenge 或配置 webroot，參考 [Certbot 驗證與續期說明](https://eff-certbot.readthedocs.io/en/stable/using.html)。

## 需要反向代理時

若外部 Nginx 已占用 80／443，維持本篇最初的 HTTP backend，即 `127.0.0.1:8080 → 容器 80`，由外部 Nginx 終止 TLS。完整配置、`trusted_proxies`、WebDAV discovery 與 HTTPS upstream 的驗證方式，見 [Nextcloud 添加 Nginx 反向代理](/posts/efd7b7b9/)。

代理位於另一台主機時，backend 改綁定宿主機內網 IP，並只允許代理來源連線。Compose 內的資料庫與 Redis 不需增加對外連接埠。

## 大檔案、Cloudflare 與分塊上傳

image 中的 `100G` 配置只是 PHP／Nginx 這一層的設定。可否完成上傳還取決於客戶端、其他代理、帳號配額、暫存空間及檔案組裝時間；不能把它當成「所有環境都能上傳 100 GB」的保證。

### Nextcloud 32 的 max_chunk_size

較舊教學常使用 `occ config:app:set files max_chunk_size`。在 `32.0.15`，伺服器使用的系統設定為 **`files.chunked_upload.max_size`**，預設 `104857600` bytes，即 **100 MiB**；前端仍可能以 `max_chunk_size` 顯示這個數值。請依 [Nextcloud 32 大檔案上傳文件](https://docs.nextcloud.com/server/32/admin_manual/configuration_files/big_file_upload_configuration.html#adjust-chunk-size-on-nextcloud-side) 使用新設定。

例如改成 20 MiB，使用整數型別：

```bash
docker compose exec --user www-data nextcloud php occ config:system:set files.chunked_upload.max_size --type integer --value 20971520
docker compose exec --user www-data nextcloud php occ config:system:get files.chunked_upload.max_size
```

`0` 代表不分塊；需要穿過有限制的代理時，保留分塊較合適。已開啟的瀏覽器頁面要重新整理，讓前端讀取新值。官方桌面客戶端與其他 WebDAV 工具有自己的分塊行為，不能假設都遵循這個瀏覽器設定。

### Cloudflare proxy 的限制

Cloudflare Free 與 Pro 公布的最大上傳大小是 **100 MB**，這是單次 HTTP request body 的限制，而非 Nextcloud 帳號容量或整個檔案的上限。區域的 Maximum Upload Size 若設得更小，會再降低可用大小。超過限制可能回覆 `413`，見 [Cloudflare 官方說明](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-413/)。

Nextcloud 預設 100 MiB 與 Cloudflare 文件的 100 MB 數字相近，部署時不宜直接貼著上限；這裡用 20 MiB 保留餘裕。支援分塊的客戶端可以把大檔案拆成多次請求，但未分塊的 WebDAV PUT 或其他上傳方式仍可能被擋下。

此外，Cloudflare 自己的讀寫逾時仍可能造成 `524`，把來源 Nginx 調成 3600 秒並不能修改這層限制。大量傳輸或最後的組裝常常逾時時，可評估使用 DNS-only 直連 HTTPS；詳細限制見 [Cloudflare 524 文件](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/)。保留 proxy 時使用 Full (strict)，並讓來源站使用有效憑證。

### 測試與排查

先以小檔案測試上傳、下載和分享，再用超過 100 MB 的測試檔驗證分塊。本篇本機測試以 20 MiB 配置，上傳一個 120 MiB 檔案，並確認完成後的檔案大小與內容。

![測試站完成 120 MiB 分塊上傳](/img/blogs/4e1d9a72/chunk-upload.jpg)

這個測試驗證本機 Nextcloud 的分塊上傳，正式環境仍要再測自己的 Cloudflare、反向代理與同步客戶端。

| 狀況 | 優先檢查 |
| --- | --- |
| `413` | Cloudflare、外部 Nginx、容器 Nginx 的 request body 限制，以及客戶端是否分塊 |
| 組裝時 `504`／`524` | 哪一層回覆逾時、儲存 I/O、PHP 工作占用、Cloudflare 逾時 |
| 部分檔案上傳失敗 | 帳號配額、資料與暫存分割區剩餘空間、鎖與 Nextcloud 記錄 |
| 遇到 `429`／`503` | 代理的 rate limit 是否把多個同時上傳的區塊或共享 IP 誤判 |

## 推薦安裝的應用程式

我目前使用的 App、依用途挑選的安裝建議，以及兩步驟驗證設定，整理在 [Nextcloud 應用程式推薦](/posts/726d0fcd/)。

本篇使用的 image 已排程 `preview:pre-generate`，安裝 Preview Generator 後，請依 [背景預覽工作](/posts/aba6d71/#背景預覽工作) 配置，避免重複執行預覽工作。

## 日常檢查與備份

管理員選單進入「管理設定 → 概覽」，檢查 HTTPS、Cron、資料庫索引與其他警告。看到更新通知時，仍依本篇的 image 更新流程處理。

![Nextcloud 管理設定總覽](/img/blogs/4e1d9a72/admin-overview.jpg)

本機 HTTP 測試會有 HTTPS／HSTS 警告，SMTP 也要依自己的郵件服務配置。問題修正後，概覽仍可能統計先前的錯誤記錄；查看記錄的時間與內容，才能判斷是否仍有新錯誤。

`127.0.0.1:8080` 在容器內指向容器自己，也可能讓站台自我檢查失敗；測試時可增加 `nextcloud` 這個內部服務名稱到 `trusted_domains`。正式環境則確認自己的網域能從容器內解析並連回站台，不要為了消除警告把整個網段加入信任清單。

常用檢查命令：

```bash
docker compose ps
docker compose logs --tail 100 nextcloud db redis
docker compose exec --user www-data nextcloud php occ status
docker compose exec nextcloud nginx -t
docker compose exec nextcloud php-fpm -t

# Nginx／PHP-FPM 詳細記錄位於容器內，Nextcloud 記錄位於持久化 data
docker compose exec nextcloud tail -n 50 /var/log/nginx/error.log
docker compose exec nextcloud tail -n 50 /var/log/php-fpm/error.log
```

若概覽明確提示 MIME 類型遷移，可在備份後依提示執行 `docker compose exec --user www-data nextcloud php occ maintenance:repair --include-expensive`。不要把每個修復命令都當成固定排程。

### 建立一致的備份

本 image 的 Web 與 Cron 在同一個容器。先停止 `nextcloud`，讓檔案與資料庫在備份期間沒有 Nextcloud 工作繼續寫入，MariaDB／Redis 保持運作。若你另外設了排程或寫入來源，也要一起停止。

```bash
cd /srv/nextcloud
sudo install -d -m 0700 -o "$(id -u)" -g "$(id -g)" /srv/nextcloud-backups
umask 077
backup_dir="/srv/nextcloud-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"

docker compose exec --user www-data nextcloud php occ status > "$backup_dir/status.txt"
docker compose exec --user www-data nextcloud php occ app:list > "$backup_dir/apps.txt"
docker compose images > "$backup_dir/images.txt"
docker image inspect "$(docker compose images -q nextcloud)" --format '{{json .RepoDigests}}' > "$backup_dir/image-digests.txt"
docker compose stop nextcloud

if ! docker compose exec -T db sh -c 'MYSQL_PWD="$MARIADB_PASSWORD" exec mariadb-dump -u nextcloud --single-transaction --default-character-set=utf8mb4 nextcloud' > "$backup_dir/nextcloud.sql"; then
  echo "資料庫備份失敗，請先排除問題" >&2
  exit 1
fi
test -s "$backup_dir/nextcloud.sql" || exit 1

sudo tar -czpf "$backup_dir/nextcloud-files.tar.gz" \
  compose.yaml .env config data custom_apps nginx php php-fpm fail2ban
sudo tar -tzf "$backup_dir/nextcloud-files.tar.gz" >/dev/null

# 單純備份時完成後啟動；若接著升級，保持停止，繼續下一節
docker compose up -d nextcloud
```

先停止 Nextcloud 再 dump，可以讓 SQL 與同時保存的檔案保持一致。不要只在 MariaDB 運作中複製 `mariadb/` 目錄當作資料庫備份。正式備份另存到其他儲存設備，並實際驗證還原，參考 [Nextcloud 備份文件](https://docs.nextcloud.com/server/32/admin_manual/maintenance/backup.html)。

## 更新 Nextcloud

### 更新前確認

1. 確認 GHCR 已提供目標 image tag，查看目標版本需求與 app 相容性。
2. 依前一節備份 SQL、設定與使用者資料，並保存原本 image 的 tag／digest。
3. 跨主要版本時，先更新到目前主要版本的最新修補版，再升下一個主要版本。不能從 30 直接跳到 32。
4. 依官方要求先停用不相容或需要停用的第三方 app，並記下原本啟用的清單。
5. 本篇掛載了 PHP、PHP-FPM 與 Nginx 配置；對照目標 image 的 repository，尤其是 `nextcloud.inc`，更新需要跟隨新版的規則。

主要版本逐版升級、背景遷移與不可降級的限制，見 [官方升級說明](https://docs.nextcloud.com/server/32/admin_manual/maintenance/upgrade.html)。MariaDB 的版本升級要另外規劃，不與 Nextcloud 的 image 更新混在同一次操作。

### 換 image 並執行 nextcloud-upgrade

在 `compose.yaml` 將 `nextcloud.image` 的 `32.0.15` 改成**已發布、符合升級路徑的目標 tag**。不要使用沒有查證存在的版本，也不要直接改成 `latest`。

完成備份後保持 Nextcloud 停止，再執行：

```bash
cd /srv/nextcloud
docker compose stop nextcloud
docker compose pull nextcloud

# 使用新 image 執行一次性維護容器，Web 與原本的 Cron 都還沒啟動
# 腳本需要 root，再自行以 www-data 執行 occ
docker compose run --rm --no-deps --entrypoint nextcloud-upgrade nextcloud

# 確認上一個命令成功後，才啟動新的 Web 容器
docker compose up -d --no-deps --force-recreate nextcloud
docker compose exec --user www-data nextcloud php occ status
docker compose exec --user www-data nextcloud php occ app:list
```

如果資料庫或 Redis 已停止，要先啟動並確認健康狀態，因為 `--no-deps` 不會代為啟動它們。`docker compose restart` 只會重啟既有容器，不會替換成剛下載的新 image。

`nextcloud-upgrade` 會依序執行：

```text
occ status
occ upgrade
occ db:add-missing-columns
occ db:add-missing-indices
occ db:add-missing-primary-keys
cron.php × 3
occ status / status -e
occ app:list
```

腳本會在命令失敗時中止。發生失敗時先保留停止狀態、閱讀輸出與記錄，不要忽略錯誤就啟動服務或任意關閉維護模式。若之前手動開啟了維護模式，先確認原因已處理，再安排相應的解除步驟。

這個 image 已移除內建 updater，因此更新採用「換 image + `nextcloud-upgrade`」。只執行 `docker compose pull` 不會遷移資料庫，單獨執行 `occ upgrade` 也不會下載新版程式。

### 更新後檢查與還原

確認 `occ status` 的版本正確、`maintenance: false`、`needsDbUpgrade: false`，再登入檢查概覽、上傳／下載、分享、WebDAV 與各 app。逐一重新啟用支援目標版本的第三方 app，依需要更新 app 後重啟 Nextcloud，讓 OPcache 重新載入。

若要回復舊版本，不能只把 image tag 改回去。Nextcloud 不支援降級；必須使用**同一次備份**的 SQL、`config`、`data`、`custom_apps` 與原 image，在新的／空白 MariaDB 資料目錄還原後再啟動。既有的新資料目錄先保留供排查，不把舊版程式直接連到已升級的資料庫。還原流程見 [官方還原文件](https://docs.nextcloud.com/server/32/admin_manual/maintenance/restore.html)。

## 相關文件

- [nextcloud-custom repository](https://github.com/hmes98318/nextcloud-custom)
- [Nextcloud 32 config.php 完整參數](https://docs.nextcloud.com/server/32/admin_manual/configuration_server/config_sample_php_parameters.html)
- [Nextcloud 32 Nginx 配置](https://docs.nextcloud.com/server/32/admin_manual/installation/nginx.html)
- [Nextcloud occ 指令](https://docs.nextcloud.com/server/32/admin_manual/occ_command.html)
- [Nextcloud Redis 與快取](https://docs.nextcloud.com/server/32/admin_manual/configuration_server/caching_configuration.html)
- [Nextcloud 設定 Nginx 反向代理](/posts/efd7b7b9/)
- [Nextcloud 內網登入時 IP 被鎖](/posts/c25d04b3/)
- [Nextcloud 安裝預覽生成器](/posts/aba6d71/)
- [Nextcloud 提高檔案上傳大小上限](/posts/99b26485/)
