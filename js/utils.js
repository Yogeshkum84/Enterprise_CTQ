/**
 * YK CTQ Utilities
 * Crypto functions and helpers
 * Developer: Yogesh K | Version: 3.0.0
 */

// Cryptographic Utilities
export const CryptoUtils = {
    async hashPassword(password, salt) {
        // Client-side hashing is only intended for optional local storage scenarios.
        // Production authentication should use server-side bcrypt. This method
        // uses SHA-256(salt + password) as a best-effort local hash and exposes
        // no application-specific pepper to avoid accidental leakage.
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode((salt || '') + (password || ''));
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            console.error('Crypto error:', e);
            throw new Error('Password hashing failed');
        }
    },
    
    generateSalt() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    },
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
};

// Date/Time Utilities
export const DateUtils = {
    formatDate(isoString) {
        if (!isoString) return '—';
        try {
            return new Date(isoString).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return isoString;
        }
    },
    
    formatDateOnly(isoString) {
        if (!isoString) return '—';
        try {
            return new Date(isoString).toLocaleDateString('en-GB');
        } catch {
            return isoString;
        }
    }
};

// Validation Utilities
export const Validators = {
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    
    isValidUsername(username) {
        return /^[a-zA-Z0-9_]{3,20}$/.test(username);
    },
    
    validatePassword(password) {
        if (password.length < 8) return { valid: false, error: 'Minimum 8 characters required' };
        if (!/[A-Z]/.test(password)) return { valid: false, error: 'Must contain uppercase letter' };
        if (!/[a-z]/.test(password)) return { valid: false, error: 'Must contain lowercase letter' };
        if (!/[0-9]/.test(password)) return { valid: false, error: 'Must contain number' };
        return { valid: true };
    }
};

// Storage Utilities
export const Storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error(`Storage get error for ${key}:`, e);
            return defaultValue;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`Storage set error for ${key}:`, e);
            return false;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            return false;
        }
    }
};

// CSV Parsing Utility (for large files)
export const CSVParser = {
    parse(text, hasHeaders = true) {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) return { headers: [], rows: [] };
        
        const parseLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result.map(v => v.replace(/^"|"$/g, ''));
        };
        
        const headers = hasHeaders ? parseLine(lines[0]) : [];
        const rows = (hasHeaders ? lines.slice(1) : lines).map(line => {
            const values = parseLine(line);
            const obj = {};
            headers.forEach((h, i) => {
                obj[h] = values[i] || '';
            });
            return obj;
        }).filter(r => Object.values(r).some(v => v));
        
        return { headers, rows };
    }
};