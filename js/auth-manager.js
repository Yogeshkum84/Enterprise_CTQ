/**
 * YK CTQ Authentication Manager
 * Handles user authentication, session management, and security
 * Developer: Yogesh K | Version: 3.0.0 | Support: yollook511@gmail.com
 */

import { CryptoUtils, Storage } from './utils.js';

// Storage Keys
const KEYS = {
    USERS: 'yk_ctq_users_v3',
    SESSION: 'yk_ctq_session_v3',
    CONFIG: 'yk_ctq_config_v3'
};

// Default admin credentials
const DEFAULT_ADMIN = {
    username: 'admin',
    displayName: 'System Administrator',
    role: 'admin',
    // No default password in code. To enable a seeded local admin for
    // development, set localStorage `yk_dev_mode` = 'true' and
    // `yk_dev_admin_password` = '<your-password>' in the browser.
};

export class AuthManager {
    constructor() {
        this.currentUser = null;
        this.initialized = false;
    }

    /**
     * Initialize authentication system
     * Creates default admin if no users exist
     */
    async initialize() {
        if (this.initialized) return true;
        
        try {
            const users = this.getUsers();
            
            // Create default admin if no users exist
            const devMode = localStorage.getItem('yk_dev_mode') === 'true';
            const devPassword = localStorage.getItem('yk_dev_admin_password') || '';
            if (users.length === 0 && devMode && devPassword) {
                console.log('Initializing default admin account (local dev)...');
                const salt = CryptoUtils.generateSalt();
                const hash = await CryptoUtils.hashPassword(devPassword, salt);

                users.push({
                    username: DEFAULT_ADMIN.username,
                    displayName: DEFAULT_ADMIN.displayName + ' (local dev)',
                    role: DEFAULT_ADMIN.role,
                    salt: salt,
                    hash: hash,
                    active: true,
                    createdAt: new Date().toISOString(),
                    lastLogin: null,
                    loginCount: 0,
                    passwordChanged: false
                });

                this.saveUsers(users);
                console.log('Default admin created successfully (local dev)');
            } else if (users.length === 0) {
                console.log('No users found; skipping default admin creation (disabled in production)');
            }
            
            // Check for existing session
            const session = Storage.get(KEYS.SESSION);
            if (session) {
                this.currentUser = session;
            }
            
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Auth initialization error:', error);
            throw error;
        }
    }

    /**
     * Authenticate user
     * @param {string} username 
     * @param {string} password 
     * @returns {Object|null} User object if successful, null if failed
     */
    async login(username, password) {
        if (!username || !password) {
            throw new Error('Username and password required');
        }

        try {
            const users = this.getUsers();
            const user = users.find(u => 
                u.username.toLowerCase() === username.toLowerCase() && 
                u.active === true
            );

            if (!user) {
                console.warn(`Login failed: User ${username} not found or inactive`);
                return null;
            }

            // Verify password
            const hash = await CryptoUtils.hashPassword(password, user.salt);
            
            if (hash !== user.hash) {
                console.warn(`Login failed: Invalid password for ${username}`);
                return null;
            }

            // Update user stats
            user.lastLogin = new Date().toISOString();
            user.loginCount = (user.loginCount || 0) + 1;
            this.saveUsers(users);

            // Create session
            const session = {
                username: user.username,
                displayName: user.displayName,
                role: user.role,
                loginTime: new Date().toISOString()
            };

            Storage.set(KEYS.SESSION, session);
            this.currentUser = session;

            console.log(`User ${user.displayName} logged in successfully`);
            return session;

        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    /**
     * Verify credentials without creating session
     * @param {string} username 
     * @param {string} password 
     */
    async verify(username, password) {
        if (!username || !password) return null;
        
        try {
            const users = this.getUsers();
            const user = users.find(u => 
                u.username.toLowerCase() === username.toLowerCase() && 
                u.active === true
            );

            if (!user) return null;

            const hash = await CryptoUtils.hashPassword(password, user.salt);
            if (hash !== user.hash) return null;

            return {
                username: user.username,
                displayName: user.displayName,
                role: user.role
            };
        } catch (error) {
            console.error('Verify error:', error);
            return null;
        }
    }

    /**
     * Logout current user
     */
    logout() {
        Storage.remove(KEYS.SESSION);
        this.currentUser = null;
        console.log('User logged out');
    }

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return !!this.currentUser;
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Check if current user is admin
     */
    isAdmin() {
        return this.currentUser?.role === 'admin';
    }

    /**
     * Add new user (Admin only)
     */
    async addUser(username, displayName, role, password) {
        if (!username || !displayName || !role || !password) {
            throw new Error('All fields required');
        }

        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }

        const users = this.getUsers();
        
        if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
            throw new Error('Username already exists');
        }

        const salt = CryptoUtils.generateSalt();
        const hash = await CryptoUtils.hashPassword(password, salt);

        users.push({
            username: username.toLowerCase(),
            displayName,
            role,
            salt,
            hash,
            active: true,
            createdAt: new Date().toISOString(),
            lastLogin: null,
            loginCount: 0
        });

        this.saveUsers(users);
        console.log(`User ${username} created successfully`);
        return true;
    }

    /**
     * Change user password
     */
    async changePassword(username, newPassword) {
        if (!newPassword || newPassword.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }

        const users = this.getUsers();
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

        if (!user) {
            throw new Error('User not found');
        }

        user.salt = CryptoUtils.generateSalt();
        user.hash = await CryptoUtils.hashPassword(newPassword, user.salt);
        user.passwordChanged = true;
        
        this.saveUsers(users);
        console.log(`Password changed for ${username}`);
        return true;
    }

    /**
     * Toggle user active status
     */
    setUserActive(username, active) {
        const users = this.getUsers();
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

        if (!user) throw new Error('User not found');
        
        // Prevent deactivating yourself
        if (user.username === this.currentUser?.username && !active) {
            throw new Error('Cannot deactivate your own account');
        }

        user.active = active;
        this.saveUsers(users);
        return true;
    }

    /**
     * Delete user permanently
     */
    deleteUser(username) {
        if (username === this.currentUser?.username) {
            throw new Error('Cannot delete your own account');
        }

        const users = this.getUsers();
        const filtered = users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
        
        if (filtered.length === users.length) {
            throw new Error('User not found');
        }

        Storage.set(KEYS.USERS, filtered);
        console.log(`User ${username} deleted`);
        return true;
    }

    /**
     * Get all users (for admin panel)
     */
    getUsers() {
        return Storage.get(KEYS.USERS, []);
    }

    /**
     * Save users array
     */
    saveUsers(users) {
        Storage.set(KEYS.USERS, users);
    }

    /**
     * Get user by username
     */
    getUser(username) {
        return this.getUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
    }

    /**
     * Update user role
     */
    updateRole(username, newRole) {
        const users = this.getUsers();
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (!user) throw new Error('User not found');
        
        user.role = newRole;
        this.saveUsers(users);
        return true;
    }
}

// Create singleton instance
export const authManager = new AuthManager();