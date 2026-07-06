// ═══════════════════════════════════════════════════════════════════
// MTG LIFE COUNTER v3 — Rescue TCG
// Número gigante centrado, + y − a los lados, colores sólidos
// Layout calculado en JS para 100% de pantalla siempre
// ═══════════════════════════════════════════════════════════════════

const LC_COLORS = [
  { bg:'#1E3A6E', accent:'#6AADFF', name:'Azul'    },
  { bg:'#6B1040', accent:'#FF5BA0', name:'Rosa'     },
  { bg:'#1A5C30', accent:'#45E87A', name:'Verde'    },
  { bg:'#6B4000', accent:'#FFAA20', name:'Naranja'  },
  { bg:'#3D1A70', accent:'#B06AFF', name:'Morado'   },
  { bg:'#00454A', accent:'#20E8D8', name:'Cyan'     },
  { bg:'#5C4A00', accent:'#F0D030', name:'Dorado'   },
  { bg:'#5C1A1A', accent:'#FF5A5A', name:'Rojo'     },
];

// Posiciones de celdas [col, row, colSpan, rowSpan] en grilla normalizada
const LC_LAYOUTS = {
  1:{ cols:1,rows:1, cells:[[0,0,1,1]] },
  2:{ cols:2,rows:1, cells:[[0,0,1,1],[1,0,1,1]] },
  3:{ cols:2,rows:2, cells:[[0,0,2,1],[0,1,1,1],[1,1,1,1]] },
  4:{ cols:2,rows:2, cells:[[0,0,1,1],[1,0,1,1],[0,1,1,1],[1,1,1,1]] },
  5:{ cols:3,rows:2, cells:[[0,0,1,1],[1,0,1,1],[2,0,1,1],[0,1,2,1],[2,1,1,1]] },
  6:{ cols:3,rows:2, cells:[[0,0,1,1],[1,0,1,1],[2,0,1,1],[0,1,1,1],[1,1,1,1],[2,1,1,1]] },
  7:{ cols:4,rows:2, cells:[[0,0,1,1],[1,0,1,1],[2,0,1,1],[3,0,1,1],[0,1,2,1],[2,1,1,1],[3,1,1,1]] },
  8:{ cols:4,rows:2, cells:[[0,0,1,1],[1,0,1,1],[2,0,1,1],[3,0,1,1],[0,1,1,1],[1,1,1,1],[2,1,1,1],[3,1,1,1]] },
};

// Fila 0 → rotado 180° (mira hacia arriba de la mesa), fila 1 → 0°
const lcRotFor = (row, totalRows) => totalRows === 1 ? 0 : row === 0 ? 180 : 0;

let lc = {
  screen:'setup', playerCount:4, startLife:40,
  players:[], editingIdx:-1,
  history:[], future:[],
  rollResult:null, isRolling:false,
};
let lcHold={}, lcDeltaVal={}, lcDeltaTimer={}, lcWakeLock=null;

// ── ABRIR / CERRAR ────────────────────────────────────────────────
function openLifeCounter() {
  AudioFX && AudioFX.tap && AudioFX.tap();
  lc.screen='setup'; lc.rollResult=null;
  // Usar lc-root directamente como overlay fixed (evita conflicto con .screen { display:block })
  document.getElementById('lc-root').classList.add('lc-open');
  if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l=>lcWakeLock=l).catch(()=>{});
  lcRender();
}
function closeLifeCounter() {
  if (lcWakeLock) { lcWakeLock.release(); lcWakeLock=null; }
  Object.values(lcHold).forEach(clearTimeout);
  if (screen.orientation?.unlock) screen.orientation.unlock();
  document.getElementById('lc-root').classList.remove('lc-open');
  goToDashboard();
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────────
function lcRender() {
  const root = document.getElementById('lc-root');
  if (!root) return;
  if (lc.screen==='setup') root.innerHTML = lcSetupHTML();
  else lcBuildGame(root);
}

// ── SETUP ─────────────────────────────────────────────────────────
function lcSetupHTML() {
  const counts=[1,2,3,4,5,6,7,8], lives=[20,30,40];
  return `<div class="lcs-wrap">
    <div class="lcs-logo">Rescue TCG</div>
    <div class="lcs-title">Contador de Vida</div>
    <div class="lcs-sub">Magic: The Gathering</div>

    <div class="lcs-group">
      <div class="lcs-label">Jugadores</div>
      <div class="lcs-row4">
        ${counts.map(n=>`<button class="lcs-opt${lc.playerCount===n?' lcs-on':''}"
          onclick="lc.playerCount=${n};lcRender()">${n}</button>`).join('')}
      </div>
    </div>

    <div class="lcs-group">
      <div class="lcs-label">Vida inicial</div>
      <div class="lcs-row3">
        ${lives.map(l=>`<button class="lcs-opt${lc.startLife===l?' lcs-on':''}"
          onclick="lc.startLife=${l};lcRender()">${l}</button>`).join('')}
      </div>
    </div>

    <button class="lcs-roll" onclick="lcRoll()">🎲 Elegir quién empieza</button>
    ${lc.rollResult?`<div class="lcs-result">${lc.rollResult}</div>`:''}

    <button class="lcs-start" onclick="lcStart()">Iniciar partida →</button>
  </div>`;
}

function lcRoll() {
  if (lc.isRolling) return;
  lc.isRolling=true; lc.rollResult='🎲'; lcRender();
  let i=0, final=1;
  const t=setInterval(()=>{
    final=1+Math.floor(Math.random()*lc.playerCount);
    const el=document.querySelector('.lcs-result');
    if(el) el.textContent='🎲 Jugador '+final;
    if(++i>=20){ clearInterval(t); lc.isRolling=false; lc.rollResult='⚡ Empieza Jugador '+final; lcRender(); }
  },80);
}

// ── INICIAR JUEGO ─────────────────────────────────────────────────
function lcStart() {
  lc.players=Array.from({length:lc.playerCount},(_,i)=>({
    id:i, name:`J${i+1}`, life:lc.startLife, eliminated:false
  }));
  lc.history=[]; lc.future=[]; lc.editingIdx=-1; lcDeltaVal={};
  lc.screen='game';
  if (screen.orientation?.lock) screen.orientation.lock('landscape').catch(()=>{});
  lcBuildGame(document.getElementById('lc-root'));
}

// ── BUILD GAME — posicionamiento absoluto en píxeles ──────────────
function lcBuildGame(root) {
  if (!root) return;
  const W=root.clientWidth||window.innerWidth;
  const H=root.clientHeight||window.innerHeight;
  const n=lc.players.length;
  const layout=LC_LAYOUTS[n]||LC_LAYOUTS[4];
  const topH=42;
  const arenaH=H-topH;
  const cellW=W/layout.cols;
  const cellH=arenaH/layout.rows;

  // ── TOPBAR
  let html=`<div class="lcg-bar" style="height:${topH}px;line-height:${topH}px">
    <button class="lcg-tbtn" onclick="lcUndo()">↩</button>
    <button class="lcg-tbtn" onclick="lcRedo()">↪</button>
    <span class="lcg-title">⚔️ MTG</span>
    <button class="lcg-tbtn" onclick="lcReset()">↺</button>
    <button class="lcg-tbtn" onclick="lc.screen='setup';lcRender()">⚙</button>
    <button class="lcg-tbtn" onclick="closeLifeCounter()">✕</button>
  </div>
  <div style="position:absolute;top:${topH}px;left:0;right:0;bottom:0">`;

  // ── PANELES
  layout.cells.forEach(([col,row,cs,rs],i)=>{
    const p=lc.players[i]; if(!p) return;
    const c=LC_COLORS[i%LC_COLORS.length];
    const x=col*cellW, y=row*cellH;
    const w=cellW*cs, h=cellH*rs;
    const rot=lcRotFor(row,layout.rows);

    // Tamaños proporcionales al panel
    const numSize = Math.min(w*.55, h*.58);   // número enorme
    const btnSize = Math.min(w*.18, h*.28);   // botones ± laterales
    const btnFont = btnSize*.58;
    const nameSize= Math.min(w,h)*.055;
    const lifeColor= p.life<=5?'#FF3030':p.life<=10?'#FF7020':c.accent;

    // Bordes entre paneles
    const borderStyle=`border:1px solid rgba(0,0,0,.3)`;

    html+=`
    <div class="lcg-panel${p.eliminated?' lcg-elim':''}"
      style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;
             background:${c.bg};${borderStyle};overflow:hidden">

      <!-- contenido rotado -->
      <div style="position:absolute;inset:0;transform:rotate(${rot}deg);
                  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${h*.02}px">

        <!-- nombre + editar (arriba) -->
        <div style="display:flex;align-items:center;gap:6px;opacity:.8">
          <span style="font-size:${nameSize}px;font-weight:800;color:${c.accent};
                       max-width:${w*.6}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(p.name)}</span>
          <button onclick="lcOpenEdit(${i})"
            style="background:transparent;border:none;font-size:${nameSize*.9}px;
                   cursor:pointer;color:${c.accent};opacity:.55;padding:0 2px">✏️</button>
        </div>

        <!-- fila: − número + -->
        <div style="display:flex;align-items:center;justify-content:center;
                    gap:${w*.04}px;width:100%">

          <button class="lcg-lb"
            style="width:${btnSize}px;height:${btnSize}px;font-size:${btnFont}px;
                   border-color:${c.accent};color:${c.accent}"
            onclick="lcChange(${i},-1)"
            onpointerdown="lcStartHold(${i},-1)"
            onpointerup="lcStopHold(${i})"
            onpointercancel="lcStopHold(${i})"
            onpointerleave="lcStopHold(${i})">−</button>

          <div style="position:relative;display:flex;align-items:center;justify-content:center;
                      min-width:${numSize*.8}px">
            <span id="lcn${i}"
              style="font-size:${numSize}px;font-weight:900;color:${lifeColor};
                     line-height:1;letter-spacing:-3px;
                     text-shadow:0 2px 20px ${c.accent}40;
                     transition:color .2s">${p.life}</span>
            <span id="lcd${i}"
              style="position:absolute;top:${-numSize*.15}px;right:${-numSize*.35}px;
                     font-size:${numSize*.2}px;font-weight:800;opacity:0;
                     pointer-events:none"></span>
          </div>

          <button class="lcg-lb"
            style="width:${btnSize}px;height:${btnSize}px;font-size:${btnFont}px;
                   border-color:${c.accent};color:${c.accent}"
            onclick="lcChange(${i},+1)"
            onpointerdown="lcStartHold(${i},+1)"
            onpointerup="lcStopHold(${i})"
            onpointercancel="lcStopHold(${i})"
            onpointerleave="lcStopHold(${i})">+</button>
        </div>

        ${p.eliminated?`<div style="font-size:${nameSize}px;font-weight:800;color:#FF4040;letter-spacing:2px">ELIMINADO</div>`:''}
      </div>
    </div>`;
  });

  html+='</div>';
  if (lc.editingIdx>=0) html+=lcModalHTML();
  root.innerHTML=html;
}

// ── CAMBIO DE VIDA ────────────────────────────────────────────────
function lcSave() {
  lc.history.push(JSON.parse(JSON.stringify(lc.players)));
  if(lc.history.length>60) lc.history.shift();
  lc.future=[];
}

function lcChange(idx, delta) {
  lcSave();
  const p=lc.players[idx];
  p.life+=delta;
  p.eliminated=p.life<=0;
  const c=LC_COLORS[idx%LC_COLORS.length];
  if(navigator.vibrate) navigator.vibrate(delta>0?15:35);

  // Actualizar número sin re-render completo
  const numEl=document.getElementById('lcn'+idx);
  if(numEl){
    const lc2=p.life<=5?'#FF3030':p.life<=10?'#FF7020':c.accent;
    numEl.textContent=p.life;
    numEl.style.color=lc2;
    numEl.style.animation='none'; void numEl.offsetWidth;
    numEl.style.animation=delta>0?'lcUp .15s ease':'lcDn .15s ease';
  }

  // Delta flotante
  lcDeltaVal[idx]=(lcDeltaVal[idx]||0)+delta;
  clearTimeout(lcDeltaTimer[idx]);
  lcDeltaTimer[idx]=setTimeout(()=>{ lcDeltaVal[idx]=0; },1600);
  const dEl=document.getElementById('lcd'+idx);
  if(dEl){
    const v=lcDeltaVal[idx];
    dEl.textContent=(v>0?'+':'')+v;
    dEl.style.color=delta>0?'#45E87A':'#FF5050';
    dEl.style.animation='none'; void dEl.offsetWidth;
    dEl.style.animation='lcDelta 1.4s ease forwards';
  }
}

function lcStartHold(idx,delta){
  let count=0;
  const tick=()=>{
    lcChange(idx,delta);
    const spd=++count>8?70:count>3?150:320;
    lcHold[idx]=setTimeout(tick,spd);
  };
  lcHold[idx]=setTimeout(tick,550);
}
function lcStopHold(idx){ clearTimeout(lcHold[idx]); }

function lcUndo(){
  if(!lc.history.length) return;
  lc.future.push(JSON.parse(JSON.stringify(lc.players)));
  lc.players=lc.history.pop();
  lcBuildGame(document.getElementById('lc-root'));
}
function lcRedo(){
  if(!lc.future.length) return;
  lc.history.push(JSON.parse(JSON.stringify(lc.players)));
  lc.players=lc.future.pop();
  lcBuildGame(document.getElementById('lc-root'));
}
function lcReset(){
  if(!confirm('¿Reiniciar la partida?')) return;
  lc.players.forEach(p=>{ p.life=lc.startLife; p.eliminated=false; });
  lc.history=[]; lc.future=[]; lcDeltaVal={};
  lcBuildGame(document.getElementById('lc-root'));
}

// ── EDITAR NOMBRE ─────────────────────────────────────────────────
function lcOpenEdit(idx){
  lc.editingIdx=idx;
  lcBuildGame(document.getElementById('lc-root'));
  setTimeout(()=>{ const i=document.getElementById('lcni'); if(i){i.focus();i.select();} },60);
}
function lcCloseEdit(){ lc.editingIdx=-1; lcBuildGame(document.getElementById('lc-root')); }
function lcConfirmEdit(){
  const v=document.getElementById('lcni')?.value?.trim();
  if(v) lc.players[lc.editingIdx].name=v;
  lcCloseEdit();
}
function lcModalHTML(){
  const p=lc.players[lc.editingIdx];
  return `<div class="lc-ov" onclick="lcCloseEdit()">
    <div class="lc-mod" onclick="event.stopPropagation()">
      <div class="lc-mod-t">Editar nombre</div>
      <input class="lc-mod-i" id="lcni" type="text" maxlength="20"
        value="${escHtml(p?.name||'')}" placeholder="Nombre"
        onkeydown="if(event.key==='Enter')lcConfirmEdit()">
      <div class="lc-mod-row">
        <button class="lc-mod-btn lc-cancel" onclick="lcCloseEdit()">Cancelar</button>
        <button class="lc-mod-btn lc-ok" onclick="lcConfirmEdit()">Guardar</button>
      </div>
    </div>
  </div>`;
}

// Re-render en resize
window.addEventListener('resize',()=>{
  if(lc.screen==='game'&&document.getElementById('lc-root')?.classList.contains('lc-open'))
    lcBuildGame(document.getElementById('lc-root'));
});
