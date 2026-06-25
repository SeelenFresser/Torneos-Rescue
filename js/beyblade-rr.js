// =============================================
// BEYBLADE ROUND ROBIN — Todos contra todos
// Solo puntos por victoria (3pts gana, 0pts pierde)
// Sin playoff — standing final decide al ganador
// =============================================

// ── RENDER PRINCIPAL ──────────────────────────
async function renderBeybladeRRView() {
  const t = currentTournament;
  const players = tournamentPlayers;
  const owner = isOwner();

  const content = document.getElementById('tournament-content');
  const n = players.length;
  const totalRounds = n % 2 === 0 ? n - 1 : n;

  content.innerHTML = `
    <div class="section" style="margin-bottom:14px">
      <div class="section-head">
        <span class="section-title">🌀 Round Robin Beyblade</span>
        <span class="badge badge-bey">Ronda ${t.current_round||0}/${totalRounds}</span>
      </div>
      <div class="section-body">
        <div class="stats-row">
          <div class="stat-box"><div class="stat-val">${n}</div><div class="stat-lbl">Jugadores</div></div>
          <div class="stat-box"><div class="stat-val">${totalRounds}</div><div class="stat-lbl">Jornadas</div></div>
          <div class="stat-box"><div class="stat-val">${t.status==='finished'?'✓':t.status==='active'?'⚡':'📅'}</div>
            <div class="stat-lbl">${t.status==='finished'?'Finalizado':t.status==='active'?'En curso':'Próximo'}</div></div>
        </div>

        ${owner && t.status === 'upcoming' ? `
        <label class="label">Agregar jugador</label>
        <div style="display:flex;gap:8px">
          <input class="input" id="rr-bey-player-name" type="text" placeholder="Nombre del jugador"
            onkeydown="if(event.key==='Enter')addPlayerRRBey()" style="flex:1">
          <button class="btn btn-primary" onclick="addPlayerRRBey()">+ Agregar</button>
        </div>` : ''}
        <div class="chips" style="margin-top:10px">
          ${players.map(p => `
            <div class="chip">
              ${p.user_id?'👤':'🤖'} ${escHtml(p.name)}
              ${owner && (t.status === 'upcoming' || t.status === 'active') ? `
                <button class="chip-edit" onclick="openEditPlayerNameModal('${p.id}','${escHtml(p.name).replace(/'/g,"\\'")}')" title="Editar nombre">✏️</button>
                <button class="chip-remove" onclick="removePlayer('${p.id}')" title="Eliminar jugador">×</button>` : ''}
            </div>`).join('')}
          ${!players.length?'<span style="color:var(--muted);font-size:13px">Sin jugadores</span>':''}
        </div>
        ${owner && t.status === 'upcoming' ? `
        ${n >= 2 ? `<p style="font-size:12px;color:var(--muted);margin-top:6px">
          📊 ${n} jugadores → <strong style="color:var(--bey)">${totalRounds} jornadas</strong> · todos contra todos
          ${n%2!==0?'<span style="font-size:11px"> · 1 descanso por jugador</span>':''}
        </p>` : ''}
        ${n >= 2 ? `<button class="btn btn-primary w-full" style="margin-top:10px" onclick="startBeybladeRR()">
          ▶ Iniciar Round Robin
        </button>` : ''}` : ''}
      </div>
    </div>

    ${t.status !== 'upcoming' ? `
    <div id="rr-bey-rounds"></div>
    <div id="rr-bey-standings" style="margin-top:14px"></div>
    ` : ''}
  `;

  if (t.status !== 'upcoming') {
    await loadAndRenderBeyRRRounds();
    renderBeyRRStandings();
  }
}

async function addPlayerRRBey() {
  const nameEl = document.getElementById('rr-bey-player-name');
  const name = nameEl?.value?.trim();
  if (!name) { showToast('Escribe un nombre'); return; }

  const { error } = await _supabase.from('players').insert({
    tournament_id: currentTournament.id, name,
    wins: 0, losses: 0, points: 0, game_wins: 0, game_losses: 0
  });
  if (error) { showToast('Error: '+error.message); return; }

  nameEl.value = '';
  await loadPlayers();
  renderBeybladeRRView();
  showToast(`${name} agregado ✓`);
  setTimeout(() => document.getElementById('rr-bey-player-name')?.focus(), 50);
}

// ── INICIAR TORNEO ────────────────────────────
async function startBeybladeRR() {
  if (tournamentPlayers.length < 2) { showToast('Necesitas al menos 2 jugadores'); return; }
  if (!confirm(`¿Iniciar Round Robin con ${tournamentPlayers.length} jugadores?`)) return;

  await _supabase.from('tournaments').update({ status: 'active' }).eq('id', currentTournament.id);
  currentTournament.status = 'active';

  await generateBeyRRRound();
}

// ── GENERAR RONDA (ROTACIÓN ESTÁNDAR) ─────────
async function generateBeyRRRound() {
  if (window._generatingBeyRR) { showToast('Generando...'); return; }
  window._generatingBeyRR = true;

  try {
    const t = currentTournament;
    const newRound = (t.current_round||0) + 1;
    const players = tournamentPlayers;
    const n = players.length;
    const totalRounds = n % 2 === 0 ? n - 1 : n;

    if (newRound > totalRounds) { showToast('Ya se jugaron todas las jornadas'); return; }

    // Verificar que no exista
    const { data: existing } = await _supabase
      .from('matches').select('id')
      .eq('tournament_id', t.id).eq('round', newRound).eq('match_type', 'beyrr');
    if (existing?.length) { showToast('Esta jornada ya fue generada'); return; }

    // Atomic update
    const { data: updated } = await _supabase
      .from('tournaments').update({ current_round: newRound })
      .eq('id', t.id).eq('current_round', newRound - 1).select('id');
    if (!updated?.length) { await loadPlayers(); renderBeybladeRRView(); return; }
    currentTournament.current_round = newRound;

    // Algoritmo de rotación estándar (Berger tables)
    const ids = [...players];
    if (ids.length % 2 !== 0) ids.push(null); // BYE ficticio
    const total = ids.length;
    const numRounds = total - 1;
    const r = ((newRound - 1) % numRounds + numRounds) % numRounds;

    const rest = ids.slice(1);
    const rotated = [ids[0], ...rest.slice(rest.length - r).concat(rest.slice(0, rest.length - r))];

    const pairings = [];
    for (let i = 0; i < total/2; i++) {
      const p1 = rotated[i];
      const p2 = rotated[total-1-i];
      if (p1 && p2) pairings.push({ p1, p2 });
      else if (p1) pairings.push({ p1, p2: null });
      else if (p2) pairings.push({ p1: p2, p2: null });
    }

    const inserts = pairings.map((p, i) => ({
      tournament_id: t.id,
      round: newRound, match_number: i+1,
      match_type: 'beyrr',
      player1_id: p.p1.id, player1_name: p.p1.name,
      player2_id: p.p2?.id || null, player2_name: p.p2?.name || 'BYE',
      is_complete: !p.p2,
      winner_id: !p.p2 ? p.p1.id : null,
      score_p1: !p.p2 ? 2 : null,
      score_p2: !p.p2 ? 0 : null,
      bye_points_given: !p.p2
    }));

    await _supabase.from('matches').insert(inserts);

    // Dar puntos por BYE inmediatamente (no hay confirmación pendiente en RR)
    for (const p of pairings) {
      if (!p.p2) {
        await _supabase.from('players').update({
          wins: (p.p1.wins||0) + 1,
          points: (p.p1.points||0) + 3
        }).eq('id', p.p1.id);
      }
    }

    AudioFX.roundStart();
    showToast(`🌀 Jornada ${newRound} generada`);
    await loadPlayers();
    renderBeybladeRRView();
  } finally {
    window._generatingBeyRR = false;
  }
}

// ── CARGAR Y RENDERIZAR JORNADAS ──────────────
async function loadAndRenderBeyRRRounds() {
  const { data: matches } = await _supabase
    .from('matches').select('*')
    .eq('tournament_id', currentTournament.id)
    .eq('match_type', 'beyrr')
    .order('round', { ascending: false })
    .order('match_number', { ascending: true });

  const el = document.getElementById('rr-bey-rounds');
  if (!el) return;

  const owner = isOwner();
  const t = currentTournament;
  const n = tournamentPlayers.length;
  const totalRounds = n % 2 === 0 ? n - 1 : n;

  const rounds = {};
  (matches||[]).forEach(m => { if(!rounds[m.round]) rounds[m.round]=[]; rounds[m.round].push(m); });
  const roundKeys = Object.keys(rounds).map(Number).sort((a,b)=>b-a);

  el.innerHTML = `
    ${owner && t.status === 'active' ? `
    <div style="margin-bottom:12px">
      ${roundKeys.length === 0 || rounds[Math.max(...roundKeys)].every(m=>m.is_complete) ? `
      <button class="btn btn-primary w-full" onclick="generateBeyRRRound()">
        ▶ ${roundKeys.length===0?'Generar Jornada 1':`Generar Jornada ${Math.max(...roundKeys)+1}`}
      </button>` : ''}
      ${roundKeys.length === totalRounds && rounds[totalRounds]?.every(m=>m.is_complete) ? `
      <button class="btn btn-danger w-full" style="margin-top:8px" onclick="finishBeyRR()">
        🏆 Finalizar torneo
      </button>` : ''}
    </div>` : ''}

    ${roundKeys.map(rn => {
      const roundMatches = rounds[rn];
      const allDone = roundMatches.every(m=>m.is_complete);
      return `<div class="section" style="margin-bottom:10px">
        <div class="section-head">
          <span class="section-title">Jornada ${rn}</span>
          <span class="badge ${allDone?'badge-std':'badge-bey'}">${allDone?'✓ Completa':'En curso'}</span>
        </div>
        <div class="section-body">
          ${roundMatches.map(m => renderBeyRRMatch(m, owner, t.status==='active')).join('')}
        </div>
      </div>`;
    }).join('')}
  `;
}

function renderBeyRRMatch(m, owner, active) {
  if (m.player2_id === null && m.player2_name === 'BYE') {
    return `<div class="match-card" style="margin-bottom:8px;opacity:0.7">
      <div class="match-player winner">${escHtml(m.player1_name)}</div>
      <span style="font-size:11px;color:var(--muted)">BYE Auto ✓</span>
    </div>`;
  }

  const w1 = m.is_complete && m.winner_id === m.player1_id ? 'winner' : '';
  const w2 = m.is_complete && m.winner_id === m.player2_id ? 'winner' : '';

  return `<div class="match-card" style="margin-bottom:8px">
    <div class="match-player ${w1}">${escHtml(m.player1_name)}</div>
    <div class="match-vs">vs</div>
    <div class="match-player ${w2}">${escHtml(m.player2_name)}</div>
    <div class="match-actions">
      ${m.is_complete
        ? `<span class="pill pill-w">${m.score_p1}–${m.score_p2}</span>
           ${owner?`<button class="btn btn-xs btn-ghost" style="margin-left:6px"
             onclick="openEditMatchModal('${m.id}','${m.player1_id}','${m.player2_id}','${escHtml(m.player1_name)}','${escHtml(m.player2_name)}',${m.score_p1},${m.score_p2},'beyrr')">✏️</button>`:''}`
        : owner && active
        ? `<div class="score-wrap">
             <input class="score-in" id="bm${m.id}-s1" type="number" min="0" max="2" placeholder="0">
             <span class="score-sep">–</span>
             <input class="score-in" id="bm${m.id}-s2" type="number" min="0" max="2" placeholder="0">
             <button class="result-btn result-btn-confirm" onclick="confirmBeyRRMatch('${m.id}','${m.player1_id}','${m.player2_id}')">✓</button>
           </div>`
        : '<span style="color:var(--muted);font-size:12px">Pendiente</span>'}
    </div>
  </div>`;
}

async function confirmBeyRRMatch(matchId, p1Id, p2Id) {
  // Guard anti doble-click / doble-submit
  if (window._confirmingBeyRR === matchId) return;
  window._confirmingBeyRR = matchId;

  try {
    const s1 = parseInt(document.getElementById(`bm${matchId}-s1`)?.value)||0;
    const s2 = parseInt(document.getElementById(`bm${matchId}-s2`)?.value)||0;
    if (s1+s2<2||s1>2||s2>2||(s1!==2&&s2!==2)) { showToast('Bo3: resultado inválido (ej: 2-0 o 2-1)'); return; }

    // Verificar en la DB que el match no esté ya confirmado (protege contra doble-click real)
    const { data: existing } = await _supabase
      .from('matches').select('is_complete').eq('id', matchId).single();
    if (existing?.is_complete) { showToast('Este resultado ya fue confirmado'); return; }

    const winnerId = s1>s2 ? p1Id : p2Id;
    const loserId  = s1>s2 ? p2Id : p1Id;

    // Update atómico: solo aplica si is_complete sigue siendo false
    const { data: updated, error } = await _supabase.from('matches')
      .update({ score_p1: s1, score_p2: s2, winner_id: winnerId, is_complete: true })
      .eq('id', matchId).eq('is_complete', false).select('id');
    if (error) { showToast('Error: '+error.message); return; }
    if (!updated?.length) { showToast('Este resultado ya fue confirmado'); return; }

    // Leer datos FRESCOS de la DB — no confiar en tournamentPlayers que puede estar desfasado
    const { data: freshPlayers, error: fetchErr } = await _supabase
      .from('players').select('id, wins, losses, points, game_wins, game_losses')
      .in('id', [winnerId, loserId]);

    if (fetchErr || !freshPlayers?.length) {
      showToast('⚠️ Resultado guardado, pero no se pudieron actualizar los puntos. Avisa al admin.');
    } else {
      const winner = freshPlayers.find(p=>p.id===winnerId);
      const loser  = freshPlayers.find(p=>p.id===loserId);

      if (winner) {
        await _supabase.from('players').update({
          wins: (winner.wins||0)+1, points: (winner.points||0)+3,
          game_wins: (winner.game_wins||0)+(winnerId===p1Id?s1:s2),
          game_losses: (winner.game_losses||0)+(winnerId===p1Id?s2:s1)
        }).eq('id',winnerId);
      } else {
        console.error('confirmBeyRRMatch: no se encontró al ganador en DB', winnerId);
      }

      if (loser) {
        await _supabase.from('players').update({
          losses: (loser.losses||0)+1,
          game_wins: (loser.game_wins||0)+(loserId===p1Id?s1:s2),
          game_losses: (loser.game_losses||0)+(loserId===p1Id?s2:s1)
        }).eq('id',loserId);
      } else {
        console.error('confirmBeyRRMatch: no se encontró al perdedor en DB', loserId);
      }
    }

    AudioFX.roundEnd();
    showToast('Resultado guardado ✓');
    await loadPlayers();
    await loadAndRenderBeyRRRounds();
    renderBeyRRStandings();
  } finally {
    window._confirmingBeyRR = null;
  }
}

// ── STANDINGS ─────────────────────────────────
function renderBeyRRStandings() {
  const el = document.getElementById('rr-bey-standings');
  if (!el) return;

  const sorted = [...tournamentPlayers].sort((a,b) =>
    (b.points-a.points) || ((b.game_wins-b.game_losses)-(a.game_wins-a.game_losses)) || (b.wins-a.wins)
  );

  const posIcons = ['👑','🥈','🥉'];

  el.innerHTML = `
    <div class="section">
      <div class="section-head"><span class="section-title">🏆 Clasificación</span></div>
      <div class="section-body">
        <table class="t-table">
          <thead><tr><th>#</th><th>Jugador</th><th>V</th><th>D</th><th>GD</th><th>Pts</th></tr></thead>
          <tbody>
            ${sorted.map((p,i)=>{
              const gd = (p.game_wins||0)-(p.game_losses||0);
              return `<tr style="${i===0?'background:rgba(245,208,96,0.08)':''}">
                <td>${posIcons[i]||i+1+'°'}</td>
                <td style="font-weight:${i===0?'700':'400'};color:${i===0?'var(--gold)':'var(--text)'}">${escHtml(p.name)}</td>
                <td style="color:var(--green)">${p.wins||0}</td>
                <td style="color:var(--red)">${p.losses||0}</td>
                <td style="color:${gd>=0?'var(--std)':'var(--red)'}">${gd>0?'+':''}${gd}</td>
                <td style="font-weight:700;color:var(--bey)">${p.points||0}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── FINALIZAR TORNEO ──────────────────────────
async function finishBeyRR() {
  if (!confirm('¿Finalizar el torneo Round Robin?')) return;

  await _supabase.from('tournaments').update({ status: 'finished' }).eq('id', currentTournament.id);
  currentTournament.status = 'finished';

  await registerHallOfFame(currentTournament.id);

  AudioFX.victory();
  renderBeybladeRRView();
  setTimeout(() => showWinnerPopup(tournamentPlayers), 600);
}
