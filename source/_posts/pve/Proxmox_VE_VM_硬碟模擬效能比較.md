---
title: Proxmox VE VM 硬碟效能比較
tags:
  - Proxmox VE
categories: Proxmox VE
keywords: 'Proxmox VE 磁碟效能比較,PVE 硬碟類型,IDE SATA VirtIO SCSI,VirtIO Block,VirtIO SCSI single,IO Thread'
description: 在 Proxmox VE 8.0.3 用 Samsung 980 PRO 測試四種 VM 硬碟類型，實測結果是 VirtIO Block 和 SCSI 的讀寫效能較好。
cover: /img/background/pve.png
abbrlink: c0ed975c
comments: true
date: 2024-05-26 05:06:32
---


Proxmox VE 建立 VM 時，有 4 種硬碟類型可以選：`IDE`、`SATA`、`VirtIO Block` 和 `SCSI`。

我用同一顆硬碟跑了幾組測試，看看這 4 種類型的讀寫效能差多少。


## 測試

本次測試 Proxmox VE 使用版本為 8.0.3  
硬碟使用 SAMSUNG 980 PRO 2TB 創建 25G VM disk 進行測試  
皆使用預設值，未設置快取  

### IDE 模式

![Proxmox VE IDE 模式的 VM 磁碟讀寫效能測試](/img/blogs/c0ed975c/benchmark_IDE.png)

### SATA 模式

![Proxmox VE SATA 模式的 VM 磁碟讀寫效能測試](/img/blogs/c0ed975c/benchmark_SATA.png)

### VirtIO Block 模式

![Proxmox VE VirtIO Block 模式的 VM 磁碟讀寫效能測試](/img/blogs/c0ed975c/benchmark_VirtIO_Block.png)

### SCSI 模式
SCSI 控制器使用 **VirtIO SCSI single**，**iotread = 1**    

![Proxmox VE VirtIO SCSI single 模式的 VM 磁碟讀寫效能測試](/img/blogs/c0ed975c/benchmark_SCSI.png)


## 結論

藉由上述比較可得知 `VirtIO Block`, `SCSI` 兩種模式都能獲得較好的讀寫效能，
而[官方文檔](https://pve.proxmox.com/wiki/Qemu/KVM_Virtual_Machines#qm_hard_disk)也是建議選擇這兩種模式進行使用，除非遇到較舊系統不支援的情況 (ex: win7)。  

`VirtIO Block` 控制器通常簡稱為 **VirtIO** 或 **virtio-blk**，是較舊類型的半虛擬化控制器，目前已被 **VirtIO SCSI** 控制器取代。
`SCSI` 控制器則有 **VirtIO SCSI single**, **VirtIO SCSI** 及其他 (這裡只探討這兩種)。  
    **VirtIO SCSI single** 使用 1 個 SCSI 控制器用於 1 個硬碟 (每個硬碟都有自己的 VirtIO SCSI 控制器)，  
    **VirtIO SCSI** 使用 1 個 SCSI 控制器用於 14 個硬碟。  

如果需要效能，建議使用 **VirtIO SCSI single** 類型的 SCSI 控制器並為連接的硬碟啟用 iotread 設定。  

{% note no-icon %}
**VirtIO SCSI** 功能是一種新的半虛擬化 SCSI 控制器設備。它是 KVM 虛擬化儲存堆疊替代儲存實作的基礎，取代了 **virtio-blk** 並改進了其功能。它提供與 **virtio-blk** 相同的性能，並增加了以下直接優勢：

* 改進的可擴充性－虛擬機器可以連接到更多儲存裝置（**VirtIO SCSI** 可以為每個虛擬 SCSI 轉接器處理多個區塊裝置）。
* 標準指令集—**VirtIO SCSI** 使用標準 SCSI 指令集，簡化了新功能的新增。
* 標準設備命名 — **VirtIO SCSI** 磁碟使用與裸機系統相同的路徑。這簡化了實體到虛擬和虛擬到虛擬的遷移。
* SCSI 設備直通 — **VirtIO SCSI** 可以直接提供 guest 實體儲存設備。

**VirtIO SCSI** 可視為 **virtio-blk** 的延伸方案，在保留其效能優勢的同時，進一步提升儲存裝置的擴充能力。它可透過單一控制器連接多個儲存設備，並沿用 guest 作業系統既有的 SCSI 堆疊。
{% endnote %}


## 參考資料

* https://pve.proxmox.com/wiki/Qemu/KVM_Virtual_Machines#qm_hard_disk
* https://forum.proxmox.com/threads/modify-hard-disk-type.59007/
* https://forum.proxmox.com/threads/virtio-scsi-vs-virtio-scsi-single.28426/
* https://www.facebook.com/groups/pve.tw/posts/1773818482786705
* https://www.ovirt.org/develop/release-management/features/storage/virtio-scsi.html

## 相關文章

- [Proxmox VE 修改 LVM 磁碟名稱](/posts/48d8abb/)
