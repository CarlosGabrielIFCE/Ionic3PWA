/**
 * Check out https://googlechromelabs.github.io/sw-toolbox/ for
 * more info on how to use sw-toolbox to custom configure your service worker.
 */


'use strict';
importScripts('./build/sw-toolbox.js');

const CACHE_APP_SHELL = 'task-cache-app-shell';
const CACHE_APP_DATA = 'task-cache-app-data';

self.toolbox.options.debug = true;

self.toolbox.options.cache = {
  name: CACHE_APP_SHELL
};

// pre-cache our key assets
self.toolbox.precache(
  [
    './assets/icon/icon-48x48.png',
    './assets/icon/icon-72x72.png',
    './assets/icon/icon-96x96.png',
    './assets/icon/icon-144x144.png',
    './assets/icon/icon-168x168.png',
    './assets/icon/icon-192x192.png',
    './build/main.js',
    './build/vendor.js',
    './build/main.css',
    './build/polyfills.js',
    'index.html',
    'manifest.json'
  ]
);

// for API requests
self.toolbox.router.any('/*', self.toolbox.networkFirst, {
  cache: {
    name: CACHE_APP_DATA
  },
  origin: 'http://localhost:3000'
});

// dynamically cache any other local assets
self.toolbox.router.any('/*', self.toolbox.fastest);

// for any other requests go to the network, cache,
// and then only use that cached resource if your user goes offline
self.toolbox.router.default = self.toolbox.networkFirst;

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
