/**
 * net.js — 麻將多人連線客戶端
 * Handles WebSocket connection, room/chatroom management, chat, and game sync
 */
var MahjongNet = (function() {
  var ws = null;
  var mySeat = -1;
  var roomCode = '';
  var playerName = '';
  var isHost = false;
  var isMultiplayer = false;
  var lobbyState = null;
  var onLobbyUpdate = null;
  var onGameStart = null;
  var onAction = null;
  var onError = null;
  var onDisconnect = null;
  var onChat = null;
  var onGameEnd = null;
  var onPlayerReplaced = null;
  var onRoomList = null;
  var reconnectTimer = null;
  var serverUrl = '';
  var _joinCallback = null;
  var _connectCallback = null;

  function getWsUrl() {
    var loc = window.location;
    var proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return proto + '//' + loc.host + '/mahjong-ws';
  }

  function connect(name, callback) {
    playerName = name || '玩家';
    // 已連線就直接回傳
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (callback) callback(null);
      return;
    }
    serverUrl = getWsUrl();
    _connectCallback = callback;

    try {
      ws = new WebSocket(serverUrl);
    } catch (e) {
      if (callback) callback('連線失敗: ' + e.message);
      return;
    }

    ws.onopen = function() {
      console.log('[Net] Connected to', serverUrl);
      if (_connectCallback) { var cb = _connectCallback; _connectCallback = null; cb(null); }
    };

    ws.onmessage = function(evt) {
      try {
        var msg = JSON.parse(evt.data);
        handleMessage(msg);
      } catch (e) {
        console.error('[Net] Bad message:', e);
      }
    };

    ws.onclose = function() {
      console.log('[Net] Disconnected');
      ws = null;
      if (onDisconnect) onDisconnect();
    };

    ws.onerror = function(err) {
      console.error('[Net] WebSocket error:', err);
      if (_connectCallback) { var cb = _connectCallback; _connectCallback = null; cb('連線錯誤'); }
    };
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'created':
        mySeat = msg.seat;
        roomCode = msg.code;
        isHost = true;
        isMultiplayer = true;
        lobbyState = msg.lobby;
        if (onLobbyUpdate) onLobbyUpdate(lobbyState);
        break;

      case 'joined':
        mySeat = msg.seat;
        roomCode = msg.code;
        isMultiplayer = true;
        lobbyState = msg.lobby;
        if (_joinCallback) { var jcb = _joinCallback; _joinCallback = null; jcb(null); }
        if (onLobbyUpdate) onLobbyUpdate(lobbyState);
        break;

      case 'lobby':
        lobbyState = msg.data;
        if (onLobbyUpdate) onLobbyUpdate(lobbyState);
        break;

      case 'gameStart':
        console.log('[Net] gameStart received:', JSON.stringify(msg));
        if (onGameStart) onGameStart(msg);
        else console.warn('[Net] gameStart received but no onGameStart handler!');
        break;

      case 'action':
        if (onAction) onAction(msg);
        break;

      case 'roomList':
        if (onRoomList) onRoomList(msg.rooms || []);
        break;

      case 'chat':
        if (onChat) onChat(msg.data);
        break;

      case 'gameEnd':
        if (onGameEnd) onGameEnd(msg);
        break;

      case 'playerReplaced':
        if (onPlayerReplaced) onPlayerReplaced(msg);
        break;

      case 'gameAborted':
        if (onGameEnd) onGameEnd({ aborted: true, reason: msg.reason });
        break;

      case 'error':
        console.warn('[Net] Server error:', msg.message);
        if (_joinCallback) { var jcb = _joinCallback; _joinCallback = null; jcb(msg.message); return; }
        if (onError) onError(msg.message);
        break;
    }
  }

  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function requestRoomList() {
    send({ type: 'listRooms' });
  }

  function listRooms(name, cb) {
    connect(name || '玩家', function(err) {
      if (err) { if (cb) cb(err); return; }
      send({ type: 'listRooms' });
      if (cb) cb(null);
    });
  }

  function joinRoom(code, name, cb) {
    _joinCallback = cb;
    connect(name, function(err) {
      if (err) { _joinCallback = null; if (cb) cb(err); return; }
      send({ type: 'join', code: code, name: name });
      setTimeout(function() {
        if (_joinCallback) { var jcb = _joinCallback; _joinCallback = null; jcb('連線逾時，請重試'); }
      }, 5000);
    });
  }

  function createRoom(name, cb) {
    connect(name, function(err) {
      if (err) { if (cb) cb(err); return; }
      send({ type: 'create', name: name });
      if (cb) cb(null);
    });
  }

  function toggleReady() {
    console.log('[Net] toggleReady called, ws=' + (ws ? 'connected' : 'null') + ', readyState=' + (ws ? ws.readyState : 'N/A'));
    send({ type: 'ready' });
  }

  function sendChat(message) {
    send({ type: 'chat', message: message });
  }

  function sendGameEnd() {
    send({ type: 'gameEnd' });
  }

  function sendAction(data) {
    send({ type: 'action', data: data });
  }

  function leaveRoom() {
    send({ type: 'leave' });
    isMultiplayer = false;
    roomCode = '';
    mySeat = -1;
  }

  function disconnect() {
    if (ws) { ws.close(); ws = null; }
  }

  return {
    connect: connect,
    createRoom: createRoom,
    listRooms: listRooms,
    requestRoomList: requestRoomList,
    joinRoom: joinRoom,
    toggleReady: toggleReady,
    sendChat: sendChat,
    sendGameEnd: sendGameEnd,
    sendAction: sendAction,
    leaveRoom: leaveRoom,
    disconnect: disconnect,

    get mySeat() { return mySeat; },
    get roomCode() { return roomCode; },
    get isHost() { return isHost; },
    get isMultiplayer() { return isMultiplayer; },
    get lobbyState() { return lobbyState; },
    get playerName() { return playerName; },

    set onLobbyUpdate(fn) { onLobbyUpdate = fn; },
    set onGameStart(fn) { onGameStart = fn; },
    set onAction(fn) { onAction = fn; },
    set onError(fn) { onError = fn; },
    set onRoomList(fn) { onRoomList = fn; },
    set onChat(fn) { onChat = fn; },
    set onGameEnd(fn) { onGameEnd = fn; },
    set onPlayerReplaced(fn) { onPlayerReplaced = fn; },
    set onDisconnect(fn) { onDisconnect = fn; }
  };
})();
