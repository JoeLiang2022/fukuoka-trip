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

// === Init ===
async function init() {
  var cacheBust = '?t=' + Date.now();
  const [topicsRes, stylesRes, audiencesRes] = await Promise.all([
    fetch('topics.json' + cacheBust).then(r => r.json()),
    fetch('styles.json' + cacheBust).then(r => r.json()),
    fetch('audiences.json' + cacheBust).then(r => r.json())
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

  // Story mode — batch for large chapter counts
  var batchSize = _chapters <= 7 ? _chapters : 5;
  var totalBatches = Math.ceil(_chapters / batchSize);
  var allChapters = [];
  var storyTitle = '';
  var characters = '';

  try {
    for (var batch = 0; batch < totalBatches; batch++) {
      var startNum = allChapters.length + 1;
      var remaining = _chapters - allChapters.length;
      var thisCount = Math.min(batchSize, remaining);
      var isFirst = batch === 0;
      var isLast = (allChapters.length + thisCount) >= _chapters;

      output.innerHTML = '<div class="loading"><div class="spinner"></div><p>AI 正在創作... (' + allChapters.length + '/' + _chapters + ' 篇)</p></div>';

      var prevSummary = '';
      if (!isFirst && allChapters.length > 0) {
        prevSummary = '【前情提要】故事標題：' + storyTitle + '\n角色外貌：' + characters + '\n';
        var last3 = allChapters.slice(-3);
        last3.forEach(function(ch) { prevSummary += '第' + ch.num + '篇「' + ch.title + '」：' + (ch.text || '').substring(0, 80) + '...\n'; });
        prevSummary += '\n請接續上面的劇情，寫第 ' + startNum + ' 到第 ' + (startNum + thisCount - 1) + ' 篇。\n\n';
      }

      var prompt = prevSummary + '你是一個專業的社群媒體故事創作者。' + (isFirst ? '請根據以下設定創作一個分篇章的故事。' : '請接續前面的劇情繼續寫。') + '\n\n' +
        '【主題】' + topic + '\n' +
        '【風格】' + style.name + ' — ' + style.prompt + '\n' +
        '【目標觀眾】' + audience.name + ' — ' + audience.tone + '\n' +
        '【本批篇章】第 ' + startNum + ' 到第 ' + (startNum + thisCount - 1) + ' 篇（共 ' + thisCount + ' 篇）\n' +
        '【總篇章數】' + _chapters + ' 篇\n' +
        '【語言】繁體中文\n\n' +
        '【你的角色：國際級暢銷書總編輯，20年經驗，不接受平庸】\n\n' +
        '【品質流程 — 在內部執行，只輸出最終達標版本】\n' +
        '完成每篇後，用7個維度自我評分（1-10）：\n' +
        '1.場景具體度 2.人物真實感 3.概念深度 4.結構節奏 5.伏筆收尾 6.語氣一致性 7.讀者記憶點\n' +
        '平均低於9分就重寫最低分的維度：\n' +
        '場景不具體→刪形容詞改用動作對話 / 人物不真實→加入付出代價的選擇 / 概念太淺→問自己讀者在別處看過嗎 / 結尾說教→刪掉宣告句\n' +
        '重寫後再評分，直到平均9分才輸出。\n\n' +
        '❌ 禁止：指令用語寫進內容、結尾變TED演講、成功來太快\n' +
        '【小說類】角色矛盾透過行為展現，女主自己做選擇\n' +
        '【非故事類】案例要有掙扎、結構要有節奏變化、要有反直覺洞見\n\n' +
        '【輸出格式】JSON 中加入 scores 欄位：\n' +
        '{"title":"...","scores":{"scene":9,"character":9,"depth":9,"pacing":9,"foreshadow":9,"tone":9,"memorable":9,"avg":9},"chapters":[...]}\n\n' +
        (isFirst ? '【抓眼球技巧】\n' + HOOK_TECHNIQUES.join('\n') + '\n\n' : '') +
        '【輸出格式】JSON（不要 markdown）：\n' +
        '{"title":"故事總標題","characters":[{"name":"角色名","appearance":"英文外貌"}],"chapters":[{"num":' + startNum + ',"title":"篇章標題","text":"200-400字","imagePrompt":"英文配圖含角色外貌","hook":"金句"}]}\n\n' +
        '要求：' + (isFirst ? '第一篇開頭3秒抓住注意力。' : '') + (isLast ? '最後一篇要有震撼或感動的結尾。' : '每篇結尾留懸念。') + ' 人物預設台灣人長相。';

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
        var batchStory = JSON.parse(cleaned);
        if (isFirst) {
          storyTitle = batchStory.title || topic;
          characters = JSON.stringify(batchStory.characters || []);
        }
        if (batchStory.chapters) allChapters = allChapters.concat(batchStory.chapters);
      } catch(pe) { /* skip bad batch */ }
    }

    if (allChapters.length === 0) throw new Error('生成失敗');
    var story = { title: storyTitle, characters: characters, chapters: allChapters };
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
        '<div class="chapter-text">' + escHtml(ch.text) + '</div>' +
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

  // Generate story ID (timestamp-based)
  const id = Date.now().toString(36);
  const filename = id + '.html';

  // Build standalone HTML — images will be generated server-side
  var html = '<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">';
  html += '<title>' + escHtml(story.title) + '</title>';
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
  html += '</body></html>';

  try {
    // Upload via server proxy (images sent separately)
    var pubResp = await fetch(API_BASE + '/api/story-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, title: story.title, chapters: story.chapters.length, html: html, imagePrompts: imagePrompts })
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
    var storyText = story.chapters.map(function(ch) { return ch.title + '\n' + ch.text; }).join('\n\n');
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
      var storyJson = JSON.stringify({ title: story.title, chapters: story.chapters.map(function(ch) { return { num: ch.num, title: ch.title, text: ch.text, hook: ch.hook }; }) });
      var optPrompt = '局部優化（只改低分部分，保留好的）。低分項目：' + lowItems.join('、') + '\n改善建議：' + (score.feedback || '') + '\n' + (score.lowAreas || '') + '\n\n規則：禁止指令用語、禁止TED演講結尾\n回覆優化後JSON（同格式）：\n' + storyJson;
      var resp2 = await fetch(API_BASE + '/api/story-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: optPrompt }) });
      if (!resp2.ok) break;
      var data2 = await resp2.json();
      var raw2 = data2.text || '';
      var cleaned2 = raw2.replace(new RegExp(tick3 + 'json\\s*', 'g'), '').replace(new RegExp(tick3 + '\\s*', 'g'), '').trim();
      var optimized; try { optimized = JSON.parse(cleaned2); } catch(pe2) { var jm2 = cleaned2.match(/\{[\s\S]*\}/); if (jm2) optimized = JSON.parse(jm2[0]); else throw pe2; }
      if (optimized.chapters) {
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
    await new Promise(function(r) { setTimeout(r, 2000); })
  }

  // Show history summary
  if (history.length > 1) {
    var histHtml = '<div style="margin:12px 0;padding:12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">';
    histHtml += '<div style="font-size:13px;color:#f093fb;font-weight:600;margin-bottom:6px">📈 改進歷程</div>';
    history.forEach(function(h) { histHtml += '<div style="font-size:12px;color:#aaa">第' + h.round + '輪：' + (h.low || '全部達標') + '</div>'; });
    histHtml += '</div>';
    output.innerHTML += histHtml;
  }

  // Re-render with optimized content
  renderStory(window._currentStory);
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
  if (!confirm('AI 將優化整個故事，這會替換目前的內容。繼續嗎？')) return;
  showToast('✨ AI 優化中...');
  var story = window._currentStory;
  var storyJson = JSON.stringify({ title: story.title, chapters: story.chapters.map(function(ch) { return { num: ch.num, title: ch.title, text: ch.text }; }) });
  var prompt = '以下是一個已完成的故事 JSON。請優化它：改善文筆、加強角色深度、修正邏輯漏洞、增加細節描寫。\n\n規則：角色矛盾透過行為展現，禁止出現「自我矛盾」「付出代價」等指令用語。用具體動作描寫人物。\n\n回覆優化後的完整 JSON（同樣格式，不要 markdown）：\n\n' + storyJson;
  try {
    var resp = await fetch(API_BASE + '/api/story-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt }) });
    if (!resp.ok) throw new Error('API ' + resp.status);
    var data = await resp.json();
    var raw = data.text || '';
    var tick3 = String.fromCharCode(96,96,96);
    var cleaned = raw.replace(new RegExp(tick3 + 'json\\s*', 'g'), '').replace(new RegExp(tick3 + '\\s*', 'g'), '').trim();
    var optimized = JSON.parse(cleaned);
    if (optimized.chapters) {
      window._currentStory.title = optimized.title || story.title;
      window._currentStory.chapters = optimized.chapters;
      renderStory(window._currentStory);
      showToast('✅ 故事已優化');
    }
  } catch(e) { showToast('優化失敗: ' + e.message); }
}

// === Regenerate All Images ===
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
    if (stories.length === 0) {
      output.innerHTML = '<div style="text-align:center;padding:40px;color:#888">還沒有發佈的故事</div>';
      return;
    }
    var html = '<div style="margin:20px 0 12px"><div style="font-size:18px;font-weight:700;color:#fff">📂 已發佈故事（' + stories.length + '）</div></div>';
    stories.forEach(function(s, i) {
      html += '<div style="margin:8px 0;padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between">';
      html += '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:600;color:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(s.title) + '</div>';
      html += '<div style="font-size:12px;color:#666;margin-top:2px">' + (s.chapters || 0) + ' 篇 · ' + (s.date || '') + '</div></div>';
      html += '<div style="display:flex;gap:6px;flex-shrink:0;margin-left:12px">';
      html += '<a href="https://joeliang2022.github.io/fukuoka-trip/stories/' + escHtml(s.file) + '" target="_blank" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(78,205,196,0.3);background:rgba(78,205,196,0.08);color:#4ecdc4;font-size:12px;text-decoration:none">查看</a>';
      html += '<button onclick="deletePublished(\'' + escHtml(s.id) + '\',\'' + escHtml(s.file) + '\')" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(245,87,108,0.3);background:rgba(245,87,108,0.08);color:#f5576c;font-size:12px;cursor:pointer">刪除</button>';
      html += '</div></div>';
    });
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
