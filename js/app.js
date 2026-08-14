// YK CTQ Audit Platform v4.0 - Intelligence Edition
console.log('🚀 CTQ Enterprise v4.0 System Initialized');

// ============================================
// STATE & CONFIG
// ============================================
// ============================================
// CTQ ITEMS — 42-criterion configuration
// ============================================
function _generateCTQItems() {
    const items = [
        {id:1,  name:"Ticket Categorisation",                    pillar:"Consistent Quality",     weight:2.38},
        {id:2,  name:"Self-Service Identification",              pillar:"Productivity",            weight:2.38},
        {id:3,  name:"Work Notes Documentation",                 pillar:"Compliance",              weight:2.38},
        {id:4,  name:"Screenshot Attachment",                    pillar:"Consistent Quality",     weight:2.38},
        {id:5,  name:"Relevant Information",                     pillar:"CSAT/Retention",         weight:2.38},
        {id:6,  name:"Ticket Status Change Accuracy",            pillar:"Compliance",              weight:2.38},
        {id:7,  name:"Correct CI/OS/Product Tier",               pillar:"Risk Management",        weight:2.38},
        {id:8,  name:"Business Service Mapping",                 pillar:"Consistent Quality",     weight:2.38},
        {id:9,  name:"Category/Sub-Category Accuracy",           pillar:"Consistent Quality",     weight:2.38},
        {id:10, name:"Additional Comments / Email Format",       pillar:"CSAT/Retention",         weight:2.38},
        {id:11, name:"Email Content Quality",                    pillar:"CSAT/Retention",         weight:2.38},
        {id:12, name:"Use of Greetings/Signature",               pillar:"CSAT/Retention",         weight:2.38},
        {id:13, name:"Email Grammar & Etiquette",                pillar:"Training & Coaching",    weight:2.38},
        {id:14, name:"Avoiding Internal IT Info in Comments",    pillar:"Compliance",              weight:2.38},
        {id:15, name:"Accurate Field Updates",                   pillar:"Consistent Quality",     weight:2.38},
        {id:16, name:"Customer Details Accuracy",                pillar:"Consistent Quality",     weight:2.38},
        {id:17, name:"Short Description Appropriateness",        pillar:"Productivity",            weight:2.38},
        {id:18, name:"Urgency/Impact Selection",                 pillar:"Risk Management",        weight:2.38},
        {id:19, name:"Detailed Description Quality",             pillar:"Consistent Quality",     weight:2.38},
        {id:20, name:"Owner Field Accuracy",                     pillar:"Compliance",              weight:2.38},
        {id:21, name:"Contact Type Accuracy",                    pillar:"CSAT/Retention",         weight:2.38},
        {id:22, name:"Ticket Ownership",                         pillar:"Productivity",            weight:2.38},
        {id:23, name:"User Contact Timeliness",                  pillar:"CSAT/Retention",         weight:2.38},
        {id:24, name:"Ticket History Check",                     pillar:"Continuous Improvement", weight:2.38},
        {id:25, name:"Probing / Issue Identification",           pillar:"Continuous Improvement", weight:2.38},
        {id:26, name:"Irrelevant Questions Avoidance",           pillar:"Productivity",            weight:2.38},
        {id:27, name:"KB Reference Usage",                       pillar:"Continuous Improvement", weight:2.38},
        {id:28, name:"Troubleshooting Effectiveness",            pillar:"Continuous Improvement", weight:2.38},
        {id:29, name:"Unnecessary Ticket Pending",               pillar:"Productivity",            weight:2.38},
        {id:30, name:"Out-of-Business Hours Contact",            pillar:"CSAT/Retention",         weight:2.38},
        {id:31, name:"User Education",                           pillar:"Training & Coaching",    weight:2.38},
        {id:32, name:"Expectation Setting",                      pillar:"CSAT/Retention",         weight:2.38},
        {id:33, name:"Incorrect KB Reference",                   pillar:"Risk Management",        weight:2.38},
        {id:34, name:"KB Attachment on Ticket",                  pillar:"Compliance",              weight:2.38},
        {id:35, name:"Strike Rule Initiation",                   pillar:"Compliance",              weight:2.38},
        {id:36, name:"Incorrect Strike Initiation",              pillar:"Risk Management",        weight:2.38},
        {id:37, name:"Manual Strike Process Adherence",          pillar:"Risk Management",        weight:2.38},
        {id:38, name:"Correct On-Hold Reason",                   pillar:"Compliance",              weight:2.38},
        {id:39, name:"SME Consultation",                         pillar:"Continuous Improvement", weight:2.38},
        {id:40, name:"Incorrect Ticket Type/Form",               pillar:"Risk Management",        weight:2.38},
        {id:41, name:"Inefficient Resolution",                   pillar:"Productivity",            weight:2.40},
        {id:42, name:"Lead/SME Stamp Requirement",               pillar:"Compliance",              weight:2.40}
    ];
    return items.map(i => ({...i, active: true}));
}

const _SENTIMENT_WORDS = {
    positive: ["resolved","fixed","completed","success","assisted","happy to","glad","great","thank","working","done","sorted","help","pleasure","kind","prompt","excellent","outstanding","apologise","appreciate","please"],
    negative: ["frustrated","escalated","unacceptable","still not","not working","issue persists","not resolved","delay","overdue","waiting","breach","unhappy","disappointed","urgent","critical","complaint","broken","fail","error","cannot","unable","ignored","unresolved"]
};

const State = {
    currentUser: null,
    currentView: 'dashboard',
    auditResults: [],
    uploadedFiles: [],
    ticketType: 'incident',
    isLoading: false,
    currentAudit: null,
    exportFormat: 'csv',
    config: {
        complianceThreshold: 75,
        sentiment: _SENTIMENT_WORDS,
        ctqItems: _generateCTQItems()
    }
};

// ============================================
// CTQ ENGINE — full 42-criterion scoring
// ============================================
const CTQEngine = {
    scoreTicket(ticketData) {
        const config = State.config;
        const activeItems = config.ctqItems.filter(c => c.active);
        const scores = {};
        const positiveReasons = [];
        const negativeReasons = [];

        const wn    = ticketData.work_notes || '';
        const ac    = ticketData.additional_comments || '';
        const desc  = ticketData.description || '';
        const rn    = ticketData.resolution_notes || '';
        const sd    = ticketData.short_description || '';
        const cat   = ticketData.category || '';
        const sub   = ticketData.subcategory || '';
        const ci    = ticketData.configuration_item || '';
        const pri   = ticketData.priority || '';
        const state = ticketData.state || '';
        const rc    = ticketData.resolution_code || '';
        const ku    = ticketData.knowledge_used || '';
        const ag    = ticketData.assigned_to || ticketData.agent || '';
        const group = ticketData.assignment_group || '';
        const caller= ticketData.caller || '';
        const reass = parseInt(ticketData.reassignment_count) || 0;
        const sc2   = parseInt(ticketData.strike_count) || 0;
        const ss    = ticketData.start_strike || '';
        const opened= ticketData.opened || '';
        const wc    = s => (s||'').trim().split(/\s+/).filter(Boolean).length;
        const clean = s => (s||'').toLowerCase();

        activeItems.forEach(item => {
            const score = CTQEngine._eval(item.id, {wn,ac,desc,rn,sd,cat,sub,ci,pri,state,rc,ku,ag,group,caller,reass,sc:sc2,ss,opened,wc,clean});
            scores[item.name] = score;
            if (score < 60) negativeReasons.push(`${item.name} (${score})`);
            else if (score > 90) positiveReasons.push(item.name);
        });

        let totalWeight = 0, weightedSum = 0;
        activeItems.forEach(item => {
            weightedSum += (scores[item.name] || 100) * item.weight;
            totalWeight += item.weight;
        });
        const overall = totalWeight > 0 ? Math.min(100, weightedSum / totalWeight) : 0;
        const sentiment = CTQEngine._sentiment(wn + ' ' + ac + ' ' + desc, config.sentiment);

        // Pillar scores
        const pillarMap = {};
        activeItems.forEach(item => {
            if (!pillarMap[item.pillar]) pillarMap[item.pillar] = {sum:0, count:0};
            pillarMap[item.pillar].sum   += scores[item.name] || 0;
            pillarMap[item.pillar].count += 1;
        });
        const pillar_scores = {};
        Object.entries(pillarMap).forEach(([p, v]) => { pillar_scores[p] = Math.round(v.sum / v.count); });

        return {
            ...ticketData,
            overall_score:    parseFloat(overall.toFixed(1)),
            grade:            CTQEngine._grade(overall),
            compliance_pass:  overall >= config.complianceThreshold,
            ctq_scores:       scores,
            pillar_scores,
            sentiment:        sentiment.type,
            sentiment_reason: sentiment.reason,
            positive_reasons: positiveReasons.slice(0, 6),
            negative_reasons: negativeReasons.slice(0, 6),
            risk_flags:       [],
            coaching_notes:   negativeReasons.length
                ? `Focus coaching on: ${negativeReasons.slice(0,3).map(i=>i.replace(/\s*\(\d+\)$/,'')).join(', ')}.`
                : 'Excellent performance — encourage peer mentoring.',
            engine_version:   '4.0.0'
        };
    },

    _grade(s) { return s>=85?'Excellent':s>=70?'Good':s>=50?'Fair':'Poor'; },

    _sentiment(text, wl) {
        const t = text.toLowerCase();
        let pos = 0, neg = 0;
        (wl.positive||[]).forEach(w => { if(t.includes(w)) pos++; });
        (wl.negative||[]).forEach(w => { if(t.includes(w)) neg++; });
        if (neg > pos + 1) return {type:'Negative', reason:'Negative language or frustration detected'};
        if (pos > neg + 1) return {type:'Positive', reason:'Positive resolution language detected'};
        return {type:'Neutral', reason:'Neutral or balanced communication'};
    },

    _eval(id, f) {
        const {wn,ac,desc,rn,sd,cat,sub,ci,pri,state,rc,ku,ag,group,caller,reass,sc,ss,opened,wc,clean} = f;
        switch(id) {
            case 1:  return (cat && cat.length > 2) ? 100 : 0;
            case 2:  return /self.?service|user guide|kb|knowledge base|faq|how.?to|portal/i.test(wn+ac+rn) ? 100 : (cat.toLowerCase().includes('self') ? 80 : 50);
            case 3:  { const l=wc(wn); if(!wn)return 0; if(l<10)return 30; if(l<30)return 65; if(l<80)return 85; return 100; }
            case 4:  return /screenshot|attachment|attached|image|snip|capture/i.test(wn+ac) ? 100 : 40;
            case 5:  return /per your request|as discussed|following up|further to|please find|as agreed|as requested/i.test(ac) ? 95 : (wc(ac)>20 ? 80 : 30);
            case 6:  { const st=clean(state); if(!state)return 0; if(/resolv|clos/.test(st)&&!rn)return 40; if(/resolv|clos/.test(st)&&rn)return 100; if(/hold/.test(st)&&!/(awaiting|waiting|pending|3rd party|vendor)/i.test(wn+ac))return 50; return 85; }
            case 7:  return ci ? 100 : 0;
            case 8:  return (group&&cat) ? 100 : (group||cat ? 70 : 20);
            case 9:  return (cat&&sub) ? 100 : (cat ? 60 : 0);
            case 10: { if(!ac)return 0; const g=/dear|hello|hi |good morning|good afternoon|thank you|thanks for/i; const s=/regards|sincerely|kind regards|best regards|IT support|service desk/i; if(g.test(ac)&&s.test(ac))return 100; if(g.test(ac)||s.test(ac))return 70; return 40; }
            case 11: { if(!ac)return 0; const l=wc(ac); if(l<10)return 30; if(l<30)return 65; return 100; }
            case 12: { if(!ac)return 50; const g=/dear|hello|hi |good morning|good afternoon/i; const s=/regards|sincerely|kind regards|best regards/i; if(g.test(ac)&&s.test(ac))return 100; if(g.test(ac)||s.test(ac))return 70; return 20; }
            case 13: { if(!ac)return 70; if(/\blol\b|\bwtf\b|\bomg\b|\bbrb\b/i.test(ac))return 20; if(/\bu r\b|cant |wont |didnt |gonna|wanna|\bpls\b|\bplz\b/i.test(ac))return 40; return 95; }
            case 14: return /jira|confluence|slack|admin password|root password|server ip/i.test(ac) ? 0 : 100;
            case 15: { const filled=[cat,sub,ci,pri,state,ag,group,rc].filter(x=>x&&x.toString().trim()).length; return Math.round((filled/8)*100); }
            case 16: return (caller&&ag) ? 100 : (caller||ag ? 60 : 0);
            case 17: { if(!sd)return 0; const l=wc(sd); if(l<3)return 20; if(l<6)return 60; if(l>20)return 70; return 100; }
            case 18: return pri ? 100 : 0;
            case 19: { const t=wc(desc)+wc(wn); if(!desc&&!wn)return 0; if(t<20)return 30; if(t<60)return 65; return 100; }
            case 20: return (ag&&group) ? 100 : (ag ? 70 : (group ? 60 : 0));
            case 21: return 90;
            case 22: { if(reass===0)return 100; if(reass<=1)return 80; if(reass<=3)return 50; return 10; }
            case 23: return /contacted|called|emailed|reached out|sent update|follow.?up|update sent/i.test(wn+ac) ? 100 : (ac ? 70 : 30);
            case 24: return /previous|history|prior|earlier|similar|recurrence|same issue|seen before|duplicate/i.test(wn+desc) ? 100 : 40;
            case 25: return /what happened|when did|how long|error message|steps to reproduce|can you describe|impact|affected users/i.test(wn+desc+ac) ? 100 : (wc(desc)>30 ? 70 : 30);
            case 26: return /is your computer on|have you tried turning|what colour|what model year/i.test(wn+ac) ? 40 : 90;
            case 27: { const kl=clean(ku); if(/true|yes|1/.test(kl)||/kb\d+|knowledge base|knowledge article|per kb/i.test(wn+rn))return 100; if(/false|no|0/.test(kl))return 10; return 40; }
            case 28: { const m=(wn+rn).match(/restart|reboot|reset|reinstall|update|patch|clear cache|log off|reconfigure|tested|verified|confirmed/gi)||[]; if(m.length>=3)return 100; if(m.length>=1)return 70; if(wc(wn)>20)return 55; return 20; }
            case 29: return (/on hold/i.test(state)&&!/(awaiting|waiting for|on hold for)/i.test(wn+ac)) ? 30 : 90;
            case 30: { if(!opened)return 80; const d=new Date(opened); if(isNaN(d))return 80; const h=d.getHours(),day=d.getDay(); return (day===0||day===6||h<8||h>18) ? 50 : 80; }
            case 31: return /please note|for future|you can|next time|recommend|suggest|prevent|avoid|guide|how to|self.?service|portal/i.test(ac+rn) ? 100 : 40;
            case 32: return /will be|should be|expected|by end of|within \d|target|timeline|sla|xla|update you|keep you|let you know|notify/i.test(ac+wn) ? 100 : 35;
            case 33: return /incorrect kb|wrong kb|wrong article|kb not applicable/i.test(wn) ? 10 : 95;
            case 34: { const k=/kb\d+|attached kb|kb article attached|knowledge attached/i; return (k.test(wn+rn)||/true|yes/.test(clean(ku))) ? 100 : 20; }
            case 35: { if(sc>0||/true|yes/.test(clean(ss)))return 100; const old=opened&&((new Date()-new Date(opened))/(1000*60*60*24))>5; return old ? 50 : 85; }
            case 36: return /incorrect strike|wrong strike|strike error|premature strike/i.test(wn) ? 10 : 95;
            case 37: { if(/vip|executive|director|ceo|cto|cio|board|priority user/i.test(caller+desc+wn)) return /manual strike|vip process|approved strike/i.test(wn) ? 100 : 40; return 90; }
            case 38: { if(!/hold/i.test(state))return 90; return /awaiting user|awaiting vendor|third party|3rd party|awaiting approval|awaiting parts|pending user/i.test(wn+ac) ? 100 : 20; }
            case 39: return /sme|subject matter|specialist|escalated to|l2|l3|level 2|level 3|senior|lead/i.test(wn+ac) ? 100 : (reass>1 ? 60 : 70);
            case 40: return /wrong form|incorrect type|should be sr|should be incident|reclassified|converted to/i.test(wn) ? 20 : 90;
            case 41: { const t=wc(rn)+wc(wn); if(!rn&&/resolv|clos/i.test(state))return 0; if(rc&&t>20)return 100; if(rc)return 70; return 40; }
            case 42: return /approved by|lead approved|sme approved|signed off|reviewed by|authorised by|stamp/i.test(wn) ? 100 : 60;
            default: return 100;
        }
    },
    
    parseCSV(text) {
        const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
        const nonEmpty = lines.filter(l => l.trim());
        if (!nonEmpty.length) return {headers: [], rows: []};
        
        const parseLine = (line) => {
            const fields = [];
            let cur = '', inQ = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQ && line[i+1] === '"') { cur += '"'; i++; }
                    else { inQ = !inQ; }
                } else if (ch === ',' && !inQ) {
                    fields.push(cur); cur = '';
                } else { cur += ch; }
            }
            fields.push(cur);
            return fields.map(f => f.trim().replace(/^"|"$/g, ''));
        };
        
        const headers = parseLine(nonEmpty[0]);
        const rows = nonEmpty.slice(1).map(line => {
            const values = parseLine(line);
            const obj = {};
            headers.forEach((h, i) => obj[h] = values[i] || '');
            return obj;
        }).filter(r => Object.values(r).some(v => v && v.trim()));
        
        return {headers, rows};
    },
    
    normalizeRow(row, index) {
        const get = (keys) => {
            for (const key of keys) {
                const val = row[key] || row[key.toLowerCase()] || row[key.replace(/ /g, '_').toLowerCase()];
                if (val !== undefined) return String(val).trim();
            }
            return '';
        };
        
        return {
            ticket_id: get(['Number', 'number', 'Ticket']) || `ROW-${index+1}`,
            agent: get(['Assigned to', 'assigned_to']),
            ticket_type: 'incident',
            short_description: get(['Short description', 'short_description']),
            description: get(['Description', 'description']),
            work_notes: get(['Work notes', 'work_notes']),
            additional_comments: get(['Additional comments', 'additional_comments']),
            resolution_notes: get(['Resolution notes', 'resolution_notes']),
            assigned_to: get(['Assigned to', 'assigned_to']),
            opened: get(['Opened', 'opened']),
            closed: get(['Closed', 'closed']),
            resolved: get(['Resolved', 'resolved']),
            state: get(['State', 'state']),
            priority: get(['Priority', 'priority']),
            category: get(['Category', 'category']),
            subcategory: get(['Subcategory', 'subcategory']),
            configuration_item: get(['Configuration item', 'configuration_item']),
            caller: get(['Caller', 'caller']),
            strike_count: get(['Strike Count', 'strike_count']),
            reassignment_count: get(['Reassignment count', 'reassignment_count']),
            resolution_code: get(['Resolution code', 'resolution_code']),
            knowledge_used: get(['Knowledge used', 'knowledge_used']),
            sla_breached: false,
            content: [get(['Short description']), get(['Description']), get(['Work notes']), get(['Additional comments'])].filter(Boolean).join('\n\n')
        };
    }
};

// ============================================
// DOM & EVENT BINDING
// ============================================
const DOM = {
    authOverlay: document.getElementById('auth-overlay'),
    appContainer: document.getElementById('app-container'),
    viewContainer: document.getElementById('view-container'),
    loadingOverlay: document.getElementById('loading-overlay'),
    ticketCount: document.getElementById('ticket-count'),
    exportModal: document.getElementById('export-modal')
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Ready');
    initTheme();
    const session = sessionStorage.getItem('ctq_session');
    if (session) showApplication(JSON.parse(session));
    else showLoginScreen();
    
    bindEvents();
});

// ============================================
// THEME MANAGEMENT
// ============================================
function initTheme() {
    const savedTheme = localStorage.getItem('yk_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButtonIcon();
}

function updateThemeButtonIcon() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.textContent = current === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('yk_theme', next);
    updateThemeButtonIcon();
    showToast(`Switched to ${next === 'dark' ? '🌙 Dark' : '☀️ Light'} mode`, 'info', 2000);
}

function bindEvents() {
    // Theme toggle
    document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);
    
    // Login
    document.getElementById('auth-login-btn')?.addEventListener('click', handleLogin);
    document.getElementById('auth-password')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleLogin();
    });
    
    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        sessionStorage.removeItem('ctq_session');
        location.reload();
    });
    
    // Navigation
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            const view = e.currentTarget.dataset.view;
            switchView(view);
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });
    
    // Export trigger
    document.getElementById('export-trigger')?.addEventListener('click', openExportModal);
}

// ============================================
// AUTHENTICATION
// ============================================
async function handleLogin() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;
    
    if (!username || !password) {
        showAuthError('Please enter credentials');
        return;
    }
    
    setLoading(true);
    // Call server-side authentication. If server unavailable and developer mode
    // is enabled locally (`yk_dev_mode` in localStorage), allow local fallback.
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        const payload = await res.json();
        if (res.ok && payload.success) {
            const user = payload.user;
            sessionStorage.setItem('ctq_session', JSON.stringify(user));
            showApplication(user);
        } else {
            // Server rejected credentials — allow developer local fallback if configured
            const devMode = localStorage.getItem('yk_dev_mode') === 'true';
            const devPassword = localStorage.getItem('yk_dev_admin_password') || '';
            if (devMode && username === 'admin' && password === devPassword) {
                const user = {username: 'admin', displayName: 'System Administrator (local dev)', role: 'admin'};
                sessionStorage.setItem('ctq_session', JSON.stringify(user));
                showApplication(user);
            } else {
                showAuthError(payload.error || 'Invalid credentials');
            }
        }
    } catch (e) {
        // Network/server error — optionally allow local dev fallback
        const devMode = localStorage.getItem('yk_dev_mode') === 'true';
        const devPassword = localStorage.getItem('yk_dev_admin_password') || '';
        if (devMode && username === 'admin' && password === devPassword) {
            const user = {username: 'admin', displayName: 'System Administrator (local dev)', role: 'admin'};
            sessionStorage.setItem('ctq_session', JSON.stringify(user));
            showApplication(user);
        } else {
            showAuthError('Authentication service unavailable');
        }
    }
    setLoading(false);
}

function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 5000);
}

// ============================================
// VIEW MANAGEMENT
// ============================================
function showLoginScreen() {
    DOM.authOverlay.style.display = 'flex';
    DOM.appContainer.style.display = 'none';
}

function showApplication(user) {
    State.currentUser = user;
    DOM.authOverlay.style.display = 'none';
    DOM.appContainer.style.display = 'block';
    
    document.getElementById('user-name').textContent = user.displayName;
    document.getElementById('user-role').textContent = user.role.toUpperCase();
    document.getElementById('user-avatar').textContent = user.displayName.charAt(0);
    
    if (user.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');
    }
    
    switchView('dashboard');
    updateStats();
}

function switchView(viewName) {
    State.currentView = viewName;
    DOM.viewContainer.innerHTML = getViewContent(viewName);

    // Post-render init — v3 views
    if (viewName === 'dashboard')    { initDashboard(); drawDashboardCharts(); }
    if (viewName === 'audit')          initAudit();
    if (viewName === 'results')        initResults();
    if (viewName === 'trends')       { initTrends(); initV4Trends(); }
    if (viewName === 'pillars')        drawPillarCharts();
    if (viewName === 'admin')          initAdmin();
    if (viewName === 'logs')           initLogs();
    if (viewName === 'coaching')       initCoaching();

    // v4.0 new views
    if (viewName === 'agents')         initV4Agents();
    if (viewName === 'note-patterns')  initV4NotePatterns();
    if (viewName === 'automation')     initV4Automation();
    if (viewName === 'repeat-callers') initV4RepeatCallers();
    if (viewName === 'kb-health')      initV4KBHealth();
}

// ============================================
// VIEW CONTENT GENERATORS
// ============================================
function getViewContent(view) {
    const views = {
        dashboard: `
            <div class="view-header">
                <h2>Quality Intelligence Dashboard</h2>
                <p class="subtitle">Real-time overview — all processing local</p>
            </div>
            <div class="stats-grid">
                <div class="stat-card blue"><div class="stat-label">TOTAL AUDITED</div><div class="stat-value" id="stat-total">0</div></div>
                <div class="stat-card green"><div class="stat-label">AVG CTQ SCORE</div><div class="stat-value" id="stat-avg">—</div></div>
                <div class="stat-card amber"><div class="stat-label">COMPLIANCE RATE</div><div class="stat-value" id="stat-comp">—</div></div>
                <div class="stat-card purple"><div class="stat-label">SLA AT RISK</div><div class="stat-value" id="stat-sla">—</div></div>
            </div>
            <div class="content-grid" style="grid-template-columns:1fr 1fr; gap:20px; margin-bottom:20px;">
                <div class="card"><div class="card-title">Score Distribution</div><canvas id="chart-dist" height="200"></canvas></div>
                <div class="card"><div class="card-title">Sentiment Breakdown</div><canvas id="chart-sent" height="200"></canvas></div>
            </div>
            <div class="card"><div class="card-title">Recent Audits</div><div id="recent-audits"><p class="empty-state">No audits yet</p></div></div>
        `,
        
        audit: `
            <div class="view-header"><h2>New Audit</h2><p class="subtitle">Score tickets using 42-point CTQ engine</p></div>
            
            <div class="card mb24">
                <div class="card-title">Ticket Type</div>
                <div class="tt-grid" style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:18px;">
                    <div class="tt-card sel" onclick="setTicketType('incident',this)" style="border:1.5px solid var(--accent); background:rgba(0,212,255,0.05); padding:12px; text-align:center; cursor:pointer; border-radius:8px;">
                        <div style="font-size:20px; margin-bottom:5px;">🔴</div><div style="font-size:11px; font-weight:600;">Incident</div>
                    </div>
                    <div class="tt-card" onclick="setTicketType('service_request',this)" style="border:1.5px solid var(--border); padding:12px; text-align:center; cursor:pointer; border-radius:8px;">
                        <div style="font-size:20px; margin-bottom:5px;">🟡</div><div style="font-size:11px; font-weight:600;">Service Request</div>
                    </div>
                    <div class="tt-card" onclick="setTicketType('chat',this)" style="border:1.5px solid var(--border); padding:12px; text-align:center; cursor:pointer; border-radius:8px;">
                        <div style="font-size:20px; margin-bottom:5px;">💬</div><div style="font-size:11px; font-weight:600;">Chat</div>
                    </div>
                    <div class="tt-card" onclick="setTicketType('call',this)" style="border:1.5px solid var(--border); padding:12px; text-align:center; cursor:pointer; border-radius:8px;">
                        <div style="font-size:20px; margin-bottom:5px;">📞</div><div style="font-size:11px; font-weight:600;">Call</div>
                    </div>
                </div>
                
                <div class="card-title">Input Method</div>
                <div class="tab-bar" style="display:flex; border-bottom:1px solid var(--border); margin-bottom:16px;">
                    <div class="tab active" onclick="switchAuditTab('upload',this)" style="padding:8px 16px; cursor:pointer; color:var(--accent); border-bottom:2px solid var(--accent); font-family:var(--mono); font-size:10px;">File Upload</div>
                    <div class="tab" onclick="switchAuditTab('manual',this)" style="padding:8px 16px; cursor:pointer; color:var(--text2); border-bottom:2px solid transparent; font-family:var(--mono); font-size:10px;">Manual Entry</div>
                </div>
                
                <div id="tab-upload" class="tab-content" style="display:block;">
                    <div class="upload-zone" id="upload-zone" style="border:2px dashed var(--border2); border-radius:10px; padding:40px; text-align:center; cursor:pointer; transition:all 0.2s;" 
                         ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event)" onclick="document.getElementById('file-input').click()">
                        <input type="file" id="file-input" accept=".csv,.xlsx,.xls" multiple style="display:none;" onchange="handleFileSelect(event)">
                        <div style="font-size:32px; margin-bottom:10px;">⬆</div>
                        <div style="font-weight:600; margin-bottom:4px;">Drop CSV/XLSX files here or click to browse</div>
                        <div style="color:var(--text2); font-size:11px;">ServiceNow export format supported</div>
                    </div>
                    <div id="file-list" style="margin-top:10px;"></div>
                    <div id="upload-progress" style="display:none; margin-top:15px;">
                        <div style="background:var(--border); height:4px; border-radius:2px; overflow:hidden;">
                            <div id="progress-bar" style="width:0%; height:100%; background:var(--accent); transition:width 0.3s;"></div>
                        </div>
                        <div id="progress-text" style="font-family:var(--mono); font-size:10px; color:var(--text2); margin-top:5px;">Processing...</div>
                    </div>
                </div>
                
                <div id="tab-manual" class="tab-content" style="display:none;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                        <div class="input-group"><label>Number</label><input type="text" id="m-number" class="inp" placeholder="INC0012345"></div>
                        <div class="input-group"><label>Assigned To</label><input type="text" id="m-agent" class="inp" placeholder="Agent Name"></div>
                        <div class="input-group"><label>Priority</label><select id="m-priority" class="inp"><option>1-Critical</option><option>2-High</option><option selected>3-Moderate</option><option>4-Low</option></select></div>
                        <div class="input-group"><label>Category</label><input type="text" id="m-category" class="inp" placeholder="Hardware"></div>
                    </div>
                    <div class="input-group" style="margin-bottom:15px;">
                        <label>Work Notes / Description</label>
                        <textarea id="m-content" rows="6" class="inp" placeholder="Enter ticket content for analysis..."></textarea>
                    </div>
                    <button class="btn btn-primary" onclick="runManualAudit()">Run CTQ Analysis</button>
                </div>
            </div>
            
            <div id="bulk-results" style="display:none;">
                <div class="card">
                    <div class="flex-between" style="margin-bottom:15px;">
                        <h3>Bulk Analysis Results</h3>
                        <button class="btn btn-primary" onclick="saveBulkResults()">Save All Results</button>
                    </div>
                    <div id="bulk-table-container" style="max-height:400px; overflow-y:auto;"></div>
                </div>
            </div>
        `,
        
        results: `
            <div class="view-header flex-between">
                <div><h2>Audit Results</h2><p class="subtitle">Complete audit history</p></div>
                <div class="flex gap8">
                    <button class="btn btn-danger" onclick="clearAllResults()">Clear All</button>
                    <button class="btn btn-primary" onclick="openExportModal()">Export Report</button>
                </div>
            </div>
            <div class="card" id="results-container">
                <p class="empty-state">No results found. Run an audit to see data here.</p>
            </div>
        `,
        
        trends: `
            <div class="view-header"><h2>Trends & Patterns</h2><p class="subtitle">Performance analytics</p></div>
            <div class="content-grid" style="grid-template-columns:2fr 1fr; gap:20px; margin-bottom:20px;">
                <div class="card"><div class="card-title">Score Trend Over Time</div><canvas id="chart-trend" height="250"></canvas></div>
                <div class="card"><div class="card-title">Top Failure Points</div><canvas id="chart-fail" height="250"></canvas></div>
            </div>
            <div class="card"><div class="card-title">Agent Performance Comparison</div><div id="agent-comparison">Insufficient data</div></div>
        `,
        
        pillars: `
            <div class="view-header"><h2>Quality Pillars</h2><p class="subtitle">8 strategic dimensions</p></div>
            <div class="card" style="margin-bottom:20px;"><canvas id="chart-radar" height="300"></canvas></div>
            <div class="pillar-grid" id="pillar-details" style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px;"></div>
        `,
        
        admin: `
            <div class="view-header"><h2>Admin Panel</h2><p class="subtitle">System configuration — admin only</p></div>

            <div class="card mb16">
                <div class="card-title">Organisation Settings</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                    <div class="input-group"><label>Organisation Name</label><input type="text" id="cfg-org" class="inp" placeholder="Enterprise IT Services"></div>
                    <div class="input-group"><label>Compliance Threshold (%)</label><input type="number" id="cfg-thresh" min="50" max="95" class="inp" placeholder="75"></div>
                </div>
                <button class="btn btn-primary" onclick="saveConfig()">Save Settings</button>
            </div>

            <div class="card mb16">
                <div class="card-hdr">
                    <span class="card-title">CTQ Scoring Criteria — 42 Items</span>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-ghost btn-sm" onclick="adminToggleAll(true)">Enable All</button>
                        <button class="btn btn-ghost btn-sm" onclick="adminToggleAll(false)">Disable All</button>
                        <button class="btn btn-primary btn-sm" onclick="adminSaveCTQ()">Save CTQ Config</button>
                    </div>
                </div>
                <div style="overflow-x:auto;">
                <table class="data-table" style="width:100%; font-size:11px;">
                    <thead><tr>
                        <th style="width:40px;">Active</th>
                        <th style="width:36px;">ID</th>
                        <th>Criterion Name</th>
                        <th>Pillar</th>
                        <th style="width:80px;">Weight</th>
                    </tr></thead>
                    <tbody id="ctq-admin-rows"></tbody>
                </table>
                </div>
            </div>

            <div class="card">
                <div class="card-title">Sentiment Keywords</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
                    <div class="input-group">
                        <label>Positive Words (comma-separated)</label>
                        <textarea id="cfg-pos-words" class="inp" rows="4" style="font-family:var(--mono);font-size:11px;"></textarea>
                    </div>
                    <div class="input-group">
                        <label>Negative Words (comma-separated)</label>
                        <textarea id="cfg-neg-words" class="inp" rows="4" style="font-family:var(--mono);font-size:11px;"></textarea>
                    </div>
                </div>
                <button class="btn btn-primary" style="margin-top:12px;" onclick="adminSaveSentiment()">Save Sentiment Config</button>
            </div>
        `,

        logs: `
            <div class="view-header">
                <h2>Execution Logs</h2>
                <p class="subtitle">Live server log — last 200 lines from Logs/ctq.log</p>
            </div>
            <div class="card">
                <div class="card-hdr" style="margin-bottom:12px;">
                    <span class="card-title">Server Log</span>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <select id="log-level-filter" class="inp-sm" onchange="initLogs()">
                            <option value="ALL">All levels</option>
                            <option value="DEBUG">DEBUG+</option>
                            <option value="INFO">INFO+</option>
                            <option value="WARNING">WARNING+</option>
                            <option value="ERROR">ERROR only</option>
                        </select>
                        <button class="btn btn-ghost btn-sm" onclick="initLogs()">↻ Refresh</button>
                    </div>
                </div>
                <div id="log-output" style="font-family:var(--mono);font-size:11px;line-height:1.7;max-height:600px;overflow-y:auto;background:var(--surface2);border-radius:6px;padding:12px;">
                    <div style="color:var(--text3);">Loading logs…</div>
                </div>
            </div>
        `
    };
    // views with dedicated generators
    if (view === 'coaching')       return getCoachingViewContent();
    if (view === 'agents')         return getAgentsViewContent();
    if (view === 'note-patterns')  return getNotePatternViewContent();
    if (view === 'automation')     return getAutomationViewContent();
    if (view === 'repeat-callers') return getRepeatCallersViewContent();
    if (view === 'kb-health')      return getKBHealthViewContent();

    // v4.0 — augment Trends with interactive Plotly chart beneath existing content
    if (view === 'trends') {
        const base = views['trends'] || views.dashboard;
        return base + `
        <div class="card mt16">
            <div class="card-title">Interactive History (v4.0) — Powered by Plotly</div>
            <div id="v4-trend-chart" style="min-height:420px;"></div>
        </div>`;
    }

    return views[view] || views.dashboard;
}

// ============================================
// FILE UPLOAD & BULK PROCESSING
// ============================================
function switchAuditTab(tab, el) {
    document.querySelectorAll('.tab').forEach(t => { t.classList.remove('active'); t.style.color='var(--text2)'; t.style.borderBottomColor='transparent'; });
    el.classList.add('active');
    el.style.color='var(--accent)';
    el.style.borderBottomColor='var(--accent)';
    
    document.querySelectorAll('.tab-content').forEach(c => c.style.display='none');
    document.getElementById('tab-'+tab).style.display='block';
}

function setTicketType(type, el) {
    State.ticketType = type;
    document.querySelectorAll('.tt-card').forEach(c => { c.style.borderColor='var(--border)'; c.style.background='transparent'; });
    el.style.borderColor='var(--accent)';
    el.style.background='rgba(0,212,255,0.05)';
}

function handleDragOver(e) { e.preventDefault(); e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.background='rgba(0,212,255,0.04)'; }
function handleDragLeave(e) { e.currentTarget.style.borderColor='var(--border2)'; e.currentTarget.style.background='transparent'; }

function handleFileSelect(e) { processFiles(Array.from(e.target.files)); }
function handleDrop(e) { e.preventDefault(); e.currentTarget.style.borderColor='var(--border2)'; processFiles(Array.from(e.dataTransfer.files)); }

function processFiles(files) {
    const validFiles = files.filter(f => /\.(csv|xlsx?)$/i.test(f.name));
    if (!validFiles.length) { showToast('Please upload CSV or Excel files', 'error'); return; }
    
    State.uploadedFiles = validFiles;
    const list = document.getElementById('file-list');
    list.innerHTML = validFiles.map(f => `
        <div style="display:flex; align-items:center; gap:8px; padding:8px 12px; background:var(--surface2); border:1px solid var(--border); border-radius:6px; margin-bottom:6px;">
            <span style="color:var(--accent);">📄</span>
            <span style="flex:1; font-family:var(--mono); font-size:11px;">${f.name}</span>
            <span style="color:var(--text3); font-size:10px;">${(f.size/1024).toFixed(1)} KB</span>
        </div>
    `).join('');
    
    // Auto-start processing
    processBulkUpload();
}

async function processBulkUpload() {
    const progress = document.getElementById('upload-progress');
    const bar = document.getElementById('progress-bar');
    const text = document.getElementById('progress-text');
    
    progress.style.display = 'block';
    const allResults = [];
    
    for (let i = 0; i < State.uploadedFiles.length; i++) {
        const file = State.uploadedFiles[i];
        text.textContent = `Processing ${file.name} (${i+1}/${State.uploadedFiles.length})...`;
        
        try {
            const text = await readFile(file);
            const {rows} = CTQEngine.parseCSV(text);
            
            for (let j = 0; j < rows.length; j++) {
                const row = CTQEngine.normalizeRow(rows[j], j);
                const score = CTQEngine.scoreTicket(row);
                allResults.push({...row, ...score, audited_at: new Date().toISOString()});
                
                // Update progress
                const pct = ((i * rows.length + j + 1) / (State.uploadedFiles.length * rows.length)) * 100;
                bar.style.width = pct + '%';
            }
        } catch (err) {
            console.error('File error:', err);
            showToast(`Error processing ${file.name}`, 'error');
        }
    }
    
    State.currentAudit = allResults;

    // Auto-save to main results so Dashboard/Audit Results/charts update immediately
    State.auditResults.push(...allResults);
    updateStats();

    displayBulkResults(allResults);
    progress.style.display = 'none';
    showToast(`Processed ${allResults.length} tickets — view Dashboard for analysis`, 'success');

    // Persist to backend so Analytics (Trends, Agent Leaderboard) have data
    _persistBatchToBackend(allResults);
}

async function _persistBatchToBackend(results) {
    try {
        // Build raw ticket payload — backend re-scores with Python engine for DB storage
        const tickets = results.map(r => ({
            number:              r.ticket_id || r.number || '',
            short_description:   r.short_description || '',
            description:         r.description || '',
            work_notes:          r.work_notes || '',
            additional_comments: r.additional_comments || '',
            resolution_notes:    r.resolution_notes || '',
            category:            r.category || '',
            subcategory:         r.subcategory || '',
            priority:            r.priority || '',
            state:               r.state || '',
            assigned_to:         r.assigned_to || r.agent || '',
            assignment_group:    r.assignment_group || '',
            caller:              r.caller || '',
            resolution_code:     r.resolution_code || '',
            knowledge_used:      r.knowledge_used || '',
            configuration_item:  r.configuration_item || '',
            reassignment_count:  r.reassignment_count || 0,
            strike_count:        r.strike_count || 0,
            opened:              r.opened || '',
            closed:              r.closed || ''
        }));

        const resp = await fetch('/api/audit/batch', {
            method:  'POST',
            headers: {'Content-Type': 'application/json'},
            body:    JSON.stringify({
                tickets,
                ticket_type:          State.ticketType || 'incident',
                username:             State.currentUser?.username || 'offline',
                compliance_threshold: State.config.complianceThreshold
            })
        });

        if (resp.ok) {
            const data = await resp.json();
            console.log(`[CTQ] Backend persisted ${data.count || tickets.length} tickets (batch ${data.batch_id})`);
        } else {
            console.warn('[CTQ] Backend persist failed — Analytics will show data after next server run');
        }
    } catch (e) {
        // Non-fatal — offline mode still works, analytics just won't have this batch
        console.warn('[CTQ] Backend offline — results saved locally only:', e.message);
    }
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const isExcel = /\.xlsx?$/i.test(file.name);

        if (isExcel) {
            // Excel: read as ArrayBuffer → SheetJS → CSV string
            if (typeof XLSX === 'undefined') {
                reject(new Error('SheetJS library not loaded. Please check your internet connection and try a hard refresh (Ctrl+Shift+R).'));
                return;
            }
            reader.onload = e => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    // Convert to CSV so the existing parseCSV pipeline works unchanged
                    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false, rawNumbers: false });
                    resolve(csv);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        } else {
            // CSV: read as plain text
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        }
    });
}

function displayBulkResults(results) {
    document.getElementById('bulk-results').style.display = 'block';
    const container = document.getElementById('bulk-table-container');
    
    const rows = results.map((r, i) => `
        <tr>
            <td style="font-family:var(--mono); font-size:11px; color:var(--accent);">${r.ticket_id}</td>
            <td>${r.agent || '—'}</td>
            <td>${r.priority || '—'}</td>
            <td style="font-weight:600; color:${r.overall_score>=75?'var(--green)':r.overall_score>=50?'var(--amber)':'var(--red)'};">${r.overall_score}</td>
            <td><span class="badge ${r.grade.toLowerCase().replace(' ','-')}">${r.grade}</span></td>
            <td>${r.sentiment}</td>
            <td>${r.compliance_pass?'✓':'✗'}</td>
        </tr>
    `).join('');
    
    container.innerHTML = `
        <table class="data-table" style="width:100%; border-collapse:collapse;">
            <thead style="background:var(--surface2); position:sticky; top:0;">
                <tr>
                    <th>Ticket ID</th><th>Agent</th><th>Priority</th><th>Score</th><th>Grade</th><th>Sentiment</th><th>Pass</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function saveBulkResults() {
    if (!State.currentAudit || !State.currentAudit.length) return;
    // Results already auto-saved on processing — just clear the staging area and go to dashboard
    showToast(`${State.currentAudit.length} results saved — opening Dashboard`, 'success');
    State.currentAudit = [];
    document.getElementById('bulk-results').style.display = 'none';
    document.getElementById('file-list').innerHTML = '';
    State.uploadedFiles = [];
    // Navigate to dashboard so user sees the populated charts
    setTimeout(() => switchView('dashboard'), 400);
}

function runManualAudit() {
    const content = document.getElementById('m-content').value.trim();
    if (!content) { showToast('Please enter content', 'error'); return; }
    
    const ticket = {
        ticket_id: document.getElementById('m-number').value || 'MANUAL-'+Date.now(),
        agent: document.getElementById('m-agent').value,
        priority: document.getElementById('m-priority').value,
        category: document.getElementById('m-category').value,
        content: content,
        work_notes: content,
        ticket_type: State.ticketType
    };
    
    const result = CTQEngine.scoreTicket(ticket);
    State.auditResults.push({...ticket, ...result, audited_at: new Date().toISOString()});
    updateStats();
    showToast('Audit completed and saved', 'success');
    document.getElementById('m-content').value = '';
}

// ============================================
// CHARTS & VISUALIZATION
// ============================================
function drawDashboardCharts() {
    if (!State.auditResults.length) return;
    
    // Score Distribution
    const distCanvas = document.getElementById('chart-dist');
    if (distCanvas) {
        const ctx = distCanvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = distCanvas.parentElement.getBoundingClientRect();
        distCanvas.width = rect.width * dpr;
        distCanvas.height = 200 * dpr;
        ctx.scale(dpr, dpr);
        
        const scores = State.auditResults.map(r => r.overall_score);
        const bins = [0,0,0,0,0]; // <50, 50-65, 65-75, 75-85, 85+
        scores.forEach(s => {
            if (s<50) bins[0]++;
            else if (s<65) bins[1]++;
            else if (s<75) bins[2]++;
            else if (s<85) bins[3]++;
            else bins[4]++;
        });
        
        const max = Math.max(...bins, 1);
        const colors = ['#ff4444', '#ffb300', '#ffb300', '#00d4ff', '#00e676'];
        const labels = ['<50','50-65','65-75','75-85','85+'];
        const barWidth = (rect.width / 5) - 20;
        
        ctx.clearRect(0,0,rect.width,200);
        bins.forEach((count, i) => {
            const h = (count/max) * 150;
            const x = 10 + i * (rect.width/5);
            const y = 180 - h;
            
            // Bar
            ctx.fillStyle = colors[i];
            ctx.fillRect(x, y, barWidth, h);
            
            // Label
            ctx.fillStyle = 'var(--text2)';
            ctx.font = '10px Consolas';
            ctx.textAlign = 'center';
            ctx.fillText(labels[i], x + barWidth/2, 195);
            
            // Value
            if (count > 0) {
                ctx.fillStyle = 'var(--text)';
                ctx.fillText(count, x + barWidth/2, y - 5);
            }
        });
    }
    
    // Sentiment Pie
    const sentCanvas = document.getElementById('chart-sent');
    if (sentCanvas) {
        const ctx = sentCanvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = sentCanvas.parentElement.getBoundingClientRect();
        sentCanvas.width = rect.width * dpr;
        sentCanvas.height = 200 * dpr;
        ctx.scale(dpr, dpr);
        
        const pos = State.auditResults.filter(r => r.sentiment === 'Positive').length;
        const neg = State.auditResults.filter(r => r.sentiment === 'Negative').length;
        const neu = State.auditResults.length - pos - neg;
        
        const total = State.auditResults.length || 1;
        const cx = rect.width / 2, cy = 100, r = 70;
        
        // Clear and draw pie
        ctx.clearRect(0,0,rect.width,200);
        
        let angle = -Math.PI/2;
        const data = [
            {val: pos, color: '#00e676', label: 'Positive'},
            {val: neg, color: '#ff4444', label: 'Negative'},
            {val: neu, color: '#8a9ab5', label: 'Neutral'}
        ];
        
        data.forEach(slice => {
            if (slice.val === 0) return;
            const sliceAngle = (slice.val / total) * Math.PI * 2;
            
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, angle, angle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = slice.color;
            ctx.fill();
            
            // Label
            const midAngle = angle + sliceAngle/2;
            const lx = cx + Math.cos(midAngle) * (r + 20);
            const ly = cy + Math.sin(midAngle) * (r + 20);
            ctx.fillStyle = slice.color;
            ctx.font = 'bold 11px Consolas';
            ctx.textAlign = 'center';
            ctx.fillText(`${slice.label} ${Math.round(slice.val/total*100)}%`, lx, ly);
            
            angle += sliceAngle;
        });
        
        // Center hole
        ctx.beginPath();
        ctx.arc(cx, cy, 40, 0, Math.PI*2);
        ctx.fillStyle = 'var(--surface)';
        ctx.fill();
        
        // Center text
        ctx.fillStyle = 'var(--text)';
        ctx.font = 'bold 14px Consolas';
        ctx.textAlign = 'center';
        ctx.fillText(total, cx, cy + 5);
        ctx.font = '9px Consolas';
        ctx.fillStyle = 'var(--text2)';
        ctx.fillText('TOTAL', cx, cy + 20);
    }
}

function drawTrendCharts() {
    if (State.auditResults.length < 2) return;
    
    // Trend Line
    const trendCanvas = document.getElementById('chart-trend');
    if (trendCanvas) {
        const ctx = trendCanvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = trendCanvas.parentElement.getBoundingClientRect();
        trendCanvas.width = rect.width * dpr;
        trendCanvas.height = 250 * dpr;
        ctx.scale(dpr, dpr);
        
        const sorted = [...State.auditResults].sort((a,b) => new Date(a.audited_at) - new Date(b.audited_at));
        const data = sorted.slice(-20); // Last 20
        
        ctx.clearRect(0,0,rect.width,250);
        
        // Draw grid
        ctx.strokeStyle = 'var(--border)';
        ctx.lineWidth = 1;
        for (let i=0; i<=4; i++) {
            const y = 30 + (200 * i / 4);
            ctx.beginPath();
            ctx.moveTo(40, y);
            ctx.lineTo(rect.width-20, y);
            ctx.stroke();
            
            ctx.fillStyle = 'var(--text3)';
            ctx.font = '9px Consolas';
            ctx.textAlign = 'right';
            ctx.fillText(100 - i*25, 35, y + 3);
        }
        
        // Draw line
        ctx.beginPath();
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 2;
        
        data.forEach((r, i) => {
            const x = 40 + (i / (data.length-1)) * (rect.width - 60);
            const y = 230 - (r.overall_score / 100) * 200;
            if (i===0) ctx.moveTo(x,y);
            else ctx.lineTo(x,y);
        });
        ctx.stroke();
        
        // Points
        data.forEach((r, i) => {
            const x = 40 + (i / (data.length-1)) * (rect.width - 60);
            const y = 230 - (r.overall_score / 100) * 200;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI*2);
            ctx.fillStyle = '#00d4ff';
            ctx.fill();
        });
    }
    
    // Failure bar chart
    const failCanvas = document.getElementById('chart-fail');
    if (failCanvas && State.auditResults.length) {
        const ctx = failCanvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = failCanvas.parentElement.getBoundingClientRect();
        failCanvas.width = rect.width * dpr;
        failCanvas.height = 250 * dpr;
        ctx.scale(dpr, dpr);
        
        // Aggregate failures (simulate CTQ failure counts)
        const failures = {};
        State.auditResults.forEach(r => {
            (r.negative_reasons || []).forEach(reason => {
                failures[reason] = (failures[reason] || 0) + 1;
            });
        });
        
        const sorted = Object.entries(failures).sort((a,b) => b[1]-a[1]).slice(0,5);
        const max = Math.max(...sorted.map(x => x[1]), 1);
        
        ctx.clearRect(0,0,rect.width,250);
        
        sorted.forEach(([reason, count], i) => {
            const y = 30 + i * 40;
            const barWidth = (count / max) * (rect.width - 150);
            
            // Label
            ctx.fillStyle = 'var(--text2)';
            ctx.font = '10px Consolas';
            ctx.textAlign = 'left';
            ctx.fillText(reason.length > 20 ? reason.substring(0,20)+'...' : reason, 10, y + 15);
            
            // Bar
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(120, y, barWidth, 20);
            
            // Count
            ctx.fillStyle = 'var(--text)';
            ctx.fillText(count, 120 + barWidth + 5, y + 15);
        });
    }
}

function drawPillarCharts() {
    const canvas = document.getElementById('chart-radar');
    if (!canvas || !State.auditResults.length) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 300 * dpr;
    ctx.scale(dpr, dpr);
    
    // Calculate pillar averages
    const pillars = ['Compliance', 'Productivity', 'Quality', 'Risk Management', 'CSAT/Retention', 'Continuous Improvement'];
    const scores = pillars.map(p => {
        const vals = State.auditResults.map(r => r.pillar_scores?.[p] || 75);
        return vals.reduce((a,b) => a+b, 0) / vals.length;
    });
    
    const cx = rect.width / 2, cy = 150, r = 100;
    const angleStep = (Math.PI * 2) / pillars.length;
    
    ctx.clearRect(0,0,rect.width,300);
    
    // Draw grid
    [20, 40, 60, 80, 100].forEach(level => {
        ctx.beginPath();
        for (let i=0; i<=pillars.length; i++) {
            const angle = i * angleStep - Math.PI/2;
            const lr = (level/100) * r;
            const x = cx + Math.cos(angle) * lr;
            const y = cy + Math.sin(angle) * lr;
            if (i===0) ctx.moveTo(x,y);
            else ctx.lineTo(x,y);
        }
        ctx.strokeStyle = 'var(--border)';
        ctx.stroke();
    });
    
    // Draw data
    ctx.beginPath();
    scores.forEach((score, i) => {
        const angle = i * angleStep - Math.PI/2;
        const sr = (score/100) * r;
        const x = cx + Math.cos(angle) * sr;
        const y = cy + Math.sin(angle) * sr;
        if (i===0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,212,255,0.2)';
    ctx.fill();
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Labels
    pillars.forEach((p, i) => {
        const angle = i * angleStep - Math.PI/2;
        const x = cx + Math.cos(angle) * (r + 30);
        const y = cy + Math.sin(angle) * (r + 30);
        ctx.fillStyle = 'var(--text2)';
        ctx.font = '10px Consolas';
        ctx.textAlign = 'center';
        ctx.fillText(p.length > 10 ? p.substring(0,10) : p, x, y);
    });
    
    // Detail cards
    const container = document.getElementById('pillar-details');
    if (container) {
        container.innerHTML = pillars.map((p, i) => `
            <div class="pillar-card" style="background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:14px;">
                <div style="font-size:11px; color:var(--text3); margin-bottom:5px;">${p}</div>
                <div style="font-size:24px; font-weight:600; color:${scores[i]>=80?'#00e676':scores[i]>=60?'#00d4ff':'#ffb300'}; font-family:var(--mono);">${scores[i].toFixed(1)}</div>
                <div style="background:var(--border); height:3px; border-radius:2px; margin-top:8px; overflow:hidden;">
                    <div style="width:${scores[i]}%; height:100%; background:${scores[i]>=80?'#00e676':scores[i]>=60?'#00d4ff':'#ffb300'};"></div>
                </div>
            </div>
        `).join('');
    }
}

// ============================================
// EXPORT FUNCTIONALITY
// ============================================
function openExportModal() {
    if (!State.auditResults.length) {
        showToast('No results to export', 'error');
        return;
    }
    DOM.exportModal.style.display = 'flex';
}

function closeExportModal() {
    DOM.exportModal.style.display = 'none';
}

function selectExportFormat(fmt) {
    State.exportFormat = fmt;
    document.getElementById('exp-csv').style.borderColor = fmt === 'csv' ? 'var(--accent)' : 'var(--border2)';
    document.getElementById('exp-csv').style.background = fmt === 'csv' ? 'rgba(0,212,255,0.05)' : 'transparent';
    document.getElementById('exp-pdf').style.borderColor = fmt === 'pdf' ? 'var(--accent)' : 'var(--border2)';
    document.getElementById('exp-pdf').style.background = fmt === 'pdf' ? 'rgba(0,212,255,0.05)' : 'transparent';
}

function executeExport() {
    const filter = document.getElementById('exp-filter').value;
    let data = [...State.auditResults];
    
    if (filter === 'fail') data = data.filter(r => !r.compliance_pass);
    else if (filter === 'sla') data = data.filter(r => r.sla_breached);
    else if (filter === 'neg') data = data.filter(r => r.sentiment === 'Negative');
    
    if (State.exportFormat === 'csv') exportCSV(data);
    else exportPDF(data);
    
    closeExportModal();
}

function exportCSV(data) {
    const headers = ['Ticket ID', 'Agent', 'Priority', 'Category', 'Score', 'Grade', 'Sentiment', 'Compliance', 'Audit Date', 'Coaching Notes'];
    const rows = data.map(r => [
        r.ticket_id, r.agent, r.priority, r.category, r.overall_score, r.grade, 
        r.sentiment, r.compliance_pass?'Pass':'Fail', new Date(r.audited_at).toLocaleDateString(), 
        `"${(r.coaching_notes || '').replace(/"/g,'""')}"`
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadBlob(csv, `ctq_audit_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
    showToast(`Exported ${data.length} records to CSV`, 'success');
}

function exportPDF(data) {
    // Generate HTML report for printing
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>CTQ Audit Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
                .header { border-bottom: 2px solid #1F5FAD; padding-bottom: 10px; margin-bottom: 20px; }
                .org { font-size: 18px; font-weight: bold; color: #1B2A4A; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background: #1B2A4A; color: white; padding: 8px; text-align: left; font-size: 11px; }
                td { padding: 6px; border-bottom: 1px solid #ddd; font-size: 10px; }
                .score { font-weight: bold; }
                .excellent { color: #00875A; } .good { color: #1F5FAD; } .fair { color: #F59E0B; } .poor { color: #C0392B; }
                .footer { margin-top: 30px; font-size: 9px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="org">YK CTQ Audit Intelligence Platform</div>
                <div style="font-size: 11px; color: #666;">Generated: ${new Date().toLocaleString()} | Records: ${data.length}</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Ticket ID</th><th>Agent</th><th>Priority</th><th>Score</th><th>Grade</th><th>Sentiment</th><th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(r => `
                        <tr>
                            <td>${r.ticket_id}</td>
                            <td>${r.agent || '—'}</td>
                            <td>${r.priority || '—'}</td>
                            <td class="score ${r.grade.toLowerCase().replace(' ','')}">${r.overall_score}</td>
                            <td>${r.grade}</td>
                            <td>${r.sentiment}</td>
                            <td>${r.compliance_pass ? '✓ Pass' : '✗ Fail'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="footer">
                YK CTQ Audit Intelligence Platform | MIT Licensed | Support: yollook511@gmail.com
            </div>
        </body>
        </html>
    `;
    
    const frame = document.getElementById('print-frame');
    frame.contentDocument.open();
    frame.contentDocument.write(html);
    frame.contentDocument.close();
    frame.contentWindow.focus();
    frame.contentWindow.print();
    
    showToast('PDF report opened for printing', 'success');
}

function downloadBlob(content, filename, type) {
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ============================================
// RESULTS MANAGEMENT
// ============================================
function updateStats() {
    DOM.ticketCount.textContent = State.auditResults.length;
    
    const total = State.auditResults.length;
    document.getElementById('stat-total').textContent = total;
    
    if (total > 0) {
        const avg = State.auditResults.reduce((s,r) => s + r.overall_score, 0) / total;
        const pass = State.auditResults.filter(r => r.compliance_pass).length / total * 100;
        const sla = State.auditResults.filter(r => r.sla_breached).length;
        
        document.getElementById('stat-avg').textContent = avg.toFixed(1);
        document.getElementById('stat-comp').textContent = pass.toFixed(0) + '%';
        document.getElementById('stat-sla').textContent = sla;
    }
    
    // Recent list
    const recent = document.getElementById('recent-audits');
    if (recent && total > 0) {
        const last = State.auditResults.slice(-5).reverse();
        recent.innerHTML = `
            <table class="data-table compact" style="width:100%;">
                <thead><tr><th>Ticket</th><th>Score</th><th>Grade</th><th>Time</th></tr></thead>
                <tbody>
                    ${last.map(r => `
                        <tr>
                            <td style="font-family:var(--mono); color:var(--accent);">${r.ticket_id}</td>
                            <td style="font-weight:600; color:${r.overall_score>=75?'var(--green)':'var(--red)'}">${r.overall_score}</td>
                            <td><span class="badge ${r.grade.toLowerCase().replace(' ','-')}">${r.grade}</span></td>
                            <td style="color:var(--text3); font-size:10px;">${new Date(r.audited_at).toLocaleTimeString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
}

function initResults() {
    const container = document.getElementById('results-container');
    if (!State.auditResults.length) {
        container.innerHTML = '<p class="empty-state">No results found. Run an audit to see data here.</p>';
        return;
    }

    // Detect v4.0 data (resolution_integrity present means scored by v4.0 engine)
    const hasV4 = State.auditResults.some(r => r.resolution_integrity !== undefined);

    const rows = State.auditResults.map(r => {
        const catFlag = (hasV4 && r.category_flag)
            ? `<span title="${_esc(r.category_flag_reason || 'Possible miscategorisation')}" style="cursor:help;">🟡</span> ` : '';
        const fcrFlag = (hasV4 && r.fcr_fail)
            ? `<span title="FCR Fail — repeat contact within 7 days" style="cursor:help;">🔴</span>` : '';
        const ri = (hasV4 && r.resolution_integrity != null)
            ? r.resolution_integrity.toFixed(0) : '';

        return `<tr>
            <td style="font-family:var(--mono); color:var(--accent);">${_esc(r.ticket_id || r.number || '—')}</td>
            <td>${_esc(r.assigned_to || r.agent || '—')}</td>
            <td>${_esc(r.priority || '—')}</td>
            <td style="font-weight:600; color:${r.overall_score>=75?'var(--green)':r.overall_score>=50?'var(--amber)':'var(--red)'}">${r.overall_score}</td>
            <td>${_esc(r.grade)}</td>
            <td><span class="sent-badge ${(r.sentiment||'').toLowerCase()}">${_esc(r.sentiment || '—')}</span></td>
            <td>${r.compliance_pass ? '✓' : '✗'}</td>
            <td>${catFlag}${_esc(r.category || '—')}</td>
            ${hasV4 ? `<td>${ri}</td><td>${fcrFlag}</td>` : ''}
            <td style="font-size:10px;">${r.audited_at ? new Date(r.audited_at).toLocaleDateString() : '—'}</td>
        </tr>`;
    }).join('');

    const v4Headers = hasV4 ? '<th>Res.Int</th><th>FCR</th>' : '';
    container.innerHTML = `
        <table class="data-table" style="width:100%; font-size:11px;">
            <thead><tr>
                <th>Ticket ID</th><th>Agent</th><th>Priority</th><th>Score</th><th>Grade</th>
                <th>Sentiment</th><th>Pass</th><th>Category</th>${v4Headers}<th>Date</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function clearAllResults() {
    if (!confirm('Clear all audit results?')) return;
    State.auditResults = [];
    updateStats();
    showToast('All results cleared', 'info');
}

// ============================================
// UTILITIES
// ============================================
function setLoading(show) {
    DOM.loadingOverlay.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 80px; right: 20px; padding: 12px 24px;
        background: ${type==='error'?'#ff4444':type==='success'?'#00e676':'#00d4ff'};
        color: #000; border-radius: 6px; font-family: Consolas, monospace;
        font-size: 12px; z-index: 10000; animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// Initialize dashboard if needed
function initDashboard() { updateStats(); }
function initAudit() {}
function initTrends() {}

// ============================================
// ADMIN PANEL
// ============================================
function initAdmin() {
    // Populate org fields from State.config
    const el = id => document.getElementById(id);
    if (el('cfg-org'))    el('cfg-org').value    = State.config.orgName || 'Enterprise IT Services';
    if (el('cfg-thresh')) el('cfg-thresh').value  = State.config.complianceThreshold || 75;

    // Populate sentiment words
    if (el('cfg-pos-words')) el('cfg-pos-words').value = (State.config.sentiment?.positive || []).join(', ');
    if (el('cfg-neg-words')) el('cfg-neg-words').value = (State.config.sentiment?.negative || []).join(', ');

    // Render CTQ items table
    const tbody = document.getElementById('ctq-admin-rows');
    if (!tbody) return;
    const pillars = ['Compliance','Consistent Quality','CSAT/Retention','Continuous Improvement','Productivity','Risk Management','Training & Coaching'];
    tbody.innerHTML = State.config.ctqItems.map(item => `
        <tr>
            <td style="text-align:center;">
                <input type="checkbox" id="ctq-active-${item.id}" ${item.active ? 'checked' : ''}
                    style="width:16px;height:16px;accent-color:var(--accent);">
            </td>
            <td style="color:var(--text3);text-align:center;">${item.id}</td>
            <td><input type="text" id="ctq-name-${item.id}" value="${_esc(item.name)}" class="inp" style="font-size:11px;padding:4px 8px;width:100%;"></td>
            <td>
                <select id="ctq-pillar-${item.id}" class="inp" style="font-size:11px;padding:4px 6px;width:100%;">
                    ${pillars.map(p => `<option value="${p}" ${p===item.pillar?'selected':''}>${p}</option>`).join('')}
                </select>
            </td>
            <td><input type="number" id="ctq-weight-${item.id}" value="${item.weight}" min="0.1" max="10" step="0.01"
                class="inp" style="font-size:11px;padding:4px 8px;width:70px;"></td>
        </tr>`).join('');
}

function adminToggleAll(active) {
    State.config.ctqItems.forEach(item => {
        const cb = document.getElementById(`ctq-active-${item.id}`);
        if (cb) cb.checked = active;
    });
}

function adminSaveCTQ() {
    State.config.ctqItems.forEach(item => {
        const active = document.getElementById(`ctq-active-${item.id}`)?.checked ?? item.active;
        const name   = document.getElementById(`ctq-name-${item.id}`)?.value || item.name;
        const pillar = document.getElementById(`ctq-pillar-${item.id}`)?.value || item.pillar;
        const weight = parseFloat(document.getElementById(`ctq-weight-${item.id}`)?.value) || item.weight;
        item.active = active;
        item.name   = name;
        item.pillar = pillar;
        item.weight = weight;
    });
    try { localStorage.setItem('yk_ctq_config_v4', JSON.stringify(State.config)); } catch(e) {}
    showToast('CTQ configuration saved', 'success');
}

function adminSaveSentiment() {
    const pos = (document.getElementById('cfg-pos-words')?.value || '').split(',').map(w=>w.trim()).filter(Boolean);
    const neg = (document.getElementById('cfg-neg-words')?.value || '').split(',').map(w=>w.trim()).filter(Boolean);
    State.config.sentiment = { positive: pos, negative: neg };
    try { localStorage.setItem('yk_ctq_config_v4', JSON.stringify(State.config)); } catch(e) {}
    showToast('Sentiment keywords saved', 'success');
}

// ============================================
// EXECUTION LOGS
// ============================================
async function initLogs() {
    const out = document.getElementById('log-output');
    if (!out) return;
    const filter = document.getElementById('log-level-filter')?.value || 'ALL';
    out.innerHTML = '<div style="color:var(--text3);">Loading…</div>';
    try {
        const res  = await fetch(`/api/logs?lines=200&level=${filter}`);
        const data = await res.json();
        if (!data.lines || !data.lines.length) {
            out.innerHTML = '<div style="color:var(--text3);">No log entries found.</div>';
            return;
        }
        const colourOf = l => l.includes('ERROR') ? '#ff4444' : l.includes('WARNING') ? '#ffb300' : l.includes('DEBUG') ? '#7c4dff' : 'var(--accent)';
        out.innerHTML = data.lines.map(line => {
            const col = colourOf(line);
            return `<div style="padding:2px 0;border-bottom:1px solid var(--border);word-break:break-all;">
                <span style="color:${col};">${_esc(line)}</span></div>`;
        }).join('');
        out.scrollTop = out.scrollHeight;
    } catch(e) {
        out.innerHTML = `<div style="color:var(--red);">⚠ Could not load logs — is server.py running? (${e.message})</div>`;
    }
}

// ============================================
// COACHING PLAN
// ============================================
function getCoachingViewContent() {
    return `
    <div class="view-header">
        <h2>Coaching Plan</h2>
        <p class="subtitle">Per-agent improvement targets based on current session results</p>
    </div>
    <div id="coaching-container"><div class="chart-loading"><div class="yk-spinner-sm"></div><span>Building plan…</span></div></div>`;
}

function initCoaching() {
    const el = document.getElementById('coaching-container');
    if (!el) return;

    const results = State.auditResults;
    if (!results.length) {
        el.innerHTML = '<div class="card"><p class="empty-state">No audit results yet — run a batch first.</p></div>';
        return;
    }

    // Group by agent
    const agentMap = {};
    results.forEach(r => {
        const agent = r.assigned_to || r.agent || 'Unknown';
        if (!agentMap[agent]) agentMap[agent] = [];
        agentMap[agent].push(r);
    });

    // Build coaching cards sorted worst-first
    const agents = Object.entries(agentMap)
        .map(([agent, tickets]) => {
            const avg  = tickets.reduce((s,t) => s + t.overall_score, 0) / tickets.length;
            const pass = tickets.filter(t => t.compliance_pass).length;

            // Aggregate weakest CTQ criteria across all tickets
            const failMap = {};
            tickets.forEach(t => {
                Object.entries(t.ctq_scores || {}).forEach(([name, score]) => {
                    if (score < 60) { failMap[name] = (failMap[name]||0) + 1; }
                });
            });
            const topFails = Object.entries(failMap)
                .sort((a,b) => b[1]-a[1])
                .slice(0, 5)
                .map(([name, count]) => ({ name, count }));

            const sentiment = {};
            tickets.forEach(t => { const s = t.sentiment || 'Neutral'; sentiment[s] = (sentiment[s]||0)+1; });

            return { agent, tickets: tickets.length, avg: avg.toFixed(1), pass, topFails, sentiment };
        })
        .sort((a,b) => a.avg - b.avg);  // worst first

    el.innerHTML = agents.map(a => {
        const scoreCol = a.avg >= 85 ? 'var(--green)' : a.avg >= 70 ? 'var(--accent)' : a.avg >= 50 ? 'var(--amber)' : 'var(--red)';
        const failRows = a.topFails.map(f =>
            `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--border);">
                <span style="color:var(--text2);font-size:11px;">${_esc(f.name)}</span>
                <span style="color:var(--red);font-size:11px;font-weight:600;">${f.count} ticket${f.count>1?'s':''} below 60</span>
             </div>`).join('') || '<div style="color:var(--text3);font-size:11px;">No critical failures 🎉</div>';

        const sentStr = Object.entries(a.sentiment).map(([k,v])=>`${k}: ${v}`).join(' · ');

        return `
        <div class="card mb16">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <div>
                    <div style="font-weight:700;font-size:15px;">${_esc(a.agent)}</div>
                    <div style="color:var(--text3);font-size:11px;">${a.tickets} ticket${a.tickets>1?'s':''} · ${a.pass}/${a.tickets} passed · Sentiment: ${sentStr}</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:28px;font-weight:800;color:${scoreCol};">${a.avg}</div>
                    <div style="font-size:9px;color:var(--text3);text-transform:uppercase;">Avg Score</div>
                </div>
            </div>
            <div class="card-title" style="font-size:11px;margin-bottom:8px;">🎯 Focus Areas</div>
            ${failRows}
        </div>`;
    }).join('');
}

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
    .badge.excellent { background: rgba(0,212,255,0.2); color: #00d4ff; border: 1px solid rgba(0,212,255,0.3); }
    .badge.good { background: rgba(0,230,118,0.2); color: #00e676; border: 1px solid rgba(0,230,118,0.3); }
    .badge.fair { background: rgba(255,179,0,0.2); color: #ffb300; border: 1px solid rgba(255,179,0,0.3); }
    .badge.poor { background: rgba(255,68,68,0.2); color: #ff4444; border: 1px solid rgba(255,68,68,0.3); }
    .sent-badge.positive { background: rgba(0,230,118,0.1); color: #00e676; padding: 2px 8px; border-radius: 12px; font-size: 10px; }
    .sent-badge.negative { background: rgba(255,68,68,0.1); color: #ff4444; padding: 2px 8px; border-radius: 12px; font-size: 10px; }
    .sent-badge.neutral { background: rgba(138,154,181,0.1); color: #8a9ab5; padding: 2px 8px; border-radius: 12px; font-size: 10px; }
    .data-table th { text-align: left; padding: 10px; background: var(--surface2); font-family: var(--mono); font-size: 10px; color: var(--text3); text-transform: uppercase; letter-spacing: 1px; }
    .data-table td { padding: 10px; border-bottom: 1px solid var(--border); font-size: 12px; }
    .data-table tr:hover { background: rgba(255,255,255,0.02); }
`;
document.head.appendChild(style);

// ============================================
// V4.0 — HISTORY TRENDS (Plotly)
// ============================================
function initV4Trends() {
    const trendEl = document.getElementById('v4-trend-chart');
    if (trendEl && window.HistoryManager) HistoryManager.renderTrends(trendEl);
}

// ============================================
// V4.0 — AGENT LEADERBOARD VIEW
// ============================================
function getAgentsViewContent() {
    return `
    <div class="view-header">
        <h2>Agent Leaderboard</h2>
        <p class="subtitle">Performance ranking — worst-first so coaching priorities are clear</p>
    </div>
    <div class="card mb16">
        <div class="card-hdr">
            <span class="card-title">Agent Performance — Last 8 Weeks</span>
            <select id="agent-weeks" class="inp-sm" onchange="initV4Agents()">
                <option value="4">4 weeks</option>
                <option value="8" selected>8 weeks</option>
                <option value="13">13 weeks</option>
                <option value="26">26 weeks</option>
            </select>
        </div>
        <div id="agent-leaderboard-chart" style="min-height:300px;"></div>
    </div>
    <div class="card">
        <div class="card-title">Agent Table</div>
        <div id="agent-table-container"><div class="chart-loading"><div class="yk-spinner-sm"></div><span>Loading…</span></div></div>
    </div>`;
}

async function initV4Agents() {
    const el = document.getElementById('agent-leaderboard-chart');
    const tableEl = document.getElementById('agent-table-container');
    if (!el) return;

    const weeks = document.getElementById('agent-weeks')?.value || 8;

    if (window.HistoryManager) HistoryManager.renderAgentLeaderboard(el, weeks);
    else el.innerHTML = '<div class="chart-error">HistoryManager not loaded — refresh the page.</div>';

    // Also load table
    try {
        const res = await fetch(`/api/history/agents?weeks=${weeks}&page=1`);
        const data = await res.json();
        if (tableEl && data.agents) {
            const rows = data.agents.map(a => `
                <tr>
                    <td style="font-weight:600;">${_esc(a.agent)}</td>
                    <td>${a.ticket_count}</td>
                    <td style="color:${a.avg_score>=85?'var(--green)':a.avg_score>=70?'var(--accent)':a.avg_score>=50?'var(--amber)':'var(--red)'}; font-weight:600;">${a.avg_score}</td>
                    <td>${a.compliance_rate}%</td>
                    <td style="color:${a.fcr_fail_rate>20?'var(--red)':'var(--text2)'};">${a.fcr_fail_rate}%</td>
                </tr>`).join('');
            tableEl.innerHTML = `
                <table class="data-table" style="width:100%;">
                    <thead><tr>
                        <th>Agent</th><th>Tickets</th><th>Avg Score</th><th>Compliance</th><th>FCR Fail Rate</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
                ${data.total_pages > 1 ? `<div class="chart-pagination">Page 1/${data.total_pages} · ${data.total} agents</div>` : ''}`;
        }
    } catch (e) { /* server may be offline, chart still works from local data */ }
}

// ============================================
// V4.0 — NOTE PATTERNS VIEW
// ============================================
function getNotePatternViewContent() {
    return `
    <div class="view-header">
        <h2>Note Pattern Library</h2>
        <p class="subtitle">Coaching prompts for low-scoring work notes — editable by admin</p>
    </div>
    <div class="card">
        <div class="card-hdr">
            <span class="card-title">Pattern Library</span>
            <div style="display:flex;gap:8px;">
                <select id="pattern-cat-filter" class="inp-sm" onchange="filterNotePatterns()">
                    <option value="">All Categories</option>
                    <option value="access">Access</option>
                    <option value="hardware">Hardware</option>
                    <option value="software">Software</option>
                    <option value="network">Network</option>
                    <option value="email">Email</option>
                    <option value="printer">Printer</option>
                    <option value="*">Generic (All)</option>
                </select>
                <button class="btn btn-primary btn-sm" onclick="openAddPatternModal()">+ Add Pattern</button>
            </div>
        </div>
        <div id="pattern-table-container"><div class="chart-loading"><div class="yk-spinner-sm"></div><span>Loading patterns…</span></div></div>
    </div>`;
}

async function initV4NotePatterns() {
    await filterNotePatterns();
}

async function filterNotePatterns() {
    const el = document.getElementById('pattern-table-container');
    if (!el) return;
    const cat = document.getElementById('pattern-cat-filter')?.value || '';

    try {
        const url = cat ? `/api/patterns/notes?category=${encodeURIComponent(cat)}` : '/api/patterns/notes';
        const res = await fetch(url);
        const patterns = await res.json();

        if (!patterns.length) {
            el.innerHTML = '<div class="chart-empty">No patterns found for this category.</div>';
            return;
        }

        const rows = patterns.map(p => `
            <tr>
                <td><span class="cat-chip">${_esc(p.category)}</span></td>
                <td style="font-size:10px; color:var(--text2);">C${p.criterion_id}</td>
                <td style="font-weight:600; font-size:11px;">${_esc(p.criterion_name)}</td>
                <td style="color:var(--amber); font-size:11px;">${_esc(p.weak_signal || '')}</td>
                <td style="font-size:11px;">${_esc(p.prompt)}</td>
                <td style="font-size:10px; color:var(--text2); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${_esc(p.strong_example || '')}">${_esc(p.strong_example || '—')}</td>
                <td style="white-space:nowrap;">
                    <button class="yk-btn-sm" onclick="editPattern(${p.id})" style="margin-right:4px;">Edit</button>
                    <button class="yk-btn-sm" onclick="deletePattern(${p.id})" style="background:rgba(255,68,68,0.12);color:#ff4444;">Delete</button>
                </td>
            </tr>`).join('');

        el.innerHTML = `
            <table class="data-table" style="width:100%; table-layout:fixed;">
                <thead><tr>
                    <th style="width:80px;">Category</th>
                    <th style="width:40px;">CTQ</th>
                    <th style="width:130px;">Criterion</th>
                    <th style="width:140px;">Weak Signal</th>
                    <th>Coaching Prompt</th>
                    <th style="width:180px;">Example</th>
                    <th style="width:60px;"></th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
    } catch (e) {
        el.innerHTML = '<div class="chart-error">⚠ Could not load patterns (server offline? Run python server.py)</div>';
    }
}

async function deletePattern(id) {
    if (!confirm('Delete this pattern?')) return;
    try {
        await fetch(`/api/patterns/notes/${id}`, { method: 'DELETE' });
        await filterNotePatterns();
        showToast('Pattern deleted', 'success');
    } catch (e) {
        showToast('Delete failed — is the server running?', 'error');
    }
}

function openAddPatternModal(existingPattern) {
    // Remove any existing modal
    document.getElementById('pattern-modal')?.remove();

    const ctqOptions = State.config.ctqItems.map(c =>
        `<option value="${c.id}" ${existingPattern?.criterion_id == c.id ? 'selected' : ''}>C${c.id} — ${_esc(c.name)}</option>`
    ).join('');

    const cats = ['General','Access','Hardware','Software','Network','Email','Printer','Telephone','Server','Database','Security','Request'];
    const catOptions = cats.map(c =>
        `<option value="${c}" ${existingPattern?.category === c ? 'selected' : ''}>${c}</option>`
    ).join('');

    const isEdit = !!existingPattern;
    const modal = document.createElement('div');
    modal.id = 'pattern-modal';
    modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;`;
    modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:12px;padding:28px;width:560px;max-width:95vw;max-height:90vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h3 style="margin:0;color:var(--text1);">${isEdit ? 'Edit' : 'Add'} Note Pattern</h3>
            <button onclick="document.getElementById('pattern-modal').remove()" style="background:none;border:none;color:var(--text2);font-size:20px;cursor:pointer;">✕</button>
        </div>

        <div class="input-group" style="margin-bottom:14px;">
            <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:6px;">CTQ Criterion *</label>
            <select id="pm-criterion" class="inp" style="width:100%;">${ctqOptions}</select>
        </div>

        <div class="input-group" style="margin-bottom:14px;">
            <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:6px;">Category *</label>
            <select id="pm-category" class="inp" style="width:100%;">${catOptions}</select>
        </div>

        <div class="input-group" style="margin-bottom:14px;">
            <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:6px;">Weak Signal Keywords (comma-separated)</label>
            <input type="text" id="pm-weak" class="inp" style="width:100%;" placeholder="e.g. no update, not documented"
                value="${_esc(existingPattern?.weak_signal || '')}">
        </div>

        <div class="input-group" style="margin-bottom:14px;">
            <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:6px;">Coaching Prompt * <span style="color:var(--text3);">(shown to agents)</span></label>
            <textarea id="pm-prompt" class="inp" rows="3" style="width:100%;resize:vertical;"
                placeholder="e.g. Ensure work notes describe each troubleshooting step taken…">${_esc(existingPattern?.prompt || '')}</textarea>
        </div>

        <div class="input-group" style="margin-bottom:20px;">
            <label style="font-size:11px;color:var(--text3);display:block;margin-bottom:6px;">Strong Example <span style="color:var(--text3);">(optional — shows good practice)</span></label>
            <textarea id="pm-example" class="inp" rows="2" style="width:100%;resize:vertical;"
                placeholder="e.g. Restarted the print spooler service, tested with test page — confirmed working.">${_esc(existingPattern?.strong_example || '')}</textarea>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button class="btn btn-ghost" onclick="document.getElementById('pattern-modal').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="savePatternModal(${isEdit ? existingPattern.id : 'null'})">${isEdit ? 'Update' : 'Add Pattern'}</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    // Close on backdrop click
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function savePatternModal(editId) {
    const criterionId  = parseInt(document.getElementById('pm-criterion')?.value);
    const category     = document.getElementById('pm-category')?.value?.trim();
    const weakSignal   = document.getElementById('pm-weak')?.value?.trim();
    const prompt       = document.getElementById('pm-prompt')?.value?.trim();
    const strongExample= document.getElementById('pm-example')?.value?.trim();

    if (!prompt) { showToast('Coaching prompt is required', 'error'); return; }

    const ctqItem = State.config.ctqItems.find(c => c.id === criterionId);
    const body = {
        criterion_id:   criterionId,
        criterion_name: ctqItem?.name || '',
        category,
        weak_signal:    weakSignal,
        prompt,
        strong_example: strongExample
    };

    try {
        const url    = editId ? `/api/patterns/notes/${editId}` : '/api/patterns/notes';
        const method = editId ? 'PUT' : 'POST';
        const res    = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(await res.text());
        document.getElementById('pattern-modal')?.remove();
        await filterNotePatterns();
        showToast(editId ? 'Pattern updated' : 'Pattern added', 'success');
    } catch(e) {
        showToast(`Save failed: ${e.message}`, 'error');
    }
}

function editPattern(id) {
    // Find pattern in the current DOM data and open modal
    fetch(`/api/patterns/notes/${id}`)
        .then(r => r.json())
        .then(p => openAddPatternModal(p))
        .catch(() => showToast('Could not load pattern', 'error'));
}

// ============================================
// V4.0 — AUTOMATION RADAR VIEW
// ============================================
function getAutomationViewContent() {
    return `
    <div class="view-header">
        <h2>Automation Radar</h2>
        <p class="subtitle">Ticket clusters most suitable for self-service, chatbot, or scripted automation</p>
    </div>
    <div class="card">
        <div class="card-title">Automation Candidates</div>
        <div id="automation-radar-container" style="min-height:200px;"></div>
    </div>`;
}

async function initV4Automation() {
    const el = document.getElementById('automation-radar-container');
    if (!el) return;
    if (window.HistoryManager) HistoryManager.renderAutomationRadar(el);
    else el.innerHTML = '<div class="chart-error">⚠ HistoryManager not loaded — refresh the page.</div>';
}

// ============================================
// V4.0 — REPEAT CALLERS VIEW
// ============================================
function getRepeatCallersViewContent() {
    return `
    <div class="view-header">
        <h2>Repeat Callers</h2>
        <p class="subtitle">Callers appearing 3+ times in the last 30 days — potential Problem ticket candidates</p>
    </div>
    <div class="card">
        <div id="repeat-callers-container" style="min-height:200px;"></div>
    </div>`;
}

async function initV4RepeatCallers() {
    const el = document.getElementById('repeat-callers-container');
    if (!el) return;
    if (window.HistoryManager) HistoryManager.renderRepeatCallers(el);
    else el.innerHTML = '<div class="chart-error">⚠ HistoryManager not loaded — refresh the page.</div>';
}

// ============================================
// V4.0 — KB HEALTH VIEW
// ============================================
function getKBHealthViewContent() {
    return `
    <div class="view-header">
        <h2>KB Health</h2>
        <p class="subtitle">Knowledge Base article usage — citation counts extracted from work notes and resolution notes</p>
    </div>
    <div class="card">
        <div class="card-title">Top KB Articles</div>
        <div id="kb-health-container"><div class="chart-loading"><div class="yk-spinner-sm"></div><span>Loading KB data…</span></div></div>
    </div>`;
}

async function initV4KBHealth() {
    const el = document.getElementById('kb-health-container');
    if (!el) return;
    try {
        const res = await fetch('/api/kb/citations');
        const data = await res.json();
        if (!data.length) {
            el.innerHTML = '<div class="chart-empty">No KB citations detected yet. Run a batch where work notes include KB article numbers (e.g., KB1234567).</div>';
            return;
        }
        const rows = data.map(r => `
            <tr>
                <td style="font-family:var(--mono); color:var(--accent);">${_esc(r.kb_article)}</td>
                <td style="font-weight:600;">${r.citation_count}</td>
                <td>${r.categories_count}</td>
            </tr>`).join('');
        el.innerHTML = `
            <table class="data-table" style="width:100%;">
                <thead><tr><th>KB Article</th><th>Citations</th><th>Categories</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>`;
    } catch (e) {
        el.innerHTML = '<div class="chart-error">⚠ Could not load KB data (is server.py running?)</div>';
    }
}

// ============================================
// V4.0 — UTILITY: HTML escape
// ============================================
function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================
// V4.0 — CSS additions
// ============================================
const v4Style = document.createElement('style');
v4Style.textContent = `
    .chart-loading { display:flex; align-items:center; gap:12px; padding:40px 20px; color:var(--text2); font-size:12px; }
    .chart-empty   { padding:40px 20px; color:var(--text3); font-size:12px; text-align:center; }
    .chart-error   { padding:20px; color:var(--red); font-size:12px; }
    .chart-pagination { padding:8px 0; color:var(--text3); font-size:11px; font-family:var(--mono); text-align:right; }
    .yk-spinner-sm { width:18px; height:18px; border:2px solid var(--border); border-top-color:var(--accent); border-radius:50%; animation:spin 1s linear infinite; flex-shrink:0; }
    .card-hdr  { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .inp-sm    { background:var(--surface2); border:1px solid var(--border); border-radius:4px; color:var(--text); font-family:var(--mono); font-size:10px; padding:4px 8px; }
    .btn-sm    { padding:4px 10px; font-size:10px; border-radius:4px; border:1px solid var(--accent); background:rgba(0,212,255,0.08); color:var(--accent); cursor:pointer; }
    .yk-btn-sm { padding:3px 8px; font-size:10px; background:rgba(255,68,68,0.08); color:var(--red); border:1px solid rgba(255,68,68,0.3); border-radius:4px; cursor:pointer; }
    .cat-chip  { display:inline-block; padding:2px 7px; background:rgba(124,77,255,0.1); color:var(--secondary); border:1px solid rgba(124,77,255,0.3); border-radius:10px; font-size:9px; font-family:var(--mono); margin-right:2px; }
    .term-chip { display:inline-block; padding:2px 6px; background:rgba(0,212,255,0.08); color:var(--accent); border:1px solid rgba(0,212,255,0.2); border-radius:8px; font-size:10px; margin:1px; font-family:var(--mono); }
    .rc-header { display:flex; align-items:center; justify-content:space-between; padding-bottom:12px; margin-bottom:12px; border-bottom:1px solid var(--border); }
    .rc-title  { font-weight:600; font-size:13px; }
    .rc-sub    { color:var(--text2); font-size:11px; }
    .rc-badge  { margin-right:6px; }
    .rc-table  { width:100%; }
    .auto-radar-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
    .auto-title        { font-weight:600; font-size:13px; }
    .auto-updated      { color:var(--text3); font-size:10px; font-family:var(--mono); }
    .auto-grid         { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px,1fr)); gap:12px; }
    .auto-card         { background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:14px; }
    .auto-card-header  { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
    .auto-cat          { font-weight:600; font-size:12px; color:var(--accent); }
    .auto-count        { font-size:10px; color:var(--text2); font-family:var(--mono); }
    .auto-terms        { margin:6px 0; }
    .auto-type         { font-size:10px; color:var(--text2); margin-top:8px; border-top:1px solid var(--border); padding-top:6px; }
    .auto-radar-computing { display:flex; flex-direction:column; align-items:center; gap:12px; padding:40px 20px; color:var(--text2); font-size:12px; text-align:center; }
    .chart-sub { font-size:10px; color:var(--text3); }
    .mt16 { margin-top:16px; }
    .mb16 { margin-bottom:16px; }
`;
document.head.appendChild(v4Style);
