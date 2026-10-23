// sw.js - Service Worker لتشغيل النظام المحاسبي والمخزني أوفلاين بالكامل 100% بدون إنترنت

const CACHE_NAME = 'smart-acc-v12-cache';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/main.css',
    './js/models.js',
    './js/storage.js',
    './js/engine.js',
    './js/inventory.js',
    './js/ui.js',
    './js/app.js',
    './manifest.json',
    './app_icon.ico',
    './icons/app_icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// تثبيت الـ Service Worker وحفظ الملفات في الكاش
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 جاري حفظ ملفات النظام في الذاكرة التخزينية للعمل أوفلاين...');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// تفعيل وتنظيف الكاش القديم
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('🧹 تنظيف الكاش القديم:', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// جلب الملفات من الكاش أثناء انقطاع الإنترنت أو التواجد أوفلاين
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            }).catch(() => {
                // إذا انقطع النت، إرجاع الصفحة الرئيسية المخزنة
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
