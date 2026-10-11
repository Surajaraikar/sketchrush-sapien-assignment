const http = require('node:http');
const crypto = require('node:crypto');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const rooms = new Map();
const DEFAULT_WORDS = ['rocket', 'pencil', 'robot', 'mountain', 'rainbow', 'guitar', 'octopus', 'castle', 'telescope', 'bicycle', 'pizza', 'volcano'];
const MAX_OPS = 6000;
const id = () => crypto.randomBytes(16).toString('hex');
const code = () => crypto.randomBytes(3).toString('hex').toUpperCase();
const clean = (value, max) => String(value ?? '').trim().slice(0, max);
const safe = (fn) => (...args) => { try { fn(...args); } catch (error) { console.error('Game event failed:', error); } };
const ackError = (ack, message) => typeof ack === 'function' && ack({ ok: false, error: message });
const ackOk = (ack, data = {}) => typeof ack === 'function' && ack({ ok: true, ...data });
const publicPlayer = (p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score, connected: p.connected, guessed: p.guessed });
const mask = (word, revealed) => [...word].map((c, i) => c === ' ' || revealed.has(i) ? c : '_').join(' ');
const near = (a, b) => { if (Math.abs(a.length - b.length) > 1) return false; let n = 0; for (let i = 0; i < Math.max(a.length,b.length); i++) if (a[i] !== b[i]) n++; return n <= 2; };

app.prepare().then(() => {
  const server = http.createServer((req, res) => app.getRequestHandler()(req, res));
  const io = new Server(server, { maxHttpBufferSize: 20000 });
  function view(room) {
    return { code: room.code, version: room.version, phase: room.phase, hostId: room.hostId, players: [...room.players.values()].map(publicPlayer), rounds: room.rounds, duration: room.duration, round: room.round, turn: room.turn, drawerId: room.drawerId, deadline: room.deadline, maskedWord: room.word ? mask(room.word, room.revealed) : '', ops: room.ops, replay: room.phase === 'results' ? room.replay : undefined, messages: room.messages.slice(-80) };
  }
  function publish(room) { room.version++; io.to(room.code).emit('room:state', view(room)); }
  function announce(room, text) { const message = { id: id(), type: 'system', text, at: Date.now() }; room.messages.push(message); io.to(room.code).emit('chat:message', message); }
  function stop(room) { clearTimeout(room.timer); clearInterval(room.hints); room.timer = null; room.hints = null; }
  function endTurn(room) {
    if (room.phase !== 'drawing' && room.phase !== 'selecting') return;
    stop(room); const word = room.word; room.word = null; room.choices = [];
    announce(room, `Turn over${word ? ` — ${word}` : ''}.`);
    room.turn++; room.drawerId = null; room.phase = 'intermission'; publish(room);
    room.timer = setTimeout(() => nextTurn(room), 3500);
  }
  function nextTurn(room) {
    stop(room);
    const players = [...room.players.values()].filter(p => p.connected);
    if (players.length < 2) { room.phase = 'lobby'; room.word = null; room.drawerId = null; publish(room); return; }
    if (room.turn >= players.length * room.rounds) { room.phase = 'results'; room.word = null; room.drawerId = null; publish(room); return; }
    const drawer = players[room.turn % players.length];
    room.round = Math.floor(room.turn / players.length) + 1;
    room.drawerId = drawer.id; room.phase = 'selecting'; room.word = null; room.ops = []; room.revealed = new Set();
    for (const p of players) p.guessed = false;
    room.choices = [...room.words].sort(() => Math.random() - .5).slice(0, 3);
    publish(room); io.to(drawer.socketId).emit('word:choices', room.choices);
    room.timer = setTimeout(() => { if (room.phase === 'selecting') selectWord(room, drawer.id, room.choices[0]); }, 15000);
  }
  function selectWord(room, playerId, word) {
    if (room.phase !== 'selecting' || room.drawerId !== playerId || !room.choices.includes(word)) return false;
    stop(room); room.word = word; room.phase = 'drawing'; room.deadline = Date.now() + room.duration * 1000;
    room.replay.push({ drawer: room.players.get(playerId)?.name, word, ops: room.ops });
    publish(room); io.to(room.players.get(playerId).socketId).emit('word:selected', word);
    room.timer = setTimeout(() => endTurn(room), room.duration * 1000);
    room.hints = setInterval(() => {
      if (room.phase !== 'drawing') return;
      const hidden = [...word].map((c, i) => c !== ' ' && !room.revealed.has(i) ? i : -1).filter(i => i >= 0);
      if (hidden.length > 2) { room.revealed.add(hidden[Math.floor(Math.random() * hidden.length)]); publish(room); }
    }, Math.max(5000, Math.floor(room.duration * 1000 / 4)));
    return true;
  }
  function member(socket) { const room = rooms.get(socket.data.room); const player = room?.players.get(socket.data.player); return room && player ? { room, player } : null; }
  io.on('connection', socket => {
    socket.on('room:create', safe((input, ack) => {
      const name = clean(input?.name, 24), avatar = clean(input?.avatar, 4) || '✏️';
      if (name.length < 2) return ackError(ack, 'Enter a nickname with at least 2 characters.');
      const rounds = Number(input?.rounds), duration = Number(input?.duration);
      if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10 || ![30, 60, 90, 120].includes(duration)) return ackError(ack, 'Choose valid room settings.');
      const custom = clean(input?.words, 2000).split(',').map(x => x.trim().toLowerCase()).filter(x => /^[a-z ]{3,24}$/.test(x));
      if (input?.words && new Set(custom).size < 3) return ackError(ack, 'Add at least 3 distinct comma-separated words.');
      let roomCode; do roomCode = code(); while (rooms.has(roomCode));
      const playerId = id(), token = id();
      const player = { id: playerId, token, name, avatar, score: 0, connected: true, guessed: false, socketId: socket.id };
      const room = { code: roomCode, players: new Map([[playerId, player]]), hostId: playerId, rounds, duration, words: custom.length ? [...new Set(custom)] : DEFAULT_WORDS, phase: 'lobby', version: 0, round: 0, turn: 0, drawerId: null, deadline: null, word: null, choices: [], revealed: new Set(), ops: [], replay: [], messages: [], timer: null, hints: null };
      rooms.set(roomCode, room); socket.join(roomCode); socket.data.room = roomCode; socket.data.player = playerId;
      ackOk(ack, { code: roomCode, playerId, token, state: view(room) }); publish(room);
    }));
    socket.on('room:join', safe((input, ack) => {
      const room = rooms.get(clean(input?.code, 8).toUpperCase());
      if (!room) return ackError(ack, 'Room not found or server restarted.');
      const token = clean(input?.token, 64);
      let player = token ? [...room.players.values()].find(p => p.token === token) : null;
      if (!player) {
        const name = clean(input?.name, 24);
        if (name.length < 2) return ackError(ack, 'Enter a nickname with at least 2 characters.');
        player = { id: id(), token: id(), name, avatar: clean(input?.avatar, 4) || '✏️', score: 0, connected: true, guessed: false, socketId: socket.id };
        room.players.set(player.id, player); announce(room, `${name} joined.`);
      } else { if (player.socketId && player.socketId !== socket.id) io.sockets.sockets.get(player.socketId)?.disconnect(true); player.connected = true; player.socketId = socket.id; }
      clearTimeout(player.expiry); socket.join(room.code); socket.data.room = room.code; socket.data.player = player.id;
      if (!room.players.get(room.hostId)?.connected) { room.hostId = player.id; announce(room, `${player.name} is now host.`); }
      ackOk(ack, { code: room.code, playerId: player.id, token: player.token, state: view(room) }); publish(room);
      if (room.phase === 'selecting' && room.drawerId === player.id) socket.emit('word:choices', room.choices);
      if (room.phase === 'drawing' && room.drawerId === player.id) socket.emit('word:selected', room.word);
    }));
    socket.on('room:start', safe((ack) => { const m = member(socket); if (!m || m.room.hostId !== m.player.id || m.room.phase !== 'lobby') return ackError(ack, 'Only the host can start from the lobby.'); if ([...m.room.players.values()].filter(p => p.connected).length < 2) return ackError(ack, 'At least 2 players are required.'); m.room.turn = 0; m.room.replay = []; for (const p of m.room.players.values()) p.score = 0; ackOk(ack); nextTurn(m.room); }));
    socket.on('word:select', safe((word, ack) => { const m = member(socket); if (!m || !selectWord(m.room, m.player.id, word)) return ackError(ack, 'Word selection expired.'); ackOk(ack); }));
    socket.on('chat:send', safe((raw, ack) => {
      const m = member(socket); if (!m) return ackError(ack, 'Join a room first.');
      const text = clean(raw, 240); if (!text) return ackError(ack, 'Message is empty.');
      if (Date.now() - (m.player.lastChat || 0) < 700) return ackError(ack, 'Slow down a moment.'); m.player.lastChat = Date.now();
      if (m.room.phase === 'drawing' && m.player.id === m.room.drawerId) return ackError(ack, 'The drawer cannot chat during a turn.');
      if (m.room.phase === 'drawing' && m.player.guessed) return ackError(ack, 'You have already guessed this turn.');
      if (m.room.phase === 'drawing' && text.toLowerCase() === m.room.word?.toLowerCase()) {
        m.player.guessed = true; const remaining = Math.max(0, m.room.deadline - Date.now()); m.player.score += 100 + Math.floor(remaining / m.room.duration / 10);
        socket.emit('guess:correct', { points: m.player.score }); announce(m.room, `${m.player.name} guessed correctly!`); publish(m.room);
        if ([...m.room.players.values()].filter(p => p.connected && p.id !== m.room.drawerId).every(p => p.guessed)) endTurn(m.room);
      } else if (m.room.phase === 'drawing' && near(text.toLowerCase(), m.room.word?.toLowerCase() || '')) socket.emit('guess:close');
      else { const message = { id: id(), type: 'player', playerId: m.player.id, name: m.player.name, text, at: Date.now() }; m.room.messages.push(message); io.to(m.room.code).emit('chat:message', message); }
      ackOk(ack);
    }));
    socket.on('canvas:op', safe((op, ack) => {
      const m = member(socket); if (!m || m.room.phase !== 'drawing' || m.room.drawerId !== m.player.id) return ackError(ack, 'You cannot draw now.');
      if (Date.now() - (m.player.lastOp || 0) < 12) return ackError(ack, 'Drawing too fast.'); m.player.lastOp = Date.now();
      if (!op || !['stroke','fill','clear','undo'].includes(op.type) || JSON.stringify(op).length > 4000 || m.room.ops.length >= MAX_OPS) return ackError(ack, 'Invalid drawing operation.');
      if (op.type === 'fill' && !/^#[0-9a-fA-F]{6}$/.test(op.color)) return ackError(ack, 'Invalid fill color.');
      if (op.type === 'stroke' && (!Array.isArray(op.points) || op.points.length < 1 || op.points.length > 80 || op.points.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n) || n < 0 || n > 1)) || !/^#[0-9a-fA-F]{6}$/.test(op.color) || !Number.isFinite(op.size) || op.size < 1 || op.size > 50)) return ackError(ack, 'Invalid stroke.');
      const item = { ...op, seq: m.room.ops.length + 1 }; m.room.ops.push(item); socket.to(m.room.code).emit('canvas:op', item); ackOk(ack, { seq: item.seq });
    }));
    socket.on('room:sync', safe((ack) => { const m = member(socket); if (m) ackOk(ack, { state: view(m.room) }); else ackError(ack, 'Session expired.'); }));
    socket.on('disconnect', safe(() => {
      const m = member(socket); if (!m || m.player.socketId !== socket.id) return;
      m.player.connected = false; announce(m.room, `${m.player.name} disconnected.`);
      if (m.room.drawerId === m.player.id) endTurn(m.room);
      if (m.room.hostId === m.player.id) { const host = [...m.room.players.values()].find(p => p.connected); if (host) { m.room.hostId = host.id; announce(m.room, `${host.name} is now host.`); } }
      publish(m.room);
      m.player.expiry = setTimeout(() => { if (!m.player.connected) { m.room.players.delete(m.player.id); if (m.room.players.size === 0) { stop(m.room); rooms.delete(m.room.code); } else { if (m.room.hostId === m.player.id) { const host = [...m.room.players.values()].find(p => p.connected); if (host) m.room.hostId = host.id; } publish(m.room); } } }, 30000);
    }));
  });
  server.listen(Number(process.env.PORT) || 3000, () => console.log(`SketchRush on http://localhost:${process.env.PORT || 3000}`));
});
