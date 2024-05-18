---
title: Nextcloud 登入密碼多次錯誤鎖定ip
tags:
  - Nextcloud
categories: Nextcloud
keywords: 'Nextcloud,Nextcloud 登入鎖定,Nextcloud 密碼錯誤,Nextcloud Too many auth attempts'
description: Nextcloud 登入密碼多次錯誤鎖定ip
cover: /img/background/nextcloud.png
abbrlink: 6cb700d9
comments: true
date: 2024-05-19 03:30:37
---


在登入 Nextcloud 網頁時，顯示登入密碼多次錯誤鎖定 IP，而只有在內網連接時才會出現此錯誤，從外部連入卻一切正常。 

![siteBlocked](/img/blogs/nextcloud/6cb700d9/siteIPBlocked.png)


## 錯誤原因

可能在內網中有一個裝置正在嘗試使用錯誤的憑證登入。可以是安裝了的手機或平板電腦，也可以是安裝了桌面用戶端的電腦。  

而會有登入失敗 IP 鎖定功能，則是需安裝暴力破解偵測 ([nextcloud/bruteforcesettings](https://github.com/nextcloud/bruteforcesettings)) 應用程式。  

主要造成的原因是 NAT Lookback 用於透過網域存取 Nextcloud 伺服器，因此本地網路內的所有裝置都透過相同的 IP 位址存取伺服器。當一台裝置觸發暴力保護時，該 IP 位址就會被阻止，然後所有其他裝置也會受到影響。導致此問題的第二種可能性是反向代理無法將各個裝置的 IP 位址正確轉送到 Nextcloud 伺服器。


## 解決方法

如果是反向代理問題，可以檢查 Nextcloud 中的 `config.php` 是否正確設置 trusted_proxies 值，以及檢查 Nginx 反向代理的 log。  
通常 trusted_proxies 沒有正確設置，從外部連入反向代理的 log 也都會顯示路由器的 IP。  

NAT Lookback 造成被鎖路由器 IP 只能藉由刪除 Nextcloud 資料庫的 oc_bruteforce_attempts 欄位或等他冷卻結束才能解決。  

登入 Nextcloud 資料庫  

```bash
mysql -u dbadmin -p nextcloud
```

執行 `SHOW Databases;` 列出當前資料庫  

```
dbadmin@localhost [nextcloud]> 
dbadmin@localhost [nextcloud]> SHOW Databases;
+--------------------+
| Database           |
+--------------------+
| information_schema |
| mysql              |
| nextcloud          |
| performance_schema |
| sys                |
+--------------------+
5 rows in set (0.01 sec)

dbadmin@localhost [nextcloud]> 
```

執行 `USE nextcloud;` 切換至 nextcloud 資料庫  

```
dbadmin@localhost [nextcloud]> 
dbadmin@localhost [nextcloud]> USE nextcloud
Database changed
dbadmin@localhost [nextcloud]> 
```

執行 `SELECT * FROM oc_bruteforce_attempts;` 列出所有因為暴力破鎖(登入錯誤太多次)被鎖的資料  

```
dbadmin@localhost [nextcloud]> 
dbadmin@localhost [nextcloud]> SELECT * FROM oc_bruteforce_attempts;
+-----+----------------------------+------------+-------------+----------------+------------------+
| id  | action                     | occurred   | ip          | subnet         | metadata         |
+-----+----------------------------+------------+-------------+----------------+------------------+
| 264 | ShareController::showShare | 1716035235 | 192.168.1.1 | 192.168.1.1/32 | {"token":"null"} |
| 265 | ShareController::showShare | 1716035235 | 192.168.1.1 | 192.168.1.1/32 | {"token":"null"} |
| 266 | ShareController::showShare | 1716035272 | 192.168.1.1 | 192.168.1.1/32 | {"token":"null"} |
| 267 | ShareController::showShare | 1716035274 | 192.168.1.1 | 192.168.1.1/32 | {"token":"null"} |
| 268 | ShareController::showShare | 1716035350 | 192.168.1.1 | 192.168.1.1/32 | {"token":"null"} |
| 269 | ShareController::showShare | 1716035356 | 192.168.1.1 | 192.168.1.1/32 | {"token":"null"} |
+-----+----------------------------+------------+-------------+----------------+------------------+
6 rows in set (0.00 sec)

dbadmin@localhost [nextcloud]> 
```

依照上述內容主要是 NAT Lookback 造成內網中所有請求都是由路由器轉發造成的。  

再來依照你要解鎖的 IP 來撰寫刪除 query ， `DELETE FROM oc_bruteforce_attempts WHERE ip = "x.x.x.x";`  

```
dbadmin@localhost [nextcloud]> 
dbadmin@localhost [nextcloud]> DELETE FROM oc_bruteforce_attempts WHERE ip = "192.168.1.1";
Query OK, 6 rows affected (0.01 sec)

dbadmin@localhost [nextcloud]> 
```

完成後再次查看，沒意外的話都已被刪除了  

```
dbadmin@localhost [nextcloud]> 
dbadmin@localhost [nextcloud]> SELECT * FROM oc_bruteforce_attempts;
Empty set (0.00 sec)

dbadmin@localhost [nextcloud]> 
```


如果你想以後都不要被誤鎖內網，可以在 `管理員 > 管理設置 > 安全性` 中設置白名單。  
(但建議應該去查 log 看哪個裝置在搞，而不是設白名單)  

![siteWhitelist](/img/blogs/nextcloud/6cb700d9/siteWhitelist.png)


## 參考連結  
* https://help.nextcloud.com/t/here-were-too-many-requests-from-your-network-retry-later-or-contact-your-administrator-if-this-is-an-error/117230/9  
* https://help.nextcloud.com/t/cannot-login-too-many-requests/100905/12