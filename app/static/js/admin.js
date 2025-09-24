// Admin page scripts extracted from template

let currentPage = 1;
let pageSize = 10;
let allUsers = [];

async function loadAdminData() {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }
    try {
        const userResponse = await apiRequest('/auth/me');
        if (!userResponse || !userResponse.ok) {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
            return;
        }
        const user = await userResponse.json();
        if (!user.is_admin) {
            window.location.href = '/dashboard';
            return;
        }
        const statsResponse = await apiRequest('/admin/stats');
        if (statsResponse && statsResponse.ok) {
            const body = await statsResponse.json();
            const stats = body && body.data ? body.data : body;
            updateStats(stats);
        }
        await loadUsers();
    } catch (error) {
        console.error('Admin: Error loading admin data:', error);
        showNotification('Error loading admin data', 'danger');
    }
}

function updateStats(stats) {
    document.getElementById('totalUsers').textContent = stats.total_users;
    document.getElementById('activeUsers').textContent = stats.active_users;
    document.getElementById('adminUsers').textContent = stats.admin_users;
    document.getElementById('totalStorage').textContent = formatBytes(stats.total_storage_used);
}

async function loadUsers() {
    try {
        const response = await apiRequest(`/api/admin/users?page=${currentPage}&size=${pageSize}`);
        if (response && response.ok) {
            const body = await response.json();
            const data = body && body.data ? body.data : body;
            allUsers = data.users || data;
            displayUsers(allUsers);
            if (data.total !== undefined) {
                updatePagination(data.total, data.page, data.size);
            }
        } else {
            const errorText = response ? await response.text() : 'Network error';
            console.log('Admin: Users error:', errorText);
            showNotification('Error loading users', 'danger');
        }
    } catch (error) {
        console.error('Admin: Error loading users:', error);
        showNotification('Error loading users', 'danger');
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-muted">
                    <i class="fas fa-inbox fa-2x mb-2"></i>
                    <p>No users found</p>
                </td>
            </tr>
        `;
        return;
    }
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td><strong>${user.username}</strong></td>
            <td>${user.email}</td>
            <td>${user.full_name || '-'}</td>
            <td><span class="badge ${user.is_active ? 'bg-success' : 'bg-danger'}">${user.is_active ? 'Active' : 'Inactive'}</span></td>
            <td><span class="badge ${user.is_admin ? 'bg-warning' : 'bg-info'}">${user.is_admin ? 'Admin' : 'User'}</span></td>
            <td><small>${formatBytes(user.used_storage)} / ${formatBytes(user.storage_quota)}</small></td>
            <td><small>${new Date(user.created_at).toLocaleDateString()}</small></td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary" onclick="editUser(${user.id})" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-outline-${user.is_active ? 'warning' : 'success'}" onclick="toggleUserStatus(${user.id}, ${user.is_active})" title="${user.is_active ? 'Deactivate' : 'Activate'}"><i class="fas fa-${user.is_active ? 'ban' : 'check'}"></i></button>
                    <button class="btn btn-outline-danger" onclick="deleteUser(${user.id})" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    const searchTerm = document.getElementById('searchUsers').value;
    const statusFilter = document.getElementById('filterStatus').value;
    const roleFilter = document.getElementById('filterRole').value;
    updateFilterInfo(users.length, searchTerm, statusFilter, roleFilter);
}

function updatePagination(total, page, size) {
    const totalPages = Math.ceil(total / size);
    const pagination = document.getElementById('usersPagination');
    let paginationHTML = '';
    paginationHTML += `
        <li class="page-item ${page === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${page - 1})">Previous</a>
        </li>
    `;
    for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
        paginationHTML += `
            <li class="page-item ${i === page ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
            </li>
        `;
    }
    paginationHTML += `
        <li class="page-item ${page === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${page + 1})">Next</a>
        </li>
    `;
    pagination.innerHTML = paginationHTML;
}

function changePage(page) { if (page < 1) return; currentPage = page; loadUsers(); }

document.getElementById('searchUsers').addEventListener('input', function() { applyFilters(); });
document.getElementById('filterStatus').addEventListener('change', function() { applyFilters(); });
document.getElementById('filterRole').addEventListener('change', function() { applyFilters(); });

function applyFilters() {
    const searchTerm = document.getElementById('searchUsers').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    const roleFilter = document.getElementById('filterRole').value;
    const filteredUsers = allUsers.filter(user => {
        const matchesSearch = user.username.toLowerCase().includes(searchTerm) ||
                              user.email.toLowerCase().includes(searchTerm) ||
                              (user.full_name && user.full_name.toLowerCase().includes(searchTerm));
        const matchesStatus = !statusFilter || (statusFilter === 'active' && user.is_active) || (statusFilter === 'inactive' && !user.is_active);
        const matchesRole = !roleFilter || (roleFilter === 'admin' && user.is_admin) || (roleFilter === 'user' && !user.is_admin);
        return matchesSearch && matchesStatus && matchesRole;
    });
    displayUsers(filteredUsers);
    updateFilterInfo(filteredUsers.length, searchTerm, statusFilter, roleFilter);
}

function updateFilterInfo(count, search, status, role) {
    document.getElementById('usersCount').textContent = `${count} users`;
    const filterParts = [];
    if (search) filterParts.push(`Search: "${search}"`);
    if (status) filterParts.push(`Status: ${status}`);
    if (role) filterParts.push(`Role: ${role}`);
    const filterInfo = filterParts.length > 0 ? `Filtered by: ${filterParts.join(', ')}` : 'All users';
    document.getElementById('filterInfo').textContent = filterInfo;
}

function clearFilters() {
    document.getElementById('searchUsers').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterRole').value = '';
    applyFilters();
    showNotification('Filters cleared', 'info');
}

function refreshUsers() { loadUsers(); showNotification('Users list refreshed', 'success'); }

async function exportUsers() {
    const exportBtn = document.querySelector('button[onclick="exportUsers()"]');
    const originalText = exportBtn.innerHTML;
    try {
        const searchTerm = document.getElementById('searchUsers').value;
        const statusFilter = document.getElementById('filterStatus').value;
        const roleFilter = document.getElementById('filterRole').value;
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (statusFilter) params.append('status', statusFilter);
        if (roleFilter) params.append('role', roleFilter);
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Exporting...';
        exportBtn.disabled = true;
        const response = await apiRequest(`/api/admin/users/export?${params.toString()}`);
        if (response && response.ok) {
            const contentDisposition = response.headers.get('Content-Disposition');
            const filename = contentDisposition ? contentDisposition.split('filename=')[1].replace(/"/g, '') : 'users_export.csv';
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
            showNotification('Users exported successfully!', 'success');
        } else {
            throw new Error('Export failed');
        }
    } catch (error) {
        showNotification('Error exporting users: ' + error.message, 'danger');
    } finally {
        exportBtn.innerHTML = originalText;
        exportBtn.disabled = false;
    }
}

function createUser() {
    const modal = new bootstrap.Modal(document.getElementById('createUserModal'));
    modal.show();
}

function editUser(userId) {
    const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
    modal.show();
    loadUserForEdit(userId);
}

async function toggleUserStatus(userId, currentStatus) {
    if (confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this user?`)) {
        try {
            const response = await apiRequest(`/api/admin/users/${userId}/toggle`, { method: 'POST', body: JSON.stringify({active: !currentStatus}) });
            if (response && response.ok) { showNotification('User status updated successfully', 'success'); loadUsers(); }
            else { throw new Error('Failed to update user status'); }
        } catch (error) { showNotification('Error updating user status', 'danger'); }
    }
}

async function deleteUser(userId) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        try {
            const response = await apiRequest(`/api/admin/users/${userId}/delete`, { method: 'DELETE' });
            if (response && response.ok) { showNotification('User deleted successfully', 'success'); loadUsers(); }
            else { throw new Error('Failed to delete user'); }
        } catch (error) { showNotification('Error deleting user', 'danger'); }
    }
}

function systemSettings() {
    const modal = new bootstrap.Modal(document.getElementById('systemSettingsModal'));
    modal.show();
}

function viewLogs() {
    let logsSection = document.getElementById('logsSection');
    if (!logsSection) {
        logsSection = document.createElement('div');
        logsSection.id = 'logsSection';
        logsSection.className = 'card mt-4';
        logsSection.innerHTML = `
            <div class="card-header">
                <h5 class="mb-0"><i class="fas fa-file-alt me-2"></i>System Logs</h5>
            </div>
            <div class="card-body">
                <div class="row mb-3">
                    <div class="col-md-6">
                        <select class="form-select" id="logTypeFilter">
                            <option value="main">Main Logs</option>
                            <option value="auth">Auth Logs</option>
                            <option value="files">Files Logs</option>
                            <option value="admin">Admin Logs</option>
                        </select>
                    </div>
                    <div class="col-md-6">
                        <button class="btn btn-outline-primary" onclick="loadLogs(document.getElementById('logTypeFilter').value)"><i class="fas fa-refresh me-2"></i>Refresh</button>
                    </div>
                </div>
                <div id="logsContainer">
                    <div class="text-center">
                        <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
                    </div>
                </div>
            </div>
        `;
        const mainContent = document.querySelector('.container-fluid') || document.querySelector('.container');
        if (mainContent) { mainContent.appendChild(logsSection); }
    }
    logsSection.scrollIntoView({ behavior: 'smooth' });
    loadLogs('main');
}

function backupData() {
    const modal = new bootstrap.Modal(document.getElementById('backupModal'));
    modal.show();
}

async function loadLogs(logType = 'main') {
    const logsContainer = document.getElementById('logsContainer');
    if (!logsContainer) { console.error('Logs container not found'); return; }
    try {
        const response = await apiRequest(`/admin/logs?log_type=${logType}&limit=50`);
        if (response && response.ok) {
            const body = await response.json();
            const logs = body && body.data ? body.data.logs : (body.logs || []);
            displayLogs(logs);
        } else {
            throw new Error('Failed to load logs');
        }
    } catch (error) {
        logsContainer.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Ошибка загрузки логов: ${error.message}
            </div>
        `;
    }
}

function displayLogs(logs) {
    const container = document.getElementById('logsContainer');
    if (!container) { console.error('Logs container not found for display'); return; }
    if (logs.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4">
                <i class="fas fa-inbox fa-2x text-muted mb-3"></i>
                <p class="text-muted">Логи не найдены</p>
            </div>
        `;
        return;
    }
    let logsHtml = '<div class="table-responsive"><table class="table table-sm">';
    logsHtml += '<thead><tr><th>Время</th><th>Уровень</th><th>Сообщение</th></tr></thead><tbody>';
    logs.forEach(log => {
        const levelClass = log.level === 'ERROR' ? 'text-danger' : log.level === 'WARNING' ? 'text-warning' : log.level === 'INFO' ? 'text-info' : '';
        logsHtml += `
            <tr>
                <td><small>${log.timestamp}</small></td>
                <td><span class="badge bg-secondary ${levelClass}">${log.level}</span></td>
                <td><small>${log.message}</small></td>
            </tr>
        `;
    });
    logsHtml += '</tbody></table></div>';
    container.innerHTML = logsHtml;
}

async function submitCreateUser() {
    const formData = {
        email: document.getElementById('createEmail').value,
        username: document.getElementById('createUsername').value,
        password: document.getElementById('createPassword').value,
        is_admin: document.getElementById('createIsAdmin').checked,
        storage_quota: document.getElementById('createStorageQuota').value * (1024**3)
    };
    try {
        const response = await apiRequest('/api/admin/users/create', { method: 'POST', body: JSON.stringify(formData) });
        if (response && response.ok) {
            showNotification('User created successfully!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('createUserModal')).hide();
            loadUsers();
        } else {
            throw new Error('Failed to create user');
        }
    } catch (error) {
        showNotification('Error creating user: ' + error.message, 'danger');
    }
}

async function submitEditUser() {
    const userId = document.getElementById('editUserId').value;
    const formData = {
        email: document.getElementById('editEmail').value,
        username: document.getElementById('editUsername').value,
        is_active: document.getElementById('editIsActive').checked,
        is_admin: document.getElementById('editIsAdmin').checked,
        storage_quota: document.getElementById('editStorageQuota').value * (1024**3)
    };
    const password = document.getElementById('editPassword').value;
    if (password) { formData.password = password; }
    try {
        const response = await apiRequest(`/api/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(formData) });
        if (response && response.ok) {
            showNotification('User updated successfully!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
            loadUsers();
        } else {
            throw new Error('Failed to update user');
        }
    } catch (error) {
        showNotification('Error updating user: ' + error.message, 'danger');
    }
}

function loadUserForEdit(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (user) {
        document.getElementById('editUserId').value = user.id;
        document.getElementById('editEmail').value = user.email;
        document.getElementById('editUsername').value = user.username;
        document.getElementById('editIsActive').checked = user.is_active;
        document.getElementById('editIsAdmin').checked = user.is_admin;
        document.getElementById('editStorageQuota').value = user.storage_quota / (1024**3);
    }
}

async function saveSystemSettings() {
    const settingsPayload = {
        site_name: document.getElementById('siteName').value,
        default_quota: document.getElementById('defaultQuota').value,
        session_timeout: document.getElementById('sessionTimeout').value,
        require_email_verification: document.getElementById('requireEmailVerification').checked
    };
    try {
        const response = await apiRequest('/admin/settings', { method: 'PUT', body: JSON.stringify(settingsPayload) });
        const body = response ? await response.json() : null;
        if (response && response.ok && (body.success === undefined || body.success)) {
            showNotification('System settings saved!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('systemSettingsModal')).hide();
        } else {
            throw new Error((body && body.message) || 'Failed to save settings');
        }
    } catch (e) {
        showNotification('Error saving settings: ' + e.message, 'danger');
    }
}

async function startBackup() {
    const backupType = document.getElementById('backupType').value;
    const compression = document.getElementById('compression').value;
    const includeUserFiles = document.getElementById('includeUserFiles') ? document.getElementById('includeUserFiles').checked : true;
    const backupBtn = document.querySelector('button[onclick="startBackup()"]');
    const originalText = backupBtn.innerHTML;
    try {
        backupBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Creating Backup...';
        backupBtn.disabled = true;
        const response = await apiRequest('/admin/backup', { method: 'POST', body: JSON.stringify({ backup_type: backupType, compression, include_user_files: includeUserFiles }) });
        if (response && response.ok) {
            const body = await response.json();
            const result = body && body.data ? body.data : body;
            showNotification(`Backup created successfully! ID: ${result.backup_id}`, 'success');
            bootstrap.Modal.getInstance(document.getElementById('backupModal')).hide();
            if (result.download_url) {
                try {
                    const downloadResponse = await apiRequest(result.download_url);
                    if (downloadResponse && downloadResponse.ok) {
                        const blob = await downloadResponse.blob();
                        const url = window.URL.createObjectURL(blob);
                        const downloadLink = document.createElement('a');
                        downloadLink.href = url;
                        downloadLink.download = result.filename;
                        downloadLink.style.display = 'none';
                        document.body.appendChild(downloadLink);
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                        window.URL.revokeObjectURL(url);
                        showNotification(`Downloading backup: ${result.filename}`, 'info');
                    } else {
                        throw new Error('Download failed');
                    }
                } catch (downloadError) {
                    try {
                        const token = localStorage.getItem('access_token');
                        const downloadUrl = `${result.download_url}?token=${token}`;
                        window.open(downloadUrl, '_blank');
                        showNotification(`Opening download: ${result.filename}`, 'info');
                    } catch (fallbackError) {
                        showNotification('Error downloading backup: ' + downloadError.message, 'danger');
                    }
                }
            }
        } else {
            throw new Error('Backup creation failed');
        }
    } catch (error) {
        showNotification('Error creating backup: ' + error.message, 'danger');
    } finally {
        backupBtn.innerHTML = originalText;
        backupBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadAdminData();
    loadLogs('main');
});

// Expose to global for onclick
window.refreshUsers = refreshUsers;
window.exportUsers = exportUsers;
window.createUser = createUser;
window.editUser = editUser;
window.toggleUserStatus = toggleUserStatus;
window.deleteUser = deleteUser;
window.systemSettings = systemSettings;
window.viewLogs = viewLogs;
window.backupData = backupData;
window.loadLogs = loadLogs;
window.submitCreateUser = submitCreateUser;
window.submitEditUser = submitEditUser;
window.saveSystemSettings = saveSystemSettings;
window.startBackup = startBackup;



