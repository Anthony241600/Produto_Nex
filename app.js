// ========================================
// APP.JS - SENAI Gamificação
// ========================================

(function () {
    'use strict';

    // ---- Estado da aplicação ----
    var csvData = [];           // Array de linhas do CSV (cada linha é array de campos)
    var csvFileName = '';       // Nome do arquivo CSV carregado
    var csvSeparator = ';';    // Separador do CSV
    var tarefaAtiva = null;     // Qual tarefa está ativa: 1, 2 ou 3

    // ---- Imagens de cada tarefa ----
    var tarefaImagens = {
        1: ['imagens/imagem-01.png', 'imagens/imagem-02.png', 'imagens/imagem-03.png'],
        2: ['imagens/imagem-04.png', 'imagens/imagem-05.png', 'imagens/imagem-06.png'],
        3: ['imagens/imagem-07.png', 'imagens/imagem-08.png', 'imagens/imagem-09.png']
    };


    // ========================================
    // ACESSO AOS CSVs
    // Funciona de 2 jeitos:
    //  - COM servidor Node (server.js): usa a API  (api/csv-list, api/csv/<nome>)
    //  - SEM servidor (GitHub Pages): lê csv/index.json e csv/<nome>;
    //    ao encerrar a atividade, guarda no navegador (localStorage) e baixa o CSV.
    // Obs.: caminhos SEM "/" no início, para funcionar em github.io/<repositorio>/
    // ========================================
    var modoEstatico = false;

    function listarCSVs() {
        return fetch('api/csv-list')
            .then(function (r) {
                if (!r.ok) throw new Error('sem API');
                return r.json();
            })
            .catch(function () {
                modoEstatico = true;
                return fetch('csv/index.json', { cache: 'no-cache' }).then(function (r) {
                    if (!r.ok) throw new Error('csv/index.json não encontrado');
                    return r.json();
                });
            });
    }

    function lerCSV(nome) {
        if (modoEstatico) {
            try {
                var salvo = localStorage.getItem('csv:' + nome);
                if (salvo) return Promise.resolve(salvo);
            } catch (e) { /* localStorage indisponível */ }
            return fetch('csv/' + encodeURIComponent(nome), { cache: 'no-cache' }).then(function (r) {
                if (!r.ok) throw new Error('Erro ao ler CSV');
                return r.text();
            });
        }
        return fetch('api/csv/' + encodeURIComponent(nome)).then(function (r) {
            if (!r.ok) throw new Error('Erro ao ler CSV');
            return r.text();
        });
    }

    function baixarArquivo(nome, conteudo) {
        var blob = new Blob(['\ufeff' + conteudo], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nome;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }

    function salvarCSV(nome, conteudo) {
        if (modoEstatico) {
            try { localStorage.setItem('csv:' + nome, conteudo); } catch (e) { /* ignora */ }
            baixarArquivo(nome, conteudo);
            return Promise.resolve({ local: true });
        }
        return fetch('api/csv/' + encodeURIComponent(nome), {
            method: 'POST',
            headers: { 'Content-Type': 'text/csv; charset=utf-8' },
            body: conteudo
        }).then(function (r) {
            if (!r.ok) throw new Error('Erro ao salvar - status: ' + r.status);
            return r.json();
        });
    }

    // ---- Elementos do DOM ----
    var splashScreen = document.getElementById('splash-screen');
    var mainScreen = document.getElementById('main-screen');
    var csvSelect = document.getElementById('csv-select');
    var tabelaContainer = document.getElementById('tabela-container');
    var encerrarContainer = document.getElementById('encerrar-container');
    var encerrarBtn = document.getElementById('encerrar-btn');
    var tarefa1Btn = document.getElementById('tarefa1-btn');
    var tarefa2Btn = document.getElementById('tarefa2-btn');
    var tarefa3Btn = document.getElementById('tarefa3-btn');
    var hbgBtn = document.getElementById('hamburger-btn');
    var popup = document.getElementById('popup')

    // ========================================
    // SPLASH SCREEN - exibe por 3 segundos
    // ========================================
    setTimeout(function () {
        splashScreen.classList.add('hidden');
        mainScreen.classList.add('visible');
        // Carregar lista de CSVs assim que a tela principal aparecer
        carregarListaCSV();
    }, 3000);

    //=========================================
    //POP UP
    //=========================================
    let visivel = false;
    popup.classList.add('hidden')
    hbgBtn.addEventListener('click', () => {
        if(visivel == false){
            popup.classList.remove('hidden')
            visivel = true
        }
        else{
            popup.classList.add('hidden')
            visivel = false
        }
    })

    // ========================================
    // CARREGAR LISTA DE ARQUIVOS CSV
    // ========================================
    function carregarListaCSV() {
        listarCSVs()
            .then(function (files) {
                // Limpar opções existentes (exceto a primeira)
                csvSelect.innerHTML = '<option value="">-- Selecione uma turma --</option>';

                files.forEach(function (filename) {
                    var option = document.createElement('option');
                    option.value = filename;
                    option.textContent = filename;
                    csvSelect.appendChild(option);
                });
            })
            .catch(function (err) {
                console.error('Erro ao carregar lista de CSVs:', err);
                alert('Erro ao carregar a lista de arquivos CSV.');
            });
    }

    // ========================================
    // COMBOBOX: ao selecionar um CSV
    // ========================================
    csvSelect.addEventListener('change', function () {
        var selectedFile = csvSelect.value;
        if (!selectedFile) {
            csvData = [];
            csvFileName = '';
            tarefaAtiva = null;
            resetBotoesTarefa();
            renderTable();
            return;
        }

        csvFileName = selectedFile;

        lerCSV(selectedFile)
            .then(function (text) {
                processCSV(text);
            })
            .catch(function (err) {
                console.error('Erro ao carregar CSV:', err);
                alert('Erro ao carregar o arquivo: ' + selectedFile);
            });
    });

    // ========================================
    // PROCESSAR CSV
    // ========================================
    function processCSV(text) {
        // Detectar separador: se contiver ';' usa ';', senão usa ','
        csvSeparator = text.indexOf(';') !== -1 ? ';' : ',';

        var lines = text.trim().split(/\r?\n/);
        csvData = [];

        for (var i = 0; i < lines.length; i++) {
            if (lines[i].trim() === '') continue; // pular linhas vazias
            var fields = lines[i].split(csvSeparator);
            csvData.push(fields);
        }

        // Reset estado de tarefa
        tarefaAtiva = null;
        resetBotoesTarefa();
        renderTable();
    }

    // ========================================
    // RENDERIZAR TABELA
    // ========================================
    function renderTable() {
        if (csvData.length === 0) {
            tabelaContainer.innerHTML = '';
            encerrarContainer.style.display = 'none';
            return;
        }

        // Determinar quantas colunas existem no CSV (do header)
        var numColunasCSV = csvData[0].length;
        // Verificar se existem colunas numéricas (além do nome) para mostrar a coluna Soma
        var temColunasNumericas = numColunasCSV > 1;

        var table = document.createElement('table');

        // ---- THEAD ----
        var thead = document.createElement('thead');
        var headerRow = document.createElement('tr');

        // Renderizar TODAS as colunas do header do CSV
        for (var h = 0; h < numColunasCSV; h++) {
            var th = document.createElement('th');
            var headerText = csvData[0][h] ? csvData[0][h].trim() : '';
            // Primeira coluna sempre mostra "Nome do Aluno"
            if (h === 0) {
                th.textContent = 'Nome do Aluno';
            } else {
                th.textContent = headerText;
            }
            headerRow.appendChild(th);
        }

        // Se tarefa ativa, adicionar colunas de imagem DEPOIS das colunas existentes
        if (tarefaAtiva && tarefaImagens[tarefaAtiva]) {
            var imgs = tarefaImagens[tarefaAtiva];
            for (var imgIdx = 0; imgIdx < imgs.length; imgIdx++) {
                var thImg = document.createElement('th');
                var img = document.createElement('img');
                img.src = imgs[imgIdx];
                img.alt = 'Atividade ' + (imgIdx + 1);
                img.width = 72;
                img.height = 72;
                thImg.appendChild(img);
                headerRow.appendChild(thImg);
            }
        }

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // ---- TBODY ----
        var tbody = document.createElement('tbody');

        // Pular header do CSV (linha 0)
        for (var i = 1; i < csvData.length; i++) {
            var nomeAluno = csvData[i][0] ? csvData[i][0].trim() : '';
            if (!nomeAluno) continue; // pular linhas vazias

            var tr = document.createElement('tr');
            var somaLinha = 0;

            // Renderizar TODAS as colunas de dados do CSV
            for (var col = 0; col < numColunasCSV; col++) {
                var tdData = document.createElement('td');
                var cellValue = csvData[i][col] ? csvData[i][col].trim() : '';
                tdData.textContent = cellValue;
                tr.appendChild(tdData);

                // Somar valores numéricos (colunas a partir da 1)
                
            }

            // Colunas de pontuação (se tarefa ativa)
            if (tarefaAtiva && tarefaImagens[tarefaAtiva]) {
                for (var j = 0; j < tarefaImagens[tarefaAtiva].length; j++) {
                    var td = document.createElement('td');
                    td.classList.add('cell-clickable');
                    td.textContent = '0';
                    td.dataset.row = i;
                    td.dataset.col = j;

                    // Evento de clique/toque: toggle 0 <-> 1
                    td.addEventListener('click', createToggleHandler(td));

                    tr.appendChild(td);
                }
            }

            tbody.appendChild(tr);
        }

        table.appendChild(tbody);

        tabelaContainer.innerHTML = '';
        tabelaContainer.appendChild(table);

        // Mostrar botão encerrar se tarefa ativa
        encerrarContainer.style.display = tarefaAtiva ? 'block' : 'none';
    }

    // ========================================
    // TOGGLE CÉLULA (0 <-> 1)
    // ========================================
    function createToggleHandler(td) {
        return function () {
            if (td.textContent === '0') {
                td.textContent = '1';
                td.classList.add('active');
            } else {
                td.textContent = '0';
                td.classList.remove('active');
            }
        };
    }

    // ========================================
    // BOTÕES DE TAREFA
    // ========================================
    function resetBotoesTarefa() {
        var btns = document.querySelectorAll('.tarefa-btn');
        for (var b = 0; b < btns.length; b++) {
            btns[b].classList.remove('active-task');
        }
    }

    function ativarTarefa(numTarefa) {
        if (csvData.length === 0) {
            alert('Por favor, selecione um arquivo CSV primeiro.');
            return;
        }

        tarefaAtiva = numTarefa;

        // Atualizar estado visual dos botões
        resetBotoesTarefa();
        document.getElementById('tarefa' + numTarefa + '-btn').classList.add('active-task');

        renderTable();
    }

    tarefa1Btn.addEventListener('click', function () { ativarTarefa(1); });
    tarefa2Btn.addEventListener('click', function () { ativarTarefa(2); });
    tarefa3Btn.addEventListener('click', function () { ativarTarefa(3); });

    // ========================================
    // ENCERRAR ATIVIDADE
    // ========================================
    encerrarBtn.addEventListener('click', function () {
        if (csvData.length === 0 || !tarefaAtiva || !csvFileName) {
            console.log('Encerrar: condições não atendidas', { csvDataLen: csvData.length, tarefaAtiva: tarefaAtiva, csvFileName: csvFileName });
            return;
        }

        // Obter data atual no formato dd/mm/yyyy
        var now = new Date();
        var dia = ('0' + now.getDate()).slice(-2);
        var mes = ('0' + (now.getMonth() + 1)).slice(-2);
        var dataAtual = dia + '/' + mes;

        // Ler valores da tabela
        var table = tabelaContainer.querySelector('table');
        if (!table) {
            console.log('Encerrar: tabela não encontrada');
            return;
        }

        var rows = table.querySelectorAll('tbody tr');
        var somas = [];

        for (var r = 0; r < rows.length; r++) {
            var cells = rows[r].querySelectorAll('td.cell-clickable');
            var soma = 0;
            for (var c = 0; c < cells.length; c++) {
                soma += parseInt(cells[c].textContent, 10) || 0;
            }
            somas.push(soma);
        }

        console.log('Somas calculadas:', somas);
        console.log('csvData ANTES:', JSON.stringify(csvData));

        // Atualizar csvData: adicionar nova coluna com a soma
        // Header: adicionar data
        csvData[0].push(dataAtual);

        // Dados: adicionar soma para cada aluno
        var somaIndex = 0;
        for (var i = 1; i < csvData.length; i++) {
            var nomeAluno = csvData[i][0] ? csvData[i][0].trim() : '';
            if (!nomeAluno) continue;
            csvData[i].push(String(somas[somaIndex] || 0));
            somaIndex++;
        }

        // Gerar conteúdo CSV usando separador ';'
        var csvContent = '';
        for (var i = 0; i < csvData.length; i++) {
            csvContent += csvData[i].join(';') + '\r\n';
        }

        console.log('csvData DEPOIS:', JSON.stringify(csvData));
        console.log('CSV a ser salvo:\n' + csvContent);

        // Salvar (servidor Node: grava o arquivo | site estático: guarda no navegador e baixa)
        var fileToReload = csvFileName;
        salvarCSV(fileToReload, csvContent)
        .then(function (resultado) {
            if (resultado && resultado.local) {
                alert('Atividade encerrada!\nColuna "' + dataAtual + '" adicionada.\n\nComo o site não tem servidor, o arquivo "' + fileToReload + '" foi baixado e a turma ficou salva neste navegador.\nPara publicar, substitua o arquivo na pasta csv/ do repositório.');
            } else {
                alert('Atividade encerrada!\nArquivo "' + fileToReload + '" atualizado com sucesso.\nColuna "' + dataAtual + '" adicionada.');
            }

            tarefaAtiva = null;
            resetBotoesTarefa();
            return lerCSV(fileToReload);
        })
        .then(function (text) {
            processCSV(text);
        })
        .catch(function (err) {
            console.error('Erro ao salvar CSV:', err);
            alert('Erro ao salvar o arquivo.\n' + err.message);
        });
    });

})();
