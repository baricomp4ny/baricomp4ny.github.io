# Portofolio — Muhammad Fikri Bari

Website portofolio pribadi (UI/UX Designer & Web Developer).
HTML + CSS + JavaScript murni, tanpa framework dan tanpa backend.

Alamat: **https://baricomp4ny.github.io/**

## Struktur file

```
Portofolio/
├── index.html          # seluruh isi halaman (8 bagian, urut dari atas)
├── style.css           # tampilan; mobile-first, lalu @media untuk layar lebar
├── script.js           # kartu proyek, foto, cek CV, tombol Salin, efek scroll
├── admin.html/.css/.js # halaman admin untuk mengelola Proyek Pilihan
├── data/
│   └── projects.js     # data Proyek Pilihan (diubah lewat admin)
├── data.txt            # sumber data isi website
├── referensi.png       # acuan gaya visual
└── assets/
    ├── foto.webp/.png  # foto profil
    ├── cv.pdf          # CV untuk tombol "Download CV"
    └── projects/       # gambar kartu proyek
```

## Admin: mengelola Proyek Pilihan

Buka **https://baricomp4ny.github.io/admin.html** (tidak ditautkan dari website
dan tidak diindeks Google). Dari sana Anda bisa menambah, mengedit, menghapus,
dan mengurutkan proyek, termasuk mengunggah gambar.

1. **Buat token GitHub** (sekali saja). Langkahnya ada di halaman admin, bagian
   "Cara membuat token": *Fine-grained token*, akses hanya ke repo
   `baricomp4ny.github.io`, izin **Contents: Read and write**.
2. **Hubungkan.** Tempel token dan klik *Hubungkan*. Data terbaru dimuat dari GitHub.
3. **Ubah proyek.** Kosongkan kolom Link agar kartu menampilkan "Demo segera".
   Gambar otomatis diperkecil (maks. lebar 1280px) dan dikompres ke WebP.
4. **Ganti CV (opsional).** Di bagian *3. CV*, pilih file PDF baru (maks. 10 MB).
   File akan menggantikan `assets/cv.pdf` yang dipakai tombol "Download CV".
5. **Publikasikan.** Semua perubahan dikirim sebagai satu commit. Website
   diperbarui dalam ± 1–2 menit. Gambar proyek yang dihapus ikut dihapus dari repo.

Keamanan:
- Siapa pun bisa membuka `admin.html`, tetapi tidak bisa menyimpan apa pun tanpa token.
- Token hanya disimpan di browser Anda. Jika "Ingat token" tidak dicentang,
  token hilang saat tab ditutup. Centang hanya di perangkat pribadi.
- Jika token bocor, hapus di GitHub (Settings → Developer settings) lalu buat baru.

Tanpa token, tombol **Unduh file (manual)** mengunduh `projects.js` dan gambar baru,
lalu Anda upload sendiri ke folder `data/` dan `assets/projects/` di GitHub.

## Mengganti foto

Foto dipakai dalam dua format: `assets/foto.webp` (ringan, dipakai browser modern)
dan `assets/foto.png` (cadangan). Saat mengganti foto, **ganti keduanya**,
atau hapus `foto.webp` jika hanya punya PNG. Jika foto tidak ada, website
otomatis menampilkan siluet.

Foto ditampilkan dengan bagian atas (kepala) dipertahankan dan bagian bawah
terpotong/memudar, jadi foto potret setengah badan paling cocok.

Agar efek tulisan **PORTFOLIO di belakang badan** terlihat maksimal, pakai foto
**PNG dengan latar transparan** (hapus latar lewat remove.bg atau Canva),
posisi setengah badan, rasio sekitar 4:5. Foto biasa (berlatar) tetap bisa dipakai,
tetapi latarnya akan menutupi sebagian tulisan.

## CV

Tombol "Download CV" mengarah ke `assets/cv.pdf`. Di GitHub Pages, jika file itu
belum ada, tombol otomatis berubah menjadi "CV segera" (abu-abu) agar tidak ada link mati.

## Menambahkan LinkedIn / Instagram

Salin salah satu blok `<li>` di bagian Kontak (misalnya GitHub), lalu ganti
`href`, label, dan teksnya.

## Mencoba di komputer

Buka `index.html` langsung di browser, atau jalankan server lokal:

```bash
python -m http.server 8765
```

lalu buka http://localhost:8765.

## Publikasi ke GitHub Pages

1. Buat repository bernama **`baricomp4ny.github.io`** di akun GitHub `baricomp4ny`.
2. Upload semua file di folder ini (termasuk folder `assets`) ke branch `main`.
3. Buka **Settings → Pages**, pilih *Deploy from a branch*, branch `main`, folder `/ (root)`.
4. Setelah 1–2 menit, website tampil di https://baricomp4ny.github.io/.
   Pasang link tersebut di bio Instagram.

## Catatan teknis

- Font: Anton (judul), Plus Jakarta Sans (teks), Caveat (tulisan tangan), dari Google Fonts.
- Animasi: hero muncul saat halaman dimuat; bagian lain muncul saat di-scroll;
  latar "aurora" bergerak pelan; langkah *Cara Saya Bekerja* menyala mengikuti scroll;
  bilah progres di atas layar. Semua dimatikan jika perangkat mengaktifkan
  *reduce motion*, dan tanpa JavaScript semua konten tetap tampil.
  Pengaturannya ada di bagian "Efek scroll" pada `style.css` dan `script.js`.
- Sudah dicek di lebar 375px, 1024px, dan 1440px tanpa scroll ke samping.

---
© Muhammad Fikri Bari
