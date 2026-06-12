// =========================================================================
// LOGIKA UTAMA ADMIN - APP ABSENSI MAN 2 SIJUNJUNG
// =========================================================================

// PENTING: Ganti dengan URL Aplikasi Web /exec yang Anda dapatkan dari Google Apps Script!
const URL_API = "https://script.google.com/macros/s/AKfycbyiJUyJndpBwzuhfo2nAQ3kjJinwt_tNPUmPHBcBf2BZ4Ex8BTSsy6iwgjNNC2eg4k8/exec";

// State / Penyimpanan Data Sementara di Memory Browser
let DB = { siswa: [], absensi: [], kelas: [], jadwal: [], jam: [] };
let antreanAbsenLokal = []; // Menampung hasil scan yang belum disinkronkan ke Google Sheets

// 1. FUNGSI OTOMATIS SAAT HALAMAN DIBUKA (INITIALIZATION)
window.addEventListener("DOMContentLoaded", () => {
    jalankanJamRealtime();
    ambilDatabasePusat();
});

// Fungsi Menjalankan Jam di Sidebar
function jalankanJamRealtime() {
    setInterval(() => {
        const sekarang = new Date();
        document.getElementById("clock-display").innerText = sekarang.toLocaleTimeString("id-ID");
    }, 1000);
}

// Fungsi Mendownload Semua Data dari Google Sheets di Awal
function ambilDatabasePusat() {
    const progress = document.getElementById("loadProgress");
    const statusText = document.getElementById("status-text");
    
    progress.style.width = "40%";
    
    // Memanggil fungsi doGet() pada Apps Script dengan parameter action=downloadMaster
    fetch(`${URL_API}?action=downloadMaster`)
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                progress.style.width = "100%";
                statusText.innerText = "Sinkronisasi Berhasil!";
                
                // Simpan data ke dalam objek global DB
                DB.siswa = data.siswa;
                DB.absensi = data.absensi;
                DB.kelas = data.kelas;
                DB.jadwal = data.jadwal;
                DB.jam = data.jam;

                // Muat pilihan kelas ke dalam dropdown form filter dan input jadwal
                perbaruiDropdownKelas();
                
                // Tampilkan tabel rekapitulasi data
                tampilkanTabelRekap();
                tampilkanTabelJadwal();
                isiFormAturanJam();

                // Beri jeda 1 detik lalu hilangkan Splashscreen masuk ke Halaman Login
                setTimeout(() => {
                    document.getElementById("splashscreen").classList.add("hidden");
                    document.getElementById("login-page").classList.remove("hidden");
                }, 1000);
            } else {
                statusText.innerText = "Gagal mengambil data: " + data.message;
            }
        })
        .catch(err => {
            statusText.innerText = "Koneksi Error. Menggunakan Data Lokal Terakhir.";
            console.error(err);
            // Jika offline, hilangkan splashscreen agar admin tetap bisa masuk menggunakan memori lokal browser
            setTimeout(() => {
                document.getElementById("splashscreen").classList.add("hidden");
                document.getElementById("login-page").classList.remove("hidden");
            }, 1000);
        });
}

// 2. LOGIKA LOGIN & NAVIGASI TAB
function handleLogin() {
    const inputSekolah = document.getElementById("school-input").value.trim();
    // Login sederhana: validasi nama sekolah mengandung kata "MAN 2"
    if (inputSekolah.toUpperCase().includes("MAN 2")) {
        document.getElementById("login-page").classList.add("hidden");
        document.getElementById("dashboard-layout").classList.remove("hidden");
        // Nyalakan Kamera Scanner QR setelah login berhasil
        mulaiKameraScanner();
    } else {
        document.getElementById("login-error").innerText = "Nama Sekolah Salah! Gunakan otoritas MAN 2 Sijunjung.";
    }
}

function handleLogout() {
    location.reload(); // Refresh halaman untuk reset keamanan
}

function switchTab(tabId) {
    // Sembunyikan semua konten tab
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active-tab"));
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    
    // Tampilkan tab yang dipilih
    document.getElementById(tabId).classList.add("active-tab");
    // Cari tombol mana yang memicu fungsi ini lalu beri tanda aktif
    event.currentTarget.classList.add("active");
}

// 3. FITUR UTAMA: SCANNER QR CODE & HITUNG OTOMATIS STATUS ABSENSI
let html5QrcodeScanner;
function mulaiKameraScanner() {
    html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 });
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

function onScanSuccess(decodedText) {
    // Asumsi teks di QR Code adalah Kode_Unik siswa (Contoh: "1001-A2B3C")
    // Cari data siswa di database berdasarkan Kode_Unik tersebut
    const siswa = DB.siswa.find(s => s.Kode_Unik === decodedText || s.NISN.toString() === decodedText);
    const profilBox = document.getElementById("latest-scan-profile");

    if (!siswa) {
        profilBox.innerHTML = `<p style="color:red; font-weight:bold;"><i class="fa-solid fa-triangle-exclamation"></i> KARTU QR TIDAK DIKENALI!<br>Siswa belum melengkapi data di halaman siswa.</p>`;
        return;
    }

    // HITUNG LOGIKA STATUS ABSENSI (Tepat Waktu / Terlambat / Alpha)
    const sekarang = new Date();
    const jamSekarangString = sekarang.toTimeString().split(' ')[0].substring(0,5); // Format "07:15"
    const hariIniString = sekarang.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' });
    
    // Ambil acuan aturan jam dari Google Sheets (Baris pertama data Jam)
    const aturanJam = DB.jam[0] || { Jam_Masuk: "07:15", Jam_Toleransi: 15 };
    
    let statusAbsen = "Tepat Waktu";
    
    // Ubah jam ke hitungan menit untuk perbandingan matematika sederhana
    const [hSekarang, mSekarang] = jamSekarangString.split(":").map(Number);
    const [hAturan, mAturan] = aturanJam.Jam_Masuk.split(":").map(Number);
    
    const menitSekarang = hSekarang * 60 + mSekarang;
    const menitAturanMasuk = hAturan * 60 + mAturan;
    const menitBatasToleransi = menitAturanMasuk + Number(aturanJam.Jam_Toleransi);

    if (menitSekarang > menitBatasToleransi) {
        statusAbsen = "Alpha";
    } else if (menitSekarang > menitAturanMasuk) {
        statusAbsen = "Terlambat";
    }

    // Buat objek data absen baru
    const dataAbsenBaru = {
        tanggal: sekarang.toLocaleDateString('id-ID'),
        waktu: jamSekarangString,
        nisn: siswa.NISN,
        nama: siswa.Nama,
        kelas: siswa.Kelas,
        status: statusAbsen,
        keterangan: "-"
    };

    // Masukkan ke dalam antrean lokal (Sebelum dikirim massal ke Google Sheets)
    antreanAbsenLokal.push(dataAbsenBaru);
    document.getElementById("badge-antrean").innerText = antreanAbsenLokal.length;

    // Tampilkan profil siswa yang sukses di-scan ke layar panel admin
    profilBox.innerHTML = `
        <div class="scan-success-profile">
            <i class="fa-solid fa-circle-check" style="color:#27ae60; font-size:40px;"></i>
            <h4 style="margin: 10px 0; font-size:20px;">${siswa.Nama}</h4>
            <p><b>NISN:</b> ${siswa.NISN} | <b>Kelas:</b> ${siswa.Kelas}</p>
            <p style="margin-top:10px;">Jam Scan: <b>${jamSekarangString} WIB</b></p>
            <span class="badge-status ${statusAbsen.toLowerCase().replace(' ', '-')}" style="display:inline-block; padding:6px 12px; border-radius:20px; color:white; font-weight:bold; margin-top:10px; background:${statusAbsen === 'Tepat Waktu' ? '#27ae60' : (statusAbsen === 'Terlambat' ? '#f57c00' : '#d32f2f')}">${statusAbsen}</span>
        </div>
    `;

    // Beri efek suara beep/notifikasi sukses jika diinginkan
    alert(`Absen berhasil dicatat lokal: ${siswa.Nama} (${statusAbsen})`);
}

function onScanFailure(error) {
    // Gagal scan biasanya karena kamera tidak fokus atau QR bergerak, biarkan sistem mencoba kembali otomatis
}

// 4. SYNC DATA: KIRIM DATA ANTRIAN LOKAL SCAN KE GOOGLE SHEETS (POST)
function uploadAntreanKeDatabase() {
    if (antreanAbsenLokal.length === 0) {
        alert("Tidak ada antrean data absensi baru untuk disinkronkan.");
        return;
    }

    const btn = document.getElementById("btn-sync-db");
    btn.innerText = "Sedang Mengirim...";
    btn.disabled = true;

    fetch(URL_API, {
        method: "POST",
        mode: "no-cors", // Mengizinkan pengiriman lintas asal (CORS) tanpa hambatan keamanan browser
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "uploadAbsenMassal",
            data: antreanAbsenLokal
        })
    })
    .then(() => {
        // Karena menggunakan no-cors, browser tidak bisa membaca balasan JSON, namun jika masuk blok ini artinya data terkirim
        alert(`Sukses! ${antreanAbsenLokal.length} Data Absensi Berhasil Diunggah ke Google Sheets.`);
        antreanAbsenLokal = []; // Kosongkan antrean
        document.getElementById("badge-antrean").innerText = "0";
        btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Sinkronkan ke Database <span id="badge-antrean">0</span>`;
        btn.disabled = false;
        ambilDatabasePusat(); // Unduh ulang master data terbaru
    })
    .catch(err => {
        alert("Gagal sinkronisasi. Periksa jaringan internet Anda.");
        btn.disabled = false;
        console.error(err);
    });
}

// 5. FUNGSI PEMBANTU UNTUK MERENDER TABEL & FORM
function perbaruiDropdownKelas() {
    const selFilter = document.getElementById("filter-kelas");
    const selJadwal = document.getElementById("input-jadwal-kelas");
    
    // Bersihkan dropdown lama
    selFilter.innerHTML = '<option value="">-- Semua Kelas --</option>';
    selJadwal.innerHTML = '<option value="">-- Pilih Kelas --</option>';

    DB.kelas.forEach(k => {
        const opt1 = `<option value="${k.Nama_Kelas}">${k.Nama_Kelas}</option>`;
        const opt2 = `<option value="${k.Nama_Kelas}">${k.Nama_Kelas}</option>`;
        selFilter.innerHTML += opt1;
        selJadwal.innerHTML += opt2;
    });
}

function tampilkanTabelRekap() {
    const tbody = document.querySelector("#table-rekap-siswa tbody");
    tbody.innerHTML = "";

    // Lakukan pengelompokan (Grouping) data absensi berdasarkan siswa
    DB.siswa.forEach(s => {
        // Filter semua data absen milik NISN siswa bersangkutan
        const absenSiswa = DB.absensi.filter(a => a.NISN == s.NISN);
        
        let hadir = absenSiswa.filter(a => a.Status === "Tepat Waktu").length;
        let terlambat = absenSiswa.filter(a => a.Status === "Terlambat").length;
        let izin = absenSiswa.filter(a => a.Status === "Izin").length;
        let sakit = absenSiswa.filter(a => a.Status === "Sakit").length;
        let alpha = absenSiswa.filter(a => a.Status === "Alpha").length;

        tbody.innerHTML += `
            <tr>
                <td>${s.NISN}</td>
                <td><b>${s.Nama}</b></td>
                <td>${s.Kelas}</td>
                <td style="color:#27ae60; font-weight:bold;">${hadir}</td>
                <td style="color:#f57c00; font-weight:bold;">${terlambat}</td>
                <td style="color:#2980b9; font-weight:bold;">${izin}</td>
                <td style="color:#8e44ad; font-weight:bold;">${sakit}</td>
                <td style="color:#c0392b; font-weight:bold;">${alpha}</td>
                <td>
                    <button class="btn-danger" onclick="hapusSiswaPusat('${s.NISN}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function tampilkanTabelJadwal() {
    const tbody = document.querySelector("#table-jadwal-pelajaran tbody");
    tbody.innerHTML = "";
    DB.jadwal.forEach(j => {
        tbody.innerHTML += `
            <tr>
                <td>${j.ID_Jadwal}</td>
                <td>${j.Nama_Kelas}</td>
                <td>${j.Hari}</td>
                <td><b>${j.Mapel}</b></td>
                <td>${j.Jam_Mulai}</td>
                <td>${j.Jam_Selesai}</td>
                <td>
                    <button class="btn-danger" onclick="hapusJadwalPusat('${j.ID_Jadwal}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function isiFormAturanJam() {
    if(DB.jam.length > 0) {
        document.getElementById("input-jam-masuk").value = DB.jam[0].Jam_Masuk;
        document.getElementById("input-jam-toleransi").value = DB.jam[0].Jam_Toleransi;
    }
}

// 6. ACTION MANAGER: TAMBAH DATA (CREATE) & HAPUS (DELETE) KE GOOGLE SHEETS
function tambahKelas() {
    const namaKelas = document.getElementById("input-nama-kelas").value.trim();
    if(!namaKelas) return alert("Ketik nama kelas!");

    kirimPostAPI({ action: "tambahKelas", data: { nama_kelas: namaKelas } }, "Kelas Baru Berhasil Disimpan!");
}

function tambahJadwal() {
    const dataJadwal = {
        nama_kelas: document.getElementById("input-jadwal-kelas").value,
        hari: document.getElementById("input-jadwal-hari").value,
        mapel: document.getElementById("input-jadwal-mapel").value.trim(),
        jam_mulai: document.getElementById("input-jadwal-mulai").value,
        jam_selesai: document.getElementById("input-jadwal-selesai").value
    };

    if(!dataJadwal.nama_kelas || !dataJadwal.mapel) return alert("Lengkapi form pembuatan jadwal!");
    kirimPostAPI({ action: "tambahJadwal", data: dataJadwal }, "Jadwal Baru Berhasil Dibuat!");
}

function simpanAturanJam() {
    const dataJam = {
        jam_masuk: document.getElementById("input-jam-masuk").value,
        jam_toleransi: document.getElementById("input-jam-toleransi").value
    };
    kirimPostAPI({ action: "simpanAturanJam", data: dataJam }, "Aturan Jam Masuk Diperbarui!");
}

function hapusSiswaPusat(nisn) {
    if(confirm(`Apakah Anda yakin ingin menghapus siswa dengan NISN ${nisn} dari database pusat?`)) {
        kirimPostAPI({ action: "hapusData", sheet: "Siswa", keyColumnIndex: 1, keyValue: nisn }, "Siswa Berhasil Dihapus.");
    }
}

function hapusJadwalPusat(idJadwal) {
    if(confirm(`Hapus Jadwal ${idJadwal}?`)) {
        kirimPostAPI({ action: "hapusData", sheet: "Jadwal", keyColumnIndex: 1, keyValue: idJadwal }, "Jadwal Berhasil Dihapus.");
    }
}

// Jembatan Universal untuk Pengiriman Perintah POST (Input/Hapus)
function kirimPostAPI(payload, pesanSukses) {
    fetch(URL_API, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(() => {
        alert(pesanSukses);
        ambilDatabasePusat(); // Muat ulang layar data
    })
    .catch(err => alert("Gagal melakukan operasi data: " + err));
}