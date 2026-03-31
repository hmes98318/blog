---
title: APC UPS 損壞修復紀錄
tags:
categories:
keywords: 'APC UPS,UPS 修復,電池回充問題,電解電容更換,UPS 維修教學,電源備援'
description: 'APC UPS 修復紀錄：更換損壞電解電容恢復電池回充問題'
cover:
abbrlink: d756239
comments: true
date: 2025-04-20 20:56:28
---


前一陣子台電停電維護時 UPS 都有正常作動並把 server 正常關機，但在復電一陣子後發現 UPS 的電池回充到一半就不會再往上充了，而電池在前幾週才更換過全新的，我猜可能是 UPS 有零件壞了，所以打算把他拆解檢查。  

![ups1](/img/blogs/d756239/ups1.jpg)

電壓測量只能充到 12.4v。  
![ups4](/img/blogs/d756239/ups4.jpg)


拆解後的內容如下。  
![ups2](/img/blogs/d756239/ups2.jpg)

發現了損壞的零件，為 330uF 35V 的電解電容。  
只需購買相同規格的電容進行更換即可。  
![ups3](/img/blogs/d756239/ups3.jpg)

更換完電容並重設 UPS 後，成功回充到正常電壓。  
![ups5](/img/blogs/d756239/ups5.jpg)
