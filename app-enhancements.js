(function () {
    if (window.__dataAnalyzerEnhancementsLoaded) return;
    window.__dataAnalyzerEnhancementsLoaded = true;

    const ensureStateBinding = () => {
        if (typeof state !== 'undefined') {
            Object.defineProperty(window, 'state', {
                configurable: true,
                enumerable: true,
                get() {
                    return state;
                },
                set(value) {
                    return value;
                }
            });
            return state;
        }
        return window.state || null;
    };

    function getCurrentState() {
        return ensureStateBinding();
    }

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
        const current = getCurrentState();
        if (!current || !Array.isArray(current.data)) return [];

        return current.data
            .map(row => parseNumber(row[columnName]))
            .filter(value => Number.isFinite(value));
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
        const current = getCurrentState();
        if (!current || !current.data.length) {
            return { rows: 0, columns: 0, nulls: 0, duplicates: 0, numericColumns: 0, categoricalColumns: 0, completeness: 100, outliers: 0, biggestColumn: null };
        }

        const rows = current.data.length;
        const columns = current.columns.length;
        const totalCells = rows * columns;

        let nulls = 0;
        current.columns.forEach((column) => {
            current.data.forEach((row) => {
                if (row[column] === null || row[column] === undefined || row[column] === '') nulls++;
            });
        });

        const uniqueRows = new Set(current.data.map((row) => JSON.stringify(row)));
        const duplicates = Math.max(0, rows - uniqueRows.size);

        const numericColumns = current.numericColumns || [];
        let biggestColumn = null;
        let maxRange = -Infinity;

        numericColumns.forEach((column) => {
            const values = getNumericValues(column);
            if (!values.length) return;
            const range = Math.max(...values) - Math.min(...values);
            if (range > maxRange) {
                maxRange = range;
                biggestColumn = column;
            }
        });

        const completeness = totalCells > 0 ? ((totalCells - nulls) / totalCells) * 100 : 100;

        let outliers = 0;
        numericColumns.forEach((column) => {
            const summary = getColumnSummary(column);
            if (summary.count > 0) {
                const threshold = summary.std * 3;
                current.data.forEach((row) => {
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
            categoricalColumns: current.categoricalColumns ? current.categoricalColumns.length : 0,
            completeness,
            outliers,
            biggestColumn
        };
    }

    function getCorrelationMatrix() {
        const current = getCurrentState();
        if (!current || !current.numericColumns || !current.numericColumns.length) return {};

        const matrix = {};
        current.numericColumns.forEach((colA) => {
            matrix[colA] = {};
            const valuesA = getNumericValues(colA);
            current.numericColumns.forEach((colB) => {
                const valuesB = getNumericValues(colB);
                if (!valuesA.length || !valuesB.length || valuesA.length !== valuesB.length) {
                    matrix[colA][colB] = 0;
                    return;
                }

                const meanA = valuesA.reduce((sum, value) => sum + value, 0) / valuesA.length;
                const meanB = valuesB.reduce((sum, value) => sum + value, 0) / valuesB.length;

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

    function ensureSummaryPanel() {
        let panel = document.getElementById('datasetSummary');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'datasetSummary';
            panel.className = 'card summary-panel';
            const target = document.getElementById('dashboardContent');
            if (target) {
                target.appendChild(panel);
            } else {
                const main = document.querySelector('.pages-container');
                if (main) main.appendChild(panel);
            }
        }
        return panel;
    }

    function ensureForecastPanel() {
        let panel = document.getElementById('forecastPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'forecastPanel';
            panel.className = 'card forecast-panel';
            const target = document.getElementById('dashboardContent');
            if (target) {
                target.appendChild(panel);
            }
        }
        return panel;
    }

    function renderDatasetSummary() {
        const panel = ensureSummaryPanel();
        const current = getCurrentState();

        if (!current || !current.data || !current.data.length) {
            panel.innerHTML = '<h3>📌 Resumo do Dataset</h3><p>Carregue um arquivo para visualizar estatísticas.</p>';
            return;
        }

        const summary = buildSummaryStats();
        const correlation = getCorrelationMatrix();
        const strongest = [];

        Object.keys(correlation).forEach((colA) => {
            Object.keys(correlation[colA]).forEach((colB) => {
                if (colA !== colB) {
                    const value = Math.abs(correlation[colA][colB]);
                    if (value > 0.5) strongest.push({ colA, colB, value });
                }
            });
        });

        strongest.sort((a, b) => b.value - a.value);
        const topCorrelation = strongest.slice(0, 3).map(item => `${item.colA} ↔ ${item.colB} (${item.value.toFixed(2)})`).join(' | ') || 'Nenhuma detectada';

        panel.innerHTML = `
            <h3>📌 Resumo do Dataset</h3>
            <div class="kpi-grid summary-kpis">
                <div class="kpi-card"><div class="kpi-label">Linhas</div><div class="kpi-value">${summary.rows.toLocaleString('pt-BR')}</div></div>
                <div class="kpi-card"><div class="kpi-label">Colunas</div><div class="kpi-value">${summary.columns}</div></div>
                <div class="kpi-card"><div class="kpi-label">Completude</div><div class="kpi-value">${summary.completeness.toFixed(1)}%</div></div>
                <div class="kpi-card"><div class="kpi-label">Outliers</div><div class="kpi-value">${summary.outliers}</div></div>
            </div>
            <div class="summary-info">
                <p><strong>Coluna dominante:</strong> ${summary.biggestColumn || 'N/A'}</p>
                <p><strong>Duplicatas:</strong> ${summary.duplicates}</p>
                <p><strong>Nulos:</strong> ${summary.nulls}</p>
                <p><strong>Correlação relevante:</strong> ${topCorrelation}</p>
            </div>
        `;
    }

    function generateForecast(columnName, periods = 6) {
        const values = getNumericValues(columnName);
        if (values.length < 2) return { values: [], forecast: [] };

        const n = values.length;
        const x = Array.from({ length: n }, (_, index) => index + 1);
        const sumX = x.reduce((sum, value) => sum + value, 0);
        const sumY = values.reduce((sum, value) => sum + value, 0);
        const sumXY = x.reduce((sum, value, index) => sum + value * values[index], 0);
        const sumXX = x.reduce((sum, value) => sum + value * value, 0);

        const slope = (n * sumXY - sumX * sumY) / ((n * sumXX - sumX * sumX) || 1);
        const intercept = (sumY - slope * sumX) / n;

        const forecast = [];
        for (let step = 1; step <= periods; step++) {
            forecast.push({
                step,
                value: intercept + slope * (n + step)
            });
        }

        return { values, forecast };
    }

    function renderForecastPanel() {
        const panel = ensureForecastPanel();
        const current = getCurrentState();

        if (!current || !current.data || !current.data.length || !current.numericColumns || !current.numericColumns.length) {
            panel.innerHTML = '<h3>📈 Previsão de Tendência</h3><p>Sem dados numéricos para prever.</p>';
            return;
        }

        const column = current.numericColumns[0];
        const forecast = generateForecast(column, 6);
        const rows = forecast.forecast.map(item => `<tr><td>+${item.step}</td><td>${Number(item.value).toFixed(2)}</td></tr>`).join('');

        panel.innerHTML = `
            <h3>📈 Previsão de Tendência</h3>
            <p><strong>Coluna base:</strong> ${column}</p>
            <table class="forecast-table">
                <thead>
                    <tr><th>Período</th><th>Valor previsto</th></tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="2">Sem previsão</td></tr>'}</tbody>
            </table>
        `;
    }

    function initializeEnhancements() {
        const current = getCurrentState();
        if (current && current.data && current.data.length) {
            renderDatasetSummary();
            renderForecastPanel();
        }
    }

    const originalOnDataLoaded = window.onDataLoaded;
    if (typeof originalOnDataLoaded === 'function') {
        window.onDataLoaded = function (rows) {
            const result = originalOnDataLoaded(rows);
            renderDatasetSummary();
            renderForecastPanel();
            return result;
        };
    }

    const originalClearData = window.clearData;
    if (typeof originalClearData === 'function') {
        window.clearData = function () {
            const result = originalClearData();
            const summary = document.getElementById('datasetSummary');
            if (summary) summary.innerHTML = '<h3>📌 Resumo do Dataset</h3><p>Carregue um arquivo para visualizar estatísticas.</p>';
            const forecast = document.getElementById('forecastPanel');
            if (forecast) forecast.innerHTML = '<h3>📈 Previsão de Tendência</h3><p>Sem previsão disponível.</p>';
            return result;
        };
    }

    const originalRenderDashboard = window.renderDashboard;
    if (typeof originalRenderDashboard === 'function') {
        window.renderDashboard = function () {
            const result = originalRenderDashboard();
            renderDatasetSummary();
            renderForecastPanel();
            return result;
        };
    }

    document.addEventListener('DOMContentLoaded', () => {
        initializeEnhancements();
    });
})();
