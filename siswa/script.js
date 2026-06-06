/**
 * =========================================================================
 * PORTAL SISWA JAVASCRIPT - MAN 2 SIJUNJUNG PLUS KETERAMPILAN
 * Fitur: Validasi Login, Auto QR Generator, Tab View, & Input Ketidakhadiran
 * =========================================================================
 */

// GANTI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA YANG SEBENARNYA
const API_URL = "https://script.google.com/macros/s/AKfycbxHDn7KSm8FsB17CVaaOAJAJbHPq1cCj4rFBjtzGrCIf8dn09FQtEPqJAJmhKBhDsvdGA/exec";

// State Global Aplikasi
let databaseMaster = null;
let siswaAktif = null;
let qrGenerator = null;

document.addEventListener("DOMContentLoaded", async () => {
    initClock();
    initTabNavigation();
    
    // 1. Ambil Data Master Semuanya dari Google Sheet (doGet)
    await muatDatabaseMaster();

    // 2. Event Listener untuk Tombol Login
    document.getElementById("btn-login").addEventListener("click", prosesLogin);
    
    // 3. Event Listener untuk Form Ketidakhadiran
    document.getElementById("form-ketidakhadiran").addEventListener("submit", kirimKetidakhadiran);

    // 4. Event Listener Logout
    document.getElementById("btn-logout").addEventListener("click", prosesLogout);
});

/**
 * MENGAMBIL DATA DARI BACKEND APPS SCRIPT
 */
async function muatDatabaseMaster() {
    const statusIndicator = document.getElementById("cloud-status");
    try {
        statusIndicator.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sinkronisasi database...`;
        statusIndicator.style.background = "rgba(245, 158, 11, 0.2)";
        statusIndicator.style.color = "#92400e";

        const response = await fetch(API_URL);
        const result = await response.json();

        if (result.status === "success") {
            databaseMaster = result.data;
            statusIndicator.innerHTML = `<i class="fa-solid fa-cloud"></i> Sinkronisasi Aktif`;
            statusIndicator.style.background = "rgba(16, 185, 129, 0.2)";
            statusIndicator.style.color = "#065f46";
            
            // Hilangkan Splash Screen jika data sudah siap
            setTimeout(() => {
                const splash = document.getElementById("splash-screen");
                if (splash) splash.style.opacity = "0";
                setTimeout(() => splash ? splash.classList.add("d-none") : null, 500);
            }, 1000);
        } else {
            alert("Gagal memuat database internal server: " + result.message);
        }
    } catch (error) {
        console.error(error);
        statusIndicator.innerHTML = `<i class="fa-solid fa-cloud-bounce"></i> Mode Offline`;
        statusIndicator.style.background = "rgba(239, 68, 68, 0.2)";
        statusIndicator.style.color = "#991b1b";
        alert("Koneksi gagal. Pastikan URL Web App Apps Script benar dan Cors diizinkan.");
    }
}

/**
 * SISTEM OTENTIKASI & PROSES LOGIN (NISN ATAU KODE UNIK)
 */
function prosesLogin() {
    const inputKredensial = document.getElementById("login-credential").value.trim();

    if (!inputKredensial) {
        alert("Silakan masukkan Kode Unik atau NISN Anda!");
        return;
    }

    if (!databaseMaster || !databaseMaster.data_siswa) {
        alert("Data siswa belum siap atau gagal dimuat dari server Cloud.");
        return;
    }

    // Cari kecocokan data berdasarkan Kode Unik ataupun NISN
    siswaAktif = databaseMaster.data_siswa.find(siswa => 
        (siswa.kode_unik && siswa.kode_unik.toLowerCase() === inputKredensial.toLowerCase()) || 
        (siswa.nisn && siswa.nisn.toString() === inputKredensial)
    );

    if (siswaAktif) {
        renderDashboardSiswa();
    } else {
        alert("Kredensial tidak ditemukan! Periksa kembali NISN atau Kode Unik Anda.");
    }
}

/**
 * RENDER TAMPILAN DASHBOARD UTAMA
 */
function renderDashboardSiswa() {
    // 1. Update Informasi Profil di Elemen Header
    document.getElementById("m-siswa-nama").innerText = siswaAktif.nama_lengkap;
    document.getElementById("m-siswa-kelas-nisn").innerText = `Kelas ${siswaAktif.kelas} | NISN ${siswaAktif.nisn}`;
    document.getElementById("m-siswa-kode").innerText = siswaAktif.kode_unik;

    // Jika siswa memiliki link foto profil valid, gunakan. Jika tidak gunakan placeholder.
    if (siswaAktif.foto_profil && siswaAktif.foto_profil !== "-") {
        document.getElementById("m-siswa-foto").src = siswaAktif.foto_profil;
    }

    // 2. Generate QR Code Otomatis Menggunakan Library qrcode.js
    const qrContainer = document.getElementById("qrcode-target");
    qrContainer.innerHTML = ""; // Bersihkan QR lama jika ada
    
    qrGenerator = new QRCode(qrContainer, {
        text: siswaAktif.kode_unik,
        width: 180,
        height: 180,
        colorDark: "#047857", // Menyelaraskan warna QR dengan tema Hijau Madrasah
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    // 3. Render Riwayat Absensi Khusus Siswa Terkait
    renderTabelRiwayatSiswa();

    // 4. Transisi Tampilan Halaman
    document.getElementById("login-container").classList.add("d-none");
    document.getElementById("main-dashboard").classList.remove("d-none");
}

/**
 * FILTER DAN TAMPILKAN TABEL RIWAYAT ABSENSI SISWA
 */
function renderTabelRiwayatSiswa() {
    const tbody = document.getElementById("tbody-riwayat-siswa");
    tbody.innerHTML = "";

    if (!databaseMaster.riwayat_absensi || databaseMaster.riwayat_absensi.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b;">Belum ada catatan absensi.</td></tr>`;
        return;
    }

    // Saring riwayat berdasarkan kode_unik siswa yang sedang login
    const riwayatSiswa = databaseMaster.riwayat_absensi.filter(absen => absen.kode_unik === siswaAktif.kode_unik);

    if (riwayatSiswa.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#64748b;">Belum ada riwayat terekam untuk Anda.</td></tr>`;
        return;
    }

    // Urutkan riwayat dari yang paling baru (Descending)
    riwayatSiswa.reverse().forEach(item => {
        let badgeClass = "badge-tepat";
        if (item.status === "Terlambat") badgeClass = "badge-telat";
        if (item.status === "Izin") badgeClass = "badge-izin";
        if (item.status === "Sakit") badgeClass = "badge-sakit";

        const barisHtml = `
            <tr>
                <td><b>${item.tanggal}</b></td>
                <td>${item.jam_scan}</td>
                <td><span class="status-badge ${badgeClass}">${item.status}</span></td>
                <td><small>${item.bukti_status || "-"}</small></td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", barisHtml);
    });
}

/**
 * KIRIM FORMULIR KETIDAKHADIRAN MANDIRI (Sakit / Izin) VIA POST
 */
async function kirimKetidakhadiran(e) {
    e.preventDefault();

    const statusPilihan = document.getElementById("report-status").value;
    const alasanTekstual = document.getElementById("report-reason").value.trim();

    if (!alasanTekstual) {
        alert("Alasan atau Bukti tidak boleh kosong!");
        return;
    }

    const konfirmasi = confirm(`Kirim laporan bahwa Anda ${statusPilihan} hari ini?`);
    if (!konfirmasi) return;

    // Struktur payload JSON disesuaikan dengan instruksi `action: "input_ketidakhadiran"` di Apps Script
    const payload = {
        action: "input_ketidakhadiran",
        kode_unik: siswaAktif.kode_unik,
        status: statusPilihan,
        bukti_status: alasanTekstual
    };

    try {
        // Tampilkan loading state button
        const btnSubmit = e.target.querySelector("button[type='submit']");
        const originalBtnText = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memproses Kiriman...`;

        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        
        const dataHasil = await response.json();

        if (dataHasil.status === "success") {
            alert(dataHasil.message);
            document.getElementById("form-ketidakhadiran").reset();
            
            // Tarik ulang database terbaru agar riwayat terupdate instan di layar
            await muatDatabaseMaster();
            renderTabelRiwayatSiswa();
            
            // Pindahkan kembali fokus tab ke tab profil utama
            document.querySelector(".tab-btn[data-target='tab-profile']").click();
        } else {
            alert("Gagal menyimpan data ke sistem cloud: " + dataHasil.message);
        }

        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;

    } catch (error) {
        console.error(error);
        alert("Koneksi internet bermasalah. Gagal terhubung ke database cloud sekolah.");
    }
}

/**
 * FUNGSI LOGOUT SISTEM
 */
function prosesLogout() {
    if (confirm("Apakah Anda yakin ingin keluar dari sistem portal siswa?")) {
        siswaAktif = null;
        document.getElementById("login-credential").value = "";
        document.getElementById("main-dashboard").classList.add("d-none");
        document.getElementById("login-container").classList.remove("d-none");
    }
}

/**
 * NAVIGASI TAB VIEW INTERFACES
 */
function initTabNavigation() {
    const tombolTabs = document.querySelectorAll(".tab-btn");
    const kontenTabs = document.querySelectorAll(".tab-content");

    tombolTabs.forEach(btn => {
        btn.addEventListener("click", () => {
            tombolTabs.forEach(t => t.classList.remove("active"));
            kontenTabs.forEach(c => c.classList.remove("active"));

            btn.classList.add("active");
            const targetId = btn.getAttribute("data-target");
            document.getElementById(targetId).classList.add("active");
        });
    });
}

/**
 * JAM DIGITAL REALTIME (JAM, MENIT, DETIK)
 */
function initClock() {
    setInterval(() => {
        const sekarang = new Date();
        const opsi = { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit" };
        const stringWaktu = sekarang.toLocaleTimeString("id-ID", opsi);
        document.getElementById("live-time").innerText = `${stringWaktu} WIB`;
    }, 1000);
}