// =============================================
// AUDIO ENGINE — disponible globalmente
// =============================================
const AudioFX = (() => {
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function beep(freq, dur, type='sine', vol=0.3, delay=0) {
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, c.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol, c.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
      osc.start(c.currentTime + delay);
      osc.stop(c.currentTime + delay + dur + 0.05);
    } catch(e) {}
  }
  return {
    tap()        { beep(440, 0.06, 'sine', 0.18); },
    minus()      { beep(220, 0.1, 'sawtooth', 0.2); },
    plus()       { beep(660, 0.08, 'sine', 0.2); },
    danger()     { beep(180, 0.2, 'sawtooth', 0.35); beep(140, 0.3, 'sawtooth', 0.35, 0.22); },
    roundStart() { [0,0.12,0.24].forEach((d,i)=>beep([523,659,784][i],0.18,'triangle',0.35,d)); },
    roundEnd()   { [0,0.15,0.3].forEach((d,i)=>beep([784,659,523][i],0.18,'triangle',0.3,d)); },
    victory()    { [523,659,784,1047,784,1047,1319].forEach((n,i)=>beep(n,0.22,'triangle',0.4,[0,0.12,0.24,0.36,0.52,0.64,0.8][i])); }
  };
})();

// =============================================
// APP UTILITIES
// =============================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
}
function openModal(id)  { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showToast(msg, ms = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay').forEach(m => m.style.display='none');
});

// Boot
initAuth();
