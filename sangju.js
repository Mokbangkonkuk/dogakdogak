/* =========================================================
   도각도각 · 전시 상주 시간표 (sangju.js) · 48판
   - 부원: ?v=s&s=전시회ID 로 들어와 상주할 수 있는 시간을 칠해서 내고, 공개된 시간표를 봐요.
   - 임원진: [전시회 관리] → 전시회 → [전시 상주 시간표]에서 날짜 · 응답 · 고르게 나누기 · 공개 · 디자인을 정해요.
   - 디자인: 기본(검정 바탕 + 연두) 또는 포스터에 맞추기(포스터에서 색 뽑기 · 제목 · 무늬 자르기).
   index.html의 도구는 window.DG로 받아 써요. 화면은 그림자 DOM 안에 그려서 도각도각 화면 모양과 서로 섞이지 않아요.
   ========================================================= */
(function(){
'use strict';
const DG = window.DG;
const LIVE = DG.LIVE;
const WD = '일월화수목금토';
let host = null, root = null;
const $ = s => root.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key = (d, h) => d + '|' + h;
const normName = s => String(s || '').replace(/\s+/g, '');
const pad = n => String(n).padStart(2, '0');
const fmtH = h => pad(h) + ':00';
function dObj(d){ const [y,m,dd] = d.split('-').map(Number); return new Date(y, m-1, dd); }
function fmtDate(d){ const t = dObj(d); return `${t.getMonth()+1}/${t.getDate()} (${WD[t.getDay()]})`; }
function isSun(d){ return dObj(d).getDay() === 0; }
function fmtRange(s, e){ return `${fmtH(s)}–${fmtH(e)}`; }
function hoursText(h){ return Number.isInteger(h) ? h + '시간' : h.toFixed(1) + '시간'; }
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function lsGet(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } }
function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
function toast(msg){ const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200); }
async function copyText(txt, msg){
  try { await navigator.clipboard.writeText(txt); }
  catch(e){ const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch(_){} ta.remove(); }
  toast(msg || '복사했어요');
}
function setTop(){ const t = (S.pub && (S.pub.cfg.title || S.pub.ex.title)) || '전시 상주'; document.title = t + ' · 상주 시간표'; }

/* ---------- 서버 ---------- */
const X = { exhId: '', mode: 'member', ex: null };
async function call(fn, ...args){
  if (LIVE) return DG.api(fn, ...args);
  // 미리보기: 상주 기능은 아래 Mock이, 나머지(사진 등)는 도각도각 미리보기 서버가 처리해요
  if (Mock[fn]){
    await new Promise(r => setTimeout(r, 150));
    const r = Mock[fn](...JSON.parse(JSON.stringify(args)));
    if (r !== Mock.PASS) return r === undefined ? r : JSON.parse(JSON.stringify(r));
  }
  return DG.api(fn, ...args);
}
const pubKey = () => 'dg_sj_pub_' + (LIVE ? '' : 'demo_') + X.exhId;
const mineKey = () => 'dg_sj_mine_' + (LIVE ? '' : 'demo_') + X.exhId;
const link = () => DG.SITE + '?v=s&s=' + encodeURIComponent(X.exhId);
async function loadPub(){ const d = await call('sjInfo', X.exhId); X.exhId = d.ex.id; S.pub = d; lsSet(pubKey(), d); applyTheme(d.theme); return d; }
function refreshPubLater(){ loadPub().then(() => { if (X.mode === 'member' && (S.view === 'home' || S.view === 'table')) render(); }).catch(() => {}); }

/* ---------- 디자인 ----------
   기본: 도각도각 원래 디자인 그대로 (종이색 바탕 · 짙은 초록 · 고운 바탕 제목, 휴대폰이 어두운 모드면 어두운 테마).
   포스터: 바탕 · 글씨 · 보조 글씨 · 강조(버튼) 색과 포스터에서 자른 제목 · 무늬 그림. */
const DEFAULT_THEME = { mode: 'default', bg: '#141414', ink: '#ededE6', muted: '#a6a69f', accent: '#b4e03c', font: 'plex', title: '', pattern: '', titleW: 72 };
const T = () => X.themeNow || fullTheme(null);
/* 도각도각 화면의 색을 그대로 읽어 와요 (index.html의 :root 색이 바뀌면 같이 바뀌어요) */
function dogakTheme(){
  const cs = getComputedStyle(document.documentElement), v = (k, d) => (cs.getPropertyValue(k) || '').trim() || d;
  return { mode: 'default', dogak: true, font: 'plex', title: '', pattern: '', titleW: 72,
    bg: v('--paper', '#eef0eb'), ink: v('--ink', '#1d2420'), muted: v('--muted', '#5b665e'), accent: v('--accent', '#2d5a46'), onAccent: v('--accent-ink', '#ffffff'),
    card: v('--surface', '#fbfbf8'), line: v('--line', '#d6dbd2'), soft: v('--soft', '#e1eae3'), red: v('--bad', '#b23a32'), warm: v('--warn', '#9a6200'), wood: v('--wood', '#8a5a35') };
}
function hexRgb(h){ h = String(h || '#000000').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbHex(r){ return '#' + r.map(v => pad(Math.max(0, Math.min(255, Math.round(v))).toString(16))).join(''); }
function mix(a, b, t){ const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * t)); }
function lum(h){ const c = hexRgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function contrast(a, b){ const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function hexA(h, a){ const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`; }
const FONTS = { plex: '"IBM Plex Sans KR"', gmarket: '"GmarketSans"', batang: '"Gowun Batang"' };
function fullTheme(t){
  if (!(t && t.mode === 'poster')){
    const d = dogakTheme(), dark = lum(d.bg) < 0.25;
    return Object.assign(d, { dark, deep: d.card, dim: mix(d.bg, d.ink, 0.5), hi: mix(d.ink, dark ? '#ffffff' : '#000000', 0.3) });
  }
  t = Object.assign({}, DEFAULT_THEME, t);
  const dark = lum(t.bg) < 0.25;
  return Object.assign(t, { dark,
    deep: mix(t.bg, dark ? '#000000' : '#ffffff', dark ? 0.22 : 0.55), card: mix(t.bg, t.ink, 0.05), soft: mix(t.bg, t.ink, 0.1),
    line: mix(t.bg, t.ink, 0.24), dim: mix(t.bg, t.ink, 0.52), hi: mix(t.ink, dark ? '#ffffff' : '#000000', 0.3),
    onAccent: contrast(t.accent, '#151515') >= contrast(t.accent, '#ffffff') ? '#1b1b1a' : '#ffffff',
    red: dark ? '#e8917e' : '#c0392b', warm: dark ? '#d9b08c' : '#9a5b22' });
}
function themeVars(t){
  return { '--bg': t.bg, '--ink': t.ink, '--muted': t.muted, '--accent': t.accent, '--on-accent': t.onAccent, '--bg-deep': t.deep, '--card': t.card,
    '--soft': t.soft, '--line': t.line, '--dim': t.dim, '--hi': t.hi, '--red': t.red, '--warm': t.warm,
    '--font': `${FONTS[t.font] || FONTS.plex},"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif`,
    '--head-font': t.dogak || t.font === 'batang' ? '"Gowun Batang","Noto Serif KR",serif' : 'var(--font)', '--logo-filter': t.dark ? 'invert(1) brightness(1.4)' : 'none',
    '--r': t.dogak ? '8px' : '12px', '--tag': t.wood || t.muted,
    '--scheme': t.dark ? 'dark' : 'light', '--glow-h': `linear-gradient(90deg,transparent,${mix(t.bg, t.accent, 0.45)} 35%,${t.accent} 75%,transparent)` };
}
function applyTheme(t, el){
  const f = fullTheme(t); if (!el) X.themeNow = f; watchDogakTheme();
  const v = themeVars(f), tgt = el || host;
  Object.keys(v).forEach(k => tgt.style.setProperty(k, v[k]));
  if (!el){ document.body.style.setProperty('--sj-bg', f.bg); const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', f.bg); }
  if (f.font === 'gmarket') loadGmarket();
  return f;
}
/* 기본 디자인은 도각도각 밝은/어두운 테마가 바뀌면 같이 바뀌어요 */
function watchDogakTheme(){
  if (watchDogakTheme.on) return; watchDogakTheme.on = true;
  const re = () => { if (host && X.themeNow && X.themeNow.dogak){ applyTheme(null); if (S.view && root) drawChrome(); } };
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', re); } catch(e){}
  try { new MutationObserver(re).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']}); } catch(e){}
}
let gmarketOn = false;
function loadGmarket(){
  if (gmarketOn) return; gmarketOn = true;
  const u = w => `url("https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSans${w}.woff") format("woff")`;
  const st = document.createElement('style');
  st.textContent = [['Light', 300], ['Medium', 500], ['Bold', 700]].map(([w, n]) => `@font-face{font-family:"GmarketSans";font-weight:${n};font-display:swap;src:local("GmarketSans${w}"),local("Gmarket Sans ${w}"),${u(w)}}`).join('\n');
  document.head.appendChild(st);
}
/* 디자인 그림: 한 번 받은 그림은 기기에 저장해 두고 다음부터는 바로 보여 줘요 */
const IMG = {};
function imgTag(id, cls, alt){ return id ? `<img class="${cls}" data-sjimg="${esc(id)}" alt="${esc(alt || '')}" ${IMG[id] ? `src="${IMG[id]}"` : ''}>` : ''; }
async function getImg(id){
  if (IMG[id]) return IMG[id];
  let src = await DG.PDB.get(id);
  if (!src){ src = X.mode === 'admin' ? await call('getPhoto', DG.S.pw, id) : await call('sjPhoto', X.exhId, id); DG.PDB.put(id, src); }
  IMG[id] = src; return src;
}
function loadImgs(scope){
  (scope || root).querySelectorAll('img[data-sjimg]:not([src])').forEach(im => { const id = im.dataset.sjimg; getImg(id).then(s => { root.querySelectorAll(`img[data-sjimg="${id}"]`).forEach(x => x.src = s); }).catch(() => im.classList.add('broken')); });
}

/* ---------- 시간 · 고르게 나누기 계산 (독립 상주 사이트와 같은 규칙) ---------- */
function hourSpan(days){ let lo = 24, hi = 0; days.forEach(d => { if (d.close > d.open){ lo = Math.min(lo, d.open); hi = Math.max(hi, d.close); } }); return lo < hi ? [lo, hi] : [10, 18]; }
function validKeys(days){ const s = new Set(); days.forEach(d => { for (let h = d.open; h < d.close; h++) s.add(key(d.date, h)); }); return s; }
function rangesOf(set, days){
  const out = [];
  days.forEach(d => {
    const rs = []; let st = null;
    for (let h = d.open; h <= d.close; h++){
      const on = h < d.close && set.has(key(d.date, h));
      if (on && st == null) st = h;
      if (!on && st != null){ rs.push([st, h]); st = null; }
    }
    if (rs.length) out.push({date: d.date, rs});
  });
  return out;
}
function rangesText(set, days){ return rangesOf(set, days).map(x => fmtDate(x.date) + ' ' + x.rs.map(r => fmtRange(r[0], r[1])).join(', ')).join('\n'); }
const LEN_OPTS = [1, 2, 3, 4, 'half'];
function lenLabel(L){ return L === 'half' ? '반나절 (하루 2타임)' : L + '시간'; }
function buildSlots(days, L){
  const out = [];
  days.forEach(d => {
    const span = d.close - d.open; if (span <= 0) return;
    const len = L === 'half' ? Math.ceil(span / 2) : +L;
    for (let s = d.open; s < d.close; s += len){ const e = Math.min(s + len, d.close); out.push({date: d.date, start: s, end: e, h: e - s}); }
  });
  return out;
}
function prepPeople(resps, days){
  const v = validKeys(days);
  return resps.map(r => ({sid: r.sid, name: r.name, set: new Set((r.avail || []).filter(k => v.has(k)))})).filter(p => p.set.size);
}
function canDo(p, s){ for (let h = s.start; h < s.end; h++) if (!p.set.has(key(s.date, h))) return false; return true; }
function candOf(s, people){ return people.filter(p => canDo(p, s)).map(p => p.sid); }
function neighbors(slots){
  const n = slots.length;
  return slots.map((s, i) => ({
    prev: i > 0 && slots[i-1].date === s.date && slots[i-1].end === s.start ? i - 1 : -1,
    next: i < n - 1 && slots[i+1].date === s.date && slots[i+1].start === s.end ? i + 1 : -1
  }));
}
function solve(slots, people, k, mode, seed){
  const n = slots.length;
  const cand = slots.map(s => candOf(s, people));
  const nb = neighbors(slots);
  const avgH = n ? slots.reduce((a, s) => a + s.h, 0) / n : 1;
  const W = mode === 'join' ? -avgH * avgH * 0.9 : mode === 'apart' ? avgH * avgH * 1.5 : 0;
  let best = null;
  for (let r = 0; r < 30; r++){
    const rnd = mulberry32(seed * 7919 + r + 1);
    const asg = slots.map(() => []); const load = {}; people.forEach(p => load[p.sid] = 0);
    const adj = (i, sid) => (nb[i].prev >= 0 && asg[nb[i].prev].includes(sid) ? 1 : 0) + (nb[i].next >= 0 && asg[nb[i].next].includes(sid) ? 1 : 0);
    const tie = slots.map(() => rnd());
    const order = [...slots.keys()].sort((a, b) => (cand[a].length - cand[b].length) || (tie[a] - tie[b]));
    for (const i of order){
      const pool = cand[i].slice();
      while (asg[i].length < k && pool.length){
        let bj = 0, bv = Infinity;
        for (let j = 0; j < pool.length; j++){ const sid = pool[j], l = load[sid]; const v = (l + slots[i].h) ** 2 - l * l + W * adj(i, sid) + rnd() * 0.8; if (v < bv){ bv = v; bj = j; } }
        const sid = pool.splice(bj, 1)[0]; asg[i].push(sid); load[sid] += slots[i].h;
      }
    }
    let improved = true, pass = 0;
    while (improved && pass++ < 80){
      improved = false;
      for (let i = 0; i < n; i++){
        const h = slots[i].h;
        for (let a = 0; a < asg[i].length; a++){
          const p = asg[i][a];
          for (const q of cand[i]){
            if (asg[i].includes(q)) continue;
            const lp = load[p], lq = load[q];
            const d = ((lp - h) ** 2 + (lq + h) ** 2) - (lp * lp + lq * lq) + W * (adj(i, q) - adj(i, p));
            if (d < -1e-9){ asg[i][a] = q; load[p] -= h; load[q] += h; improved = true; break; }
          }
        }
      }
    }
    const objective = () => {
      let unfilled = 0, sq = 0, adjT = 0;
      asg.forEach((x, i) => { unfilled += Math.max(0, k - x.length); if (nb[i].next >= 0) x.forEach(sid => { if (asg[nb[i].next].includes(sid)) adjT++; }); });
      Object.values(load).forEach(l => sq += l * l);
      return unfilled * 1e9 + sq + W * adjT;
    };
    // 이어 바꾸기: 많이 맡은 사람 → A가 대신 → A의 다른 타임은 B가 대신 … → 적게 맡은 사람
    let cur = objective(), guard = 0, changed = true;
    while (changed && guard++ < 300){
      changed = false;
      const order2 = Object.keys(load).sort((a, b) => load[b] - load[a]);
      for (const P of order2){
        const prev = {}; prev[P] = null; const queue = [P];
        while (queue.length && !changed){
          const A = queue.shift();
          for (let i = 0; i < n && !changed; i++){
            if (!asg[i].includes(A)) continue;
            for (const B of cand[i]){
              if (B in prev || asg[i].includes(B)) continue;
              prev[B] = {from: A, slot: i}; queue.push(B);
              if (load[B] + slots[i].h >= load[P]) continue;
              const saveA = asg.map(x => x.slice()), saveL = Object.assign({}, load);
              let x = B;
              while (prev[x]){ const st = prev[x]; const s = asg[st.slot]; s[s.indexOf(st.from)] = x; load[st.from] -= slots[st.slot].h; load[x] += slots[st.slot].h; x = st.from; }
              const nv = objective();
              if (nv < cur - 1e-9){ cur = nv; changed = true; break; }
              saveA.forEach((v, j) => asg[j] = v); Object.assign(load, saveL);
            }
          }
        }
        if (changed) break;
      }
    }
    const score = cur;
    if (!best || score < best.score - 1e-9) best = {score, asg: asg.map(x => x.slice())};
  }
  return best ? best.asg : [];
}
function compareLens(days, people, k){
  return LEN_OPTS.map(L => {
    const slots = buildSlots(days, L);
    const lens = new Set(slots.map(s => s.h));
    const need = slots.reduce((a, s) => a + s.h * k, 0);
    const short = slots.filter(s => candOf(s, people).length < k).length;
    return {L, n: slots.length, need, per: people.length ? need / people.length : 0, perSlots: people.length ? slots.length * k / people.length : 0, short, lens};
  }).filter(x => {
    // 반나절이 1~4시간 보기와 똑같이 나오면 빼요
    if (x.L !== 'half') return true;
    return !(x.lens.size === 1 && [1, 2, 3, 4].includes([...x.lens][0]));
  });
}
function loadsOf(result){
  const m = {};
  (result.slots || []).forEach(s => (s.sids || []).forEach(sid => { m[sid] = m[sid] || {n: 0, h: 0}; m[sid].n++; m[sid].h += s.end - s.start; }));
  return m;
}
function displayNames(result){
  // 같은 이름이 둘이면 학번 뒤 2자리를 붙여요
  const names = result.names || {}; const cnt = {};
  Object.values(names).forEach(n => cnt[normName(n)] = (cnt[normName(n)] || 0) + 1);
  const out = {};
  Object.entries(names).forEach(([sid, n]) => out[sid] = cnt[normName(n)] > 1 ? `${n}(${sid.slice(-2)})` : n);
  return out;
}
function iso(t){ return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`; }
function periodLines(days){
  // 시간이 같은 날끼리 묶어요: 12월 24–25일 11:00–18:00
  const out = [];
  days.forEach(d => {
    const last = out[out.length - 1], t = dObj(d.date);
    const prev = last && dObj(last.to.date); if (prev) prev.setDate(prev.getDate() + 1);
    if (last && last.open === d.open && last.close === d.close && prev && iso(prev) === d.date) last.to = d;
    else out.push({from: d, to: d, open: d.open, close: d.close});
  });
  return out.map(g => {
    const f = dObj(g.from.date), t = dObj(g.to.date);
    const ds = g.from === g.to ? `${f.getMonth()+1}월 ${f.getDate()}일` : (f.getMonth() === t.getMonth() ? `${f.getMonth()+1}월 ${f.getDate()}–${t.getDate()}일` : `${f.getMonth()+1}월 ${f.getDate()}일 – ${t.getMonth()+1}월 ${t.getDate()}일`);
    return `${ds} ${fmtRange(g.open, g.close)}`;
  });
}
function mySlots(r, name){
  const me = normName(name); if (!me || !r) return [];
  return r.slots.filter(s => s.names.some(n => normName(n).replace(/\(\d\d\)$/, '') === me));
}

const CSS = "*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}\n:host{--taupe:var(--line);display:block;margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);font-size:14px;line-height:1.55;word-break:keep-all;min-height:100vh;position:relative;text-align:left}\nbutton,input,select,textarea{font:inherit;color:inherit}\na{color:inherit}\n::selection{background:var(--ink);color:var(--bg)}\n.top{background:var(--bg);padding:16px 28px 12px;position:sticky;top:0;z-index:20}\n.top .in{max-width:880px;margin:0 auto;display:flex;align-items:center;gap:12px;font-size:11.5px;color:var(--muted)}\n.top .mk{width:30px;height:26px;flex:none;cursor:pointer;background:none;border:none;padding:0}\n.top .mk img{width:100%;height:100%;display:block;object-fit:contain;filter:var(--logo-filter)}\n.top .ttl{font-weight:300;letter-spacing:-.01em}\n.top .ln{flex:1;height:1px;background:var(--dim);min-width:20px}\n.top .ttl{cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%}\n.top .back{background:none;border:1px solid var(--line);color:var(--ink);border-radius:999px;padding:3px 12px;font-size:11.5px;cursor:pointer;flex:none}\n.demo-x{background:var(--taupe);color:#211d19;text-align:center;font-size:11.5px;padding:5px 10px;font-weight:500}\n.main{max-width:880px;margin:0 auto;padding:14px 28px 40px;position:relative}\nh1{font-family:var(--head-font);font-size:18.5px;line-height:1.3;margin:6px 0 8px;letter-spacing:-.02em;font-weight:700;color:var(--ink)}\nh2{font-family:var(--head-font);font-size:16.5px;margin:0 0 10px;letter-spacing:-.01em;font-weight:700}\nh3{font-size:14px;margin:0 0 8px;font-weight:700}\nb,strong{font-weight:700}\n.muted{color:var(--muted)}\n.small{font-size:12px}\n.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:18px;margin:0 0 14px}\n.notice{white-space:pre-wrap;border-left:2px solid var(--accent);padding:2px 0 2px 12px;font-size:12.5px;color:var(--muted);margin:12px 0 0}\n.chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:500;border:1px solid var(--line);color:var(--muted)}\n.chip.on{border-color:var(--ink);color:var(--ink)}\n.chip.on::before{content:\"\";width:6px;height:6px;border-radius:50%;background:var(--ink)}\n.chip.off{color:var(--dim)}\n.chip.warn{border-color:var(--red);color:var(--red)}\n.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--dim);background:transparent;color:var(--ink);border-radius:var(--r);padding:11px 16px;font-weight:500;cursor:pointer;text-decoration:none;min-height:44px}\n.btn.primary,.btn.lime{background:var(--accent);border-color:var(--accent);color:var(--on-accent);font-weight:700}\n.btn.ghost{border-color:var(--line)}\n.btn.danger{border-color:var(--red);color:var(--red)}\n.btn.danger.armed{background:var(--red);color:var(--bg)}\n.btn.sm{min-height:36px;padding:6px 12px;font-size:12px;border-radius:10px}\n.btn.block{display:flex;width:100%}\n.btn:disabled{opacity:.4;cursor:default}\n.btn:focus-visible,.inp:focus-visible,.cell:focus-visible,.tabs button:focus-visible{outline:2px solid var(--hi);outline-offset:2px}\n.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}\n.stack>*+*{margin-top:10px}\nlabel.f{display:block;font-size:11.5px;font-weight:500;margin:0 0 6px;color:var(--muted)}\n.inp{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--bg-deep);color:var(--ink);min-height:44px;font-size:15px}\n.inp:focus{outline:none;border-color:var(--ink)}\n.inp::placeholder{color:var(--dim)}\n.inp:disabled{opacity:.6}\ntextarea.inp{min-height:84px;resize:vertical}\nselect.inp{appearance:auto;color-scheme:var(--scheme)}\ninput[type=date].inp,input[type=color]{color-scheme:var(--scheme)}\n.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}\n.err{color:var(--red);font-size:12px;margin-top:6px;min-height:1em}\n.hr{height:1px;background:var(--line);margin:16px 0}\n.glow{height:2px;background:var(--glow-h);margin:12px -28px 0}\n.foot{text-align:center;color:var(--dim);font-size:11px;padding:10px 0 30px;position:relative;z-index:1}\n.foot button{background:none;border:none;color:var(--muted);text-decoration:underline;cursor:pointer;font-size:11.5px;padding:6px}\n\n/* 첫 화면 */\n.hero{display:block;max-width:420px;height:auto;margin:18px 0 clamp(28px,9vh,90px) 0}\n.thero{margin:34px 0 clamp(28px,9vh,90px)}\n.thero .k{font-size:13px;color:var(--tag);letter-spacing:.02em;font-weight:600}\n.thero .t{font-family:var(--head-font);font-size:clamp(34px,11vw,56px);font-weight:700;line-height:1.08;letter-spacing:-.03em;color:var(--ink);margin-top:6px;word-break:keep-all}\n.thero .bar{display:block;width:96px;height:5px;background:var(--accent);margin-top:16px;border-radius:2px}\n.grain{position:fixed;right:0;bottom:0;width:min(100%,1100px);pointer-events:none;z-index:0}\n.grain img{width:100%;height:auto;display:block}\n.main>*{position:relative;z-index:1}\n.when{font-size:12.5px;font-weight:500;line-height:1.8;margin:6px 0 0;color:var(--muted);letter-spacing:-.01em}\n\n/* 시간 격자 */\n.gwrap{overflow-x:auto;margin:0 -4px;padding:0 4px 4px}\n.tgrid{display:grid;gap:4px;user-select:none;-webkit-user-select:none;min-width:100%}\n.tgrid .hd{font-size:11px;font-weight:700;text-align:center;line-height:1.25;padding:2px 0 4px}\n.tgrid .hd .wd{display:block;font-weight:400;color:var(--muted)}\n.tgrid .hd.sun,.tgrid .hd.sun .wd{color:var(--red)}\n.tgrid .hl{font-size:11px;color:var(--muted);text-align:right;padding-right:4px;transform:translateY(-8px);font-variant-numeric:tabular-nums}\n.tgrid .allday{display:block;margin:5px auto 0;font-size:11px;border:1px solid var(--line);background:transparent;border-radius:8px;padding:2px 6px;cursor:pointer;font-weight:500;color:var(--muted)}\n.cell{height:40px;border-radius:7px;background:var(--bg-deep);border:1px solid var(--line);touch-action:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums;transition:background .08s;color:var(--ink)}\n.cell.on{background:var(--accent);border-color:var(--accent)}\n.cell.x{background:repeating-linear-gradient(135deg,transparent 0 5px,var(--soft) 5px 10px);border-color:transparent;cursor:default}\n.cell.heat{cursor:pointer;touch-action:auto}\n.cell.short{box-shadow:inset 0 0 0 2px var(--red)}\n.cell.pick{outline:2px solid var(--hi);outline-offset:1px}\n.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--muted);margin:10px 0 0}\n.legend i{display:inline-block;width:14px;height:14px;border-radius:4px;vertical-align:-2px;margin-right:5px;border:1px solid var(--line);background:var(--bg-deep)}\n.sumline{font-size:12px;margin-top:10px}\n.sumline b{font-variant-numeric:tabular-nums}\n\n/* 탭 */\n.tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin:0 0 16px;overflow-x:auto}\n.tabs button{flex:1;border:none;background:none;padding:10px 10px 11px;font-weight:500;cursor:pointer;white-space:nowrap;color:var(--dim);border-bottom:2px solid transparent;margin-bottom:-1px}\n.tabs button.on{color:var(--ink);border-bottom-color:var(--ink);font-weight:700}\n.seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}\n.seg button{background:none;border:none;padding:6px 14px;font-size:12px;color:var(--dim);cursor:pointer;min-height:36px}\n.seg button.on{background:var(--accent);color:var(--on-accent);font-weight:700}\n\n/* 시간표: 목록 */\n.day{margin:0 0 14px}\n.day h3{display:flex;align-items:center;gap:8px;margin:0 0 8px}\n.slot{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line)}\n.slot:first-of-type{border-top:none}\n.slot .tm{width:104px;flex:none;font-weight:700;font-variant-numeric:tabular-nums;font-size:13px}\n.slot .ppl{display:flex;flex-wrap:wrap;gap:6px;flex:1;min-width:0}\n.slot.edit{cursor:pointer;border-radius:10px;margin:0 -8px;padding:10px 8px}\n.slot.edit:hover{background:var(--soft)}\n.slot.open{background:var(--soft)}\n.pp{border:1px solid var(--line);border-radius:6px;padding:1px 8px;font-size:12.5px;font-weight:500}\n.pp.me{background:var(--accent);border-color:var(--accent);color:var(--on-accent);font-weight:700}\n.pp.miss{border-style:dashed;border-color:var(--warm);color:var(--warm);font-size:11.5px}\n.editbox{background:var(--bg-deep);border:1px solid var(--line);border-radius:12px;padding:12px;margin:4px 0 10px}\n.ck{display:flex;align-items:center;gap:10px;padding:7px 4px;border-radius:8px;cursor:pointer}\n.ck:hover{background:var(--soft)}\n.ck input{width:20px;height:20px;accent-color:var(--ink)}\n.ck .ld{margin-left:auto;font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}\n\n/* 시간표: 표 */\n.ttab{width:100%;border-collapse:collapse;table-layout:fixed}\n.ttab th{font-size:11px;font-weight:500;color:var(--muted);text-align:left;padding:0 6px 7px}\n.ttab th.sun{color:var(--red)}\n.ttab td{border-top:1px solid var(--line);padding:8px 6px;vertical-align:top;font-size:12px;line-height:1.6}\n.ttab td.t{color:var(--muted);font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap}\n.ttab td.none{background:repeating-linear-gradient(135deg,transparent 0 5px,var(--soft) 5px 10px)}\n.ttab .me{background:var(--accent);color:var(--on-accent);border-radius:4px;padding:0 5px;font-weight:700}\n.ttab .miss{color:var(--warm);font-size:11px}\n.ttwrap{overflow-x:auto;margin:0 -6px}\n\ntable.t{width:100%;border-collapse:collapse;font-size:12.5px}\ntable.t th,table.t td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}\ntable.t th{font-size:11.5px;color:var(--muted);font-weight:500}\ntable.t td.n,table.t th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}\ntable.t tr.sel td{background:var(--soft)}\ntable.t tr.sel td:first-child{box-shadow:inset 2px 0 0 var(--ink)}\ntable.t tr.click{cursor:pointer}\n.bar{height:6px;background:var(--bg-deep);border-radius:3px;overflow:hidden;min-width:50px}\n.bar>i{display:block;height:100%;background:var(--ink)}\n.dayrow{display:grid;grid-template-columns:minmax(0,1fr) 92px 92px 40px;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)}\n.dayrow .inp{min-height:40px;padding:6px 8px}\n.x-btn{border:none;background:var(--soft);border-radius:10px;height:40px;cursor:pointer;font-size:16px;color:var(--muted)}\n.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);background:var(--accent);color:var(--on-accent);padding:11px 18px;border-radius:12px;font-size:13px;font-weight:500;opacity:0;transition:.2s;pointer-events:none;z-index:50;max-width:90vw;text-align:center}\n.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}\n.loading{padding:60px 0;text-align:center;color:var(--muted)}\n.big{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em}\n.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}\n.stats>div{border-top:1px solid var(--line);padding:10px 2px 0}\n.stats .lb{font-size:11px;color:var(--muted)}\n.mylist{margin:8px 0 0;padding:0;list-style:none}\n.mylist li{padding:4px 0;font-weight:700}\ndetails>summary{cursor:pointer;color:var(--muted);font-size:12px;padding:6px 0}\n@media (max-width:560px){\n  .grid2{grid-template-columns:minmax(0,1fr)}\n  .slot .tm{width:92px;font-size:12px}\n  .stats .big{font-size:19px}\n  .dayrow{grid-template-columns:minmax(0,1fr) 78px 78px 36px}\n}\n@media (max-width:480px){ .top .en{display:none} }\n@media (prefers-reduced-motion:reduce){ *{transition:none!important} }\n\n/* 임원진 · 디자인 */\n.atop{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 6px}\n.atop .sp{flex:1}\n.swrow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}\n.sw{display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--muted)}\n.sw input[type=color]{width:100%;height:42px;border:1px solid var(--line);border-radius:10px;background:var(--bg-deep);padding:3px;cursor:pointer}\n.crop{position:relative;user-select:none;-webkit-user-select:none;touch-action:none;border-radius:8px;overflow:hidden;border:1px solid var(--line);max-width:520px;cursor:crosshair}\n.crop img{display:block;width:100%;height:auto;pointer-events:none}\n.crop .sel{position:absolute;border:2px solid var(--accent);box-shadow:0 0 0 9999px rgba(0,0,0,.45);display:none}\n.thumbs{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}\n.thumb{border:1px solid var(--line);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;min-height:96px}\n.thumb img{max-width:100%;max-height:120px;object-fit:contain;align-self:flex-start;border-radius:4px}\n.thumb .lb{font-size:12px;color:var(--muted)}\n.pv{border:1px solid var(--line);border-radius:22px;overflow:hidden;max-width:300px;background:var(--bg);color:var(--ink);font-family:var(--font);position:relative}\n.pv .pvin{padding:16px 18px 20px;position:relative;z-index:1}\n.pv .hero{margin:10px 0 18px}\n.pv .thero{margin:14px 0 18px}.pv .thero .t{font-size:30px}\n.pv .grain{position:absolute}\n.pv h1{font-size:16px}\n.pv .btn{min-height:38px;font-size:13px}\n.radio{display:flex;gap:8px;flex-wrap:wrap}\n.radio label{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:10px;padding:9px 12px;cursor:pointer;font-size:13.5px}\n.radio label:has(input:checked){border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}\n.radio input{accent-color:var(--accent)}\ninput[type=range]{width:100%;accent-color:var(--accent)}\nimg.broken{display:none}\n@media (max-width:560px){ .swrow{grid-template-columns:repeat(2,minmax(0,1fr))} .thumbs{grid-template-columns:minmax(0,1fr)} }\n";

/* ---------- 화면 틀 ---------- */
const S = { pub: null, view: 'home', admin: null, me: lsGet('dg_sj_me', {name: '', sid: ''}) };
function mount(){
  host = document.getElementById('v-sangju');
  if (!host.shadowRoot){
    root = host.attachShadow({mode: 'open'});
    const st = document.createElement('style'); st.textContent = CSS; root.appendChild(st);
    const wrap = document.createElement('div'); wrap.innerHTML = `<div class="grain" id="grain" aria-hidden="true"></div><header class="top"><div class="in" id="topIn"></div></header><div class="main" id="app"></div><div class="foot" id="foot"></div><div class="toast" id="toast" role="status"></div>`;
    while (wrap.firstChild) root.appendChild(wrap.firstChild);
  } else root = host.shadowRoot;
  if (!document.getElementById('sj-global')){
    const g = document.createElement('style'); g.id = 'sj-global';
    g.textContent = 'body[data-view="sangju"]{background:var(--sj-bg,#141414)!important}body[data-view="sangju"] main.wrap{max-width:none;padding:0;margin:0}#v-sangju{display:block}#v-sangju[hidden]{display:none}';
    document.head.appendChild(g);
  }
}
function drawChrome(){
  const t = T(), title = S.pub ? (S.pub.cfg.title || S.pub.ex.title) : '';
  $('#topIn').innerHTML = X.mode === 'admin'
    ? `<button class="mk" aria-label="전시회 화면으로" onclick="SJ.back()"><img src="logo.png" alt=""></button><span class="ln"></span><span class="ttl">임원진 · 전시 상주</span><button class="back" onclick="SJ.back()">← 전시회로</button>`
    : `<button class="mk" aria-label="처음으로" onclick="SJ.go('home')"><img src="logo.png" alt=""></button><span class="ln"></span><span class="ttl" onclick="SJ.go('home')">${esc(title || '전시 상주')}</span>${X.backToAdmin ? `<button class="back" onclick="SJ.back()">← 임원진 화면</button>` : S.view !== 'home' ? `<button class="back" onclick="SJ.go('home')">처음으로</button>` : ''}`;
  $('#grain').innerHTML = t.mode === 'poster' && t.pattern ? imgTag(t.pattern, '', '') : '';
  $('#foot').innerHTML = `<div>도각도각 · 목방 목공 동아리</div>`;
  loadImgs();
}
function heroHTML(t, title){
  t = t || T();
  if (t.mode === 'poster' && t.title) return imgTag(t.title, 'hero', title).replace('class="hero"', `class="hero" style="width:calc(${t.titleW || 72}% + 28px);margin-left:-28px"`);
  return `<div class="thero"><div class="k">목방 전시회</div><div class="t">${esc(title)}</div><span class="bar"></span></div>`;
}
function go(v){ S.view = v || 'home'; render(); }
function render(){
  setTop(); drawChrome(); window.scrollTo(0, 0);
  if (X.mode === 'admin') return adminMain();
  if (S.view === 'form') return viewForm();
  if (S.view === 'table') return viewTable();
  viewHome();
}

/* ---------- 부원: 첫 화면 ---------- */
function viewHome(){
  const c = S.pub.cfg, r = S.pub.result;
  const days = c.days || [];
  const mine = mySlots(r, S.me.name);
  const title = c.title || S.pub.ex.title;
  $('#app').innerHTML = `
  ${heroHTML(T(), title)}
  <h1>상주 시간표</h1>
  ${days.length ? `<p class="when">${periodLines(days).map(esc).join('<br>')}</p>` : '<p class="muted">전시 날짜가 아직 정해지지 않았어요.</p>'}
  <p class="muted small" style="margin:4px 0 0">${c.open ? `가능한 시간 받는 중 · 지금 ${S.pub.count || 0}명 응답` : '지금은 가능한 시간을 받지 않아요'}${r ? ' · 시간표 나왔어요' : ''}</p>
  ${c.notice ? `<div class="notice">${esc(c.notice)}</div>` : ''}
  ${mine.length ? `<div class="card" style="margin:20px 0 0"><div class="muted small">${esc(S.me.name)} 님의 상주</div>${mine.map(s => `<div style="font-weight:700;margin-top:2px">${esc(fmtDate(s.date))} ${fmtRange(s.start, s.end)}</div>`).join('')}</div>` : ''}
  <div class="stack" style="margin-top:36px">
    <button class="btn primary block" onclick="SJ.go('form')" ${days.length ? '' : 'disabled'}>${c.open ? '내 가능한 시간 적기' : '내가 적은 시간 보기'}</button>
    ${r ? `<button class="btn block" onclick="SJ.go('table')">확정된 시간표 보기</button>` : `<p class="muted small" style="text-align:center;margin-top:12px">시간표가 나오면 이 화면에서 볼 수 있어요.</p>`}
  </div>`;
  loadImgs();
}

/* ---------- 부원 링크로 열기 ---------- */
async function member(exhId){
  mount(); X.mode = 'member'; X.exhId = exhId || ''; S.view = 'home';
  if (!LIVE){ try { const I = await DG.api('exhInfo'); X.demoTitles = {}; (I.list || []).forEach(e => X.demoTitles[e.id] = e.title); if (!X.exhId) X.exhId = ((I.list || [])[0] || {}).id || ''; } catch(e){} }
  const cached = X.exhId ? lsGet(pubKey(), null) : null;
  if (cached && cached.cfg){
    S.pub = cached; applyTheme(cached.theme); render();
    const before = JSON.stringify(cached);
    loadPub().then(p => { if (JSON.stringify(p) !== before && X.mode === 'member' && (S.view === 'home' || S.view === 'table')) render(); }).catch(() => {});
    return;
  }
  applyTheme(null); drawChrome();
  $('#app').innerHTML = `<p class="muted small" style="margin-top:40px">불러오는 중…</p>`;
  try { await loadPub(); render(); }
  catch(e){ $('#app').innerHTML = `<div class="card" style="margin-top:30px"><h2>불러오지 못했어요</h2><p class="muted">${esc(e.message)}</p><button class="btn" onclick="location.reload()">다시 시도</button></div>`; }
}

/* ---------- 임원진 ---------- */
async function adminReload(){ S.admin = await call('sjAdmin', DG.S.pw, X.exhId); }
async function adminWrite(fn, ...args){ S.admin = await call(fn, DG.S.pw, X.exhId, ...args); }
async function admin(exhId, ex){
  mount(); X.mode = 'admin'; X.exhId = exhId; X.ex = ex || null; S.tab = S.tab || 'set'; S.draft = null; S.distOpt = null; S.td = null;
  const ck = 'dg_sj_adm_' + exhId;
  const cached = DG.cacheGet ? DG.cacheGet(DG.PWK, ck) : null;
  if (cached){ S.admin = cached; applyTheme(cached.theme); render(); }
  else { applyTheme(null); drawChrome(); $('#app').innerHTML = `<p class="muted small" style="margin-top:40px">불러오는 중…</p>`; }
  try { await adminReload(); if (DG.cacheSet) DG.cacheSet(DG.PWK, ck, S.admin); if (X.mode !== 'admin') return; applyTheme(S.admin.theme); if (!cached || !typing()) render(); }
  catch(e){ if (!cached) $('#app').innerHTML = `<div class="card" style="margin-top:30px"><h2>불러오지 못했어요</h2><p class="muted">${esc(/알 수 없는 요청/.test(e.message) ? '상주 시간표는 앱스 스크립트에 Sangju.gs를 넣고 [새 버전]으로 배포하면 열려요.' : e.message)}</p></div>`; }
}
const typing = () => { const a = root.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
function syncPub(){
  // 임원진이 바꾼 내용을 부원 화면 저장본에도 바로 반영해요
  const A = S.admin; if (!A) return;
  S.pub = { ex: {id: A.ex.id, title: A.ex.title}, cfg: {title: A.cfg.title, notice: A.cfg.notice, open: A.cfg.open, k: A.cfg.k, days: A.cfg.days}, theme: A.theme, count: A.responses.length, result: null };
  if (DG.cacheSet) DG.cacheSet(DG.PWK, 'dg_sj_adm_' + X.exhId, A);
}
function adminMain(){
  const A = S.admin; syncPub();
  if (S.tab !== 'design' && X.themeNow !== fullTheme(A.theme) && S.td){ applyTheme(A.theme); drawChrome(); }
  const title = A.cfg.title || A.ex.title;
  $('#app').innerHTML = `
  <div class="atop"><h1 style="margin:0">${esc(title)}</h1><span class="sp"></span>
    <button class="btn ghost sm" onclick="SJ.adminRefresh()">새로고침</button>
    <button class="btn ghost sm" onclick="SJ.preview()">부원 화면 보기</button>
    <button class="btn ghost sm" onclick="SJ.copyText(SJ.link(),'상주 링크를 복사했어요')">링크 복사</button></div>
  ${A.url ? `<p class="muted small" style="margin:0 0 12px">응답은 <a href="${esc(A.url)}" target="_blank" rel="noopener">'${esc(A.ex.title)} 출품' 시트</a>의 '상주' 탭에 쌓여요.</p>` : ''}
  <div class="tabs">
    <button data-t="set">설정</button><button data-t="resp">응답 ${A.responses.length}명</button><button data-t="dist">배분 · 공개</button><button data-t="design">디자인</button>
  </div>
  <div id="tab"></div>`;
  root.querySelectorAll('.tabs button').forEach(b => { b.classList.toggle('on', b.dataset.t === S.tab); b.onclick = () => { S.tab = b.dataset.t; adminMain(); }; });
  ({set: tabSet, resp: tabResp, dist: tabDist, design: tabDesign})[S.tab]();
}
async function adminRefresh(){ try { await adminReload(); S.draft = null; S.td = null; applyTheme(S.admin.theme); render(); toast('새로 불러왔어요'); } catch(e){ toast(e.message); } }
function preview(){ X.mode = 'member'; S.view = 'home'; X.backToAdmin = true; render(); refreshPubLater(); toast('부원에게 보이는 화면이에요. 오른쪽 위 [← 임원진 화면]으로 돌아가요'); }
function back(){
  if (X.mode === 'member' && X.backToAdmin){ X.backToAdmin = false; X.mode = 'admin'; render(); return; }
  DG.openExhDetail(X.exhId);
}

/* ---------- 디자인 탭 ---------- */
function tabDesign(){
  const A = S.admin;
  if (!S.td) S.td = { t: Object.assign({}, DEFAULT_THEME, A.theme && A.theme.mode === 'poster' ? A.theme : {}, {mode: (A.theme && A.theme.mode) || 'default'}), src: null, srcFrom: '', sel: null, pend: {} };
  const D = S.td, t = D.t, poster = t.mode === 'poster';
  applyTheme(previewTheme()); drawChrome();
  $('#tab').innerHTML = `
  <div class="card stack">
    <h2>디자인</h2>
    <div class="radio" role="radiogroup">
      <label><input type="radio" name="dm" value="default" ${!poster ? 'checked' : ''}> 기본 (도각도각 디자인)</label>
      <label><input type="radio" name="dm" value="poster" ${poster ? 'checked' : ''}> 포스터에 맞추기</label>
    </div>
    <p class="muted small" style="margin:0">${poster ? '포스터에서 색을 뽑고, 제목과 배경 무늬를 잘라 써요. 바꾸면 이 화면에 바로 보여요. [디자인 저장하기]를 눌러야 부원에게 보여요.' : '도각도각 원래 디자인 그대로예요 (밝은 · 어두운 테마도 도각도각을 따라가요). 제목은 전시회 이름이 글자로 크게 나와요.'}</p>
  </div>
  ${poster ? `
  <div class="card stack">
    <h2>포스터 그림</h2>
    <div class="row">
      ${A.ex.poster ? `<button class="btn sm" id="dUseEx">전시회 포스터 쓰기</button>` : ''}
      <label class="btn sm">다른 그림 올리기<input type="file" accept="image/*" id="dFile" hidden></label>
      ${D.src ? `<button class="btn sm" id="dAuto">포스터에서 색 뽑기</button>` : ''}
    </div>
    ${D.src ? `<p class="muted small" style="margin:0">그림 위를 손가락이나 마우스로 끌어서 네모를 그린 뒤, 아래 버튼으로 제목이나 무늬로 써요.</p>
      <div class="crop" id="crop"><img src="${D.src}" alt="포스터"><div class="sel" id="sel"></div></div>
      <div class="row"><button class="btn sm primary" id="dTitle" disabled>고른 부분을 제목으로</button><button class="btn sm" id="dPat" disabled>고른 부분을 배경 무늬로</button></div>`
    : `<p class="muted small" style="margin:0">${A.ex.poster ? '[전시회 포스터 쓰기]를 누르면 전시회에 올려 둔 포스터를 불러와요.' : '전시회 설정에 포스터가 없어요. [다른 그림 올리기]로 포스터 그림을 골라 주세요.'}</p>`}
    <div class="thumbs">
      <div class="thumb"><span class="lb">제목 그림</span>${D.pend.title ? `<img src="${D.pend.title}" alt="">` : t.title ? imgTag(t.title, '', '제목') : '<span class="muted small">없으면 전시회 이름이 글자로 나와요</span>'}${D.pend.title || t.title ? '<button class="btn sm ghost" id="dTitleRm">빼기</button>' : ''}</div>
      <div class="thumb"><span class="lb">배경 무늬</span>${D.pend.pattern ? `<img src="${D.pend.pattern}" alt="">` : t.pattern ? imgTag(t.pattern, '', '무늬') : '<span class="muted small">없으면 무늬 없이 나와요</span>'}${D.pend.pattern || t.pattern ? '<button class="btn sm ghost" id="dPatRm">빼기</button>' : ''}</div>
    </div>
  </div>
  <div class="card stack">
    <h2>색 · 글꼴</h2>
    <div class="swrow">
      <label class="sw">바탕<input type="color" data-c="bg" value="${t.bg}"></label>
      <label class="sw">글씨<input type="color" data-c="ink" value="${t.ink}"></label>
      <label class="sw">보조 글씨<input type="color" data-c="muted" value="${t.muted}"></label>
      <label class="sw">강조 · 버튼<input type="color" data-c="accent" value="${t.accent}"></label>
    </div>
    <div class="grid2">
      <div><label class="f" for="dFont">글꼴</label><select class="inp" id="dFont">
        <option value="plex" ${t.font === 'plex' ? 'selected' : ''}>기본 (IBM Plex Sans)</option>
        <option value="gmarket" ${t.font === 'gmarket' ? 'selected' : ''}>G마켓 산스</option>
        <option value="batang" ${t.font === 'batang' ? 'selected' : ''}>제목만 고운 바탕</option></select></div>
      <div><label class="f" for="dW">제목 그림 크기 <span id="dWv">${t.titleW}%</span></label><input type="range" id="dW" min="40" max="100" value="${t.titleW}"></div>
    </div>
  </div>` : ''}
  <div class="card">
    <h2>부원 첫 화면 미리보기</h2>
    <div class="pv" id="pv"></div>
  </div>
  <div class="err" id="dErr"></div>
  <button class="btn primary block" id="dSave">디자인 저장하기</button>`;
  drawPreview(); loadImgs();
  root.querySelectorAll('input[name=dm]').forEach(r => r.onchange = () => { t.mode = r.value; livePreview(); tabDesign(); });
  if (!poster) return wireDesignSave();
  const useEx = $('#dUseEx'); if (useEx) useEx.onclick = async () => { useEx.disabled = true; useEx.textContent = '불러오는 중…'; try { D.src = await getImg(A.ex.poster); D.srcFrom = 'ex'; D.sel = null; tabDesign(); } catch(e){ toast(e.message); useEx.disabled = false; useEx.textContent = '전시회 포스터 쓰기'; } };
  $('#dFile').onchange = async e => { const f = e.target.files && e.target.files[0]; if (!f) return; try { D.src = await DG.shrinkImage(f, 1800); D.srcFrom = 'file'; D.sel = null; tabDesign(); } catch(err){ toast(err.message); } };
  const auto = $('#dAuto'); if (auto) auto.onclick = async () => { const p = await palette(D.src); Object.assign(t, p); livePreview(); tabDesign(); toast('포스터에서 색을 뽑았어요. 마음에 안 들면 아래에서 바꿔요'); };
  root.querySelectorAll('input[type=color]').forEach(inp => inp.oninput = () => { t[inp.dataset.c] = inp.value; livePreview(); });
  $('#dFont').onchange = e => { t.font = e.target.value; livePreview(); };
  $('#dW').oninput = e => { t.titleW = +e.target.value; $('#dWv').textContent = t.titleW + '%'; drawPreview(); };
  const rmT = $('#dTitleRm'); if (rmT) rmT.onclick = () => { t.title = ''; delete D.pend.title; livePreview(); tabDesign(); };
  const rmP = $('#dPatRm'); if (rmP) rmP.onclick = () => { t.pattern = ''; delete D.pend.pattern; livePreview(); tabDesign(); };
  if (D.src) wireCrop();
  wireDesignSave();
}
function livePreview(){ applyTheme(previewTheme()); drawChrome(); drawPreview(); }
function previewTheme(){ const D = S.td, t = Object.assign({}, D.t); if (D.pend.title) { t.title = 'pending-title'; IMG['pending-title'] = D.pend.title; } if (D.pend.pattern) { t.pattern = 'pending-pattern'; IMG['pending-pattern'] = D.pend.pattern; } return t; }
function drawPreview(){
  const pv = $('#pv'); if (!pv) return;
  const t = previewTheme(), A = S.admin, f = applyTheme(t, pv), title = A.cfg.title || A.ex.title;
  pv.innerHTML = `${f.mode === 'poster' && f.pattern ? `<div class="grain">${imgTag(f.pattern, '', '')}</div>` : ''}<div class="pvin">
    ${heroHTML(f, title).replace('margin-left:-28px', 'margin-left:-18px').replace('+ 28px', '+ 18px')}
    <h1>상주 시간표</h1>
    <p class="when">${(A.cfg.days || []).length ? periodLines(A.cfg.days).map(esc).join('<br>') : '날짜를 정하면 여기에 나와요'}</p>
    <button class="btn primary block" style="margin-top:16px">내 가능한 시간 적기</button></div>`;
  loadImgs(pv);
}
function wireCrop(){
  const box = $('#crop'), sel = $('#sel'), D = S.td; let st = null;
  const pos = e => { const r = box.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
  const draw = () => { const s = D.sel; if (!s){ sel.style.display = 'none'; return; } sel.style.display = 'block'; sel.style.left = s.x * 100 + '%'; sel.style.top = s.y * 100 + '%'; sel.style.width = s.w * 100 + '%'; sel.style.height = s.h * 100 + '%'; const ok = s.w > 0.03 && s.h > 0.02; $('#dTitle').disabled = $('#dPat').disabled = !ok; };
  box.addEventListener('pointerdown', e => { e.preventDefault(); st = pos(e); D.sel = {x: st[0], y: st[1], w: 0, h: 0}; try { box.setPointerCapture(e.pointerId); } catch(_){} draw(); });
  box.addEventListener('pointermove', e => { if (!st) return; const p = pos(e); D.sel = {x: Math.min(st[0], p[0]), y: Math.min(st[1], p[1]), w: Math.abs(p[0] - st[0]), h: Math.abs(p[1] - st[1])}; draw(); });
  const end = () => { st = null; }; box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  draw();
  $('#dTitle').onclick = async () => { D.pend.title = await cropOut(D.src, D.sel, 1100); D.t.title = ''; D.sel = null; livePreview(); tabDesign(); toast('제목 그림을 넣었어요'); };
  $('#dPat').onclick = async () => { D.pend.pattern = await cropOut(D.src, D.sel, 1100); D.t.pattern = ''; D.sel = null; livePreview(); tabDesign(); toast('배경 무늬를 넣었어요'); };
}
function loadImage(src){ return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('그림을 읽지 못했어요.')); im.src = src; }); }
async function cropOut(src, s, maxW){
  const im = await loadImage(src), W = im.naturalWidth, H = im.naturalHeight;
  const sx = Math.round(s.x * W), sy = Math.round(s.y * H), sw = Math.max(1, Math.round(s.w * W)), sh = Math.max(1, Math.round(s.h * H));
  const k = Math.min(1, maxW / sw), c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  c.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.86);
}
/* 포스터에서 색 뽑기: 가장 많은 색 = 바탕, 바탕과 잘 구분되는 가장 많은 색 = 글씨, 가장 또렷한 색 = 강조 */
async function palette(src){
  const im = await loadImage(src), c = document.createElement('canvas'), n = 96;
  c.width = n; c.height = Math.max(1, Math.round(n * im.naturalHeight / im.naturalWidth));
  const g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height).data, cnt = {};
  // 비슷한 색끼리 묶어 세고, 묶음마다 실제 색의 평균을 써요 (바탕색이 포스터 그림과 딱 맞게)
  for (let i = 0; i < d.length; i += 4){ const k = [d[i], d[i+1], d[i+2]].map(v => Math.round(v / 12)).join(','); const b = cnt[k] || (cnt[k] = {n: 0, r: 0, g: 0, b: 0}); b.n++; b.r += d[i]; b.g += d[i+1]; b.b += d[i+2]; }
  const list = Object.values(cnt).map(v => ({hex: rgbHex([v.r / v.n, v.g / v.n, v.b / v.n]), n: v.n})).sort((a, b) => b.n - a.n);
  const bg = list[0].hex;
  const ink = (list.find(x => contrast(x.hex, bg) >= 4.5 && x.n >= 3) || {hex: lum(bg) < 0.25 ? '#eeeeea' : '#1b1b1a'}).hex;
  const sat = h => { const [r, g2, b] = hexRgb(h).map(v => v / 255), mx = Math.max(r, g2, b), mn = Math.min(r, g2, b); return mx ? (mx - mn) / mx : 0; };
  const acc = list.filter(x => x.n >= 3 && contrast(x.hex, bg) >= 2.2 && sat(x.hex) > 0.18).sort((a, b) => (sat(b.hex) * Math.log(b.n + 1)) - (sat(a.hex) * Math.log(a.n + 1)))[0];
  return { bg, ink, muted: mix(ink, bg, 0.28), accent: acc ? acc.hex : ink };
}
function wireDesignSave(){
  $('#dSave').onclick = async () => {
    const D = S.td, t = D.t, b = $('#dSave'), err = $('#dErr'); err.textContent = '';
    b.disabled = true; b.textContent = '저장하는 중…';
    try {
      for (const k of ['title', 'pattern']) if (D.pend[k]){ t[k] = await call('uploadPhoto', DG.S.pw, D.pend[k], `상주 ${k === 'title' ? '제목' : '무늬'}.jpg`); IMG[t[k]] = D.pend[k]; DG.PDB.put(t[k], D.pend[k]); delete D.pend[k]; }
      await adminWrite('sjSaveTheme', t.mode === 'poster' ? t : {mode: 'default'});
      S.td = null; applyTheme(S.admin.theme); syncPub(); lsSet(pubKey(), Object.assign({}, lsGet(pubKey(), {}), {theme: S.admin.theme})); refreshPubLater();
      toast('디자인을 저장했어요'); render();
    } catch(e){ err.textContent = e.message; b.disabled = false; b.textContent = '디자인 저장하기'; }
  };
}

/* ---------- 부원: 가능한 시간 적기 ---------- */
function viewForm(){
  const c = S.pub.cfg;
  if (!(c.days || []).length){ $('#app').innerHTML = `<div class="card"><h2>아직 전시 날짜가 정해지지 않았어요</h2><p class="muted">임원진이 날짜를 정하면 여기서 시간을 고를 수 있어요.</p></div>`; return; }
  $('#app').innerHTML = `
  <div class="card">
    <h2>1. 누구인지 알려 주세요</h2>
    <p class="muted small" style="margin-top:-4px">이미 적었다면 같은 이름·학번으로 들어오면 고칠 수 있어요.</p>
    <div class="grid2">
      <div><label class="f" for="fName">이름</label><input class="inp" id="fName" maxlength="20" autocomplete="name" value="${esc(S.me.name)}"></div>
      <div><label class="f" for="fSid">학번 (9자리)</label><input class="inp" id="fSid" inputmode="numeric" maxlength="9" value="${esc(S.me.sid)}"></div>
    </div>
    <div class="err" id="fErr"></div>
    <button class="btn primary block" id="fNext" onclick="SJ.formNext()">다음</button>
  </div>
  <div id="fStep2"></div>`;
  $('#fSid').addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g, '').slice(0, 9));
  ['fName','fSid'].forEach(id => $('#'+id).addEventListener('keydown', e => { if (e.key === 'Enter') formNext(); }));
}
async function formNext(){
  const name = $('#fName').value.trim(), sid = $('#fSid').value.trim();
  const err = $('#fErr'); err.textContent = '';
  if (!name) return err.textContent = '이름을 적어 주세요';
  if (!/^\d{9}$/.test(sid)) return err.textContent = '학번은 9자리 숫자로 적어 주세요';
  const b = $('#fNext');
  const done = mine => {
    S.me = {name, sid}; lsSet('dg_sj_me', S.me);
    $('#fName').disabled = $('#fSid').disabled = true;
    b.outerHTML = `<button class="btn ghost sm" onclick="SJ.viewForm()">이름·학번 바꾸기</button>`;
    formStep2(mine);
  };
  // 이 기기에서 낸 적이 있으면 바로 보여 주고, 서버 내용은 뒤에서 확인해요
  const local = lsGet(mineKey(), null);
  if (local && local.sid === sid && normName(local.name) === normName(name)){
    done(local);
    call('sjMine', X.exhId, sid, name).then(m => {
      if (!S.formDirty && m && JSON.stringify([...(m.avail || [])].sort()) !== JSON.stringify([...(local.avail || [])].sort())){ lsSet(mineKey(), Object.assign({sid, name}, m)); formStep2(m); }
    }).catch(() => {});
    return;
  }
  b.disabled = true; b.textContent = '확인하는 중…';
  try { const mine = await call('sjMine', X.exhId, sid, name); if (mine) lsSet(mineKey(), Object.assign({sid, name}, mine)); done(mine); }
  catch(e){ err.textContent = e.message; b.disabled = false; b.textContent = '다음'; }
}
function formStep2(mine){
  const c = S.pub.cfg;
  const sel = new Set((mine && mine.avail) || []);
  const open = !!c.open;
  $('#fStep2').innerHTML = `
  <div class="card">
    <h2>2. 상주할 수 있는 시간을 모두 칠해 주세요</h2>
    <p class="muted small" style="margin-top:-4px">${open ? '칸을 누르거나 손가락으로 쭉 끌면 한꺼번에 칠해져요. 다시 누르면 지워져요. 많이 칠할수록 배분이 고르게 돼요.' : '지금은 받지 않아요. 적어 둔 시간만 볼 수 있어요.'}</p>
    ${mine ? `<p class="small" style="margin:0 0 8px"><span class="chip on">저장된 응답을 불러왔어요</span></p>` : ''}
    <div class="gwrap"><div id="fGrid"></div></div>
    <div class="legend"><span><i style="background:var(--accent);border-color:var(--accent)"></i>가능</span><span><i></i>안 됨</span><span><i style="background:repeating-linear-gradient(135deg,transparent 0 3px,var(--soft) 3px 6px);border-color:transparent"></i>운영 안 하는 시간</span></div>
    <div class="sumline" id="fSum"></div>
    <div class="hr"></div>
    <label class="f" for="fMemo">하고 싶은 말 (선택)</label>
    <textarea class="inp" id="fMemo" maxlength="300" placeholder="예) 25일은 오후 4시 전에 가야 해요 / 같은 날 몰아서 하고 싶어요" ${open ? '' : 'disabled'}>${esc((mine && mine.memo) || '')}</textarea>
    <div class="err" id="fErr2"></div>
    ${open ? `<button class="btn primary block" id="fSave" onclick="SJ.formSave()">${mine ? '고친 내용 저장하기' : '저장하기'}</button>` : ''}
  </div>`;
  S.formSel = sel; S.formDirty = false;
  const upd = () => {
    const ranges = rangesOf(sel, c.days);
    const tot = [...sel].filter(k => validKeys(c.days).has(k)).length;
    $('#fSum').innerHTML = `고른 시간 <b>${tot}시간</b>` + (ranges.length ? '<br><span class="muted">' + ranges.map(x => esc(fmtDate(x.date)) + ' ' + x.rs.map(r => fmtRange(r[0], r[1])).join(', ')).join('<br>') + '</span>' : '');
  };
  drawGrid($('#fGrid'), c.days, {mode: open ? 'edit' : 'view', sel, onChange: () => { S.formDirty = true; upd(); }});
  upd();
  $('#fStep2').scrollIntoView({behavior:'smooth', block:'start'});
}
async function formSave(){
  const c = S.pub.cfg; const err = $('#fErr2'); err.textContent = '';
  const avail = [...S.formSel].filter(k => validKeys(c.days).has(k));
  if (!avail.length) return err.textContent = '가능한 시간을 한 칸 이상 칠해 주세요';
  const b = $('#fSave'); b.disabled = true; b.textContent = '저장하는 중…';
  try {
    const memo = $('#fMemo').value.trim();
    await call('sjSubmit', X.exhId, S.me.sid, S.me.name, avail, memo);
    lsSet(mineKey(), {sid: S.me.sid, name: S.me.name, avail, memo});
    refreshPubLater();
    const set = new Set(avail);
    $('#app').innerHTML = `
    <div class="card">
      <span class="chip on">저장했어요</span>
      <h1 style="margin-top:12px">${esc(S.me.name)}님, 고마워요!</h1>
      <p class="muted">임원진이 모두의 시간을 모아 고르게 나눈 뒤 시간표를 올려요. 바뀌면 같은 이름·학번으로 다시 들어와서 고치면 돼요.</p>
      <div class="notice">${esc(rangesText(set, c.days))}</div>
    </div>
    <div class="stack"><button class="btn block" onclick="SJ.go('form')">다시 고치기</button><button class="btn ghost block" onclick="SJ.go('home')">처음으로</button></div>`;
  } catch(e){ err.textContent = e.message; b.disabled = false; b.textContent = '저장하기'; }
}
function drawGrid(el, days, o){
  const [lo, hi] = hourSpan(days);
  const cols = days.length;
  el.className = 'tgrid';
  el.style.gridTemplateColumns = `44px repeat(${cols}, minmax(${cols > 6 ? 46 : 52}px, 1fr))`;
  let html = '<div></div>';
  days.forEach(d => {
    const t = dObj(d.date);
    html += `<div class="hd ${isSun(d.date) ? 'sun' : ''}">${t.getMonth()+1}/${t.getDate()}<span class="wd">${WD[t.getDay()]}</span>${o.mode === 'edit' ? `<button class="allday" data-day="${d.date}">하루 종일</button>` : ''}</div>`;
  });
  for (let h = lo; h < hi; h++){
    html += `<div class="hl">${fmtH(h)}</div>`;
    days.forEach(d => {
      const k = key(d.date, h);
      if (h < d.open || h >= d.close){ html += `<div class="cell x"></div>`; return; }
      if (o.mode === 'heat'){
        const n = o.counts[k] || 0; const a = o.max ? n / o.max : 0;
        const bg = n ? hexA(T().accent, 0.12 + a * 0.8) : 'var(--bg-deep)';
        html += `<div class="cell heat ${n < o.k ? 'short' : ''} ${o.pick === k ? 'pick' : ''}" data-k="${k}" style="background:${bg};${a > 0.55 ? 'color:var(--on-accent)' : ''}">${n}</div>`;
      } else {
        html += `<div class="cell ${o.sel.has(k) ? 'on' : ''}" data-k="${k}"></div>`;
      }
    });
  }
  el.innerHTML = html;
  if (o.mode === 'heat'){ el.onclick = e => { const c = e.target.closest('.cell[data-k]'); if (c && o.onPick) o.onPick(c.dataset.k); }; return; }
  if (o.mode !== 'edit') return;
  let painting = false, val = true;
  const apply = c => { if (!c || !c.dataset.k) return; const k = c.dataset.k; if (val) o.sel.add(k); else o.sel.delete(k); c.classList.toggle('on', val); };
  el.addEventListener('pointerdown', e => {
    const c = e.target.closest('.cell[data-k]'); if (!c) return;
    e.preventDefault(); painting = true; val = !o.sel.has(c.dataset.k); apply(c);
    try { el.setPointerCapture(e.pointerId); } catch(_){}
  });
  el.addEventListener('pointermove', e => {
    if (!painting) return;
    const t = root.elementFromPoint(e.clientX, e.clientY);
    apply(t && t.closest && t.closest('.cell[data-k]'));
  });
  const end = () => { if (painting){ painting = false; o.onChange && o.onChange(); } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  el.querySelectorAll('.allday').forEach(b => b.addEventListener('click', () => {
    const d = days.find(x => x.date === b.dataset.day);
    const ks = []; for (let h = d.open; h < d.close; h++) ks.push(key(d.date, h));
    const all = ks.every(k => o.sel.has(k));
    ks.forEach(k => all ? o.sel.delete(k) : o.sel.add(k));
    el.querySelectorAll('.cell[data-k]').forEach(c => c.classList.toggle('on', o.sel.has(c.dataset.k)));
    o.onChange && o.onChange();
  }));
}

/* ---------- 확정 시간표 ---------- */
function timetableHTML(slots, k, isMe){
  const dates = [...new Set(slots.map(s => s.date))];
  const rows = [...new Map(slots.map(s => [s.start + '-' + s.end, [s.start, s.end]])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const at = {}; slots.forEach(s => at[s.date + '|' + s.start + '-' + s.end] = s);
  const tw = dates.length > 4 ? 'min-width:' + (54 + dates.length * 88) + 'px' : '';
  return `<div class="ttwrap"><table class="ttab" style="${tw}"><thead><tr><th style="width:54px"></th>${dates.map(d => { const t = dObj(d); return `<th class="${t.getDay() === 0 ? 'sun' : ''}">${t.getMonth()+1}/${t.getDate()} ${WD[t.getDay()]}</th>`; }).join('')}</tr></thead><tbody>
  ${rows.map(([st, en]) => `<tr><td class="t">${st}–${en}</td>${dates.map(d => {
    const s = at[d + '|' + st + '-' + en];
    if (!s) return '<td class="none"></td>';
    const names = s.names.map(n => isMe(n) ? `<span class="me">${esc(n)}</span>` : esc(n));
    const miss = s.names.length < k ? `<span class="miss">${k - s.names.length}명 비어 있음</span>` : '';
    return `<td>${names.concat(miss ? [miss] : []).join('<br>')}</td>`;
  }).join('')}</tr>`).join('')}
  </tbody></table></div>`;
}
function viewTable(){
  const r = S.pub.result;
  if (!r){ $('#app').innerHTML = `<div class="card"><h2>아직 시간표가 나오지 않았어요</h2><p class="muted">임원진이 나누기를 마치면 여기에 올라와요.</p><button class="btn" onclick="SJ.go('form')">내 가능한 시간 적기</button></div>`; return; }
  S.tview = S.tview || 'table';
  $('#app').innerHTML = `
  <div class="row" style="justify-content:space-between;align-items:baseline;margin-top:10px">
    <div class="row" style="align-items:baseline;gap:10px"><h1 style="margin:0;font-size:21px">상주 시간표</h1><span class="muted" style="font-size:11px">${r.L === 'half' ? '반나절' : r.L + '시간'}씩 · 한 타임 ${r.k}명</span></div>
    <div class="seg" role="tablist"><button data-v="table">표</button><button data-v="list">목록</button></div>
  </div>
  <div class="glow"></div>
  <label class="f" for="tName" style="margin-top:16px">내 이름</label>
  <input class="inp" id="tName" placeholder="이름을 적으면 내 시간이 표시돼요" value="${esc(S.me.name)}">
  <div id="tMine"></div>
  <div id="tDays" style="margin-top:18px"></div>`;
  root.querySelectorAll('.seg button').forEach(b => { b.classList.toggle('on', b.dataset.v === S.tview); b.onclick = () => { S.tview = b.dataset.v; root.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b)); draw(); }; });
  const draw = () => {
    const me = normName($('#tName').value);
    const isMe = n => me && normName(n).replace(/\(\d\d\)$/, '') === me;
    const mine = r.slots.filter(s => s.names.some(isMe));
    $('#tMine').innerHTML = me ? (mine.length
      ? `<p style="margin:10px 0 0;font-size:12.5px;line-height:1.7">${mine.map(s => `<b>${esc(fmtDate(s.date))} ${fmtRange(s.start, s.end)}</b>`).join('<br>')}<br><span class="muted" style="font-size:11.5px">${mine.length}타임 · ${hoursText(mine.reduce((a, s) => a + s.end - s.start, 0))}</span></p>`
      : `<p class="small muted" style="margin:10px 0 0">이 이름으로 배정된 시간이 없어요.</p>`) : '';
    if (S.tview === 'table'){ $('#tDays').innerHTML = timetableHTML(r.slots, r.k, isMe); return; }
    const byDay = {}; r.slots.forEach(s => (byDay[s.date] = byDay[s.date] || []).push(s));
    $('#tDays').innerHTML = Object.keys(byDay).map(d => `
      <div class="day"><h3>${esc(fmtDate(d))}</h3>
      ${byDay[d].map(s => `<div class="slot"><div class="tm">${fmtRange(s.start, s.end)}</div><div class="ppl">${s.names.map(n => `<span class="pp ${isMe(n) ? 'me' : ''}">${esc(n)}</span>`).join('')}${s.names.length < r.k ? `<span class="pp miss">${r.k - s.names.length}명 비어 있음</span>` : ''}</div></div>`).join('')}
      </div>`).join('');
  };
  $('#tName').addEventListener('input', () => { draw(); S.me.name = $('#tName').value.trim(); lsSet('dg_sj_me', S.me); });
  draw();
}

/* ---------- 임원진: 설정 · 응답 · 배분 ---------- */
function tabSet(){
  const c = JSON.parse(JSON.stringify(S.admin.cfg));
  S.cfgEdit = c;
  const hopt = (v, from, to) => { let s = ''; for (let h = from; h <= to; h++) s += `<option value="${h}" ${h === v ? 'selected' : ''}>${fmtH(h)}</option>`; return s; };
  $('#tab').innerHTML = `
  <div class="card">
    <h2>받기</h2>
    <label class="ck" style="padding-left:0"><input type="checkbox" id="sOpen" ${c.open ? 'checked' : ''}> 부원들의 가능한 시간 받기</label>
    <div class="row" style="margin-top:8px">
      <button class="btn sm" onclick="SJ.copyText(SJ.link(),'상주 링크를 복사했어요')">시간 적는 링크 복사</button>
      <button class="btn sm" onclick="SJ.copyText(SJ.noticeText(),'단톡방 공지글을 복사했어요')">단톡방 공지글 복사</button>
    </div>
  </div>
  <div class="card stack">
    <h2>안내</h2>
    <div><label class="f" for="sTitle">제목 <span class="muted">(비우면 전시회 이름)</span></label><input class="inp" id="sTitle" maxlength="40" value="${esc(c.title)}"></div>
    <div><label class="f" for="sNotice">안내 문구 (첫 화면에 보여요)</label><textarea class="inp" id="sNotice" maxlength="1000">${esc(c.notice)}</textarea></div>
  </div>
  <div class="card">
    <h2>전시 날짜와 운영 시간</h2>
    <p class="muted small" style="margin-top:-4px">부원들은 1시간 칸으로 골라요. 몇 시간씩 나눌지는 응답이 모인 뒤 [배분] 탭에서 정해요.</p>
    <div class="grid2">
      <div><label class="f" for="sFrom">시작 날짜</label><input class="inp" type="date" id="sFrom" value="${c.days[0] ? c.days[0].date : ''}"></div>
      <div><label class="f" for="sTo">끝 날짜</label><input class="inp" type="date" id="sTo" value="${c.days.length ? c.days[c.days.length-1].date : ''}"></div>
      <div><label class="f" for="sOpenH">기본 여는 시간</label><select class="inp" id="sOpenH">${hopt(c.defOpen, 0, 23)}</select></div>
      <div><label class="f" for="sCloseH">기본 닫는 시간</label><select class="inp" id="sCloseH">${hopt(c.defClose, 1, 24)}</select></div>
    </div>
    <button class="btn sm" style="margin-top:10px" onclick="SJ.fillRange()">이 기간으로 날짜 채우기</button>
    <div class="hr"></div>
    <h3>날짜별 운영 시간 <span class="muted small">(설치·철수 날처럼 다른 날만 바꿔요)</span></h3>
    <div id="sDays"></div>
    <div class="row" style="margin-top:10px"><input class="inp" type="date" id="sAdd" style="width:auto;flex:1;min-width:160px"><button class="btn sm" onclick="SJ.addDay()">날짜 하나 추가</button></div>
  </div>
  <div class="card">
    <h2>한 타임에 몇 명</h2>
    <select class="inp" id="sK" style="max-width:160px">${[1,2,3,4,5].map(n => `<option value="${n}" ${n === c.k ? 'selected' : ''}>${n}명</option>`).join('')}</select>
  </div>
  <div class="err" id="sErr"></div>
  <button class="btn primary block" id="sSave" onclick="SJ.saveCfg()">설정 저장하기</button>
`;
  drawDays();
}
function drawDays(){
  const c = S.cfgEdit;
  const hopt = (v, from, to) => { let s = ''; for (let h = from; h <= to; h++) s += `<option value="${h}" ${h === v ? 'selected' : ''}>${fmtH(h)}</option>`; return s; };
  $('#sDays').innerHTML = c.days.length ? c.days.map((d, i) => `
    <div class="dayrow"><b class="${isSun(d.date) ? '' : ''}">${esc(fmtDate(d.date))}</b>
      <select class="inp" data-i="${i}" data-f="open">${hopt(d.open, 0, 23)}</select>
      <select class="inp" data-i="${i}" data-f="close">${hopt(d.close, 1, 24)}</select>
      <button class="x-btn" title="빼기" data-del="${i}">×</button></div>`).join('') : '<p class="muted small">아직 날짜가 없어요. 위에서 기간을 정하고 [이 기간으로 날짜 채우기]를 눌러 주세요.</p>';
  $('#sDays').querySelectorAll('select').forEach(s => s.onchange = () => { c.days[+s.dataset.i][s.dataset.f] = +s.value; });
  $('#sDays').querySelectorAll('[data-del]').forEach(b => b.onclick = () => { c.days.splice(+b.dataset.del, 1); drawDays(); });
}
function fillRange(){
  const f = $('#sFrom').value, t = $('#sTo').value; const c = S.cfgEdit;
  if (!f || !t) return toast('시작·끝 날짜를 골라 주세요');
  if (t < f) return toast('끝 날짜가 시작 날짜보다 빨라요');
  const o = +$('#sOpenH').value, cl = +$('#sCloseH').value;
  if (cl <= o) return toast('닫는 시간이 여는 시간보다 늦어야 해요');
  c.defOpen = o; c.defClose = cl;
  const old = Object.fromEntries(c.days.map(d => [d.date, d]));
  const days = []; for (let x = dObj(f); iso(x) <= t; x.setDate(x.getDate() + 1)){ const ds = iso(x); days.push(old[ds] || {date: ds, open: o, close: cl}); if (days.length > 31) break; }
  c.days = days; drawDays();
}
function addDay(){
  const d = $('#sAdd').value; const c = S.cfgEdit; if (!d) return;
  if (c.days.some(x => x.date === d)) return toast('이미 있는 날짜예요');
  c.days.push({date: d, open: +$('#sOpenH').value, close: +$('#sCloseH').value});
  c.days.sort((a, b) => a.date < b.date ? -1 : 1); drawDays();
}
async function saveCfg(){
  const c = S.cfgEdit; const err = $('#sErr'); err.textContent = '';
  c.open = $('#sOpen').checked; c.title = $('#sTitle').value.trim(); c.notice = $('#sNotice').value.trim();
  c.k = +$('#sK').value; c.defOpen = +$('#sOpenH').value; c.defClose = +$('#sCloseH').value;
  const bad = c.days.find(d => d.close <= d.open);
  if (bad) return err.textContent = `${fmtDate(bad.date)}: 닫는 시간이 여는 시간보다 늦어야 해요`;
  const b = $('#sSave'); b.disabled = true; b.textContent = '저장하는 중…';
  try { await adminWrite('sjSaveConfig', c); S.pub.cfg = Object.assign({}, S.pub.cfg, {title: S.admin.cfg.title, notice: S.admin.cfg.notice, open: S.admin.cfg.open, k: S.admin.cfg.k, days: S.admin.cfg.days}); lsSet(pubKey(), S.pub); refreshPubLater(); setTop(); toast('설정을 저장했어요'); tabSet(); }
  catch(e){ err.textContent = e.message; b.disabled = false; b.textContent = '설정 저장하기'; }
}
function noticeText(){
  const c = S.admin ? S.admin.cfg : S.pub.cfg; const d = c.days; const ttl = c.title || (S.admin ? S.admin.ex.title : S.pub.ex.title);
  return `[${ttl}] 상주 가능한 시간 알려 주세요!\n` +
    (d.length ? `기간: ${fmtDate(d[0].date)} ~ ${fmtDate(d[d.length-1].date)}\n` : '') +
    `\n아래 링크에서 이름·학번(9자리)을 적고, 상주할 수 있는 시간을 모두 칠해 주세요. 많이 칠할수록 고르게 나눌 수 있어요.\n${link()}\n` +
    (c.notice ? `\n${c.notice}\n` : '') + `\n시간표가 나오면 같은 링크 첫 화면에서 볼 수 있어요.`;
}
function tabResp(){
  const A = S.admin, c = A.cfg;
  const people = prepPeople(A.responses, c.days);
  const counts = {}; people.forEach(p => p.set.forEach(k => counts[k] = (counts[k] || 0) + 1));
  const max = Math.max(1, ...Object.values(counts));
  const short = [...validKeys(c.days)].filter(k => (counts[k] || 0) < c.k).length;
  const totalH = people.reduce((a, p) => a + p.set.size, 0);
  $('#tab').innerHTML = `
  <div class="card">
    <div class="stats">
      <div><div class="lb">응답</div><div class="big">${A.responses.length}<span class="small">명</span></div></div>
      <div><div class="lb">가능 시간 합</div><div class="big">${totalH}<span class="small">시간</span></div></div>
      <div><div class="lb">${c.k}명 안 되는 칸</div><div class="big" style="${short ? 'color:var(--red)' : ''}">${short}<span class="small">칸</span></div></div>
    </div>
  </div>
  <div class="card">
    <h2>시간마다 가능한 사람 수</h2>
    <p class="muted small" style="margin-top:-4px">빨간 테두리는 ${c.k}명이 안 되는 시간이에요. 칸을 누르면 누가 되는지 보여요.</p>
    ${c.days.length ? '<div class="gwrap"><div id="rGrid"></div></div><div id="rPick" class="sumline"></div>' : '<p class="muted">설정 탭에서 날짜를 먼저 정해 주세요.</p>'}
  </div>
  <div class="card">
    <div class="row" style="justify-content:space-between"><h2 style="margin:0">응답한 사람</h2><button class="btn sm ghost" onclick="SJ.copyText(SJ.link(),'상주 링크를 복사했어요')">링크 복사</button></div>
    ${A.responses.length ? `<table class="t" style="margin-top:8px"><thead><tr><th>이름</th><th class="n">가능</th><th>메모</th><th></th></tr></thead><tbody>
    ${A.responses.slice().sort((a, b) => b.updated - a.updated).map(r => {
      const p = people.find(x => x.sid === r.sid);
      return `<tr><td><b>${esc(r.name)}</b><div class="muted small">${esc(r.sid)}</div></td><td class="n">${p ? p.set.size : 0}시간</td><td class="small">${esc(r.memo || '')}</td><td class="n"><button class="btn sm danger" data-del="${esc(r.sid)}">삭제</button></td></tr>`;
    }).join('')}</tbody></table>` : '<p class="muted">아직 응답이 없어요.</p>'}
  </div>`;
  if (c.days.length){
    const pick = k => {
      const [d, h] = k.split('|'); const who = people.filter(p => p.set.has(k));
      $('#rPick').innerHTML = `<b>${esc(fmtDate(d))} ${fmtRange(+h, +h + 1)}</b> · ${who.length}명<br>${who.length ? who.map(p => esc(p.name)).join(', ') : '<span class="muted">아무도 없어요</span>'}`;
      drawGrid($('#rGrid'), c.days, {mode: 'heat', counts, max, k: c.k, pick: k, onPick: pick});
    };
    drawGrid($('#rGrid'), c.days, {mode: 'heat', counts, max, k: c.k, onPick: pick});
  }
  root.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!b.classList.contains('armed')){ b.classList.add('armed'); b.textContent = '지울까요?'; setTimeout(() => { if (b.isConnected){ b.classList.remove('armed'); b.textContent = '삭제'; } }, 4000); return; }
    b.disabled = true;
    try { await adminWrite('sjDelete', b.dataset.del); refreshPubLater(); toast('지웠어요'); adminMain(); } catch(e){ toast(e.message); b.disabled = false; }
  });
}
function tabDist(){
  const A = S.admin, c = A.cfg;
  if (!c.days.length){ $('#tab').innerHTML = '<div class="card"><p class="muted">설정 탭에서 날짜를 먼저 정해 주세요.</p></div>'; return; }
  const people = prepPeople(A.responses, c.days);
  if (!S.draft && A.result){ S.draft = JSON.parse(JSON.stringify(A.result)); S.draft.saved = true; }
  if (!S.distOpt) S.distOpt = {L: (A.result && A.result.L) || 2, mode: (A.result && A.result.mode) || 'any', seed: 1};
  const cmp = compareLens(c.days, people, c.k);
  if (!cmp.some(x => String(x.L) === String(S.distOpt.L))) S.distOpt.L = cmp[0].L;
  const D = S.draft;
  const stale = D ? A.responses.filter(r => r.updated > D.made).length : 0;
  const gone = D ? Object.keys(D.names || {}).filter(sid => !A.responses.some(r => r.sid === sid)).length : 0;
  $('#tab').innerHTML = `
  <div class="card">
    <h2>1. 몇 시간씩 나눌까요?</h2>
    <p class="muted small" style="margin-top:-4px">응답 ${people.length}명 · 한 타임 ${c.k}명 기준이에요. 줄을 눌러 골라요.</p>
    <table class="t"><thead><tr><th>타임 길이</th><th class="n">타임 수</th><th class="n">1인당 평균</th><th class="n">${c.k}명 안 되는 타임</th></tr></thead><tbody>
    ${cmp.map(x => `<tr class="click ${String(x.L) === String(S.distOpt.L) ? 'sel' : ''}" data-len="${x.L}"><td><b>${esc(lenLabel(x.L))}</b></td><td class="n">${x.n}개</td><td class="n">${people.length ? `${x.perSlots.toFixed(1)}타임 · ${x.per.toFixed(1)}시간` : '-'}</td><td class="n" style="${x.short ? 'color:var(--red);font-weight:700' : ''}">${x.short}개</td></tr>`).join('')}
    </tbody></table>
    <div class="hr"></div>
    <label class="f" for="dMode">같은 사람의 타임을</label>
    <select class="inp" id="dMode" style="max-width:360px">
      <option value="any" ${S.distOpt.mode === 'any' ? 'selected' : ''}>상관없이 고르게만</option>
      <option value="join" ${S.distOpt.mode === 'join' ? 'selected' : ''}>가능하면 이어 붙이기 (한 번 올 때 길게)</option>
      <option value="apart" ${S.distOpt.mode === 'apart' ? 'selected' : ''}>가능하면 떨어뜨리기 (연달아 안 하게)</option>
    </select>
    <p class="muted small">1시간 타임이면 '이어 붙이기'를 추천해요.</p>
    <button class="btn primary block" id="dRun" ${people.length ? '' : 'disabled'}>${D ? '이 조건으로 다시 나누기' : '균등하게 나누기'}</button>
    ${people.length ? '' : '<p class="muted small">응답이 모이면 나눌 수 있어요.</p>'}
  </div>
  <div id="dRes"></div>`;
  root.querySelectorAll('tr[data-len]').forEach(tr => tr.onclick = () => { S.distOpt.L = tr.dataset.len === "half" ? "half" : +tr.dataset.len; S.distOpt.mode = $('#dMode').value; tabDist(); });
  $('#dMode').onchange = () => S.distOpt.mode = $('#dMode').value;
  $('#dRun').onclick = () => {
    S.distOpt.mode = $('#dMode').value;
    if (S.draft) S.distOpt.seed++;
    const slots = buildSlots(c.days, S.distOpt.L);
    const asg = solve(slots, people, c.k, S.distOpt.mode, S.distOpt.seed);
    S.draft = {L: S.distOpt.L, k: c.k, mode: S.distOpt.mode, made: Date.now(), saved: false,
      slots: slots.map((s, i) => ({date: s.date, start: s.start, end: s.end, sids: asg[i] || []})),
      names: Object.fromEntries(A.responses.map(r => [r.sid, r.name]))};
    S.editSlot = -1;
    drawResult(people, stale, gone);
    toast('나눴어요. 아래에서 확인하고 고칠 수 있어요');
    setTimeout(() => $('#dRes').scrollIntoView({behavior:'smooth', block:'start'}), 50);
  };
  if (D) drawResult(people, stale, gone);
}
function drawResult(people, stale, gone){
  const A = S.admin, D = S.draft; const k = D.k;
  const names = Object.assign({}, D.names, Object.fromEntries(A.responses.map(r => [r.sid, r.name])));
  D.names = names;
  const loads = loadsOf(D);
  const allSids = [...new Set([...people.map(p => p.sid), ...Object.keys(loads)])];
  const hs = allSids.map(s => (loads[s] || {h: 0}).h);
  const minH = Math.min(...hs), maxH = Math.max(...hs);
  const missing = D.slots.reduce((a, s) => a + Math.max(0, k - s.sids.length), 0);
  const byDay = {}; D.slots.forEach((s, i) => (byDay[s.date] = byDay[s.date] || []).push(i));
  const isPub = A.published && A.result && A.result.made === D.made && !D.dirty;
  const dn = displayNames(D);
  $('#dRes').innerHTML = `
  <div class="card">
    <div class="row" style="justify-content:space-between">
      <h2 style="margin:0">2. 나눈 결과</h2>
      <div class="row"><span class="chip ${isPub ? 'on' : D.saved && !D.dirty ? '' : 'warn'}">${isPub ? '공개 중' : D.saved && !D.dirty ? '저장됨 · 비공개' : '아직 저장 안 됨'}</span>
      <div class="seg" id="rSeg"><button data-v="list" class="${S.rview !== 'table' ? 'on' : ''}">목록</button><button data-v="table" class="${S.rview === 'table' ? 'on' : ''}">표</button></div></div>
    </div>
    <p class="muted small">${esc(lenLabel(D.L))} 단위 · 한 타임 ${k}명 · 1인당 <b>${hoursText(minH)} ~ ${hoursText(maxH)}</b>${missing ? ` · <b style="color:var(--red)">빈자리 ${missing}개</b>` : ''}</p>
    ${stale || gone ? `<p class="small" style="color:var(--red);margin:0 0 6px">나눈 뒤에 응답이 바뀐 사람이 ${stale + gone}명 있어요. 다시 나누는 게 좋아요.</p>` : ''}
    ${S.rview === 'table' ? `<p class="muted small" style="margin:0 0 10px">사람을 바꾸려면 [목록]에서 타임을 눌러요.</p>${timetableHTML(D.slots.map(s => ({date: s.date, start: s.start, end: s.end, names: s.sids.map(sid => dn[sid] || sid)})), k, () => false)}` : `<p class="muted small" style="margin:0 0 6px">타임을 누르면 사람을 바꿀 수 있어요.</p>
    ${Object.keys(byDay).map(d => `<div class="day"><h3 style="margin-top:14px">${esc(fmtDate(d))}</h3>
      ${byDay[d].map(i => { const s = D.slots[i]; return `<div class="slot edit ${S.editSlot === i ? 'open' : ''}" data-i="${i}"><div class="tm">${fmtRange(s.start, s.end)}</div><div class="ppl">${s.sids.map(sid => `<span class="pp">${esc(names[sid] || sid)}</span>`).join('')}${s.sids.length < k ? `<span class="pp miss">${k - s.sids.length}명 부족</span>` : ''}</div></div>${S.editSlot === i ? editBox(i, people, loads) : ''}`; }).join('')}
    </div>`).join('')}`}
  </div>
  <div class="card">
    <h2>사람마다 맡은 시간</h2>
    <table class="t"><thead><tr><th>이름</th><th class="n">타임</th><th class="n">시간</th><th class="n">가능했던</th><th style="width:30%"></th></tr></thead><tbody>
    ${allSids.map(sid => ({sid, l: loads[sid] || {n: 0, h: 0}, p: people.find(x => x.sid === sid)})).sort((a, b) => b.l.h - a.l.h || (names[a.sid] || '').localeCompare(names[b.sid] || '')).map(x => `
      <tr><td><b>${esc(names[x.sid] || x.sid)}</b></td><td class="n">${x.l.n}</td><td class="n">${hoursText(x.l.h)}</td><td class="n muted">${x.p ? x.p.set.size + '시간' : '-'}</td><td><div class="bar"><i style="width:${maxH ? x.l.h / maxH * 100 : 0}%"></i></div></td></tr>`).join('')}
    </tbody></table>
  </div>
  <div class="err" id="dErr"></div>
  <div class="stack">
    <button class="btn lime block" id="dPub">저장하고 부원들에게 공개하기</button>
    <div class="grid2"><button class="btn block" id="dSave">저장만 하기 (비공개)</button>${A.published ? '<button class="btn block danger" id="dUnpub">공개 내리기</button>' : '<button class="btn block ghost" id="dCopy">단톡방 공지글 복사</button>'}</div>
    ${A.published ? '<button class="btn block ghost" id="dCopy">단톡방 공지글 복사</button>' : ''}
  </div>`;
  root.querySelectorAll('#rSeg button').forEach(b => b.onclick = () => { S.rview = b.dataset.v; drawResult(people, stale, gone); });
  root.querySelectorAll('.slot.edit').forEach(el => el.onclick = () => { const i = +el.dataset.i; S.editSlot = S.editSlot === i ? -1 : i; drawResult(people, stale, gone); });
  root.querySelectorAll('.editbox input[type=checkbox]').forEach(cb => cb.onchange = () => {
    const s = D.slots[S.editSlot]; const sid = cb.dataset.sid;
    if (cb.checked){ if (!s.sids.includes(sid)) s.sids.push(sid); } else s.sids = s.sids.filter(x => x !== sid);
    D.dirty = true; drawResult(people, stale, gone);
  });
  const save = async publish => {
    const err = $('#dErr'); err.textContent = '';
    const btn = publish ? $('#dPub') : $('#dSave'); const t = btn.textContent; btn.disabled = true; btn.textContent = '저장하는 중…';
    try {
      const out = Object.assign({}, D); delete out.dirty; delete out.saved;
      await adminWrite('sjSaveResult', out, publish);
      refreshPubLater();
      S.draft = JSON.parse(JSON.stringify(S.admin.result)); S.draft.saved = true;
      toast(publish ? '공개했어요. 부원들이 첫 화면에서 볼 수 있어요' : '저장했어요 (아직 비공개)');
      drawResult(people, 0, 0);
    } catch(e){ err.textContent = e.message; btn.disabled = false; btn.textContent = t; }
  };
  $('#dPub').onclick = () => save(true);
  $('#dSave').onclick = () => save(false);
  if ($('#dUnpub')) $('#dUnpub').onclick = async () => {
    try { await adminWrite('sjUnpublish'); refreshPubLater(); S.draft.saved = true; toast('공개를 내렸어요'); drawResult(people, stale, gone); } catch(e){ toast(e.message); }
  };
  $('#dCopy').onclick = () => copyText(resultText(D), '시간표 공지글을 복사했어요');
}
function editBox(i, people, loads){
  const D = S.draft, s = D.slots[i];
  const can = people.filter(p => canDo(p, s));
  const cannot = Object.keys(D.names).filter(sid => !can.some(p => p.sid === sid));
  const row = (sid, warn) => `<label class="ck"><input type="checkbox" data-sid="${esc(sid)}" ${s.sids.includes(sid) ? 'checked' : ''}> <span>${esc(D.names[sid] || sid)}${warn ? ' <span class="chip warn">가능 시간 아님</span>' : ''}</span><span class="ld">지금 ${hoursText((loads[sid] || {h: 0}).h)}</span></label>`;
  return `<div class="editbox" onclick="event.stopPropagation()">
    <div class="small" style="font-weight:700;margin-bottom:4px">${esc(fmtDate(s.date))} ${fmtRange(s.start, s.end)} · ${s.sids.length}/${D.k}명</div>
    ${can.length ? can.sort((a, b) => (loads[a.sid] || {h: 0}).h - (loads[b.sid] || {h: 0}).h).map(p => row(p.sid, false)).join('') : '<p class="muted small">이 시간 전체가 되는 사람이 없어요.</p>'}
    ${cannot.length ? `<details ${cannot.some(sid => s.sids.includes(sid)) ? 'open' : ''}><summary>가능 시간이 아닌 사람도 넣기</summary>${cannot.map(sid => row(sid, true)).join('')}</details>` : ''}
  </div>`;
}
function resultText(D){
  const c = S.admin.cfg; const ttl = c.title || S.admin.ex.title; const dn = displayNames(D);
  const byDay = {}; D.slots.forEach(s => (byDay[s.date] = byDay[s.date] || []).push(s));
  return `[${ttl}] 상주 시간표\n` + Object.keys(byDay).map(d => `\n${fmtDate(d)}\n` + byDay[d].map(s => `${fmtRange(s.start, s.end)} ${s.sids.map(sid => dn[sid] || sid).join(', ')}`).join('\n')).join('\n') + `\n\n내 시간만 보기: ${link()}`;
}

/* ---------- 미리보기용 가짜 서버 (config.js의 서버 주소가 비었을 때만 써요) ---------- */
const Mock = {
  PASS: {},
  key: 'dg_sj_demo_v1',
  db(){
    let db = lsGet(this.key, null);
    if (!db) db = {ex: {}, photos: {}};
    return db;
  },
  save(db){ lsSet(this.key, db); },
  ex(db, id){
    id = id || Object.keys(db.ex)[0] || X.exhId || 'demo';
    if (!db.ex[id]){
      const days = ['2026-12-24', '2026-12-25', '2026-12-26'].map((d, i) => ({date: d, open: 11, close: i === 2 ? 17 : 18}));
      const names = ['장소현','김도윤','이서연','박지호','최하은','정민준','강유나','조현우','윤서아','임준서','한지우','오세린'], rnd = mulberry32(42);
      const responses = names.map((n, i) => { const avail = []; days.forEach(d => { if (rnd() < 0.3) return; const a = d.open + Math.floor(rnd() * 3); const b = Math.min(d.close, a + 2 + Math.floor(rnd() * 5)); for (let h = a; h < b; h++) avail.push(key(d.date, h)); });
        return {sid: String(202311000 + i * 37), name: n, avail, memo: i === 2 ? '24일은 16시 전에 가야 해요' : '', created: Date.now() - 86400000, updated: Date.now() - 86400000}; });
      db.ex[id] = {cfg: {title: '', notice: '제1학생회관 대회의실', open: true, k: 2, defOpen: 11, defClose: 18, days}, responses, result: null, published: false, theme: {mode: 'default'}};
      this.save(db);
    }
    return [id, db.ex[id]];
  },
  title(id){ return (X.demoTitles || {})[id] || (X.ex && X.ex.title) || '목방 전시회'; },
  adm(id, e){ return {ex: {id, title: this.title(id), poster: (X.ex && X.ex.poster) || ''}, cfg: e.cfg, theme: e.theme, url: '', responses: e.responses, result: e.result, published: e.published}; },
  sjInfo(exhId){ const db = this.db(), [id, e] = this.ex(db, exhId); return {ex: {id, title: this.title(id)}, cfg: {title: e.cfg.title, notice: e.cfg.notice, open: e.cfg.open, k: e.cfg.k, days: e.cfg.days}, theme: e.theme, count: e.responses.length, result: e.published && e.result ? publicResult(e.result) : null}; },
  sjMine(exhId, sid, name){ const [, e] = this.ex(this.db(), exhId); const r = e.responses.find(x => x.sid === sid); if (!r) return null; if (normName(r.name) !== normName(name)) throw new Error('이 학번은 다른 이름으로 저장돼 있어요. 이름을 확인해 주세요.'); return {avail: r.avail, memo: r.memo}; },
  sjSubmit(exhId, sid, name, avail, memo){
    const db = this.db(), [, e] = this.ex(db, exhId);
    if (!e.cfg.open) throw new Error('지금은 상주 가능한 시간을 받지 않아요.');
    if (!/^\d{9}$/.test(sid)) throw new Error('학번은 9자리 숫자로 적어 주세요.');
    const v = validKeys(e.cfg.days), list = [...new Set(avail)].filter(k => v.has(k));
    if (!list.length) throw new Error('가능한 시간을 한 칸 이상 골라 주세요.');
    let r = e.responses.find(x => x.sid === sid);
    if (r && normName(r.name) !== normName(name)) throw new Error('이 학번은 다른 이름으로 저장돼 있어요.');
    if (!r){ r = {sid, created: Date.now()}; e.responses.push(r); }
    Object.assign(r, {name: String(name).trim(), avail: list, memo: String(memo || '').slice(0, 300), updated: Date.now()}); this.save(db); return true;
  },
  sjAdmin(pw, exhId){ const [id, e] = this.ex(this.db(), exhId); return this.adm(id, e); },
  sjSaveConfig(pw, exhId, cfg){ const db = this.db(), [id, e] = this.ex(db, exhId); e.cfg = cfg; this.save(db); return this.adm(id, e); },
  sjDelete(pw, exhId, sid){ const db = this.db(), [id, e] = this.ex(db, exhId); e.responses = e.responses.filter(r => r.sid !== sid); this.save(db); return this.adm(id, e); },
  sjSaveResult(pw, exhId, result, publish){ const db = this.db(), [id, e] = this.ex(db, exhId); e.result = result; e.published = !!publish; this.save(db); return this.adm(id, e); },
  sjUnpublish(pw, exhId){ const db = this.db(), [id, e] = this.ex(db, exhId); e.published = false; this.save(db); return this.adm(id, e); },
  sjSaveTheme(pw, exhId, theme){ const db = this.db(), [id, e] = this.ex(db, exhId); e.theme = theme && theme.mode === 'poster' ? theme : {mode: 'default'}; this.save(db); return this.adm(id, e); },
  sjPhoto(exhId, id){ const db = this.db(); if (!db.photos[id]) throw new Error('그림을 찾을 수 없어요.'); return db.photos[id]; },
  uploadPhoto(pw, data){ const db = this.db(), id = 'psj' + Math.random().toString(36).slice(2, 12); db.photos[id] = data; this.save(db); return id; },
  getPhoto(pw, id){ const db = this.db(); return db.photos[id] || this.PASS; },
};
function publicResult(r){ const dn = displayNames(r); return {L: r.L, k: r.k, made: r.made, slots: r.slots.map(s => ({date: s.date, start: s.start, end: s.end, names: s.sids.map(sid => dn[sid] || '')}))}; }

/* index.html과 화면 속 버튼이 부르는 것들 */
window.SJ = { go, link, copyText, noticeText: () => noticeText(), viewForm, formNext, formSave, fillRange, addDay, saveCfg, adminRefresh, preview, back };
window.dgSangju = { member, admin };
})();
