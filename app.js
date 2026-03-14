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