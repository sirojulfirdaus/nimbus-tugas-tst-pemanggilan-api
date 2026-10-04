# NIMBUS — Bandung Weather Companion

NIMBUS adalah aplikasi web cuaca terkini untuk Kota Bandung. Aplikasi ini mengambil data dari OpenWeather, menampilkan gambaran cuaca Bandung, lalu memungkinkan pengguna menjelajahi kondisi pada 30 kecamatan melalui peta interaktif dan pilihan kecamatan.

Selain menampilkan data meteorologi, NIMBUS menyajikan interpretasi kontekstual seperti kesiapan aktivitas luar ruang, kenyamanan, mobilitas, rekomendasi aktivitas, dan saran persiapan. Seluruh informasi tersebut menggunakan data cuaca saat ini, bukan prakiraan.

## Tentang Project

NIMBUS menyajikan:

- cuaca Kota Bandung saat ini;
- cuaca terkini pada 30 kecamatan di Kota Bandung;
- visualisasi peta kecamatan berbasis SVG;
- metrik cuaca utama;
- interpretasi cuaca dan rekomendasi aktivitas berdasarkan data yang tersedia.

## Tujuan

Project ini dibuat sebagai tugas perkuliahan untuk mempraktikkan:

- konsumsi external REST API;
- pemrosesan response JSON;
- normalisasi dan penampilan data API secara dinamis dengan JavaScript;
- pemisahan struktur HTML, presentasi CSS, dan logika JavaScript;
- pembuatan antarmuka interaktif yang bergantung pada data API.

## API yang Digunakan

Data cuaca runtime berasal dari **OpenWeather Current Weather API**.

Base endpoint:

```text
https://api.openweathermap.org/data/2.5/weather
```

Semua request NIMBUS menggunakan `units=metric`, sehingga suhu diterima dalam Celsius.

### 1. Bandung Overview

Gambaran umum Bandung menggunakan parameter kota `q=Bandung`.

Contoh konseptual:

```http
GET https://api.openweathermap.org/data/2.5/weather?q=Bandung&appid=API_KEY&units=metric
```

Response ini digunakan untuk menampilkan kondisi umum Kota Bandung pada bagian overview.

### 2. Weather per Kecamatan

Cuaca kecamatan diminta menggunakan pasangan koordinat `lat` dan `lon`.

Contoh konseptual:

```http
GET https://api.openweathermap.org/data/2.5/weather?lat={LATITUDE}&lon={LONGITUDE}&appid=API_KEY&units=metric
```

Konfigurasi aplikasi memuat satu koordinat representatif untuk masing-masing dari 30 kecamatan di Kota Bandung. Nilai yang ditampilkan merupakan cuaca yang dikembalikan OpenWeather untuk titik representatif tersebut, bukan rata-rata meteorologis resmi atau pengukuran yang berlaku seragam di seluruh wilayah administratif kecamatan.

## Data dari API

Data OpenWeather utama yang digunakan meliputi:

- temperature dan feels like;
- kondisi serta deskripsi cuaca;
- humidity dan pressure;
- visibility dan cloud cover;
- wind speed, wind direction, dan wind gust jika tersedia;
- curah hujan satu jam jika tersedia;
- sunrise dan sunset;
- waktu observasi dan offset zona waktu.

Response mentah divalidasi dan dinormalisasi menjadi struktur data internal sebelum masuk ke state aplikasi dan ditampilkan. Field opsional yang tidak tersedia dipertahankan sebagai data tidak tersedia, bukan diubah menjadi nilai nol.

## Alur Pemanggilan API

```text
Browser
  ↓
Weather Service
  ↓
OpenWeather Current Weather API
  ↓
JSON Response
  ↓
Normalization
  ↓
Application State
  ↓
NIMBUS Interface
```

Alur saat aplikasi dibuka:

1. Aplikasi memeriksa cache cuaca lokal.
2. Cuaca Bandung diminta jika cache segar tidak tersedia.
3. Cuaca seluruh 30 kecamatan diminta melalui koordinat representatifnya.
4. Request kecamatan diproses dengan concurrency terbatas, maksimal lima request pada satu waktu.
5. Response yang berhasil divalidasi, dinormalisasi, dan disimpan ke cache.
6. State aplikasi diperbarui dan antarmuka menampilkan cuaca serta interpretasinya.
7. Pemilihan kecamatan membaca data yang sudah dimuat dan dalam kondisi normal tidak membuat request API baru.

Kegagalan pada satu kecamatan ditangani secara terpisah agar kecamatan lain tetap dapat digunakan.

## Cache dan Refresh

- Data cuaca tersimpan di `localStorage`.
- Cache yang masih segar dapat digunakan tanpa request jaringan baru.
- Masa berlaku cache sekitar 10 menit.
- Tombol **Refresh Weather** memaksa upaya pengambilan data terbaru.
- Jika refresh gagal tetapi cache sebelumnya tersedia, data lama dapat tetap ditampilkan dengan penanda stale.

## Fitur Utama

- cuaca Kota Bandung saat ini;
- peta interaktif 30 kecamatan Kota Bandung;
- pemilihan dan detail cuaca kecamatan;
- Outdoor Readiness;
- Comfort Index;
- Mobility Mood;
- rekomendasi aktivitas;
- keputusan praktis berdasarkan kondisi cuaca saat ini;
- saran persiapan;
- Weather Personality dan weather story;
- metrik cuaca terperinci;
- wind compass;
- visualisasi sunrise dan sunset;
- antarmuka responsif;
- refresh data cuaca.

## Peta Kecamatan Bandung

Geometri kecamatan disimpan sebagai asset SVG lokal pada `assets/maps/bandung-kecamatan.svg`. Geometri Kota Bandung berasal dari dataset [tryfatur/geojson-bandung](https://github.com/tryfatur/geojson-bandung), kemudian dikonversi menjadi SVG untuk digunakan oleh antarmuka.

Repository sumber tersebut digunakan sebagai sumber dataset geometri, bukan sebagai API runtime. Website tidak menghubungi repository tersebut ketika dijalankan.

## Teknologi

- HTML5
- CSS3
- Vanilla JavaScript
- ES Modules
- Fetch API
- LocalStorage
- SVG

Project ini tidak memerlukan frontend framework atau dependency runtime eksternal.

## Struktur Project

```text
nimbus-tugas-tst-pemanggilan-api/
├── index.html
├── assets/
│   └── maps/
├── css/
├── js/
│   ├── api/
│   ├── config/
│   ├── domain/
│   ├── services/
│   ├── state/
│   ├── ui/
│   ├── utils/
│   └── app.js
├── tests/
└── README.md
```

## Cara Menjalankan

Karena aplikasi menggunakan ES Modules, jalankan project melalui local HTTP server. Jangan membuka `index.html` secara langsung menggunakan `file://`.

Clone repository dari GitHub, lalu masuk ke direktori project:

```bash
git clone https://github.com/sirojulfirdaus/nimbus-tugas-tst-pemanggilan-api.git
cd nimbus-tugas-tst-pemanggilan-api
```

### Konfigurasi API Key

Salin file contoh menjadi konfigurasi lokal:

```powershell
Copy-Item js/config/apiKey.example.js js/config/apiKey.local.js
```

Kemudian buka `js/config/apiKey.local.js` dan ganti placeholder dengan OpenWeather API key yang diberikan untuk tugas. File konfigurasi lokal tersebut diabaikan oleh Git dan tidak boleh di-commit.

Setelah berada di direktori root repository, jalankan salah satu local HTTP server berikut.

### Python

```bash
python -m http.server 5500
```

Pada Windows, perintah berikut juga dapat digunakan:

```bash
py -m http.server 5500
```

Setelah server aktif, buka [http://localhost:5500](http://localhost:5500) di browser.

Sebagai alternatif, project dapat dijalankan dengan ekstensi **Live Server** di Visual Studio Code. Tidak diperlukan instalasi npm.

## API Key

Tugas ini menggunakan API key OpenWeather yang disediakan untuk pemanggilan API dari static frontend. Key dikonfigurasi melalui `js/config/apiKey.local.js`, sedangkan repository hanya menyimpan `js/config/apiKey.example.js` sebagai template tanpa credential.

Walaupun tidak disimpan di repository, key tetap dikirim oleh browser dan dapat dilihat melalui browser developer tools. Key pada static frontend tidak dapat dianggap rahasia. Untuk aplikasi produksi, credential API sebaiknya disimpan pada backend, API proxy, atau arsitektur server-side lain yang sesuai.

## Keterbatasan

- Aplikasi hanya menggunakan current weather, bukan forecast.
- Data kecamatan berasal dari query satu koordinat representatif, bukan agregat meteorologis resmi seluruh kecamatan.
- Akurasi dan ketersediaan data bergantung pada OpenWeather serta koneksi jaringan.
- Field opsional seperti rain dan wind gust tidak selalu tersedia pada setiap response.
- API key lokal tetap terlihat oleh client saat runtime karena arsitektur static frontend untuk kebutuhan tugas.

## Repository

[https://github.com/sirojulfirdaus/nimbus-tugas-tst-pemanggilan-api](https://github.com/sirojulfirdaus/nimbus-tugas-tst-pemanggilan-api)
