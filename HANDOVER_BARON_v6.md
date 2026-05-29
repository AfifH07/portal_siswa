# HANDOVER BARON v6
> Dibuat: 29 Mei 2026 | Versi Proyek: 2.4.3 (active dev)
> Lanjutan dari HANDOVER_BARON_v5.md

---

## 🚨 BUG AKTIF — BELUM DIKONFIRMASI

### Bug 1: /karakter/ BLP tidak tampil
**Gejala:** Halaman walisantri /karakter/ tab BLP kosong
**Fix sudah diberikan (Y1):** filter status include 'locked'
**Perlu konfirmasi:** paste output console.log [karakter] dari browser

### Bug 2: /karakter/ Tab Catatan & Bimbingan kosong
**Fix sudah diberikan (Y2):** fetch dari kesantrian/incidents/?siswa_nisn=
**Perlu konfirmasi:** cek apakah data muncul setelah deploy

### Bug 3: Evaluasi Perilaku guru statistik 0
**Fix sudah diberikan (R3):** tambah Q(evaluator=evaluator_name) di get_filtered_queryset_for_user()
**Perlu konfirmasi:** deploy dan test login guru

### Bug 4: Tab Integritas guru santri tidak lengkap
**Fix sudah diberikan (R1):** deduplicate _get_assigned_classes()
**Perlu konfirmasi:** deploy dan test

### Bug 5: penilaian_integritas_guru tolak guru saat GET
**Fix sudah diberikan (R2):** hapus 403 untuk guru, filter queryset guru=user
**Perlu konfirmasi:** deploy dan test

---

## ✅ SELESAI DI SESI INI (28–29 MEI 2026)

| Fix | File |
|-----|------|
| Filter walisantri: is_approved + visibility publik | evaluations/views.py |
| getUserRole fallback di students.js | students.js |
| Fix kondisi !userRole === 'superadmin' → includes() | students.js |
| guru_todo_list redesign: Assignment-based | dashboard/views.py |
| Incident: tambah field foto + serializer + view | kesantrian/ |
| render foto di case-management.js | case-management.js |
| Data migration: isi created_by dari evaluator (21 fixed) | via shell |
| Halaman /blp/ — Input BLP guru wali kelas | blp.html + blp.js + blp.css |
| Halaman /karakter/ — Karakter walisantri | karakter.html + karakter.js |
| Route /karakter/ didaftarkan | backend_django/urls.py |

---

## 📋 PENDING (urut prioritas)

| # | Item | Status |
|---|------|--------|
| 1 | Konfirmasi Bug 1–5 di atas | 🔴 IN PROGRESS |
| 2 | Testing role: Musyrif | 🟡 Belum dimulai |
| 3 | Testing role: BK | 🟡 Belum dimulai |
| 4 | Testing role: Bendahara | 🟡 Belum dimulai |
| 5 | Testing role: Walisantri (lanjut) | 🟡 Belum dimulai |
| 6 | Bug evaluasi "Menunggu Persetujuan" | 🔴 Dari v5, belum selesai |

---

## 🏗️ ARSITEKTUR PENTING

### Backend
- Grade.mata_pelajaran = CharField (bukan FK)
- Grade.nisn = FK ke Student, filter: nisn__nisn=<string>
- User.name = nama lengkap (BUKAN first_name)
- User.linked_student_nisn = CharField (NISN anak pertama)
- User.linked_student_nisns = JSONField (array semua anak)
- Evaluation.is_approved = BooleanField default=False
- EvaluationComment.jenis = diskusi / pembinaan
- Incident = model di apps/kesantrian/ (BUKAN apps/evaluations/)
- BLPEntry = apps/kesantrian/, 59 indikator nested JSON, 6 domain
- Todo guru: berbasis Assignment (bukan Schedule)

### Frontend
- grades.js: raw fetch() — JANGAN migrate ke apiFetch()
- evaluasi-asatidz.js: TIDAK BOLEH diubah sama sekali
- ibadah.js: fungsi lama raw fetch(), fungsi baru apiFetch()
- evaluations.js, blp.js, karakter.js: pakai apiFetch()

### Versi file terbaru
| File | Versi |
|------|-------|
| evaluations.js | ?v=20260525c |
| blp.js | ?v=20260529b |
| blp.css | ?v=20260529b |
| karakter.js | ?v=20260529b |
| students.js | ?v=20260526a |
| auth-check.js | ?v=20260528blp |

---

## ⚙️ CONSTRAINTS WAJIB

- apiFetch('endpoint/') TANPA prefix /api/
- Student PK = nisn (string)
- Event handler via .onclick = fn, BUKAN inline HTML onclick
- Cek duplikat fungsi sebelum tambah fungsi baru
- evaluasi-asatidz.js TIDAK BOLEH diubah
- Bump ?v= setiap perubahan JS/CSS
- grades.js masih raw fetch()

---

## 🧠 ALUR WAJIB SETIAP BUG

1. PROMPT INVESTIGASI (read-only)
2. Tunggu output dari AI agent
3. ANALISIS → tentukan root cause
4. Jika belum jelas → PROMPT INVESTIGASI LANJUTAN
5. Root cause TERKONFIRMASI → PROMPT FIX
6. Konfirmasi hasil deploy
7. Jika gagal → kembali ke 1

DILARANG skip ke fix tanpa investigasi
DILARANG fix berdasarkan asumsi

---

## 🚀 DEPLOY PYTHONANYWHERE

cd ~/portal_siswa && git pull
cd backend_django
python manage.py makemigrations
python manage.py migrate --noinput
python manage.py collectstatic --noinput
# Reload di Web tab PythonAnywhere

Log error: cat /var/log/apiiip.pythonanywhere.com.error.log | tail -50

---

## 📁 FILE KUNCI

portal-siswa/
├── CLAUDE.md
├── HANDOVER_BARON_v6.md
├── backend_django/apps/
│   ├── evaluations/views.py    ← get_filtered_queryset_for_user
│   ├── kesantrian/views.py     ← blp_student_history, incident, ibadah
│   ├── kesantrian/models.py    ← BLPEntry, Incident (+ foto baru)
│   ├── dashboard/views.py      ← guru_todo_list (Assignment-based)
│   └── accounts/models.py      ← Assignment
└── frontend/
    ├── views/blp.html
    ├── views/karakter.html
    └── public/js/
        ├── blp.js
        ├── karakter.js
        ├── students.js
        └── evaluasi-asatidz.js  ← JANGAN DIUBAH

*HANDOVER_BARON_v6.md — Portal Siswa Baron — 29 Mei 2026*
