# Quick Start Guide — v4.0.1 New Features

## 🔧 Setup Instructions

### 1. Install Updates
```bash
# Navigate to project directory
cd CTQ-Enterprise

# Install new dependencies
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
# Copy .env template to .env (rename from .env.example)
cp .env.example .env

# Edit .env with your settings (optional — defaults work for local testing)
# nano .env    # or use your preferred editor
```

### 3. Default Configuration
The app works **out of the box** with these defaults:
-- ✅ **Login:** admin (create password via `.env` ADMIN_PASSWORD_HASH or enable local dev mode for testing)
- ✅ **Database:** Creates in `data/ctq_history.db`
- ✅ **Logging:** Daily logs in `Logs/` folder
- ✅ **CORS:** Restricted to http://localhost:8745

### 4. Start Server
```bash
python server.py
```

---

## 🌙 Dark/Light Mode

### How to Use
1. Look for the **moon icon (🌙)** in the top-right header
2. Click to toggle between dark and light themes
3. Your preference is **automatically saved** (persists on reload)

### Supported Browsers
- Chrome/Chromium v90+
- Firefox v88+
- Safari v14.1+
- Edge v90+

---

## 📧 Email Notifications (Optional)

### Enable Email Notifications
Edit `.env`:
```ini
MAIL_ENABLED=true
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-specific-password
MAIL_NOTIFICATION_RECIPIENTS=admin@company.com,qa-lead@company.com
```

### Setting Up Gmail (Recommended for Testing)
1. Go to https://myaccount.google.com/apppasswords
2. Enable 2-factor authentication if not already enabled
3. Generate an "App password" for Mail
4. Copy the 16-character password to .env as `MAIL_PASSWORD`
5. Restart server and run a batch audit

### Email Template Preview
When a batch completes, recipients receive:
- Batch ID
- Number of tickets processed
- Average quality score
- Pass rate percentage
- Link to review detailed results

### Troubleshooting Email
- **Not receiving emails?** Check:
  - `MAIL_ENABLED=true` in .env
  - SMTP credentials are correct
  - Recipients list is not empty
  - Check server logs: `Logs/ctq-YYYY-MM-DD.log` for "email" messages

---

## 🔐 Security Improvements

### What Changed
| Before | After |
|--------|-------|
| SHA-256 hashing (fast, weak) | Bcrypt hashing (slow, strong) |
| Credentials hardcoded in code | Credentials in .env (never in git) |
| No session timeout | Auto-logout after 8 hours |
| CORS open to all domains | CORS restricted to localhost |
| Generic error messages | Specific, secure error handling |

### Best Practices
1. **Always set a strong `SECRET_KEY` in .env:**
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   # Copy the output to SECRET_KEY in .env
   ```

2. **Change default user passwords:**
   ```bash
   python -c "import bcrypt; print(bcrypt.hashpw(b'YourNewPassword123', bcrypt.gensalt()).decode())"
   # Copy the output to ADMIN_PASSWORD_HASH or USER_PASSWORD_HASH in .env
   ```

3. **Never commit .env file:**
   ```bash
   # .gitignore already includes .env
   git status  # Verify .env is not listed
   ```

---

## ✅ Features Summary

| Feature | v4.0.0 | v4.0.1 |
|---------|--------|--------|
| Bcrypt password hashing | ❌ | ✅ |
| Environment configuration | ❌ | ✅ |
| Session timeout | ❌ | ✅ |
| Dark/Light mode | ❌ | ✅ |
| Email notifications | ❌ | ✅ Optional |
| CORS restrictions | ❌ | ✅ |
| Error handling | ⚠️ Basic | ✅ Improved |

---

## 🆘 Troubleshooting

### "Import Error: No module named 'bcrypt'"
```bash
pip install bcrypt>=4.0
```

### "Flask-Mail import failed"
Email notifications require Flask-Mail:
```bash
pip install Flask-Mail>=0.9.1
```
Or to disable: Set `MAIL_ENABLED=false` in .env

### "Session expired" after short time
Check `PERMANENT_SESSION_LIFETIME` in .env (seconds). Default is 28800 (8 hours).

### Theme not persisting after reload
- Verify browser localStorage is enabled
- Check browser console for JavaScript errors
- Try a different browser

### Batch completion email not sent
1. Verify `MAIL_ENABLED=true` and `MAIL_NOTIFICATION_RECIPIENTS` set
2. Check `Logs/ctq-YYYY-MM-DD.log` for email errors
3. Verify SMTP credentials are correct
4. Test with simple recipients first (gmail.com)

---

## 📚 Additional Resources

- **Full Documentation:** See `PROJECT_REVIEW.md` for comprehensive analysis
- **Security Details:** See `.env.example` for all configuration options
- **Changes Log:** See `CHANGELOG_v4.0.1.md` for all modifications
- **Contributing:** See `CONTRIBUTING.md` for development guidelines

---

## 🎯 Next Steps

1. **Test locally:** Start server, toggle dark mode, run a batch, check email (if enabled)
2. **Configure for your org:** Update .env with your email and security preferences
3. **Share with team:** Distribute setup instructions and note the new dark mode feature
4. **Provide feedback:** Report issues or feature requests via GitHub issues

---

**Happy auditing!** 🎉

Questions? Contact: yollook511@gmail.com

