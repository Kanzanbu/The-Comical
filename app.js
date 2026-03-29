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

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  updateStats();
  renderCollection();
  refreshTimelineSelector();
});

  const grid = document.getElementById('grid');
  let list = comics;

  if (currentFilter !== 'all') list = list.filter(c => c.status === currentFilter);
  if (searchQuery) list = list.filter(c =>
    c.title.toLowerCase().includes(searchQuery) ||
    (c.series || '').toLowerCase().includes(searchQuery)
  );

  if (!list.length) {
    const isEmpty = comics.length === 0;
    grid.innerHTML = `
      <div class="empty-state">
        <span class="big-icon">📦</span>
        <h2>${isEmpty ? 'YOUR BOX IS EMPTY!' : 'NO RESULTS'}</h2>
        <p>${isEmpty ? 'Click "+ ADD ISSUE" to start your collection.' : 'Try a different filter or search.'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(c => {
    const idx = comics.indexOf(c);
    const cv  = c.cover
      ? `<img class="card-cover" src="${esc(c.cover)}" alt="${esc(c.title)}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <div class="cover-placeholder" style="display:none"><span class="icon">📖</span>${esc(c.title)}</div>`
      : `<div class="cover-placeholder"><span class="icon">📖</span>${esc(c.title)}</div>`;

    return `
      <div class="card" onclick="cycleStatus(${idx})">
        <button class="card-delete" onclick="delComic(event,${idx})">✕</button>
        <div class="card-ribbon ribbon-${c.status}">${c.status}</div>
        ${cv}
        <div class="card-body">
          <div class="card-title">${esc(c.title)}</div>
          ${c.series ? `<div class="card-series">${esc(c.series)}</div>` : ''}
          ${c.issue  ? `<div class="card-issue">Issue ${esc(c.issue)}</div>` : ''}
          <span class="status-badge badge-${c.status}">${statusLabel(c.status)}</span>
        </div>
      </div>`;
  }).join('');
}

function cycleStatus(idx) {
  const order = ['unread','reading','read','wishlist'];
  comics[idx].status = order[(order.indexOf(comics[idx].status) + 1) % 4];
  persist(); render();
}

function delComic(e, idx) {
  e.stopPropagation();
  if (!confirm(`Remove "${comics[idx].title}" from your collection?`)) return;
  const id = comics[idx].id;
  comics.splice(idx, 1);
  timelines.forEach(t => { t.entries = t.entries.filter(en => en.comicId !== id); });
  persist(); render();
  if (currentTLId) renderTimeline();
}

function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
}

function handleSearch(v) { searchQuery = v.toLowerCase(); render(); }

function pickStatus(el) {
  document.querySelectorAll('#modal .status-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  selectedStatus = el.dataset.val;
}

/*Modals*/
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); if (id === 'modal') clearAddForm(); }

function clearAddForm() {
  ['f-title','f-series','f-issue','f-cover'].forEach(id => document.getElementById(id).value = '');
  selectedStatus = 'unread';
  document.querySelectorAll('#modal .status-option')
    .forEach(o => o.classList.toggle('selected', o.dataset.val === 'unread'));
}

function saveComic() {
  const title = document.getElementById('f-title').value.trim();
  if (!title) { document.getElementById('f-title').focus(); return; }
  comics.unshift({
    id:     Date.now(),
    title,
    series: document.getElementById('f-series').value.trim(),
    issue:  document.getElementById('f-issue').value.trim(),
    cover:  document.getElementById('f-cover').value.trim(),
    status: selectedStatus
  });
  persist(); render(); closeModal('modal');
}

/*Timeline View*/
function refreshTLSelector() {
  const sel = document.getElementById('tl-select');
  sel.innerHTML = '<option value="">— select a timeline —</option>' +
    timelines.map(tl => `<option value="${tl.id}"${tl.id === currentTLId ? ' selected' : ''}>${esc(tl.name)}</option>`).join('');
  if (currentTLId) renderTimeline();
}

function selectTimeline(val) {
  currentTLId = val ? parseInt(val) : null;
  renderTimeline();
}

function renderTimeline() {
  const container = document.getElementById('timeline-container');
  const addBtn    = document.getElementById('tl-add-btn');
  const delBtn    = document.getElementById('tl-del-btn');

  if (!currentTLId) {
    addBtn.style.display = 'none';
    delBtn.style.display = 'none';
    container.innerHTML = `
      <div class="no-tl-empty">
        <span class="big-icon">📅</span>
        <h2>NO TIMELINE SELECTED</h2>
        <p>Create a new timeline or select one above.</p>
      </div>`;
    return;
  }

  const tl = timelines.find(t => t.id === currentTLId);
  if (!tl) return;
  addBtn.style.display = '';
  delBtn.style.display = '';

  const headerHTML = `
    <div class="tl-header-row">
      <span class="tl-title-text">${esc(tl.name)}</span>
      ${tl.desc ? `<span class="tl-desc-text">${esc(tl.desc)}</span>` : ''}
      <span class="tl-count">${tl.entries.length} issue${tl.entries.length !== 1 ? 's' : ''}</span>
    </div>`;

  if (!tl.entries.length) {
    container.innerHTML = headerHTML + `
      <div class="timeline-empty-inner">
        <span class="big-icon">🕳️</span>
        <h2>EMPTY TIMELINE</h2>
        <p>Click "+ ADD ISSUE" above to start placing issues.</p>
      </div>`;
    return;
  }

  /* Build strip nodes */
  let strip = '';
  let lastYear = null;

  tl.entries.forEach((entry, i) => {
    const comic = comics.find(c => c.id === entry.comicId);
    if (!comic) return;

    /* Optional year badge */
    const yr = entry.date ? (entry.date.match(/\d{4}/) || [''])[0] : null;
    if (yr && yr !== lastYear) {
      strip += `<div class="tl-year-spacer"><div class="tl-year-badge">${yr}</div></div>`;
      lastYear = yr;
    }

    const above = i % 2 === 0;
    const cv = comic.cover
      ? `<img class="tl-cover" src="${esc(comic.cover)}" alt="${esc(comic.title)}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <div class="tl-cover-ph" style="display:none">📖</div>`
      : `<div class="tl-cover-ph">📖</div>`;

    const infoHTML = `
      <div class="tl-info">
        <div class="tl-ctitle">${esc(comic.title)}</div>
        ${comic.issue  ? `<div class="tl-cissue">#${esc(comic.issue)}</div>` : ''}
        ${entry.date   ? `<div class="tl-cdate">${esc(entry.date)}</div>`   : ''}
        ${entry.note   ? `<div class="tl-cnote">${esc(entry.note)}</div>`   : ''}
      </div>`;

    const cardHTML = `
      <div class="tl-card">
        ${cv}${infoHTML}
        <button class="tl-remove" onclick="removeTLEntry(event,${i})">✕</button>
      </div>`;

    const spacer = `<div style="width:128px;height:1px"></div>`;
    const armDown = `<div class="tl-arm"></div>`;
    const armUp   = `<div class="tl-arm"></div>`;

    if (above) {
      strip += `
        <div class="tl-item">
          ${cardHTML}
          ${armDown}
          <div class="tl-dot dot-${comic.status}"></div>
          ${armDown}
          ${spacer}
        </div>`;
    } else {
      strip += `
        <div class="tl-item">
          ${spacer}
          ${armUp}
          <div class="tl-dot dot-${comic.status}"></div>
          ${armUp}
          ${cardHTML}
        </div>`;
    }
  });

/* Add-more node */
  strip += `
    <div class="tl-add-node" onclick="openAddToTLModal()">
      <div class="tl-add-ring">+</div>
      <div class="tl-add-text">Add Issue</div>
    </div>`;

  container.innerHTML = headerHTML + `<div class="tl-strip-wrap"><div class="tl-strip">${strip}</div></div>`;
}

function removeTLEntry(e, idx) {
  e.stopPropagation();
  const tl = timelines.find(t => t.id === currentTLId);
  if (!tl) return;
  tl.entries.splice(idx, 1);
  persist(); renderTimeline();
}


