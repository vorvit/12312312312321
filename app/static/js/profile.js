// Profile page scripts

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('profileForm');
    if (form) {
        form.addEventListener('submit', onSubmitProfile);
    }
});

async function onSubmitProfile(e) {
    e.preventDefault();
    const formData = {
        username: document.getElementById('username').value,
        first_name: document.getElementById('firstName').value,
        last_name: document.getElementById('lastName').value,
        bio: document.getElementById('bio').value
    };
    try {
        const response = await apiRequest('/users/me', { method: 'PUT', body: JSON.stringify(formData) });
        if (response && response.ok) {
            showInlineAlert('Profile updated successfully!', 'success');
        } else {
            throw new Error('Failed to update profile');
        }
    } catch (error) {
        showInlineAlert('Error updating profile: ' + error.message, 'danger');
    }
}

function changePassword() {
    const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
    modal.show();
}

function savePassword() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    if (newPassword !== confirmPassword) {
        showInlineAlert('New passwords do not match!', 'danger');
        return;
    }
    showInlineAlert('Password change functionality will be implemented', 'info');
}

function viewSessions() {
    const modal = new bootstrap.Modal(document.getElementById('sessionsModal'));
    modal.show();
    loadSessions();
}

async function loadSessions() {
    document.getElementById('sessionsList').innerHTML = '<p>No active sessions found.</p>';
}

function terminateAllSessions() {
    if (confirm('Are you sure you want to terminate all other sessions?')) {
        showInlineAlert('Session termination functionality will be implemented', 'info');
    }
}

function showInlineAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    const container = document.querySelector('.container-fluid');
    container.insertBefore(alertDiv, container.firstChild);
    setTimeout(() => { if (alertDiv.parentNode) alertDiv.remove(); }, 5000);
}

// expose
window.changePassword = changePassword;
window.savePassword = savePassword;
window.viewSessions = viewSessions;
window.terminateAllSessions = terminateAllSessions;



