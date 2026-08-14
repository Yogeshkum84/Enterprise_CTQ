/**
 * YK Configuration Manager
 */

import { AppInfo } from './utils.js';

const STORAGE_KEY = 'yk_ctq_config_v3';

const DEFAULT_CONFIG = {
    version: AppInfo.version,
    developer: AppInfo.developer,
    supportEmail: AppInfo.supportEmail,
    orgName: 'Enterprise IT Services',
    complianceThreshold: 75,
    requireLogin: true,
    maxBatchSize: 1000,
    ctqItems: generateDefaultCTQItems(),
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

function generateDefaultCTQItems() {
    const items = [
        {id: 1, name: "Ticket Categorisation", pillar: "Consistent Quality"},
        {id: 2, name: "Self-Service Identification", pillar: "Productivity"},
        {id: 3, name: "Work Notes Documentation", pillar: "Compliance"},
        {id: 4, name: "Screenshot Attachment", pillar: "Consistent Quality"},
        {id: 5, name: "Relevant Information", pillar: "CSAT/Retention"},
        {id: 6, name: "Ticket Status Change Accuracy", pillar: "Compliance"},
        {id: 7, name: "Correct CI/OS/Product Tier", pillar: "Risk Management"},
        {id: 8, name: "Business Service Mapping", pillar: "Consistent Quality"},
        {id: 9, name: "Category/Sub-Category Accuracy", pillar: "Consistent Quality"},
        {id: 10, name: "Additional Comments / Email Format", pillar: "CSAT/Retention"},
        {id: 11, name: "Email Content Quality", pillar: "CSAT/Retention"},
        {id: 12, name: "Use of Greetings/Signature", pillar: "CSAT/Retention"},
        {id: 13, name: "Email Grammar & Etiquette", pillar: "Training & Coaching"},
        {id: 14, name: "Avoiding Internal IT Info in Comments", pillar: "Compliance"},
        {id: 15, name: "Accurate Field Updates", pillar: "Consistent Quality"},
        {id: 16, name: "Customer Details Accuracy", pillar: "Consistent Quality"},
        {id: 17, name: "Short Description Appropriateness", pillar: "Productivity"},
        {id: 18, name: "Urgency/Impact Selection", pillar: "Risk Management"},
        {id: 19, name: "Detailed Description Quality", pillar: "Consistent Quality"},
        {id: 20, name: "Owner Field Accuracy", pillar: "Compliance"},
        {id: 21, name: "Contact Type Accuracy", pillar: "CSAT/Retention"},
        {id: 22, name: "Ticket Ownership", pillar: "Productivity"},
        {id: 23, name: "User Contact Timeliness", pillar: "CSAT/Retention"},
        {id: 24, name: "Ticket History Check", pillar: "Continuous Improvement"},
        {id: 25, name: "Probing / Issue Identification", pillar: "Continuous Improvement"},
        {id: 26, name: "Irrelevant Questions Avoidance", pillar: "Productivity"},
        {id: 27, name: "KB Reference Usage", pillar: "Continuous Improvement"},
        {id: 28, name: "Troubleshooting Effectiveness", pillar: "Continuous Improvement"},
        {id: 29, name: "Unnecessary Ticket Pending", pillar: "Productivity"},
        {id: 30, name: "Out-of-Business Hours Contact", pillar: "CSAT/Retention"},
        {id: 31, name: "User Education", pillar: "Training & Coaching"},
        {id: 32, name: "Expectation Setting", pillar: "CSAT/Retention"},
        {id: 33, name: "Incorrect KB Reference", pillar: "Risk Management"},
        {id: 34, name: "KB Attachment on Ticket", pillar: "Compliance"},
        {id: 35, name: "Strike Rule Initiation", pillar: "Compliance"},
        {id: 36, name: "Incorrect Strike Initiation", pillar: "Risk Management"},
        {id: 37, name: "Manual Strike Process Adherence", pillar: "Risk Management"},
        {id: 38, name: "Correct On-Hold Reason", pillar: "Compliance"},
        {id: 39, name: "SME Consultation", pillar: "Continuous Improvement"},
        {id: 40, name: "Incorrect Ticket Type/Form", pillar: "Risk Management"},
        {id: 41, name: "Inefficient Resolution", pillar: "Productivity"},
        {id: 42, name: "Lead/SME Stamp Requirement", pillar: "Compliance"}
    ];
    
    // Assign weights: first 40 are 2.38%, last 2 are 2.40%
    return items.map((item, index) => ({
        ...item,
        weight: index < 40 ? 2.38 : 2.40,
        active: true
    }));
}

export class ConfigManager {
    static load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return {...DEFAULT_CONFIG};
            const saved = JSON.parse(raw);
            return {...DEFAULT_CONFIG, ...saved};
        } catch (e) {
            console.error('Config load error:', e);
            return {...DEFAULT_CONFIG};
        }
    }
    
    static save(config) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
    
    static reset() {
        localStorage.removeItem(STORAGE_KEY);
    }
}