---
title: Proxmox VE 修改 LVM 磁碟名稱
tags:
  - Proxmox VE
categories: Proxmox VE
keywords: 'Proxmox VE LVM 磁碟重新命名,PVE 修改 VM 硬碟 ID,lvrename,vm-disk,qm disk rescan'
description: VM ID 從 106 改成 201 後，LVM 磁碟名稱還留著 106。用 lvrename 把名稱改好，再重新掃描並掛回 VM，讓磁碟名稱跟上新的 ID。
cover: /img/background/pve.png
abbrlink: 48d8abb
comments: true
date: 2024-05-26 04:43:57
---


在 Proxmox VE 把 VM ID 改掉後，會發現 LVM 磁碟名稱還留著舊的 ID。

例如，為了分類把 VM ID 從 106 改成 201，磁碟名稱裡卻還是 106。

![Proxmox VE 修改 VM ID 後仍保留舊名稱的 LVM 磁碟](/img/blogs/48d8abb/oldVM.png)


## 用 lvrename 修改名稱

Proxmox VE 使用版本為 8.0.3  
SSH 進入 PVE server，執行 `lvs` 命令列出當前邏輯卷 (Logical Volume)  

```
root@pve:/etc/pve/nodes/pve# lvs
  LV            VG  Attr       LSize   Pool Origin Data%  Meta%  Move Log Cpy%Sync Convert
  data          pve twi-aotz--  <1.67t             24.11  1.02
  root          pve -wi-ao----  96.00g
  swap          pve -wi-ao----   8.00g
  vm-100-disk-0 pve Vwi-aotz--  32.00g data        22.94
  vm-101-disk-0 pve Vwi-aotz-- 124.00m data        20.72
  vm-102-disk-0 pve Vwi-aotz-- 160.00g data        94.59
  vm-103-disk-0 pve Vwi-aotz--  64.00g data        23.31
  vm-104-disk-0 pve Vwi-aotz-- 128.00g data        9.50
  vm-106-disk-0 pve Vwi-a-tz-- 128.00g data        61.70
  vm-108-disk-0 pve Vwi-aotz-- 256.00g data        29.61
  vm-200-disk-0 pve Vwi-aotz--  64.00g data        19.42
  vm-202-disk-0 pve Vwi-aotz--  64.00g data        92.59
root@pve:/etc/pve/nodes/pve# 
```

設置允許對邏輯卷 (Logical Volume) 進行重命名操作。  

```bash
lvrenameavailable=1
```

修改 `vm-106-disk-0` 邏輯卷名稱至 `vm-201-disk-0`  

```
root@pve:/etc/pve/nodes/pve# lvrename pve vm-106-disk-0 vm-201-disk-0
  Renamed "vm-106-disk-0" to "vm-201-disk-0" in volume group "pve"
root@pve:/etc/pve/nodes/pve# 
```

修改完成後重新掃描磁碟配置  

```bash
qm disk rescan
```

完成後刷新網頁控制台，即可看到修改後的磁碟並重新掛載即可。  

![Proxmox VE 重新掃描後掛載改名的 VM 磁碟](/img/blogs/48d8abb/mountDisk.png)

![Proxmox VE 原 VM 磁碟名稱的對照畫面](/img/blogs/48d8abb/oldVM.png)

## 相關文章

- [Proxmox VE VM 硬碟效能比較](/posts/c0ed975c/)
