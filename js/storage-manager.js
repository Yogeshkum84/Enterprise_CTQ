/**
 * YK Storage Manager
 * Handles Results and Execution Logs
 */

import { AppInfo } from './utils.js';

const RESULTS_KEY = 'yk_ctq_results_v3';
const LOGS_KEY = 'yk_ctq_logs_v3';
const SESSION_KEY = 'yk_ctq_session_v3';

export class ResultsStore {
    static load() {
        try {
            return JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]');
        } catch {
            return [];
        }
    }
    
    static save(results) {
        localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
    }
    
    static add(newResults) {
        const existing = this.load();
        const combined = [...newResults, ...existing];
        this.save(combined);
        return combined;
    }
    
    static clear() {
        localStorage.removeItem(RESULTS_KEY);
    }
}

export class Logger {
    static write(action, detail, level = 'info', username = null) {
        const logs = this.load();
        const session = sessionStorage.getItem(SESSION_KEY);
        const currentUser = session ? JSON.parse(session) : null;
        
        const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            user: username || (currentUser ? currentUser.username : 'system'),
            displayName: currentUser ? currentUser.displayName : 'System',
            action,
            detail,
            level
        };
        
        logs.unshift(entry);
        if (logs.length > 2000) logs.length = 2000; // Keep last 2000
        localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
        return entry;
    }
    
    static load() {
        try {
            return JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
        } catch {
            return [];
        }
    }
    
    static exportCSV() {
        const logs = this.load();
        const headers = ['Timestamp', 'User', 'DisplayName', 'Action', 'Detail', 'Level'];
        const rows = logs.map(l => [
            l.timestamp,
            l.user,
            l.displayName,
            l.action,
            `"${(l.detail || '').replace(/"/g, '""')}"`,
            l.level
        ]);
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
    
    static clear() {
        localStorage.setItem(LOGS_KEY, JSON.stringify([]));
    }
}

export class SessionManager {
    static get() {
        try {
            return JSON.parse(sessionStorage.getItem(SESSION_KEY));
        } catch {
            return null;
        }
    }
    
    static set(user) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }
    
    static clear() {
        sessionStorage.removeItem(SESSION_KEY);
    }
}