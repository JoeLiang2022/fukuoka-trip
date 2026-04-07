// AI Story Creator â€” app.js
// Data-driven: loads topics.json, styles.json, audiences.json
// Stories stored in localStorage
// API calls go through server proxy (no key in frontend)

const API_BASE = 'https://live-subtitle.onrender.com';
const ACCESS_CODE = '0910164482';
const STORIES_BASE = 'https://joeliang2022.github.io/fukuoka-trip/stories/';

// === Fetch helper with credentials and quota handling ===
async function apiFetch(url, options) {
  options = options || {};
  options.credentials = 'include';
  var resp = await fetch(url, options);
  if (resp.status === 429) {
    var data = {};
    try { data = await resp.json(); } catch(_) {}
    if (data.error === 'quota_exceeded') {
      showQuotaExceeded(data);
      throw new Error('quota_exceeded');
    }
  }
  return resp;
}

function showQuotaExceeded(data) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = '<div style="background:#1a1a2e;border:1px solid rgba(240,147,251,0.3);border-radius:20px;padding:32px;max-width:360px;text-align:center">' +
    '<div style="font-size:40px;margin-bottom:12px">âš¡</div>' +
    '<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">ç”¨é‡å·²é”ä¸Šé™</div>' +
    '<div style="font-size:14px;color:#aaa;margin-bottom:16px">å·²ä½¿ç”¨ ' + (data.used || 0) + ' / ' + (data.limit || 0) + 'ï¼ˆ' + (data.plan || 'free') + ' æ–¹æ¡ˆï¼‰</div>' +
    '<a href="/pricing" style="display:inline-block;padding:12px 28px;border-radius:12px;background:linear-gradient(135deg,#f093fb,#f5576c);color:#fff;text-decoration:none;font-weight:600;font-size:15px">å‡ç´šæ–¹æ¡ˆ â†’</a>' +
    '<div style="margin-top:12px"><button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:none;border:none;color:#888;cursor:pointer;font-size:13px">é—œé–‰</button></div>' +
    '</div>';
  document.body.appendChild(overlay);
}

// === Auth Gate (Session-based with passcode fallback) ===
async function checkAuth() {
  // Try session-based auth first
  try {
    var resp = await fetch(API_BASE + '/api/account', { credentials: 'include' });
    if (resp.ok) {
      var account = await resp.json();
      window._userAccount = account;
      try { sessionStorage.setItem('storyAuth', '1'); } catch(e) {}
      document.getElementById('authGate').style.display = 'none';
      document.getElementById('mainApp').style.display = '';
      init();
      return;
    }
  } catch(e) { /* session auth failed, try passcode fallback */ }

  // Fallback: passcode auth (legacy)
  var codeInput = document.getElementById('authCode');
  if (codeInput) {
    var code = codeInput.value.trim();
    if (code === ACCESS_CODE) {
      try { sessionStorage.setItem('storyAuth', '1'); } catch(e) {}
      document.getElementById('authGate').style.display = 'none';
      document.getElementById('mainApp').style.display = '';
      init();
      return;
    }
    if (code) {
      document.getElementById('authError').style.display = '';
      codeInput.value = '';
    }
  }
}

function loginWithGoogle() {
  window.location.href = '/auth/google';
}

// Auto-login: try session first, then passcode
(async function() {
  try {
    var resp = await fetch(API_BASE + '/api/account', { credentials: 'include' });
    if (resp.ok) {
      var account = await resp.json();
      window._userAccount = account;
      try { sessionStorage.setItem('storyAuth', '1'); } catch(e) {}
      document.getElementById('authGate').style.display = 'none';
      document.getElementById('mainApp').style.display = '';
      init();
      return;
    }
  } catch(e) {}
  // No valid session — show auth gate (don't auto-skip with sessionStorage)
})();

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
let _quality = 'normal';
let _voiceMode = 'off'; // off, browser, gemini-f, gemini-m

// === Init ===
async function init() {
  // Initialize i18n
  if (typeof initI18n === 'function') {
    try { await initI18n(); var sel = document.getElementById('langSelect'); if (sel && typeof getLanguage === 'function') sel.value = getLanguage(); } catch(e) { console.warn('i18n init:', e); }
  }
  var dataBase = window.location.hostname.includes('render.com') ? 'https://cdn.jsdelivr.net/gh/JoeLiang2022/fukuoka-trip@main/story/' : '';
  var cacheBust = '?t=' + Date.now();
  const [topicsRes, stylesRes, audiencesRes, refsRes] = await Promise.all([
    fetch(dataBase + 'topics.json' + cacheBust).then(r => r.json()),
    fetch(dataBase + 'styles.json' + cacheBust).then(r => r.json()),
    fetch(dataBase + 'audiences.json' + cacheBust).then(r => r.json()),
    fetch(dataBase + 'references.json' + cacheBust).then(r => r.json()).catch(function() { return {}; })
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
    if (el.textContent.includes('ç†±é–€ä¸»é¡Œ') || el.textContent.includes('é¸æ“‡')) {
      el.style.display = isNews ? 'none' : '';
      if (!isNews) {
        var curStyle = _styles.find(function(s) { return s.id === id; });
        var curType = curStyle ? (curStyle.type || 'story') : 'story';
        var sectionLabel = {'book':'ðŸ“š é¸æ“‡æ›¸ç±åç¨±','article':'ðŸ“ é¸æ“‡æ–‡ç« æ¨™é¡Œ','story':'ðŸ“ é¸æ“‡æ•…äº‹åç¨±','copy':'ðŸ“ é¸æ“‡æ–‡æ¡ˆæ¨™é¡Œ'};
        el.textContent = sectionLabel[curType] || 'ðŸ“ é¸æ“‡æ¨™é¡Œ';
      }
    }
  });
  // Switch chapter count buttons for news mode
  var countBtns = document.querySelector('.count-btns');
  if (countBtns) {
    if (isNews) {
      _chapters = 30;
      countBtns.innerHTML = '<button onclick="setChapters(30)" id="ch30" class="active">30å‰‡</button><button onclick="setChapters(60)" id="ch60">60å‰‡</button><button onclick="setChapters(100)" id="ch100">100å‰‡</button>';
    } else {
      _chapters = 3;
      countBtns.innerHTML = '<button onclick="setChapters(3)" id="ch3" class="active">3ç¯‡</button><button onclick="setChapters(5)" id="ch5">5ç¯‡</button><button onclick="setChapters(7)" id="ch7">7ç¯‡</button><button onclick="setChapters(30)" id="ch30">30ç¯‡</button><button onclick="setChapters(60)" id="ch60">60ç¯‡</button><button onclick="promptCustomChapters()" id="chCustom">è‡ªè¨‚</button>';
    }
  }
  // For non-news styles: generate AI story title suggestions
  if (!isNews) {
    var style = _styles.find(function(s) { return s.id === id; });
    var styleType = style ? (style.type || 'story') : 'story';
    var titleTypeMap = {
      'news': 'æ–°èžæ¨™é¡Œ', 'book': 'æ›¸ç±åç¨±', 'article': 'æ–‡ç« æ¨™é¡Œ',
      'story': 'æ•…äº‹åç¨±', 'copy': 'æ–‡æ¡ˆæ¨™é¡Œ'
    };
    var titleType = titleTypeMap[styleType] || 'æ¨™é¡Œ';
    // Hide static topics, show loading
    var topicGrid = document.getElementById('topicGrid');
    var catRow = document.getElementById('catRow');
    if (catRow) catRow.style.display = 'none';
    if (topicGrid) {
      topicGrid.style.display = '';
      topicGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:#888"><div class="spinner" style="width:24px;height:24px;border:2px solid rgba(240,147,251,0.2);border-top-color:#f093fb;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 8px"></div>AI æ­£åœ¨æ§‹æ€' + titleType + '...</div>';
    }
    _selectedTopic = '';
    // Call AI to generate titles
    try {
      var titleStyleMap = {
        'book': 'è«‹ç”Ÿæˆåƒæš¢éŠ·æ›¸ä¸€æ¨£çš„æ›¸åï¼Œä¾‹å¦‚ã€ŠåŽŸå­ç¿’æ…£ã€‹ã€Šå¿«æ€æ…¢æƒ³ã€‹ã€Šåˆ»æ„ç·´ç¿’ã€‹é¢¨æ ¼ã€‚æ›¸åè¦å°ˆæ¥­ã€æœ‰æ·±åº¦ã€è®“äººæƒ³è²·ä¾†çœ‹ã€‚ä¸è¦ç”Ÿæˆæ•…äº‹åç¨±ã€‚',
        'article': 'è«‹ç”Ÿæˆåƒç†±é–€å°ˆæ¬„æ–‡ç« çš„æ¨™é¡Œï¼Œæœ‰è§€é»žã€æœ‰æ·±åº¦ã€è®“äººæƒ³é»žé€²åŽ»çœ‹ã€‚',
        'story': 'åƒè€ƒæŠ–éŸ³ã€å°ç´…æ›¸ã€IG ä¸Šæœ€ç«çš„æ•…äº‹é¡žåž‹ã€‚åç¨±è¦æœ‰æ‡¸å¿µæ„Ÿã€è®“äººå¿ä¸ä½æƒ³é»žã€‚',
        'copy': 'è«‹ç”Ÿæˆåƒå»£å‘Šé‡‘å¥æˆ–å½±ç‰‡æ¨™é¡Œï¼Œç°¡çŸ­æœ‰åŠ›ã€ä¸€ç§’æŠ“ä½çœ¼çƒã€‚',
        'news': 'è«‹ç”Ÿæˆä»Šæ—¥ç†±é–€æ–°èžä¸»é¡Œã€‚'
      };
      var titleStyle = titleStyleMap[styleType] || titleStyleMap['story'];
      var titlePrompt = 'ä½ æ˜¯ã€Œ' + (style ? style.name : id) + 'ã€é ˜åŸŸçš„å°ˆå®¶ã€‚è«‹ç”Ÿæˆ 20 å€‹ç›®å‰æœ€ç†±é–€çš„' + titleType + 'ã€‚\n\nç”¨ JSON å›žè¦†ï¼ˆä¸è¦ markdownï¼‰ï¼š{"titles":["' + titleType + '1","' + titleType + '2",...]}\n\nè¦æ±‚ï¼š\n- ' + titleStyle + '\n- è¦ç¬¦åˆç•¶ä¸‹æµè¡Œè¶¨å‹¢\n- ç¹é«”ä¸­æ–‡\n- 20 å€‹ï¼Œå¾žæœ€ç†±é–€æŽ’åˆ°æ¬¡ç†±é–€';
      apiFetch(API_BASE + '/api/story-generate', {
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
            }).join('') + '<div style="grid-column:1/-1;text-align:center;padding:8px"><button onclick="selectStyle(_selectedStyle)" style="padding:8px 20px;border-radius:10px;border:1px solid rgba(240,147,251,0.3);background:rgba(240,147,251,0.08);color:#f093fb;font-size:13px;cursor:pointer">ðŸ”„ æ›ä¸€æ‰¹</button></div>';
          }
        } catch(e) {
          if (topicGrid) topicGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:12px;color:#888">ç”Ÿæˆå¤±æ•—ï¼Œè«‹ç›´æŽ¥è¼¸å…¥ä¸»é¡Œ</div>';
        }
      }).catch(function() {
        if (topicGrid) topicGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:12px;color:#888">ç”Ÿæˆå¤±æ•—ï¼Œè«‹ç›´æŽ¥è¼¸å…¥ä¸»é¡Œ</div>';
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
    if (custom) { custom.classList.add('active'); custom.textContent = n + 'ç¯‡'; }
  }
}

function promptCustomChapters() {
  var n = prompt('è«‹è¼¸å…¥ç¯‡ç« æ•¸ï¼ˆ1-200ï¼‰ï¼š');
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
  if (_chapterLength === 'short') return 'ç´„200å­—';
  if (_chapterLength === 'long') return '500-800å­—';
  return 'ç´„400å­—';
}

// quality setter (variable declared at top)
function setQuality(q) {
  _quality = q;
  var bn = document.getElementById('qualNormal');
  var bh = document.getElementById('qualHigh');
  if (bn) bn.classList.toggle('active', q === 'normal');
  if (bh) bh.classList.toggle('active', q === 'high');
}

function setVoice(mode) {
  _voiceMode = mode;
  var sel = document.getElementById('voiceSelect');
  if (sel) sel.value = mode;
}

// Read story aloud (browser TTS)
function readStoryBrowser() {
  if (!window._currentStory) return;
  var chapters = window._currentStory.chapters;
  var idx = 0;
  function readNext() {
    if (idx >= chapters.length) { showToast('æœ—è®€å®Œç•¢'); return; }
    var ch = chapters[idx];
    showToast('ðŸ”Š æœ—è®€ç¬¬ ' + ch.num + ' ç¯‡...');
    var u = new SpeechSynthesisUtterance(ch.title + 'ã€‚' + ch.text);
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
    showToast('ðŸ¤– ç”ŸæˆèªžéŸ³ç¬¬ ' + ch.num + ' ç¯‡...');
    try {
      var resp = await apiFetch(API_BASE + '/api/story/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Passcode': ACCESS_CODE },
        body: JSON.stringify({ text: ch.title + 'ã€‚' + ch.text, voice: voiceName })
      });
      if (!resp.ok) { showToast('èªžéŸ³ç”Ÿæˆå¤±æ•—'); continue; }
      var data = await resp.json();
      if (data.audio) {
        var audio = new Audio('data:' + (data.mimeType || 'audio/mp3') + ';base64,' + data.audio);
        await new Promise(function(resolve) { audio.onended = resolve; audio.onerror = resolve; audio.play(); });
      }
    } catch(e) { showToast('èªžéŸ³éŒ¯èª¤: ' + e.message); }
  }
  showToast('æœ—è®€å®Œç•¢');
}

function getRandomRefs(styleId, count) {
  var refs = window._references && window._references[styleId] ? window._references[styleId] : [];
  if (refs.length === 0) return '';
  var shuffled = refs.slice().sort(function() { return Math.random() - 0.5; });
  return shuffled.slice(0, count || 4).join('ã€');
}

// === Story Hook Techniques (injected into prompt) ===
const HOOK_TECHNIQUES = [
  'é–‹é ­ç”¨ä¸€å€‹éœ‡æ’¼çš„äº‹å¯¦æˆ–å•é¡ŒæŠ“ä½æ³¨æ„åŠ›ï¼ˆå‰3ç§’æ³•å‰‡ï¼‰',
  'æ¯ç¯‡çµå°¾ç•™ä¸‹æ‡¸å¿µæˆ–cliffhangerï¼Œè®“è®€è€…æƒ³çœ‹ä¸‹ä¸€ç¯‡',
  'åœ¨æ•…äº‹ä¸­æ’å…¥ã€Œä½ å¯èƒ½ä¸çŸ¥é“ã€ã€Œæ›´å¯æ€•çš„æ˜¯ã€ç­‰è½‰æŠ˜èªž',
  'ç”¨å…·é«”æ•¸å­—å’Œç´°ç¯€å¢žåŠ å¯ä¿¡åº¦ï¼ˆä¾‹å¦‚ï¼šè·é›¢åœ°çƒ4.2å…‰å¹´ï¼‰',
  'åŠ å…¥è®€è€…èƒ½ä»£å…¥çš„æƒ…å¢ƒï¼ˆæƒ³åƒä¸€ä¸‹ï¼Œå¦‚æžœä½ ...ï¼‰',
  'ä½¿ç”¨å°æ¯”å’Œåå·®è£½é€ è¡æ“Šï¼ˆè¡¨é¢ä¸Š...ä½†å¯¦éš›ä¸Š...ï¼‰',
  'åœ¨é—œéµè™•ä½¿ç”¨çŸ­å¥å¢žåŠ ç¯€å¥æ„Ÿå’Œç·Šå¼µæ„Ÿ',
  'æ¯ç¯‡éƒ½æœ‰ä¸€å€‹ã€Œé‡‘å¥ã€é©åˆæˆªåœ–åˆ†äº«',
  'ç”¨æ•…äº‹åŒ–çš„æ–¹å¼å‘ˆç¾çŸ¥è­˜ï¼Œä¸è¦åƒæ•™ç§‘æ›¸',
  'çµå°¾è¦æœ‰é¤˜éŸ»ï¼Œè®“è®€è€…æ€è€ƒæˆ–ç”¢ç”Ÿæƒ…ç·’'
];

// === Generate Story ===
async function generate() {
  var isNews = (_selectedStyle === 'news' || _selectedStyle === 'finance');
  const topic = isNews ? 'ä»Šå¤©çš„æœ€æ–°' + (_selectedStyle === 'finance' ? 'è²¡ç¶“' : '') + 'æ–°èž' : (document.getElementById('customTopic').value.trim() || _selectedTopic);
  if (!topic && !isNews) { showToast('è«‹é¸æ“‡æˆ–è¼¸å…¥ä¸€å€‹ä¸»é¡Œ'); return; }

  const style = _styles.find(s => s.id === _selectedStyle) || _styles[0];
  const audience = _audiences.find(a => a.id === _selectedAudience) || _audiences[0];
  const btn = document.getElementById('btnGenerate');
  const output = document.getElementById('output');

  btn.disabled = true;
  btn.textContent = 'â³ ç”Ÿæˆä¸­...';
  output.innerHTML = '<div class="loading"><div class="spinner"></div><p>' + (isNews ? 'æœå°‹ä»Šæ—¥æ–°èžä¸­...' : 'AI æ­£åœ¨æ§‹æ€æ•…äº‹æž¶æ§‹...') + '</p></div>';

  // News mode: batch API calls for 30/60/100 articles
  if (isNews) {
    var newsType = _selectedStyle === 'finance' ? 'è²¡ç¶“' : '';
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
        output.innerHTML = '<div class="loading"><div class="spinner"></div><p>æœå°‹æ–°èžä¸­... (' + allArticles.length + '/' + _chapters + ')</p></div>';

        var recentTitles = allArticles.slice(-5).map(function(a) { return a.title; }).join(', ');
        var newsPrompt = 'ä½ æ˜¯ä¸€ä½å°ˆæ¥­æ–°èžè¨˜è€…ã€‚è«‹æœå°‹ä»Šå¤©ï¼ˆ' + newsDate + 'ï¼‰æœ€é‡è¦çš„' + newsType + 'æ–°èžã€‚\n\n' +
          (recentTitles ? 'Avoid these: ' + recentTitles + '\n\n' : '') +
          'è«‹ç”¨ JSON æ ¼å¼å›žè¦†ï¼Œä¸è¦åŠ  markdown æ¨™è¨˜ï¼š\n' +
          '{"articles":[{"title":"æ–°èžæ¨™é¡Œ","summary":"2-3å¥è¨˜è€…æ’­å ±é¢¨æ ¼æ‘˜è¦","source":"ä¾†æºåª’é«”","url":"æ–°èžé€£çµURL","category":"åˆ†é¡ž","time":"æ™‚é–“"}]}\n\n' +
          'è¦æ±‚ï¼šåˆ—å‡º ' + thisCount + ' å‰‡ä¸åŒçš„é‡è¦æ–°èžï¼Œæ¯å‰‡å¿…é ˆæœ‰çœŸå¯¦é€£çµURLï¼Œç”¨ç¹é«”ä¸­æ–‡ï¼Œè¨˜è€…æ’­å ±å£å»';

        var resp = await apiFetch(API_BASE + '/api/story-generate', {
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
      output.innerHTML = '<div class="loading"><p>âŒ ' + escHtml(e.message) + '</p></div>';
    }
    btn.disabled = false; btn.textContent = 'âœ¨ ç”Ÿæˆ';
    return;
  }

  // Story mode â€” per-chapter generation with DNA + outline + memory
  var allChapters = [];

  try {
    // Step 0: AI Style Tuning Dialog
    var tuningResult = await showTuningDialog(topic, style, audience);

    // Step 1: Load Style DNA
    output.innerHTML = '<div class="loading"><div class="spinner"></div><p>è¼‰å…¥é¢¨æ ¼è¨­å®š...</p></div>';
    var dna = await loadStyleDNA(_selectedStyle);

    // Step 2: Generate outline (pre-plan story arc)
    output.innerHTML = '<div class="loading"><div class="spinner"></div><p>è¦åŠƒæ•…äº‹å¤§ç¶±...</p></div>';
    var outline = await generateOutline(dna, topic, _chapters, audience);

    // Step 3: Initialize session memory
    var memory = createEmptyMemory();

    // Step 3.5: Load Story Bible (if available)
    var bible = null;
    var bibleContext = '';
    var currentLang = (typeof getLanguage === 'function') ? getLanguage() : 'zh-TW';
    if (typeof loadBible === 'function') {
      try { bible = loadBible('current'); } catch(e) {}
    }
    if (bible && typeof compressBibleForPrompt === 'function') {
      try { bibleContext = compressBibleForPrompt(bible, 1500); } catch(e) {}
    }

    // Step 4: Generate chapters (per-chapter or batch based on quality setting)
    var batchSize = (_quality === 'high') ? 1 : 2;
    for (var chIdx = 0; chIdx < _chapters; chIdx += batchSize) {
      var batchEnd = Math.min(chIdx + batchSize, _chapters);
      var chapterNum = chIdx + 1;
      output.innerHTML = '<div class="loading"><div class="spinner"></div><p>AI æ­£åœ¨å‰µä½œç¬¬ ' + chapterNum + (batchSize > 1 ? '-' + batchEnd : '') + '/' + _chapters + ' ç¯‡...</p></div>';

      if (batchSize === 1) {
        // High quality: one chapter per API call
        var prompt = assemblePrompt({
          dna: dna, chapterOutline: outline[chIdx], memory: memory,
          chapterNum: chapterNum, totalChapters: _chapters, topic: topic,
          audience: audience, chapterLength: _chapterLength,
          isFirstChapter: chapterNum === 1, isLastChapter: chapterNum === _chapters,
          bible: bibleContext, language: currentLang, tuning: tuningResult
        });
        var resp = await apiFetch(API_BASE + '/api/story-generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: prompt, style: _selectedStyle })
        });
        if (!resp.ok) continue;
        var data = await resp.json();
        var raw = data.text || '';
        var tick3 = String.fromCharCode(96,96,96);
        var cleaned = raw.replace(new RegExp(tick3 + 'json\\s*', 'g'), '').replace(new RegExp(tick3 + '\\s*', 'g'), '').trim();
        try {
          var chapter = JSON.parse(cleaned);
          if (chapter.chapters && Array.isArray(chapter.chapters)) chapter = chapter.chapters[0];
          if (!chapter.num) chapter.num = chapterNum;
          if (chapterNum === 1) { memory.title = chapter.title || topic; if (chapter.characters) memory.characters = memory.characters.concat(chapter.characters); }
          allChapters.push(chapter);
          updateSessionMemory(memory, [chapter], outline);
        } catch(pe) {}
      } else {
        // Normal quality: batch of 5 chapters per API call
        var batchOutlines = [];
        for (var bi = chIdx; bi < batchEnd; bi++) batchOutlines.push(outline[bi]);
        var batchPrompt = assemblePrompt({
          dna: dna, chapterOutline: batchOutlines[0], memory: memory,
          chapterNum: chapterNum, totalChapters: _chapters, topic: topic,
          audience: audience, chapterLength: _chapterLength,
          isFirstChapter: chapterNum === 1, isLastChapter: batchEnd === _chapters,
          batchOutlines: batchOutlines, batchSize: batchEnd - chIdx,
          bible: bibleContext, language: currentLang, tuning: tuningResult
        });
        var resp = await apiFetch(API_BASE + '/api/story-generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: batchPrompt, style: _selectedStyle })
        });
        if (!resp.ok) continue;
        var data = await resp.json();
        var raw = data.text || '';
        var tick3 = String.fromCharCode(96,96,96);
        var cleaned = raw.replace(new RegExp(tick3 + 'json\\s*', 'g'), '').replace(new RegExp(tick3 + '\\s*', 'g'), '').trim();
        try {
          var parsed = JSON.parse(cleaned);
          var batchChapters = parsed.chapters || (Array.isArray(parsed) ? parsed : [parsed]);
          for (var bci = 0; bci < batchChapters.length; bci++) {
            var ch = batchChapters[bci];
            if (!ch.num) ch.num = chIdx + bci + 1;
            if (chIdx === 0 && bci === 0) { memory.title = ch.title || topic; if (ch.characters) memory.characters = memory.characters.concat(ch.characters); }
            allChapters.push(ch);
          }
          updateSessionMemory(memory, batchChapters, outline);
          // If batch returned fewer chapters than expected, fill remaining one-by-one
          var got = batchChapters.length;
          if (got < (batchEnd - chIdx)) {
            for (var fi = chIdx + got; fi < batchEnd; fi++) {
              output.innerHTML = '<div class="loading"><div class="spinner"></div><p>è£œç”Ÿæˆç¬¬ ' + (fi+1) + '/' + _chapters + ' ç¯‡...</p></div>';
              var fallbackPrompt = assemblePrompt({
                dna: dna, chapterOutline: outline[fi], memory: memory,
                chapterNum: fi + 1, totalChapters: _chapters, topic: topic,
                audience: audience, chapterLength: _chapterLength,
                isFirstChapter: false, isLastChapter: (fi + 1) === _chapters,
                bible: bibleContext, language: currentLang, tuning: tuningResult
              });
              var fbResp = await apiFetch(API_BASE + '/api/story-generate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: fallbackPrompt, style: _selectedStyle })
              });
              if (!fbResp.ok) continue;
              var fbData = await fbResp.json();
              var fbRaw = fbData.text || '';
              var fbCleaned = fbRaw.replace(new RegExp(tick3 + 'json\\s*', 'g'), '').replace(new RegExp(tick3 + '\\s*', 'g'), '').trim();
              try {
                var fbCh = JSON.parse(fbCleaned);
                if (fbCh.chapters && Array.isArray(fbCh.chapters)) fbCh = fbCh.chapters[0];
                if (!fbCh.num) fbCh.num = fi + 1;
                allChapters.push(fbCh);
                updateSessionMemory(memory, [fbCh], outline);
              } catch(fpe) {}
            }
          }
        } catch(pe) {}
      }
    }

    if (allChapters.length === 0) throw new Error('ç”Ÿæˆå¤±æ•—');
    // Fill in missing chapters with placeholders
    var chapterMap = {};
    allChapters.forEach(function(ch) { chapterMap[ch.num] = ch; });
    var filledChapters = [];
    for (var cn = 1; cn <= _chapters; cn++) {
      if (chapterMap[cn]) {
        filledChapters.push(chapterMap[cn]);
      } else {
        filledChapters.push({ num: cn, title: 'ç¬¬ ' + cn + ' ç¯‡ï¼ˆå¾…ç”Ÿæˆï¼‰', text: 'âš ï¸ æ­¤ç« ç¯€ç”Ÿæˆå¤±æ•—ï¼Œè«‹ä½¿ç”¨ç·¨è¼¯åŠŸèƒ½é¸æ“‡æ­¤ç« ç¯€é‡æ–°ç”Ÿæˆã€‚', hook: '', imagePrompt: '', _missing: true });
      }
    }
    var story = { title: memory.title || topic, characters: memory.characters, chapters: filledChapters };
    saveStory(topic, style.name, audience.name, story);
    renderStory(story);

    // Extract Story Bible in background after generation
    if (typeof extractBibleFromStory === 'function') {
      (async function() {
        try {
          var storyData = { title: story.title, chapters: filledChapters.filter(function(ch) { return !ch._missing; }), storyId: 'current' };
          var extracted = await extractBibleFromStory(storyData, bible || createEmptyBible('current'));
          if (extracted && typeof mergeBible === 'function') {
            bible = mergeBible(bible || createEmptyBible('current'), extracted);
            if (typeof saveBible === 'function') saveBible(bible);
            renderBiblePanel(bible);
          }
        } catch(e) { console.warn('Bible extraction:', e); }
      })();
    }
    
    // Generate TTS audio in background if voice is selected (one-time, uploaded to GitHub)
    if (_voiceMode && _voiceMode !== 'off' && _voiceMode !== 'browser') {
      var voiceMap = {'kore':'Kore','zephyr':'Zephyr','aoede':'Aoede','leda':'Leda','puck':'Puck','orus':'Orus','charon':'Charon','fenrir':'Fenrir'};
      var vName = voiceMap[_voiceMode] || 'Aoede';
      // Use a consistent ID that will be reused during publish
      var storyId = Date.now().toString(36);
      window._preGeneratedStoryId = storyId;
      showToast('ðŸ”Š èªžéŸ³ç”Ÿæˆä¸­ï¼ˆ' + vName + 'ï¼‰ï¼ŒèƒŒæ™¯è™•ç†...', true);
      apiFetch(API_BASE + '/api/story/gen-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Passcode': ACCESS_CODE },
        body: JSON.stringify({ id: storyId, chapterTexts: filledChapters.filter(function(ch){return !ch._missing;}).map(function(ch) { return ch.title + 'ã€‚' + ch.text; }), voice: vName, speed: window._voiceSpeed || 'normal', style: window._voiceStyle || 'podcast' })
      }).then(function(r) { return r.ok ? r.json() : null; }).then(function(d) {
        if (d && d.results) { var ok = d.results.filter(function(r){return r.ok;}).length; showToast('âœ… èªžéŸ³å·²ç”Ÿæˆï¼ˆ' + ok + '/' + filledChapters.length + 'ï¼‰'); }
      }).catch(function() {});
    }
  } catch (e) {
    output.innerHTML = '<div class="loading"><p>âŒ ' + escHtml(e.message) + '</p></div>';
  }
  btn.disabled = false; btn.textContent = 'âœ¨ ç”Ÿæˆæ•…äº‹';
}

// === Render News (Google News style) ===
function renderNews(newsData, rawText, sources) {
  var output = document.getElementById('output');
  var html = '';
  if (newsData && newsData.articles) {
    html += '<div style="margin:20px 0 8px;text-align:center"><div style="font-size:22px;font-weight:700;color:#fff">ðŸ“° ' + (_selectedStyle === 'finance' ? 'è²¡ç¶“' : 'ä»Šæ—¥') + 'æ–°èž</div>';
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
      if (article.source) html += '<span style="font-size:12px;color:#888;background:rgba(255,255,255,0.04);padding:3px 8px;border-radius:4px">ðŸ“° ' + escHtml(article.source) + '</span>';
      if (url) html += '<a href="' + escHtml(url) + '" target="_blank" style="font-size:12px;color:#4ecdc4;text-decoration:none;font-weight:600">é–±è®€å…¨æ–‡ â†’</a>';
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
    html += '<div style="font-size:12px;color:#888;margin-bottom:6px">ðŸ“Ž æ‰€æœ‰ä¾†æº</div>';
    sources.forEach(function(src) {
      if (src.url) html += '<div style="margin:3px 0"><a href="' + escHtml(src.url) + '" target="_blank" style="color:#4ecdc4;font-size:12px;text-decoration:none">' + escHtml(src.title || src.url) + '</a></div>';
    });
    html += '</div>';
  }
  html += '<div class="export-bar"><button onclick="publishNews()">ðŸ“¤ ç™¼ä½ˆæ–°èž</button><button onclick="copyAll()">ðŸ“‹ è¤‡è£½å…¨éƒ¨</button></div>';
  output.innerHTML = html;
  window._currentStory = newsData;
  window._currentNewsSources = sources;
}

// === Render Story ===
function renderStory(story) {
  const output = document.getElementById('output');
  let html = '<div class="story-header"><div class="story-title">' + escHtml(story.title) + '</div><div class="story-meta">' + _chapters + ' ç¯‡ç«  Â· AI ç”Ÿæˆ</div></div>';

  // Show built-in scores if available
  if (story.scores) {
    var sc = story.scores;
    var labels = {scene:'å ´æ™¯',character:'äººç‰©',depth:'æ·±åº¦',pacing:'ç¯€å¥',foreshadow:'ä¼ç­†',tone:'èªžæ°£',memorable:'è¨˜æ†¶é»ž'};
    html += '<div style="margin:0 0 12px;padding:12px;border-radius:10px;background:rgba(78,205,196,0.06);border:1px solid rgba(78,205,196,0.15);display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center">';
    html += '<span style="font-size:12px;color:#888">AI è‡ªè©•ï¼š</span>';
    for (var k in labels) { if (sc[k]) html += '<span style="font-size:12px;color:' + (sc[k] >= 9 ? '#2ecc71' : sc[k] >= 7 ? '#f39c12' : '#e74c3c') + '">' + labels[k] + ' ' + sc[k] + '</span>'; }
    if (sc.avg) html += '<span style="font-size:13px;font-weight:700;color:' + (sc.avg >= 9 ? '#2ecc71' : '#f39c12') + '">å¹³å‡ ' + sc.avg + '</span>';
    html += '</div>';
  }

  story.chapters.forEach((ch, i) => {
    html += '<div class="chapter-card" id="chapter' + i + '">' +
      '<div class="chapter-img" id="chImg' + i + '"><div class="img-loading"><div class="spinner"></div><span>ç”Ÿæˆé…åœ–ä¸­...</span></div></div>' +
      '<div class="chapter-body">' +
        '<div class="chapter-num">ç¬¬ ' + ch.num + ' ç¯‡</div>' +
        '<div class="chapter-title">' + escHtml(ch.title) + '</div>' +
        '<div class="chapter-text">' + mdToHtml(ch.text) + '</div>' +
        (ch.hook ? '<div style="margin-top:12px;padding:10px 14px;border-radius:10px;background:rgba(240,147,251,0.08);border-left:3px solid #f093fb;font-size:14px;color:#f093fb;font-weight:600">ðŸ’¬ ' + escHtml(ch.hook) + '</div>' : '') +
      '</div>' +
      '<div class="chapter-actions">' +
        '<button onclick="copyChapter(' + i + ')">ðŸ“‹ è¤‡è£½</button>' +
        '<button onclick="regenImage(' + i + ')">ðŸ–¼ï¸ é‡æ–°ç”Ÿåœ–</button>' +
      '</div>' +
    '</div>';
  });

  // Show news sources if available
  if (story._sources && story._sources.length > 0) {
    html += '<div style="margin:16px 0;padding:14px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">';
    html += '<div style="font-size:13px;color:#f093fb;font-weight:600;margin-bottom:8px">ðŸ“° æ–°èžä¾†æº</div>';
    story._sources.forEach(function(src) {
      if (src.url) html += '<div style="margin:4px 0"><a href="' + escHtml(src.url) + '" target="_blank" style="color:#4ecdc4;font-size:13px;text-decoration:none">' + escHtml(src.title || src.url) + '</a></div>';
    });
    html += '</div>';
  }

  html += '<div class="export-bar">' +
    '<button onclick="showEditUI(window._currentStory, window._editPublishedId || \'\')">âœï¸ ç·¨è¼¯ç« ç¯€</button>' +
    '<button onclick="aiScoreStory()">ðŸ“Š AI è©•åˆ†</button>' +
    '<button onclick="aiOptimizeStory()">âœ¨ AI å„ªåŒ–</button>' +
    '<button onclick="regenAllImages()">ðŸ–¼ï¸ é‡æ–°ç”Ÿåœ–</button>' +
    '<button onclick="publishStory()">ðŸ“¤ ç™¼ä½ˆ</button>' +
    '<button onclick="exportEPUB()">ðŸ“• EPUB</button>' +
    '<button onclick="exportPDF()">ðŸ“„ PDF</button>' +
    '<button onclick="copyAll()">ðŸ“‹ è¤‡è£½å…¨éƒ¨</button>' +
    '<button onclick="downloadMD()">â¬‡ï¸ ä¸‹è¼‰ MD</button>' +
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
    const resp = await apiFetch(API_BASE + '/api/story-image', {
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
  if (imgEl) imgEl.innerHTML = '<div class="img-loading"><div class="spinner"></div><span>é‡æ–°ç”Ÿæˆ...</span></div>';
  generateImage(ch.imagePrompt, idx);
}

// === Copy & Export ===
function copyChapter(idx) {
  if (!window._currentStory) return;
  const ch = window._currentStory.chapters[idx];
  const text = 'ã€ç¬¬' + ch.num + 'ç¯‡ã€‘' + ch.title + '\n\n' + ch.text + (ch.hook ? '\n\nðŸ’¬ ' + ch.hook : '');
  navigator.clipboard.writeText(text).then(() => showToast('å·²è¤‡è£½ç¬¬' + ch.num + 'ç¯‡'));
}

function copyAll() {
  if (!window._currentStory) return;
  const s = window._currentStory;
  let text = 'ðŸ“– ' + s.title + '\n\n';
  s.chapters.forEach(ch => {
    text += 'â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\nã€ç¬¬' + ch.num + 'ç¯‡ã€‘' + ch.title + '\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n\n' + ch.text + '\n';
    if (ch.hook) text += '\nðŸ’¬ ' + ch.hook + '\n';
    text += '\n';
  });
  navigator.clipboard.writeText(text).then(() => showToast('å·²è¤‡è£½å…¨éƒ¨æ•…äº‹'));
}

function downloadMD() {
  if (!window._currentStory) return;
  const s = window._currentStory;
  let md = '# ' + s.title + '\n\n';
  s.chapters.forEach(ch => {
    md += '## ç¬¬' + ch.num + 'ç¯‡ï¼š' + ch.title + '\n\n' + ch.text + '\n\n';
    if (ch.hook) md += '> ðŸ’¬ ' + ch.hook + '\n\n';
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

// === Language Switcher ===
function switchLanguage(langCode) {
  if (typeof setLanguage === 'function') {
    setLanguage(langCode);
  }
}

// === Story Bible Panel ===
function toggleBiblePanel() {
  var panel = document.getElementById('biblePanel');
  if (!panel) return;
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
}

function renderBiblePanel(bible) {
  var existing = document.getElementById('biblePanel');
  if (existing) existing.remove();
  if (!bible || (!bible.characters.length && !bible.world.length && !bible.relationships.length && !bible.plotThreads.length)) return;

  var html = '<div id="biblePanel" class="bible-panel">';
  html += '<div class="bible-header" onclick="toggleBiblePanel()"><span>ðŸ“– Story Bible</span><span class="bible-toggle">â–¼</span></div>';
  html += '<div class="bible-content">';

  if (bible.characters.length) {
    html += '<div class="bible-section"><div class="bible-section-title">ðŸ‘¤ è§’è‰² (' + bible.characters.length + ')</div>';
    bible.characters.forEach(function(ch) {
      html += '<div class="bible-card"><div class="bible-card-name">' + escHtml(ch.name) + '</div>';
      if (ch.personality) html += '<div class="bible-card-detail">' + escHtml(ch.personality) + '</div>';
      if (ch.arc) html += '<div class="bible-card-detail" style="color:#f093fb">å¼§ç·š: ' + escHtml(ch.arc) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  if (bible.relationships.length) {
    html += '<div class="bible-section"><div class="bible-section-title">ðŸ’• é—œä¿‚ (' + bible.relationships.length + ')</div>';
    bible.relationships.forEach(function(r) {
      var c1 = r.char1 || r.char1Id || '?', c2 = r.char2 || r.char2Id || '?';
      html += '<div class="bible-card"><div class="bible-card-name">' + escHtml(c1) + ' â†” ' + escHtml(c2) + '</div>';
      if (r.description) html += '<div class="bible-card-detail">' + escHtml(r.description) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  if (bible.world.length) {
    html += '<div class="bible-section"><div class="bible-section-title">ðŸŒ ä¸–ç•Œè§€ (' + bible.world.length + ')</div>';
    bible.world.forEach(function(w) {
      html += '<div class="bible-card"><div class="bible-card-name">' + escHtml(w.name) + '</div>';
      if (w.description) html += '<div class="bible-card-detail">' + escHtml(w.description) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  if (bible.plotThreads.length) {
    html += '<div class="bible-section"><div class="bible-section-title">ðŸ§µ åŠ‡æƒ…ç·š (' + bible.plotThreads.length + ')</div>';
    bible.plotThreads.forEach(function(pt) {
      var statusIcon = pt.status === 'active' ? 'ðŸŸ¢' : pt.status === 'resolved' ? 'âœ…' : 'ðŸ’¤';
      html += '<div class="bible-card"><div class="bible-card-name">' + statusIcon + ' ' + escHtml(pt.name) + '</div>';
      if (pt.description) html += '<div class="bible-card-detail">' + escHtml(pt.description) + '</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  html += '</div></div>';
  var output = document.getElementById('output');
  if (output) output.insertAdjacentHTML('afterbegin', html);
}

// === Export Handlers ===
async function exportEPUB() {
  if (!window._currentStory) { showToast('æ²’æœ‰æ•…äº‹å¯åŒ¯å‡º'); return; }
  if (typeof generateEPUB !== 'function') { showToast('EPUB æ¨¡çµ„æœªè¼‰å…¥'); return; }
  showToast('ðŸ“¦ ç”Ÿæˆ EPUB ä¸­...', true);
  try {
    var lang = (typeof getLanguage === 'function') ? getLanguage() : 'zh-TW';
    var blob = await generateEPUB(window._currentStory, { format: 'epub', includeImages: true, language: lang, author: 'AI Story Creator' });
    if (typeof downloadBlob === 'function') {
      downloadBlob(blob, (window._currentStory.title || 'story') + '.epub');
    }
    showToast('âœ… EPUB å·²ä¸‹è¼‰');
  } catch(e) { showToast('âŒ EPUB å¤±æ•—: ' + e.message); }
}

async function exportPDF() {
  if (!window._currentStory) { showToast('æ²’æœ‰æ•…äº‹å¯åŒ¯å‡º'); return; }
  if (typeof exportPDFFromServer !== 'function' && typeof window.exportPDF !== 'function') {
    // Fallback: call server directly
    showToast('ðŸ“„ ç”Ÿæˆ PDF ä¸­...', true);
    try {
      var resp = await apiFetch(API_BASE + '/api/story/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Passcode': ACCESS_CODE },
        body: JSON.stringify({ story: window._currentStory })
      });
      if (!resp.ok) { var e = await resp.json(); throw new Error(e.error || 'PDF ' + resp.status); }
      var blob = await resp.blob();
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (window._currentStory.title || 'story') + '.pdf';
      a.click();
      showToast('âœ… PDF å·²ä¸‹è¼‰');
    } catch(e) { showToast('âŒ PDF å¤±æ•—: ' + e.message); }
    return;
  }
  showToast('ðŸ“„ ç”Ÿæˆ PDF ä¸­...', true);
  try {
    var fn = typeof exportPDFFromServer === 'function' ? exportPDFFromServer : window.exportPDF;
    await fn(window._currentStory, { format: 'pdf' });
    showToast('âœ… PDF å·²ä¸‹è¼‰');
  } catch(e) { showToast('âŒ PDF å¤±æ•—: ' + e.message); }
}

// === Utils ===
function escHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// === AI Style Tuning Dialog ===
var _styleTuning = null; // stores tuning result for current generation

async function showTuningDialog(topic, style, audience) {
  return new Promise(function(resolve) {
    // Build tuning questions based on style category
    var questions = _getTuningQuestions(style);
    var answers = {};
    var currentQ = 0;

    // Create dialog overlay
    var overlay = document.createElement('div');
    overlay.className = 'tuning-overlay';
    overlay.innerHTML = '<div class="tuning-dialog">' +
      '<div class="tuning-header">ðŸŽ¨ é¢¨æ ¼å¾®èª¿</div>' +
      '<div class="tuning-topic">ä¸»é¡Œï¼š' + escHtml(topic) + ' Â· é¢¨æ ¼ï¼š' + escHtml(style.name) + '</div>' +
      '<div class="tuning-chat" id="tuningChat"></div>' +
      '<div class="tuning-input-row">' +
        '<div class="tuning-options" id="tuningOptions"></div>' +
        '<div class="tuning-custom-row" style="display:flex;gap:8px;margin-top:8px">' +
          '<input type="text" id="tuningInput" placeholder="æˆ–è¼¸å…¥è‡ªè¨‚å›žç­”..." class="tuning-input" onkeydown="if(event.key===\'Enter\')submitTuning()">' +
          '<button onclick="submitTuning()" class="tuning-send">â†’</button>' +
        '</div>' +
      '</div>' +
      '<div class="tuning-actions">' +
        '<button onclick="skipTuning()" class="tuning-skip">è·³éŽå¾®èª¿ï¼Œç›´æŽ¥ç”Ÿæˆ</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(overlay);

    // Show first question
    _showTuningQuestion(questions, currentQ);

    // Submit answer
    window.submitTuning = function(optionValue) {
      var input = document.getElementById('tuningInput');
      var answer = optionValue || (input ? input.value.trim() : '');
      if (!answer) return;

      // Show user answer in chat
      var chat = document.getElementById('tuningChat');
      chat.innerHTML += '<div class="tuning-msg tuning-user">' + escHtml(answer) + '</div>';
      answers[questions[currentQ].key] = answer;
      if (input) input.value = '';

      currentQ++;
      if (currentQ < questions.length) {
        setTimeout(function() { _showTuningQuestion(questions, currentQ); }, 300);
      } else {
        // All questions answered â€” build tuning prompt
        chat.innerHTML += '<div class="tuning-msg tuning-ai">âœ… äº†è§£ï¼é–‹å§‹ç”Ÿæˆ...</div>';
        setTimeout(function() {
          overlay.remove();
          _styleTuning = _buildTuningPrompt(answers, topic, style);
          resolve(_styleTuning);
        }, 800);
      }
      chat.scrollTop = chat.scrollHeight;
    };

    // Skip tuning
    window.skipTuning = function() {
      overlay.remove();
      _styleTuning = null;
      resolve(null);
    };
  });
}

function _showTuningQuestion(questions, idx) {
  var q = questions[idx];
  var chat = document.getElementById('tuningChat');
  var options = document.getElementById('tuningOptions');

  chat.innerHTML += '<div class="tuning-msg tuning-ai">' + q.question + '</div>';
  chat.scrollTop = chat.scrollHeight;

  // Show option buttons
  options.innerHTML = q.options.map(function(opt) {
    return '<button class="tuning-opt" onclick="submitTuning(\'' + opt.replace(/'/g, "\\'") + '\')">' + escHtml(opt) + '</button>';
  }).join('');
}

function _getTuningQuestions(style) {
  var base = [
    {
      key: 'tone',
      question: 'ðŸ“ ä½ å¸Œæœ›ä»€éº¼èªžæ°£ï¼Ÿ',
      options: ['è¼•é¬†æ˜“è®€', 'å°ˆæ¥­åš´è¬¹', 'å¹½é»˜é¢¨è¶£', 'æº«æš–æ„Ÿæ€§', 'çŠ€åˆ©ç›´ç™½']
    },
    {
      key: 'depth',
      question: 'ðŸ“Š å…§å®¹æ·±åº¦ï¼Ÿ',
      options: ['å…¥é–€ç§‘æ™®', 'ä¸­ç­‰æ·±åº¦', 'å°ˆå®¶ç´šæ·±å…¥']
    },
    {
      key: 'local',
      question: 'ðŸŒ è¦åŠ å…¥åœ¨åœ°å…ƒç´ å—Žï¼Ÿ',
      options: ['å°ç£æ¡ˆä¾‹ç‚ºä¸»', 'åœ‹éš›æ¡ˆä¾‹ç‚ºä¸»', 'æ··åˆéƒ½è¦']
    }
  ];

  // Add style-specific questions
  if (style.type === 'book' || style.type === 'article') {
    base.push({
      key: 'structure',
      question: 'ðŸ—ï¸ åå¥½ä»€éº¼çµæ§‹ï¼Ÿ',
      options: ['æ•…äº‹æ¡ˆä¾‹é©…å‹•', 'ç†è«–æ¡†æž¶é©…å‹•', 'å•é¡Œè§£æ±ºé©…å‹•']
    });
  }
  if (style.type === 'story') {
    base = [
      { key: 'mood', question: 'ðŸŽ­ æ•…äº‹æ°›åœï¼Ÿ', options: ['è¼•é¬†æº«é¦¨', 'ç·Šå¼µåˆºæ¿€', 'é»‘æš—æ²‰é‡', 'æµªæ¼«ç”œèœœ'] },
      { key: 'pacing', question: 'âš¡ ç¯€å¥åå¥½ï¼Ÿ', options: ['å¿«ç¯€å¥', 'æ…¢æ…¢é‹ªé™³', 'å¼µå¼›æœ‰åº¦'] },
      { key: 'ending', question: 'ðŸŽ¬ çµå±€é¢¨æ ¼ï¼Ÿ', options: ['å¤§åœ˜åœ“', 'é–‹æ”¾å¼', 'åè½‰éœ‡æ’¼', 'é¤˜éŸ»æ‚ é•·'] }
    ];
  }

  return base;
}

function _buildTuningPrompt(answers, topic, style) {
  var parts = [];
  if (answers.tone) parts.push('èªžæ°£é¢¨æ ¼ï¼š' + answers.tone);
  if (answers.depth) parts.push('å…§å®¹æ·±åº¦ï¼š' + answers.depth);
  if (answers.local) parts.push('æ¡ˆä¾‹ä¾†æºï¼š' + answers.local);
  if (answers.structure) parts.push('çµæ§‹åå¥½ï¼š' + answers.structure);
  if (answers.mood) parts.push('æ•…äº‹æ°›åœï¼š' + answers.mood);
  if (answers.pacing) parts.push('ç¯€å¥åå¥½ï¼š' + answers.pacing);
  if (answers.ending) parts.push('çµå±€é¢¨æ ¼ï¼š' + answers.ending);
  if (parts.length === 0) return null;
  return 'ã€ä½¿ç”¨è€…é¢¨æ ¼å¾®èª¿ã€‘\n' + parts.join('\n');
}

function mdToHtml(s) {
  if (!s) return '';
  var h = escHtml(s);
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
  h = h.replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:3px">$1</code>');
  h = h.replace(/^### (.+)$/gm, '<div style="font-size:15px;font-weight:600;color:#f093fb;margin:12px 0 4px">$1</div>');
  h = h.replace(/^## (.+)$/gm, '<div style="font-size:16px;font-weight:700;color:#fff;margin:14px 0 6px">$1</div>');
  h = h.replace(/^# (.+)$/gm, '<div style="font-size:18px;font-weight:700;color:#fff;margin:16px 0 8px">$1</div>');
  h = h.replace(/^[-â€¢] (.+)$/gm, '<div style="padding-left:16px">â€¢ $1</div>');
  h = h.replace(/^\d+\. (.+)$/gm, function(m, p1, offset, str) { return '<div style="padding-left:16px">' + m + '</div>'; });
  h = h.replace(/\n/g, '<br>');
  return h;
}
function showToast(msg, persistent) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (t._timer) clearTimeout(t._timer);
  if (!persistent) t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

// === Publish News to GitHub Pages ===
async function publishNews() {
  if (!window._currentStory || !window._currentStory.articles) { showToast('æ²’æœ‰æ–°èžå¯ç™¼ä½ˆ'); return; }
  var news = window._currentStory;
  showToast('ðŸ“¤ ç™¼ä½ˆæ–°èžä¸­...');
  var id = 'news-' + new Date().toISOString().split('T')[0];
  var filename = id + '.html';
  var html = '<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">';
  html += '<title>' + escHtml((news.date || '') + ' ä»Šæ—¥æ–°èž') + '</title><link rel="stylesheet" href="reader.css?v=1"></head><body>';
  html += '<div class="stories-header"><h1>ðŸ“° ä»Šæ—¥æ–°èž</h1><p>' + escHtml(news.date || '') + '</p>';
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
    if (a.source) html += '<span style="font-size:12px;color:#888">ðŸ“° ' + escHtml(a.source) + '</span> ';
    html += '<a href="' + escHtml(url) + '" target="_blank" style="font-size:12px;color:#4ecdc4;text-decoration:none;font-weight:600">é–±è®€å…¨æ–‡ â†’</a>';
    html += '</div></div>';
  });
  html += '</div><div style="text-align:center;padding:20px"><a href="index.html" style="color:#f093fb;text-decoration:none">â† æ‰€æœ‰æ•…äº‹</a></div></body></html>';
  try {
    var pubResp = await apiFetch(API_BASE + '/api/story-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, title: (news.date || '') + ' ä»Šæ—¥æ–°èž', chapters: news.articles.length, html: html })
    });
    if (!pubResp.ok) { var e = {}; try { e = await pubResp.json(); } catch(_){} throw new Error(e.error || 'Publish ' + pubResp.status); }
    var url = STORIES_BASE + filename;
    showToast('âœ… æ–°èžå·²ç™¼ä½ˆï¼');
    var output = document.getElementById('output');
    output.innerHTML += '<div style="margin:16px 0;padding:16px;border-radius:12px;background:rgba(46,204,113,0.1);border:1px solid rgba(46,204,113,0.3);text-align:center"><div style="font-size:15px;color:#2ecc71;font-weight:600;margin-bottom:8px">âœ… æ–°èžå·²ç™¼ä½ˆ</div><a href="' + url + '" target="_blank" style="color:#4ecdc4;word-break:break-all">' + url + '</a></div>';
  } catch(e) { showToast('âŒ ç™¼ä½ˆå¤±æ•—: ' + e.message); }
}

// === Publish Story to GitHub Pages ===
async function publishStory() {
  if (!window._currentStory) { showToast('æ²’æœ‰æ•…äº‹å¯ç™¼ä½ˆ'); return; }
  var story = window._currentStory;
  var hasImages = story.chapters.some(function(ch) { return ch.imagePrompt; });
  // First publish: auto-include images if they exist, no questions asked
  // Republish: also auto-include, no questions
  await publishStoryDirect(hasImages);
}

async function publishStoryDirect(wantImages) {
  if (!window._currentStory) { showToast('æ²’æœ‰æ•…äº‹å¯ç™¼ä½ˆ'); return; }
  const story = window._currentStory;
  showToast('ðŸ“¤ ç™¼ä½ˆä¸­...', true);

  const id = window._editPublishedId || window._preGeneratedStoryId || Date.now().toString(36);
  window._editPublishedId = null;
  window._preGeneratedStoryId = null;

  var imagePrompts = [];
  if (wantImages) {
    story.chapters.forEach(function(ch, i) {
      if (ch.imagePrompt) imagePrompts.push({ idx: i, prompt: ch.imagePrompt });
    });
  }

  try {
    var pubBody = {
      id: id,
      title: story.title || 'æ•…äº‹',
      chapters: story.chapters.map(function(ch) {
        return { num: ch.num, title: ch.title, text: ch.text, hook: ch.hook || '', imagePrompt: ch.imagePrompt || '' };
      })
    };
    if (imagePrompts.length > 0) pubBody.imagePrompts = imagePrompts;
    // Password protection
    var pwInput = document.getElementById('storyPassword');
    if (pwInput && pwInput.value.trim()) pubBody.password = pwInput.value.trim();
    var pubResp = await apiFetch(API_BASE + '/api/story-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pubBody)
    });
    if (!pubResp.ok) {
      var errData = {};
      try { errData = await pubResp.json(); } catch(_) {}
      throw new Error(errData.error || 'Publish API ' + pubResp.status);
    }

    var url = API_BASE + '/reader?id=' + id;
    showToast('âœ… ç™¼ä½ˆæˆåŠŸ');
    // Save to localStorage
    try {
      var list = JSON.parse(localStorage.getItem('storyHistory') || '[]');
      var found = list.find(function(l) { return l.story && l.story.title === story.title; });
      if (found) { found.publishedId = id; }
      else { list.unshift({ topic: story.title, style: _selectedStyle, audience: '', story: story, date: new Date().toISOString(), publishedId: id }); }
      if (list.length > 50) list.length = 50;
      localStorage.setItem('storyHistory', JSON.stringify(list));
    } catch(_) {}
    // Show persistent publish result panel
    var output = document.getElementById('output');
    var pubInfo = '<div style="margin:16px 0;padding:20px;border-radius:14px;background:rgba(46,204,113,0.08);border:1px solid rgba(46,204,113,0.25)">';
    pubInfo += '<div style="text-align:center;margin-bottom:12px"><span style="font-size:32px">âœ…</span></div>';
    pubInfo += '<div style="text-align:center;font-size:17px;font-weight:700;color:#2ecc71;margin-bottom:4px">ç™¼ä½ˆæˆåŠŸ</div>';
    pubInfo += '<div style="text-align:center;font-size:15px;color:#ddd;margin-bottom:4px">' + escHtml(story.title || 'æ•…äº‹') + '</div>';
    pubInfo += '<div style="text-align:center;font-size:13px;color:#888;margin-bottom:8px">' + story.chapters.length + ' ç¯‡ç« </div>';
    pubInfo += '<div style="text-align:center;margin-bottom:10px"><a href="' + url + '" target="_blank" style="color:#4ecdc4;font-size:14px;word-break:break-all">' + url + '</a></div>';
    pubInfo += '<div style="text-align:center;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">';
    pubInfo += '<button onclick="navigator.clipboard.writeText(\'' + url + '\');showToast(\'å·²è¤‡è£½é€£çµ\')" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(78,205,196,0.3);background:rgba(78,205,196,0.1);color:#4ecdc4;cursor:pointer;font-size:13px">ðŸ“‹ è¤‡è£½é€£çµ</button>';
    pubInfo += '<button onclick="window.open(\'' + url + '\',\'_blank\')" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(240,147,251,0.3);background:rgba(240,147,251,0.1);color:#f093fb;cursor:pointer;font-size:13px">ðŸ”— é–‹å•Ÿæ•…äº‹</button>';
    pubInfo += '</div></div>';
    output.innerHTML += pubInfo;
  } catch (e) {
    showToast('âŒ ç™¼ä½ˆå¤±æ•—: ' + e.message);
  }
}


// === AI Score + Auto-Optimize Loop ===
async function aiScoreStory() {
  if (!window._currentStory) { showToast('æ²’æœ‰æ•…äº‹'); return; }
  var output = document.getElementById('output');
  var maxRounds = 5;
  var history = [];
  var story = window._currentStory;

  for (var round = 1; round <= maxRounds; round++) {
    // Step 1: Score
    output.innerHTML += '<div id="scoreRound' + round + '" style="margin:12px 0;padding:14px;border-radius:12px;background:rgba(240,147,251,0.06);border:1px solid rgba(240,147,251,0.15)"><div style="font-size:14px;color:#f093fb;font-weight:600">ðŸ“Š ç¬¬ ' + round + ' è¼ªè©•åˆ†ä¸­...</div></div>';
    var storyText = story.chapters.map(function(ch) { return 'ã€ç¬¬' + ch.num + 'ç¯‡ã€‘' + ch.title + '\n' + ch.text; }).join('\n\n');
    // Limit total length to avoid API issues
    if (storyText.length > 8000) storyText = storyText.substring(0, 8000) + '\n\n...ï¼ˆå¾ŒçºŒç¯‡ç« çœç•¥ï¼‰';
    var scorePrompt = 'è©•åˆ†ä»¥ä¸‹æ–‡ç« ï¼ˆæ»¿åˆ†10ï¼‰ï¼Œç”¨JSONå›žè¦†ï¼š{"scores":{"scene":0,"character":0,"depth":0,"pacing":0,"foreshadow":0,"tone":0,"memorable":0},"feedback":"æ”¹å–„å»ºè­°","lowAreas":"æœ€éœ€æ”¹å–„çš„å…·é«”å•é¡Œ"}\n\nè©•åˆ†æ¨™æº–ï¼šscene=å ´æ™¯å…·é«”åº¦ character=äººç‰©çœŸå¯¦æ„Ÿ depth=æ¦‚å¿µæ·±åº¦ pacing=çµæ§‹ç¯€å¥ foreshadow=ä¼ç­†æ”¶å°¾ tone=èªžæ°£ä¸€è‡´æ€§ memorable=è®€è€…è¨˜æ†¶é»ž\n\n' + storyText;
    try {
      var resp = await apiFetch(API_BASE + '/api/story-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: scorePrompt }) });
      if (!resp.ok) break;
      var data = await resp.json();
      var raw = data.text || '';
      var tick3 = String.fromCharCode(96,96,96);
      var cleaned = raw.replace(new RegExp(tick3 + 'json\\s*', 'g'), '').replace(new RegExp(tick3 + '\\s*', 'g'), '').trim();
      var score; try { score = JSON.parse(cleaned); } catch(pe) { var jsonMatch = cleaned.match(/\{[\s\S]*\}/); if (jsonMatch) score = JSON.parse(jsonMatch[0]); else throw pe; }
      var s = score.scores || {};
      var labels = {scene:'å ´æ™¯',character:'äººç‰©',depth:'æ·±åº¦',pacing:'ç¯€å¥',foreshadow:'ä¼ç­†',tone:'èªžæ°£',memorable:'è¨˜æ†¶é»ž'};
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
            if (diff !== 0) changes.push(labels[ck] + (diff > 0 ? 'â†‘' : 'â†“') + Math.abs(diff));
          }
        }
        if (changes.length > 0) {
          var changeEl = document.getElementById('scoreRound' + round);
          if (changeEl) changeEl.innerHTML += '<div style="font-size:12px;color:#888;margin-top:4px">è®ŠåŒ–ï¼š' + changes.join(' ') + '</div>';
        }
        // Rollback if overall got worse
        var prevAvg = 0, curAvg = 0, cnt = 0;
        for (var ak in labels) { if (s[ak] && prev[ak]) { prevAvg += prev[ak]; curAvg += s[ak]; cnt++; } }
        if (cnt > 0 && curAvg / cnt < prevAvg / cnt && window._prevChapters) {
          story.chapters = window._prevChapters;
          window._currentStory = story;
          var rbEl = document.getElementById('scoreRound' + round);
          if (rbEl) rbEl.innerHTML += '<div style="font-size:12px;color:#f5576c;margin-top:4px">âš ï¸ åˆ†æ•¸ä¸‹é™ï¼Œå·²å›žæ»¾åˆ°ä¸Šä¸€ç‰ˆ</div>';
          break;
        }
      }
      history.push({ round: round, scores: s, low: lowItems.join('ã€') });

      var el = document.getElementById('scoreRound' + round);
      if (el) el.innerHTML = '<div style="font-size:14px;color:#f093fb;font-weight:600">ðŸ“Š ç¬¬ ' + round + ' è¼ª</div>' + scoreHtml + (lowItems.length > 0 ? '<div style="font-size:12px;color:#f5576c;margin-top:4px">ä½Žåˆ†ï¼š' + lowItems.join('ã€') + '</div>' : '<div style="font-size:13px;color:#2ecc71;font-weight:600;margin-top:4px">âœ… å…¨éƒ¨ 9 åˆ†ä»¥ä¸Šï¼</div>');

      if (allAbove9) {
        showToast('âœ… å…¨éƒ¨é”æ¨™ï¼å…± ' + round + ' è¼ª');
        break;
      }
      if (round >= maxRounds) {
        showToast('âš ï¸ å·²é”æœ€å¤§è¼ªæ•¸ ' + maxRounds);
        break;
      }

      // Step 2: Optimize low scores
      el.innerHTML += '<div style="font-size:12px;color:#888;margin-top:6px">ðŸ”§ å„ªåŒ–ä¸­...</div>';
      // Find the worst chapter based on feedback
      var worstIdx = Math.floor(Math.random() * story.chapters.length);
      var worstCh = story.chapters[worstIdx];
      var storyJson = JSON.stringify({ num: worstCh.num, title: worstCh.title, text: worstCh.text, hook: worstCh.hook });
      var optPrompt = 'å„ªåŒ–ä»¥ä¸‹ç¯‡ç« ï¼ˆåªæ”¹ä½Žåˆ†éƒ¨åˆ†ï¼‰ã€‚ä½Žåˆ†é …ç›®ï¼š' + lowItems.join('ã€') + '\næ”¹å–„å»ºè­°ï¼š' + (score.feedback || '') + '\n' + (score.lowAreas || '') + '\n\nè¦å‰‡ï¼šç¦æ­¢æŒ‡ä»¤ç”¨èªžã€ç¦æ­¢TEDæ¼”è¬›çµå°¾\nå›žè¦†å„ªåŒ–å¾ŒJSONï¼ˆåŒæ ¼å¼ï¼‰ï¼š\n' + storyJson;
      var resp2 = await apiFetch(API_BASE + '/api/story-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: optPrompt }) });
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
      if (el2) el2.innerHTML += '<div style="font-size:12px;color:#f5576c;margin-top:4px">âŒ å¤±æ•—: ' + escHtml(e.message) + '</div>';
      break;
    }
    // Delay between rounds to avoid rate limit
    await new Promise(function(r) { setTimeout(r, 3000); })
  }

  // Re-render story with updated content + export bar, then append score history
  renderStory(window._currentStory);
  if (history.length > 0) {
    var histHtml = '<div style="margin:12px 0;padding:12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">';
    histHtml += '<div style="font-size:13px;color:#f093fb;font-weight:600;margin-bottom:6px">ðŸ“ˆ è©•åˆ†æ­·ç¨‹ï¼ˆå…± ' + history.length + ' è¼ªï¼‰</div>';
    history.forEach(function(h) { histHtml += '<div style="font-size:12px;color:#aaa">ç¬¬' + h.round + 'è¼ªï¼š' + (h.low || 'âœ… å…¨éƒ¨é”æ¨™') + '</div>'; });
    histHtml += '</div>';
    output.innerHTML += histHtml;
  }
}

// === AI Optimize Low Scores (targeted) ===
async function aiOptimizeLowScores() {
  if (!window._currentStory || !window._lastScores) { showToast('è«‹å…ˆè©•åˆ†'); return; }
  var scores = window._lastScores.scores || {};
  var weaknesses = window._lastScores.weaknesses || '';
  var feedback = window._lastScores.feedback || '';
  // Find which areas need improvement
  var improvements = [];
  if (scores.plot < 9) improvements.push('åŠ‡æƒ…é‚è¼¯ï¼ˆç›®å‰' + scores.plot + 'åˆ†ï¼‰ï¼šåŠ å¼·å› æžœé—œä¿‚ã€æ¸›å°‘å·§åˆ');
  if (scores.characters < 9) improvements.push('è§’è‰²æ·±åº¦ï¼ˆç›®å‰' + scores.characters + 'åˆ†ï¼‰ï¼šç”¨è¡Œç‚ºå’Œå°è©±å±•ç¾æ€§æ ¼ï¼Œå¢žåŠ å…§å¿ƒæŽ™æ‰Ž');
  if (scores.pacing < 9) improvements.push('ç¯€å¥æ„Ÿï¼ˆç›®å‰' + scores.pacing + 'åˆ†ï¼‰ï¼šèª¿æ•´å¿«æ…¢ç¯€å¥ï¼Œé—œéµè™•ç”¨çŸ­å¥');
  if (scores.hook < 9) improvements.push('å¸å¼•åŠ›ï¼ˆç›®å‰' + scores.hook + 'åˆ†ï¼‰ï¼šåŠ å¼·é–‹é ­æ‡¸å¿µå’Œçµå°¾ cliffhanger');

  showToast('ðŸ”§ å„ªåŒ–ä¸­ï¼ˆåªæ”¹ä½Žåˆ†éƒ¨åˆ†ï¼‰...');
  var story = window._currentStory;
  var storyJson = JSON.stringify({ title: story.title, chapters: story.chapters.map(function(ch) { return { num: ch.num, title: ch.title, text: ch.text, hook: ch.hook }; }) });

  var prompt = 'ä»¥ä¸‹æ•…äº‹éœ€è¦å±€éƒ¨å„ªåŒ–ï¼ˆä¸è¦æ•´ç¯‡é‡å¯«ï¼Œåªæ”¹å–„å¼±é …ï¼‰ã€‚\n\n' +
    'éœ€è¦æ”¹å–„çš„é …ç›®ï¼š\n' + improvements.join('\n') + '\n\n' +
    'è©•å¯©æ„è¦‹ï¼š' + weaknesses + '\n' + feedback + '\n\n' +
    'è¦å‰‡ï¼š\n- åªä¿®æ”¹éœ€è¦æ”¹å–„çš„éƒ¨åˆ†ï¼Œä¿ç•™å¥½çš„å…§å®¹\n- ç¦æ­¢å‡ºç¾æŒ‡ä»¤ç”¨èªžï¼ˆè‡ªæˆ‘çŸ›ç›¾ã€ä»˜å‡ºä»£åƒ¹ç­‰ï¼‰\n- ç¦æ­¢çµå°¾è®Š TED æ¼”è¬›\n- å›žè¦†å®Œæ•´çš„å„ªåŒ–å¾Œ JSONï¼ˆåŒæ ¼å¼ï¼‰\n\n' + storyJson;

  try {
    var resp = await apiFetch(API_BASE + '/api/story-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt }) });
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
      showToast('âœ… ä½Žåˆ†é …ç›®å·²å„ªåŒ–ï¼Œè«‹é‡æ–°è©•åˆ†ç¢ºèª');
    }
  } catch(e) { showToast('å„ªåŒ–å¤±æ•—: ' + e.message); }
}

// === AI Optimize Story ===
async function aiOptimizeStory() {
  if (!window._currentStory) { showToast('æ²’æœ‰æ•…äº‹'); return; }
  if (!confirm('AI å°‡é€ç¯‡å„ªåŒ–æ•…äº‹ã€‚ç¹¼çºŒå—Žï¼Ÿ')) return;
  var story = window._currentStory;
  var output = document.getElementById('output');
  
  for (var i = 0; i < story.chapters.length; i++) {
    var ch = story.chapters[i];
    showToast('âœ¨ å„ªåŒ–ç¬¬ ' + ch.num + ' ç¯‡...');
    var prompt = 'å„ªåŒ–ä»¥ä¸‹ç¯‡ç« ï¼ˆä¿ç•™å¥½çš„éƒ¨åˆ†ï¼Œæ”¹å–„å¼±é …ï¼‰ã€‚ç¦æ­¢æŒ‡ä»¤ç”¨èªžã€ç¦æ­¢èªªæ•™çµå°¾ã€‚\n\n' +
      'æ•…äº‹æ¨™é¡Œï¼š' + story.title + '\n' +
      'ç¬¬ ' + ch.num + ' ç¯‡ã€Œ' + ch.title + 'ã€ï¼š\n' + ch.text + '\n\n' +
      'å›žè¦†å„ªåŒ–å¾Œçš„ JSONï¼ˆä¸è¦ markdownï¼‰ï¼š{"title":"ç¯‡ç« æ¨™é¡Œ","text":"å„ªåŒ–å¾Œå…§å®¹","hook":"é‡‘å¥"}';
    try {
      var resp = await apiFetch(API_BASE + '/api/story-generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt }) });
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
  showToast('âœ… é€ç¯‡å„ªåŒ–å®Œæˆ');
}

// === Regenerate All Images ===
function startReading() {
  if (_voiceMode === 'off') { showToast('è«‹å…ˆé¸æ“‡èªžéŸ³æ¨¡å¼'); return; }
  if (_voiceMode === 'browser') { readStoryBrowser(); return; }
  // Gemini TTS voices
  var voiceMap = {'kore':'Kore','zephyr':'Zephyr','aoede':'Aoede','leda':'Leda','puck':'Puck','orus':'Orus','charon':'Charon','fenrir':'Fenrir'};
  var voiceName = voiceMap[_voiceMode];
  if (voiceName) { readStoryGemini(voiceName); return; }
  showToast('æœªçŸ¥çš„èªžéŸ³æ¨¡å¼');
}

function regenAllImages() {
  if (!window._currentStory) { showToast('æ²’æœ‰æ•…äº‹'); return; }
  showToast('ðŸ–¼ï¸ é‡æ–°ç”Ÿæˆæ‰€æœ‰åœ–ç‰‡...');
  window._currentStory.chapters.forEach(function(ch, i) {
    var imgEl = document.getElementById('chImg' + i);
    if (imgEl) imgEl.innerHTML = '<div class="img-loading"><div class="spinner"></div><span>é‡æ–°ç”Ÿæˆ...</span></div>';
    generateImage(ch.imagePrompt, i);
  });
}

// === Published Stories Management ===
async function showPublished() {
  var output = document.getElementById('output');
  output.innerHTML = '<div class="loading"><div class="spinner"></div><p>è¼‰å…¥å·²ç™¼ä½ˆæ•…äº‹...</p></div>';
  try {
    var resp = await apiFetch(API_BASE + '/api/story-list');
    if (!resp.ok) throw new Error('API ' + resp.status);
    var data = await resp.json();
    var stories = data.stories || [];
    // Also load local backups
    var localList = [];
    try { localList = JSON.parse(localStorage.getItem('storyHistory') || '[]'); } catch(_) {}
    if (stories.length === 0 && localList.length === 0) {
      output.innerHTML = '<div style="text-align:center;padding:40px;color:#888">é‚„æ²’æœ‰ç™¼ä½ˆçš„æ•…äº‹</div>';
      return;
    }
    var html = '<div style="margin:20px 0 12px"><div style="font-size:18px;font-weight:700;color:#fff">ðŸ“‚ å·²ç™¼ä½ˆæ•…äº‹ï¼ˆ' + stories.length + 'ï¼‰</div></div>';
    stories.forEach(function(s, i) {
      // Check if we have a local backup for this story
      var hasBackup = localList.some(function(l) { return l.publishedId === s.id; });
      html += '<div style="margin:8px 0;padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between">';
      html += '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:600;color:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(s.title) + '</div>';
      html += '<div style="font-size:12px;color:#666;margin-top:2px">' + (s.chapters || 0) + ' ç¯‡ Â· ' + (s.date || '') + (hasBackup ? ' Â· ðŸ“ æœ‰å‚™ä»½' : '') + '</div></div>';
      html += '<div style="display:flex;gap:6px;flex-shrink:0;margin-left:12px">';
      html += '<button onclick="editPublished(\'' + escHtml(s.id) + '\',\'' + escHtml(s.file) + '\')" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(240,147,251,0.3);background:rgba(240,147,251,0.08);color:#f093fb;font-size:12px;cursor:pointer">âœï¸ ç·¨è¼¯</button>';
      html += '<a href="https://joeliang2022.github.io/fukuoka-trip/stories/' + escHtml(s.file) + '" target="_blank" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(78,205,196,0.3);background:rgba(78,205,196,0.08);color:#4ecdc4;font-size:12px;text-decoration:none">æŸ¥çœ‹</a>';
      html += '<button onclick="deletePublished(\'' + escHtml(s.id) + '\',\'' + escHtml(s.file) + '\')" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(245,87,108,0.3);background:rgba(245,87,108,0.08);color:#f5576c;font-size:12px;cursor:pointer">åˆªé™¤</button>';
      html += '</div></div>';
    });
    // Show local-only stories (not yet published or backup without remote)
    var localOnly = localList.filter(function(l) { return l.story && l.story.title; });
    if (localOnly.length > 0) {
      html += '<div style="margin:20px 0 8px;font-size:14px;color:#888">ðŸ“ æœ¬æ©Ÿå‚™ä»½ï¼ˆ' + localOnly.length + 'ï¼‰</div>';
      localOnly.slice(0, 10).forEach(function(l, i) {
        html += '<div style="margin:6px 0;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:space-between">';
        html += '<div style="flex:1;min-width:0"><div style="font-size:14px;color:#ccc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(l.story.title) + '</div>';
        html += '<div style="font-size:11px;color:#555">' + (l.story.chapters ? l.story.chapters.length : 0) + ' ç¯‡ Â· ' + (l.date || '').split('T')[0] + '</div></div>';
        html += '<button onclick="loadLocalStory(' + i + ')" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(240,147,251,0.3);background:rgba(240,147,251,0.08);color:#f093fb;font-size:11px;cursor:pointer;flex-shrink:0;margin-left:8px">é–‹å•Ÿ</button>';
        html += '</div>';
      });
    }
    output.innerHTML = html;
  } catch(e) {
    output.innerHTML = '<div style="text-align:center;padding:40px;color:#888">è¼‰å…¥å¤±æ•—: ' + escHtml(e.message) + '</div>';
  }
}

async function deletePublished(id, file) {
  if (!confirm('ç¢ºå®šè¦åˆªé™¤ã€Œ' + id + 'ã€å—Žï¼Ÿ')) return;
  showToast('ðŸ—‘ åˆªé™¤ä¸­...');
  try {
    var resp = await apiFetch(API_BASE + '/api/story-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, file: file })
    });
    if (!resp.ok) throw new Error('API ' + resp.status);
    showToast('âœ… å·²åˆªé™¤');
    showPublished();
  } catch(e) {
    showToast('âŒ åˆªé™¤å¤±æ•—: ' + e.message);
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
    if (!item || !item.story) { showToast('æ‰¾ä¸åˆ°å‚™ä»½'); return; }
    window._currentStory = item.story;
    window._editPublishedId = item.publishedId || null;
    renderStory(item.story);
    showToast('å·²è¼‰å…¥ï¼š' + (item.story.title || ''));
  } catch(e) { showToast('è¼‰å…¥å¤±æ•—'); }
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

  // No local backup â€” fetch from GitHub Pages and parse HTML
  var output = document.getElementById('output');
  output.innerHTML = '<div class="loading"><div class="spinner"></div><p>è¼‰å…¥æ•…äº‹å…§å®¹...</p></div>';
  try {
    var url = 'https://joeliang2022.github.io/fukuoka-trip/stories/' + (file || publishedId + '.html');
    var resp = await fetch(url);
    if (!resp.ok) throw new Error('ç„¡æ³•è¼‰å…¥æ•…äº‹');
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
          hook: hook ? hook.textContent.replace(/^ðŸ’¬\s*/, '') : ''
        });
      }
    }
    if (chapters.length === 0) throw new Error('ç„¡æ³•è§£æžæ•…äº‹ç« ç¯€');

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
    output.innerHTML = '<div style="text-align:center;padding:40px;color:#f5576c">è¼‰å…¥å¤±æ•—: ' + escHtml(e.message) + '</div>';
  }
}

// === Show Edit UI with chapter checkboxes ===
function showEditUI(story, publishedId) {
  // Fill missing chapters with placeholders
  if (story.chapters && story.chapters.length > 0) {
    var maxNum = 0;
    story.chapters.forEach(function(ch) { if (ch.num > maxNum) maxNum = ch.num; });
    var chapterMap = {};
    story.chapters.forEach(function(ch) { chapterMap[ch.num] = ch; });
    var filled = [];
    for (var cn = 1; cn <= maxNum; cn++) {
      if (chapterMap[cn]) {
        filled.push(chapterMap[cn]);
      } else {
        filled.push({ num: cn, title: 'ç¬¬ ' + cn + ' ç¯‡ï¼ˆå¾…ç”Ÿæˆï¼‰', text: 'âš ï¸ æ­¤ç« ç¯€ç”Ÿæˆå¤±æ•—ï¼Œè«‹é¸æ“‡æ­¤ç« ç¯€ä¸¦è¼¸å…¥ä¿®æ”¹æŒ‡ä»¤é‡æ–°ç”Ÿæˆã€‚', hook: '', imagePrompt: '', _missing: true });
      }
    }
    story.chapters = filled;
    window._currentStory = story;
  }
  var output = document.getElementById('output');
  var html = '<div style="margin:16px 0">';
  html += '<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">âœï¸ ç·¨è¼¯æ•…äº‹</div>';
  html += '<div style="font-size:15px;color:#ddd;margin-bottom:12px">' + escHtml(story.title) + '</div>';

  // Chapter selection
  html += '<div style="margin-bottom:12px">';
  html += '<div style="display:flex;gap:8px;margin-bottom:8px">';
  html += '<button onclick="toggleAllChapters(true)" style="padding:5px 12px;border-radius:8px;border:1px solid rgba(78,205,196,0.3);background:rgba(78,205,196,0.08);color:#4ecdc4;font-size:12px;cursor:pointer">å…¨é¸</button>';
  html += '<button onclick="toggleAllChapters(false)" style="padding:5px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#888;font-size:12px;cursor:pointer">å–æ¶ˆå…¨é¸</button>';
  html += '</div>';

  story.chapters.forEach(function(ch, i) {
    var isMissing = ch._missing || (ch.text && ch.text.indexOf('âš ï¸') === 0);
    var bgColor = isMissing ? 'rgba(245,87,108,0.08)' : 'rgba(255,255,255,0.02)';
    var borderColor = isMissing ? 'rgba(245,87,108,0.25)' : 'rgba(255,255,255,0.05)';
    html += '<label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;margin:4px 0;border-radius:10px;background:' + bgColor + ';border:1px solid ' + borderColor + ';cursor:pointer">';
    html += '<input type="checkbox" class="ch-select" value="' + i + '" style="margin-top:3px;flex-shrink:0"' + (isMissing ? ' checked' : '') + '>';
    html += '<div style="flex:1;min-width:0"><div style="font-size:13px;color:' + (isMissing ? '#f5576c' : '#f093fb') + ';font-weight:600">ç¬¬ ' + ch.num + ' ç¯‡' + (isMissing ? ' âš ï¸ å¾…ç”Ÿæˆ' : '') + '</div>';
    html += '<div style="font-size:14px;color:#ddd;margin-top:2px">' + escHtml(ch.title) + '</div>';
    html += '<div style="font-size:12px;color:#777;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + escHtml((ch.text || '').substring(0, 100)) + '...</div>';
    html += '</div></label>';
  });
  html += '</div>';

  // Edit prompt
  html += '<div style="margin-bottom:12px">';
  html += '<div style="font-size:13px;color:#888;margin-bottom:6px">ä¿®æ”¹æŒ‡ä»¤ï¼ˆå‘Šè¨´ AI è¦æ€Žéº¼æ”¹ï¼‰</div>';
  html += '<textarea id="editPrompt" rows="4" placeholder="ä¾‹å¦‚ï¼šæŠŠç¬¬3ç¯‡çš„çµå°¾æ”¹æˆæ›´æœ‰æ‡¸å¿µçš„ã€åŠ å¼·è§’è‰²ä¹‹é–“çš„è¡çªã€æŠŠèªªæ•™çš„éƒ¨åˆ†æ”¹æˆç”¨å ´æ™¯å±•ç¾..." style="width:100%;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;font-family:inherit;resize:vertical;box-sizing:border-box"></textarea>';
  html += '</div>';

  // Action buttons
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  html += '<button onclick="executeEdit(\'' + escHtml(publishedId) + '\')" style="padding:10px 20px;border-radius:10px;border:none;background:linear-gradient(135deg,#f093fb,#f5576c);color:#fff;font-size:14px;font-weight:600;cursor:pointer">âœ¨ ä¿®æ”¹é¸ä¸­ç« ç¯€</button>';
  html += '<button onclick="renderStory(window._currentStory)" style="padding:10px 20px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#ccc;font-size:14px;cursor:pointer">ðŸ‘ é è¦½å…¨æ–‡</button>';
  html += '<button onclick="publishStory()" style="padding:10px 20px;border-radius:10px;border:1px solid rgba(46,204,113,0.3);background:rgba(46,204,113,0.08);color:#2ecc71;font-size:14px;cursor:pointer">ðŸ“¤ ç™¼ä½ˆ</button>';
  html += '<button onclick="showPublished()" style="padding:10px 20px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#888;font-size:14px;cursor:pointer">â† è¿”å›ž</button>';
  html += '</div></div>';

  output.innerHTML = html;
}

function toggleAllChapters(checked) {
  document.querySelectorAll('.ch-select').forEach(function(cb) { cb.checked = checked; });
}

// === Execute Edit: regenerate selected chapters with prompt ===
async function executeEdit(publishedId) {
  var story = window._currentStory;
  if (!story) { showToast('æ²’æœ‰æ•…äº‹'); return; }

  var editPrompt = document.getElementById('editPrompt').value.trim();
  if (!editPrompt) { showToast('è«‹è¼¸å…¥ä¿®æ”¹æŒ‡ä»¤'); return; }

  var selected = [];
  document.querySelectorAll('.ch-select:checked').forEach(function(cb) {
    selected.push(parseInt(cb.value));
  });
  if (selected.length === 0) { showToast('è«‹é¸æ“‡è¦ä¿®æ”¹çš„ç« ç¯€'); return; }

  var output = document.getElementById('output');
  showToast('âœ¨ ä¿®æ”¹ä¸­...');

  for (var si = 0; si < selected.length; si++) {
    var idx = selected[si];
    var ch = story.chapters[idx];
    if (!ch) continue;

    output.innerHTML = '<div class="loading"><div class="spinner"></div><p>ä¿®æ”¹ç¬¬ ' + ch.num + ' ç¯‡... (' + (si + 1) + '/' + selected.length + ')</p></div>';

    var prompt = 'ä½ æ˜¯ä¸€ä½è³‡æ·±ç·¨è¼¯ã€‚è«‹æ ¹æ“šä»¥ä¸‹æŒ‡ä»¤ä¿®æ”¹é€™ç¯‡æ–‡ç« ã€‚\n\n' +
      'ã€ä¿®æ”¹æŒ‡ä»¤ã€‘' + editPrompt + '\n\n' +
      'ã€åŽŸæ–‡ã€‘\næ¨™é¡Œï¼š' + ch.title + '\nå…§å®¹ï¼š' + ch.text + '\né‡‘å¥ï¼š' + (ch.hook || '') + '\n\n' +
      'ã€è¦å‰‡ã€‘\n- ä¿ç•™åŽŸæ–‡å¥½çš„éƒ¨åˆ†ï¼Œåªæ”¹éœ€è¦æ”¹çš„\n- ä¿®æ”¹å¾Œçš„ç¯‡å¹…è¦å’ŒåŽŸæ–‡ç›¸è¿‘\n- ç”¨ JSON å›žè¦†ï¼ˆä¸è¦ markdownï¼‰ï¼š{"num":' + ch.num + ',"title":"ä¿®æ”¹å¾Œæ¨™é¡Œ","text":"ä¿®æ”¹å¾Œå…§å®¹","imagePrompt":"è‹±æ–‡é…åœ–æè¿°","hook":"é‡‘å¥"}';

    try {
      var resp = await apiFetch(API_BASE + '/api/story-generate', {
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
    } catch(e) { showToast('ç¬¬ ' + ch.num + ' ç¯‡ä¿®æ”¹å¤±æ•—'); }
  }

  // Update local backup
  window._currentStory = story;
  try {
    var list = JSON.parse(localStorage.getItem('storyHistory') || '[]');
    var found = list.find(function(l) { return l.publishedId === publishedId; });
    if (found) { found.story = story; found.date = new Date().toISOString(); }
    localStorage.setItem('storyHistory', JSON.stringify(list));
  } catch(_) {}

  showToast('âœ… ä¿®æ”¹å®Œæˆ');
  renderStory(story);
}
