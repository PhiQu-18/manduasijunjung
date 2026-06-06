/**
 * =========================================================================
 * LOGIC RUNTIME ENGINE - MAN 2 SIJUNJUNG SMART ENGINE V6 (PATCHED)
 * Fitur: Real Hardware Camera QR Scanner & Professional Dropdown Filtering
 * Integration: Dynamic Chart.js Analytics on Tab Jam Masuk
 * =========================================================================
 */
// Menyimpan daftar kode_unik siswa yang sedang dalam masa jeda (cooldown)
const siswaSedangCooldown = {};
const DURASI_JEDA_MS = 5000; // Jeda 5 Detik (Silakan ubah sesuai kebutuhan)

const API_URL = "https://script.google.com/macros/s/AKfycbxHDn7KSm8FsB17CVaaOAJAJbHPq1cCj4rFBjtzGrCIf8dn09FQtEPqJAJmhKBhDsvdGA/exec";
let html5QrcodeScanner = null; // Instance global untuk modul kamera hardware
let absensiChartInstance = null; // Instance global untuk Chart.js grafik absensi

document.addEventListener("DOMContentLoaded", function() {
    matikanSplashscreen();
    inisialisasiJamDigital();
    setupNavigasiTab();
    muatDatabaseAwal();
    registrasiFormEvent();
});

function matikanSplashscreen() {
    setTimeout(() => {
        const splash = document.getElementById("splash-screen");
        if (splash) {
            splash.style.opacity = "0";
            setTimeout(() => splash.style.visibility = "hidden", 600);
        }
    }, 2000);
}

function inisialisasiJamDigital() {
    const formatOpsi = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setInterval(() => {
        const kini = new Date();
        const elemenJam = document.getElementById("current-date");
        if (elemenJam) {
            elemenJam.innerText = kini.toLocaleDateString('id-ID', formatOpsi) + " | " + kini.toLocaleTimeString('id-ID') + " WIB";
        }
    }, 1000);
}

function setupNavigasiTab() {
    document.querySelectorAll(".nav-btn").forEach(tombol => {
        tombol.addEventListener("click", function() {
            document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            
            this.classList.add("active");
            const targetContent = document.getElementById(this.dataset.target);
            if (targetContent) {
                targetContent.classList.add("active");
            }
            
            // Penghematan daya baterai: otomatis matikan kamera jika user meninggalkan tab beranda
            if (this.dataset.target !== "tab-beranda" && html5QrcodeScanner) {
                matikanKameraSistem();
            }

            // TRIGGER GRAFIK: Jika user membuka tab pengaturan jam masuk, render ulang grafiknya
            if (this.dataset.target === "tab-jam") {
                kalkulasiDanRenderGrafikGlobal();
            }
        });
    });
}

// =========================================================================
// REAL CAMERA SCANNER MANAGEMENT (HTML5-QRCODE INTERACTION)
// =========================================================================

function toggleKameraHardware() {
    const btn = document.getElementById("btn-toggle-camera");
    if (!btn) return;
    
    if (html5QrcodeScanner === null) {
        btn.innerHTML = `<i class="fa-solid fa-stop"></i> Matikan Kamera`;
        btn.style.backgroundColor = "var(--danger-color)";
        
        html5QrcodeScanner = new Html5Qrcode("camera-reader");
        const qrCodeSuccessCallback = (decodedText, decodedResult) => {
            prosesKodeSiswaDitemukan(decodedText);
        };
        const config = { fps: 15, qrbox: { width: 220, height: 220 } };
        
        html5QrcodeScanner.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
        .catch(err => {
            alert("Gagal mengakses kamera hardware: " + err);
            matikanKameraSistem();
        });
    } else {
        matikanKameraSistem();
    }
}

function matikanKameraSistem() {
    const btn = document.getElementById("btn-toggle-camera");
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            html5QrcodeScanner = null;
            if (btn) {
                btn.innerHTML = `<i class="fa-solid fa-video"></i> Aktifkan Kamera`;
                btn.style.backgroundColor = "var(--accent-color)";
            }
            const containerKamera = document.getElementById("camera-reader");
            if (containerKamera) containerKamera.innerHTML = "";
        }).catch(err => console.error("Gagal menghentikan kamera", err));
    }
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
            localStorage.setItem("db_jam_masuk", JSON.stringify(formatJson.data.jam_masuk));
            localStorage.setItem("db_daftar_kelas", JSON.stringify(formatJson.data.daftar_kelas));
            localStorage.setItem("db_jadwal_pelajaran", JSON.stringify(formatJson.data.jadwal_pelajaran));
            localStorage.setItem("db_data_siswa", JSON.stringify(formatJson.data.data_siswa));
            localStorage.setItem("db_riwayat_absensi", JSON.stringify(formatJson.data.riwayat_absensi));
            
            tampilkanStatusCloud("Cloud Terhubung", "rgba(16, 185, 129, 0.2)");
            perbaruiTampilanSemuaTab();
        }
    } catch (err) {
        console.error(err);
        tampilkanStatusCloud("Koneksi Putus", "#ef4444");
        perbaruiTampilanSemuaTab();
    }
}

function perbaruiTampilanSemuaTab() {
    renderTabAturanJam();
    renderOpsiPilihanKelas();
    renderTabelMasterJadwalDanKelas();
    renderTabelSiswaDanRekapKumulatif();
    updateCounterAntreanLokal();
    jalankanPenyaringanMasterProfesional(); 
    kalkulasiDanRenderGrafikGlobal(); // Perbarui visualisasi data grafik
}

function tampilkanStatusCloud(pesan, warnaBg) {
    const label = document.getElementById("cloud-status");
    if (label) {
        label.innerHTML = `<i class="fa-solid fa-cloud"></i> ${pesan}`;
        label.style.backgroundColor = warnaBg;
    }
}

function updateCounterAntreanLokal() {
    const antrean = JSON.parse(localStorage.getItem("antrean_scan_lokal")) || [];
    const counter = document.getElementById("queue-count");
    if (counter) counter.innerText = antrean.length;
}

// =========================================================================
// PROCESS ABSENSI CORE RUNTIME
// =========================================================================

function registrasiFormEvent() {
    const btnKamera = document.getElementById("btn-toggle-camera");
    if (btnKamera) btnKamera.addEventListener("click", toggleKameraHardware);

    const btnSubmitScan = document.getElementById("btn-submit-scan");
    if (btnSubmitScan) {
        btnSubmitScan.addEventListener("click", () => {
            const inputField = document.getElementById("scan-manual-input");
            if (inputField) {
                prosesKodeSiswaDitemukan(inputField.value.trim());
                inputField.value = "";
            }
        });
    }
    
    const inputManual = document.getElementById("scan-manual-input");
    if (inputManual) {
        inputManual.addEventListener("keypress", (e) => {
            if (e.key === 'Enter') {
                prosesKodeSiswaDitemukan(e.target.value.trim());
                e.target.value = "";
            }
        });
    }

    const btnFlush = document.getElementById("btn-flush-database");
    if (btnFlush) btnFlush.addEventListener("click", sinkronisasiAntreanKeCloud);

    const filterSiswaKelas = document.getElementById("filter-siswa-kelas");
    if (filterSiswaKelas) filterSiswaKelas.addEventListener("change", renderTabelSiswaDanRekapKumulatif);
    
    const filterSiswaWaktu = document.getElementById("filter-siswa-waktu");
    if (filterSiswaWaktu) filterSiswaWaktu.addEventListener("change", renderTabelSiswaDanRekapKumulatif);
    
    const filterMasterKelas = document.getElementById("select-filter-master-kelas");
    if (filterMasterKelas) filterMasterKelas.addEventListener("change", jalankanPenyaringanMasterProfesional);
    
    const filterMasterHari = document.getElementById("select-filter-master-hari");
    if (filterMasterHari) filterMasterHari.addEventListener("change", jalankanPenyaringanMasterProfesional);

    const btnRefreshRekap = document.getElementById("btn-refresh-rekap");
    if (btnRefreshRekap) btnRefreshRekap.addEventListener("click", muatDatabaseAwal);

    const formJam = document.getElementById("form-jam-masuk");
    if (formJam) {
        formJam.addEventListener("submit", async function(e) {
            e.preventDefault();
            const payload = {
                action: "update_jam_masuk",
                jam_masuk: document.getElementById("input-jam-masuk").value,
                toleransi_telat: document.getElementById("input-toleransi").value
            };
            await postDataKeCloud(payload);
        });
    }

    const formKelas = document.getElementById("form-kelas");
    if (formKelas) {
        formKelas.addEventListener("submit", async function(e) {
            e.preventDefault();
            const payload = {
                action: "tambah_kelas",
                id_kelas: document.getElementById("input-id-kelas").value.toUpperCase(),
                nama_kelas: document.getElementById("input-nama-kelas").value
            };
            const berhasil = await postDataKeCloud(payload);
            if (berhasil) this.reset();
        });
    }

    const formJadwal = document.getElementById("form-jadwal");
    if (formJadwal) {
        formJadwal.addEventListener("submit", async function(e) {
            e.preventDefault();
            const payload = {
                action: "tambah_jadwal",
                id_kelas: document.getElementById("select-jadwal-kelas").value,
                hari: document.getElementById("select-jadwal-hari").value,
                mata_pelajaran: document.getElementById("input-jadwal-mapel").value,
                jam_mulai: document.getElementById("input-jadwal-mulai").value,
                jam_berakhir: document.getElementById("input-jadwal-selesai").value
            };
            const berhasil = await postDataKeCloud(payload);
            if (berhasil) this.reset();
        });
    }
}

function prosesKodeSiswaDitemukan(kodeUnik) {
    if (!kodeUnik) return;

    if (siswaSedangCooldown[kodeUnik]) {
        console.warn(`[JEDA] Kode Unik ${kodeUnik} baru saja melakukan scan. Mengabaikan scan beruntun.`);
        return; 
    }

    const siswaDaftar = JSON.parse(localStorage.getItem("db_data_siswa")) || [];
    const aturanJam = JSON.parse(localStorage.getItem("db_jam_masuk")) || [];
    const dataSiswa = siswaDaftar.find(s => s.kode_unik === kodeUnik);
    
    if (!dataSiswa) {
        alert(`❌ Error: Kode Unik "${kodeUnik}" tidak dikenali oleh sistem!`);
        return;
    }

    siswaSedangCooldown[kodeUnik] = true;
    setTimeout(() => {
        delete siswaSedangCooldown[kodeUnik];
    }, DURASI_JEDA_MS);

    const sekarang = new Date();
    const jamScanKini = kiniFormatJamMenit(sekarang);
    const tanggalHariIni = sekarang.toLocaleDateString('en-CA'); 

    const jamAturanMasuk = aturanJam[0] ? aturanJam[0].jam_masuk : "07:30";
    const jamAturanToleransi = aturanJam[0] ? aturanJam[0].toleransi_telat : "07:45";

    let statusHasil = "Terlambat";
    if (konversiMenitMurni(jamScanKini) <= konversiMenitMurni(jamAturanMasuk) || konversiMenitMurni(jamScanKini) <= konversiMenitMurni(jamAturanToleransi)) {
        statusHasil = "Tepat Waktu";
    }

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

    const feedBox = document.getElementById("feed-profile-view");
    if (feedBox) {
        const urlFoto = dataSiswa.foto_profil !== "-" ? dataSiswa.foto_profil : "https://via.placeholder.com/150";
        feedBox.innerHTML = `
            <div class="feed-active-card">
                <span class="feed-greet"><i class="fa-solid fa-mug-hot"></i> Selamat Pagi!</span>
                <img src="${urlFoto}" class="feed-avatar" alt="Profil">
                <h4 class="feed-name">${dataSiswa.nama_lengkap}</h4>
                <p class="feed-details">NISN: ${dataSiswa.nisn} | Kelas: <strong>${dataSiswa.kelas}</strong></p>
                <p style="margin-top:10px; font-weight:bold; color: ${statusHasil === 'Tepat Waktu' ? 'var(--success-color, #10b981)' : 'var(--danger-color, #ef4444)'}">
                    Status: ${statusHasil} (${jamScanKini} WIB)
                </p>
            </div>`;
    }
}

async function sinkronisasiAntreanKeCloud() {
    const antrean = JSON.parse(localStorage.getItem("antrean_scan_lokal")) || [];
    if (antrean.length === 0) return alert("Antrean kosong harian sudah bersih.");

    if (!confirm(`Sinkronisasi ${antrean.length} absensi siswa ke Cloud Server?`)) return;

    tampilkanStatusCloud("Mengupload Antrean...", "#f97316");
    let suksesCount = 0;
    
    for (let item of antrean) {
        try {
            const res = await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify({ action: "scan_absensi", kode_unik: item.kode_unik })
            });
            const r = await res.json();
            if (r.status === "success") suksesCount++;
        } catch (e) {
            console.error(e);
        }
    }

    alert(`Sinkronisasi Selesai! ${suksesCount} data berhasil dimasukkan ke Database Cloud.`);
    localStorage.setItem("antrean_scan_lokal", JSON.stringify([]));
    muatDatabaseAwal();
}

// =========================================================================
// REKAP TAB GENERATOR & PROFESSIONAL DROPDOWN FILTER
// =========================================================================

function renderTabelSiswaDanRekapKumulatif() {
    const tbody = document.getElementById("tbody-siswa-rekap");
    if (!tbody) return;
    tbody.innerHTML = "";

    const dataSiswa = JSON.parse(localStorage.getItem("db_data_siswa")) || [];
    const riwayatAbsen = JSON.parse(localStorage.getItem("db_riwayat_absensi")) || [];

    const filterKelas = document.getElementById("filter-siswa-kelas")?.value || "ALL";
    const filterWaktu = document.getElementById("filter-siswa-waktu")?.value || "ALL";

    dataSiswa.forEach(siswa => {
        if (filterKelas !== "ALL" && siswa.kelas !== filterKelas) return;

        let rekap = { tepat: 0, telat: 0, sakit: 0, izin: 0, alpha: 0 };

        riwayatAbsen.forEach(log => {
            if (log.kode_unik !== siswa.kode_unik) return;
            if (!validasiFilterWaktu(log.tanggal, filterWaktu)) return;

            if (log.status === "Tepat Waktu") rekap.tepat++;
            else if (log.status === "Terlambat") rekap.telat++;
            else if (log.status === "Sakit") rekap.sakit++;
            else if (log.status === "Izin") rekap.izin++;
            else if (log.status === "Alpha") rekap.alpha++;
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
                <td><i class="fa-solid fa-trash-can action-icon-del" onclick="hapusSiswaCloud(${siswa.row_index})"></i></td>
            </tr>`;
    });
}

function validasiFilterWaktu(tanggalString, tipeFilter) {
    if (tipeFilter === "ALL") return true;
    const dLog = new Date(tanggalString);
    const dKini = new Date();
    
    if (tipeFilter === "1W") return ((dKini - dLog) / (1000 * 60 * 60 * 24)) <= 7;
    if (tipeFilter === "1M") return dLog.getMonth() === dKini.getMonth() && dLog.getFullYear() === dKini.getFullYear();
    if (tipeFilter === "S1") return dLog.getMonth() >= 0 && dLog.getMonth() <= 5 && dLog.getFullYear() === dKini.getFullYear();
    if (tipeFilter === "S2") return dLog.getMonth() >= 6 && dLog.getMonth() <= 11 && dLog.getFullYear() === dKini.getFullYear();
    if (tipeFilter === "1Y") return dLog.getFullYear() === dKini.getFullYear();
    return true;
}

function jalankanPenyaringanMasterProfesional() {
    const filterKelasElemen = document.getElementById("select-filter-master-kelas");
    const filterHariElemen = document.getElementById("select-filter-master-hari");
    
    if (!filterKelasElemen || !filterHariElemen) return;
    
    const kelasTerpilih = filterKelasElemen.value;
    const hariTerpilih = filterHariElemen.value;

    document.querySelectorAll("#tbody-master-kelas tr").forEach(row => {
        const idKelasSisiTabel = row.getAttribute("data-kelas");
        if (!idKelasSisiTabel) return;
        
        if (kelasTerpilih === "ALL" || idKelasSisiTabel === kelasTerpilih) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });

    document.querySelectorAll("#tbody-master-jadwal tr").forEach(row => {
        const kelasSisiTabel = row.getAttribute("data-kelas");
        const hariSisiTabel = row.getAttribute("data-hari");
        
        if (!kelasSisiTabel || !hariSisiTabel) return;

        const cocokKelas = (kelasTerpilih === "ALL" || kelasSisiTabel === kelasTerpilih);
        const cocokHari = (hariTerpilih === "ALL" || hariSisiTabel === hariTerpilih);

        if (cocokKelas && cocokHari) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
}

// =========================================================================
// CORE ENGINE: DYNAMIC CHART RENDERING LOGIC
// =========================================================================

function kalkulasiDanRenderGrafikGlobal() {
    const canvas = document.getElementById("absensiChart");
    if (!canvas) return;

    const riwayatAbsen = JSON.parse(localStorage.getItem("db_riwayat_absensi")) || [];
    
    let totalRekap = { tepat: 0, telat: 0, sakit: 0, izin: 0, alpha: 0 };

    // Akumulasikan seluruh record riwayat absensi yang tersimpan di database lokal
    riwayatAbsen.forEach(log => {
        if (log.status === "Tepat Waktu") totalRekap.tepat++;
        else if (log.status === "Terlambat") totalRekap.telat++;
        else if (log.status === "Sakit") totalRekap.sakit++;
        else if (log.status === "Izin") totalRekap.izin++;
        else if (log.status === "Alpha") totalRekap.alpha++;
    });

    const ctx = canvas.getContext('2d');

    // Mencegah memory leak atau penumpukan render grafik lama saat data di-refresh
    if (absensiChartInstance) {
        absensiChartInstance.destroy();
    }

    // Pembuatan objek Chart menggunakan format Doughnut profesional
    absensiChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Tepat Waktu', 'Terlambat', 'Sakit', 'Izin', 'Alpha'],
            datasets: [{
                label: 'Total Rekapitulasi Sekolah',
                data: [totalRekap.tepat, totalRekap.telat, totalRekap.sakit, totalRekap.izin, totalRekap.alpha],
                backgroundColor: [
                    '#10b981', // Emerald Green (Tepat)
                    '#ef4444', // Red Rose (Telat)
                    '#0369a1', // Ocean Blue (Sakit)
                    '#b45309', // Amber Orange (Izin)
                    '#6b21a8'  // Deep Purple (Alpha)
                ],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { family: 'sans-serif', size: 12, weight: 'bold' },
                        padding: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            let nilai = context.raw || 0;
                            return ` ${label}: ${nilai} Kali Scan`;
                        }
                    }
                }
            }
        }
    });
}

// =========================================================================
// OPSI RENDER UTILITIES
// =========================================================================

function renderTabAturanJam() {
    const dataJam = JSON.parse(localStorage.getItem("db_jam_masuk")) || [];
    if (dataJam.length > 0) {
        const lblJam = document.getElementById("label-jam-aktif");
        const lblTol = document.getElementById("label-toleransi-aktif");
        const inpJam = document.getElementById("input-jam-masuk");
        const inpTol = document.getElementById("input-toleransi");
        
        if (lblJam) lblJam.innerHTML = `Jam Masuk Utama: <strong>${dataJam[0].jam_masuk}</strong> WIB`;
        if (lblTol) lblTol.innerHTML = `Batas Maksimal Toleransi: <strong>${dataJam[0].toleransi_telat}</strong> WIB`;
        if (inpJam) inpJam.value = dataJam[0].jam_masuk;
        if (inpTol) inpTol.value = dataJam[0].toleransi_telat;
    }
}

function renderOpsiPilihanKelas() {
    const listKelas = JSON.parse(localStorage.getItem("db_daftar_kelas")) || [];
    
    const filterSiswa = document.getElementById("filter-siswa-kelas");
    const selectJadwal = document.getElementById("select-jadwal-kelas");
    const filterMasterKelas = document.getElementById("select-filter-master-kelas");
    
    let htmlOpsi = '<option value="ALL">Semua Kelas</option>';
    let htmlForm = '';
    
    listKelas.forEach(k => {
        htmlOpsi += `<option value="${k.id_kelas}">${k.id_kelas}</option>`;
        htmlForm += `<option value="${k.id_kelas}">${k.id_kelas} - ${k.nama_kelas}</option>`;
    });
    
    if (filterSiswa) filterSiswa.innerHTML = htmlOpsi;
    if (filterMasterKelas) filterMasterKelas.innerHTML = htmlOpsi; 
    if (selectJadwal) selectJadwal.innerHTML = htmlForm;
}

function renderTabelMasterJadwalDanKelas() {
    const tKelas = document.getElementById("tbody-master-kelas");
    const tJadwal = document.getElementById("tbody-master-jadwal");
    if (!tKelas || !tJadwal) return;
    
    tKelas.innerHTML = ""; 
    tJadwal.innerHTML = "";
    
    const listKelas = JSON.parse(localStorage.getItem("db_daftar_kelas")) || [];
    const listJadwal = JSON.parse(localStorage.getItem("db_jadwal_pelajaran")) || [];

    listKelas.forEach(k => {
        tKelas.innerHTML += `
            <tr data-kelas="${k.id_kelas}">
                <td><strong>${k.id_kelas}</strong></td>
                <td>${k.nama_kelas}</td>
                <td><i class="fa-solid fa-trash" style="color:var(--danger-color); cursor:pointer;" onclick="hapusAksiUmum('hapus_kelas', ${k.row_index})"></i></td>
            </tr>`;
    });

    listJadwal.forEach(j => {
        tJadwal.innerHTML += `
            <tr data-kelas="${j.id_kelas}" data-hari="${j.hari}">
                <td><code>${j.id_kelas}</code></td>
                <td>${j.hari}</td>
                <td>${j.mata_pelajaran}</td>
                <td>${j.jam_mulai} - ${j.jam_berakhir}</td>
                <td><i class="fa-solid fa-trash" style="color:var(--danger-color); cursor:pointer;" onclick="hapusAksiUmum('hapus_jadwal', ${j.row_index})"></i></td>
            </tr>`;
    });
}

async function postDataKeCloud(payload) {
    tampilkanStatusCloud("Memproses Cloud...", "#f97316");
    try {
        const r = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
        const res = await r.json();
        alert(res.message);
        await muatDatabaseAwal();
        return true;
    } catch(e) { 
        alert("Operasi cloud gagal. Periksa koneksi internet."); 
        tampilkanStatusCloud("Koneksi Putus", "#ef4444");
        return false;
    }
}

async function hapusSiswaCloud(rowIndex) {
    if (confirm("Hapus data siswa permanen?")) {
        await postDataKeCloud({ action: "hapus_siswa", row_index: rowIndex });
    }
}

async function hapusAksiUmum(actionName, rowIndex) {
    if (confirm("Hapus data master?")) {
        await postDataKeCloud({ action: actionName, row_index: rowIndex });
    }
}

function kiniFormatJamMenit(d) {
    return String(d.getHours()).padStart(2, '0') + ":" + String(d.getMinutes()).padStart(2, '0');
}

function konversiMenitMurni(str) {
    if (!str || !str.includes(":")) return 0;
    const p = str.split(":");
    return (parseInt(p[0], 10) * 60) + parseInt(p[1], 10);
}