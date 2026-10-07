/* WH Management service worker — push notifications */
self.addEventListener("push", (event) => {
  let data = { title: "WH Management", body: "", url: "/dashboard" };
  try {
    data = event.data.json();
  } catch (e) {
    // abaikan
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(clients.openWindow(url));
});
