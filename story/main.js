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
let _generateImages = false;
let _chapterLength = 'medium';
let _voiceMode = 'off'; // off, browser, gemini-f, gemini-m

// === Init ===
async function init() {
  var cacheBust = '?t=' + Date.now();
  const [topicsRes, stylesRes, audiencesRes, refsRes] = await Promise.all([
    fetch('topics.json' + cacheBust).then(r => r.json()),
    fetch('styles.json' + cacheBust).then(r => r.json()),
    fetch('audiences.json' + cacheBust).then(r => r.json()),
    fetch('references.json' + cacheBust).then(r => r.json()).catch(function() { return {}; })
  ]);
  _topics = topicsRes;
  _styles = stylesRes;
  _audiences = audiencesRes;
  window._references = refsRes;
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
  var isNews = (id === 'news' || id === 'finance');
  var topicEls = document.querySelectorAll('.section-title');
  var catRow = document.getElementById('catRow');
  var topicGrid = document.getElementById('topicGrid');
  var customInput = document.querySelector('.custom-input');
  if (catRow) catRow.style.display = isNews ? 'none' : '';
  if (topicGrid) topicGrid.style.display = isNews ? 'none' : '';
  if (customInput) customInput.style.display = isNews ? 'none' : '';
  topicEls.forEach(function(el) {
    if (el.textContent.includes('熱門主題')) {
      el.style.display = isNews ? 'none' : '';
      if (!isNews) el.textContent = '📝 選擇故事名稱';
    }
  });
  // Switch chapter count buttons for news mode
  var countBtns = document.querySelector('.count-btns');
  if (countBtns) {
    if (isNews) {
      _chapters = 30;
      countBtns.innerHTML = '<button onclick="setChapters(30)" id="ch30" class="active">30則</button><button onclick="setChapters(60)" id="ch60">60則</button><button onclick="setChapters(100)" id="ch100">100則</button>';
    } else {
      _chapters = 3;
      countBtns.innerHTML = '<button onclick="setChapters(3)" id="ch3" class="active">3篇</button><button onclick="setChapters(5)" id="ch5">5篇</button><button onclick="setChapters(7)" id="ch7">7篇</button><button onclick="setChapters(30)" id="ch30">30篇</button><button onclick="setChapters(60)" id="ch60">60篇</button><button onclick="promptCustomChapters()" id="chCustom">自訂</button>';
    }
  }
  // For non-news styles: generate AI story title suggestions
  if (!isNews) {
    var style = _styles.find(function(s) { return s.id === id; });
    // Hide static topics, show loading
    var topicGrid = document.getElementById('topicGrid');
    var catRow = document.getElementById('catRow');
    if (catRow) catRow.style.display = 'none';
    if (topicGrid) {
      topicGrid.style.display = '';
      topicGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:#888"><div class="spinner" style="width:24px;height:24px;border:2px solid rgba(240,147,251,0.2);border-top-color:#f093fb;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 8px"></div>AI 正在構思故事名稱...</div>';
    }
    _selectedTopic = '';
    // Call AI to generate titles
    try {
      var titlePrompt = '你是社群媒體故事創作專家，熟悉網路上最熱門、最高流量的故事題材。請根據「' + (style ? style.name : id) + '」風格，生成 20 個目前最熱門、最容易爆紅的故事名稱。\n\n用 JSON 回覆（不要 markdown）：{"titles":["故事名稱1","故事名稱2",...]}\n\n要求：\n- 參考抖音、小紅書、IG 上最火的故事類型\n- 名稱要有懸念感、讓人忍不住想點\n- 要符合當下流行趨勢\n- 繁體中文\n- 20 個，從最熱門排到次熱門';
      fetch(API_BASE + '/api/story-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: titlePrompt, style: id })
      }).then(function(r) { return r.json(); }).then(function(data) {
        var raw = data.text || '';
        var tick3 = String.fromCharCode(96,96,96);
        var cleaned = raw.replace(new RegExp(tick3 + 'json\\s*', 'g'), '').replace(new RegExp(tick3 + '\\s*', 'g'), '').trim();
        try {
          var result = JSON.parse(cleaned);
          var titles = result.titles || [];
          if (topicGrid) {
            topicGrid.innerHTML = titles.map(function(t) {
              return '<div class="topic-card" onclick="selectTopic(this,\'' + t.replace(/'/g, "\\'") + '\')">' + t + '</div>';
            }).join('') + '<div style="grid-column:1/-1;text-align:center;padding:8px"><button onclick="selectStyle(_selectedStyle)" style="padding:8px 20px;border-radius:10px;border:1px solid rgba(240,147,251,0.3);background:rgba(240,147,251,0.08);color:#f093fb;font-size:13px;cursor:pointer">🔄 換一批</button></div>';
          }
        } catch(e) {
          if (topicGrid) topicGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:12px;color:#888">生成失敗，請直接輸入主題</div>';
        }
      }).catch(function() {
        if (topicGrid) topicGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:12px;color:#888">生成失敗，請直接輸入主題</div>';
      });
    } catch(e) {}
  }
}

// === Render Categories ===
function renderCategories(allowedCats) {
  var row = document.getElementById('catRow');
  var cats = allowedCats || Object.keys(_topics);
  row.innerHTML = cats.map(function(cat) {
    return '<div class="cat-btn' + (cat === _selectedCat ? ' active' : '') + '" onclick="selectCategory(\'' + cat.replace(/'/g, "\\'") + '\')">' + cat + '</div>';
  }).join('');
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
  document.querySelectorAll('.count-btns button').forEach(function(b) { b.classList.remove('active'); });
  var btn = document.getElementById('ch' + n);
  if (btn) btn.classList.add('active');
  else {
    var custom = document.getElementById('chCustom');
    if (custom) { custom.classList.add('active'); custom.textContent = n + '篇'; }
  }
}

function promptCustomChapters() {
  var n = prompt('請輸入篇章數（1-200）：');
  if (n && !isNaN(n) && parseInt(n) > 0 && parseInt(n) <= 200) {
    setChapters(parseInt(n));
  }
}

function toggleImages(on) {
  _generateImages = on;
  var btnOn = document.getElementById('imgOn');
  var btnOff = document.getElementById('imgOff');
  if (btnOn) btnOn.classList.toggle('active', on);
  if (btnOff) btnOff.classList.toggle('active', !on);
}

function setLength(len) {
  _chapterLength = len;
  ['Short','Medium','Long'].forEach(function(l) {
    var b = document.getElementById('len' + l);
    if (b) b.classList.toggle('active', l.toLowerCase() === len);
  });
}

function getLengthText() {
  if (_chapterLength === 'short') return '約200字';
  if (_chapterLength === 'long') return '500-800字';
  return '約400字';
}

function setVoice(mode) {
  _voiceMode = mode;
  document.querySelectorAll('[id^="voice"]').forEach(function(b) { b.classList.remove('active'); });
  var map = {'off':'voiceOff','browser':'voiceBrowser','kore':'voiceKore','zephyr':'voiceZephyr','aoede':'voiceAoede','leda':'voiceLeda','puck':'voicePuck','orus':'voiceOrus'};
  var btn = document.getElementById(map[mode]);
  if (btn) btn.classList.add('active');
}

// Read story aloud (browser TTS)
function readStoryBrowser() {
  if (!window._currentStory) return;
  var chapters = window._currentStory.chapters;
  var idx = 0;
  function readNext() {
    if (idx >= chapters.length) { showToast('朗讀完畢'); return; }
    var ch = chapters[idx];
    showToast('🔊 朗讀第 ' + ch.num + ' 篇...');
    var u = new SpeechSynthesisUtterance(ch.title + '。' + ch.text);
    u.lang = 'zh-TW'; u.rate = 1;
    u.onend = function() { idx++; readNext(); };
    speechSynthesis.speak(u);
  }
  readNext();
}

// Read story with Gemini TTS
async function readStoryGemini(voiceName) {
  if (!window._currentStory) return;
  var chapters = window._currentStory.chapters;
  for (var i = 0; i < chapters.length; i++) {
    var ch = chapters[i];
    showToast('🤖 生成語音第 ' + ch.num + ' 篇...');
    try {
      var resp = await fetch(API_BASE + '/api/story/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Passcode': ACCESS_CODE },
        body: JSON.stringify({ text: ch.title + '。' + ch.text, voice: voiceName })
      });
      if (!resp.ok) { showToast('語音生成失敗'); continue; }
      var data = await resp.json();
      if (data.audio) {
        var audio = new Audio('data:' + (data.mimeType || 'audio/mp3') + ';base64,' + data.audio);
        await new Promise(function(resolve) { audio.onended = resolve; audio.onerror = resolve; audio.play(); });
      }
    } catch(e) { showToast('語音錯誤: ' + e.message); }
  }
  showToast('朗讀完畢');
}

function getRandomRefs(styleId, count) {
  var refs = window._references && window._references[styleId] ? window._references[styleId] : [];
  if (refs.length === 0) return '';
  var shuffled = refs.slice().sort(function() { return Math.random() - 0.5; });
  return shuffled.slice(0, count || 4).join('、');
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
  var isNews = (_selectedStyle === 'news' || _selectedStyle === 'finance');
  const topic = isNews ? '今天的最新' + (_selectedStyle === 'finance' ? '財經' : '') + '新聞' : (document.getElementById('customTopic').value.trim() || _selectedTopic);
  if (!topic && !isNews) { showToast('請選擇或輸入一個主題'); return; }

  const style = _styles.find(s => s.id === _selectedStyle) || _styles[0];
  const audience = _audiences.find(a => a.id === _selectedAudience) || _audiences[0];
  const btn = document.getElementById('btnGenerate');
  const output = document.getElementById('output');

  btn.disabled = true;
  btn.textContent = '⏳ 生成中...';
  output.innerHTML = '<div class="loading"><div class="spinner"></div><p>' + (isNews ? '搜尋今日新聞中...' : 'AI 正在構思故事架構...') + '</p></div>';

  // News mode: batch API calls for 30/60/100 articles
  if (isNews) {
    var newsType = _selectedStyle === 'finance' ? '財經' : '';
    var batchSize = 15;
    var totalBatches = Math.ceil(_chapters / batchSize);
    var allArticles = [];
    var allSources = [];
    var newsDate = new Date().toISOString().split('T')[0];
    var headline = '';

    try {
      for (var batch = 0; batch < totalBatches; batch++) {
        var remaining = _chapters - (batch * batchSize);
        var thisCount = Math.min(batchSize, remaining);
        output.innerHTML = '<div class="loading"><div class="spinner"></div><p>搜尋新聞中... (' + allArticles.length + '/' + _chapters + ')</p></div>';

        var recentTitles = allArticles.slice(-5).map(function(a) { return a.title; }).join(', ');
        var newsPrompt = '你是一位專業新聞記者。請搜尋今天（' + newsDate + '）最重要的' + newsType + '新聞。\n\n' +
          (recentTitles ? 'Avoid these: ' + recentTitles + '\n\n' : '') +
          '請用 JSON 格式回覆，不要加 markdown 標記：\n' +
          '{"articles":[{"title":"新聞標題","summary":"2-3句記者播報風格摘要","source":"來源媒體","url":"新聞連結URL","category":"分類","time":"時間"}]}\n\n' +
          '要求：列出 ' + thisCount + ' 則不同的重要新聞，每則必須有真實連結URL，用繁體中文，記者播報口吻';

        var resp = await fetch(API_BASE + '/api/story-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: newsPrompt, style: _selectedStyle })
        });
        if (!resp.ok) { continue; }
        var data = await resp.json();
        var raw = data.text || '';
        if (data.sources) allSources = allSources.concat(data.sources);
        var tick3 = String.fromCharCode(96,96,96);
        var cleaned = raw.replace(new RegExp(tick3 + 'json\\s*', 'g'), '').replace(new RegExp(tick3 + '\\s*', 'g'), '').trim();
        try {
          var batchData = JSON.parse(cleaned);
          if (batchData.articles) allArticles = allArticles.concat(batchData.articles);
          if (batchData.headline && !headline) headline = batchData.headline;
          if (batchData.date) newsDate = batchData.date;
        } catch(pe) { /* skip bad batch */ }
      }
      var newsData = { date: newsDate, headline: headline, articles: allArticles };
      renderNews(newsData, '', allSources);
    } catch(e) {
      output.innerHTML = '<div class="loading"><p>❌ ' + escHtml(e.message) + '</p></div>';
    }
    btn.disabled = false; btn.textContent = '✨ 生成';
    return;
  }

  // Story mode — per-chapter generation with DNA + outline + memory
  var allChapters = [];

  try {
    // Step 1: Load Style DNA
    output.innerHTML = '<div class="loading"><div class="spinner"></div><p>載入風格設定...</p></div>';
    var dna = await loadStyleDNA(_selectedStyle);

    // Step 2: Generate outline (pre-plan story arc)
    output.innerHTML = '<div class="loading"><div class="spinner"></div><p>規劃故事大綱...</p></div>';
    var outline = await generateOutline(dna, topic, _chapters, audience);

    // Step 3: Initialize session memory
    var memory = createEmptyMemory();

    // Step 4: Per-chapter generation
    for (var chIdx = 0; chIdx < _chapters; chIdx++) {
      var chapterNum = chIdx + 1;
      output.innerHTML = '<div class="loading"><div class="spinner"></div><p>AI 正在創作第 ' + chapterNum + '/' + _chapters + ' 篇...</p></div>';

      // Assemble prompt for THIS single chapter
      var prompt = assemblePrompt({
        dna: dna,
        chapterOutline: outline[chIdx],
        memory: memory,
        chapterNum: chapterNum,
        totalChapters: _chapters,
        topic: topic,
        audience: audience,
        chapterLength: _chapterLength,
        isFirstChapter: chapterNum === 1,
        isLastChapter: chapterNum === _chapters
      });

      // Call API — generates exactly ONE chapter
      var resp = await fetch(API_BASE + '/api/story-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt, style: _selectedStyle })
      });
      if (!resp.ok) continue;
      var data = await resp.json();
      var raw = data.text || '';
      var tick3 = String.fromCharCode(96,96,96);
      var cleaned = raw.replace(new RegExp(tick3 + 'json\\s*', 'g'), '').replace(new RegExp(tick3 + '\\s*', 'g'), '').trim();

      try {
        var chapter = JSON.parse(cleaned);
        // Handle case where API returns wrapped object
        if (chapter.chapters && Array.isArray(chapter.chapters)) {
          chapter = chapter.chapters[0];
        }
        if (!chapter.num) chapter.num = chapterNum;

        // First chapter: extract title and characters
        if (chapterNum === 1) {
          memory.title = chapter.title || topic;
          if (chapter.characters) {
            for (var ci = 0; ci < chapter.characters.length; ci++) {
              memory.characters.push(chapter.characters[ci]);
            }
          }
        }

        allChapters.push(chapter);

        // Update session memory
        updateSessionMemory(memory, [chapter], outline);
      } catch(pe) { /* skip bad chapter */ }
    }

    if (allChapters.length === 0) throw new Error('生成失敗');
    var story = { title: memory.title || topic, characters: memory.characters, chapters: allChapters };
    saveStory(topic, style.name, audience.name, story);
    renderStory(story);
  } catch (e) {
    output.innerHTML = '<div class="loading"><p>❌ ' + escHtml(e.message) + '</p></div>';
  }
  btn.disabled = false; btn.textContent = '✨ 生成故事';
}

// === Render News (Google News style) ===
function renderNews(newsData, rawText, sources) {
  var output = document.getElementById('output');
  var html = '';
  if (newsData && newsData.articles) {
    html += '<div style="margin:20px 0 8px;text-align:center"><div style="font-size:22px;font-weight:700;color:#fff">📰 ' + (_selectedStyle === 'finance' ? '財經' : '今日') + '新聞</div>';
    html += '<div style="font-size:12px;color:#666;margin-top:4px">' + (newsData.date || new Date().toISOString().split('T')[0]) + '</div>';
    if (newsData.headline) html += '<div style="font-size:14px;color:#f093fb;margin-top:8px;font-weight:600">' + escHtml(newsData.headline) + '</div>';
    html += '</div>';

    newsData.articles.forEach(function(article, i) {
      // Try to get URL from article itself, or from grounding sources
      var url = article.url || '';
      if (!url && sources && sources[i] && sources[i].url) url = sources[i].url;

      html += '<div style="margin:10px 0;padding:16px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);cursor:pointer" onclick="' + (url ? 'window.open(\'' + escHtml(url).replace(/'/g, "\\'") + '\',\'_blank\')' : '') + '">';
      // Category + Time
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
      if (article.category) html += '<span style="font-size:11px;color:#f093fb;font-weight:600;padding:2px 8px;border-radius:4px;background:rgba(240,147,251,0.1)">' + escHtml(article.category) + '</span>';
      if (article.time) html += '<span style="font-size:11px;color:#666">' + escHtml(article.time) + '</span>';
      html += '</div>';
      // Title (clickable)
      if (url) {
        html += '<a href="' + escHtml(url) + '" target="_blank" style="font-size:17px;font-weight:600;color:#eee;margin-bottom:6px;line-height:1.4;text-decoration:none;display:block">' + escHtml(article.title) + '</a>';
      } else {
        html += '<div style="font-size:17px;font-weight:600;color:#eee;margin-bottom:6px;line-height:1.4">' + escHtml(article.title) + '</div>';
      }
      // Summary
      html += '<div style="font-size:14px;color:#aaa;line-height:1.7">' + escHtml(article.summary) + '</div>';
      // Source + Link
      html += '<div style="margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
      if (article.source) html += '<span style="font-size:12px;color:#888;background:rgba(255,255,255,0.04);padding:3px 8px;border-radius:4px">📰 ' + escHtml(article.source) + '</span>';
      if (url) html += '<a href="' + escHtml(url) + '" target="_blank" style="font-size:12px;color:#4ecdc4;text-decoration:none;font-weight:600">閱讀全文 →</a>';
      html += '</div></div>';
    });
  } else {
    html += '<div style="margin:20px 0;padding:16px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">';
    html += '<div style="font-size:15px;color:#ccc;line-height:1.8;white-space:pre-wrap">' + escHtml(rawText) + '</div>';
    html += '</div>';
  }
  // All sources
  if (sources && sources.length > 0) {
    html += '<div style="margin:12px 0;padding:12px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04)">';
    html += '<div style="font-size:12px;color:#888;margin-bottom:6px">📎 所有來源</div>';
    sources.forEach(function(src) {
      if (src.url) html += '<div style="margin:3px 0"><a href="' + escHtml(src.url) + '" target="_blank" style="color:#4ecdc4;font-size:12px;text-decoration:none">' + escHtml(src.title || src.url) + '</a></div>';
    });
    html += '</div>';
  }
  html += '<div class="export-bar"><button onclick="publishNews()">📤 發佈新聞</button><button onclick="copyAll()">📋 複製全部</button></div>';
  output.innerHTML = html;
  window._currentStory = newsData;
  window._currentNewsSources = sources;
}

// === Render Story ===
function renderStory(story) {
  const output = document.getElementById('output');
  let html = '<div class="story-header"><div class="story-title">' + escHtml(story.title) + '</div><div class="story-meta">' + _chapters + ' 篇章 · AI 生成</div></div>';

  // Show built-in scores if available
  if (story.scores) {
    var sc = story.scores;
    var labels = {scene:'場景',character:'人物',depth:'深度',pacing:'節奏',foreshadow:'伏筆',tone:'語氣',memorable:'記憶點'};
    html += '<div style="margin:0 0 12px;padding:12px;border-radius:10px;background:rgba(78,205,196,0.06);border:1px solid rgba(78,205,196,0.15);display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center">';
    html += '<span style="font-size:12px;color:#888">AI 自評：</span>';
    for (var k in labels) { if (sc[k]) html += '<span style="font-size:12px;color:' + (sc[k] >= 9 ? '#2ecc71' : sc[k] >= 7 ? '#f39c12' : '#e74c3c') + '">' + labels[k] + ' ' + sc[k] + '</span>'; }
    if (sc.avg) html += '<span style="font-size:13px;font-weight:700;color:' + (sc.avg >= 9 ? '#2ecc71' : '#f39c12') + '">平均 ' + sc.avg + '</span>';
    html += '</div>';
  }

  story.chapters.forEach((ch, i) => {
    html += '<div class="chapter-card" id="chapter' + i + '">' +
      '<div class="chapter-img" id="chImg' + i + '"><div class="img-loading"><div class="spinner"></div><span>生成配圖中...</span></div></div>' +
      '<div class="chapter-body">' +
        '<div class="chapter-num">第 ' + ch.num + ' 篇</div>' +
        '<div class="chapter-title">' + escHtml(ch.title) + '</div>' +
        '<div class="chapter-text">' + mdToHtml(ch.text) + '</div>' +
        (ch.hook ? '<div style="margin-top:12px;padding:10px 14px;border-radius:10px;background:rgba(240,147,251,0.08);border-left:3px solid #f093fb;font-size:14px;color:#f093fb;font-weight:600">💬 ' + escHtml(ch.hook) + '</div>' : '') +
      '</div>' +
      '<div class="chapter-actions">' +
        '<button onclick="copyChapter(' + i + ')">📋 複製</button>' +
        '<button onclick="regenImage(' + i + ')">🖼️ 重新生圖</button>' +
      '</div>' +
    '</div>';
  });

  // Show news sources if available
  if (story._sources && story._sources.length > 0) {
    html += '<div style="margin:16px 0;padding:14px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">';
    html += '<div style="font-size:13px;color:#f093fb;font-weight:600;margin-bottom:8px">📰 新聞來源</div>';
    story._sources.forEach(function(src) {
      if (src.url) html += '<div style="margin:4px 0"><a href="' + escHtml(src.url) + '" target="_blank" style="color:#4ecdc4;font-size:13px;text-decoration:none">' + escHtml(src.title || src.url) + '</a></div>';
    });
    html += '</div>';
  }

  html += '<div class="export-bar">' +
    '<button onclick="showEditUI(window._currentStory, window._editPublishedId || \'\')">✏️ 編輯章節</button>' +
    '<button onclick="aiScoreStory()">📊 AI 評分</button>' +
    '<button onclick="aiOptimizeStory()">✨ AI 優化</button>' +
    '<button onclick="regenAllImages()">🖼️ 重新生圖</button>' +
    '<button onclick="publishStory()">📤 發佈</button>' +
    '<button onclick="copyAll()">📋 複製全部</button>' +
    '<button onclick="downloadMD()">⬇️ 下載 MD</button>' +
  '</div>';

  output.innerHTML = html;

  // Generate images async (only if enabled)
  if (_generateImages) {
    story.chapters.forEach((ch, i) => {
      generateImage(ch.imagePrompt, i);
    });
  } else {
    // Hide image placeholders
    story.chapters.forEach((ch, i) => {
      var imgEl = document.getElementById('chImg' + i);
      if (imgEl) imgEl.style.display = 'none';
    });
  }

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
function saveStory(topic, style, audience, story, publishedId) {
  try {
    const list = JSON.parse(localStorage.getItem('storyHistory') || '[]');
    list.unshift({ topic, style, audience, story, date: new Date().toISOString(), publishedId: publishedId || null });
    if (list.length > 50) list.length = 50;
    localStorage.setItem('storyHistory', JSON.stringify(list));
  } catch (_) {}
}

// === Utils ===
function escHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function mdToHtml(s) {
  if (!s) return '';
  var h = escHtml(s);
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
  h = h.replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:3px">$1</code>');
  h = h.replace(/^### (.+)$/gm, '<div style="font-size:15px;font-weight:600;color:#f093fb;margin:12px 0 4px">$1</div>');
  h = h.replace(/^## (.+)$/gm, '<div style="font-size:16px;font-weight:700;color:#fff;margin:14px 0 6px">$1</div>');
  h = h.replace(/^# (.+)$/gm, '<div style="font-size:18px;font-weight:700;color:#fff;margin:16px 0 8px">$1</div>');
  h = h.replace(/^[-•] (.+)$/gm, '<div style="padding-left:16px">• $1</div>');
  h = h.replace(/^\d+\. (.+)$/gm, function(m, p1, offset, str) { return '<div style="padding-left:16px">' + m + '</div>'; });
  h = h.replace(/\n/g, '<br>');
  return h;
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// === Publish News to GitHub Pages ===
async function publishNews() {
  if (!window._currentStory || !window._currentStory.articles) { showToast('沒有新聞可發佈'); return; }
  var news = window._currentStory;
  showToast('📤 發佈新聞中...');
  var id = 'news-' + new Date().toISOString().split('T')[0];
  var filename = id + '.html';
  var html = '<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">';
  html += '<title>' + escHtml((news.date || '') + ' 今日新聞') + '</title><link rel="stylesheet" href="reader.css?v=1"></head><body>';
  html += '<div class="stories-header"><h1>📰 今日新聞</h1><p>' + escHtml(news.date || '') + '</p>';
  if (news.headline) html += '<p style="color:#f093fb;margin-top:8px;font-weight:600">' + escHtml(news.headline) + '</p>';
  html += '</div><div class="stories-list" style="max-width:700px">';
  news.articles.forEach(function(a) {
    var url = a.url || '#';
    html += '<div style="padding:16px 20px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);margin-bottom:10px">';
    if (a.category) html += '<span style="font-size:11px;color:#f093fb;font-weight:600;padding:2px 8px;border-radius:4px;background:rgba(240,147,251,0.1)">' + escHtml(a.category) + '</span> ';
    if (a.time) html += '<span style="font-size:11px;color:#666">' + escHtml(a.time) + '</span>';
    html += '<div style="margin-top:6px"><a href="' + escHtml(url) + '" target="_blank" style="font-size:17px;font-weight:600;color:#eee;text-decoration:none;line-height:1.4">' + escHtml(a.title) + '</a></div>';
    html += '<div style="font-size:14px;color:#aaa;line-height:1.7;margin-top:6px">' + escHtml(a.summary) + '</div>';
    html += '<div style="margin-top:8px">';
    if (a.source) html += '<span style="font-size:12px;color:#888">📰 ' + escHtml(a.source) + '</span> ';
    html += '<a href="' + escHtml(url) + '" target="_blank" style="font-size:12px;color:#4ecdc4;text-decoration:none;font-weight:600">閱讀全文 →</a>';
    html += '</div></div>';
  });
  html += '</div><div style="text-align:center;padding:20px"><a href="index.html" style="color:#f093fb;text-decoration:none">← 所有故事</a></div></body></html>';
  try {
    var pubResp = await fetch(API_BASE + '/api/story-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, title: (news.date || '') + ' 今日新聞', chapters: news.articles.length, html: html })
    });
    if (!pubResp.ok) { var e = {}; try { e = await pubResp.json(); } catch(_){} throw new Error(e.error || 'Publish ' + pubResp.status); }
    var url = STORIES_BASE + filename;
    showToast('✅ 新聞已發佈！');
    var output = document.getElementById('output');
    output.innerHTML += '<div style="margin:16px 0;padding:16px;border-radius:12px;background:rgba(46,204,113,0.1);border:1px solid rgba(46,204,113,0.3);text-align:center"><div style="font-size:15px;color:#2ecc71;font-weight:600;margin-bottom:8px">✅ 新聞已發佈</div><a href="' + url + '" target="_blank" style="color:#4ecdc4;word-break:break-all">' + url + '</a></div>';
  } catch(e) { showToast('❌ 發佈失敗: ' + e.message); }
}

// === Publish Story to GitHub Pages ===
async function publishStory() {
  if (!window._currentStory) { showToast('沒有故事可發佈'); return; }
  const story = window._currentStory;
  showToast('📤 發佈中...');

  // Reuse existing ID if republishing an edited story, otherwise generate new
  const id = window._editPublishedId || Date.now().toString(36);
  const filename = id + '.html';
  // Clear edit state after using it
  window._editPublishedId = null;

  // Build standalone HTML — images will be generated server-side
  var html = '<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">';
  html += '<title>' + escHtml(story.title || '故事') + '</title>';
  html += '<link rel="stylesheet" href="reader.css?v=1">';
  html += '</head><body>';
  html += '<div class="reader-header"><a href="index.html" class="back-link">\u2190 所有故事</a></div>';
  html += '<article class="story">';
  html += '<h1 class="story-title">' + escHtml(story.title) + '</h1>';

  var imagePrompts = [];
  story.chapters.forEach(function(ch, i) {
    if (ch.imagePrompt) imagePrompts.push({ idx: i, prompt: ch.imagePrompt });
    html += '<section class="chapter">';
    html += '<div class="chapter-cover" id="cover' + i + '"><img src="img/' + id + '_' + i + '.png" alt="" onerror="this.parentElement.style.display=\'none\'"></div>';
    html += '<div class="chapter-num">\u7B2C ' + ch.num + ' \u7BC7</div>';
    html += '<h2>' + escHtml(ch.title) + '</h2>';
    html += '<div class="chapter-content">' + escHtml(ch.text).replace(/\n/g, '<br>') + '</div>';
    if (ch.hook) html += '<blockquote class="hook">\uD83D\uDCAC ' + escHtml(ch.hook) + '</blockquote>';
    html += '</section>';
  });
  html += '</article>';
  html += '<div class="reader-footer"><a href="index.html">← 更多故事</a></div>';
  // Audio Player — simple, uses absolute URLs for reliability
  html += '<div class="audio-bar" id="audioBar">';
  html += '<button id="btnTTS" onclick="toggleTTS()">🔊 朗讀</button>';
  html += '<div class="progress"><span class="current-chapter" id="ttsStatus">點擊開始朗讀</span></div>';
  html += '<button onclick="stopTTS()" style="background:#333;padding:6px 12px;font-size:12px">⏹</button>';
  html += '</div>';
  var audioBase = 'https://joeliang2022.github.io/fukuoka-trip/stories/audio/';
  var audioFiles = [];
  for (var ai = 0; ai < story.chapters.length; ai++) { audioFiles.push('"' + audioBase + id + '_' + ai + '.wav"'); }
  html += '<audio id="ap" preload="auto" crossorigin="anonymous"></audio>';
  html += '<script>';
  html += 'var au=document.getElementById("ap");';
  html += 'var files=[' + audioFiles.join(',') + '];';
  html += 'var ci=0,playing=false,actx=null,src=null,rev=null;';
  // Setup Web Audio with reverb
  html += 'function setupAudio(){if(actx)return;try{actx=new(window.AudioContext||window.webkitAudioContext)();src=actx.createMediaElementSource(au);';
  // Create reverb using IIR filter (simple room reverb simulation)
  html += 'var conv=actx.createConvolver();var rate=actx.sampleRate;var len=rate*1.5;var buf=actx.createBuffer(2,len,rate);';
  html += 'for(var ch=0;ch<2;ch++){var d=buf.getChannelData(ch);for(var j=0;j<len;j++){d[j]=(Math.random()*2-1)*Math.pow(1-j/len,2.5);}}';
  html += 'conv.buffer=buf;var dry=actx.createGain();dry.gain.value=0.85;var wet=actx.createGain();wet.gain.value=0.15;';
  html += 'src.connect(dry);src.connect(conv);conv.connect(wet);dry.connect(actx.destination);wet.connect(actx.destination);';
  html += '}catch(e){src=null;actx=null;}}';
  html += 'function playChapter(i){if(i>=files.length){document.getElementById("ttsStatus").textContent="朗讀完畢";playing=false;ci=0;document.getElementById("btnTTS").textContent="🔊 朗讀";return;}ci=i;document.getElementById("ttsStatus").textContent="第"+(i+1)+"篇/"+files.length;setupAudio();au.src=files[i];au.onended=function(){playChapter(i+1);};au.play();}';
  html += 'function toggleTTS(){if(playing){au.pause();playing=false;document.getElementById("btnTTS").textContent="▶ 繼續";}else{playing=true;document.getElementById("btnTTS").textContent="⏸ 暫停";if(au.src&&au.paused&&au.currentTime>0){au.play();}else{playChapter(ci);}}}';
  html += 'function stopTTS(){au.pause();au.removeAttribute("src");playing=false;ci=0;document.getElementById("btnTTS").textContent="🔊 朗讀";document.getElementById("ttsStatus").textContent="已停止";}';
  html += '<\/script>';
html += '</body></html>';

  try {
    // Upload via server proxy (skip images if republishing edited story)
    var pubBody = { id: id, title: story.title || '故事', chapters: story.chapters.length, html: html };
    if (imagePrompts.length > 0) pubBody.imagePrompts = imagePrompts;
    var pubResp = await fetch(API_BASE + '/api/story-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pubBody)
    });
    if (!pubResp.ok) {
      var errData = {};
      try { errData = await pubResp.json(); } catch(_) {}
      throw new Error(errData.error || 'Publish API ' + pubResp.status);
    }

    var url = STORIES_BASE + filename;
    showToast('✅ 已發佈！');
    // Save publishedId to localStorage backup
    try {
      var list = JSON.parse(localStorage.getItem('storyHistory') || '[]');
      var found = list.find(function(l) { return l.story && l.story.title === story.title; });
      if (found) { found.publishedId = id; }
      else { list.unshift({ topic: story.title, style: _selectedStyle, audience: '', story: story, date: new Date().toISOString(), publishedId: id }); }
      if (list.length > 50) list.length = 50;
      localStorage.setItem('storyHistory', JSON.stringify(list));
    } catch(_) {}
    // Show publish result — clear and detailed
    var output = document.getElementById('output');
    var pubInfo = '<div style="margin:16px 0;padding:20px;border-radius:14px;background:rgba(46,204,113,0.08);border:1px solid rgba(46,204,113,0.25)">';
    pubInfo += '<div style="text-align:center;margin-bottom:12px"><span style="font-size:32px">✅</span></div>';
    pubInfo += '<div style="text-align:center;font-size:17px;font-weight:700;color:#2ecc71;margin-bottom:4px">發佈成功</div>';
    pubInfo += '<div style="text-align:center;font-size:15px;color:#ddd;margin-bottom:4px">' + escHtml(story.title || '故事') + '</div>';
    pubInfo += '<div style="text-align:center;font-size:13px;color:#888;margin-bottom:14px">' + story.chapters.length + ' 篇章</div>';
    pubInfo += '<div style="text-align:center;margin-bottom:10px"><a href="' + url + '" target="_blank" style="color:#4ecdc4;font-size:14px;word-break:break-all">' + url + '</a></div>';
    pubInfo += '<div style="text-align:center;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">';
    pubInfo += '<button onclick="navigator.clipboard.writeText(\'' + url + '\');showToast(\'已複製連結\')" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(78,205,196,0.3);background:rgba(78,205,196,0.1);color:#4ecdc4;cursor:pointer;font-size:13px">📋 複製連結</button>';
    pubInfo += '<button onclick="window.open(\'' + url + '\',\'_blank\')" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(240,147,251,0.3);background:rgba(240,147,251,0.1);color:#f093fb;cursor:pointer;font-size:13px">🔗 開啟故事</button>';
    pubInfo += '</div>';
    pubInfo += '<div style="text-align:center;font-size:11px;color:#666;margin-top:10px">⏳ GitHub Pages 部署約需 1-2 分鐘，若顯示 404 請稍後再試</div>';
    pubInfo += '</div>';
    output.innerHTML += pubInfo;
    // Auto-generate TTS audio after publish
    // Always generate voice (default Aoede) — user shouldn't need to manually select
    var voiceMap = {'kore':'Kore','zephyr':'Zephyr','aoede':'Aoede','leda':'Leda','puck':'Puck','orus':'Orus'};
    var selectedVoice = (_voiceMode !== 'off' && _voiceMode !== 'browser' && voiceMap[_voiceMode]) ? voiceMap[_voiceMode] : 'Aoede';
    showToast('🔊 語音生成中（' + selectedVoice + '），請稍候...');
    fetch(API_BASE + '/api/story/gen-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Passcode': ACCESS_CODE },
      body: JSON.stringify({ id: id, chapterTexts: story.chapters.map(function(ch) { return ch.title + '。' + ch.text; }), voice: selectedVoice })
    }).then(function(ttsResp) {
      if (ttsResp.ok) return ttsResp.json();
      return null;
    }).then(function(ttsData) {
      if (ttsData && ttsData.results) {
        var ttsOk = ttsData.results.filter(function(r) { return r.ok; }).length;
        showToast('✅ 語音已生成（' + ttsOk + '/' + story.chapters.length + ' 篇）');
      }
    }).catch(function() {});
  } catch (e) {
    showToast('❌ 發佈失敗: ' + e.message);
  }
}

// === AI Score + Auto-Optimize Loop ===
async function aiScoreStory() {
  if (!window._currentStory) { showToast('沒有故事'); return; }
  var output = document.getElementById('output');
  var maxRounds = 5;
  var history = [];
  var story = window._currentStory;

  for (var round = 1; round <= maxRounds; round++) {
    // Step 1: Score
    output.innerHTML += '<div id="scoreRound' + round + '" style="margin:12px 0;padding:14px;border-radius:12px;background:rgba(240,147,251,0.06);border:1px solid rgba(240,147,251,0.15)"><div style="font-size:14px;color:#f093fb;font-weight:600">📊 第 ' + round + ' 輪評分中...</div></div>';
    var storyText = story.chapters.map(function(ch) { return '【第' + ch.num + '篇】' + ch.title + '\n' + ch.text; }).join('\n\n');
    // Limit total length to avoid API issues
    if (storyText.length > 8000) storyText = storyText.substring(0, 8000) + '\n\n...（後續篇章省略）';
    var scorePrompt = '評分以下文章（滿分10），用JSON回覆：{"scores":{"scene":0,"character":0,"depth":0,"pacing":0,"foreshadow":0,"tone":0,"memorable":0},"feedback":"改善建議","lowAreas":"最需改善的具體問題"}\n\n評分標準：scene=場景具體度 character=人物真實感 depth=概念深度 pacing=結構節奏 foreshadow=伏筆收尾 tone=語氣一致性 memorable=讀者記憶點\n\n' + storyText;
    try {
      var resp = await fetch(API_BASE + '/api/story-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: scorePrompt }) });
      if (!resp.ok) break;
      var data = await resp.json();
      var raw = data.text || '';
      var tick3 = String.fromCharCode(96,96,96);
      var cleaned = raw.replace(new RegExp(tick3 + 'json\\s*', 'g'), '').replace(new RegExp(tick3 + '\\s*', 'g'), '').trim();
      var score; try { score = JSON.parse(cleaned); } catch(pe) { var jsonMatch = cleaned.match(/\{[\s\S]*\}/); if (jsonMatch) score = JSON.parse(jsonMatch[0]); else throw pe; }
      var s = score.scores || {};
      var labels = {scene:'場景',character:'人物',depth:'深度',pacing:'節奏',foreshadow:'伏筆',tone:'語氣',memorable:'記憶點'};
      var allAbove9 = true;
      var lowItems = [];
      var scoreHtml = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">';
      for (var k in labels) {
        if (s[k] !== undefined) {
          scoreHtml += '<span style="font-size:12px;color:' + (s[k] >= 9 ? '#2ecc71' : s[k] >= 7 ? '#f39c12' : '#e74c3c') + '">' + labels[k] + ' ' + s[k] + '</span>';
          if (s[k] < 9) { allAbove9 = false; lowItems.push(labels[k] + '(' + s[k] + ')'); }
        }
      }
      scoreHtml += '</div>';
      if (score.feedback) scoreHtml += '<div style="font-size:12px;color:#aaa;margin-top:4px">' + escHtml(score.feedback) + '</div>';
      // Compare with previous round
      if (history.length > 0) {
        var prev = history[history.length - 1].scores;
        var changes = [];
        for (var ck in labels) {
          if (s[ck] !== undefined && prev[ck] !== undefined) {
            var diff = s[ck] - prev[ck];
            if (diff !== 0) changes.push(labels[ck] + (diff > 0 ? '↑' : '↓') + Math.abs(diff));
          }
        }
        if (changes.length > 0) {
          var changeEl = document.getElementById('scoreRound' + round);
          if (changeEl) changeEl.innerHTML += '<div style="font-size:12px;color:#888;margin-top:4px">變化：' + changes.join(' ') + '</div>';
        }
        // Rollback if overall got worse
        var prevAvg = 0, curAvg = 0, cnt = 0;
        for (var ak in labels) { if (s[ak] && prev[ak]) { prevAvg += prev[ak]; curAvg += s[ak]; cnt++; } }
        if (cnt > 0 && curAvg / cnt < prevAvg / cnt && window._prevChapters) {
          story.chapters = window._prevChapters;
          window._currentStory = story;
          var rbEl = document.getElementById('scoreRound' + round);
          if (rbEl) rbEl.innerHTML += '<div style="font-size:12px;color:#f5576c;margin-top:4px">⚠️ 分數下降，已回滾到上一版</div>';
          break;
        }
      }
      history.push({ round: round, scores: s, low: lowItems.join('、') });

      var el = document.getElementById('scoreRound' + round);
      if (el) el.innerHTML = '<div style="font-size:14px;color:#f093fb;font-weight:600">📊 第 ' + round + ' 輪</div>' + scoreHtml + (lowItems.length > 0 ? '<div style="font-size:12px;color:#f5576c;margin-top:4px">低分：' + lowItems.join('、') + '</div>' : '<div style="font-size:13px;color:#2ecc71;font-weight:600;margin-top:4px">✅ 全部 9 分以上！</div>');

      if (allAbove9) {
        showToast('✅ 全部達標！共 ' + round + ' 輪');
        break;
      }
      if (round >= maxRounds) {
        showToast('⚠️ 已達最大輪數 ' + maxRounds);
        break;
      }

      // Step 2: Optimize low scores
      el.innerHTML += '<div style="font-size:12px;color:#888;margin-top:6px">🔧 優化中...</div>';
      // Find the worst chapter based on feedback
      var worstIdx = Math.floor(Math.random() * story.chapters.length);
      var worstCh = story.chapters[worstIdx];
      var storyJson = JSON.stringify({ num: worstCh.num, title: worstCh.title, text: worstCh.text, hook: worstCh.hook });
      var optPrompt = '優化以下篇章（只改低分部分）。低分項目：' + lowItems.join('、') + '\n改善建議：' + (score.feedback || '') + '\n' + (score.lowAreas || '') + '\n\n規則：禁止指令用語、禁止TED演講結尾\n回覆優化後JSON（同格式）：\n' + storyJson;
      var resp2 = await fetch(API_BASE + '/api/story-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: optPrompt }) });
      if (!resp2.ok) break;
      var data2 = await resp2.json();
      var raw2 = data2.text || '';
      var cleaned2 = raw2.replace(new RegExp(tick3 + 'json\\s*', 'g'), '').replace(new RegExp(tick3 + '\\s*', 'g'), '').trim();
      var optimized; try { optimized = JSON.parse(cleaned2); } catch(pe2) { var jm2 = cleaned2.match(/\{[\s\S]*\}/); if (jm2) optimized = JSON.parse(jm2[0]); else throw pe2; }
      if (optimized.chapters) {
        // Save previous version for potential rollback
        window._prevChapters = JSON.parse(JSON.stringify(story.chapters));
        story.chapters = optimized.chapters;
        if (optimized.title) story.title = optimized.title;
        window._currentStory = story;
      }
    } catch(e) { 
      var el2 = document.getElementById('scoreRound' + round);
      if (el2) el2.innerHTML += '<div style="font-size:12px;color:#f5576c;margin-top:4px">❌ 失敗: ' + escHtml(e.message) + '</div>';
      break;
    }
    // Delay between rounds to avoid rate limit
    await new Promise(function(r) { setTimeout(r, 3000); })
  }

  // Re-render story with updated content + export bar, then append score history
  renderStory(window._currentStory);
  if (history.length > 0) {
    var histHtml = '<div style="margin:12px 0;padding:12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">';
    histHtml += '<div style="font-size:13px;color:#f093fb;font-weight:600;margin-bottom:6px">📈 評分歷程（共 ' + history.length + ' 輪）</div>';
    history.forEach(function(h) { histHtml += '<div style="font-size:12px;color:#aaa">第' + h.round + '輪：' + (h.low || '✅ 全部達標') + '</div>'; });
    histHtml += '</div>';
    output.innerHTML += histHtml;
  }
}

// === AI Optimize Low Scores (targeted) ===
async function aiOptimizeLowScores() {
  if (!window._currentStory || !window._lastScores) { showToast('請先評分'); return; }
  var scores = window._lastScores.scores || {};
  var weaknesses = window._lastScores.weaknesses || '';
  var feedback = window._lastScores.feedback || '';
  // Find which areas need improvement
  var improvements = [];
  if (scores.plot < 9) improvements.push('劇情邏輯（目前' + scores.plot + '分）：加強因果關係、減少巧合');
  if (scores.characters < 9) improvements.push('角色深度（目前' + scores.characters + '分）：用行為和對話展現性格，增加內心掙扎');
  if (scores.pacing < 9) improvements.push('節奏感（目前' + scores.pacing + '分）：調整快慢節奏，關鍵處用短句');
  if (scores.hook < 9) improvements.push('吸引力（目前' + scores.hook + '分）：加強開頭懸念和結尾 cliffhanger');

  showToast('🔧 優化中（只改低分部分）...');
  var story = window._currentStory;
  var storyJson = JSON.stringify({ title: story.title, chapters: story.chapters.map(function(ch) { return { num: ch.num, title: ch.title, text: ch.text, hook: ch.hook }; }) });

  var prompt = '以下故事需要局部優化（不要整篇重寫，只改善弱項）。\n\n' +
    '需要改善的項目：\n' + improvements.join('\n') + '\n\n' +
    '評審意見：' + weaknesses + '\n' + feedback + '\n\n' +
    '規則：\n- 只修改需要改善的部分，保留好的內容\n- 禁止出現指令用語（自我矛盾、付出代價等）\n- 禁止結尾變 TED 演講\n- 回覆完整的優化後 JSON（同格式）\n\n' + storyJson;

  try {
    var resp = await fetch(API_BASE + '/api/story-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt }) });
    if (!resp.ok) throw new Error('API ' + resp.status);
    var data = await resp.json();
    var raw = data.text || '';
    var tick3 = String.fromCharCode(96,96,96);
    var cleaned = raw.replace(new RegExp(tick3 + 'json\\s*', 'g'), '').replace(new RegExp(tick3 + '\\s*', 'g'), '').trim();
    var optimized = JSON.parse(cleaned);
    if (optimized.chapters) {
      window._currentStory.chapters = optimized.chapters;
      if (optimized.title) window._currentStory.title = optimized.title;
      renderStory(window._currentStory);
      showToast('✅ 低分項目已優化，請重新評分確認');
    }
  } catch(e) { showToast('優化失敗: ' + e.message); }
}

// === AI Optimize Story ===
async function aiOptimizeStory() {
  if (!window._currentStory) { showToast('沒有故事'); return; }
  if (!confirm('AI 將逐篇優化故事。繼續嗎？')) return;
  var story = window._currentStory;
  var output = document.getElementById('output');
  
  for (var i = 0; i < story.chapters.length; i++) {
    var ch = story.chapters[i];
    showToast('✨ 優化第 ' + ch.num + ' 篇...');
    var prompt = '優化以下篇章（保留好的部分，改善弱項）。禁止指令用語、禁止說教結尾。\n\n' +
      '故事標題：' + story.title + '\n' +
      '第 ' + ch.num + ' 篇「' + ch.title + '」：\n' + ch.text + '\n\n' +
      '回覆優化後的 JSON（不要 markdown）：{"title":"篇章標題","text":"優化後內容","hook":"金句"}';
    try {
      var resp = await fetch(API_BASE + '/api/story-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt }) });
      if (!resp.ok) continue;
      var data = await resp.json();
      var raw = data.text || '';
      var tick3 = String.fromCharCode(96,96,96);
      var cleaned = raw.replace(new RegExp(tick3 + 'json\\s*', 'g'), '').replace(new RegExp(tick3 + '\\s*', 'g'), '').trim();
      try {
        var opt = JSON.parse(cleaned);
        if (opt.text) { ch.text = opt.text; if (opt.title) ch.title = opt.title; if (opt.hook) ch.hook = opt.hook; }
      } catch(pe) { var m = cleaned.match(/\{[\s\S]*\}/); if (m) { var opt2 = JSON.parse(m[0]); if (opt2.text) { ch.text = opt2.text; if (opt2.title) ch.title = opt2.title; } } }
    } catch(e) { /* skip failed chapter */ }
    await new Promise(function(r) { setTimeout(r, 2000); });
  }
  
  window._currentStory = story;
  renderStory(story);
  showToast('✅ 逐篇優化完成');
}

// === Regenerate All Images ===
function startReading() {
  if (_voiceMode === 'off') { showToast('請先選擇語音模式'); return; }
  if (_voiceMode === 'browser') { readStoryBrowser(); return; }
  // Gemini TTS voices
  var voiceMap = {'kore':'Kore','zephyr':'Zephyr','aoede':'Aoede','leda':'Leda','puck':'Puck','orus':'Orus'};
  var voiceName = voiceMap[_voiceMode];
  if (voiceName) { readStoryGemini(voiceName); return; }
  showToast('未知的語音模式');
}

function regenAllImages() {
  if (!window._currentStory) { showToast('沒有故事'); return; }
  showToast('🖼️ 重新生成所有圖片...');
  window._currentStory.chapters.forEach(function(ch, i) {
    var imgEl = document.getElementById('chImg' + i);
    if (imgEl) imgEl.innerHTML = '<div class="img-loading"><div class="spinner"></div><span>重新生成...</span></div>';
    generateImage(ch.imagePrompt, i);
  });
}

// === Published Stories Management ===
async function showPublished() {
  var output = document.getElementById('output');
  output.innerHTML = '<div class="loading"><div class="spinner"></div><p>載入已發佈故事...</p></div>';
  try {
    var resp = await fetch(API_BASE + '/api/story-list');
    if (!resp.ok) throw new Error('API ' + resp.status);
    var data = await resp.json();
    var stories = data.stories || [];
    // Also load local backups
    var localList = [];
    try { localList = JSON.parse(localStorage.getItem('storyHistory') || '[]'); } catch(_) {}
    if (stories.length === 0 && localList.length === 0) {
      output.innerHTML = '<div style="text-align:center;padding:40px;color:#888">還沒有發佈的故事</div>';
      return;
    }
    var html = '<div style="margin:20px 0 12px"><div style="font-size:18px;font-weight:700;color:#fff">📂 已發佈故事（' + stories.length + '）</div></div>';
    stories.forEach(function(s, i) {
      // Check if we have a local backup for this story
      var hasBackup = localList.some(function(l) { return l.publishedId === s.id; });
      html += '<div style="margin:8px 0;padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between">';
      html += '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:600;color:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(s.title) + '</div>';
      html += '<div style="font-size:12px;color:#666;margin-top:2px">' + (s.chapters || 0) + ' 篇 · ' + (s.date || '') + (hasBackup ? ' · 📝 有備份' : '') + '</div></div>';
      html += '<div style="display:flex;gap:6px;flex-shrink:0;margin-left:12px">';
      html += '<button onclick="editPublished(\'' + escHtml(s.id) + '\',\'' + escHtml(s.file) + '\')" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(240,147,251,0.3);background:rgba(240,147,251,0.08);color:#f093fb;font-size:12px;cursor:pointer">✏️ 編輯</button>';
      html += '<a href="https://joeliang2022.github.io/fukuoka-trip/stories/' + escHtml(s.file) + '" target="_blank" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(78,205,196,0.3);background:rgba(78,205,196,0.08);color:#4ecdc4;font-size:12px;text-decoration:none">查看</a>';
      html += '<button onclick="deletePublished(\'' + escHtml(s.id) + '\',\'' + escHtml(s.file) + '\')" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(245,87,108,0.3);background:rgba(245,87,108,0.08);color:#f5576c;font-size:12px;cursor:pointer">刪除</button>';
      html += '</div></div>';
    });
    // Show local-only stories (not yet published or backup without remote)
    var localOnly = localList.filter(function(l) { return l.story && l.story.title; });
    if (localOnly.length > 0) {
      html += '<div style="margin:20px 0 8px;font-size:14px;color:#888">📝 本機備份（' + localOnly.length + '）</div>';
      localOnly.slice(0, 10).forEach(function(l, i) {
        html += '<div style="margin:6px 0;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:space-between">';
        html += '<div style="flex:1;min-width:0"><div style="font-size:14px;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(l.story.title) + '</div>';
        html += '<div style="font-size:11px;color:#555">' + (l.story.chapters ? l.story.chapters.length : 0) + ' 篇 · ' + (l.date || '').split('T')[0] + '</div></div>';
        html += '<button onclick="loadLocalStory(' + i + ')" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(240,147,251,0.3);background:rgba(240,147,251,0.08);color:#f093fb;font-size:11px;cursor:pointer;flex-shrink:0;margin-left:8px">開啟</button>';
        html += '</div>';
      });
    }
    output.innerHTML = html;
  } catch(e) {
    output.innerHTML = '<div style="text-align:center;padding:40px;color:#888">載入失敗: ' + escHtml(e.message) + '</div>';
  }
}

async function deletePublished(id, file) {
  if (!confirm('確定要刪除「' + id + '」嗎？')) return;
  showToast('🗑 刪除中...');
  try {
    var resp = await fetch(API_BASE + '/api/story-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, file: file })
    });
    if (!resp.ok) throw new Error('API ' + resp.status);
    showToast('✅ 已刪除');
    showPublished();
  } catch(e) {
    showToast('❌ 刪除失敗: ' + e.message);
  }
}

// === Boot ===
// Only init if already authenticated (otherwise wait for checkAuth)
if (sessionStorage.getItem('storyAuth') !== '1') {
  // Show auth gate, don't init
} else {
  // Already handled by auto-login block above
}

// === Load Local Story Backup ===
function loadLocalStory(index) {
  try {
    var list = JSON.parse(localStorage.getItem('storyHistory') || '[]');
    var item = list[index];
    if (!item || !item.story) { showToast('找不到備份'); return; }
    window._currentStory = item.story;
    window._editPublishedId = item.publishedId || null;
    renderStory(item.story);
    showToast('已載入：' + (item.story.title || ''));
  } catch(e) { showToast('載入失敗'); }
}

// === Edit Published Story ===
async function editPublished(publishedId, file) {
  // Try local backup first
  try {
    var list = JSON.parse(localStorage.getItem('storyHistory') || '[]');
    var item = list.find(function(l) { return l.publishedId === publishedId; });
    if (item && item.story && item.story.chapters) {
      window._currentStory = item.story;
      window._editPublishedId = publishedId;
      showEditUI(item.story, publishedId);
      return;
    }
  } catch(_) {}

  // No local backup — fetch from GitHub Pages and parse HTML
  var output = document.getElementById('output');
  output.innerHTML = '<div class="loading"><div class="spinner"></div><p>載入故事內容...</p></div>';
  try {
    var url = 'https://joeliang2022.github.io/fukuoka-trip/stories/' + (file || publishedId + '.html');
    var resp = await fetch(url);
    if (!resp.ok) throw new Error('無法載入故事');
    var html = await resp.text();

    // Parse HTML back to story object
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    var title = (doc.querySelector('.story-title') || doc.querySelector('h1') || {}).textContent || '';
    var chapterEls = doc.querySelectorAll('.chapter, section');
    var chapters = [];
    for (var i = 0; i < chapterEls.length; i++) {
      var el = chapterEls[i];
      var h2 = el.querySelector('h2');
      var content = el.querySelector('.chapter-content');
      var hook = el.querySelector('.hook, blockquote');
      if (h2 && content) {
        chapters.push({
          num: i + 1,
          title: h2.textContent || '',
          text: content.textContent || '',
          imagePrompt: '',
          hook: hook ? hook.textContent.replace(/^💬\s*/, '') : ''
        });
      }
    }
    if (chapters.length === 0) throw new Error('無法解析故事章節');

    var story = { title: title, characters: [], chapters: chapters };
    window._currentStory = story;
    window._editPublishedId = publishedId;

    // Save to local backup
    var list2 = [];
    try { list2 = JSON.parse(localStorage.getItem('storyHistory') || '[]'); } catch(_) {}
    list2.unshift({ topic: title, style: '', audience: '', story: story, date: new Date().toISOString(), publishedId: publishedId });
    if (list2.length > 50) list2.length = 50;
    localStorage.setItem('storyHistory', JSON.stringify(list2));

    showEditUI(story, publishedId);
  } catch(e) {
    output.innerHTML = '<div style="text-align:center;padding:40px;color:#f5576c">載入失敗: ' + escHtml(e.message) + '</div>';
  }
}

// === Show Edit UI with chapter checkboxes ===
function showEditUI(story, publishedId) {
  var output = document.getElementById('output');
  var html = '<div style="margin:16px 0">';
  html += '<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">✏️ 編輯故事</div>';
  html += '<div style="font-size:15px;color:#ddd;margin-bottom:12px">' + escHtml(story.title) + '</div>';

  // Chapter selection
  html += '<div style="margin-bottom:12px">';
  html += '<div style="display:flex;gap:8px;margin-bottom:8px">';
  html += '<button onclick="toggleAllChapters(true)" style="padding:5px 12px;border-radius:8px;border:1px solid rgba(78,205,196,0.3);background:rgba(78,205,196,0.08);color:#4ecdc4;font-size:12px;cursor:pointer">全選</button>';
  html += '<button onclick="toggleAllChapters(false)" style="padding:5px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#888;font-size:12px;cursor:pointer">取消全選</button>';
  html += '</div>';

  story.chapters.forEach(function(ch, i) {
    html += '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;margin:4px 0;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);cursor:pointer">';
    html += '<input type="checkbox" class="ch-select" value="' + i + '" style="margin-top:3px;flex-shrink:0">';
    html += '<div style="flex:1;min-width:0"><div style="font-size:13px;color:#f093fb;font-weight:600">第 ' + ch.num + ' 篇</div>';
    html += '<div style="font-size:14px;color:#ddd;margin-top:2px">' + escHtml(ch.title) + '</div>';
    html += '<div style="font-size:12px;color:#777;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + escHtml((ch.text || '').substring(0, 100)) + '...</div>';
    html += '</div></label>';
  });
  html += '</div>';

  // Edit prompt
  html += '<div style="margin-bottom:12px">';
  html += '<div style="font-size:13px;color:#888;margin-bottom:6px">修改指令（告訴 AI 要怎麼改）</div>';
  html += '<textarea id="editPrompt" rows="4" placeholder="例如：把第3篇的結尾改成更有懸念的、加強角色之間的衝突、把說教的部分改成用場景展現..." style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;resize:vertical;box-sizing:border-box"></textarea>';
  html += '</div>';

  // Action buttons
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  html += '<button onclick="executeEdit(\'' + escHtml(publishedId) + '\')" style="padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#f093fb,#f5576c);color:#fff;font-size:14px;font-weight:600;cursor:pointer">✨ 修改選中章節</button>';
  html += '<button onclick="renderStory(window._currentStory)" style="padding:10px 20px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#ccc;font-size:14px;cursor:pointer">👁 預覽全文</button>';
  html += '<button onclick="showPublished()" style="padding:10px 20px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#888;font-size:14px;cursor:pointer">← 返回</button>';
  html += '</div></div>';

  output.innerHTML = html;
}

function toggleAllChapters(checked) {
  document.querySelectorAll('.ch-select').forEach(function(cb) { cb.checked = checked; });
}

// === Execute Edit: regenerate selected chapters with prompt ===
async function executeEdit(publishedId) {
  var story = window._currentStory;
  if (!story) { showToast('沒有故事'); return; }

  var editPrompt = document.getElementById('editPrompt').value.trim();
  if (!editPrompt) { showToast('請輸入修改指令'); return; }

  var selected = [];
  document.querySelectorAll('.ch-select:checked').forEach(function(cb) {
    selected.push(parseInt(cb.value));
  });
  if (selected.length === 0) { showToast('請選擇要修改的章節'); return; }

  var output = document.getElementById('output');
  showToast('✨ 修改中...');

  for (var si = 0; si < selected.length; si++) {
    var idx = selected[si];
    var ch = story.chapters[idx];
    if (!ch) continue;

    output.innerHTML = '<div class="loading"><div class="spinner"></div><p>修改第 ' + ch.num + ' 篇... (' + (si + 1) + '/' + selected.length + ')</p></div>';

    var prompt = '你是一位資深編輯。請根據以下指令修改這篇文章。\n\n' +
      '【修改指令】' + editPrompt + '\n\n' +
      '【原文】\n標題：' + ch.title + '\n內容：' + ch.text + '\n金句：' + (ch.hook || '') + '\n\n' +
      '【規則】\n- 保留原文好的部分，只改需要改的\n- 修改後的篇幅要和原文相近\n- 用 JSON 回覆（不要 markdown）：{"num":' + ch.num + ',"title":"修改後標題","text":"修改後內容","imagePrompt":"英文配圖描述","hook":"金句"}';

    try {
      var resp = await fetch(API_BASE + '/api/story-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt, style: _selectedStyle })
      });
      if (!resp.ok) continue;
      var data = await resp.json();
      var raw = data.text || '';
      var tick3 = String.fromCharCode(96,96,96);
      var cleaned = raw.replace(new RegExp(tick3 + 'json\\s*', 'g'), '').replace(new RegExp(tick3 + '\\s*', 'g'), '').trim();
      var edited = JSON.parse(cleaned);
      if (edited.text) {
        story.chapters[idx] = { num: ch.num, title: edited.title || ch.title, text: edited.text, imagePrompt: edited.imagePrompt || ch.imagePrompt, hook: edited.hook || ch.hook };
      }
    } catch(e) { showToast('第 ' + ch.num + ' 篇修改失敗'); }
  }

  // Update local backup
  window._currentStory = story;
  try {
    var list = JSON.parse(localStorage.getItem('storyHistory') || '[]');
    var found = list.find(function(l) { return l.publishedId === publishedId; });
    if (found) { found.story = story; found.date = new Date().toISOString(); }
    localStorage.setItem('storyHistory', JSON.stringify(list));
  } catch(_) {}

  showToast('✅ 修改完成');
  renderStory(story);
}
