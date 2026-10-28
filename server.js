// ========================================
// SERVER.JS - Servidor local com API para CSVs
// ========================================

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8081;
const BASE_DIR = __dirname;
const CSV_DIR = path.join(BASE_DIR, 'csv');

// Tipos MIME para arquivos estáticos
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',        
    '.ico': 'image/x-icon',
    '.csv': 'text/csv; charset=utf-8',
    '.bmp': 'image/bmp'
};

const server = http.createServer(function (req, res) {
    const method = req.method;
    const url = req.url.split('?')[0]; // ignorar query strings

    // ---- API: Listar arquivos CSV ----
    if (method === 'GET' && url === '/api/csv-list') {
        fs.readdir(CSV_DIR, function (err, files) {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Erro ao ler diretório csv/' }));
                return;
            }
            var csvFiles = files.filter(function (f) {
                return f.toLowerCase().endsWith('.csv');
            });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(csvFiles));
        });
        return;
    }

    // ---- API: Ler um arquivo CSV ----
    if (method === 'GET' && url.startsWith('/api/csv/')) {
        var filename = decodeURIComponent(url.replace('/api/csv/', ''));
        // Segurança: impedir path traversal
        if (filename.indexOf('..') !== -1 || filename.indexOf('/') !== -1) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Nome de arquivo inválido' }));
            return;
        }
        var filePath = path.join(CSV_DIR, filename);
        fs.readFile(filePath, 'utf-8', function (err, data) {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Arquivo não encontrado' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' });
            res.end(data);
        });
        return;
    }

    // ---- API: Salvar (sobrescrever) um arquivo CSV ----
    if (method === 'POST' && url.startsWith('/api/csv/')) {
        var filename = decodeURIComponent(url.replace('/api/csv/', ''));
        if (filename.indexOf('..') !== -1 || filename.indexOf('/') !== -1) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Nome de arquivo inválido' }));
            return;
        }
        var filePath = path.join(CSV_DIR, filename);
        var body = '';
        req.on('data', function (chunk) {
            body += chunk;
        });
        req.on('end', function () {
            fs.writeFile(filePath, body, 'utf-8', function (err) {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Erro ao salvar arquivo' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, message: 'Arquivo salvo com sucesso' }));
            });
        });
        return;
    }

    // ---- Servir arquivos estáticos ----
    var filePath = url === '/' ? '/index.html' : url;
    filePath = path.join(BASE_DIR, decodeURIComponent(filePath));

    // Segurança: não permitir acesso fora do diretório base
    if (!filePath.startsWith(BASE_DIR)) {
        res.writeHead(403);
        res.end('Acesso negado');
        return;
    }

    var ext = path.extname(filePath).toLowerCase();
    var contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, function (err, data) {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('Arquivo não encontrado: ' + url);
            } else {
                res.writeHead(500);
                res.end('Erro interno do servidor');
            }
            return;
        }
        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache'   // navegador sempre revalida (usa ETag/304 do cliente)
        });
        res.end(data);
    });
});

server.listen(PORT, function () {
    console.log('=================================');
    console.log('  SENAI Gamificação - Servidor');
    console.log('  http://localhost:' + PORT);
    console.log('=================================');
});
