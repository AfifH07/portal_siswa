## SUPERADMIN

### Auth & Akses
- [ ] Login berhasil dengan kredensial `superadmin` dan diarahkan ke dashboard utama.
- [ ] Sidebar menampilkan seluruh menu admin termasuk Kelola User, Data Siswa, Jurnal Guru, Nilai, Evaluasi, Hafalan, Ibadah, Keuangan, dan Dashboard.
- [ ] Tombol logout menghapus token dan mengarahkan kembali ke halaman login.
- [ ] Halaman role lain tetap bisa diakses sesuai hak superadmin tanpa redirect/403.
- [ ] Halaman tidak menampilkan error JavaScript di Console setelah login.

### Kelola User
- [ ] Tabel user menampilkan username, nama, role, status aktif, dan aksi edit/hapus.
- [ ] Tambah user baru berhasil dengan role yang dipilih.
- [ ] Edit user berhasil mengubah nama, username, role, dan status aktif.
- [ ] Hapus/nonaktifkan user meminta konfirmasi dan user tidak bisa login setelah dinonaktifkan.
- [ ] Set role `walisantri` menampilkan field `linked_student_nisn` dan `linked_student_nisns`.
- [ ] Simpan `linked_student_nisn` untuk satu anak berhasil dan tampil kembali saat user diedit ulang.
- [ ] Simpan `linked_student_nisns` multi-anak berhasil sebagai array NISN dan tidak berubah format.
- [ ] User walisantri multi-anak melihat child selector sesuai NISN yang diset.
- [ ] User non-walisantri tidak menampilkan field linked student yang tidak relevan.

### Data Siswa
- [ ] Tabel siswa menampilkan NISN, NIS, nama, kelas, jenis kelamin, dan catatan.
- [ ] Search siswa berdasarkan nama/NISN mengembalikan hasil yang sesuai.
- [ ] Filter kelas menampilkan hanya siswa pada kelas yang dipilih.
- [ ] Tambah siswa baru berhasil dengan NISN sebagai identifier.
- [ ] Edit data siswa berhasil menyimpan NIS, jenis kelamin, kelas, dan catatan.
- [ ] Import Excel siswa menampilkan preview/hasil sukses dan jumlah data yang diproses.
- [ ] Export data siswa menghasilkan file yang bisa dibuka dan berisi kolom utama siswa.

### Dashboard Admin
- [ ] Kartu statistik utama menampilkan jumlah siswa, guru, kelas, dan data aktif tanpa angka `NaN`.
- [ ] Grafik dashboard tampil dengan data aktual dan tidak memakai demo/random data.
- [ ] Widget aktivitas terbaru menampilkan item dengan tanggal dan deskripsi yang benar.
- [ ] Link akses cepat membuka halaman tujuan sesuai labelnya.

### Jurnal Guru
- [ ] Superadmin dapat melihat riwayat jurnal semua guru.
- [ ] Filter guru, kelas, tanggal, dan sesi mengubah hasil tabel dengan benar.
- [ ] Detail jurnal menampilkan tipe pengajar, kelas, jam, kehadiran siswa, tujuan pembelajaran, ketuntasan materi, dan dokumentasi.
- [ ] Data jurnal yang dibuat guru terlihat di daftar superadmin.

### Nilai
- [ ] Superadmin dapat melihat daftar nilai semua kelas dan semua guru.
- [ ] Filter kelas, mapel, semester, jenis nilai, dan guru bekerja tanpa error.
- [ ] Tabel nilai menampilkan siswa, kelas, mapel, jenis, materi, nilai, guru, dan tanggal input.
- [ ] Statistik nilai menampilkan rata-rata, nilai tertinggi, nilai terendah, jumlah nilai, dan ketuntasan.
- [ ] Chart analytics nilai tampil dan tidak kosong jika data tersedia.
- [ ] Input/edit/hapus nilai memvalidasi nilai 0-100.

### Evaluasi Santri
- [ ] Superadmin melihat semua evaluasi dari semua santri tanpa dibatasi approval.
- [ ] Superadmin dapat approve evaluasi dan status berubah menjadi approved.
- [ ] Superadmin dapat unapprove evaluasi dan status kembali sesuai.
- [ ] Superadmin dapat close case dengan mengisi `keputusan_final`.
- [ ] Detail evaluasi menampilkan foto, kategori, jenis, deskripsi, pembuat, status approval, dan status close.
- [ ] Comment dengan visibility `internal` dan `semua` tampil untuk superadmin.
- [ ] Tambah comment dengan foto berhasil dan foto bisa dibuka.
- [ ] Hapus comment meminta konfirmasi dan comment hilang dari detail.

### Hafalan / Program Al-Quran
- [ ] Superadmin dapat melihat daftar setoran hafalan semua santri.
- [ ] Tambah setoran hafalan menyimpan siswa, tanggal, juz, halaman, catatan, dan status.
- [ ] Edit setoran hafalan mengubah data tanpa membuat duplikat.
- [ ] Hapus setoran hafalan menghapus item dari riwayat.
- [ ] Badge status setoran menampilkan Lancar, Perlu Ulang, atau Belum Selesai dengan warna sesuai.
- [ ] Import Excel hafalan berhasil memproses file valid dan menampilkan jumlah sukses/gagal.
- [ ] Download template Excel hafalan menghasilkan file template.

### Kelompok Hafalan / Kajian
- [ ] Tab Kelompok Kajian Mingguan tampil untuk role yang berhak.
- [ ] Generate otomatis kelompok per kelas membuat kelompok dan anggota sesuai kelas.
- [ ] CRUD kelompok berhasil membuat, mengedit, dan menghapus kelompok.
- [ ] Tambah anggota kelompok berhasil memilih santri berdasarkan NISN.
- [ ] Set ketua kelompok hanya membuat satu ketua aktif per kelompok.
- [ ] Tambah pertemuan tidak membuat data ganda saat tombol diklik cepat.
- [ ] Hapus pertemuan meminta konfirmasi dan item hilang dari list.
- [ ] Input presensi pertemuan menyimpan hadir/tidak hadir untuk anggota.

### Ibadah Santri
- [ ] Superadmin dapat melihat data ibadah semua kelas/santri.
- [ ] Filter tanggal, kelas, dan siswa mengubah data ibadah yang ditampilkan.
- [ ] Rekap ibadah menampilkan persentase atau status tanpa angka `NaN`.
- [ ] Input/edit data ibadah menyimpan jenis ibadah, waktu, dan status.

### Keuangan
- [ ] Superadmin dapat membuka halaman keuangan.
- [ ] Tabel tagihan menampilkan siswa, kelas, jenis tagihan, nominal, status, dan tanggal.
- [ ] Filter status lunas/belum lunas bekerja.
- [ ] Tambah atau edit tagihan menyimpan nominal valid.
- [ ] Pembayaran/tagihan yang berubah status tampil di dashboard walisantri.

## ADMIN

### Auth & Akses
- [ ] Login berhasil dengan kredensial `admin`.
- [ ] Sidebar menampilkan menu admin tanpa menu Kelola User.
- [ ] Akses ke halaman Kelola User ditolak atau diarahkan sesuai aturan.
- [ ] Halaman superadmin-only tidak bisa diakses langsung melalui URL.
- [ ] Tombol logout menghapus session dan token.

### Data Siswa
- [ ] Admin dapat melihat tabel siswa dengan NISN, NIS, nama, kelas, jenis kelamin, dan catatan.
- [x] Admin dapat import Excel siswa dan melihat hasil sukses/gagal.
- [ ] Admin dapat export data siswa ke file.
- [ ] Admin dapat mencari siswa berdasarkan nama dan NISN.
- [ ] Admin dapat memfilter siswa berdasarkan kelas.
- [ ] Admin dapat edit data siswa tanpa mengubah NISN secara tidak sengaja.

### Dashboard Admin
- [ ] Dashboard admin memuat statistik siswa, guru, kelas, dan aktivitas.
- [ ] Semua card statistik menampilkan angka valid.
- [ ] Link akses cepat admin mengarah ke halaman yang sesuai.
- [ ] Tidak ada error 401/403 di Network untuk endpoint dashboard admin.

### Jurnal Guru
- [ ] Admin dapat melihat riwayat jurnal semua guru.
- [ ] Filter kelas/tanggal/guru bekerja dan tidak menghapus data lain.
- [ ] Detail jurnal menampilkan dokumentasi/foto jika tersedia.
- [ ] Jurnal yang belum lengkap terlihat dengan indikator yang jelas.

### Nilai
- [ ] Admin dapat melihat semua nilai.
- [ ] Admin dapat input nilai untuk siswa dengan 8 jenis penilaian.
- [ ] Jenis nilai yang tersedia: penugasan, tes tulis, tes lisan, portofolio, praktek, proyek, UTS, UAS.
- [ ] Field materi tersimpan dan tampil di tabel/detail.
- [ ] Chart analytics nilai admin tampil sesuai filter.
- [ ] Export/import nilai jika tersedia berjalan tanpa error.

### Evaluasi Santri
- [ ] Admin dapat melihat daftar evaluasi sesuai hak akses.
- [x] Admin dapat membuat evaluasi baru untuk santri.
- [ ] Admin dapat menambah comment dengan visibility `internal` atau `semua`.
- [x] Comment visibility `semua` terlihat oleh walisantri, sedangkan `internal` tidak.
- [x] Upload foto evaluasi/comment berhasil dan URL foto dapat dibuka.

### Hafalan / Program Al-Quran
- [ ] Admin dapat melihat riwayat hafalan per santri.
- [ ] Admin dapat tambah/edit/hapus setoran hafalan.
- [ ] Field status setoran tersimpan dan badge status tampil benar.
- [ ] Import Excel hafalan memvalidasi file dan menampilkan error baris jika ada.
- [ ] Tab kelompok hafalan/kajian dapat dikelola sesuai akses admin.

### Ibadah Santri
- [ ] Admin dapat melihat rekap ibadah per kelas/santri.
- [x] Admin dapat menambah rekap ibadah per kelas/santri.
- [ ] Filter tanggal dan kelas mengubah data dengan benar.
- [ ] Data ibadah yang kosong menampilkan empty state, bukan error JavaScript.

### Keuangan
- [ ] Admin dapat membuka halaman keuangan jika diberi akses.
- [ ] Data tagihan tampil tanpa error permission.
- [ ] Status pembayaran berubah sesuai aksi yang dilakukan.

## PIMPINAN

### Auth & Akses
- [ ] Login berhasil dengan kredensial `pimpinan`.
- [ ] Sidebar menampilkan menu pimpinan yang relevan seperti Dashboard, Evaluasi, Statistik, dan laporan.
- [ ] Halaman input operasional guru/admin yang tidak berhak tidak bisa diakses.
- [ ] Halaman Kelola User tidak tampil di sidebar.
- [ ] Akses langsung ke URL admin-only menghasilkan redirect/403.

### Dashboard Pimpinan
- [ ] Dashboard pimpinan tampil jika tersedia.
- [ ] Statistik ringkas menampilkan data evaluasi, kehadiran, dan akademik sesuai desain yang tersedia.
- [ ] Card statistik tidak menampilkan `0` jika data sebenarnya ada.
- [ ] Link dari dashboard ke detail evaluasi/laporan membuka halaman yang tepat.

### Evaluasi Santri
- [ ] Pimpinan melihat semua evaluasi yang sudah approved. (fitur ini dihapus)
- [ ] Pimpinan dapat approve evaluasi baru jika item belum approved.(fitur ini dihapus)
- [ ] Pimpinan dapat unapprove evaluasi dan status berubah.(fitur ini dihapus)
- [ ] Tombol close case tampil pada evaluasi yang belum ditutup.
- [ ] Close case wajib mengisi `keputusan_final`.
- [ ] Setelah close, detail menampilkan keputusan final, nama penutup, dan waktu close.
- [ ] Pimpinan dapat melihat comment visibility `internal` dan `semua`.
- [ ] Pimpinan dapat menambah comment dengan visibility `internal`.
- [ ] Pimpinan dapat menambah comment dengan visibility `semua` dan comment tersebut terlihat oleh walisantri.
- [ ] Upload foto comment pembinaan berhasil.

### Stats Evaluasi
- [ ] Statistik evaluasi menampilkan total kasus, approved, closed, dan kategori.
- [ ] Filter tanggal/kategori/kelas jika tersedia mengubah statistik.
- [ ] Statistik menggunakan data yang sama dengan list evaluasi.
- [ ] Tidak ada mismatch antara jumlah card statistik dan jumlah list setelah filter.

### Laporan Akademik
- [ ] Pimpinan dapat melihat ringkasan nilai jika menu tersedia.
- [ ] Filter kelas dan semester bekerja.
- [ ] Data chart akademik tidak memakai demo/random data.
- [ ] Empty state tampil jika belum ada data.

## GURU

### Auth & Akses
- [ ] Login berhasil dengan kredensial `guru`.
- [ ] Sidebar menampilkan Dashboard Guru, Jurnal Guru, Nilai, Evaluasi, dan menu lain sesuai assignment.
- [ ] Guru tidak bisa membuka Kelola User.
- [ ] Guru tidak bisa melihat data guru lain jika endpoint dibatasi.
- [ ] Token expired mengarahkan ke login dan tidak menampilkan halaman kosong.

### Dashboard Guru
- [x] Todo list menampilkan presensi/jurnal yang belum diisi.
- [x] Todo list menampilkan nilai yang belum diinput sesuai assignment guru.
- [x] Todo list menampilkan izin tanpa titipan tugas jika ada.
- [ ] Klik item todo membuka halaman input yang sesuai.
- [ ] Setelah jurnal/nilai diisi, item todo berkurang atau berubah status.
- [ ] Dashboard tidak menampilkan data assignment guru lain.

### Jurnal Guru — Wizard Step 1 Tipe Pengajar
- [ ] Guru dapat memilih tipe pengajar Guru Pengampu.
- [ ] Guru dapat memilih tipe pengajar Guru Piket jika memiliki akses.
- [ ] Pilihan tipe pengajar mempengaruhi pilihan kelas/jadwal di step berikutnya.
- [ ] Tombol lanjut disabled jika tipe pengajar belum dipilih.

### Jurnal Guru — Wizard Step 2 Info Kelas
- [ ] Dropdown kelas menampilkan kelas sesuai assignment guru.
- [ ] Dropdown mapel menampilkan mapel sesuai assignment guru.
- [ ] Tanggal default hari ini dan bisa diubah.
- [ ] Jam/sesi menampilkan data jadwal yang relevan.
- [ ] Tujuan pembelajaran wajib diisi jika aturan form mensyaratkan.

### Jurnal Guru — Wizard Step 3 Kehadiran
- [ ] Daftar santri kelas tampil dengan NISN, nama, dan status hadir.
- [ ] Status hadir/izin/sakit/alfa bisa dipilih per santri.
- [ ] Ketuntasan materi menerima nilai 0-100.
- [ ] Validasi mencegah submit jika data kehadiran wajib belum lengkap.
- [ ] Jumlah siswa hadir/tidak hadir sesuai pilihan.


### Halaman Nilai
- [ ] Guru hanya melihat mapel/kelas yang menjadi assignment-nya.
- [ ] Input nilai menampilkan 8 jenis penilaian.
- [ ] Input nilai menyimpan siswa, mapel, jenis, materi, semester, tahun ajaran, dan nilai.
- [ ] Nilai di bawah 0 atau di atas 100 ditolak.
- [ ] Daftar nilai menampilkan nilai yang baru diinput.
- [ ] Edit nilai mengubah data tanpa membuat record baru.
- [ ] Hapus nilai meminta konfirmasi dan menghapus record.
- [ ] Chart analytics guru mengikuti filter mapel/kelas.
- [ ] Donut chart ketuntasan tidak mencampur data guru lain jika filter guru diterapkan.

### Evaluasi Santri
- [ ] Guru dapat membuat evaluasi baru untuk santri.
- [ ] Form evaluasi menyimpan jenis, kategori, deskripsi, santri, dan foto jika ada.
- [ ] Evaluasi baru milik guru tampil di daftar kasus sendiri.
- [x] Guru non-wali tidak melihat semua kasus guru lain.
- [ ] Guru dapat menambah comment pada kasus yang bisa diakses.
- [ ] Guru dapat memilih visibility comment `internal` atau `semua`.
- [ ] Comment dengan foto berhasil tersimpan dan tampil di detail.
- [ ] Guru wali kelas dapat melihat evaluasi approved untuk kelas yang diwali.
- [x] Guru wali kelas tidak dapat melihat kasus internal kelas lain yang belum approved. (sistem ini dihapus)

### Izin Guru / Titipan Tugas
- [ ] Guru dapat mengajukan izin jika fitur tersedia.
- [ ] Form izin menyimpan jenis izin, tanggal, alasan, dan foto surat.
- [ ] Titipan tugas dapat ditambahkan untuk kelas/jadwal yang ditinggalkan.
- [ ] Dashboard guru menandai izin tanpa titipan tugas.

## MUSYRIF

### Auth & Akses
- [ ] Login berhasil dengan kredensial `musyrif`.
- [ ] Sidebar menampilkan Hafalan, Ibadah, Evaluasi approved, dan menu kesantrian yang relevan.
- [ ] Musyrif tidak bisa membuka Kelola User.
- [ ] Musyrif tidak bisa membuka halaman keuangan jika tidak diberi akses.
- [ ] Akses langsung ke halaman admin-only menghasilkan redirect/403.

### Hafalan / Program Al-Quran
- [ ] Musyrif dapat memilih santri dan melihat profil hafalan santri.
- [ ] Riwayat setoran menampilkan tanggal, juz, halaman, catatan, penginput, dan status.
- [ ] Tambah setoran menyimpan juz, halaman dari, halaman sampai, jumlah halaman, catatan, dan status.
- [ ] Edit setoran mengisi ulang form dengan data lama termasuk status.
- [ ] Hapus setoran meminta konfirmasi dan item hilang dari tabel.
- [ ] Status setoran tampil sebagai badge Lancar, Perlu Ulang, atau Belum Selesai.
- [ ] Sorting riwayat setoran menampilkan data terbaru di atas jika desain mengharuskan.
- [ ] Empty state tampil jika santri belum punya setoran.

### Import Excel Hafalan
- [ ] Menu import Excel hafalan tampil jika musyrif punya akses.
- [ ] Download template hafalan menghasilkan file yang valid.
- [ ] Upload file valid memproses data dan menampilkan jumlah sukses.
- [ ] Upload file invalid menampilkan pesan error yang menjelaskan kolom/baris bermasalah.
- [ ] Data hasil import tampil di riwayat santri terkait.

### Kelompok Hafalan / Kajian
- [ ] Musyrif dapat melihat kelompok yang menjadi tanggung jawabnya jika dibatasi.
- [ ] Daftar anggota kelompok menampilkan nama, NISN, kelas, dan ketua.
- [ ] Pertemuan kelompok menampilkan tanggal, judul, lokasi, dan jumlah hadir.
- [ ] Input presensi pertemuan menyimpan status hadir anggota.
- [ ] Tombol tambah pertemuan tidak membuat double submit saat diklik cepat.
- [ ] Tombol hapus pertemuan menghapus data setelah konfirmasi.

### Ibadah Santri
- [ ] Musyrif dapat melihat daftar ibadah santri.
- [ ] Input ibadah menyimpan santri, tanggal, jenis ibadah, waktu, dan status.
- [ ] Filter kelas dan tanggal bekerja.
- [ ] Rekap ibadah per santri tampil tanpa error.
- [ ] Data ibadah yang sudah disimpan muncul di halaman walisantri jika memang termasuk data publik.

### Evaluasi Santri
- [ ] Musyrif dapat melihat evaluasi yang sudah approved.
- [ ] Musyrif tidak melihat evaluasi yang belum approved jika bukan pembuat/role berwenang.
- [ ] Detail evaluasi menampilkan comment sesuai akses musyrif.
- [ ] Musyrif dapat menambah comment jika role diberi akses comment.

## BK

### Auth & Akses
- [ ] Login berhasil dengan kredensial `bk`.
- [ ] Sidebar menampilkan menu Evaluasi Santri dan menu BK yang relevan.
- [ ] BK tidak dapat membuka Kelola User.
- [ ] BK tidak dapat membuka halaman input nilai atau keuangan jika tidak berhak.
- [ ] Akses langsung ke halaman role lain menghasilkan redirect/403.

### Evaluasi Santri
- [ ] BK dapat melihat semua evaluasi approved semua santri.
- [ ] BK tidak melihat evaluasi belum approved jika aturan akses membatasi.
- [ ] Filter santri, kelas, kategori, dan status bekerja jika tersedia.
- [ ] Detail evaluasi menampilkan data santri, kategori, deskripsi, foto, status approval, dan timeline comment.
- [ ] BK dapat menambah comment pembinaan.
- [ ] BK dapat memilih visibility comment `internal` atau `semua`.
- [ ] Upload foto comment berhasil dan foto tampil di detail.
- [ ] Comment BK dengan visibility `semua` terlihat oleh walisantri.
- [ ] Comment BK dengan visibility `internal` tidak terlihat oleh walisantri.
- [ ] BK tidak dapat approve/unapprove jika tombol tersebut khusus pimpinan/superadmin.

### Statistik Evaluasi
- [ ] Statistik kasus approved tampil untuk seluruh santri.
- [ ] Filter kategori mengubah angka statistik dan list.
- [ ] Statistik tidak menampilkan angka `NaN` atau mismatch dengan tabel.
- [ ] Kasus closed dan open dibedakan dengan indikator yang jelas.

## BENDAHARA

### Auth & Akses
- [ ] Login berhasil dengan kredensial `bendahara`.
- [ ] Sidebar menampilkan menu Keuangan dan dashboard yang relevan.
- [ ] Bendahara tidak dapat membuka Kelola User.
- [ ] Bendahara tidak dapat membuka input nilai/jurnal jika tidak berhak.
- [ ] Akses langsung ke halaman admin-only menghasilkan redirect/403.

### Keuangan
- [ ] Halaman keuangan memuat daftar tagihan tanpa error 401/403.
- [ ] Tabel tagihan menampilkan siswa, kelas, jenis tagihan, nominal, jatuh tempo, status, dan aksi.
- [ ] Search siswa berdasarkan nama/NISN bekerja.
- [ ] Filter status lunas/belum lunas bekerja.
- [ ] Tambah tagihan menyimpan jenis tagihan, nominal, siswa/kelas, dan jatuh tempo.
- [ ] Edit tagihan mengubah nominal/status tanpa membuat duplikat.
- [ ] Tandai lunas mengubah status dan tanggal pembayaran.
- [ ] Batalkan pembayaran mengembalikan status sesuai aturan.
- [ ] Nominal dengan format tidak valid ditolak.
- [ ] Data tagihan muncul di dashboard walisantri anak terkait.
- [ ] Export laporan keuangan jika tersedia menghasilkan file valid.

### Dashboard Keuangan
- [ ] Card total tagihan menampilkan angka valid.
- [ ] Card tagihan lunas dan belum lunas sesuai data tabel.
- [ ] Grafik/rekap pembayaran tampil jika data tersedia.
- [ ] Empty state tampil jika belum ada data tagihan.

## WALISANTRI

### Auth & Akses
- [ ] Login berhasil dengan kredensial `walisantri`.
- [ ] Sidebar hanya menampilkan menu yang relevan untuk walisantri.
- [ ] Walisantri tidak dapat membuka halaman admin/guru/musyrif melalui URL langsung.
- [ ] Data yang tampil hanya data anak yang terhubung ke akun.
- [ ] Logout menghapus token dan localStorage terkait session.

### Dashboard Walisantri
- [ ] Dashboard menampilkan nama walisantri dan ringkasan anak aktif.
- [ ] Child selector tampil jika akun memiliki lebih dari satu anak.
- [ ] Saat anak pertama dipilih, card dashboard menampilkan data anak pertama.
- [ ] Saat anak kedua dipilih, card dashboard menampilkan data anak kedua.
- [ ] Pilihan anak tersimpan ke `selected_child_nisn` dan `selected_child_data`.
- [ ] Akses cepat menuju Nilai, Hafalan, Evaluasi, Ibadah, dan Keuangan membuka halaman sesuai anak aktif.
- [ ] Stat card Kajian Mingguan mengambil data dari endpoint kehadiran kajian yang benar.

### Child Selector Multi-Anak
- [ ] Tab anak menampilkan nama, kelas, dan/atau NISN.
- [ ] Klik tab anak mengubah active state secara visual.
- [ ] Klik tab anak mengupdate localStorage `selected_child_nisn`.
- [ ] Klik tab anak mengupdate localStorage `selected_child_data`.
- [ ] Event `childSwitched` memicu reload data pada halaman yang sedang aktif.
- [ ] 🔧 recently fixed Anak kedua dapat dipilih tanpa data halaman tetap nyangkut dari anak pertama.
- [ ] 🔧 recently fixed Listener `childSwitched` tidak terpanggil ganda saat halaman di-init ulang.

### Halaman Nilai — Hero Card
- [ ] Hero card menampilkan nama anak aktif, kelas, rata-rata nilai, nilai tertinggi, dan ringkasan performa.
- [ ] Jika anak punya data nilai, hero card tidak menampilkan `Data tidak tersedia`.
- [ ] Jika anak tidak punya data nilai, empty state tampil dengan pesan yang jelas.
- [ ] 🔧 recently fixed Saat ganti dari anak pertama ke anak kedua, hero card reset ke `Memuat data...` sebelum data baru tampil.
- [ ] 🔧 recently fixed Data hero card anak kedua tampil sesuai NISN anak kedua, bukan sisa anak pertama.

### Halaman Nilai — Ringkasan Performa
- [ ] Card Terbaik menampilkan mapel dengan rata-rata tertinggi.
- [ ] Card Perlu Perhatian tidak sama dengan Terbaik jika data mapel lebih dari satu.
- [ ] Jika hanya ada satu mapel, card Perlu Perhatian disembunyikan atau menampilkan pesan belum cukup data.
- [ ] Rata-rata performa menampilkan angka valid dan bukan `NaN`.

### Halaman Nilai — Radar/Peta Kekuatan Mapel
- [ ] Radar chart tampil untuk tiga mapel atau lebih.
- [ ] Bar chart tampil jika mapel kurang dari tiga.
- [ ] Empty state tampil jika tidak ada data mapel.
- [ ] 🔧 recently fixed Empty state radar tidak menghapus canvas dari DOM.
- [ ] 🔧 recently fixed Saat ganti anak, radar chart destroy dan render ulang sesuai data anak aktif.
- [ ] 🔧 recently fixed Anak kedua yang punya nilai menampilkan chart, bukan pesan kosong dari anak sebelumnya.

### Halaman Nilai — Detail Nilai Per Mapel
- [ ] List mapel menampilkan nama mapel, rata-rata, UH, UTS, dan UAS jika data tersedia.
- [ ] Field UH/UTS/UAS terisi dari response backend jika nilai jenis tersebut ada.
- [ ] Tombol panah/detail membuka panel inline.
- [ ] Panel detail menampilkan tabel jenis, materi, tanggal, dan nilai.
- [ ] Klik tombol detail lagi menutup panel.
- [ ] Filter semester mengubah list detail nilai.
- [ ] 🔧 recently fixed Saat ganti anak, detail nilai reload dan tidak menampilkan data anak sebelumnya.
- [ ] Jika endpoint detail gagal, pesan error tampil di area detail, bukan crash halaman.

### Halaman Nilai — Chart Tren Nilai
- [ ] Chart tren memanggil `/api/grades/trend/<nisn>/?months=<period>`.
- [ ] Chart tren menampilkan multi-line per mapel.
- [ ] 🔧 recently fixed Chart tren tidak lagi hanya menampilkan satu mapel seperti `matematika` lowercase.
- [ ] Tiga mapel highlight otomatis mencakup performa terbaik, performa terendah, dan paling fluktuatif.
- [ ] Mapel non-highlight tampil abu-abu tipis.
- [ ] Klik legend mapel non-highlight membuatnya menjadi highlight.
- [ ] Klik legend mapel highlight mengembalikannya ke abu-abu.
- [ ] Tooltip menampilkan nama mapel dan nilai pada bulan yang dipilih.
- [ ] Data bulan kosong tampil sebagai gap dan tidak membuat garis salah.
- [ ] Jika data tren kosong, tampil pesan `Data tren belum tersedia`.
- [ ] 🔧 recently fixed Saat ganti anak, chart tren destroy dan render ulang dengan data NISN anak aktif.

### Halaman Nilai — Ganti Anak End-to-End
- [ ] 🔧 recently fixed Ganti ke anak kedua membuat hero card, radar, detail nilai, dan chart tren semuanya reload.
- [ ] 🔧 recently fixed Ganti kembali ke anak pertama membuat semua komponen kembali sesuai anak pertama.
- [ ] Tidak ada request ganda berlebihan ke endpoint analytics saat klik tab anak sekali.
- [ ] Tidak ada error JavaScript di Console saat ganti anak cepat beberapa kali.
- [ ] Network menunjukkan endpoint average/detail/trend memakai NISN anak yang sedang aktif.
- [ ] Jika anak kedua tidak linked di backend, halaman menampilkan pesan akses/data kosong yang jelas.

### Evaluasi Santri
- [ ] Walisantri hanya melihat evaluasi yang sudah approved.
- [ ] Evaluasi belum approved tidak tampil.
- [ ] Detail evaluasi menampilkan jenis, kategori, deskripsi, foto, dan status.
- [ ] Walisantri hanya melihat comment dengan visibility `semua`.
- [ ] Comment visibility `internal` tidak tampil di akun walisantri.
- [ ] Evaluasi closed menampilkan keputusan final jika visibility memperbolehkan.
- [ ] Ganti anak memuat evaluasi anak yang dipilih.

### Hafalan Anak
- [ ] Halaman hafalan menampilkan judul Hafalan Ananda.
- [ ] Child selector hafalan tampil untuk akun multi-anak.
- [ ] Pilihan anak dari dashboard terbawa ke halaman hafalan.
- [ ] Riwayat setoran menampilkan tanggal, juz, halaman, catatan, dan status.
- [ ] Target Tartil tampil read-only.
- [ ] Target Tahfidz tampil read-only.
- [ ] Kompetensi & Pengajar tampil read-only.
- [ ] Tidak ada tombol Simpan, Edit, Hapus, atau input admin yang tampil untuk walisantri.
- [ ] Ganti tab anak memuat ulang data hafalan anak yang dipilih.
- [ ] Empty state tampil jika anak belum punya setoran.

### Ibadah Anak
- [ ] Halaman ibadah menampilkan child selector untuk multi-anak.
- [ ] Data ibadah anak aktif tampil sesuai localStorage.
- [ ] Ganti anak memuat ulang ibadah anak yang dipilih.
- [ ] Rekap ibadah harian/mingguan tampil tanpa angka `NaN`.
- [ ] Empty state tampil jika belum ada data ibadah.

### Keuangan Anak
- [ ] Tagihan anak aktif tampil dengan jenis tagihan, nominal, status, dan jatuh tempo.
- [ ] Status lunas/belum lunas sesuai data bendahara.
- [ ] Ganti anak memuat tagihan anak yang dipilih.
- [ ] Walisantri tidak melihat tagihan anak yang tidak linked ke akunnya.

## REGRESSION CHECK

- [ ] Login semua role berhasil dan sidebar sesuai role setelah perubahan `auth-check.js`.
- [ ] Back-chip menampilkan `Kembali ke Dashboard` di halaman selain dashboard dan hilang di dashboard.
- [ ] Endpoint dengan FK Student selalu memakai `nisn__nisn` untuk string NISN.
- [ ] `User.name` dipakai untuk nama lengkap, bukan `get_full_name()`.
- [ ] `apiFetch()` tetap dipakai tanpa prefix `/api/` pada file yang memakai apiFetch.
- [ ] `grades.js` tetap memakai raw `fetch()` dan tidak dimigrasikan diam-diam ke `apiFetch()`.
- [ ] `evaluasi-asatidz.js` tidak berubah.
- [ ] Semua file JS/CSS yang diubah memiliki bump `?v=` pada HTML pemuatnya.
- [ ] Halaman Nilai walisantri multi-anak reload semua komponen saat child selector berubah.
- [ ] 🔧 recently fixed Hero card nilai tidak menampilkan data anak sebelumnya setelah ganti anak.
- [ ] 🔧 recently fixed Radar chart tidak kehilangan canvas setelah empty state.
- [ ] 🔧 recently fixed Chart tren menampilkan multi-line per mapel dan bukan demo/random data.
- [ ] 🔧 recently fixed Listener `childSwitched` tidak terdaftar lebih dari sekali.
- [ ] Endpoint `/api/grades/trend/<nisn>/?months=6` mengembalikan `{ labels, mapel }` dengan `mata_pelajaran` string.
- [ ] Halaman Nilai tidak memanggil `loadWalisantriView()` legacy.
- [ ] Walisantri hanya melihat evaluasi approved dan comment visibility `semua`.
- [ ] Guru non-wali tidak melihat kasus evaluasi guru lain.
- [ ] Pimpinan dapat approve/unapprove dan close case evaluasi.
- [ ] Upload foto evaluasi/comment tetap berhasil setelah perubahan auth/api.
- [ ] Jurnal Guru wizard 4 step tetap menyimpan attendance dan dokumentasi.
- [ ] Dashboard Guru todo list berubah setelah jurnal/nilai diinput.
- [ ] Hafalan walisantri tetap read-only tanpa tombol Simpan/Edit.
- [ ] Setoran hafalan status tersimpan dan badge tampil benar.
- [ ] Tambah pertemuan kelompok/kajian tidak double submit.
- [ ] Hapus pertemuan kelompok/kajian memanggil DELETE dan list reload.
- [ ] Child selector dashboard menyimpan `selected_child_nisn` dan `selected_child_data`.
- [ ] Child selector hafalan dan ibadah membaca key localStorage yang sama.
- [ ] Data staging PythonAnywhere cocok dengan linked NISN user walisantri yang diuji.
- [ ] Setelah deploy, jalankan `migrate`, `collectstatic`, reload WSGI, dan cek log error PythonAnywhere.
