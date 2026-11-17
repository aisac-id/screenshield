# Operation — ScreenShield

Knowledge base komersial & operasional untuk **ScreenShield — Sensitive-Info Redaction Mirror**, ekstensi Google Chrome Manifest V3 dari **PT. Sainskerta Solusi Nusantara** — software house & AI partner sejak 2013, berkantor di Gedung Graha Mampang Lt. 3, Jakarta Selatan.

ScreenShield memirror sebuah layar atau tab, membaca teksnya sepenuhnya lokal dengan OCR Tesseract WASM (tanpa jaringan, tanpa backend, izin manifest hanya `storage`), lalu memikselisasi email, nomor telepon, nomor kartu yang lolos Luhn, API secret, kata sandi, dan kata kunci kustom pada salinan cermin tersebut. Yang dibagikan di rapat adalah tab cermin, bukan jendela aslinya.

Seluruh dokumen di folder ini disusun berdasarkan fakta yang ada di repositori (`README.md`, `manifest.json`, `app.html`, `background.js`, `js/`, `vendor/`, `assets/`, `docs/`, `promo/`, `LICENSE`) serta sumber eksternal nyata yang dicantumkan pada bagian *Sumber & Referensi* tiap dokumen.

> **Catatan penting.** Harga, target, proyeksi, ambang waktu, jenjang layanan, dan seluruh nilai rupiah dalam dokumen ini adalah **usulan — perlu validasi manajemen**. Dokumen berklasifikasi Confidential dan berstatus *Final Draft — Review Manajemen*. Analisis kepatuhan bersifat internal dan bukan nasihat hukum.

## 01-Business-Strategy

| Dokumen | Kode | Isi |
|---|---|---|
| [Business Model Canvas](01-Business-Strategy/01-Business-Model-Canvas.docx) | SSN-SSH-BMC-01 | Sembilan blok usaha, prasyarat monetisasi, struktur biaya tanpa server |
| [ICP dan Segmentasi Pasar](01-Business-Strategy/02-ICP-dan-Segmentasi-Pasar.docx) | SSN-SSH-ICP-02 | Profil pelanggan ideal, persona, kriteria kualifikasi dan diskualifikasi |
| [Analisis Kompetitor](01-Business-Strategy/03-Analisis-Kompetitor.docx) | SSN-SSH-KOMP-03 | Empat kelas pesaing nyata dengan URL, posisi yang dapat dipertahankan |
| [Analisis SWOT](01-Business-Strategy/04-Analisis-SWOT.docx) | SSN-SSH-SWOT-04 | Kekuatan arsitektur, celah komersial, peluang regulasi, ancaman platform |

## 02-Sales

| Dokumen | Kode | Isi |
|---|---|---|
| [Proposal Penjualan B2B — Tim Teknologi](02-Sales/05-Proposal-Penjualan-B2B-TimTeknologi.docx) | SSN-SSH-PROP-B2B-05 | Lisensi kursi, standardisasi kata kunci, pemasangan 30 hari |
| [Proposal Penjualan B2C — Praktisi Digital](02-Sales/05-Proposal-Penjualan-B2C-PraktisiDigital.docx) | SSN-SSH-PROP-B2C-05 | Penawaran untuk individu, privasi yang bisa diaudit sendiri |
| [Statement of Work](02-Sales/06-Statement-of-Work.docx) | SSN-SSH-SOW-06 | Enam paket jasa, jadwal, kriteria penerimaan, garansi |
| [Pricing dan Packaging](02-Sales/07-Pricing-dan-Packaging.docx) | SSN-SSH-PRICE-07 | Empat lapis produk, jasa, diskon, rencana uji harga |
| [Sales Playbook dan Battlecard](02-Sales/08-Sales-Playbook-dan-Battlecard.docx) | SSN-SSH-PLAY-08 | Alur dua jalur, naskah per persona, kontra keberatan, larangan klaim |
| [Product Datasheet](02-Sales/09-Product-Datasheet.docx) | SSN-SSH-DS-09 | Spesifikasi terverifikasi: izin, aturan deteksi, parameter, batasan |

## 03-Pre-Sales

| Dokumen | Kode | Isi |
|---|---|---|
| [Discovery Questionnaire](03-Pre-Sales/10-Discovery-Questionnaire.docx) | SSN-SSH-DISC-10 | Kuesioner penemuan dan saringan kualifikasi |
| [Demo Script dan PoC Plan](03-Pre-Sales/11-Demo-Script-dan-PoC-Plan.docx) | SSN-SSH-DEMO-11 | Naskah demo 12 menit, uji guna 14 hari, ambang keberhasilan |
| [Technical Proposal](03-Pre-Sales/12-Technical-Proposal.docx) | SSN-SSH-TECH-12 | Proposal untuk uji tuntas keamanan klien |
| [ROI dan Business Case](03-Pre-Sales/13-ROI-dan-Business-Case.docx) | SSN-SSH-ROI-13 | Model manfaat dengan variabel diisi klien, total biaya kepemilikan |

## 04-IT-Communication

| Dokumen | Kode | Isi |
|---|---|---|
| [Arsitektur Solusi](04-IT-Communication/14-Arsitektur-Solusi.docx) | SSN-SSH-ARS-14 | Komponen sisi klien, alur data satu arah, distribusi dan pembaruan |
| [Arsitektur Keamanan dan Threat Model](04-IT-Communication/15-Arsitektur-Keamanan-dan-Threat-Model.docx) | SSN-SSH-SEC-15 | Model ancaman per permukaan, rantai pasok, celah yang belum ditangani |
| [Privasi Data dan Kepatuhan](04-IT-Communication/16-Privasi-Data-dan-Kepatuhan.docx) | SSN-SSH-PRIV-16 | Pemetaan UU PDP No. 27/2022, peran pengendali, yurisdiksi ekspor |

## 05-Resilience-Operations

| Dokumen | Kode | Isi |
|---|---|---|
| [Business Continuity Plan](05-Resilience-Operations/17-Business-Continuity-Plan.docx) | SSN-SSH-BCP-17 | Kelangsungan distribusi, bangun, dan dukungan — bukan server |
| [Disaster Recovery Plan](05-Resilience-Operations/18-Disaster-Recovery-Plan.docx) | SSN-SSH-DRP-18 | Pemulihan kunci penerbit, repositori, dan saluran distribusi |
| [SOP Insiden dan Breach Response](05-Resilience-Operations/19-SOP-Insiden-dan-Breach-Response.docx) | SSN-SSH-SOP-19 | Deteksi, triase, penahanan, eradikasi, pemulihan, notifikasi |
| [SLA dan Model Dukungan](05-Resilience-Operations/20-SLA-dan-Model-Dukungan.docx) | SSN-SSH-SLA-20 | Jenjang layanan, klasifikasi tiket, kredit, dan pengukuran mutu |

## Cara membaca suite ini

Mulai dari `01-Business-Model-Canvas` untuk memahami model usaha, lalu `02-ICP-dan-Segmentasi-Pasar` dan `03-Analisis-Kompetitor` untuk menentukan siapa yang dibidik dan siapa lawannya. Tim penjualan memakai `08-Sales-Playbook-dan-Battlecard` bersama `09-Product-Datasheet`. Tim pra-penjualan dan arsitek klien memakai `10` sampai `13`. Tim infrastruktur, keamanan, dan kepatuhan klien memakai `14` sampai `20`.

Satu hal yang berulang di seluruh dokumen dan harus dipahami sebelum keputusan komersial apa pun: **v1.0.0 belum memiliki modul validasi lisensi**, sehingga lapis berbayar tidak dapat ditagih sampai modul itu dibangun. Hanya jasa implementasi dan skema berbasis kode yang dapat diperdagangkan hari ini.

## Penerbit

PT. Sainskerta Solusi Nusantara — software house & AI partner, Jakarta, sejak 2013.
Gedung Graha Mampang Lt. 3, Jakarta Selatan · hello@sainskerta.id · +62 813-5988-3131 · sainskerta.net

© 2026 PT. Sainskerta Solusi Nusantara · hello@sainskerta.id · sainskerta.net
