// library.js — Personal story library UI
// Fetches stories from GET /api/story/list, renders list with pagination, supports delete

(function() {
  var _stories = [];
  var _lastId = null;
  var _hasMore = false;
  var _loading = false;

  window.showLibrary = async function() {
    var output = document.getElementById('output');
    if (!output) return;
    output.innerHTML = '<div class="loading"><div class="spinner"></div><p>載入我的故事...</p></div>';
    _stories = [];
    _lastId = null;
    _hasMore = false;
    await _loadPage(output, false);
  };

  async function _loadPage(output, append) {
    if (_loading) return;
    _loading = true;
    try {
      var url = '/api/story/list?limit=20';
      if (_lastId) url += '&startAfter=' + _lastId;
      var resp = await fetch(url, { credentials: 'include' });
      if (resp.status === 401) { window.location.href = '/auth/google'; return; }
      if (!resp.ok) throw new Error('API ' + resp.status);
      var data = await resp.json();
      var newStories = data.stories || [];
      _stories = _stories.concat(newStories);
      _hasMore = data.hasMore || false;
      _lastId = data.lastId || null;
      _render(output);
    } catch(e) {
      if (!append) {
        output.innerHTML = '<div style="text-align:center;padding:40px;color:#888">載入失敗: ' + (e.message || '') + '</div>';
      }
    }
    _loading = false;
  }

  function _render(output) {
    if (_stories.length === 0) {
      output.innerHTML = '<div style="text-align:center;padding:40px;color:#888">' +
        '<div style="font-size:40px;margin-bottom:12px">📚</div>' +
        '<div style="font-size:16px;color:#aaa">還沒有故事</div>' +
        '<div style="font-size:13px;color:#666;margin-top:8px">開始創作你的第一個故事吧！</div></div>';
      return;
    }
    var html = '<div style="margin:20px 0 12px"><div style="font-size:18px;font-weight:700;color:#fff">📚 我的故事（' + _stories.length + (_hasMore ? '+' : '') + '）</div></div>';
    _stories.forEach(function(s) {
      var date = s.createdAt ? new Date(s.createdAt._seconds ? s.createdAt._seconds * 1000 : s.createdAt).toLocaleDateString() : '';
      var chapCount = (s.chapters && s.chapters.length) || 0;
      var isPublished = !!s.publishedAt;
      html += '<div style="margin:8px 0;padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between">';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-size:15px;font-weight:600;color:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _esc(s.title || '未命名') + '</div>';
      html += '<div style="font-size:12px;color:#666;margin-top:2px">' + chapCount + ' 篇 · ' + date;
      if (s.style) html += ' · ' + _esc(s.style);
      if (isPublished) html += ' · <span style="color:#2ecc71">已發佈</span>';
      html += '</div></div>';
      html += '<div style="display:flex;gap:6px;flex-shrink:0;margin-left:12px">';
      if (isPublished) {
        html += '<a href="/reader?id=' + _esc(s.id) + '" target="_blank" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(78,205,196,0.3);background:rgba(78,205,196,0.08);color:#4ecdc4;font-size:12px;text-decoration:none">查看</a>';
      }
      html += '<button onclick="deleteLibraryStory(\'' + _esc(s.id) + '\',\'' + _esc(s.title || '') + '\')" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(245,87,108,0.3);background:rgba(245,87,108,0.08);color:#f5576c;font-size:12px;cursor:pointer">刪除</button>';
      html += '</div></div>';
    });
    if (_hasMore) {
      html += '<div style="text-align:center;margin:16px 0"><button onclick="loadMoreLibrary()" id="loadMoreBtn" style="padding:10px 24px;border-radius:10px;border:1px solid rgba(240,147,251,0.3);background:rgba(240,147,251,0.08);color:#f093fb;font-size:14px;cursor:pointer">載入更多</button></div>';
    }
    output.innerHTML = html;
  }

  window.loadMoreLibrary = function() {
    var output = document.getElementById('output');
    if (output) _loadPage(output, true);
  };

  window.deleteLibraryStory = async function(id, title) {
    if (!confirm('確定要刪除「' + (title || id) + '」嗎？此操作無法復原。')) return;
    try {
      var resp = await fetch('/api/story/' + id, { method: 'DELETE', credentials: 'include' });
      if (resp.status === 401) { window.location.href = '/auth/google'; return; }
      if (resp.status === 403) { if (typeof showToast === 'function') showToast('❌ 這不是你的故事'); return; }
      if (!resp.ok) throw new Error('API ' + resp.status);
      _stories = _stories.filter(function(s) { return s.id !== id; });
      var output = document.getElementById('output');
      if (output) _render(output);
      if (typeof showToast === 'function') showToast('✅ 已刪除');
    } catch(e) {
      if (typeof showToast === 'function') showToast('❌ 刪除失敗: ' + e.message);
    }
  };

  function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
})();
