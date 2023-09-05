---
title: Nextcloud 遷移指南
tags:
  - Nextcloud
  - TrueNAS
categories: Nextcloud
keywords: 'Nextcloud,TrueNAS Nextcloud,Nextcloud Jail,Nextcloud 504 塊組裝錯誤'
description: Nextcloud 遷移指南
cover: /img/background/nextcloud.png
abbrlink: 811961c1
comments: true
date: 2023-08-27 22:10:02
---


最近升級了伺服器所以也打算來更新一下我年久失修的 Nextcloud ，他的版本還停留在 24.0.1.1 ，  
由於我的 Nextcloud 是使用 TrueNAS 的 Jail 來架設的，所以本篇主要以 TrueNAS 的 Jail 遷移為主。  

本次的環境使用 DELL R720XD 運行 **TrueNAS CORE 13.0-U5.3**  


## 前置作業

開始進行前記得先幫資料拍張快照，避免造成不可逆的損失。  
![createSnapshot](/img/blogs/nextcloud/createSnapshot.png)

使用 TrueNAS 的插件添加新的 Nextcloud，因為本次升級的版本為 27.0.2.1 所以我把名稱設為 nextcloud27  
![pluginAdd](/img/blogs/nextcloud/pluginAdd.png)

安裝完成後記下以下內容，如果忘了也可以到插件那邊找。  
![installSuccessMsg](/img/blogs/nextcloud/installSuccessMsg.png)

給新的 Nextcloud 資料添加掛載點，與舊的相同路徑。
![mountPoint](/img/blogs/nextcloud/mountPoint.png)


## 拉取設定檔

接下來把舊的 Nextcloud 資料拉出來，使用 SSH 進入 TrueNAS ，  
用 `iocage list` 列出當前的所有 Jail ，使用 `iocage exec <舊的 nextcloud ip> tcsh` 進入 Jail。  
![iocageExec](/img/blogs/nextcloud/iocageExec.png)

進入 Nextcloud 主目錄  
```tcsh
cd /usr/local/www/nextcloud
```

### 備份 config.php

打印出 `config/config.php` 設定檔，把上面的資料複製出來。  
```tcsh
cat config/config.php
```

```php
<?php
$CONFIG = array (
  'apps_paths' =>
  array (
    0 =>
    array (
      'path' => '/usr/local/www/nextcloud/apps',
      'url' => '/apps',
      'writable' => true,
    ),
    1 =>
    array (
      'path' => '/usr/local/www/nextcloud/apps-pkg',
      'url' => '/apps-pkg',
      'writable' => false,
    ),
  ),
  'loglevel' => 3,
  'logfile' => '/var/log/nextcloud/nextcloud.log',
  'memcache.local' => '\\OC\\Memcache\\APCu',
  'one-click-instance' => true,
  'one-click-instance.user-limit' => 100,
  'memcache.distributed' => '\\OC\\Memcache\\Redis',
  'memcache.locking' => '\\OC\\Memcache\\Redis',
  'redis' =>
  array (
    'host' => 'localhost',
  ),
  'passwordsalt' => 's5qDYMUxxxxxxxxxx57wu+K',
  'secret' => 'dV4D3axxxxxxxxxxxxxxxxxxxxxxxRODiQ',
  'trusted_domains' =>
  array (
    0 => 'xxxxxx.com',
    1 => '192.168.*.*',
  ),
  'datadirectory' => '/usr/local/www/nextcloud/nextclouddata',
  'dbtype' => 'mysql',
  'version' => '24.0.1.1',
  'trusted_proxies' =>
  array (
    0 => '192.168.1.120',
  ),
  'forwarded_for_headers' =>
  array (
    0 => 'HTTP_X_FORWARDED_FOR',
  ),
  'dbname' => 'nextcloud',
  'dbhost' => 'localhost',
  'dbport' => '',
  'dbtableprefix' => 'oc_',
  'mysql.utf8mb4' => true,
  'dbuser' => 'oc_ncadmin',
  'dbpassword' => 'xxxxxxxxxx',
  'installed' => true,
  'instanceid' => 'oc538c7su4sg',
  'force_language' => 'zh_TW',
  'default_language' => 'zh_TW',
  'mail_from_address' => 'xxxxxxxxxx',
  'mail_smtpmode' => 'smtp',
  'mail_sendmailmode' => 'smtp',
  'mail_domain' => 'gmail.com',
  'mail_smtpauthtype' => 'LOGIN',
  'mail_smtpsecure' => 'ssl',
  'mail_smtpauth' => 1,
  'mail_smtphost' => 'smtp.gmail.com',
  'mail_smtpport' => '465',
  'mail_smtpname' => 'xxxxxxxxxx@gmail.com',
  'mail_smtppassword' => 'xxxxxxxxxx',
  'maintenance' => false,
  'enable_previews' => true,
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
  'app_install_overwrite' =>
  array (
    0 => 'hancomoffice',
    1 => 'suspicious_login',
  ),
  'allow_local_remote_servers' => true,
  'preview_max_memory' => 512,
  'updater.release.channel' => 'stable',
);

```

在新的 config.php 設置中 `passwordsalt`, `secret` 需與舊的完全相同

`passwordsalt`: 用來增加密碼安全性的隨機字串。用來對使用者密碼進行哈希處理，以增加密碼的安全性，即使相同的密碼在不同的帳戶中也會有不同的哈希值。  
`secret`: 用來增加安全性的隨機字串。它在多個方面被使用，例如用於生成驗證令牌、會話驗證、加密等等。  

如果 `passwordsalt` 或 `secret` 值變更，使用者的密碼和會話驗證可能會失效，會導致無法正常登入 Nextcloud。  

`datadirectory` 則為掛載的外部資料集位置。  

### 導出資料庫

使用以下命令把 Nextcloud 的資料庫轉移出來，並使用 scp 之類的把導出的資料轉移出去。  
(密碼可以在 TrueNAS 的插件那邊找到)  
```tcsh
mysqldump -u dbadmin -p nextcloud > nextcloud_backup.sql
```

完成以上步驟後接下來就可以開始配置新的 Nextcloud 了。  


## 開始配置

使用 `iocage exec <新的 nextcloud ip> tcsh` 進入 Jail。  
進入 Nextcloud 主目錄  
```tcsh
cd /usr/local/www/nextcloud
```

### 配置 config.php

把剛剛備份的 `config.php` 配置使用 vi 或 vim 進行填寫，  
必須一樣的參數為 `passwordsalt`, `secret`，其他的則依照狀況進行修改。  
(如果 vim 沒安裝則需使用 `pkg install vim` 進行安裝)  

```tcsh
vim config/config.php
```

### 導入資料庫

把剛剛備份出來的 `nextcloud_backup.sql` 用 scp 之類的工具把他傳進來，  
並使用以下命令進行導入。  

```tcsh
mysql -u dbadmin -p nextcloud < nextcloud_backup.sql
```

導入完成後使用 occ 命令進行更新。  
```tcsh
occ upgrade
```

如果升級時出現類似下列內容的資料庫錯誤  

{% note no-icon %}
Exception: Database error when running migration 4002Date20220922094803 for app suspicious_login
The table with name 'nextcloud.oc_login_ips_aggregated' already exists.
Update failed
Maintenance mode is kept active
Resetting log level
{% endnote %}

則須進入資料庫中將該 table 刪除。  

```tcsh
mysql -u dbadmin -p nextcloud
```

使用此 SQL 指令刪除 **nextcloud.oc_login_ips_aggregated** table。  

```sql
DROP TABLE nextcloud.oc_login_ips_aggreated;
```

完成後再次執行 `occ upgrade` 進行更新，如果有出現其他 table 有同樣問題則重複上述步驟即可。  

升級完成後再使用此 occ 命令檢查資料庫是否有缺少 indexes ，如果有則會自動添加。  

```tcsh
occ db:add-missing-indices
```

上述步驟完成後輸入 Nextcloud 的 IP 打開網頁就能看到升級成功了。


## 其他優化配置


### PHP-FPM 最佳化效能

修改 `/usr/local/etc/php-fpm.d/nextcloud.conf`  

```conf
[nextcloud]
user = www
group = www

listen = /var/run/nextcloud-php-fpm.sock
listen.owner = www
listen.group = www

pm = dynamic
pm.max_children = 256
pm.start_servers = 48
pm.min_spare_servers = 32
pm.max_spare_servers = 64

php_admin_value[session.save_path] = "/usr/local/www/nextcloud-sessions-tmp"
; Nextcloud wants PATH environment variable set.
env[PATH] = $PATH
```

`pm.max_children`, `pm.min_spare_servers`, `pm.max_spare_servers` 則依照自己的 Server 效能下去調整  
PHP-FPM Process Calculator: https://spot13.com/pmcalculator/  

詳細內容可參考此篇文章  
https://blog.gtwang.org/linux/nginx-php-fpm-configuration-optimization/  


其他設置可參考以下文章
* [Nextcloud 添加預覽生成器](/posts/aba6d71)
* [Nextcloud 提高上傳檔案大小上限](/posts/99b26485)
* [Nextcloud 添加 Nginx 反向代理](/posts/efd7b7b9)