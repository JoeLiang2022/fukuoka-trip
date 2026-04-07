// account.js — Account and subscription management UI
// Fetches account info from GET /api/account, shows usage bars, upgrade buttons

(function() {
  window.showAccount = async function() {
    var output = document.getElementById('output');
    if (!output) return;
    output.innerHTML = '<div class="loading"><div class="spinner"></div><p>載入帳號資訊...</p></div>';
    try {
      var resp = await fetch('/api/account', { credentials: 'include' });
      if (resp.status === 401) { window.location.href = '/auth/google'; return; }
      if (!resp.ok) throw new Error('API ' + resp.status);
      var data = await resp.json();
      _renderAccount(output, data);
    } catch(e) {
      output.innerHTML = '<div style="text-align:center;padding:40px;color:#888">載入失敗: ' + _esc(e.message) + '</div>';
    }
  };

  function _renderAccount(output, data) {
    var plan = data.plan || 'free';
    var planLabels = { free: 'Free', pro: 'Pro', unlimited: 'Unlimited' };
    var planColors = { free: '#888', pro: '#f093fb', unlimited: '#f5576c' };

    var html = '<div style="margin:20px 0">';
    // Profile card
    html += '<div style="padding:24px;border-radius:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);margin-bottom:16px">';
    html += '<div style="display:flex;align-items:center;gap:16px">';
    if (data.photoURL) {
      html += '<img src="' + _esc(data.photoURL) + '" style="width:56px;height:56px;border-radius:50%;border:2px solid rgba(255,255,255,0.1)" alt="">';
    } else {
      html += '<div style="width:56px;height:56px;border-radius:50%;background:rgba(240,147,251,0.15);display:flex;align-items:center;justify-content:center;font-size:24px">👤</div>';
    }
    html += '<div>';
    html += '<div style="font-size:18px;font-weight:700;color:#fff">' + _esc(data.displayName || 'User') + '</div>';
    html += '<div style="font-size:13px;color:#888">' + _esc(data.email || '') + '</div>';
    html += '<div style="margin-top:4px"><span style="display:inline-block;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:600;color:' + (planColors[plan] || '#888') + ';background:' + (planColors[plan] || '#888') + '20;border:1px solid ' + (planColors[plan] || '#888') + '40">' + (planLabels[plan] || plan) + '</span></div>';
    html += '</div></div></div>';

    // Usage section
    html += '<div style="padding:20px;border-radius:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);margin-bottom:16px">';
    html += '<div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:16px">📊 本月用量</div>';
    var usage = data.usage || {};
    var types = [
      { key: 'storyGen', label: '故事生成', icon: '📖', color: '#f093fb' },
      { key: 'tts', label: '語音合成', icon: '🔊', color: '#4ecdc4' },
      { key: 'imageGen', label: '圖片生成', icon: '🖼️', color: '#f5576c' }
    ];
    types.forEach(function(t) {
      var u = usage[t.key] || { used: 0, limit: 0 };
      var isUnlimited = u.limit === -1;
      var pct = isUnlimited ? 0 : (u.limit > 0 ? Math.min(100, Math.round(u.used / u.limit * 100)) : 100);
      var barColor = pct >= 90 ? '#e74c3c' : pct >= 70 ? '#f39c12' : t.color;
      html += '<div style="margin-bottom:14px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
      html += '<span style="font-size:13px;color:#ccc">' + t.icon + ' ' + t.label + '</span>';
      html += '<span style="font-size:13px;color:#aaa">' + u.used + ' / ' + (isUnlimited ? '∞' : u.limit) + '</span>';
      html += '</div>';
      html += '<div style="height:8px;border-radius:4px;background:rgba(255,255,255,0.06);overflow:hidden">';
      if (!isUnlimited) {
        html += '<div style="height:100%;width:' + pct + '%;border-radius:4px;background:' + barColor + ';transition:width 0.3s"></div>';
      }
      html += '</div></div>';
    });
    html += '</div>';

    // Actions
    html += '<div style="display:flex;gap:10px;flex-wrap:wrap">';
    if (plan === 'free' || plan === 'pro') {
      html += '<button onclick="upgradeSubscription(\'' + (plan === 'free' ? 'pro' : 'unlimited') + '\')" style="flex:1;min-width:140px;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#f093fb,#f5576c);color:#fff;font-size:15px;font-weight:600;cursor:pointer">';
      html += plan === 'free' ? '⬆️ 升級到 Pro' : '⬆️ 升級到 Unlimited';
      html += '</button>';
    }
    html += '<a href="/pricing" style="flex:1;min-width:140px;padding:12px;border-radius:12px;border:1px solid rgba(240,147,251,0.3);background:rgba(240,147,251,0.08);color:#f093fb;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none;text-align:center">💰 查看方案</a>';
    html += '<button onclick="logoutAccount()" style="flex:1;min-width:140px;padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#aaa;font-size:14px;cursor:pointer">登出</button>';
    html += '</div>';

    // Subscription details
    if (data.subscription && data.subscription.cancelAtPeriodEnd) {
      var endDate = data.subscription.currentPeriodEnd ? new Date(data.subscription.currentPeriodEnd._seconds ? data.subscription.currentPeriodEnd._seconds * 1000 : data.subscription.currentPeriodEnd).toLocaleDateString() : '';
      html += '<div style="margin-top:12px;padding:12px;border-radius:10px;background:rgba(245,87,108,0.08);border:1px solid rgba(245,87,108,0.2);font-size:13px;color:#f5576c;text-align:center">⚠️ 訂閱將於 ' + endDate + ' 到期後取消</div>';
    }

    html += '</div>';
    output.innerHTML = html;
  }

  window.upgradeSubscription = async function(planId) {
    try {
      var resp = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId: planId })
      });
      if (resp.status === 401) { window.location.href = '/auth/google'; return; }
      if (!resp.ok) throw new Error('API ' + resp.status);
      var data = await resp.json();
      if (data.url) window.location.href = data.url;
    } catch(e) {
      if (typeof showToast === 'function') showToast('❌ 升級失敗: ' + e.message);
    }
  };

  window.logoutAccount = function() {
    try { sessionStorage.removeItem('storyAuth'); } catch(e) {}
    window.location.href = '/auth/logout';
  };

  function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
})();
