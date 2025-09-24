// Files page scripts extracted from template

document.addEventListener('DOMContentLoaded', function() {
    loadUserFiles();
});

async function loadUserFiles() {
    try {
        const response = await apiRequest('/api/files');
        if (response && response.ok) {
            const body = await response.json();
            const files = body && body.data ? body.data : body;
            displayUserFiles(files || []);
        } else {
            throw new Error('Failed to load files');
        }
    } catch (error) {
        console.error('Error loading files:', error);
        const el = document.getElementById('filesList');
        if (el) el.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Error loading files: ${error.message}
            </div>
        `;
    }
}

function displayUserFiles(files) {
    const container = document.getElementById('filesList');
    if (!container) return;
    if (files.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-4">
                <i class="fas fa-folder-open fa-3x mb-3"></i>
                <h5>No files uploaded yet</h5>
                <p>Upload your first IFC file to get started</p>
                <button class="btn btn-primary" onclick="uploadFile()">
                    <i class="fas fa-upload me-2"></i>Upload Files
                </button>
            </div>
        `;
        return;
    }
    let html = '<div class="row">';
    files.forEach(file => {
        const fileSize = formatFileSize(file.size);
        const uploadDate = new Date(file.last_modified || file.upload_date || Date.now()).toLocaleDateString();
        html += `
            <div class="col-md-6 col-lg-4 mb-3">
                <div class="card h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-2">
                            <i class="fas fa-file fa-2x text-primary me-3"></i>
                            <div class="flex-grow-1">
                                <h6 class="card-title mb-0" title="${file.name || file.filename}">${(file.name || file.filename)}</h6>
                                <small class="text-muted">${fileSize}</small>
                            </div>
                        </div>
                        <p class="card-text small text-muted">Uploaded: ${uploadDate}</p>
                    </div>
                    <div class="card-footer bg-transparent">
                        <div class="btn-group w-100" role="group">
                            <button class="btn btn-outline-primary btn-sm" onclick="viewFile('${file.name || file.filename}')"><i class="fas fa-eye"></i></button>
                            <button class="btn btn-outline-success btn-sm" onclick="downloadFile('${file.name || file.filename}')"><i class="fas fa-download"></i></button>
                            <button class="btn btn-outline-danger btn-sm" onclick="deleteFile('${file.name || file.filename}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024; const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function viewFile(filename) { window.open(`/ifc-viewer?file=${encodeURIComponent(filename)}`, '_blank'); }

async function downloadFile(filename) {
    try {
        const response = await apiRequest(`/files/download/${encodeURIComponent(filename)}`);
        if (response && response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
        } else { throw new Error('Download failed'); }
    } catch (error) { alert('Error downloading file: ' + error.message); }
}

async function deleteFile(filename) {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;
    try {
        const response = await apiRequest(`/files/delete/${encodeURIComponent(filename)}`, { method: 'DELETE' });
        if (response && response.ok) { loadUserFiles(); }
        else { throw new Error('Delete failed'); }
    } catch (error) { alert('Error deleting file: ' + error.message); }
}

function uploadFile() { window.location.href = '/dashboard'; }

// expose
window.loadUserFiles = loadUserFiles;
window.viewFile = viewFile;
window.downloadFile = downloadFile;
window.deleteFile = deleteFile;
window.uploadFile = uploadFile;



