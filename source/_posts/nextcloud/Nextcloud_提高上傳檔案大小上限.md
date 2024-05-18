---
title: Nextcloud 提高上傳檔案大小上限
tags:
  - Nextcloud
categories: Nextcloud
keywords: 'Nextcloud,Nextcloud 提高上傳檔案大小,Nextcloud 504,Nextcloud 504 塊組裝錯誤'
description: Nextcloud 提高上傳檔案大小上限
cover: /img/background/nextcloud.png
abbrlink: 99b26485
comments: true
date: 2023-08-28 12:02:40
---


### 提高上傳檔案大小上限

Nextcloud 默認上傳的最大檔案大小為 512MB ，如果想提高則須修改以下內容。  
(此修改適用於 TrueNAS CORE Jail 的 Nextcloud，其他系統的配置檔位置則會有些許出入)  

修改 `/usr/local/etc/php/php.truenas.ini`  

```ini
; https://docs.nextcloud.com/server/latest/admin_manual/installation/server_tuning.html?highlight=tuning

[PHP]
; recommended value of 512MB for php memory limit (avoid warning when running occ)
memory_limit=1024M
post_max_size=20G
upload_max_filesize=20G
max_execution_time = 3600

[opcache]
; Modify opcache settings in php.ini according to Nextcloud documentation (remove comment and set recommended value)
opcache.enable=1
opcache.enable_cli=1
opcache.memory_consumption=2048
opcache.interned_strings_buffer=16
opcache.max_accelerated_files=30000
opcache.revalidate_freq=1
opcache.save_comments=1
opcache.validate_timestamps = 0
opcache.revalidate_freq = 60
opcache.max_file_size = 0

[apcu]
apc.enable_cli=1
```

`memory_limit`: 提高到 1G 加快網頁載入速度 (預設值 125MB)  
`post_max_size`, `upload_max_filesize`: 調整為 20G 表示最大上傳單檔案大小為 20G  
`max_execution_time`: 延長 php 的執行時間避免檔案還沒上傳完就超時 (504 塊組裝錯誤 就是因為這個)  

修改 `/usr/local/etc/nginx/nginx.conf`  

```conf
load_module /usr/local/libexec/nginx/ngx_mail_module.so;
load_module /usr/local/libexec/nginx/ngx_stream_module.so;

user www;
worker_processes auto;

pid /var/run/nginx.pid;

events {
  use kqueue;
  worker_connections 1024;
  multi_accept on;
}
http {

  # Basic settings
  # ----------

  sendfile on;
  tcp_nopush on;
  tcp_nodelay on;
  reset_timedout_connection on;
  keepalive_timeout 65;
  keepalive_requests 1000;
  types_hash_max_size 2048;
  server_tokens off;
  send_timeout 3600; #30;
  server_names_hash_max_size 4096;

  fastcgi_connect_timeout 3600s;
  fastcgi_send_timeout    3600s;
  fastcgi_read_timeout    3600s;

  # Common limits
  # ----------

  client_max_body_size 100m; # upload size
  client_body_buffer_size 1m;
  client_header_timeout 3600; #3m;
  client_body_timeout 3600; #3m;

  client_body_temp_path /var/tmp/nginx/client_body_temp;

  proxy_connect_timeout 3600; #5;
  proxy_send_timeout 3600; #10;
  proxy_read_timeout 3600; #10;

  proxy_buffer_size 4k;
  proxy_buffers 8 16k;
  proxy_busy_buffers_size 64k;
  proxy_temp_file_write_size 64k;

  proxy_temp_path /var/tmp/nginx/proxy_temp;

  include mime.types;
  default_type application/octet-stream;

  # Logs format
  # ----------

  log_format main '$remote_addr - $host [$time_local] "$request" '
                  '$status $body_bytes_sent "$http_referer" '
                  '"$http_user_agent" "$http_x_forwarded_for"'
                  'rt=$request_time ut=$upstream_response_time '
                  'cs=$upstream_cache_status';

  log_format cache '$remote_addr - $host [$time_local] "$request" $status '
                   '$body_bytes_sent "$http_referer" '
                   'rt=$request_time ut=$upstream_response_time '
                   'cs=$upstream_cache_status';

  access_log /var/log/nginx/access.log main;
  error_log /var/log/nginx/error.log warn;

  # GZip config
  # ----------

  gzip on;
  gzip_static on;
  gzip_types text/plain text/css text/javascript text/xml application/x-javascript application/javascript application/xml application/json image/x-icon;
  gzip_comp_level 9;
  gzip_buffers 16 8k;
  gzip_proxied expired no-cache no-store private auth;
  gzip_min_length 1000;
  gzip_disable "msie6"
  gzip_vary on;

  # Cache config
  # ----------

  proxy_cache_valid 1m;

  # Virtual host config
  # ----------

  # SSL
  # ----------

  ssl_certificate /usr/local/etc/letsencrypt/live/truenas/fullchain.pem;
  ssl_certificate_key /usr/local/etc/letsencrypt/live/truenas/privkey.pem;
  # Verify chain of trust of OCSP response using Root CA and Intermediate certs
  ssl_trusted_certificate /usr/local/etc/letsencrypt/live/truenas/chain.pem;

  ssl_session_timeout 1d;
  ssl_session_cache shared:MozSSL:10m;  # about 40000 sessions
  ssl_session_tickets off;

  # intermediate configuration
  # Keep only TLS 1.2 (+ TLS 1.3)
  ssl_protocols TLSv1.2 TLSv1.3;
  # Use only strong ciphers
  ssl_ciphers TLS-CHACHA20-POLY1305-SHA256:TLS-AES-256-GCM-SHA384:TLS-AES-128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
  # Use more secure ECDH Curve
  ssl_ecdh_curve X25519:P-521:P-384:P-256;
  # Defend against the BEAST attack
  ssl_prefer_server_ciphers off;

  # OCSP Stapling
  ssl_stapling on;
  ssl_stapling_verify on;

  include /usr/local/etc/nginx/conf.d/*.conf;
}
```

把以下 timeout 都提高到 3600s (解決 504 塊組裝錯誤)  
如果有添加反向代理的話也需要把 timeout 都調到同樣數值。  

{% note no-icon %}
fastcgi_connect_timeout
fastcgi_send_timeout
fastcgi_read_timeout

send_timeout
client_header_timeout
client_body_timeout

proxy_connect_timeout
proxy_send_timeout
proxy_read_timeout
{% endnote %}


## 修改上傳塊大小
Nextcloud 預設的上傳塊大小為 10MB，如果網路頻寬足夠則可加大塊大小以提高性能。  

使用以下 occ 命令提高到 20MB  

```tcsh
occ config:app:set files max_chunk_size --value 20971520
```

不建議設置為 0 (不分塊)，從外網上傳檔案常常會失敗  

可參考以下連結  
https://docs.nextcloud.com/server/latest/admin_manual/configuration_files/big_file_upload_configuration.html#adjust-chunk-size-on-nextcloud-side
