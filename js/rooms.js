// =============================================
// SALAS DE COMMANDER — Tiempo real sin torneo
// Anfitrión crea sala con código · Jugadores se unen
// =============================================

let roomState = {
  room: null,
  mySlot: null,
  channel: null
};

// ── ABRIR PANTALLA DE SALAS ───────────────────────────────
function openRoomsScreen() {
  AudioFX.tap();
  document.getElementById('game-title').textContent = '🧙 Commander en vivo';
  document.getElementById('game-player-name').textContent = '';
  showScreen('screen-game');

  const content = document.getElementById('game-content');
  content.style.padding = '16px';
  content.innerHTML = `
    <div style="max-width:420px;margin:0 auto">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:40px;margin-bottom:8px">🧙</div>
        <h2 style="font-size:18px;font-weight:700">Commander en vivo</h2>
        <p style="font-size:13px;color:var(--muted);margin-top:4px">Juega con amigos en tiempo real · 2–6 jugadores</p>
      </div>

      <!-- Crear sala -->
      <div class="section" style="margin-bottom:12px">
        <div class="section-head"><span class="section-title">🏠 Crear sala</span></div>
        <div class="section-body">
          <label class="label">Tu nombre en la sala</label>
          <input class="input" id="room-host-name" type="text"
            placeholder="Nombre o alias"
            value="${escHtml(currentUser?.user_metadata?.display_name || '')}">
          <label class="label">Puntos de vida iniciales</label>
          <select class="input" id="room-start-life">
            <option value="40" selected>40 — Commander estándar</option>
            <option value="30">30 — Partida rápida</option>
            <option value="20">20 — Partida express</option>
          </select>
          <button class="btn btn-primary w-full" onclick="createRoom()">
            🏠 Crear sala y obtener código
          </button>
        </div>
      </div>

      <!-- Unirse a sala -->
      <div class="section">
        <div class="section-head"><span class="section-title">🔑 Unirse a sala</span></div>
        <div class="section-body">
          <label class="label">Tu nombre</label>
          <input class="input" id="room-join-name" type="text"
            placeholder="Nombre o alias"
            value="${escHtml(currentUser?.user_metadata?.display_name || '')}">
          <label class="label">Código de sala (6 letras)</label>
          <input class="input" id="room-code-input" type="text"
            placeholder="XXXXXX" maxlength="6"
            style="text-transform:uppercase;letter-spacing:4px;font-size:20px;font-weight:700;text-align:center"
            oninput="this.value=this.value.toUpperCase().replace(/[^A-Z0-9]/g,'')">
          <button class="btn btn-cream w-full" onclick="joinRoom()">
            🔑 Unirme a la sala
          </button>
        </div>
      </div>
    </div>
  `;
}

// ── LIMPIAR SALAS VIEJAS ─────────────────────────────────
async function cleanOldRooms() {
  const cutoff = new Date(Date.now() - 90 * 60 * 1000).toISOString();
  await _supabase.from('commander_rooms')
    .delete()
    .or(`created_at.lt.${cutoff},status.eq.finished`);
}

// ── CREAR SALA ────────────────────────────────────────────
async function createRoom() {
  const hostName = document.getElementById('room-host-name').value.trim();
  if (!hostName) { showToast('Pon tu nombre'); return; }
  const startLife = parseInt(document.getElementById('room-start-life').value) || 40;

  // Limpiar salas viejas antes de crear
  await cleanOldRooms();

  // Generar código único de 6 chars
  const code = generateRoomCode();

  const mySlot = {
    id: currentUser?.id || ('guest_' + Date.now()),
    name: hostName,
    life: startLife,
    commanderDmg: {},
    isHost: true,
    color: PLAYER_COLORS[0]
  };

  const roomData = {
    code,
    host_id: mySlot.id,
    start_life: startLife,
    status: 'waiting',
    slots: JSON.stringify([mySlot]),
    created_at: new Date().toISOString()
  };

  const { data, error } = await _supabase.from('commander_rooms').insert(roomData).select().single();
  if (error) { showToast('Error creando sala: ' + error.message); return; }

  roomState.room = data;
  roomState.mySlot = mySlot;
  AudioFX.roundStart();
  showRoomLobby(data, mySlot);
}

// ── UNIRSE A SALA ─────────────────────────────────────────
async function joinRoom() {
  const name = document.getElementById('room-join-name').value.trim();
  const code = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!name) { showToast('Pon tu nombre'); return; }
  if (code.length !== 6) { showToast('El código tiene 6 caracteres'); return; }

  const { data: room, error } = await _supabase.from('commander_rooms')
    .select('*').eq('code', code).eq('status', 'waiting').maybeSingle();

  if (error || !room) { showToast('Sala no encontrada o ya inició'); return; }

  const slots = JSON.parse(room.slots || '[]');
  if (slots.length >= 6) { showToast('Sala llena (máximo 6)'); return; }

  const mySlot = {
    id: currentUser?.id || ('guest_' + Date.now()),
    name,
    life: room.start_life,
    commanderDmg: {},
    isHost: false,
    color: PLAYER_COLORS[slots.length % PLAYER_COLORS.length]
  };

  slots.push(mySlot);
  const { error: updErr } = await _supabase.from('commander_rooms')
    .update({ slots: JSON.stringify(slots) }).eq('id', room.id);

  if (updErr) { showToast('Error uniéndose: ' + updErr.message); return; }

  roomState.room = { ...room, slots: JSON.stringify(slots) };
  roomState.mySlot = mySlot;
  AudioFX.tap();
  showRoomLobby(roomState.room, mySlot);
}

// ── LOBBY (sala de espera) ────────────────────────────────
function showRoomLobby(room, mySlot) {
  const slots = JSON.parse(room.slots || '[]');
  const isHost = mySlot.isHost;
  const content = document.getElementById('game-content');
  content.innerHTML = `
    <div style="max-width:420px;margin:0 auto">
      <!-- Código de sala -->
      <div style="text-align:center;padding:20px;background:var(--dark2);
        border:2px solid var(--magic);border-radius:var(--radius-lg);margin-bottom:16px">
        <p style="font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Código de sala</p>
        <div style="font-size:42px;font-weight:900;color:var(--magic);letter-spacing:8px;margin:6px 0">
          ${room.code}
        </div>
        <p style="font-size:12px;color:var(--muted)">Comparte este código con tus amigos</p>
        <button class="btn btn-sm" style="margin-top:8px" onclick="copyRoomCode('${room.code}')">
          📋 Copiar código
        </button>
      </div>

      <!-- Jugadores -->
      <div class="section" style="margin-bottom:12px">
        <div class="section-head">
          <span class="section-title">👥 Jugadores (${slots.length}/6)</span>
          <span style="font-size:12px;color:var(--muted)">${room.start_life} PV</span>
        </div>
        <div class="section-body" id="lobby-slots">
          ${renderLobbySlots(slots, mySlot.id)}
        </div>
      </div>

      <div style="display:flex;gap:8px">
        ${isHost ? `
          <button class="btn btn-primary" style="flex:1" onclick="startRoom()" id="btn-start-room"
            ${slots.length < 2 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
            ▶ Iniciar partida
          </button>` : `
          <div style="flex:1;padding:10px;text-align:center;background:var(--dark3);
            border-radius:var(--radius);color:var(--muted);font-size:13px">
            Esperando al anfitrión...
          </div>`}
        <button class="btn btn-danger btn-sm" onclick="leaveRoom()">Salir</button>
      </div>
    </div>
  `;

  subscribeRoomChannel(room.id);
}

function renderLobbySlots(slots, myId) {
  const colors = slots.map(s => s.color || PLAYER_COLORS[0]);
  return slots.map((s, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;
      border-bottom:1px solid var(--border)">
      <div style="width:10px;height:10px;border-radius:50%;background:${s.color||'var(--magic)'};flex-shrink:0"></div>
      <div style="flex:1;font-size:13px;font-weight:${s.id===myId?'700':'400'}">
        ${escHtml(s.name)} ${s.isHost ? '<span style="color:var(--muted);font-size:11px">(anfitrión)</span>' : ''}
        ${s.id===myId ? '<span style="color:var(--pink);font-size:11px"> (tú)</span>' : ''}
      </div>
      <span style="font-size:11px;color:var(--muted)">${s.life} PV</span>
    </div>`).join('') +
  (slots.length < 6 ? `
    <div style="padding:8px 0;color:var(--muted2);font-size:12px;font-style:italic">
      ${6 - slots.length} lugar(es) disponibles
    </div>` : '');
}

// ── INICIAR PARTIDA (solo anfitrión) ─────────────────────
async function startRoom() {
  const { error } = await _supabase.from('commander_rooms')
    .update({ status: 'playing' }).eq('id', roomState.room.id);
  if (error) { showToast('Error: ' + error.message); return; }
  AudioFX.roundStart();
}

// ── VISTA DE PARTIDA ──────────────────────────────────────
function showRoomGame(room) {
  const slots = JSON.parse(room.slots || '[]');
  const myId = roomState.mySlot.id;
  const mySlot = slots.find(s => s.id === myId) || roomState.mySlot;
  roomState.mySlot = mySlot;

  const content = document.getElementById('game-content');
  content.style.padding = '8px 12px';

  content.innerHTML = `
    <div class="game-tabs" style="margin-bottom:8px">
      <button class="game-tab active" onclick="showRoomTab('life')">❤️ Vida</button>
      <button class="game-tab" onclick="showRoomTab('cmdr')">⚔️ Comandante</button>
      <button class="game-tab" onclick="showRoomTab('spin')">🎲 Dados</button>
    </div>
    <div id="room-tab-body" style="height:calc(100vh - 160px);overflow-y:auto"></div>
  `;

  roomState.activeTab = 'life';
  showRoomTab('life');
}

function showRoomTab(tab) {
  AudioFX.tap();
  roomState.activeTab = tab; // guardar pestaña activa
  document.querySelectorAll('.game-tab').forEach(b => {
    b.classList.toggle('active',
      (tab==='life'&&b.textContent.includes('❤️'))||
      (tab==='cmdr'&&b.textContent.includes('⚔️'))||
      (tab==='spin'&&b.textContent.includes('🎲'))
    );
  });
  const el = document.getElementById('room-tab-body');
  if (!el) return;
  if (tab === 'life') renderRoomLifeTab(el);
  else if (tab === 'cmdr') renderRoomCmdrTab(el);
  else if (tab === 'spin') {
    // Reusar spinner libre con los jugadores de la sala
    gameState.freePlayers = JSON.parse(roomState.room?.slots||'[]').map(s=>({id:s.id,name:s.name}));
    renderSpinContent(el);
  }
}

// Vida: mi vida grande con controles, los demás pequeños (solo ver)
function renderRoomLifeTab(el) {
  const slots = JSON.parse(roomState.room?.slots || '[]');
  const myId = roomState.mySlot?.id;
  const mySlot = slots.find(s => s.id === myId);
  const others = slots.filter(s => s.id !== myId);

  if (!mySlot) { el.innerHTML = '<div class="empty-state">Reconectando...</div>'; return; }

  el.innerHTML = `
    <!-- MI VIDA — grande con controles -->
    <div class="life-counter glow-pink" style="margin-bottom:10px;padding:14px">
      <div class="life-player" style="color:${mySlot.color||'var(--magic)'}">
        ${escHtml(mySlot.name)} (tú)
      </div>
      <div class="life-num ${mySlot.life<=5?'critical':mySlot.life<=10?'danger':''}"
        id="room-life-${myId}" style="font-size:68px">${mySlot.life}</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px">
        <button class="life-btn minus" style="height:44px;border-radius:8px" onclick="changeRoomLife(-5)">−5</button>
        <button class="life-btn minus" style="height:44px;border-radius:8px" onclick="changeRoomLife(-1)">−1</button>
        <button class="life-btn plus"  style="height:44px;border-radius:8px" onclick="changeRoomLife(+1)">+1</button>
        <button class="life-btn plus"  style="height:44px;border-radius:8px" onclick="changeRoomLife(+5)">+5</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:6px">
        <input class="life-in" id="room-custom-life" type="number" placeholder="±" style="flex:1">
        <button class="btn btn-sm" onclick="applyRoomCustomLife()">OK</button>
        <button class="btn btn-sm btn-ghost" onclick="resetRoomMyLife()">↺</button>
      </div>
    </div>

    <!-- OTROS JUGADORES — compactos, solo lectura -->
    <div style="display:grid;grid-template-columns:repeat(${Math.min(others.length,3)},1fr);gap:8px">
      ${others.map(s => `
        <div class="life-counter" style="padding:10px;opacity:${s.life<=0?'0.5':'1'}">
          <div style="font-size:11px;font-weight:700;color:${s.color||'var(--muted)'};
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px">
            ${escHtml(s.name)}
          </div>
          <div class="life-num ${s.life<=5?'critical':s.life<=10?'danger':''}"
            id="room-life-${s.id}" style="font-size:36px">${s.life}</div>
          ${s.life <= 0 ? '<div style="font-size:11px;color:var(--red)">💀 Eliminado</div>' : ''}
        </div>`).join('')}
    </div>
  `;
}

async function changeRoomLife(delta) {
  const slots = JSON.parse(roomState.room?.slots || '[]');
  const myId = roomState.mySlot?.id;
  const idx = slots.findIndex(s => s.id === myId);
  if (idx < 0) return;

  slots[idx].life = Math.max(0, (slots[idx].life || 40) + delta);
  roomState.mySlot.life = slots[idx].life;
  const life = slots[idx].life;

  // Actualizar visual inmediato
  const el = document.getElementById('room-life-' + myId);
  if (el) {
    el.textContent = life;
    el.className = 'life-num ' + (life<=5?'critical':life<=10?'danger':'');
  }

  delta < 0 ? (life<=5 ? AudioFX.danger() : AudioFX.minus()) : AudioFX.plus();

  // Guardar en DB + broadcast
  await _supabase.from('commander_rooms')
    .update({ slots: JSON.stringify(slots) }).eq('id', roomState.room.id);
}

async function applyRoomCustomLife() {
  const val = parseInt(document.getElementById('room-custom-life')?.value);
  if (!isNaN(val)) { await changeRoomLife(val); document.getElementById('room-custom-life').value = ''; }
}

async function resetRoomMyLife() {
  AudioFX.tap();
  const startLife = roomState.room?.start_life || 40;
  const slots = JSON.parse(roomState.room?.slots || '[]');
  const myId = roomState.mySlot?.id;
  const idx = slots.findIndex(s => s.id === myId);
  if (idx < 0) return;
  slots[idx].life = startLife;
  roomState.mySlot.life = startLife;
  await _supabase.from('commander_rooms')
    .update({ slots: JSON.stringify(slots) }).eq('id', roomState.room.id);
}

// ── DAÑO DE COMANDANTE ────────────────────────────────────
function renderRoomCmdrTab(el) {
  const slots = JSON.parse(roomState.room?.slots || '[]');
  const myId = roomState.mySlot?.id;
  const opponents = slots.filter(s => s.id !== myId);

  // Leer daño desde room slots
  const mySlot = slots.find(s => s.id === myId);
  const dmgReceived = mySlot?.commanderDmg || {};

  el.innerHTML = `
    <p style="font-size:12px;color:var(--muted);margin-bottom:10px">
      Daño recibido de comandantes ajenos. A 21 = eliminado.
    </p>
    <div class="cmdr-damage-grid" style="margin-bottom:14px">
      ${opponents.map(opp => {
        const dmg = dmgReceived[opp.id] || 0;
        return `<div class="cmdr-dmg-row">
          <div class="cmdr-dmg-name" style="color:${opp.color||'var(--muted)'}">
            De ${escHtml(opp.name)}
          </div>
          <div class="cmdr-dmg-val ${dmg>=16?'danger':''}" id="room-rcvd-${opp.id}">${dmg}</div>
          <div class="cmdr-dmg-btns">
            <button class="dmg-btn minus" onclick="changeRoomCmdrDmg('${opp.id}',-1)">−</button>
            <button class="dmg-btn plus"  onclick="changeRoomCmdrDmg('${opp.id}',+1)">+</button>
            <button class="dmg-btn plus"  onclick="changeRoomCmdrDmg('${opp.id}',+2)">+2</button>
          </div>
          ${dmg>=21?'<span style="color:var(--red);font-size:11px;font-weight:700">💀 FATAL</span>':''}
        </div>`;
      }).join('')}
    </div>
    <hr>
    <p style="font-size:12px;color:var(--muted);margin:10px 0">Daño que hice yo con mi comandante:</p>
    <div class="cmdr-damage-grid">
      ${opponents.map(opp => {
        // Leer del slot del oponente (lo que yo le mandé)
        const oppSlot = slots.find(s => s.id === opp.id);
        const dmgSent = oppSlot?.commanderDmg?.[myId] || 0;
        return `<div class="cmdr-dmg-row">
          <div class="cmdr-dmg-name">A ${escHtml(opp.name)}</div>
          <div class="cmdr-dmg-val ${dmgSent>=16?'danger':''}">${dmgSent}</div>
          <div style="font-size:11px;color:var(--muted)">(el oponente lo registra)</div>
        </div>`;
      }).join('')}
    </div>
  `;
}

async function changeRoomCmdrDmg(oppId, delta) {
  const slots = JSON.parse(roomState.room?.slots || '[]');
  const myId = roomState.mySlot?.id;
  const idx = slots.findIndex(s => s.id === myId);
  if (idx < 0) return;

  if (!slots[idx].commanderDmg) slots[idx].commanderDmg = {};
  const prev = slots[idx].commanderDmg[oppId] || 0;
  const next = Math.max(0, prev + delta);
  slots[idx].commanderDmg[oppId] = next;

  const el = document.getElementById('room-rcvd-' + oppId);
  if (el) {
    el.textContent = next;
    el.className = 'cmdr-dmg-val' + (next>=16?' danger':'');
  }

  if (next >= 21) { AudioFX.danger(); showToast('💀 ¡Daño de comandante fatal!'); }
  else delta > 0 ? AudioFX.minus() : AudioFX.tap();

  await _supabase.from('commander_rooms')
    .update({ slots: JSON.stringify(slots) }).eq('id', roomState.room.id);
}

// ── REALTIME DE SALA ──────────────────────────────────────
function subscribeRoomChannel(roomId) {
  if (roomState.channel) { _supabase.removeChannel(roomState.channel); }

  roomState.channel = _supabase
    .channel(`room-${roomId}`)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public',
      table: 'commander_rooms', filter: `id=eq.${roomId}`
    }, (payload) => {
      if (!payload.new) return;
      const prevStatus = roomState.room?.status;
      roomState.room = payload.new;
      const slots = JSON.parse(payload.new.slots || '[]');

      // Transición waiting → playing: mostrar partida a todos
      if (payload.new.status === 'playing' && prevStatus === 'waiting') {
        showRoomGame(payload.new);
        return;
      }

      // En lobby: actualizar lista de jugadores
      if (payload.new.status === 'waiting') {
        const lobbyEl = document.getElementById('lobby-slots');
        if (lobbyEl) {
          lobbyEl.innerHTML = renderLobbySlots(slots, roomState.mySlot?.id);
          const btnStart = document.getElementById('btn-start-room');
          if (btnStart) {
            btnStart.disabled = slots.length < 2;
            btnStart.style.opacity = slots.length < 2 ? '0.5' : '1';
          }
        }
        return;
      }

      // En partida: actualizar solo los elementos del DOM, NUNCA re-renderizar
      if (payload.new.status === 'playing') {
        slots.forEach(s => {
          if (s.id === roomState.mySlot?.id) return; // la mía no se toca
          // Actualizar vida
          const lifeEl = document.getElementById('room-life-' + s.id);
          if (lifeEl) {
            lifeEl.textContent = s.life;
            lifeEl.className = 'life-num ' + (s.life<=5?'critical':s.life<=10?'danger':'');
          }
        });
        // Si estamos en la pestaña de comandante, actualizar los valores de daño
        if (roomState.activeTab === 'cmdr') {
          const tabEl = document.getElementById('room-tab-body');
          if (tabEl) renderRoomCmdrTab(tabEl);
        }
      }
    })
    .subscribe();
}

function leaveRoom() {
  AudioFX.tap();
  if (roomState.channel) { _supabase.removeChannel(roomState.channel); roomState.channel = null; }
  roomState = { room: null, mySlot: null, channel: null };
  showScreen('screen-dashboard');
}

function copyRoomCode(code) {
  navigator.clipboard.writeText(code).then(() => showToast('Código copiado: ' + code));
}

// ── HELPERS ───────────────────────────────────────────────
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:6}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

const PLAYER_COLORS = [
  'var(--magic)',     // púrpura
  'var(--std)',       // verde
  'var(--bey)',       // naranja
  'var(--pink-light)',// rosa
  'var(--cream)',     // crema
  '#60C0FF'          // azul
];
