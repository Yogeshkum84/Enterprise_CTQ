/**
 * Export Manager with YK Branding
 * Adds footer to all exports with developer info
 */

import { AppInfo } from './ctq-engine.js';

export const ExportManager = {
    generateCSV(results, config) {
        const headers = [
            'Ticket_ID', 'Agent', 'Priority', 'State', 'Category', 'Subcategory',
            'CTQ_Score', 'Grade', 'Compliance', 'Sentiment', 'Sentiment_Reason',
            // v4.0 fields
            'Frustration_Index', 'Escalation_Urgency', 'VIP_Sensitivity',
            'SLA_Anxiety', 'Resolution_Confidence',
            'Resolution_Integrity', 'Category_Confidence', 'Category_Flag',
            'Category_Suggestion', 'FCR_Fail',
            // Core fields
            'Scored_By', 'Audited_Date', 'Engine_Version',
            ...config.ctqItems.filter(c => c.active).map(c => `CTQ_${c.id}_${c.name.replace(/\s+/g, '_')}`)
        ];

        const rows = results.map(r => {
            const sp = r.sentiment_profile || {};
            return [
                r.ticket_id,
                r.assigned_to || r.agent,
                r.priority,
                r.state,
                r.category,
                r.subcategory,
                r.overall_score,
                r.grade,
                r.compliance_pass ? 'PASS' : 'FAIL',
                r.sentiment,
                r.sentiment_reason,
                // v4.0 intelligence fields
                sp.frustration_index ?? '',
                sp.escalation_urgency ?? '',
                sp.vip_sensitivity ?? '',
                sp.sla_anxiety ?? '',
                sp.resolution_confidence ?? '',
                r.resolution_integrity ?? '',
                r.category_confidence ?? '',
                r.category_flag ? 'YES' : 'NO',
                r.category_suggestion ?? '',
                r.fcr_fail ? 'YES' : 'NO',
                // Core fields
                r.scored_by,
                r.audited_at,
                r.engine_version || AppInfo.version,
                ...config.ctqItems.filter(c => c.active).map(c => r.ctq_scores?.[c.name] || '')
            ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`);
        });
        
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        
        // Add YK Footer to CSV
        const footer = `\n\n` +
            `# ============================================================================\n` +
            `# YK CTQ AUDIT INTELLIGENCE PLATFORM - ENTERPRISE EDITION\n` +
            `# ============================================================================\n` +
            `# Export Date: ${new Date().toISOString()}\n` +
            `# Developer: ${AppInfo.developer}\n` +
            `# Version: ${AppInfo.version} (Intelligence Edition)\n` +
            `# Support: ${AppInfo.supportEmail}\n` +
            `# Total Records: ${results.length}\n` +
            `# Licence: MIT — Free to use, modify and distribute\n` +
            `# ============================================================================`;
        
        return csvContent + footer;
    },
    
    generatePDF(results, config, user) {
        const avg = results.length ? (results.reduce((s, r) => s + r.overall_score, 0) / results.length).toFixed(1) : 0;
        const compliance = results.length ? Math.round(results.filter(r => r.compliance_pass).length / results.length * 100) : 0;
        
        return `<!DOCTYPE html>
<html>
<head>
    <title>YK CTQ Audit Report - ${config.orgName}</title>
    <meta charset="UTF-8">
    <style>
        @page { size: A4 landscape; margin: 15mm; }
        body { 
            font-family: Arial, sans-serif; 
            font-size: 10px; 
            line-height: 1.4;
            color: #1a1a2e;
            margin: 0;
            padding: 0;
        }
        .yk-header { 
            display: flex; 
            align-items: center; 
            border-bottom: 3px solid #00d4ff; 
            padding-bottom: 15px; 
            margin-bottom: 20px;
        }
        .yk-logo-box {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #00d4ff, #7c4dff);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 24px;
            margin-right: 15px;
        }
        .yk-title-block h1 {
            margin: 0;
            font-size: 20px;
            color: #1a1a2e;
        }
        .yk-title-block p {
            margin: 5px 0 0 0;
            color: #666;
            font-size: 11px;
        }
        .yk-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }
        .yk-stat-box {
            background: #f0f4f8;
            border-radius: 6px;
            padding: 12px;
            text-align: center;
            border-left: 4px solid #00d4ff;
        }
        .yk-stat-label {
            font-size: 9px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .yk-stat-value {
            font-size: 20px;
            font-weight: bold;
            color: #1a1a2e;
            margin-top: 5px;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px;
            font-size: 9px;
        }
        th { 
            background: #1a1a2e; 
            color: white; 
            padding: 8px; 
            text-align: left;
            font-weight: 600;
        }
        td { 
            padding: 6px 8px; 
            border-bottom: 1px solid #e1e4e8; 
        }
        tr:nth-child(even) { background: #f6f8fa; }
        .score-excellent { color: #00e676; font-weight: bold; }
        .score-good { color: #00d4ff; font-weight: bold; }
        .score-fair { color: #ffb300; font-weight: bold; }
        .score-poor { color: #ff4444; font-weight: bold; }
        .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .badge-pass { background: #d4edda; color: #155724; }
        .badge-fail { background: #f8d7da; color: #721c24; }
        
        /* YK Footer - Appears on every page */
        .yk-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #1a1a2e;
            color: white;
            padding: 10px 15mm;
            font-size: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .yk-footer-brand {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .yk-footer-logo {
            width: 20px;
            height: 20px;
            background: linear-gradient(135deg, #00d4ff, #7c4dff);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 10px;
        }
        .yk-footer-info {
            text-align: right;
        }
        .yk-footer-info a {
            color: #00d4ff;
            text-decoration: none;
        }
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 80px;
            color: rgba(0, 212, 255, 0.05);
            font-weight: bold;
            pointer-events: none;
            z-index: -1;
        }
    </style>
</head>
<body>
    <div class="watermark">YK ENTERPRISE</div>
    
    <div class="yk-header">
        <div class="yk-logo-box">YK</div>
        <div class="yk-title-block">
            <h1>${config.orgName} - CTQ Audit Report</h1>
            <p>Generated by ${AppInfo.developer} | Version ${AppInfo.version} | ${new Date().toLocaleString()}</p>
        </div>
    </div>
    
    <div class="yk-stats">
        <div class="yk-stat-box">
            <div class="yk-stat-label">Total Tickets</div>
            <div class="yk-stat-value">${results.length}</div>
        </div>
        <div class="yk-stat-box">
            <div class="yk-stat-label">Avg Score</div>
            <div class="yk-stat-value">${avg}</div>
        </div>
        <div class="yk-stat-box">
            <div class="yk-stat-label">Compliance</div>
            <div class="yk-stat-value">${compliance}%</div>
        </div>
        <div class="yk-stat-box">
            <div class="yk-stat-label">Report ID</div>
            <div class="yk-stat-value">${Date.now().toString(36).toUpperCase().slice(-6)}</div>
        </div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Ticket ID</th>
                <th>Agent</th>
                <th>Priority</th>
                <th>State</th>
                <th>Score</th>
                <th>Grade</th>
                <th>Compliance</th>
                <th>Sentiment</th>
            </tr>
        </thead>
        <tbody>
            ${results.map(r => `
                <tr>
                    <td><strong>${r.ticket_id}</strong></td>
                    <td>${r.assigned_to || r.agent}</td>
                    <td>${r.priority}</td>
                    <td>${r.state}</td>
                    <td class="${r.overall_score >= 85 ? 'score-excellent' : r.overall_score >= 70 ? 'score-good' : r.overall_score >= 50 ? 'score-fair' : 'score-poor'}">
                        ${r.overall_score.toFixed(1)}
                    </td>
                    <td>${r.grade}</td>
                    <td><span class="badge ${r.compliance_pass ? 'badge-pass' : 'badge-fail'}">${r.compliance_pass ? 'PASS' : 'FAIL'}</span></td>
                    <td>${r.sentiment}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <!-- Footer appears on every printed page -->
    <div class="yk-footer">
        <div class="yk-footer-brand">
            <div class="yk-footer-logo">YK</div>
            <div>
                <div style="font-weight: bold;">YK CTQ Audit Intelligence Platform</div>
                <div style="font-size: 7px; opacity: 0.8;">Enterprise Edition</div>
            </div>
        </div>
        <div class="yk-footer-info">
            <div>Developer: ${AppInfo.developer} | Version: ${AppInfo.version}</div>
            <div>Support: <a href="mailto:${AppInfo.supportEmail}">${AppInfo.supportEmail}</a></div>
            <div style="margin-top: 4px; opacity: 0.6;">© 2026 Yogesh K — MIT Licensed</div>
        </div>
    </div>
</body>
</html>`;
    }
};