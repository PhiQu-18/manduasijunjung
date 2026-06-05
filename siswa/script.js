/**
 * =========================================================================
 * ENGINE CORE INTERKONEKSI UTAMA - HALAMAN SISWA (V4 - RUNTIME CLOUD)
 * MAN 2 Sijunjung Plus Keterampilan
 * =========================================================================
 */

// !!! GANTI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA YANG SUDAH DI-DEPLOY !!!
const API_URL = "https://script.google.com/macros/s/AKfycbzGIPmW2lCPl8qEOPq76NGik56LF2A6fenpPzTpuGqwtzJ6AsuEafz2EJbmpc1OoqqLcg/exec";

// State Global Runtime Aplikasi
let sessionUser = null;
let databaseCloud = null;
let currentAuthTab = 'login';

// ==========================================
// 1. SISTEM ORKESTRASI SAAT PERTAMA DIMUAT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const splash = document.getElementById("splash-screen");
    
    // Jalankan timer splash hiasan awal selama 2.5 detik
    setTimeout(async () => {
        if (splash) splash.style.display = "none";
        
        // Tampilkan loader cloud global saat mengambil snapshot spreadsheet
        showGlobalLoader("Menyinkronkan Basis Data Cloud...");
        await ambilDataMasterDariCloud();
        hideGlobalLoader();

        // Cek apakah fitur "Ingat Saya" aktif dari sesi sebelumnya
        const savedUser = localStorage.getItem("remembered_siswa_m2spk");
        if (savedUser) {
            sessionUser = JSON.parse(savedUser);
            // Segarkan data sesi seandainya admin mengubah detail profil di lembar spreadsheet hulu
            sinkronkanUlangSesiSiswa();
            renderHalamanUtamaAplikasi();
        } else {
            // Jika tidak ada sesi tersimpan, lempar siswa ke panel Log/Daftar
            document.getElementById("auth-section").style.display = "block";
        }
    }, 2500);
});

// Fungsi untuk menarik seluruh data (GET) dari server Sheets
async function ambilDataMasterDariCloud() {
    try {
        const response = await fetch(API_URL, { method: "GET" });
        const result = await response.json();
        if (result.status === "success") {
            databaseCloud = result.data;
            console.log("☁️ Data Cloud Tersinkron:", databaseCloud);
            // Suntik opsi pilihan kelas dari database ke komponen dropdown di setup-profile
            populasiDropdownKelas();
        } else {
            alert("⚠️ Gagal mengunduh struktur data cloud: " + result.message);
        }
    } catch (err) {
        console.error(err);
        alert("❌ Putus koneksi. Pastikan perangkat Anda terhubung ke internet.");
    }
}

function populasiDropdownKelas() {
    const selectKelas = document.getElementById("setup-kelas");
    if (!selectKelas || !databaseCloud || !databaseCloud.daftar_kelas) return;
    
    // Bersihkan opsi bawaan kecuali placeholder pertama
    selectKelas.innerHTML = '<option value="">-- Pilih Kelas Anda --</option>';
    
    databaseCloud.daftar_kelas.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.nama_kelas; // Menggunakan Nama Kelas sebagai relasi string identitas
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
        // Jika status "Ingat Saya" aktif, perbarui isi data lokal terbarunya
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

    if (tabMode === 'login') {
        loginForm.style.display = "block";
        regForm.style.display = "none";
        loginTabBtn.classList.add("active");
        regTabBtn.classList.remove("active");
    } else {
        loginForm.style.display = "block"; // Biarkan login form tersembunyi
        loginForm.style.display = "none";
        regForm.style.display = "block";
        loginTabBtn.classList.remove("active");
        regTabBtn.classList.add("active");
    }
}

function togglePasswordVisibility(inputId, buttonElement) {
    const input = document.getElementById(inputId);
    const icon = buttonElement.querySelector("i");
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

// Proses Pendaftaran Awal Akses Akun
async function handleRegister(event) {
    event.preventDefault();
    if (!databaseCloud) {
        alert("⚠️ Sinkronisasi server belum selesai, silakan coba beberapa saat lagi.");
        return;
    }

    const inputNisn = document.getElementById("reg-nisn").value.trim();
    const inputHp = document.getElementById("reg-hp").value.trim();

    // Validasi pencegahan duplikasi data lokal hulu
    const cekSiswaExist = databaseCloud.data_siswa.find(s => s.nisn.toString() === inputNisn);
    if (cekSiswaExist) {
        alert("⚠️ NISN tersebut sudah terdaftar di cloud. Silakan langsung gunakan menu MASUK.");
        switchAuthTab('login');
        document.getElementById("login-nisn").value = inputNisn;
        return;
    }

    // Arahkan langsung ke halaman "Lengkapi Profil" dengan mengunci input pendaftaran
    document.getElementById("auth-section").style.display = "none";
    document.getElementById("profile-completion-section").style.display = "block";
    
    document.getElementById("setup-nisn").value = inputNisn;
    document.getElementById("setup-hp").value = inputHp;
}

// Proses Log Masuk Aplikasi
async function handleLogin(event) {
    event.preventDefault();
    if (!databaseCloud) {
        alert("⚠️ Server cloud belum siap dihubungi.");
        return;
    }

    const inputNisn = document.getElementById("login-nisn").value.trim();
    const inputHp = document.getElementById("login-pwd").value.trim();
    const rememberMeCheck = document.getElementById("login-remember").checked;

    // Cari kecocokan NISN & No.HP (sebagai sandi) di array master data_siswa hasil GET hulu
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
        alert("❌ Gagal Masuk: Kombinasi NISN & No HP salah, atau profil Anda belum diaktifkan!");
    }
}

// ==========================================
// 3. FITUR LENGKAPI DATA PROFIL (TEMBAK POST DATA_SISWA)
// ==========================================
function triggerDeviceGallery() {
    document.getElementById("file-hidden-input").removeAttribute("capture");
    document.getElementById("file-hidden-input").click();
}

function openSelfieCamera() {
    document.getElementById("file-hidden-input").setAttribute("capture", "user");
    document.getElementById("file-hidden-input").click();
}

function previewFileImage(inputElement) {
    const file = inputElement.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // Tampilkan berkas string base64 ke elemen visual avatar
            document.getElementById("selfie-img-view").src = e.target.result;
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
        foto_profil: document.getElementById("selfie-img-view").src // Mengirim string base64 gambar
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "text/plain" }, // CORS Safe Fallback Apps Script
            body: JSON.stringify(payloadSiswaBaru)
        });
        
        const result = await response.json();
        
        if (result.status === "success") {
            alert(`🎉 Registrasi Berhasil!\nKode Unik Kartu Anda: ${result.kode_unik}`);
            
            // Tarik ulang snapshot data master cloud agar siswa baru terindeks di sistem lokal
            await ambilDataMasterDariCloud();
            
            // Set objek sesi berdasarkan data yang baru masuk di cloud
            sessionUser = databaseCloud.data_siswa.find(s => s.nisn.toString() === payloadSiswaBaru.nisn);
            
            // Anggap pendaftaran pertama kali langsung mengaktifkan fitur ingat saya
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

    // Petakan data sesi aktif ke elemen Top Bar & Sisi Depan Kartu Siswa Digital
    document.getElementById("user-display-top").innerText = sessionUser.nama_lengkap;
    document.getElementById("card-front-nama").innerText = sessionUser.nama_lengkap.toUpperCase();
    document.getElementById("card-front-nisn").innerText = sessionUser.nisn;
    document.getElementById("card-front-kelas").innerText = sessionUser.kelas;
    document.getElementById("card-front-hp").innerText = sessionUser.nomor_hp;

    // Set Foto Profil Siswa
    const avatarSrc = sessionUser.foto_profil && sessionUser.foto_profil !== "-" ? sessionUser.foto_profil : "https://via.placeholder.com/150";
    document.getElementById("card-front-img").src = avatarSrc;

    // Buat QR Code Otomatis di Sisi Belakang Kartu Berdasarkan Kode Unik Cloud (`M2SPK...`)
    const nilaiQR = sessionUser.kode_unik || sessionUser.nisn;
    document.getElementById("card-back-qr").src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${nilaiQR}&ecc=H`;
    document.getElementById("card-back-code").innerText = nilaiQR;

    // Jalankan kalkulasi data tabel log rekap pribadi siswa
    prosesDanRenderRekapPribadi();

    // Default navigasi mengarah ke tab tengah (Beranda)
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
        status: document.getElementById("absensi-jenis").value, // "Izin" atau "Sakit"
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
            
            // Tarik ulang data cloud teranyar lalu segarkan visual tabel rekap harian
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

    // Inisialisasi Counter Penghitung Akumulasi Ringkas (Summary Box)
    let totalHadir = 0;
    let totalTelat = 0;
    let totalSakit = 0;
    let totalIzin = 0;
    let totalAlpha = 0;

    if (!databaseCloud || !databaseCloud.riwayat_absensi) {
        wadahTabel.innerHTML = `<tr><td colspan="3" class="text-center text-muted">Belum ada catatan absensi.</td></tr>`;
        return;
    }

    // Filter baris data riwayat murni milik siswa yang sedang aktif bersangkutan
    const riwayatSiswaAktif = databaseCloud.riwayat_absensi.filter(
        item => item.kode_unik === sessionUser.kode_unik
    ).reverse(); // Balik urutan agar data tanggal paling baru berada di baris atas

    if (riwayatSiswaAktif.length === 0) {
        wadahTabel.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4">Tidak ada log data kehadiran.</td></tr>`;
        updateVisualSummaryBoxes(0, 0, 0, 0, 0);
        return;
    }

    // Iterasi pengisian baris tabel sekaligus menjumlahkan counter status harian
    riwayatSiswaAktif.forEach(item => {
        let badgeStyle = "bg-danger";
        
        switch (item.status) {
            case "Tepat Waktu":
                badgeStyle = "bg-success";
                totalHadir++;
                break;
            case "Terlambat":
                badgeStyle = "bg-warning text-dark";
                totalTelat++;
                break;
            case "Sakit":
                badgeStyle = "bg-info text-dark";
                totalSakit++;
                break;
            case "Izin":
                badgeStyle = "bg-primary";
                totalIzin++;
                break;
            case "Alpha":
                badgeStyle = "bg-danger";
                totalAlpha++;
                break;
        }

        const baris = document.createElement("tr");
        baris.innerHTML = `
            <td class="fw-bold text-secondary">${formatFormatTanggalId(item.tanggal)}</td>
            <td class="fw-mono">${item.jam_scan} WIB</td>
            <td><span class="badge ${badgeStyle}">${item.status}</span></td>
        `;
        wadahTabel.appendChild(baris);
    });

    // Perbarui angka ringkasan harian di dashboard atas tab rekap
    updateVisualSummaryBoxes(totalHadir, totalTelat, totalSakit, totalIzin, totalAlpha);
}

function updateVisualSummaryBoxes(h, t, s, i, a) {
    document.getElementById("summary-hadir").innerText = h;
    document.getElementById("summary-telat").innerText = t;
    document.getElementById("summary-sakit").innerText = s;
    document.getElementById("summary-izin").innerText = i;
    document.getElementById("summary-alpha").innerText = a;
}

function formatFormatTanggalId(stringTanggal) {
    if (!stringTanggal || stringTanggal === "-") return "-";
    try {
        const opsi = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(stringTanggal).toLocaleDateString('id-ID', opsi);
    } catch(e) {
        return stringTanggal; // Fallback jika string bukan format standar tanggal
    }
}

// ==========================================
// 7. UTILITIES NAVIGATION CONTROL UI
// ==========================================
function navigateToPage(pageIndex) {
    const swiper = document.getElementById('pages-swiper');
    if (!swiper) return;

    document.getElementById('btn-nav-absen').classList.remove('active');
    document.getElementById('btn-nav-home').classList.remove('active');
    document.getElementById('btn-nav-rekap').classList.remove('active');

    if (pageIndex === 0) {
        swiper.style.transform = 'translateX(0%)';
        document.getElementById('btn-nav-absen').classList.add('active');
    } else if (pageIndex === 1) {
        swiper.style.transform = 'translateX(-33.333%)';
        document.getElementById('btn-nav-home').classList.add('active');
    } else if (pageIndex === 2) {
        swiper.style.transform = 'translateX(-66.666%)';
        document.getElementById('btn-nav-rekap').classList.add('active');
    }
}

function toggleCardFlip(cardWrapperElement) {
    cardWrapperElement.classList.toggle('flipped');
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
    if (loader) {
        document.getElementById("loader-text").innerText = pesanTeks;
        loader.style.display = "flex";
    }
}

function hideGlobalLoader() {
    const loader = document.getElementById("global-cloud-loader");
    if (loader) loader.style.display = "none";
}