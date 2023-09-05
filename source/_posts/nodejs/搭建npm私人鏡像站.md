---
title: 搭建 npm 私人鏡像站
tags:
  - Node.js
  - Server
categories: Node.js
keywords: 'Node.js,npm,鏡像站'
description: 搭建 npm 私人鏡像站
cover: /img/background/npm.png
abbrlink: c7d1d524
comments: true
date: 2023-09-01 20:30:59
---


搭建 npm 私人鏡像站有三種常見的解決方案，分別是 [CNPM](https://github.com/cnpm/cnpmcore)、[Nexus](https://www.sonatype.com/) 和 [Verdaccio](https://verdaccio.org/)。


* **CNPM**
CNPM 是一個基於Node.js的 npm 鏡像源，旨在提供更快速和穩定的包管理體驗。它是淘寶公司推出的項目，通常用於中國地區的開發者，以加速包的下載速度。  
但部屬上手難度較高，不使用雲端儲存 npm 緩存的設置也較麻煩。  

* **Nexus**
Nexus是一個由Sonatype開發的強大的存儲和分發平台，支持多種包管理器，包括 npm。  
但如果使用Nginx反向代理重寫路徑會出現無法下載包的問題。  

* **Verdaccio**
Verdaccio是一個輕量級的 npm 私人鏡像站管理工具，允許您在本地搭建私人 npm 鏡像站，它易於安裝和配置，用於自己的項目或組織內部使用。  

--------------------


## 搭建步驟

上面三種解決方案，我以不搞死自己的前提選擇了 Verdaccio 進行搭建 (~~已經被上面兩種搞過了~~)，
本次，我們將使用 Verdaccio 搭配 Docker Compose 來搭建私人 npm 鏡像站，並使用 Nginx 作為反向代理。

### Docker Compose配置文件（docker-compose.yml）

```yaml
version: '3.8'
services:
  verdaccio:
    image: verdaccio/verdaccio:nightly-master
    container_name: verdaccio-docker
    restart: always
    ports:
      - '4873:4873'
    volumes:
      - './data/storage:/verdaccio/storage'
      - './data/conf:/verdaccio/conf'
volumes:
  verdaccio:
    driver: local
```

上述 Docker Compose 文件將創建一個名為 `verdaccio` 的容器，並使用 Verdaccio 的官方映像。它將使用端口4873來運行，並將 Verdaccio 的存儲和配置文件映射到本地目錄以保持持久性。


### 創建 data 目錄
在 `docker-compose.yml` 同目錄下創建 data 目錄，  
並在目錄中創建 `conf/`, `storage/` 兩個目錄。  

創建 `conf/config.yaml` 寫入配置檔 ([參考此連結](https://github.com/verdaccio/verdaccio/blob/9b4a4459232891f9273621e66343bbc7f32cf660/docker-examples/v6/docker-local-storage-volume/conf/config.yaml))

```yaml
storage: /verdaccio/storage

auth:
  htpasswd:
    file: /verdaccio/conf/htpasswd
security:
  api:
    jwt:
      sign:
        expiresIn: 60d
        notBefore: 1
  web:
    sign:
      expiresIn: 7d

uplinks:
  npmjs:
    url: https://registry.npmjs.org/

packages:
  '@jota/*':
    access: $all
    publish: $all

  '@*/*':
    # scoped packages
    access: $all
    publish: $all
    proxy: npmjs

  '**':
    # allow all users (including non-authenticated users) to read and
    # publish all packages
    #
    # you can specify usernames/groupnames (depending on your auth plugin)
    # and three keywords: "$all", "$anonymous", "$authenticated"
    access: $all

    # allow all known users to publish packages
    # (anyone can register by default, remember?)
    publish: $all

    # if package is not available locally, proxy requests to 'npmjs' registry
    proxy: npmjs

middlewares:
  audit:
    enabled: true

log:
  - { type: stdout, format: pretty, level: trace }
```

創建 `conf/htpasswd` 來存放使用者帳號密碼  

`storage` 目錄則是用來存放 npm 模組包的  


### 啟動容器

```bash
docker compose up
```
啟動容器後記得開啟主機的4873端口，否則會無法訪問。  

如果啟動容器後出現無法讀取 `data/` 目錄，則需使用以下方式進行修改。

```bash
chmod -R 777 data/
```


## 使用步驟

### 安裝 nrm 

nrm（NPM Registry Manager）是一個用於管理 npm 鏡像站設定的命令行工具。  
它允許您輕鬆切換不同的 npm 鏡像站，包括官方 npm 鏡像站和私人鏡像站，以加速包的下載速度和提高效率。  

如果尚未安裝 nrm，請在命令行中執行以下命令來全域安裝：
```bash
npm install nrm -g
```

列出可用鏡像站
```bash
nrm ls
```


### 使用 nrm 添加鏡像站
```bash
nrm add mynpm http://鏡像站IP:4873
```

切換 npm 源
```bash
nrm use mynpm
```

檢查是否更換成功
```bash
npm config get registry
```


### 創建私人鏡像站帳號

```bash
nrm adduser
```

登入私人鏡像站
```bash
npm login
```


## Nginx反向代理配置

verdaccio 配置完成後接下來，我們將使用 Nginx 作為反向代理來通過 https 提供私人 npm 鏡像站服務。

```conf
server {
    listen      443 ssl http2;
    listen      [::]:443 http2 ssl;
    server_name <你的網域>;

    charset utf-8;

    location / {
        proxy_set_header Host $host:$server_port;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_pass http://<verdaccio 的內網 IP>:4873/;
    }

    ssl_certificate /etc/letsencrypt/live/<你的網域>/fullchain.pem; # 使用 Certbot 進行憑證管理
    ssl_certificate_key /etc/letsencrypt/live/<你的網域>/privkey.pem;
}
```

上述 Nginx 配置文件將聽取443端口，使用 SSL 加密，並將請求代理到 Verdaccio 容器的地址。同時，它使用 Certbot 管理的 SSL 證書來提供加密。  

完成這些配置後，就成功搭建了一個私人 npm 鏡像站，並使用 Nginx 進行了反向代理。