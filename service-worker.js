// ========================================
// SERVICE WORKER - SENAI Gamificação PWA
// ========================================

var CACHE_NAME = 'senai-gamificacao-v4';

var ASSETS_TO_CACHE = [
    './',
    'index.html',
    'style.css',
    'app.js',
    'manifest.json',
    'imagens/senai-logo.png',
    'imagens/logoNexus1.png',
    'imagens/logoNexus2.png',
    'imagens/icon-192.png',
    'imagens/icon-512.png',
    'imagens/imagem-01.png',
    'imagens/imagem-02.png',
    'imagens/imagem-03.png',
    'imagens/imagem-04.png',
    'imagens/imagem-05.png',
    'imagens/imagem-06.png',
    'imagens/imagem-07.png',
    'imagens/imagem-08.png',
    'imagens/imagem-09.png',
    'imagens/imagem-10.png',
    'imagens/imagem-11.png',
    'Google_Sans_Flex/GoogleSansFlex-VariableFont_GRAD,ROND,opsz,slnt,wdth,wght.ttf'
];

// Instalar: cachear todos os assets estáticos
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            console.log('[SW] Cache aberto, adicionando assets...');
            // Cacheia um por um: se algum arquivo faltar (404), os outros
            // são salvos e a instalação NÃO falha (addAll falharia tudo).
            return Promise.all(ASSETS_TO_CACHE.map(function (url) {
                return cache.add(url).catch(function (e) {
                    console.log('[SW] Nao cacheado:', url);
                });
            }));
        })
    );
    self.skipWaiting();
});

// Ativar: limpar caches antigos
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.map(function (name) {
                    if (name !== CACHE_NAME) {
                        console.log('[SW] Removendo cache antigo:', name);
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch: Network first para API, Cache first para assets
self.addEventListener('fetch', function (event) {
    var url = event.request.url;

    // Requisições da API: sempre buscar da rede (nunca cachear)
    if (url.indexOf('/api/') !== -1 || url.indexOf('/csv/') !== -1) {
        event.respondWith(
            fetch(event.request).catch(function () {
                return new Response(JSON.stringify({ error: 'Sem conexão com o servidor' }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // Só tratar GET
    if (event.request.method !== 'GET') return;

    // Assets estáticos: NETWORK FIRST (sempre tenta a rede e atualiza o cache;
    // só usa o cache se estiver offline). Assim, alterações em CSS/JS/HTML
    // aparecem com um F5 normal.
    event.respondWith(
        fetch(event.request, { cache: 'no-cache' }).then(function (networkResponse) {
            if (networkResponse && networkResponse.status === 200) {
                var responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(event.request, responseClone);
                });
            }
            return networkResponse;
        }).catch(function () {
            return caches.match(event.request);
        })
    );
});
