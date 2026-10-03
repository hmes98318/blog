---
title: Nextcloud 提高檔案上傳大小上限
tags:
  - Nextcloud
  - Nginx
categories: Nextcloud
keywords: 'Nextcloud 上傳大小限制,Nextcloud 大檔案上傳,Nextcloud 分塊上傳,files.chunked_upload.max_size,PHP upload_max_filesize,Nginx 504'
description: 調整 Nextcloud 大檔案上傳所需的 PHP、網頁伺服器與反向代理設定，並說明新版分塊大小、暫存空間和上傳逾時的排查方式。
cover: /img/background/nextcloud.png
abbrlink: 99b26485
comments: true
date: 2023-08-28 12:02:40
updated: 2026-10-04 03:59:25
---

Nextcloud 上傳大檔案時，可能會遇到「413 Request Entity Too Large」，或是在檔案傳輸完成後出現「Error when assembling chunks, status code 504」。
前者通常與網頁伺服器或反向代理的請求大小限制有關；後者則發生在分塊上傳完成後，Nextcloud 組裝檔案的階段。

本文整理 PHP、Nginx／Apache、反向代理與 Nextcloud 分塊上傳的相關設定。以下以單次請求大小上限 100G、讀寫逾時 3600 秒為例，數值可以依需求調整。

Nextcloud 裝在實體主機、虛擬機或容器裡，都可以依自己使用的 PHP、Nginx 或 Apache 配置套用。

## 先確認上傳方式與限制

Nextcloud 的上傳限制並非固定在某一個數字，實際值取決於安裝時載入的配置，以及用戶端如何傳送檔案。

| 項目 | 限制的內容 |
| --- | --- |
| PHP 的 `upload_max_filesize` | PHP 處理表單上傳時，單個檔案的大小 |
| PHP 的 `post_max_size` | 整個 POST 請求的大小，包含檔案與其他表單資料 |
| Nginx、Apache、反向代理或 CDN | 經過該服務的單次 HTTP 請求大小與等待時間 |
| Nextcloud 分塊大小 | 支援分塊的上傳方式，每一塊的大小 |
| 帳號配額與儲存空間 | 完整檔案能否存入帳號使用的儲存位置 |

WebDAV 的單次 PUT 與分塊上傳不一定受 PHP 的兩個表單上限控制，仍要檢查網頁伺服器的請求大小和逾時。分塊也不會增加帳號配額；每塊傳完後，伺服器還需要完成檔案組裝或儲存端的合併操作。參考 [Nextcloud 大檔案上傳文件](https://docs.nextcloud.com/server/stable/admin_manual/configuration_files/big_file_upload_configuration.html)。

## PHP 配置

### 找到網頁端使用的設定檔

先確認 Nextcloud 使用 PHP-FPM，還是 Apache 的 PHP 模組，並找到該服務實際載入的 `php.ini` 或額外的 `.ini` 檔案。

常見位置包括 `/etc/php/<版本>/fpm/php.ini`、`/etc/php/<版本>/apache2/php.ini`、`/usr/local/etc/php/php.ini`；以自己的安裝為準。套件或容器若在啟動時產生配置，應透過它提供的設定檔、掛載或環境變數調整，讓設定在重啟後仍能保留。

`php --ini` 查到的是 CLI 的配置，不能據此判定網頁端也使用同一份檔案。必要時依 [Nextcloud PHP 配置文件](https://docs.nextcloud.com/server/stable/admin_manual/installation/php_configuration.html#notes-on-php-ini-configuration) 檢查網頁端的 `phpinfo()`；診斷頁只供管理者存取，確認後刪除。

### 上傳大小與執行時間

在網頁端載入的 PHP 配置中調整以下項目：

```ini
[PHP]
; 上傳大小
upload_max_filesize = 100G
post_max_size = 100G

; 請求處理時間
max_input_time = 3600
max_execution_time = 3600

; 記憶體與輸出
memory_limit = 1024M
output_buffering = 0
```

| 設定 | 用途 |
| --- | --- |
| `upload_max_filesize` | PHP 表單上傳的單檔大小上限 |
| `post_max_size` | PHP 接受的 POST 內容大小上限 |
| `max_input_time` | PHP 接收與解析輸入資料的時間限制 |
| `max_execution_time` | PHP 腳本的執行時間限制；實際計時方式依平台而異 |
| `memory_limit` | 單個 PHP 請求可使用的記憶體上限 |
| `output_buffering` | 關閉 PHP 輸出緩衝 |

`100G` 使用二進位單位，約為 100 GiB。若要透過表單上傳接近此大小的單檔，`post_max_size` 必須比檔案上限更大，才能容納其他表單資料；網頁伺服器也要留出相應的請求大小。兩個值都設為 `100G`，不代表一個剛好 100 GiB 的 multipart POST 一定能通過。

`memory_limit = 1024M` 沿用配置參考中的數值，它控制 PHP 工作的記憶體用量，與允許的檔案大小不同。Nextcloud 建議至少 512 MB；有多個 PHP 工作同時執行時，需按主機容量調整。參考 [Nextcloud PHP 設定](https://docs.nextcloud.com/server/stable/admin_manual/installation/php_configuration.html#php-ini-settings) 與 [PHP 上傳配置說明](https://www.php.net/manual/en/ini.core.php#ini.upload-max-filesize)。

### 檢查 .user.ini 與 PHP-FPM pool

使用 PHP-FPM 時，Nextcloud 根目錄的 `.user.ini` 可能覆蓋 `php.ini`。請把裡面的同名上傳大小、執行時間、記憶體與輸出緩衝選項一併調整，並保留其餘內容。使用 Apache PHP 模組時，則檢查站台或 `.htaccess` 中的 `php_value` 設定。

PHP-FPM pool 裡的 `php_admin_value`、`php_admin_flag` 也可能固定住數值。若修改後沒有生效，沿著這些設定查找，不要只重複修改 CLI 的 `php.ini`。

另外檢查 pool 的 `request_terminate_timeout`。這是 PHP-FPM 終止單次請求的時間限制，預設 `0` 代表關閉；原本沒有設定時，可以維持預設。若現有 pool 設了較短的時間，可依需求調高，例如：

```ini
; 合併到 Nextcloud 使用的既有 pool
request_terminate_timeout = 3600s
```

保留 pool 原本的使用者、socket 與 `pm.*` 配置。上傳大小的調整不需要一併改動 PHP 工作數量或 OPcache 容量。參考 [PHP-FPM 配置文件](https://www.php.net/manual/en/install.fpm.configuration.php)。

## 網頁伺服器配置

依 Nextcloud 後端使用的服務選擇 Nginx 或 Apache；前面若還有反向代理，再檢查下一節。

### Nextcloud 後端使用 Nginx

將以下指令合併到 Nextcloud 的既有 `server` 區塊。相同指令已存在時直接修改原值，並檢查處理 WebDAV 的 `location` 是否另有較小的上限。

```nginx
# 1. 上傳大小與暫存
client_max_body_size    100G;
client_body_buffer_size 1m;
client_body_temp_path   /var/tmp/nginx_client_body_temp;

# 2. 用戶端讀寫逾時
client_body_timeout 3600s;
send_timeout        3600s;

# 3. PHP-FPM 連線與讀寫逾時
fastcgi_connect_timeout 60s;
fastcgi_send_timeout    3600s;
fastcgi_read_timeout    3600s;
```

`client_body_temp_path` 指向的目錄要先建立，並讓 Nginx 工作程序可寫入；建立方式見下方「暫存目錄與儲存空間」。

在原本轉送 PHP 的 `location` 裡，確認這個設定：

```nginx
fastcgi_request_buffering off;
```

保留原本的 `fastcgi_pass`、`fastcgi_param`、路由與禁止存取內部目錄的規則。這裡調整的是上傳相關項目；完整的站台配置可對照 [Nextcloud 官方 Nginx 範例](https://docs.nextcloud.com/server/stable/admin_manual/installation/nginx.html)。

| 指令 | 用途 |
| --- | --- |
| `client_max_body_size` | 限制單次請求大小；分塊上傳時，每一塊都要低於這個值 |
| `client_body_buffer_size` | 接收請求內容使用的記憶體緩衝區，`1m` 並非上傳上限 |
| `client_body_temp_path` | Nginx 接收請求時使用的暫存位置 |
| `client_body_timeout` | 讀取上傳內容時，兩次讀取操作之間的等待時間 |
| `send_timeout` | 向用戶端回傳資料時，兩次寫入操作之間的等待時間 |
| `fastcgi_connect_timeout` | 建立 PHP-FPM 連線的等待時間 |
| `fastcgi_send_timeout` | 把請求送給 PHP-FPM 時，兩次寫入操作之間的等待時間 |
| `fastcgi_read_timeout` | 等待 PHP-FPM 回應時，兩次讀取操作之間的等待時間 |
| `fastcgi_request_buffering off` | 邊接收上傳內容邊送給 PHP-FPM |

檔案傳完後才出現 504 時，要特別檢查 `fastcgi_read_timeout`。最後的組裝可能仍在處理，Nginx 卻已停止等待 PHP-FPM 回應。讀寫逾時範例使用 3600 秒，建立連線則保留 60 秒；提高連線逾時無法延長檔案組裝時間。

這些讀寫逾時多半計算相鄰操作之間的等待時間，並非整個檔案傳輸的總時間。詳細語意見 [Nginx 用戶端請求配置](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_body_timeout) 與 [FastCGI 配置](https://nginx.org/en/docs/http/ngx_http_fastcgi_module.html#fastcgi_read_timeout)。

### Nextcloud 後端使用 Apache

在 Nextcloud 的既有 `VirtualHost` 中調整：

```apache
# 1. Nextcloud 目錄的請求大小
<Directory "/var/www/nextcloud">
    LimitRequestBody 0
</Directory>

# 2. 請求處理逾時
Timeout 3600
```

目錄換成實際的 Nextcloud 安裝路徑，並保留既有存取權限與重寫規則。

`LimitRequestBody 0` 代表取消 Apache 在這個目錄的請求大小限制，其他代理、PHP 或帳號配額仍各自生效。Apache 2.4.54 起的預設值是 1 GiB，未分塊的上傳可能在此被擋下。參考 [Apache LimitRequestBody 文件](https://httpd.apache.org/docs/2.4/mod/core.html#limitrequestbody)。

若 Apache 透過 `mod_proxy_fcgi` 連到 PHP-FPM，另外在該 `VirtualHost` 設定 `ProxyTimeout 3600`。若啟用了 `mod_reqtimeout`，也要檢查 `RequestReadTimeout`，它對接收速度和時間的限制不會因為提高 `Timeout` 就消失。這些項目也列在 [Nextcloud 的 Apache 上傳配置說明](https://docs.nextcloud.com/server/stable/admin_manual/configuration_files/big_file_upload_configuration.html#apache)。

## 前面還有反向代理時

請求經過的每一層都要容得下上傳內容，也要能等待後端完成處理。使用 Nginx 反向代理時，在既有的 `server` 區塊調整：

```nginx
# 上傳大小與用戶端讀寫逾時
client_max_body_size 100G;
client_body_timeout  3600s;
send_timeout         3600s;
```

在原本的 `proxy_pass` 所在 `location` 裡調整：

```nginx
# 1. 後端連線與讀寫逾時
proxy_connect_timeout 60s;
proxy_send_timeout    3600s;
proxy_read_timeout    3600s;

# 2. 串流傳送
proxy_http_version      1.1;
proxy_request_buffering off;
proxy_buffering         off;
```

保留原有的 `proxy_pass` 與轉送標頭。`proxy_request_buffering off` 讓代理邊接收邊轉送上傳內容；`proxy_buffering off` 控制後端回應的緩衝。參考 [Nginx 代理配置文件](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_request_buffering)。

完整的 HTTPS 入口、HTTP 後端與 Nextcloud 可信任代理設定，請看 [Nextcloud 設定 Nginx 反向代理](/posts/efd7b7b9/)。

若另有 CDN、負載平衡器或託管代理，也要核對該服務的單次請求上限與逾時。修改來源 Nginx 不會改變前面服務的限制。

## 調整新版 Nextcloud 的上傳塊大小

現行 Nextcloud 使用系統設定 `files.chunked_upload.max_size`，預設為 `104857600` bytes，也就是 **100 MiB**。這個值控制分塊大小，與 PHP、Nginx 的 `100G` 請求上限不同。

以下改成 **20 MiB**。在 Nextcloud 安裝目錄執行，並將 `www-data` 換成 PHP 實際使用的帳號：

```bash
cd /var/www/nextcloud

sudo -u www-data php occ config:system:set files.chunked_upload.max_size --type integer --value 20971520
sudo -u www-data php occ config:system:get files.chunked_upload.max_size
```

設定值以 bytes 計算，型別要使用整數。讀取結果應為 `20971520`。也可以把同一個設定合併到原本 `config/config.php` 的 `$CONFIG` 陣列：

```php
'files.chunked_upload.max_size' => 20971520,
```

選擇其中一種修改方式即可；保留設定檔中的其他項目。若額外的 `*.config.php` 也有同名設定，需一併檢查，因為它可能覆蓋主設定檔。

修改後重新整理瀏覽器，讓檔案頁面取得新值。需要恢復預設大小時，可把數值改回 `104857600`。

20 MiB 可以作為起點，每塊都要低於沿途最小的請求上限。頻寬高、沒有較小代理限制時，可以依實際測試調大；每塊越大，傳輸失敗時重傳的資料也越多。`0` 代表停用分塊，經過有請求大小限制的代理時，保留分塊較方便。

這個系統設定不保證所有客戶端都採用同樣的大小。桌面同步程式、手機 app 與其他 WebDAV 工具可能有自己的分塊策略；不支援分塊的單次 PUT 仍需要整個請求通過代理與網頁伺服器。

參考 [Nextcloud 分塊大小設定](https://docs.nextcloud.com/server/stable/admin_manual/configuration_files/big_file_upload_configuration.html#adjust-chunk-size-on-nextcloud-side)、[系統設定參數](https://docs.nextcloud.com/server/stable/admin_manual/configuration_server/config_sample_php_parameters.html#files-chunked-upload-max-size) 與 [occ 指令文件](https://docs.nextcloud.com/server/stable/admin_manual/occ_command.html)。

## 暫存目錄與儲存空間

大檔案上傳除了最終儲存位置，也可能占用 PHP、Nginx 與 Nextcloud 的暫存空間。多人同時上傳時，要把並行請求、分塊與檔案組裝的用量一起算進去。

如果原本的暫存目錄容量足夠，可以沿用。需要另設位置時，先建立目錄；以下帳號範例分別為 PHP 的 `www-data`、Nginx 的 `nginx`，請依實際工作程序帳號替換：

```bash
sudo install -d -o www-data -g www-data -m 0700 /var/tmp/nextcloud-upload
sudo install -d -o nginx -g nginx -m 0700 /var/tmp/nginx_client_body_temp
```

PHP 的 `php.ini` 可指定上傳暫存位置：

```ini
upload_tmp_dir = /var/tmp/nextcloud-upload
```

`upload_tmp_dir` 應放在 PHP 主配置或可管理此選項的 PHP-FPM pool，不能靠 `.user.ini` 修改。Nextcloud 自己的暫存位置則合併到 `config/config.php` 的 `$CONFIG`：

```php
'tempdirectory' => '/var/tmp/nextcloud-upload',
```

路徑必須是 PHP 執行環境內可見、可寫入的目錄，並放在網頁根目錄之外。有容器、SELinux、AppArmor 或 `open_basedir` 限制時，也要確認掛載與存取權限。Nginx 的暫存目錄同樣要由 Nginx 工作程序存取。

確認這些目錄所在的檔案系統容量：

```bash
df -h /var/tmp/nextcloud-upload /var/tmp/nginx_client_body_temp
```

使用物件儲存或外部儲存時，組裝方式與本機暫存需求可能不同，仍需確認儲存端的限制。最後再檢查帳號剩餘配額與資料儲存位置的可用容量。參考 [Nextcloud 暫存目錄設定](https://docs.nextcloud.com/server/stable/admin_manual/configuration_server/config_sample_php_parameters.html#tempdirectory) 與 [大檔案及物件儲存說明](https://docs.nextcloud.com/server/stable/admin_manual/configuration_files/big_file_upload_configuration.html#large-file-upload-on-object-storage)。

## 載入設定與測試

修改 PHP 配置後重啟對應的 PHP-FPM；使用 Apache PHP 模組時則重啟 Apache。Nginx 與 Apache 先檢查語法，再重新載入。

以下是使用 systemd 的例子。PHP-FPM 的執行檔與服務名稱要換成自己安裝的名稱，例如 `php8.4-fpm`；容器或其他服務管理方式則使用對應的重啟命令。

PHP-FPM 與 Nginx：

```bash
sudo php-fpm -t
sudo systemctl restart php-fpm

sudo nginx -t
sudo systemctl reload nginx
```

Apache：

```bash
sudo apachectl configtest
sudo systemctl restart apache2
```

Apache 的服務也可能叫 `httpd`；使用 Apache 搭配 PHP-FPM 時，兩邊都要載入新配置。

接著依序測試：

1. 上傳小檔案，確認登入、檔案存取與下載正常。
2. 在瀏覽器上傳大於設定分塊大小的檔案，例如 120 MiB。從開發者工具的 Network 檢查分塊請求，以及最後完成上傳的回應。
3. 再測試自己實際需要的大檔案，下載後比對檔案大小或 SHA-256。
4. 分別測試平常使用的同步 app、手機 app 或 WebDAV 工具，確認它們的上傳方式也能通過。
5. 若有反向代理或 CDN，測試要經過實際使用的完整連線路徑。

### 上傳失敗時的排查

先找出錯誤由哪一層回覆，再對照同一時間的 Nextcloud、PHP、網頁伺服器與代理日誌。

| 現象 | 優先檢查 |
| --- | --- |
| `413 Request Entity Too Large` | 回覆錯誤的代理或網頁伺服器之請求上限；若是 Nextcloud 回覆，也檢查配額與儲存端限制 |
| 表單上傳超過某個大小就失敗 | 網頁端實際生效的 `upload_max_filesize`、`post_max_size`，以及覆蓋它們的配置 |
| 上傳完成後，組裝時出現 `504` | `fastcgi_read_timeout`、`proxy_read_timeout`、PHP-FPM 請求終止時間與儲存處理速度 |
| `408` 或傳輸中斷 | 用戶端上傳速度、網路連線、`client_body_timeout` 與沿途代理的逾時 |
| 暫存檔建立失敗、空間不足 | 暫存目錄權限、磁碟剩餘容量、帳號配額與儲存端日誌 |
| PHP 記憶體不足 | PHP 錯誤日誌、實際生效的 `memory_limit` 與並行工作用量 |

504 只能說明某一層等待後端逾時，原因也可能是儲存太慢、PHP 工作繁忙或請求被終止。依日誌處理原因，再調整該層的等待時間。

## 配置參考

本文的 `100G` 上傳限制、`1024M` PHP 記憶體、Nginx `1m` 請求緩衝與 3600 秒讀寫逾時，參考以下配置。PHP 輸入時間、PHP-FPM 既有限制與 Apache 的處理方式另依官方文件補充。

- [overlay/php/php.ini](https://github.com/hmes98318/nextcloud-custom/blob/6d7c02efbbf5d4b58dfd260c402c67d96afbc2c0/overlay/php/php.ini)
- [overlay/nginx/nginx.conf](https://github.com/hmes98318/nextcloud-custom/blob/6d7c02efbbf5d4b58dfd260c402c67d96afbc2c0/overlay/nginx/nginx.conf)
- [overlay/nginx/conf.d/nextcloud.inc](https://github.com/hmes98318/nextcloud-custom/blob/6d7c02efbbf5d4b58dfd260c402c67d96afbc2c0/overlay/nginx/conf.d/nextcloud.inc)

## 相關文章

- [Nextcloud 設定 Nginx 反向代理](/posts/efd7b7b9/)
