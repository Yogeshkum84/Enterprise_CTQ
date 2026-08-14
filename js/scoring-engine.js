/**
 * YK Scoring Engine
 * All 42 CTQ Criteria implementation
 */

import { ConfigManager } from './config-manager.js';

export class ScoringEngine {
    static async processBatch(tickets, config, onProgress) {
        const results = [];
        const batchSize = config.maxBatchSize || 500;
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
    }
    
    static scoreTicket(ticket, config) {
        const activeItems = config.ctqItems.filter(c => c.active);
        const scores = {};
        const positiveReasons = [];
        const negativeReasons = [];
        const riskFlags = [];
        
        // Normalize fields
        const fields = {
            wn: ticket.work_notes || '',
            ac: ticket.additional_comments || '',
            desc: ticket.description || '',
            rn: ticket.resolution_notes || '',
            sd: ticket.short_description || '',
            cat: ticket.category || '',
            sub: ticket.subcategory || '',
            ci: ticket.configuration_item || '',
            pri: ticket.priority || '',
            state: ticket.state || '',
            rc: ticket.resolution_code || '',
            ku: ticket.knowledge_used || '',
            ag: ticket.assigned_to || ticket.agent || '',
            group: ticket.assignment_group || '',
            caller: ticket.caller || '',
            reass: parseInt(ticket.reassignment_count) || 0,
            sc: parseInt(ticket.strike_count) || 0,
            ss: ticket.start_strike || '',
            opened: ticket.opened || '',
            wc: s => (s || '').trim().split(/\s+/).filter(Boolean).length,
            clean: s => (s || '').toLowerCase()
        };
        
        // Score each criterion
        activeItems.forEach(item => {
            const score = this.evaluateCriterion(item.id, fields);
            scores[item.name] = score;
            
            if (score < 60) negativeReasons.push(`${item.name} (${score})`);
            else if (score >= 85) positiveReasons.push(item.name);
        });
        
        // Calculate weighted average
        let totalWeight = 0;
        let weightedSum = 0;
        activeItems.forEach(item => {
            const s = scores[item.name] || 100;
            weightedSum += s * item.weight;
            totalWeight += item.weight;
        });
        
        const overall = totalWeight > 0 ? Math.min(100, weightedSum / totalWeight) : 0;
        
        // Sentiment Analysis
        const sentiment = this.analyzeSentiment(fields.wn + ' ' + fields.ac + ' ' + fields.desc, config.sentiment);
        
        return {
            ...ticket,
            overall_score: parseFloat(overall.toFixed(1)),
            grade: this.getGrade(overall),
            compliance_pass: overall >= config.complianceThreshold,
            ctq_scores: scores,
            pillar_scores: this.calculatePillarScores(scores, activeItems),
            sentiment: sentiment.type,
            sentiment_reason: sentiment.reason,
            positive_reasons: positiveReasons.slice(0, 6),
            negative_reasons: negativeReasons.slice(0, 6),
            risk_flags: riskFlags,
            coaching_notes: this.generateCoachingNotes(negativeReasons),
            audited_at: new Date().toISOString()
        };
    }
    
    static evaluateCriterion(id, f) {
        switch(id) {
            case 1: return f.cat && f.cat.length > 2 ? 100 : 0;
            
            case 2: {
                const kw = /self.?service|user guide|kb|knowledge base|faq|how.?to|portal/i;
                return kw.test(f.wn + f.ac + f.rn) ? 100 : (f.cat.toLowerCase().includes('self') ? 80 : 50);
            }
            
            case 3: {
                const len = f.wc(f.wn);
                if (!f.wn) return 0;
                if (len < 10) return 30;
                if (len < 30) return 65;
                if (len < 80) return 85;
                return 100;
            }
            
            case 4: {
                const kw = /screenshot|attachment|attached|image|snip|capture/i;
                return kw.test(f.wn + f.ac) ? 100 : 40;
            }
            
            case 5: {
                const kw = /per your request|as discussed|following up|further to|please find|as agreed/i;
                return kw.test(f.ac) ? 95 : (f.wc(f.ac) > 20 ? 80 : 30);
            }
            
            case 6: {
                const st = f.clean(f.state);
                if (!f.state) return 0;
                if (/resolv|clos/.test(st) && !f.rn) return 40;
                if (/resolv|clos/.test(st) && f.rn) return 100;
                if (/hold/.test(st) && !/(awaiting|waiting|pending|3rd party|vendor)/i.test(f.wn + f.ac)) return 50;
                return 85;
            }
            
            case 7: return f.ci ? 100 : 0;
            
            case 8: return (f.group && f.cat) ? 100 : (f.group || f.cat ? 70 : 20);
            
            case 9: return (f.cat && f.sub) ? 100 : (f.cat ? 60 : 0);
            
            case 10: {
                if (!f.ac) return 0;
                const g = /dear|hello|hi |good morning|good afternoon|thank you|thanks for/i;
                const s = /regards|sincerely|kind regards|best regards|IT support|service desk/i;
                if (g.test(f.ac) && s.test(f.ac)) return 100;
                if (g.test(f.ac) || s.test(f.ac)) return 70;
                return 40;
            }
            
            case 11: {
                if (!f.ac) return 0;
                const len = f.wc(f.ac);
                if (len < 10) return 30;
                if (len < 30) return 65;
                return 100;
            }
            
            case 12: {
                if (!f.ac) return 50;
                const g = /dear|hello|hi |good morning|good afternoon/i;
                const s = /regards|sincerely|kind regards|best regards/i;
                if (g.test(f.ac) && s.test(f.ac)) return 100;
                if (g.test(f.ac) || s.test(f.ac)) return 70;
                return 20;
            }
            
            case 13: {
                const bad = /\bu r\b|cant |wont |didnt |shouldnt |im |gonna|wanna|\bpls\b|\bplz\b/i;
                const slang = /\blol\b|\bwtf\b|\bomg\b|\bbrb\b/i;
                if (!f.ac) return 70;
                if (slang.test(f.ac)) return 20;
                if (bad.test(f.ac)) return 40;
                return 95;
            }
            
            case 14: {
                const ik = /jira|confluence|slack|internal|admin password|root password|server ip|\\\\[a-z]/i;
                return ik.test(f.ac) ? 0 : 100;
            }
            
            case 15: {
                const filled = [f.cat, f.sub, f.ci, f.pri, f.state, f.ag, f.group, f.rc].filter(x => x && x.toString().trim()).length;
                return Math.round((filled / 8) * 100);
            }
            
            case 16: return (f.caller && f.ag) ? 100 : (f.caller || f.ag ? 60 : 0);
            
            case 17: {
                if (!f.sd) return 0;
                const len = f.wc(f.sd);
                if (len < 3) return 20;
                if (len < 6) return 60;
                if (len > 20) return 70;
                return 100;
            }
            
            case 18: return f.pri ? 100 : 0;
            
            case 19: {
                const total = f.wc(f.desc) + f.wc(f.wn);
                if (!f.desc && !f.wn) return 0;
                if (total < 20) return 30;
                if (total < 60) return 65;
                return 100;
            }
            
            case 20: return (f.ag && f.group) ? 100 : (f.ag ? 70 : (f.group ? 60 : 0));
            
            case 21: return 90;
            
            case 22: {
                if (f.reass === 0) return 100;
                if (f.reass <= 1) return 80;
                if (f.reass <= 3) return 50;
                return 10;
            }
            
            case 23: {
                const kw = /contacted|called|emailed|reached out|sent update|follow.?up|update sent/i;
                return kw.test(f.wn + f.ac) ? 100 : (f.ac ? 70 : 30);
            }
            
            case 24: {
                const kw = /previous|history|prior|earlier|similar|recurrence|same issue|seen before|duplicate/i;
                return kw.test(f.wn + f.desc) ? 100 : 40;
            }
            
            case 25: {
                const kw = /what happened|when did|how long|error message|steps to reproduce|can you describe|impact|affected users/i;
                return kw.test(f.wn + f.desc + f.ac) ? 100 : (f.wc(f.desc) > 30 ? 70 : 30);
            }
            
            case 26: {
                const kw = /is your computer on|have you tried turning|what colour|what model year/i;
                return kw.test(f.wn + f.ac) ? 40 : 90;
            }
            
            case 27: {
                const kuLow = f.clean(f.ku);
                const kbKw = /kb\d+|knowledge base|knowledge article|kb article|reference kb|per kb/i;
                if (/true|yes|1/.test(kuLow) || kbKw.test(f.wn + f.rn)) return 100;
                if (/false|no|0/.test(kuLow)) return 10;
                return 40;
            }
            
            case 28: {
                const kw = (f.wn + f.rn).match(/restart|reboot|reset|reinstall|update|patch|clear cache|log off|reconfigure|tested|verified|confirmed/gi) || [];
                if (kw.length >= 3) return 100;
                if (kw.length >= 1) return 70;
                if (f.wc(f.wn) > 20) return 55;
                return 20;
            }
            
            case 29: {
                const noReason = /on hold/i.test(f.state) && !/(awaiting|waiting for|on hold for)/i.test(f.wn + f.ac);
                return noReason ? 30 : 90;
            }
            
            case 30: {
                if (!f.opened) return 80;
                const d = new Date(f.opened);
                if (isNaN(d.getTime())) return 80;
                const h = d.getHours();
                const day = d.getDay();
                if (day === 0 || day === 6 || h < 8 || h > 18) return 50;
                return 80;
            }
            
            case 31: {
                const kw = /please note|for future|you can|next time|recommend|suggest|prevent|avoid|guide|how to|self.?service|portal/i;
                return kw.test(f.ac + f.rn) ? 100 : 40;
            }
            
            case 32: {
                const kw = /will be|should be|expected|by end of|within \d|target|timeline|sla|xla|update you|keep you|let you know|notify/i;
                return kw.test(f.ac + f.wn) ? 100 : 35;
            }
            
            case 33: {
                const kw = /incorrect kb|wrong kb|wrong article|kb not applicable/i;
                return kw.test(f.wn) ? 10 : 95;
            }
            
            case 34: {
                const kbKw = /kb\d+|attached kb|kb article attached|knowledge attached/i;
                const kuLow = f.clean(f.ku);
                return (kbKw.test(f.wn + f.rn) || /true|yes/.test(kuLow)) ? 100 : 20;
            }
            
            case 35: {
                if (f.sc > 0 || /true|yes/.test(f.clean(f.ss))) return 100;
                const old = f.opened && ((new Date() - new Date(f.opened)) / (1000 * 60 * 60 * 24)) > 5;
                return old ? 50 : 85;
            }
            
            case 36: {
                const kw = /incorrect strike|wrong strike|strike error|premature strike/i;
                return kw.test(f.wn) ? 10 : 95;
            }
            
            case 37: {
                const vip = /vip|executive|director|ceo|cto|cio|board|priority user/i;
                if (vip.test(f.caller + f.desc + f.wn)) {
                    const mk = /manual strike|vip process|approved strike/i;
                    return mk.test(f.wn) ? 100 : 40;
                }
                return 90;
            }
            
            case 38: {
                if (!/hold/i.test(f.state)) return 90;
                const kw = /awaiting user|awaiting vendor|third party|3rd party|awaiting approval|awaiting parts|pending user/i;
                return kw.test(f.wn + f.ac) ? 100 : 20;
            }
            
            case 39: {
                const kw = /sme|subject matter|specialist|escalated to|l2|l3|level 2|level 3|senior|lead/i;
                return kw.test(f.wn + f.ac) ? 100 : (f.reass > 1 ? 60 : 70);
            }
            
            case 40: {
                const kw = /wrong form|incorrect type|should be sr|should be incident|reclassified|converted to/i;
                return kw.test(f.wn) ? 20 : 90;
            }
            
            case 41: {
                const total = f.wc(f.rn) + f.wc(f.wn);
                if (!f.rn && /resolv|clos/i.test(f.clean(f.state))) return 0;
                if (f.rc && total > 20) return 100;
                if (f.rc) return 70;
                return 40;
            }
            
            case 42: {
                const kw = /approved by|lead approved|sme approved|signed off|reviewed by|authorised by|stamp/i;
                return kw.test(f.wn) ? 100 : 60;
            }
            
            default: return 100;
        }
    }
    
    static analyzeSentiment(text, wordLists) {
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
        
        if (negCount > posCount + 1) return {type: 'Negative', reason: 'Negative language detected'};
        if (posCount > negCount + 1) return {type: 'Positive', reason: 'Positive resolution language'};
        return {type: 'Neutral', reason: 'Neutral tone'};
    }
    
    static calculatePillarScores(scores, activeItems) {
        const pillarScores = {};
        const pillarCounts = {};
        
        activeItems.forEach(item => {
            const score = scores[item.name] || 0;
            if (!pillarScores[item.pillar]) {
                pillarScores[item.pillar] = 0;
                pillarCounts[item.pillar] = 0;
            }
            pillarScores[item.pillar] += score;
            pillarCounts[item.pillar]++;
        });
        
        for (const pillar in pillarScores) {
            pillarScores[pillar] = Math.round(pillarScores[pillar] / pillarCounts[pillar]);
        }
        
        return pillarScores;
    }
    
    static getGrade(score) {
        if (score >= 85) return 'Excellent';
        if (score >= 70) return 'Good';
        if (score >= 50) return 'Fair';
        return 'Poor';
    }
    
    static generateCoachingNotes(issues) {
        if (!issues.length) return 'Excellent performance across all CTQ criteria. Continue best practices.';
        const top3 = issues.slice(0, 3).map(i => i.replace(/\s*\(\d+\)$/, ''));
        return `Focus coaching on: ${top3.join(', ')}. These areas showed scores below 60.`;
    }
}