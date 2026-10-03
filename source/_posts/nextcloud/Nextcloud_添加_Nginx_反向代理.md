---
title: Nextcloud 設定 Nginx 反向代理
tags:
  - Nextcloud
  - Nginx
categories: Nextcloud
keywords: 'Nextcloud Nginx 反向代理,Nextcloud HTTPS,Certbot,trusted_domains,trusted_proxies,WebDAV'
description: 讓 Nginx 接收 HTTPS 連線，再轉送到內網 Nextcloud 的 HTTP 服務。這裡放上完整配置，逐項說明憑證、轉送標頭與上傳設定，並補上可信任網域和代理 IP 的設定。
cover: /img/background/nextcloud.png
abbrlink: efd7b7b9
comments: true
date: 2023-08-28 11:45:02
updated: 2026-10-04 03:17:10
---

Nextcloud 放在內網時，可以讓前面的一台 Nginx 負責網域和 HTTPS，再把請求轉送到 Nextcloud。對外只開放 Nginx 的 80、443 連接埠，Nextcloud 繼續使用原本的內網位址。

Nextcloud 裝在實體主機、虛擬機或容器裡，後端使用 Apache 或 Nginx，都可以用這個方式連接。先確認它在內網能正常使用，並且反向代理主機連得到後端的 HTTP 服務。

## 連線架構

本文的網路環境範例如下。

範例中，Nginx 對外提供 HTTPS，再透過內網 HTTP 連到 Nextcloud：

```text
使用者 ── HTTPS ── Nginx 反向代理 ── HTTP ── 內網 Nextcloud
                  cloud.example.com        10.20.10.104:80
                  10.20.10.10
```

| 項目 | 範例 |
| --- | --- |
| 對外網域 | `cloud.example.com` |
| Nginx 反向代理的內網 IP | `10.20.10.10` |
| Nextcloud 的 HTTP 服務 | `http://10.20.10.104:80` |
| 使用者存取的網址 | `https://cloud.example.com` |

Nginx 與 Nextcloud 在同一台主機時，後端位址也可以使用 `127.0.0.1` 和實際的服務連接埠。

## 完整 Nginx 反向代理配置

以下是 `/etc/nginx/conf.d/nextcloud.conf` 的完整內容，使用 **Nginx 1.30.5**。將 `cloud.example.com`、憑證路徑與 `10.20.10.104:80` 換成自己的設定。第一次設定時，先依下方「使用 Certbot 申請憑證」一節取得憑證，再套用這份配置。

```conf
# 1. HTTP 轉 HTTPS
server {
    listen      80;
    listen      [::]:80;
    server_name cloud.example.com;

    location / {
        return 301 https://cloud.example.com$request_uri;
    }
}

server {
    # 2. HTTPS 入口
    listen      443 ssl;
    listen      [::]:443 ssl;
    server_name cloud.example.com;
    http2       on;

    # 3. TLS 憑證
    ssl_certificate     /etc/letsencrypt/live/cloud.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cloud.example.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # 4. HSTS
    add_header        Strict-Transport-Security "max-age=15768000" always;
    proxy_hide_header Strict-Transport-Security;

    # 5. 上傳大小與用戶端逾時
    client_max_body_size    100G;
    client_body_buffer_size 20m;
    client_body_timeout     3600s;
    send_timeout            3600s;

    # 6. WebDAV 服務探索
    location = /.well-known/carddav {
        return 301 https://cloud.example.com/remote.php/dav/;
    }

    location = /.well-known/caldav {
        return 301 https://cloud.example.com/remote.php/dav/;
    }

    # 7. 轉送到 Nextcloud HTTP 後端
    location / {
        proxy_pass         http://10.20.10.104:80;
        proxy_http_version 1.1;
        proxy_redirect     off;

        # 8. 轉送標頭
        proxy_headers_hash_max_size    512;
        proxy_headers_hash_bucket_size 64;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;
        proxy_set_header Accept-Encoding   $http_accept_encoding;

        # 9. 上傳與下載緩衝
        proxy_request_buffering  off;
        proxy_buffering          off;
        proxy_buffer_size        128k;
        proxy_buffers            4 256k;
        proxy_busy_buffers_size  256k;
        proxy_max_temp_file_size 0;

        # 10. 後端連線與傳輸逾時
        proxy_connect_timeout 60s;
        proxy_send_timeout    3600s;
        proxy_read_timeout    3600s;
    }
}
```

## 配置說明

以下依配置中的註解順序說明。

### 1. HTTP 轉 HTTPS

第一個 `server` 接收 HTTP 連線：

- `listen 80` 和 `listen [::]:80` 分別監聽 IPv4、IPv6 的 80 連接埠。
- `server_name` 填使用者存取的網域。
- `return 301` 將請求轉到固定的 HTTPS 網域，`$request_uri` 保留原本的路徑和查詢參數。

HTTP 入口用來轉址；使用者實際存取 Nextcloud 時，會連到下方的 HTTPS 入口。

### 2. HTTPS 入口

第二個 `server` 的 `listen 443 ssl` 和 `listen [::]:443 ssl` 接收 IPv4、IPv6 的 HTTPS 連線，`server_name` 使用同一個網域。

`http2 on` 啟用使用者到 Nginx 的 HTTP/2。Nginx 到 Nextcloud 則使用稍後的 `proxy_http_version 1.1`，兩段連線可以使用不同協定版本。語法見 [Nginx HTTP/2 文件](https://nginx.org/en/docs/http/ngx_http_v2_module.html#http2)。

### 3. TLS 憑證

| 指令 | 用途 |
| --- | --- |
| `ssl_certificate` | 站台憑證與中繼憑證鏈，使用 Certbot 的 `fullchain.pem` |
| `ssl_certificate_key` | 對應憑證的私密金鑰，使用 `privkey.pem` |
| `include` | 載入 Certbot Nginx 外掛提供的 `options-ssl-nginx.conf` |
| `ssl_dhparam` | 使用 Certbot Nginx 外掛提供的 DH 參數檔 |

範例的憑證名稱是 `cloud.example.com`，對應 `/etc/letsencrypt/live/cloud.example.com/`。請沿用 Certbot 實際產生的路徑；申請步驟放在下方。

### 4. HSTS

`Strict-Transport-Security` 讓瀏覽器在有效期間使用 HTTPS，請在 HTTPS 已正常運作後套用。`always` 讓這個標頭也能加入錯誤回應，參考 [Nginx 回應標頭文件](https://nginx.org/en/docs/http/ngx_http_headers_module.html#add_header)。

`proxy_hide_header Strict-Transport-Security` 隱藏後端送來的同名標頭，由入口 Nginx 統一提供 HSTS，避免重複。若 `cloud.example.com` 的下層子網域也全部使用 HTTPS，才在標頭值加上 `includeSubDomains`。

### 5. 上傳大小與用戶端逾時

| 指令 | 範例值 | 用途 |
| --- | --- | --- |
| `client_max_body_size` | `100G` | 入口允許的單次請求大小 |
| `client_body_buffer_size` | `20m` | 接收請求內容時使用的記憶體緩衝區 |
| `client_body_timeout` | `3600s` | 讀取用戶端上傳內容時，相鄰讀取操作的等待時間 |
| `send_timeout` | `3600s` | 回傳資料給用戶端時，相鄰寫入操作的等待時間 |

`20m` 是緩衝區大小，並不是 20 MB 的上傳上限。多人同時上傳時，也要考慮記憶體用量。

`100G` 只調整這台 Nginx 的限制，後端網頁伺服器、PHP、儲存配額與其他代理仍有自己的限制。逾時設定也不是整個檔案傳輸的總時間。

上傳塊大小、PHP 與後端網頁伺服器的調整，請看 [Nextcloud 提高檔案上傳大小上限](/posts/99b26485/)。

### 6. WebDAV 服務探索

`/.well-known/carddav` 和 `/.well-known/caldav` 由入口 Nginx 轉到 `/remote.php/dav/`，供通訊錄和行事曆客戶端探索服務。

兩個 `location =` 只比對指定路徑，其餘請求交給後面的 `location /`。這份配置使用網域根目錄；若 Nextcloud 安裝在 `/nextcloud/`，依下方的子目錄說明調整 DAV 轉址。

### 7. 轉送到 Nextcloud HTTP 後端

| 指令 | 用途 |
| --- | --- |
| `proxy_pass` | 將請求送到內網 Nextcloud 的 HTTP 位址與連接埠 |
| `proxy_http_version 1.1` | 使用 HTTP/1.1 與後端連線，配合後面的上傳串流設定 |
| `proxy_redirect off` | 關閉 Nginx 對後端回應中 `Location` 和 `Refresh` 標頭的改寫 |

`proxy_pass http://10.20.10.104:80` 沒有附加路徑，保留原始請求 URI，讓網頁、分享連結與 WebDAV 都交給 Nextcloud 處理。Nextcloud 產生連結時使用的網域與協定，會在下方的 `config.php` 設定。

後端 HTTP 站台要接受 `cloud.example.com` 這個 Host，並直接提供 Nextcloud 服務。後端也要保留 Nextcloud 所需的網頁伺服器規則。

### 8. 轉送標頭

`proxy_headers_hash_max_size` 和 `proxy_headers_hash_bucket_size` 設定代理標頭雜湊表的容量與 bucket 大小，範例分別使用 `512`、`64`。

| 標頭 | 傳送值 | 用途 |
| --- | --- | --- |
| `Host` | `$host` | 保留使用者存取的站台名稱 |
| `X-Real-IP` | `$remote_addr` | 傳送 Nginx 看到的來源 IP |
| `X-Forwarded-For` | `$remote_addr` | 提供 Nextcloud 判斷用戶端來源的 IP |
| `X-Forwarded-Proto` | `$scheme` | 告知後端使用者使用的協定，本例為 HTTPS |
| `X-Forwarded-Host` | `$host` | 告知後端原始的存取網域 |
| `Accept-Encoding` | `$http_accept_encoding` | 保留用戶端支援的壓縮格式 |

範例由 Nginx 直接接收使用者連線，因此 `X-Forwarded-For` 使用 `$remote_addr` 覆寫。Nextcloud 必須搭配下方的 `trusted_proxies` 才會信任代理提供的來源資訊。

若 Nginx 前面還有 CDN 或另一層代理，要先在入口依可信來源還原 IP，再往後轉送；設定可參考 [Nginx realip 模組](https://nginx.org/en/docs/http/ngx_http_realip_module.html)。

### 9. 上傳與下載緩衝

| 指令 | 範例值 | 用途 |
| --- | --- | --- |
| `proxy_request_buffering` | `off` | 持續往後端轉送上傳內容，不先等待完整請求存入代理暫存檔 |
| `proxy_buffering` | `off` | 收到後端回應就往用戶端傳送 |
| `proxy_buffer_size` | `128k` | 讀取後端回應第一部分時使用的緩衝區，通常包含回應標頭 |
| `proxy_buffers` | `4 256k` | 回應緩衝啟用時，每個連線使用的緩衝區數量與大小 |
| `proxy_busy_buffers_size` | `256k` | 回應緩衝啟用時，正在向用戶端傳送資料的緩衝區上限 |
| `proxy_max_temp_file_size` | `0` | 禁止將代理回應寫入暫存檔 |

本例關閉回應緩衝，`proxy_buffers` 與 `proxy_busy_buffers_size` 主要在日後啟用緩衝時才會使用。`proxy_max_temp_file_size 0` 控制的是回應暫存檔，與允許上傳的檔案大小不同。

### 10. 後端連線與傳輸逾時

| 指令 | 範例值 | 用途 |
| --- | --- | --- |
| `proxy_connect_timeout` | `60s` | 建立後端連線的等待時間 |
| `proxy_send_timeout` | `3600s` | 往後端傳送請求時，相鄰寫入操作的等待時間 |
| `proxy_read_timeout` | `3600s` | 讀取後端回應時，相鄰讀取操作的等待時間 |

若連不上後端，先檢查網路、HTTP 服務與連接埠；傳輸中發生逾時，再看是代理、後端 PHP 還是儲存空間出了問題。

代理本身使用 `proxy_pass` 轉送 HTTP 請求，PHP 與 FastCGI 的設定放在執行 Nextcloud 的後端。各指令的作用見 [Nginx proxy 模組](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) 與 [HTTP core 模組](https://nginx.org/en/docs/http/ngx_http_core_module.html)。

## 使用 Certbot 申請憑證

下面的 Nginx 設定與指令都在**反向代理主機**操作。先安裝 Nginx、Certbot 與 Certbot 的 Nginx 外掛，安裝方式可參考 [Nginx 官方套件說明](https://nginx.org/en/linux_packages.html) 和 [Certbot 安裝指引](https://certbot.eff.org/instructions)。

將網域的 DNS 指向 Nginx 對外的 IP。若主機位於路由器後面，將 TCP 80、443 轉送到 Nginx；有 AAAA 記錄時，IPv6 也要能連到這台主機。

先建立 `/etc/nginx/conf.d/nextcloud.conf`，只放 HTTP 配置：

```conf
server {
    listen 80;
    listen [::]:80;
    server_name cloud.example.com;

    location / {
        return 200 "Nextcloud reverse proxy\n";
    }
}
```

這個檔案由 Nginx 的 `http {}` 載入。若使用 `sites-available`／`sites-enabled`，就放在該系統慣用的位置並啟用站台；整份配置只載入一次。

檢查並載入設定後，申請憑證：

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx --redirect --cert-name cloud.example.com -d cloud.example.com
```

Certbot 會驗證網域、儲存憑證，並在站台中加入 HTTPS 設定。完成後，用本文開頭的完整配置取代**同一份站台配置**。

這個申請方式使用 HTTP-01，Let's Encrypt 必須能從外網連到 TCP 80。若 Nginx 也只開放內網，可改用 Certbot 的 [DNS 外掛](https://eff-certbot.readthedocs.io/en/stable/using.html#dns-plugins) 進行 DNS-01 驗證，取得憑證後一樣能提供內網 HTTPS。

憑證路徑由 `--cert-name cloud.example.com` 決定。如果透過 DNS 外掛申請、尚未由 Nginx 外掛配置 HTTPS，可先執行 `sudo certbot install --nginx --cert-name cloud.example.com`，再套用完整配置。確認 `options-ssl-nginx.conf` 和 `ssl-dhparams.pem` 存在，並沿用 Certbot 提供的路徑。

## Nextcloud 的 config.php

接著在 **Nextcloud 主機或其執行環境**修改安裝目錄下的 `config/config.php`，例如 `/var/www/nextcloud/config/config.php`。實際位置依安裝方式而定。

將以下項目合併進原本的 `$CONFIG` 陣列。資料庫、資料目錄、識別碼與其他既有設定都保留；同名項目已存在時，修改原項目：

```php
'trusted_domains' => [
    'cloud.example.com',
],
'trusted_proxies' => [
    '10.20.10.10',
],
'forwarded_for_headers' => [
    'HTTP_X_FORWARDED_FOR',
],
'overwritehost' => 'cloud.example.com',
'overwriteprotocol' => 'https',
'overwrite.cli.url' => 'https://cloud.example.com',
```

`trusted_domains` 填使用者存取的網域或 IP，格式不含 `https://` 和路徑。將正式網域加入既有清單，需要使用的內網名稱也可以保留。這與允許哪些代理轉送來源資訊的 `trusted_proxies` 是兩回事，參考 [Nextcloud trusted_domains 說明](https://docs.nextcloud.com/server/stable/admin_manual/configuration_server/config_sample_php_parameters.html#trusted-domains)。

`trusted_proxies` 填 **Nextcloud 實際收到連線時的代理來源 IP**。在這個範例裡，Nginx 與 Nextcloud 直接透過內網連線，所以填 `10.20.10.10`。如果中間有 NAT、容器網路，或代理就在同一台主機，來源可能變成閘道位址或 `127.0.0.1`，請以後端連線記錄與 PHP 收到的 `REMOTE_ADDR` 為準。

只信任真正會連入的代理位址，需要使用 CIDR 時也應限縮範圍。讓 PHP 保留代理來源，再由 Nextcloud 核對 `trusted_proxies`、讀取 `X-Forwarded-For`；若後端另有 real IP 設定，也要一起檢查這段信任關係。

這裡固定使用 `cloud.example.com` 作為站台名稱。`overwritehost` 和 `overwriteprotocol` 讓產生的連結使用公開網域與 HTTPS，`overwrite.cli.url` 則提供 Cron、通知等命令列工作使用的完整網址。

如果同時保留直接連到後端的 HTTP 入口，並希望只有經過這台代理時才覆寫網域與協定，可以增加：

```php
'overwritecondaddr' => '^10\\.20\\.10\\.10$',
```

這是比對代理來源 IP 的正規表示式，請與 `trusted_proxies` 一樣改成實際位址。完整參數與範例見 [Nextcloud 官方反向代理文件](https://docs.nextcloud.com/server/stable/admin_manual/configuration_server/reverse_proxy_configuration.html)。

儲存後，在執行 Nextcloud 的環境中檢查 PHP 語法。以下路徑請換成自己的安裝目錄：

```bash
php -l /var/www/nextcloud/config/config.php
```

### Nextcloud 安裝在子目錄時

如果內網與對外都使用 `/nextcloud/`，例如 `https://cloud.example.com/nextcloud/`，`proxy_pass` 保留為 `http://10.20.10.104:80`，保留請求的 `/nextcloud/` 路徑原樣送到後端。

將兩個 DAV discovery 轉址改成：

```conf
location = /.well-known/carddav {
    return 301 https://cloud.example.com/nextcloud/remote.php/dav/;
}

location = /.well-known/caldav {
    return 301 https://cloud.example.com/nextcloud/remote.php/dav/;
}
```

再於 `config.php` 指定 Nextcloud 的路徑與完整網址：

```php
'overwritewebroot' => '/nextcloud',
'overwrite.cli.url' => 'https://cloud.example.com/nextcloud',
```

## 載入設定與檢查

回到反向代理主機，檢查並重新載入 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx

curl -fsS https://cloud.example.com/status.php
curl -I https://cloud.example.com/.well-known/carddav
curl -I https://cloud.example.com/.well-known/caldav
```

`status.php` 應回傳 Nextcloud 的 JSON 狀態。兩個 DAV discovery 路徑應回覆 `301`，`Location` 指向自己的 `/remote.php/dav/`；子目錄部署則要包含 `/nextcloud/`。

接著用瀏覽器登入，測試分享連結、上傳與下載，再用桌面或手機客戶端測試 WebDAV 同步。從不同用戶端送出請求，確認 Nextcloud 記錄的來源 IP 與實際連線相符。

常見問題可以先從這幾個地方查：

| 現象 | 檢查位置 |
| --- | --- |
| 顯示不受信任的網域 | `trusted_domains` 是否包含存取網域、後端收到的 Host 是否正確 |
| 網址變成內網 IP，或一直重新導向 | `overwritehost`、`overwriteprotocol`，以及後端是否再次轉址 |
| `502 Bad Gateway` | Nginx 到後端的網路連線、連接埠，以及後端 HTTP 服務是否正常 |
| `413 Request Entity Too Large` | 產生錯誤的那一層之 `client_max_body_size` 或其他上傳限制 |
| `504 Gateway Timeout` | 代理與後端的逾時設定、PHP 處理狀況、儲存速度與暫存空間 |
| Nextcloud 記錄的 IP 都是代理 IP | 實際代理來源、`trusted_proxies`、`X-Forwarded-For` 與後端的 real IP 設定 |

最後測試憑證續期：

```bash
sudo certbot renew --cert-name cloud.example.com --dry-run
```

確認安裝方式已配置定期執行 `certbot renew`。使用 Nginx installer 時，續期後會重新載入 Nginx；其他驗證方式則要在憑證成功更新後安排 reload。續期與排程的說明見 [Certbot 官方文件](https://eff-certbot.readthedocs.io/en/stable/using.html#automated-renewals)。

## 相關文章

- [Nextcloud 提高檔案上傳大小上限](/posts/99b26485/)
- [Nextcloud 內網登入時 IP 被鎖](/posts/c25d04b3/)
