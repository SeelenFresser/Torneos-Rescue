// =============================================
// COMMANDER 1vs1 — Mejor de 1, 30 vidas
// Swiss o Eliminación directa (se elige al crear)
// Contador de vida en vivo + daño de comandante
// =============================================

const C1V1_START_LIFE = 30;
const C1V1_MATCH_TYPE = 'commander1v1';

// ── RENDER PRINCIPAL ───────────────────────────────────────
function renderCommander1v1View() {
  const t = currentTournament;
  const players = tournamentPlayers;
  const owner = isOwner();
  const isSwiss = t.format === 'swiss';
  const totalRounds = isSwiss ? calcTotalRounds(players.length) : Math.ceil(Math.log2(Math.max(players.length,2)));
  const roundsDone = t.current_round || 0;
  const roundsLeft = Math.max(0, totalRounds - roundsDone);

  document.getElementById('tournament-content').innerHTML = `
    <div class="stats-row">
      <div class="stat-box"><div class="stat-val" style="color:var(--magic)">${players.length}</div><div class="stat-lbl">Jugadores</div></div>
      <div class="stat-box"><div class="stat-val">${roundsDone}/${totalRounds}</div><div class="stat-lbl">${isSwiss?'Rondas':'Rondas'}</div></div>
      <div class="stat-box"><div class="stat-val">${C1V1_START_LIFE}</div><div class="stat-lbl">Vidas</div></div>
    </div>

    ${renderJoinButton()}
    ${renderTournamentControls ? renderTournamentControls() : ''}

    <div class="section">
      <div class="section-head">
        <span class="section-title">🧙 Jugadores (${players.length})</span>
        ${owner && t.status !== 'finished' ? `
          <div style="display:flex;gap:6px">
            ${roundsDone === 0 ? `<button class="btn btn-primary btn-sm" onclick="startCommander1v1()">▶ Iniciar torneo</button>` :
              roundsLeft > 0 ? `<button class="btn btn-sm" onclick="generateCommander1v1Round()">▶ Ronda ${roundsDone+1}</button>` :
              `<button class="btn btn-sm btn-cream" onclick="finalizarCommander1v1()">🏆 Ver campeón</button>`}
          </div>` : ''}
      </div>
      <div class="section-body">
        ${owner && t.status === 'upcoming' ? `
          <div class="add-row" style="margin-bottom:10px">
            <input class="input" id="c1v1-pname" type="text" placeholder="Agregar jugador manualmente" onkeydown="if(event.key==='Enter')addPlayer('c1v1-pname')">
            <button class="btn" onclick="addPlayer('c1v1-pname')">+</button>
          </div>` : ''}
        <div class="chips">
          ${players.map(p => `
            <div class="chip">
              ${p.user_id ? '👤' : '🤖'} ${escHtml(p.name)}
              ${owner && (t.status === 'upcoming' || t.status === 'active') ? `
                <button class="chip-edit" onclick="openEditPlayerNameModal('${p.id}','${escHtml(p.name).replace(/'/g,"\\'")}')" title="Editar nombre">✏️</button>
                <button class="chip-remove" onclick="removePlayer('${p.id}')" title="Eliminar jugador">×</button>` : ''}
            </div>`).join('')}
          ${players.length === 0 ? '<span style="color:var(--muted);font-size:13px">Sin jugadores aún</span>' : ''}
        </div>
      </div>
    </div>

    ${t.status !== 'upcoming' ? `<div id="c1v1-rounds"></div>` : ''}
    ${t.status !== 'upcoming' ? `<div id="c1v1-standings" style="margin-top:14px"></div>` : ''}
  `;

  if (t.status !== 'upcoming') {
    loadAndRenderC1v1Rounds();
    renderC1v1Standings();
  }
}

// ── INICIAR TORNEO ─────────────────────────────────────────
async function startCommander1v1() {
  if (tournamentPlayers.length < 2) { showToast('Necesitas al menos 2 jugadores'); return; }
  if (!confirm(`¿Iniciar torneo Commander 1v1 (${currentTournament.format === 'swiss' ? 'Swiss' : 'Eliminación'}) con ${tournamentPlayers.length} jugadores?`)) return;

  await _supabase.from('tournaments').update({ status: 'active' }).eq('id', currentTournament.id);
  currentTournament.status = 'active';

  await generateCommander1v1Round();
}

// ── GENERAR RONDA (Swiss o Eliminación) ────────────────────
async function generateCommander1v1Round() {
  if (window._generatingC1v1) { showToast('Generando...'); return; }
  window._generatingC1v1 = true;

  try {
    const t = currentTournament;
    const newRound = (t.current_round || 0) + 1;
    const players = tournamentPlayers;

    if (t.format === 'swiss') {
      await generateC1v1SwissRound(t, newRound, players);
    } else {
      await generateC1v1EliminationRound(t, newRound, players);
    }
  } finally {
    window._generatingC1v1 = false;
  }
}

async function generateC1v1SwissRound(t, newRound, players) {
  const totalRounds = calcTotalRounds(players.length);
  if (newRound > totalRounds) { showToast('Ya se jugaron todas las rondas'); return; }

  const { data: existing } = await _supabase
    .from('matches').select('id')
    .eq('tournament_id', t.id).eq('round', newRound).eq('match_type', C1V1_MATCH_TYPE);
  if (existing?.length) { showToast('Esta ronda ya fue generada'); return; }

  const { data: updated } = await _supabase
    .from('tournaments').update({ current_round: newRound })
    .eq('id', t.id).eq('current_round', newRound - 1).select('id');
  if (!updated?.length) { await loadPlayers(); renderCommander1v1View(); return; }
  currentTournament.current_round = newRound;

  // Historial de emparejamientos y BYEs previos
  const { data: prevMatches } = await _supabase
    .from('matches').select('player1_id, player2_id')
    .eq('tournament_id', t.id).eq('match_type', C1V1_MATCH_TYPE);

  const prevPairs = new Set();
  const hadBye = new Set();
  (prevMatches || []).forEach(m => {
    if (m.player1_id && m.player2_id) prevPairs.add([m.player1_id, m.player2_id].sort().join('|'));
    if (!m.player2_id) hadBye.add(m.player1_id);
  });

  // Motor Suizo v4 — backtracking con mínimos rematches (compartido con swiss.js)
  let activePairings, byePlayer;
  try {
    ({ pairings: activePairings, bye: byePlayer } = buildSwissPairingsV2(players, prevPairs, hadBye));
  } catch (e) {
    console.error('Swiss v4 validación falló (C1v1):', e.message);
    showToast('Error generando emparejamientos — intenta de nuevo');
    // Revertir el avance de ronda para no dejar el torneo en estado inconsistente
    await _supabase.from('tournaments').update({ current_round: newRound - 1 })
      .eq('id', t.id).eq('current_round', newRound);
    currentTournament.current_round = newRound - 1;
    return;
  }
  const pairings = [...activePairings];
  if (byePlayer) pairings.push({ p1: byePlayer, p2: null });

  const inserts = pairings.map((p, i) => ({
    tournament_id: t.id, round: newRound, match_number: i + 1,
    match_type: C1V1_MATCH_TYPE,
    player1_id: p.p1.id, player1_name: p.p1.name,
    player2_id: p.p2?.id || null, player2_name: p.p2?.name || 'BYE',
    is_complete: !p.p2, winner_id: !p.p2 ? p.p1.id : null,
    life_p1: C1V1_START_LIFE, life_p2: C1V1_START_LIFE,
    cmdr_dmg_p1: 0, cmdr_dmg_p2: 0
  }));

  await _supabase.from('matches').insert(inserts);

  for (const p of pairings) {
    if (!p.p2) {
      await _supabase.from('players').update({
        wins: (p.p1.wins || 0) + 1, points: (p.p1.points || 0) + 3
      }).eq('id', p.p1.id);
    }
  }

  AudioFX.roundStart();
  showToast(`⚔️ Ronda ${newRound} generada`);
  await loadPlayers();
  renderCommander1v1View();
}

async function generateC1v1EliminationRound(t, newRound, players) {
  let activePlayers;

  if (newRound === 1) {
    activePlayers = [...players].sort(() => Math.random() - 0.5);
  } else {
    const { data: prevRoundMatches } = await _supabase
      .from('matches').select('*')
      .eq('tournament_id', t.id).eq('round', newRound - 1).eq('match_type', C1V1_MATCH_TYPE);

    if (!prevRoundMatches?.every(m => m.is_complete)) {
      showToast('Completa todos los duelos de la ronda anterior primero'); return;
    }
    const winnerIds = prevRoundMatches.map(m => m.winner_id).filter(Boolean);
    activePlayers = winnerIds.map(id => players.find(p => p.id === id)).filter(Boolean);
  }

  if (activePlayers.length <= 1) {
    showToast('¡El torneo ya tiene un campeón!');
    await finalizarCommander1v1();
    return;
  }

  const { data: existing } = await _supabase
    .from('matches').select('id')
    .eq('tournament_id', t.id).eq('round', newRound).eq('match_type', C1V1_MATCH_TYPE);
  if (existing?.length) { showToast('Esta ronda ya fue generada'); return; }

  const { data: updated } = await _supabase
    .from('tournaments').update({ current_round: newRound })
    .eq('id', t.id).eq('current_round', newRound - 1).select('id');
  if (!updated?.length) { await loadPlayers(); renderCommander1v1View(); return; }
  currentTournament.current_round = newRound;

  const inserts = [];
  for (let i = 0; i < activePlayers.length; i += 2) {
    const p1 = activePlayers[i];
    const p2 = activePlayers[i + 1] || null;
    inserts.push({
      tournament_id: t.id, round: newRound, match_number: (i/2) + 1,
      match_type: C1V1_MATCH_TYPE,
      player1_id: p1.id, player1_name: p1.name,
      player2_id: p2?.id || null, player2_name: p2?.name || 'BYE',
      is_complete: !p2, winner_id: !p2 ? p1.id : null,
      life_p1: C1V1_START_LIFE, life_p2: C1V1_START_LIFE,
      cmdr_dmg_p1: 0, cmdr_dmg_p2: 0
    });
  }

  await _supabase.from('matches').insert(inserts);

  AudioFX.roundStart();
  showToast(`⚔️ Ronda ${newRound} generada (${activePlayers.length} jugadores)`);
  await loadPlayers();
  renderCommander1v1View();
}

// ── CARGAR Y RENDERIZAR RONDAS ──────────────────────────────
async function loadAndRenderC1v1Rounds() {
  const { data: matches } = await _supabase
    .from('matches').select('*')
    .eq('tournament_id', currentTournament.id).eq('match_type', C1V1_MATCH_TYPE)
    .order('round', { ascending: false }).order('match_number', { ascending: true });

  const el = document.getElementById('c1v1-rounds');
  if (!el) return;

  const owner = isOwner();
  const t = currentTournament;
  const rounds = {};
  (matches || []).forEach(m => { if (!rounds[m.round]) rounds[m.round] = []; rounds[m.round].push(m); });
  const roundKeys = Object.keys(rounds).map(Number).sort((a,b) => b-a);
  const isSwiss = t.format === 'swiss';
  const totalRounds = isSwiss ? calcTotalRounds(tournamentPlayers.length) : null;

  el.innerHTML = `
    ${owner && t.status === 'active' ? `
    <div style="margin-bottom:12px">
      ${roundKeys.length === 0 || rounds[Math.max(...roundKeys)].every(m => m.is_complete) ? `
      <button class="btn btn-primary w-full" onclick="generateCommander1v1Round()">
        ▶ ${roundKeys.length === 0 ? 'Generar Ronda 1' : `Generar Ronda ${Math.max(...roundKeys)+1}`}
      </button>` : ''}
      ${isSwiss && roundKeys.length === totalRounds && rounds[totalRounds]?.every(m => m.is_complete) ? `
      <button class="btn btn-danger w-full" style="margin-top:8px" onclick="finalizarCommander1v1()">
        🏆 Finalizar torneo
      </button>` : ''}
    </div>` : ''}

    ${roundKeys.map(rn => {
      const roundMatches = rounds[rn];
      const allDone = roundMatches.every(m => m.is_complete);
      return `<div class="section" style="margin-bottom:10px">
        <div class="section-head">
          <span class="section-title">⚔️ Ronda ${rn}</span>
          <span class="badge badge-magic">${allDone ? '✓ Completa' : 'En curso'}</span>
        </div>
        <div class="section-body">
          ${roundMatches.map(m => renderC1v1MatchCard(m, owner, t.status === 'active')).join('')}
        </div>
      </div>`;
    }).join('')}
  `;
}

function renderC1v1MatchCard(m, owner, active) {
  if (m.player2_id === null && m.player2_name === 'BYE') {
    return `<div class="match-card" style="margin-bottom:8px;opacity:0.7">
      <div class="match-player winner">${escHtml(m.player1_name)}</div>
      <span style="font-size:11px;color:var(--muted)">BYE Auto ✓</span>
    </div>`;
  }

  const w1 = m.is_complete && m.winner_id === m.player1_id ? 'winner' : '';
  const w2 = m.is_complete && m.winner_id === m.player2_id ? 'winner' : '';
  const s1Marker = m.winner_id === m.player1_id ? 1 : null;
  const s2Marker = m.winner_id === m.player2_id ? 1 : null;

  return `<div class="match-card" style="margin-bottom:8px;flex-wrap:wrap">
    <div class="match-player ${w1}">${escHtml(m.player1_name)}</div>
    <div class="match-vs">vs</div>
    <div class="match-player ${w2}">${escHtml(m.player2_name)}</div>
    <div class="match-actions" style="width:100%;margin-top:6px;display:flex;gap:6px;justify-content:flex-end;align-items:center">
      ${m.is_complete
        ? `<span class="pill pill-w">🏆 ${escHtml(m.winner_id === m.player1_id ? m.player1_name : m.player2_name)}</span>
           ${owner ? `<button class="btn btn-xs btn-ghost" onclick="openEditMatchModal('${m.id}','${m.player1_id}','${m.player2_id}','${escHtml(m.player1_name).replace(/'/g,"\\'")}','${escHtml(m.player2_name).replace(/'/g,"\\'")}',${s1Marker},${s2Marker},'commander1v1')">✏️</button>` : ''}`
        : owner && active
        ? `<button class="btn btn-sm btn-primary" onclick="openC1v1LifeTracker('${m.id}')">❤️ Abrir contador de vida</button>`
        : '<span style="color:var(--muted);font-size:12px">Pendiente</span>'}
    </div>
  </div>`;
}

// ── STANDINGS (Swiss) ────────────────────────────────────────
function renderC1v1Standings() {
  const el = document.getElementById('c1v1-standings');
  if (!el || currentTournament.format !== 'swiss') { if (el) el.innerHTML = ''; return; }

  const sorted = [...tournamentPlayers].sort((a,b) =>
    (b.points - a.points) || ((b.game_wins-b.game_losses)-(a.game_wins-a.game_losses)) || (b.wins-a.wins)
  );
  const posIcons = ['👑','🥈','🥉'];

  el.innerHTML = `
    <div class="section">
      <div class="section-head"><span class="section-title">🏆 Clasificación</span></div>
      <div class="section-body">
        <table class="t-table">
          <thead><tr><th>#</th><th>Jugador</th><th>V</th><th>D</th><th>Pts</th></tr></thead>
          <tbody>
            ${sorted.map((p,i) => `<tr style="${i===0?'background:rgba(245,208,96,0.08)':''}">
              <td>${posIcons[i]||i+1+'°'}</td>
              <td style="font-weight:${i===0?'700':'400'};color:${i===0?'var(--gold)':'var(--text)'}">${escHtml(p.name)}</td>
              <td style="color:var(--green)">${p.wins||0}</td>
              <td style="color:var(--red)">${p.losses||0}</td>
              <td style="font-weight:700;color:var(--magic)">${p.points||0}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── CONTADOR DE VIDA EN VIVO (30 PV + daño de cdr) ─────────
let c1v1TrackerMatch = null;
let c1v1RealtimeChannel = null;

async function openC1v1LifeTracker(matchId) {
  const { data: m } = await _supabase.from('matches').select('*').eq('id', matchId).single();
  if (!m) return;
  c1v1TrackerMatch = m;

  showScreen('screen-c1v1-tracker');
  renderC1v1LifeTracker();
  subscribeC1v1Tracker(matchId);
}

function renderC1v1LifeTracker() {
  const el = document.getElementById('c1v1-tracker-content');
  if (!el || !c1v1TrackerMatch) return;
  const m = c1v1TrackerMatch;
  const owner = isOwner();
  const myPlayerId = tournamentPlayers.find(p => p.user_id === currentUser?.id)?.id;
  const isParticipant = myPlayerId === m.player1_id || myPlayerId === m.player2_id;
  const canControl = owner || isParticipant; // admin o uno de los 2 jugadores de la mesa

  const c1 = LIFE_COLORS[0];
  const c2 = LIFE_COLORS[3];
  const life1 = m.life_p1 ?? C1V1_START_LIFE;
  const life2 = m.life_p2 ?? C1V1_START_LIFE;
  const dmg1 = m.cmdr_dmg_p1 ?? 0; // daño que p1 recibió del cdr de p2
  const dmg2 = m.cmdr_dmg_p2 ?? 0; // daño que p2 recibió del cdr de p1

  el.innerHTML = `
    <div style="text-align:center;margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:var(--magic)">⚔️ ${escHtml(m.player1_name)} vs ${escHtml(m.player2_name)}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">Mejor de 1 · ${C1V1_START_LIFE} vidas</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;height:calc(100vh - 280px)">
      ${[{name:m.player1_name, life:life1, dmg:dmg1, key:'p1', c:c1}, {name:m.player2_name, life:life2, dmg:dmg2, key:'p2', c:c2}].map(p => `
        <div style="background:${p.c.bg};border-radius:16px;padding:12px 8px;
          display:flex;flex-direction:column;align-items:center;justify-content:space-between;
          border:2px solid ${p.life<=10?'#FF4444':p.c.accent}44;position:relative;overflow:hidden">
          <div style="font-size:12px;font-weight:800;color:${p.c.accent};text-transform:uppercase;
            border-bottom:2px solid ${p.c.accent}40;width:90%;text-align:center;padding-bottom:3px">
            ${escHtml(p.name)}
          </div>
          ${canControl ? `<button onclick="changeC1v1Life('${p.key}',+1)"
            style="width:100%;padding:6px 0;background:${p.c.btnPlus}88;border:none;
            border-radius:10px;color:#fff;font-size:18px;font-weight:900;cursor:pointer">+</button>` : '<div style="height:32px"></div>'}
          <div style="font-size:${p.life>=10?'58px':'70px'};font-weight:900;color:#fff;line-height:1;
            text-shadow:0 2px 20px ${p.c.accent}80">${p.life}</div>
          ${canControl ? `<button onclick="changeC1v1Life('${p.key}',-1)"
            style="width:100%;padding:6px 0;background:${p.c.btnMinus}88;border:none;
            border-radius:10px;color:#fff;font-size:18px;font-weight:900;cursor:pointer">−</button>` : '<div></div>'}
          ${canControl ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;width:100%;margin-top:4px">
            <button onclick="changeC1v1Life('${p.key}',-5)" style="padding:5px 0;background:${p.c.btnMinus}66;
              border:none;border-radius:8px;color:${p.c.accent};font-size:11px;font-weight:700;cursor:pointer">−5</button>
            <button onclick="changeC1v1Life('${p.key}',+5)" style="padding:5px 0;background:${p.c.btnPlus}66;
              border:none;border-radius:8px;color:${p.c.accent};font-size:11px;font-weight:700;cursor:pointer">+5</button>
          </div>` : ''}

          <!-- Daño de comandante recibido -->
          <div style="margin-top:6px;background:rgba(0,0,0,0.3);border-radius:8px;padding:6px 8px;width:90%">
            <div style="font-size:9px;color:${p.c.accent}80;text-align:center;margin-bottom:2px">⚔️ Daño cdr recibido</div>
            <div style="font-size:18px;font-weight:900;color:${p.dmg>=21?'#FF4444':'#fff'};text-align:center">
              ${p.dmg} <span style="font-size:11px;opacity:0.6">/21</span>
            </div>
            ${canControl ? `<div style="display:flex;justify-content:center;gap:6px;margin-top:4px">
              <button onclick="changeC1v1CmdrDmg('${p.key}',-1)" style="padding:2px 8px;background:rgba(0,0,0,0.3);
                border:none;border-radius:5px;color:${p.c.accent};font-size:11px;cursor:pointer">−</button>
              <button onclick="changeC1v1CmdrDmg('${p.key}',+1)" style="padding:2px 8px;background:${p.c.btnPlus}88;
                border:none;border-radius:5px;color:#fff;font-size:11px;cursor:pointer">+</button>
              <button onclick="changeC1v1CmdrDmg('${p.key}',+2)" style="padding:2px 8px;background:${p.c.btnPlus};
                border:none;border-radius:5px;color:#fff;font-size:11px;cursor:pointer">+2</button>
            </div>` : ''}
          </div>

          ${p.life<=0 || p.dmg>=21 ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,0.6);
            display:flex;align-items:center;justify-content:center;border-radius:14px;font-size:28px">💀</div>` : ''}
        </div>`).join('')}
    </div>

    ${canControl ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
      <button class="btn btn-primary" onclick="reportC1v1Winner('p1')"
        style="background:${c1.bg};border-color:${c1.accent};color:${c1.accent}">
        ✓ Ganó ${escHtml(m.player1_name)}
      </button>
      <button class="btn btn-primary" onclick="reportC1v1Winner('p2')"
        style="background:${c2.bg};border-color:${c2.accent};color:${c2.accent}">
        ✓ Ganó ${escHtml(m.player2_name)}
      </button>
    </div>` : `
    <div style="text-align:center;margin-top:12px;font-size:12px;color:var(--muted)">
      👁 Solo los jugadores de esta mesa o el admin pueden modificar el contador
    </div>`}
  `;
}

async function changeC1v1Life(key, delta) {
  if (!c1v1TrackerMatch) return;
  const field = key === 'p1' ? 'life_p1' : 'life_p2';
  const current = c1v1TrackerMatch[field] ?? C1V1_START_LIFE;
  const next = Math.max(0, current + delta);
  c1v1TrackerMatch[field] = next;
  renderC1v1LifeTracker();
  delta < 0 ? (next<=10?AudioFX.danger():AudioFX.minus()) : AudioFX.plus();
  await _supabase.from('matches').update({ [field]: next }).eq('id', c1v1TrackerMatch.id);
}

async function changeC1v1CmdrDmg(key, delta) {
  if (!c1v1TrackerMatch) return;
  const field = key === 'p1' ? 'cmdr_dmg_p1' : 'cmdr_dmg_p2';
  const current = c1v1TrackerMatch[field] ?? 0;
  const next = Math.max(0, current + delta);
  c1v1TrackerMatch[field] = next;
  renderC1v1LifeTracker();
  if (next >= 21) { AudioFX.danger(); showToast('⚔️ ¡Daño de comandante fatal!'); }
  else delta > 0 ? AudioFX.minus() : AudioFX.tap();
  await _supabase.from('matches').update({ [field]: next }).eq('id', c1v1TrackerMatch.id);
}

function subscribeC1v1Tracker(matchId) {
  if (c1v1RealtimeChannel) _supabase.removeChannel(c1v1RealtimeChannel);
  c1v1RealtimeChannel = _supabase
    .channel(`c1v1-match-${matchId}`)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}`
    }, (payload) => {
      c1v1TrackerMatch = { ...c1v1TrackerMatch, ...payload.new };
      renderC1v1LifeTracker();
    })
    .subscribe();
}

function stopC1v1Tracker() {
  if (c1v1RealtimeChannel) { _supabase.removeChannel(c1v1RealtimeChannel); c1v1RealtimeChannel = null; }
  c1v1TrackerMatch = null;
}

async function reportC1v1Winner(key) {
  if (!c1v1TrackerMatch) return;
  const m = c1v1TrackerMatch;
  const winnerId = key === 'p1' ? m.player1_id : m.player2_id;
  const winnerName = key === 'p1' ? m.player1_name : m.player2_name;
  const loserId = key === 'p1' ? m.player2_id : m.player1_id;

  if (!confirm(`¿Confirmar que ${winnerName} ganó esta partida?`)) return;

  const { data: updated, error } = await _supabase.from('matches')
    .update({ winner_id: winnerId, is_complete: true })
    .eq('id', m.id).eq('is_complete', false).select('id');
  if (error) { showToast('Error: '+error.message); return; }
  if (!updated?.length) { showToast('Este resultado ya fue confirmado'); return; }

  // Leer datos FRESCOS de la DB (no confiar en tournamentPlayers que puede estar desfasado)
  const { data: freshPlayers, error: fetchErr } = await _supabase
    .from('players').select('id, wins, losses, points')
    .in('id', [winnerId, loserId]);

  if (fetchErr || !freshPlayers?.length) {
    showToast('⚠️ Resultado guardado, pero no se pudieron actualizar los puntos. Avisa al admin.');
  } else {
    const winner = freshPlayers.find(p => p.id === winnerId);
    const loser = freshPlayers.find(p => p.id === loserId);

    if (winner) {
      await _supabase.from('players').update({
        wins: (winner.wins||0)+1, points: (winner.points||0)+3
      }).eq('id', winnerId);
    } else {
      console.error('reportC1v1Winner: no se encontró al ganador en DB', winnerId);
    }

    if (loser) {
      await _supabase.from('players').update({
        losses: (loser.losses||0)+1
      }).eq('id', loserId);
    } else {
      console.error('reportC1v1Winner: no se encontró al perdedor en DB', loserId);
    }
  }

  AudioFX.roundEnd();
  showToast(`🏆 ${winnerName} gana`);
  stopC1v1Tracker();
  showScreen('screen-tournament');
  await loadPlayers();
  await loadAndRenderC1v1Rounds();
  renderC1v1Standings();
}

// ── FINALIZAR TORNEO ─────────────────────────────────────────
async function finalizarCommander1v1() {
  if (!confirm('¿Finalizar el torneo Commander 1v1?')) return;
  await setTournamentStatus('finished');
  await registerHallOfFame(currentTournament.id);
  renderCommander1v1View();
  setTimeout(() => showWinnerPopup(tournamentPlayers), 600);
}
