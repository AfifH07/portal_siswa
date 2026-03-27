# Dokumentasi Teknis: Fitur Utama dan Role-Based Access Control

**Portal Sistem Informasi Pondok Pesantren Baron**
**Versi:** 2.3.4
**Tanggal:** Maret 2026

---

## 1. Modul Utama (Core Features)

### 1.1 Modul Manajemen Kasus & Bimbingan Santri (Incident Management)

#### 1.1.1 Deskripsi Modul

Modul Catatan & Bimbingan (*Incident Management*) adalah sistem case management untuk mencatat, membahas, dan menyelesaikan kejadian/masalah santri yang memerlukan koordinasi antar stakeholder (BK, Mudir, Wali Kelas). Sistem ini menerapkan *threaded discussion* dengan kontrol visibilitas untuk menjaga kerahasiaan informasi sensitif.

#### 1.1.2 Model Data: `Incident`

```python
class Incident(models.Model):
    # Identifikasi
    siswa = ForeignKey(Student)                    # Santri terkait
    judul = CharField(max_length=200)              # Ringkasan kejadian
    deskripsi = TextField()                        # Deskripsi lengkap

    # Klasifikasi
    kategori = CharField(choices=[
        ('perilaku', 'Perilaku/Akhlak'),
        ('kedisiplinan', 'Kedisiplinan'),
        ('akademik', 'Akademik'),
        ('kesehatan', 'Kesehatan'),
        ('sosial', 'Interaksi Sosial'),
        ('keluarga', 'Masalah Keluarga'),
        ('lainnya', 'Lainnya'),
    ])
    tingkat = CharField(choices=[
        ('ringan', 'Ringan'),
        ('sedang', 'Sedang'),
        ('berat', 'Berat'),
        ('kritis', 'Kritis'),
    ])

    # Status Workflow
    status = CharField(choices=[
        ('open', 'Open'),
        ('in_discussion', 'In Discussion'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ])

    # Tracking
    pelapor = ForeignKey(User)                     # Ustadz yang melaporkan
    assigned_to = ForeignKey(User)                 # Ustadz penanggungjawab
    diputuskan_oleh = ForeignKey(User)             # Mudir yang memutuskan
    keputusan_final = TextField()                  # Keputusan akhir
```

#### 1.1.3 Fitur Thread Diskusi (IncidentComment)

Setiap incident memiliki sistem komentar berjenjang dengan kontrol visibilitas:

```python
class IncidentComment(models.Model):
    incident = ForeignKey(Incident)
    author = ForeignKey(User)                      # Penulis komentar
    author_role = CharField()                      # Role saat menulis
    content = TextField()                          # Isi komentar

    visibility = CharField(choices=[
        ('internal', 'Internal (Hanya Ustadz)'),
        ('public', 'Public (Termasuk Wali Santri)'),
        ('final_decision', 'Final Decision'),
    ])

    comment_type = CharField(choices=[
        ('discussion', 'Diskusi'),
        ('recommendation', 'Rekomendasi'),
        ('action', 'Tindakan'),
        ('final_decision', 'Keputusan Final'),
    ])
```

**Aturan Visibilitas:**
| Visibility | Ustadz/BK/Mudir | Wali Santri |
|------------|-----------------|-------------|
| `internal` | ✅ Dapat melihat | ❌ Tersembunyi |
| `public` | ✅ Dapat melihat | ✅ Dapat melihat |
| `final_decision` | ✅ Dapat melihat | ✅ Dapat melihat |

#### 1.1.4 Workflow Penanganan Kasus

```
┌─────────────────────────────────────────────────────────────────────┐
│                          INCIDENT WORKFLOW                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────┐    ┌──────────────────┐    ┌───────────────────┐     │
│   │  🔴 OPEN │ ──►│  🟡 IN_DISCUSSION │ ──►│  🟢 RESOLVED      │     │
│   └──────────┘    └──────────────────┘    └───────────────────┘     │
│        │                    │                       │                │
│        ▼                    ▼                       ▼                │
│   BK/Wali Kelas        Koordinasi             Mudir memberikan      │
│   mencatat             antar pihak            keputusan final       │
│   kejadian             menambah               via comment           │
│                        komentar               final_decision        │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  Wali Santri hanya melihat:                                  │   │
│   │  • Judul & status                                            │   │
│   │  • Komentar visibility='public' atau 'final_decision'        │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 1.1.5 API Endpoints

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/api/kesantrian/incidents/` | GET | List incidents (filtered by role) |
| `/api/kesantrian/incidents/` | POST | Create new incident |
| `/api/kesantrian/incidents/{id}/` | GET | Detail incident with comments |
| `/api/kesantrian/incidents/{id}/` | PUT | Update incident |
| `/api/kesantrian/incidents/{id}/resolve/` | POST | Resolve with final decision |
| `/api/kesantrian/incidents/{id}/comments/` | POST | Add comment |
| `/api/kesantrian/incidents/summary/` | GET | Summary statistics |

---

### 1.2 Modul Evaluasi Asatidz (HR/Kinerja Karyawan)

#### 1.2.1 Deskripsi Modul

Modul Evaluasi Asatidz adalah sistem HR untuk mencatat evaluasi kinerja Ustadz/Karyawan oleh Pimpinan/Mudir. Berbeda dengan sistem evaluasi berbasis poin, modul ini bersifat *narrative/descriptive* dengan kategorisasi berdasarkan jenis catatan.

#### 1.2.2 Model Data: `AsatidzEvaluation`

```python
class AsatidzEvaluation(models.Model):
    # Target evaluasi
    ustadz = ForeignKey(User)                      # Ustadz yang dievaluasi

    # Detail evaluasi
    tanggal_kejadian = DateField()                 # Tanggal observasi
    kategori = CharField(choices=[
        ('apresiasi', 'Apresiasi'),                # 🌟 Pencapaian positif
        ('administratif', 'Administratif'),        # 📋 Catatan administrasi
        ('kedisiplinan', 'Kedisiplinan'),          # ⚠️ Catatan disiplin
    ])
    deskripsi = TextField()                        # Deskripsi lengkap

    # Metadata
    dilaporkan_oleh = ForeignKey(User)             # Auto-filled: Mudir
    tahun_ajaran = CharField()
    semester = CharField()
```

#### 1.2.3 Fitur Summary Cards

Dashboard modul menampilkan statistik agregat dalam bentuk card:

```
┌──────────────────────────────────────────────────────────────┐
│                    SUMMARY CARDS (Pimpinan View)              │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────┐  │
│  │ 📊 TOTAL    │  │ 🌟 APRESIASI│  │ 📋 ADMIN    │  │ ⚠️  │  │
│  │    47       │  │     23      │  │     15      │  │  9  │  │
│  │ Total Eval  │  │ Apresiasi   │  │Administratif│  │Disip│  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────┘  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Perhitungan Summary:**
```javascript
function updateSummary(data) {
    const apresiasi = data.filter(e => e.kategori === 'apresiasi').length;
    const administratif = data.filter(e => e.kategori === 'administratif').length;
    const kedisiplinan = data.filter(e => e.kategori === 'kedisiplinan').length;
    const total = data.length;
}
```

#### 1.2.4 Fitur Real-time Filter

Sistem menyediakan filtering client-side dengan debounce 300ms:

| Filter | Deskripsi |
|--------|-----------|
| **Search** | Pencarian nama ustadz atau isi evaluasi |
| **Kategori** | Filter berdasarkan apresiasi/administratif/kedisiplinan |
| **Ustadz** | Dropdown filter per ustadz |
| **Reset** | Mengembalikan semua filter ke default |

```javascript
// Filter dengan debounce
searchInput.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        applyFilters();
    }, 300);
});
```

#### 1.2.5 Fitur Kategori Badges

Setiap evaluasi ditampilkan dengan badge visual berdasarkan kategori:

| Kategori | Badge Color | Icon | CSS Class |
|----------|-------------|------|-----------|
| Apresiasi | Hijau (#22c55e) | 🌟 | `.kategori-apresiasi` |
| Administratif | Kuning (#f59e0b) | 📋 | `.kategori-administratif` |
| Kedisiplinan | Merah (#ef4444) | ⚠️ | `.kategori-kedisiplinan` |

#### 1.2.6 API Endpoints

| Endpoint | Method | Akses |
|----------|--------|-------|
| `/api/kesantrian/asatidz/evaluations/` | GET | All staff (filtered by role) |
| `/api/kesantrian/asatidz/evaluations/` | POST | Pimpinan only |
| `/api/kesantrian/asatidz/evaluations/{pk}/` | GET/PUT/DELETE | Pimpinan (all), Ustadz (own GET) |
| `/api/kesantrian/asatidz/evaluations/summary/` | GET | Pimpinan only |
| `/api/kesantrian/asatidz/evaluations/ustadz/{id}/` | GET | Pimpinan (all), Ustadz (own) |

---

### 1.3 Modul Penilaian Karakter (BLP - Buku Laporan Pendidikan)

#### 1.3.1 Deskripsi Modul

BLP (*Buku Laporan Pendidikan*) adalah sistem penilaian karakter santri berbasis indikator terstruktur. Sistem menggunakan 25 indikator inti (*core*) yang dikelompokkan dalam 6 domain, dengan visualisasi menggunakan **Radar Chart** untuk representasi holistik perkembangan karakter santri.

#### 1.3.2 Model Data: `BLPEntry`

```python
class BLPEntry(models.Model):
    siswa = ForeignKey(Student)

    # Periode mingguan
    week_start = DateField()                       # Tanggal mulai (Minggu)
    week_end = DateField()                         # Tanggal akhir (Sabtu)
    tahun_ajaran = CharField()
    semester = CharField()

    # Penilaian (JSONField)
    indicator_values = JSONField(default=get_blp_default_values)
    # Struktur: {"akhlak": {"sopan_santun": 4, ...}, "kedisiplinan": {...}, ...}

    # Skor kalkulasi
    total_score = PositiveIntegerField()           # Max 125 (core)
    domain_scores = JSONField()                    # Skor per domain

    # Status
    status = CharField(choices=[
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('locked', 'Locked'),
    ])
```

#### 1.3.3 Struktur 25 Indikator Inti (BLP Core)

| Domain | Jumlah Indikator | Skor Maks | Indikator Utama |
|--------|------------------|-----------|-----------------|
| **Akhlak & Adab** | 5 | 25 | Sopan Santun, Kejujuran, Tawadhu, Adab Makan, Adab Berbicara |
| **Kedisiplinan** | 4 | 20 | Tepat Waktu Sholat, Tepat Waktu Kelas, Kebersihan Diri, Jam Malam |
| **Ibadah & Spiritual** | 6 | 30 | Sholat Wajib, Dhuha, Tahajud, Tilawah, Dzikir, Kekhusyukan |
| **Akademik Keagamaan** | 4 | 20 | Hafalan, Murojaah, Tajwid, Kehadiran Diniyah |
| **Interaksi Sosial** | 3 | 15 | Kerjasama, Tolong Menolong, Anti Bullying |
| **Pengembangan Diri** | 3 | 15 | Kemandirian, Inisiatif, Public Speaking |
| **TOTAL** | **25** | **125** | - |

#### 1.3.4 Sistem Penilaian

**Skala Nilai per Indikator:**
| Nilai | Label | Deskripsi |
|-------|-------|-----------|
| 0 | Belum | Belum terlihat/dinilai |
| 1 | Sangat Kurang | Perlu pembinaan intensif |
| 2 | Kurang | Perlu perhatian khusus |
| 3 | Cukup | Memenuhi standar minimal |
| 4 | Baik | Di atas standar |
| 5 | Sangat Baik | Teladan |

**Predikat Berdasarkan Persentase:**
| Persentase | Predikat | Keterangan |
|------------|----------|------------|
| ≥ 90% | **Mumtaz** | Istimewa |
| ≥ 75% | **Jayyid Jiddan** | Sangat Baik |
| ≥ 60% | **Jayyid** | Baik |
| ≥ 40% | **Maqbul** | Cukup |
| < 40% | **Perlu Pembinaan** | Perlu perhatian khusus |

```python
@property
def predikat(self):
    percentage = (self.total_score / 125) * 100
    if percentage >= 90:
        return 'Mumtaz'
    elif percentage >= 75:
        return 'Jayyid Jiddan'
    elif percentage >= 60:
        return 'Jayyid'
    elif percentage >= 40:
        return 'Maqbul'
    else:
        return 'Perlu Pembinaan'
```

#### 1.3.5 Visualisasi Radar Chart

BLP menggunakan **Chart.js Radar Chart** untuk visualisasi 6 domain:

```javascript
// Konfigurasi Radar Chart
const radarConfig = {
    type: 'radar',
    data: {
        labels: [
            'Akhlak',
            'Kedisiplinan',
            'Ibadah',
            'Akademik',
            'Sosial',
            'Pengembangan'
        ],
        datasets: [{
            label: 'Skor Santri',
            data: [80, 75, 90, 70, 85, 65],  // Persentase per domain
            backgroundColor: 'rgba(31, 168, 122, 0.2)',
            borderColor: '#1fa87a',
            borderWidth: 2,
        }]
    },
    options: {
        scales: {
            r: {
                min: 0,
                max: 100,
                ticks: { stepSize: 20 }
            }
        }
    }
};
```

**Tampilan Visual:**
```
                          Akhlak (80%)
                              ●
                           ╱     ╲
                        ╱           ╲
       Pengembangan ●─────────────────● Kedisiplinan
           (65%)    │                 │    (75%)
                    │      ●          │
                    │   (Center)      │
                    │                 │
           Sosial ●─┼─────────────────┼─● Ibadah
           (85%)    │                 │    (90%)
                    │                 │
                    └────────●────────┘
                          Akademik
                           (70%)
```

#### 1.3.6 Domain Score Chips

Di bawah radar chart, ditampilkan chip untuk setiap domain:

```html
<div class="blp-domain-summary">
    <div class="domain-chip" data-domain="akhlak">
        <span class="dc-icon">🤲</span>
        <span class="dc-label">Akhlak</span>
        <span class="dc-score">20/25</span>
    </div>
    <div class="domain-chip" data-domain="kedisiplinan">
        <span class="dc-icon">⏰</span>
        <span class="dc-label">Disiplin</span>
        <span class="dc-score">15/20</span>
    </div>
    <!-- ... dst untuk 6 domain -->
</div>
```

#### 1.3.7 API Endpoints

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/api/kesantrian/blp/student/{nisn}/` | GET | Get BLP entries for student |
| `/api/kesantrian/blp/` | POST | Create BLP entry |
| `/api/kesantrian/blp/{id}/` | PUT | Update BLP entry |
| `/api/kesantrian/blp/{id}/lock/` | POST | Lock entry (prevent edits) |
| `/api/kesantrian/blp/class/{kelas}/` | GET | Get BLP for entire class |

---

## 2. Matriks Role-Based Access Control (RBAC)

### 2.1 Definisi Role

| Role | Kode | Deskripsi |
|------|------|-----------|
| **Superadmin** | `superadmin` | Administrator sistem dengan akses penuh |
| **Pimpinan** | `pimpinan` | Kepala Sekolah / Mudir Pesantren |
| **Guru** | `guru` | Pengajar mata pelajaran |
| **Musyrif** | `musyrif` | Pengawas asrama / Pembimbing halaqoh |
| **Admin Kelas** | `admin_kelas` | Wali kelas untuk operasi bulk |
| **BK** | `bk` | Bimbingan Konseling |
| **Bendahara** | `bendahara` | Pengelola keuangan |
| **Walisantri** | `walisantri` | Orang tua / Wali santri |
| **Adituren** | `adituren` | Alumni dengan akses terbatas |
| **Pendaftar** | `pendaftar` | Calon santri baru |

### 2.2 Matriks CRUD per Modul

#### 2.2.1 Modul Manajemen Santri

| Role | Create | Read | Update | Delete | Keterangan |
|------|:------:|:----:|:------:|:------:|------------|
| Superadmin | ✅ | ✅ | ✅ | ✅ | Full access |
| Pimpinan | ✅ | ✅ | ✅ | ✅ | Full access |
| Guru | ❌ | ✅* | ✅* | ❌ | *Hanya kelas sendiri |
| Musyrif | ❌ | ✅* | ❌ | ❌ | *Hanya santri bimbingan |
| Admin Kelas | ❌ | ✅* | ✅* | ❌ | *Hanya kelas sendiri |
| Bendahara | ❌ | ✅ | ❌ | ❌ | Read untuk referensi keuangan |
| Walisantri | ❌ | ✅* | ❌ | ❌ | *Hanya anak sendiri |
| Pendaftar | ❌ | ❌ | ❌ | ❌ | Tidak ada akses |

#### 2.2.2 Modul Presensi

| Role | Create | Read | Update | Delete | Keterangan |
|------|:------:|:----:|:------:|:------:|------------|
| Superadmin | ✅ | ✅ | ✅ | ✅ | Full access |
| Pimpinan | ✅ | ✅ | ✅ | ✅ | Full access |
| Guru | ✅* | ✅* | ✅* | ❌ | *Hanya kelas sendiri |
| Musyrif | ✅* | ✅* | ✅* | ❌ | *Hanya santri bimbingan |
| Admin Kelas | ✅* | ✅* | ✅* | ❌ | *Hanya kelas sendiri |
| Walisantri | ❌ | ✅* | ❌ | ❌ | *Hanya anak sendiri |

#### 2.2.3 Modul Nilai Akademik

| Role | Create | Read | Update | Delete | Keterangan |
|------|:------:|:----:|:------:|:------:|------------|
| Superadmin | ✅ | ✅ | ✅ | ✅ | Full access |
| Pimpinan | ✅ | ✅ | ✅ | ✅ | Full access |
| Guru | ✅* | ✅* | ✅* | ❌ | *Hanya mapel & kelas sendiri |
| Admin Kelas | ❌ | ✅* | ❌ | ❌ | *Hanya kelas sendiri |
| Walisantri | ❌ | ✅* | ❌ | ❌ | *Hanya anak sendiri |

#### 2.2.4 Modul Hafalan (Tahfidz)

| Role | Create | Read | Update | Delete | Keterangan |
|------|:------:|:----:|:------:|:------:|------------|
| Superadmin | ✅ | ✅ | ✅ | ✅ | Full access |
| Pimpinan | ✅ | ✅ | ✅ | ✅ | Full access |
| Guru | ✅* | ✅* | ✅* | ❌ | *Hanya santri bimbingan |
| Musyrif | ✅* | ✅* | ✅* | ❌ | *Hanya santri bimbingan |
| Walisantri | ❌ | ✅* | ❌ | ❌ | *Hanya anak sendiri |

#### 2.2.5 Modul BLP (Penilaian Karakter)

| Role | Create | Read | Update | Delete | Keterangan |
|------|:------:|:----:|:------:|:------:|------------|
| Superadmin | ✅ | ✅ | ✅ | ✅ | Full access |
| Pimpinan | ✅ | ✅ | ✅ | ✅ | Full access |
| Guru | ✅* | ✅* | ✅* | ❌ | *Hanya kelas sendiri |
| Musyrif | ✅* | ✅* | ✅* | ❌ | *Hanya santri bimbingan |
| Walisantri | ❌ | ✅* | ❌ | ❌ | *Hanya anak sendiri (radar chart) |

#### 2.2.6 Modul Incident (Catatan & Bimbingan)

| Role | Create Incident | Add Comment | Read | Resolve | Keterangan |
|------|:---------------:|:-----------:|:----:|:-------:|------------|
| Superadmin | ✅ | ✅ | ✅ | ✅ | Full access |
| Pimpinan | ✅ | ✅ | ✅ | ✅ | Dapat resolve dengan keputusan final |
| Guru | ✅ | ✅ | ✅* | ❌ | *Semua incident (untuk koordinasi) |
| Musyrif | ✅ | ✅ | ✅* | ❌ | *Semua incident (untuk koordinasi) |
| BK | ✅ | ✅ | ✅ | ❌ | Akses penuh untuk konseling |
| Walisantri | ❌ | ❌ | ✅* | ❌ | *Hanya anak sendiri, visibility public/final |

#### 2.2.7 Modul Evaluasi Asatidz (HR)

| Role | Create | Read | Update | Delete | Keterangan |
|------|:------:|:----:|:------:|:------:|------------|
| Superadmin | ✅ | ✅ | ✅ | ✅ | Full access |
| Pimpinan | ✅ | ✅ | ✅ | ✅ | Full CRUD untuk HR |
| Guru | ❌ | ✅* | ❌ | ❌ | *Hanya evaluasi diri sendiri |
| Musyrif | ❌ | ✅* | ❌ | ❌ | *Hanya evaluasi diri sendiri |
| Admin Kelas | ❌ | ✅* | ❌ | ❌ | *Hanya evaluasi diri sendiri |
| BK | ❌ | ✅* | ❌ | ❌ | *Hanya evaluasi diri sendiri |
| Walisantri | ❌ | ❌ | ❌ | ❌ | Tidak ada akses |

#### 2.2.8 Modul Keuangan

| Role | Create | Read | Update | Delete | Keterangan |
|------|:------:|:----:|:------:|:------:|------------|
| Superadmin | ✅ | ✅ | ✅ | ✅ | Full access |
| Pimpinan | ❌ | ✅ | ❌ | ❌ | Read-only untuk monitoring |
| Bendahara | ✅ | ✅ | ✅ | ✅ | Full CRUD keuangan |
| Walisantri | ❌ | ✅* | ❌ | ❌ | *Hanya tagihan anak sendiri |

#### 2.2.9 Modul User Management

| Role | Create | Read | Update | Delete | Keterangan |
|------|:------:|:----:|:------:|:------:|------------|
| Superadmin | ✅ | ✅ | ✅ | ✅ | Full access termasuk ubah role |
| Pimpinan | ❌ | ✅ | ❌ | ❌ | Read-only untuk monitoring |
| Lainnya | ❌ | ❌ | ❌ | ❌ | Tidak ada akses |

### 2.3 Permission Classes Django

```python
# apps/accounts/permissions.py

class IsSuperAdmin(BasePermission):
    """Hanya superadmin"""
    ALLOWED_ROLES = ['superadmin']

class IsPimpinan(BasePermission):
    """Superadmin dan Pimpinan"""
    ALLOWED_ROLES = ['superadmin', 'pimpinan']

class IsGuru(BasePermission):
    """Superadmin, Pimpinan, Guru (dengan object-level untuk kelas)"""
    ALLOWED_ROLES = ['superadmin', 'pimpinan', 'guru']

class IsWalisantri(BasePermission):
    """Walisantri dengan object-level untuk anak terhubung"""
    ALLOWED_ROLES = ['superadmin', 'pimpinan', 'walisantri']

class IsAsatidzEvaluationAllowed(BasePermission):
    """
    WRITE: superadmin, pimpinan
    READ: semua staff (dengan object-level untuk ustadz sendiri)
    """
    WRITE_ROLES = ['superadmin', 'pimpinan']
    READ_ROLES = ['superadmin', 'pimpinan', 'guru', 'musyrif', 'admin_kelas', 'bk']
```

### 2.4 Akses Halaman Frontend

| Halaman | Superadmin | Pimpinan | Guru | Musyrif | Admin Kelas | Bendahara | Walisantri |
|---------|:----------:|:--------:|:----:|:-------:|:-----------:|:---------:|:----------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Students | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Attendance | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Grades | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Hafalan | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Evaluations (BLP) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Ibadah | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Finance | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Evaluasi Asatidz | ✅ | ✅ | ✅* | ✅* | ✅* | ❌ | ❌ |

*\* View only untuk evaluasi diri sendiri*

---

## 3. Implementasi Permission di Frontend

### 3.1 Role-Based Navigation (auth-check.js)

```javascript
const navConfig = {
    'superadmin': {
        main: [
            { href: '/dashboard/', icon: '📊', label: 'Dashboard' },
            { href: '/students', icon: '👥', label: 'Siswa' },
            // ... full menu
        ],
        admin: [
            { href: '/users', icon: '🔐', label: 'Manajemen User' }
        ],
        hr: [
            { href: '/evaluasi-asatidz', icon: '👨‍🏫', label: 'Evaluasi Asatidz' }
        ]
    },
    'walisantri': {
        main: [
            { href: '/dashboard/', icon: '📊', label: 'Dashboard' },
            { href: '/grades', icon: '📝', label: 'Nilai Ananda' },
            { href: '/hafalan', icon: '📖', label: 'Hafalan' },
            { href: '/finance', icon: '💰', label: 'Tagihan' }
        ]
    },
    // ... konfigurasi untuk role lainnya
};
```

### 3.2 Element Visibility Control

```javascript
// Show/hide elements based on role
function showElementByRole(elementId, allowedRoles) {
    const userRole = getUserRole();
    const element = document.getElementById(elementId);
    if (allowedRoles.includes(userRole)) {
        element.style.display = '';
    } else {
        element.style.display = 'none';
    }
}

// Usage in HTML
<button class="pimpinan-only" style="display: none;">
    Tambah Evaluasi
</button>
```

---

*Dokumen ini dibuat sebagai bagian dari dokumentasi teknis Portal Ponpes Baron v2.3.4*
