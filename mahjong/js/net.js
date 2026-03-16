/**
 * net.js — 麻將多人連線客戶端
 * Handles WebSocket connection, room management, and game sync
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
  var reconnectTimer = null;
  var serverUrl = '';
  var _joinCallback = null; // deferred callback for joinRoom
  var onRoomList = null; // callback for room list

  function getWsUrl() {
    var loc = window.location;
    var proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    // Always use /mahjong-ws path — gateway routes it to the mahjong WSS
    return proto + '//' + loc.host + '/mahjong-ws';
  }

  function connect(name, callback) {
    playerName = name || '玩家';
    serverUrl = getWsUrl();

    try {
      ws = new WebSocket(serverUrl);
    } catch (e) {
      if (callback) callback('連線失敗: ' + e.message);
      return;
    }

    ws.onopen = function() {
      console.log('[Net] Connected to', serverUrl);
      if (callback) callback(null);
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
      if (onDisconnect) onDisconnect();
    };

    ws.onerror = function(err) {
      console.error('[Net] WebSocket error:', err);
      if (callback) { callback('連線錯誤'); callback = null; }
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
        isHost = false;
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
        if (onGameStart) onGameStart(msg);
        break;

      case 'action':
        if (onAction) onAction(msg);
        break;

      case 'roomList':
        if (onRoomList) onRoomList(msg.rooms || []);
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

  function createRoom(name, cb) {
    connect(name, function(err) {
      if (err) { if (cb) cb(err); return; }
      send({ type: 'create', name: name });
      if (cb) cb(null);
    });
  }

  function listRooms(name, cb) {
    // Connect first (if not already), then request room list
    if (ws && ws.readyState === WebSocket.OPEN) {
      send({ type: 'listRooms' });
      if (cb) cb(null);
    } else {
      connect(name || '玩家', function(err) {
        if (err) { if (cb) cb(err); return; }
        send({ type: 'listRooms' });
        if (cb) cb(null);
      });
    }
  }

  function joinRoom(code, name, cb) {
    _joinCallback = cb;
    connect(name, function(err) {
      if (err) { _joinCallback = null; if (cb) cb(err); return; }
      send({ type: 'join', code: code, name: name });
      // Timeout: if server doesn't respond in 5 seconds, fail
      setTimeout(function() {
        if (_joinCallback) { var jcb = _joinCallback; _joinCallback = null; jcb('連線逾時，請重試'); }
      }, 5000);
    });
  }

  function toggleReady() {
    send({ type: 'ready' });
  }

  function startGame() {
    send({ type: 'start' });
  }

  function sendAction(data) {
    send({ type: 'action', data: data });
  }

  function leaveRoom() {
    send({ type: 'leave' });
    isMultiplayer = false;
    roomCode = '';
    mySeat = -1;
    if (ws) { ws.close(); ws = null; }
  }

  function disconnect() {
    if (ws) { ws.close(); ws = null; }
  }

  return {
    connect: connect,
    createRoom: createRoom,
    listRooms: listRooms,
    joinRoom: joinRoom,
    toggleReady: toggleReady,
    startGame: startGame,
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
    set onDisconnect(fn) { onDisconnect = fn; }
  };
})();
