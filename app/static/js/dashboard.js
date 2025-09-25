// Update current time
function updateTime() {
    const now = new Date();
    const el = document.getElementById('currentTime');
    if (el) el.textContent = now.toLocaleString();
}
setInterval(updateTime, 1000);
updateTime();

// Load user data
async function loadUserData() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    try {
        const response = await apiRequest('/users/me');
        if (response && response.ok) {
            const user = await response.json();
            updateDashboard(user);
            ensurePreloadIframe();
            setPreloadBadge('preloading');
            // Load files manifest from API once and store
            try {
                const filesResp = await apiRequest('/api/files');
                if (filesResp && filesResp.ok) {
                    const body = await filesResp.json();
                    const files = body.data || body || [];
                    const manifest = files.map(f => ({ name: f.name || f.filename, size: f.size || f.file_size, etag: f.etag || null, updatedAt: f.last_modified || null }));
                    localStorage.setItem('files_manifest', JSON.stringify(manifest));
                }
            } catch {}
            // Send token and manifest to viewer and trigger explicit preload
            sendHandshakeToViewer();
            sendPreloadAllToViewer();
        } else {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Dashboard: Error loading user data:', error);
        localStorage.removeItem('access_token');
        window.location.href = '/login';
    }
}

function updateDashboard(user) {
    const usedMB = Math.round(user.used_storage / (1024 * 1024));
    const quotaGB = Math.round(user.storage_quota / (1024 * 1024 * 1024));
    const usedPercent = Math.round((user.used_storage / user.storage_quota) * 100);

    const storageUsed = document.getElementById('storageUsed');
    const storageQuota = document.getElementById('storageQuota');
    const usedStorage = document.getElementById('usedStorage');
    const availableStorage = document.getElementById('availableStorage');
    if (storageUsed) storageUsed.textContent = `${usedMB} MB`;
    if (storageQuota) storageQuota.textContent = `${quotaGB} GB`;
    if (usedStorage) usedStorage.textContent = `${usedMB} MB`;
    if (availableStorage) availableStorage.textContent = `${quotaGB - Math.round(usedMB / 1024)} GB`;

    const progressBar = document.getElementById('storageProgress');
    if (progressBar) {
        progressBar.style.width = `${usedPercent}%`;
        progressBar.setAttribute('aria-valuenow', usedPercent);
    }

    const lastLogin = document.getElementById('lastLogin');
    if (lastLogin) {
        if (user.last_login) {
            const loginDate = new Date(user.last_login);
            lastLogin.textContent = loginDate.toLocaleString();
        } else {
            lastLogin.textContent = 'Today ' + new Date().toLocaleTimeString();
        }
    }

    const username = document.getElementById('username');
    if (username) username.textContent = user.username || user.email;

    const userEmail = document.getElementById('userEmail');
    if (userEmail) userEmail.textContent = user.email;
}

// Show login history
function showLoginHistory() {
    const modal = new bootstrap.Modal(document.getElementById('loginHistoryModal'));
    modal.show();
    loadLoginHistory();
}

async function loadLoginHistory() {
    try {
        const response = await apiRequest('/users/login-history');
        if (response && response.ok) {
            const data = await response.json();
            displayLoginHistory(data);
        } else {
            console.error('Failed to load login history:', response.status);
        }
    } catch (error) {
        console.error('Error loading login history:', error);
    }
}

function displayLoginHistory(data) {
    const container = document.getElementById('loginHistoryList');
    if (!container) {
        console.error('Login history container not found');
        return;
    }
    
    // Handle both array and object responses
    const historyData = Array.isArray(data) ? data : (data.login_history || data.data || []);
    
    if (historyData.length === 0) {
        container.innerHTML = '<div class="text-muted">No login history available</div>';
        return;
    }

    let html = '';
    historyData.forEach(entry => {
        const date = new Date(entry.timestamp);
        html += `
            <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                <div>
                    <div class="fw-bold">${entry.ip_address || 'Unknown'}</div>
                    <small class="text-muted">${entry.user_agent || 'Unknown'}</small>
                </div>
                <small class="text-muted">${date.toLocaleString()}</small>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Show storage details
function showStorageDetails() {
    const modal = new bootstrap.Modal(document.getElementById('storageDetailsModal'));
    modal.show();
}

// Show recent activity
function showRecentActivity() {
    const modal = new bootstrap.Modal(document.getElementById('recentActivityModal'));
    modal.show();
    loadRecentActivity();
}

async function loadRecentActivity() {
    try {
        // Пока эндпоинт не реализован, показываем заглушку
        const container = document.getElementById('recentActivityList');
        if (container) {
            container.innerHTML = '<div class="text-muted">Activity tracking not implemented yet</div>';
        }
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

function displayRecentActivity(data) {
    const container = document.getElementById('recentActivityList');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = '<div class="text-muted">No recent activity</div>';
        return;
    }

    let html = '';
    data.forEach(activity => {
        const date = new Date(activity.timestamp);
        html += `
            <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                <div>
                    <div class="fw-bold">${activity.action}</div>
                    <small class="text-muted">${activity.details}</small>
                </div>
                <small class="text-muted">${date.toLocaleString()}</small>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Load recent activity for card display
async function loadRecentActivityForCard() {
    try {
        // Пока эндпоинт не реализован, показываем заглушку
        const container = document.getElementById('recentActivityCard');
        if (container) {
            container.innerHTML = '<div class="text-muted">No recent activity</div>';
        }
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

function displayRecentActivityForCard(data) {
    const container = document.getElementById('recentActivityCard');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = '<div class="text-muted">No recent activity</div>';
        return;
    }

    let html = '';
    const recentActivities = data.slice(0, 3); // Show only last 3 activities
    recentActivities.forEach(activity => {
        const date = new Date(activity.timestamp);
        html += `
            <div class="d-flex justify-content-between align-items-center py-1">
                <div>
                    <div class="fw-bold small">${activity.action}</div>
                    <small class="text-muted">${activity.details}</small>
                </div>
                <small class="text-muted">${date.toLocaleDateString()}</small>
            </div>
        `;
    });
    container.innerHTML = html;
}



// File management functions
async function loadUserFiles() {
    try {
        const response = await apiRequest('/api/files');
        if (response && response.ok) {
            const body = await response.json();
            displayUserFiles(body.data || body);
        }
    } catch (error) {
        console.error('Error loading user files:', error);
    }
}

function displayUserFiles(files) {
    const container = document.getElementById('userFilesList');
    if (!container) return;
    
    const fileCount = document.getElementById('fileCount');
    if (fileCount) fileCount.textContent = files.length;
    
    if (files.length === 0) {
        container.innerHTML = '<div class="text-muted">No files uploaded yet</div>';
        return;
    }
    
    let html = '';
    files.forEach(file => {
        const size = formatFileSize(file.size);
        const date = new Date(file.last_modified).toLocaleDateString();
        html += `
            <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
                <div>
                    <div class="fw-bold">${file.name}</div>
                    <small class="text-muted">${size} • ${date}</small>
                </div>
                <div class="btn-group">
                    <button class="btn btn-sm btn-outline-primary" onclick="downloadFile('${file.name}')" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info" onclick="viewFile('${file.name}')" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteFile('${file.name}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function viewFiles() {
    const modal = new bootstrap.Modal(document.getElementById('filesModal'));
    modal.show();
    loadUserFiles();
}

function openMyFiles() { viewFiles(); }

function openUploadModal() {
    // Close view files modal if open
    const viewModal = bootstrap.Modal.getInstance(document.getElementById('filesModal'));
    if (viewModal) viewModal.hide();
    
    // Open upload modal
    const uploadModal = new bootstrap.Modal(document.getElementById('uploadModal'));
    uploadModal.show();
}

async function deleteFile(filename) {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
    try {
        const response = await apiRequest(`/files/delete/${filename}`, { method: 'DELETE' });
        if (response && response.ok) {
            showAlert(`${filename} deleted successfully`, 'success');
            loadUserFiles();
            loadUserData();
        } else {
            showAlert(`Failed to delete ${filename}`, 'danger');
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        showAlert(`Failed to delete ${filename}: ${error.message}`, 'danger');
    }
}

async function downloadFile(filename) {
    try {
        const response = await apiRequest(`/files/download/${filename}`);
        if (response && response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            showAlert(`Failed to download ${filename}`, 'danger');
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        showAlert(`Failed to download ${filename}: ${error.message}`, 'danger');
    }
}

function viewFile(filename) {
    // Open server viewer route with file param; it will forward to TSP with token & file
    try {
        const filesModal = bootstrap.Modal.getInstance(document.getElementById('filesModal'));
        if (filesModal) filesModal.hide();
    } catch {}
    window.location.href = `/ifc-viewer?file=${encodeURIComponent(filename)}`;
}

function refreshFiles() {
    loadUserFiles();
    loadUserData();
}

// IFC Viewer function
function openIFCViewer() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        alert('Please login first');
        return;
    }
    // Same-window navigation to viewer (reuse caches from hidden iframe preload)
    const url = `${VIEWER_ORIGIN}?token=${encodeURIComponent(token)}`;
    window.location.href = url;
}

// Profile management
async function editProfile() {
    const modal = new bootstrap.Modal(document.getElementById('editProfileModal'));
    modal.show();
}

async function saveProfile() {
    const username = document.getElementById('editUsername').value;
    const email = document.getElementById('editEmail').value;
    const fullName = document.getElementById('editFullName').value;
    
    try {
        const response = await apiRequest('/users/me', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                email: email,
                full_name: fullName
            })
        });
        
        if (response && response.ok) {
            showAlert('Profile updated successfully', 'success');
            loadUserData();
            const modal = bootstrap.Modal.getInstance(document.getElementById('editProfileModal'));
            if (modal) modal.hide();
        } else {
            showAlert('Failed to update profile', 'danger');
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showAlert(`Failed to update profile: ${error.message}`, 'danger');
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


// Utility functions
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    let container = document.querySelector('.container-fluid') || document.querySelector('.container') || document.body;
    if (container === document.body) { container.appendChild(alertDiv); }
    else { container.insertBefore(alertDiv, container.firstChild); }
    setTimeout(() => { if (alertDiv.parentNode) alertDiv.remove(); }, 5000);
}

// File upload functionality
let selectedFiles = [];

function setupFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const fileUploadArea = document.getElementById('fileUploadArea');
    const uploadBtn = document.getElementById('uploadBtn');
    const selectedFilesDiv = document.getElementById('selectedFiles');
    const filesList = document.getElementById('filesList');
    const uploadProgress = document.getElementById('uploadProgress');
    const uploadStatus = document.getElementById('uploadStatus');

    // Click to browse files
    fileUploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    // Drag and drop functionality
    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.classList.add('dragover');
    });

    fileUploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove('dragover');
    });

    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        handleFileSelection(files);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        handleFileSelection(files);
    });

    // Upload button click
    uploadBtn.addEventListener('click', uploadFiles);

    function handleFileSelection(files) {
        // Filter IFC files
        const ifcFiles = files.filter(file => {
            const ext = file.name.toLowerCase().split('.').pop();
            return ['ifc', 'ifcxml', 'ifczip'].includes(ext);
        });

        if (ifcFiles.length === 0) {
            showAlert('Please select IFC files (.ifc, .ifcxml, .ifczip)', 'warning');
            return;
        }

        selectedFiles = ifcFiles;
        displaySelectedFiles();
        uploadBtn.disabled = false;
    }

    function displaySelectedFiles() {
        filesList.innerHTML = '';
        selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'd-flex justify-content-between align-items-center p-2 border rounded mb-2';
            fileItem.innerHTML = `
                <div>
                    <i class="fas fa-file me-2"></i>
                    <span>${file.name}</span>
                    <small class="text-muted ms-2">(${(file.size / 1024).toFixed(1)} KB)</small>
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeFile(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            filesList.appendChild(fileItem);
        });
        selectedFilesDiv.style.display = 'block';
    }

    async function uploadFiles() {
        if (selectedFiles.length === 0) return;

        uploadBtn.disabled = true;
        uploadProgress.style.display = 'block';
        uploadStatus.textContent = 'Uploading files...';

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const progress = ((i + 1) / selectedFiles.length) * 100;
            
            uploadStatus.textContent = `Uploading ${file.name}... (${i + 1}/${selectedFiles.length})`;
            document.querySelector('.progress-bar').style.width = `${progress}%`;

            try {
                const formData = new FormData();
                formData.append('file', file);

                // Get CSRF token from cookies
                const csrfToken = document.cookie
                    .split('; ')
                    .find(row => row.startsWith('csrf_token='))
                    ?.split('=')[1];

                const headers = {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                };

                if (csrfToken) {
                    headers['X-CSRF-Token'] = csrfToken;
                }

                const response = await fetch('/files/upload', {
                    method: 'POST',
                    body: formData,
                    headers: headers
                });

                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                    console.error(`Failed to upload ${file.name}`);
                }
            } catch (error) {
                errorCount++;
                console.error(`Error uploading ${file.name}:`, error);
            }
        }

        // Reset UI
        uploadProgress.style.display = 'none';
        selectedFilesDiv.style.display = 'none';
        selectedFiles = [];
        uploadBtn.disabled = true;
        fileInput.value = '';

        // Show results
        if (successCount > 0) {
            showAlert(`${successCount} file(s) uploaded successfully`, 'success');
            loadUserFiles();
            loadUserData();
        }
        if (errorCount > 0) {
            showAlert(`${errorCount} file(s) failed to upload`, 'danger');
        }

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('uploadModal'));
        if (modal) modal.hide();
    }
}

// Remove file from selection
function removeFile(index) {
    selectedFiles.splice(index, 1);
    if (selectedFiles.length === 0) {
        document.getElementById('selectedFiles').style.display = 'none';
        document.getElementById('uploadBtn').disabled = true;
    } else {
        setupFileUpload(); // Re-setup to refresh display
    }
}

// Reusable IFC Viewer window management
let viewerWindow = null;
const VIEWER_ORIGIN = 'http://localhost:5174';
const VIEWER_NAME = 'ifc-viewer';

// Hidden iframe for background preload (same-window navigation model)
function ensurePreloadIframe() {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    let iframe = document.getElementById('viewerPreloadIframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'viewerPreloadIframe';
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
    }
    const preloadUrl = `${VIEWER_ORIGIN}`; // no token, no query
    if (iframe.src !== preloadUrl) {
        iframe.src = preloadUrl;
        iframe.onload = () => {
            // After viewer ready, send handshake and explicit preload
            setTimeout(() => {
                sendHandshakeToViewer();
                sendPreloadAllToViewer();
            }, 200);
        };
    } else {
        // If already loaded, just handshake and preload
        sendHandshakeToViewer();
        sendPreloadAllToViewer();
    }
}

function sendPreloadAllToViewer() {
    // Avoid sending before iframe is ready; rely on onload hook
    const iframe = document.getElementById('viewerPreloadIframe');
    if (!viewerWindow && !(iframe && iframe.contentWindow)) return;
    sendToViewer({ type: 'preloadAll' });
}

function setPreloadBadge(state) {
    const badge = document.getElementById('viewerPreloadStatusBadge');
    if (!badge) return;
    if (state === 'preloading') {
        badge.textContent = 'Preloading';
        badge.className = 'badge rounded-pill bg-warning ms-2';
    } else if (state === 'ready') {
        badge.textContent = 'Ready';
        badge.className = 'badge rounded-pill bg-success ms-2';
    } else {
        badge.textContent = 'Idle';
        badge.className = 'badge rounded-pill bg-secondary ms-2';
    }
}

window.addEventListener('message', (event) => {
    if (event.origin !== VIEWER_ORIGIN) return;
    const msg = event.data || {};
    if (msg.type === 'preload-status') {
        setPreloadBadge(msg.state);
        if (typeof msg.progress === 'number') {
            // Optionally, later show a progress bar; for now, update title
            const badge = document.getElementById('viewerPreloadStatusBadge');
            if (badge) badge.title = `Preload: ${msg.progress}%`;
        }
    }
});

// When ensuring viewer, ping for current status
function ensureViewerWindow({ focus = false } = {}) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        console.warn('No token available to open viewer');
        return null;
    }
    const url = `${VIEWER_ORIGIN}?token=${encodeURIComponent(token)}&preload=1`;

    if (viewerWindow && !viewerWindow.closed) {
        if (focus) {
            try { viewerWindow.focus(); } catch (e) { /* ignore */ }
        } else {
            try { viewerWindow.blur(); window.focus(); } catch (e) { /* ignore */ }
        }
        // ask for status
        try { viewerWindow.postMessage({ type: 'preload-status-request' }, VIEWER_ORIGIN); } catch (e) {}
        return viewerWindow;
    }

    viewerWindow = window.open(url, VIEWER_NAME);
    if (!viewerWindow) {
        console.warn('Viewer window blocked by popup blocker');
        return null;
    }
    if (!focus) {
        try { viewerWindow.blur(); window.focus(); } catch (e) { /* ignore */ }
    }
    // ask for status
    try { viewerWindow.postMessage({ type: 'preload-status-request' }, VIEWER_ORIGIN); } catch (e) {}
    return viewerWindow;
}

function sendToViewer(message) {
    const origin = '*';
    if (viewerWindow && !viewerWindow.closed) {
        try { viewerWindow.postMessage(message, origin); } catch (e) { console.error('postMessage to viewerWindow failed', e); }
    }
    const iframe = document.getElementById('viewerPreloadIframe');
    if (iframe && iframe.contentWindow) {
        try { iframe.contentWindow.postMessage(message, origin); } catch (e) { console.error('postMessage to iframe failed', e); }
    }
}

function sendHandshakeToViewer() {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const iframe = document.getElementById('viewerPreloadIframe');
    // Avoid sending before iframe is ready; rely on onload hook
    if (!viewerWindow && !(iframe && iframe.contentWindow)) return;

    const msgToken = { type: 'token', value: token };
    const manifest = JSON.parse(localStorage.getItem('files_manifest') || '[]');
    const msgManifest = { type: 'manifest', value: manifest };

    sendToViewer(msgToken);
    sendToViewer(msgManifest);
}

// React on token refresh notifications from app.js
window.addEventListener('token-updated', (e) => {
    try {
        sendHandshakeToViewer();
    } catch {}
});

// Load data on page load
document.addEventListener('DOMContentLoaded', function() {
    loadUserData();
    loadUserFiles();
    setupFileUpload();
});

// Set initial badge state on load
setPreloadBadge('Idle');

// Make functions globally available
window.viewFiles = viewFiles;
window.openMyFiles = openMyFiles;
window.showLoginHistory = showLoginHistory;
window.showStorageDetails = showStorageDetails;
window.showRecentActivity = showRecentActivity;
window.openIFCViewer = openIFCViewer;
window.editProfile = editProfile;
window.saveProfile = saveProfile;
window.deleteFile = deleteFile;
window.downloadFile = downloadFile;
window.viewFile = viewFile;
window.refreshFiles = refreshFiles;
window.removeFile = removeFile;
