# Privacy Policy for LiveKadeh SSH & SFTP Pro

**Last Updated:** September 3, 2026

LiveKadeh ("we", "our", or "the extension") values your privacy. This Privacy Policy explains our practices regarding user data and information security for the **LiveKadeh SSH & SFTP Pro** Chrome Extension.

---

## 1. Summary (No Data Collection)
**LiveKadeh SSH & SFTP Pro does NOT collect, track, transmit, or sell any personal data or usage analytics to any external or third-party servers.** 

All operations, terminal sessions, and file transfers occur strictly between your browser and the servers you explicitly specify.

---

## 2. Information Handled Locally on Your Device

### A. Saved Server Configurations
- **What is stored:** Hostnames, IP addresses, ports, usernames, passwords, and optional SSH private keys.
- **Where it is stored:** Exclusively on your local computer using Chrome's secure `chrome.storage.local` API.
- **Transmission:** Credentials are only sent directly to your configured local or remote WebSocket bridge to establish the SSH/SFTP connection requested by you. They are never sent to LiveKadeh or any third party.

### B. Clipboard Access
- The extension requests `clipboardRead` and `clipboardWrite` solely to facilitate user-initiated Copy and Paste actions inside the interactive terminal via the context menu or standard keyboard shortcuts (`Ctrl+Shift+C` / `Ctrl+Shift+V`).
- Clipboard content is never logged, inspected, or sent over the network.

---

## 3. Network Connections & Host Permissions

- The extension establishes network connections (via WebSockets `ws://` and `wss://`) only to the Bridge endpoints defined by the user (e.g., `ws://localhost:3000` or a verified public/private bridge server).
- No telemetry, analytics, tracking cookies, or tracking pixels are embedded in the extension.

---

## 4. Single Purpose & Compliance
In accordance with the Google Chrome Web Store Developer Program Policies:
- The extension serves a single purpose: providing an in-browser SSH terminal and SFTP file management client.
- The extension does not use remote code; all application scripts and libraries are bundled locally in compliance with Manifest V3 policies.

---

## 5. Contact & Inquiries
If you have any questions about this Privacy Policy or the security of the extension, please open an issue on our official GitHub repository:
- **GitHub:** [https://github.com/livekadeh/chrome-ssh-sftp-extension](https://github.com/livekadeh/chrome-ssh-sftp-extension)
