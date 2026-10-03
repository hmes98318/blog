---
title: APC UPS 電池充不滿的維修紀錄
tags:
  - APC UPS
  - 硬體維修
categories: 硬體維修
keywords: 'APC UPS 電池充不滿,UPS 電池充電異常,APC UPS 維修紀錄,330uF 35V 電解電容,UPS 電容更換'
description: APC UPS 換過新電池，卻還是充到一半就停住。拆開後找到壞掉的電解電容，更換並重設 UPS 後，電池才恢復正常充電。
cover: /img/blogs/d756239/ups1.jpg
abbrlink: d756239
comments: true
date: 2025-04-20 20:56:28
---


前一陣子台電停電維護時 UPS 都有正常作動並把 server 正常關機，但在復電一陣子後發現 UPS 的電池回充到一半就不會再往上充了，而電池在前幾週才更換過全新的，我猜可能是 UPS 有零件壞了，所以打算把他拆解檢查。  

![出現電池充電異常的 APC UPS](/img/blogs/d756239/ups1.jpg)

電壓測量只能充到 12.4v。  
![APC UPS 電池充電異常時的電壓量測](/img/blogs/d756239/ups4.jpg)


## 拆機檢查

拆解後的內容如下。  
![APC UPS 拆解後的內部零件](/img/blogs/d756239/ups2.jpg)

發現了損壞的零件，為 330uF 35V 的電解電容。  
只需購買相同規格的電容進行更換即可。  
![APC UPS 中損壞的 330uF 35V 電解電容](/img/blogs/d756239/ups3.jpg)

## 更換電容後的結果

更換完電容並重設 UPS 後，成功回充到正常電壓。  
![更換電容並重設 APC UPS 後的充電電壓量測](/img/blogs/d756239/ups5.jpg)
