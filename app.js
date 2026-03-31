// ===== THEME MANAGEMENT =====
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDarkMode = document.body.classList.contains('dark-mode');
  localStorage.setItem('dark-mode', isDarkMode);
  updateThemeIcon();
}

function updateThemeIcon() {
  const toggle = document.getElementById('theme-toggle');
  if (document.body.classList.contains('dark-mode')) {
    toggle.textContent = '☀️';
    toggle.title = 'Toggle Light Mode';
  } else {
    toggle.textContent = '🌙';
    toggle.title = 'Toggle Dark Mode';
  }
}

function initializeTheme() {
  const darkModeSetting = localStorage.getItem('dark-mode');
  if (darkModeSetting === 'true') {
    document.body.classList.add('dark-mode');
  }
  updateThemeIcon();
}

// ===== STATE MANAGEMENT =====
let comics = JSON.parse(localStorage.getItem('comics') || '[]');
let timelines = JSON.parse(localStorage.getItem('comic-timelines') || '[]');
let currentFilter = 'all';
let searchQuery = '';
let selectedTimelineId = null;
let editingComicId = null;

// ===== ENCYCLOPEDIA STATE =====
let encyclopediaData = null;
let encyclopediaCurrentFilter = 'all';
let encyclopediaSearchQuery = '';

// ===== UTILITY FUNCTIONS =====
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

function looksLikeDateTime(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?)?$/.test(value);
}

function normalizeCharacterName(character) {
  if (!character) return 'Unknown';
  if (looksLikeDateTime(character.name) && character.first_appearance) {
    return character.first_appearance;
  }
  return character.name || 'Unknown';
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
  document.getElementById('view-encyclopedia').style.display = tab === 'encyclopedia' ? 'block' : 'none';
  
  if (tab === 'timeline') {
    refreshTimelineSelector();
  } else if (tab === 'encyclopedia') {
    loadEncyclopediaData();
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
      ${comic.imageUrl ? `<img src="${escapeHtml(comic.imageUrl)}" alt="${escapeHtml(comic.title)} cover" class="card-cover-img" onerror="this.style.display='none'"/>` : `
      <div class="cover-placeholder">
        <span class="icon">📖</span>
        <span>${escapeHtml(comic.series || 'Comic')}</span>
      </div>
      `}
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
  try {
    editingComicId = null;
    const titleElement = document.getElementById('modal-title');
    if (titleElement) {
      titleElement.textContent = 'Add New Issue';
    }
    clearComicForm();
    openModal('modal-issue');
  } catch (error) {
    console.error('Error opening add issue modal:', error);
    showToast('Error opening form!', 'error');
  }
}

function clearComicForm() {
  try {
    const fields = [
      'issue-title',
      'issue-series',
      'issue-number',
      'issue-author',
      'issue-artist',
      'issue-date',
      'issue-description',
      'issue-rating'
    ];
    
    fields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.value = '';
      }
    });
    
    const statusField = document.getElementById('issue-status');
    if (statusField) {
      statusField.value = 'unread';
    }
  } catch (error) {
    console.error('Error clearing form:', error);
  }
}

function saveIssue(event) {
  event.preventDefault();
  
  try {
    const title = document.getElementById('issue-title').value.trim();
    if (!title) {
      showToast('Comic title is required!', 'error');
      return;
    }
    
    const issueNumberValue = document.getElementById('issue-number').value.trim();
    const ratingValue = document.getElementById('issue-rating').value.trim();
    
    const comic = {
      id: editingComicId || generateId(),
      title,
      series: document.getElementById('issue-series').value.trim() || '',
      issueNumber: issueNumberValue ? parseInt(issueNumberValue) : null,
      author: document.getElementById('issue-author').value.trim() || '',
      artist: document.getElementById('issue-artist').value.trim() || '',
      releaseDate: document.getElementById('issue-date').value || '',
      status: document.getElementById('issue-status').value,
      description: document.getElementById('issue-description').value.trim() || '',
      imageUrl: document.getElementById('issue-image').value.trim() || '',
      rating: ratingValue ? parseFloat(ratingValue) : null
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
  } catch (error) {
    console.error('Error saving issue:', error);
    showToast('Error saving comic!', 'error');
  }
}

function editComic(id) {
  try {
    const comic = comics.find(c => c.id === id);
    if (!comic) {
      showToast('Comic not found!', 'error');
      return;
    }
    
    editingComicId = id;
    document.getElementById('modal-title').textContent = 'Edit Issue';
    document.getElementById('issue-title').value = comic.title || '';
    document.getElementById('issue-series').value = comic.series || '';
    document.getElementById('issue-number').value = comic.issueNumber || '';
    document.getElementById('issue-author').value = comic.author || '';
    document.getElementById('issue-artist').value = comic.artist || '';
    document.getElementById('issue-date').value = comic.releaseDate || '';
    document.getElementById('issue-status').value = comic.status || 'unread';
    document.getElementById('issue-description').value = comic.description || '';
    document.getElementById('issue-image').value = comic.imageUrl || '';
    document.getElementById('issue-rating').value = comic.rating || '';
    
    openModal('modal-issue');
  } catch (error) {
    console.error('Error editing comic:', error);
    showToast('Error opening comic for editing!', 'error');
  }
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
  // Convert string ID to number if it's not empty
  selectedTimelineId = id && id !== '' ? parseInt(id) : null;
  const addBtn = document.getElementById('tl-add-btn');
  const delBtn = document.getElementById('tl-del-btn');

  if (id && id !== '') {
    addBtn.style.display = 'block';
    delBtn.style.display = 'block';
    renderTimeline(parseInt(id));
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
  
  const timelineHTML = `
    <div class="timeline-header">
      <h2>${escapeHtml(timeline.name)}</h2>
      ${timeline.description ? `<p class="timeline-description">${escapeHtml(timeline.description)}</p>` : ''}
    </div>
    <div class="visual-timeline">
      <div class="timeline-line"></div>
      <div class="timeline-issues">
        ${timeline.issues.map((issueId, index) => {
          const comic = comics.find(c => c.id === issueId);
          if (!comic) return '';
          const isEven = index % 2 === 0;
          const statusColor = comic.status === 'read' ? '#1a4d4d' : comic.status === 'reading' ? '#1a3d66' : comic.status === 'wishlist' ? '#661111' : '#444';
          return `
            <div class="timeline-node ${isEven ? 'left' : 'right'}" style="--order: ${index}">
              <div class="timeline-node-dot"></div>
              <div class="timeline-node-card" style="--status-color: ${statusColor}">
                <div class="node-card-number">${index + 1}</div>
                <div class="node-card-content">
                  <div class="node-card-title">${escapeHtml(comic.title)}</div>
                  <div class="node-card-series">${comic.series ? escapeHtml(comic.series) : 'Comic'}${comic.issueNumber ? ` #${comic.issueNumber}` : ''}</div>
                  <div class="node-card-status badge-${comic.status}">${getStatusLabel(comic.status)}</div>
                  ${comic.releaseDate ? `<div class="node-card-date">${comic.releaseDate}</div>` : ''}
                  ${comic.rating ? `<div class="node-card-rating">⭐ ${comic.rating}/5</div>` : ''}
                </div>
                <button class="node-card-remove" onclick="removeFromTimeline(${timelineId}, ${issueId})" title="Remove from timeline">✕</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  
  container.innerHTML = timelineHTML;
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
  try {
    if (!selectedTimelineId) {
      showToast('Select a timeline first!', 'error');
      return;
    }

    // Find the timeline and validate it exists
    const timeline = timelines.find(t => t.id === selectedTimelineId);
    if (!timeline) {
      // If timeline not found, refresh selector and show error
      refreshTimelineSelector();
      showToast('Timeline not found! Please select a timeline from the dropdown.', 'error');
      return;
    }

    // Get available comics (not already in timeline)
    const availableComics = comics.filter(c => !timeline.issues.includes(c.id));

    if (availableComics.length === 0) {
      showToast('All comics are already in this timeline!', 'error');
      return;
    }

    const select = document.getElementById('timeline-issue-select');
    if (!select) {
      showToast('Form element not found!', 'error');
      return;
    }

    // Populate select with available comics
    select.innerHTML = '<option value="">Choose an issue...</option>' +
      availableComics.map(c => `<option value="${c.id}">${escapeHtml(c.title)} - ${escapeHtml(c.series || 'N/A')}</option>`).join('');

    // Set default order
    const orderField = document.getElementById('timeline-order');
    if (orderField) {
      orderField.value = timeline.issues.length + 1;
    }

openModal('modal-add-to-timeline');
  } catch (error) {
    console.error('Error opening add to timeline modal:', error);
    showToast('Error opening form!', 'error');
  }
}

function addIssueToTimeline(event) {
  event.preventDefault();
  
  try {
    if (!selectedTimelineId) {
      showToast('No timeline selected!', 'error');
      return;
    }
    
    const comicId = parseInt(document.getElementById('timeline-issue-select').value);
    if (!comicId) {
      showToast('Select an issue!', 'error');
      return;
    }
    
    const timeline = timelines.find(t => t.id === selectedTimelineId);
    if (!timeline) {
      showToast('Timeline not found!', 'error');
      return;
    }
    
    // Check if already in timeline
    if (timeline.issues.includes(comicId)) {
      showToast('Issue already in timeline!', 'error');
      return;
    }
    
    // Add the issue to timeline
    timeline.issues.push(comicId);
    showToast('Issue added to timeline!');
    
    // Save and refresh
    persist();
    renderTimeline(selectedTimelineId);
    closeModal('modal-add-to-timeline');
    
    // Clear the form for next use
    document.getElementById('timeline-issue-select').value = '';
    document.getElementById('timeline-order').value = '';
  } catch (error) {
    console.error('Error adding issue to timeline:', error);
    showToast('Error adding issue!', 'error');
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
      rating: 5,
      imageUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a5/Watchmen%2C_issue_1.png'
    }
  ];
  
  const sampleTimelines = [
    {
      id: Date.now(),
      name: 'Marvel Origin Story',
      description: 'The birth of Marvel heroes',
      issues: [1, 2]
    },
    {
      id: Date.now() + 1,
      name: 'DC Legends',
      description: 'The greatest DC heroes',
      issues: [3, 4, 5]
    }
  ];
  
  comics = sampleComics;
  timelines = sampleTimelines;
  persist();
}

// ===== ENCYCLOPEDIA FUNCTIONS =====
async function loadEncyclopediaData() {
  if (encyclopediaData) {
    renderEncyclopedia();
    return;
  }
  
  try {
    const response = await fetch('Database/encyclopedia_data.json');
    if (!response.ok) {
      throw new Error('Failed to load encyclopedia data');
    }
    encyclopediaData = await response.json();
    renderEncyclopedia();
  } catch (error) {
    console.error('Error loading encyclopedia data:', error);
    document.getElementById('encyclopedia-content').innerHTML = `
      <div class="empty-state">
        <div class="big-icon">📚</div>
        <h2>ENCYCLOPEDIA UNAVAILABLE</h2>
        <p>Could not load encyclopedia data. Make sure encyclopedia_data.json exists in the Database folder.</p>
      </div>
    `;
  }
}

function renderEncyclopedia() {
  if (!encyclopediaData) return;
  
  // Update stats
  const statsEl = document.getElementById('encyclopedia-stats');
  statsEl.innerHTML = `
    <div class="ency-stat">🏢 <strong>${encyclopediaData.publishers.length}</strong> Publishers</div>
    <div class="ency-stat">📚 <strong>${encyclopediaData.series.length}</strong> Series</div>
    <div class="ency-stat">🦸 <strong>${encyclopediaData.characters.length}</strong> Characters</div>
    <div class="ency-stat">✏️ <strong>${encyclopediaData.creators.length}</strong> Creators</div>
    <div class="ency-stat">🌍 <strong>${encyclopediaData.universes.length}</strong> Universes</div>
    <div class="ency-stat">👥 <strong>${encyclopediaData.groups.length}</strong> Groups</div>
  `;
  
  // Update last updated date
  if (encyclopediaData.last_updated) {
    document.getElementById('ency-last-updated').textContent = encyclopediaData.last_updated;
  }
  
  renderEncyclopediaContent();
}

function renderEncyclopediaContent() {
  const content = document.getElementById('encyclopedia-content');
  const statusText = document.getElementById('encyclopedia-results');
  if (!encyclopediaData) return;
  
  let sections = [];
  const filter = encyclopediaCurrentFilter;
  const query = encyclopediaSearchQuery.trim().toLowerCase();

  const sortByName = (items) => items.slice().sort((a, b) => (String(a.name || '').localeCompare(String(b.name || ''))));
  const filterByQuery = (items, fields) => {
    if (!query) return items;
    return items.filter(item => 
      fields.some(field => {
        const val = item[field];
        return val && String(val).toLowerCase().includes(query);
      })
    );
  };
  
  if (filter === 'all' || filter === 'publishers') {
    const publishers = filterByQuery(encyclopediaData.publishers || [], ['name', 'notes']);
    const sortedPub = sortByName(publishers);
    if (sortedPub.length > 0) {
      sections.push({
        title: '🏢 Publishers',
        id: 'publishers',
        items: sortedPub.map(p => ({
          name: p.name || 'Unknown Publisher',
          subtitle: p.is_comics_publisher ? 'Comics Publisher' : 'Publisher',
          description: p.notes || 'No additional info available.'
        }))
      });
    }
  }
  
  if (filter === 'all' || filter === 'series') {
    const series = filterByQuery(encyclopediaData.series || [], ['name', 'year_began', 'year_ended']);
    const sortedSeries = sortByName(series);
    if (sortedSeries.length > 0) {
      sections.push({
        title: '📚 Comic Series',
        id: 'series',
        items: sortedSeries.map(s => {
          const publisher = (encyclopediaData.publishers || []).find(p => p.id === s.publisher_id);
          return {
            name: s.name || 'Untitled Series',
            subtitle: publisher ? publisher.name : 'Unknown Publisher',
            description: `${s.year_began || '?'} - ${s.year_ended || 'Present'}`
          };
        })
      });
    }
  }
  
  if (filter === 'all' || filter === 'characters') {
    const characters = filterByQuery(encyclopediaData.characters || [], ['name', 'first_appearance']);
    const sortedCharacters = sortByName(characters);
    if (sortedCharacters.length > 0) {
      sections.push({
        title: '🦸 Characters',
        id: 'characters',
        items: sortedCharacters.map(c => ({
          name: normalizeCharacterName(c),
          subtitle: 'Character',
          description: `First appearance: ${c.first_appearance || 'Unknown'}`
        }))
      });
    }
  }
  
  if (filter === 'all' || filter === 'creators') {
    const creators = filterByQuery(encyclopediaData.creators || [], ['name', 'birth_date', 'death_date']);
    const sortedCreators = sortByName(creators);
    if (sortedCreators.length > 0) {
      sections.push({
        title: '✏️ Creators',
        id: 'creators',
        items: sortedCreators.map(c => ({
          name: c.name || 'Unknown Creator',
          subtitle: 'Creator',
          description: formatDateRange(c.birth_date, c.death_date)
        }))
      });
    }
  }
  
  if (filter === 'all' || filter === 'universes') {
    const universes = filterByQuery(encyclopediaData.universes || [], ['name', 'description']);
    const sortedUniverses = sortByName(universes);
    if (sortedUniverses.length > 0) {
      sections.push({
        title: '🌍 Universes',
        id: 'universes',
        items: sortedUniverses.map(u => ({
          name: u.name || 'Unknown Universe',
          subtitle: 'Universe',
          description: u.description || 'No description.'
        }))
      });
    }
  }
  
  if (filter === 'all' || filter === 'groups') {
    const groups = filterByQuery(encyclopediaData.groups || [], ['name', 'description']);
    const sortedGroups = sortByName(groups);
    if (sortedGroups.length > 0) {
      sections.push({
        title: '👥 Groups & Teams',
        id: 'groups',
        items: sortedGroups.map(g => ({
          name: g.name || 'Unknown Group',
          subtitle: 'Team',
          description: g.description || 'No description.'
        }))
      });
    }
  }
  
  const totalCount = sections.reduce((sum, section) => sum + section.items.length, 0);
  if (statusText) {
    statusText.textContent = `Showing ${totalCount} ${totalCount === 1 ? 'entry' : 'entries'} (${filter === 'all' ? 'all categories' : filter})`;
  }
  
  if (sections.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">🔍</div>
        <h2>NO RESULTS FOUND</h2>
        <p>No encyclopedia entries match your search criteria.</p>
      </div>
    `;
    return;
  }
  
  content.innerHTML = sections.map(section => `
    <div class="encyclopedia-section">
      <h2 class="encyclopedia-section-title">${section.title}</h2>
      <div class="encyclopedia-list">
        ${section.items.map(item => `
          <div class="encyclopedia-item">
            <div class="ency-item-header">
              <h3 class="ency-item-name">${escapeHtml(item.name)}</h3>
              <span class="ency-item-subtitle">${escapeHtml(item.subtitle)}</span>
            </div>
            ${item.description ? `<p class="ency-item-description">${escapeHtml(item.description)}</p>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function formatDateRange(birth, death) {
  if (!birth) return 'Unknown dates';
  const birthYear = birth.substring(0, 4);
  if (death) {
    const deathYear = death.substring(0, 4);
    return `${birthYear} - ${deathYear}`;
  }
  return `b. ${birthYear}`;
}

function filterEncyclopedia(filter, button) {
  encyclopediaCurrentFilter = filter;
  
  // Update button states
  document.querySelectorAll('.ency-filter-btn').forEach(btn => btn.classList.remove('active'));
  if (button) button.classList.add('active');
  
  // Update search query from input
  const searchInput = document.getElementById('encyclopedia-search');
  if (searchInput) {
    encyclopediaSearchQuery = searchInput.value;
  }
  
  renderEncyclopediaContent();
}

function searchEncyclopedia(query) {
  encyclopediaSearchQuery = query;
  renderEncyclopediaContent();
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme
  initializeTheme();
  
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


