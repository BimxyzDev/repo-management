// script.js - Enhanced Version (Complete)

// State Management
let repositories = [];
let currentRepo = null;
let currentPath = '';
let currentContents = [];
let currentItem = null;
let currentFileSha = '';
let viewMode = 'grid';
let filesToUpload = [];
let zipFile = null;
let searchTimeout = null;
let editor = null;
let searchCursor = null;
let recentActivities = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();
    initializeDragAndDrop();
    initializeCodeMirror();
    updateHeaderStats();
});

// Initialize CodeMirror
function initializeCodeMirror() {
    // Ini akan diinisialisasi saat modal dibuka
}

// Create CodeMirror instance
function createCodeMirror(textarea, options = {}) {
    const defaultOptions = {
        lineNumbers: true,
        mode: 'javascript',
        theme: document.getElementById('editorTheme')?.value || 'dracula',
        autoCloseBrackets: true,
        matchBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        lineWrapping: true,
        foldGutter: true,
        gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
        extraKeys: {
            'Ctrl-F': 'findPersistent',
            'Ctrl-H': 'replace',
            'Ctrl-Space': 'autocomplete',
            'Ctrl-/': 'toggleComment',
            'Ctrl-D': 'deleteLine',
            'Alt-Up': 'swapLineUp',
            'Alt-Down': 'swapLineDown'
        }
    };

    const cm = CodeMirror.fromTextArea(textarea, { ...defaultOptions, ...options });
    
    cm.on('cursorActivity', () => {
        const pos = cm.getCursor();
        const statusbar = document.querySelector('.editor-statusbar');
        if (statusbar) {
            document.getElementById('cursorPosition').textContent = `Ln ${pos.line + 1}, Col ${pos.ch + 1}`;
        }
    });

    return cm;
}

// Change editor theme
function changeEditorTheme() {
    const theme = document.getElementById('editorTheme').value;
    if (editor) {
        editor.setOption('theme', theme);
    }
}

// Load from localStorage
function loadFromStorage() {
    const saved = localStorage.getItem('github-repos-manager-v3');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            repositories = data.repositories || [];
            recentActivities = data.activities || [];
        } catch {
            repositories = [];
            recentActivities = [];
        }
    }
    updateStats();
    renderRepoList();
    renderRecentActivity();
}

// Save to localStorage
function saveToStorage() {
    localStorage.setItem('github-repos-manager-v3', JSON.stringify({
        repositories: repositories,
        activities: recentActivities
    }));
    updateStats();
    updateHeaderStats();
}

// Add activity
function addActivity(type, message, repo) {
    const activity = {
        id: Date.now(),
        type,
        message,
        repo: repo || (currentRepo ? `${currentRepo.owner}/${currentRepo.repo}` : 'Unknown'),
        timestamp: new Date().toISOString()
    };
    
    recentActivities.unshift(activity);
    if (recentActivities.length > 10) {
        recentActivities.pop();
    }
    
    saveToStorage();
    renderRecentActivity();
}

// Render recent activity
function renderRecentActivity() {
    const container = document.getElementById('recentActivity');
    
    if (recentActivities.length === 0) {
        container.innerHTML = `
            <div class="empty-state small">
                <i class="fas fa-clock"></i>
                <p>No recent activity</p>
            </div>
        `;
        return;
    }

    container.innerHTML = recentActivities.map(activity => {
        const date = new Date(activity.timestamp).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let icon = 'fa-info-circle';
        if (activity.type === 'create') icon = 'fa-plus-circle';
        if (activity.type === 'edit') icon = 'fa-edit';
        if (activity.type === 'delete') icon = 'fa-trash';
        if (activity.type === 'upload') icon = 'fa-upload';
        
        return `
            <div class="activity-item">
                <i class="fas ${icon}"></i>
                <div class="activity-content">
                    <div class="activity-message">${activity.message}</div>
                    <div class="activity-meta">
                        <span>${activity.repo}</span>
                        <span>•</span>
                        <span>${date}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Update header stats
function updateHeaderStats() {
    document.getElementById('headerTotalRepos').textContent = repositories.length;
}

// Initialize drag and drop
function initializeDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    const zipUploadArea = document.getElementById('zipUploadArea');
    
    if (uploadArea) {
        setupDragAndDrop(uploadArea, (files) => handleFileSelect(files));
    }
    
    if (zipUploadArea) {
        setupDragAndDrop(zipUploadArea, (files) => {
            if (files.length > 0) handleZipSelect(files[0]);
        });
    }
}

function setupDragAndDrop(element, callback) {
    element.addEventListener('dragover', (e) => {
        e.preventDefault();
        element.classList.add('dragover');
    });

    element.addEventListener('dragleave', () => {
        element.classList.remove('dragover');
    });

    element.addEventListener('drop', (e) => {
        e.preventDefault();
        element.classList.remove('dragover');
        callback(e.dataTransfer.files);
    });
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

// Filter repositories
function filterRepositories() {
    const searchTerm = document.getElementById('repoSearch').value.toLowerCase();
    const items = document.querySelectorAll('.repo-item');
    
    items.forEach(item => {
        const name = item.querySelector('.repo-name span').textContent.toLowerCase();
        if (name.includes(searchTerm)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// Filter files
function filterFiles() {
    const searchTerm = document.getElementById('fileSearch').value.toLowerCase();
    const cards = document.querySelectorAll('.file-card');
    const rows = document.querySelectorAll('.file-table tbody tr');
    
    if (viewMode === 'grid') {
        cards.forEach(card => {
            const name = card.querySelector('.file-name').textContent.toLowerCase();
            if (name.includes(searchTerm)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    } else {
        rows.forEach(row => {
            const name = row.cells[0].textContent.toLowerCase();
            if (name.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
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
        addActivity('edit', `Updated repository: ${owner}/${repo}`);
    } else {
        repositories.push({
            id: Date.now().toString(),
            token,
            owner,
            repo,
            addedAt: new Date().toISOString()
        });
        showAlert('Success', 'Repository added successfully', 'success');
        addActivity('create', `Added repository: ${owner}/${repo}`);
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
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="removeRepository('${repo.id}', event)">
                        <i class="fas fa-trash-alt"></i>
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
        addActivity('view', `Opened repository: ${repo.owner}/${repo.repo}`);
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
        const repo = repositories.find(r => r.id === id);
        repositories = repositories.filter(r => r.id !== id);
        saveToStorage();
        renderRepoList();
        
        if (currentRepo?.id === id) {
            currentRepo = null;
            document.getElementById('mainContent').style.display = 'none';
        }
        
        updateStats();
        if (repo) {
            addActivity('delete', `Removed repository: ${repo.owner}/${repo.repo}`);
        }
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
        addActivity('delete', 'Cleared all repositories');
        showAlert('Success', 'All repositories cleared', 'success');
    }
}

// Export repositories
function exportRepos() {
    if (repositories.length === 0) {
        showAlert('Warning', 'No repositories to export', 'warning');
        return;
    }

    const data = JSON.stringify({
        repositories: repositories,
        activities: recentActivities,
        exportedAt: new Date().toISOString()
    }, null, 2);
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `github-repos-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    addActivity('export', 'Exported repositories data');
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
                if (data.repositories && Array.isArray(data.repositories)) {
                    repositories = data.repositories;
                    if (data.activities) recentActivities = data.activities;
                } else if (Array.isArray(data)) {
                    repositories = data;
                } else {
                    throw new Error('Invalid data format');
                }
                
                saveToStorage();
                renderRepoList();
                renderRecentActivity();
                updateStats();
                addActivity('import', `Imported ${repositories.length} repositories`);
                showAlert('Success', `Imported ${repositories.length} repositories`, 'success');
                
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
        document.getElementById('statFileCount').textContent = currentContents.length;
    } else {
        document.getElementById('statActiveRepo').innerHTML = '-';
        document.getElementById('statCurrentFolder').innerHTML = '/';
        document.getElementById('statFileCount').textContent = '0';
    }
}

// Load contents from GitHub
async function loadContents(path = '') {
    if (!currentRepo) return;

    currentPath = path;
    setLoading(true, 'Loading contents...');
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
    document.getElementById('fileSearch').value = ''; // Reset search
    
    if (currentContents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>This folder is empty</p>
                <button class="btn btn-primary" onclick="showCreateFileModal()">
                    <i class="fas fa-plus"></i>
                    Create first file
                </button>
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
    
    updateStats();
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
                    <button class="file-action-btn" onclick="showRenameModal('${item.path}', '${item.name}', '${item.sha}', event)" title="Rename">
                        <i class="fas fa-tag"></i>
                    </button>
                    <button class="file-action-btn delete" onclick="deleteItem('${item.path}', '${item.sha}', 'dir', event)" title="Delete">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                ` : `
                    <button class="file-action-btn" onclick="editFile('${item.path}', '${item.sha}', event)" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="file-action-btn" onclick="downloadFile('${item.path}', event)" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="file-action-btn" onclick="showRenameModal('${item.path}', '${item.name}', '${item.sha}', event)" title="Rename">
                        <i class="fas fa-tag"></i>
                    </button>
                    <button class="file-action-btn delete" onclick="deleteItem('${item.path}', '${item.sha}', 'file', event)" title="Delete">
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
                        <button class="btn btn-sm" onclick="showRenameModal('${item.path}', '${item.name}', '${item.sha}', event)" title="Rename">
                            <i class="fas fa-tag"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.path}', '${item.sha}', 'dir', event)" title="Delete">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    ` : `
                        <button class="btn btn-sm" onclick="editFile('${item.path}', '${item.sha}', event)" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm" onclick="downloadFile('${item.path}', event)" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.path}', '${item.sha}', 'file', event)" title="Delete">
                            <i class="fas fa-trash-alt"></i>
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

// Get language mode for CodeMirror
function getLanguageMode(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    
    const modes = {
        js: 'javascript',
        ts: 'javascript',
        jsx: 'jsx',
        tsx: 'jsx',
        py: 'python',
        html: 'htmlmixed',
        css: 'css',
        scss: 'css',
        json: 'javascript',
        xml: 'xml',
        php: 'php',
        sql: 'sql',
        md: 'markdown'
    };
    
    return modes[ext] || 'javascript';
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
    
    // Clean up editor if closing edit modal
    if (modalId === 'editFileModal' && editor) {
        editor.toTextArea();
        editor = null;
    }
}

// Show create file modal
function showCreateFileModal() {
    document.getElementById('newFileName').value = '';
    document.getElementById('newFileContent').value = '';
    document.getElementById('createFileCommitMessage').value = 'Create new file';
    openModal('createFileModal');
    
    // Initialize editor
    setTimeout(() => {
        const textarea = document.getElementById('newFileContent');
        editor = createCodeMirror(textarea, {
            mode: 'javascript'
        });
    }, 100);
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
    document.getElementById('uploadProgress').style.display = 'none';
    openModal('uploadModal');
}

// Show ZIP upload modal
function showZipUploadModal() {
    zipFile = null;
    document.getElementById('zipFileInfo').style.display = 'none';
    document.getElementById('extractedFileList').style.display = 'none';
    document.getElementById('extractedFileList').innerHTML = '';
    document.getElementById('zipProgress').style.display = 'none';
    document.getElementById('zipCommitMessage').value = 'Extract ZIP archive';
    document.getElementById('extractBtn').disabled = true;
    openModal('zipUploadModal');
}

// Show search modal
function showSearchModal() {
    document.getElementById('globalSearchInput').value = '';
    document.getElementById('searchResults').innerHTML = `
        <div class="search-stats" id="searchStats"></div>
        <div class="results-list" id="resultsList"></div>
    `;
    openModal('searchModal');
}

// Insert snippet
function insertSnippet(type) {
    if (!editor) return;
    
    const snippets = {
        function: 'function name() {\n    \n}',
        class: 'class Name {\n    constructor() {\n        \n    }\n}',
        if: 'if (condition) {\n    \n}',
        for: 'for (let i = 0; i < length; i++) {\n    \n}'
    };
    
    editor.replaceSelection(snippets[type]);
}

// Format code
function formatCode() {
    if (!editor) return;
    
    const content = editor.getValue();
    // Simple formatting - in production you might want to use prettier
    const formatted = content
        .split('\n')
        .map(line => line.trim())
        .join('\n');
    
    editor.setValue(formatted);
}

// Toggle search panel
function toggleSearchPanel() {
    const panel = document.getElementById('searchPanel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        document.getElementById('searchInput').focus();
    } else {
        panel.style.display = 'none';
        document.getElementById('replacePanel').style.display = 'none';
    }
}

// Toggle word wrap
function toggleWordWrap() {
    if (editor) {
        editor.setOption('lineWrapping', !editor.getOption('lineWrapping'));
    }
}

// Search in editor
function searchInEditor() {
    if (!editor) return;
    
    const query = document.getElementById('searchInput').value;
    if (!query) return;
    
    const cursor = editor.getSearchCursor(query);
    if (cursor.findNext()) {
        editor.setSelection(cursor.from(), cursor.to());
    }
}

// Find next occurrence
function findNext() {
    if (!editor) return;
    
    const query = document.getElementById('searchInput').value;
    if (!query) return;
    
    const cursor = editor.getSearchCursor(query);
    if (cursor.findNext()) {
        editor.setSelection(cursor.from(), cursor.to());
    } else if (cursor.findPrevious()) {
        cursor.findPrevious();
        editor.setSelection(cursor.from(), cursor.to());
    }
}

// Find previous occurrence
function findPrev() {
    if (!editor) return;
    
    const query = document.getElementById('searchInput').value;
    if (!query) return;
    
    const cursor = editor.getSearchCursor(query);
    if (cursor.findPrevious()) {
        editor.setSelection(cursor.from(), cursor.to());
    }
}

// Replace in editor
function replaceInEditor() {
    document.getElementById('replacePanel').style.display = 'flex';
}

// Replace all
function replaceAll() {
    if (!editor) return;
    
    const search = document.getElementById('searchInput').value;
    const replace = document.getElementById('replaceInput').value;
    
    if (!search) return;
    
    const content = editor.getValue();
    const newContent = content.split(search).join(replace);
    editor.setValue(newContent);
    
    document.getElementById('replacePanel').style.display = 'none';
}

// Create file
async function createFile() {
    const fileName = document.getElementById('newFileName').value.trim();
    const content = editor ? editor.getValue() : document.getElementById('newFileContent').value;
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
    setLoading(true, 'Creating file...');

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
        addActivity('create', `Created file: ${fileName}`, `${currentRepo.owner}/${currentRepo.repo}`);
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
    setLoading(true, 'Creating folder...');

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
        addActivity('create', `Created folder: ${folderName}`, `${currentRepo.owner}/${currentRepo.repo}`);
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
    
    setLoading(true, 'Loading file...');

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
            <span>Editing: ${path}</span>
        `;
        document.getElementById('editFileContent').value = content;
        document.getElementById('editCommitMessage').value = `Update ${path.split('/').pop()}`;
        
        // Update file size in statusbar
        document.getElementById('fileSize').textContent = formatBytes(content.length);
        
        openModal('editFileModal');
        
        // Initialize editor
        setTimeout(() => {
            const textarea = document.getElementById('editFileContent');
            editor = createCodeMirror(textarea, {
                mode: getLanguageMode(path),
                value: content
            });
            
            // Update cursor position
            const pos = editor.getCursor();
            document.getElementById('cursorPosition').textContent = `Ln ${pos.line + 1}, Col ${pos.ch + 1}`;
        }, 100);

    } catch (error) {
        showAlert('Error', error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Save file
async function saveFile() {
    const content = editor ? editor.getValue() : document.getElementById('editFileContent').value;
    const commitMessage = document.getElementById('editCommitMessage').value;

    setLoading(true, 'Saving file...');

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
        addActivity('edit', `Updated file: ${currentItem.path}`, `${currentRepo.owner}/${currentRepo.repo}`);
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
        
        addActivity('download', `Downloaded file: ${path}`, `${currentRepo.owner}/${currentRepo.repo}`);
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

    setLoading(true, 'Renaming...');

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
        addActivity('edit', `Renamed ${currentItem.currentName} to ${newName}`, `${currentRepo.owner}/${currentRepo.repo}`);
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

    setLoading(true, 'Deleting...');

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
        addActivity('delete', `Deleted ${type}: ${path}`, `${currentRepo.owner}/${currentRepo.repo}`);
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

// Handle ZIP file selection
async function handleZipSelect(file) {
    if (!file) return;
    
    zipFile = file;
    
    // Display file info
    document.getElementById('zipFileName').textContent = file.name;
    document.getElementById('zipSize').textContent = formatBytes(file.size);
    document.getElementById('zipFileInfo').style.display = 'block';
    
    // Enable extract button
    document.getElementById('extractBtn').disabled = false;
    
    // Read ZIP contents
    setLoading(true, 'Reading ZIP file...');
    
    try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        
        let folderCount = 0;
        let fileCount = 0;
        const fileList = [];
        
        contents.forEach((relativePath, zipEntry) => {
            if (zipEntry.dir) {
                folderCount++;
            } else {
                fileCount++;
                fileList.push(`<div class="file-list-item">
                    <div class="file-info">
                        <i class="fas ${getFileIcon(zipEntry.name)}"></i>
                        <span>${zipEntry.name}</span>
                    </div>
                </div>`);
            }
        });
        
        document.getElementById('zipFolderCount').textContent = folderCount;
        document.getElementById('zipFileCount').textContent = fileCount;
        
        // Show file list (max 10 files)
        if (fileList.length > 0) {
            const listElement = document.getElementById('extractedFileList');
            listElement.innerHTML = fileList.slice(0, 10).join('');
            if (fileList.length > 10) {
                listElement.innerHTML += `<div class="file-list-item">... and ${fileList.length - 10} more files</div>`;
            }
            listElement.style.display = 'block';
        }
        
    } catch (error) {
        showAlert('Error', 'Failed to read ZIP file: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
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
    document.getElementById('uploadProgress').style.display = 'flex';
    setLoading(true, 'Uploading files...');

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        
        // Update progress
        const progress = Math.round(((i + 1) / filesToUpload.length) * 100);
        document.getElementById('progressFill').style.width = progress + '%';
        document.getElementById('progressText').textContent = progress + '%';

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
    document.getElementById('uploadProgress').style.display = 'none';

    if (errorCount === 0) {
        showAlert('Success', `Successfully uploaded ${successCount} files`, 'success');
        addActivity('upload', `Uploaded ${successCount} files`, `${currentRepo.owner}/${currentRepo.repo}`);
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

// Extract and upload ZIP
async function extractAndUploadZip() {
    if (!zipFile) {
        showAlert('Validation Error', 'No ZIP file selected', 'error');
        return;
    }

    const commitMessage = document.getElementById('zipCommitMessage').value;
    const preserveSubfolders = document.getElementById('extractSubfolders').checked;
    const overwrite = document.getElementById('overwriteExisting').checked;
    
    setLoading(true, 'Extracting ZIP file...');
    document.getElementById('zipProgress').style.display = 'flex';
    
    try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(zipFile);
        
        const files = [];
        contents.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
                files.push({
                    path: relativePath,
                    entry: zipEntry
                });
            }
        });
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Update progress
            const progress = Math.round(((i + 1) / files.length) * 100);
            document.getElementById('zipProgressFill').style.width = progress + '%';
            document.getElementById('zipProgressText').textContent = progress + '%';
            
            try {
                // Determine final path
                let finalPath;
                if (preserveSubfolders) {
                    finalPath = currentPath ? `${currentPath}/${file.path}` : file.path;
                } else {
                    const fileName = file.path.split('/').pop();
                    finalPath = currentPath ? `${currentPath}/${fileName}` : fileName;
                }
                
                // Get file content
                const content = await file.entry.async('base64');
                
                // Check if file exists
                let sha = null;
                if (!overwrite) {
                    const checkResponse = await fetch(`https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${finalPath}`, {
                        headers: {
                            'Authorization': `token ${currentRepo.token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    
                    if (checkResponse.ok) {
                        const existing = await checkResponse.json();
                        sha = existing.sha;
                    }
                }
                
                // Upload file
                const body = {
                    message: `${commitMessage}: ${file.path}`,
                    content: content
                };
                
                if (sha) {
                    body.sha = sha;
                }
                
                const response = await fetch(`https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${finalPath}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${currentRepo.token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body)
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || `Failed to upload ${file.path}`);
                }
                
                successCount++;
                
            } catch (error) {
                errorCount++;
                errors.push(`${file.path}: ${error.message}`);
            }
        }
        
        setLoading(false);
        document.getElementById('zipProgress').style.display = 'none';
        
        if (errorCount === 0) {
            showAlert('Success', `Successfully extracted and uploaded ${successCount} files`, 'success');
            addActivity('upload', `Extracted ZIP with ${successCount} files`, `${currentRepo.owner}/${currentRepo.repo}`);
            closeModal('zipUploadModal');
            loadContents(currentPath);
        } else if (successCount > 0) {
            showAlert('Warning', `Extracted ${successCount} files, ${errorCount} failed`, 'warning');
        } else {
            showAlert('Error', 'Failed to extract any files', 'error');
        }
        
    } catch (error) {
        setLoading(false);
        showAlert('Error', 'Failed to process ZIP file: ' + error.message, 'error');
    }
}

// Debounce search
function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        performSearch();
    }, 500);
}

// Perform search in repository
async function performSearch() {
    const query = document.getElementById('globalSearchInput').value.trim();
    if (!query || !currentRepo) return;
    
    setLoading(true, 'Searching...');
    
    try {
        // Search code in repository
        const response = await fetch(`https://api.github.com/search/code?q=${encodeURIComponent(query)}+repo:${currentRepo.owner}/${currentRepo.repo}`, {
            headers: {
                'Authorization': `token ${currentRepo.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Search failed');
        }
        
        const data = await response.json();
        
        document.getElementById('searchStats').innerHTML = `
            <i class="fas fa-search"></i>
            Found ${data.total_count} results for "${query}"
        `;
        
        if (data.items.length === 0) {
            document.getElementById('resultsList').innerHTML = `
                <div class="empty-state small">
                    <i class="fas fa-search"></i>
                    <p>No results found</p>
                </div>
            `;
            return;
        }
        
        const results = await Promise.all(data.items.slice(0, 20).map(async item => {
            try {
                // Get file content to show context
                const contentResponse = await fetch(item.url, {
                    headers: {
                        'Authorization': `token ${currentRepo.token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                if (contentResponse.ok) {
                    const contentData = await contentResponse.json();
                    const content = decodeURIComponent(escape(atob(contentData.content)));
                    
                    // Find line with match
                    const lines = content.split('\n');
                    const matchLine = lines.findIndex(line => 
                        line.toLowerCase().includes(query.toLowerCase())
                    );
                    
                    if (matchLine >= 0) {
                        const context = lines.slice(Math.max(0, matchLine - 2), matchLine + 3).join('\n');
                        return {
                            ...item,
                            context,
                            line: matchLine + 1
                        };
                    }
                }
                return item;
            } catch {
                return item;
            }
        }));
        
        document.getElementById('resultsList').innerHTML = results.map(item => `
            <div class="search-result-item" onclick="editFile('${item.path}', '${item.sha}', event)">
                <div class="result-path">
                    <i class="fas fa-file-code"></i>
                    ${item.path}
                    ${item.line ? `<span class="result-line">Line ${item.line}</span>` : ''}
                </div>
                ${item.context ? `
                    <pre class="result-context"><code>${escapeHtml(item.context)}</code></pre>
                ` : ''}
            </div>
        `).join('');
        
    } catch (error) {
        showAlert('Error', 'Search failed: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

// Hide alert
function hideAlert() {
    document.getElementById('alert').classList.remove('show');
}

// Set loading
function setLoading(loading, message = 'Loading...') {
    const loadingEl = document.getElementById('loading');
    const messageEl = document.getElementById('loadingMessage');
    
    if (loading) {
        messageEl.textContent = message;
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
        
        // Clean up editor if closing edit modal
        if (e.target.id === 'editFileModal' && editor) {
            editor.toTextArea();
            editor = null;
        }
    }
});

// Handle escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
            
            // Clean up editor if closing edit modal
            if (modal.id === 'editFileModal' && editor) {
                editor.toTextArea();
                editor = null;
            }
        });
        document.body.style.overflow = '';
    }
    
    // Keyboard shortcuts in editor
    if (editor && document.getElementById('editFileModal').classList.contains('active')) {
        // Save file: Ctrl+S
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            saveFile();
        }
        
        // Find: Ctrl+F
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            toggleSearchPanel();
            setTimeout(() => document.getElementById('searchInput').focus(), 100);
        }
        
        // Replace: Ctrl+H
        if (e.ctrlKey && e.key === 'h') {
            e.preventDefault();
            toggleSearchPanel();
            document.getElementById('replacePanel').style.display = 'flex';
            setTimeout(() => document.getElementById('replaceInput').focus(), 100);
        }
        
        // Find next: F3 or Ctrl+G
        if (e.key === 'F3' || (e.ctrlKey && e.key === 'g')) {
            e.preventDefault();
            findNext();
        }
        
        // Find previous: Shift+F3 or Ctrl+Shift+G
        if (e.shiftKey && e.key === 'F3' || (e.ctrlKey && e.shiftKey && e.key === 'g')) {
            e.preventDefault();
            findPrev();
        }
        
        // Toggle comment: Ctrl+/
        if (e.ctrlKey && e.key === '/') {
            e.preventDefault();
            editor.toggleComment();
        }
        
        // Duplicate line: Ctrl+D
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            const cursor = editor.getCursor();
            const line = editor.getLine(cursor.line);
            editor.replaceRange(line + '\n' + line, { line: cursor.line, ch: 0 });
        }
        
        // Delete line: Ctrl+Shift+D
        if (e.ctrlKey && e.shiftKey && e.key === 'd') {
            e.preventDefault();
            editor.execCommand('deleteLine');
        }
        
        // Move line up: Alt+Up
        if (e.altKey && e.key === 'ArrowUp') {
            e.preventDefault();
            editor.execCommand('swapLineUp');
        }
        
        // Move line down: Alt+Down
        if (e.altKey && e.key === 'ArrowDown') {
            e.preventDefault();
            editor.execCommand('swapLineDown');
        }
        
        // Indent more: Tab
        if (e.key === 'Tab' && !e.shiftKey) {
            const cursor = editor.getCursor();
            const line = editor.getLine(cursor.line);
            if (cursor.ch === 0) {
                e.preventDefault();
                editor.replaceRange('    ', { line: cursor.line, ch: 0 });
            }
        }
        
        // Indent less: Shift+Tab
        if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            const cursor = editor.getCursor();
            const line = editor.getLine(cursor.line);
            if (line.startsWith('    ')) {
                editor.replaceRange('', { line: cursor.line, ch: 0 }, { line: cursor.line, ch: 4 });
            }
        }
        
        // Auto complete: Ctrl+Space
        if (e.ctrlKey && e.key === ' ') {
            e.preventDefault();
            editor.execCommand('autocomplete');
        }
        
        // Go to line: Ctrl+L
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            const line = prompt('Enter line number:');
            if (line && !isNaN(line)) {
                const lineNum = parseInt(line) - 1;
                if (lineNum >= 0 && lineNum < editor.lineCount()) {
                    editor.setCursor({ line: lineNum, ch: 0 });
                }
            }
        }
        
        // Select all: Ctrl+A
        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            editor.execCommand('selectAll');
        }
        
        // Undo: Ctrl+Z
        if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            editor.undo();
        }
        
        // Redo: Ctrl+Y or Ctrl+Shift+Z
        if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
            e.preventDefault();
            editor.redo();
        }
        
        // Fold code: Ctrl+Shift+[
        if (e.ctrlKey && e.shiftKey && e.key === '[') {
            e.preventDefault();
            editor.execCommand('fold');
        }
        
        // Unfold code: Ctrl+Shift+]
        if (e.ctrlKey && e.shiftKey && e.key === ']') {
            e.preventDefault();
            editor.execCommand('unfold');
        }
        
        // Fold all: Ctrl+Alt+[
        if (e.ctrlKey && e.altKey && e.key === '[') {
            e.preventDefault();
            editor.execCommand('foldAll');
        }
        
        // Unfold all: Ctrl+Alt+]
        if (e.ctrlKey && e.altKey && e.key === ']') {
            e.preventDefault();
            editor.execCommand('unfoldAll');
        }
    }
    
    // Global shortcuts when no modal is active
    if (!document.querySelector('.modal.active')) {
        // Refresh: Ctrl+R
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            if (currentRepo) {
                refreshContents();
            }
        }
        
        // New file: Ctrl+N
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            if (currentRepo) {
                showCreateFileModal();
            }
        }
        
        // New folder: Ctrl+Shift+N
        if (e.ctrlKey && e.shiftKey && e.key === 'n') {
            e.preventDefault();
            if (currentRepo) {
                showCreateFolderModal();
            }
        }
        
        // Upload files: Ctrl+U
        if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            if (currentRepo) {
                showUploadModal();
            }
        }
        
        // Search in repository: Ctrl+Shift+F
        if (e.ctrlKey && e.shiftKey && e.key === 'f') {
            e.preventDefault();
            if (currentRepo) {
                showSearchModal();
            }
        }
        
        // Toggle view mode: Ctrl+Shift+V
        if (e.ctrlKey && e.shiftKey && e.key === 'v') {
            e.preventDefault();
            setViewMode(viewMode === 'grid' ? 'table' : 'grid');
        }
        
        // Focus file search: Ctrl+Shift+S
        if (e.ctrlKey && e.shiftKey && e.key === 's') {
            e.preventDefault();
            document.getElementById('fileSearch').focus();
        }
    }
});

// Handle keyboard shortcuts in modals
document.addEventListener('keydown', (e) => {
    // Close modal with Escape (already handled above)
    
    // Submit forms with Ctrl+Enter
    if (e.ctrlKey && e.key === 'Enter') {
        const activeModal = document.querySelector('.modal.active');
        if (!activeModal) return;
        
        const modalId = activeModal.id;
        
        if (modalId === 'createFileModal') {
            e.preventDefault();
            createFile();
        } else if (modalId === 'editFileModal') {
            e.preventDefault();
            saveFile();
        } else if (modalId === 'createFolderModal') {
            e.preventDefault();
            createFolder();
        } else if (modalId === 'renameModal') {
            e.preventDefault();
            confirmRename();
        } else if (modalId === 'uploadModal') {
            e.preventDefault();
            uploadFiles();
        } else if (modalId === 'zipUploadModal') {
            e.preventDefault();
            extractAndUploadZip();
        }
    }
});

// Handle paste events in editor
document.addEventListener('paste', (e) => {
    if (editor && document.getElementById('editFileModal').classList.contains('active')) {
        const items = e.clipboardData.items;
        for (let item of items) {
            if (item.type.indexOf('image') === 0) {
                e.preventDefault();
                const blob = item.getAsFile();
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    const base64 = e.target.result;
                    const cursor = editor.getCursor();
                    editor.replaceRange(`\n<img src="${base64}" alt="Pasted image">\n`, cursor);
                };
                
                reader.readAsDataURL(blob);
                break;
            }
        }
    }
});

// Handle drop events in editor
document.addEventListener('dragover', (e) => {
    if (editor && document.getElementById('editFileModal').classList.contains('active')) {
        e.preventDefault();
    }
});

document.addEventListener('drop', (e) => {
    if (editor && document.getElementById('editFileModal').classList.contains('active')) {
        e.preventDefault();
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    const base64 = e.target.result;
                    const cursor = editor.getCursor();
                    editor.replaceRange(`\n<img src="${base64}" alt="${file.name}">\n`, cursor);
                };
                
                reader.readAsDataURL(file);
            } else if (file.type === 'text/plain') {
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    const cursor = editor.getCursor();
                    editor.replaceRange(e.target.result, cursor);
                };
                
                reader.readAsText(file);
            }
        }
    }
});

// Auto-save functionality
let autoSaveTimer = null;

function enableAutoSave() {
    if (!editor) return;
    
    editor.on('change', () => {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            if (confirm('Auto-save changes?')) {
                saveFile();
            }
        }, 30000); // Auto-save after 30 seconds of inactivity
    });
}

// Word count in editor
function updateWordCount() {
    if (!editor) return;
    
    const content = editor.getValue();
    const words = content.split(/\s+/).filter(w => w.length > 0).length;
    const chars = content.length;
    const lines = editor.lineCount();
    
    const statusbar = document.querySelector('.editor-statusbar');
    if (statusbar) {
        const wordCountEl = document.getElementById('wordCount');
        if (!wordCountEl) {
            statusbar.innerHTML += `<span id="wordCount">${words} words</span>`;
        } else {
            wordCountEl.textContent = `${words} words, ${chars} chars`;
        }
    }
}

// Toggle fullscreen editor
function toggleFullscreen() {
    const modalContent = document.querySelector('#editFileModal .modal-content');
    if (modalContent) {
        modalContent.classList.toggle('fullscreen');
    }
}

// Add to editor toolbar
function addEditorToolbarButtons() {
    const toolbar = document.querySelector('.modal-header-actions');
    if (toolbar) {
        toolbar.innerHTML += `
            <button class="btn btn-sm" onclick="toggleFullscreen()" title="Fullscreen (F11)">
                <i class="fas fa-expand"></i>
            </button>
        `;
    }
}

// Handle window resize
window.addEventListener('resize', () => {
    if (editor) {
        editor.refresh();
    }
});

// Before unload warning
window.addEventListener('beforeunload', (e) => {
    if (editor && document.getElementById('editFileModal').classList.contains('active')) {
        const content = editor.getValue();
        const originalContent = document.getElementById('editFileContent').defaultValue;
        
        if (content !== originalContent) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        }
    }
});

// Initialize tooltips
document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[title]');
    if (target) {
        const title = target.getAttribute('title');
        if (title && !target.querySelector('.tooltip')) {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = title;
            target.appendChild(tooltip);
            
            setTimeout(() => {
                tooltip.remove();
            }, 2000);
        }
    }
});

// Context menu customization
document.addEventListener('contextmenu', (e) => {
    const target = e.target.closest('.file-card, .file-table tr, .repo-item');
    if (target) {
        e.preventDefault();
        
        // Show custom context menu
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.top = e.pageY + 'px';
        menu.style.left = e.pageX + 'px';
        
        if (target.classList.contains('file-card') || target.classList.contains('folder-row')) {
            const isFolder = target.classList.contains('folder') || target.classList.contains('folder-row');
            
            menu.innerHTML = `
                <div class="context-menu-item" onclick="${isFolder ? 'loadContents' : 'editFile'}">
                    <i class="fas ${isFolder ? 'fa-folder-open' : 'fa-edit'}"></i>
                    ${isFolder ? 'Open' : 'Edit'}
                </div>
                <div class="context-menu-item" onclick="downloadFile">
                    <i class="fas fa-download"></i>
                    Download
                </div>
                <div class="context-menu-divider"></div>
                <div class="context-menu-item" onclick="showRenameModal">
                    <i class="fas fa-tag"></i>
                    Rename
                </div>
                <div class="context-menu-item delete" onclick="deleteItem">
                    <i class="fas fa-trash-alt"></i>
                    Delete
                </div>
            `;
        }
        
        document.body.appendChild(menu);
        
        // Remove menu on click outside
        setTimeout(() => {
            document.addEventListener('click', function removeMenu() {
                menu.remove();
                document.removeEventListener('click', removeMenu);
            });
        }, 100);
    }
});

// Export all functions for global use
window.addRepository = addRepository;
window.toggleTokenVisibility = toggleTokenVisibility;
window.selectRepository = selectRepository;
window.editRepository = editRepository;
window.removeRepository = removeRepository;
window.clearAllRepos = clearAllRepos;
window.exportRepos = exportRepos;
window.importRepos = importRepos;
window.refreshContents = refreshContents;
window.setViewMode = setViewMode;
window.showCreateFileModal = showCreateFileModal;
window.showCreateFolderModal = showCreateFolderModal;
window.showUploadModal = showUploadModal;
window.showZipUploadModal = showZipUploadModal;
window.showSearchModal = showSearchModal;
window.createFile = createFile;
window.createFolder = createFolder;
window.editFile = editFile;
window.saveFile = saveFile;
window.downloadFile = downloadFile;
window.showRenameModal = showRenameModal;
window.confirmRename = confirmRename;
window.deleteItem = deleteItem;
window.handleFileSelect = handleFileSelect;
window.handleZipSelect = handleZipSelect;
window.uploadFiles = uploadFiles;
window.extractAndUploadZip = extractAndUploadZip;
window.filterRepositories = filterRepositories;
window.filterFiles = filterFiles;
window.changeEditorTheme = changeEditorTheme;
window.insertSnippet = insertSnippet;
window.formatCode = formatCode;
window.toggleSearchPanel = toggleSearchPanel;
window.toggleWordWrap = toggleWordWrap;
window.searchInEditor = searchInEditor;
window.findNext = findNext;
window.findPrev = findPrev;
window.replaceInEditor = replaceInEditor;
window.replaceAll = replaceAll;
window.debounceSearch = debounceSearch;
window.performSearch = performSearch;
window.showAlert = showAlert;
window.hideAlert = hideAlert;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleFullscreen = toggleFullscreen;

// Log welcome message
console.log('%c🚀 GitHub Repository Manager v3.0', 'color: #6366f1; font-size: 16px; font-weight: bold;');
console.log('%cProfessional code editor with advanced features', 'color: #6b7280; font-size: 12px;');
console.log('%cKeyboard shortcuts: Ctrl+N (new file), Ctrl+F (search), Ctrl+S (save)', 'color: #10b981; font-size: 11px;');