---
title: 在 Rocky Linux 9 Nginx 上啟用 Brotli 壓縮
tags:
  - Rocky Linux
  - Nginx
categories: Rocky Linux
keywords: 'Rocky Linux,Nginx,Brotli,網站壓縮,網頁加速,Google Brotli,網站優化,Rocky Linux 9,Nginx 模組編譯,Nginx 性能優化'
description: 在 Rocky Linux 9 Nginx 上啟用 Brotli 壓縮
cover: /img/background/nginx.svg
abbrlink: dd600bd3
comments: true
date: 2025-04-26 22:04:15
--- 


## Brotli

Brotli 是由 Google 開發的開源壓縮演算法，相較於傳統的 Gzip 壓縮，Brotli 能提供更小的檔案體積和更快的解壓速度。透過 Brotli 壓縮，可以減少網站的頻寬使用並提升使用者的網頁載入速度。

不過，Rocky Linux 9 的官方套件庫中並未提供 Nginx 的 Brotli 模組，因此我們需要手動編譯安裝。


## 環境準備

* Rocky Linux 9.5
* `nginx/1.28.0` 使用官方存儲庫安裝，[參考連結](https://docs.nginx.com/nginx/admin-guide/installing-nginx/installing-nginx-open-source/#installing-prebuilt-rhel-centos-oracle-linux-almalinux-rocky-linux-packages)

### 安裝編譯所需套件

首先，安裝編譯 Brotli 模組所需的依賴套件：

```bash
dnf install wget pcre pcre-devel zlib zlib-devel openssl openssl-devel git cmake make -y
```


## 下載並編譯 Brotli 源碼

我們需要先從 GitHub clone Google 官方的 ngx_brotli 模組：

```bash
$ cd /usr/src

$ git clone --recurse-submodules -j8 https://github.com/google/ngx_brotli

$ cd ngx_brotli/deps/brotli
$ mkdir out && cd out
```

### 使用 CMake 配置 Brotli 編譯選項

```bash
cmake -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DCMAKE_C_FLAGS="-Ofast -m64 -march=native -mtune=native -flto -funroll-loops -ffunction-sections -fdata-sections -Wl,--gc-sections" -DCMAKE_CXX_FLAGS="-Ofast -m64 -march=native -mtune=native -flto -funroll-loops -ffunction-sections -fdata-sections -Wl,--gc-sections" -DCMAKE_INSTALL_PREFIX=./installed ..
```

輸出 log 如下  

```
[root@rocky9 out]# cmake -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DCMAKE_C_FLAGS="-Ofast -m64 -march=native -mtune=native -flto -funroll-loops -ffunction-sections -fdata-sections -Wl,--gc-sections" -DCMAKE_CXX_FLAGS="-Ofast -m64 -march=native -mtune=native -flto -funroll-loops -ffunction-sections -fdata-sections -Wl,--gc-sections" -DCMAKE_INSTALL_PREFIX=./installed ..
-- The C compiler identification is GNU 11.5.0
-- Detecting C compiler ABI info
-- Detecting C compiler ABI info - done
-- Check for working C compiler: /bin/cc - skipped
-- Detecting C compile features
-- Detecting C compile features - done
-- Build type is 'Release'
-- Performing Test BROTLI_EMSCRIPTEN
-- Performing Test BROTLI_EMSCRIPTEN - Failed
-- Compiler is not EMSCRIPTEN
-- Looking for log2
-- Looking for log2 - not found
-- Looking for log2
-- Looking for log2 - found
-- Configuring done (0.4s)
-- Generating done (0.0s)
CMake Warning:
  Manually-specified variables were not used by the project:

    CMAKE_CXX_FLAGS


-- Build files have been written to: /usr/src/ngx_brotli/deps/brotli/out
[root@rocky9 out]#
```

### 編譯 Brotli

```bash
cmake --build . --config Release --target brotlienc
```

輸出 log 如下  

```
[root@rocky9 out]# cmake --build . --config Release --target brotlienc
[  3%] Building C object CMakeFiles/brotlicommon.dir/c/common/constants.c.o
[  6%] Building C object CMakeFiles/brotlicommon.dir/c/common/context.c.o
[ 10%] Building C object CMakeFiles/brotlicommon.dir/c/common/dictionary.c.o
[ 13%] Building C object CMakeFiles/brotlicommon.dir/c/common/platform.c.o
[ 17%] Building C object CMakeFiles/brotlicommon.dir/c/common/shared_dictionary.c.o
[ 20%] Building C object CMakeFiles/brotlicommon.dir/c/common/transform.c.o
[ 24%] Linking C static library libbrotlicommon.a
[ 24%] Built target brotlicommon
[ 27%] Building C object CMakeFiles/brotlienc.dir/c/enc/backward_references.c.o
[ 31%] Building C object CMakeFiles/brotlienc.dir/c/enc/backward_references_hq.c.o
[ 34%] Building C object CMakeFiles/brotlienc.dir/c/enc/bit_cost.c.o
[ 37%] Building C object CMakeFiles/brotlienc.dir/c/enc/block_splitter.c.o
[ 41%] Building C object CMakeFiles/brotlienc.dir/c/enc/brotli_bit_stream.c.o
[ 44%] Building C object CMakeFiles/brotlienc.dir/c/enc/cluster.c.o
[ 48%] Building C object CMakeFiles/brotlienc.dir/c/enc/command.c.o
[ 51%] Building C object CMakeFiles/brotlienc.dir/c/enc/compound_dictionary.c.o
[ 55%] Building C object CMakeFiles/brotlienc.dir/c/enc/compress_fragment.c.o
[ 58%] Building C object CMakeFiles/brotlienc.dir/c/enc/compress_fragment_two_pass.c.o
[ 62%] Building C object CMakeFiles/brotlienc.dir/c/enc/dictionary_hash.c.o
[ 65%] Building C object CMakeFiles/brotlienc.dir/c/enc/encode.c.o
[ 68%] Building C object CMakeFiles/brotlienc.dir/c/enc/encoder_dict.c.o
[ 72%] Building C object CMakeFiles/brotlienc.dir/c/enc/entropy_encode.c.o
[ 75%] Building C object CMakeFiles/brotlienc.dir/c/enc/fast_log.c.o
[ 79%] Building C object CMakeFiles/brotlienc.dir/c/enc/histogram.c.o
[ 82%] Building C object CMakeFiles/brotlienc.dir/c/enc/literal_cost.c.o
[ 86%] Building C object CMakeFiles/brotlienc.dir/c/enc/memory.c.o
[ 89%] Building C object CMakeFiles/brotlienc.dir/c/enc/metablock.c.o
[ 93%] Building C object CMakeFiles/brotlienc.dir/c/enc/static_dict.c.o
[ 96%] Building C object CMakeFiles/brotlienc.dir/c/enc/utf8_util.c.o
[100%] Linking C static library libbrotlienc.a
[100%] Built target brotlienc
[root@rocky9 out]# 
```

編譯完成後，返回上層目錄：  

```bash
cd ../../../..
```


## 編譯 Nginx Brotli 模組

### 下載 Nginx 源碼

確保下載的 Nginx 源碼版本與系統上運行的 Nginx 版本一致：

```bash
wget https://nginx.org/download/nginx-1.28.0.tar.gz
tar -xzf nginx-1.28.0.tar.gz
cd nginx-1.28.0
```

### 配置並編譯動態模組

使用 `--with-compat` 參數確保相容性，並指定 ngx_brotli 模組的位置：

```bash
./configure --with-compat --add-dynamic-module=/usr/src/ngx_brotli
```

輸出 log 如下  

```
[root@rocky9 nginx-1.28.0]# ./configure --with-compat --add-dynamic-module=/usr/src/ngx_brotli
checking for OS
 + Linux 5.14.0-503.40.1.el9_5.x86_64 x86_64
checking for C compiler ... found
 + using GNU C compiler
 + gcc version: 11.5.0 20240719 (Red Hat 11.5.0-5) (GCC)
checking for gcc -pipe switch ... found
checking for -Wl,-E switch ... found
checking for gcc builtin atomic operations ... found
checking for C99 variadic macros ... found
checking for gcc variadic macros ... found
checking for gcc builtin 64 bit byteswap ... found
checking for unistd.h ... found
checking for inttypes.h ... found
checking for limits.h ... found
checking for sys/filio.h ... not found
checking for sys/param.h ... found
checking for sys/mount.h ... found
checking for sys/statvfs.h ... found
checking for crypt.h ... found
checking for Linux specific features
checking for epoll ... found
checking for EPOLLRDHUP ... found
checking for EPOLLEXCLUSIVE ... found
checking for eventfd() ... found
checking for O_PATH ... found
checking for sendfile() ... found
checking for sendfile64() ... found
checking for sys/prctl.h ... found
checking for prctl(PR_SET_DUMPABLE) ... found
checking for prctl(PR_SET_KEEPCAPS) ... found
checking for capabilities ... found
checking for crypt_r() ... found
checking for sys/vfs.h ... found
checking for BPF sockhash ... found
checking for SO_COOKIE ... found
checking for UDP_SEGMENT ... found
checking for nobody group ... found
checking for poll() ... found
checking for /dev/poll ... not found
checking for kqueue ... not found
checking for crypt() ... not found
checking for crypt() in libcrypt ... found
checking for F_READAHEAD ... not found
checking for posix_fadvise() ... found
checking for O_DIRECT ... found
checking for F_NOCACHE ... not found
checking for directio() ... not found
checking for statfs() ... found
checking for statvfs() ... found
checking for dlopen() ... found
checking for sched_yield() ... found
checking for sched_setaffinity() ... found
checking for SO_SETFIB ... not found
checking for SO_REUSEPORT ... found
checking for SO_ACCEPTFILTER ... not found
checking for SO_BINDANY ... not found
checking for IP_TRANSPARENT ... found
checking for IP_BINDANY ... not found
checking for IP_BIND_ADDRESS_NO_PORT ... found
checking for IP_RECVDSTADDR ... not found
checking for IP_SENDSRCADDR ... not found
checking for IP_PKTINFO ... found
checking for IPV6_RECVPKTINFO ... found
checking for IP_MTU_DISCOVER ... found
checking for IPV6_MTU_DISCOVER ... found
checking for IP_DONTFRAG ... not found
checking for IPV6_DONTFRAG ... found
checking for TCP_DEFER_ACCEPT ... found
checking for TCP_KEEPIDLE ... found
checking for TCP_FASTOPEN ... found
checking for TCP_INFO ... found
checking for accept4() ... found
checking for int size ... 4 bytes
checking for long size ... 8 bytes
checking for long long size ... 8 bytes
checking for void * size ... 8 bytes
checking for uint32_t ... found
checking for uint64_t ... found
checking for sig_atomic_t ... found
checking for sig_atomic_t size ... 4 bytes
checking for socklen_t ... found
checking for in_addr_t ... found
checking for in_port_t ... found
checking for rlim_t ... found
checking for uintptr_t ... uintptr_t found
checking for system byte ordering ... little endian
checking for size_t size ... 8 bytes
checking for off_t size ... 8 bytes
checking for time_t size ... 8 bytes
checking for AF_INET6 ... found
checking for setproctitle() ... not found
checking for pread() ... found
checking for pwrite() ... found
checking for pwritev() ... found
checking for strerrordesc_np() ... found
checking for localtime_r() ... found
checking for clock_gettime(CLOCK_MONOTONIC) ... found
checking for posix_memalign() ... found
checking for memalign() ... found
checking for mmap(MAP_ANON|MAP_SHARED) ... found
checking for mmap("/dev/zero", MAP_SHARED) ... found
checking for System V shared memory ... found
checking for POSIX semaphores ... found
checking for struct msghdr.msg_control ... found
checking for ioctl(FIONBIO) ... found
checking for ioctl(FIONREAD) ... found
checking for struct tm.tm_gmtoff ... found
checking for struct dirent.d_namlen ... not found
checking for struct dirent.d_type ... found
checking for sysconf(_SC_NPROCESSORS_ONLN) ... found
checking for sysconf(_SC_LEVEL1_DCACHE_LINESIZE) ... found
checking for openat(), fstatat() ... found
checking for getaddrinfo() ... found
configuring additional dynamic modules
adding module in /usr/src/ngx_brotli
 + ngx_brotli was configured
checking for PCRE2 library ... not found
checking for PCRE library ... found
checking for PCRE JIT support ... found
checking for zlib library ... found
creating objs/Makefile

Configuration summary
  + using system PCRE library
  + OpenSSL library is not used
  + using system zlib library

  nginx path prefix: "/usr/local/nginx"
  nginx binary file: "/usr/local/nginx/sbin/nginx"
  nginx modules path: "/usr/local/nginx/modules"
  nginx configuration prefix: "/usr/local/nginx/conf"
  nginx configuration file: "/usr/local/nginx/conf/nginx.conf"
  nginx pid file: "/usr/local/nginx/logs/nginx.pid"
  nginx error log file: "/usr/local/nginx/logs/error.log"
  nginx http access log file: "/usr/local/nginx/logs/access.log"
  nginx http client request body temporary files: "client_body_temp"
  nginx http proxy temporary files: "proxy_temp"
  nginx http fastcgi temporary files: "fastcgi_temp"
  nginx http uwsgi temporary files: "uwsgi_temp"
  nginx http scgi temporary files: "scgi_temp"

[root@rocky9 nginx-1.28.0]#
```

執行模組編譯：

```bash
make modules
```

輸出 log 如下  

```
[root@rocky9 nginx-1.28.0]# make modules
make -f objs/Makefile modules
make[1]: Entering directory '/usr/src/nginx-1.28.0'
cc -c -fPIC -pipe  -O -W -Wall -Wpointer-arith -Wno-unused-parameter -Werror -g  -Wno-deprecated-declarations -I src/core -I src/event -I src/event/modules -I src/event/quic -I src/os/unix -I /usr/src/ngx_brotli/deps/brotli/c/include -I objs -I src/http -I src/http/modules \
        -o objs/addon/filter/ngx_http_brotli_filter_module.o \
        /usr/src/ngx_brotli/filter/ngx_http_brotli_filter_module.c
cc -c -fPIC -pipe  -O -W -Wall -Wpointer-arith -Wno-unused-parameter -Werror -g  -Wno-deprecated-declarations -I src/core -I src/event -I src/event/modules -I src/event/quic -I src/os/unix -I /usr/src/ngx_brotli/deps/brotli/c/include -I objs -I src/http -I src/http/modules \
        -o objs/ngx_http_brotli_filter_module_modules.o \
        objs/ngx_http_brotli_filter_module_modules.c
cc -o objs/ngx_http_brotli_filter_module.so \
objs/addon/filter/ngx_http_brotli_filter_module.o \
objs/ngx_http_brotli_filter_module_modules.o \
-L/usr/src/ngx_brotli/deps/brotli/c/../out -lbrotlienc -lbrotlicommon -lm \
-shared
lto-wrapper: warning: using serial compilation of 6 LTRANS jobs
cc -c -fPIC -pipe  -O -W -Wall -Wpointer-arith -Wno-unused-parameter -Werror -g  -Wno-deprecated-declarations -I src/core -I src/event -I src/event/modules -I src/event/quic -I src/os/unix -I /usr/src/ngx_brotli/deps/brotli/c/include -I objs -I src/http -I src/http/modules \
        -o objs/addon/static/ngx_http_brotli_static_module.o \
        /usr/src/ngx_brotli/static/ngx_http_brotli_static_module.c
cc -c -fPIC -pipe  -O -W -Wall -Wpointer-arith -Wno-unused-parameter -Werror -g  -Wno-deprecated-declarations -I src/core -I src/event -I src/event/modules -I src/event/quic -I src/os/unix -I /usr/src/ngx_brotli/deps/brotli/c/include -I objs -I src/http -I src/http/modules \
        -o objs/ngx_http_brotli_static_module_modules.o \
        objs/ngx_http_brotli_static_module_modules.c
cc -o objs/ngx_http_brotli_static_module.so \
objs/addon/static/ngx_http_brotli_static_module.o \
objs/ngx_http_brotli_static_module_modules.o \
-shared
make[1]: Leaving directory '/usr/src/nginx-1.28.0'
[root@rocky9 nginx-1.28.0]#
```


## 安裝 Brotli 模組到 Nginx

編譯成功後，在 `objs/` 目錄中可以看到兩個 `.so` 檔案：
- `ngx_http_brotli_filter_module.so`：用於即時壓縮
- `ngx_http_brotli_static_module.so`：用於提供預先壓縮的檔案

```
[root@rocky9 nginx-1.28.0]# ll objs/
total 1372
drwxr-xr-x. 4 root root      34 May 22 11:44 addon
-rw-r--r--. 1 root root   18280 May 22 11:44 autoconf.err
-rw-r--r--. 1 root root   43404 May 22 11:44 Makefile
-rw-r--r--. 1 root root    8460 May 22 11:44 ngx_auto_config.h
-rw-r--r--. 1 root root     657 May 22 11:44 ngx_auto_headers.h
-rw-r--r--. 1 root root     883 May 22 11:44 ngx_http_brotli_filter_module_modules.c
-rw-r--r--. 1 root root   25096 May 22 11:45 ngx_http_brotli_filter_module_modules.o
-rwxr-xr-x. 1 root root 1179032 May 22 11:45 ngx_http_brotli_filter_module.so
-rw-r--r--. 1 root root     303 May 22 11:44 ngx_http_brotli_static_module_modules.c
-rw-r--r--. 1 root root   24016 May 22 11:45 ngx_http_brotli_static_module_modules.o
-rwxr-xr-x. 1 root root   71536 May 22 11:45 ngx_http_brotli_static_module.so
-rw-r--r--. 1 root root    5856 May 22 11:44 ngx_modules.c
drwxr-xr-x. 9 root root      91 May 22 11:44 src
[root@rocky9 nginx-1.28.0]#
```

將這些模組檔案複製到 Nginx server 的模組目錄中。  

```bash
cp objs/ngx_http_brotli_*.so /usr/lib64/nginx/modules/
```


## 配置 Nginx 載入 Brotli 模組

修改 Nginx 主配置檔案 `/etc/nginx/nginx.conf`，加入 Brotli 模組。  

```conf
user nginx;

pid /run/nginx.pid;

worker_processes auto;
worker_rlimit_nofile  65536;

error_log /var/log/nginx/error.log;

# Module
load_module modules/ngx_http_brotli_filter_module.so;
load_module modules/ngx_http_brotli_static_module.so;

events {
    use epoll;
    worker_connections 16384;
    multi_accept on;
}

# ...

```

在 http 區塊 `conf.d/*.conf` 中啟用 Brotli 壓縮。  

```conf
http {
    # ...

    # 啟用 Brotli 壓縮
    brotli on;
    brotli_comp_level 4;  # 壓縮等級 (0-11)
    brotli_types 
        text/plain
        text/css
        text/javascript
        text/xml
        text/x-component
        application/javascript
        application/x-javascript
        application/json
        application/xml
        application/rss+xml
        application/atom+xml
        application/vnd.ms-fontobject
        font/truetype
        font/opentype
        image/svg+xml;
}
```


## 測試與啟用設定

檢查 Nginx 配置是否有錯誤：  

```bash
nginx -t
```

如果配置正確，重新載入 Nginx：  

```bash
nginx -s reload
```


## 驗證 Brotli 是否生效

使用 curl 測試 Brotli 壓縮是否生效：  

```bash
curl -H 'Accept-Encoding: br' -I https://<domain.com>
```

如果看到 response headers 中包含 `Content-Encoding: br`，表示 Brotli 壓縮已成功啟用。  


## 參考資料

* [Google Brotli GitHub 儲存庫](https://github.com/google/brotli)
* https://docs.nginx.com/nginx/admin-guide/installing-nginx/installing-nginx-open-source/#installing-prebuilt-rhel-centos-oracle-linux-almalinux-rocky-linux-packages
* https://www.cnblogs.com/-wenli/p/13594882.html
