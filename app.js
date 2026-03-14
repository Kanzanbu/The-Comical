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