# HANDOVER BARON v4
> Dibuat: 20 Mei 2026 | Versi Proyek: 2.4.3 (active dev)
> Lanjutan dari HANDOVER_BARON_v3.md

---

## 🚨 STATUS SAAT INI — BACA INI DULU

### Bug yang sedang ditangani (BELUM SELESAI)
**Bug: Data anak kedua gagal dimuat di halaman Nilai walisantri**

Saat walisantri klik tab anak kedua (Faiz Muzakki Sirullah, XII B):
- Hero card → "Data tidak tersedia"
- Radar chart → "Belum ada data nilai untuk ditampilkan"
- Detail Nilai → "Gagal memuat data"
- Chart tren → tampil tapi hanya 1 mapel (matematika lowercase)

Root cause yang sudah teridentifikasi:
- Testing dilakukan di PythonAnywhere (staging), bukan lokal
- User Pak Budi di PythonAnywhere adalah akun berbeda dari `wali_multi` di lokal
- Kemungkinan: NISN Faiz tidak terdaftar di `linked_student_nisns` user Pak Budi di staging
- Faiz sendiri punya 66 data nilai di database — datanya ada
- Belum dikonfirmasi: dari mana child selector mendapat daftar anak (endpoint apa)

### Investigasi yang sudah dilakukan tapi belum tuntas
Prompt investigasi sudah dibuat tapi belum dijalankan di PythonAnywhere:
1. Cek semua walisantri + linked_student_nisns di staging
2. Cek NISN Faiz di staging
3. Cek endpoint yang mengisi child selector di grades.js

---

## ✅ YANG SUDAH SELESAI DI SESI INI (19-20 MEI 2026)

### Fix chart halaman Nilai walisantri

| Fix | Detail | File |
|-----|--------|------|
| Revert PERUBAHAN 2 (canvas innerHTML) | Hapus recreate canvas via innerHTML di loadWalisantriAnalytics() | grades.js |
| Fix empty state radar | Ganti innerHTML dengan createElement agar canvas tidak hilang dari DOM | grades.js |
| Guard listener childSwitched duplikat | Flag `_gradesChildSwitchedListenerActive` | grades.js |
| Reset hero card saat ganti anak | Tampilkan "Memuat data..." sebelum fetch | grades.js |
| Reset radar canvas saat ganti anak | Restore display:'' dan sembunyikan .chart-empty-msg | grades.js |
| Hapus demo data fallback tren | Ganti random data dengan pesan "Data tren belum tersedia" | grades.js |
| Endpoint tren per mapel (backend) | Buat get_grade_trend() baru, field mata_pelajaran (string, bukan FK) | grades/views.py |
| Daftarkan endpoint tren di urls.py | path('trend/<str:nisn>/') | grades/urls.py |
| Chart tren highlight+collapse | Multi-line per mapel, 3 mapel otomatis highlight, klik legend toggle | grades.js |

### Versi file setelah sesi ini
| File | Versi |
|------|-------|
| grades.js | ?v=20260520a |
| grades/views.py | (endpoint get_grade_trend ditambah) |
| grades/urls.py | (path trend/<str:nisn>/ ditambah) |

### Catatan penting endpoint tren
- Path: `GET /api/grades/trend/<nisn>/?months=<1-12>`
- Field mapel: `mata_pelajaran` adalah **CharField string biasa**, BUKAN FK
- Query: `.values('bulan', 'mata_pelajaran')` — tanpa `__nama`
- Response: `{ nisn, months, labels, mapel: [{nama, data, avg, min, max, fluktuasi}] }`
- Mapel diurutkan: fluktuasi tertinggi dulu (paling menarik)
- Hanya exclude jenis `uts` dan `uas` dari query tren

---

## 🔍 PROMPT INVESTIGASI BERIKUTNYA (jalankan ini dulu)

Sebelum membuat fix apapun, jalankan investigasi ini di **PythonAnywhere console**:

```
Jalankan di PythonAnywhere Django shell. JANGAN ubah apapun.

INVESTIGASI 1 — Semua walisantri di staging

python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
wali_list = User.objects.filter(role='walisantri').values(
    'id','username','name','linked_student_nisn','linked_student_nisns'
)
for w in wali_list:
    print(w)
"

INVESTIGASI 2 — NISN Faiz di staging

python manage.py shell -c "
from apps.students.models import Student
faiz = Student.objects.filter(nama__icontains='Faiz').first()
if faiz:
    print('NISN:', faiz.nisn, '| Nama:', faiz.nama)
    from django.contrib.auth import get_user_model
    User = get_user_model()
    import json
    for u in User.objects.filter(role='walisantri'):
        nisns = getattr(u, 'linked_student_nisns', []) or []
        if isinstance(nisns, str):
            try: nisns = json.loads(nisns)
            except: nisns = []
        single = getattr(u, 'linked_student_nisn', '')
        if faiz.nisn in nisns or faiz.nisn == single:
            print('Wali linked ke Faiz:', u.username, u.name)
else:
    print('Faiz tidak ditemukan di staging')
"

INVESTIGASI 3 — Endpoint yang mengisi child selector di grades.js

Buka grades.js, cari fungsi yang fetch data anak untuk child selector.
Cari pola: fetch ke endpoint yang mengandung 'children', 'my-child', 
'child', 'linked', atau 'walisantri'.
Laporkan:
- Nama fungsi
- URL endpoint persis
- Bagaimana response dipakai untuk mengisi childrenData

JANGAN ubah apapun.
```

---

## 📋 PENDING ITEMS (urut prioritas)

| # | Item | File | Status |
|---|------|------|--------|
| 1 | **BUG: Data anak kedua gagal di staging** | grades.js + backend | 🔴 IN PROGRESS — investigasi staging belum selesai |
| 2 | Bug Catatan Guru: fake save, tidak ada nama pencatat, tidak ada riwayat | hafalan.js | 🟡 Belum dimulai |
| 3 | Diskusi model: Guru Tartil / Guru Tahfidz / Status Khidmat | hafalan.js + backend | 🟡 Belum dimulai |

---

## 🏗️ ARSITEKTUR PENTING (jangan dilanggar)

### Backend
- `Grade.mata_pelajaran` = **CharField string**, bukan FK ke model mapel
- `Grade.nisn` = FK ke Student, filter dengan `nisn__nisn=<string_nisn>`
- `User.name` = nama lengkap (BUKAN `first_name` atau `get_full_name()`)
- `User.linked_student_nisn` = CharField (NISN anak pertama)
- `User.linked_student_nisns` = JSONField (array NISN semua anak)

### Frontend grades.js
- File ini masih pakai **raw fetch()** — JANGAN migrate ke apiFetch()
- `loadWalisantriView()` = fungsi LEGACY — jangan hapus, jangan panggil
- `loadWalisantriAnalytics()` = entry point aktif untuk data walisantri
- `evaluasi-asatidz.js` = **TIDAK BOLEH diubah sama sekali**

### Chart
- Radar chart: destroy() dulu, JANGAN recreate canvas via innerHTML
- Empty state: gunakan `createElement` + `display:none` pada canvas
- Guard listener: `window._gradesChildSwitchedListenerActive` mencegah duplikat

---

## ⚙️ CONSTRAINTS WAJIB (di setiap prompt)

```
- apiFetch('endpoint/') TANPA prefix /api/
- Student PK = nisn (string)
- Event handler via .onclick = fn, BUKAN inline HTML onclick
- Cek duplikat fungsi sebelum tambah fungsi baru
- evaluasi-asatidz.js TIDAK BOLEH diubah
- Bump ?v= setelah setiap perubahan JS/CSS
- grades.js masih raw fetch() — jangan migrate dulu
- Deploy dan konfirmasi hasil ditulis di LUAR prompt
```

---

## 🧠 PRINSIP PROMPTER

```
- Selalu investigasi dulu sebelum fix
- Satu prompt = satu fokus
- Minta screenshot setelah perubahan visual
- Jangan berasumsi — cek dulu
- Bedakan environment: lokal vs PythonAnywhere (staging)
  Data bisa berbeda antar environment
```

---

## 📁 FILE KUNCI PROYEK

```
portal-siswa/
├── CLAUDE.md                        # Constraints proyek (dibaca Claude Code tiap sesi)
├── backend_django/
│   └── apps/
│       ├── grades/
│       │   ├── views.py             # get_grade_trend() baru ada di sini
│       │   └── urls.py              # path trend/<str:nisn>/ sudah didaftarkan
│       └── kesantrian/
│           └── views.py             # hafalan, catatan guru, kelompok
└── frontend/public/js/
    ├── grades.js       ?v=20260520a  # Chart tren + radar + fix ganti anak
    ├── hafalan.js      ?v=20260518d  # Hafalan, catatan guru (saveCatatan masih fake)
    ├── auth-check.js   ?v=20260515a  # Sidebar + back-chip patch
    └── evaluasi-asatidz.js          # JANGAN DIUBAH
```

---

## 🚀 DEPLOY PYTHONANYWHERE

```bash
cd ~/portal_siswa && git pull
cd backend_django
python manage.py makemigrations
python manage.py migrate --noinput
python manage.py collectstatic --noinput
# Reload di Web tab PythonAnywhere
```

Log error: `cat /var/log/apiiip.pythonanywhere.com.error.log | tail -50`

---

*HANDOVER_BARON_v4.md — Portal Siswa Baron — 20 Mei 2026*
*Dibuat oleh: PROMPTER session (Claude Sonnet)*
