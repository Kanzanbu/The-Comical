/*state*/
let comics    = JSON.parse(localStorage.getItem('comic')     || '[]');
let timelines = JSON.parse(localStorage.getItem('comic-timelines') || '[]');

let currentFilter = 'all';
let searchQuery   = '';
let selectedStatus = 'unread';
let currentTab    = 'collection';
let currentTLId   = null;

/*persist*/
function persist() {
  localStorage.setItem('comic',            JSON.stringify(comics));
  localStorage.setItem('comic-timelines',  JSON.stringify(timelines));
  updateStats();
}

/*helpers*/
function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function statusLabel(s) {
  return { read:'Read', reading:'Reading', unread:'Unread', wishlist:'Wishlist' }[s] || s;
}

/*stats*/
function updateStats() {
  document.getElementById('stat-total').textContent    = comics.length;
  document.getElementById('stat-read').textContent     = comics.filter(c => c.status === 'read').length;
  document.getElementById('stat-wishlist').textContent = comics.filter(c => c.status === 'wishlist').length;
}
/*Tabs*/
function switchTab(tab, btn) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('view-collection').style.display = tab === 'collection' ? '' : 'none';
  document.getElementById('view-timeline').style.display   = tab === 'timeline'   ? '' : 'none';
  if (tab === 'timeline') refreshTLSelector();
}

function onAddBtn() {
  if (currentTab === 'collection') openModal('modal');
  else openAddToTLModal();
}

/*Collection View*/
function render() {
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


