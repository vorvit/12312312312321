// IFC Auth Service - Main JavaScript

// Global app state
const AppState = {
    user: null,
    token: null,
    isAuthenticated: false
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Check for OAuth token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const oauthToken = urlParams.get('token');
    if (oauthToken) {
        // Store OAuth token and redirect to dashboard
        localStorage.setItem('access_token', oauthToken);
        AppState.token = oauthToken;
        AppState.isAuthenticated = true;
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Validate token and get user info
        validateToken();
        return;
    }
    
    // Check for stored token
    const token = localStorage.getItem('access_token');
    if (token) {
        AppState.token = token;
        AppState.isAuthenticated = true;
        validateToken();
    }
    
    // Update UI based on auth state
    updateAuthUI();
    
    // Setup global error handling
    setupErrorHandling();
    
    // Setup form validation
    setupFormValidation();
}

// Token validation
async function validateToken() {
    try {
        const response = await fetch('/auth/me', {
            headers: {
                'Authorization': `Bearer ${AppState.token}`
            }
        });
        
        if (response.ok) {
            AppState.user = await response.json();
            updateAuthUI();
        } else {
            logout();
        }
    } catch (error) {
        console.error('Token validation failed:', error);
        logout();
    }
}

// Update UI based on authentication state
function updateAuthUI() {
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const adminSection = document.getElementById('adminSection');
    const loginButton = document.getElementById('loginButton');
    const registerButton = document.getElementById('registerButton');
    const logoutButton = document.getElementById('logoutButton');
    
    if (AppState.isAuthenticated && AppState.user) {
        // Show user info and logout button
        if (userInfo) userInfo.style.display = 'block';
        if (userName) userName.textContent = AppState.user.username;
        if (loginButton) loginButton.style.display = 'none';
        if (registerButton) registerButton.style.display = 'none';
        if (logoutButton) logoutButton.style.display = 'none';
        
        // Show admin section if user is admin
        if (adminSection) {
            if (AppState.user.is_admin) {
                adminSection.style.display = 'block';
            } else {
                adminSection.style.display = 'none';
            }
        }
    } else {
        // Show login and register buttons
        if (userInfo) userInfo.style.display = 'none';
        if (loginButton) loginButton.style.display = 'block';
        if (registerButton) registerButton.style.display = 'block';
        if (logoutButton) logoutButton.style.display = 'none';
        if (adminSection) adminSection.style.display = 'none';
    }
}

// Authentication helpers
function login(token, user) {
    localStorage.setItem('access_token', token);
    AppState.token = token;
    AppState.user = user;
    AppState.isAuthenticated = true;
    updateAuthUI();
}

function logout() {
    localStorage.removeItem('access_token');
    AppState.token = null;
    AppState.user = null;
    AppState.isAuthenticated = false;
    updateAuthUI();
    window.location.href = '/login';
}

// API helpers
async function apiRequest(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const isUnsafe = method !== 'GET';
    const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1];

    const isFormData = options.body instanceof FormData;

    const headers = {
        ...(AppState.token && { 'Authorization': `Bearer ${AppState.token}` }),
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(isUnsafe && csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
    };

    const mergedOptions = {
        method,
        ...options,
        headers: {
            ...headers,
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, mergedOptions);
        
        if (response.status === 401) {
            logout();
            return null;
        }
        
        return response;
    } catch (error) {
        console.error('API request failed:', error);
        showNotification('Network error. Please check your connection.', 'danger');
        return null;
    }
}

// Notification system
function showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    notification.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-dismiss
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
    }
}

// Form validation
function setupFormValidation() {
    const forms = document.querySelectorAll('form[data-validate]');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!validateForm(this)) {
                e.preventDefault();
            }
        });
    });
}

function validateForm(form) {
    const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            showFieldError(input, 'This field is required');
            isValid = false;
        } else {
            clearFieldError(input);
        }
    });
    
    // Email validation
    const emailInputs = form.querySelectorAll('input[type="email"]');
    emailInputs.forEach(input => {
        if (input.value && !isValidEmail(input.value)) {
            showFieldError(input, 'Please enter a valid email address');
            isValid = false;
        }
    });
    
    // Password validation
    const passwordInputs = form.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(input => {
        if (input.value && input.value.length < 8) {
            showFieldError(input, 'Password must be at least 8 characters long');
            isValid = false;
        }
    });
    
    return isValid;
}

function showFieldError(input, message) {
    clearFieldError(input);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'invalid-feedback';
    errorDiv.textContent = message;
    
    input.classList.add('is-invalid');
    input.parentNode.appendChild(errorDiv);
}

function clearFieldError(input) {
    input.classList.remove('is-invalid');
    const errorDiv = input.parentNode.querySelector('.invalid-feedback');
    if (errorDiv) {
        errorDiv.remove();
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Error handling
function setupErrorHandling() {
    window.addEventListener('error', function(e) {
        console.error('Global error:', e.error);
        showNotification('An unexpected error occurred', 'danger');
    });
    
    window.addEventListener('unhandledrejection', function(e) {
        console.error('Unhandled promise rejection:', e.reason);
        showNotification('An unexpected error occurred', 'danger');
    });
}

// Utility functions
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// File upload helpers
function setupFileUpload(uploadArea, callback) {
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && callback) {
            callback(files);
        }
    });
    
    uploadArea.addEventListener('click', function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.addEventListener('change', function() {
            if (this.files.length > 0 && callback) {
                callback(this.files);
            }
        });
        input.click();
    });
}

// Password visibility toggle
function setupPasswordToggle(toggleId, inputId, iconId) {
    const toggleButton = document.getElementById(toggleId);
    if (!toggleButton) return;
    
    toggleButton.addEventListener('click', function() {
        const passwordInput = document.getElementById(inputId);
        const toggleIcon = document.getElementById(iconId);
        
        if (!passwordInput || !toggleIcon) return;
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleIcon.classList.remove('fa-eye');
            toggleIcon.classList.add('fa-eye-slash');
            this.title = 'Hide Password';
        } else {
            passwordInput.type = 'password';
            toggleIcon.classList.remove('fa-eye-slash');
            toggleIcon.classList.add('fa-eye');
            this.title = 'Show Password';
        }
    });
}

// Auto-setup password toggles on page load
document.addEventListener('DOMContentLoaded', function() {
    // Setup password toggles if they exist
    if (document.getElementById('togglePassword')) {
        setupPasswordToggle('togglePassword', 'password', 'togglePasswordIcon');
    }
    if (document.getElementById('toggleConfirmPassword')) {
        setupPasswordToggle('toggleConfirmPassword', 'confirm_password', 'toggleConfirmPasswordIcon');
    }
});

// Export for global use
window.AppState = AppState;
window.apiRequest = apiRequest;
window.showNotification = showNotification;
window.formatBytes = formatBytes;
window.formatDate = formatDate;
window.setupFileUpload = setupFileUpload;
window.setupPasswordToggle = setupPasswordToggle;
// Theme management removed - using light theme only

window.login = login;
window.logout = logout;
window.updateAuthUI = updateAuthUI;
