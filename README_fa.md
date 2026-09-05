# ⚡ LiveKadeh SSH & SFTP Pro (نسخه حرفه‌ای)

[![English Version](https://img.shields.io/badge/Language-English-blue.svg)](README.md)
[![GitHub Repository](https://img.shields.io/badge/GitHub-livekadeh%2Fchrome--ssh--sftp--extension-00f0ff?style=for-the-badge&logo=github)](https://github.com/livekadeh/chrome-ssh-sftp-extension)
[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-00ff9d?style=for-the-badge&logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/)
[![Release v1.4.3](https://img.shields.io/badge/Release-v1.4.3-orange?style=for-the-badge)](https://github.com/livekadeh/chrome-ssh-sftp-extension/releases/tag/v1.4.3)
[![License: MIT](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](LICENSE)

اکستنشن حرفه‌ای و پیشرفته گوگل کروم (نسخه Pro) برای اتصال مستقیم به خط فرمان **SSH (با شبیه‌ساز قدرتمند xterm.js، پشتیبانی کامل فارسی/BiDi، و منوی کلیک‌راست کپی/پیست)** و **مدیریت فایل پیشرفته SFTP (با پخش‌کننده و نمایشگر عکس و فیلم و صوت، فشرده‌سازی، حالت پنجره مستقل و نوار پیشرفت زنده آپلود)** همراه با سرور واسط پرسرعت (WebSocket Bridge Server).

---

## 🌟 ویژگی‌های کلیدی

### ⚡ ترمینال تعاملی SSH
- **شبیه‌سازی کامل ترمینال (xterm-256color)** با پشتیبانی از تمامی کلیدهای کنترلی، رنگ‌بندی ۲۵۶ رنگ ANSI، ویرایشگرهای نانو (Nano)، ویم (Vim) و مانیتورینگ htop.
- **پشتیبانی کامل از زبان فارسی و BiDi**: اتصال صحیح حروف فارسی در خروجی و هنگام تایپ مستقیم، تراز خطوط فارسی (`text-align-last: right`) و نوار ورودی اختصاصی فارسی.
- **منوی کلیک‌راست هوشمند**: منوی شناور اختصاصی برای **کپی (Copy)**، **پیست (Paste)**، **انتخاب همه** و **پاک‌سازی صفحه**.
- **پشتیبانی از چندین نشست همزمان (Multi-Session Tabs)** با امکان جابجایی سریع بین سرورها.
- **شخصی‌سازی بصری**: تغییر اندازه فونت و انتخاب تم‌های جذاب (Cyberpunk Neon, Dracula, Tokyo Night, Monokai, Matrix).

### 📁 مدیریت فایل پیشرفته SFTP
- **پخش و نمایش مستقیم مدیا (Media Viewer & Player)**: مشاهده و پخش درون‌مرورگری عکس‌ها، ویدیوها (`.mp4`, `.webm`, `.mov`, `.mkv`) و فایل‌های صوتی (`.mp3`, `.wav`, `.ogg`, `.flac`) تنها با دو بار کلیک!
- **تغییر چیدمان نمایش (List & Grid Views)**: انتخاب بین نمای جدولی با جزئیات کامل و نمای کارتی شبکه‌ای.
- **فشرده‌سازی و استخراج آرشیو**: فشرده‌سازی فایل‌ها به `.zip` یا `.tar.gz` و استخراج روی سرور ریموت.
- **اجرای مستقل در پنجره اختصاصی دسکتاپ (Standalone App Window)** بدون نوار آدرس یا تب‌های کروم و ایجاد شورتکات دسکتاپ.
- **نوار پیشرفت زنده برای آپلود**: نمایش درصد پیشرفت، سرعت و بایت‌های منتقل‌شده هنگام آپلود فایل‌های حجیم به صورت Chunked.
- **ویرایشگر کد درون‌برنامه‌ای (Built-in Code Editor)** با کلید میانبر ذخیره فوری (`Ctrl+S`).
- **عملیات کامل فایل**: ساخت فایل/پوشه جدید، تغییر نام، حذف و تغییر سطح دسترسی (`chmod`).

### 🖥️ صندوقچه امن سرورها (Server Vault)
- ذخیره اطلاعات سرورها شامل هاست، پورت، نام کاربری، رمز عبور یا کلید خصوصی (SSH Private Key).
- برچسب‌گذاری رنگی برای تفکیک محیط‌های مختلف (توسعه، تست، پروداکشن).
- امکان خروجی گرفتن (Export) و وارد کردن (Import) فایل پشتیبان کانفیگ سرورها به صورت JSON.

### 🌐 فهرست سرورهای عمومی (Public Bridges Directory)
- دریافت خودکار و همگام‌سازی لحظه‌ای لیست سرورهای بریج عمومی از گیت‌هاب با یک کلیک.
- تست پینگ و اتصال ۱-کلیکه بدون نیاز به وارد کردن دستی آدرس.

### 📦 پکیج‌های پرتابل لوکال بریج بدون نیاز به نصب (Zero Config)
- **ویندوز**: فایل `livekadeh-bridge-windows-x64-portable.zip` حاوی `node.exe` پرتابل و فایل اجرایی `start-windows.bat` بدون نیاز به نصب هرگونه نرم‌افزار پیش‌نیاز.
- **لینوکس**: فایل `livekadeh-bridge-linux-x64.tar.gz` حاوی باینری مستقل و اسکریپت `start-linux.sh`.

---

## 🚀 راهنمای نصب و راه‌اندازی

### ۱. نصب افزونه در گوگل کروم
1. فایل زیپ افزونه [`livekadeh-ssh-sftp-extension-v1.4.3.zip`](https://github.com/livekadeh/chrome-ssh-sftp-extension/releases/download/v1.4.3/livekadeh-ssh-sftp-extension-v1.4.3.zip) را دانلود و استخراج (Extract) کنید.
2. مرورگر کروم را باز کرده و به آدرس `chrome://extensions` بروید.
3. گزینه **Developer mode** را در بالا سمت راست فعال کنید.
4. روی دکمه **Load unpacked** کلیک کرده و همان پوشه استخراج شده را انتخاب کنید (تمام فایل‌ها از جمله `manifest.json` مستقیماً در ریشه پوشه قرار دارند).
5. آیکون ⚡ **LiveKadeh** به مرورگر شما اضافه خواهد شد!

---

### ۲. راه‌اندازی بریج سرور (Bridge Server)

#### روش اول: اجرای نسخه پرتابل لوکال (روی کامپیوتر خودتان)
- **ویندوز**: پوشه زیپ پرتابل را باز کرده و روی `start-windows.bat` دو بار کلیک کنید.
- **لینوکس**: فایل آرشیو را استخراج کرده و دستور `./start-linux.sh` را اجرا کنید.

#### روش دوم: راه‌اندازی روی سرور لینوکس ابری (VPS)
```bash
git clone https://github.com/livekadeh/chrome-ssh-sftp-extension.git
cd chrome-ssh-sftp-extension
chmod +x deploy.sh
./deploy.sh
```

---

## 📜 لایسنس
این پروژه تحت لایسنس **MIT** منتشر شده است.
