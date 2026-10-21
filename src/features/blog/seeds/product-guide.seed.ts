import { BlogPostItem } from '../blog.types';

export const PRODUCT_GUIDE_SEEDS: BlogPostItem[] = [
  {
    id: 'post-product-sales-dashboard-5min',
    slug: 'cara-membuat-dashboard-penjualan-otomatis-5-menit-maystudio',
    title: 'Cara Membuat Dashboard Penjualan Otomatis dalam 5 Menit di MayStudio',
    excerpt: 'Tutorial lengkap mengunggah file data penjualan Excel/CSV ke MayStudio dan menghasilkan dashboard interaktif dengan bento layout serta ringkasan metrik instan.',
    category: 'Panduan Produk',
    tags: ['Dashboard Penjualan', 'MayStudio', 'Tutorial Dashboard', 'Visualisasi Excel', 'Analisis Data'],
    authorName: 'Tim Editorial MayStudio',
    coverImageUrl: null,
    status: 'PUBLISHED',
    publishedAt: '2026-07-08T11:30:00.000Z',
    metaTitle: 'Cara Membuat Dashboard Penjualan Otomatis | MayStudio',
    metaDescription: 'Langkah praktis membuat dashboard penjualan visual dari file Excel di MayStudio dalam 5 menit. Tanpa koding, langsung siap dipresentasikan.',
    viewCount: 1150,
    createdAt: '2026-07-08T11:30:00.000Z',
    updatedAt: '2026-07-08T11:30:00.000Z',
    deletedAt: null,
    contentMarkdown: `Menyusun laporan penjualan berkala dari sekumpulan file spreadsheet sering kali memakan waktu berjam-jam: membuat pivot table, menyalin grafik ke PowerPoint, merapikan palet warna, dan menghitung persentase pertumbuhan.

Dengan fitur ingestion dan generator analitik di MayStudio, Anda dapat mengubah file mentah Excel (\`.xlsx\`) atau \`.csv\` menjadi dashboard visual modern bergaya bento grid yang siap dipresentasikan dalam hitungan menit.

---

### Langkah 1: Mempersiapkan Format File Spreadsheet

Pastikan file spreadsheet Anda memiliki susunan standar tabular:
- Baris pertama (Row 1) berisi nama kolom yang jelas (misal: \`Tanggal\`, \`Nama_Sales\`, \`Kategori_Produk\`, \`Wilayah\`, \`Qty\`, \`Total_Nilai\`).
- Tidak ada baris kosong di tengah-tengah data.
- Kolom tanggal diformat sesuai standar tanggal (*Date*), dan nominal berupa angka numerik tanpa simbol mata uang manual.

---

### Langkah 2: Mengunggah Berkas ke Modul Ingestion

1. Masuk ke menu [Upload & Buat Dashboard](/upload) di panel MayStudio.
2. Seret dan lepaskan (*drag and drop*) file Anda ke area unggah atau klik tombol telusuri berkas.
3. Mesin parser MayStudio akan memvalidasi skema data, mendeteksi tipe kolom, dan menampilkan pratinjau tabel awal (*Data Preview*).

---

### Langkah 3: Menentukan Metrik Utama dan Layout

MayStudio secara cerdas menyarankan visualisasi yang paling relevan untuk dataset Anda:
- **Kartu Ringkasan KPI**: Menampilkan Total Omzet, Rata-rata Nilai Transaksi (*AOV*), dan Jumlah Transaksi Unik.
- **Bagan Tren Waktu**: Memvisualisasikan pergerakan omzet mingguan atau bulanan secara interaktif.
- **Distribusi Segmen**: Menampilkan perbandingan performa per kategori produk atau kontribusi wilayah sales dalam diagram batang horisontal yang rapi.

---

### Langkah 4: Kustomisasi Tema dan Ekspor Laporan

- Pilih palet warna korporat yang sesuai (seperti tema *Teal Corporate*, *Executive Indigo*, atau *Minimal Warm*).
- Simpan dashboard ke akun Anda untuk diakses kembali sewaktu-waktu atau unduh ringkasan laporan dalam format siap kirim.

Mulai buat dashboard pertama Anda hari ini melalui menu [Dashboard Generator MayStudio](/upload).`,
  },
  {
    id: 'post-product-business-forms-guide',
    slug: 'panduan-menggunakan-template-formulir-bisnis-hr-maystudio',
    title: 'Panduan Lengkap Menggunakan Template Formulir Bisnis dan HR di MayStudio',
    excerpt: 'Cara memanfaatkan katalog formulir siap pakai untuk pengajuan cuti, purchase order, evaluasi kinerja, hingga klaim reimbursement dengan validasi data otomatis.',
    category: 'Panduan Produk',
    tags: ['Formulir Bisnis', 'Template HR', 'Purchase Order', 'MayStudio', 'Administrasi Kantor'],
    authorName: 'Tim Editorial MayStudio',
    coverImageUrl: null,
    status: 'PUBLISHED',
    publishedAt: '2026-07-27T14:00:00.000Z',
    metaTitle: 'Panduan Template Formulir Bisnis & HR | MayStudio',
    metaDescription: 'Pelajari cara memilih, mengisi, dan mencetak dokumen formulir operasional kantor siap pakai di MayStudio untuk mempercepat administrasi harian tim Anda.',
    viewCount: 790,
    createdAt: '2026-07-27T14:00:00.000Z',
    updatedAt: '2026-07-27T14:00:00.000Z',
    deletedAt: null,
    contentMarkdown: `Pembuatan dokumen administrasi internal dari kertas kosong sering kali menghasilkan format yang tidak seragam antar karyawan: ada yang lupa mencantumkan nomor kontak darurat pada form cuti, atau salah menghitung kalkulasi PPN pada berkas pesanan pembelian (*Purchase Order*).

Katalog [Formulir Bisnis MayStudio](/formulir) menyediakan pustaka template dokumen operasional terstandarisasi yang siap digunakan dengan validasi otomatis.

---

### Ragam Kategori Formulir yang Tersedia

1. **Human Resources & Personalia**:
   - Formulir Permohonan Cuti Tahunan / Sakit
   - Form Klaim Penggantian Biaya Pengobatan (*Medical Reimbursement*)
   - Lembar Penilaian Kinerja Karyawan (KPI Review Form)
   - Berita Acara Serah Terima Inventaris Kantor (*Handover Form*)

2. **Pengadaan & Finansial (*Procurement & Finance*)**:
   - Surat Pesanan Pembelian (*Purchase Order / PO*)
   - Formulir Permintaan Pembelian Barang (*Purchase Requisition*)
   - Bukti Pengeluaran Kas Kecil (*Petty Cash Voucher*)
   - Lembar Laporan Perjalanan Dinas (*Travel Expense Report*)

3. **Operasional & Layanan Pelanggan**:
   - Formulir Keluhan Pelanggan (*Customer Feedback & Incident Log*)
   - Berita Acara Pekerjaan Selesai (BAP)

---

### Cara Menggunakan dan Mengkustomisasi Formulir

1. Buka halaman [Formulir MayStudio](/formulir).
2. Pilih template dokumen yang Anda butuhkan melalui filter kategori atau kotak pencarian.
3. Isi data identitas perusahaan, nama staf, rincian biaya, dan tanggal efektif pada formulir interaktif di layar.
4. Sistem otomatis menghitung subtotal, pajak, dan total akhir dengan akurasi 100%.
5. Cetak langsung atau simpan dokumen dalam format PDF beresolusi tinggi dengan kop surat yang rapi.

Standarisasi seluruh dokumen administrasi perusahaan Anda sekarang untuk alur kerja yang lebih profesional dan bebas hambatan.`,
  },
  {
    id: 'post-product-dashboard-theme-colors',
    slug: 'tips-memilih-tema-warna-dashboard-presentasi-eksekutif',
    title: 'Tips Memilih Tema dan Palet Warna Dashboard yang Tepat untuk Presentasi Eksekutif',
    excerpt: 'Panduan psikologi warna data, kontras rasio yang nyaman di mata, dan cara menyesuaikan tema dashboard MayStudio dengan identitas perusahaan Anda.',
    category: 'Panduan Produk',
    tags: ['Tema Dashboard', 'Desain Visual', 'Presentasi Eksekutif', 'Palet Warna', 'UI UX Data'],
    authorName: 'Tim Editorial MayStudio',
    coverImageUrl: null,
    status: 'PUBLISHED',
    publishedAt: '2026-08-05T08:30:00.000Z',
    metaTitle: 'Tips Memilih Tema Warna Dashboard Eksekutif | MayStudio',
    metaDescription: 'Cara memilih tema dan kombinasi warna visualisasi dashboard yang elegan dan mudah dibaca oleh para pimpinan perusahaan saat presentasi laporan.',
    viewCount: 670,
    createdAt: '2026-08-05T08:30:00.000Z',
    updatedAt: '2026-08-05T08:30:00.000Z',
    deletedAt: null,
    contentMarkdown: `Warna dalam visualisasi data bukan sekadar dekorasi pemanis tampilan, melainkan instrumen komunikasi visual yang memandu fokus pembaca pada hal yang paling penting. Pemilihan palet warna yang terlalu mencolok, minim kontras, atau terlalu banyak variasi gradien justru akan melelahkan mata dan mengaburkan pesan laporan.

Berikut adalah prinsip pemilihan tema visual untuk dashboard eksekutif di MayStudio.

---

### 1. Aturan 60-30-10 dalam Desain Antarmuka Data

- **60% Warna Latar Belakang Netral**: Gunakan warna kanvas lembut seperti putih pudar (*off-white* / \`#f8f9fa\`) atau abu-abu netral sangat muda. Ini memberikan ruang bernapas yang luas (*negative space*).
- **30% Warna Struktural**: Digunakan untuk teks judul, garis batas kartu (*borders*), dan sumbu grafik (misalnya warna slate tua \`#0f172a\` atau navy gelap).
- **10% Warna Aksen Utama**: Warna tegas yang digunakan secara hemat hanya untuk menyoroti metrik kunci, batang grafik aktif, atau indikator status.

---

### 2. Memahami Semiotika Warna Bisnis

- **Teal / Emerald Green**: Sangat ideal untuk laporan bisnis umum, kesehatan finansial, pertumbuhan positif, dan suasana profesional yang tenang.
- **Deep Navy / Classic Slate**: Memberikan impresi kestabilan, audit kepatuhan, dan ketelitian tinggi untuk laporan perbankan atau legal.
- **Rose / Crimson**: Gunakan warna merah secara eksklusif hanya untuk tanda peringatan (misal target yang belum tercapai, selisih kerugian, atau stok menipis). Jangan gunakan warna merah sebagai warna tema latar belakang kartu normal.

---

### 3. Menghindari Pelangi Visual (Color Overload)

Hindari memberikan warna berbeda untuk setiap batang grafik jika seluruh batang tersebut mengukur variabel yang sama. Jika Anda menampilkan grafik omzet 12 bulan, cukup gunakan satu warna biru/teal yang seragam. Gunakan warna aksen berbeda hanya pada satu bulan tertentu yang menjadi fokus pembahasan rekor tertinggi.

Sesuaikan pengaturan tema visual dashboard Anda secara instan di [Dashboard Studio MayStudio](/dashboards).`,
  },
  {
    id: 'post-product-formula-and-dashboard-workflow',
    slug: 'menggabungkan-kalkulator-rumus-excel-dan-dashboard-visual',
    title: 'Cara Menggabungkan Kalkulator Rumus Excel dan Dashboard Visual untuk Efisiensi Tim',
    excerpt: 'Alur kerja terintegrasi antara pengecekan logika formula pada modul Kamus Rumus dengan visualisasi tren KPI untuk meningkatkan akurasi data tim operasional.',
    category: 'Panduan Produk',
    tags: ['Kamus Rumus', 'Dashboard Visual', 'Efisiensi Tim', 'Workflow Data', 'MayStudio'],
    authorName: 'Tim Editorial MayStudio',
    coverImageUrl: null,
    status: 'PUBLISHED',
    publishedAt: '2026-08-16T16:15:00.000Z',
    metaTitle: 'Alur Kerja Rumus Excel & Dashboard Visual | MayStudio',
    metaDescription: 'Optimalkan alur kerja tim data Anda dengan mengombinasikan verifikasi formula spreadsheet dan dashboard analitik interaktif di MayStudio.',
    viewCount: 830,
    createdAt: '2026-08-16T16:15:00.000Z',
    updatedAt: '2026-08-16T16:15:00.000Z',
    deletedAt: null,
    contentMarkdown: `Banyak tim operasional dan keuangan mengalami hambatan kerja karena memisahkan proses validasi formula dengan proses penyajian visual. Sering kali terjadi situasi di mana sebuah grafik dashboard terlihat sangat meyakinkan, namun setelah diaudit, angka dasarnya salah akibat kekeliruan rumus penguncian sel (\`$A$1\`) atau salah memilih parameter \`VLOOKUP\`.

MayStudio dirancang untuk menghubungkan siklus pengolahan data secara menyeluruh dalam satu ekosistem: mulai dari verifikasi logika formula hingga presentasi visual akhir.

---

### Alur Kerja Terpadu 3 Langkah

#### Tahap 1: Verifikasi Logika Formula di Kamus Rumus
Sebelum menerapkan formula pada tabel data master perusahaan yang memuat puluhan ribu baris:
1. Buka modul [Kamus Rumus Excel MayStudio](/rumus).
2. Pelajari sintaks, contoh kasus, dan uji logika rumus (misalnya \`SUMIFS\`, \`XLOOKUP\`, atau \`INDEX MATCH\`) pada kalkulator interaktif.
3. Pastikan penanganan galat seperti \`IFERROR\` telah terpasang dengan benar.

#### Tahap 2: Ekspor Data Bersih ke Format Terstruktur
Setelah formula di lembar kerja Anda terbukti akurat dan menghasilkan rekap yang valid, simpan hasil ringkasan tabel Anda dalam format \`.xlsx\` atau \`.csv\`.

#### Tahap 3: Visualisasi Interaktif di Dashboard Analyst
Unggah file tabel ringkasan tersebut ke modul [Dashboard MayStudio](/upload) untuk menghasilkan bento cards, grafik tren, dan perbandingan performa interaktif tanpa perlu menyusun grafik secara manual satu per satu.

---

### Manfaat Integrasi Workflow untuk Tim Kerja

- **Eliminasi Human Error**: Pengecekan logika rumus sejak awal mencegah kesalahan data fatal sampai ke meja manajemen.
- **Standarisasi Tampilan Laporan**: Seluruh anggota tim menghasilkan laporan dengan format dan estetika desain yang konsisten.
- **Hemat Waktu Signifikan**: Memangkas waktu pembuatan laporan mingguan hingga lebih dari 70%.

Jelajahi seluruh modul terintegrasi kami dan tingkatkan standar produktivitas tim Anda bersama MayStudio.`,
  },
];
