// DataAnalyzer Pro v3.0 — Complete Web Application
// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

let state = {
    data: [],
    columns: [],
    columnTypes: {},
    numericColumns: [],
    categoricalColumns: [],
    fileName: '',
    currentTable: {
        filteredData: [],
        page: 1,
        rowsPerPage: 25
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
});

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.getAttribute('data-page');
            navigateTo(page, btn);
        });
    });
}

function navigateTo(page, btnEl) {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    if (btnEl) {
        btnEl.classList.add('active');
    } else {
        const match = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (match) match.classList.add('active');
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(page);
    if (target) target.classList.add('active');

    const titles = {
        dashboard: 'Dashboard',
        dados: 'Dados',
        analytics: 'Análises',
        charts: 'Gráficos',
        insights: 'Insights',
        comparacao: 'Comparação',
        exportar: 'Exportar',
        relatorio: 'Relatório'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;
}

// ═══════════════════════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════════════════════

function changeTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FILE UPLOAD & PARSING
// ═══════════════════════════════════════════════════════════════════════════

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    showLoading(true);
    state.fileName = file.name;
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            complete: (results) => {
                onDataLoaded(results.data);
            },
            error: (err) => {
                showLoading(false);
                showNotification('Erro ao ler CSV: ' + err.message, 'error');
            }
        });
    } else if (ext === 'xlsx' || ext === 'xls') {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target.result, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                onDataLoaded(json);
            } catch (err) {
                showLoading(false);
                showNotification('Erro ao ler planilha: ' + err.message, 'error');
            }
        };
        reader.onerror = () => {
            showLoading(false);
            showNotification('Erro ao ler arquivo', 'error');
        };
        reader.readAsBinaryString(file);
    } else if (ext === 'json') {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                onDataLoaded(Array.isArray(json) ? json : [json]);
            } catch (err) {
                showLoading(false);
                showNotification('Erro ao ler JSON: ' + err.message, 'error');
            }
        };
        reader.onerror = () => {
            showLoading(false);
            showNotification('Erro ao ler arquivo', 'error');
        };
        reader.readAsText(file);
    } else {
        showLoading(false);
        showNotification('Formato de arquivo não suportado', 'error');
    }
}

function onDataLoaded(rows) {
    if (!rows || rows.length === 0) {
        showLoading(false);
        showNotification('Arquivo vazio ou sem dados válidos', 'warning');
        return;
    }

    state.data = rows;
    state.columns = Object.keys(rows[0]);
    detectColumnTypes();

    state.currentTable.filteredData = state.data;
    state.currentTable.page = 1;

    renderFileInfo();
    populateColumnSelects();
    renderDashboard();
    renderTable();

    document.getElementById('btnRefresh').style.display = 'inline-block';
    document.getElementById('btnClear').style.display = 'inline-block';

    showLoading(false);
    showNotification('✓ Arquivo carregado com sucesso!', 'success');
}

function detectColumnTypes() {
    state.columnTypes = {};
    state.numericColumns = [];
    state.categoricalColumns = [];

    state.columns.forEach(col => {
        const values = state.data.map(r => r[col]).filter(v => v != null && v !== '');
        const numericCount = values.filter(v => !isNaN(parseFloat(v)) && isFinite(v)).length;
        const isNumeric = values.length > 0 && (numericCount / values.length) > 0.8;

        if (isNumeric) {
            state.columnTypes[col] = 'numérico';
            state.numericColumns.push(col);
        } else {
            state.columnTypes[col] = 'texto';
            state.categoricalColumns.push(col);
        }
    });
}

function renderFileInfo() {
    const box = document.getElementById('fileInfoBox');
    const content = document.getElementById('fileInfoContent');
    box.style.display = 'block';
    content.innerHTML = `
        <p><strong>📄 ${state.fileName}</strong></p>
        <p>${state.data.length.toLocaleString()} linhas × ${state.columns.length} colunas</p>
    `;
}

function populateColumnSelects() {
    const selectIds = ['chartColumn', 'chartColumn2', 'compColumn'];
    selectIds.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const placeholder = select.options[0] ? select.options[0].outerHTML : '';
        select.innerHTML = placeholder + state.columns.map(col => `<option value="${col}">${col}</option>`).join('');
    });
}

function clearData() {
    state.data = [];
    state.columns = [];
    state.columnTypes = {};
    state.numericColumns = [];
    state.categoricalColumns = [];
    state.fileName = '';
    state.currentTable = { filteredData: [], page: 1, rowsPerPage: 25 };

    document.getElementById('fileInfoBox').style.display = 'none';
    document.getElementById('btnRefresh').style.display = 'none';
    document.getElementById('btnClear').style.display = 'none';
    document.getElementById('fileInput').value = '';

    document.getElementById('dashboardEmpty').style.display = 'block';
    document.getElementById('dashboardContent').style.display = 'none';
    document.getElementById('kpiGrid').innerHTML = '';
    document.getElementById('chartGrid').innerHTML = '';
    document.getElementById('tableContainer').innerHTML = '';
    document.getElementById('pagination').innerHTML = '';
    document.getElementById('analyticsContent').innerHTML = '';
    document.getElementById('insightsContent').innerHTML = '';
    document.getElementById('comparacaoContent').innerHTML = '';
    document.getElementById('chartContainer').innerHTML = '';

    showNotification('Dados limpos', 'success');
}

function refreshData() {
    if (state.data.length === 0) {
        showNotification('Nenhum dado carregado', 'warning');
        return;
    }
    detectColumnTypes();
    renderDashboard();
    renderTable();
    showNotification('Dados atualizados', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

function renderDashboard() {
    if (state.data.length === 0) {
        document.getElementById('dashboardEmpty').style.display = 'block';
        document.getElementById('dashboardContent').style.display = 'none';
        return;
    }

    document.getElementById('dashboardEmpty').style.display = 'none';
    document.getElementById('dashboardContent').style.display = 'block';

    renderKPIs();
    renderDashboardCharts();
}

function renderKPIs() {
    const stats = calculateStatistics();
    const kpiHtml = `
        <div class="kpi-card">
            <div class="kpi-label">📊 Registros</div>
            <div class="kpi-value">${stats.rows.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">📋 Colunas</div>
            <div class="kpi-value">${stats.columns}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">⚠️ Nulos</div>
            <div class="kpi-value">${stats.nulls.toLocaleString()}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">📌 Duplicados</div>
            <div class="kpi-value">${stats.duplicates}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">🔢 Numéricas</div>
            <div class="kpi-value">${stats.numericCols}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">🏷️ Categóricas</div>
            <div class="kpi-value">${stats.categoricalCols}</div>
        </div>
    `;
    document.getElementById('kpiGrid').innerHTML = kpiHtml;
}

function calculateStatistics() {
    const totalCells = state.data.length * state.columns.length;
    let nullCount = 0;
    state.columns.forEach(col => {
        state.data.forEach(row => {
            if (row[col] == null || row[col] === '') nullCount++;
        });
    });

    const duplicates = state.data.length - new Set(state.data.map(r => JSON.stringify(r))).size;

    return {
        rows: state.data.length,
        columns: state.columns.length,
        nulls: nullCount,
        duplicates: duplicates,
        numericCols: state.numericColumns.length,
        categoricalCols: state.categoricalColumns.length,
        totalCells: totalCells
    };
}

function renderDashboardCharts() {
    const chartGrid = document.getElementById('chartGrid');
    chartGrid.innerHTML = '';
    
    // Primeiro gráfico: distribuição primeira coluna numérica
    if (state.numericColumns.length > 0) {
        const col = state.numericColumns[0];
        const container = document.createElement('div');
        container.className = 'chart-container';
        chartGrid.appendChild(container);
        renderHistogram(col, container);
    }
    
    // Segundo gráfico: Top categorias
    if (state.categoricalColumns.length > 0) {
        const col = state.categoricalColumns[0];
        const container = document.createElement('div');
        container.className = 'chart-container';
        chartGrid.appendChild(container);
        renderBarChart(col, container);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function showNotification(message, type = 'info') {
    const notif = document.getElementById('notification');
    notif.textContent = message;
    notif.className = `notification ${type} show`;
    
    setTimeout(() => {
        notif.classList.remove('show');
    }, 4000);
}

function updateChartOptions() {
    const type = document.getElementById('chartType').value;
    const col2 = document.getElementById('chartColumn2');
    col2.style.display = ['scatter', 'bubble', 'linha'].includes(type) ? 'block' : 'none';
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

function loadAnalytics() {
    if (state.data.length === 0) {
        showNotification('Carregue um arquivo', 'warning');
        return;
    }
    
    showLoading(true);
    setTimeout(() => {
        const analytics = calculateAnalytics();
        const html = renderAnalyticsTable(analytics);
        document.getElementById('analyticsContent').innerHTML = html;
        showLoading(false);
        showNotification('Análises calculadas', 'success');
    }, 500);
}

function calculateAnalytics() {
    const result = {};
    state.numericColumns.forEach(col => {
        const values = state.data.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
        if (values.length === 0) return;
        
        values.sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        
        result[col] = {
            count: values.length,
            mean: mean.toFixed(2),
            median: values[Math.floor(values.length / 2)].toFixed(2),
            std: Math.sqrt(variance).toFixed(2),
            min: values[0].toFixed(2),
            max: values[values.length - 1].toFixed(2),
            q1: values[Math.floor(values.length * 0.25)].toFixed(2),
            q3: values[Math.floor(values.length * 0.75)].toFixed(2)
        };
    });
    return result;
}

function renderAnalyticsTable(analytics) {
    let html = '<table><thead><tr><th>Coluna</th><th>Count</th><th>Média</th><th>Mediana</th><th>Desvio</th><th>Min</th><th>Max</th></tr></thead><tbody>';
    
    Object.entries(analytics).forEach(([col, stats]) => {
        html += `<tr>
            <td><strong>${col}</strong></td>
            <td>${stats.count}</td>
            <td>${stats.mean}</td>
            <td>${stats.median}</td>
            <td>${stats.std}</td>
            <td>${stats.min}</td>
            <td>${stats.max}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    return html;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHARTS - GRÁFICOS
// ═══════════════════════════════════════════════════════════════════════════

function generateChart() {
    const type = document.getElementById('chartType').value;
    const col = document.getElementById('chartColumn').value;
    const col2 = document.getElementById('chartColumn2').value;
    
    if (!type || !col) {
        showNotification('Selecione tipo e coluna', 'warning');
        return;
    }
    
    showLoading(true);
    setTimeout(() => {
        const container = document.getElementById('chartContainer');
        container.innerHTML = '';
        
        if (type === 'histograma') renderHistogram(col, container);
        else if (type === 'boxplot') renderBoxplot(col, container);
        else if (type === 'barras') renderBarChart(col, container);
        else if (type === 'pizza') renderPieChart(col, container);
        else if (type === 'linha') renderLineChart(col, container);
        else if (type === 'scatter') renderScatterChart(col, col2, container);
        else if (type === 'heatmap') renderHeatmap(container);
        else if (type === 'sunburst') renderSunburst(col, container);
        else if (type === 'bubble') renderBubbleChart(col, col2, container);
        
        showLoading(false);
        showNotification('Gráfico gerado', 'success');
    }, 300);
}

function renderHistogram(col, container) {
    const values = state.data.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    Plotly.newPlot(container, [{
        x: values,
        type: 'histogram',
        marker: { color: '#1a56db' }
    }], {
        title: `Distribuição — ${col}`,
        xaxis: { title: col },
        yaxis: { title: 'Frequência' }
    }, { responsive: true });
}

function renderBoxplot(col, container) {
    const values = state.data.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    Plotly.newPlot(container, [{
        y: values,
        type: 'box',
        marker: { color: '#1a56db' }
    }], {
        title: `Boxplot — ${col}`,
        yaxis: { title: col }
    }, { responsive: true });
}

function renderBarChart(col, container) {
    const counts = {};
    state.data.forEach(r => {
        const v = r[col];
        counts[v] = (counts[v] || 0) + 1;
    });
    
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15);
    Plotly.newPlot(container, [{
        x: sorted.map(e => e[0]),
        y: sorted.map(e => e[1]),
        type: 'bar',
        marker: { color: '#1a56db' }
    }], {
        title: `Top 15 — ${col}`,
        xaxis: { title: col },
        yaxis: { title: 'Frequência' }
    }, { responsive: true });
}

function renderPieChart(col, container) {
    const counts = {};
    state.data.forEach(r => {
        const v = r[col];
        counts[v] = (counts[v] || 0) + 1;
    });
    
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    Plotly.newPlot(container, [{
        labels: sorted.map(e => e[0]),
        values: sorted.map(e => e[1]),
        type: 'pie'
    }], {
        title: `Proporção — ${col}`
    }, { responsive: true });
}

function renderLineChart(col, container) {
    const values = state.data.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    Plotly.newPlot(container, [{
        y: values,
        type: 'scatter',
        mode: 'lines',
        marker: { color: '#1a56db' }
    }], {
        title: `Série Temporal — ${col}`,
        xaxis: { title: 'Índice' },
        yaxis: { title: col }
    }, { responsive: true });
}

function renderScatterChart(col1, col2, container) {
    if (!col2) {
        showNotification('Selecione segunda coluna', 'warning');
        return;
    }
    
    const x = state.data.map(r => parseFloat(r[col1])).filter(v => !isNaN(v));
    const y = state.data.map(r => parseFloat(r[col2])).filter(v => !isNaN(v));
    
    Plotly.newPlot(container, [{
        x: x,
        y: y,
        type: 'scatter',
        mode: 'markers',
        marker: { size: 8, color: '#1a56db', opacity: 0.6 }
    }], {
        title: `Dispersão — ${col1} × ${col2}`,
        xaxis: { title: col1 },
        yaxis: { title: col2 }
    }, { responsive: true });
}



// ═══════════════════════════════════════════════════════════════════════════
// INSIGHTS
// ═══════════════════════════════════════════════════════════════════════════

function generateInsights() {
    if (state.data.length === 0) {
        showNotification('Carregue um arquivo', 'warning');
        return;
    }
    
    showLoading(true);
    const insights = [];
    
    // Nulos
    state.columns.forEach(col => {
        const nullCount = state.data.filter(r => r[col] == null || r[col] === '').length;
        if (nullCount > 0) {
            const pct = (nullCount / state.data.length * 100).toFixed(1);
            insights.push({
                severity: pct >= 30 ? 'critical' : 'warning',
                category: 'NULOS',
                message: `"${col}" possui ${nullCount} nulos (${pct}%)`
            });
        }
    });
    
    // Duplicatas
    const duplicates = state.data.length - new Set(state.data.map(r => JSON.stringify(r))).size;
    if (duplicates > 0) {
        insights.push({
            severity: 'warning',
            category: 'DUPLICATAS',
            message: `${duplicates} linhas duplicadas`
        });
    }
    
    // Distribuição
    state.numericColumns.slice(0, 3).forEach(col => {
        const values = state.data.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
        if (values.length === 0) return; // avoid divide-by-zero
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
        const std = Math.sqrt(variance) || 0;
        const skewness = std === 0 ? 0 : values.reduce((sum, v) => sum + Math.pow(v - mean, 3), 0) / (values.length * Math.pow(std, 3));

        if (Math.abs(skewness) > 2) {
            insights.push({
                severity: 'info',
                category: 'DISTRIBUIÇÃO',
                message: `"${col}" possui distribuição muito assimétrica (skewness: ${skewness.toFixed(2)})`
            });
        }
    });
    
    showLoading(false);
    const html = insights.map(i => `
        <div class="insight-item ${i.severity}">
            <div class="insight-icon">${i.severity === 'critical' ? '🔴' : i.severity === 'warning' ? '⚠️' : 'ℹ️'}</div>
            <div class="insight-content">
                <h4>${i.category}</h4>
                <p>${i.message}</p>
            </div>
        </div>
    `).join('');
    
    document.getElementById('insightsContent').innerHTML = html || '<p>Nenhum insight detectado</p>';
}



// ═══════════════════════════════════════════════════════════════════════════
// DATA TABLE
// ═══════════════════════════════════════════════════════════════════════════

function updateTable() {
    state.currentTable.filteredData = state.data;
    renderTable();
}

function filterTable() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    state.currentTable.filteredData = state.data.filter(row =>
        Object.values(row).some(v => String(v).toLowerCase().includes(searchTerm))
    );
    state.currentTable.page = 1;
    renderTable();
}

function renderTable() {
    const rowsPerPageEl = document.getElementById('rowsPerPage');
    const rowsPerPage = rowsPerPageEl ? parseInt(rowsPerPageEl.value) || state.currentTable.rowsPerPage : state.currentTable.rowsPerPage;
    const start = (state.currentTable.page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = (state.currentTable.filteredData || []).slice(start, end);

    let html = '<table><thead><tr>';
    state.columns.forEach(col => html += `<th>${col}</th>`);
    html += '</tr></thead><tbody>';

    if (pageData.length === 0) {
        html += `<tr><td colspan="${state.columns.length}" style="text-align:center;padding:12px">Nenhum registro</td></tr>`;
    } else {
        pageData.forEach(row => {
            html += '<tr>';
            state.columns.forEach(col => html += `<td>${row[col] || '-'}</td>`);
            html += '</tr>';
        });
    }

    html += '</tbody></table>';
    document.getElementById('tableContainer').innerHTML = html;

    // Pagination (build DOM buttons to avoid incorrect global onclicks)
    const totalPages = Math.max(1, Math.ceil(((state.currentTable.filteredData || []).length) / rowsPerPage));
    const paginationEl = document.getElementById('pagination');
    paginationEl.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        if (i === state.currentTable.page) btn.classList.add('active');
        btn.textContent = i;
        btn.addEventListener('click', () => goToTablePage(i));
        paginationEl.appendChild(btn);
    }
}

function goToTablePage(page) {
    state.currentTable.page = page;
    renderTable();
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

function exportCSV() {
    const csv = [state.columns.join(','), ...state.data.map(r => state.columns.map(c => r[c]).join(','))].join('\n');
    downloadFile(csv, 'data.csv', 'text/csv');
    showNotification('CSV exportado', 'success');
}

function exportExcel() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(state.data);
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, 'data.xlsx');
    showNotification('Excel exportado', 'success');
}

function exportJSON() {
    const json = JSON.stringify(state.data, null, 2);
    downloadFile(json, 'data.json', 'application/json');
    showNotification('JSON exportado', 'success');
}

function exportPDF() {
    if (state.data.length === 0) {
        showNotification('Carregue um arquivo', 'warning');
        return;
    }

    try {
        showLoading(true);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        doc.setFontSize(14);
        doc.setTextColor(26, 86, 219);
        doc.text(state.fileName || 'Dados', 14, 12);
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(`${state.data.length.toLocaleString('pt-BR')} registros × ${state.columns.length} colunas — exportado em ${new Date().toLocaleString('pt-BR')}`, 14, 18);

        doc.autoTable({
            startY: 24,
            head: [state.columns],
            body: state.data.map(row => state.columns.map(c => row[c] != null && row[c] !== '' ? String(row[c]) : '-')),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [26, 86, 219], textColor: 255 },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { top: 24, left: 10, right: 10 },
            theme: 'grid'
        });

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount} — DataAnalyzer Pro v3.0`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' });
        }

        doc.save('data.pdf');
        showLoading(false);
        showNotification('PDF exportado', 'success');
    } catch (err) {
        showLoading(false);
        showNotification('Erro ao gerar PDF: ' + err.message, 'error');
    }
}

function exportHTML() {
    const html = `<html><head><meta charset="UTF-8"><title>Data</title><style>table{border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}</style></head><body><table><thead><tr>${state.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${state.data.map(r => `<tr>${state.columns.map(c => `<td>${r[c]}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
    downloadFile(html, 'data.html', 'text/html');
    showNotification('HTML exportado', 'success');
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORT GENERATION - PROFESSIONAL PDF
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// REPORT GENERATION - PROFESSIONAL PDF (jsPDF + autoTable, geração nativa)
// ═══════════════════════════════════════════════════════════════════════════

function generateReport() {
    if (state.data.length === 0) {
        showNotification('Carregue um arquivo', 'warning');
        return;
    }

    const title = document.getElementById('relatorioTitle').value || 'Relatório Executivo';
    const includeSummary = document.getElementById('relSummary').checked;
    const includeStats = document.getElementById('relStats').checked;
    const includeGraphs = document.getElementById('relGraphs').checked;
    const includeInsights = document.getElementById('relInsights').checked;

    showLoading(true);

    setTimeout(() => {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 14;

            const now = new Date();
            const dateStr = now.toLocaleString('pt-BR');

            const stats = calculateStatistics();
            const insights = generateInsightsData();
            const analytics = calculateAnalytics();

            const PRIMARY = [26, 86, 219];
            const GRAY = [102, 102, 102];
            const LIGHT = [249, 250, 251];
            const SEVERITY_COLORS = {
                critical: [220, 38, 38],
                warning: [217, 119, 6],
                info: [2, 132, 199]
            };

            // ── CAPA ──────────────────────────────────────────────────────
            doc.setFontSize(26);
            doc.setTextColor(...PRIMARY);
            doc.text(title, margin, 30);

            doc.setFontSize(11);
            doc.setTextColor(...GRAY);
            doc.text('Relatório Executivo', margin, 39);
            doc.text(`Data: ${dateStr}`, margin, 46);
            doc.text('Ferramenta: DataAnalyzer Pro v3.0', margin, 52);
            doc.setDrawColor(...PRIMARY);
            doc.setLineWidth(0.8);
            doc.line(margin, 57, pageWidth - margin, 57);

            let y = 68;

            // ── RESUMO EXECUTIVO (KPIs) ───────────────────────────────────
            if (includeSummary) {
                doc.setFontSize(16);
                doc.setTextColor(...PRIMARY);
                doc.text('Resumo Executivo', margin, y);
                y += 8;

                const kpis = [
                    ['Registros', stats.rows.toLocaleString('pt-BR')],
                    ['Colunas', String(stats.columns)],
                    ['Nulos', stats.nulls.toLocaleString('pt-BR')],
                    ['Duplicados', String(stats.duplicates)],
                    ['Numéricas', String(stats.numericCols)],
                    ['Categóricas', String(stats.categoricalCols)]
                ];

                const boxWidth = (pageWidth - margin * 2 - 10) / 3;
                const boxHeight = 20;
                kpis.forEach((kpi, i) => {
                    const col = i % 3;
                    const row = Math.floor(i / 3);
                    const x = margin + col * (boxWidth + 5);
                    const boxY = y + row * (boxHeight + 5);

                    doc.setFillColor(...LIGHT);
                    doc.setDrawColor(...PRIMARY);
                    doc.roundedRect(x, boxY, boxWidth, boxHeight, 2, 2, 'FD');

                    doc.setFontSize(8);
                    doc.setTextColor(...GRAY);
                    doc.text(kpi[0], x + 4, boxY + 7);

                    doc.setFontSize(15);
                    doc.setTextColor(...PRIMARY);
                    doc.text(kpi[1], x + 4, boxY + 16);
                });

                y += Math.ceil(kpis.length / 3) * (boxHeight + 5) + 8;

                doc.setFontSize(10);
                doc.setTextColor(40, 40, 40);
                const completude = ((1 - stats.nulls / (stats.rows * stats.columns)) * 100).toFixed(1);
                doc.text(`Dataset carregado: ${state.fileName}`, margin, y);
                y += 6;
                doc.text(`Tamanho: ${stats.rows.toLocaleString('pt-BR')} linhas × ${stats.columns} colunas`, margin, y);
                y += 6;
                doc.text(`Completude: ${completude}% dos valores preenchidos`, margin, y);
                y += 10;
            }

            // ── ESTATÍSTICAS DESCRITIVAS ──────────────────────────────────
            if (includeStats) {
                doc.addPage();
                y = 20;
                doc.setFontSize(16);
                doc.setTextColor(...PRIMARY);
                doc.text('Estatísticas Descritivas', margin, y);
                y += 4;

                doc.setFontSize(11);
                doc.setTextColor(40, 40, 40);
                doc.text('Colunas Numéricas', margin, y + 6);

                const analyticsRows = Object.entries(analytics).map(([col, s]) => [col, s.mean, s.median, s.std, s.min, s.max]);
                doc.autoTable({
                    startY: y + 10,
                    head: [['Coluna', 'Média', 'Mediana', 'Desvio', 'Min', 'Max']],
                    body: analyticsRows.length ? analyticsRows : [['—', '—', '—', '—', '—', '—']],
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: PRIMARY, textColor: 255 },
                    alternateRowStyles: { fillColor: LIGHT },
                    margin: { left: margin, right: margin }
                });

                let afterY = doc.lastAutoTable.finalY + 10;
                doc.setFontSize(11);
                doc.setTextColor(40, 40, 40);
                doc.text('Qualidade dos Dados', margin, afterY);

                const qualityRows = state.columns.map(col => {
                    const values = state.data.map(r => r[col]);
                    const nullCount = values.filter(v => v == null || v === '').length;
                    const unique = new Set(values.filter(v => v != null)).size;
                    const type = state.columnTypes[col] || 'desconhecido';
                    return [col, type, String(nullCount), `${(nullCount / state.data.length * 100).toFixed(1)}%`, String(unique)];
                });

                doc.autoTable({
                    startY: afterY + 4,
                    head: [['Coluna', 'Tipo', 'Nulos', '% Nulos', 'Únicos']],
                    body: qualityRows,
                    styles: { fontSize: 8 },
                    headStyles: { fillColor: PRIMARY, textColor: 255 },
                    alternateRowStyles: { fillColor: LIGHT },
                    margin: { left: margin, right: margin }
                });
            }

            // ── INSIGHTS AUTOMÁTICOS ──────────────────────────────────────
            if (includeInsights) {
                doc.addPage();
                y = 20;
                doc.setFontSize(16);
                doc.setTextColor(...PRIMARY);
                doc.text('Insights Automáticos', margin, y);
                y += 8;

                doc.setFontSize(10);
                doc.setTextColor(40, 40, 40);
                doc.text('Análise automática dos dados detectou os seguintes pontos importantes:', margin, y);
                y += 8;

                insights.forEach(insight => {
                    const color = SEVERITY_COLORS[insight.severity] || GRAY;
                    const lines = doc.splitTextToSize(insight.message, pageWidth - margin * 2 - 6);
                    const boxHeight = 8 + lines.length * 5;

                    if (y + boxHeight > 280) {
                        doc.addPage();
                        y = 20;
                    }

                    doc.setFillColor(250, 250, 250);
                    doc.setDrawColor(...color);
                    doc.setLineWidth(1);
                    doc.line(margin, y, margin, y + boxHeight);
                    doc.rect(margin, y, pageWidth - margin * 2, boxHeight, 'F');
                    doc.setLineWidth(1.2);
                    doc.line(margin, y, margin, y + boxHeight);

                    doc.setFontSize(9);
                    doc.setTextColor(...color);
                    doc.text(insight.category, margin + 4, y + 6);

                    doc.setFontSize(9);
                    doc.setTextColor(40, 40, 40);
                    doc.text(lines, margin + 4, y + 12);

                    y += boxHeight + 4;
                });
            }

            // ── AMOSTRA DOS DADOS ──────────────────────────────────────────
            if (includeGraphs) {
                doc.addPage();
                y = 20;
                doc.setFontSize(16);
                doc.setTextColor(...PRIMARY);
                doc.text('Amostra dos Dados', margin, y);
                y += 4;

                doc.setFontSize(10);
                doc.setTextColor(40, 40, 40);
                doc.text('Primeiras 10 linhas do dataset:', margin, y + 6);

                doc.autoTable({
                    startY: y + 10,
                    head: [state.columns],
                    body: state.data.slice(0, 10).map(row => state.columns.map(c => row[c] != null && row[c] !== '' ? String(row[c]) : '-')),
                    styles: { fontSize: 7 },
                    headStyles: { fillColor: PRIMARY, textColor: 255 },
                    alternateRowStyles: { fillColor: LIGHT },
                    margin: { left: margin, right: margin }
                });
            }

            // ── CONCLUSÃO ──────────────────────────────────────────────────
            doc.addPage();
            y = 20;
            doc.setFontSize(16);
            doc.setTextColor(...PRIMARY);
            doc.text('Conclusão', margin, y);
            y += 10;

            doc.setFontSize(11);
            doc.setTextColor(40, 40, 40);
            doc.text('Resumo da Análise', margin, y);
            y += 7;
            doc.setFontSize(10);
            const resumoLines = doc.splitTextToSize(
                `Este relatório apresenta uma análise completa do dataset ${state.fileName} contendo ${stats.rows.toLocaleString('pt-BR')} registros e ${stats.columns} colunas.`,
                pageWidth - margin * 2
            );
            doc.text(resumoLines, margin, y);
            y += resumoLines.length * 5 + 6;

            doc.setFontSize(11);
            doc.text('Principais Achados', margin, y);
            y += 7;
            doc.setFontSize(10);
            const achados = [
                `Dataset com ${stats.numericCols} colunas numéricas e ${stats.categoricalCols} categóricas`,
                `Completude dos dados: ${((1 - stats.nulls / (stats.rows * stats.columns)) * 100).toFixed(1)}%`,
                `Duplicatas detectadas: ${stats.duplicates} linhas`,
                `Valores nulos: ${stats.nulls.toLocaleString('pt-BR')} ocorrências`
            ];
            achados.forEach(line => {
                const wrapped = doc.splitTextToSize(`•  ${line}`, pageWidth - margin * 2 - 4);
                doc.text(wrapped, margin + 2, y);
                y += wrapped.length * 5 + 1;
            });
            y += 5;

            doc.setFontSize(11);
            doc.text('Recomendações', margin, y);
            y += 7;
            doc.setFontSize(10);
            const recomendacoes = [
                'Investigar presença de valores nulos para possível tratamento',
                'Validar dados duplicados e decidir por remoção ou consolidação',
                'Executar análises exploratórias por coluna numérica',
                'Identificar correlações entre variáveis'
            ];
            recomendacoes.forEach(line => {
                const wrapped = doc.splitTextToSize(`•  ${line}`, pageWidth - margin * 2 - 4);
                doc.text(wrapped, margin + 2, y);
                y += wrapped.length * 5 + 1;
            });

            // ── RODAPÉ EM TODAS AS PÁGINAS ─────────────────────────────────
            const pageCount = doc.internal.getNumberOfPages();
            const pageHeight = doc.internal.pageSize.getHeight();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(
                    `DataAnalyzer Pro v3.0  •  ${dateStr}  •  Página ${i} de ${pageCount}`,
                    pageWidth / 2,
                    pageHeight - 8,
                    { align: 'center' }
                );
            }

            doc.save(`${title.replace(/\s+/g, '_')}_${now.getTime()}.pdf`);

            showLoading(false);
            showNotification('✓ Relatório PDF gerado com sucesso!', 'success');
        } catch (err) {
            showLoading(false);
            showNotification('Erro ao gerar relatório: ' + err.message, 'error');
        }
    }, 300);
}


function generateInsightsData() {
    const insights = [];
    
    // Nulos
    state.columns.forEach(col => {
        const nullCount = state.data.filter(r => r[col] == null || r[col] === '').length;
        if (nullCount > 0) {
            const pct = (nullCount / state.data.length * 100).toFixed(1);
            insights.push({
                severity: pct >= 30 ? 'critical' : 'warning',
                category: '⚠️ NULOS',
                message: `"${col}" possui ${nullCount} nulos (${pct}%)`
            });
        }
    });
    
    // Duplicatas
    const duplicates = state.data.length - new Set(state.data.map(r => JSON.stringify(r))).size;
    if (duplicates > 0) {
        insights.push({
            severity: 'warning',
            category: '📌 DUPLICATAS',
            message: `${duplicates} linhas duplicadas encontradas`
        });
    }
    
    if (insights.length === 0) {
        insights.push({
            severity: 'info',
            category: 'ℹ️ DADOS',
            message: '✓ Dados sem problemas críticos detectados'
        });
    }
    
    return insights;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPARAÇÃO
// ═══════════════════════════════════════════════════════════════════════════

function generateComparacao() {
    const col = document.getElementById('compColumn').value;
    const metric = document.getElementById('compMetric').value;
    
    if (!col) {
        showNotification('Selecione coluna', 'warning');
        return;
    }
    
    showLoading(true);
    const values = state.data.map(r => parseFloat(r[col])).filter(v => !isNaN(v));
    if (values.length === 0) {
        showLoading(false);
        showNotification('Sem valores numéricos na coluna selecionada', 'warning');
        return;
    }
    values.sort((a, b) => a - b);

    let result = 0;
    if (metric === 'mean') result = values.reduce((a, b) => a + b, 0) / values.length;
    else if (metric === 'median') {
        if (values.length % 2 === 0) {
            const mid = values.length / 2;
            result = (values[mid - 1] + values[mid]) / 2;
        } else {
            result = values[Math.floor(values.length / 2)];
        }
    } else if (metric === 'std') {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        result = Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
    } else if (metric === 'min') result = values[0];
    else if (metric === 'max') result = values[values.length - 1];

    showLoading(false);
    const html = `
        <div style="padding: 16px; background: #1a56db; color: white; border-radius: 8px; text-align: center;">
            <h3>${metric.toUpperCase()} de ${col}</h3>
            <h1 style="color: white;">${Number(result).toFixed(2)}</h1>
        </div>
    `;
    document.getElementById('comparacaoContent').innerHTML = html;
}
