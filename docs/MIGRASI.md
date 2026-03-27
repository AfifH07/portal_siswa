# MIGRASI DARI GOOGLE APPS SCRIPT KE LOCALHOST

## 📋 Langkah demi Langkah

### 1. Persiapan Environment

#### Install Node.js dan Database

```bash
# Cek Node.js (v14 atau lebih tinggi)
node --version

# Cek npm
npm --version

# Install MySQL
# Windows: Download installer dari https://dev.mysql.com/downloads/installer/
# Ubuntu: sudo apt-get install mysql-server
# Mac: brew install mysql
```

### 2. Setup Project

```bash
# Clone atau download project
cd portal-siswa

# Install dependencies
npm install

# Setup database
```

### 3. Setup Database

#### MySQL

```bash
# Login ke MySQL
mysql -u root -p

# Buat database
CREATE DATABASE portal_siswa;

# Import schema
mysql -u root -p portal_siswa < database/schema.sql

# Atau menggunakan MySQL Workbench / phpMyAdmin
```

#### Environment Variables

```bash
# Copy .env.example ke .env
cp .env.example .env

# Edit .env sesuai konfigurasi
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=portal_siswa
PORT=3000
JWT_SECRET=your-secret-key-here
```

### 4. Migrasi Data dari Google Sheets ke Database

Ada beberapa cara untuk melakukan ini:

#### Cara A: Export CSV dan Import ke Database

1. **Export dari Google Sheets:**
   - Sheet Users: File > Download > Comma-separated values (.csv)
   - Sheet Siswa: File > Download > Comma-separated values (.csv)
   - Sheet Absensi: File > Download > Comma-separated values (.csv)
   - Sheet Nilai: File > Download > Comma-separated values (.csv)
   - Sheet Evaluasi: File > Download > Comma-separated values (.csv)
   - Sheet Jadwal: File > Download > Comma-separated values (.csv)
   - Sheet ResetPassword: File > Download > Comma-separated values (.csv)

2. **Import ke Database (MySQL):**

```sql
-- Users
LOAD DATA LOCAL INFILE 'users.csv'
INTO TABLE users
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(username, password, role, name, nisn, email);

-- Siswa
LOAD DATA LOCAL INFILE 'siswa.csv'
INTO TABLE students
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(nisn, nama, kelas, program);

-- Absensi
LOAD DATA LOCAL INFILE 'absensi.csv'
INTO TABLE attendance
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(nisn, @var1, waktu, status, keterangan)
SET tanggal = STR_TO_DATE(@var1, '%d/%m/%Y');

-- Nilai
LOAD DATA LOCAL INFILE 'nilai.csv'
INTO TABLE grades
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(nisn, mata_pelajaran, nilai, semester, tahun_ajaran, jenis_ujian);

-- Evaluasi
LOAD DATA LOCAL INFILE 'evaluasi.csv'
INTO TABLE evaluations
FIELDS TERMINATED BY ','
ENCLOSED BY '"'
LINES TERMINATED BY '\n'
IGNORE 1 ROWS
(nisn, @var1, jenis, evaluator, nama_evaluator, nama_siswa, summary, foto_url, tindak_lanjut)
SET tanggal = STR_TO_DATE(@var1, '%d/%m/%Y');
```

#### Cara B: Menggunakan Script Migrasi

Buat file `migrate.js` di root project:

```javascript
const { User, Student, Attendance, Grade, Evaluation, Schedule, ResetToken } = require('./backend/models');
const sequelize = require('./backend/config/database');

async function migrateFromCSV(csvFile, model) {
  // Implementasi migrasi dari CSV
  // Bisa menggunakan library seperti 'csv-parser' atau 'fast-csv'
}

async function migrateAll() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Migrasi semua data
    await migrateFromCSV('users.csv', User);
    await migrateFromCSV('siswa.csv', Student);
    await migrateFromCSV('absensi.csv', Attendance);
    await migrateFromCSV('nilai.csv', Grade);
    await migrateFromCSV('evaluasi.csv', Evaluation);
    await migrateFromCSV('jadwal.csv', Schedule);
    await migrateFromCSV('resetpassword.csv', ResetToken);

    console.log('Migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateAll();
```

### 5. Migrasi File Upload dari Google Drive

1. **Download semua file dari Google Drive folder "Folder Evaluasi Siswa"**
2. **Simpan ke folder `uploads/`**
3. **Update database untuk memetakan file URLs**

```sql
-- Update evaluasi dengan path file lokal
UPDATE evaluations 
SET foto_url = CONCAT('/uploads/', file_name)
WHERE foto_url LIKE 'https://drive.google.com%';
```

### 6. Migrasi Frontend

#### Separasi File

Dari `Index.html`, pisahkan menjadi:

1. **frontend/views/index.html** - HTML structure
2. **frontend/public/css/style.css** - CSS (dari `<style>` tag)
3. **frontend/public/js/app.js** - JavaScript (dari `<script>` tag)

#### Update JavaScript untuk API Calls

Ganti semua `google.script.run` dengan `fetch()`:

```javascript
// Google Apps Script (lama)
google.script.run
  .withSuccessHandler(function(result) {
    console.log(result);
  })
  .validateLogin(username, password);

// Node.js API (baru)
fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ username, password })
})
.then(response => response.json())
.then(result => {
  console.log(result);
  if (result.success) {
    localStorage.setItem('token', result.token);
    // ...
  }
});
```

#### Update HTML Links

```html
<!-- Include CSS -->
<link rel="stylesheet" href="/css/style.css">

<!-- Include JS -->
<script src="/js/app.js"></script>

<!-- Update form actions -->
<form id="login-form" onsubmit="handleLogin(event)">
```

### 7. Menjalankan Aplikasi

```bash
# Development
npm run dev

# Production
npm start
```

Buka browser: `http://localhost:3000`

### 8. Testing

#### Login sebagai Superadmin
- Username: `admin`
- Password: (sesuai yang ada di database)

#### Testing Endpoints

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Get Dashboard Stats (with token)
curl http://localhost:3000/api/dashboard/stats \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🔍 Troubleshooting

### Error: Connection Refused
- Pastikan MySQL berjalan: `mysql -u root -p`
- Cek konfigurasi di .env

### Error: Module Not Found
- Run: `npm install`

### Error: File Upload Gagal
- Pastikan folder `uploads/` ada dan writable
- `chmod 755 uploads/` (Linux/Mac)

### Tampilan Tidak Berfungsi
- Cek console browser untuk error
- Pastikan file CSS dan JS ter-include dengan benar
- Buka developer tools (F12) untuk debugging

## 📚 Next Steps

1. **Security Hardening**
   - Set strong JWT_SECRET
   - Enable HTTPS (SSL)
   - Setup firewall

2. **Backup Strategy**
   - Automated database backup
   - Backup uploads folder

3. **Monitoring**
   - Setup logging
   - Error tracking (Sentry, etc.)

4. **Deployment**
   - VPS (DigitalOcean, Linode)
   - Cloud (AWS, Google Cloud, Azure)
   - PaaS (Heroku, Railway, Render)

## 📞 Support

Untuk bantuan lebih lanjut:
- Cek README.md untuk dokumentasi lengkap
- Review Code.gs vs backend/controllers untuk perbandingan
