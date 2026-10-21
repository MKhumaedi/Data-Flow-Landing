import { BlogPostItem } from '../blog.types';

export const BUSINESS_ADMIN_SEEDS: BlogPostItem[] = [
  {
    id: 'post-biz-document-archiving',
    slug: 'sistem-pengarsipan-dokumen-kantor-rapi-dan-terstruktur',
    title: 'Sistem Pengarsipan Dokumen Kantor yang Rapi dan Mudah Ditemukan Kembali',
    excerpt: 'Panduan membuat struktur penamaan folder, kode klasifikasi berkas fisik maupun digital, serta jadwal retensi arsip untuk efisiensi operasional kantor.',
    category: 'Produktivitas Bisnis & Administrasi',
    tags: ['Pengarsipan', 'Administrasi Kantor', 'Manajemen Dokumen', 'SOP Kantor', 'Produktivitas'],
    authorName: 'Tim Editorial MayStudio',
    coverImageUrl: null,
    status: 'PUBLISHED',
    publishedAt: '2026-06-14T10:30:00.000Z',
    metaTitle: 'Sistem Pengarsipan Dokumen Kantor Rapi | MayStudio',
    metaDescription: 'Cara menata sistem pengarsipan dokumen kantor digital dan fisik. Standarisasi nama file, folder berjenjang, dan tata kelola arsip perusahaan yang tertib.',
    viewCount: 690,
    createdAt: '2026-06-14T10:30:00.000Z',
    updatedAt: '2026-06-14T10:30:00.000Z',
    deletedAt: null,
    contentMarkdown: `Salah satu pemborosan waktu kerja paling besar di lingkungan kantor adalah mencari berkas dokumen yang terselip atau file spreadsheet yang disimpan dengan nama sembarangan seperti \`rekap_final_v2_beneran_FIX.xlsx\`.

Sistem pengarsipan yang tertib bukan hanya mempermudah pekerjaan sehari-hari, tetapi juga krusial untuk kesiapan audit internal, kepatuhan hukum (*legal compliance*), dan kesinambungan kerja saat ada pergantian staf (*handover*).

Berikut adalah panduan membangun tata kelola pengarsipan dokumen kantor yang rapi dan konsisten.

---

### 1. Standarisasi Konvensi Penamaan File (File Naming Convention)

Buat aturan baku penamaan berkas digital yang wajib dipatuhi oleh seluruh anggota divisi. Pola terbaik menggunakan format:

\`\`\`text
[YYYY-MM-DD]_[Kategori/Divisi]_[NamaDokumen]_[Entitas/Klien]_[Versi]
\`\`\`

**Contoh Penerapan:**
- \`2026-06-14_FIN_Invoice_PT-Sinar-Jaya_v1.0.pdf\`
- \`2026-06-30_HRD_Rekap-Absensi-Karyawan_Cabang-Jakarta_FINAL.xlsx\`

**Keuntungan Format Ini:**
- Format tanggal \`YYYY-MM-DD\` (ISO 8601) membuat komputer mengurutkan file secara kronologis otomatis saat disortir berdasarkan nama (*sort by name*).
- Menghindari spasi liar dengan menggunakan tanda hubung (\`-\`) atau garis bawah (\`_\`).

---

### 2. Struktur Hierarki Folder Maksimal 3 Tingkat (3-Tier Rule)

Hindari membuat subfolder yang terlalu dalam hingga 7-8 lapisan karena akan membingungkan staf lain. Batasi hierarki folder maksimal 3 level:

- **Level 1 (Divisi / Domain Utama)**: \`01_Keuangan_dan_Akuntansi\`
- **Level 2 (Tahun / Periode)**: \`2026\`
- **Level 3 (Kategori Transaksi)**: \`01_Faktur_Penjualan\`, \`02_Bukti_Pengeluaran_Kas\`, \`03_Pajak\`

Gunakan angka dua digit di depan nama folder (\`01_\`, \`02_\`, \`03_\`) agar urutan folder tidak berantakan saat ada nama baru.

---

### 3. Pengelolaan Dokumen Fisik (Map Binder & Labeling)

Untuk arsip fisik yang memerlukan tanda tangan basah atau meterai:
- Kelompokkan berkas menggunakan map ordner berlabel jelas pada punggung binder.
- Gunakan kode warna (*color coding*) untuk membedakan divisi: misal merah untuk Berkas Legal, biru untuk Pajak & Finansial, dan hijau untuk Kontrak Vendor.
- Simpan lembar daftar isi (*index sheet*) di halaman paling depan setiap binder.

---

### 4. Menetapkan Jadwal Retensi dan Pemusnahan Dokumen

Tidak semua dokumen perlu disimpan selamanya. Tetapkan jadwal retensi arsip berdasarkan regulasi:
- Dokumen transaksi keuangan dan bukti setor pajak umumnya wajib disimpan selama minimal 5 hingga 10 tahun.
- Dokumen operasional harian non-kritis dapat diarsipkan setelah 1 tahun dan dimusnahkan secara berkala setelah mendapat persetujuan pimpinan.

Dukung kerapian administrasi kantor Anda dengan memanfaatkan template operasional di katalog [Formulir Bisnis MayStudio](/formulir).`,
  },
  {
    id: 'post-biz-petty-cash-management',
    slug: 'panduan-manajemen-kas-kecil-petty-cash-dan-laporan-biaya',
    title: 'Panduan Manajemen Kas Kecil (Petty Cash) dan Laporan Pertanggungjawaban Biaya',
    excerpt: 'Prosedur standar pengelolaan kas kecil dengan metode Imprest Fund, pencatatan voucher pengeluaran, batasan plafon, dan rekonsiliasi akhir bulan.',
    category: 'Produktivitas Bisnis & Administrasi',
    tags: ['Petty Cash', 'Kas Kecil', 'Keuangan Kantor', 'Laporan Biaya', 'Administrasi'],
    authorName: 'Tim Editorial MayStudio',
    coverImageUrl: null,
    status: 'PUBLISHED',
    publishedAt: '2026-06-29T13:15:00.000Z',
    metaTitle: 'Panduan Manajemen Petty Cash Kantor | MayStudio',
    metaDescription: 'Panduan lengkap mengelola kas kecil (petty cash) kantor. Pelajari metode dana tetap (imprest), pembuatan voucher kas, dan bukti transaksi akurat.',
    viewCount: 890,
    createdAt: '2026-06-29T13:15:00.000Z',
    updatedAt: '2026-06-29T13:15:00.000Z',
    deletedAt: null,
    contentMarkdown: `Kas kecil (*petty cash*) adalah sejumlah uang tunai yang disediakan perusahaan untuk membiayai pengeluaran operasional harian yang bersifat rutin dan bernominal relatif kecil, seperti pembelian air mineral galon, perlengkapan ATK darurat, biaya kurir instan, atau konsumsi rapat tamu.

Meskipun nominal tiap transaksi kecil, jika tidak dikelola dengan sistem kontrol yang ketat, kas kecil dapat menjadi sumber kebocoran anggaran dan perselisihan pembukuan.

---

### 1. Metode Pengelolaan: Imprest Fund System (Sistem Dana Tetap)

Metode yang paling direkomendasikan untuk administrasi kantor adalah **Sistem Dana Tetap (*Imprest System*)**:

- **Plafon Tetap**: Manajemen menetapkan batas saldo kas kecil (misalnya Rp 5.000.000).
- **Pengeluaran Disertai Bukti**: Setiap ada pengeluaran uang tunai, pemegang kas kecil wajib mengumpulkan kuitansi/struk asli dan mencatatnya ke formulir Bukti Pengeluaran Kas Kecil (BPKK).
- **Penggantian Sesuai Nominal yang Terpakai**: Saat saldo kas kecil menipis (misal tersisa Rp 1.200.000), pemegang kas kecil mengajukan klaim penggantian dana ke bagian *Finance* sebesar total kuitansi yang terkumpul (Rp 3.800.000), sehingga saldo fisik kembali utuh ke plafon Rp 5.000.000.

---

### 2. Standar Bukti Transaksi yang Sah

Setiap pengeluaran kas kecil wajib memiliki 3 unsur validasi:
1. **Struk Asli / Nota Pembelian**: Harus mencantumkan nama toko, tanggal transaksi, rincian barang, dan nominal yang jelas.
2. **Voucher Pengeluaran Kas Kecil**: Ditandatangani oleh pemohon (*requester*), staf pemegang kas kecil, dan atasan yang berwenang menyetujui.
3. **Keterangan Keperluan Bisnis**: Catat secara spesifik alasan pengeluaran (misal: *"Pembelian kertas HVS A4 5 rim untuk kebutuhan cetak laporan audit pajak"*).

---

### 3. Batasan dan Larangan Penggunaan Kas Kecil

Untuk menjaga fungsi kas kecil tetap pada koridornya, terapkan aturan tegas:
- **Batas Maksimal per Transaksi**: Misalnya transaksi di atas Rp 1.000.000 wajib melalui mekanisme transfer bank atau *purchase order* resmi.
- **Larangan Kasbon Pribadi (*IOU*)**: Kas kecil tidak boleh dipinjamkan untuk kepentingan pribadi staf dengan jaminan selembar kertas catatan kasbon.
- **Penyimpanan di Brankas / Cash Box Terkunci**: Uang tunai fisik dan buku kas wajib disimpan di tempat aman dengan akses terbatas hanya pada staf yang ditunjuk (*custodian*).

---

### 4. Rekonsiliasi Rutin (Cash Count Fisik)

Lakukan penghitungan fisik uang tunai (*cash count*) setiap hari Jumat sore atau sebelum pengajuan penggantian dana:

\`\`\`text
Total Uang Tunai Fisik di Brankas + Total Kuitansi/Voucher Belum Diklaim = Plafon Dana Tetap
\`\`\`

Jika ada selisih lebih atau kurang, segera telusuri transaksi yang terlewat sebelum minggu kerja berikutnya dimulai.`,
  },
  {
    id: 'post-biz-hr-onboarding-checklist',
    slug: 'checklist-onboarding-karyawan-baru-template-prosedur-hr',
    title: 'Checklist Onboarding Karyawan Baru: Template dan Prosedur Standar HR',
    excerpt: 'Daftar periksa langkah demi langkah menyambut pegawai baru sejak hari pertama, penyiapan fasilitas kerja, kelengkapan berkas legal, hingga evaluasi masa percobaan.',
    category: 'Produktivitas Bisnis & Administrasi',
    tags: ['Onboarding', 'HR Management', 'Karyawan Baru', 'Checklist HR', 'SOP Perusahaan'],
    authorName: 'Tim Editorial MayStudio',
    coverImageUrl: null,
    status: 'PUBLISHED',
    publishedAt: '2026-07-18T09:20:00.000Z',
    metaTitle: 'Checklist Onboarding Karyawan Baru | MayStudio',
    metaDescription: 'Template dan panduan proses onboarding karyawan baru untuk divisi HR. Pastikan transisi pegawai lancar mulai hari pertama hingga 90 hari masa kerja.',
    viewCount: 760,
    createdAt: '2026-07-18T09:20:00.000Z',
    updatedAt: '2026-07-18T09:20:00.000Z',
    deletedAt: null,
    contentMarkdown: `Kesan pertama seorang karyawan terhadap perusahaan terbentuk pada minggu pertama mereka bergabung. Proses orientasi (*onboarding*) yang tidak terstruktur—seperti laptop yang belum siap, akun email yang belum dibuat, atau atasan yang tidak menyambut—dapat menurunkan moral karyawan dan meningkatkan risiko *early turnover*.

Program onboarding yang sukses bertujuan mengintegrasikan pegawai baru secara administratif, kultural, dan fungsional agar mereka dapat mandiri dan produktif lebih cepat.

---

### Fase 1: Pre-Onboarding (1 Minggu Sebelum Hari Pertama)

Persiapan matang sebelum karyawan tiba di kantor:
- [ ] Kirim email ucapan selamat datang resmi berisi informasi waktu kedatangan, dress code, dan agenda hari pertama.
- [ ] Siapkan perangkat keras (Laptop, mouse, charger, kartu akses/ID Card).
- [ ] Buat akun email perusahaan (\`nama@perusahaan.com\`), akun Slack/Teams, dan hak akses software relevan.
- [ ] Tunjuk seorang rekan kerja senior sebagai *Onboarding Buddy* untuk mendampingi adaptasi sehari-hari.

---

### Fase 2: Hari Pertama (Day 1 - Sambutan & Administrasi)

Hari pertama harus berfokus pada kenyamanan dan orientasi dasar, bukan beban tugas:
- [ ] Sambutan hangat oleh HR dan perkenalan dengan manajer divisi.
- [ ] Tur keliling kantor (ruang rapat, pantry, toilet, area darurat).
- [ ] Penandatanganan dokumen legal (Perjanjian Kerja, NDA, form pendaftaran BPJS Ketenagakerjaan & Kesehatan, rekening payroll).
- [ ] Pengaturan perangkat kerja dan login ke seluruh sistem internal.
- [ ] Makan siang bersama tim atau buddy.

---

### Fase 3: Minggu Pertama (Day 2 - 7 - Pengenalan Tugas & Budaya)

- [ ] Sesi pengenalan struktur organisasi, visi misi, dan budaya kerja perusahaan.
- [ ] Diskusi dengan atasan langsung mengenai tugas pokok fungsi (tupoksi) dan ekspektasi kinerja.
- [ ] Mempelajari SOP divisi dan membaca dokumentasi kerja yang ada.
- [ ] Menentukan target kerja 30-60-90 hari ke depan secara tertulis.

---

### Fase 4: Evaluasi 30, 60, dan 90 Hari

Onboarding bukan proses satu hari, melainkan proses berkelanjutan selama masa percobaan (*probation*):
- **Hari ke-30**: Sesi check-in informal antara HR dan karyawan untuk memastikan tidak ada kendala adaptasi sosial maupun teknis.
- **Hari ke-60**: Evaluasi progres target tugas bersama manajer divisi.
- **Hari ke-90**: Evaluasi kelulusan masa probation formal dengan formulir penilaian kinerja terstruktur.

Dapatkan template formulir evaluasi karyawan dan formulir HR siap pakai di [Katalog Formulir MayStudio](/formulir).`,
  },
  {
    id: 'post-biz-effective-meeting-management',
    slug: 'cara-menyelenggarakan-rapat-kerja-efektif-terarah',
    title: 'Cara Menyelenggarakan Rapat Kerja yang Efektif, Terarah, dan Hemat Waktu',
    excerpt: 'Hindari rapat tanpa hasil dengan menyusun agenda tertulis, membatasi durasi pembahasan, menetapkan notula tindakan (action items), dan menunjuk PIC yang jelas.',
    category: 'Produktivitas Bisnis & Administrasi',
    tags: ['Rapat Efektif', 'Meeting Management', 'Notula Rapat', 'Efisiensi Kerja', 'Kolaborasi Tim'],
    authorName: 'Tim Editorial MayStudio',
    coverImageUrl: null,
    status: 'PUBLISHED',
    publishedAt: '2026-07-29T15:45:00.000Z',
    metaTitle: 'Cara Menyelenggarakan Rapat Kerja Efektif | MayStudio',
    metaDescription: 'Tips mengelola rapat kerja agar produktif dan selesai tepat waktu. Format agenda, pencatatan action items, dan tindak lanjut tugas secara disiplin.',
    viewCount: 620,
    createdAt: '2026-07-29T15:45:00.000Z',
    updatedAt: '2026-07-29T15:45:00.000Z',
    deletedAt: null,
    contentMarkdown: `Keluhan "rapat yang sebenarnya bisa diselesaikan lewat satu email singkat" adalah fenomena umum di dunia kerja. Banyak rapat terjebak dalam diskusi melantur tanpa fokus, menghabiskan jam kerja produktif tim, dan berakhir tanpa keputusan yang jelas.

Untuk memastikan setiap menit dalam ruang rapat menghasilkan nilai nyata bagi organisasi, ikuti 4 pedoman tata kelola rapat profesional berikut.

---

### 1. Filosofi "No Agenda, No Meeting"

Jangan pernah menjadwalkan rapat tanpa menyertakan agenda tertulis minimal 24 jam sebelumnya dalam undangan kalender. Agenda yang baik memuat:
- **Tujuan Utama Rapat**: Apakah untuk mengambil keputusan (*decision making*), mencari ide solusi (*brainstorming*), atau menyelaraskan jadwal proyek (*alignment*)?
- **Daftar Topik & Alokasi Menit**: Misal (10 menit rekap data, 20 menit diskusi opsi, 15 menit penentuan keputusan).
- **Materi Pra-Bacaan (*Pre-read Material*)**: Kirimkan dokumen pendukung lebih awal sehingga peserta datang dengan bekal pemahaman, bukan membaca dari nol saat rapat dimulai.

---

### 2. Batasi Jumlah Peserta (Aturan Dua Kotak Pizza)

Undang hanya orang-orang yang peran kontribusinya mutlak diperlukan:
- Pengambil keputusan (*Decision Maker*).
- Pemilik masalah atau penanggung jawab proyek (*Subject Matter Expert*).
- Eksekutor langsung yang akan menjalankan tugas.

Peserta yang hanya butuh informasi hasil akhir cukup menerima salinan notula ringkas (*MoM*) lewat email tanpa perlu hadir secara fisik.

---

### 3. Tunjuk Fasilitator dan Notulis yang Disiplin

- **Fasilitator**: Bertugas menjaga waktu, menengahi perdebatan, dan mengembalikan topik jika ada peserta yang berbicara keluar dari konteks.
- **Notulis**: Menangkap inti keputusan, bukan mencatat setiap perkataan kata per kata.

---

### 4. Format Notula Tindakan (Action Items Table)

Setiap rapat wajib diakhiri dengan pembacaan tabel rencana tindak lanjut:

| Apa Tugasnya (Task) | Siapa Penanggung Jawabnya (PIC) | Kapan Tenggat Waktunya (Deadline) |
| :--- | :--- | :--- |
| Revisi tabel anggaran operasional | Rian (Finance) | Jumat, 17:00 WIB |
| Pengiriman draft kontrak ke vendor B | Sarah (Legal) | Senin, 12:00 WIB |

Kirimkan ringkasan ini ke seluruh peserta maksimal 2 jam setelah rapat selesai untuk memastikan komitmen bersama.`,
  },
  {
    id: 'post-biz-sme-bookkeeping-basics',
    slug: 'dasar-pembukuan-keuangan-sederhana-untuk-umkm',
    title: 'Dasar Pembukuan Keuangan Sederhana untuk Usaha Mikro, Kecil, dan Menengah (UMKM)',
    excerpt: 'Langkah mudah mencatat arus kas masuk dan keluar, memisahkan rekening pribadi dan bisnis, serta menyusun laporan laba rugi sederhana bagi pemilik usaha.',
    category: 'Produktivitas Bisnis & Administrasi',
    tags: ['Pembukuan UMKM', 'Laporan Keuangan', 'Arus Kas', 'Manajemen Bisnis', 'Akuntansi Sederhana'],
    authorName: 'Tim Editorial MayStudio',
    coverImageUrl: null,
    status: 'PUBLISHED',
    publishedAt: '2026-08-08T10:00:00.000Z',
    metaTitle: 'Dasar Pembukuan Keuangan Sederhana UMKM | MayStudio',
    metaDescription: 'Panduan pembukuan keuangan praktis untuk pelaku UMKM. Cara mencatat pemasukan, pengeluaran, inventaris stok, dan mengecek laba bersih bulanan.',
    viewCount: 910,
    createdAt: '2026-08-08T10:00:00.000Z',
    updatedAt: '2026-08-08T10:00:00.000Z',
    deletedAt: null,
    contentMarkdown: `Banyak pemilik usaha kecil dan rintisan mengeluhkan omzet penjualan yang terlihat besar, namun di akhir bulan saldo rekening bisnis tetap kosong. Masalah klasik ini hampir selalu bersumber dari ketiadaan pembukuan keuangan yang tertib dan pemisahan rekening yang tidak disiplin.

Pembukuan tidak harus rumit seperti akuntansi korporasi multinasional. Dengan 4 buku catatan dasar berikut di spreadsheet, Anda dapat memantau kesehatan finansial bisnis Anda dengan akurat.

---

### 1. Pisahkan Rekening Pribadi dan Rekening Usaha Secara Mutlak

Ini adalah fondasi paling utama dalam bisnis:
- Buka rekening bank dan e-wallet khusus yang hanya digunakan untuk transaksi jual-beli dan operasional toko.
- Tetapkan "Gaji Pemilik" (*Owner's Draw/Salary*) tetap setiap bulan yang ditransfer dari rekening usaha ke rekening pribadi Anda.
- Jangan pernah membayar belanja kebutuhan pribadi menggunakan uang kas bisnis, dan sebaliknya.

---

### 2. Buku Kas Masuk dan Kas Keluar (Buku Kas Harian)

Catat setiap rupiah yang bergerak dengan kolom:
- **Tanggal**: Waktu transaksi terjadi.
- **Keterangan**: Rincian nama barang, nomor nota, atau nama pelanggan/pemasok.
- **Kategori**: Pisahkan apakah Pemasukan Penjualan, Biaya Bahan Baku (HPP), Biaya Operasional (Listrik, Sewa, Gaji), atau Biaya Pemasaran.
- **Nominal Masuk / Keluar**.
- **Saldo Akhir**: Menggunakan formula penjumlahan saldo kumulatif.

---

### 3. Buku Catatan Piutang dan Utang Dagang

Banyak usaha kecil mengalami krisis likuiditas karena uang mereka macet di tagihan pelanggan:
- Catat nama pelanggan yang berhutang, tanggal pembelian, jatuh tempo pembayaran, dan nomor kontak.
- Lakukan penagihan secara berkala sebelum tanggal jatuh tempo tiba.
- Catat pula kewajiban utang Anda kepada pemasok bahan baku agar hubungan kemitraan tetap terjaga baik.

---

### 4. Laporan Laba Rugi Sederhana di Akhir Bulan

Di akhir bulan, susun ringkasan sederhana:

\`\`\`text
  Total Pendapatan Omzet Penjualan
- Harga Pokok Penjualan (HPP / Biaya Bahan Baku Langsung)
-----------------------------------------------------------
= Laba Kotor (Gross Profit)
- Beban Operasional (Sewa tempat, gaji staf, utilitas, pulsa)
-----------------------------------------------------------
= Laba Bersih (Net Profit)
\`\`\`

Laba bersih inilah yang menjadi tolak ukur apakah model bisnis Anda benar-benar menghasilkan keuntungan riil untuk diekspansi lebih lanjut.`,
  },
];
