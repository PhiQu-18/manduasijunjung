const CONFIG_ADMIN = {
  API_URL: "https://script.google.com/macros/s/AKfycbwsbtH2cdunAY93SojXUuWWHMILwODm1qauvQQw0o_V-4ZsT9zj7Q213ei-E0VCZAHgoQ/exec", // <-- PASTIKAN SAMA DENGAN SISWA
  SCHOOL_NAME: "MAN 2 Sijunjung"
};

let adminChartInstance = null;
let qrScannerEngine = null;

// SINKRONISASI OTOMATIS SAAT WEB DIbuka (Fitur 1)
document.addEventListener("DOMContentLoaded", () => {
  startAdminLiveClock();
  downloadDatabaseCloudToLocal();
});

// 1. ENGINE RUNTIME CLOCK REAL-TIME
function startAdminLiveClock() {
  setInterval(() => {
    const now = new Date();
    const clockStr = now.toTimeString().split(' ')[0] + " - " + now.toLocaleDateString('id-ID', {day:'2-digit', month:'2-digit', year:'numeric'});
    document.getElementById("live-admin-clock").innerText = clockStr;
  }, 1000);
}

// 2. DOWNLOAD & SYNC DATABASE ON LOAD (Fitur 1)
function downloadDatabaseCloudToLocal() {
  fetch(CONFIG_ADMIN.API_URL)
    .then(res => res.json())
    .then(db => {
      if (db.kelas) localStorage.setItem("master_kelas", JSON.stringify(db.kelas));
      if (db.jadwal) localStorage.setItem("master_jadwal", JSON.stringify(db.jadwal));
      if (db.rule_jam_masuk) localStorage.setItem("rule_jam_masuk", db.rule_jam_masuk);
      if (db.rule_jam_toleransi) localStorage.setItem("rule_jam_toleransi", db.rule_jam_toleransi);
      if (db.all_absensi_logs) localStorage.setItem("global_absensi_logs", JSON.stringify(db.all_absensi_logs));
      if (db.all_siswa) localStorage.setItem("global_siswa_list", JSON.stringify(db.all_siswa));

      // Selesai Sinkronisasi -> Munculkan Box Login Sederhana
      document.getElementById("sync-loader").classList.add("hidden");
      document.getElementById("login-box").classList.remove("hidden");
      bindAdminLoginEngine();
    })
    .catch(err => {
      alert("Gagal sinkronisasi data cloud. Aplikasi berjalan dalam offline-cache mode.");
      document.getElementById("sync-loader").classList.add("hidden");
      document.getElementById("login-box").classList.remove("hidden");
      bindAdminLoginEngine();
    });
}

// 3. VALIDASI LOGIN SEDERHANA NAMA SEKOLAH (Fitur 1)
function bindAdminLoginEngine() {
  document.getElementById("admin-login-form").onsubmit = (e) => {
    e.preventDefault();
    const inputName = document.getElementById("school-verify-input").value.trim();

    if (inputName.toLowerCase() === CONFIG_ADMIN.SCHOOL_NAME.toLowerCase()) {
      document.getElementById("admin-auth-container").classList.add("hidden");
      document.getElementById("admin-dashboard-layout").classList.remove("hidden");
      
      // Nyalakan subsistem dashboard
      switchAdminPane('scan');
      populateAdminFilterDropdowns();
      refreshQueueCounterUI();
    } else {
      alert(`Nama validasi salah! Harus berupa "${CONFIG_ADMIN.SCHOOL_NAME}"`);
    }
  };
}

// 4. ROUTER DASHBOARD NAVIGASI PANEL
window.switchAdminPane = function(paneId) {
  document.querySelectorAll(".tab-pane-admin").forEach(p => p.classList.add("hidden"));
  document.querySelectorAll(".sidebar-item").forEach(btn => btn.classList.remove("active"));
  
  document.getElementById(`pane-${paneId}`).classList.remove("hidden");
  
  // Highlight tombol aktif
  const titles = { scan: "Gerbang Scan QR", rekap: "Rekap Absensi Siswa", jadwal: "Aturan Jam & Jadwal" };
  document.getElementById("pane-title-indicator").innerText = titles[paneId];

  // Matikan kamera jika pindah halaman agar hemat baterai/performa
  if (paneId === 'scan') { startQRScannerCamera(); } else { stopQRScannerCamera(); }
  if (paneId === 'rekap') { renderMasterRekapTable(); }
  if (paneId === 'jadwal') { renderJadwalMasterTable(); initJadwalRulesFields(); }
}

// TOGGLE SIDEBAR UNTUK TAMPILAN RESPONSIF (HP/TAB)
window.toggleSidebarMobile = function() {
  const sidebar = document.getElementById("sidebar-nav");
  sidebar.classList.toggle("sidebar-hide");
}

// =========================================================================
// 5. SUBSISTEM CORE A: CAMERA SCAN & OFFLINE FILTER QUEUE (Fitur 2)
// =========================================================================
function startQRScannerCamera() {
  if (qrScannerEngine) { qrScannerEngine.start(); return; }

  qrScannerEngine = new Instascan.Scanner({ video: document.getElementById('webcam-preview-area'), mirror: false });
  
  qrScannerEngine.addListener('scan', function (content) {
    if (content.startsWith("ABSENSR-")) {
      const nisn = content.replace("ABSENSR-", "");
      processInboundScanLog(nisn);
    }
  });

  Instascan.Camera.getCameras().then(function (cameras) {
    if (cameras.length > 0) {
      // Prioritaskan kamera belakang jika diakses lewat HP
      const cameraObj = cameras.length > 1 ? cameras[1] : cameras[0];
      qrScannerEngine.start(cameraObj);
    } else {
      console.error('Kamera video hardware tidak ditemukan.');
    }
  }).catch(function (e) { console.error(e); });
}

function stopQRScannerCamera() {
  if (qrScannerEngine) qrScannerEngine.stop();
}

function processInboundScanLog(nisn) {
  const listSiswa = JSON.parse(localStorage.getItem("global_siswa_list")) || [];
  const siswa = listSiswa.find(s => s.nisn.toString() === nisn.toString());

  const nama = siswa ? siswa.nama : "Siswa Belum Registrasi";
  const kelas = siswa ? siswa.kelas : "-";
  
  const tanggal = new Date().toISOString().split('T')[0];
  const waktu = new Date().toTimeString().split(' ')[0].substring(0, 5);

  // LOGIKA PENILAIAN JALUR WAKTU OTOMATIS
  const jamMasuk = localStorage.getItem("rule_jam_masuk") || "07:30";
  const jamToleransi = localStorage.getItem("rule_jam_toleransi") || "07:45";

  const toMin = (t) => t.split(":").map(Number)[0] * 60 + t.split(":").map(Number)[1];
  const curMin = toMin(waktu), mskMin = toMin(jamMasuk), tlrMin = toMin(jamToleransi);

  let status = "Tepat Waktu";
  if (curMin > mskMin && curMin <= tlrMin) status = "Telat";
  else if (curMin > tlrMin) status = "Alpha";

  const dataScan = { tanggal, waktu, nisn, nama, kelas, status, keterangan: "Scan Gerbang Otomatis" };

  // Tarik Antrean LocalStorage Pending (Fitur 2)
  const queue = JSON.parse(localStorage.getItem("offline_scan_queue")) || [];
  queue.unshift(dataScan); // Masukkan di baris paling atas
  localStorage.setItem("offline_scan_queue", JSON.stringify(queue));

  // Masukkan juga langsung ke data rekap lokal sementara
  const globalLogs = JSON.parse(localStorage.getItem("global_absensi_logs")) || [];
  globalLogs.unshift(dataScan);
  localStorage.setItem("global_absensi_logs", JSON.stringify(globalLogs));

  refreshQueueCounterUI();
  renderScanQueueTable();
  
  // Efek Audio beep jika diperlukan bisa ditambahkan di sini
}

function refreshQueueCounterUI() {
  const queue = JSON.parse(localStorage.getItem("offline_scan_queue")) || [];
  document.getElementById("queue-counter").innerText = queue.length;
}

function renderScanQueueTable() {
  const queue = JSON.parse(localStorage.getItem("offline_scan_queue")) || [];
  const tbody = document.getElementById("scan-queue-table-body");
  tbody.innerHTML = "";

  if (queue.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-400 italic">Belum ada aktivitas scan kartu baru.</td></tr>`;
    return;
  }

  queue.forEach(item => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50";
    tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-bold text-slate-700">${item.waktu}</td>
      <td class="py-3 px-4 font-mono">${item.nisn}</td>
      <td class="py-3 px-4 font-medium text-slate-900">${item.nama}</td>
      <td class="py-3 px-4"><span class="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold">${item.kelas}</span></td>
      <td class="py-3 px-4"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'Tepat Waktu'?'bg-emerald-100 text-emerald-700':item.status==='Telat'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}">${item.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// TOMBOL ACTIONS FLUSH MASSAL UNTUK MENGIRIM QUEUE KE GOOGLE SHEET
window.triggerCloudFlush = function() {
  const queue = JSON.parse(localStorage.getItem("offline_scan_queue")) || [];
  if (queue.length === 0) { alert("Antrean kosong! Tidak ada data scan baru untuk diunggah."); return; }

  // Ubah status ke layar loading
  document.getElementById("queue-counter").innerText = "Mengunggah...";

  fetch(CONFIG_ADMIN.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "sync_absensi", data: queue })
  })
  .then(res => res.json())
  .then(res => {
    if (res.result === "success") {
      alert("Hebat! Seluruh data antrean scan sukses digabungkan ke database cloud.");
      localStorage.removeItem("offline_scan_queue");
      refreshQueueCounterUI();
      renderScanQueueTable();
    }
  })
  .catch(err => {
    alert("Koneksi gagal. Data tetap aman tersimpan di LocalStorage komputer ini.");
    refreshQueueCounterUI();
  });
}

// =========================================================================
// 6. SUBSISTEM CORE B: REKAP ABSENSI, FILTER & GRAFIK VISUAL (Fitur 2)
// =========================================================================
function populateAdminFilterDropdowns() {
  const listKelas = JSON.parse(localStorage.getItem("master_kelas")) || [];
  
  const optionsHtml = `<option value="">Semua Kelas</option>` + listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
  document.getElementById("filter-rekap-kelas").innerHTML = optionsHtml;
  document.getElementById("j-kelas").innerHTML = listKelas.map(k => `<option value="${k}">${k}</option>`).join('');
  document.getElementById("filter-jadwal-kelas").innerHTML = optionsHtml;

  // Bind trigger perubahan filter
  document.getElementById("filter-rekap-kelas").onchange = () => renderMasterRekapTable();
  document.getElementById("filter-rekap-bulan").onchange = () => renderMasterRekapTable();
}

function renderMasterRekapTable() {
  const logs = JSON.parse(localStorage.getItem("global_absensi_logs")) || [];
  const filterKelas = document.getElementById("filter-rekap-kelas").value;
  const filterBulan = document.getElementById("filter-rekap-bulan").value;

  // Proses Filtering Array
  const filteredData = logs.filter(item => {
    const matchKelas = filterKelas === "" || item.kelas === filterKelas;
    const matchBulan = filterBulan === "" || (item.tanggal && item.tanggal.split("-")[1] === filterBulan);
    return matchKelas && matchBulan;
  });

  const tbody = document.getElementById("master-rekap-table-body");
  tbody.innerHTML = "";

  const stats = { "Tepat Waktu": 0, "Telat": 0, "Izin": 0, "Sakit": 0, "Alpha": 0 };

  filteredData.forEach((item, index) => {
    if (stats[item.status] !== undefined) stats[item.status]++;

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition-colors";
    tr.innerHTML = `
      <td class="py-3 px-4 font-medium">${item.tanggal} <span class="text-slate-400 ml-1 font-mono">${item.waktu}</span></td>
      <td class="py-3 px-4 font-mono">${item.nisn}</td>
      <td class="py-3 px-4 font-semibold text-slate-900">${item.nama}</td>
      <td class="py-3 px-4"><span class="bg-slate-100 rounded px-2 py-0.5">${item.kelas}</span></td>
      <td class="py-3 px-4"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${item.status==='Tepat Waktu'?'bg-emerald-100 text-emerald-700':item.status==='Telat'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}">${item.status}</span></td>
      <td class="py-3 px-4 text-slate-500">${item.keterangan || "-"}</td>
      <td class="py-3 px-4 text-center space-x-1">
        <button onclick="openRekapEditModal(${index})" class="rounded-lg bg-slate-100 px-2 py-1 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"><i class="fa-solid fa-marker"></i></button>
        <button onclick="deleteRekapEntry(${index})" class="rounded-lg bg-slate-100 px-2 py-1 text-slate-700 hover:bg-red-50 hover:text-red-600"><i class="fa-solid fa-trash-can"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateAdminGlobalDonutChart(stats);
}

function updateAdminGlobalDonutChart(stats) {
  const ctx = document.getElementById("adminGlobalDonutChart").getContext("2d");
  if (adminChartInstance) adminChartInstance.destroy();

  adminChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(stats),
      datasets: [{
        data: Object.values(stats),
        backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#ef4444']
      }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
  });
}

// ACTIONS EDIT & HAPUS PADA DATA (Fitur 2)
window.openRekapEditModal = function(index) {
  const logs = JSON.parse(localStorage.getItem("global_absensi_logs")) || [];
  const currentItem = logs[index];

  document.getElementById("edit-rekap-index").value = index;
  document.getElementById("edit-rekap-status").value = currentItem.status;
  document.getElementById("edit-rekap-keterangan").value = currentItem.keterangan || "";
  document.getElementById("edit-rekap-modal").classList.remove("hidden");
}

window.closeRekapModal = function() {
  document.getElementById("edit-rekap-modal").classList.add("hidden");
}

window.saveRekapModalChanges = function() {
  const index = document.getElementById("edit-rekap-index").value;
  const logs = JSON.parse(localStorage.getItem("global_absensi_logs")) || [];
  
  logs[index].status = document.getElementById("edit-rekap-status").value;
  logs[index].keterangan = document.getElementById("edit-rekap-keterangan").value.trim();

  localStorage.setItem("global_absensi_logs", JSON.stringify(logs));
  closeRekapModal();
  renderMasterRekapTable();
}

window.deleteRekapEntry = function(index) {
  if (confirm("Apakah Anda yakin ingin menghapus baris rekap absensi ini secara lokal?")) {
    const logs = JSON.parse(localStorage.getItem("global_absensi_logs")) || [];
    logs.splice(index, 1);
    localStorage.setItem("global_absensi_logs", JSON.stringify(logs));
    renderMasterRekapTable();
  }
}

// =========================================================================
// 7. SUBSISTEM CORE C: ATURAN JAM & JADWAL PELAJARAN (Fitur 2)
// =========================================================================
function initJadwalRulesFields() {
  document.getElementById("rule-jam-masuk").value = localStorage.getItem("rule_jam_masuk") || "07:30";
  document.getElementById("rule-jam-toleransi").value = localStorage.getItem("rule_jam_toleransi") || "07:45";

  document.getElementById("form-rule-jam").onsubmit = (e) => {
    e.preventDefault();
    const jam_masuk = document.getElementById("rule-jam-masuk").value;
    const jam_toleransi = document.getElementById("rule-jam-toleransi").value;

    fetch(CONFIG_ADMIN.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "admin_update_jam", data: { jam_masuk, jam_toleransi } })
    }).then(() => {
      localStorage.setItem("rule_jam_masuk", jam_masuk);
      localStorage.setItem("rule_jam_toleransi", jam_toleransi);
      alert("Aturan Batas Waktu Masuk Berhasil Di-publish!");
    });
  };
}

// FORMS SUBMIT KELAS & JADWAL BARU (Fitur 2)
document.getElementById("form-admin-kelas").onsubmit = (e) => {
  e.preventDefault();
  const namaKelas = document.getElementById("input-nama-kelas").value.trim();
  const idKelas = document.getElementById("input-id-kelas").value.trim();

  const currentClasses = JSON.parse(localStorage.getItem("master_kelas")) || [];
  if (!currentClasses.includes(namaKelas)) {
    currentClasses.push(namaKelas);
    localStorage.setItem("master_kelas", JSON.stringify(currentClasses));
  }

  // Kirim Array Terbaru ke Cloud DB
  const rawPayload = currentClasses.map((item, idx) => ({ id_kelas: idKelas || "KLS"+idx, nama_kelas: item }));
  
  fetch(CONFIG_ADMIN.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "admin_update_kelas", data: rawPayload })
  }).then(() => {
    alert(`Kelas ${namaKelas} Sukses Ditambahkan!`);
    document.getElementById("form-admin-kelas").reset();
    populateAdminFilterDropdowns();
  });
};

document.getElementById("form-admin-jadwal").onsubmit = (e) => {
  e.preventDefault();
  const newJadwal = {
    id_jadwal: document.getElementById("j-id").value.trim(),
    id_kelas: document.getElementById("j-kelas").value,
    hari: document.getElementById("j-hari").value,
    mapel: document.getElementById("j-mapel").value.trim(),
    jam_mulai: document.getElementById("j-mulai").value,
    jam_selesai: document.getElementById("j-selesai").value
  };

  const listJadwal = JSON.parse(localStorage.getItem("master_jadwal")) || [];
  listJadwal.push(newJadwal);
  localStorage.setItem("master_jadwal", JSON.stringify(listJadwal));

  fetch(CONFIG_ADMIN.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "admin_update_jadwal", data: listJadwal })
  }).then(() => {
    alert("Jadwal Baru Sukses Di-push ke Cloud Database!");
    document.getElementById("form-admin-jadwal").reset();
    renderJadwalMasterTable();
  });
};

window.renderJadwalMasterTable = function() {
  const listJadwal = JSON.parse(localStorage.getItem("master_jadwal")) || [];
  const filterKelas = document.getElementById("filter-jadwal-kelas").value;
  const tbody = document.getElementById("master-jadwal-table-body");
  tbody.innerHTML = "";

  const filtered = listJadwal.filter(j => filterKelas === "" || j.id_kelas === filterKelas);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400 italic">Tidak ada jadwal terdaftar untuk filter kelas ini.</td></tr>`;
    return;
  }

  filtered.forEach((item, index) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50";
    tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-bold">${item.id_jadwal}</td>
      <td class="py-3 px-4"><span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">${item.id_kelas}</span></td>
      <td class="py-3 px-4 font-medium">${item.hari}</td>
      <td class="py-3 px-4 text-slate-900 font-semibold">${item.mapel}</td>
      <td class="py-3 px-4 font-mono text-slate-500">${item.jam_mulai} - ${item.jam_selesai}</td>
      <td class="py-3 px-4 text-center">
        <button onclick="deleteJadwalEntry(${index})" class="text-slate-400 hover:text-red-600 px-2 py-1"><i class="fa-solid fa-trash-can"></i> Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.deleteJadwalEntry = function(index) {
  if (confirm("Hapus item jadwal pelajaran ini?")) {
    const listJadwal = JSON.parse(localStorage.getItem("master_jadwal")) || [];
    listJadwal.splice(index, 1);
    localStorage.setItem("master_jadwal", JSON.stringify(listJadwal));
    
    fetch(CONFIG_ADMIN.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "admin_update_jadwal", data: listJadwal })
    }).then(() => { renderJadwalMasterTable(); });
  }
}

// =========================================================================
// 8. SUBSISTEM CORE D: EKSPOR FILE KE CSV RAPI (Fitur 2)
// =========================================================================
window.exportRekapToCSV = function() {
  const logs = JSON.parse(localStorage.getItem("global_absensi_logs")) || [];
  const filterKelas = document.getElementById("filter-rekap-kelas").value || "Semua-Kelas";
  
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "NO,TANGGAL,JAM,NISN,NAMA LENGKAP,KELAS,STATUS KEHADIRAN,KETERANGAN\n";

  logs.forEach((item, index) => {
    const row = [
      index + 1,
      item.tanggal,
      item.waktu,
      `="${item.nisn}"`, // Bungkus rumus excel agar angka NISN tidak terpotong (Truncated)
      `"${item.nama.toUpperCase()}"`,
      `"${item.kelas}"`,
      `"${item.status}"`,
      `"${item.keterangan || '-'}"`
    ].join(",");
    csvContent += row + "\n";
  });

  triggerCSVDownload(`REKAP_ABSENSI_MAN2_${filterKelas.toUpperCase()}.csv`, csvContent);
}

window.exportJadwalToCSV = function() {
  const listJadwal = JSON.parse(localStorage.getItem("master_jadwal")) || [];
  const filterKelas = document.getElementById("filter-jadwal-kelas").value || "Semua-Kelas";

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "ID JADWAL,KELAS,HARI,MATA PELAJARAN,JAM MULAI,JAM SELESAI\n";

  listJadwal.forEach(item => {
    const row = [item.id_jadwal, item.id_kelas, item.hari, `"${item.mapel}"`, item.jam_mulai, item.jam_selesai].join(",");
    csvContent += row + "\n";
  });

  triggerCSVDownload(`JADWAL_PELAJARAN_MAN2_${filterKelas.toUpperCase()}.csv`, csvContent);
}

function triggerCSVDownload(fileName, encodedContent) {
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(encodedContent));
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

window.executeAdminLogout = function() {
  if (confirm("Keluar dari panel administrasi madrasah?")) {
    window.location.reload();
  }
}