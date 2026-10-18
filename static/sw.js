// UnterrichtsManager Service Worker with Web Push Support
const CACHE_NAME = 'unterrichtsmanager-v1';

self.addEventListener('install', (event) => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(self.clients.claim());
});

// Push notification received
self.addEventListener('push', (event) => {
	let data = {
		title: 'UnterrichtsManager',
		body: 'Du hast offene Fristen oder anstehende Termine.',
		url: '/'
	};

	try {
		if (event.data) {
			data = event.data.json();
		}
	} catch (e) {
		if (event.data) {
			data.body = event.data.text();
		}
	}

	const options = {
		body: data.body,
		icon: '/icon.svg',
		badge: '/icon.svg',
		vibrate: [100, 50, 100],
		data: {
			url: data.url || '/'
		}
	};

	event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification click handler -> navigate to target URL
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const targetUrl = event.notification.data?.url || '/';

	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if (client.url === targetUrl && 'focus' in client) {
					return client.focus();
				}
			}
			if (self.clients.openWindow) {
				return self.clients.openWindow(targetUrl);
			}
		})
	);
});
