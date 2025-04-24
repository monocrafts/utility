document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('csv-file-input');
  const loadBtn = document.getElementById('csv-load-btn');
  const entriesList = document.getElementById('entries-list');
  const dirChooseBtn = document.getElementById('dir-choose-btn');
  const selectedDir = document.getElementById('selected-dir');
  const startAllBtn = document.getElementById('start-all');
  const statusList = document.getElementById('status-list');

  let entries = [];
  let directoryHandle = null;

  // CSV読み込み
  loadBtn.addEventListener('click', () => {
    if (!fileInput.files.length) {
      alert('CSVファイルを選択してください');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.trim().split('\n');
      entries = lines.map(line => {
        const [url, name] = line.split(',').map(s => s.trim());
        return { url, name: name || null };
      });
      // 描画
      entriesList.innerHTML = '';
      entries.forEach(e => {
        const li = document.createElement('li');
        li.textContent = `${e.url} → ${e.name || '(自動生成)'}`;
        entriesList.appendChild(li);
      });
    };
    reader.readAsText(fileInput.files[0], 'utf-8');
  });

  // フォルダ選択
  dirChooseBtn.addEventListener('click', async () => {
    try {
      directoryHandle = await window.showDirectoryPicker();
      selectedDir.textContent = directoryHandle.name;
    } catch {
      // キャンセル
    }
  });

  function addStatusItem(idx) {
    const li = document.createElement('li');
    li.id = `item-${idx}`;
    const span = document.createElement('span');
    span.id = `status-${idx}`;
    span.textContent = '未実行';
    li.appendChild(document.createTextNode(entries[idx].url + ' → '));
    li.appendChild(span);
    statusList.appendChild(li);
  }

  function updateStatus(idx, ok, elapsed) {
    const span = document.getElementById(`status-${idx}`);
    const item = document.getElementById(`item-${idx}`);
    // 既存リトライ削除
    const old = item.querySelector('button.retry-btn');
    if (old) old.remove();
    if (ok === null) {
      span.textContent = '実行中';
      span.className = 'status-running';
    } else {
      span.textContent = (ok ? '成功' : '失敗') + ` (${elapsed}ms)`;
      span.className = ok ? 'status-success' : 'status-fail';
      if (!ok) {
        const retry = document.createElement('button');
        retry.textContent = 'Retry';
        retry.className = 'retry-btn';
        retry.addEventListener('click', () => fetchAndSave(entries[idx], idx));
        item.appendChild(retry);
      }
    }
  }

  async function fetchAndSave(entry, idx) {
    updateStatus(idx, null, 0);
    const start = performance.now();
    try {
      const res = await fetch(entry.url);
      if (!res.ok) throw new Error(res.statusText);
      const text = await res.text();
      const elapsed = Math.round(performance.now() - start);

      // ファイル名生成
      const u = new URL(entry.url);
      const host = u.hostname;
      const tailSegs = u.pathname.split('/').filter(s => s);
      const tail = tailSegs.length ? tailSegs.pop() : 'index';
      const base = entry.name || `${host}.${tail}`;
      let ext = null;
      const m = u.pathname.match(/\.([0-9A-Za-z]+)(?:$|[?&#])/);
      if (m) ext = m[1];
      if (!ext) {
        const ct = res.headers.get('Content-Type') || '';
        ext = ct.includes('html') ? 'html' : ct.includes('json') ? 'json' : ct.includes('plain') ? 'txt' : 'bin';
      }
      const pad = n => n.toString().padStart(2,'0');
      const now = new Date();
      const ts = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `${base}.${ts}.${ext}`;

      if (directoryHandle) {
        const handle = await directoryHandle.getFileHandle(filename, { create: true });
        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
      } else {
        const blobUrl = URL.createObjectURL(new Blob([text], {type:'application/octet-stream'}));
        await chrome.downloads.download({ url: blobUrl, filename });
      }
      updateStatus(idx, true, elapsed);
    } catch {
      const elapsed = Math.round(performance.now() - start);
      updateStatus(idx, false, elapsed);
    }
  }

  // 一括実行
  startAllBtn.addEventListener('click', async () => {
    statusList.innerHTML = '';
    for (let i = 0; i < entries.length; i++) addStatusItem(i);
    startAllBtn.disabled = true;
    for (let i = 0; i < entries.length; i++) {
      await fetchAndSave(entries[i], i);
    }
    startAllBtn.disabled = false;
  });
});