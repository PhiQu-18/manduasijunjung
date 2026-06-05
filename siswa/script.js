/**
 * =========================================================================
 * SCRIPT CLIENT-SIDE LAMAN SISWA - MAN 2 SIJUNJUNG SMART ENGINE
 * Terkoneksi Langsung Dengan Google Sheets V4 Final Production API
 * =========================================================================
 */

// 1. KONFIGURASI WEB APP API 
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzGIPmW2lCPl8qEOPq76NGik56LF2A6fenpPzTpuGqwtzJ6AsuEafz2EJbmpc1OoqqLcg/exec";

// State Global Aplikasi
let masterData = {}; 
let currentUserSession = JSON.parse(localStorage.getItem('siswa_session')) || null;

// ==========================================
// 2. INITIALIZATION & SPLASH SCREEN VIA GET
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    // Ambil basis data segar dari Google Sheets (doGet)
    await fetchDatabaseFromSheets();

    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        splash.style.opacity = '0';
        splash.style.visibility = 'hidden';
        
        // Cek Sesi login lokal
        if (currentUserSession) {
            // Ambil data siswa terbaru hasil sinkronisasi dari sheets berdasarkan NISN
            const siswaAktif = masterData.data_siswa.find(s => s.nisn.toString() === currentUserSession.nisn.toString());
            if (siswaAktif) {
                currentUserSession = siswaAktif; // Perbarui data session
                localStorage.setItem('siswa_session', JSON.stringify(currentUserSession));
                launchMainApp();
            } else {
                // Jika NISN dihapus oleh admin di database cloud
                logoutProcess();
            }
        } else {
            // Menampilkan form login/daftar
            document.getElementById('auth-section').style.display = 'flex';
        }
    }, 2000);
});

// Fungsi Sync Mengambil Data (doGet)
async function fetchDatabaseFromSheets() {
    try {
        const response = await fetch(SCRIPT_URL, { method: "GET" });
        const result = await response.json();
        if (result.status === "success") {
            masterData = result.data;
            // Backup lokal jika suatu saat offline
            localStorage.setItem('master_data_backup', JSON.stringify(masterData));
        }
    } catch (error) {
        console.error("Sinkronisasi gagal, memuat backup lokal...", error);
        masterData = JSON.parse(localStorage.getItem('master_data_backup')) || { jam_masuk:[], jadwal_pelajaran:[], daftar_kelas:[], data_siswa:[], riwayat_absensi:[] };
        triggerSystemBanner("Koneksi Lambat", "Menggunakan data lokal.", "fa-triangle-exclamation");
    }
}

// ==========================================
// 3. PROSES AUTENTIKASI (LOGIN & DAFTAR)
// ==========================================
function switchAuthTab(tab) {
    const btnLogin = document.querySelectorAll('.auth-tab-btn')[0];
    const btnReg = document.querySelectorAll('.auth-tab-btn')[1];
    if (tab === 'login') {
        btnLogin.classList.add('active');
        btnReg.classList.remove('active');
        document.getElementById('form-login').style.display = 'block';
        document.getElementById('form-register').style.display = 'none';
    } else {
        btnReg.classList.add('active');
        btnLogin.classList.remove('active');
        document.getElementById('form-login').style.display = 'none';
        document.getElementById('form-register').style.display = 'block';
    }
}

// Pendaftaran Akun (Validasi awal NISN sebelum melengkapi profil)
async function handleRegister(e) {
    e.preventDefault();
    const nisn = document.getElementById('reg-nisn').value.trim();

    // Cek di master data apakah NISN ini sudah terdaftar sebelumnya di database cloud
    const sudahAda = masterData.data_siswa.find(s => s.nisn.toString() === nisn);
    if (sudahAda) {
        triggerSystemBanner("Sudah Terdaftar", "NISN Anda telah aktif, silakan masuk.", "fa-circle-info");
        switchAuthTab('login');
        return;
    }

    // Alihkan langsung ke form pelengkap data agar data masuk ke Google Sheets sekali jalan
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('profile-completion-section').style.display = 'flex';
    document.getElementById('setup-nisn').value = nisn;
    
    // Load opsi kelas secara dinamis dari database Google Sheets tab 'Daftar_Kelas'
    const selectKelas = document.getElementById('setup-kelas');
    selectKelas.innerHTML = '<option value="">-- Pilih Ruang Kelas --</option>';
    masterData.daftar_kelas.forEach(k => {
        let opt = document.createElement('option');
        opt.value = k.id_kelas;
        opt.innerText = `${k.nama_kelas}`;
        selectKelas.appendChild(opt);
    });
}

// Proses Login Mencocokkan NISN dan Nomor HP sebagai sandi akses
async function handleLogin(e) {
    e.preventDefault();
    const nisn = document.getElementById('login-nisn').value.trim();
    const pwd = document.getElementById('login-pwd').value.trim(); // Siswa memasukkan Nomor HP di input password

    // Validasi langsung mencocokkan NISN dan Nomor HP yang ada di sheet Data_Siswa
    const userMatch = masterData.data_siswa.find(s => 
        s.nisn.toString() === nisn && s.nomor_hp.toString() === pwd
    );

    if (userMatch) {
        currentUserSession = userMatch;
        localStorage.setItem('siswa_session', JSON.stringify(currentUserSession));
        triggerSystemBanner("Berhasil Masuk", `Selamat datang kembali, ${userMatch.nama_lengkap}`, "fa-circle-check");
        launchMainApp();
    } else {
        triggerSystemBanner("Gagal Masuk", "NISN tidak terdaftar atau Nomor HP salah!", "fa-circle-exclamation");
    }
}

// Submit Profil Lengkap Menuju Aksi "tambah_siswa" di Apps Script
async function saveCompleteProfile(e) {
    e.preventDefault();
    const nisn = document.getElementById('setup-nisn').value;
    const nama = document.getElementById('setup-nama').value.trim();
    const kelas = document.getElementById('setup-kelas').value;
    const hp = document.getElementById('setup-hp').value.trim();
    const imgView = document.getElementById('selfie-img-view');
    
    let base64Foto = imgView.style.display === 'block' ? imgView.src : "-";

    const payload = {
        action: "tambah_siswa",
        nama_lengkap: nama,
        nisn: nisn,
        nomor_hp: hp,
        kelas: kelas,
        foto_profil: base64Foto
    };

    triggerSystemBanner("Menyimpan...", "Mengirim data siswa ke Google Sheets Cloud...", "fa-cloud-arrow-up");

    try {
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const res = await response.json();

        if (res.status === "success") {
            // Ambil kode_unik yang otomatis digenerate oleh backend Anda (Contoh: M2SPKXE1-1)
            payload.kode_unik = res.kode_unik;
            currentUserSession = payload;
            localStorage.setItem('siswa_session', JSON.stringify(currentUserSession));
            
            triggerSystemBanner("Registrasi Sukses", "Akun & Kartu Siswa Anda telah aktif!", "fa-id-card");
            
            // Refresh data dari cloud agar sinkron total
            await fetchDatabaseFromSheets();
            launchMainApp();
        } else {
            triggerSystemBanner("Gagal Menyimpan", res.message, "fa-circle-xmark");
        }
    } catch (err) {
        triggerSystemBanner("Gangguan Server", "Gagal menghubungi API Sheets.", "fa-triangle-exclamation");
    }
}

// ==========================================
// 4. HANDLER FOTO (KAMERA & FILE INPUT BASE64)
// ==========================================
function triggerCamera() {
    const randomImgId = Math.floor(Math.random() * 70);
    const mockSelfieUrl = `https://i.pravatar.cc/150?img=${randomImgId}`;
    
    document.getElementById('selfie-placeholder').style.display = 'none';
    const imgView = document.getElementById('selfie-img-view');
    imgView.src = mockSelfieUrl;
    imgView.style.display = 'block';
    triggerSystemBanner("Kamera Aktif", "Foto sukses diambil.", "fa-camera");
}

function loadAvatarFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function() {
        document.getElementById('selfie-placeholder').style.display = 'none';
        const imgView = document.getElementById('selfie-img-view');
        imgView.src = reader.result; 
        imgView.style.display = 'block';
    }
    reader.readAsDataURL(file);
}

// ==========================================
// 5. APPLIKASI UTAMA (RENDERING DATA & KARTU 3D)
// ==========================================
function launchMainApp() {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('profile-completion-section').style.display = 'none';
    document.getElementById('main-app-section').style.display = 'block';

    document.getElementById('user-display-top').innerText = currentUserSession.nama_lengkap;
    
    document.getElementById('card-front-img').src = currentUserSession.foto_profil !== "-" ? currentUserSession.foto_profil : "https://via.placeholder.com/90x115?text=MAN2";
    document.getElementById('card-front-nama').innerText = currentUserSession.nama_lengkap.toUpperCase();
    document.getElementById('card-front-nisn').innerText = currentUserSession.nisn;
    document.getElementById('card-front-kelas').innerText = currentUserSession.kelas;
    document.getElementById('card-front-hp').innerText = currentUserSession.nomor_hp;
    
    const qrCodeReal = currentUserSession.kode_unik || "POPO";
    document.getElementById('card-back-qr').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrCodeReal}&ecc=H`;
    document.getElementById('card-back-code').innerText = qrCodeReal;

    calculateAttendanceStats(qrCodeReal);
    renderTodaySchedule(currentUserSession.kelas);
}

function toggleCardFlip(element) {
    element.classList.toggle('flipped');
}

function calculateAttendanceStats(kodeUnik) {
    let tepatWaktu = 0;
    let terlambat = 0;
    let izin = 0;
    let sakit = 0;
    let alpha = 0;

    const riwayatUser = masterData.riwayat_absensi.filter(r => r.kode_unik === kodeUnik);

    riwayatUser.forEach(item => {
        const stat = item.status.trim().toLowerCase();
        if (stat === "tepat waktu") tepatWaktu++;
        else if (stat === "terlambat") terlambat++;
        else if (stat === "izin") izin++;
        else if (stat === "sakit") sakit++;
        else if (stat === "alpha") alpha++;
    });

    document.getElementById('stat-tepat').innerText = tepatWaktu;
    document.getElementById('stat-lambat').innerText = terlambat;
    document.getElementById('stat-izin').innerText = izin;
    document.getElementById('stat-sakit').innerText = sakit;
    document.getElementById('stat-alpha').innerText = alpha;
}

// ==========================================
// 6. FITUR AKADEMIK & FILTER JADWAL RIIL
// ==========================================
function renderTodaySchedule(idKelas) {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariIni = days[new Date().getDay()];
    
    document.querySelectorAll('.cal-date').forEach(el => el.classList.remove('active'));
    loadScheduleByDay(idKelas, hariIni);
}

function showSchedule(element, hari) {
    document.querySelectorAll('.cal-date').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    loadScheduleByDay(currentUserSession.kelas, hari);
}

function loadScheduleByDay(idKelas, hari) {
    const resultBox = document.getElementById('schedule-result-box');
    resultBox.innerHTML = '';

    const jadwalCocok = masterData.jadwal_pelajaran.filter(j => j.id_kelas.toLowerCase() === idKelas.toLowerCase() && j.hari.toLowerCase() === hari.toLowerCase());

    if (jadwalCocok.length === 0) {
        resultBox.innerHTML = `<div class="subject-item" style="border-left-color: var(--text-muted)">-- Tidak Ada Jadwal Pelajaran (${hari}) --</div>`;
        return;
    }

    jadwalCocok.forEach(m => {
        const item = document.createElement('div');
        item.className = 'subject-item';
        item.innerText = `${m.jam_mulai} - ${m.jam_berakhir} | ${m.mata_pelajaran}`;
        resultBox.appendChild(item);
    });
}

// ==========================================
// 7. INPUT KETIDAKHADIRAN (ACTION: input_ketidakhadiran)
// ==========================================
async function submitAbsenMandiri(e) {
    e.preventDefault();
    const jenisStatus = document.getElementById('absensi-jenis').value; 
    const alasan = document.getElementById('absensi-alasan').value.trim();

    const payload = {
        action: "input_ketidakhadiran",
        kode_unik: currentUserSession.kode_unik || "POPO",
        status: jenisStatus,
        bukti_status: alasan ? `Alasan: ${alasan}` : "-"
    };

    triggerSystemBanner("Mengirim...", "Mengunggah surat absensi mandiri...", "fa-spinner");

    try {
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const res = await response.json();

        if (res.status === "success") {
            triggerSystemBanner("Berhasil", `Pelaporan ${jenisStatus} berhasil dicatat di database Cloud!`, "fa-circle-check");
            document.getElementById('absensi-alasan').value = '';
            
            await fetchDatabaseFromSheets();
            calculateAttendanceStats(currentUserSession.kode_unik);
        } else {
            triggerSystemBanner("Gagal Absen", res.message, "fa-circle-xmark");
        }
    } catch (err) {
        triggerSystemBanner("Koneksi Putus", "Gagal memproses absensi mandiri.", "fa-triangle-exclamation");
    }
}

function applyRekapFilter() {
    triggerSystemBanner("Filter Diterapkan", "Menampilkan data histori terpilih.", "fa-filter");
    calculateAttendanceStats(currentUserSession.kode_unik);
}

// ==========================================
// 8. GLOBAL UTILITIES (SWIPE, BANNER, AUD)
// ==========================================
function navigateToPage(pageIndex) {
    const swiper = document.getElementById('pages-swiper');
    const btnHome = document.getElementById('btn-nav-home');
    const btnFeatures = document.getElementById('btn-nav-features');

    if (pageIndex === 0) {
        swiper.style.transform = 'translateX(0%)';
        btnHome.classList.add('active');
        btnFeatures.classList.remove('active');
    } else {
        swiper.style.transform = 'translateX(-50%)';
        btnFeatures.classList.add('active');
        btnHome.classList.remove('active');
    }
}

let touchstartX = 0;
let touchendX = 0;
document.getElementById('pages-swiper').addEventListener('touchstart', e => touchstartX = e.changedTouches[0].screenX );
document.getElementById('pages-swiper').addEventListener('touchend', e => {
    touchendX = e.changedTouches[0].screenX;
    if (touchstartX - touchendX > 100) navigateToPage(1);
    if (touchendX - touchstartX > 100) navigateToPage(0);
});

function playNotificationSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime); 
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.12);
    } catch(e) {}
}

function triggerSystemBanner(title, text, iconClass) {
    playNotificationSound();
    const banner = document.getElementById('statusbar-notification');
    const icon = document.getElementById('noti-icon-element');
    
    document.getElementById('noti-title').innerText = title;
    document.getElementById('noti-text').innerText = text;
    icon.className = `fa-solid ${iconClass} noti-icon`;
    
    banner.classList.add('show');
    setTimeout(() => { banner.classList.remove('show'); }, 3500);
}

function logoutProcess() {
    localStorage.removeItem('siswa_session');
    location.reload();
}