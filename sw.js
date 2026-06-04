// Menangani kemunculan notifikasi sistem di bar status perangkat
self.addEventListener('push', function(event) {
  let data = { judul: 'MAN 2 Sijunjung', pesan: 'Waktunya absen masuk pagi!' };
  
  if (event.data) {
    try { 
      data = event.json(); 
    } catch (e) { 
      data.pesan = event.data.text(); 
    }
  }

  const opsi = {
    body: data.pesan,
    icon: './foto/1.webp', // Ikon utama di dalam banner notifikasi
    badge: './foto/1.webp', // Ikon kecil transparan yang muncul di bar atas status HP
    vibrate: [200, 100, 200], // Efek getar pola pesan masuk
    requireInteraction: true // Notifikasi tidak akan hilang sampai diklik/ditutup siswa
  };

  event.waitUntil(
    self.registration.showNotification(data.judul, opsi)
  );
});

// Aksi ketika banner notifikasi di bar status diklik oleh siswa
self.addEventListener('notificationclick', function(event) {
  event.notification.close(); // Tutup banner
  
  // Menentukan path tujuan secara dinamis berdasarkan lokasi aplikasi terinstal
  // Ini akan otomatis mendeteksi apakah di localhost atau sub-folder GitHub Pages
  const urlTujuan = new URL('siswa.html', self.location.origin + self.location.pathname).href;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // 1. Jika tab aplikasi sudah terbuka di browser, fokuskan ke tab tersebut
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url === urlTujuan && 'focus' in client) {
          return client.focus();
        }
      }
      // 2. Jika tab belum terbuka, buka tab baru dengan URL yang tepat
      if (clients.openWindow) {
        return clients.openWindow(urlTujuan);
      }
    })
  );
});