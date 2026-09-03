/**
 * LiveKadeh SSH & SFTP Pro - Internationalization (i18n) Engine
 * Default Language: English ('en')
 * Supported: English ('en'), Persian ('fa')
 */

const I18N_DICTIONARY = {
  en: {
    // Navigation
    nav_terminal: 'SSH Terminal',
    nav_sftp: 'SFTP File Manager',
    nav_servers: 'Saved Servers',
    nav_settings: 'Settings',
    nav_about: 'About',
    not_connected: 'Not Connected',
    btn_new_connection: '+ New Connection',

    // Terminal Toolbar
    term_new_tab: 'New Terminal Tab',
    term_toggle_rtl: '↔ RTL Persian',
    term_reconnect: 'Reconnect Session',
    term_clear: 'Clear Terminal',
    term_font_minus: 'Decrease Font',
    term_font_plus: 'Increase Font',
    term_empty_title: 'No Active SSH Session',
    term_empty_desc: 'Connect to a server from the connection modal or saved servers list.',
    term_connect_now: 'Connect to Server 🚀',

    // Persian Bar
    persian_bar_badge: '⚡ Persian Input:',
    persian_bar_placeholder: 'Type Persian text or commands (Press Enter to send)...',
    persian_bar_send: 'Send ↵',

    // Context Menu
    ctx_copy: 'Copy',
    ctx_paste: 'Paste',
    ctx_select_all: 'Select All',
    ctx_clear: 'Clear Screen',

    // SFTP
    sftp_quick_paths: 'Quick Paths',
    sftp_upload_btn: 'Upload Files',
    sftp_new_folder: 'New Folder',
    sftp_new_file: 'New File',
    sftp_parent_dir: 'Go to parent directory',
    sftp_refresh: 'Refresh directory',
    sftp_search_placeholder: 'Filter files in current folder...',
    sftp_th_name: 'Name',
    sftp_th_size: 'Size',
    sftp_th_perms: 'Permissions',
    sftp_th_modified: 'Modified',
    sftp_th_actions: 'Actions',
    sftp_uploading_chunked: 'Uploading file (chunked)...',

    // SFTP Context Menu
    sftp_ctx_open: 'Open',
    sftp_ctx_download: 'Download',
    sftp_ctx_edit: 'Edit File',
    sftp_ctx_extract: 'Extract Archive (Unpack)',
    sftp_extract_btn: '📦 Extract',
    sftp_ctx_rename: 'Rename',
    sftp_ctx_chmod: 'Permissions (Chmod)',
    sftp_ctx_copy_path: 'Copy Full Path',
    sftp_ctx_delete: 'Delete',
    sftp_ctx_upload: 'Upload Files...',
    sftp_ctx_new_folder: 'New Folder',
    sftp_ctx_new_file: 'New File',
    sftp_ctx_copy_dir: 'Copy Directory Path',
    sftp_ctx_parent_dir: 'Parent Directory',
    sftp_ctx_refresh: 'Refresh Directory',
    sftp_compress_btn: '🗜️ Compress',
    sftp_ctx_compress: 'Compress (Zip / Tar)',
    sftp_preview_btn: '👁️ Preview / Play',
    sftp_ctx_preview: 'Preview / Play Media',
    sftp_view_list: 'List View',
    sftp_view_grid: 'Grid View',
    sftp_items_count: 'items',
    sftp_selected_count: 'item(s) selected',
    sftp_no_selection: 'No files selected',
    media_modal_title: 'Media Viewer',
    media_loading: 'Loading media file...',

    // Active Sessions Drawer
    drawer_title: 'Active Servers & Sessions',
    drawer_open_servers: 'Open Servers',
    drawer_active_btn: 'Active Servers',
    drawer_sftp_sessions: 'Active SFTP Managers',
    drawer_ssh_sessions: 'Active SSH Terminals',
    drawer_quick_servers: 'Quick Connect Saved Servers',
    drawer_switch_sftp: 'Switch SFTP 📁',
    drawer_switch_ssh: 'Terminal ⚡',
    drawer_close_session: 'Disconnect',
    drawer_no_sftp: 'No active SFTP session connected',
    drawer_no_ssh: 'No active SSH terminal open',
    drawer_new_conn: '+ New Connection',

    // Servers View
    servers_title: 'Saved Server Vault',
    servers_desc: 'Securely manage and launch connections to your remote SSH/SFTP servers.',
    servers_search_placeholder: 'Search by server name or host IP...',
    servers_add_btn: '+ Add Server',
    servers_export_btn: 'Export JSON',
    servers_import_btn: 'Import JSON',
    srv_card_ssh: '⚡ SSH Terminal',
    srv_card_sftp: '📁 SFTP Manager',
    srv_edit: 'Edit',
    srv_delete: 'Delete',
    srv_empty_msg: 'No servers saved yet. Click "+ Add Server" to configure your first server.',
    srv_delete_confirm: 'Are you sure you want to delete server',

    // Settings View
    settings_title: 'Application Settings',
    settings_bridge_label: 'WebSocket Bridge URL',
    settings_bridge_hint: 'The local or remote bridge daemon handling raw SSH/SFTP connections.',
    settings_test_bridge: 'Test Bridge Connection',
    settings_public_bridges: 'Public Community Bridges',
    settings_fetch_bridges: 'Fetch Latest from GitHub 🔄',
    settings_theme_label: 'Terminal Color Scheme',
    settings_font_label: 'Terminal Font Family',
    settings_save_btn: 'Save Settings',
    settings_saved_alert: 'Settings saved successfully ✔',
    settings_test_running: 'Testing connection...',
    settings_test_timeout: 'Error: Connection timed out',
    settings_test_success: 'Bridge connected successfully 🚀',
    settings_test_failed: 'WebSocket connection failed',

    // Modal
    modal_title_connect: 'Connect to Server',
    modal_title_edit: 'Edit Server',
    modal_title_new: 'New Server Connection',
    modal_err_host: 'Please enter a server host address.',
    modal_label_name: 'Server Label',
    modal_label_host: 'Host IP / Domain',
    modal_label_port: 'Port',
    modal_label_user: 'Username',
    modal_label_pass: 'Password',
    modal_label_key: 'SSH Private Key (Optional)',
    modal_btn_connect_term: 'Connect SSH ⚡',
    modal_btn_connect_sftp: 'Open SFTP 📁',
    modal_btn_cancel: 'Cancel',

    // Popup
    popup_quick_connect: 'Quick Connect to Server',
    popup_saved_servers: 'Saved Servers',
    popup_manage: 'Manage +',
    popup_bridge_checking: 'Bridge: Checking...',
    popup_host_placeholder: 'Server IP or Host (e.g. 192.168.1.100)',
    popup_user_placeholder: 'User (e.g. root)',
    popup_port_placeholder: 'Port (22)',
    popup_pass_placeholder: 'Password or key',

    // About
    about_desc: 'High-performance, in-browser SSH Terminal with complete Persian/BiDi cursive shaping and full-featured SFTP File Manager powered by WebSocket bridge architecture.',
    about_btn_check_update: 'Check for Updates 🔄',
    about_feat_term_title: 'Interactive SSH Terminal',
    about_feat_term_desc: 'Full xterm-256color emulation, ANSI colors, tabs, custom themes, and complete Persian/BiDi shaping with right-click Copy/Paste.',
    about_feat_sftp_title: 'Advanced SFTP Explorer',
    about_feat_sftp_desc: 'Fast chunked uploads with live progress bar, drag & drop, in-browser file editor with Ctrl+S, permissions chmod, and rich context menu.',
    about_feat_security_title: 'Local & Encrypted Storage',
    about_feat_security_desc: 'All server credentials and private keys are stored strictly in your browser local storage with JSON backup export/import.',
    about_feat_bridge_title: 'High-Speed Bridge Server',
    about_feat_bridge_desc: 'Node.js ssh2 WebSocket bridge proxying raw SSH and SFTP streams with low latency, portable zero-config runners available.',
    about_desktop_title: 'Run as Standalone Window / Desktop App',
    about_desktop_desc: 'You can run this extension outside of Chrome browser tabs in a clean, dedicated desktop application window without address bar or bookmarks.',
    about_desktop_how: '💡 How to install as a Desktop App icon in Chrome:',
    about_desktop_steps: '<li>Click the 3 dots menu in Chrome (top-right corner).</li><li>Go to <b>Cast, save, and share</b> (or More tools) &rarr; <b>Create shortcut...</b></li><li>Check the box <b>"Open as window"</b> and click <b>Create</b>.</li><li>A desktop icon and taskbar app will be created to launch directly!</li>',
    about_checking: 'Checking GitHub for updates...',
    nav_standalone_window: 'Open in Standalone App Window',
    nav_standalone_btn: 'App Window ⤢',
    about_up_to_date: 'You are using the latest version (v1.4.0) ✔',
    about_update_available: 'New version available:',
    about_btn_download_update: 'Download New Version 📥',

    // Language Toggle
    lang_btn: '🌐 English',
  },
  fa: {
    // Navigation
    nav_terminal: 'ترمینال SSH',
    nav_sftp: 'فایل منیجر SFTP',
    nav_servers: 'سرورهای ذخیره‌شده',
    nav_settings: 'تنظیمات',
    nav_about: 'درباره ما',
    not_connected: 'اتصال برقرار نیست',
    btn_new_connection: '+ اتصال جدید',

    // Terminal Toolbar
    term_new_tab: 'ترمینال جدید',
    term_toggle_rtl: '↔ راست‌چین فارسی',
    term_reconnect: 'اتصال مجدد',
    term_clear: 'پاک کردن ترمینال',
    term_font_minus: 'کاهش فونت',
    term_font_plus: 'افزایش فونت',
    term_empty_title: 'ترمینال SSH فعال نیست',
    term_empty_desc: 'جهت اتصال به سرور و باز کردن خط فرمان، از دکمه اتصال جدید یا لیست سرورها استفاده کنید.',
    term_connect_now: 'اتصال به سرور 🚀',

    // Persian Bar
    persian_bar_badge: '⚡ ورودی فارسی:',
    persian_bar_placeholder: 'تایپ مستقیم دستور یا پیام به زبان فارسی (با زدن Enter ارسال می‌شود)...',
    persian_bar_send: 'ارسال ↵',

    // Context Menu
    ctx_copy: 'کپی (Copy)',
    ctx_paste: 'پیست (Paste)',
    ctx_select_all: 'انتخاب همه',
    ctx_clear: 'پاک‌سازی صفحه',

    // SFTP
    sftp_quick_paths: 'مسیرهای سریع',
    sftp_upload_btn: 'آپلود فایل‌ها',
    sftp_new_folder: 'پوشه جدید',
    sftp_new_file: 'فایل جدید',
    sftp_parent_dir: 'یک سطح بالاتر',
    sftp_refresh: 'بارگذاری مجدد',
    sftp_search_placeholder: 'جستجو در این پوشه...',
    sftp_th_name: 'نام فایل / پوشه',
    sftp_th_size: 'حجم',
    sftp_th_perms: 'سطح دسترسی',
    sftp_th_modified: 'تاریخ ویرایش',
    sftp_th_actions: 'عملیات',
    sftp_uploading_chunked: 'در حال آپلود تکه‌ای فایل...',

    // SFTP Context Menu
    sftp_ctx_open: 'باز کردن',
    sftp_ctx_download: 'دانلود',
    sftp_ctx_edit: 'ویرایش فایل',
    sftp_ctx_extract: 'استخراج فایل فشرده (Extract)',
    sftp_extract_btn: '📦 استخراج',
    sftp_ctx_rename: 'تغییر نام',
    sftp_ctx_chmod: 'تغییر سطح دسترسی (Chmod)',
    sftp_ctx_copy_path: 'کپی مسیر کامل',
    sftp_ctx_delete: 'حذف',
    sftp_ctx_upload: 'آپلود فایل‌ها...',
    sftp_ctx_new_folder: 'پوشه جدید',
    sftp_ctx_new_file: 'فایل جدید',
    sftp_ctx_copy_dir: 'کپی آدرس این پوشه',
    sftp_ctx_parent_dir: 'یک سطح بالاتر',
    sftp_ctx_refresh: 'بروزرسانی',
    sftp_compress_btn: '🗜️ فشرده‌سازی',
    sftp_ctx_compress: 'فشرده‌سازی فایل‌ها (Compress)',
    sftp_preview_btn: '👁️ نمایش / پخش',
    sftp_ctx_preview: 'پخش و نمایش مدیا (Preview)',
    sftp_view_list: 'نمای جدولی',
    sftp_view_grid: 'نمای شبکه‌ای',
    sftp_items_count: 'آیتم',
    sftp_selected_count: 'آیتم انتخاب شده',
    sftp_no_selection: 'هیچ فایلی انتخاب نشده',
    media_modal_title: 'نمایشگر و پخش‌کننده رسانه',
    media_loading: 'در حال دریافت و آماده‌سازی فایل رسانه...',

    // Active Sessions Drawer
    drawer_title: 'مدیریت سرورها و نشست‌های فعال',
    drawer_open_servers: 'سرورهای باز',
    drawer_active_btn: 'مدیریت سرورها',
    drawer_sftp_sessions: 'نشست‌های فعال فایل منیجر (SFTP)',
    drawer_ssh_sessions: 'نشست‌های فعال ترمینال (SSH)',
    drawer_quick_servers: 'اتصال سریع به سرورهای ذخیره‌شده',
    drawer_switch_sftp: 'ورود به SFTP 📁',
    drawer_switch_ssh: 'ترمینال ⚡',
    drawer_close_session: 'قطع اتصال',
    drawer_no_sftp: 'هیچ نشست فعال SFTP وجود ندارد',
    drawer_no_ssh: 'هیچ ترمینال SSH باز نیست',
    drawer_new_conn: '+ اتصال جدید',

    // Servers View
    servers_title: 'صندوقچه سرورهای ذخیره‌شده',
    servers_desc: 'مدیریت ایمن اطلاعات و دسترسی سریع به سرورهای لینوکسی راه دور.',
    servers_search_placeholder: 'جستجو با نام سرور یا آدرس IP...',
    servers_add_btn: '+ افزودن سرور جدید',
    servers_export_btn: 'خروجی JSON',
    servers_import_btn: 'ورود اطلاعات JSON',
    srv_card_ssh: '⚡ ترمینال SSH',
    srv_card_sftp: '📁 فایل منیجر SFTP',
    srv_edit: 'ویرایش',
    srv_delete: 'حذف',
    srv_empty_msg: 'هیچ سروری ذخیره نشده است. با کلیک بر روی «سرور جدید +» اولین سرور خود را اضافه کنید.',
    srv_delete_confirm: 'آیا از حذف سرور اطمینان دارید؟',

    // Settings View
    settings_title: 'تنظیمات برنامه',
    settings_bridge_label: 'آدرس وب‌سوکت سرور واسط (Bridge URL)',
    settings_bridge_hint: 'آدرس بریج لوکال یا ریموت جهت برقراری ارتباط با پورت‌های SSH/SFTP.',
    settings_test_bridge: 'تست اتصال به بریج',
    settings_public_bridges: 'لیست سرورهای عمومی (Public Bridges)',
    settings_fetch_bridges: 'دریافت آخرین لیست از گیت‌هاب 🔄',
    settings_theme_label: 'تم رنگی ترمینال',
    settings_font_label: 'فونت ترمینال',
    settings_save_btn: 'ذخیره تنظیمات',
    settings_saved_alert: 'تنظیمات با موفقیت ذخیره گردید ✔',
    settings_test_running: 'در حال تست...',
    settings_test_timeout: 'خطا: عدم پاسخگویی در مدت زمان تعیین شده',
    settings_test_success: 'ارتباط با موفقیت برقرار شد 🚀',
    settings_test_failed: 'خطا در برقراری ارتباط با وب‌سوکت',

    // Modal
    modal_title_connect: 'اتصال به سرور',
    modal_title_edit: 'ویرایش سرور',
    modal_title_new: 'اتصال به سرور جدید',
    modal_err_host: 'لطفاً آدرس سرور را وارد نمایید.',
    modal_label_name: 'نام نمایشی سرور',
    modal_label_host: 'آدرس سرور (IP یا دامنه)',
    modal_label_port: 'پورت',
    modal_label_user: 'نام کاربری',
    modal_label_pass: 'رمز عبور',
    modal_label_key: 'کلید خصوصی (اختیاری)',
    modal_btn_connect_term: 'اتصال SSH ⚡',
    modal_btn_connect_sftp: 'باز کردن SFTP 📁',
    modal_btn_cancel: 'انصراف',

    // Popup
    popup_quick_connect: 'اتصال سریع به سرور',
    popup_saved_servers: 'سرورهای ذخیره‌شده',
    popup_manage: 'مدیریت +',
    popup_bridge_checking: 'بریج سرور: در حال بررسی...',
    popup_host_placeholder: 'آدرس سرور یا IP (مثلاً 192.168.1.100)',
    popup_user_placeholder: 'نام کاربری (مثلاً root)',
    popup_port_placeholder: 'پورت (22)',
    popup_pass_placeholder: 'رمز عبور یا کلید',

    // About
    about_desc: 'اکستنشن حرفه‌ای تحت مرورگر برای دسترسی به خط فرمان SSH با شبیه‌ساز xterm و پشتیبانی کامل از حروف متصل فارسی، به همراه مدیریت فایل کامل SFTP بر بستر وب‌سوکت.',
    about_btn_check_update: 'بررسی نسخه جدید 🔄',
    about_feat_term_title: 'ترمینال تعاملی SSH',
    about_feat_term_desc: 'شبیه‌ساز کامل xterm با رنگ‌های ۲۵۶ تایی، تب‌های همزمان، تم‌های سایبرپانک و شکل‌دهی بی‌نقص فارسی همراه با منوی کلیک‌راست کپی/پیست.',
    about_feat_sftp_title: 'مدیریت فایل پیشرفته SFTP',
    about_feat_sftp_desc: 'آپلود تکه‌ای با نوار پیشرفت زنده، درگ اند دراپ، ادیتور درون‌برنامه‌ای با کلید Ctrl+S، تغییر مجوزها (chmod) و منوی کلیک‌راست کامل.',
    about_feat_security_title: 'صندوقچه امن و لوکال',
    about_feat_security_desc: 'اطلاعات سرورها و کلیدهای خصوصی تنها در حافظه محلی مرورگر ذخیره شده و هیچ داده‌ای به خارج ارسال نمی‌شود با امکان بکاپ‌گیری JSON.',
    about_feat_bridge_title: 'سرور واسط پرسرعت (Bridge)',
    about_feat_bridge_desc: 'ارتباط کم‌تاخیر با سرورها بر بستر WebSocket و لایبرری استاندارد ssh2 بدون نیاز به نصب نرم‌افزار اضافی در نسخه‌های پرتابل.',
    about_desktop_title: 'اجرا در پنجره اختصاصی و نصب به عنوان برنامه مستقل (Desktop App)',
    about_desktop_desc: 'می‌توانید برنامه را خارج از تب‌های معمولی کروم در یک پنجره تمیز و مستقل بدون نوار آدرس یا بوک‌مارک اجرا نمایید.',
    about_desktop_how: '💡 نحوه ایجاد میانبر مستقل در دسکتاپ کروم:',
    about_desktop_steps: '<li>روی منوی سه نقطه کروم (بالا سمت راست) کلیک کنید.</li><li>گزینه <b>Cast, save, and share</b> (یا More tools) و سپس <b>Create shortcut...</b> را انتخاب کنید.</li><li>تیک گزینه <b>Open as window (باز شدن در پنجره مجزا)</b> را بزنید و دکمه <b>Create</b> را فشار دهید.</li><li>آیکون برنامه در دسکتاپ و تسک‌بار ایجاد شده و مستقیماً مانند یک نرم‌افزار بومی ویندوز/لینوکس باز می‌شود!</li>',
    about_checking: 'در حال بررسی گیت‌هاب برای نسخه جدید...',
    nav_standalone_window: 'اجرا در پنجره مستقل برنامه',
    nav_standalone_btn: 'پنجره اختصاصی ⤢',
    about_up_to_date: 'شما از آخرین نسخه پایدار (v1.4.0) استفاده می‌کنید ✔',
    about_update_available: 'نسخه جدید در دسترس است:',
    about_btn_download_update: 'دانلود نسخه جدید 📥',

    // Language Toggle
    lang_btn: '🌐 فارسی',
  }
};

class I18nManager {
  constructor() {
    this.currentLang = 'en'; // Default language is English
  }

  async init() {
    try {
      const { lang = 'en' } = await chrome.storage.local.get('lang');
      this.setLanguage(lang, false);
    } catch (e) {
      this.setLanguage('en', false);
    }
  }

  async toggleLanguage() {
    const nextLang = this.currentLang === 'en' ? 'fa' : 'en';
    await this.setLanguage(nextLang, true);
    return nextLang;
  }

  async setLanguage(lang, persist = true) {
    this.currentLang = lang === 'fa' ? 'fa' : 'en';
    if (persist) {
      await chrome.storage.local.set({ lang: this.currentLang });
    }

    const isFa = this.currentLang === 'fa';
    document.documentElement.lang = this.currentLang;
    document.documentElement.dir = isFa ? 'rtl' : 'ltr';

    this.applyTranslations();
  }

  t(key) {
    const dict = I18N_DICTIONARY[this.currentLang] || I18N_DICTIONARY.en;
    return dict[key] || I18N_DICTIONARY.en[key] || key;
  }

  applyTranslations() {
    const dict = I18N_DICTIONARY[this.currentLang] || I18N_DICTIONARY.en;

    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) el.textContent = dict[key];
    });

    // Placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key]) el.setAttribute('placeholder', dict[key]);
    });

    // Titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (dict[key]) el.setAttribute('title', dict[key]);
    });

    // Language button text update
    const btnLang = document.getElementById('langCurrentText');
    if (btnLang) {
      btnLang.textContent = this.currentLang === 'en' ? '🌐 English' : '🌐 فارسی';
    }
  }
}

window.i18n = new I18nManager();
