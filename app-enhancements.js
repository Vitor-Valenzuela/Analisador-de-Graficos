(function () {
    if (window.__dataAnalyzerEnhancementsLoaded) return;
    window.__dataAnalyzerEnhancementsLoaded = true;

    function parseNumber(value) {
        if (value === null || value === undefined || value === '') return NaN;
        if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;

        const text = String(value).trim();
        if (!text) return NaN;

        const normalized = text
            .replace(/\s+/g, '')
            .replace(/\$/g, '')
            .replace(/%/g, '')
            .replace(/\./g, '')
            .replace(',', '.')
            .replace(/[^0-9.+-]/g, '');

        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : NaN;
    }

    function formatValue(value) {
        if (value === null || value === undefined || value === '') return '-';
        if (typeof value === 'number') {
            if (Number.isInteger(value)) return value.toLocaleString('pt-BR');
            return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
        }
        return String(value);
    }

    function getNumericValues(columnName) {
        const values = [];
        if (!window.state || !Array.isArray(window.state.data)) return values;
        window.state.data.forEach((row) => {
            const value = parseNumber(row[columnName]);
            if (Number.isFinite(value)) values.push(value);
        });
        return values;
    }

    function getColumnSummary(columnName) {
        const values = getNumericValues(columnName);
        if (!values.length) {
            return { count: 0, mean: 0, median: 0, std: 0, min: 0, max: 0 };
        }

        const sorted = [...values].sort((a, b) => a - b);
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
        const std = Math.sqrt(variance);
        const median = sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];

        return {
            count: values.length,
            mean,
            median,
            std,
            min: sorted[0],
            max: sorted[sorted.length - 1]
        };
    }

    function buildSummaryStats() {
        if (!window.state || !window.state.data.length) {
            return {
                rows: 0,
                columns: 0,
                nulls: 0,
                duplicates: 0,
                numericColumns: 0,
                categoricalColumns: 0,
                completeness: 100,
                outliers: 0,
                biggestColumn: null
            };
        }

        const rows = window.state.data.length;
        const columns = window.state.columns.length;
        const totalCells = rows * columns;

        let nulls = 0;
        let duplicates = 0;
        window.state.columns.forEach((column) => {
            window.state.data.forEach((row) => {
                if (row[column] === null || row[column] === undefined || row[column] === '') nulls++;
            });
        });

        const uniqueRows = new Set(window.state.data.map((row) => JSON.stringify(row)));
        duplicates = Math.max(0, rows - uniqueRows.size);

        const numericColumns = window.state.numericColumns || [];
        let biggestColumn = null;
        let maxValues = -Infinity;

        numericColumns.forEach((column) => {
            const values = getNumericValues(column);
            const range = values.length ? Math.max(...values) - Math.min(...values) : 0;
            if (range > maxValues) {
                maxValues = range;
                biggestColumn = column;
            }
        });

        const completeness = totalCells > 0 ? ((totalCells - nulls) / totalCells) * 100 : 100;
        let outliers = 0;

        numericColumns.forEach((column) => {
            const summary = getColumnSummary(column);
            if (summary.count > 0) {
                const threshold = summary.std * 3;
                window.state.data.forEach((row) => {
                    const value = parseNumber(row[column]);
                    if (Number.isFinite(value) && Math.abs(value - summary.mean) > threshold) outliers++;
                });
            }
        });

        return {
            rows,
            columns,
            nulls,
            duplicates,
            numericColumns: numericColumns.length,
            categoricalColumns: window.state.categoricalColumns ? window.state.categoricalColumns.length : 0,
            completeness,
            outliers,
            biggestColumn
        };
    }

    function getCorrelationMatrix() {
        const numericColumns = window.state.numericColumns || [];
        const matrix = {};

        numericColumns.forEach((colA) => {
            matrix[colA] = {};
            const valuesA = getNumericValues(colA);
            numericColumns.forEach((colB) => {
                const valuesB = getNumericValues(colB);
                if (!valuesA.length || !valuesB.length || valuesA.length !== valuesB.length) {
                    matrix[colA][colB] = 0;
                    return;
                }

                const meanA = valuesA.reduce((sum, v) => sum + v, 0) / valuesA.length;
                const meanB = valuesB.reduce((sum, v) => sum + v, 0) / valuesB.length;
                let numerator = 0;
                let sumA = 0;
                let sumB = 0;

                valuesA.forEach((valueA, index) => {
                    const diffA = valueA - meanA;
                    const diffB = valuesB[index] - meanB;
                    numerator += diffA * diffB;
                    sumA += diffA ** 2;
                    sumB += diffB ** 2;
                });

                const denominator = Math.sqrt(sumA * sumB) || 1;
                matrix[colA][colB] = denominator ? numerator / denominator : 0;
            });
        });

        return matrix;
    }

    function ensureSummaryContainer() {
        let panel = document.getElementById('datasetSummary');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'datasetSummary';
            panel.className = 'card';
            const insertedTarget = document.querySelector('#dashboard .card, #dashboardContent');
            if (insertedTarget && insertedTarget.parentNode) {
                insertedTarget.parentNode.insertBefore(panel, insertedTarget.nextSibling);
            } else {
                const main = document.querySelector('.pages-container');
                if (main) main.appendChild(panel);
            }
        }
        return panel;
    }

    function renderDatasetSummary() {
        const panel = ensureSummaryContainer();
        if (!window.state || !window.state.data.length) {
            panel.innerHTML = '<h3>📌 Resumo do Dataset</h3><p>Carregue um arquivo para visualizar estatísticas.</p>';
            return;
        }

        const summary = buildSummaryStats();
        const correlation = getCorrelationMatrix();
        const topCorrelations = [];

        Object.keys(correlation).forEach((colA) => {
            Object.keys(correlation[colA]).forEach((colB) => {
                const value = correlation[colA][colB];
                if (colA !== colB && Math.abs(value) > 0.5) {
                    topCorrelations.push({ colA, colB, value });
                }
            });
        });

        topCorrelations.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
        const top = topCorrelations.slice(0, 3);

        const html = `
            <h3>📌 Resumo do Dataset</h3>
            <div class="kpi-grid">
                <div class="kpi-card">
                    <div class="kpi-label">Linhas</div>
                    <div class="kpi-value">${summary.rows.toLocaleString('pt-BR')}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Colunas</div>
                    <div class="kpi-value">${summary.columns}</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Completude</div>
                    <div class="kpi-value">${summary.completeness.toFixed(1)}%</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">Outliers</div>
                    <div class="kpi-value">${summary.outliers}</div>
                </div>
            </div>
            <div class="summary-info">
                <p><strong>Coluna dominante:</strong> ${summary.biggestColumn || 'N/A'}</p>
                <p><strong>Duplicatas:</strong> ${summary.duplicates}</p>
                <p><strong>Nulos:</strong> ${summary.nulls}</p>
                <p><strong>Correlação forte:</strong> ${top.length ? top.map(item => `${item.colA} ↔ ${item.colB} (${item.value.toFixed(2)})`).join(' | ') : 'Nenhuma detectada'}</p>
            </div>
        `;

        panel.innerHTML = html;
    }

    function generateForecast(columnName, periods = 6) {
        const values = getNumericValues(columnName);
        if (values.length < 2) {
            return { values: [], forecast: [] };
        }

        const n = values.length;
        const x = Array.from({ length: n }, (_, index) => index + 1);
        const sumX = x.reduce((sum, value) => sum + value, 0);
        const sumY = values.reduce((sum, value) => sum + value, 0);
        const sumXY = x.reduce((sum, value, index) => sum + value * values[index], 0);
        const sumXX = x.reduce((sum, value) => sum + value * value, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
        const intercept = (sumY - slope * sumX) / n;

        const forecast = [];
        let lastValue = values[values.length - 1];
        for (let step = 1; step <= periods; step++) {
            const projected = intercept + slope * (n + step);
            forecast.push({ step, value: projected });
            lastValue = projected;
        }

        return { values, forecast };
    }

    function renderForecastPanel() {
        const target = document.getElementById('forecastPanel');
        if (!target) return;

        if (!window.state || !window.state.data.length || !window.state.numericColumns.length) {
            target.innerHTML = '<p>Não há dados numéricos para prever.</p>';
            return;
        }

        const column = window.state.numericColumns[0];
        const forecast = generateForecast(column, 6);
        const rows = forecast.forecast.map((item) => `<tr><td>+${item.step}</td><td>${Number(item.value).toFixed(2)}</td></tr>`).join('');
        target.innerHTML = `
            <h3>📈 Previsão de Tendência</h3>
            <p><strong>Coluna base:</strong> ${column}</p>
            <table>
              <thead><tr><th>Período</th><th>Valor previsto</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="2">Sem previsão</td></tr>'}</tbody>
            </table>
        `;
    }

    function enhanceApp() {
        if (!window.state) return;

        const oldOnDataLoaded = window.onDataLoaded;
        if (oldOnDataLoaded) {
            window.onDataLoaded = function (rows) {
                const result = oldOnDataLoaded(rows);
                renderDatasetSummary();
                renderForecastPanel();
                return result;
            };
        }

        const oldClearData = window.clearData;
        if (oldClearData) {
            window.clearData = function () {
                const result = oldClearData();
                const panel = ensureSummaryContainer();
                panel.innerHTML = '<h3>📌 Resumo do Dataset</h3><p>Carregue um arquivo para visualizar estatísticas.</p>';
                const forecast = document.getElementById('forecastPanel');
                if (forecast) forecast.innerHTML = '<p>Sem previsão disponível.</p>';
                return result;
            };
        }

        const oldGenerateInsights = window.generateInsights;
        if (oldGenerateInsights) {
            window.generateInsights = function () {
                const insights = [];
                if (!window.state || !window.state.data.length) {
                    showNotification('Carregue um arquivo', 'warning');
                    return;
                }

                const summary = buildSummaryStats();
                if (summary.nulls > 0) {
                    insights.push({ severity: summary.nulls > 0.3 * summary.rows * summary.columns ? 'critical' : 'warning', category: 'NULOS', message: `Há ${summary.nulls} valores vazios no conjunto.` });
                }

                if (summary.duplicates > 0) {
                    insights.push({ severity: 'warning', category: 'DUPLICATAS', message: `${summary.duplicates} linhas duplicadas foram encontradas.` });
                }

                if (window.state.numericColumns.length) {
                    window.state.numericColumns.forEach((column) => {
                        const stats = getColumnSummary(column);
                        if (stats.count > 2) {
                            const threshold = stats.std * 3;
                            const anomalies = window.state.data.filter((row) => {
                                const value = parseNumber(row[column]);
                                return Number.isFinite(value) && Math.abs(value - stats.mean) > threshold;
                            }).length;
                            if (anomalies > 0) {
                                insights.push({ severity: 'info', category: 'ANOMALIAS', message: `${anomalies} valores fora do padrão em "${column}".` });
                            }
                        }
                    });
                }

                const matrix = getCorrelationMatrix();
                let strongest = null;
                Object.keys(matrix).forEach((colA) => {
                    Object.keys(matrix[colA]).forEach((colB) => {
                        if (colA !== colB) {
                            const value = Math.abs(matrix[colA][colB]);
                            if (!strongest || value > strongest.value) {
                                strongest = { colA, colB, value };
                            }
                        }
                    });
                });

                if (strongest && strongest.value > 0.75) {
                    insights.push({ severity: 'info', category: 'CORRELAÇÃO', message: `Alta correlação entre ${strongest.colA} e ${strongest.colB} (${strongest.value.toFixed(2)}).` });
                }

                if (!insights.length) {
                    insights.push({ severity: 'info', category: 'ESTADO', message: 'Dados consistentes e sem anomalias detectadas.' });
                }

                const html = insights.map((item) => `
                    <div class="insight-item ${item.severity}">
                        <div class="insight-icon">${item.severity === 'critical' ? '🔴' : item.severity === 'warning' ? '⚠️' : 'ℹ️'}</div>
                        <div class="insight-content">
                            <h4>${item.category}</h4>
                            <p>${item.message}</p>
                        </div>
                    </div>
                `).join('');

                document.getElementById('insightsContent').innerHTML = html || '<p>Nenhum insight detectado</p>';
                showNotification('Insights atualizados', 'success');
            };
        }

        const oldRenderKPIs = window.renderKPIs;
        if (oldRenderKPIs) {
            window.renderKPIs = function () {
                const stats = buildSummaryStats();
                const kpiHtml = `
                    <div class="kpi-card"><div class="kpi-label">📊 Registros</div><div class="kpi-value">${stats.rows.toLocaleString('pt-BR')}</div></div>
                    <div class="kpi-card"><div class="kpi-label">📋 Colunas</div><div class="kpi-value">${stats.columns}</div></div>
                    <div class="kpi-card"><div class="kpi-label">⚠️ Nulos</div><div class="kpi-value">${stats.nulls.toLocaleString('pt-BR')}</div></div>
                    <div class="kpi-card"><div class="kpi-label">📌 Duplicados</div><div class="kpi-value">${stats.duplicates}</div></div>
                    <div class="kpi-card"><div class="kpi-label">🔢 Numéricas</div><div class="kpi-value">${stats.numericColumns}</div></div>
                    <div class="kpi-card"><div class="kpi-label">💯 Completude</div><div class="kpi-value">${stats.completeness.toFixed(1)}%</div></div>
                `;
                document.getElementById('kpiGrid').innerHTML = kpiHtml;
            };
        }

        const oldExportCSV = window.exportCSV;
        if (oldExportCSV) {
            window.exportCSV = function () {
                if (!window.state || !window.state.data.length) {
                    showNotification('Carregue um arquivo antes de exportar', 'warning');
                    return;
                }
                const csv = [
                    window.state.columns.map((column) => `"${String(column).replace(/"/g, '""')}"`).join(','),
                    ...window.state.data.map((row) => window.state.columns.map((column) => {
                        const value = row[column];
                        const stringValue = value === null || value === undefined ? '' : String(value).replace(/"/g, '""');
                        return `"${stringValue}"`;
                    }).join(','))
                ].join('\n');
                downloadFile(csv, 'dados_exportados.csv', 'text/csv;charset=utf-8;');
                showNotification('CSV exportado', 'success');
            };
        }

        const oldGenerateComparacao = window.generateComparacao;
        if (oldGenerateComparacao) {
            window.generateComparacao = function () {
                const col = document.getElementById('compColumn').value;
                const metric = document.getElementById('compMetric').value;
                if (!col) {
                    showNotification('Selecione coluna', 'warning');
                    return;
                }

                const values = getNumericValues(col);
                if (!values.length) {
                    showNotification('Sem valores numéricos na coluna selecionada', 'warning');
                    return;
                }

                const stats = getColumnSummary(col);
                let result = 0;
                if (metric === 'mean') result = stats.mean;
                else if (metric === 'median') result = stats.median;
                else if (metric === 'std') result = stats.std;
                else if (metric === 'min') result = stats.min;
                else if (metric === 'max') result = stats.max;

                const html = `
                    <div style="padding: 16px; background: #1a56db; color: white; border-radius: 8px; text-align: center;">
                        <h3>${metric.toUpperCase()} de ${col}</h3>
                        <h1 style="color: white;">${Number(result).toFixed(2)}</h1>
                    </div>
                `;
                document.getElementById('comparacaoContent').innerHTML = html;
            };
        }

        const panel = document.getElementById('forecastPanel');
        if (!panel) {
            const forecastCard = document.createElement('div');
            forecastCard.id = 'forecastPanel';
            forecastCard.className = 'card';
            const target = document.getElementById('dashboardContent');
            if (target) {
                target.appendChild(forecastCard);
            }
        }

        renderDatasetSummary();
        renderForecastPanel();
    }

    window.generateForecast = generateForecast;
    window.getDatasetSummary = buildSummaryStats;
    window.getCorrelationMatrix = getCorrelationMatrix;
    window.renderDatasetSummary = renderDatasetSummary;
    window.renderForecastPanel = renderForecastPanel;

    document.addEventListener('DOMContentLoaded', () => {
        enhanceApp();
        const observer = new MutationObserver(() => {
            if (window.state && window.state.data && window.state.data.length) {
                renderDatasetSummary();
                renderForecastPanel();
            }
        });

        const target = document.querySelector('.pages-container');
        if (target) observer.observe(target, { childList: true, subtree: true });
    });
})();
