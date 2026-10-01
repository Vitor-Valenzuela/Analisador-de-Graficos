(function () {
    function parseNumber(value) {
        if (value === null || value === undefined || value === '') return NaN;
        if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
        const text = String(value).trim();
        if (!text) return NaN;
        const normalized = text
            .replace(/\s/g, '')
            .replace(/\./g, '')
            .replace(',', '.')
            .replace(/[%$€£¥]/g, '');
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : NaN;
    }

    function formatCell(value) {
        if (value === null || value === undefined || value === '') return '-';
        return String(value);
    }

    function getNumericValues(col) {
        return state.data
            .map(row => parseNumber(row[col]))
            .filter(value => Number.isFinite(value));
    }

    function getPairedNumericValues(colX, colY) {
        const x = [];
        const y = [];

        state.data.forEach(row => {
            const left = parseNumber(row[colX]);
            const right = parseNumber(row[colY]);
            if (Number.isFinite(left) && Number.isFinite(right)) {
                x.push(left);
                y.push(right);
            }
        });

        return { x, y };
    }

    function safeCsvValue(value) {
        const text = value === null || value === undefined ? '' : String(value);
        if (/[",\n]/.test(text)) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    }

    window.updateChartOptions = function () {
        const type = document.getElementById('chartType').value;
        const second = document.getElementById('chartColumn2');
        if (!second) return;
        const shouldShow = ['scatter', 'linha', 'bubble'].includes(type);
        second.style.display = shouldShow ? 'block' : 'none';
        if (!shouldShow) second.value = '';
    };

    window.generateChart = function () {
        const type = document.getElementById('chartType').value;
        const col = document.getElementById('chartColumn').value;
        const col2 = document.getElementById('chartColumn2').value;

        if (!type || !col) {
            showNotification('Selecione tipo e coluna', 'warning');
            return;
        }

        if ((type === 'scatter' || type === 'bubble') && !col2) {
            showNotification('Selecione a segunda coluna para este gráfico', 'warning');
            return;
        }

        showLoading(true);
        setTimeout(() => {
            const container = document.getElementById('chartContainer');
            container.innerHTML = '';

            if (type === 'histograma') {
                renderHistogram(col, container);
            } else if (type === 'boxplot') {
                renderBoxplot(col, container);
            } else if (type === 'barras') {
                renderBarChart(col, container);
            } else if (type === 'pizza') {
                renderPieChart(col, container);
            } else if (type === 'linha') {
                const values = getNumericValues(col);
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
            } else if (type === 'scatter') {
                const { x, y } = getPairedNumericValues(col, col2);
                Plotly.newPlot(container, [{
                    x,
                    y,
                    type: 'scatter',
                    mode: 'markers',
                    marker: { size: 8, color: '#1a56db', opacity: 0.6 }
                }], {
                    title: `Dispersão — ${col} × ${col2}`,
                    xaxis: { title: col },
                    yaxis: { title: col2 }
                }, { responsive: true });
            } else if (type === 'bubble') {
                const { x, y } = getPairedNumericValues(col, col2);
                const z = x.map((_, index) => Math.abs(y[index]) || 1);
                Plotly.newPlot(container, [{
                    x,
                    y,
                    z,
                    type: 'scatter',
                    mode: 'markers',
                    marker: { size: z.map(value => Math.max(8, value * 2)), opacity: 0.7, color: '#7c3aed' }
                }], {
                    title: `Bubble — ${col} × ${col2}`,
                    xaxis: { title: col },
                    yaxis: { title: col2 }
                }, { responsive: true });
            }

            showLoading(false);
            showNotification('Gráfico gerado', 'success');
        }, 300);
    };

    window.renderTable = function () {
        const rowsPerPageEl = document.getElementById('rowsPerPage');
        const rowsPerPage = rowsPerPageEl ? parseInt(rowsPerPageEl.value, 10) || state.currentTable.rowsPerPage : state.currentTable.rowsPerPage;
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
                state.columns.forEach(col => html += `<td>${formatCell(row[col])}</td>`);
                html += '</tr>';
            });
        }

        html += '</tbody></table>';
        document.getElementById('tableContainer').innerHTML = html;

        const totalPages = Math.max(1, Math.ceil(((state.currentTable.filteredData || []).length) / rowsPerPage));
        const paginationEl = document.getElementById('pagination');
        paginationEl.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            if (i === state.currentTable.page) btn.classList.add('active');
            btn.textContent = i;
            btn.addEventListener('click', () => {
                state.currentTable.page = i;
                window.renderTable();
            });
            paginationEl.appendChild(btn);
        }
    };

    window.exportCSV = function () {
        if (!state.data.length) {
            showNotification('Carregue um arquivo antes de exportar', 'warning');
            return;
        }

        const header = state.columns.map(safeCsvValue).join(',');
        const rows = state.data.map(row => state.columns.map(col => safeCsvValue(row[col])).join(','));
        const csv = [header, ...rows].join('\n');
        downloadFile(csv, 'data.csv', 'text/csv;charset=utf-8;');
        showNotification('CSV exportado', 'success');
    };

    window.generateComparacao = function () {
        const col = document.getElementById('compColumn').value;
        const metric = document.getElementById('compMetric').value;

        if (!col) {
            showNotification('Selecione coluna', 'warning');
            return;
        }

        const values = getNumericValues(col);
        if (values.length === 0) {
            showNotification('Sem valores numéricos na coluna selecionada', 'warning');
            return;
        }

        values.sort((a, b) => a - b);
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

        let result = 0;
        if (metric === 'mean') {
            result = mean;
        } else if (metric === 'median') {
            const mid = Math.floor(values.length / 2);
            result = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
        } else if (metric === 'std') {
            result = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
        } else if (metric === 'min') {
            result = values[0];
        } else if (metric === 'max') {
            result = values[values.length - 1];
        }

        const html = `
            <div style="padding: 16px; background: #1a56db; color: white; border-radius: 8px; text-align: center;">
                <h3>${metric.toUpperCase()} de ${col}</h3>
                <h1 style="color: white;">${Number(result).toFixed(2)}</h1>
            </div>
        `;

        document.getElementById('comparacaoContent').innerHTML = html;
    };

    window.generateReport = function () {
        if (state.data.length === 0) {
            showNotification('Carregue um arquivo', 'warning');
            return;
        }

        const title = document.getElementById('relatorioTitle').value || 'Relatório Executivo';
        const includeSummary = document.getElementById('relSummary').checked;
        const includeStats = document.getElementById('relStats').checked;
        const includeGraphs = document.getElementById('relGraphs').checked;
        const includeInsights = document.getElementById('relInsights').checked;
        const includeForecast = document.getElementById('relForecast')?.checked ?? false;

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
                const analytics = calculateAnalytics();
                const insights = generateInsightsData();

                const PRIM = [26, 86, 219];
                const GRAY = [102, 102, 102];
                const LIGHT = [249, 250, 251];

                doc.setFontSize(26);
                doc.setTextColor(...PRIM);
                doc.text(title, margin, 30);
                doc.setFontSize(11);
                doc.setTextColor(...GRAY);
                doc.text('Relatório Executivo', margin, 39);
                doc.text(`Data: ${dateStr}`, margin, 46);
                doc.text('Ferramenta: DataAnalyzer Pro v3.0', margin, 52);
                doc.setDrawColor(...PRIM);
                doc.setLineWidth(0.8);
                doc.line(margin, 57, pageWidth - margin, 57);

                let y = 68;

                if (includeSummary) {
                    doc.setFontSize(16);
                    doc.setTextColor(...PRIM);
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
                        doc.setDrawColor(...PRIM);
                        doc.roundedRect(x, boxY, boxWidth, boxHeight, 2, 2, 'FD');

                        doc.setFontSize(8);
                        doc.setTextColor(...GRAY);
                        doc.text(kpi[0], x + 4, boxY + 7);

                        doc.setFontSize(15);
                        doc.setTextColor(...PRIM);
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

                if (includeStats) {
                    doc.addPage();
                    y = 20;
                    doc.setFontSize(16);
                    doc.setTextColor(...PRIM);
                    doc.text('Estatísticas Descritivas', margin, y);
                    y += 4;

                    const analyticsRows = Object.entries(analytics).map(([col, s]) => [col, s.mean, s.median, s.std, s.min, s.max]);
                    doc.autoTable({
                        startY: y + 10,
                        head: [['Coluna', 'Média', 'Mediana', 'Desvio', 'Min', 'Max']],
                        body: analyticsRows.length ? analyticsRows : [['—', '—', '—', '—', '—', '—']],
                        styles: { fontSize: 8 },
                        headStyles: { fillColor: PRIM, textColor: 255 },
                        alternateRowStyles: { fillColor: LIGHT },
                        margin: { left: margin, right: margin }
                    });
                }

                if (includeInsights) {
                    doc.addPage();
                    y = 20;
                    doc.setFontSize(16);
                    doc.setTextColor(...PRIM);
                    doc.text('Insights Automáticos', margin, y);
                    y += 8;

                    insights.forEach((insight) => {
                        const color = insight.severity === 'critical' ? [220, 38, 38] : insight.severity === 'warning' ? [217, 119, 6] : [2, 132, 199];
                        const lines = doc.splitTextToSize(insight.message, pageWidth - margin * 2 - 6);
                        const boxHeight = 8 + lines.length * 5;

                        if (y + boxHeight > 280) {
                            doc.addPage();
                            y = 20;
                        }

                        doc.setFillColor(250, 250, 250);
                        doc.setDrawColor(...color);
                        doc.rect(margin, y, pageWidth - margin * 2, boxHeight, 'F');
                        doc.setFontSize(9);
                        doc.setTextColor(...color);
                        doc.text(insight.category, margin + 4, y + 6);
                        doc.setFontSize(9);
                        doc.setTextColor(40, 40, 40);
                        doc.text(lines, margin + 4, y + 12);
                        y += boxHeight + 4;
                    });
                }

                if (includeGraphs) {
                    doc.addPage();
                    y = 20;
                    doc.setFontSize(16);
                    doc.setTextColor(...PRIM);
                    doc.text('Amostra dos Dados', margin, y);
                    y += 4;
                    doc.autoTable({
                        startY: y + 10,
                        head: [state.columns],
                        body: state.data.slice(0, 10).map(row => state.columns.map(c => row[c] != null && row[c] !== '' ? String(row[c]) : '-')),
                        styles: { fontSize: 7 },
                        headStyles: { fillColor: PRIM, textColor: 255 },
                        alternateRowStyles: { fillColor: LIGHT },
                        margin: { left: margin, right: margin }
                    });
                }

                if (includeForecast) {
                    doc.addPage();
                    y = 20;
                    doc.setFontSize(16);
                    doc.setTextColor(...PRIM);
                    doc.text('Previsão e Tendência', margin, y);
                    y += 8;
                    doc.setFontSize(10);
                    doc.setTextColor(40, 40, 40);
                    const firstNumeric = state.numericColumns[0];
                    if (firstNumeric) {
                        const values = getNumericValues(firstNumeric);
                        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                        const trend = values.length > 1 ? values[values.length - 1] - values[0] : 0;
                        const lines = [
                            `Coluna principal para tendência: ${firstNumeric}`,
                            `Média observada: ${avg.toFixed(2)}`,
                            `Variação total: ${trend.toFixed(2)}`,
                            'Conclusão: a tendência geral pode sugerir aceleração ou redução conforme a série observada.'
                        ];
                        lines.forEach((line) => {
                            doc.text(doc.splitTextToSize(line, pageWidth - margin * 2), margin, y);
                            y += 8;
                        });
                    } else {
                        doc.text('Nenhuma coluna numérica disponível para análise de tendência.', margin, y);
                    }
                }

                doc.addPage();
                y = 20;
                doc.setFontSize(16);
                doc.setTextColor(...PRIM);
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
                achados.forEach((line) => {
                    const wrapped = doc.splitTextToSize(`•  ${line}`, pageWidth - margin * 2 - 4);
                    doc.text(wrapped, margin + 2, y);
                    y += wrapped.length * 5 + 1;
                });

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
    };
})();
