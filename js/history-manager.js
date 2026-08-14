/**
 * YK CTQ — History Manager v4.0
 * Fetches /api/history/* and renders interactive Plotly charts.
 *
 * Exports:
 *   HistoryManager.renderTrends(container)
 *   HistoryManager.renderAgentLeaderboard(container)
 *   HistoryManager.renderDrillDown(container, results)
 *   HistoryManager.renderSentimentRadar(container, sentimentProfile)
 *   HistoryManager.renderRepeatCallers(container)
 *   HistoryManager.renderAutomationRadar(container)
 */

// Plain script — no ES module import needed; AppInfo pulled from window if available

// ---------------------------------------------------------------------------
// Plotly availability check
// ---------------------------------------------------------------------------
function _plotly() {
    if (typeof Plotly === 'undefined') {
        console.warn('Plotly not loaded. Charts will not render.');
        return null;
    }
    return Plotly;
}

// ---------------------------------------------------------------------------
// Shared colour palette
// ---------------------------------------------------------------------------
const C = {
    primary:  '#00d4ff',
    secondary:'#7c4dff',
    accent:   '#00e676',
    warning:  '#ffb300',
    danger:   '#ff4444',
    bg:       '#111318',
    bg2:      '#181c23',
    border:   '#1e2430',
    textPrim: '#e8edf5',
    textSec:  '#8a9ab5',
    textMut:  '#4a5568',
    gridLine: 'rgba(30,36,48,0.8)',
};

const PLOTLY_LAYOUT_BASE = {
    paper_bgcolor: 'transparent',
    plot_bgcolor:  'transparent',
    font:          { family: "Consolas, 'Courier New', monospace", color: C.textPrim, size: 11 },
    margin:        { t: 30, r: 20, b: 50, l: 60 },
    xaxis:         { gridcolor: C.gridLine, linecolor: C.border, zerolinecolor: C.border },
    yaxis:         { gridcolor: C.gridLine, linecolor: C.border, zerolinecolor: C.border },
    legend:        { bgcolor: 'transparent', bordercolor: C.border, font: { color: C.textPrim } },
    hoverlabel:    { bgcolor: C.bg2, bordercolor: C.primary, font: { color: C.textPrim } },
};

const PLOTLY_CONFIG = {
    displaylogo:     false,
    responsive:      true,
    modeBarButtons:  [['zoom2d','pan2d','resetScale2d','toImage']],
};

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
function _skeleton(msg = 'Loading chart…') {
    return `<div class="chart-loading"><div class="yk-spinner-sm"></div><span>${msg}</span></div>`;
}

function _error(msg) {
    return `<div class="chart-error">⚠ ${msg}</div>`;
}

// ---------------------------------------------------------------------------
// 1. Weekly Score Trend with Anomaly Markers
// ---------------------------------------------------------------------------
async function renderTrends(container) {
    if (!container) return;
    container.innerHTML = _skeleton('Fetching weekly trend data…');

    let trends, anomalies;
    try {
        const [tRes, aRes] = await Promise.all([
            fetch('/api/history/trends?weeks=52'),
            fetch('/api/history/anomalies'),
        ]);
        trends    = await tRes.json();
        anomalies = await aRes.json();
    } catch (e) {
        container.innerHTML = _error('Could not load trend data from server.');
        return;
    }

    if (!trends || !trends.length) {
        container.innerHTML = '<div class="chart-empty">No historical data yet. Run a batch to populate.</div>';
        return;
    }

    const P = _plotly();
    if (!P) { container.innerHTML = _error('Plotly not available.'); return; }

    // Sort ascending by week
    const data = [...trends].reverse();
    const weeks     = data.map(d => d.week_start || d.week);
    const scores    = data.map(d => d.avg_score);
    const passRates = data.map(d => d.avg_pass_rate);
    const volumes   = data.map(d => d.ticket_count);

    // Anomaly markers
    const anomalyX   = [];
    const anomalyY   = [];
    const anomalyTxt = [];
    const anomalyCol = [];
    const anomalySet = new Set(anomalies.map(a => a.week_start));
    anomalies.forEach(a => {
        const idx = weeks.indexOf(a.week_start);
        if (idx >= 0) {
            anomalyX.push(weeks[idx]);
            anomalyY.push(scores[idx]);
            anomalyTxt.push(`${a.direction === 'drop' ? '📉 Score drop' : '📈 Score spike'}<br>Σ ${a.sigma_delta > 0 ? '+' : ''}${a.sigma_delta}`);
            anomalyCol.push(a.direction === 'drop' ? C.danger : C.accent);
        }
    });

    const traces = [
        {
            x: weeks, y: scores, mode: 'lines+markers', name: 'Avg CTQ Score',
            line:   { color: C.primary, width: 2.5 },
            marker: { color: weeks.map((w, i) => anomalySet.has(w) ? C.warning : C.primary),
                      size: weeks.map((w) => anomalySet.has(w) ? 10 : 6) },
            hovertemplate: '<b>%{x}</b><br>Score: %{y:.1f}<extra></extra>',
        },
        {
            x: weeks, y: passRates, mode: 'lines', name: 'Compliance %',
            line: { color: C.secondary, width: 2, dash: 'dot' },
            yaxis: 'y2',
            hovertemplate: '<b>%{x}</b><br>Compliance: %{y:.1f}%<extra></extra>',
        },
        {
            x: anomalyX, y: anomalyY, mode: 'markers', name: 'Anomaly',
            marker: { color: anomalyCol, size: 14, symbol: 'diamond', line: { color: '#fff', width: 1 } },
            text: anomalyTxt, hoverinfo: 'text',
        },
    ];

    const layout = {
        ...PLOTLY_LAYOUT_BASE,
        title:   { text: 'Weekly CTQ Score Trend', font: { color: C.textPrim, size: 14 }, x: 0.02 },
        xaxis:   { ...PLOTLY_LAYOUT_BASE.xaxis, title: 'Week', tickangle: -45 },
        yaxis:   { ...PLOTLY_LAYOUT_BASE.yaxis, title: 'Avg Score', range: [0, 105] },
        yaxis2:  { title: 'Compliance %', overlaying: 'y', side: 'right', range: [0, 105],
                   gridcolor: 'transparent', linecolor: C.border, color: C.secondary },
        showlegend: true,
        shapes: [
            { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 75, y1: 75,
              line: { color: C.warning, width: 1, dash: 'dot' } },
        ],
        annotations: [{
            x: 1, xref: 'paper', y: 75, yref: 'y',
            text: 'Threshold 75', showarrow: false,
            font: { color: C.warning, size: 9 }, xanchor: 'right',
        }],
    };

    container.innerHTML = '<div id="trend-plot" style="width:100%;height:380px;"></div>';
    P.newPlot('trend-plot', traces, layout, PLOTLY_CONFIG);

    // Click on data point → filter results table
    document.getElementById('trend-plot').on('plotly_click', (e) => {
        if (e.points && e.points[0]) {
            const week = e.points[0].x;
            window.dispatchEvent(new CustomEvent('yk:trend-week-click', { detail: { week } }));
        }
    });
}


// ---------------------------------------------------------------------------
// 2. Agent Leaderboard
// ---------------------------------------------------------------------------
async function renderAgentLeaderboard(container, weeks = 8) {
    if (!container) return;
    container.innerHTML = _skeleton('Loading agent data…');

    let data;
    try {
        const res = await fetch(`/api/history/agents?weeks=${weeks}&page=1`);
        data = await res.json();
    } catch (e) {
        container.innerHTML = _error('Could not load agent data.');
        return;
    }

    if (!data.agents || !data.agents.length) {
        container.innerHTML = '<div class="chart-empty">No agent data available yet.</div>';
        return;
    }

    const P = _plotly();
    if (!P) { container.innerHTML = _error('Plotly not available.'); return; }

    const agents = data.agents.slice().reverse();  // best → worst visually bottom to top
    const names  = agents.map(a => a.agent);
    const scores = agents.map(a => a.avg_score);
    const colors = scores.map(s => s >= 85 ? C.accent : s >= 70 ? C.primary : s >= 50 ? C.warning : C.danger);

    const trace = {
        x: scores, y: names, type: 'bar', orientation: 'h', name: 'Avg Score',
        marker: { color: colors },
        hovertemplate: '<b>%{y}</b><br>Score: %{x:.1f}<br><extra></extra>',
        text: scores.map(s => s.toFixed(1)), textposition: 'outside',
        textfont: { color: C.textPrim, size: 10 },
    };

    const layout = {
        ...PLOTLY_LAYOUT_BASE,
        title:   { text: `Agent Performance (Last ${weeks} Weeks)`, font: { color: C.textPrim, size: 13 }, x: 0.02 },
        xaxis:   { ...PLOTLY_LAYOUT_BASE.xaxis, title: 'Avg CTQ Score', range: [0, 110] },
        yaxis:   { ...PLOTLY_LAYOUT_BASE.yaxis, automargin: true },
        margin:  { t: 30, r: 60, b: 50, l: 130 },
        shapes: [{
            type: 'line', x0: 75, x1: 75, y0: -0.5, y1: names.length - 0.5,
            line: { color: C.warning, width: 1.5, dash: 'dot' },
        }],
    };

    container.innerHTML = '<div id="agent-plot" style="width:100%;height:' + Math.max(280, agents.length * 40 + 80) + 'px;"></div>';
    if (data.total_pages > 1) {
        container.innerHTML += `<div class="chart-pagination">Page 1/${data.total_pages} · ${data.total} agents · sorted worst first</div>`;
    }
    P.newPlot('agent-plot', [trace], layout, PLOTLY_CONFIG);
}


// ---------------------------------------------------------------------------
// 3. Drill-Down Explorer (results table filter)
// ---------------------------------------------------------------------------
function renderDrillDown(container, results) {
    if (!container || !results || !results.length) return;
    const P = _plotly();
    if (!P) return;

    // Score distribution histogram
    const scores = results.map(r => r.overall_score);
    const traceDist = {
        x: scores, type: 'histogram', nbinsx: 20, name: 'Score Distribution',
        marker: { color: C.primary, opacity: 0.8 },
        hovertemplate: 'Score %{x:.0f}–%{x:.0f}<br>Count: %{y}<extra></extra>',
    };

    // Category breakdown pie
    const catCounts = {};
    results.forEach(r => { const c = r.category || 'Unknown'; catCounts[c] = (catCounts[c] || 0) + 1; });
    const traceCategories = {
        labels:  Object.keys(catCounts),
        values:  Object.values(catCounts),
        type:    'pie',
        name:    'By Category',
        domain:  { column: 1 },
        marker:  { colors: [C.primary, C.secondary, C.accent, C.warning, C.danger, '#ff6b6b', '#a8edea'] },
        textfont: { color: '#fff' },
        hovertemplate: '<b>%{label}</b><br>%{value} tickets (%{percent})<extra></extra>',
    };

    const layout = {
        ...PLOTLY_LAYOUT_BASE,
        grid:    { rows: 1, columns: 2, pattern: 'independent' },
        margin:  { t: 30, r: 20, b: 50, l: 50 },
        title:   { text: `Drill-Down Explorer — ${results.length} tickets`, font: { color: C.textPrim, size: 13 }, x: 0.02 },
        annotations: [
            { text: 'Score Distribution', x: 0.2, y: 1.05, xref: 'paper', yref: 'paper', showarrow: false, font: { color: C.textSec, size: 11 } },
            { text: 'Category Split',     x: 0.8, y: 1.05, xref: 'paper', yref: 'paper', showarrow: false, font: { color: C.textSec, size: 11 } },
        ],
    };

    container.innerHTML = '<div id="drilldown-plot" style="width:100%;height:320px;"></div>';
    P.newPlot('drilldown-plot', [traceDist, traceCategories], layout, PLOTLY_CONFIG);

    // Click on histogram bin → emit filter event
    document.getElementById('drilldown-plot').on('plotly_click', (e) => {
        if (e.points && e.points[0]) {
            const pt = e.points[0];
            if (pt.xaxis) {
                const minScore = Math.floor(pt.x / 5) * 5;
                window.dispatchEvent(new CustomEvent('yk:drilldown-filter', {
                    detail: { minScore, maxScore: minScore + 5 }
                }));
            }
        }
    });
}


// ---------------------------------------------------------------------------
// 4. Sentiment Radar (7-dimension)
// ---------------------------------------------------------------------------
function renderSentimentRadar(container, profile) {
    if (!container || !profile) return;
    const P = _plotly();
    if (!P) return;

    const dims = [
        { key: 'polarity',             label: 'Polarity' },
        { key: 'frustration_index',    label: 'Frustration' },
        { key: 'escalation_urgency',   label: 'Urgency' },
        { key: 'vip_sensitivity',      label: 'VIP' },
        { key: 'sla_anxiety',          label: 'SLA Anxiety' },
        { key: 'resolution_confidence',label: 'Resolution' },
        { key: 'repeat_caller_signal', label: 'Repeat Caller' },
    ];

    const values = dims.map(d => profile[d.key] ?? 0);
    const labels = dims.map(d => d.label);

    const trace = {
        type:  'scatterpolar',
        r:     [...values, values[0]],
        theta: [...labels, labels[0]],
        fill:  'toself',
        name:  'Sentiment Profile',
        line:  { color: C.primary },
        fillcolor: 'rgba(0,212,255,0.12)',
        hovertemplate: '<b>%{theta}</b>: %{r}<extra></extra>',
    };

    const layout = {
        ...PLOTLY_LAYOUT_BASE,
        polar: {
            bgcolor:   'transparent',
            radialaxis: { visible: true, range: [0, 100], gridcolor: C.gridLine,
                          linecolor: C.border, tickcolor: C.textMut, tickfont: { size: 9 } },
            angularaxis: { gridcolor: C.gridLine, linecolor: C.border },
        },
        showlegend: false,
        margin: { t: 10, r: 30, b: 10, l: 30 },
    };

    container.innerHTML = '';
    P.newPlot(container, [trace], layout, { ...PLOTLY_CONFIG, displayModeBar: false });
}


// ---------------------------------------------------------------------------
// 5. Repeat Callers card
// ---------------------------------------------------------------------------
async function renderRepeatCallers(container) {
    if (!container) return;
    container.innerHTML = _skeleton('Loading repeat caller data…');

    let callers;
    try {
        const res = await fetch('/api/repeat/callers');
        callers = await res.json();
    } catch (e) {
        container.innerHTML = _error('Could not load repeat caller data.');
        return;
    }

    if (!callers || !callers.length) {
        container.innerHTML = '<div class="chart-empty">No repeat callers detected in last 30 days.</div>';
        return;
    }

    const rows = callers.slice(0, 10).map(c => {
        const cats = (() => { try { return JSON.parse(c.categories); } catch { return []; } })();
        return `<tr>
            <td class="rc-caller"><span class="rc-badge">🔁</span>${_esc(c.caller)}</td>
            <td class="rc-count">${c.ticket_count}</td>
            <td class="rc-cats">${cats.map(cat => `<span class="cat-chip">${_esc(cat)}</span>`).join('')}</td>
            <td class="rc-action"><button class="yk-btn-sm" onclick="window.dispatchEvent(new CustomEvent('yk:repeat-caller-detail',{detail:{caller:'${_esc(c.caller)}'}}))">View Tickets</button></td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="rc-header">
            <span class="rc-title">🔁 Repeat Callers — Last 30 Days</span>
            <span class="rc-sub">${callers.length} unique repeat callers</span>
        </div>
        <table class="yk-table rc-table">
            <thead><tr><th>Caller</th><th>Tickets</th><th>Categories</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}


// ---------------------------------------------------------------------------
// 6. Automation Radar
// ---------------------------------------------------------------------------
async function renderAutomationRadar(container) {
    if (!container) return;
    container.innerHTML = _skeleton('Analysing automation candidates…');

    let data;
    try {
        const res = await fetch('/api/automation/candidates');
        data = await res.json();
    } catch (e) {
        container.innerHTML = _error('Could not load automation candidates.');
        return;
    }

    if (data.status === 'computing' || data.status === 'running') {
        container.innerHTML = `
            <div class="auto-radar-computing">
                <div class="yk-spinner-sm"></div>
                <p>Clustering ${data.status === 'running' ? 'in progress' : 'queued'} — this runs in the background.</p>
                <p class="chart-sub">Check back in a moment or re-open this view.</p>
            </div>`;
        setTimeout(() => renderAutomationRadar(container), 5000);
        return;
    }

    const candidates = data.candidates || [];
    if (!candidates.length) {
        container.innerHTML = '<div class="chart-empty">Not enough ticket data for cluster analysis (need ≥30 tickets).</div>';
        return;
    }

    const updated = data.updated_at
        ? new Date(data.updated_at).toLocaleString()
        : 'unknown';

    const cards = candidates.map(c => {
        const terms = (() => { try { return JSON.parse(c.top_terms || '[]'); } catch { return c.top_terms || []; } })();
        const termList = Array.isArray(terms) ? terms : [];
        return `
        <div class="auto-card">
            <div class="auto-card-header">
                <span class="auto-cat">${_esc(c.dominant_category || c.label || 'Cluster')}</span>
                <span class="auto-count">${c.ticket_count} tickets</span>
            </div>
            <div class="auto-terms">${termList.map(t => `<span class="term-chip">${_esc(t)}</span>`).join('')}</div>
            <div class="auto-type">🤖 ${_esc(c.automation_type)}</div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="auto-radar-header">
            <span class="auto-title">🤖 Automation Radar</span>
            <span class="auto-updated">Last computed: ${updated}</span>
        </div>
        <div class="auto-grid">${cards}</div>`;
}


// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


// ---------------------------------------------------------------------------
// Public API — exposed as global for non-module scripts
// ---------------------------------------------------------------------------
window.HistoryManager = {
    renderTrends,
    renderAgentLeaderboard,
    renderDrillDown,
    renderSentimentRadar,
    renderRepeatCallers,
    renderAutomationRadar,
};
