// script.js

// State Management
let repositories = [];
let currentRepo = null;
let currentPath = '';
let currentContents = [];
let currentItem = null;
let currentFileSha = '';
let viewMode = 'grid';
let filesToUpload = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    initializeDragAndDrop();
});

// Load from localStorage
function loadFromStorage() {
    const saved = localStorage.getItem('github-repos-manager-v2');
    if (saved) {
        try {
            repositories = JSON.parse(saved);
        } catch {
            repositories = [];
        }
    }
    updateStats();
    renderRepoList();
}

// Save to localStorage
function saveToStorage() {
    localStorage.setItem('github-repos-manager-v2', JSON.stringify(repositories));
    updateStats();
}

// Initialize drag and drop
function initializeDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            handleFileSelect(e.dataTransfer.files);
        });
    }
}

// Toggle token visibility
function toggleTokenVisibility() {
    const input = document.getElementById('token');
    const icon = document.querySelector('.token-toggle i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'far fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'far fa-eye';
    }
}

// Add repository
function addRepository() {
    const token = document.getElementById('token').value.trim();
    const owner = document.getElementById('owner').value.trim();
    const repo = document.getElementById('repo').value.trim();

    if (!token || !owner || !repo) {
        showAlert('Validation Error', 'Please fill all fields', 'error');
        return;
    }

    // Basic token validation
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
        if (!confirm('Token format looks incorrect. Continue anyway?')) {
            return;
        }
    }

    const exists = repositories.find(r => r.owner === owner && r.repo === repo);
    
    if (exists) {
        if (!confirm('Repository already exists. Update token?')) return;
        exists.token = token;
        exists.updatedAt = new Date().toISOString();
        showAlert('Success', 'Repository updated successfully', 'success');
    } else {
        repositories.push({
            id: Date.now().toString(),
            token,
            owner,
            repo,
            addedAt: new Date().toISOString()
        });
        showAlert('Success', 'Repository added successfully', 'success');
    }

    saveToStorage();
    renderRepoList();
    
    // Clear form
    document.getElementById('token').value = '';
    document.getElementById('owner').value = '';
    document.getElementById('repo').value = '';
}

// Render repository list
function renderRepoList() {
    const list = document.getElementById('repoList');
    
    if (repositories.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-database"></i>
                <p>No repositories added yet</p>
            </div>
        `;
        return;
    }

    list.innerHTML = repositories.map(repo => {
        const isActive = currentRepo?.id === repo.id;
        const date = new Date(repo.addedAt).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
        
        return `
            <li class="repo-item ${isActive ? 'active' : ''}" onclick="selectRepository('${repo.id}')">
                <div class="repo-name">
                    <i class="fas fa-github"></i>
                    <span>${repo.owner}/${repo.repo}</span>
                </div>
                <div class="repo-meta">
                    <span><i class="far fa-calendar"></i> ${date}</span>
                    <span class="repo-badge">${repo.token.substring(0, 10)}...</span>
                </div>
                <div class="repo-actions">
                    <button class="btn btn-sm" onclick="editRepository('${repo.id}', event)">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="removeRepository('${repo.id}', event)">
                        <i class="fas fa-trash-alt"></i> Remove
                    </button>
                </div>
            </li>
        `;
    }).join('');
}

// Select repository
function selectRepository(id) {
    const repo = repositories.find(r => r.id === id);
    if (repo) {
        currentRepo = repo;
        currentPath = '';
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('currentRepoDisplay').innerHTML = `
            <i class="fas fa-github"></i>
            ${repo.owner}/${repo.repo}
        `;
        updateStats();
        loadContents();
    }
}

// Edit repository
function editRepository(id, event) {
    event.stopPropagation();
    const repo = repositories.find(r => r.id === id);
    if (repo) {
        document.getElementById('token').value = repo.token;
        document.getElementById('owner').value = repo.owner;
        document.getElementById('repo').value = repo.repo;
    }
}

// Remove repository
function removeRepository(id, event) {
    event.stopPropagation();
    if (confirm('Remove this repository from the list?')) {
        repositories = repositories.filter(r => r.id !== id);
        saveToStorage();
        renderRepoList();
        
        if (currentRepo?.id === id) {
            currentRepo = null;
            document.getElementById('mainContent').style.display = 'none';
        }
        
        updateStats();
        showAlert('Success', 'Repository removed', 'success');
    }
}

// Clear all repositories
function clearAllRepos() {
    if (confirm('Clear all repositories? This action cannot be undone.')) {
        repositories = [];
        saveToStorage();
        renderRepoList();
        currentRepo = null;
        document.getElementById('mainContent').style.display = 'none';
        updateStats();
        showAlert('Success', 'All repositories cleared', 'success');
    }
}

// Export repositories
function exportRepos() {
    if (repositories.length === 0) {
        showAlert('Warning', 'No repositories to export', 'warning');
        return;
    }

    const data = JSON.stringify(repositories, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `github-repos-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showAlert('Success', 'Repositories exported successfully', 'success');
}

// Import repositories
function importRepos() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Validate data structure
                if (!Array.isArray(data)) {
                    throw new Error('Invalid data format');
                }
                
                // Validate each repository
                const valid = data.every(r => 
                    r.id && r.token && r.owner && r.repo && r.addedAt
                );
                
                if (!valid) {
                    throw new Error('Invalid repository data');
                }
                
                repositories = data;
                saveToStorage();
                renderRepoList();
                updateStats();
                showAlert('Success', `Imported ${data.length} repositories`, 'success');
                
            } catch (error) {
                showAlert('Error', 'Invalid file format: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// Update statistics
function updateStats() {
    document.getElementById('statTotalRepos').textContent = repositories.length;
    
    if (currentRepo) {
        document.getElementById('statActiveRepo').innerHTML = `
            <i class="fas fa-github"></i>
            ${currentRepo.owner}/${currentRepo.repo}
        `;
        document.getElementById('statCurrentFolder').innerHTML = `
            <i class="fas fa-folder"></i>
            ${currentPath || '/'}
        `;
    } else {
        document.getElementById('statActiveRepo').innerHTML = '-';
        document.getElementById('statCurrentFolder').innerHTML = '/';
    }
}

// Load contents from GitHub
async function loadContents(path = '') {
    if (!currentRepo) return;

    currentPath = path;
    setLoading(true);
    updateStats();

    try {
        const apiUrl = `https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${path}`;
        
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `token ${currentRepo.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Invalid token or unauthorized');
            } else if (response.status === 404) {
                throw new Error('Repository or path not found');
            } else {
                throw new Error(`Failed to load contents (${response.status})`);
            }
        }

        const data = await response.json();
        currentContents = Array.isArray(data) ? data : [data];
        
        const pathDisplay = document.getElementById('currentRepoPath').querySelector('span');
        pathDisplay.textContent = path || '/';
        
        renderContents();
        renderBreadcrumb();

    } catch (error) {
        showAlert('Error', error.message, 'error');
        currentContents = [];
        renderContents();
    } finally {
        setLoading(false);
    }
}

// Render contents based on view mode
function renderContents() {
    const container = document.getElementById('filesContainer');
    
    if (currentContents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>This folder is empty</p>
            </div>
        `;
        return;
    }

    // Sort: folders first, then files
    const sorted = [...currentContents].sort((a, b) => {
        if (a.type === 'dir' && b.type !== 'dir') return -1;
        if (a.type !== 'dir' && b.type === 'dir') return 1;
        return a.name.localeCompare(b.name);
    });

    if (viewMode === 'grid') {
        renderGridView(sorted);
    } else {
        renderTableView(sorted);
    }
}

// Render grid view
function renderGridView(items) {
    const container = document.getElementById('filesContainer');
    
    container.innerHTML = `
        <div class="file-grid">
            ${items.map(item => renderFileCard(item)).join('')}
        </div>
    `;
}

// Render table view
function renderTableView(items) {
    const container = document.getElementById('filesContainer');
    
    container.innerHTML = `
        <div class="table-container">
            <table class="file-table">
                <thead>
                    <tr>
                        <th><i class="fas fa-file"></i> Name</th>
                        <th><i class="fas fa-tag"></i> Type</th>
                        <th><i class="fas fa-weight-hanging"></i> Size</th>
                        <th><i class="far fa-clock"></i> Last Updated</th>
                        <th><i class="fas fa-cog"></i> Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(item => renderFileRow(item)).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Render file card for grid view
function renderFileCard(item) {
    const isFolder = item.type === 'dir';
    const icon = isFolder ? 'fa-folder' : getFileIcon(item.name);
    const size = isFolder ? '-' : formatBytes(item.size);
    const date = item.last_modified ? new Date(item.last_modified).toLocaleDateString() : '-';
    
    return `
        <div class="file-card ${isFolder ? 'folder' : ''}" onclick="${isFolder ? `loadContents('${item.path}')` : ''}">
            <div class="file-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="file-name">${item.name}</div>
            <div class="file-meta">
                <i class="far fa-calendar"></i>
                <span>${date}</span>
                <span>•</span>
                <span>${size}</span>
            </div>
            <div class="file-actions">
                ${isFolder ? `
                    <button class="file-action-btn" onclick="showRenameModal('${item.path}', '${item.name}', '${item.sha}', event)">
                        <i class="fas fa-tag"></i>
                    </button>
                    <button class="file-action-btn" onclick="deleteItem('${item.path}', '${item.sha}', 'dir', event)">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                ` : `
                    <button class="file-action-btn" onclick="editFile('${item.path}', '${item.sha}', event)">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="file-action-btn" onclick="downloadFile('${item.path}', event)">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="file-action-btn" onclick="showRenameModal('${item.path}', '${item.name}', '${item.sha}', event)">
                        <i class="fas fa-tag"></i>
                    </button>
                    <button class="file-action-btn" onclick="deleteItem('${item.path}', '${item.sha}', 'file', event)">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                `}
            </div>
        </div>
    `;
}

// Render file row for table view
function renderFileRow(item) {
    const isFolder = item.type === 'dir';
    const icon = isFolder ? 'fa-folder' : getFileIcon(item.name);
    const size = isFolder ? '-' : formatBytes(item.size);
    const updated = item.last_modified ? new Date(item.last_modified).toLocaleDateString() : '-';
    
    return `
        <tr class="${isFolder ? 'folder-row' : ''}" ${isFolder ? `onclick="loadContents('${item.path}')"` : ''}>
            <td>
                <i class="fas ${icon} cell-icon"></i>
                ${item.name}
            </td>
            <td>${isFolder ? 'Folder' : 'File'}</td>
            <td>${size}</td>
            <td>${updated}</td>
            <td onclick="event.stopPropagation()">
                <div style="display: flex; gap: 0.5rem;">
                    ${isFolder ? `
                        <button class="btn btn-sm" onclick="showRenameModal('${item.path}', '${item.name}', '${item.sha}', event)">
                            <i class="fas fa-tag"></i> Rename
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.path}', '${item.sha}', 'dir', event)">
                            <i class="fas fa-trash-alt"></i> Delete
                        </button>
                    ` : `
                        <button class="btn btn-sm" onclick="editFile('${item.path}', '${item.sha}', event)">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm" onclick="downloadFile('${item.path}', event)">
                            <i class="fas fa-download"></i> Download
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.path}', '${item.sha}', 'file', event)">
                            <i class="fas fa-trash-alt"></i> Delete
                        </button>
                    `}
                </div>
            </td>
        </tr>
    `;
}

// Get file icon based on extension
function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    const icons = {
        // Code
        js: 'fa-file-code', ts: 'fa-file-code', py: 'fa-file-code',
        java: 'fa-file-code', c: 'fa-file-code', cpp: 'fa-file-code',
        cs: 'fa-file-code', php: 'fa-file-code', rb: 'fa-file-code',
        go: 'fa-file-code', rs: 'fa-file-code',
        
        // Web
        html: 'fa-file-code', css: 'fa-file-code', scss: 'fa-file-code',
        json: 'fa-file-code', xml: 'fa-file-code', yaml: 'fa-file-code',
        
        // Documents
        md: 'fa-file-alt', txt: 'fa-file-alt', pdf: 'fa-file-pdf',
        doc: 'fa-file-word', docx: 'fa-file-word',
        xls: 'fa-file-excel', xlsx: 'fa-file-excel',
        
        // Images
        jpg: 'fa-file-image', jpeg: 'fa-file-image', png: 'fa-file-image',
        gif: 'fa-file-image', svg: 'fa-file-image', webp: 'fa-file-image',
        
        // Archives
        zip: 'fa-file-archive', rar: 'fa-file-archive', '7z': 'fa-file-archive',
        tar: 'fa-file-archive', gz: 'fa-file-archive',
        
        // Executables
        exe: 'fa-file', sh: 'fa-terminal', bat: 'fa-terminal',
        
        // Default
        default: 'fa-file'
    };
    
    return icons[ext] || icons.default;
}

// Format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Render breadcrumb
function renderBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    const parts = currentPath.split('/').filter(p => p);
    
    let html = `
        <span class="breadcrumb-item" onclick="loadContents()">
            <i class="fas fa-home"></i> root
        </span>
    `;
    
    let current = '';
    
    parts.forEach((part, i) => {
        current += (i === 0 ? '' : '/') + part;
        html += '<span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>';
        html += `
            <span class="breadcrumb-item" onclick="loadContents('${current}')">
                <i class="fas fa-folder"></i> ${part}
            </span>
        `;
    });
    
    breadcrumb.innerHTML = html;
}

// Refresh contents
function refreshContents() {
    loadContents(currentPath);
}

// Set view mode
function setViewMode(mode) {
    viewMode = mode;
    
    const gridBtn = document.getElementById('viewGridBtn');
    const tableBtn = document.getElementById('viewTableBtn');
    
    if (mode === 'grid') {
        gridBtn.classList.add('active');
        tableBtn.classList.remove('active');
    } else {
        gridBtn.classList.remove('active');
        tableBtn.classList.add('active');
    }
    
    renderContents();
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.body.style.overflow = '';
}

// Show create file modal
function showCreateFileModal() {
    document.getElementById('newFileName').value = '';
    document.getElementById('newFileContent').value = '';
    document.getElementById('createFileCommitMessage').value = 'Create new file';
    openModal('createFileModal');
}

// Show create folder modal
function showCreateFolderModal() {
    document.getElementById('newFolderName').value = '';
    document.getElementById('createFolderCommitMessage').value = 'Create new folder';
    openModal('createFolderModal');
}

// Show upload modal
function showUploadModal() {
    filesToUpload = [];
    document.getElementById('uploadFileList').innerHTML = '';
    document.getElementById('uploadCommitMessage').value = 'Upload files';
    document.getElementById('uploadBtn').disabled = false;
    openModal('uploadModal');
}

// Create file
async function createFile() {
    const fileName = document.getElementById('newFileName').value.trim();
    const content = document.getElementById('newFileContent').value;
    const commitMessage = document.getElementById('createFileCommitMessage').value;

    if (!fileName) {
        showAlert('Validation Error', 'File name is required', 'error');
        return;
    }

    // Validate file name
    if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
        showAlert('Validation Error', 'File name contains invalid characters', 'error');
        return;
    }

    const path = currentPath ? `${currentPath}/${fileName}` : fileName;
    setLoading(true);

    try {
        const response = await fetch(`https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${currentRepo.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: commitMessage,
                content: btoa(unescape(encodeURIComponent(content)))
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create file');
        }

        showAlert('Success', 'File created successfully', 'success');
        closeModal('createFileModal');
        loadContents(currentPath);

    } catch (error) {
        showAlert('Error', error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Create folder
async function createFolder() {
    const folderName = document.getElementById('newFolderName').value.trim();
    const commitMessage = document.getElementById('createFolderCommitMessage').value;

    if (!folderName) {
        showAlert('Validation Error', 'Folder name is required', 'error');
        return;
    }

    // Validate folder name
    if (!/^[a-zA-Z0-9._-]+$/.test(folderName)) {
        showAlert('Validation Error', 'Folder name contains invalid characters', 'error');
        return;
    }

    const path = currentPath ? `${currentPath}/${folderName}/.gitkeep` : `${folderName}/.gitkeep`;
    setLoading(true);

    try {
        const response = await fetch(`https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${currentRepo.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: commitMessage,
                content: btoa('')
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create folder');
        }

        showAlert('Success', 'Folder created successfully', 'success');
        closeModal('createFolderModal');
        loadContents(currentPath);

    } catch (error) {
        showAlert('Error', error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Edit file
async function editFile(path, sha, event) {
    if (event) event.stopPropagation();
    
    setLoading(true);

    try {
        const response = await fetch(`https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${path}`, {
            headers: {
                'Authorization': `token ${currentRepo.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch file');
        }

        const data = await response.json();
        const content = decodeURIComponent(escape(atob(data.content)));
        
        currentItem = { path, sha };
        currentFileSha = data.sha;
        
        document.getElementById('editFilePath').innerHTML = `
            <i class="fas fa-file"></i>
            Editing: ${path}
        `;
        document.getElementById('editFileContent').value = content;
        document.getElementById('editCommitMessage').value = `Update ${path.split('/').pop()}`;
        openModal('editFileModal');

    } catch (error) {
        showAlert('Error', error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Save file
async function saveFile() {
    const content = document.getElementById('editFileContent').value;
    const commitMessage = document.getElementById('editCommitMessage').value;

    setLoading(true);

    try {
        const response = await fetch(`https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${currentItem.path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${currentRepo.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: commitMessage,
                content: btoa(unescape(encodeURIComponent(content))),
                sha: currentFileSha
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to save file');
        }

        showAlert('Success', 'File saved successfully', 'success');
        closeModal('editFileModal');
        loadContents(currentPath);

    } catch (error) {
        showAlert('Error', error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Download file
async function downloadFile(path, event) {
    event.stopPropagation();
    
    try {
        const response = await fetch(`https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${path}`, {
            headers: {
                'Authorization': `token ${currentRepo.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch file');
        }

        const data = await response.json();
        const content = decodeURIComponent(escape(atob(data.content)));
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = path.split('/').pop();
        a.click();
        URL.revokeObjectURL(url);
        
        showAlert('Success', 'File downloaded', 'success');

    } catch (error) {
        showAlert('Error', error.message, 'error');
    }
}

// Show rename modal
function showRenameModal(path, currentName, sha, event) {
    if (event) event.stopPropagation();
    
    currentItem = { path, sha, currentName };
    document.getElementById('renameNewName').value = currentName;
    document.getElementById('renameCommitMessage').value = `Rename ${currentName}`;
    openModal('renameModal');
}

// Confirm rename
async function confirmRename() {
    const newName = document.getElementById('renameNewName').value.trim();
    const commitMessage = document.getElementById('renameCommitMessage').value;

    if (!newName) {
        showAlert('Validation Error', 'New name is required', 'error');
        return;
    }

    // Validate name
    if (!/^[a-zA-Z0-9._-]+$/.test(newName)) {
        showAlert('Validation Error', 'Name contains invalid characters', 'error');
        return;
    }

    const pathParts = currentItem.path.split('/');
    pathParts.pop();
    const parentPath = pathParts.join('/');
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;

    setLoading(true);

    try {
        // Get file content
        const getResponse = await fetch(`https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${currentItem.path}`, {
            headers: {
                'Authorization': `token ${currentRepo.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!getResponse.ok) {
            const error = await getResponse.json();
            throw new Error(error.message || 'Failed to fetch item');
        }

        const data = await getResponse.json();

        // Create new file
        const createResponse = await fetch(`https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${newPath}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${currentRepo.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: commitMessage,
                content: data.content,
            })
        });

        if (!createResponse.ok) {
            const error = await createResponse.json();
            throw new Error(error.message || 'Failed to create new file');
        }

        // Delete old file
        const deleteResponse = await fetch(`https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${currentItem.path}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${currentRepo.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Delete ${currentItem.currentName}`,
                sha: currentItem.sha
            })
        });

        if (!deleteResponse.ok) {
            const error = await deleteResponse.json();
            throw new Error(error.message || 'Failed to delete old file');
        }

        showAlert('Success', 'Renamed successfully', 'success');
        closeModal('renameModal');
        loadContents(currentPath);

    } catch (error) {
        showAlert('Error', error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Delete item
async function deleteItem(path, sha, type, event) {
    if (event) event.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    setLoading(true);

    try {
        const response = await fetch(`https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${path}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${currentRepo.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: `Delete ${path}`,
                sha: sha
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to delete');
        }

        showAlert('Success', 'Deleted successfully', 'success');
        loadContents(currentPath);

    } catch (error) {
        showAlert('Error', error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Handle file selection for upload
function handleFileSelect(files) {
    filesToUpload = Array.from(files);
    const fileList = document.getElementById('uploadFileList');
    
    if (filesToUpload.length === 0) {
        fileList.innerHTML = '';
        return;
    }

    fileList.innerHTML = filesToUpload.map(file => `
        <div class="file-list-item">
            <div class="file-info">
                <i class="fas ${getFileIcon(file.name)}"></i>
                <span>${file.name}</span>
            </div>
            <span class="file-size">${formatBytes(file.size)}</span>
        </div>
    `).join('');
}

// Upload files
async function uploadFiles() {
    const commitMessage = document.getElementById('uploadCommitMessage').value;
    const uploadBtn = document.getElementById('uploadBtn');
    
    if (filesToUpload.length === 0) {
        showAlert('Validation Error', 'No files selected', 'error');
        return;
    }

    // Check total size
    const totalSize = filesToUpload.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > 100 * 1024 * 1024) { // 100MB limit
        showAlert('Error', 'Total file size exceeds 100MB limit', 'error');
        return;
    }

    uploadBtn.disabled = true;
    setLoading(true);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const file of filesToUpload) {
        try {
            const path = currentPath ? `${currentPath}/${file.name}` : file.name;
            
            // Check if file exists
            const checkResponse = await fetch(`https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${path}`, {
                headers: {
                    'Authorization': `token ${currentRepo.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            let sha = null;
            if (checkResponse.ok) {
                const existing = await checkResponse.json();
                sha = existing.sha;
            }

            // Convert file to base64
            const content = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const body = {
                message: `${commitMessage}: ${file.name}`,
                content: content
            };

            if (sha) {
                body.sha = sha; // Update existing file
            }

            const response = await fetch(`https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${path}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${currentRepo.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `Failed to upload ${file.name}`);
            }

            successCount++;

        } catch (error) {
            errorCount++;
            errors.push(`${file.name}: ${error.message}`);
        }
    }

    setLoading(false);
    uploadBtn.disabled = false;

    if (errorCount === 0) {
        showAlert('Success', `Successfully uploaded ${successCount} files`, 'success');
        closeModal('uploadModal');
        loadContents(currentPath);
    } else if (successCount > 0) {
        showAlert('Warning', `Uploaded ${successCount} files, ${errorCount} failed`, 'warning');
        if (errors.length > 0) {
            console.error('Upload errors:', errors);
        }
    } else {
        showAlert('Error', 'Failed to upload any files', 'error');
    }
}

// Show alert
function showAlert(title, message, type) {
    const alert = document.getElementById('alert');
    const icon = alert.querySelector('.alert-icon i');
    
    // Set icon based on type
    if (type === 'success') {
        icon.className = 'fas fa-check-circle';
    } else if (type === 'error') {
        icon.className = 'fas fa-exclamation-circle';
    } else if (type === 'warning') {
        icon.className = 'fas fa-exclamation-triangle';
    }
    
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').textContent = message;
    alert.className = `alert ${type} show`;
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        alert.classList.remove('show');
    }, 3000);
}

// Set loading
function setLoading(loading) {
    const loadingEl = document.getElementById('loading');
    if (loading) {
        loadingEl.classList.add('active');
    } else {
        loadingEl.classList.remove('active');
    }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// Handle escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
});