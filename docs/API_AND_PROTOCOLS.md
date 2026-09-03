# 📡 پروتکل و پیام‌های وب‌سوکت (WebSocket Protocol & APIs)

تمام پیام‌های مبادله شده بین کلاینت (اکستنشن کروم) و سرور واسط (Bridge Server) در قالب اشیای **JSON** ارسال می‌شوند.

---

## ۱. پیام‌های SSH Terminal

### 📥 شروع نشست SSH (`ssh-init`)
```json
{
  "type": "ssh-init",
  "host": "nl.livekadeh.com",
  "port": 22,
  "username": "root",
  "password": "your_password",
  "privateKey": "-----BEGIN OPENSSH PRIVATE KEY-----...",
  "cols": 120,
  "rows": 30,
  "term": "xterm-256color"
}
```

### 📤 خروجی ترمینال از سرور (`ssh-output`)
```json
{
  "type": "ssh-output",
  "data": "\u001b[32mroot@server:~# \u001b[0m"
}
```

### 📥 ورودی کاربر به ترمینال (`ssh-input`)
```json
{
  "type": "ssh-input",
  "data": "ls -la\r"
}
```

### 📥 تغییر ابعاد پنجره ترمینال (`ssh-resize`)
```json
{
  "type": "ssh-resize",
  "cols": 140,
  "rows": 40
}
```

### 📤 وضعیت ارتباط SSH (`ssh-status`)
```json
{
  "type": "ssh-status",
  "status": "connected | connecting | disconnected | error",
  "message": "SSH session ready"
}
```

---

## ۲. پیام‌های SFTP File Manager

### 📥 شروع اتصال SFTP (`sftp-init`)
```json
{
  "type": "sftp-init",
  "host": "nl.livekadeh.com",
  "port": 22,
  "username": "root",
  "password": "your_password"
}
```

### 📥 دریافت لیست فایل‌های یک پوشه (`sftp-list`)
```json
{
  "type": "sftp-list",
  "path": "/var/www",
  "id": "req-101"
}
```
**پاسخ سرور (`sftp-list-res`):**
```json
{
  "type": "sftp-list-res",
  "id": "req-101",
  "success": true,
  "path": "/var/www",
  "files": [
    {
      "filename": "html",
      "attrs": {
        "isDirectory": true,
        "size": 4096,
        "permissions": "0755",
        "mtime": 1756891200
      }
    }
  ]
}
```

### 📥 خواندن محتوای فایل (`sftp-read`)
```json
{
  "type": "sftp-read",
  "path": "/root/test.txt",
  "id": "req-102"
}
```

### 📥 نوشتن / ذخیره فایل (`sftp-write`)
```json
{
  "type": "sftp-write",
  "path": "/root/test.txt",
  "content": "Hello LiveKadeh",
  "isBase64": false,
  "id": "req-103"
}
```

### 📥 ایجاد پوشه (`sftp-mkdir`)
```json
{
  "type": "sftp-mkdir",
  "path": "/root/new_folder",
  "id": "req-104"
}
```

### 📥 حذف فایل / پوشه (`sftp-unlink` / `sftp-rmdir`)
```json
{
  "type": "sftp-unlink",
  "path": "/root/old_file.txt",
  "id": "req-105"
}
```

### 📥 تغییر مجوز دسترسی (`sftp-chmod`)
```json
{
  "type": "sftp-chmod",
  "path": "/root/script.sh",
  "mode": "0755",
  "id": "req-106"
}
```

---

## ۳. پیام‌های سیستمی و پینگ
```json
{ "type": "ping" }  -->  { "type": "pong", "timestamp": 1756892000 }
```
