---
title: Proxmox VE 修改 LVM 硬碟 ID
tags:
  - Proxmox VE
categories: Proxmox VE
keywords: 'Proxmox VE,Proxmox VE 修改 LVM 硬碟 ID,Proxmox VE rename disk,Proxmox VE change disk'
description: Proxmox VE 修改 LVM 硬碟 ID
cover: /img/background/pve.png
abbrlink: 48d8abb
comments: true
date: 2024-05-26 04:43:57
---


在修改 VM ID 後會出現一個問題，原本同 VM ID 一起創建的 VM Disk ID 仍是舊的 VM ID 值。  
ex: 106 的 VM 因為需要分類所以須改成 201 的 VM ID，但 VM Disk ID 仍是 106 而不是修改後的 201  

![oldVM](/img/blogs/48d8abb/oldVM.png)


## 解決方法

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

![mountDisk](/img/blogs/48d8abb/mountDisk.png)

![oldVM](/img/blogs/48d8abb/oldVM.png)
