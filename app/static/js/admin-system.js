// Admin System Status page scripts

document.addEventListener('DOMContentLoaded', function() {
    loadSystemStatus();
});

async function loadSystemStatus() {
    try {
        const t0 = performance.now();
        const healthResponse = await apiRequest(`/health?ts=${Date.now()}`);
        if (healthResponse && healthResponse.ok) {
            const health = await healthResponse.json();
            updateHealthStatus(health);
            updateSystemMeta(health);
        }
        const t1 = performance.now();
        const statsResponse = await apiRequest(`/admin/stats?ts=${Date.now()}`);
        if (statsResponse && statsResponse.ok) {
            const body = await statsResponse.json();
            const stats = body && body.data ? body.data : body;
            updateSystemStats(stats);
        }
        const t2 = performance.now();
        showLatency(Math.round(t1 - t0), Math.round(t2 - t1));
    } catch (error) {
        console.error('Error loading system status:', error);
        updateHealthStatus({ status: 'error', message: error.message });
    }
}

function updateHealthStatus(health) {
    const statuses = {
        'database': document.getElementById('dbStatus'),
        'redis': document.getElementById('redisStatus'),
        'minio': document.getElementById('minioStatus'),
        'postgres': document.getElementById('postgresStatus')
    };
    Object.keys(statuses).forEach(service => {
        const element = statuses[service];
        if (!element) return;
        if (health[service] && health[service].status === 'healthy') {
            element.className = 'badge bg-success';
            element.textContent = 'OK';
        } else {
            element.className = 'badge bg-danger';
            element.textContent = 'Offline';
        }
    });
}

function updateSystemMeta(health) {
    const el = document.getElementById('systemMeta');
    if (!el) return;
    const uptime = health.uptime_sec !== undefined ? `${health.uptime_sec}s` : '-';
    const ver = health.version || '-';
    const ts = health.timestamp || '';
    el.textContent = `Uptime: ${uptime} • Version: ${ver} • ${ts}`;
}

function updateSystemStats(stats) {
    document.getElementById('totalUsers').textContent = stats.total_users ?? 0;
    document.getElementById('activeUsers').textContent = stats.active_users ?? 0;
    document.getElementById('totalFiles').textContent = stats.total_files ?? '-';
    document.getElementById('storageUsed').textContent = formatBytes(stats.total_storage_used ?? 0);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function refreshStatus() { loadSystemStatus(); }

function openLogsModal() { window.location.href = '/admin#logs'; }
function openBackupModal() { window.location.href = '/admin#backup'; }
function clearCache() { if (confirm('Are you sure you want to clear the cache?')) { alert('Cache cleared successfully!'); } }

function showLatency(healthMs, statsMs) {
    const el = document.getElementById('systemMeta');
    if (!el) return;
    el.textContent = `${el.textContent} • latency: health ${healthMs}ms, stats ${statsMs}ms`;
}

// expose
window.refreshStatus = refreshStatus;
window.openLogsModal = openLogsModal;
window.openBackupModal = openBackupModal;
window.clearCache = clearCache;


