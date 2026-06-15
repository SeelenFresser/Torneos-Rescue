// =============================================
// COMMANDER 2vs2 — Torneo Swiss / Round Robin
// Reglas THG adaptadas para Commander
// =============================================

// ── ESTADO GLOBAL ────────────────────────────
let c2v2Tournament = null;
let c2v2Teams = [];
let c2v2Matches = [];

// ── COLORES POR EQUIPO ────────────────────────
const TEAM_COLORS = [
  { bg: '#1A3A6E', accent: '#4A90D9', name: 'Equipo Azul' },
  { bg: '#7A1040', accent: '#FF2D8A', name: 'Equipo Rosa' },
  { bg: '#0D5C3A', accent: '#2ECC71', name: 'Equipo Verde' },
  { bg: '#5C2A00', accent: '#FF7700', name: 'Equipo Naranja' },
  { bg: '#3D0D6B', accent: '#9B30FF', name: 'Equipo Morado' },
  { bg: '#6B4A00', accent: '#D4A020', name: 'Equipo Dorado' },
  { bg: '#1A4040', accent: '#00CED1', name: 'Equipo Cyan' },
  { bg: '#4A1A00', accent: '#FF6347', name: 'Equipo Rojo' },
];

const ADMIN_2V2 = '37aa3b75-bcc6-45a8-9b63-1de1285d14f6';
function is2v2Admin() { return currentUser?.id === ADMIN_2V2; }

// ── ABRIR PANTALLA 2v2 ────────────────────────
async function open2v2Screen() {
  AudioFX.tap();
  showScreen('screen-2v2');
  document.getElementById('c2v2-content').innerHTML =
    '<div class="empty-state"><div class="spinner"></div></div>';
  await load2v2Screen();
}

async function load2v2Screen() {
  const { data: tournaments } = await _supabase
    .from('commander_2v2_tournaments')
    .select('*')
    .order('created_at', { ascending: false });

  const el = document.getElementById('c2v2-content');
  const isAdmin = is2v2Admin();

  const active   = (tournaments||[]).filter(t => t.status !== 'finished');
  const finished = (tournaments||[]).filter(t => t.status === 'finished');

  el.innerHTML = `
    ${isAdmin ? `
    <button class="btn btn-primary w-full" style="margin-bottom:16px;
      background:linear-gradient(135deg,var(--magic),#6A20C0)"
      onclick="open2v2CreateModal()">
      🧙 + Nuevo Torneo 2vs2
    </button>` : ''}

    ${active.length ? `
    <div class="section-title" style="margin-bottom:8px">⚡ Activos</div>
    ${active.map(t => render2v2Card(t)).join('')}` : ''}

    ${finished.length ? `
    <div class="section-title" style="margin-top:16px;margin-bottom:8px">✓ Finalizados</div>
    ${finished.map(t => render2v2Card(t)).join('')}` : ''}

    ${!tournaments?.length ? `
    <div class="empty-state" style="padding:32px 20px">
      <div style="font-size:48px;margin-bottom:12px">🧙</div>
      <p>No hay torneos 2vs2 aún.</p>
    </div>` : ''}
  `;
}

function render2v2Card(t) {
  const fmtLabel = { swiss: 'Swiss', roundrobin: 'Round Robin' };
  const statusColor = { active: 'var(--magic)', upcoming: 'var(--std)', finished: 'var(--muted)' };

  return `<div class="section" style="margin-bottom:10px;cursor:pointer"
    onclick="open2v2Detail('${t.id}')">
    <div class="section-body" style="padding:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:16px;font-weight:800;color:var(--text)">${escHtml(t.name)}</div>
        <span style="font-size:11px;font-weight:700;color:${statusColor[t.status]||'var(--muted)'};
          background:${statusColor[t.status]||'var(--muted)'}22;padding:3px 8px;border-radius:20px">
          ${t.status==='active'?'⚡ En curso':t.status==='upcoming'?'📅 Próximo':'✓ Finalizado'}
        </span>
      </div>
      <div style="display:flex;gap:14px;font-size:12px;color:var(--muted)">
        <span>🧙 ${fmtLabel[t.format]||t.format}</span>
        <span>👥 ${t.team_count||0} equipos</span>
        <span>❤️ ${t.starting_life||60} PV</span>
      </div>
    </div>
  </div>`;
}

// ── MODAL CREAR TORNEO 2v2 ────────────────────
function open2v2CreateModal() {
  openModal('modal-2v2-create');
}

async function create2v2Tournament() {
  const name   = document.getElementById('2v2-name')?.value?.trim();
  const format = document.getElementById('2v2-format')?.value;
  const rounds = parseInt(document.getElementById('2v2-rounds')?.value)||4;

  if (!name) { showToast('Escribe un nombre'); return; }

  const { data, error } = await _supabase.from('commander_2v2_tournaments').insert({
    name, format, total_rounds: rounds,
    current_round: 0, status: 'upcoming',
    starting_life: 60, team_count: 0,
    owner_id: currentUser.id
  }).select().single();

  if (error) { showToast('Error: '+error.message); return; }

  closeModal('modal-2v2-create');
  AudioFX.roundStart();
  showToast(`🧙 Torneo "${name}" creado`);
  await open2v2Detail(data.id);
}

// ── DETALLE DEL TORNEO ────────────────────────
async function open2v2Detail(tournamentId) {
  const { data: t } = await _supabase
    .from('commander_2v2_tournaments').select('*').eq('id', tournamentId).single();
  if (!t) return;
  c2v2Tournament = t;

  showScreen('screen-2v2-detail');
  document.getElementById('c2v2-detail-title').textContent = t.name;
  document.getElementById('c2v2-detail-content').innerHTML =
    '<div class="empty-state"><div class="spinner"></div></div>';

  await load2v2Detail();
}

async function load2v2Detail() {
  if (!c2v2Tournament) return;

  const [{ data: teams }, { data: matches }] = await Promise.all([
    _supabase.from('commander_2v2_teams').select('*')
      .eq('tournament_id', c2v2Tournament.id)
      .order('points', { ascending: false }),
    _supabase.from('commander_2v2_matches').select('*')
      .eq('tournament_id', c2v2Tournament.id)
      .order('round').order('match_number')
  ]);

  c2v2Teams   = teams   || [];
  c2v2Matches = matches || [];

  const tab = window._c2v2Tab || 'equipos';
  const el  = document.getElementById('c2v2-detail-content');
  const isAdmin = is2v2Admin();
  const t = c2v2Tournament;

  el.innerHTML = `
    <!-- TABS -->
    <div style="display:flex;gap:4px;margin-bottom:16px;background:var(--dark3);
      border-radius:10px;padding:4px">
      ${[['equipos','👥 Equipos'],['rondas','⚔️ Rondas'],['standing','🏆 Standing']].map(([id,label])=>`
        <button onclick="switch2v2Tab('${id}')"
          class="btn btn-sm ${tab===id?'btn-primary':'btn-ghost'}"
          style="flex:1;font-size:12px" id="c2v2-tab-${id}">
          ${label}
        </button>`).join('')}
    </div>
    <div id="c2v2-tab-content"></div>
  `;

  render2v2Tab(tab);
}

function switch2v2Tab(tab) {
  window._c2v2Tab = tab;
  ['equipos','rondas','standing'].forEach(t => {
    const btn = document.getElementById(`c2v2-tab-${t}`);
    if (btn) { btn.className = `btn btn-sm ${t===tab?'btn-primary':'btn-ghost'}`; btn.style.flex='1'; btn.style.fontSize='12px'; }
  });
  render2v2Tab(tab);
}

function render2v2Tab(tab) {
  const el = document.getElementById('c2v2-tab-content');
  if (!el) return;
  if (tab === 'equipos')  render2v2Teams(el);
  else if (tab === 'rondas') render2v2Rounds(el);
  else if (tab === 'standing') render2v2Standing(el);
}

// ── TAB EQUIPOS ───────────────────────────────
function render2v2Teams(el) {
  const isAdmin = is2v2Admin();
  const t = c2v2Tournament;

  el.innerHTML = `
    ${isAdmin && t.status === 'upcoming' ? `
    <div style="display:grid;gap:8px;margin-bottom:16px">
      <button class="btn btn-primary" onclick="open2v2AddTeamModal()">
        + Agregar equipo manualmente
      </button>
      ${c2v2Teams.length >= 2 ? `
      <button class="btn" style="border-color:var(--magic);color:var(--magic)"
        onclick="randomize2v2Teams()">
        🎲 Generar equipos al azar
      </button>
      <button class="btn btn-primary" style="background:var(--green)"
        onclick="start2v2Tournament()">
        ▶ Iniciar torneo
      </button>` : ''}
    </div>` : ''}

    ${c2v2Teams.length ? `
    <div style="display:grid;gap:8px">
      ${c2v2Teams.map((team, i) => {
        const c = TEAM_COLORS[i % TEAM_COLORS.length];
        return `<div style="background:${c.bg};border:1px solid ${c.accent}44;
          border-radius:12px;padding:12px 14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:14px;font-weight:800;color:${c.accent}">
              ${escHtml(team.team_name)}
            </div>
            ${isAdmin && t.status==='upcoming'?`
            <button class="btn btn-xs btn-danger" onclick="remove2v2Team('${team.id}')">✕</button>`:''}
          </div>
          <div style="display:flex;gap:8px;font-size:13px;color:#fff">
            <span>🧙 ${escHtml(team.player1_name)}</span>
            <span style="color:${c.accent}">+</span>
            <span>🧙 ${escHtml(team.player2_name)}</span>
          </div>
          ${team.commander1||team.commander2?`
          <div style="display:flex;gap:8px;font-size:11px;color:${c.accent}88;margin-top:4px">
            ${team.commander1?`<span>${escHtml(team.commander1)}</span>`:''}
            ${team.commander2?`<span>+ ${escHtml(team.commander2)}</span>`:''}
          </div>`:''}
        </div>`;
      }).join('')}
    </div>` : `
    <div class="empty-state" style="padding:24px">
      <div style="font-size:32px;margin-bottom:8px">👥</div>
      <p>Sin equipos aún. Agrega equipos para comenzar.</p>
    </div>`}
  `;
}

// ── MODAL AGREGAR EQUIPO ──────────────────────
function open2v2AddTeamModal() {
  const nextNum = c2v2Teams.length + 1;
  const c = TEAM_COLORS[(nextNum-1) % TEAM_COLORS.length];
  document.getElementById('2v2-team-name').value = c.name;
  openModal('modal-2v2-add-team');
}

async function add2v2Team() {
  const teamName  = document.getElementById('2v2-team-name')?.value?.trim();
  const p1Name    = document.getElementById('2v2-p1-name')?.value?.trim();
  const p2Name    = document.getElementById('2v2-p2-name')?.value?.trim();
  const cmdr1     = document.getElementById('2v2-cmdr1')?.value?.trim();
  const cmdr2     = document.getElementById('2v2-cmdr2')?.value?.trim();

  if (!teamName||!p1Name||!p2Name) { showToast('Completa nombre del equipo y jugadores'); return; }

  const { error } = await _supabase.from('commander_2v2_teams').insert({
    tournament_id: c2v2Tournament.id,
    team_name: teamName,
    player1_name: p1Name, player2_name: p2Name,
    commander1: cmdr1||null, commander2: cmdr2||null,
    wins: 0, losses: 0, draws: 0, points: 0
  });

  if (error) { showToast('Error: '+error.message); return; }

  // Actualizar conteo
  await _supabase.from('commander_2v2_tournaments')
    .update({ team_count: c2v2Teams.length + 1 })
    .eq('id', c2v2Tournament.id);
  c2v2Tournament.team_count = c2v2Teams.length + 1;

  closeModal('modal-2v2-add-team');
  AudioFX.tap();
  showToast('Equipo agregado ✓');
  await load2v2Detail();
}

async function remove2v2Team(teamId) {
  if (!confirm('¿Eliminar este equipo?')) return;
  await _supabase.from('commander_2v2_teams').delete().eq('id', teamId);
  await load2v2Detail();
}

// ── EQUIPOS AL AZAR ───────────────────────────
async function randomize2v2Teams() {
  // Obtener todos los jugadores individuales registrados
  const players = [];
  c2v2Teams.forEach(t => {
    players.push(t.player1_name, t.player2_name);
  });

  if (players.length < 4 || players.length % 2 !== 0) {
    showToast('Necesitas un número par de jugadores'); return;
  }

  if (!confirm(`¿Reorganizar ${players.length} jugadores en ${players.length/2} equipos aleatorios?`)) return;

  // Mezclar y emparejar
  const shuffled = players.sort(() => Math.random() - 0.5);
  const newTeams = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    newTeams.push({ p1: shuffled[i], p2: shuffled[i+1] });
  }

  // Borrar equipos actuales y recrear
  await _supabase.from('commander_2v2_teams').delete().eq('tournament_id', c2v2Tournament.id);

  const inserts = newTeams.map((pair, i) => ({
    tournament_id: c2v2Tournament.id,
    team_name: TEAM_COLORS[i % TEAM_COLORS.length].name,
    player1_name: pair.p1, player2_name: pair.p2,
    wins: 0, losses: 0, draws: 0, points: 0
  }));

  await _supabase.from('commander_2v2_teams').insert(inserts);
  AudioFX.roundStart();
  showToast('🎲 Equipos reorganizados al azar');
  await load2v2Detail();
}

// ── INICIAR TORNEO ────────────────────────────
async function start2v2Tournament() {
  if (c2v2Teams.length < 2) { showToast('Necesitas al menos 2 equipos'); return; }
  if (!confirm(`¿Iniciar torneo con ${c2v2Teams.length} equipos?`)) return;

  await _supabase.from('commander_2v2_tournaments')
    .update({ status: 'active' }).eq('id', c2v2Tournament.id);
  c2v2Tournament.status = 'active';

  await generate2v2Round();
}

// ── GENERACIÓN DE RONDAS ──────────────────────
async function generate2v2Round() {
  if (window._generating2v2) { showToast('Generando...'); return; }
  window._generating2v2 = true;

  try {
    const t = c2v2Tournament;
    const newRound = (t.current_round||0) + 1;

    // Verificar que no existe ya
    const { data: existing } = await _supabase
      .from('commander_2v2_matches').select('id')
      .eq('tournament_id', t.id).eq('round', newRound);
    if (existing?.length) { showToast('Esta ronda ya fue generada'); return; }

    // Atomic update
    const { data: updated } = await _supabase
      .from('commander_2v2_tournaments')
      .update({ current_round: newRound })
      .eq('id', t.id).eq('current_round', newRound - 1)
      .select('id');
    if (!updated?.length) { await load2v2Detail(); return; }
    c2v2Tournament.current_round = newRound;

    let pairings = [];

    if (t.format === 'roundrobin') {
      pairings = generateRoundRobinPairings2v2(c2v2Teams, newRound);
    } else {
      pairings = generateSwissPairings2v2(c2v2Teams, c2v2Matches);
    }

    const inserts = pairings.map((p, i) => ({
      tournament_id: t.id,
      round: newRound, match_number: i + 1,
      team1_id: p.t1.id, team1_name: p.t1.team_name,
      team2_id: p.t2?.id || null, team2_name: p.t2?.team_name || 'BYE',
      is_bye: !p.t2, is_complete: !p.t2,
      winner_team_id: !p.t2 ? p.t1.id : null
    }));

    await _supabase.from('commander_2v2_matches').insert(inserts);

    // BYE: dar puntos al equipo que descansa
    for (const p of pairings) {
      if (!p.t2) {
        await _supabase.from('commander_2v2_teams').update({
          wins: (p.t1.wins||0) + 1,
          points: (p.t1.points||0) + 3
        }).eq('id', p.t1.id);
      }
    }

    AudioFX.roundStart();
    showToast(`⚔️ Ronda ${newRound} generada`);
    await load2v2Detail();
    switch2v2Tab('rondas');
  } finally {
    window._generating2v2 = false;
  }
}

function generateSwissPairings2v2(teams, matches) {
  const sorted = [...teams].sort((a,b) => (b.points-a.points)||(b.wins-a.wins));
  const prevPairs = new Set();
  const hadBye = new Set();

  matches.forEach(m => {
    if (m.team1_id && m.team2_id) prevPairs.add([m.team1_id,m.team2_id].sort().join('|'));
    if (m.is_bye) hadBye.add(m.team1_id);
  });

  const pairings = [];
  const used = new Set();

  // BYE al de menor puntos sin BYE previo
  if (sorted.length % 2 !== 0) {
    let byeTeam = null;
    for (let i = sorted.length-1; i >= 0; i--) {
      if (!hadBye.has(sorted[i].id)) { byeTeam = sorted[i]; break; }
    }
    if (!byeTeam) byeTeam = sorted[sorted.length-1];
    pairings.push({ t1: byeTeam, t2: null });
    used.add(byeTeam.id);
  }

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(sorted[i].id)) continue;
    const t1 = sorted[i];
    let t2 = null;
    for (let j = i+1; j < sorted.length; j++) {
      if (!used.has(sorted[j].id)) {
        const key = [t1.id, sorted[j].id].sort().join('|');
        if (!prevPairs.has(key)) { t2 = sorted[j]; break; }
      }
    }
    if (!t2) for (let j = i+1; j < sorted.length; j++) {
      if (!used.has(sorted[j].id)) { t2 = sorted[j]; break; }
    }
    if (t2) { pairings.push({t1,t2}); used.add(t1.id); used.add(t2.id); }
  }
  return pairings;
}

function generateRoundRobinPairings2v2(teams, currentRound) {
  const ids = [...teams];
  if (ids.length % 2 !== 0) ids.push(null); // BYE
  const n = ids.length;
  const r = (currentRound - 1) % (n - 1);

  const rotated = [ids[0], ...ids.slice(1).slice(-(n-1) + r).concat(ids.slice(1).slice(0, -(n-1) + r))];
  const pairings = [];
  for (let i = 0; i < n/2; i++) {
    const t1 = rotated[i];
    const t2 = rotated[n-1-i];
    if (t1 && t2) pairings.push({t1,t2});
    else if (t1) pairings.push({t1, t2: null});
  }
  return pairings;
}

// ── TAB RONDAS ────────────────────────────────
function render2v2Rounds(el) {
  const isAdmin = is2v2Admin();
  const t = c2v2Tournament;

  // Agrupar por ronda
  const rounds = {};
  c2v2Matches.forEach(m => { if(!rounds[m.round]) rounds[m.round]=[]; rounds[m.round].push(m); });
  const roundKeys = Object.keys(rounds).map(Number).sort((a,b)=>a-b);

  el.innerHTML = `
    ${isAdmin && t.status === 'active' ? `
    <div style="display:grid;gap:8px;margin-bottom:14px">
      ${roundKeys.length === 0 || (roundKeys.length > 0 && rounds[Math.max(...roundKeys)].every(m=>m.is_complete)) ? `
      <button class="btn btn-primary" onclick="generate2v2Round()">
        ▶ ${roundKeys.length === 0 ? 'Generar Ronda 1' : `Generar Ronda ${Math.max(...roundKeys)+1}`}
      </button>` : ''}
    </div>` : ''}

    ${roundKeys.length ? roundKeys.reverse().map(rn => {
      const roundMatches = rounds[rn];
      const allDone = roundMatches.every(m=>m.is_complete);
      return `<div style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:var(--magic);
          text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;
          display:flex;justify-content:space-between">
          <span>⚔️ Ronda ${rn}</span>
          <span style="color:${allDone?'var(--green)':'var(--muted)'}">
            ${allDone?'✓ Completa':'En curso'}
          </span>
        </div>
        ${roundMatches.map(m => render2v2MatchCard(m, isAdmin)).join('')}
      </div>`;
    }).join('') : `
    <div class="empty-state" style="padding:24px">
      <div style="font-size:32px;margin-bottom:8px">⚔️</div>
      <p>Sin rondas aún. Inicia el torneo para generar la primera ronda.</p>
    </div>`}
  `;
}

function render2v2MatchCard(m, isAdmin) {
  const t = c2v2Tournament;
  const team1idx = c2v2Teams.findIndex(t=>t.id===m.team1_id);
  const team2idx = c2v2Teams.findIndex(t=>t.id===m.team2_id);
  const c1 = TEAM_COLORS[team1idx % TEAM_COLORS.length];
  const c2 = team2idx>=0 ? TEAM_COLORS[team2idx % TEAM_COLORS.length] : null;
  const w1 = m.is_complete && m.winner_team_id===m.team1_id;
  const w2 = m.is_complete && m.winner_team_id===m.team2_id;

  if (m.is_bye) return `
    <div style="background:var(--dark2);border:1px solid var(--border);
      border-radius:12px;padding:12px 14px;margin-bottom:8px;
      display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:13px;font-weight:700;color:${c1.accent}">${escHtml(m.team1_name)}</div>
      <span style="font-size:11px;background:var(--dark3);padding:3px 10px;border-radius:20px;color:var(--muted)">
        BYE Auto ✓
      </span>
    </div>`;

  return `<div style="background:var(--dark2);border:1px solid var(--border);
    border-radius:12px;padding:12px 14px;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:${!m.is_complete&&isAdmin?'10px':'0'}">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:${w1?'800':'600'};
          color:${w1?'var(--gold)':w2?'var(--muted)':c1.accent}">
          ${escHtml(m.team1_name)}
        </div>
        <div style="font-size:11px;color:var(--muted)">
          ${escHtml(c2v2Teams.find(t=>t.id===m.team1_id)?.player1_name||'')} + 
          ${escHtml(c2v2Teams.find(t=>t.id===m.team1_id)?.player2_name||'')}
        </div>
      </div>
      ${m.is_complete ? `
        <div style="text-align:center;font-size:18px;font-weight:900;color:var(--text);min-width:40px">
          ${w1?'✓':'✗'}
        </div>` : `
        <div style="font-size:12px;color:var(--muted)">vs</div>`}
      <div style="flex:1;text-align:right">
        <div style="font-size:13px;font-weight:${w2?'800':'600'};
          color:${w2?'var(--gold)':w1?'var(--muted)':c2?.accent||'var(--text)'}">
          ${escHtml(m.team2_name)}
        </div>
        <div style="font-size:11px;color:var(--muted);text-align:right">
          ${escHtml(c2v2Teams.find(t=>t.id===m.team2_id)?.player1_name||'')} + 
          ${escHtml(c2v2Teams.find(t=>t.id===m.team2_id)?.player2_name||'')}
        </div>
      </div>
    </div>
    ${m.is_complete ? `
      <div style="text-align:center;font-size:12px;color:var(--green);margin-top:6px">
        🏆 Ganó: ${escHtml(m.winner_team_id===m.team1_id?m.team1_name:m.team2_name)}
      </div>` : isAdmin && t.status==='active' ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
      <button class="btn btn-primary"
        onclick="confirm2v2Result('${m.id}','${m.team1_id}','${m.team1_name}')"
        style="background:${c1.bg};border-color:${c1.accent};color:${c1.accent};font-weight:700">
        ✓ Ganó ${escHtml(m.team1_name)}
      </button>
      <button class="btn btn-primary"
        onclick="confirm2v2Result('${m.id}','${m.team2_id}','${m.team2_name}')"
        style="background:${c2?.bg||'var(--dark2)'};border-color:${c2?.accent||'var(--magic)'};color:${c2?.accent||'var(--magic)'};font-weight:700">
        ✓ Ganó ${escHtml(m.team2_name)}
      </button>
    </div>
    <div style="margin-top:6px;text-align:center">
      <button class="btn btn-xs btn-ghost" onclick="open2v2GameTracker('${m.id}')">
        ❤️ Abrir tracker de partida
      </button>
    </div>` : ''}
  </div>`;
}

async function confirm2v2Result(matchId, winnerTeamId, winnerTeamName) {
  const loserMatch = c2v2Matches.find(m=>m.id===matchId);
  const loserTeamId = loserMatch?.team1_id===winnerTeamId ? loserMatch?.team2_id : loserMatch?.team1_id;

  const { error } = await _supabase.from('commander_2v2_matches').update({
    winner_team_id: winnerTeamId, is_complete: true
  }).eq('id', matchId);

  if (error) { showToast('Error: '+error.message); return; }

  // Actualizar stats de equipos
  const winner = c2v2Teams.find(t=>t.id===winnerTeamId);
  const loser  = c2v2Teams.find(t=>t.id===loserTeamId);
  if (winner) await _supabase.from('commander_2v2_teams').update({
    wins: (winner.wins||0)+1, points: (winner.points||0)+3
  }).eq('id',winnerTeamId);
  if (loser) await _supabase.from('commander_2v2_teams').update({
    losses: (loser.losses||0)+1
  }).eq('id',loserTeamId);

  AudioFX.roundEnd();
  showToast(`✓ ${winnerTeamName} gana`);
  await load2v2Detail();
  switch2v2Tab('rondas');
}

// ── TAB STANDING ──────────────────────────────
function render2v2Standing(el) {
  const isAdmin = is2v2Admin();
  const t = c2v2Tournament;
  const sorted = [...c2v2Teams].sort((a,b)=>(b.points-a.points)||(b.wins-a.wins));

  el.innerHTML = `
    ${isAdmin && t.status==='active' ? `
    <button class="btn btn-danger w-full" style="margin-bottom:14px"
      onclick="finish2v2Tournament()">
      🏆 Finalizar torneo
    </button>` : ''}

    ${sorted.length ? `
    <div style="display:grid;gap:6px">
      ${sorted.map((team,i)=>{
        const c = TEAM_COLORS[c2v2Teams.indexOf(team) % TEAM_COLORS.length];
        const posIcons = ['👑','🥈','🥉'];
        return `<div style="background:${i<3?c.bg:'var(--dark2)'};
          border:2px solid ${i<3?c.accent+'44':'var(--border)'};
          border-radius:12px;padding:10px 14px;
          display:flex;align-items:center;gap:10px">
          <div style="font-size:${i<3?'22px':'16px'};min-width:28px;text-align:center">
            ${posIcons[i]||`${i+1}°`}
          </div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:${i===0?'900':'700'};
              color:${i===0?'var(--gold)':i<3?c.accent:'var(--text)'}">
              ${escHtml(team.team_name)}
            </div>
            <div style="font-size:11px;color:var(--muted)">
              ${escHtml(team.player1_name)} + ${escHtml(team.player2_name)}
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:20px;font-weight:900;color:${i===0?'var(--gold)':i<3?c.accent:'var(--text)'}">
              ${team.points}
            </div>
            <div style="font-size:10px;color:var(--muted)">${team.wins}V ${team.losses}D</div>
          </div>
        </div>`;
      }).join('')}
    </div>` : `
    <div class="empty-state" style="padding:24px">Sin equipos aún</div>`}
  `;
}

async function finish2v2Tournament() {
  if (!confirm('¿Finalizar el torneo y registrar al equipo ganador?')) return;

  const sorted = [...c2v2Teams].sort((a,b)=>(b.points-a.points)||(b.wins-a.wins));
  const winner = sorted[0];

  await _supabase.from('commander_2v2_tournaments').update({ status: 'finished' })
    .eq('id', c2v2Tournament.id);
  c2v2Tournament.status = 'finished';

  // Hall of Fame
  await _supabase.from('hall_of_fame').insert({
    tournament_name: c2v2Tournament.name,
    tournament_type: 'commander',
    tournament_format: '2v2',
    winner_name: `${winner.team_name} (${winner.player1_name} + ${winner.player2_name})`,
    winner_points: winner.points,
    winner_wins: winner.wins,
    tournament_date: new Date().toISOString(),
    player_count: c2v2Teams.length * 2
  });

  AudioFX.victory();
  show2v2Champion(winner, sorted[1]);
}

function show2v2Champion(winner, second) {
  const wi = c2v2Teams.indexOf(winner);
  const wc = TEAM_COLORS[wi % TEAM_COLORS.length];

  const overlay = document.createElement('div');
  overlay.id = 'c2v2-winner-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.92);
    display:flex;align-items:center;justify-content:center;
    z-index:9999;padding:20px;backdrop-filter:blur(8px)`;

  overlay.innerHTML = `
    <div style="background:#1A0010;border:2px solid var(--gold);border-radius:20px;
      padding:32px 24px;text-align:center;max-width:420px;width:100%;
      box-shadow:0 0 80px rgba(245,208,96,0.4)">
      <div style="font-size:48px;margin-bottom:8px">🏆</div>
      <div style="font-size:13px;color:var(--muted);text-transform:uppercase;
        letter-spacing:2px;margin-bottom:12px">¡Campeones del Torneo!</div>
      <div style="font-size:28px;font-weight:900;color:var(--gold);margin-bottom:4px">
        👑 ${escHtml(winner.team_name)}
      </div>
      <div style="font-size:15px;color:#fff;margin-bottom:20px">
        🧙 ${escHtml(winner.player1_name)} + 🧙 ${escHtml(winner.player2_name)}
      </div>
      <div style="background:${wc.bg};border:1px solid ${wc.accent};border-radius:10px;
        padding:10px;margin-bottom:20px">
        <div style="font-size:12px;color:${wc.accent}">Record final</div>
        <div style="font-size:22px;font-weight:900;color:#fff">${winner.wins}V · ${winner.losses}D · ${winner.points}pts</div>
      </div>
      <button class="btn btn-primary w-full"
        onclick="document.getElementById('c2v2-winner-overlay').remove();
          showScreen('screen-2v2');load2v2Screen()">
        Volver a torneos
      </button>
    </div>`;
  document.body.appendChild(overlay);
}

// ── TRACKER DE PARTIDA EN VIVO ────────────────
let trackerMatchId = null;
let trackerState = {
  teamA: { life: 60, poison: 0, cmdrDmg: {} },
  teamB: { life: 60, poison: 0, cmdrDmg: {} }
};

function open2v2GameTracker(matchId) {
  trackerMatchId = matchId;
  const match = c2v2Matches.find(m=>m.id===matchId);
  if (!match) return;

  const teamA = c2v2Teams.find(t=>t.id===match.team1_id);
  const teamB = c2v2Teams.find(t=>t.id===match.team2_id);
  const tAidx = c2v2Teams.indexOf(teamA);
  const tBidx = c2v2Teams.indexOf(teamB);
  const cA = TEAM_COLORS[tAidx % TEAM_COLORS.length];
  const cB = TEAM_COLORS[tBidx % TEAM_COLORS.length];

  trackerState = {
    teamA: { life: 60, poison: 0, cmdrDmg: { fromB1: 0, fromB2: 0 }, name: teamA?.team_name||'Equipo A', color: cA },
    teamB: { life: 60, poison: 0, cmdrDmg: { fromA1: 0, fromA2: 0 }, name: teamB?.team_name||'Equipo B', color: cB },
    teamAplayers: [teamA?.player1_name||'J1', teamA?.player2_name||'J2'],
    teamBplayers: [teamB?.player1_name||'J1', teamB?.player2_name||'J2'],
    teamAcmdrs: [teamA?.commander1||'Comandante 1', teamA?.commander2||'Comandante 2'],
    teamBcmdrs: [teamB?.commander1||'Comandante 1', teamB?.commander2||'Comandante 2'],
  };

  showScreen('screen-2v2-tracker');
  render2v2Tracker();
}

function render2v2Tracker() {
  const el = document.getElementById('c2v2-tracker-content');
  if (!el) return;
  const { teamA, teamB, teamAplayers, teamBplayers, teamAcmdrs, teamBcmdrs } = trackerState;
  const cA = teamA.color;
  const cB = teamB.color;

  const isAdmin = is2v2Admin();

  el.innerHTML = `
    <!-- EQUIPO A -->
    <div style="background:${cA.bg};border:2px solid ${teamA.life<=10?'#FF4444':cA.accent}44;
      border-radius:16px;padding:14px;margin-bottom:10px">
      <div style="font-size:12px;font-weight:800;color:${cA.accent};
        text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">
        ${escHtml(teamA.name)} — ${escHtml(teamAplayers[0])} + ${escHtml(teamAplayers[1])}
      </div>

      <!-- VIDAS COMPARTIDAS -->
      <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:11px;color:${cA.accent}80;margin-bottom:4px">❤️ Vidas del equipo</div>
        <div style="font-size:56px;font-weight:900;color:#fff;
          text-shadow:0 2px 20px ${cA.accent}80;line-height:1">
          ${teamA.life}
        </div>
        <div style="display:flex;justify-content:center;gap:8px;margin-top:8px">
          <button onclick="changeTeamLife('A',-5)"
            style="padding:6px 14px;background:${cA.btnMinus||'#2a0010'}88;border:none;
            border-radius:8px;color:#fff;font-size:14px;font-weight:700;cursor:pointer">−5</button>
          <button onclick="changeTeamLife('A',-1)"
            style="padding:6px 14px;background:${cA.btnMinus||'#2a0010'}88;border:none;
            border-radius:8px;color:#fff;font-size:16px;font-weight:700;cursor:pointer">−1</button>
          <button onclick="changeTeamLife('A',+1)"
            style="padding:6px 14px;background:${cA.accent}88;border:none;
            border-radius:8px;color:#fff;font-size:16px;font-weight:700;cursor:pointer">+1</button>
          <button onclick="changeTeamLife('A',+5)"
            style="padding:6px 14px;background:${cA.accent}88;border:none;
            border-radius:8px;color:#fff;font-size:14px;font-weight:700;cursor:pointer">+5</button>
        </div>
      </div>

      <!-- VENENO Y DAÑO CDR -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:rgba(0,0,0,0.3);border-radius:10px;padding:8px;text-align:center">
          <div style="font-size:10px;color:${cA.accent}80;margin-bottom:4px">☠️ Veneno (de 20)</div>
          <div style="font-size:22px;font-weight:900;color:${teamA.poison>=15?'#FF4444':'#9B30FF'}">
            ${teamA.poison}
          </div>
          <div style="display:flex;justify-content:center;gap:6px;margin-top:4px">
            <button onclick="changeTeamPoison('A',-1)"
              style="padding:3px 10px;background:rgba(0,0,0,0.3);border:none;border-radius:6px;
              color:#9B30FF;font-size:12px;cursor:pointer">−</button>
            <button onclick="changeTeamPoison('A',+1)"
              style="padding:3px 10px;background:#9B30FF88;border:none;border-radius:6px;
              color:#fff;font-size:12px;cursor:pointer">+</button>
          </div>
        </div>
        <div style="background:rgba(0,0,0,0.3);border-radius:10px;padding:8px">
          <div style="font-size:10px;color:${cA.accent}80;margin-bottom:4px">⚔️ Daño de Cdr recibido</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:2px">
            De ${escHtml(teamBcmdrs[0])}: <strong style="color:${teamA.cmdrDmg.fromB1>=21?'#FF4444':'#fff'}">${teamA.cmdrDmg.fromB1}</strong>
            ${teamA.cmdrDmg.fromB1>=21?'💀 FATAL':''}
          </div>
          <div style="display:flex;gap:4px;margin-bottom:4px">
            <button onclick="changeCmdrDmg('A','fromB1',-1)"
              style="padding:2px 8px;background:rgba(0,0,0,0.3);border:none;border-radius:5px;color:var(--muted);font-size:11px;cursor:pointer">−</button>
            <button onclick="changeCmdrDmg('A','fromB1',+1)"
              style="padding:2px 8px;background:${cB?.accent||'var(--magic)'}88;border:none;border-radius:5px;color:#fff;font-size:11px;cursor:pointer">+</button>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:2px">
            De ${escHtml(teamBcmdrs[1])}: <strong style="color:${teamA.cmdrDmg.fromB2>=21?'#FF4444':'#fff'}">${teamA.cmdrDmg.fromB2}</strong>
            ${teamA.cmdrDmg.fromB2>=21?'💀 FATAL':''}
          </div>
          <div style="display:flex;gap:4px">
            <button onclick="changeCmdrDmg('A','fromB2',-1)"
              style="padding:2px 8px;background:rgba(0,0,0,0.3);border:none;border-radius:5px;color:var(--muted);font-size:11px;cursor:pointer">−</button>
            <button onclick="changeCmdrDmg('A','fromB2',+1)"
              style="padding:2px 8px;background:${cB?.accent||'var(--magic)'}88;border:none;border-radius:5px;color:#fff;font-size:11px;cursor:pointer">+</button>
          </div>
        </div>
      </div>
    </div>

    <!-- EQUIPO B -->
    <div style="background:${cB.bg};border:2px solid ${teamB.life<=10?'#FF4444':cB.accent}44;
      border-radius:16px;padding:14px;margin-bottom:10px">
      <div style="font-size:12px;font-weight:800;color:${cB.accent};
        text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">
        ${escHtml(teamB.name)} — ${escHtml(teamBplayers[0])} + ${escHtml(teamBplayers[1])}
      </div>

      <div style="text-align:center;margin-bottom:12px">
        <div style="font-size:11px;color:${cB.accent}80;margin-bottom:4px">❤️ Vidas del equipo</div>
        <div style="font-size:56px;font-weight:900;color:#fff;
          text-shadow:0 2px 20px ${cB.accent}80;line-height:1">
          ${teamB.life}
        </div>
        <div style="display:flex;justify-content:center;gap:8px;margin-top:8px">
          <button onclick="changeTeamLife('B',-5)"
            style="padding:6px 14px;background:${cB.btnMinus||'#2a0010'}88;border:none;
            border-radius:8px;color:#fff;font-size:14px;font-weight:700;cursor:pointer">−5</button>
          <button onclick="changeTeamLife('B',-1)"
            style="padding:6px 14px;background:${cB.btnMinus||'#2a0010'}88;border:none;
            border-radius:8px;color:#fff;font-size:16px;font-weight:700;cursor:pointer">−1</button>
          <button onclick="changeTeamLife('B',+1)"
            style="padding:6px 14px;background:${cB.accent}88;border:none;
            border-radius:8px;color:#fff;font-size:16px;font-weight:700;cursor:pointer">+1</button>
          <button onclick="changeTeamLife('B',+5)"
            style="padding:6px 14px;background:${cB.accent}88;border:none;
            border-radius:8px;color:#fff;font-size:14px;font-weight:700;cursor:pointer">+5</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:rgba(0,0,0,0.3);border-radius:10px;padding:8px;text-align:center">
          <div style="font-size:10px;color:${cB.accent}80;margin-bottom:4px">☠️ Veneno (de 20)</div>
          <div style="font-size:22px;font-weight:900;color:${teamB.poison>=15?'#FF4444':'#9B30FF'}">
            ${teamB.poison}
          </div>
          <div style="display:flex;justify-content:center;gap:6px;margin-top:4px">
            <button onclick="changeTeamPoison('B',-1)"
              style="padding:3px 10px;background:rgba(0,0,0,0.3);border:none;border-radius:6px;
              color:#9B30FF;font-size:12px;cursor:pointer">−</button>
            <button onclick="changeTeamPoison('B',+1)"
              style="padding:3px 10px;background:#9B30FF88;border:none;border-radius:6px;
              color:#fff;font-size:12px;cursor:pointer">+</button>
          </div>
        </div>
        <div style="background:rgba(0,0,0,0.3);border-radius:10px;padding:8px">
          <div style="font-size:10px;color:${cB.accent}80;margin-bottom:4px">⚔️ Daño de Cdr recibido</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:2px">
            De ${escHtml(teamAcmdrs[0])}: <strong style="color:${teamB.cmdrDmg.fromA1>=21?'#FF4444':'#fff'}">${teamB.cmdrDmg.fromA1}</strong>
            ${teamB.cmdrDmg.fromA1>=21?'💀 FATAL':''}
          </div>
          <div style="display:flex;gap:4px;margin-bottom:4px">
            <button onclick="changeCmdrDmg('B','fromA1',-1)"
              style="padding:2px 8px;background:rgba(0,0,0,0.3);border:none;border-radius:5px;color:var(--muted);font-size:11px;cursor:pointer">−</button>
            <button onclick="changeCmdrDmg('B','fromA1',+1)"
              style="padding:2px 8px;background:${cA?.accent||'var(--magic)'}88;border:none;border-radius:5px;color:#fff;font-size:11px;cursor:pointer">+</button>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:2px">
            De ${escHtml(teamAcmdrs[1])}: <strong style="color:${teamB.cmdrDmg.fromA2>=21?'#FF4444':'#fff'}">${teamB.cmdrDmg.fromA2}</strong>
            ${teamB.cmdrDmg.fromA2>=21?'💀 FATAL':''}
          </div>
          <div style="display:flex;gap:4px">
            <button onclick="changeCmdrDmg('B','fromA2',-1)"
              style="padding:2px 8px;background:rgba(0,0,0,0.3);border:none;border-radius:5px;color:var(--muted);font-size:11px;cursor:pointer">−</button>
            <button onclick="changeCmdrDmg('B','fromA2',+1)"
              style="padding:2px 8px;background:${cA?.accent||'var(--magic)'}88;border:none;border-radius:5px;color:#fff;font-size:11px;cursor:pointer">+</button>
          </div>
        </div>
      </div>
    </div>

    <!-- VERIFICAR CONDICIÓN DE DERROTA -->
    ${checkDefeatConditions()}

    <!-- BOTÓN REGISTRAR RESULTADO -->
    ${isAdmin ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
      <button class="btn btn-primary"
        onclick="closeTrackerAndReport('${trackerMatchId}','${c2v2Matches.find(m=>m.id===trackerMatchId)?.team1_id}','${teamA.name}')"
        style="background:${cA.bg};border-color:${cA.accent};color:${cA.accent}">
        ✓ Ganó ${escHtml(teamA.name)}
      </button>
      <button class="btn btn-primary"
        onclick="closeTrackerAndReport('${trackerMatchId}','${c2v2Matches.find(m=>m.id===trackerMatchId)?.team2_id}','${teamB.name}')"
        style="background:${cB.bg};border-color:${cB.accent};color:${cB.accent}">
        ✓ Ganó ${escHtml(teamB.name)}
      </button>
    </div>` : ''}
  `;
}

function checkDefeatConditions() {
  const { teamA, teamB } = trackerState;
  const warnings = [];

  if (teamA.life <= 0) warnings.push(`💀 ${escHtml(teamA.name)} llegó a 0 PV`);
  if (teamB.life <= 0) warnings.push(`💀 ${escHtml(teamB.name)} llegó a 0 PV`);
  if (teamA.poison >= 20) warnings.push(`☠️ ${escHtml(teamA.name)} tiene 20+ veneno`);
  if (teamB.poison >= 20) warnings.push(`☠️ ${escHtml(teamB.name)} tiene 20+ veneno`);
  if (Object.values(teamA.cmdrDmg).some(v=>v>=21)) warnings.push(`⚔️ ${escHtml(teamA.name)} recibió 21+ daño de un comandante`);
  if (Object.values(teamB.cmdrDmg).some(v=>v>=21)) warnings.push(`⚔️ ${escHtml(teamB.name)} recibió 21+ daño de un comandante`);

  if (!warnings.length) return '';
  return `<div style="background:#FF444422;border:2px solid #FF4444;border-radius:12px;
    padding:12px;margin-bottom:10px">
    <div style="font-size:13px;font-weight:700;color:#FF4444;margin-bottom:6px">
      ⚠️ Condición de derrota detectada
    </div>
    ${warnings.map(w=>`<div style="font-size:12px;color:#fff;margin-bottom:4px">${w}</div>`).join('')}
  </div>`;
}

function changeTeamLife(team, delta) {
  const key = team === 'A' ? 'teamA' : 'teamB';
  trackerState[key].life = Math.max(0, trackerState[key].life + delta);
  delta < 0 ? (trackerState[key].life<=10?AudioFX.danger():AudioFX.minus()) : AudioFX.plus();
  render2v2Tracker();
}

function changeTeamPoison(team, delta) {
  const key = team === 'A' ? 'teamA' : 'teamB';
  trackerState[key].poison = Math.max(0, trackerState[key].poison + delta);
  AudioFX.tap();
  render2v2Tracker();
}

function changeCmdrDmg(team, source, delta) {
  const key = team === 'A' ? 'teamA' : 'teamB';
  trackerState[key].cmdrDmg[source] = Math.max(0, (trackerState[key].cmdrDmg[source]||0) + delta);
  delta > 0 ? AudioFX.minus() : AudioFX.tap();
  render2v2Tracker();
}

async function closeTrackerAndReport(matchId, winnerTeamId, winnerTeamName) {
  await confirm2v2Result(matchId, winnerTeamId, winnerTeamName);
  showScreen('screen-2v2-detail');
  switch2v2Tab('rondas');
}
