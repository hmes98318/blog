---
title: Nextcloud 添加預覽生成器
tags:
  - Nextcloud
categories: Nextcloud
keywords: 'Nextcloud,Nextcloud 預覽圖片,Nextcloud 預覽生成器'
description: Nextcloud 添加預覽生成器
cover: /img/background/nextcloud.png
abbrlink: aba6d71
comments: true
date: 2023-08-28 10:02:35
---


如果想不點擊圖片、影片等檔案即可預覽內容的話可藉由以下步驟進行安裝。  


## 安裝

使用 ncadmin 登入網頁端，點擊進入應用程式安裝 **Preview Generator**   
https://apps.nextcloud.com/apps/previewgenerator  

![previewGenerator](/img/blogs/nextcloud/previewGenerator.png)

接下來使用以下命令安裝 ffmpeg  
(此安裝適用於 TrueNAS CORE Jail 的 Nextcloud ，點擊此[連結](https://ffmpeg.org/download.html)查看適用於你操作系統的安裝方式)  

```tcsh
pkg install ffmpeg
```

編輯 `config/config.php` 添加以下內容

```php
'enable_previews' => true,
'preview_max_memory' => 1024,
'enabledPreviewProviders' =>
  array (
    0 => 'OC\\Preview\\AVI',
    1 => 'OC\\Preview\\GIF',
    2 => 'OC\\Preview\\HEIC',
    3 => 'OC\\Preview\\Image',
    4 => 'OC\\Preview\\JPEG',
    5 => 'OC\\Preview\\MKV',
    6 => 'OC\\Preview\\Movie',
    7 => 'OC\\Preview\\MP3',
    8 => 'OC\\Preview\\MP4',
    9 => 'OC\\Preview\\MKV',
    10 => 'OC\\Preview\\PNG',
    11 => 'OC\\Preview\\SVG',
    12 => 'OC\\Preview\\TXT',
  ),

```

`preview_max_memory`: 依照可用的記憶體容量去做調整  
`enabledPreviewProviders`: 哪些檔案可以生成預覽圖  

詳細配置可參考此[連結](https://docs.nextcloud.com/server/latest/admin_manual/configuration_server/config_sample_php_parameters.html#enabledpreviewproviders)  


待生成的檔案過多會等比較久，我60萬筆資料等了快三天才全部生成完成  
可在 `config/config.php` 設置最大與覽圖生成尺寸來加快速度 (預設值為 null)  

```php
  'preview_max_x' => 1024,
  'preview_max_y' => 1024,
```

配置完成後使用以下命令進行全部的預覽圖生成  
(-v 為輸出的 log 詳細程度)  
```tcsh
sudo -u www /usr/local/bin/php /usr/local/www/nextcloud/occ preview:generate-all -vvv
```



完成後配置 cronjob 使用者為 www ，我設置每五分鐘執行一次  
```tcsh
crontab -u www -e


*/5 * * * * /usr/local/bin/php /usr/local/www/nextcloud/occ preview:pre-generate -v
```

完成上述配置後圖片預覽就能正常使用了  


## 刪除已生成的預覽圖

如果你想刪除生成的預覽文件可以使用以下的方法。  

{% note warning flat %}
**但不保證不會有資料錯誤的問題，建議有修復能力或知道自己在幹嘛的人再來執行，**  
**記得先拍張快照，還有把 Nextcloud 切到維護模式及停用預覽圖生成的 cronjob。**  
{% endnote %}

進入你的 datadirectory 中，會有 `appdata_<instanceid>/` 的資料夾找到與你新的 Nextcloud 實例相同的 **instanceid** 目錄，目錄下的 `preview/` 就是存放預覽圖的位置，  
進入的路徑則是 `datadirectory/appdata_<instanceid>/` ，  
接下來使用此命令刪除 `preview/` 下的所有預覽圖  

```tcsh
rm -rf preview/*
```

刪除完成後使用資料庫管理員進入 nextcloud 資料庫
```tcsh
mysql -u dbadmin -p nextcloud
```

使用此段 SQL 命令列出預覽圖的快取總數，`appdata_<instanceid>` 替換成與你實例相同的 **instanceid**   
```sql
SELECT COUNT(*) FROM oc_filecache WHERE path LIKE "appdata_oc538c7su4sg/preview/%";
```

刪除預覽圖的所有快取資料  
```sql
DELETE FROM oc_filecache WHERE path LIKE "appdata_oc538c7su4sg/preview/%";
```


```
dbadmin@localhost [nextcloud]> SELECT COUNT(*) FROM oc_filecache WHERE path LIKE "appdata_oc538c7su4sg/preview/%";
+----------+
| COUNT(*) |
+----------+
|   610830 |
+----------+
1 row in set (1.97 sec)

dbadmin@localhost [nextcloud]> 
dbadmin@localhost [nextcloud]> 
dbadmin@localhost [nextcloud]> DELETE FROM oc_filecache WHERE path LIKE "appdata_oc538c7su4sg/preview/%";

Query OK, 610830 rows affected (4 min 44.38 sec)

dbadmin@localhost [nextcloud]> 
dbadmin@localhost [nextcloud]> 
dbadmin@localhost [nextcloud]> SELECT COUNT(*) FROM oc_filecache WHERE path LIKE "appdata_oc538c7su4sg/preview/%";
+----------+
| COUNT(*) |
+----------+
|        0 |
+----------+
1 row in set (0.37 sec)

dbadmin@localhost [nextcloud]> 
```


如果不會操作資料庫也可使用以下命令達到相同效果 (也較安全)  

刪除 `preview/` 下的內容後執行此命令，
此命令將檢查 appdata 目錄並確保檔案快取與實際儲存上的檔案一致 (刪除預覽圖的快取資料)  
```tcsh
occ files:scan-app-data
```

```
root@nextcloud27:/usr/local/www/nextcloud # occ files:scan-app-data
Scanning AppData for files

+---------+--------+--------------+
| Folders | Files  | Elapsed time |
+---------+--------+--------------+
| 194131  | 404447 | 00:25:26     |
+---------+--------+--------------+
root@nextcloud27:/usr/local/www/nextcloud # 
```


完成後即可重新設置預覽圖生成器，  
關閉維護模式及啟用預覽圖生成的 cronjob 即可再次使用。  


如果對設定有甚麼問題可以參考他們的 Github  
https://github.com/nextcloud/previewgenerator  
