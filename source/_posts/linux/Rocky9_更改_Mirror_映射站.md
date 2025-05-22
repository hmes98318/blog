---
title: Rocky Linux 9 更改 Mirror 映射站
tags:
  - Rocky Linux
categories: Rocky Linux
keywords: 'Rocky Linux,Rocky Linux 9,Mirror 更換,映射站,套件來源,dnf,yum,repo,baseurl,mirrorlist,系統更新加速,Rocky Linux Mirror,Rocky Linux 加速,Rocky Linux 套件下載'
description: Rocky Linux 9 更改 Mirror 映射站
cover: /img/background/rockylinux.svg
abbrlink: 8d1a9329
comments: true
date: 2025-04-19 02:17:45
--- 

## 為何需要更換 Mirror

Rocky Linux 預設使用官方的 Mirror 站點進行系統更新與套件安裝，但官方 Mirror 常下載速度緩慢。透過更換至地理位置較近或網路連線較佳的 Mirror 映射站，可以明顯提升下載速度，加快系統更新與套件安裝的效率。  

以下是更換 Rocky Linux 9 Mirror 映射站的完整方法。  


## 備份原始設定

先備份原本的設定檔  
```bash
$ mkdir backup
$ cp /etc/yum.repos.d/[Rr]ocky*.repo backup/
```


## 選擇適合的 Mirror

參考 Rocky Linux 官方提供的 Mirror list：  
https://mirrors.rockylinux.org/mirrormanager/mirrors  

我使用 `rocky-linux-asia-east1.production.gcp.mirrors.ctrliq.cloud mirror`  


## 修改設定檔

更改 mirror   
```bash
sed -e 's|^mirrorlist=|#mirrorlist=|g' \
    -e 's|^#baseurl=http://dl.rockylinux.org/$contentdir|baseurl=https://rocky-linux-asia-east1.production.gcp.mirrors.ctrliq.cloud/pub/rocky|g' \
    -i.bak \
    /etc/yum.repos.d/[Rr]ocky*.repo
```


## 如何恢復原始設定

如果要恢復可使用此命令或剛剛的備份檔  
```bash
sed -e 's|^#mirrorlist=|mirrorlist=|g' \
    -e 's|^baseurl=https://rocky-linux-asia-east1.production.gcp.mirrors.ctrliq.cloud/pub/rocky|#baseurl=http://dl.rockylinux.org/$contentdir|g' \
    -i.bak \
    /etc/yum.repos.d/[Rr]ocky*.repo
```


## 更新系統快取

完成後清除 dnf cache 並更新 cache  
```bash
$ dnf clean all
$ dnf makecache
```

透過以上步驟，將套件來源更改為更快速的 Mirror。這能有效提升系統更新與套件安裝效率，若需要隨時可使用相同方法更換其他映射站。


## 參考資料

* https://mirrors.rockylinux.org/mirrormanager/
* https://sysin.org/blog/rocky-linux-mirrors/
