// AI Story Creator — app.js
// Data-driven: loads topics.json, styles.json, audiences.json
// Stories stored in localStorage
// API calls go through server proxy (no key in frontend)

const API_BASE = 'https://live-subtitle.onrender.com';
const ACCESS_CODE = '0910164482';
const STORIES_BASE = 'https://joeliang2022.github.io/fukuoka-trip/stories/';

// === Auth Gate ===
function checkAuth() {
  var code = document.getElementById('authCode').value.trim();
  if (code === ACCESS_CODE) {
    try { sessionStorage.setItem('storyAuth', '1'); } catch(e) {}
    document.getElementById('authGate').style.display = 'none';
    document.getElementById('mainApp').style.display = '';
    init();
  } else {
    document.getElementById('authError').style.display = '';
    document.getElementById('authCode').value = '';
  }
}
// Auto-login if already authed
try {
  if (sessionStorage.getItem('storyAuth') === '1') {
    document.getElementById('authGate').style.display = 'none';
    document.getElementById('mainApp').style.display = '';
    init();
  }
} catch(e) { /* Safari private mode may block sessionStorage */ }

let _topics = {};
let _styles = [];
let _audiences = [];
let _selectedStyle = 'suspense';
let _selectedAudience = 'young';
let _selectedTopic = '';
let _selectedCat = '';
let _chapters = 3;

// === Init ===
async function init() {
  const [topicsRes, stylesRes, audiencesRes] = await Promise.all([
    fetch('topics.json').then(r => r.json()),
    fetch('styles.json').then(r => r.json()),
    fetch('audiences.json').then(r => r.json())
  ]);
  _topics = topicsRes;
  _styles = stylesRes;
  _audiences = audiencesRes;
  renderAudiences();
  renderStyles();
  renderCategories();
  // Default: first category
  const cats = Object.keys(_topics);
  if (cats.length) selectCategory(cats[0]);
}

// === Render Audiences ===
function renderAudiences() {
  const row = document.getElementById('audienceRow');
  row.innerHTML = _audiences.map(a =>
    '<div class="chip' + (a.id === _selectedAudience ? ' active' : '') + '" onclick="selectAudience(\'' + a.id + '\')">' + a.icon + ' ' + a.name + '</div>'
  ).join('');
}
function selectAudience(id) {
  _selectedAudience = id;
  renderAudiences();
}

// === Render Styles ===
function renderStyles() {
  const row = document.getElementById('styleRow');
  row.innerHTML = _styles.map(s =>
    '<div class="chip' + (s.id === _selectedStyle ? ' active' : '') + '" onclick="selectStyle(\'' + s.id + '\')">' + s.icon + ' ' + s.name + '</div>'
  ).join('');
}
function selectStyle(id) {
  _selectedStyle = id;
  renderStyles();
}

// === Render Categories ===
function renderCategories() {
  const row = document.getElementById('catRow');
  row.innerHTML = Object.keys(_topics).map(cat =>
    '<div class="cat-btn' + (cat === _selectedCat ? ' active' : '') + '" onclick="selectCategory(\'' + cat.replace(/'/g, "\\'") + '\')">' + cat + '</div>'
  ).join('');
}
function selectCategory(cat) {
  _selectedCat = cat;
  renderCategories();
  renderTopics(cat);
}

// === Render Topics ===
function renderTopics(cat) {
  const grid = document.getElementById('topicGrid');
  const list = _topics[cat] || [];
  grid.innerHTML = list.map(t =>
    '<div class="topic-card' + (t === _selectedTopic ? ' selected' : '') + '" onclick="selectTopic(this,\'' + t.replace(/'/g, "\\'") + '\')">' + t + '</div>'
  ).join('');
}
function selectTopic(el, topic) {
  _selectedTopic = topic;
  document.getElementById('customTopic').value = '';
  document.querySelectorAll('.topic-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

// === Chapter Count ===
function setChapters(n) {
  _chapters = n;
  [3,5,7].forEach(x => {
    var b = document.getElementById('ch' + x);
    if (b) b.classList.toggle('active', x === n);
  });
}

// === Story Hook Techniques (injected into prompt) ===
const HOOK_TECHNIQUES = [
  '開頭用一個震撼的事實或問題抓住注意力（前3秒法則）',
  '每篇結尾留下懸念或cliffhanger，讓讀者想看下一篇',
  '在故事中插入「你可能不知道」「更可怕的是」等轉折語',
  '用具體數字和細節增加可信度（例如：距離地球4.2光年）',
  '加入讀者能代入的情境（想像一下，如果你...）',
  '使用對比和反差製造衝擊（表面上...但實際上...）',
  '在關鍵處使用短句增加節奏感和緊張感',
  '每篇都有一個「金句」適合截圖分享',
  '用故事化的方式呈現知識，不要像教科書',
  '結尾要有餘韻，讓讀者思考或產生情緒'
];

// === Generate Story ===
async function generate() {
  const topic = document.getElementById('customTopic').value.trim() || _selectedTopic;
  if (!topic) { showToast('請選擇或輸入一個主題'); return; }

  const style = _styles.find(s => s.id === _selectedStyle) || _styles[0];
  const audience = _audiences.find(a => a.id === _selectedAudience) || _audiences[0];
  const btn = document.getElementById('btnGenerate');
  const output = document.getElementById('output');

  btn.disabled = true;
  btn.textContent = '⏳ 生成中...';
  output.innerHTML = '<div class="loading"><div class="spinner"></div><p>AI 正在構思故事架構...</p></div>';

  const prompt = `你是一個專業的社群媒體故事創作者。請根據以下設定創作一個分篇章的故事。

【主題】${topic}
【風格】${style.name} — ${style.prompt}
【目標觀眾】${audience.name} — ${audience.tone}
【篇章數】${_chapters} 篇
【語言】繁體中文

【抓眼球技巧（必須融入）】
${HOOK_TECHNIQUES.join('\n')}

【輸出格式】請用 JSON 格式回覆，不要加 markdown 標記：
{
  "title": "故事總標題（要吸引人點擊）",
  "chapters": [
    {
      "num": 1,
      "title": "篇章標題（要有懸念感）",
      "text": "篇章內容（200-400字，適合社群媒體閱讀）",
      "imagePrompt": "用英文描述這篇的配圖場景（適合AI生圖，cinematic style）",
      "hook": "這篇的金句（適合截圖分享，一句話）"
    }
  ]
}

要求：
- 每篇都能獨立閱讀，但串起來是完整故事
- 第一篇開頭要在3秒內抓住注意力
- 每篇結尾要有懸念讓人想看下一篇
- 最後一篇要有震撼或感動的結尾
- 金句要適合做成社群圖卡
- 配圖描述要具體、有電影感`;

  try {
    const resp = await fetch(API_BASE + '/api/story-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt, style: _selectedStyle })
    });
    if (!resp.ok) throw new Error('API error: ' + resp.status);
    const data = await resp.json();
    const raw = data.text || '';

    // Parse JSON from response (strip markdown fences if any)
    let story;
    try {
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      story = JSON.parse(cleaned);
    } catch (e) {
      output.innerHTML = '<div class="loading"><p>⚠️ AI 回覆格式異常，請重試</p><pre style="font-size:12px;color:#666;max-height:200px;overflow:auto">' + escHtml(raw.substring(0, 500)) + '</pre></div>';
      btn.disabled = false; btn.textContent = '✨ 生成故事';
      return;
    }

    // Save to localStorage
    saveStory(topic, style.name, audience.name, story);

    // Render
    renderStory(story);
  } catch (e) {
    output.innerHTML = '<div class="loading"><p>❌ ' + escHtml(e.message) + '</p></div>';
  }
  btn.disabled = false; btn.textContent = '✨ 生成故事';
}

// === Render Story ===
function renderStory(story) {
  const output = document.getElementById('output');
  let html = '<div class="story-header"><div class="story-title">' + escHtml(story.title) + '</div><div class="story-meta">' + _chapters + ' 篇章 · AI 生成</div></div>';

  story.chapters.forEach((ch, i) => {
    html += '<div class="chapter-card" id="chapter' + i + '">' +
      '<div class="chapter-img" id="chImg' + i + '"><div class="img-loading"><div class="spinner"></div><span>生成配圖中...</span></div></div>' +
      '<div class="chapter-body">' +
        '<div class="chapter-num">第 ' + ch.num + ' 篇</div>' +
        '<div class="chapter-title">' + escHtml(ch.title) + '</div>' +
        '<div class="chapter-text">' + escHtml(ch.text) + '</div>' +
        (ch.hook ? '<div style="margin-top:12px;padding:10px 14px;border-radius:10px;background:rgba(240,147,251,0.08);border-left:3px solid #f093fb;font-size:14px;color:#f093fb;font-weight:600">💬 ' + escHtml(ch.hook) + '</div>' : '') +
      '</div>' +
      '<div class="chapter-actions">' +
        '<button onclick="copyChapter(' + i + ')">📋 複製</button>' +
        '<button onclick="regenImage(' + i + ')">🖼️ 重新生圖</button>' +
      '</div>' +
    '</div>';
  });

  html += '<div class="export-bar">' +
    '<button onclick="publishStory()">📤 發佈</button>' +
    '<button onclick="copyAll()">📋 複製全部</button>' +
    '<button onclick="downloadMD()">⬇️ 下載 MD</button>' +
  '</div>';

  output.innerHTML = html;

  // Generate images async
  story.chapters.forEach((ch, i) => {
    generateImage(ch.imagePrompt, i);
  });

  // Store for copy/export
  window._currentStory = story;
}

// === Image Generation (via server proxy) ===
async function generateImage(prompt, chapterIdx) {
  const imgEl = document.getElementById('chImg' + chapterIdx);
  if (!imgEl) return;
  try {
    const resp = await fetch(API_BASE + '/api/story-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt })
    });
    if (!resp.ok) throw new Error('Image API ' + resp.status);
    const data = await resp.json();
    if (data.image) {
      imgEl.innerHTML = '<img src="data:image/png;base64,' + data.image + '" alt="">';
    } else {
      throw new Error(data.error || 'No image');
    }
  } catch (e) {
    imgEl.innerHTML = '<span style="color:#555">\uD83D\uDDBC\uFE0F ' + escHtml(e.message) + '</span>';
    imgEl.style.cursor = 'pointer';
    imgEl.onclick = function() { imgEl.innerHTML = '<div class="img-loading"><div class="spinner"></div><span>Retry...</span></div>'; imgEl.onclick = null; generateImage(prompt, chapterIdx); };
  }
}


function regenImage(idx) {
  if (!window._currentStory) return;
  const ch = window._currentStory.chapters[idx];
  if (!ch) return;
  var imgEl = document.getElementById('chImg' + idx);
  if (imgEl) imgEl.innerHTML = '<div class="img-loading"><div class="spinner"></div><span>重新生成...</span></div>';
  generateImage(ch.imagePrompt, idx);
}

// === Copy & Export ===
function copyChapter(idx) {
  if (!window._currentStory) return;
  const ch = window._currentStory.chapters[idx];
  const text = '【第' + ch.num + '篇】' + ch.title + '\n\n' + ch.text + (ch.hook ? '\n\n💬 ' + ch.hook : '');
  navigator.clipboard.writeText(text).then(() => showToast('已複製第' + ch.num + '篇'));
}

function copyAll() {
  if (!window._currentStory) return;
  const s = window._currentStory;
  let text = '📖 ' + s.title + '\n\n';
  s.chapters.forEach(ch => {
    text += '═══════════════════\n【第' + ch.num + '篇】' + ch.title + '\n═══════════════════\n\n' + ch.text + '\n';
    if (ch.hook) text += '\n💬 ' + ch.hook + '\n';
    text += '\n';
  });
  navigator.clipboard.writeText(text).then(() => showToast('已複製全部故事'));
}

function downloadMD() {
  if (!window._currentStory) return;
  const s = window._currentStory;
  let md = '# ' + s.title + '\n\n';
  s.chapters.forEach(ch => {
    md += '## 第' + ch.num + '篇：' + ch.title + '\n\n' + ch.text + '\n\n';
    if (ch.hook) md += '> 💬 ' + ch.hook + '\n\n';
    md += '---\n\n';
  });
  const blob = new Blob([md], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = s.title.replace(/[^\w\u4e00-\u9fff]/g, '_') + '.md';
  a.click();
}

// === Storage ===
function saveStory(topic, style, audience, story) {
  try {
    const list = JSON.parse(localStorage.getItem('storyHistory') || '[]');
    list.unshift({ topic, style, audience, story, date: new Date().toISOString() });
    if (list.length > 20) list.length = 20;
    localStorage.setItem('storyHistory', JSON.stringify(list));
  } catch (_) {}
}

// === Utils ===
function escHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// === Publish Story to GitHub Pages ===
async function publishStory() {
  if (!window._currentStory) { showToast('沒有故事可發佈'); return; }
  const story = window._currentStory;
  showToast('📤 發佈中...');

  // Generate story ID (timestamp-based)
  const id = Date.now().toString(36);
  const filename = id + '.html';

  // Build standalone HTML page for the story
  var html = '<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">';
  html += '<title>' + escHtml(story.title) + '</title>';
  html += '<link rel="stylesheet" href="reader.css?v=1">';
  html += '</head><body>';
  html += '<div class="reader-header"><a href="index.html" class="back-link">\u2190 所有故事</a></div>';
  html += '<article class="story">';
  html += '<h1 class="story-title">' + escHtml(story.title) + '</h1>';

  // Collect images as separate entries
  var imageEntries = [];
  story.chapters.forEach(function(ch, i) {
    var imgEl = document.getElementById('chImg' + i);
    var imgData = null;
    if (imgEl) {
      var img = imgEl.querySelector('img');
      if (img && img.src && img.src.startsWith('data:')) {
        var parts = img.src.split(',');
        if (parts.length === 2) {
          imgData = parts[1]; // base64 only
          imageEntries.push({ idx: i, data: imgData });
        }
      }
    }
    html += '<section class="chapter">';
    if (imgData) html += '<div class="chapter-cover"><img src="img/' + id + '_' + i + '.png" alt=""></div>';
    html += '<div class="chapter-num">\u7B2C ' + ch.num + ' \u7BC7</div>';
    html += '<h2>' + escHtml(ch.title) + '</h2>';
    html += '<div class="chapter-content">' + escHtml(ch.text).replace(/\n/g, '<br>') + '</div>';
    if (ch.hook) html += '<blockquote class="hook">\uD83D\uDCAC ' + escHtml(ch.hook) + '</blockquote>';
    html += '</section>';
  });
  html += '</article>';
  html += '<div class="reader-footer"><a href="index.html">← 更多故事</a></div>';
  html += '</body></html>';

  try {
    // Upload via server proxy (images sent separately)
    var pubResp = await fetch(API_BASE + '/api/story-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, title: story.title, chapters: story.chapters.length, html: html, images: imageEntries })
    });
    if (!pubResp.ok) {
      var errData = {};
      try { errData = await pubResp.json(); } catch(_) {}
      throw new Error(errData.error || 'Publish API ' + pubResp.status);
    }

    var url = STORIES_BASE + filename;
    showToast('✅ 已發佈！');
    // Show publish result
    var output = document.getElementById('output');
    output.innerHTML += '<div style="margin:16px 0;padding:16px;border-radius:12px;background:rgba(46,204,113,0.1);border:1px solid rgba(46,204,113,0.3);text-align:center">' +
      '<div style="font-size:15px;color:#2ecc71;font-weight:600;margin-bottom:8px">✅ 故事已發佈</div>' +
      '<a href="' + url + '" target="_blank" style="color:#4ecdc4;word-break:break-all">' + url + '</a>' +
      '<div style="margin-top:8px"><button onclick="navigator.clipboard.writeText(\'' + url + '\');showToast(\'已複製連結\')" style="padding:6px 16px;border-radius:8px;border:1px solid rgba(78,205,196,0.3);background:rgba(78,205,196,0.1);color:#4ecdc4;cursor:pointer">📋 複製連結</button></div>' +
    '</div>';
  } catch (e) {
    showToast('❌ 發佈失敗: ' + e.message);
  }
}

// === Boot ===
// Only init if already authenticated (otherwise wait for checkAuth)
if (sessionStorage.getItem('storyAuth') !== '1') {
  // Show auth gate, don't init
} else {
  // Already handled by auto-login block above
}
