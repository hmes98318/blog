---
title: Nextcloud 添加 Nginx 反向代理
tags:
  - Nextcloud
categories: Nextcloud
keywords: 'Nextcloud,Nextcloud Nginx,Nextcloud 反向代理,Nextcloud Nginx 反向代理'
description: 為 Nextcloud 配置 Nginx HTTPS 反向代理，包含大檔案上傳、WebDAV discovery、trusted_proxies、來源 IP 與 Cloudflare 配置。
cover: /img/background/nextcloud.png
abbrlink: efd7b7b9
comments: true
date: 2023-08-28 11:45:02
updated: 2026-10-03 22:00:00
---

這篇配合 [打造自己的雲端硬碟：Nextcloud 部署教學](/posts/4e1d9a72/) 更新。`nextcloud-custom` image 已內建提供網頁的 Nginx；若宿主機可直接對外服務，可直接在容器配置 HTTPS。已有統一入口、或 Nextcloud 位於另一台內網主機時，再使用本篇的外部 Nginx。

以下參考我原本的部署配置，使用 `cloud.example.com` 示範。請替換成自己的網域、憑證路徑與 backend 位址。

## 連線架構

```text
使用者 ── HTTPS ── 外部 Nginx ── HTTP ── Nextcloud 容器 Nginx／PHP-FPM
                  cloud.example.com     127.0.0.1:8080
```

本篇主要範例是外部 Nginx 安裝在 Docker 宿主機，Nextcloud 使用部署教學的 HTTP 配置：

```yaml
    ports:
      - "127.0.0.1:8080:80"
```

如果 backend 還在使用 image 預設的「HTTP 轉 HTTPS」配置，要先依部署教學改成 HTTP virtual host，否則 TLS 終止在代理、backend 卻再次轉址，可能形成重新導向循環。

代理在另一台主機時，將 backend 綁定宿主機的內網 IP，例如 `10.20.10.104:8080:80`，只允許代理主機連線，並將下方的 `proxy_pass` 改成 `http://10.20.10.104:8080`。若中間經過不受信任的網路，改用下文的 HTTPS upstream。

## Nginx HTTPS 反向代理配置

這裡使用支援 `http2 on` 的 Nginx 1.25.1 以上。設定放在 Nginx `http {}` 所包含的 virtual host 檔案，例如 `/etc/nginx/conf.d/nextcloud.conf`；不要再把整段包一個 `http {}`。

初次尚未取得憑證時，先只載入下面的 **80 server**，建立 `/var/www/letsencrypt`，確認 DNS 和 TCP 80 可達，再使用已安裝的 Certbot：

```bash
sudo mkdir -p /var/www/letsencrypt
sudo nginx -t
sudo systemctl reload nginx
sudo certbot certonly --webroot -w /var/www/letsencrypt -d cloud.example.com
```

取得憑證後再載入完整的 443 配置：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name cloud.example.com;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        try_files $uri =404;
    }

    location / {
        return 301 https://cloud.example.com$request_uri;
    }
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

    add_header Strict-Transport-Security "max-age=15768000" always;

    client_max_body_size 100G;
    client_body_buffer_size 1m;
    client_body_timeout 3600s;
    send_timeout 3600s;

    proxy_headers_hash_max_size 512;
    proxy_headers_hash_bucket_size 64;
    proxy_hide_header Strict-Transport-Security;

    location = /.well-known/carddav {
        return 301 https://cloud.example.com/remote.php/dav/;
    }

    location = /.well-known/caldav {
        return 301 https://cloud.example.com/remote.php/dav/;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_redirect off;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header Accept-Encoding $http_accept_encoding;

        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        proxy_max_temp_file_size 0;
        proxy_request_buffering off;
        proxy_buffering off;

        proxy_connect_timeout 60s;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

`proxy_pass` 沒有附加路徑或重寫規則，讓 WebDAV 的 PUT、MOVE、PROPFIND 等請求及原始 URI 交給 Nextcloud 處理。其他 `.well-known` 請求也會交由 backend 的 `nextcloud.inc` 處理。

本例只有一個可信入口，因此覆寫 `X-Forwarded-For`，避免把使用者自行傳入的 IP 字串一起轉送。若有多層可信代理，要明確配置每一層的來源與信任關係，不能直接把任意傳入的標頭視為真實 IP。

幾個上傳相關設定：

- `proxy_request_buffering off`：上傳內容持續轉送，不先把完整 request body 存到外部 Nginx 暫存檔。
- `proxy_buffering off`：下載回應持續轉送；`proxy_max_temp_file_size 0` 禁止寫入代理回應暫存檔，不代表上傳大小為零。
- `client_max_body_size 100G`：外部 Nginx 允許的單次 request body。仍要配合 backend、客戶端、配額與其他代理限制。
- `proxy_read_timeout`、`proxy_send_timeout`、`client_body_timeout`：等待相鄰讀寫操作的時間，不是整個傳輸必定可執行一小時的保證。
- `proxy_connect_timeout 60s`：連到 backend 的時間。Nginx 文件指出連線逾時通常不能超過 75 秒，將它改成 3600 秒不會延長檔案組裝時間。

外部 Nginx 使用 HTTP proxy，因此 PHP 的 `fastcgi_*` 應放在直接連 PHP-FPM 的 backend；原配置中的 `Front-End-Https` 也不需要，Nextcloud 使用 `X-Forwarded-Proto` 與下面的系統設定判斷 HTTPS。參考 [Nginx proxy 模組文件](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)。

主配置使用 Nginx 原生 TLS 指令，沒有依賴 Certbot 額外的 `options-ssl-nginx.conf` 或 DH 參數檔。如果自己的 Certbot 已管理這些檔案，可依現有配置整合，先檢查檔案存在再 include。

HSTS 在 HTTPS 確認正常後啟用；只有其他所有子網域都使用 HTTPS 時，才加 `includeSubDomains`。`proxy_hide_header` 避免 HTTPS backend 的 HSTS 與入口重複。

## Nextcloud 的 trusted_proxies

在宿主機的 `config/config.php`，把以下項目合併進安裝後的 `$CONFIG`。既有的資料庫、識別碼、Redis 等配置保留：

```php
'trusted_domains' => [
  'cloud.example.com',
],
'trusted_proxies' => [
  '172.20.0.1', // 範例：請改成 Nextcloud 實際看到的代理來源 IP
],
'forwarded_for_headers' => [
  'HTTP_X_FORWARDED_FOR',
],
'overwritehost' => 'cloud.example.com',
'overwriteprotocol' => 'https',
'overwrite.cli.url' => 'https://cloud.example.com',
```

`trusted_domains` 是使用者存取的站台名稱，`trusted_proxies` 是 backend 接收到連線時的代理來源 IP，兩者用途不同。

**宿主機 Nginx 連到 Docker 發布的 `127.0.0.1:8080`，容器看到的來源可能是 Docker bridge gateway，而不是 `127.0.0.1`。** 先查看候選 gateway，再從代理送一個請求並對照 backend access log 的來源欄位：

```bash
docker inspect "$(docker compose ps -q nextcloud)" \
  --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}'

curl -I https://cloud.example.com/status.php
docker compose exec nextcloud tail -n 20 /var/log/nginx/access.log
```

另一台代理、Docker bridge、NAT 或代理容器都可能改變這個來源，請以實際記錄為準。只加入必要的 IP／CIDR；不要設定 `0.0.0.0/0`，也不要把整個內網都當成可信代理。日後重新建立 Docker 網路若改變位址，要一併更新配置。

配合部署教學，backend 的 `nginx/real-ip.conf` 保留為只有註解的檔案，覆蓋 image 預設對 `10.0.0.0/8` 的信任。讓 PHP 的 `REMOTE_ADDR` 保留代理來源，再由 Nextcloud 核對 `trusted_proxies`；若 backend Nginx 先把它改成客戶端 IP，可能讓 Nextcloud 無法按預期辨識可信代理。

修改後執行：

```bash
docker compose exec nextcloud php -l /var/www/html/config/config.php
docker compose restart nextcloud
sudo nginx -t
sudo systemctl reload nginx
```

完整參數與信任規則見 [Nextcloud 32 官方反向代理文件](https://docs.nextcloud.com/server/32/admin_manual/configuration_server/reverse_proxy_configuration.html)。

## backend 使用 HTTPS 時

如果要像原本配置一樣，將請求轉送到 `https://10.20.10.104`，在 `location /` 使用下面的 upstream 設定，其他 proxy 標頭、buffer 與 timeout 保留：

```nginx
proxy_pass https://10.20.10.104:443;
proxy_ssl_server_name on;
proxy_ssl_name cloud.internal.example.com;
proxy_ssl_verify on;
proxy_ssl_verify_depth 2;
proxy_ssl_trusted_certificate /etc/nginx/ca/nextcloud-ca.pem;
```

`cloud.internal.example.com` 必須是 backend 憑證包含的名稱；`nextcloud-ca.pem` 放簽發 backend 憑證的可信 CA。如果使用自簽憑證，應明確信任自己的憑證並驗證名稱。image 內附憑證的名稱是 `cloud.k8s.local`，不能拿其他名稱直接驗證，正式配置可自行簽發或換成合適的憑證。

不要只把 `http` 改成 `https` 就視為完成驗證：Nginx 的 upstream 憑證驗證預設並未開啟。設定與錯誤排查見 [Nginx upstream TLS 文件](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_ssl_verify)。

## 可選：黑名單與 rate limit

原本配置的 `$malicious_ip_blocked`、`blacklist_detailed` 與 rate limit zone，都來自其他全域配置。直接複製單一 server 區塊會因未定義變數或 zone 而失敗。以下提供可獨立定義的範例，有需求才加入。

### IP 黑名單

先建立清單：

```bash
sudo mkdir -p /etc/nginx/blocklists
sudo touch /etc/nginx/blocklists/cloud.blacklist
```

在 `http {}` 所包含的配置加入：

```nginx
geo $cloud_is_denied {
    default 0;
    include /etc/nginx/blocklists/cloud.blacklist;
}

log_format cloud_blacklist '$remote_addr [$time_local] "$request" $status';
```

`cloud.blacklist` 的格式如下，示意 IP 請換成實際要封鎖的來源：

```nginx
203.0.113.45 1;
```

在 HTTPS server 增加記錄與阻擋：

```nginx
access_log /var/log/nginx/cloud-blacklist.log cloud_blacklist if=$cloud_is_denied;

if ($cloud_is_denied = 1) {
    return 403;
}
```

此處的 `if` 只執行 `return`。如果前面還有 Cloudflare，須先正確還原來源 IP，否則可能封鎖 Cloudflare 節點而不是原始使用者。

### 連線與請求頻率限制

在 `http {}` 所包含的配置宣告 zone：

```nginx
limit_conn_zone $binary_remote_addr zone=nextcloud_conn:10m;
limit_req_zone $binary_remote_addr zone=nextcloud_req:10m rate=20r/s;
```

再於 HTTPS server 增加：

```nginx
limit_conn nextcloud_conn 100;
limit_req zone=nextcloud_req burst=100 nodelay;
limit_req_status 429;
```

這些數值只是起步範例。分塊上傳、照片縮圖、桌面同步，以及共用 NAT 的多人都會增加同一 IP 的請求數；套用後要測試同步與大檔案，不把 `429` 當成 Nextcloud 本身壞掉。

原配置的 `/sites/` 是特定 Pico CMS app 的代理需求，有使用且確認版本相容時再獨立配置。一般 Nextcloud 部署不需要把 `/sites/` 轉送回自己的公開 HTTPS 網域。

## Cloudflare 與大檔案注意事項

- Free／Pro 公布的單次 request 上限為 100 MB。外部 Nginx 設成 `100G` 仍不能提高 Cloudflare 的限制；使用支援分塊的客戶端，並保留大小餘裕。
- Nextcloud `32.0.15` 使用 `files.chunked_upload.max_size`，預設 100 MiB。20 MiB 配置、舊 `max_chunk_size` 的差異及上傳測試，見 [部署教學的大檔案章節](/posts/4e1d9a72/#大檔案、Cloudflare-與分塊上傳)。
- Cloudflare 的讀寫逾時可能回覆 `524`，來源 Nginx 的 3600 秒設定不能修改此上限；必要時評估 DNS-only 直接存取 HTTPS。
- 使用 proxy 時配置 Full (strict) 與有效來源憑證，避免 HTTP 回源造成重新導向問題。私人檔案、登入頁與 WebDAV 不適合套用整站的「Cache Everything」。

如果要讓外部 Nginx 記錄真實使用者 IP，配置 `real_ip_header CF-Connecting-IP`，但 `set_real_ip_from` **只能信任 Cloudflare 官方 IP 範圍**，再轉送已還原的 `$remote_addr`。不要信任所有來源傳入的 `CF-Connecting-IP`；PHP 端仍只信任真正連入 backend 的 Nginx 來源。清單更新時也要同步維護，參考 [Cloudflare IP 清單](https://www.cloudflare.com/ips/) 與 [Nginx realip 文件](https://nginx.org/en/docs/http/ngx_http_realip_module.html)。

上傳限制與逾時的原始說明：[Cloudflare 413](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-413/)、[Cloudflare 524](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/)。

## 驗證配置

```bash
sudo nginx -t
sudo systemctl reload nginx

curl -I https://cloud.example.com/status.php
curl -I https://cloud.example.com/.well-known/carddav
curl -I https://cloud.example.com/.well-known/caldav
```

DAV discovery 應回覆 301，`Location` 指向 `https://cloud.example.com/remote.php/dav/`。接著用瀏覽器登入，檢查管理總覽、WebDAV 同步、小檔案與超過 100 MB 的分塊上傳；最後確認 Nextcloud 記錄的是使用者 IP，且沒有重新導向循環或逾時。

若只有小檔案正常、大檔案失敗，查看回覆是外部 Nginx、backend 還是 Cloudflare 產生，再調整對應層。儲存太慢、PHP 工作者耗盡、暫存空間不足，都不能單靠拉長 timeout 解決。
