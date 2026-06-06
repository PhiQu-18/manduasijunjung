/**
 * =========================================================================
 * ENGINE CORE INTERKONEKSI UTAMA - HALAMAN SISWA (V4 - RUNTIME CLOUD)
 * MAN 2 Sijunjung Plus Keterampilan
 * =========================================================================
 */

// URL WEB APP GOOGLE APPS SCRIPT
const API_URL = "https://script.google.com/macros/s/AKfycbzJFRFhKghUg0hSytkGS4dAGSSKAI1YFmjDGAPPD7h1OjIKd4MbX8iyOjgGEO7jMMevaQ/exec";

// State Global Runtime Aplikasi
let sessionUser = null;
let databaseCloud = null;
let currentAuthTab = 'login';

// ==========================================
// 1. SISTEM ORKESTRASI SAAT PERTAMA DIMUAT (FIXED STUCK SPLASH)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const splash = document.getElementById("splash-screen");
    
    // Jalankan manajemen pemuatan data cloud secara aman
    setTimeout(async () => {
        try {
            showGlobalLoader("Menyinkronkan Basis Data Cloud...");
            
            // Mekanisme Race: Paksa batalkan loading jika dalam 8 detik Google Sheets tidak merespon
            await Promise.race([
                ambilDataMasterDariCloud(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Koneksi Google Sheets Timeout")), 8000))
            ]);

        } catch (err) {
            console.error("⚠️ Masalah sinkronisasi awal cloud:", err);
            alert("⚠️ Gagal terhubung ke Cloud secara cepat. Aplikasi beralih ke mode pemeriksaan sesi.");
        } finally {
            // JAMINAN UTAMA: Apapun yang terjadi (sukses/gagal), matikan semua loader agar web tidak freeze!
            hideGlobalLoader();
            if (splash) splash.style.display = "none";
        }

        // Jalankan percabangan tampilan setelah visual splash bersih
        tentukanTampilanHalamanSiswa();
    }, 2500);
});

// Fungsi Mandiri Pemutus Alur Halaman
function tentukanTampilanHalamanSiswa() {
    try {
        const savedUser = localStorage.getItem("remembered_siswa_m2spk");
        
        if (savedUser) {
            sessionUser = JSON.parse(savedUser);
            sinkronkanUlangSesiSiswa();
            renderHalamanUtamaAplikasi();
        } else {
            const authSection = document.getElementById("auth-section");
            if (authSection) authSection.style.display = "block";
        }
    } catch (e) {
        console.error("Gagal membaca struktur sesi lokal:", e);
        const authSection = document.getElementById("auth-section");
        if (authSection) authSection.style.display = "block";
    }
}

// Fungsi untuk menarik seluruh data (GET) dari server Sheets
async function ambilDataMasterDariCloud() {
    try {
        const response = await fetch(API_URL, { method: "GET" });
        const result = await response.json();
        if (result.status === "success") {
            databaseCloud = result.data;
            console.log("☁️ Data Cloud Tersinkron:", databaseCloud);
            populasiDropdownKelas();
        } else {
            console.warn("Server Sheets mengirim status gagal:", result.message);
        }
    } catch (err) {
        console.error("Eror fatal fungsi fetch GET:", err);
        throw err; // Lempar kembali ke Promise.race pembungkus
    }
}

function populasiDropdownKelas() {
    const selectKelas = document.getElementById("setup-kelas");
    if (!selectKelas || !databaseCloud || !databaseCloud.daftar_kelas) return;
    
    selectKelas.innerHTML = '<option value="">-- Pilih Kelas Anda --</option>';
    
    databaseCloud.daftar_kelas.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.nama_kelas;
        opt.innerText = item.nama_kelas;
        selectKelas.appendChild(opt);
    });
}

function sinkronkanUlangSesiSiswa() {
    if (!databaseCloud || !sessionUser) return;
    const dataTerbaru = databaseCloud.data_siswa.find(
        s => s.nisn.toString() === sessionUser.nisn.toString()
    );
    if (dataTerbaru) {
        sessionUser = dataTerbaru;
        if(localStorage.getItem("remembered_siswa_m2spk")) {
            localStorage.setItem("remembered_siswa_m2spk", JSON.stringify(sessionUser));
        }
    }
}

// ==========================================
// 2. OTENTIKASI (LOGIN & DAFTAR) HANDLER
// ==========================================
function switchAuthTab(tabMode) {
    currentAuthTab = tabMode;
    const loginForm = document.getElementById("form-login");
    const regForm = document.getElementById("form-register");
    const loginTabBtn = document.getElementById("tab-login-btn");
    const regTabBtn = document.getElementById("tab-register-btn");

    if (!loginForm || !regForm || !loginTabBtn || !regTabBtn) return;

    if (tabMode === 'login') {
        loginForm.style.display = "block";
        regForm.style.display = "none";
        loginTabBtn.classList.add("active");
        regTabBtn.classList.remove("active");
    } else {
        loginForm.style.display = "none";
        regForm.style.display = "block";
        loginTabBtn.classList.remove("active");
        regTabBtn.classList.add("active");
    }
}

function togglePasswordVisibility(inputId, buttonElement) {
    const input = document.getElementById(inputId);
    if (!input || !buttonElement) return;
    const icon = buttonElement.querySelector("i");
    if (input.type === "password") {
        input.type = "text";
        if (icon) icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        input.type = "password";
        if (icon) icon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

async function handleRegister(event) {
    event.preventDefault();
    if (!databaseCloud) {
        alert("⚠️ Sinkronisasi data cloud gagal atau belum selesai. Cek jaringan Anda.");
        return;
    }

    const inputNisn = document.getElementById("reg-nisn").value.trim();
    const inputHp = document.getElementById("reg-hp").value.trim();

    const cekSiswaExist = databaseCloud.data_siswa.find(s => s.nisn.toString() === inputNisn);
    if (cekSiswaExist) {
        alert("⚠️ NISN tersebut sudah terdaftar di cloud. Silakan langsung gunakan menu MASUK.");
        switchAuthTab('login');
        const loginNisnField = document.getElementById("login-nisn");
        if (loginNisnField) loginNisnField.value = inputNisn;
        return;
    }

    const authSec = document.getElementById("auth-section");
    const profSec = document.getElementById("profile-completion-section");
    
    if (authSec) authSec.style.display = "none";
    if (profSec) profSec.style.display = "block";
    
    document.getElementById("setup-nisn").value = inputNisn;
    document.getElementById("setup-hp").value = inputHp;
}

async function handleLogin(event) {
    event.preventDefault();
    if (!databaseCloud) {
        alert("⚠️ Aplikasi berjalan tanpa pangkalan data cloud. Autentikasi ditolak.");
        return;
    }

    const inputNisn = document.getElementById("login-nisn").value.trim();
    const inputHp = document.getElementById("login-pwd").value.trim();
    const rememberMeCheck = document.getElementById("login-remember").checked;

    const userTerotentikasi = databaseCloud.data_siswa.find(
        s => s.nisn.toString() === inputNisn && s.nomor_hp.toString() === inputHp
    );

    if (userTerotentikasi) {
        sessionUser = userTerotentikasi;
        if (rememberMeCheck) {
            localStorage.setItem("remembered_siswa_m2spk", JSON.stringify(sessionUser));
        }
        renderHalamanUtamaAplikasi();
    } else {
        alert("❌ Gagal Masuk: Kombinasi NISN & No HP salah, atau profil Anda belum aktif!");
    }
}

// ==========================================
// 3. FITUR LENGKAPI DATA PROFIL
// ==========================================
function triggerDeviceGallery() {
    const input = document.getElementById("file-hidden-input");
    if (input) {
        input.removeAttribute("capture");
        input.click();
    }
}

function openSelfieCamera() {
    const input = document.getElementById("file-hidden-input");
    if (input) {
        input.setAttribute("capture", "user");
        input.click();
    }
}

function previewFileImage(inputElement) {
    const file = inputElement.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const view = document.getElementById("selfie-img-view");
            if (view) view.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

async function saveCompleteProfile(event) {
    event.preventDefault();
    showGlobalLoader("Menyimpan Dokumen & Membuat Kode Unik...");

    const payloadSiswaBaru = {
        action: "tambah_siswa",
        nama_lengkap: document.getElementById("setup-nama").value.trim(),
        nisn: document.getElementById("setup-nisn").value.trim(),
        nomor_hp: document.getElementById("setup-hp").value.trim(),
        kelas: document.getElementById("setup-kelas").value,
        foto_profil: document.getElementById("selfie-img-view").src
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(payloadSiswaBaru)
        });
        
        const result = await response.json();
        
        if (result.status === "success") {
            alert(`🎉 Registrasi Berhasil!\nKode Unik Kartu Anda: ${result.kode_unik}`);
            await ambilDataMasterDariCloud();
            sessionUser = databaseCloud.data_siswa.find(s => s.nisn.toString() === payloadSiswaBaru.nisn);
            localStorage.setItem("remembered_siswa_m2spk", JSON.stringify(sessionUser));
            renderHalamanUtamaAplikasi();
        } else {
            alert("❌ Penolakan Cloud: " + result.message);
        }
    } catch (error) {
        console.error(error);
        alert("❌ Terjadi gangguan internal pengiriman data cloud.");
    } finally {
        hideGlobalLoader();
    }
}

// ==========================================
// 4. PENANGANAN LAYOUT & RENDERING VIEW UTAMA
// ==========================================
function renderHalamanUtamaAplikasi() {
    document.getElementById("auth-section").style.display = "none";
    document.getElementById("profile-completion-section").style.display = "none";
    document.getElementById("main-app-section").style.display = "block";

    document.getElementById("user-display-top").innerText = sessionUser.nama_lengkap;
    document.getElementById("card-front-nama").innerText = sessionUser.nama_lengkap.toUpperCase();
    document.getElementById("card-front-nisn").innerText = sessionUser.nisn;
    document.getElementById("card-front-kelas").innerText = sessionUser.kelas;
    document.getElementById("card-front-hp").innerText = sessionUser.nomor_hp;

    const avatarSrc = sessionUser.foto_profil && sessionUser.foto_profil !== "-" ? sessionUser.foto_profil : "https://via.placeholder.com/150";
    document.getElementById("card-front-img").src = avatarSrc;

    const nilaiQR = sessionUser.kode_unik || sessionUser.nisn;
    document.getElementById("card-back-qr").src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${nilaiQR}&ecc=H`;
    document.getElementById("card-back-code").innerText = nilaiQR;

    prosesDanRenderRekapPribadi();
    navigateToPage(1);
}

// ==========================================
// 5. FITUR ABSENSI MANDIRI (IZIN / SAKIT)
// ==========================================
async function submitAbsenMandiri(event) {
    event.preventDefault();
    if (!sessionUser) return;

    showGlobalLoader("Mengirim Berkas Lampiran...");

    const payloadAbsen = {
        action: "input_ketidakhadiran",
        kode_unik: sessionUser.kode_unik,
        status: document.getElementById("absensi-jenis").value,
        bukti_status: document.getElementById("absensi-bukti-link").value.trim()
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(payloadAbsen)
        });
        
        const result = await response.json();
        if (result.status === "success") {
            alert(`✅ Pelaporan status "${payloadAbsen.status}" sukses tercatat di pangkalan data.`);
            document.getElementById("absensi-alasan").value = "";
            document.getElementById("absensi-bukti-link").value = "";
            
            await ambilDataMasterDariCloud();
            prosesDanRenderRekapPribadi();
        } else {
            alert("❌ Cloud menolak: " + result.message);
        }
    } catch (err) {
        console.error(err);
        alert("❌ Gagal terhubung ke server cloud absensi.");
    } finally {
        hideGlobalLoader();
    }
}

// ==========================================
// 6. ENGINE KOMPUTASI & RENDERING REKAP SISWA
// ==========================================
function prosesDanRenderRekapPribadi() {
    const wadahTabel = document.getElementById("rekap-list-container");
    if (!wadahTabel) return;

    wadahTabel.innerHTML = "";

    let totalHadir = 0, totalTelat = 0, totalSakit = 0, totalIzin = 0, totalAlpha = 0;

    if (!databaseCloud || !databaseCloud.riwayat_absensi) {
        wadahTabel.innerHTML = `<tr><td colspan="3" class="text-center text-muted">Belum ada catatan absensi.</td></tr>`;
        return;
    }

    const riwayatSiswaAktif = databaseCloud.riwayat_absensi.filter(
        item => item.kode_unik === sessionUser.kode_unik
    ).reverse();

    if (riwayatSiswaAktif.length === 0) {
        wadahTabel.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4">Tidak ada log data kehadiran.</td></tr>`;
        updateVisualSummaryBoxes(0, 0, 0, 0, 0);
        return;
    }

    riwayatSiswaAktif.forEach(item => {
        let badgeStyle = "bg-danger";
        
        switch (item.status) {
            case "Tepat Waktu": badgeStyle = "bg-success"; totalHadir++; break;
            case "Terlambat": badgeStyle = "bg-warning text-dark"; totalTelat++; break;
            case "Sakit": badgeStyle = "bg-info text-dark"; totalSakit++; break;
            case "Izin": badgeStyle = "bg-primary"; totalIzin++; break;
            case "Alpha": badgeStyle = "bg-danger"; totalAlpha++; break;
        }

        const baris = document.createElement("tr");
        baris.innerHTML = `
            <td class="fw-bold text-secondary">${formatFormatTanggalId(item.tanggal)}</td>
            <td class="fw-mono">${item.jam_scan} WIB</td>
            <td><span class="badge ${badgeStyle}">${item.status}</span></td>
        `;
        wadahTabel.appendChild(baris);
    });

    updateVisualSummaryBoxes(totalHadir, totalTelat, totalSakit, totalIzin, totalAlpha);
}

function updateVisualSummaryBoxes(h, t, s, i, a) {
    const elH = document.getElementById("summary-hadir");
    const elT = document.getElementById("summary-telat");
    const elS = document.getElementById("summary-sakit");
    const elI = document.getElementById("summary-izin");
    const elA = document.getElementById("summary-alpha");

    if (elH) elH.innerText = h;
    if (elT) elT.innerText = t;
    if (elS) elS.innerText = s;
    if (elI) elI.innerText = i;
    if (elA) elA.innerText = a;
}

function formatFormatTanggalId(stringTanggal) {
    if (!stringTanggal || stringTanggal === "-") return "-";
    try {
        const opsi = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(stringTanggal).toLocaleDateString('id-ID', opsi);
    } catch(e) {
        return stringTanggal;
    }
}

// ==========================================
// 7. UTILITIES NAVIGATION CONTROL UI
// ==========================================
function navigateToPage(pageIndex) {
    const swiper = document.getElementById('pages-swiper');
    if (!swiper) return;

    const btnAbsen = document.getElementById('btn-nav-absen');
    const btnHome = document.getElementById('btn-nav-home');
    const btnRekap = document.getElementById('btn-nav-rekap');

    if (btnAbsen) btnAbsen.classList.remove('active');
    if (btnHome) btnHome.classList.remove('active');
    if (btnRekap) btnRekap.classList.remove('active');

    if (pageIndex === 0) {
        swiper.style.transform = 'translateX(0%)';
        if (btnAbsen) btnAbsen.classList.add('active');
    } else if (pageIndex === 1) {
        swiper.style.transform = 'translateX(-33.333%)';
        if (btnHome) btnHome.classList.add('active');
    } else if (pageIndex === 2) {
        swiper.style.transform = 'translateX(-66.666%)';
        if (btnRekap) btnRekap.classList.add('active');
    }
}

function toggleCardFlip(cardWrapperElement) {
    if (cardWrapperElement) cardWrapperElement.classList.toggle('flipped');
}

function logoutProcess() {
    if (confirm("Apakah Anda yakin ingin keluar dari Akun Siswa MAN 2 Sijunjung?")) {
        localStorage.removeItem("remembered_siswa_m2spk");
        sessionUser = null;
        location.reload();
    }
}

function showGlobalLoader(pesanTeks) {
    const loader = document.getElementById("global-cloud-loader");
    const text = document.getElementById("loader-text");
    if (loader && text) {
        text.innerText = pesanTeks;
        loader.style.display = "flex";
    }
}

function hideGlobalLoader() {
    const loader = document.getElementById("global-cloud-loader");
    if (loader) loader.style.display = "none";
}