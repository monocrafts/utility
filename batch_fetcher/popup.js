const openOptionsBtn = document.getElementById('open-options');
const startAllBtn = document.getElementById('start-all');
const statusList = document.getElementById('status-list');
let entries = [];

openOptionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

function addStatusItem(entry, idx) {
  const li = document.createElement('li');
  li.id = `item-${idx}`;
  li.textContent = `${entry.url} → `;
  const span = document.createElement('span');
  span.id = `status-${idx}`;
  span.textContent = '未実行';
  li.appendChild(span);
  statusList.appendChild(li);
}

function updateStatus(idx, ok) {
  const span = document.getElementById(`status-${idx}`);
  span.textContent = ok ? '成功' : '失敗';
  span.className = ok ? 'status-success' : 'status-fail';
  if (!ok) {
    const retry = document.createElement('button');
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => fetchAndSave(entries[idx], idx));
    document.getElementById(`item-${idx}`).appendChild(retry);
  }
}

async function fetchAndSave(entry, idx) {
  updateStatus(idx, null);
  try {
    const res = await fetch(entry.url);
    if (!res.ok) throw new Error(res.statusText);
    const text = await res.text();
    const blob = new Blob([text], { type: 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(blob);

    let base;
    if (entry.name) {
      base = entry.name;
    } else {
      const u = new URL(entry.url);
      const host = u.hostname;
      const segs = u.pathname.split('/').filter(s => s);
      const tail = segs.length ? segs.at(-1) : 'index';
      base = `${host}.${tail}`;
    }

    let ext = null;
    const path = new URL(entry.url).pathname;
    const mat = path.match(/\.([a-zA-Z0-9]+)(?:$|[?&#])/);
    if (mat) ext = mat[1];
    if (!ext) {
      const ct = res.headers.get('Content-Type') || '';
      if (ct.includes('html')) ext = 'html';
      else if (ct.includes('json')) ext = 'json';
      else if (ct.includes('plain')) ext = 'txt';
      else ext = 'bin';
    }

    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const ts = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

    const filename = `${base}.${ts}.${ext}`;
    await chrome.downloads.download({ url: blobUrl, filename });
    updateStatus(idx, true);
  } catch (e) {
    console.error(e);
    updateStatus(idx, false);
  }
}

async function startAll() {
  startAllBtn.disabled = true;
  for (let i = 0; i < entries.length; i++) {
    await fetchAndSave(entries[i], i);
  }
  startAllBtn.disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get({ entries: [] }, ({ entries: stored }) => {
    entries = stored;
    statusList.innerHTML = '';
    entries.forEach((entry, i) => addStatusItem(entry, i));
  });
  startAllBtn.addEventListener('click', startAll);
});