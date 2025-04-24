const fileInput = document.getElementById('csv-file-input');
const loadBtn = document.getElementById('csv-load-btn');
const listEl = document.getElementById('entries-list');

function render(entries) {
  listEl.innerHTML = '';
  entries.forEach(e => {
    const li = document.createElement('li');
    li.textContent = `${e.url} → ${e.name || '(自動生成)'}`;
    listEl.appendChild(li);
  });
}

loadBtn.addEventListener('click', () => {
  const file = fileInput.files[0];
  if (!file) {
    alert('CSVファイルを選択してください');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    const entries = text.trim().split('\n').map(line => {
      const [url, name] = line.split(',').map(s => s.trim());
      return { url, name: name || null };
    });
    chrome.storage.sync.set({ entries }, () => render(entries));
  };
  reader.readAsText(file, 'utf-8');
});

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get({ entries: [] }, ({ entries }) => render(entries));
});