---
title: 用 Verdaccio 架設 npm 私人鏡像站
tags:
  - Node.js
  - Server
  - Verdaccio
  - Docker
categories: Node.js
keywords: 'Verdaccio npm 私有 Registry,npm 私人鏡像站,Verdaccio Docker Compose,npm registry 設定,nrm,Nginx 反向代理'
description: 用 Verdaccio 和 Docker Compose 架設私人 npm 鏡像站，把套件留在自己的伺服器上，並透過 Nginx 提供 HTTPS 連線。
cover: /img/background/npm.png
abbrlink: c7d1d524
comments: true
date: 2023-09-01 20:30:59
---


架設 npm 私人鏡像站時，常見的方案包括 [CNPM](https://github.com/cnpm/cnpmcore)、[Nexus](https://www.sonatype.com/) 與 [Verdaccio](https://verdaccio.org/)。

* **CNPM**  
  CNPM 是一套以 Node.js 為基礎的 npm registry／鏡像方案，最初由淘寶團隊推出，主要用於改善中國地區存取 npm 套件時的下載速度與穩定性。  
  相較其他方案，CNPM 的部署與維護門檻較高；若不搭配雲端物件儲存，快取與儲存空間的設定也較為繁瑣。

* **Nexus**  
  Nexus Repository 是 Sonatype 開發的套件儲存與發布平台，支援 npm、Maven、Docker 等多種套件格式，適合需要集中管理多種類型套件的環境。  
  不過，在透過 Nginx 反向代理並進行路徑重寫時，需要特別留意 base path 與 registry URL 的設定，否則可能造成套件下載失敗。

* **Verdaccio**  
  Verdaccio 是一套輕量級的 npm 私有 registry，安裝與設定相對簡單，適合個人專案、小型團隊或內部環境使用。它也能作為 npm 官方 registry 的代理與快取層，減少重複下載並提升內部套件的存取效率。

--------------------


## 架設步驟

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


## 切換鏡像站與登入

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


## Nginx 反向代理設定

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

## 相關文章

- [在 Rocky Linux 9 的 Nginx 啟用 Brotli 壓縮](/posts/dd600bd3/)
