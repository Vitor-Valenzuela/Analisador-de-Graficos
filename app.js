// Estado global
let appData = {
    data: [],
    columns: [],
    fileName: '',
    currentTheme: localStorage.getItem('theme') || 'dark',
    currentChart: null,
    allSheets: {}, // Armazenar todas as abas
    selectedSheets: [], // Abas selecionadas
    sheetNames: [] // Nomes das abas
};

// Inicializar
document.addEventListener('DOMContentLoaded', function() {
    applyTheme(appData.currentTheme);
    showEmptyState();
});

// ========== TEMAS ==========
function changeTheme(theme) {
    appData.currentTheme = theme;
    localStorage.setItem('theme', theme);
    applyTheme(theme);
    updateThemeButtons(theme);
    showNotification(`✨ Tema "${theme}" aplicado!`);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

function updateThemeButtons(theme) {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[onclick="changeTheme('${theme}')"]`).classList.add('active');
}

// ========== ARQUIVO ==========
function handleFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    appData.fileName = file.name;
    const ext = file.name.split('.').pop().toLowerCase();

    try {
        if (ext === 'csv') {
            readCSV(file);
        } else if (['xlsx', 'xls'].includes(ext)) {
            readExcel(file);
        } else if (ext === 'json') {
            readJSON(file);
        } else {
            showNotification('❌ Formato não suportado', 'error');
        }
    } catch (error) {
        showNotification(`❌ Erro: ${error.message}`, 'error');
        console.error(error);
    }
}

function readCSV(file) {
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            if (results.data && results.data.length > 0) {
                appData.data = results.data;
                appData.columns = Object.keys(results.data[0]);
                appData.allSheets = { 'Dados': results.data };
                appData.selectedSheets = ['Dados'];
                document.getElementById('sheetsSection').style.display = 'none';
                updateUI();
                showNotification(`✅ Arquivo carregado! ${appData.data.length} linhas`);
            } else {
                showNotification('❌ Arquivo vazio', 'error');
            }
        },
        error: function(error) {
            showNotification(`❌ Erro: ${error.message}`, 'error');
        }
    });
}

function readExcel(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                showNotification('❌ Nenhuma planilha encontrada', 'error');
                return;
            }

            appData.sheetNames = workbook.SheetNames;
            appData.allSheets = {};

            // Carregar todas as abas
            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet);
                appData.allSheets[sheetName] = rows;
            });

            // Mostrar seletor de abas
            if (appData.sheetNames.length > 1) {
                showSheetSelector(appData.sheetNames);
                showNotification(`✅ ${appData.sheetNames.length} planilhas encontradas! Selecione quais carregar.`);
            } else {
                // Se tiver apenas uma aba, carregar automaticamente
                appData.data = appData.allSheets[appData.sheetNames[0]];
                appData.columns = Object.keys(appData.data[0] || {});
                appData.selectedSheets = appData.sheetNames;
                updateUI();
                showNotification(`✅ Arquivo carregado! ${appData.data.length} linhas`);
            }
        } catch (error) {
            showNotification(`❌ Erro ao ler Excel: ${error.message}`, 'error');
            console.error(error);
        }
    };

    reader.onerror = function() {
        showNotification('❌ Erro ao ler arquivo', 'error');
    };

    reader.readAsArrayBuffer(file);
}

function readJSON(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const json = JSON.parse(e.target.result);
            
            if (Array.isArray(json) && json.length > 0) {
                appData.data = json;
                appData.columns = Object.keys(json[0]);
                appData.allSheets = { 'Dados': json };
                appData.selectedSheets = ['Dados'];
                document.getElementById('sheetsSection').style.display = 'none';
                updateUI();
                showNotification(`✅ Arquivo carregado! ${appData.data.length} linhas`);
            } else {
                showNotification('❌ JSON inválido', 'error');
            }
        } catch (error) {
            showNotification(`❌ Erro: ${error.message}`, 'error');
        }
    };

    reader.readAsText(file);
}

function showSheetSelector(sheetNames) {
    let html = '';
    sheetNames.forEach(name => {
        html += `
            <label class="sheet-checkbox">
                <input type="checkbox" value="${name}" checked>
                ${name}
            </label>
        `;
    });

    document.getElementById('sheetsList').innerHTML = html;
    document.getElementById('sheetsSection').style.display = 'block';
}

function loadSelectedSheets() {
    const checkboxes = document.querySelectorAll('.sheet-checkbox input:checked');
    const selected = Array.from(checkboxes).map(cb => cb.value);

    if (selected.length === 0) {
        showNotification('❌ Selecione ao menos uma planilha', 'error');
        return;
    }

    appData.selectedSheets = selected;

    // Combinar dados de todas as abas selecionadas
    appData.data = [];
    appData.columns = new Set();

    selected.forEach(sheetName => {
        const sheetData = appData.allSheets[sheetName] || [];
        sheetData.forEach(row => {
            appData.data.push({ ...row, '_sheet': sheetName });
        });
        sheetData.forEach(row => {
            Object.keys(row).forEach(col => appData.columns.add(col));
        });
    });

    appData.columns = Array.from(appData.columns);

    updateUI();
    showNotification(`✅ ${selected.length} planilha(s) carregada(s)! ${appData.data.length} linhas totais`);
}

function updateUI() {
    document.getElementById('fileInfo').innerHTML = `
        <strong>📁 ${appData.fileName}</strong><br>
        ${appData.data.length} linhas × ${appData.columns.length} colunas<br>
        ${appData.selectedSheets.length > 1 ? `(${appData.selectedSheets.length} abas)` : ''}
    `;
    
    document.getElementById('settingsInfo').innerHTML = `
        <strong>${appData.fileName}</strong><br>
        ${appData.data.length} linhas | ${appData.columns.length} colunas<br>
        ${appData.selectedSheets.join(', ')}
    `;
    
    updateColumnSelects();
    renderDashboard();
}

function updateColumnSelects() {
    const numericCols = appData.columns.filter(col => {
        if (!appData.data[0]) return false;
        const val = appData.data[0][col];
        return !isNaN(val) && val !== '';
    });

    const select = document.getElementById('chartColumn');
    select.innerHTML = (numericCols.length > 0 ? numericCols : appData.columns)
        .map(col => `<option value="${col}">${col}</option>`)
        .join('');
}

// ========== NAVEGAÇÃO ==========
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    if (appData.data.length === 0) {
        showEmptyState();
        return;
    }

    switch(pageId) {
        case 'dashboard': renderDashboard(); break;
        case 'analytics': renderAnalytics(); break;
        case 'charts': generateChart(); break;
        case 'comparison': renderComparison(); break;
        case 'statistics': renderStatistics(); break;
        case 'export': renderExport(); break;
    }
}

function showEmptyState() {
    document.getElementById('dashboardContent').innerHTML = `
        <div class="empty-state">
            <div class="icon">📊</div>
            <h3>Nenhum arquivo carregado</h3>
            <p>Clique em "📂 Abrir Arquivo" para começar</p>
        </div>
    `;
}

// ========== DASHBOARD ==========
function renderDashboard() {
    const stats = getStats();
    
    let html = '<div class="stat-grid">';
    html += `<div class="stat-card"><div class="label">Linhas</div><div class="value">${stats.rows}</div></div>`;
    html += `<div class="stat-card"><div class="label">Colunas</div><div class="value">${stats.cols}</div></div>`;
    html += `<div class="stat-card"><div class="label">Faltantes</div><div class="value">${stats.missing}%</div></div>`;
    html += `<div class="stat-card"><div class="label">Abas</div><div class="value">${appData.selectedSheets.length}</div></div>`;
    html += '</div>';

    html += '<div class="card"><h3>Colunas</h3><table><thead><tr><th>Nome</th><th>Tipo</th><th>Únicos</th></tr></thead><tbody>';
    
    appData.columns.forEach(col => {
        if (col === '_sheet') return;
        const unique = new Set(appData.data.map(r => r[col])).size;
        const type = isNumericColumn(col) ? 'Número' : 'Texto';
        html += `<tr><td>${col}</td><td>${type}</td><td>${unique}</td></tr>`;
    });

    html += '</tbody></table></div>';

    document.getElementById('dashboardContent').innerHTML = html;
}

// ========== ANÁLISES ==========
function renderAnalytics() {
    let html = '';

    appData.columns.forEach(col => {
        if (col === '_sheet' || !isNumericColumn(col)) return;

        const values = appData.data.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
        if (values.length === 0) return;

        const mean = values.reduce((a, b) => a + b) / values.length;
        const sorted = values.sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        html += `<div class="card">
            <h3>📌 ${col}</h3>
            <table>
                <tr><td><strong>Média:</strong></td><td>${mean.toFixed(2)}</td></tr>
                <tr><td><strong>Mediana:</strong></td><td>${median.toFixed(2)}</td></tr>
                <tr><td><strong>Desvio Padrão:</strong></td><td>${stdDev.toFixed(2)}</td></tr>
                <tr><td><strong>Mínimo:</strong></td><td>${min.toFixed(2)}</td></tr>
                <tr><td><strong>Máximo:</strong></td><td>${max.toFixed(2)}</td></tr>
            </table>
        </div>`;
    });

    document.getElementById('analyticsContent').innerHTML = html || '<p>Nenhuma coluna numérica</p>';
}

// ========== GRÁFICOS ==========
function generateChart() {
    if (appData.data.length === 0) return;

    const selectElement = document.getElementById('chartColumn');
    const selectedOptions = Array.from(selectElement.selectedOptions).map(opt => opt.value);
    const type = document.getElementById('chartType').value;

    if (selectedOptions.length === 0) {
        showNotification('Selecione ao menos uma coluna', 'error');
        return;
    }

    if (appData.currentChart) appData.currentChart.destroy();

    const ctx = document.getElementById('myChart').getContext('2d');
    
    // Cores para múltiplos datasets
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'];
    
    const datasets = selectedOptions.map((column, idx) => {
        const values = appData.data
            .map(r => parseFloat(r[column]))
            .filter(v => !isNaN(v))
            .slice(0, 20);

        if (values.length === 0) return null;

        const color = colors[idx % colors.length];
        
        return {
            label: column,
            data: values,
            borderColor: color,
            backgroundColor: type === 'pie' ? colors : `${color}40`,
            fill: type !== 'pie',
            tension: 0.4,
            borderWidth: 2
        };
    }).filter(d => d !== null);

    if (datasets.length === 0) {
        showNotification('Nenhuma coluna com dados numéricos', 'error');
        return;
    }

    const labels = Array.from({length: 20}, (_, i) => i + 1);

    const config = {
        type: type,
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: { color: '#d1d5db' }
                }
            },
            scales: type !== 'pie' ? {
                y: {
                    ticks: { color: '#d1d5db' }
                },
                x: {
                    ticks: { color: '#d1d5db' }
                }
            } : undefined
        }
    };

    appData.currentChart = new Chart(ctx, config);
    showNotification(`✅ Gráfico gerado com ${selectedOptions.length} coluna(s)!`);
}

// ========== COMPARAÇÃO ==========
function renderComparison() {
    let html = '';

    appData.columns.forEach((col, idx) => {
        if (col === '_sheet') return;
        const values = appData.data.map(r => r[col]);
        const unique = new Set(values).size;
        const nulls = values.filter(v => v === '' || v === null).length;

        html += `<div class="card">
            <h3>${idx}️⃣ ${col}</h3>
            <table>
                <tr><td><strong>Nulos:</strong></td><td>${nulls}</td></tr>
                <tr><td><strong>Únicos:</strong></td><td>${unique}</td></tr>
            </table>
        </div>`;
    });

    document.getElementById('comparisonContent').innerHTML = html;
}

// ========== ESTATÍSTICAS ==========
function renderStatistics() {
    const stats = getStats();

    let html = `<div class="stat-grid">
        <div class="stat-card"><div class="label">Total</div><div class="value">${stats.rows}</div></div>
        <div class="stat-card"><div class="label">Colunas</div><div class="value">${stats.cols}</div></div>
        <div class="stat-card"><div class="label">Completo</div><div class="value">${(100 - stats.missing).toFixed(1)}%</div></div>
    </div>`;

    html += '<div class="card"><h3>Detalhes</h3><table><thead><tr><th>Coluna</th><th>Tipo</th><th>Nulos</th></tr></thead><tbody>';

    appData.columns.forEach(col => {
        if (col === '_sheet') return;
        const nulls = appData.data.filter(r => r[col] === '' || r[col] === null).length;
        const type = isNumericColumn(col) ? 'Número' : 'Texto';
        html += `<tr><td>${col}</td><td>${type}</td><td>${nulls}</td></tr>`;
    });

    html += '</tbody></table></div>';
    document.getElementById('statisticsContent').innerHTML = html;
}

// ========== EXPORTAÇÃO ==========
function renderExport() {
    let html = '<table><thead><tr>';
    
    appData.columns.filter(c => c !== '_sheet').forEach(col => html += `<th>${col}</th>`);
    html += '</tr></thead><tbody>';

    appData.data.slice(0, 10).forEach(row => {
        html += '<tr>';
        appData.columns.filter(c => c !== '_sheet').forEach(col => html += `<td>${row[col]}</td>`);
        html += '</tr>';
    });

    html += '</tbody></table>';
    document.getElementById('exportPreview').innerHTML = html;
}

function exportCSV() {
    if (appData.data.length === 0) return;

    const cols = appData.columns.filter(c => c !== '_sheet');
    let csv = cols.join(',') + '\n';
    appData.data.forEach(row => {
        csv += cols.map(col => `"${row[col] || ''}"`).join(',') + '\n';
    });

    downloadFile(csv, 'text/csv', 'export.csv');
}

function exportJSON() {
    if (appData.data.length === 0) return;
    const cols = appData.columns.filter(c => c !== '_sheet');
    const filtered = appData.data.map(row => {
        const obj = {};
        cols.forEach(col => obj[col] = row[col]);
        return obj;
    });
    downloadFile(JSON.stringify(filtered, null, 2), 'application/json', 'export.json');
}

function exportExcel() {
    if (appData.data.length === 0) return;

    const cols = appData.columns.filter(c => c !== '_sheet');
    const filtered = appData.data.map(row => {
        const obj = {};
        cols.forEach(col => obj[col] = row[col]);
        return obj;
    });

    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, 'export.xlsx');
    showNotification('✅ Excel exportado!');
}

function exportPDF() {
    if (appData.data.length === 0) {
        showNotification('Carregue um arquivo primeiro', 'error');
        return;
    }

    try {
        showNotification('⏳ Gerando PDF... aguarde', 'success');

        // Aguardar um pouco para garantir que html2pdf esteja pronto
        setTimeout(() => {
            let pdfContent = `
                <div style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                    <h1 style="color: #3b82f6; border-bottom: 3px solid #3b82f6; padding-bottom: 10px;">
                        📊 DataAnalyzer Pro - Relatório
                    </h1>
                    
                    <p style="margin: 10px 0;"><strong>Arquivo:</strong> ${appData.fileName}</p>
                    <p style="margin: 10px 0;"><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
                    <p style="margin: 10px 0;"><strong>Hora:</strong> ${new Date().toLocaleTimeString('pt-BR')}</p>
                    <p style="margin: 10px 0;"><strong>Abas Carregadas:</strong> ${appData.selectedSheets.join(', ')}</p>
                    
                    <hr style="margin: 30px 0; border: none; border-top: 2px solid #ddd;">
            `;

            // Dashboard
            if (document.getElementById('pdfDashboard').checked) {
                const stats = getStats();
                pdfContent += `
                    <h2 style="color: #1f2937; border-left: 5px solid #3b82f6; padding-left: 15px; margin-top: 20px;">
                        📊 Dashboard
                    </h2>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0;">
                        <div style="background: #f0f4ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 4px;">
                            <p style="margin: 0; font-size: 12px; color: #666;">TOTAL DE LINHAS</p>
                            <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #3b82f6;">${stats.rows}</p>
                        </div>
                        <div style="background: #f0f4ff; border-left: 4px solid #10b981; padding: 15px; border-radius: 4px;">
                            <p style="margin: 0; font-size: 12px; color: #666;">TOTAL DE COLUNAS</p>
                            <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #10b981;">${stats.cols}</p>
                        </div>
                        <div style="background: #f0f4ff; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px;">
                            <p style="margin: 0; font-size: 12px; color: #666;">DADOS FALTANTES</p>
                            <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #f59e0b;">${stats.missing}%</p>
                        </div>
                        <div style="background: #f0f4ff; border-left: 4px solid #ef4444; padding: 15px; border-radius: 4px;">
                            <p style="margin: 0; font-size: 12px; color: #666;">COMPLETUDE</p>
                            <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #ef4444;">${(100 - stats.missing).toFixed(1)}%</p>
                        </div>
                    </div>
                `;
            }

            // Análises
            if (document.getElementById('pdfAnalytics').checked) {
                pdfContent += `
                    <h2 style="color: #1f2937; border-left: 5px solid #3b82f6; padding-left: 15px; margin-top: 30px;">
                        📊 Análises
                    </h2>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                        <thead>
                            <tr style="background-color: #3b82f6; color: white;">
                                <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Coluna</th>
                                <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Média</th>
                                <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Mediana</th>
                                <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Mín</th>
                                <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Máx</th>
                                <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Desvio</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                appData.columns.forEach((col, idx) => {
                    if (col === '_sheet' || !isNumericColumn(col)) return;
                    
                    const values = appData.data
                        .map(r => parseFloat(r[col]))
                        .filter(v => !isNaN(v));
                    
                    if (values.length === 0) return;

                    const mean = (values.reduce((a, b) => a + b) / values.length).toFixed(2);
                    const sorted = [...values].sort((a, b) => a - b);
                    const median = sorted[Math.floor(sorted.length / 2)].toFixed(2);
                    const min = Math.min(...values).toFixed(2);
                    const max = Math.max(...values).toFixed(2);
                    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
                    const stdDev = Math.sqrt(variance).toFixed(2);

                    const bgColor = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                    pdfContent += `
                        <tr style="background-color: ${bgColor};">
                            <td style="border: 1px solid #ddd; padding: 10px;"><strong>${col}</strong></td>
                            <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${mean}</td>
                            <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${median}</td>
                            <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${min}</td>
                            <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${max}</td>
                            <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${stdDev}</td>
                        </tr>
                    `;
                });

                pdfContent += '</tbody></table>';
            }

            // Tabela de dados
            if (document.getElementById('pdfTable').checked) {
                const cols = appData.columns.filter(c => c !== '_sheet');
                
                pdfContent += `
                    <h2 style="color: #1f2937; border-left: 5px solid #3b82f6; padding-left: 15px; margin-top: 30px;">
                        📋 Dados (Primeiras 20 Linhas)
                    </h2>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px;">
                        <thead>
                            <tr style="background-color: #3b82f6; color: white;">
                `;
                
                cols.forEach(col => {
                    pdfContent += `<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">${col}</th>`;
                });
                
                pdfContent += `
                            </tr>
                        </thead>
                        <tbody>
                `;

                appData.data.slice(0, 20).forEach((row, idx) => {
                    const bgColor = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                    pdfContent += `<tr style="background-color: ${bgColor};">`;
                    
                    cols.forEach(col => {
                        pdfContent += `<td style="border: 1px solid #ddd; padding: 8px;">${row[col] || ''}</td>`;
                    });
                    
                    pdfContent += '</tr>';
                });

                pdfContent += '</tbody></table>';
            }

            // Comparação
            if (document.getElementById('pdfComparison').checked) {
                pdfContent += `
                    <h2 style="color: #1f2937; border-left: 5px solid #3b82f6; padding-left: 15px; margin-top: 30px;">
                        🔄 Comparação de Colunas
                    </h2>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                        <thead>
                            <tr style="background-color: #3b82f6; color: white;">
                                <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Coluna</th>
                                <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Tipo</th>
                                <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Nulos</th>
                                <th style="border: 1px solid #ddd; padding: 10px; text-align: right;">Únicos</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                appData.columns.forEach((col, idx) => {
                    if (col === '_sheet') return;
                    
                    const values = appData.data.map(r => r[col]);
                    const unique = new Set(values).size;
                    const nulls = values.filter(v => v === '' || v === null).length;
                    const type = isNumericColumn(col) ? 'Número' : 'Texto';
                    
                    const bgColor = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                    pdfContent += `
                        <tr style="background-color: ${bgColor};">
                            <td style="border: 1px solid #ddd; padding: 10px;"><strong>${col}</strong></td>
                            <td style="border: 1px solid #ddd; padding: 10px;">${type}</td>
                            <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${nulls}</td>
                            <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">${unique}</td>
                        </tr>
                    `;
                });

                pdfContent += '</tbody></table>';
            }

            pdfContent += '</div>';

            // Gerar PDF usando html2pdf
            const element = document.createElement('div');
            element.innerHTML = pdfContent;

            const opt = {
                margin: 10,
                filename: `DataAnalyzer_Report_${new Date().getTime()}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
            };

            if (typeof html2pdf !== 'undefined') {
                html2pdf().set(opt).from(element).save().then(() => {
                    showNotification('✅ PDF gerado e baixado com sucesso!');
                }).catch(err => {
                    console.error('Erro html2pdf:', err);
                    downloadHTMLAsFallback(pdfContent);
                });
            } else {
                downloadHTMLAsFallback(pdfContent);
            }

        }, 100); // Pequeno delay para garantir que html2pdf está pronto

    } catch (error) {
        showNotification(`❌ Erro: ${error.message}`, 'error');
        console.error('Erro ao gerar PDF:', error);
    }
}

function downloadHTMLAsFallback(htmlContent) {
    const fullHTML = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>DataAnalyzer Report</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; background: white; color: #333; }
                @page { margin: 20mm; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            ${htmlContent}
        </body>
        </html>
    `;

    const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `DataAnalyzer_Report_${new Date().getTime()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('📄 HTML baixado - Abra no navegador e use Ctrl+P para salvar como PDF');
}

function downloadFile(content, type, filename) {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    showNotification('✅ Arquivo exportado!');
}

// ========== UTILITÁRIOS ==========
function isNumericColumn(col) {
    return appData.data.some(r => !isNaN(parseFloat(r[col])) && r[col] !== '');
}

function getStats() {
    let missing = 0;
    appData.data.forEach(row => {
        appData.columns.forEach(col => {
            if (col === '_sheet') return;
            if (row[col] === '' || row[col] === null) missing++;
        });
    });

    const cols = appData.columns.filter(c => c !== '_sheet').length;
    const total = appData.data.length * cols;
    return {
        rows: appData.data.length,
        cols: cols,
        missing: ((missing / total) * 100).toFixed(1)
    };
}

function showNotification(msg, type = 'success') {
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: ${type === 'error' ? '#ef4444' : '#10b981'};
        color: white; padding: 15px 20px;
        border-radius: 8px; z-index: 9999;
        font-weight: 600;
    `;
    div.textContent = msg;
    document.body.appendChild(div);

    setTimeout(() => {
        div.remove();
    }, 3000);
}