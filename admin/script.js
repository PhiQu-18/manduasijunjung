/**
 * =========================================================================
 * LOGIC RUNTIME ENGINE - MAN 2 SIJUNJUNG SMART ENGINE V5
 * Fitur: Splashscreen, Offline Storage Cache, Multi-filter Waktu, Rekap Lokal
 * =========================================================================
 */

// Taruh URL Deployment Web App Google Apps Script Anda di sini
const API_URL = "https://script.google.com/macros/s/AKfycbzGIPmW2lCPl8qEOPq76NGik56LF2A6fenpPzTpuGqwtzJ6AsuEafz2EJbmpc1OoqqLcg/exec";

document.addEventListener("DOMContentLoaded", function() {
    matikanSplashscreen();
    inisialisasiJamDigital();
    setupNavigasiTab();
    muatDatabaseAwal();
    registrasiFormEvent();
});

// 1. SPLASHSCREEN REMOVAL ANIMATION
function matikanSplashscreen() {
    setTimeout(() => {
        const splash = document.getElementById("splash-screen");
        splash.style.opacity = "0";
        setTimeout(() => splash.style.visibility = "hidden", 600);
    }, 2000); // Tampil interaktif selama 2 detik
}

// 2. LIVE CLOCK SYSTEM
function inisialisasiJamDigital() {
    const formatOpsi = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setInterval(() => {
        const kini = new Date();
        document.getElementById("current-date").innerText = kini.toLocaleDateString('id-ID', formatOpsi) + " | " + kini.toLocaleTimeString('id-ID') + " WIB";
    }, 1000);
}

// 3. SWITCHING TAB VIEW PANEL
function setupNavigasiTab() {
    document.querySelectorAll(".nav-btn").forEach(tombol => {
        tombol.addEventListener("click", function() {
            document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            this.classList.add("active");
            document.getElementById(this.dataset.target).classList.add("active");
        });
    });
}

// =========================================================================
// OFFLINE INTEGRATION & CORE SYNC LOCALSTORAGE
// =========================================================================

async function muatDatabaseAwal() {
    tampilkanStatusCloud("Mendownload Data...", "#f97316");
    try {
        const res = await fetch(API_URL);
        const formatJson = await res.json();
        
        if (formatJson.status === "success") {
            // DOWNLOAD TOTAL DATA GOOGLE SHEET SEBAGAI LOCAL STORAGE CACHE BERKECEPATAN TINGGI
            localStorage.setItem("db_jam_masuk", JSON.stringify(formatJson.data.jam_masuk));
            localStorage.setItem("db_daftar_kelas", JSON.stringify(formatJson.data.daftar_kelas));
            localStorage.setItem("db_jadwal_pelajaran", JSON.stringify(formatJson.data.jadwal_pelajaran));
            localStorage.setItem("db_data_siswa", JSON.stringify(formatJson.data.data_siswa));
            localStorage.setItem("db_riwayat_absensi", JSON.stringify(formatJson.data.riwayat_absensi));
            
            tampilkanStatusCloud("Cloud Terhubung", "rgba(255,255,255,0.2)");
            perbaruiTampilanSemuaTab();
        }
    } catch (err) {
        console.error(err);
        tampilkanStatusCloud("Koneksi Putus", "#ef4444");
        // Jika offline, sistem otomatis memakai cache LocalStorage sebelumnya agar operasional scan tidak macet
        perbaruiTampilanSemuaTab();
    }
}

function perbaruiTampilanSemuaTab() {
    renderTabAturanJam();
    renderOpsiPilihanKelas();
    renderTabelMasterJadwalDanKelas();
    renderTabelSiswaDanRekapKumulatif();
    updateCounterAntreanLokal();
}

function tampilkanStatusCloud(pesan, warnaBg) {
    const label = document.getElementById("cloud-status");
    label.innerHTML = `<i class="fa-solid fa-cloud"></i> ${pesan}`;
    label.style.backgroundColor = warnaBg;
}

function updateCounterAntreanLokal() {
    const antrean = JSON.parse(localStorage.getItem("antrean_scan_lokal")) || [];
    document.getElementById("queue-count").innerText = antrean.length;
}

// =========================================================================
// LOGIKA ABSENSI PAGI HARI (TAB 1: BERANDA)
// =========================================================================

function registrasiFormEvent() {
    // Tombol Toggle Aktifkan Kamera simulasi
    let kameraAktif = false;
    document.getElementById("btn-toggle-camera").addEventListener("click", function() {
        kameraAktif = !kameraAktif;
        const box = document.getElementById("camera-viewport");
        if(kameraAktif) {
            this.innerHTML = `<i class="fa-solid fa-stop"></i> Matikan Kamera`;
            this.style.backgroundColor = "var(--danger)";
            box.innerHTML = `<div style="color:#22c55e;"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:3rem;"></i><p style="margin-top:10px;">Lensa Scanner Kamera Aktif & Siap Membaca...</p></div>`;
        } else {
            this.innerHTML = `<i class="fa-solid fa-power-off"></i> Aktifkan Kamera`;
            this.style.backgroundColor = "var(--accent)";
            box.innerHTML = `<div class="camera-placeholder"><i class="fa-solid fa-video-slash"></i><p>Kamera Dinonaktifkan</p></div>`;
        }
    });

    // Handle Eksekusi Trigger Scan Kartu Siswa
    document.getElementById("btn-submit-scan").addEventListener("click", jalankanScanProses);
    document.getElementById("scan-manual-input").addEventListener("keypress", (e) => {
        if(e.key === 'Enter') jalankanScanProses();
    });

    // Kirim Koleksi Data Lokal Ke Cloud Database Server
    document.getElementById("btn-flush-database").addEventListener("click", sinkronisasiAntreanKeCloud);

    // Filter Listeners
    document.getElementById("filter-siswa-kelas").addEventListener("change", renderTabelSiswaDanRekapKumulatif);
    document.getElementById("filter-siswa-waktu").addEventListener("change", renderTabelSiswaDanRekapKumulatif);
    document.getElementById("search-master-input").addEventListener("input", filterTabelMasterKelasJadwal);

    // Aturan Jam Masuk Submit
    document.getElementById("form-jam-masuk").addEventListener("submit", async function(e) {
        e.preventDefault();
        const payload = {
            action: "update_jam_masuk",
            jam_masuk: document.getElementById("input-jam-masuk").value,
            toleransi_telat: document.getElementById("input-toleransi").value
        };
        await postDataKeCloud(payload);
    });

    // Form Tambah Kelas
    document.getElementById("form-kelas").addEventListener("submit", async function(e) {
        e.preventDefault();
        const payload = {
            action: "tambah_kelas",
            id_kelas: document.getElementById("input-id-kelas").value.toUpperCase(),
            nama_kelas: document.getElementById("input-nama-kelas").value
        };
        await postDataKeCloud(payload);
        this.reset();
    });

    // Form Tambah Jadwal
    document.getElementById("form-jadwal").addEventListener("submit", async function(e) {
        e.preventDefault();
        const payload = {
            action: "tambah_jadwal",
            id_kelas: document.getElementById("select-jadwal-kelas").value,
            hari: document.getElementById("select-jadwal-hari").value,
            mata_pelajaran: document.getElementById("input-jadwal-mapel").value,
            jam_mulai: document.getElementById("input-jadwal-mulai").value,
            jam_berakhir: document.getElementById("input-jadwal-selesai").value
        };
        await postDataKeCloud(payload);
        this.reset();
    });
}

function jalankanScanProses() {
    const inputField = document.getElementById("scan-manual-input");
    const kodeUnik = inputField.value.trim();
    if(!kodeUnik) return alert("Silakan tempelkan kartu atau masukkan kode unik siswa!");

    // Ambil basis data siswa lokal cache
    const siswaDaftar = JSON.parse(localStorage.getItem("db_data_siswa")) || [];
    const aturanJam = JSON.parse(localStorage.getItem("db_jam_masuk")) || [];

    const dataSiswa = siswaDaftar.find(s => s.kode_unik === kodeUnik);
    if(!dataSiswa) {
        alert("Fatal Error: Kode Kartu Siswa Tidak Terdaftar Di Database!");
        inputField.value = "";
        return;
    }

    // Kalkulasi Status Detil Jam Menggunakan Rumus Menit Presisi
    const sekarang = new Date();
    const jamScanKini = kiniFormatJamMenit(sekarang);
    const tanggalHariIni = sekarang.toISOString().split('T')[0];

    const jamAturanMasuk = aturanJam[0] ? aturanJam[0].jam_masuk : "07:30";
    const jamAturanToleransi = aturanJam[0] ? aturanJam[0].toleransi_telat : "07:45";

    let statusHasil = "Terlambat";
    if (konversiMenitMurni(jamScanKini) <= konversiMenitMurni(jamAturanMasuk) || konversiMenitMurni(jamScanKini) <= konversiMenitMurni(jamAturanToleransi)) {
        statusHasil = "Tepat Waktu";
    }

    // SIMPAN DATA SEMENTARA DI LOCALSTORAGE AGAR PROSES SCAN PAGI BERJALAN INSTAN < 1 MILIDETIK
    const antreanScan = JSON.parse(localStorage.getItem("antrean_scan_lokal")) || [];
    antreanScan.push({
        tanggal: tanggalHariIni,
        kode_unik: kodeUnik,
        jam_scan: jamScanKini,
        status: statusHasil,
        bukti_status: "-"
    });
    localStorage.setItem("antrean_scan_lokal", JSON.stringify(antreanScan));
    updateCounterAntreanLokal();

    // UPDATE FEED PANEL SEBELAH KANAN SECARA INTERAKTIF
    const feedBox = document.getElementById("feed-profile-view");
    const urlFoto = dataSiswa.foto_profil !== "-" ? dataSiswa.foto_profil : "https://via.placeholder.com/150";
    
    feedBox.innerHTML = `
        <div class="feed-active-card">
            <span class="feed-greet"><i class="fa-solid fa-circle-check"></i> Berhasil Discan Lokal</span>
            <img src="${urlFoto}" class="feed-avatar" alt="Profil">
            <h4 class="feed-name">${dataSiswa.nama_lengkap}</h4>
            <p class="feed-details">NISN: ${dataSiswa.nisn} | Kelas: <strong>${dataSiswa.kelas}</strong></p>
            <p style="margin-top:10px; font-weight:bold; color: ${statusHasil === 'Tepat Waktu' ? 'var(--success)' : 'var(--danger)'}">
                Status Jam Scan: ${jamScanKini} (${statusHasil})
            </p>
        </div>`;

    inputField.value = "";
}

async function sinkronisasiAntreanKeCloud() {
    const antrean = JSON.parse(localStorage.getItem("antrean_scan_lokal")) || [];
    if(antrean.length === 0) return alert("Antrean kosong. Tidak ada data scan baru untuk dimasukkan.");

    if(!confirm(`Anda akan mengunggah sekaligus ${antrean.length} data scan ke server cloud. Lanjutkan?`)) return;

    tampilkanStatusCloud("Mengupload Antrean...", "#f97316");
    
    let suksesCount = 0;
    for(let item of antrean) {
        try {
            const res = await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify({
                    action: "scan_absensi",
                    kode_unik: item.kode_unik
                })
            });
            const r = await res.json();
            if(r.status === "success") suksesCount++;
        } catch(e) {
            console.error("Gagal sinkron baris: ", item);
        }
    }

    alert(`Proses Selesai. Berhasil memasukkan ${suksesCount} dari ${antrean.length} data absensi harian.`);
    localStorage.setItem("antrean_scan_lokal", JSON.stringify([])); // Kosongkan antrean lokal
    muatDatabaseAwal(); // Tarik database baru dari cloud
}

// =========================================================================
// RENDER DATA SISWA & REKAP TAB (DENGAN FILTER WAKTU SANGAT LENGKAP)
// =========================================================================

function renderTabelSiswaDanRekapKumulatif() {
    const tbody = document.getElementById("tbody-siswa-rekap");
    tbody.innerHTML = "";

    const dataSiswa = JSON.parse(localStorage.getItem("db_data_siswa")) || [];
    const riwayatAbsen = JSON.parse(localStorage.getItem("db_riwayat_absensi")) || [];

    const filterKelas = document.getElementById("filter-siswa-kelas").value;
    const filterWaktu = document.getElementById("filter-siswa-waktu").value;

    dataSiswa.forEach(siswa => {
        // Filter Berdasarkan Kelas
        if(filterKelas !== "ALL" && siswa.kelas !== filterKelas) return;

        // Hitung Kumulatif Rekapitulasi Berdasarkan Filter Waktu Dinamis
        let rekap = { tepat: 0, telat: 0, sakit: 0, izin: 0, alpha: 0 };

        riwayatAbsen.forEach(log => {
            if(log.kode_unik !== siswa.kode_unik) return;
            if(!validasiFilterWaktu(log.tanggal, filterWaktu)) return;

            if(log.status === "Tepat Waktu") rekap.tepat++;
            else if(log.status === "Terlambat") rekap.telat++;
            else if(log.status === "Sakit") rekap.sakit++;
            else if(log.status === "Izin") rekap.izin++;
            else if(log.status === "Alpha") rekap.alpha++;
        });

        const ava = siswa.foto_profil !== "-" ? siswa.foto_profil : "https://via.placeholder.com/150";

        tbody.innerHTML += `
            <tr>
                <td><img src="${ava}" class="row-avatar" alt="img"></td>
                <td><code>${siswa.kode_unik}</code></td>
                <td><strong>${siswa.nama_lengkap}</strong></td>
                <td>${siswa.nisn}</td>
                <td>${siswa.kelas}</td>
                <td class="text-center font-bold text-success">${rekap.tepat}</td>
                <td class="text-center font-bold text-danger">${rekap.telat}</td>
                <td class="text-center font-bold" style="color:#0369a1">${rekap.sakit}</td>
                <td class="text-center font-bold" style="color:#b45309">${rekap.izin}</td>
                <td class="text-center font-bold" style="color:#6b21a8">${rekap.alpha}</td>
                <td>
                    <i class="fa-solid fa-trash-can action-icon-del" onclick="hapusSiswaCloud(${siswa.row_index})"></i>
                </td>
            </tr>`;
    });
}

function validasiFilterWaktu(tanggalString, tipeFilter) {
    if(tipeFilter === "ALL") return true;
    
    const dLog = new Date(tanggalString);
    const dKini = new Date();
    
    if(tipeFilter === "1W") {
        const selisihHari = (dKini - dLog) / (1000 * 60 * 60 * 24);
        return selisihHari <= 7;
    }
    if(tipeFilter === "1M") {
        return dLog.getMonth() === dKini.getMonth() && dLog.getFullYear() === dKini.getFullYear();
    }
    if(tipeFilter === "S1") {
        return dLog.getMonth() >= 0 && dLog.getMonth() <= 5 && dLog.getFullYear() === dKini.getFullYear();
    }
    if(tipeFilter === "S2") {
        return dLog.getMonth() >= 6 && dLog.getMonth() <= 11 && dLog.getFullYear() === dKini.getFullYear();
    }
    if(tipeFilter === "1Y") {
        return dLog.getFullYear() === dKini.getFullYear();
    }
    return true;
}

// =========================================================================
// LAIN-LAIN / RENDER UTILITY RENDERING FUNCTIONS
// =========================================================================

function renderTabAturanJam() {
    const dataJam = JSON.parse(localStorage.getItem("db_jam_masuk")) || [];
    if(dataJam.length > 0) {
        document.getElementById("label-jam-aktif").innerHTML = `Jam Masuk Utama: <strong>${dataJam[0].jam_masuk}</strong> WIB`;
        document.getElementById("label-toleransi-aktif").innerHTML = `Batas Maksimal Toleransi: <strong>${dataJam[0].toleransi_telat}</strong> WIB`;
        document.getElementById("input-jam-masuk").value = dataJam[0].jam_masuk;
        document.getElementById("input-toleransi").value = dataJam[0].toleransi_telat;
    }
}

function renderOpsiPilihanKelas() {
    const listKelas = JSON.parse(localStorage.getItem("db_daftar_kelas")) || [];
    const selectFilter = document.getElementById("filter-siswa-kelas");
    const selectJadwal = document.getElementById("select-jadwal-kelas");
    
    let filterHtml = '<option value="ALL">Semua Kelas</option>';
    let formHtml = '';
    
    listKelas.forEach(k => {
        filterHtml += `<option value="${k.id_kelas}">${k.id_kelas}</option>`;
        formHtml += `<option value="${k.id_kelas}">${k.id_kelas} - ${k.nama_kelas}</option>`;
    });
    selectFilter.innerHTML = filterHtml;
    selectJadwal.innerHTML = formHtml;
}

function renderTabelMasterJadwalDanKelas() {
    const tKelas = document.getElementById("tbody-master-kelas");
    const tJadwal = document.getElementById("tbody-master-jadwal");
    
    tKelas.innerHTML = ""; tJadwal.innerHTML = "";
    
    const listKelas = JSON.parse(localStorage.getItem("db_daftar_kelas")) || [];
    const listJadwal = JSON.parse(localStorage.getItem("db_jadwal_pelajaran")) || [];

    listKelas.forEach(k => {
        tKelas.innerHTML += `<tr><td><strong>${k.id_kelas}</strong></td><td>${k.nama_kelas}</td><td><i class="fa-solid fa-trash" style="color:var(--danger); cursor:pointer;" onclick="hapusAksiUmum('hapus_kelas', ${k.row_index})"></i></td></tr>`;
    });

    listJadwal.forEach(j => {
        tJadwal.innerHTML += `<tr><td><code>${j.id_kelas}</code></td><td>${j.hari}</td><td>${j.mata_pelajaran}</td><td>${j.jam_mulai} - ${j.jam_berakhir}</td><td><i class="fa-solid fa-trash" style="color:var(--danger); cursor:pointer;" onclick="hapusAksiUmum('hapus_jadwal', ${j.row_index})"></i></td></tr>`;
    });
}

function filterTabelMasterKelasJadwal() {
    const keyword = document.getElementById("search-master-input").value.toLowerCase();
    
    // Pencarian instan baris tabel kelas
    document.querySelectorAll("#tbody-master-kelas tr").forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(keyword) ? "" : "none";
    });
    // Pencarian instan baris tabel jadwal pelajaran
    document.querySelectorAll("#tbody-master-jadwal tr").forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(keyword) ? "" : "none";
    });
}

// HELPER PARSING & CLOUD POST
async function postDataKeCloud(payload) {
    try {
        const r = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
        const res = await r.json();
        alert(res.message);
        muatDatabaseAwal();
    } catch(e) { alert("Operasi cloud gagal."); }
}

async function hapusSiswaCloud(rowIndex) {
    if(confirm("Hapus permanen data siswa ini dari cloud database?")) {
        await postDataKeCloud({ action: "hapus_siswa", row_index: rowIndex });
    }
}

async function hapusAksiUmum(actionName, rowIndex) {
    if(confirm("Hapus data master terpilih?")) {
        await postDataKeCloud({ action: actionName, row_index: rowIndex });
    }
}

function kiniFormatJamMenit(d) {
    return String(d.getHours()).padStart(2, '0') + ":" + String(d.getMinutes()).padStart(2, '0');
}

function konversiMenitMurni(str) {
    const p = str.split(":");
    return (parseInt(p[0], 10) * 60) + parseInt(p[1], 10);
}