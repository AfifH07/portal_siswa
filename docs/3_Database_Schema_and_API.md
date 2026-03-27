# Portal Ponpes Baron - Database Schema and API Documentation

## Document Information
| Item | Value |
|------|-------|
| Version | 2.3.4 |
| Last Updated | 2026-03-21 |
| Database | SQLite (dev) / PostgreSQL (prod) |
| API Style | REST with Django REST Framework |

---

## Table of Contents
1. [Database Overview](#1-database-overview)
2. [Core Models](#2-core-models)
3. [Accounts Models](#3-accounts-models)
4. [Students Models](#4-students-models)
5. [Grades Models](#5-grades-models)
6. [Attendance Models](#6-attendance-models)
7. [Evaluations Models](#7-evaluations-models)
8. [Kesantrian Models](#8-kesantrian-models)
9. [Finance Models](#9-finance-models)
10. [API Endpoints](#10-api-endpoints)
11. [Authentication & Security](#11-authentication--security)

---

## 1. Database Overview

### Entity Relationship Diagram (High-Level)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PORTAL PONPES BARON                            │
│                            DATABASE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────┐     ┌──────────────┐     ┌────────────┐                     │
│   │   User   │────▶│  Assignment  │     │ TahunAjaran│                     │
│   └────┬─────┘     └──────────────┘     └────────────┘                     │
│        │                                                                    │
│        │ linked_student_nisns                                              │
│        ▼                                                                    │
│   ┌──────────┐                                                             │
│   │ Student  │◀─────────────────────────────────────────┐                  │
│   └────┬─────┘                                          │                  │
│        │                                                │                  │
│   ┌────┴────────────────────────────────────────────────┴─────┐            │
│   │                                                           │            │
│   ▼           ▼           ▼           ▼           ▼           ▼            │
│ ┌─────┐   ┌───────┐   ┌───────┐   ┌────────┐   ┌──────┐   ┌───────┐       │
│ │Grade│   │Attend.│   │ Eval  │   │ Ibadah │   │ BLP  │   │Tagihan│       │
│ └─────┘   └───────┘   └───────┘   └────────┘   └──────┘   └───┬───┘       │
│                                                               │            │
│                                        ┌──────────────────────┘            │
│                                        ▼                                   │
│                                   ┌──────────┐                             │
│                                   │Pembayaran│                             │
│                                   └──────────┘                             │
│                                                                             │
│   ┌────────────┐     ┌─────────────┐     ┌───────────────────┐             │
│   │  Incident  │────▶│ IncidentCmt │     │ AsatidzEvaluation │             │
│   └────────────┘     └─────────────┘     └───────────────────┘             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Database Statistics
| Category | Count |
|----------|-------|
| Total Tables | ~25 |
| Core Models | 1 |
| Auth Models | 4 |
| Student Models | 2 |
| Academic Models | 4 |
| Kesantrian Models | 10 |
| Finance Models | 4 |

---

## 2. Core Models

### 2.1 TahunAjaran (Academic Year)
**Table:** `core_tahunajaran`

Master data for academic year management. Only one record can be active at a time.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| nama | CharField(20) | Required | Year format: "2025/2026" |
| semester | CharField(10) | Choices | "Ganjil" / "Genap" |
| is_active | BooleanField | Default: False | Only one active at a time |
| tanggal_mulai | DateField | Nullable | Semester start date |
| tanggal_selesai | DateField | Nullable | Semester end date |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Last update timestamp |

**Unique Constraint:** `(nama, semester)`

**Special Behavior:** `save()` override ensures only ONE record can have `is_active=True`.

---

## 3. Accounts Models

### 3.1 User
**Table:** `users`

Custom user model extending Django's AbstractBaseUser with role-based access control.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| username | CharField(50) | Unique | Login username |
| password | CharField(255) | Required | Hashed password |
| role | CharField(20) | Choices | User role (see below) |
| name | CharField(100) | Required | Full name |
| nisn | CharField(20) | Nullable | NISN for student-linked accounts |
| email | EmailField(100) | Nullable | Email address |
| phone | CharField(20) | Nullable | Phone number |
| linked_student_nisn | CharField(20) | Nullable | Legacy single NISN |
| linked_student_nisns | JSONField | Default: [] | Multi-child support |
| kelas | CharField(20) | Nullable | Class assignment |
| mata_pelajaran | CharField(100) | Nullable | Subject taught (for guru) |
| is_active | BooleanField | Default: True | Account status |
| is_staff | BooleanField | Default: False | Django admin access |
| is_superuser | BooleanField | Default: False | Full permissions |
| date_joined | DateTimeField | Auto | Registration date |
| last_login | DateTimeField | Nullable | Last login timestamp |

**Role Choices:**
| Role | Display Name | Description |
|------|--------------|-------------|
| superadmin | Superadmin | Full system access |
| pimpinan | Pimpinan | School leadership |
| guru | Guru | Teachers/Ustadz |
| musyrif | Musyrif | Dormitory supervisors |
| admin_kelas | Admin Kelas | Homeroom teachers |
| bendahara | Bendahara | Finance staff |
| walisantri | Walisantri | Parent/guardian |
| adituren | Adituren/Alumni | Alumni access |
| pendaftar | Pendaftar | New registrants |

### 3.2 Assignment
**Table:** `user_assignments`

Assignment of staff to classes, halaqoh, or duties.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| user | ForeignKey | FK → User | Assigned staff |
| assignment_type | CharField(20) | Choices | Type of assignment |
| kelas | CharField(20) | Nullable | Class (for KBM/wali_kelas) |
| halaqoh_id | BigIntegerField | Nullable | Halaqoh ID |
| mata_pelajaran | CharField(100) | Nullable | Subject (for KBM) |
| hari | CharField(50) | Nullable | Days (for piket) |
| tahun_ajaran | CharField(10) | Required | Academic year |
| semester | CharField(10) | Choices | Ganjil/Genap |
| status | CharField(20) | Choices | active/inactive/pending |
| catatan | TextField | Nullable | Notes |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |
| created_by | CharField(50) | Nullable | Creator username |

**Assignment Types:**
- `kbm` - Kegiatan Belajar Mengajar
- `diniyah` - Diniyah classes
- `halaqoh` - Halaqoh Tahfidz/Tahsin
- `piket` - Daily duty
- `wali_kelas` - Homeroom teacher

### 3.3 ResetToken
**Table:** `reset_tokens`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| username | CharField(50) | Required | Target username |
| token | CharField(10) | Unique | Reset token |
| status | CharField(10) | Choices | Active/Used |
| created_at | DateTimeField | Auto | Creation timestamp |

### 3.4 UserActivity
**Table:** `user_activities`

Audit trail for user management actions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| user | ForeignKey | FK → User | Actor |
| target_user | ForeignKey | FK → User | Target |
| action | CharField(20) | Choices | Action type |
| details | JSONField | Default: {} | Change details |
| ip_address | GenericIPAddress | Nullable | Client IP |
| user_agent | TextField | Nullable | Browser info |
| timestamp | DateTimeField | Auto | Action timestamp |

---

## 4. Students Models

### 4.1 Student
**Table:** `students`

Core student data with alumni support.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| nisn | CharField(20) | Unique | Student ID number |
| nama | CharField(100) | Required | Full name |
| kelas | CharField(20) | Nullable | Current class |
| program | CharField(50) | Nullable | Study program |
| email | EmailField(100) | Nullable | Email |
| phone | CharField(20) | Nullable | Phone |
| tempat_lahir | CharField(100) | Nullable | Birth place |
| tanggal_lahir | DateField | Nullable | Birth date |
| alamat | TextField | Nullable | Address |
| jenis_kelamin | CharField(1) | Choices | L/P |
| wali_nama | CharField(100) | Nullable | Guardian name |
| wali_phone | CharField(20) | Nullable | Guardian phone |
| wali_hubungan | CharField(50) | Nullable | Relationship |
| tanggal_masuk | DateField | Nullable | Enrollment date |
| target_hafalan | IntegerField | Default: 0 | Target memorization |
| current_hafalan | IntegerField | Default: 0 | Current memorization |
| target_nilai | IntegerField | Default: 75 | Target grade |
| aktif | BooleanField | Default: True | Legacy status |
| status | CharField(20) | Choices | aktif/alumni/pindah/dikeluarkan |
| tahun_lulus | CharField(10) | Nullable | Graduation year |
| tanggal_keluar | DateField | Nullable | Exit date |
| alasan_keluar | TextField | Nullable | Exit reason |
| ijazah_diterima | BooleanField | Default: False | Certificate received |
| catatan_alumni | TextField | Nullable | Alumni notes |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |

**Indexes:** nisn, nama, kelas, program, aktif, status, tahun_lulus

### 4.2 Schedule
**Table:** `schedules`

Class schedules.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| username | CharField(50) | Required | Teacher username |
| kelas | CharField(20) | Required | Class |
| hari | CharField(20) | Required | Day |
| jam | CharField(20) | Required | Time slot |
| mata_pelajaran | CharField(100) | Nullable | Subject |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |

---

## 5. Grades Models

### 5.1 Grade
**Table:** `grades`

Academic grades with multi-type support.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| nisn | ForeignKey | FK → Student | Student reference |
| mata_pelajaran | CharField(100) | Required | Subject name |
| nilai | IntegerField | 0-100 | Grade value |
| semester | CharField(20) | Choices | Ganjil/Genap |
| tahun_ajaran | CharField(10) | Required | Academic year |
| jenis | CharField(50) | Choices | Grade type |
| kelas | CharField(20) | Required | Class |
| guru | CharField(100) | Required | Teacher name |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |

**Grade Types (Jenis):**
- `UH` - Ulangan Harian
- `UTS` - Ujian Tengah Semester
- `UAS` - Ujian Akhir Semester
- `Tugas` - Assignment
- `Proyek` - Project

**Indexes:** nisn, kelas, semester, tahun_ajaran

---

## 6. Attendance Models

### 6.1 Attendance
**Table:** `attendance`

Student attendance with lesson period (JP) support.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| nisn | ForeignKey | FK → Student | Student reference |
| tanggal | DateField | Required | Date |
| jam_ke | PositiveSmallInteger | 1-9 | Lesson period |
| mata_pelajaran | CharField(100) | Nullable | Subject |
| status | CharField(50) | Required | Hadir/Sakit/Izin/Alpha |
| keterangan | TextField | Nullable | Notes |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |

**Unique Constraint:** `(nisn, tanggal, jam_ke)`

**Lesson Periods:**
| JP | Label |
|----|-------|
| 1 | JP 1 (Pagi) |
| 2-7 | JP 2-7 (Siang) |
| 8-9 | JP 8-9 (Sore) |

### 6.2 AttendanceDraft
**Table:** `attendance_draft`

Temporary attendance data before submission.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| username | CharField(50) | Required | Teacher username |
| kelas | CharField(20) | Required | Class |
| tanggal | DateField | Required | Date |
| mata_pelajaran | CharField(100) | Required | Subject |
| data | JSONField | Nullable | Draft data |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |

---

## 7. Evaluations Models

### 7.1 Evaluation
**Table:** `evaluations`

Student evaluations (prestasi/pelanggaran).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| nisn | ForeignKey | FK → Student | Student reference |
| tanggal | DateField | Required | Evaluation date |
| jenis | CharField(20) | Choices | prestasi/pelanggaran |
| kategori | CharField(30) | Choices | Category |
| evaluator | CharField(100) | Required | Evaluator name |
| name | CharField(200) | Required | Evaluation title |
| summary | TextField | Required | Description |
| catatan | TextField | Nullable | Additional notes |
| photo | ImageField | Nullable | Evidence photo |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |

**Kategori Choices:**
- adab, kedisiplinan, akademik, kebersihan, hafalan, sosial

---

## 8. Kesantrian Models

### 8.1 Ibadah
**Table:** `kesantrian_ibadah`

Daily worship tracking.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| siswa | ForeignKey | FK → Student | Student reference |
| tanggal | DateField | Required | Date |
| jenis | CharField(20) | Choices | Worship type |
| waktu | CharField(30) | Choices | Prayer time |
| status | CharField(20) | Choices | hadir/tidak_hadir/terlambat/izin/sakit |
| catatan | TextField | Nullable | Notes |
| pencatat | CharField(100) | Required | Recorder username |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |

**Unique Constraint:** `(siswa, tanggal, jenis, waktu)`

**Jenis Choices:**
- sholat_wajib, sholat_sunnah, puasa, dzikir, tilawah

**Waktu Choices:**
- subuh, dzuhur, ashar, maghrib, isya, dhuha, tahajud, rawatib_qabliyah, rawatib_badiyah, witir, tarawih

### 8.2 Halaqoh
**Table:** `kesantrian_halaqoh`

Quran study groups.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| nama | CharField(100) | Required | Group name |
| jenis | CharField(20) | Choices | tahfidz/tahsin/kajian/bahasa |
| musyrif | CharField(100) | Required | Supervisor name |
| musyrif_username | CharField(50) | Nullable | Supervisor username |
| jadwal | CharField(200) | Nullable | Schedule |
| lokasi | CharField(100) | Nullable | Location |
| kapasitas | PositiveIntegerField | Default: 15 | Max members |
| aktif | BooleanField | Default: True | Active status |
| tahun_ajaran | CharField(10) | Required | Academic year |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |

### 8.3 HalaqohMember
**Table:** `kesantrian_halaqoh_member`

Halaqoh membership.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| halaqoh | ForeignKey | FK → Halaqoh | Halaqoh reference |
| siswa | ForeignKey | FK → Student | Student reference |
| tanggal_gabung | DateField | Auto | Join date |
| aktif | BooleanField | Default: True | Active status |
| catatan | TextField | Nullable | Notes |

**Unique Constraint:** `(halaqoh, siswa)`

### 8.4 Pembinaan
**Table:** `kesantrian_pembinaan`

Student guidance records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| siswa | ForeignKey | FK → Student | Student reference |
| tanggal | DateField | Required | Date |
| kategori | CharField(30) | Choices | Category |
| judul | CharField(200) | Required | Title |
| deskripsi | TextField | Required | Description |
| tingkat | CharField(20) | Choices | Level |
| tindak_lanjut | TextField | Nullable | Follow-up |
| pembina | CharField(100) | Required | Counselor name |
| pembina_username | CharField(50) | Nullable | Counselor username |
| surah | CharField(100) | Nullable | Surah (for hafalan) |
| ayat_mulai | PositiveIntegerField | Nullable | Start verse |
| ayat_selesai | PositiveIntegerField | Nullable | End verse |
| jumlah_halaman | DecimalField(5,2) | Nullable | Pages count |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |

### 8.5 BLPEntry
**Table:** `kesantrian_blp_entry`

Weekly character assessment with 59 indicators.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| siswa | ForeignKey | FK → Student | Student reference |
| week_start | DateField | Required | Week start (Sunday) |
| week_end | DateField | Required | Week end (Saturday) |
| tahun_ajaran | CharField(10) | Required | Academic year |
| semester | CharField(10) | Choices | Ganjil/Genap |
| indicator_values | JSONField | Required | 59 indicator scores |
| bonus_points | PositiveIntegerField | Max: 95 | Bonus points |
| bonus_notes | TextField | Nullable | Bonus notes |
| total_score | PositiveIntegerField | Max: 390 | Calculated total |
| domain_scores | JSONField | Default: {} | Per-domain scores |
| status | CharField(20) | Choices | draft/submitted/locked/archived |
| is_locked | BooleanField | Default: False | Lock status |
| locked_at | DateTimeField | Nullable | Lock timestamp |
| locked_by | CharField(50) | Nullable | Locker username |
| catatan | TextField | Nullable | General notes |
| tindak_lanjut | TextField | Nullable | Follow-up |
| pencatat | CharField(100) | Required | Recorder name |
| pencatat_username | CharField(50) | Nullable | Recorder username |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |

**Unique Constraint:** `(siswa, week_start)`

**BLP Scoring System:**
- 59 indicators across 6 domains
- Each indicator: 0-5 points
- Max base score: 295 points
- Bonus points: 0-95
- Max total: 390 points

**Predikat Calculation:**
| Percentage | Predikat |
|------------|----------|
| ≥90% | Mumtaz |
| ≥75% | Jayyid Jiddan |
| ≥60% | Jayyid |
| ≥40% | Maqbul |
| <40% | Perlu Pembinaan |

### 8.6 Incident
**Table:** `kesantrian_incident`

Case management for student issues.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| siswa | ForeignKey | FK → Student | Student reference |
| judul | CharField(200) | Required | Title |
| deskripsi | TextField | Required | Description |
| kategori | CharField(20) | Choices | Category |
| tingkat | CharField(20) | Choices | Severity |
| tanggal_kejadian | DateField | Required | Incident date |
| lokasi | CharField(100) | Nullable | Location |
| status | CharField(20) | Choices | Workflow status |
| pelapor | ForeignKey | FK → User | Reporter |
| pelapor_role | CharField(50) | Required | Reporter role |
| assigned_to | ForeignKey | FK → User | Assignee |
| keputusan_final | TextField | Nullable | Final decision |
| diputuskan_oleh | ForeignKey | FK → User | Decision maker |
| tanggal_keputusan | DateTimeField | Nullable | Decision date |
| tindak_lanjut | TextField | Nullable | Follow-up plan |
| deadline_tindak_lanjut | DateField | Nullable | Follow-up deadline |
| tahun_ajaran | CharField(10) | Default: 2025/2026 | Academic year |
| semester | CharField(10) | Default: Ganjil | Semester |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |

**Status Workflow:**
- `open` → `in_discussion` → `resolved` → `closed`

**Tingkat Choices:**
- ringan, sedang, berat, kritis

### 8.7 IncidentComment
**Table:** `kesantrian_incident_comment`

Threaded comments on incidents.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| incident | ForeignKey | FK → Incident | Incident reference |
| content | TextField | Required | Comment content |
| comment_type | CharField(20) | Choices | observation/suggestion/evaluation/decision/follow_up/note |
| author | ForeignKey | FK → User | Author |
| author_role | CharField(50) | Required | Author role |
| author_role_display | CharField(100) | Nullable | Display name |
| visibility | CharField(20) | Choices | Visibility level |
| parent_comment | ForeignKey | FK → Self | Parent (for threads) |
| attachment | FileField | Nullable | Attachment |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |

**Visibility Choices:**
- `internal` - Only staff can see
- `public` - Walisantri can see
- `final_decision` - Final decision visible to all

### 8.8 AsatidzEvaluation
**Table:** `kesantrian_asatidz_evaluation`

Staff evaluation records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| ustadz | ForeignKey | FK → User | Target staff |
| tanggal_kejadian | DateField | Required | Event date |
| kategori | CharField(20) | Choices | apresiasi/administratif/kedisiplinan |
| deskripsi | TextField | Required | Description |
| dilaporkan_oleh | ForeignKey | FK → User | Reporter |
| tahun_ajaran | CharField(10) | Default: 2025/2026 | Academic year |
| semester | CharField(10) | Default: Ganjil | Semester |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |

### 8.9 InvalRecord
**Table:** `inval_records`

Teacher substitution records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| guru_absent | ForeignKey | FK → User | Absent teacher |
| guru_pengganti | ForeignKey | FK → User | Substitute teacher |
| tanggal | DateField | Required | Date |
| jam_pelajaran | CharField(20) | Required | Lesson period |
| kelas | CharField(20) | Required | Class |
| mata_pelajaran | CharField(100) | Required | Subject |
| alasan | CharField(20) | Choices | Reason |
| keterangan | TextField | Nullable | Notes |
| bukti_file | FileField | Nullable | Evidence file |
| status | CharField(20) | Choices | pending/verified/rejected |
| verified_by | CharField(50) | Nullable | Verifier |
| verified_at | DateTimeField | Nullable | Verification time |
| rejection_reason | TextField | Nullable | Rejection reason |
| evaluation_created | BooleanField | Default: False | Auto-eval flag |
| recorded_by | ForeignKey | FK → User | Recorder |
| recorded_by_username | CharField(50) | Required | Recorder username |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |

### 8.10 EmployeeEvaluation
**Table:** `employee_evaluations`

Point-based staff evaluation (auto-generated from Inval).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| user | ForeignKey | FK → User | Target staff |
| tanggal | DateField | Required | Date |
| jenis | CharField(20) | Choices | Evaluation type |
| poin | IntegerField | Required | Points (+/-) |
| keterangan | TextField | Required | Description |
| inval_record | ForeignKey | FK → InvalRecord | Source record |
| tahun_ajaran | CharField(10) | Required | Academic year |
| semester | CharField(10) | Choices | Ganjil/Genap |
| created_by | CharField(50) | Required | Creator |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |

---

## 9. Finance Models

### 9.1 Tarif
**Table:** `finance_tarif`

Fee master data.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| nama | CharField(100) | Required | Fee name |
| kategori | CharField(20) | Choices | spp/gedung/seragam/buku/kegiatan/wisuda/lainnya |
| frekuensi | CharField(20) | Choices | bulanan/semester/tahunan/sekali |
| nominal | DecimalField(12,2) | Min: 0 | Fee amount |
| tahun_ajaran | CharField(10) | Required | Academic year |
| kelas | CharField(20) | Nullable | Target class |
| program | CharField(50) | Nullable | Target program |
| deskripsi | TextField | Nullable | Description |
| aktif | BooleanField | Default: True | Active status |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |
| created_by | CharField(100) | Nullable | Creator |
| updated_by | CharField(100) | Nullable | Last editor |

### 9.2 Tagihan
**Table:** `finance_tagihan`

Student invoices.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| siswa | ForeignKey | FK → Student | Student reference |
| tarif | ForeignKey | FK → Tarif | Fee reference |
| bulan | PositiveSmallInteger | Choices | Month (1-12) |
| tahun | PositiveIntegerField | Required | Year |
| nominal | DecimalField(12,2) | Min: 0 | Invoice amount |
| diskon | DecimalField(12,2) | Default: 0 | Discount |
| denda | DecimalField(12,2) | Default: 0 | Late fee |
| total | DecimalField(12,2) | Calculated | Total amount |
| terbayar | DecimalField(12,2) | Default: 0 | Amount paid |
| sisa | DecimalField(12,2) | Calculated | Remaining |
| status | CharField(20) | Choices | Payment status |
| jatuh_tempo | DateField | Required | Due date |
| keterangan | TextField | Nullable | Notes |
| no_invoice | CharField(50) | Unique | Invoice number |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |
| created_by | CharField(100) | Nullable | Creator |
| updated_by | CharField(100) | Nullable | Last editor |

**Unique Constraint:** `(siswa, tarif, bulan, tahun)`

**Status Choices:**
- belum_bayar, sebagian, lunas, lewat_jatuh_tempo

### 9.3 Pembayaran
**Table:** `finance_pembayaran`

Payment records.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| tagihan | ForeignKey | FK → Tagihan | Invoice reference |
| tanggal | DateTimeField | Default: now | Payment date |
| nominal | DecimalField(12,2) | Min: 0.01 | Payment amount |
| metode | CharField(20) | Choices | tunai/transfer/qris/virtual_account/lainnya |
| bukti | ImageField | Nullable | Receipt image |
| nomor_referensi | CharField(100) | Nullable | Reference number |
| terverifikasi | BooleanField | Default: False | Verification status |
| tanggal_verifikasi | DateTimeField | Nullable | Verification date |
| verified_by | CharField(100) | Nullable | Verifier |
| keterangan | TextField | Nullable | Notes |
| created_at | DateTimeField | Auto | Creation timestamp |
| updated_at | DateTimeField | Auto | Update timestamp |
| created_by | CharField(100) | Nullable | Creator |
| updated_by | CharField(100) | Nullable | Last editor |

### 9.4 LaporanKeuangan
**Table:** `finance_laporan`

Monthly financial reports.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | BigAutoField | PK | Primary key |
| bulan | PositiveSmallInteger | Required | Month |
| tahun | PositiveIntegerField | Required | Year |
| total_tagihan | DecimalField(15,2) | Default: 0 | Total invoices |
| total_terbayar | DecimalField(15,2) | Default: 0 | Total paid |
| total_tunggakan | DecimalField(15,2) | Default: 0 | Total arrears |
| jumlah_siswa_lunas | PositiveIntegerField | Default: 0 | Paid students count |
| jumlah_siswa_tunggakan | PositiveIntegerField | Default: 0 | Arrears count |
| generated_at | DateTimeField | Auto | Generation timestamp |
| generated_by | CharField(100) | Nullable | Generator |

**Unique Constraint:** `(bulan, tahun)`

---

## 10. API Endpoints

### 10.1 Core API
**Base:** `/api/core/`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/tahun-ajaran/active/` | Get active academic year | Public |
| GET | `/tahun-ajaran/` | List all academic years | Superadmin |
| POST | `/tahun-ajaran/` | Create academic year | Superadmin |
| GET | `/tahun-ajaran/{id}/` | Get academic year detail | Superadmin |
| PUT | `/tahun-ajaran/{id}/` | Update academic year | Superadmin |
| DELETE | `/tahun-ajaran/{id}/` | Delete academic year | Superadmin |

### 10.2 Auth API
**Base:** `/api/auth/`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/csrf/` | Get CSRF token | Public |
| POST | `/login/` | User login | Public |
| POST | `/logout/` | User logout | Authenticated |
| GET | `/status/` | Auth status check | Authenticated |
| POST | `/change-password/` | Change password | Authenticated |
| POST | `/request-reset/` | Request password reset | Public |
| POST | `/reset-password/` | Reset password with token | Public |
| POST | `/token/refresh/` | Refresh JWT token | Authenticated |

### 10.3 Users API
**Base:** `/api/users/`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/me/` | Get current user | Authenticated |
| GET | `/` | List all users | Superadmin |
| POST | `/` | Create user | Superadmin |
| GET | `/{username}/` | Get user detail | Superadmin |
| PUT | `/{username}/` | Update user | Superadmin |
| DELETE | `/{username}/` | Delete user | Superadmin |
| GET | `/{user_id}/assignments/` | Get user assignments | Superadmin |

### 10.4 Students API
**Base:** `/api/students/`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | List students | Staff |
| POST | `/` | Create student | Staff |
| GET | `/{nisn}/` | Get student detail | Staff |
| PUT | `/{nisn}/` | Update student | Staff |
| DELETE | `/{nisn}/` | Delete student | Staff |
| GET | `/classes/` | Get distinct classes | Staff |
| GET | `/statistics/` | Student statistics | Staff |
| POST | `/import/` | Import from Excel | Staff |
| POST | `/bulk-update-class/` | Bulk class update | Staff |
| GET | `/download-template/` | Download import template | Staff |
| GET | `/alumni/` | List alumni | Staff |
| GET | `/alumni/statistics/` | Alumni statistics | Staff |
| GET | `/alumni/{nisn}/` | Alumni detail | Staff |
| PUT | `/alumni/{nisn}/update/` | Update alumni info | Staff |
| POST | `/set-alumni/` | Set alumni status | Staff |
| POST | `/bulk-set-alumni/` | Bulk set alumni | Staff |
| POST | `/reactivate/` | Reactivate student | Staff |

### 10.5 Grades API
**Base:** `/api/grades/`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | List grades | Staff |
| POST | `/` | Create grade | Guru |
| GET | `/{id}/` | Get grade detail | Staff |
| PUT | `/{id}/` | Update grade | Guru |
| DELETE | `/{id}/` | Delete grade | Guru |
| GET | `/statistics/` | Grade statistics | Staff |
| GET | `/average/{nisn}/` | Student average | Staff/Walisantri |
| GET | `/my-child/` | Walisantri view | Walisantri |
| GET | `/class/{kelas}/` | Class grades | Staff |
| GET | `/all/` | All grades | Staff |
| GET | `/classes/` | Distinct classes | Staff |
| GET | `/mata-pelajaran/` | Distinct subjects | Staff |
| POST | `/import/` | Import from Excel | Guru |
| GET | `/generate-template/` | Generate template | Guru |
| POST | `/import-v2/` | Import v2 | Guru |

### 10.6 Attendance API
**Base:** `/api/attendance/`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | List attendance | Staff |
| POST | `/` | Create attendance | Guru |
| GET | `/{id}/` | Get attendance detail | Staff |
| PUT | `/{id}/` | Update attendance | Guru |
| DELETE | `/{id}/` | Delete attendance | Guru |
| POST | `/initialize/` | Initialize class attendance | Guru |
| POST | `/batch/` | Save batch attendance | Guru |
| GET | `/today/{nisn}/` | Today's attendance | Staff |
| GET | `/monthly/{nisn}/{month}/{year}/` | Monthly attendance | Staff |
| GET | `/stats/{nisn}/` | Attendance stats | Staff |
| GET | `/class/{kelas}/{tanggal}/` | Class attendance | Staff |
| GET | `/all/` | All attendance | Staff |
| GET | `/history/` | Attendance history | Staff |

### 10.7 Evaluations API
**Base:** `/api/evaluations/`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | List evaluations | Staff |
| POST | `/` | Create evaluation | Staff |
| GET | `/{id}/` | Get evaluation detail | Staff |
| PUT | `/{id}/` | Update evaluation | Staff |
| DELETE | `/{id}/` | Delete evaluation | Staff |
| GET | `/student/{nisn}/` | Student evaluations | Staff/Walisantri |
| GET | `/all/` | All evaluations | Staff |
| GET | `/statistics/` | Evaluation statistics | Staff |

### 10.8 Kesantrian API
**Base:** `/api/kesantrian/`

#### Walisantri Endpoints
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/my-children-summary/` | Children summary | Walisantri |
| GET | `/ibadah/{nisn}/` | Child ibadah detail | Walisantri/Staff |
| GET | `/pembinaan/{nisn}/` | Child pembinaan | Walisantri/Staff |
| GET | `/worship-tracker/{nisn}/` | Worship tracker | Walisantri/Staff |

#### Recording Endpoints
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/ibadah/record/` | Record ibadah | Musyrif/Guru |
| POST | `/ibadah/record-bulk/` | Bulk record ibadah | Musyrif/Guru |

#### Chart & Print
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/chart-data/{nisn}/` | Chart data | Staff |
| GET | `/print-rapor/{nisn}/` | Rapor data | Staff |
| GET | `/print-rapor-html/{nisn}/` | Rapor HTML | Staff |
| GET | `/behavior-summary/{nisn}/` | Behavior summary | Staff |
| GET | `/student-metrics/{nisn}/` | Student metrics | Staff |

#### BLP Endpoints
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/blp/indicators/` | Get BLP indicators | Staff |
| GET | `/blp/` | List BLP entries | Staff |
| POST | `/blp/` | Create BLP entry | Staff |
| GET | `/blp/{id}/` | Get BLP detail | Staff |
| PUT | `/blp/{id}/` | Update BLP entry | Staff |
| DELETE | `/blp/{id}/` | Delete BLP entry | Staff |
| POST | `/blp/{id}/lock/` | Lock BLP entry | Staff |
| GET | `/blp/student/{nisn}/` | Student BLP history | Staff/Walisantri |

#### Inval Endpoints
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/inval/` | List inval records | Staff |
| POST | `/inval/` | Create inval | Guru |
| GET | `/inval/{id}/` | Get inval detail | Staff |
| PUT | `/inval/{id}/` | Update inval | Guru |
| POST | `/inval/{id}/verify/` | Verify inval | Pimpinan |

#### Employee Evaluation
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/employee-evaluations/` | List evaluations | Pimpinan |
| GET | `/employee-evaluations/user/{id}/` | User summary | Pimpinan |

#### Incident Endpoints
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/incidents/summary/` | Incident summary | Staff |
| GET | `/incidents/` | List incidents | Staff |
| POST | `/incidents/` | Create incident | Staff |
| GET | `/incidents/{id}/` | Get incident detail | Staff |
| PUT | `/incidents/{id}/` | Update incident | Staff |
| POST | `/incidents/{id}/resolve/` | Resolve incident | Pimpinan |
| GET | `/incidents/student/{nisn}/` | Student incidents | Staff/Walisantri |
| GET | `/incidents/{id}/comments/` | Get comments | Staff |
| POST | `/incidents/{id}/comments/` | Add comment | Staff |
| GET | `/comments/{id}/` | Get comment detail | Staff |
| PUT | `/comments/{id}/` | Update comment | Author |
| DELETE | `/comments/{id}/` | Delete comment | Author |

#### Asatidz Evaluation
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/asatidz/evaluations/` | List evaluations | Pimpinan/Self |
| POST | `/asatidz/evaluations/` | Create evaluation | Pimpinan |
| GET | `/asatidz/evaluations/summary/` | Evaluation summary | Pimpinan |
| GET | `/asatidz/evaluations/{id}/` | Get detail | Pimpinan/Self |
| PUT | `/asatidz/evaluations/{id}/` | Update evaluation | Pimpinan |
| DELETE | `/asatidz/evaluations/{id}/` | Delete evaluation | Pimpinan |
| GET | `/asatidz/evaluations/ustadz/{id}/` | By ustadz | Pimpinan/Self |

#### PDF Downloads
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/download-rapor/{nisn}/` | Download rapor PDF | Staff |
| GET | `/download-blp/{nisn}/` | Download BLP PDF | Staff |

### 10.9 Finance API
**Base:** `/api/finance/`

#### Tarif (ViewSet)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/tarif/` | List tarif | Bendahara |
| POST | `/tarif/` | Create tarif | Bendahara |
| GET | `/tarif/{id}/` | Get tarif detail | Bendahara |
| PUT | `/tarif/{id}/` | Update tarif | Bendahara |
| DELETE | `/tarif/{id}/` | Delete tarif | Bendahara |

#### Tagihan (ViewSet)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/tagihan/` | List tagihan | Bendahara |
| POST | `/tagihan/` | Create tagihan | Bendahara |
| GET | `/tagihan/{id}/` | Get tagihan detail | Bendahara |
| PUT | `/tagihan/{id}/` | Update tagihan | Bendahara |
| DELETE | `/tagihan/{id}/` | Delete tagihan | Bendahara |
| GET | `/tagihan/summary/` | Tagihan summary | Bendahara |
| POST | `/tagihan/generate_bulk/` | Generate bulk | Bendahara |

#### Pembayaran (ViewSet)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/pembayaran/` | List pembayaran | Bendahara |
| POST | `/pembayaran/` | Create pembayaran | Bendahara/Walisantri |
| GET | `/pembayaran/{id}/` | Get pembayaran detail | Bendahara |
| PUT | `/pembayaran/{id}/` | Update pembayaran | Bendahara |
| DELETE | `/pembayaran/{id}/` | Delete pembayaran | Bendahara |
| POST | `/pembayaran/{id}/verify/` | Verify pembayaran | Bendahara |
| GET | `/pembayaran/pending/` | Pending verification | Bendahara |

#### Other Finance Endpoints
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/statistics/` | Finance statistics | Bendahara |
| GET | `/student/{nisn}/` | Student finance summary | Walisantri |
| POST | `/generate-spp/` | Generate monthly SPP | Bendahara |

---

## 11. Authentication & Security

### 11.1 JWT Authentication
- Access token lifetime: 1 day
- Refresh token lifetime: 7 days
- Token stored in HTTP-only cookies and Authorization header

### 11.2 Permission Classes

| Permission | Description |
|------------|-------------|
| `IsSuperAdmin` | Only superadmin role |
| `IsPimpinan` | Superadmin or pimpinan |
| `IsStaff` | All staff roles (excludes walisantri, pendaftar) |
| `IsGuru` | Guru or musyrif |
| `IsBendahara` | Finance staff |
| `IsWalisantri` | Parent/guardian access |
| `IsOwnerOrAdmin` | Object owner or admin |
| `IsAsatidzEvaluationAllowed` | HR module access |

### 11.3 RBAC Matrix (Summary)

| Role | Students | Grades | Attendance | BLP | Incidents | Finance | Users |
|------|----------|--------|------------|-----|-----------|---------|-------|
| superadmin | Full | Full | Full | Full | Full | Full | Full |
| pimpinan | Read | Read | Read | Full | Full | Read | Limited |
| guru | Class | Class | Class | Class | Create | - | - |
| musyrif | Class | - | Class | Class | Create | - | - |
| bendahara | - | - | - | - | - | Full | - |
| walisantri | Own | Own | Own | Own | View | Own | - |

### 11.4 Security Features
- CSRF protection enabled
- Password hashing with Django's PBKDF2
- Rate limiting on auth endpoints
- Input validation on all endpoints
- SQL injection protection via ORM
- XSS protection in templates

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 2.3.4 | 2026-03-21 | Initial documentation |
| - | - | Added TahunAjaran model |
| - | - | Complete API endpoint mapping |
| - | - | Security documentation |
