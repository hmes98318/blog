---
title: Nextcloud 添加 Nginx 反向代理
tags:
  - Nextcloud
categories: Nextcloud
keywords: 'Nextcloud,Nextcloud Nginx,Nextcloud 反向代理,Nextcloud Nginx 反向代理'
description: Nextcloud 添加 Nginx 反向代理
cover: /img/background/nextcloud.png
abbrlink: efd7b7b9
comments: true
date: 2023-08-28 11:45:02
---


使用以下配置來進行反向代理  
timeout 也都設置 3600s 來防止超時 (防止 504 塊組裝錯誤)  

timeout 設置參考 [Nextcloud 提高上傳檔案大小上限](/posts/aba6d71)  

```conf
server {
    listen      443 ssl http2;
    listen      [::]:443 http2 ssl;
    server_name <你的網域>;

    fastcgi_request_buffering off;
    proxy_buffering off;

    location / {
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        add_header Front-End-Https on;

        #Enable HSTS (HTTP Strict Transport Security)
        add_header Strict-Transport-Security "max-age=15768000;includeSubDomains";

        proxy_headers_hash_max_size 512;
        proxy_headers_hash_bucket_size 64;
        proxy_redirect off;
        proxy_max_temp_file_size 0;

        client_max_body_size 100G;
        client_body_buffer_size 20m;

        client_body_timeout     3600s;
        fastcgi_connect_timeout 3600s;
        fastcgi_send_timeout    3600s;
        fastcgi_read_timeout    3600s;
        proxy_connect_timeout   3600s;
        proxy_read_timeout      3600s;
        proxy_send_timeout      3600s;
        send_timeout            3600s;

        proxy_pass https://<Nextcloud 的內網 IP>;
    }

    ssl_certificate /etc/letsencrypt/live/<你的網域>/fullchain.pem; # 使用 Certbot 進行憑證管理
    ssl_certificate_key /etc/letsencrypt/live/<你的網域>/privkey.pem;
}
```