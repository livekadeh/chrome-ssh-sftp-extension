# ⚙️ راهنمای پیکربندی و راه‌اندازی سرور (Server Setup & Deployment)

این راهنما مراحل راه‌اندازی، اجرای دائمی و تنظیم Nginx با SSL برای سرور واسط (Bridge Server) را شرح می‌دهد.

---

## ۱. اجرای خودکار با PM2 (پیش‌فرض)

سرور واسط به صورت خودکار با PM2 پیکربندی شده است.

```bash
cd /root/chrome-ssh-sftp-extension/server
npm install --production
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### دستورات مدیریت سرویس در سرور:
- **مشاهده لاگ‌های زنده**: `pm2 logs chrome-ssh-sftp-bridge`
- **راه‌اندازی مجدد**: `pm2 restart chrome-ssh-sftp-bridge`
- **بررسی وضعیت و مصرف رم**: `pm2 status`

---

## ۲. پیکربندی Nginx Reverse Proxy با SSL (اختیاری برای WSS)

در صورتی که بخواهید ارتباط وب‌سوکت از طریق پروتکل امن `wss://` و پورت ۴۴۳ برقرار گردد:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location /ws {
        proxy_pass http://127.0.0.1:3000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000/health;
    }
}
```
پس از اعمال کانفیگ:
```bash
nginx -t && systemctl reload nginx
```

---

## ۳. تنظیم فایروال (UFW)
اطمینان حاصل کنید پورت ۳۰۰۰ یا ۴۴۳ در فایروال باز باشد:
```bash
ufw allow 3000/tcp
ufw allow 22/tcp
ufw reload
```
