// ===== STATE MANAGEMENT =====
let comics = JSON.parse(localStorage.getItem('comics') || '[]');
let timelines = JSON.parse(localStorage.getItem('comic-timelines') || '[]');
let currentFilter = 'all';
let searchQuery = '';
let selectedTimelineId = null;
let editingComicId = null;

// ===== UTILITY FUNCTIONS =====
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show';
  if (type === 'error') toast.style.background = 'var(--red)';
  else toast.style.background = 'var(--green)';
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function persist() {
  localStorage.setItem('comics', JSON.stringify(comics));
  localStorage.setItem('comic-timelines', JSON.stringify(timelines));
  updateStats();
}

function updateStats() {
  document.getElementById('stat-total').textContent = comics.length;
  document.getElementById('stat-read').textContent = comics.filter(c => c.status === 'read').length;
  document.getElementById('stat-wishlist').textContent = comics.filter(c => c.status === 'wishlist').length;
}

// ===== MODAL FUNCTIONS =====
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
}

// ===== TAB SWITCHING =====
function switchTab(tab, button) {
  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  button.classList.add('active');
  
  // Hide/show content
  document.getElementById('view-collection').style.display = tab === 'collection' ? 'block' : 'none';
  document.getElementById('view-timeline').style.display = tab === 'timeline' ? 'block' : 'none';
  
  if (tab === 'timeline') {
    refreshTimelineSelector();
  }
}

// ===== COLLECTION VIEW =====
function renderCollection() {
  const grid = document.getElementById('issuesGrid');
  
  let filtered = comics.slice();
  
  // Apply status filter
  if (currentFilter !== 'all') {
    filtered = filtered.filter(c => c.status === currentFilter);
  }
  
  // Apply search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(c => 
      c.title.toLowerCase().includes(q) ||
      (c.series && c.series.toLowerCase().includes(q)) ||
      (c.author && c.author.toLowerCase().includes(q))
    );
  }
  
  // Sort by title
  filtered.sort((a, b) => a.title.localeCompare(b.title));
  
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">📚</div>
        <h2>NO ISSUES YET</h2>
        <p>Start tracking your comics collection!</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = filtered.map(comic => `
    <div class="card" onclick="editComic(${comic.id})">
      <div class="cover-placeholder">
        <span class="icon">📖</span>
        <span>${escapeHtml(comic.series || 'Comic')}</span>
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(comic.title)}</div>
        ${comic.series ? `<div class="card-series">${escapeHtml(comic.series)}</div>` : ''}
        ${comic.issueNumber ? `<div class="card-issue">#${comic.issueNumber}</div>` : ''}
        <span class="status-badge badge-${comic.status}">
          ${getStatusLabel(comic.status)}
        </span>
        ${comic.rating ? `<div style="font-size: 0.85rem; margin-top: 4px;">⭐ ${comic.rating}/5</div>` : ''}
      </div>
      <button class="card-delete" onclick="deleteComic(event, ${comic.id})">✕</button>
    </div>
  `).join('');
}

function getStatusLabel(status) {
  const labels = {
    'read': '✓ Read',
    'reading': '👀 Reading',
    'unread': '○ Unread',
    'wishlist': '⭐ Wishlist'
  };
  return labels[status] || status;
}

function filterIssues(type, value) {
  if (type === 'search') {
    searchQuery = value;
  } else {
    currentFilter = type;
    // Update button active states
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
  }
  renderCollection();
}

// ===== COMIC CRUD =====
function generateId() {
  return Date.now();
}

function onAddBtn() {
  editingComicId = null;
  document.getElementById('modal-title').textContent = 'Add New Issue';
  clearComicForm();
  openModal('modal-issue');
}

function clearComicForm() {
  document.getElementById('issue-title').value = '';
  document.getElementById('issue-series').value = '';
  document.getElementById('issue-number').value = '';
  document.getElementById('issue-author').value = '';
  document.getElementById('issue-artist').value = '';
  document.getElementById('issue-date').value = '';
  document.getElementById('issue-status').value = 'unread';
  document.getElementById('issue-description').value = '';
  document.getElementById('issue-rating').value = '';
}

function saveIssue(event) {
  event.preventDefault();
  
  const title = document.getElementById('issue-title').value.trim();
  if (!title) {
    showToast('Comic title is required!', 'error');
    return;
  }
  
  const comic = {
    id: editingComicId || generateId(),
    title,
    series: document.getElementById('issue-series').value.trim(),
    issueNumber: document.getElementById('issue-number').value,
    author: document.getElementById('issue-author').value.trim(),
    artist: document.getElementById('issue-artist').value.trim(),
    releaseDate: document.getElementById('issue-date').value,
    status: document.getElementById('issue-status').value,
    description: document.getElementById('issue-description').value.trim(),
    rating: parseFloat(document.getElementById('issue-rating').value) || null
  };
  
  if (editingComicId) {
    const index = comics.findIndex(c => c.id === editingComicId);
    if (index !== -1) {
      comics[index] = comic;
      showToast('Comic updated!');
    }
  } else {
    comics.push(comic);
    showToast('Comic added!');
  }
  
  persist();
  renderCollection();
  closeModal('modal-issue');
}

function editComic(id) {
  const comic = comics.find(c => c.id === id);
  if (!comic) return;
  
  editingComicId = id;
  document.getElementById('modal-title').textContent = 'Edit Issue';
  document.getElementById('issue-title').value = comic.title;
  document.getElementById('issue-series').value = comic.series || '';
  document.getElementById('issue-number').value = comic.issueNumber || '';
  document.getElementById('issue-author').value = comic.author || '';
  document.getElementById('issue-artist').value = comic.artist || '';
  document.getElementById('issue-date').value = comic.releaseDate || '';
  document.getElementById('issue-status').value = comic.status;
  document.getElementById('issue-description').value = comic.description || '';
  document.getElementById('issue-rating').value = comic.rating || '';
  
  openModal('modal-issue');
}

function deleteComic(event, id) {
  event.stopPropagation();
  if (confirm('Delete this comic from your collection?')) {
    comics = comics.filter(c => c.id !== id);
    persist();
    renderCollection();
    showToast('Comic deleted!');
  }
}

// ===== TIMELINE FUNCTIONS =====
function refreshTimelineSelector() {
  const selector = document.getElementById('tl-select');
  selector.innerHTML = '<option value="">Choose a timeline...</option>' + 
    timelines.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
}

function selectTimeline(id) {
  selectedTimelineId = id || null;
  const addBtn = document.getElementById('tl-add-btn');
  const delBtn = document.getElementById('tl-del-btn');
  
  if (id) {
    addBtn.style.display = 'block';
    delBtn.style.display = 'block';
    renderTimeline(id);
  } else {
    addBtn.style.display = 'none';
    delBtn.style.display = 'none';
    document.getElementById('timeline-container').innerHTML = `
      <div class="no-tl-empty">
        <h2>SELECT A TIMELINE</h2>
        <p>Choose a timeline from the dropdown to view its reading order.</p>
      </div>
    `;
  }
}

function renderTimeline(timelineId) {
  const timeline = timelines.find(t => t.id === timelineId);
  if (!timeline) return;
  
  const container = document.getElementById('timeline-container');
  
  if (!timeline.issues || timeline.issues.length === 0) {
    container.innerHTML = `
      <div class="no-tl-empty">
        <h2>${escapeHtml(timeline.name)}</h2>
        <p>No issues in this timeline yet. Add some!</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '<h2 style="padding: 0 0 16px 0;border-bottom: var(--border);margin-bottom: 16px;">' + 
    escapeHtml(timeline.name) + '</h2>' +
    timeline.issues.map((issueId, index) => {
      const comic = comics.find(c => c.id === issueId);
      if (!comic) return '';
      return `
        <div class="timeline-entry">
          <div class="timeline-entry-number">${index + 1}</div>
          <div class="timeline-entry-info">
            <div class="timeline-entry-title">${escapeHtml(comic.title)}</div>
            <div class="timeline-entry-meta">
              ${comic.series ? `${escapeHtml(comic.series)}` : ''} 
              ${comic.issueNumber ? `#${comic.issueNumber}` : ''}
              ${comic.status ? `• ${getStatusLabel(comic.status)}` : ''}
            </div>
          </div>
          <button style="background: var(--red); color: #fff; border: var(--border); padding: 6px 12px; cursor: pointer;" onclick="removeFromTimeline(${timelineId}, ${issueId})">Remove</button>
        </div>
      `;
    }).join('');
}

function openNewTimelineModal() {
  document.getElementById('timeline-name').value = '';
  document.getElementById('timeline-description').value = '';
  openModal('modal-timeline');
}

function saveTimeline(event) {
  event.preventDefault();
  
  const name = document.getElementById('timeline-name').value.trim();
  if (!name) {
    showToast('Timeline name is required!', 'error');
    return;
  }
  
  const timeline = {
    id: generateId(),
    name,
    description: document.getElementById('timeline-description').value.trim(),
    issues: []
  };
  
  timelines.push(timeline);
  showToast('Timeline created!');
  persist();
  refreshTimelineSelector();
  closeModal('modal-timeline');
}

function openAddToTimelineModal() {
  if (!selectedTimelineId) {
    showToast('Select a timeline first!', 'error');
    return;
  }
  
  const select = document.getElementById('timeline-issue-select');
  const timeline = timelines.find(t => t.id === selectedTimelineId);
  const availableComics = comics.filter(c => !timeline.issues.includes(c.id));
  
  select.innerHTML = '<option value="">Choose an issue...</option>' +
    availableComics.map(c => `<option value="${c.id}">${escapeHtml(c.title)} - ${escapeHtml(c.series || 'N/A')}</option>`).join('');
  
  document.getElementById('timeline-order').value = timeline.issues.length + 1;
  openModal('modal-add-to-timeline');
}

function addIssueToTimeline(event) {
  event.preventDefault();
  
  if (!selectedTimelineId) return;
  
  const comicId = parseInt(document.getElementById('timeline-issue-select').value);
  if (!comicId) {
    showToast('Select an issue!', 'error');
    return;
  }
  
  const timeline = timelines.find(t => t.id === selectedTimelineId);
  if (timeline && !timeline.issues.includes(comicId)) {
    timeline.issues.push(comicId);
    showToast('Issue added to timeline!');
    persist();
    renderTimeline(selectedTimelineId);
    closeModal('modal-add-to-timeline');
  }
}

function removeFromTimeline(timelineId, comicId) {
  const timeline = timelines.find(t => t.id === timelineId);
  if (timeline) {
    timeline.issues = timeline.issues.filter(id => id !== comicId);
    persist();
    renderTimeline(timelineId);
    showToast('Issue removed from timeline!');
  }
}

function deleteTimeline() {
  if (confirm('Delete this timeline?')) {
    timelines = timelines.filter(t => t.id !== selectedTimelineId);
    selectedTimelineId = null;
    document.getElementById('tl-select').value = '';
    document.getElementById('timeline-container').innerHTML = `
      <div class="no-tl-empty">
        <h2>SELECT A TIMELINE</h2>
        <p>Choose a timeline from the dropdown.</p>
      </div>
    `;
    document.getElementById('tl-add-btn').style.display = 'none';
    document.getElementById('tl-del-btn').style.display = 'none';
    persist();
    refreshTimelineSelector();
    showToast('Timeline deleted!');
  }
}

// ===== DATA MANAGEMENT =====
function openSettingsModal() {
  document.getElementById('total-count').textContent = comics.length;
  document.getElementById('read-count').textContent = comics.filter(c => c.status === 'read').length;
  document.getElementById('reading-count').textContent = comics.filter(c => c.status === 'reading').length;
  document.getElementById('wishlist-count').textContent = comics.filter(c => c.status === 'wishlist').length;
  document.getElementById('timeline-count').textContent = timelines.length;
  openModal('modal-settings');
}

function exportData() {
  const data = {
    comics,
    timelines,
    exportDate: new Date().toISOString(),
    version: '1.0'
  };
  
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `comic-collection-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Collection exported!');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.comics && data.timelines) {
          comics = data.comics;
          timelines = data.timelines;
          persist();
          renderCollection();
          refreshTimelineSelector();
          updateStats();
          showToast('Collection imported successfully!');
          closeModal('modal-settings');
        } else {
          showToast('Invalid file format!', 'error');
        }
      } catch (err) {
        showToast('Error reading file!', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function clearAllData() {
  if (confirm('⚠️ This will DELETE all your comics and timelines. Are you sure?')) {
    if (confirm('Are you REALLY sure? This cannot be undone!')) {
      comics = [];
      timelines = [];
      currentFilter = 'all';
      searchQuery = '';
      selectedTimelineId = null;
      editingComicId = null;
      persist();
      renderCollection();
      refreshTimelineSelector();
      updateStats();
      closeModal('modal-settings');
      showToast('All data cleared!');
    }
  }
}

// ===== SAMPLE DATA =====
function initializeSampleData() {
  const sampleComics = [
    {
      id: 1,
      title: 'The Amazing Spider-Man',
      series: 'Marvel',
      issueNumber: 1,
      author: 'Stan Lee',
      artist: 'Steve Ditko',
      releaseDate: '1962-06-01',
      status: 'read',
      description: 'The first appearance of Spider-Man!',
      rating: 5
    },
    {
      id: 2,
      title: 'X-Men #1',
      series: 'Marvel',
      issueNumber: 1,
      author: 'Stan Lee',
      artist: 'Jack Kirby',
      releaseDate: '1963-09-01',
      status: 'read',
      description: 'The birth of the X-Men',
      rating: 5
    },
    {
      id: 3,
      title: 'Detective Comics',
      series: 'DC',
      issueNumber: 27,
      author: 'Bob Kane',
      artist: 'Jerry Robinson',
      releaseDate: '1939-05-01',
      status: 'read',
      description: 'First appearance of Batman',
      rating: 5
    },
    {
      id: 4,
      title: 'Action Comics',
      series: 'DC',
      issueNumber: 1,
      author: 'Jerry Siegel',
      artist: 'Joe Shuster',
      releaseDate: '1938-06-01',
      status: 'reading',
      description: 'The first appearance of Superman',
      rating: 5
    },
    {
      id: 5,
      title: 'Watchmen',
      series: 'DC',
      issueNumber: 1,
      author: 'Alan Moore',
      artist: 'Dave Gibbons',
      releaseDate: '1986-09-01',
      status: 'read',
      description: 'Groundbreaking superhero deconstruction',
      rating: 5
    }
  ];
  
  comics = sampleComics;
  persist();
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  // Load or initialize with sample data on first visit
  if (comics.length === 0) {
    initializeSampleData();
  }
  
  updateStats();
  renderCollection();
  refreshTimelineSelector();
  
  // Mobile menu improvements
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.blur();
      }
    });
  }
  
  // Prevent double-tap zoom on buttons (improves responsiveness)
  document.addEventListener('touchend', (e) => {
    if (e.target.matches('button, input, select, textarea')) {
      e.preventDefault();
    }
  }, false);
});

// Close modals when clicking outside
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
});


