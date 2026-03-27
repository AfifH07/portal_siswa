# 🚀 Quick Start - Portal Siswa Localhost Setup

## 📦 What's Been Created

### Backend Structure (Node.js/Express)
```
backend/
├── config/
│   ├── config.js           # Application config (migrasi CONFIG dari Code.gs)
│   └── database.js        # Database connection
├── controllers/
│   └── authController.js  # Auth logic (login, password reset)
├── middleware/
│   ├── authMiddleware.js   # JWT authentication
│   └── uploadMiddleware.js # File upload handler
├── models/               # Database models (migrasi Sheets ke Tables)
│   ├── User.js          # Users table
│   ├── Student.js       # Siswa table
│   ├── Attendance.js    # Absensi table
│   ├── Grade.js        # Nilai table
│   ├── Evaluation.js    # Evaluasi table
│   ├── ResetToken.js   # ResetPassword table
│   ├── Schedule.js     # Jadwal table
│   ├── AttendanceDraft.js # AttendanceDraft table
│   └── index.js       # Export semua models
├── routes/
│   └── auth.js        # Auth routes
├── utils/
│   ├── auth.js        # JWT helpers
│   ├── date.js        # Date formatting helpers
│   ├── helpers.js     # General helpers
│   └── permission.js  # Permission checker
└── server.js         # Main entry point
```

### Frontend Structure
```
frontend/
├── public/           # Static files
│   ├── css/        # CSS styles
│   ├── js/         # JavaScript client
│   └── assets/     # Images, fonts
└── views/
    └── index.html  # Main HTML (dari Index.html)
```

### Database & Configuration
```
database/
├── schema.sql      # SQL schema untuk setup database
.env               # Environment variables (copy dari .env.example)
package.json       # Dependencies
README.md          # Dokumentasi lengkap
MIGRASI.md        # Panduan migrasi detail
```

## 🎯 Files yang Perlu Disediakan

### 1. Copy dan Edit .env
```bash
cd portal-siswa
cp .env.example .env
```

Edit `.env`:
```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=portal_siswa
PORT=3000
JWT_SECRET=generate-random-secret-key-here
```

### 2. Setup Database

#### Cara A: Command Line (MySQL)
```bash
# Import schema
mysql -u root -p < database/schema.sql

# Atau
mysql -u root -p
> USE portal_siswa;
> SOURCE database/schema.sql;
```

#### Cara B: GUI (MySQL Workbench / phpMyAdmin)
- Buka MySQL Workbench
- Create New Connection ke localhost
- Open SQL Editor
- Run script dari `database/schema.sql`

### 3. Install Dependencies
```bash
cd portal-siswa
npm install
```

### 4. Separasi Frontend Files

Dari `report/Index.html`:

#### Langkah 1: Extract CSS
- Copy semua antara `<style>` dan `</style>`
- Paste ke `frontend/public/css/style.css`

#### Langkah 2: Extract JavaScript
- Copy semua antara `<script>` dan `</script>` (yang bukan CDN)
- Paste ke `frontend/public/js/app.js`

#### Langkah 3: Update HTML
Di `frontend/views/index.html`:
```html
<!-- Add CSS -->
<link rel="stylesheet" href="/css/style.css">

<!-- Add JS (sebelum body end) -->
<script src="/js/app.js"></script>
```

### 5. Update JavaScript untuk API

Di `frontend/public/js/app.js`, ganti semua `google.script.run` dengan `fetch()`:

```javascript
// CONTOH MIGRASI:

// GANTI INI (Google Apps Script):
google.script.run
  .withSuccessHandler(function(result) {
    if (result.success) {
      // ...
    }
  })
  .validateLogin(username, password);

// JADI INI (Node.js API):
async function login(username, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const result = await response.json();
    
    if (result.success) {
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result));
      showDashboard();
    } else {
      showError(result.message);
    }
  } catch (error) {
    showError('Terjadi kesalahan koneksi');
  }
}
```

## ▶️ Menjalankan Aplikasi

```bash
# Start server
npm run dev
```

Server akan berjalan di: `http://localhost:3000`

Buka browser dan akses: `http://localhost:3000`

## 🔐 Login Awal

Default user (ada di database/schema.sql):
- Username: `admin`
- Password: (check di .sql atau setup manual)

Buat user admin baru dengan password yang aman:
```sql
INSERT INTO users (username, password, role, name, email)
VALUES ('superadmin', '$2a$10$YourHashedPassword', 'superadmin', 'Super Admin', 'admin@sekolah.id');
```

Untuk generate hashed password, gunakan tool online atau Node.js:
```javascript
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('your-password', 10));
```

## 📋 Tasks Berikutnya

### Backend Controllers (sudah dibuat: authController)
Sisa yang perlu dibuat:
- [ ] usersController.js
- [ ] attendanceController.js
- [ ] gradesController.js
- [ ] evaluationsController.js
- [ ] dashboardController.js
- [ ] uploadController.js

### API Routes (sudah dibuat: auth)
Sisa yang perlu dibuat:
- [ ] users.js
- [ ] attendance.js
- [ ] grades.js
- [ ] evaluations.js
- [ ] dashboard.js
- [ ] upload.js

### Frontend Migration
- [ ] Separasi CSS ke file terpisah
- [ ] Separasi JS ke file terpisah
- [ ] Update semua `google.script.run` ke `fetch()`
- [ ] Update HTML untuk include CSS/JS eksternal

## 🧪 Testing

### Test Database Connection
```bash
cd backend
node -e "const sequelize = require('./config/database'); sequelize.authenticate().then(() => console.log('OK')).catch(e => console.error(e))"
```

### Test API
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Check response for token
```

## 🐛 Common Issues

### Error: "Database connection failed"
- Cek MySQL running: `mysql -u root -p`
- Verify .env credentials
- Check firewall settings

### Error: "Module not found"
- Run: `npm install`

### Error: "EADDRINUSE: address already in use"
- Port 3000 sudah dipakai
- Ganti PORT di .env atau kill process yang pakai port 3000

### Frontend not loading
- Cek file paths di index.html
- Buka developer console (F12) untuk error messages

## 📚 Documentation

- `README.md` - Dokumentasi lengkap struktur dan fitur
- `MIGRASI.md` - Panduan detail migrasi dari Google Sheets
- Code vs Backend mapping di README.md

## 💡 Tips

1. **Jalankan dengan nodemon** di development untuk auto-restart:
   ```bash
   npm run dev
   ```

2. **Cek logs** di terminal untuk debugging backend

3. **Buka developer tools** di browser (F12) untuk debugging frontend

4. **Backup database** sebelum migrasi production data

5. **Version control** dengan git untuk tracking perubahan

## 📞 Next Steps

1. Complete backend controllers and routes
2. Migrate frontend completely
3. Test semua features
4. Deploy ke production (VPS/Cloud)

Good luck! 🚀
