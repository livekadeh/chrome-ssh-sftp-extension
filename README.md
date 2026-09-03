# ⚡ LiveKadeh SSH & SFTP Pro

[![GitHub Repository](https://img.shields.io/badge/GitHub-livekadeh%2Fchrome--ssh--sftp--extension-00f0ff?style=for-the-badge&logo=github)](https://github.com/livekadeh/chrome-ssh-sftp-extension)
[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-00ff9d?style=for-the-badge&logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](LICENSE)

اکستنشن حرفه‌ای و مدرن گوگل کروم (نسخه Pro) برای اتصال مستقیم به خط فرمان **SSH (با شبیه‌ساز xterm.js و پشتیبانی کامل فارسی/BiDi)** و **مدیریت فایل پیشرفته SFTP (با پروسس‌بار زنده و Chunked Upload)** همراه با سرور واسط پرسرعت (WebSocket Bridge Server).

---

## 🌟 ویژگی‌های کلیدی (Key Features)

### ⚡ ترمینال تعاملی SSH
- **شبیه‌سازی کامل ترمینال (xterm-256color)** با پشتیبانی کامل از کلیدهای کنترلی، رنگ‌بندی ANSI، نانو (Nano)، ویم (Vim) و htop.
- **پشتیبانی از چندین نشست همزمان (Multi-Session Tabs)** با امکان سوییچ سریع و باز کردن چندین ترمینال همزمان.
- **تنظیمات بصری پیشرفته**: امکان تغییر اندازه فونت، تغییر خانواده فونت (`JetBrains Mono`, `Fira Code` و ...) و انتخاب تم‌های جذاب (Cyberpunk Neon, Dracula, Tokyo Night, Monokai, Matrix).
- **امکان اتصال مجدد خودکار (Auto Reconnect) و پاکسازی سریع صفحه**.

### 📁 مدیریت فایل پیشرفته SFTP
- **مرورگر فایل حرفه‌ای**: نمایش ساختار پوشه‌ها و فایل‌ها همراه با آیکون اختصاصی فرمت‌ها، سایز، تاریخ ویرایش و مجوزهای دسترسی (Octal Permissions نظیر `0755` و `0644`).
- **آپلود آسان با Drag & Drop**: قابلیت کشیدن و رها کردن فایل‌ها از کامپیوتر به پنجره مرورگر جهت آپلود آنی.
- **دانلود سریع فایل‌ها با یک کلیک**.
- **ویرایشگر کد درون‌برنامه‌ای (Built-in Code Editor)**: باز کردن و ویرایش مستقیم فایل‌های متنی و اسکریپت‌ها روی سرور با قابلیت ذخیره آنی (`Ctrl+S`).
- **عملیات کامل فایل**: ساخت فایل/پوشه جدید، تغییر نام، حذف (فایل یا فولدر) و تغییر سطح دسترسی (`chmod`).
- **نوار دسترسی سریع (Quick Paths)** برای دایرکتوری‌های پرکاربرد سرور نظیر `/root`، `/var/www`، `/home`، `/etc` و `/var/log`.

### 🖥️ صندوقچه امن سرورها (Server Vault)
- ذخیره اطلاعات سرورها شامل هاست، پورت، نام کاربری، رمز عبور یا کلید خصوصی (SSH Key).
- برچسب‌گذاری رنگی برای تشخیص آسان محیط‌های مختلف (توسعه، تست، پروداکشن).
- امکان خروجی گرفتن (Export) و وارد کردن (Import) فایل پشتیبان کانفیگ سرورها به صورت JSON.

### 🌐 بریج سرور سبک و پرسرعت (Node.js WebSocket Bridge)
- ارتباط ایمن و کم‌تاخیر از طریق WebSocket با کتابخانه `ssh2`.
- قابلیت اجرا با PM2 به صورت دائم و مدیریت خودکار منابع.

---

## 📚 مستندات کامل پروژه (Documentation)

مستندات تفصیلی و فنی پروژه در پوشه [`docs/`](docs/) قرار دارد:
- 🏗️ **[معماری سیستم (Architecture)](docs/ARCHITECTURE.md)**: دیاگرام جریان داده و لایه‌های کلاینت و سرور
- 📡 **[پروتکل پیام‌ها و وب‌سوکت (APIs & Protocols)](docs/API_AND_PROTOCOLS.md)**: مشخصات تمام پیام‌های JSON ترمینال و SFTP
- ⚙️ **[راهنمای سرور و استقرار (Server Setup)](docs/SERVER_SETUP.md)**: دستورات PM2، Nginx با SSL و فایروال
- 🧩 **[راهنمای توسعه اکستنشن (Extension Guide)](docs/EXTENSION_GUIDE.md)**: نحوه دیباگ و افزودن ویژگی‌های جدید
- 🗺️ **[نقشه راه پروژه (Roadmap)](docs/ROADMAP.md)**: وضعیت فازها و فیچرهای بعدی

---

## 📁 ساختار پروژه (Project Structure)

```text
chrome-ssh-sftp-extension/
├── extension/                     # سورس اکستنشن گوگل کروم (Manifest V3)
│   ├── manifest.json              # مانیفست اکستنشن کروم
│   ├── popup.html                 # پنجره پاپ‌آپ سریع در نوار ابزار
│   ├── popup.css
│   ├── popup.js
│   ├── app.html                   # داشبورد کامل در تب بزرگ (ترمینال + SFTP + سرورها)
│   ├── app.css
│   ├── app.js
│   ├── ssh-terminal.js            # ماژول ترمینال با xterm.js
│   ├── sftp-manager.js            # ماژول فایل منیجر SFTP
│   ├── background.js              # Service Worker اکستنشن
│   ├── icons/                     # آیکون‌های اکستنشن (16, 48, 128)
│   └── lib/                       # کتابخانه‌های محلی xterm.js و افزونه Fit
├── server/                        # بریج سرور Node.js
│   ├── package.json
│   ├── server.js                  # وب‌سوکت بریج SSH و SFTP
│   └── ecosystem.config.js        # کانفیگ اجرای سرویس با PM2
├── deploy.sh                      # اسکریپت استقرار و اجرای خودکار روی لینوکس
└── README.md
```

---

## 🚀 راهنمای نصب و راه‌اندازی (Installation Guide)

### ۱. نصب اکستنشن در گوگل کروم (Chrome Extension Setup)

1. مرورگر گوگل کروم را باز کنید و به آدرس `chrome://extensions` بروید.
2. گزینه **Developer mode** را در گوشه بالا سمت راست فعال کنید.
3. بر روی دکمه **Load unpacked** کلیک کنید.
4. پوشه `extension` موجود در این پروژه را انتخاب نمایید.
5. آیکون ⚡ **LiveKadeh** به نوار افزونه‌های مرورگر شما اضافه خواهد شد!

---

### ۲. راه‌اندازی بریج سرور روی لینوکس (Bridge Server Setup)

برای راه‌اندازی یا بروزرسانی سرور واسط (Bridge Server):

```bash
cd /root/chrome-ssh-sftp-extension
chmod +x deploy.sh
./deploy.sh
```

یا به صورت دستی:

```bash
cd /root/chrome-ssh-sftp-extension/server
npm install
pm2 start ecosystem.config.js
pm2 save
```

وضعیت سلامت بریج سرور در آدرس‌های زیر قابل مشاهده است:
- `http://<YOUR_SERVER_IP>:3000/health`
- وب‌سوکت: `ws://<YOUR_SERVER_IP>:3000/ws` (یا `ws://localhost:3000/ws` در محیط توسعه)

---

## 🔗 ریپازیتوری گیت‌هاب (GitHub Repository)
این پروژه بر روی گیت‌هاب شما در آدرس زیر در دسترس است:
👉 **[https://github.com/livekadeh/chrome-ssh-sftp-extension](https://github.com/livekadeh/chrome-ssh-sftp-extension)**

---

## 📄 لایسنس
توسعه یافته تحت مجوز MIT توسط تیم **LiveKadeh**.
