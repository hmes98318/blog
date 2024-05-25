---
title: Proxmox VE VM 硬碟模擬效能比較
tags:
  - Proxmox VE
categories: Proxmox VE
keywords: 'Proxmox VE,Proxmox VE VM 硬碟模擬效能比較,Proxmox VE disk type,Proxmox VE disk'
description: Proxmox VE VM 硬碟模擬效能比較
cover: /img/background/pve.png
abbrlink: c0ed975c
comments: true
date: 2024-05-26 05:06:32
---


Proxmox VE 在創建 VM 時，有 4 種硬碟類型可以選擇，分別是 `IDE`, `SATA`, `VirtIO Block`, `SCSI`。
而 4 種硬碟類型的效能差別可以參考以下測試。  


## 測試

本次測試 Proxmox VE 使用版本為 8.0.3  
硬碟使用 SAMSUNG 980 PRO 2TB 創建 25G VM disk 進行測試  
皆使用預設值，未設置快取  

### IDE 模式

![benchmark_IDE](/img/blogs/c0ed975c/benchmark_IDE.png)

### SATA 模式

![benchmark_SATA](/img/blogs/c0ed975c/benchmark_SATA.png)

### VirtIO Block 模式

![benchmark_VirtIO_Block](/img/blogs/c0ed975c/benchmark_VirtIO_Block.png)

### SCSI 模式
SCSI 控制器使用 **VirtIO SCSI single**，**iotread = 1**    

![benchmark_SCSI](/img/blogs/c0ed975c/benchmark_SCSI.png)


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

**VirtIO SCSI** 旨在取代 **virtio-blk**，保留了 **virtio-blk** 的效能優勢，同時提高了儲存可擴充性，允許透過單一控制器存取多個儲存設備，並實作 guest 作業系統的 SCSI 堆疊的重複使用。
{% endnote %}


## 參考資料

* https://pve.proxmox.com/wiki/Qemu/KVM_Virtual_Machines#qm_hard_disk
* https://forum.proxmox.com/threads/modify-hard-disk-type.59007/
* https://forum.proxmox.com/threads/virtio-scsi-vs-virtio-scsi-single.28426/
* https://www.facebook.com/groups/pve.tw/posts/1773818482786705
* https://www.ovirt.org/develop/release-management/features/storage/virtio-scsi.html