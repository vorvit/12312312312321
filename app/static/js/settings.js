// Settings page scripts

document.addEventListener('DOMContentLoaded', function() {
    loadUserData();
    const form = document.getElementById('accountForm');
    if (form) form.addEventListener('submit', onSubmitAccount);
});

async function loadUserData() {
    try {
        const response = await apiRequest('/users/me');
        if (response && response.ok) {
            const user = await response.json();
            document.getElementById('email').value = user.email || '';
            document.getElementById('fullName').value = user.full_name || '';
            document.getElementById('phone').value = user.phone || '';
        } else {
            throw new Error('Failed to load user data');
        }
    } catch (error) {
        alert('Error loading user data: ' + error.message);
    }
}

async function onSubmitAccount(e) {
    e.preventDefault();
    const formData = {
        full_name: document.getElementById('fullName').value,
        phone: document.getElementById('phone').value
    };
    try {
        const response = await apiRequest('/users/me', { method: 'PUT', body: JSON.stringify(formData) });
        if (response && response.ok) {
            alert('Account settings updated successfully!');
        } else {
            throw new Error('Update failed');
        }
    } catch (error) {
        alert('Error updating account: ' + error.message);
    }
}

function changePassword() { window.location.href = '/profile'; }
function viewSessions() { window.location.href = '/profile'; }
function exportData() { alert('Data export feature coming soon!'); }
function saveNotifications() { alert('Notification preferences saved!'); }

// expose
window.changePassword = changePassword;
window.viewSessions = viewSessions;
window.exportData = exportData;
window.saveNotifications = saveNotifications;



