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