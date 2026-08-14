/**
 * YK CTQ Audit Intelligence Platform - Core Engine
 * Enterprise Module - Separated from UI
 * Developer: Yogesh K | Version: 3.0.0 | Support: yollook511@gmail.com
 */

import { CryptoUtils, Storage, CSVParser } from './utils.js';

// If you want to use the separate auth-manager, import it:
// import { authManager } from './auth-manager.js';

export const ENGINE_VERSION = '3.0.0-Enterprise';
export const DEVELOPER_INFO = 'Yogesh K';
export const SUPPORT_EMAIL = 'yollook511@gmail.com';

// Storage Keys
export const STORAGE_KEYS = {
    CONFIG: 'yk_ctq_config_v3',
    RESULTS: 'yk_ctq_results_v3',
    USERS: 'yk_ctq_users_v3',
    LOGS: 'yk_ctq_logs_v3',
    SESSION: 'yk_ctq_session_v3'
};

// ... rest of the ctq-engine.js code remains the same ...

// Default Configuration
const DEFAULT_CONFIG = {
    version: ENGINE_VERSION,
    developer: DEVELOPER_INFO,
    supportEmail: SUPPORT_EMAIL,
    orgName: 'Enterprise IT Services',
    complianceThreshold: 75,
    requireLogin: true,
    maxBatchSize: 1000, // For large volume processing
    ctqItems: generateCTQItems(),
    sentiment: {
        positive: ["resolved", "fixed", "completed", "success", "assisted", "happy to", "glad", "great", "thank", "working", "done", "sorted", "help", "pleasure", "kind", "prompt", "excellent", "outstanding", "apologise", "appreciate", "please"],
        negative: ["frustrated", "escalated", "unacceptable", "still not", "not working", "issue persists", "not resolved", "delay", "overdue", "waiting", "breach", "unhappy", "disappointed", "urgent", "critical", "complaint", "broken", "fail", "error", "cannot", "unable", "ignored", "unresolved"]
    },
    pillars: [
        {name: "Continuous Improvement", icon: "↗", color: "#00d4ff"},
        {name: "Consistent Quality", icon: "✓", color: "#00e676"},
        {name: "Compliance", icon: "⚖", color: "#7c4dff"},
        {name: "Training & Coaching", icon: "🎓", color: "#ff6d00"},
        {name: "CSAT/Retention", icon: "♥", color: "#ffb300"},
        {name: "Objective Evaluation", icon: "⚖", color: "#00bcd4"},
        {name: "Productivity", icon: "⚡", color: "#e040fb"},
        {name: "Risk Management", icon: "⚠", color: "#ff4444"}
    ]
};

function generateCTQItems() {
    const items = [
        {id: 1, name: "Ticket Categorisation", pillar: "Consistent Quality", weight: 2.38},
        {id: 2, name: "Self-Service Identification", pillar: "Productivity", weight: 2.38},
        {id: 3, name: "Work Notes Documentation", pillar: "Compliance", weight: 2.38},
        {id: 4, name: "Screenshot Attachment", pillar: "Consistent Quality", weight: 2.38},
        {id: 5, name: "Relevant Information", pillar: "CSAT/Retention", weight: 2.38},
        {id: 6, name: "Ticket Status Change Accuracy", pillar: "Compliance", weight: 2.38},
        {id: 7, name: "Correct CI/OS/Product Tier", pillar: "Risk Management", weight: 2.38},
        {id: 8, name: "Business Service Mapping", pillar: "Consistent Quality", weight: 2.38},
        {id: 9, name: "Category/Sub-Category Accuracy", pillar: "Consistent Quality", weight: 2.38},
        {id: 10, name: "Additional Comments / Email Format", pillar: "CSAT/Retention", weight: 2.38},
        {id: 11, name: "Email Content Quality", pillar: "CSAT/Retention", weight: 2.38},
        {id: 12, name: "Use of Greetings/Signature", pillar: "CSAT/Retention", weight: 2.38},
        {id: 13, name: "Email Grammar & Etiquette", pillar: "Training & Coaching", weight: 2.38},
        {id: 14, name: "Avoiding Internal IT Info in Comments", pillar: "Compliance", weight: 2.38},
        {id: 15, name: "Accurate Field Updates", pillar: "Consistent Quality", weight: 2.38},
        {id: 16, name: "Customer Details Accuracy", pillar: "Consistent Quality", weight: 2.38},
        {id: 17, name: "Short Description Appropriateness", pillar: "Productivity", weight: 2.38},
        {id: 18, name: "Urgency/Impact Selection", pillar: "Risk Management", weight: 2.38},
        {id: 19, name: "Detailed Description Quality", pillar: "Consistent Quality", weight: 2.38},
        {id: 20, name: "Owner Field Accuracy", pillar: "Compliance", weight: 2.38},
        {id: 21, name: "Contact Type Accuracy", pillar: "CSAT/Retention", weight: 2.38},
        {id: 22, name: "Ticket Ownership", pillar: "Productivity", weight: 2.38},
        {id: 23, name: "User Contact Timeliness", pillar: "CSAT/Retention", weight: 2.38},
        {id: 24, name: "Ticket History Check", pillar: "Continuous Improvement", weight: 2.38},
        {id: 25, name: "Probing / Issue Identification", pillar: "Continuous Improvement", weight: 2.38},
        {id: 26, name: "Irrelevant Questions Avoidance", pillar: "Productivity", weight: 2.38},
        {id: 27, name: "KB Reference Usage", pillar: "Continuous Improvement", weight: 2.38},
        {id: 28, name: "Troubleshooting Effectiveness", pillar: "Continuous Improvement", weight: 2.38},
        {id: 29, name: "Unnecessary Ticket Pending", pillar: "Productivity", weight: 2.38},
        {id: 30, name: "Out-of-Business Hours Contact", pillar: "CSAT/Retention", weight: 2.38},
        {id: 31, name: "User Education", pillar: "Training & Coaching", weight: 2.38},
        {id: 32, name: "Expectation Setting", pillar: "CSAT/Retention", weight: 2.38},
        {id: 33, name: "Incorrect KB Reference", pillar: "Risk Management", weight: 2.38},
        {id: 34, name: "KB Attachment on Ticket", pillar: "Compliance", weight: 2.38},
        {id: 35, name: "Strike Rule Initiation", pillar: "Compliance", weight: 2.38},
        {id: 36, name: "Incorrect Strike Initiation", pillar: "Risk Management", weight: 2.38},
        {id: 37, name: "Manual Strike Process Adherence", pillar: "Risk Management", weight: 2.38},
        {id: 38, name: "Correct On-Hold Reason", pillar: "Compliance", weight: 2.38},
        {id: 39, name: "SME Consultation", pillar: "Continuous Improvement", weight: 2.38},
        {id: 40, name: "Incorrect Ticket Type/Form", pillar: "Risk Management", weight: 2.38},
        {id: 41, name: "Inefficient Resolution", pillar: "Productivity", weight: 2.40},
        {id: 42, name: "Lead/SME Stamp Requirement", pillar: "Compliance", weight: 2.40}
    ];
    return items.map(i => ({...i, active: true}));
}

// Crypto Utilities
const CryptoUtils = {
    async hashPassword(password, salt) {
        const encoder = new TextEncoder();
        const data = encoder.encode(salt + password + 'YK_CTQ_PEPPER_2026');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    generateSalt() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }
};

// Configuration Manager
export const ConfigManager = {
    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
            if (!raw) return {...DEFAULT_CONFIG};
            const saved = JSON.parse(raw);
            return {...DEFAULT_CONFIG, ...saved};
        } catch (e) {
            console.error('Config load error:', e);
            return {...DEFAULT_CONFIG};
        }
    },
    
    save(config) {
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    },
    
    reset() {
        localStorage.removeItem(STORAGE_KEYS.CONFIG);
    }
};

// Authentication Manager
export const AuthManager = {
    async initialize() {
        const users = this.getUsers();
        // Only create a local default admin if the developer explicitly enabled
        // local dev mode. Production deployments should manage users server-side.
        const devMode = localStorage.getItem('yk_dev_mode') === 'true';
        const devPassword = localStorage.getItem('yk_dev_admin_password') || '';
        if (users.length === 0 && devMode && devPassword) {
            const salt = CryptoUtils.generateSalt();
            const hash = await CryptoUtils.hashPassword(devPassword, salt);
            users.push({
                username: 'admin',
                displayName: 'System Administrator (local dev)',
                role: 'admin',
                salt,
                hash,
                active: true,
                createdAt: new Date().toISOString(),
                lastLogin: null,
                loginCount: 0
            });
            this.saveUsers(users);
        }
    },
    
    getUsers() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.USERS);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    },
    
    saveUsers(users) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    },
    
    async verify(username, password) {
        const users = this.getUsers();
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.active);
        if (!user) return null;
        
        const hash = await CryptoUtils.hashPassword(password, user.salt);
        if (hash !== user.hash) return null;
        
        user.lastLogin = new Date().toISOString();
        user.loginCount++;
        this.saveUsers(users);
        
        return {
            username: user.username,
            displayName: user.displayName,
            role: user.role
        };
    },
    
    async addUser(username, displayName, role, password) {
        const users = this.getUsers();
        if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
            throw new Error('Username already exists');
        }
        const salt = CryptoUtils.generateSalt();
        const hash = await CryptoUtils.hashPassword(password, salt);
        users.push({
            username, displayName, role, salt, hash,
            active: true,
            createdAt: new Date().toISOString(),
            lastLogin: null,
            loginCount: 0
        });
        this.saveUsers(users);
    },
    
    async changePassword(username, newPassword) {
        const users = this.getUsers();
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user) throw new Error('User not found');
        user.salt = CryptoUtils.generateSalt();
        user.hash = await CryptoUtils.hashPassword(newPassword, user.salt);
        this.saveUsers(users);
    }
};

// Scoring Engine with All 42 Criteria
export const ScoringEngine = {
    async processBatch(tickets, config, onProgress) {
        const results = [];
        const batchSize = config.maxBatchSize || 1000;
        const total = tickets.length;
        
        for (let i = 0; i < total; i += batchSize) {
            const batch = tickets.slice(i, i + batchSize);
            const batchResults = batch.map(ticket => this.scoreTicket(ticket, config));
            results.push(...batchResults);
            
            if (onProgress) {
                onProgress({
                    processed: Math.min(i + batchSize, total),
                    total,
                    percentage: Math.round((Math.min(i + batchSize, total) / total) * 100)
                });
            }
            
            // Yield to main thread
            if (i + batchSize < total) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        return results;
    },
    
    scoreTicket(ticket, config) {
        const activeItems = config.ctqItems.filter(c => c.active);
        const scores = {};
        const positiveReasons = [];
        const negativeReasons = [];
        const riskFlags = [];
        
        // Extract fields
        const wn = ticket.work_notes || '';
        const ac = ticket.additional_comments || '';
        const desc = ticket.description || '';
        const rn = ticket.resolution_notes || '';
        const sd = ticket.short_description || '';
        const cat = ticket.category || '';
        const sub = ticket.subcategory || '';
        const ci = ticket.configuration_item || '';
        const pri = ticket.priority || '';
        const state = ticket.state || '';
        const rc = ticket.resolution_code || '';
        const ku = ticket.knowledge_used || '';
        const ag = ticket.assigned_to || '';
        const group = ticket.assignment_group || '';
        const caller = ticket.caller || '';
        const reass = parseInt(ticket.reassignment_count) || 0;
        const sc = parseInt(ticket.strike_count) || 0;
        const ss = ticket.start_strike || '';
        const opened = ticket.opened || '';
        
        const wc = s => (s || '').trim().split(/\s+/).filter(Boolean).length;
        const clean = s => (s || '').toLowerCase();
        
        // Score each active criterion
        activeItems.forEach(item => {
            const score = this.evaluateCriterion(item.id, {
                wn, ac, desc, rn, sd, cat, sub, ci, pri, state, rc, ku, ag, group, caller, reass, sc, ss, opened, wc, clean
            });
            scores[item.name] = score;
            
            if (score < 60) negativeReasons.push(`${item.name} (${score})`);
            else if (score > 90) positiveReasons.push(item.name);
        });
        
        // Calculate weighted score
        let totalWeight = 0;
        let weightedSum = 0;
        activeItems.forEach(item => {
            const s = scores[item.name] || 100;
            weightedSum += s * item.weight;
            totalWeight += item.weight;
        });
        
        const overall = totalWeight > 0 ? Math.min(100, weightedSum / totalWeight) : 0;
        
        // Sentiment Analysis
        const sentiment = this.analyzeSentiment(wn + ' ' + ac + ' ' + desc, config.sentiment);
        
        return {
            ...ticket,
            overall_score: parseFloat(overall.toFixed(1)),
            grade: this.getGrade(overall),
            compliance_pass: overall >= config.complianceThreshold,
            ctq_scores: scores,
            sentiment: sentiment.type,
            sentiment_reason: sentiment.reason,
            positive_reasons: positiveReasons.slice(0, 6),
            negative_reasons: negativeReasons.slice(0, 6),
            risk_flags: riskFlags,
            coaching_notes: this.generateCoachingNotes(negativeReasons),
            engine_version: ENGINE_VERSION,
            audited_at: new Date().toISOString()
        };
    },
    
    evaluateCriterion(id, fields) {
        const {wn, ac, desc, rn, sd, cat, sub, ci, pri, state, rc, ku, ag, group, caller, reass, sc, ss, opened, wc, clean} = fields;
        
        switch(id) {
            case 1: // Ticket Categorisation
                if (cat && cat.length > 2) return 100;
                return 0;
                
            case 2: // Self-Service Identification
                const kw2 = /self.?service|user guide|kb|knowledge base|faq|how.?to|portal/i;
                return kw2.test(wn + ac + rn) ? 100 : (cat.toLowerCase().includes('self') ? 80 : 50);
                
            case 3: // Work Notes Documentation
                const wnLen = wc(wn);
                if (!wn) return 0;
                if (wnLen < 10) return 30;
                if (wnLen < 30) return 65;
                if (wnLen < 80) return 85;
                return 100;
                
            case 4: // Screenshot Attachment
                const kw4 = /screenshot|attachment|attached|image|snip|capture/i;
                return kw4.test(wn + ac) ? 100 : 40;
                
            case 5: // Relevant Information
                const kw5 = /per your request|as discussed|following up|further to|please find|as agreed|as requested/i;
                return kw5.test(ac) ? 95 : (wc(ac) > 20 ? 80 : 30);
                
            case 6: // Ticket Status Change Accuracy
                const st = clean(state);
                if (!state) return 0;
                if (/resolv|clos/.test(st) && !rn) return 40;
                if (/resolv|clos/.test(st) && rn) return 100;
                if (/hold/.test(st) && !/(awaiting|waiting|pending|3rd party|vendor)/i.test(wn + ac)) return 50;
                return 85;
                
            case 7: // Correct CI/OS/Product Tier
                return ci ? 100 : 0;
                
            case 8: // Business Service Mapping
                return (group && cat) ? 100 : (group || cat ? 70 : 20);
                
            case 9: // Category/Sub-Category Accuracy
                return (cat && sub) ? 100 : (cat ? 60 : 0);
                
            case 10: // Additional Comments / Email Format
                if (!ac) return 0;
                const gk = /dear|hello|hi |good morning|good afternoon|thank you|thanks for/i;
                const sk = /regards|sincerely|kind regards|best regards|IT support|service desk/i;
                if (gk.test(ac) && sk.test(ac)) return 100;
                if (gk.test(ac) || sk.test(ac)) return 70;
                return 40;
                
            case 11: // Email Content Quality
                if (!ac) return 0;
                const acLen = wc(ac);
                if (acLen < 10) return 30;
                if (acLen < 30) return 65;
                return 100;
                
            case 12: // Use of Greetings/Signature
                if (!ac) return 50;
                const g12 = /dear|hello|hi |good morning|good afternoon/i;
                const s12 = /regards|sincerely|kind regards|best regards/i;
                if (g12.test(ac) && s12.test(ac)) return 100;
                if (g12.test(ac) || s12.test(ac)) return 70;
                return 20;
                
            case 13: // Email Grammar & Etiquette
                const bad = /\bu r\b|cant |wont |didnt |shouldnt |im |gonna|wanna|\bpls\b|\bplz\b|as per\b/i;
                const slang = /\blol\b|\bwtf\b|\bomg\b|\bbrb\b/i;
                if (!ac) return 70;
                if (slang.test(ac)) return 20;
                if (bad.test(ac)) return 40;
                return 95;
                
            case 14: // Avoiding Internal IT Info in Comments
                const ik = /jira|confluence|slack|internal|admin password|root password|server ip|\\\\[a-z]/i;
                return ik.test(ac) ? 0 : 100;
                
            case 15: // Accurate Field Updates
                const filled = [cat, sub, ci, pri, state, ag, group, rc].filter(f => f && f.toString().trim().length > 0).length;
                return Math.round((filled / 8) * 100);
                
            case 16: // Customer Details Accuracy
                return (caller && ag) ? 100 : (caller || ag ? 60 : 0);
                
            case 17: // Short Description Appropriateness
                if (!sd) return 0;
                const sdLen = wc(sd);
                if (sdLen < 3) return 20;
                if (sdLen < 6) return 60;
                if (sdLen > 20) return 70;
                return 100;
                
            case 18: // Urgency/Impact Selection
                return pri ? 100 : 0;
                
            case 19: // Detailed Description Quality
                const total = wc(desc) + wc(wn);
                if (!desc && !wn) return 0;
                if (total < 20) return 30;
                if (total < 60) return 65;
                return 100;
                
            case 20: // Owner Field Accuracy
                return (ag && group) ? 100 : (ag ? 70 : (group ? 60 : 0));
                
            case 21: // Contact Type Accuracy
                return 90; // Default if ticket type exists
                
            case 22: // Ticket Ownership
                if (reass === 0) return 100;
                if (reass <= 1) return 80;
                if (reass <= 3) return 50;
                return 10;
                
            case 23: // User Contact Timeliness
                const kw23 = /contacted|called|emailed|reached out|sent update|follow.?up|update sent/i;
                return kw23.test(wn + ac) ? 100 : (ac ? 70 : 30);
                
            case 24: // Ticket History Check
                const kw24 = /previous|history|prior|earlier|similar|recurrence|same issue|seen before|duplicate/i;
                return kw24.test(wn + desc) ? 100 : 40;
                
            case 25: // Probing / Issue Identification
                const kw25 = /what happened|when did|how long|error message|steps to reproduce|can you describe|impact|affected users/i;
                return kw25.test(wn + desc + ac) ? 100 : (wc(desc) > 30 ? 70 : 30);
                
            case 26: // Irrelevant Questions Avoidance
                const kw26 = /is your computer on|have you tried turning|what colour|what model year/i;
                return kw26.test(wn + ac) ? 40 : 90;
                
            case 27: // KB Reference Usage
                const kuLow = clean(ku);
                const kbKw = /kb\d+|knowledge base|knowledge article|kb article|reference kb|per kb/i;
                if (/true|yes|1/.test(kuLow) || kbKw.test(wn + rn)) return 100;
                if (/false|no|0/.test(kuLow)) return 10;
                return 40;
                
            case 28: // Troubleshooting Effectiveness
                const kw28 = (wn + rn).match(/restart|reboot|reset|reinstall|update|patch|clear cache|log off|reconfigure|tested|verified|confirmed/gi) || [];
                if (kw28.length >= 3) return 100;
                if (kw28.length >= 1) return 70;
                if (wc(wn) > 20) return 55;
                return 20;
                
            case 29: // Unnecessary Ticket Pending
                const noReason = /on hold/i.test(state) && !/(awaiting|waiting for|on hold for)/i.test(wn + ac);
                return noReason ? 30 : 90;
                
            case 30: // Out-of-Business Hours Contact
                if (!opened) return 80;
                const d = new Date(opened);
                if (isNaN(d.getTime())) return 80;
                const h = d.getHours();
                const day = d.getDay();
                if (day === 0 || day === 6 || h < 8 || h > 18) return 50;
                return 80;
                
            case 31: // User Education
                const kw31 = /please note|for future|you can|next time|recommend|suggest|prevent|avoid|guide|how to|self.?service|portal/i;
                return kw31.test(ac + rn) ? 100 : 40;
                
            case 32: // Expectation Setting
                const kw32 = /will be|should be|expected|by end of|within \d|target|timeline|sla|xla|update you|keep you|let you know|notify/i;
                return kw32.test(ac + wn) ? 100 : 35;
                
            case 33: // Incorrect KB Reference
                const kw33 = /incorrect kb|wrong kb|wrong article|kb not applicable/i;
                return kw33.test(wn) ? 10 : 95;
                
            case 34: // KB Attachment on Ticket
                const kbKw34 = /kb\d+|attached kb|kb article attached|knowledge attached/i;
                const kuLow34 = clean(ku);
                return (kbKw34.test(wn + rn) || /true|yes/.test(kuLow34)) ? 100 : 20;
                
            case 35: // Strike Rule Initiation
                if (sc > 0 || /true|yes/.test(clean(ss))) return 100;
                const old = opened && ((new Date() - new Date(opened)) / (1000 * 60 * 60 * 24)) > 5;
                return old ? 50 : 85;
                
            case 36: // Incorrect Strike Initiation
                const kw36 = /incorrect strike|wrong strike|strike error|premature strike/i;
                return kw36.test(wn) ? 10 : 95;
                
            case 37: // Manual Strike Process Adherence
                const vip = /vip|executive|director|ceo|cto|cio|board|priority user/i;
                if (vip.test(caller + desc + wn)) {
                    const mk = /manual strike|vip process|approved strike/i;
                    return mk.test(wn) ? 100 : 40;
                }
                return 90;
                
            case 38: // Correct On-Hold Reason
                if (!/hold/i.test(state)) return 90;
                const kw38 = /awaiting user|awaiting vendor|third party|3rd party|awaiting approval|awaiting parts|pending user/i;
                return kw38.test(wn + ac) ? 100 : 20;
                
            case 39: // SME Consultation
                const kw39 = /sme|subject matter|specialist|escalated to|l2|l3|level 2|level 3|senior|lead/i;
                return kw39.test(wn + ac) ? 100 : (reass > 1 ? 60 : 70);
                
            case 40: // Incorrect Ticket Type/Form
                const kw40 = /wrong form|incorrect type|should be sr|should be incident|reclassified|converted to/i;
                return kw40.test(wn) ? 20 : 90;
                
            case 41: // Inefficient Resolution
                const total41 = wc(rn) + wc(wn);
                if (!rn && /resolv|clos/i.test(state)) return 0;
                if (rc && total41 > 20) return 100;
                if (rc) return 70;
                return 40;
                
            case 42: // Lead/SME Stamp Requirement
                const kw42 = /approved by|lead approved|sme approved|signed off|reviewed by|authorised by|stamp/i;
                return kw42.test(wn) ? 100 : 60;
                
            default:
                return 100;
        }
    },
    
    analyzeSentiment(text, wordLists) {
        const allText = text.toLowerCase();
        let posCount = 0, negCount = 0;
        
        wordLists.positive.forEach(word => {
            const matches = allText.match(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
            if (matches) posCount += matches.length;
        });
        
        wordLists.negative.forEach(word => {
            const matches = allText.match(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
            if (matches) negCount += matches.length;
        });
        
        if (negCount > posCount + 1) return {type: 'Negative', reason: 'Negative language or frustration detected'};
        if (posCount > negCount + 1) return {type: 'Positive', reason: 'Positive resolution language detected'};
        return {type: 'Neutral', reason: 'Neutral or balanced communication'};
    },
    
    getGrade(score) {
        if (score >= 85) return 'Excellent';
        if (score >= 70) return 'Good';
        if (score >= 50) return 'Fair';
        return 'Poor';
    },
    
    generateCoachingNotes(issues) {
        if (!issues.length) {
            return 'Excellent performance across all CTQ criteria. Encourage continued best practice and peer mentoring.';
        }
        const top3 = issues.slice(0, 3).map(i => i.replace(/\s*\(\d+\)$/, ''));
        return `Focus coaching on: ${top3.join(', ')}. These areas showed scores below 60 and represent the highest improvement opportunity.`;
    }
};

// Results Storage
export const ResultsStore = {
    load() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.RESULTS) || '[]');
        } catch {
            return [];
        }
    },
    
    save(results) {
        localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(results));
    },
    
    add(newResults) {
        const existing = this.load();
        const combined = [...newResults, ...existing];
        this.save(combined);
        return combined;
    },
    
    clear() {
        localStorage.removeItem(STORAGE_KEYS.RESULTS);
    }
};

// Execution Logger
export const Logger = {
    write(action, detail, level = 'info', username = null) {
        const logs = this.load();
        const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            timestamp: new Date().toISOString(),
            user: username || (sessionStorage.getItem(STORAGE_KEYS.SESSION) ? JSON.parse(sessionStorage.getItem(STORAGE_KEYS.SESSION)).username : 'system'),
            action,
            detail,
            level
        };
        logs.unshift(entry);
        if (logs.length > 2000) logs.length = 2000; // Keep last 2000
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
        return entry;
    },
    
    load() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGS) || '[]');
        } catch {
            return [];
        }
    },
    
    exportCSV() {
        const logs = this.load();
        const headers = ['Timestamp', 'User', 'Action', 'Detail', 'Level'];
        const rows = logs.map(l => [
            l.timestamp, l.user, l.action, `"${(l.detail || '').replace(/"/g, '""')}"`, l.level
        ]);
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
};

// Export configuration info
export const AppInfo = {
    version: ENGINE_VERSION,
    developer: DEVELOPER_INFO,
    supportEmail: SUPPORT_EMAIL
};