// =========================================================================
// LOGIKA UTAMA PORTAL SISWA (KAMERA & GALERI INTEGRASI) - MAN 2 SIJUNJUNG
// =========================================================================

// PENTING: Ganti dengan URL Aplikasi Web /exec yang Anda dapatkan dari Google Apps Script!
const URL_API_PUSAT = "https://script.google.com/macros/s/AKfycbyiJUyJndpBwzuhfo2nAQ3kjJinwt_tNPUmPHBcBf2BZ4Ex8BTSsy6iwgjNNC2eg4k8/exec";

// Objek Penyimpanan Sementara Data Master dari Google Sheets
let MASTER_DB = { siswa: [], kelas: [], jadwal: [] };
let DATA_LOGGED_IN_SISWA = null; // Menyimpan data profil siswa yang berhasil login

// 1. OTOMATISASI SAAT HALAMAN DIBUKA
window.addEventListener("DOMContentLoaded", () => {
    unduhDataMasterSiswa();
});

// Fungsi untuk sinkronisasi awal mengambil data Kelas & Jadwal
function unduhDataMasterSiswa() {
    const msg = document.getElementById("loading-msg");
    
    fetch(`${URL_API_PUSAT}?action=downloadMaster`)
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                MASTER_DB.siswa = data.siswa;
                MASTER_DB.kelas = data.kelas;
                MASTER_DB.jadwal = data.jadwal;

                // Isi dropdown Pilihan Kelas di Form Registrasi secara dinamis
                isiDropdownKelasRegistrasi();

                // Cek apakah siswa pernah login sebelumnya di HP ini (Auto Login)
                let sesiLokal = localStorage.getItem("sesi_siswa_man2");
                if (sesiLokal) {
                    DATA_LOGGED_IN_SISWA = JSON.parse(sesiLokal);
                    bukaDashboardSiswa(DATA_LOGGED_IN_SISWA);
                } else {
                    // Masuk ke halaman login/register
                    document.getElementById("student-splash").classList.add("hidden");
                    document.getElementById("auth-container").classList.remove("hidden");
                }
            }
        })
        .catch(err => {
            msg.innerText = "Koneksi Bermasalah. Coba muat ulang halaman.";
            console.error(err);
        });
}

// 2. LOGIKA USER INTERFACE (UI INTERACTION)
function switchAuthForm(target) {
    if (target === 'register') {
        document.getElementById("form-login").classList.add("hidden");
        document.getElementById("form-register").classList.remove("hidden");
    } else {
        document.getElementById("form-register").classList.add("hidden");
        document.getElementById("form-login").classList.remove("hidden");
    }
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling;
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye-slash", "fa-eye");
    } else {
        input.type = "password";
        icon.classList.replace("fa-eye", "fa-eye-slash");
    }
}

function switchStudentTab(tabId) {
    document.querySelectorAll(".student-tab-content").forEach(tab => tab.classList.remove("active-tab"));
    document.querySelectorAll(".bottom-nav-item").forEach(item => item.classList.remove("active"));
    
    document.getElementById(tabId).classList.add("active-tab");
    event.currentTarget.classList.add("active");
}

function isiDropdownKelasRegistrasi() {
    const select = document.getElementById("reg-kelas");
    select.innerHTML = '<option value="">-- Pilih Kelas --</option>';
    MASTER_DB.kelas.forEach(k => {
        select.innerHTML += `<option value="${k.Nama_Kelas}">${k.Nama_Kelas}</option>`;
    });
}

// 3. PROSES REGISTRASI & LENGKAPI PROFIL SISWA (VERSI UPGRADE KAMERA & GALERI)
function prosesRegistrasiSiswa() {
    const nisn = document.getElementById("reg-nisn").value.trim();
    const nama = document.getElementById("reg-nama").value.trim();
    const hp = document.getElementById("reg-hp").value.trim();
    const kelas = document.getElementById("reg-kelas").value;
    const password = document.getElementById("reg-pass").value.trim();
    
    // Ambil elemen berkas gambar dari input file HTML
    const fileInput = document.getElementById("reg-foto-file");
    const berkasFoto = fileInput.files[0];

    if (!nisn || !nama || !kelas || !password) {
        alert("Mohon lengkapi NISN, Nama, Kelas, dan Password Anda!");
        return;
    }

    if (password.length < 6) {
        alert("Password minimal harus 6 karakter demi keamanan.");
        return;
    }

    const btn = event.currentTarget;
    btn.innerText = "Sedang Memproses...";
    btn.disabled = true;

    // Logika pembaca gambar: Jika siswa memasukkan foto, ubah jadi teks Base64
    if (berkasFoto) {
        const pembacaBerkas = new FileReader();
        pembacaBerkas.onloadend = function() {
            const stringBase64Foto = pembacaBerkas.result; // Hasil konversi gambar ke teks
            
            // Jalankan pengiriman data ke Google Sheets
            kirimDataPendaftaranKeServer(nisn, nama, hp, kelas, stringBase64Foto, password, btn);
        }
        pembacaBerkas.readAsDataURL(berkasFoto); // Mulai membaca file berkas
    } else {
        // Jika siswa tidak memilih foto, kirim dengan string kosong
        kirimDataPendaftaranKeServer(nisn, nama, hp, kelas, "", password, btn);
    }
}

// Fungsi bantu untuk menembak API Google Apps Script (POST)
function kirimDataPendaftaranKeServer(nisn, nama, hp, kelas, fotoBase64, password, tombolElemen) {
    const payload = {
        action: "registrasiSiswa",
        data: { nisn, nama, hp, kelas, foto: fotoBase64, password }
    };

    fetch(URL_API_PUSAT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(() => {
        alert("Profil Berhasil Disimpan! Silakan masuk menggunakan NISN dan Password Anda.");
        tombolElemen.innerText = "Simpan & Buat Kartu QR";
        tombolElemen.disabled = false;
        location.reload(); // Segarkan halaman kembali ke menu utama login
    })
    .catch(err => {
        alert("Gagal terhubung ke server pendaftaran: " + err);
        tombolElemen.disabled = false;
    });
}

// 4. PROSES LOGIN SISWA
function prosesLoginSiswa() {
    const nisnInput = document.getElementById("login-nisn").value.trim();
    const passInput = document.getElementById("login-pass").value.trim();

    if (!nisnInput || !passInput) return alert("Isi NISN dan Password!");

    // Validasi lokal mencocokkan data baris dari data master yang sudah didownload
    const cocokSiswa = MASTER_DB.siswa.find(s => s.NISN.toString() === nisnInput && s.Password.toString() === passInput);

    if (cocokSiswa) {
        DATA_LOGGED_IN_SISWA = cocokSiswa;
        // Simpan sesi login di memori HP agar tidak perlu login berulang kali
        localStorage.setItem("sesi_siswa_man2", JSON.stringify(cocokSiswa));
        bukaDashboardSiswa(cocokSiswa);
    } else {
        alert("NISN atau Password Salah! Pastikan Anda sudah melengkapi profil.");
    }
}

// 5. RENDERING DASHBOARD, GENERATOR QR CODE & JADWAL
function bukaDashboardSiswa(siswa) {
    document.getElementById("student-splash").classList.add("hidden");
    document.getElementById("auth-container").classList.add("hidden");
    document.getElementById("student-dashboard").classList.remove("hidden");

    // Tulis Informasi Profil User ke Layar Atas & Kartu
    document.getElementById("txt-nama-user").innerText = siswa.Nama;
    document.getElementById("txt-kelas-user").innerText = "Kelas: " + siswa.Kelas;
    document.getElementById("card-nama").innerText = siswa.Nama;
    document.getElementById("card-nisn").innerText = "NISN: " + siswa.NISN;
    document.getElementById("card-kelas").innerText = siswa.Kelas;
    
    // Set Inisial Nama untuk Avatar Bulat
    document.getElementById("user-avatar").innerText = siswa.Nama.substring(0,1).toUpperCase();

    // GENERASI KARTU QR CODE OTOMATIS
    document.getElementById("qrcode-area").innerHTML = "";
    new QRCode(document.getElementById("qrcode-area"), {
        text: siswa.Kode_Unik,
        width: 140,
        height: 140,
        colorDark : "#1b5e20",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    // Render Jadwal Pelajaran Berdasarkan Kelas Siswa
    renderTimelineJadwalSiswa(siswa.Kelas);
}

function renderTimelineJadwalSiswa(kelasSiswa) {
    const container = document.getElementById("list-jadwal-siswa");
    const jadwalFilter = MASTER_DB.jadwal.filter(j => j.Nama_Kelas === kelasSiswa);

    if (jadwalFilter.length === 0) {
        container.innerHTML = `<p class="placeholder-text"><i class="fa-solid fa-calendar-xmark"></i> Belum ada jadwal pelajaran terunggah untuk kelas ${kelasSiswa}.</p>`;
        return;
    }

    container.innerHTML = "";
    jadwalFilter.forEach(j => {
        container.innerHTML += `
            <div class="schedule-card">
                <div class="schedule-time">
                    <div class="start">${j.Jam_Mulai}</div>
                    <div class="end">${j.Jam_Selesai} WIB</div>
                </div>
                <div class="schedule-info">
                    <h4>${j.Mapel}</h4>
                    <p><i class="fa-solid fa-tags"></i> Hari ${j.Hari} | ${j.Nama_Kelas}</p>
                </div>
            </div>
        `;
    });
}

// 6. AJUKAN SURAT KETERANGAN IZIN / SAKIT (POST)
function kirimSuratIzinSiswa() {
    const status = document.getElementById("perm-status").value;
    const urlBukti = document.getElementById("perm-url").value.trim();

    if (!urlBukti) return alert("Masukkan URL tautan bukti foto surat keterangan terlebih dahulu!");

    const sekarang = new Date();
    const tanggalIni = sekarang.toLocaleDateString('id-ID');
    const waktuIni = honoraryClockTime = sekarang.toTimeString().split(' ')[0].substring(0,5);

    const payloadAbsenLokal = [
        {
            tanggal: tanggalIni,
            waktu: waktuIni,
            nisn: DATA_LOGGED_IN_SISWA.NISN,
            nama: DATA_LOGGED_IN_SISWA.Nama,
            kelas: DATA_LOGGED_IN_SISWA.Kelas,
            status: status,
            keterangan: urlBukti
        }
    ];

    const btn = event.currentTarget;
    btn.innerText = "Sedang Mengirim...";
    btn.disabled = true;

    fetch(URL_API_PUSAT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action: "uploadAbsenMassal",
            data: payloadAbsenLokal
        })
    })
    .then(() => {
        alert(`Permohonan ${status} Anda Berhasil Dikirim ke Wali Kelas & Admin!`);
        btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Kirim Permohonan`;
        btn.disabled = false;
        document.getElementById("perm-url").value = ""; 
    })
    .catch(err => {
        alert("Gagal mengirim data permohonan. Cek internet Anda.");
        btn.disabled = false;
    });
}

function logoutSiswa() {
    if(confirm("Apakah Anda ingin keluar dari Portal Siswa MAN 2?")) {
        localStorage.removeItem("sesi_siswa_man2");
        location.reload();
    }
}