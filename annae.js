/* =========================================================
   도각도각 · 전시 관람 안내 (annae.js) · 49판
   - 임원진: [전시회 관리] → 전시회 → [관람 안내 만들기]에서 소개글 · 지도(전시대 배치) · 관람 순서를 정하고 공개해요.
   - 관람객: 입구 QR로 tour/?s=전시회ID 페이지가 열려요 (도각도각 앱과 따로 떨어진 작은 페이지).
   - 작품 정보는 출품 기획서에서 가져와요. 학번은 관람객 화면에 보내지 않아요.
   - 이 파일은 관람 안내 화면을 처음 열 때만 불러와요. 도각도각 다른 화면은 그대로예요.
   index.html의 도구는 window.DG로 받아 써요. 화면은 그림자 DOM 안에 그려서 도각도각 화면 모양과 섞이지 않아요.
   ========================================================= */
(function(){
'use strict';
const DG = window.DG;
const LIVE = DG.LIVE;
let host = null, root = null;
const $ = s => root.querySelector(s);
const $$ = s => [...root.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const TUTON = () => !!(DG.tut && DG.tut());
function lsGet(k, d){ try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } }
function lsSet(k, v){ if (TUTON()) return; try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
function toast(msg){ const t = $('#toast'); if (!t) return; t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400); }
async function copyText(txt, msg){
  try { await navigator.clipboard.writeText(txt); }
  catch(e){ const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch(_){} ta.remove(); }
  toast(msg || '복사했어요');
}
const uid = () => 'i' + Math.random().toString(36).slice(2, 8);

/* ---------- 색: 도각도각 원래 디자인 그대로 읽어 와요 ---------- */
function hexRgb(h){ h = String(h || '#000000').trim().replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, t){ const x = hexRgb(a), y = hexRgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function lum(h){ const c = hexRgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function applyTheme(){
  const cs = getComputedStyle(document.documentElement), v = (k, d) => (cs.getPropertyValue(k) || '').trim() || d;
  const bg = v('--paper', '#eef0eb'), ink = v('--ink', '#1d2420'), dark = lum(bg) < 0.25;
  const vars = { '--bg': bg, '--ink': ink, '--muted': v('--muted', '#5b665e'), '--accent': v('--accent', '#2d5a46'), '--on-accent': v('--accent-ink', '#ffffff'),
    '--card': v('--surface', '#fbfbf8'), '--line': v('--line', '#d6dbd2'), '--soft': v('--soft', '#e1eae3'), '--red': v('--bad', '#b23a32'), '--warm': v('--warn', '#9a6200'),
    '--wood': v('--wood', '#8a5a35'), '--bg-deep': v('--surface', '#fbfbf8'), '--dim': mix(bg, ink, 0.5), '--hi': mix(ink, dark ? '#ffffff' : '#000000', 0.3), '--scheme': dark ? 'dark' : 'light',
    '--logo-filter': dark ? 'invert(1) brightness(1.4)' : 'none' };
  Object.keys(vars).forEach(k => host.style.setProperty(k, vars[k]));
  document.body.style.setProperty('--an-bg', bg);
}
function watchTheme(){
  if (watchTheme.on) return; watchTheme.on = true;
  const re = () => { if (host && !host.hidden) applyTheme(); };
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', re); } catch(e){}
  try { new MutationObserver(re).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']}); } catch(e){}
}

/* ---------- 지도에 놓는 것들 ---------- */
const K = {
  stand: { name: '전시대', w: 40, h: 40, holds: true, hint: '작품을 올리는 네모 전시대' },
  table: { name: '긴 테이블', w: 180, h: 60, holds: true, hint: '작품 여러 개를 올리는 긴 책상' },
  wall:  { name: '벽 · 칸막이', w: 300, h: 10 },
  door:  { name: '입구', w: 120, h: 20 },
  exit:  { name: '출구', w: 120, h: 20 },
  text:  { name: '글씨', w: 240, h: 50 },
  zone:  { name: '구역', w: 300, h: 200 },
};
const HOLDS = k => !!(K[k] && K[k].holds);

/* 출품 기획서 → 관람객에게 보일 작품 (Annae.gs의 gaWorks_와 같은 규칙. 학번은 넣지 않아요) */
const cut = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const num = v => { const n = Math.round(Number(String(v == null ? '' : v).replace(/[^\d.]/g, ''))); return n > 0 && n <= 100000 ? n : ''; };
function pubWorks(list){
  return (list || []).slice().sort((a, b) => String(a.at || '').localeCompare(String(b.at || ''))).slice(0, 300).map(r => {
    r = r || {};
    const who = [{ n: cut(r.name, 20), g: cut(r.gen, 3).replace(/\D/g, '') }].concat((r.co || []).slice(0, 9).map(p => ({ n: cut(p && p.name, 20), g: cut(p && p.gen, 3).replace(/\D/g, '') }))).filter(p => p.n);
    const objs = (r.objs || []).slice(0, 30).map(o => { o = o || {}; return { n: cut(o.n, 30), m: cut(o.m, 30), w: num(o.w), d: num(o.d), h: num(o.h) }; }).filter(o => o.n || o.m);
    return { id: cut(r.id, 40), t: cut(r.work, 60), who, objs, d: cut(r.desc, 1500) };
  }).filter(w => w.id && (w.t || w.who.length));
}
const whoText = w => (w.who || []).map(p => p.n + (p.g ? ` (${p.g}기)` : '')).join(', ');
const objLine = o => [o.n, o.m, o.w && o.d && o.h ? `${o.w}×${o.d}×${o.h}mm` : ''].filter(String).join(' · ');

/* 처음 만들 때 채워 둘 내용 (전시회 이름으로 골라요) */
/* 해마다 그대로 쓸 수 있는 동아리 소개 (37회 '동심' 리플렛 글) */
const CLUB_INTRO = `건국대 중앙동아리 '목방(木房)'은
1985년 몇몇 뜻있는 선배님들이 모여
창립한 순수 목공예 동아리입니다.
예로부터 나무는 우리의 생활과 문화에 있어
밀접한 관계를 맺어왔습니다.
많은 건축물, 예술작품,
가구 등에 나무가 쓰이고 있습니다.
그것은 나무만이 가진 연하면서도
강하고, 강하면서 부드러운
성질 때문일 것입니다.
'목방'에서는 나무를 충분히 이해한 뒤,
깎고 다듬어 작품으로 승화시키는
창작 활동을 합니다.
축제 기간에는 직접 구성원들이
갖가지 나무로 조각한 악세사리를
판매하고, 매년 가을에 전시회를 여는 등의
다양한 활동을 해오고 있습니다.
민예적인 목공예 창작 활동을 통해
우리나라 고유 예술의 계승과 발전을 꾀하고
이를 통한 원만한 인격 형성을
목적으로 하는 동아리,
가족적인 분위기에서
서로의 사랑을 느낄 수 있는 곳,
'지구 위의 조그마한 사랑 공간'
바로 목방입니다.`;
const secId = () => 'g' + Math.random().toString(36).slice(2, 7);
/* 49판: 글은 세 개로 고정이에요.
   - 회장 축사 · 동문 축사: 리플렛에만 (해마다 새로 적어요)
   - 목방은 어떤 동아리인가요?: 늘 같은 글. 안내 화면 맨 끝과 리플렛에 들어가요 (고칠 필요 없어요) */
const SEC_FIXED = [
  { id: 'pres', t: '회장 축사', tour: false, leaf: true, at: 'pre' },
  { id: 'club', t: '목방은 어떤 동아리인가요?', tour: true, leaf: true, at: 'post' },
  { id: 'alum', t: '동문 축사', tour: false, leaf: true, at: 'post' }];
function defaultSections(){ return SEC_FIXED.map(x => Object.assign({ b: x.id === 'club' ? CLUB_INTRO : '', s: '' }, x)); }
function fixSections(list){
  const L = Array.isArray(list) ? list : [];
  const find = (id, t) => L.find(x => x && x.id === id) || L.find(x => x && x.t === t) || {};
  return SEC_FIXED.map(f => { const o = find(f.id, f.t); return Object.assign({}, f, { b: f.id === 'club' ? CLUB_INTRO : String(o.b || ''), s: f.id === 'club' ? '' : String(o.s || '') }); });
}
/* 장소 · 찾아오시는 길은 늘 같아요 (건국대학교 제1학생회관 2층 대회의실). 지도 앱은 대회의실까지는 못 찾아서 건물로 찾게 해요 */
const PLACE = '건국대학교 제1학생회관 2층 대회의실';
const MAPQ = '건국대학교 제1학생회관';
const WAY = "지도 앱에서는 '건국대학교 제1학생회관'으로 찾아 주세요. 건물 2층에 대회의실이 있어요.";
/* 임원진 소개: 회장단 · 총무부 · 학술부 · 기홍부 순서. 차장 · 부원은 해마다 인원이 달라서 칸을 더하고 뺄 수 있어요 */
const STAFF_GROUPS = [
  { g: '회장단', roles: [{ r: '회장' }, { r: '부회장' }] },
  { g: '총무부', roles: [{ r: '총무' }, { r: '총무차장', multi: true }] },
  { g: '학술부', roles: [{ r: '학술부장' }, { r: '학술부원', multi: true }] },
  { g: '기홍부', roles: [{ r: '기홍부장' }, { r: '기홍부원', multi: true }] }];
const ROLES = STAFF_GROUPS.flatMap(x => x.roles.map(y => y.r));
const MULTI = new Set(STAFF_GROUPS.flatMap(x => x.roles.filter(y => y.multi).map(y => y.r)));
function staffRows(text){
  const rows = [];
  String(text || '').split('\n').map(l => l.trim()).filter(Boolean).forEach(l => { const m = l.match(/^([^:：]{1,12})\s*[:：]\s*(.*)$/); rows.push(m ? { r: m[1].trim(), v: m[2].trim() } : { r: '', v: l }); });
  const out = ROLES.map(r => ({ r, v: '' })), extra = [];
  rows.forEach(x => {
    const i = out.findIndex(y => y.r === x.r && !y.v);
    if (i >= 0){ out[i].v = x.v; return; }
    if (MULTI.has(x.r)){ let j = -1; out.forEach((y, k) => { if (y.r === x.r) j = k; }); out.splice(j + 1, 0, { r: x.r, v: x.v }); return; }
    extra.push(x);   // 예전 직책(운영진 등)은 맨 아래 '그 밖에'로
  });
  return out.concat(extra.map(x => Object.assign(x, { other: true })));
}
const staffText = rows => rows.filter(x => x.v.trim()).map(x => (x.r ? x.r + ' : ' : '') + x.v.trim()).join('\n');
/* 초대장 글: 온각 전시 소개글 (다음 전시회부터는 새로 적어요) */
const ONKAK_TEXT = `어느덧 한 해의 끝자락, 차가운 바람이 불어오는 겨울이 찾아왔습니다. 올 한 해도 나무와 함께 시간을 보내온 목방이 저마다의 이야기를 담은 작품들과 함께 전시회를 열게 되었습니다.

이번 전시의 제목은 <온각(溫刻): 차가운 계절에 새긴 따스함>입니다.

여러분은 추운 겨울, 어떤 순간에 따뜻함을 느끼시나요?

차가운 바람을 피해 들어온 포근한 공간, 두 손을 감싸는 따뜻한 차 한 잔, 소중한 사람과 나누는 작은 웃음처럼 우리의 일상에는 저마다의 온기가 스며들어 있습니다.

나무도 그러합니다. 투박하고 거친 나무 한 조각은 누군가의 손길을 거쳐 조금씩 다듬어지고, 그 안에는 오랜 시간 쌓아온 정성과 마음이 깃들게 됩니다.

저마다의 시간과 마음을 나무에 새겨 넣었습니다. 서로 다른 결을 가진 나무들이 저마다의 모습을 찾아가듯, 각기 다른 손끝에서 피어난 이야기들을 하나의 전시에 담아보았습니다.

따뜻할 온(溫), 새길 각(刻).

차가운 계절 속에서도 오래도록 남을 따스함을 새긴다는 의미처럼, 이번 전시가 여러분의 마음에도 작은 온기로 남기를 바랍니다.`;
function defaultInv(title){
  const v = { pub: false, hello: '', text: '', end: '많은 관심 부탁드립니다. 전시장에서 만나요.', days: [], ev: null, works: true, staff: false };
  if (/온각|溫刻/.test(title || '')) Object.assign(v, { hello: '목방 제40회 전시회에 초대합니다', text: ONKAK_TEXT,
    days: [{ d: '2026-12-24', o: '11:00', c: '18:00' }, { d: '2026-12-25', o: '11:00', c: '18:00' }, { d: '2026-12-26', o: '11:00', c: '17:00' }] });
  return v;
}
function defaultGuide(title){
  const g = { published: false, label: '목공 동아리 목방 전시회', sub: '', dates: '', place: PLACE, sections: defaultSections(), staff: '', way: WAY, mapq: MAPQ, notes: '작품은 눈으로만 감상해 주세요.\n궁금한 점은 상주 중인 부원에게 물어봐 주세요.', map: { W: 1500, H: 1000, route: true, items: [] }, order: [] };
  if (/온각|溫刻/.test(title || '')) Object.assign(g, { label: '목방 제40회 전시회', sub: '차가운 계절에 새긴 따스함',
    dates: '12월 24일(목) – 25일(금) 11:00 – 18:00\n12월 26일(토) 11:00 – 17:00' });
  g.map.items.push({ id: uid(), k: 'door', x: 100, y: 980, w: 120, h: 20, lab: '' });
  return g;
}
function fromServer(g, title){
  const d = Object.assign(defaultGuide(title), clone(g || {}));
  d.map = Object.assign({ W: 1500, H: 1000, route: true, items: [] }, d.map || {});
  d.order = Array.isArray(d.order) ? d.order : [];
  d.sections = fixSections(d.sections);
  d.inv = Object.assign(defaultInv(title), (g && g.inv) || {}); d.inv.ev = null;   // 발표회는 다른 곳에서 해서 초대장에 안 넣어요
  d.way = WAY; d.mapq = MAPQ; if (!d.place) d.place = PLACE;
  delete d.intro;
  return d;
}
/* 관람객 화면 · 리플렛에 보낼 것만 */
const pubGuide = D => ({ label: D.label, sub: D.sub, dates: D.dates, place: D.place, sections: D.sections.filter(x => x.tour !== false).map(x => ({ t: x.t, b: x.b, s: x.s, at: x.at })), notes: D.notes, map: D.map, order: D.order });
/* 초대장에 보낼 것 (Annae.gs의 gaInvite와 같은 모양) */
const invData = D => ({ ex: { id: X.exhId, title: X.ex.title }, ready: true, theme: S.theme || { mode: 'default' },
  inv: { hello: D.inv.hello, text: D.inv.text, end: D.inv.end, days: D.inv.days.filter(x => /^\d{4}-\d\d-\d\d$/.test(x.d)).sort((a, b) => a.d < b.d ? -1 : 1), ev: D.inv.ev && /^\d{4}-\d\d-\d\d$/.test(D.inv.ev.d) ? D.inv.ev : null },
  label: D.label, sub: D.sub, dates: D.dates, place: D.place, way: D.way, mapq: D.mapq, staff: D.inv.staff ? D.staff : '', titles: D.inv.works ? S.works.map(w => w.t).filter(String) : [] });
const inviteUrl = () => DG.SITE + 'invite/?s=' + encodeURIComponent(X.exhId);
/* 작품이 있는 전시대만 순서에 넣고, 빠진 전시대는 맨 뒤에 붙여요 */
function normalize(D, works){
  const ok = new Set((works || []).map(w => w.id)), taken = new Set();
  D.map.items.forEach(it => { if (HOLDS(it.k)){ it.ws = (it.ws || []).filter(id => ok.has(id) && !taken.has(id)); it.ws.forEach(id => taken.add(id)); } else delete it.ws; });
  const holders = new Set(D.map.items.filter(it => it.ws && it.ws.length).map(it => it.id));
  const seen = new Set();
  D.order = D.order.filter(id => holders.has(id) && !seen.has(id) && seen.add(id));
  D.map.items.forEach(it => { if (holders.has(it.id) && !seen.has(it.id)){ seen.add(it.id); D.order.push(it.id); } });
  return D;
}
const itemById = (D, id) => D.map.items.find(it => it.id === id);
const numOf = (D, id) => { const i = D.order.indexOf(id); return i < 0 ? 0 : i + 1; };
function placeName(D, it){
  if (!it) return '';
  const n = numOf(D, it.id);
  if (n) return n + '번' + (it.lab ? ' · ' + it.lab : '');
  if (it.lab) return it.lab;
  // 번호도 이름도 없는 전시대는 위쪽 왼쪽부터 센 자리로 구별해요
  const hs = D.map.items.filter(x => HOLDS(x.k) && !numOf(D, x.id) && !x.lab).sort((a, b) => a.y - b.y || a.x - b.x);
  return `빈 ${K[it.k].name} · 위에서 ${hs.indexOf(it) + 1}번째`;
}
function whereIs(D, wid){ return D.map.items.find(it => (it.ws || []).includes(wid)); }

/* ---------- 지도 그리기 (tour/index.html의 drawMap과 같은 모양) ----------
   단위는 cm예요. o: { sel, pick(Set), focus, editor, minHit(cm) } */
function mapSVG(D, o){
  o = o || {};
  const M = D.map, W = M.W, H = M.H, U = Math.max(W, H), pad = U * 0.05, BR = U / 40;
  const items = M.items, order = D.order;
  const cx = it => it.x + it.w / 2, cy = it => it.y + it.h / 2;
  const R = it => Math.max(Math.min(it.w, it.h) / 2, BR * (o.bs || 1));
  const sw = U / 400;
  let s = `<rect x="0" y="0" width="${W}" height="${H}" class="floor" stroke-width="${sw * 2}"/>`;
  if (o.editor){ for (let x = 100; x < W; x += 100) s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" class="grid" stroke-width="${sw * (x % 500 ? 0.5 : 1)}"/>`;
    for (let y = 100; y < H; y += 100) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" class="grid" stroke-width="${sw * (y % 500 ? 0.5 : 1)}"/>`; }
  const layer = k => items.filter(it => it.k === k);
  layer('zone').forEach(it => { s += `<g data-g="${it.id}"><rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" rx="${BR * 0.3}" class="zone" stroke-width="${sw}" stroke-dasharray="${sw * 4} ${sw * 3}"/>${it.lab ? `<text x="${it.x + BR * 0.4}" y="${it.y + BR * 0.95}" class="zl" font-size="${BR * 0.8}">${esc(it.lab)}</text>` : ''}</g>`; });
  layer('wall').forEach(it => { s += `<rect data-g="${it.id}" x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" class="wall"/>`; });
  ['door', 'exit'].forEach(k => layer(k).forEach(it => {
    const lab = it.lab || K[k].name, vert = it.h > it.w, fs = BR * 0.85;
    const tx = vert ? (it.x + it.w / 2 > W / 2 ? it.x - fs * 0.5 : it.x + it.w + fs * 0.5) : cx(it), ty = vert ? cy(it) + fs * 0.35 : (it.y + it.h / 2 > H / 2 ? it.y - fs * 0.45 : it.y + it.h + fs * 1.05);
    const anchor = vert ? (it.x + it.w / 2 > W / 2 ? 'end' : 'start') : 'middle';
    s += `<g data-g="${it.id}"><rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" class="door ${k}"/><text x="${tx}" y="${ty}" text-anchor="${anchor}" class="dl" font-size="${fs}">${esc(lab)}</text></g>`;
  }));
  layer('text').forEach(it => { s += `<text data-g="${it.id}" x="${cx(it)}" y="${cy(it) + it.h * 0.22}" text-anchor="middle" class="tx" font-size="${it.h * 0.62}">${esc(it.lab || '글씨')}</text>`; });
  items.filter(it => HOLDS(it.k)).forEach(it => {
    const n = numOf(D, it.id), has = it.ws && it.ws.length;
    s += `<rect data-g="${it.id}" x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" rx="${Math.min(it.w, it.h) * 0.08}" class="hold${has ? ' has' : ''}${o.focus === it.id ? ' focus' : ''}" stroke-width="${sw * 1.2}"/>`;
    if (!n && o.editor) s += `<text x="${cx(it)}" y="${cy(it) + BR * 0.3}" text-anchor="middle" class="empty" font-size="${BR * 0.8}">+</text>`;
  });
  // 동선: 입구 → 1번 → 2번 … → 출구
  if (M.route !== false && order.length){
    const door = layer('door')[0], exit = layer('exit')[0];
    const pts = [];
    if (door) pts.push({ x: cx(door), y: cy(door), r: 0 });
    order.forEach(id => { const it = itemById(D, id); if (it) pts.push({ x: cx(it), y: cy(it), r: R(it) * 1.05 }); });
    if (exit) pts.push({ x: cx(exit), y: cy(exit), r: 0 });
    let path = '', arrows = '';
    for (let i = 1; i < pts.length; i++){
      const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy); if (L < a.r + b.r + 1) continue;
      const ux = dx / L, uy = dy / L, x1 = a.x + ux * a.r, y1 = a.y + uy * a.r, x2 = b.x - ux * b.r, y2 = b.y - uy * b.r;
      path += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, ang = Math.atan2(dy, dx) * 180 / Math.PI, A = BR * 0.55;
      if (Math.hypot(x2 - x1, y2 - y1) > A * 2.4) arrows += `<path d="M${A} 0L${-A * 0.7} ${A * 0.7}L${-A * 0.7} ${-A * 0.7}Z" transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(${ang.toFixed(1)})" class="arw"/>`;
    }
    s += `<path d="${path}" class="route" stroke-width="${BR * 0.16}" stroke-dasharray="${BR * 0.5} ${BR * 0.35}" fill="none"/>${arrows}`;
  }
  order.forEach((id, i) => { const it = itemById(D, id); if (!it) return; const r = R(it);
    s += `<g class="badge${o.focus === id ? ' focus' : ''}" data-stop="${id}"><circle cx="${cx(it)}" cy="${cy(it)}" r="${r}"/><text x="${cx(it)}" y="${cy(it) + r * 0.36}" text-anchor="middle" font-size="${r * (i >= 9 ? 0.9 : 1.05)}">${i + 1}</text></g>`; });
  if (o.pick) [...o.pick].forEach((id, i) => { const it = itemById(D, id); if (!it) return; s += `<circle cx="${cx(it)}" cy="${cy(it)}" r="${R(it) * 1.35}" class="picked"/>`; });
  // 고른 것 테두리 + 누를 곳
  if (o.sel){ const it = itemById(D, o.sel); if (it){ const g = BR * 0.25; s += `<rect x="${it.x - g}" y="${it.y - g}" width="${it.w + g * 2}" height="${it.h + g * 2}" class="selbox" stroke-width="${sw * 1.6}" stroke-dasharray="${sw * 3} ${sw * 2}"/>`; } }
  if (o.editor){
    const mh = o.minHit || 0;
    items.slice().sort((a, b) => (b.w * b.h) - (a.w * a.h)).forEach(it => {
      const gx = Math.max(0, (mh - it.w) / 2), gy = Math.max(0, (mh - it.h) / 2);
      s += `<rect class="hit${o.sel === it.id ? ' sel' : ''}" data-id="${it.id}" x="${it.x - gx}" y="${it.y - gy}" width="${it.w + gx * 2}" height="${it.h + gy * 2}"/>`;
    });
  }
  return { vb: `${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`, body: s };
}

/* ---------- 서버 ---------- */
const X = { exhId: '', ex: null, list: [] };
async function call(fn, ...args){
  if ((!LIVE || TUTON()) && Mock[fn]){ await new Promise(r => setTimeout(r, 140)); return clone(Mock[fn](...clone(args))); }
  return DG.api(fn, ...args);
}
const tourUrl = () => DG.SITE + 'tour/?s=' + encodeURIComponent(X.exhId);

/* ---------- 상태 ---------- */
const S = { A: null, D: null, tab: 'intro', sel: null, zoom: 1, pick: null, undo: [], dirty: false, theme: null, multi: false, works: [] };
const draftKey = () => 'dg_ga_draft_' + (LIVE ? '' : 'demo_') + X.exhId;
function markDirty(){ S.dirty = true; lsSet(draftKey(), { at: (S.A && S.A.guide && S.A.guide.at) || 0, t: Date.now(), d: S.D }); drawStatus(); }
function snap(){ S.undo.push(JSON.stringify({ map: S.D.map, order: S.D.order })); if (S.undo.length > 40) S.undo.shift(); }
function undo(){ const u = S.undo.pop(); if (!u) return toast('되돌릴 게 없어요'); const o = JSON.parse(u); S.D.map = o.map; S.D.order = o.order; if (S.sel && !itemById(S.D, S.sel)) S.sel = null; markDirty(); drawTab(); }
const savedJSON = () => JSON.stringify(normalize(fromServer(S.A.guide, X.ex.title), S.works));
const worksChanged = () => JSON.stringify(S.works) !== JSON.stringify(S.A.works || []);

/* ---------- 화면 틀 ---------- */
function mount(){
  host = document.getElementById('v-annae');
  if (!host.shadowRoot){
    root = host.attachShadow({ mode: 'open' });
    const st = document.createElement('style'); st.textContent = CSS; root.appendChild(st);
    const wrap = document.createElement('div');
    wrap.innerHTML = `<header class="top"><div class="in"><button class="mk" data-a="back" aria-label="전시회 화면으로"><img src="logo.png" alt=""></button><span class="ln"></span><span class="ttl">임원진 · 전시 안내서</span><button class="back" data-a="back">← 전시회로</button></div></header><div class="main" id="app"></div><div class="toast" id="toast" role="status"></div><div class="pvwrap" id="pvwrap" hidden></div><div class="lfwrap" id="lfwrap" hidden></div>`;
    while (wrap.firstChild) root.appendChild(wrap.firstChild);
    wire();
  } else root = host.shadowRoot;
  if (!document.getElementById('an-global')){
    const g = document.createElement('style'); g.id = 'an-global';
    g.textContent = 'body[data-view="annae"]{background:var(--an-bg,#eef0eb)!important}body[data-view="annae"] main.wrap{max-width:none;padding:0;margin:0}#v-annae{display:block}#v-annae[hidden]{display:none}';
    document.head.appendChild(g);
  }
  applyTheme(); watchTheme();
}

async function admin(exhId, ex, list, tab){
  mount(); X.exhId = exhId; X.ex = ex || { id: exhId, title: '' }; X.list = list || [];
  S.works = pubWorks(X.list); S.tab = tab === 'leaf' ? 'pub' : ['intro', 'map', 'works', 'pub', 'inv'].includes(tab) ? tab : (S.tab === 'leaf' ? 'pub' : S.tab || 'intro');
  S.sel = null; S.pick = null; S.undo = []; S.multi = false;
  const ck = 'dg_ga_adm_' + exhId, cached = DG.cacheGet ? DG.cacheGet(DG.PWK, ck) : null;
  if (cached){ setData(cached); render(); }
  else $('#app').innerHTML = `<p class="muted small" style="margin-top:40px">불러오는 중…</p>`;
  S.themeFor = null; loadTheme();
  try {
    const A = await call('gaAdmin', DG.S.pw, exhId);
    if (DG.cacheSet) DG.cacheSet(DG.PWK, ck, A);
    if (!cached || !S.dirty){ setData(A); render(); } else S.A = A;
  } catch(e){
    if (!cached) $('#app').innerHTML = `<div class="card" style="margin-top:30px"><h2>불러오지 못했어요</h2><p class="muted">${esc(/알 수 없는 요청/.test(e.message) ? '관람 안내는 앱스 스크립트에 Annae.gs를 넣고 [새 버전]으로 배포하면 열려요.' : e.message)}</p><button class="btn" data-a="back">← 전시회로</button></div>`;
  }
}
function setData(A){
  S.staff = null; S.A = A; S.D = normalize(fromServer(A.guide, X.ex.title), S.works); S.dirty = false;
  const bk = lsGet(draftKey(), null);
  if (bk && bk.d && bk.t > ((A.guide && A.guide.at) || 0)){ S.D = normalize(fromServer(bk.d, X.ex.title), S.works); S.dirty = JSON.stringify(S.D) !== savedJSON(); S.restored = S.dirty; }
  if (!S.dirty) lsSet(draftKey(), null);
}
async function loadTheme(){
  if (S.themeFor === X.exhId) return; S.themeFor = X.exhId;
  try { const p = await call('sjInfo', X.exhId); S.theme = p && p.theme || null; } catch(e){ S.theme = null; }
  const el = $('#design'); if (el) el.innerHTML = designCard();
  const cv = $('#cov'); if (cv){ cv.innerHTML = coverHTML(); loadCoverImg(); }
}
/* 디자인: 전시회마다 상주 시간표 [디자인] 탭에서 포스터에 맞춰 정한 걸 같이 써요 */
const FONT_NAME = { plex: '기본 글꼴', gmarket: 'G마켓 산스', batang: '제목만 고운 바탕' };
function designCard(){
  const t = S.theme, poster = !!(t && t.mode === 'poster');
  const sw = poster ? ['bg', 'ink', 'muted', 'accent'].map(k => `<span class="swc" style="background:${esc(t[k] || '#888')}" title="${esc(t[k] || '')}"></span>`).join('') : '';
  return `<div class="row" style="align-items:flex-start"><div class="grow"><h3 style="margin:0 0 4px">디자인 · ${poster ? '전시 포스터에 맞춤' : '도각도각 기본'}</h3>
    <p class="muted small" style="margin:0">${poster ? `${sw ? `<span class="sws">${sw}</span> ` : ''}${esc(FONT_NAME[t.font] || FONT_NAME.plex)}${t.title ? ' · 포스터 제목 그림' : ''}${t.pattern ? ' · 배경 무늬' : ''}` : '아직 이 전시회의 포스터 디자인을 정하지 않아서 도각도각 기본 디자인으로 보여요.'}</p>
    <p class="muted small" style="margin:6px 0 0">디자인은 전시회마다 따로 정해요. 상주 시간표 [디자인] 탭에서 포스터를 올리면 색 · 제목 · 무늬를 뽑아서, 상주 시간표와 관람 안내에 같이 써요.</p></div>
    ${DG.openSangju ? `<button class="btn ghost sm" data-a="design">${poster ? '디자인 바꾸기' : '포스터로 디자인 정하기'}</button>` : ''}</div>`;
}
function render(){ document.title = (X.ex.title || '전시회') + ' · 전시 안내서'; main(); }
function main(){
  const A = S.A, n = S.works.length;
  $('#app').innerHTML = `
  <div class="atop"><h1 style="margin:0">${esc(X.ex.title)}</h1><span class="sp"></span>
    <button class="btn ghost sm" data-a="refresh">새로고침</button>
    <button class="btn ghost sm" data-a="preview">안내 화면 미리보기</button></div>
  <div class="status" id="status"></div>
  <div class="tabs">
    <button data-t="intro">소개</button><button data-t="map">전시회장 구성</button><button data-t="works">작품 ${n}</button><button data-t="pub">안내 화면 · 리플렛</button><button data-t="inv">초대장</button>
  </div>
  <div id="tab"></div>`;
  $$('.tabs button').forEach(b => { b.classList.toggle('on', b.dataset.t === S.tab); b.onclick = () => { S.tab = b.dataset.t; S.pick = null; S.multi = false; if (DG.route) DG.route({ v: 'ga', id: X.exhId, tab: S.tab }); main(); }; });
  drawStatus(); drawTab();
}
function drawStatus(){
  const el = $('#status'); if (!el || !S.A) return;
  const pub = !!(S.A.guide && S.A.guide.published), unplaced = S.works.filter(w => !whereIs(S.D, w.id)).length;
  const ipub = !!(S.A.guide && S.A.guide.inv && S.A.guide.inv.pub);
  el.innerHTML = `<span class="chip ${pub ? 'on' : 'off'}">${pub ? '안내 화면 여는 중' : '안내 화면 닫힘'}</span><span class="chip ${ipub ? 'on' : 'off'}">${ipub ? '초대장 여는 중' : '초대장 닫힘'}</span>
    ${S.dirty ? `<span class="chip warn">저장 안 한 내용 있음</span>` : (worksChanged() && S.A.guide ? `<span class="chip warn">출품 기획서가 바뀌었어요 · 저장하면 반영돼요</span>` : '')}
    ${unplaced ? `<span class="chip">지도에 안 놓은 작품 ${unplaced}점</span>` : ''}
    <span class="sp"></span>
    ${S.restored && S.dirty ? `<button class="btn ghost sm" data-a="discard">저장 안 한 내용 버리기</button>` : ''}
    <button class="btn ${S.dirty || (worksChanged() && S.A.guide) ? 'primary' : 'ghost'} sm" data-a="save">저장하기</button>`;
}
function drawTab(){ ({ intro: tabIntro, map: tabMap, works: tabWorks, pub: tabPub, inv: tabInvite })[S.tab](); }

/* ---------- 소개 탭: 표지(포스터로 만든 예시 + 수정하기) · 축사 · 임원진 · 관람 안내 ---------- */
function coverHTML(){
  const D = S.D, t = S.theme && S.theme.mode === 'poster' ? S.theme : null;
  const st = t ? `background:${esc(t.bg)};color:${esc(t.ink)}` : '';
  return `<div class="cov${t ? ' pos' : ''}" style="${st}">
    <div class="covk" style="${t ? `color:${esc(t.muted)}` : ''}">${esc(D.label)}</div>
    ${t && t.title ? `<img class="covti" data-ph="${esc(t.title)}" alt="${esc(X.ex.title)}">` : `<div class="covt">${esc(X.ex.title)}</div>${D.sub ? `<div class="covs">${esc(D.sub)}</div>` : ''}`}
    <div class="covd" style="${t ? `color:${esc(t.muted)}` : ''}">${esc([D.dates, D.place].filter(Boolean).join('\n'))}</div></div>`;
}
function loadCoverImg(){ $$('img[data-ph]:not([src])').forEach(im => photo(im.dataset.ph).then(src => { if (src) im.src = src; else im.remove(); })); }
function tabIntro(){
  const D = S.D, pres = D.sections.find(x => x.id === 'pres'), alum = D.sections.find(x => x.id === 'alum');
  const sec = (x, hint) => `<div class="card stack" data-sid="${x.id}"><div class="row"><h2 style="margin:0">${esc(x.t)}</h2><span class="chip">${hint}</span></div>
      <textarea class="inp" data-fix="b" maxlength="3000" rows="${Math.min(14, Math.max(5, (x.b.match(/\n/g) || []).length + 2))}" placeholder="본문 (줄 바꿈이 리플렛에 그대로 들어가요)">${esc(x.b)}</textarea>
      <input class="inp" data-fix="s" value="${esc(x.s)}" maxlength="80" placeholder="끝에 붙일 이름 (선택) 예: 2026 2학기 목방 회장 39기 ○○○"></div>`;
  $('#tab').innerHTML = `
  <div class="card row prevrow"><div class="grow"><b>지난 전시회에서 불러오기</b><div class="muted small">전시회장 구성(전시대 배치) · 관람 안내 · 초대장 맺음말을 그대로 가져와요. 작품 자리는 비워요.</div></div>
    <button class="btn ghost sm" data-a="prev-open">불러오기</button></div>
  <div id="prevp"></div>
  <div class="card">
    <div class="row"><h2 style="margin:0">표지</h2><span class="sp"></span><button class="btn ${S.covEdit ? 'primary' : 'ghost'} sm" data-a="cov-edit" aria-expanded="${!!S.covEdit}">${S.covEdit ? '수정 닫기' : '수정하기'}</button></div>
    <p class="muted small" style="margin:6px 0 12px">포스터 디자인으로 만든 표지예요. 안내 화면 맨 위, 초대장, 리플렛 표지에 들어가요.</p>
    <div id="cov">${coverHTML()}</div>
    ${S.covEdit ? `<div class="sub stack">
      <div class="grid2"><div><label class="f" for="f-label">위 작은 글씨</label><input class="inp" id="f-label" data-f="label" maxlength="40" value="${esc(D.label)}" placeholder="예: 목방 제40회 전시회"></div>
        <div><label class="f" for="f-sub">부제 <span class="muted">(포스터 제목 그림이 있으면 그림 속 부제로 대신해요)</span></label><input class="inp" id="f-sub" data-f="sub" maxlength="80" value="${esc(D.sub)}" placeholder="예: 차가운 계절에 새긴 따스함"></div></div>
      <div class="grid2"><div><label class="f" for="f-dates">일정 <span class="muted">(줄마다 하나씩)</span></label><textarea class="inp" id="f-dates" data-f="dates" maxlength="400" rows="3" placeholder="12월 24일(목) – 25일(금) 11:00 – 18:00">${esc(D.dates)}</textarea></div>
        <div><label class="f" for="f-place">장소</label><input class="inp" id="f-place" data-f="place" maxlength="100" value="${esc(D.place)}"></div></div>
    </div>` : ''}
  </div>
  ${sec(pres, '리플렛에만')}
  ${sec(alum, '리플렛에만')}
  <div class="card stack"><div class="row"><h2 style="margin:0">임원진 소개</h2><span class="chip">리플렛 · 초대장(고르면)</span></div>
    <p class="muted small" style="margin:0">직책마다 '기수 이름 학과 학번'을 적어요. 빈 칸은 안 나와요. 차장 · 부원은 [+ 더하기]로 사람 수만큼 칸을 늘려요.</p>
    <div class="staff" id="staff">${staffHTML()}</div></div>
  <div class="card stack"><div class="row"><h2 style="margin:0">관람 안내</h2><span class="chip">안내 화면</span></div>
    <textarea class="inp" id="f-notes" data-f="notes" maxlength="1000" rows="3" placeholder="작품은 눈으로만 감상해 주세요.&#10;궁금한 점은 상주 중인 부원에게 물어봐 주세요." aria-label="관람 안내 (줄마다 하나씩)">${esc(D.notes)}</textarea>
    <p class="muted small" style="margin:0">줄마다 하나씩 적어요. 안내 화면의 지도 아래에 나와요.</p></div>
  <details class="card fixed"><summary><b>늘 같은 내용</b> <span class="muted small">— 목방은 어떤 동아리인가요? · 찾아오시는 길</span></summary>
    <p class="muted small">고칠 필요 없이 해마다 그대로 들어가요.</p>
    <div class="fx"><b>목방은 어떤 동아리인가요?</b><span class="muted small">안내 화면 맨 끝 · 리플렛</span><p class="desc">${esc(CLUB_INTRO)}</p></div>
    <div class="fx"><b>찾아오시는 길</b><span class="muted small">초대장 · 리플렛</span><p class="desc">${esc(PLACE)}\n${esc(WAY)}</p></div></details>
  <div class="card" id="design">${designCard()}</div>`;
  loadCoverImg();
}
function staffHTML(){
  const L = S.staff || (S.staff = staffRows(S.D.staff));
  const row = (x, i) => `<div class="srow"><label class="f sr0" for="st-${i}">${x.other && !x.r ? '<input class="inp" data-sr="' + i + '" placeholder="직책" aria-label="직책">' : esc(x.r)}</label>
    <input class="inp" id="st-${i}" data-sv="${i}" value="${esc(x.v)}" maxlength="60" placeholder="예: 39기 홍길동 화학공학부 23학번">${(MULTI.has(x.r) && L.filter(y => y.r === x.r).length > 1) || x.other ? `<button class="btn ghost sm" data-a="staff-del" data-i="${i}" aria-label="이 칸 빼기">×</button>` : ''}</div>`;
  const groups = STAFF_GROUPS.map(G => {
    const rs = G.roles.map(R => R.r), mine = L.map((x, i) => [x, i]).filter(([x]) => !x.other && rs.includes(x.r));
    const adds = G.roles.filter(R => R.multi).map(R => `<button class="btn ghost sm" data-a="staff-add" data-r="${esc(R.r)}">+ ${esc(R.r)} 더하기</button>`).join('');
    return `<div class="sgrp"><div class="sgh">${esc(G.g)}</div>${mine.map(([x, i]) => row(x, i)).join('')}${adds ? `<div class="sadd">${adds}</div>` : ''}</div>`;
  }).join('');
  const others = L.map((x, i) => [x, i]).filter(([x]) => x.other);
  return groups + (others.length ? `<div class="sgrp"><div class="sgh">그 밖에 <span class="muted small">(예전 직책 · 필요 없으면 ×)</span></div>${others.map(([x, i]) => row(x, i)).join('')}</div>` : '');
}
async function openPrev(){
  const el = $('#prevp'); if (!el) return;
  el.innerHTML = `<div class="card"><p class="muted small" style="margin:0">전시회 목록을 불러오는 중…</p></div>`;
  let L = []; try { L = DG.exhList ? await DG.exhList() : []; } catch(e){}
  L = (L || []).filter(e => e.id !== X.exhId).sort((a, b) => (b.at || 0) - (a.at || 0));
  el.innerHTML = `<div class="card stack">${L.length ? `<label class="f" for="prev-sel">어느 전시회에서 가져올까요?</label>
    <select class="inp" id="prev-sel">${L.map(e => `<option value="${esc(e.id)}">${esc(e.title)}</option>`).join('')}</select>
    <p class="muted small" style="margin:0">지금 [전시회장 구성] · [관람 안내] · [초대장 맺음말]은 가져온 걸로 바뀌어요. 표지 · 축사 · 임원진 · 작품은 그대로예요.</p>
    <div class="row"><button class="btn primary sm" data-a="prev-go">가져오기</button><button class="btn ghost sm" data-a="prev-close">닫기</button></div>`
    : `<p class="muted small" style="margin:0">가져올 다른 전시회가 없어요.</p><div><button class="btn ghost sm" data-a="prev-close">닫기</button></div>`}</div>`;
}
async function prevGo(){
  const id = ($('#prev-sel') || {}).value; if (!id) return;
  try {
    const A = await call('gaAdmin', DG.S.pw, id), g = A && A.guide;
    if (!g || !g.map){ return toast('그 전시회에는 아직 만든 전시 안내서가 없어요.'); }
    snap();
    const m = clone(g.map); (m.items || []).forEach(it => { if (it.ws) it.ws = []; });
    S.D.map = Object.assign({ W: 1500, H: 1000, route: true, items: [] }, m); S.D.order = [];
    if (g.notes) S.D.notes = g.notes;
    if (g.inv && g.inv.end) S.D.inv.end = g.inv.end;
    normalize(S.D, S.works); markDirty(); tabIntro();
    toast(`'${(A.ex && A.ex.title) || '지난 전시회'}'의 전시회장 구성과 관람 안내를 가져왔어요`);
  } catch(e){ toast(e.message); }
}

/* ---------- 전시회장 구성 탭 (전시대 배치 · 관람 순서) ---------- */
function tabMap(){
  const D = S.D, M = D.map;
  $('#tab').innerHTML = `
  <div class="card">
    <div class="row" style="justify-content:space-between">
      <div class="row" style="gap:6px"><label class="f" style="margin:0">방 크기</label>
        <input class="inp n" type="number" inputmode="decimal" step="0.5" min="2" max="100" data-room="W" value="${M.W / 100}" aria-label="가로 m"><span class="muted small">m ×</span>
        <input class="inp n" type="number" inputmode="decimal" step="0.5" min="2" max="100" data-room="H" value="${M.H / 100}" aria-label="세로 m"><span class="muted small">m</span></div>
      <label class="ck sm"><input type="checkbox" data-a="route" ${M.route !== false ? 'checked' : ''}> 동선 화살표</label>
    </div>
    <div class="tools">
      ${['stand', 'table', 'wall', 'door', 'exit', 'text', 'zone'].map(k => `<button class="tl" data-add="${k}" title="${esc(K[k].hint || '')}">+ ${K[k].name}</button>`).join('')}
      <button class="tl" data-a="multi" aria-expanded="${S.multi}">여러 개 한 번에</button>
    </div>
    <div id="multi"></div>
    <div class="mapwrap"><div class="zoom"><button data-z="-1" aria-label="작게">−</button><button data-z="0">맞추기</button><button data-z="1" aria-label="크게">+</button><button data-a="undo" aria-label="되돌리기">↶</button></div>
      <div class="mapbox" id="mapbox"><svg id="map" xmlns="http://www.w3.org/2000/svg"></svg></div></div>
    <p class="muted small" id="maphint" style="margin:8px 0 0"></p>
    <div id="selp"></div>
  </div>
  <div class="card" id="orderp"></div>`;
  drawMulti(); drawMap(true); drawSel(); drawOrder();
}
function scale(){ const box = $('#mapbox'), svg = $('#map'); if (!box || !svg) return 1; const W = S.D.map.W, H = S.D.map.H, U = Math.max(W, H); return svg.clientWidth / (W + U * 0.1); }
function drawMap(fit){
  const box = $('#mapbox'), svg = $('#map'); if (!box) return;
  const M = S.D.map, U = Math.max(M.W, M.H), vbW = M.W + U * 0.1, vbH = M.H + U * 0.1;
  const baseW = box.clientWidth || 600, w = Math.round(baseW * S.zoom);
  svg.setAttribute('width', w); svg.setAttribute('height', Math.round(w * vbH / vbW));
  const r = mapSVG(S.D, { editor: true, sel: S.sel, pick: S.pick ? new Set(S.pick) : null, minHit: 34 / (w / vbW) });
  svg.setAttribute('viewBox', r.vb); svg.innerHTML = r.body;
  const h = $('#maphint');
  if (h) h.textContent = S.pick ? `보는 순서대로 전시대를 눌러 주세요 (${S.pick.length} / ${S.D.order.length})` : S.sel ? '한 번 더 누른 채로 끌면 옮겨져요. 빈 곳을 누르면 선택이 풀려요.' : '놓을 것을 위 단추로 더하고, 눌러서 고른 뒤 끌어서 옮겨요. 숫자는 관람 순서예요.';
}
function visibleCenter(){
  const box = $('#mapbox'), sc = scale(), M = S.D.map, U = Math.max(M.W, M.H), pad = U * 0.05;
  return { x: (box.scrollLeft + box.clientWidth / 2) / sc - pad, y: (box.scrollTop + Math.min(box.clientHeight, $('#map').clientHeight) / 2) / sc - pad };
}
const snap10 = v => Math.round(v / 10) * 10;
function addItem(k, at){
  const M = S.D.map, c = at || visibleCenter(), d = K[k];
  let x = snap10(Math.max(0, Math.min(M.W - d.w, c.x - d.w / 2))), y = snap10(Math.max(0, Math.min(M.H - d.h, c.y - d.h / 2)));
  while (M.items.some(it => it.x === x && it.y === y)){ x += 20; y += 20; }
  const it = { id: uid(), k, x, y, w: d.w, h: d.h, lab: '' }; if (HOLDS(k)) it.ws = [];
  snap(); M.items.push(it); S.sel = it.id; markDirty(); drawMap(); drawSel(); drawOrder();
  return it;
}
function drawMulti(){
  const el = $('#multi'); if (!el) return;
  if (!S.multi){ el.innerHTML = ''; return; }
  const m = S.mset || (S.mset = { k: 'stand', n: 10, cols: 5, gx: 120, gy: 150 });
  el.innerHTML = `<div class="sub stack"><b class="small">전시대를 줄 맞춰 여러 개 놓기</b>
    <div class="radio small">${['stand', 'table'].map(k => `<label><input type="radio" name="mk" value="${k}" ${m.k === k ? 'checked' : ''}> ${K[k].name}</label>`).join('')}</div>
    <div class="grid4"><label class="f">몇 개<input class="inp" type="number" min="1" max="60" data-m="n" value="${m.n}"></label><label class="f">한 줄에<input class="inp" type="number" min="1" max="30" data-m="cols" value="${m.cols}"></label>
      <label class="f">옆 간격 cm<input class="inp" type="number" min="0" max="2000" step="10" data-m="gx" value="${m.gx}"></label><label class="f">줄 간격 cm<input class="inp" type="number" min="0" max="2000" step="10" data-m="gy" value="${m.gy}"></label></div>
    <p class="muted small" style="margin:0">간격은 전시대 한가운데에서 옆 전시대 한가운데까지예요. 지금 보이는 곳 가운데부터 놓여요.</p>
    <div class="row"><button class="btn primary sm" data-a="multi-go">놓기</button><button class="btn ghost sm" data-a="multi">닫기</button></div></div>`;
}
function multiGo(){
  const m = S.mset, d = K[m.k], M = S.D.map, n = Math.max(1, Math.min(60, +m.n || 1)), cols = Math.max(1, Math.min(30, +m.cols || 1));
  const rows = Math.ceil(n / cols), c = visibleCenter();
  const x0 = c.x - ((cols - 1) * m.gx) / 2 - d.w / 2, y0 = c.y - ((rows - 1) * m.gy) / 2 - d.h / 2;
  snap();
  for (let i = 0; i < n; i++){
    const it = { id: uid(), k: m.k, x: snap10(x0 + (i % cols) * m.gx), y: snap10(y0 + Math.floor(i / cols) * m.gy), w: d.w, h: d.h, lab: '', ws: [] };
    it.x = Math.max(0, Math.min(M.W - it.w, it.x)); it.y = Math.max(0, Math.min(M.H - it.h, it.y)); M.items.push(it);
  }
  S.multi = false; S.sel = null; markDirty(); drawMulti(); drawMap(); drawSel(); drawOrder(); toast(`${K[m.k].name} ${n}개를 놓았어요`);
}
function drawSel(){
  const el = $('#selp'); if (!el) return;
  const it = S.sel && itemById(S.D, S.sel);
  if (!it || S.pick){ el.innerHTML = ''; return; }
  const n = numOf(S.D, it.id), holds = HOLDS(it.k);
  const ph = { stand: '예: 창가 쪽', table: '예: 소품 테이블', door: '입구', exit: '출구', text: '예: 무대 · 발표회 자리', zone: '예: 38기 작품', wall: '' }[it.k];
  el.innerHTML = `<div class="sub stack">
    <div class="row"><b>${esc(K[it.k].name)}${n ? ` · ${n}번` : ''}</b><span class="sp"></span>
      <button class="btn ghost sm" data-a="rot" title="가로 세로 바꾸기">90° 돌리기</button><button class="btn ghost sm" data-a="dup">복사</button><button class="btn danger sm" data-a="del">지우기</button></div>
    ${it.k !== 'wall' ? `<div><label class="f">${it.k === 'text' ? '보일 글씨' : '이름 (선택)'}</label><input class="inp" data-it="lab" maxlength="40" value="${esc(it.lab)}" placeholder="${esc(ph)}"></div>` : ''}
    <div class="grid4">
      <label class="f">가로 cm<input class="inp" type="number" min="5" step="5" data-it="w" value="${it.w}"></label><label class="f">세로 cm<input class="inp" type="number" min="5" step="5" data-it="h" value="${it.h}"></label>
      <div class="nudge"><span class="f">조금씩 옮기기</span><div><button data-nx="-1" aria-label="왼쪽">←</button><button data-ny="-1" aria-label="위">↑</button><button data-ny="1" aria-label="아래">↓</button><button data-nx="1" aria-label="오른쪽">→</button></div></div>
    </div>
    ${holds ? `<div><label class="f">올린 작품 <span class="muted">(${(it.ws || []).length}점 · 고르면 관람 순서에 들어가요)</span></label>${worksPicker(it)}</div>` : ''}
  </div>`;
}
function worksPicker(it){
  if (!S.works.length) return `<p class="muted small" style="margin:0">아직 들어온 출품 기획서가 없어요.</p>`;
  return `<div class="wpick">${S.works.map(w => { const at = whereIs(S.D, w.id), mine = at && at.id === it.id;
    return `<label class="ck"><input type="checkbox" data-w="${esc(w.id)}" ${mine ? 'checked' : ''}><span class="grow"><b>${esc(w.t || '(제목 없음)')}</b> <span class="muted">${esc(whoText(w))}</span></span>${at && !mine ? `<span class="ld">${esc(placeName(S.D, at))}에 있음</span>` : ''}</label>`; }).join('')}</div>`;
}
function drawOrder(){
  const el = $('#orderp'); if (!el) return;
  const D = S.D, wmap = Object.fromEntries(S.works.map(w => [w.id, w]));
  if (S.pick){ el.innerHTML = `<h2>관람 순서 정하는 중</h2><p class="muted small">위 지도에서 관람객이 볼 순서대로 전시대를 하나씩 눌러 주세요. 다시 누르면 빠져요.</p>
    <ol class="olist">${S.pick.map(id => `<li><b>${esc(placeName(D, itemById(D, id)).replace(/^\d+번/, '') || K[itemById(D, id).k].name)}</b></li>`).join('')}</ol>
    <div class="row"><button class="btn primary sm" data-a="pick-done">다 했어요</button><button class="btn ghost sm" data-a="pick-cancel">그만두기</button></div>`; return; }
  el.innerHTML = `<div class="row"><h2 style="margin:0">관람 순서</h2><span class="sp"></span>
      ${D.order.length > 1 ? `<button class="btn ghost sm" data-a="auto">입구에서 가까운 순서로</button><button class="btn ghost sm" data-a="pick">지도에서 눌러 정하기</button>` : ''}</div>
    ${D.order.length ? `<p class="muted small">작품을 올린 전시대만 번호가 붙어요. 이 순서대로 안내 화면에 나와요.</p>
    <ol class="olist">${D.order.map((id, i) => { const it = itemById(D, id);
      return `<li class="${S.sel === id ? 'sel' : ''}"><span class="no">${i + 1}</span><button class="lk" data-selid="${id}"><b>${esc(it.lab || K[it.k].name)}</b><span class="muted small">${(it.ws || []).map(w => esc((wmap[w] || {}).t || '')).join(' · ')}</span></button>
        <span class="mv"><button data-mv="-1" data-id="${id}" ${i ? '' : 'disabled'} aria-label="앞으로">↑</button><button data-mv="1" data-id="${id}" ${i < D.order.length - 1 ? '' : 'disabled'} aria-label="뒤로">↓</button></span></li>`; }).join('')}</ol>`
    : `<p class="muted small" style="margin:6px 0 0">전시대를 누르고 [올린 작품]에서 작품을 고르면 여기에 순서가 생겨요. [작품] 탭에서 작품마다 놓을 곳을 골라도 돼요.</p>`}`;
}
function autoOrder(){
  const D = S.D, door = D.map.items.find(it => it.k === 'door');
  let p = door ? { x: door.x + door.w / 2, y: door.y + door.h / 2 } : { x: 0, y: D.map.H };
  const left = D.order.map(id => itemById(D, id)), out = [];
  while (left.length){ let bi = 0, bd = Infinity; left.forEach((it, i) => { const d = Math.hypot(it.x + it.w / 2 - p.x, it.y + it.h / 2 - p.y); if (d < bd){ bd = d; bi = i; } });
    const it = left.splice(bi, 1)[0]; out.push(it.id); p = { x: it.x + it.w / 2, y: it.y + it.h / 2 }; }
  snap(); D.order = out; markDirty(); drawMap(); drawOrder(); toast('입구에서 가까운 전시대부터 이어지게 정했어요');
}

/* 지도 위 누르기 · 끌기 */
let drag = null;
function onDown(e){
  const svg = $('#map'); if (!svg || !svg.contains(e.target)) return;
  const hit = e.target.closest('.hit'), id = hit && hit.dataset.id;
  if (S.pick){ if (!id) return; const it = itemById(S.D, id); if (!it || !(it.ws && it.ws.length)) return toast('작품을 올린 전시대만 고를 수 있어요');
    const i = S.pick.indexOf(id); i < 0 ? S.pick.push(id) : S.pick.splice(i, 1); drawMap(); drawOrder(); if (S.pick.length === S.D.order.length) pickDone(); return; }
  if (!id){ drag = { none: true, sx: e.clientX, sy: e.clientY }; return; }
  if (id !== S.sel){ S.sel = id; drawMap(); drawSel(); drawOrder(); return; }
  const it = itemById(S.D, id), m = svg.getScreenCTM(); if (!m) return;
  drag = { id, sx: e.clientX, sy: e.clientY, ox: it.x, oy: it.y, k: 1 / m.a, moved: false };
  try { svg.setPointerCapture(e.pointerId); } catch(_){}
  e.preventDefault();
}
function onMove(e){
  if (!drag || drag.none) return;
  const dx = (e.clientX - drag.sx) * drag.k, dy = (e.clientY - drag.sy) * drag.k;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
  if (!drag.moved){ snap(); drag.moved = true; }
  const it = itemById(S.D, drag.id), M = S.D.map;
  it.x = Math.max(-it.w / 2, Math.min(M.W - it.w / 2, snap10(drag.ox + dx))); it.y = Math.max(-it.h / 2, Math.min(M.H - it.h / 2, snap10(drag.oy + dy)));
  if (!drag.raf) drag.raf = requestAnimationFrame(() => { if (drag) drag.raf = 0; drawMap(); });
  e.preventDefault();
}
function onUp(e){
  if (!drag) return; const d = drag; drag = null;
  if (d.none){ if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6 && S.sel && !S.pick){ S.sel = null; drawMap(); drawSel(); drawOrder(); } return; }
  if (d.moved){ markDirty(); drawMap(); }
}
function pickDone(){ const D = S.D; snap(); D.order = S.pick.concat(D.order.filter(id => !S.pick.includes(id))); S.pick = null; markDirty(); drawMap(); drawSel(); drawOrder(); toast('관람 순서를 정했어요'); }

/* ---------- 작품 탭 ---------- */
function tabWorks(){
  const D = S.D, holders = D.map.items.filter(it => HOLDS(it.k));
  const opts = sel => `<option value="">지도에 안 놓음</option>${holders.map(it => `<option value="${it.id}" ${sel === it.id ? 'selected' : ''}>${esc(placeName(D, it))}</option>`).join('')}`;
  $('#tab').innerHTML = `
  <p class="muted small" style="margin:0 0 12px">출품 기획서 내용이 그대로 관람객에게 보여요 (학번은 안 보여요). 설명을 고치려면 출품 기획서를 고친 뒤 여기서 [저장하기]를 눌러 주세요.
    ${holders.length ? '' : '<br><b>먼저 [지도 · 순서] 탭에서 전시대를 놓으면, 작품마다 놓을 곳을 고를 수 있어요.</b>'}</p>
  ${S.works.length ? S.works.map(w => { const at = whereIs(D, w.id);
    return `<div class="card wcard"><div class="row" style="align-items:flex-start"><div class="grow"><b class="wt">${esc(w.t || '(제목 없음)')}</b><div class="muted small">${esc(whoText(w))}</div></div>
      <select class="inp place" data-place="${esc(w.id)}" aria-label="놓을 곳">${opts(at && at.id)}</select></div>
      ${w.objs.length ? `<div class="small objs">${w.objs.map(o => esc(objLine(o))).join('<br>')}</div>` : ''}
      ${w.d ? `<details><summary>작품 설명</summary><p class="desc">${esc(w.d)}</p></details>` : '<p class="muted small" style="margin:6px 0 0">작품 설명이 비어 있어요.</p>'}</div>`; }).join('')
    : `<div class="card"><p class="muted" style="margin:0">아직 들어온 출품 기획서가 없어요.</p></div>`}`;
}

/* ---------- 초대장 탭: 전시 전에 보내는 모바일 초대장 (…/invite/) ---------- */
const WD = '일월화수목금토';
function dayLabel(d){ if (!/^\d{4}-\d\d-\d\d$/.test(d || '')) return ''; const t = new Date(d + 'T00:00:00'); return `${t.getMonth() + 1}/${t.getDate()} (${WD[t.getDay()]})`; }
function tabInvite(){ $('#tab').innerHTML = invHTML(); }
function invHTML(){
  const v = S.D.inv, pub = !!(S.A.guide && S.A.guide.inv && S.A.guide.inv.pub);
  return `
  <div class="card stack">
    <div class="row"><h2 style="margin:0">${pub ? '초대장을 보내는 중이에요' : '초대장은 아직 닫혀 있어요'}</h2><span class="sp"></span>
      <button class="btn ghost sm" data-a="inv-preview">초대장 미리보기</button>
      ${pub ? `<button class="btn sm" data-a="inv-copy">초대장 링크 복사</button><button class="btn danger sm" data-a="inv-unpub">초대장 닫기</button>` : `<button class="btn primary sm" data-a="inv-pub">저장하고 초대장 열기</button>`}</div>
    <p class="muted small" style="margin:0">전시 전에 카톡 · 인스타로 보내는 초대장이에요. 안내 화면과 따로 열고 닫아요. ${pub ? '[초대장 링크 복사]로 링크를 보내면 돼요.' : '열고 나면 [초대장 링크 복사]가 생겨요.'}</p>
  </div>
  <div class="card stack">
    <h2>커버와 초대 글</h2>
    <div><label class="f" for="i-hello">커버 초대 문구 <span class="muted">(한 줄)</span></label><input class="inp" id="i-hello" data-inv="hello" maxlength="60" value="${esc(v.hello)}" placeholder="예: 목방 제40회 전시회에 초대합니다"></div>
    <div><label class="f" for="i-text">초대 글 <span class="muted">(전시 소개 멘트 · 빈 줄로 문단을 나눠요)</span></label><textarea class="inp big-ta" id="i-text" data-inv="text" maxlength="3000" rows="12" placeholder="전시를 소개하는 글을 적어 주세요.">${esc(v.text)}</textarea></div>
    <div><label class="f" for="i-end">맺음말</label><input class="inp" id="i-end" data-inv="end" maxlength="300" value="${esc(v.end)}" placeholder="예: 많은 관심 부탁드립니다. 전시장에서 만나요."></div>
  </div>
  <div class="card stack">
    <div class="row"><h2 style="margin:0">전시하는 날</h2><span class="sp"></span><button class="btn ghost sm" data-a="day-add">+ 날짜 더하기</button></div>
    <p class="muted small" style="margin:0">초대장의 달력, 'D-' 카운트다운, [캘린더에 추가]에 쓰여요.</p>
    ${v.days.length ? v.days.map((x, i) => `<div class="row dayrow"><input class="inp" type="date" data-day="${i}" data-k="d" value="${esc(x.d)}" aria-label="날짜"><span class="muted small dl">${esc(dayLabel(x.d))}</span>
      <input class="inp tm" type="time" data-day="${i}" data-k="o" value="${esc(x.o)}" aria-label="여는 시각"><span class="muted">–</span><input class="inp tm" type="time" data-day="${i}" data-k="c" value="${esc(x.c)}" aria-label="닫는 시각">
      <button class="btn ghost sm" data-a="day-del" data-i="${i}" aria-label="이 날짜 빼기">×</button></div>`).join('') : '<p class="muted small" style="margin:0">아직 날짜가 없어요.</p>'}
  </div>
  <div class="card stack">
    <h2>더 보일 것</h2>
    <label class="ck"><input type="checkbox" data-invck="works" ${v.works ? 'checked' : ''}><span class="grow"><b>전시 작품 제목</b><br><span class="muted small">출품 기획서의 작품 제목만 작게 이어서 보여요. 지금 ${S.works.length}점</span></span></label>
    <label class="ck"><input type="checkbox" data-invck="staff" ${v.staff ? 'checked' : ''}><span class="grow"><b>임원진 소개</b><br><span class="muted small">[소개] 탭의 임원진을 '초대하는 사람들'로 보여요</span></span></label>
  </div>
  <p class="muted small">카톡에 링크를 보낼 때 뜨는 그림(아이보리 봉투에 초록 도장)은 해마다 그대로 써요. 들어와서 보이는 초대장 화면은 그해 포스터 디자인을 따라가요.</p>`;
}
function previewInvite(){
  const D = normalize(clone(S.D), S.works), data = invData(D);
  window.__invPv = data;
  try { localStorage.setItem('dg_ga_ivpv', JSON.stringify({ s: X.exhId, t: Date.now(), data })); } catch(e){}
  const w = $('#pvwrap'); w.hidden = false;
  w.innerHTML = `<div class="pvbar"><b>초대장 미리보기</b><span class="muted small">저장하지 않은 내용도 보여요</span><span class="sp"></span><button class="btn sm" data-a="pv-close">닫기</button></div>
    <div class="pvphone"><iframe src="${esc(inviteUrl())}&pv=1" title="초대장 미리보기"></iframe></div>`;
}

/* ---------- 안내 화면 · 리플렛 탭: 전시장에서 쓰는 것 ---------- */
function tabPub(){
  const pub = !!(S.A.guide && S.A.guide.published);
  $('#tab').innerHTML = `
  <div class="card stack">
    <div class="row"><h2 style="margin:0">${pub ? '안내 화면을 여는 중이에요' : '안내 화면은 아직 닫혀 있어요'}</h2><span class="sp"></span>
      <button class="btn ghost sm" data-a="preview">미리보기</button>
      ${pub ? `<button class="btn sm" data-a="copy">링크 복사</button><button class="btn danger sm" data-a="unpub">안내 화면 닫기</button>` : `<button class="btn primary sm" data-a="publish">저장하고 안내 화면 열기</button>`}</div>
    <p class="muted small" style="margin:0">입구 QR을 찍으면 열리는 화면이에요. 전시장 지도와 순서대로 작품 설명이 나와요. ${pub ? '[저장하기]를 누를 때마다 바로 바뀌어요. 출품 기획서가 바뀌었을 때도 [저장하기]를 한 번 눌러 주세요.' : '전시 직전에 열면 돼요. 그 전에 QR을 찍으면 "준비하고 있어요"가 나와요.'}</p>
  </div>
  <div class="duo2">
    <div class="card stack"><h2>입구 QR 안내판</h2>
      <p class="muted small" style="margin:0">A4 세로 한 장 · 전시회 이름과 안내 화면으로 가는 큰 QR이 들어가요.</p>
      <div class="row" style="margin-top:auto"><button class="btn primary sm" data-a="qr-sheet">보기 · 인쇄 · PDF</button></div></div>
    <div class="card stack"><h2>리플렛</h2>
      <p class="muted small" style="margin:0">A4 가로 3단 접지 · 앞뒤 2쪽. 축사 · 전시장 지도 · 임원진 · 작품 표가 들어가요.</p>
      <div class="row" style="margin-top:auto"><button class="btn primary sm" data-a="leaflet">보기 · 인쇄 · PDF</button></div></div>
  </div>`;
}
/* 인쇄 · PDF 공통: 미리보기 창 안 문서(iframe)에서 바로 인쇄하거나, 쪽마다 그림으로 떠서 PDF로 만들어요 */
const PDF_JS = `window.__pdf = function(name, orient){
  function ld(src){ return new Promise(function(res, rej){ var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function(){ rej(new Error('PDF 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.')); }; document.head.appendChild(s); }); }
  var pages = [].slice.call(document.querySelectorAll('.page')), W = orient === 'landscape' ? 297 : 210, H = orient === 'landscape' ? 210 : 297;
  document.body.classList.add('pdfing'); pages.forEach(function(p){ p.style.zoom = 1; });
  var done = function(){ document.body.classList.remove('pdfing'); if (window.__fit) window.__fit(); };
  return (window.html2canvas ? Promise.resolve() : ld('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'))
    .then(function(){ return window.jspdf ? null : ld('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); })
    .then(function(){ return document.fonts && document.fonts.ready; })
    .then(function(){
      var doc = new window.jspdf.jsPDF({ orientation: orient, unit: 'mm', format: 'a4', compress: true }), chain = Promise.resolve();
      pages.forEach(function(p, i){ chain = chain.then(function(){ return window.html2canvas(p, { scale: 2.6, backgroundColor: '#ffffff', useCORS: true, logging: false }).then(function(c){ if (i) doc.addPage(); doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, H); }); }); });
      return chain.then(function(){ doc.save(name); done(); });
    }).catch(function(e){ done(); throw e; });
};`;
async function qrSignHTML(){
  const url = tourUrl(), D = S.D, title = X.ex.title, src = await qrData(640);
  if (!src) throw new Error('QR을 만들지 못했어요. 인터넷 연결을 확인해 주세요.');
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)} 입구 QR</title>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=IBM+Plex+Sans+KR:wght@400;600&display=swap" rel="stylesheet">
<style>@page{size:A4;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:"IBM Plex Sans KR","Apple SD Gothic Neo",sans-serif;color:#1d2420}
.page{width:210mm;height:297mm;padding:26mm 22mm;display:flex;flex-direction:column;align-items:center;text-align:center;background:#fff;overflow:hidden}
.k{font-size:13pt;letter-spacing:.08em;color:#8a5a35;font-weight:600}.t{font-family:"Gowun Batang",serif;font-size:40pt;line-height:1.15;margin:6mm 0 3mm;word-break:keep-all}
.s{font-size:15pt;color:#5b665e}.q{width:118mm;height:118mm;margin:16mm 0 10mm;image-rendering:pixelated}.q img{width:100%;height:100%}
.m{font-size:17pt;font-weight:600;line-height:1.5;word-break:keep-all}.h{font-size:12pt;color:#5b665e;margin-top:3mm}
.bar{width:28mm;height:2mm;background:#2d5a46;border-radius:1mm;margin-top:6mm}
@media screen{body{background:#7d827c;padding:14px 0}.page{margin:0 auto;box-shadow:0 4px 24px rgba(0,0,0,.25)}}
.pdfing{background:#fff!important;padding:0!important}.pdfing .page{box-shadow:none;margin:0}</style></head><body><div class="page">
<div class="k">${esc(D.label || '목공 동아리 목방 전시회')}</div><div class="t">${esc(title)}</div>${D.sub ? `<div class="s">${esc(D.sub)}</div>` : ''}<div class="bar"></div>
<div class="q"><img src="${src}" alt="QR"></div><div class="m">QR을 찍으면<br>전시장 지도와 작품 설명을 볼 수 있어요</div>
<div class="h">휴대폰 카메라로 찍어 주세요</div></div>
<script>window.__fit = function(){ var z = Math.min(1, (window.innerWidth - 24) / 794); document.querySelector('.page').style.zoom = matchMedia('print').matches ? 1 : z; }; window.__fit(); addEventListener('resize', window.__fit);
${PDF_JS}<\/script></body></html>`;
}

/* ---------- 리플렛: A4 가로 3단 접지, 앞뒤 2쪽 (37회 '동심' 리플렛 구성) ----------
   바깥쪽 면: [첫 글] [전시장 지도 · 찾아오시는 길 · 임원진 · QR] [표지]
   안쪽 면:   [글]    [작품 소개 표]                                [글]
   글이 3개보다 많으면 길이를 보고 세 칸에 나눠 넣어요. */
async function qrData(size){
  const tmp = document.createElement('div'); tmp.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(tmp);
  const src = await new Promise(res => { if (!DG.drawQR) return res(''); try { DG.drawQR(tmp, tourUrl(), size, ''); } catch(e){ return res(''); } let n = 0; const t = setInterval(() => { const c = tmp.querySelector('canvas'), im = tmp.querySelector('img');
    const s = im && im.src && im.src.startsWith('data:') ? im.src : c ? (() => { try { return c.toDataURL('image/png'); } catch(e){ return ''; } })() : '';
    if (s || ++n > 30){ clearInterval(t); res(s); } }, 100); });
  tmp.remove(); return src;
}
async function photo(id){ if (!id) return ''; S.ph = S.ph || {}; if (S.ph[id]) return S.ph[id]; try { const d = await call('sjPhoto', X.exhId, id); if (typeof d === 'string' && d.startsWith('data:')) return S.ph[id] = d; } catch(e){} return ''; }
function splitSecs(secs){
  // 순서를 지키면서 세 칸의 글 길이가 비슷해지게 나눠요
  const n = secs.length, len = x => (x.t.length + x.b.length + x.s.length + 60);
  if (n <= 3) return [secs.slice(0, 1), secs.slice(1, 2), secs.slice(2, 3)];
  let best = null;
  for (let i = 1; i < n - 1; i++) for (let j = i + 1; j < n; j++){
    const parts = [secs.slice(0, i), secs.slice(i, j), secs.slice(j)], m = Math.max(...parts.map(p => p.reduce((a, x) => a + len(x), 0)));
    if (!best || m < best.m) best = { m, parts };
  }
  return best.parts;
}
function leafletRows(D){
  const wmap = Object.fromEntries(S.works.map(w => [w.id, w])), used = new Set(), groups = [];
  D.order.forEach((id, i) => { const it = itemById(D, id); if (!it) return; const ws = (it.ws || []).map(x => wmap[x]).filter(Boolean); ws.forEach(w => used.add(w.id)); if (ws.length) groups.push({ n: String(i + 1), ws }); });
  const rest = S.works.filter(w => !used.has(w.id)); if (rest.length) groups.push({ n: '–', ws: rest });
  return groups;
}
async function leafletHTML(){
  const D = normalize(clone(S.D), S.works), t = S.theme && S.theme.mode === 'poster' ? Object.assign({ titleW: 72 }, S.theme) : null;
  const [ti, pat, qr] = await Promise.all([photo(t && t.title), photo(t && t.pattern), qrData(360)]);
  const dark = t ? lum(t.bg) < 0.35 : true;
  const coverBg = t ? t.bg : '#1f3a2c', coverInk = t ? t.ink : '#f1efe6', coverMuted = t ? (t.muted || t.ink) : '#c9d2c6';
  const head = t ? (lum(t.bg) < 0.3 ? t.bg : mix(t.ink, '#000000', 0.3)) : '#244a38';
  const deco = t ? (contrastOK(t.accent) ? t.accent : head) : '#2d5a46';
  const slot = id => D.sections.filter(x => x.id === id && (x.b || '').trim());
  const A = slot('pres'), B = slot('club'), C = slot('alum');   // 49판: 자리 고정 (회장 축사 | 동아리 소개 | 동문 축사)
  const secBlock = L => L.map(x => `<section class="tx">${x.t ? `<h2>${esc(x.t)}</h2>` : ''}<div class="b">${esc(x.b.trim())}</div>${x.s ? `<div class="sg">${esc(x.s)}</div>` : ''}</section>`).join('');
  let prevR = null;
  const staff = (D.staff || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const m = l.match(/^([^:：]{1,12})\s*[:：]\s*(.*)$/); const r = m ? m[1].trim() : '', v = m ? m[2] : l, same = r && r === prevR; prevR = r; return `<div class="st${same ? ' same' : ''}"><span class="r">${esc(r)}</span><span>${esc(v)}</span></div>`; }).join('');
  const map = D.map.items.length ? mapSVG(D, { bs: 1.25 }) : null;
  const rows = leafletRows(D).map(g => g.ws.map((w, k) => `<tr>${k ? '' : `<td class="no" rowspan="${g.ws.length}">${esc(g.n)}</td>`}<td class="who">${(w.who || []).map(p => esc((p.g ? p.g + '기 ' : '') + p.n)).join('<br>')}</td><td class="wt">${esc(w.t || '')}</td><td class="mt">${esc([...new Set((w.objs || []).flatMap(o => String(o.m || '').split(/[,、·]/)).map(x => x.trim()).filter(Boolean))].join(', '))}</td></tr>`).join('')).join('');
  const title = X.ex.title || '';
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)} 리플렛</title>
<link href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=Gowun+Batang:wght@700&display=swap" rel="stylesheet">
<style>
${t && t.font === 'gmarket' ? ['Light', 'Medium', 'Bold'].map((w, i) => `@font-face{font-family:"GmarketSans";font-weight:${[300, 500, 700][i]};src:local("GmarketSans${w}"),url("https://fastly.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSans${w}.woff") format("woff")}`).join('') : ''}
@page{size:A4 landscape;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:"Nanum Myeongjo","Gowun Batang","AppleMyungjo",serif;color:#1e221f;word-break:keep-all;--head:${head};--deco:${deco}}
.page{width:297mm;height:210mm;display:grid;grid-template-columns:99mm 99mm 99mm;background:#fff;position:relative;overflow:hidden;break-after:page;page-break-after:always}
.page:last-child{break-after:auto;page-break-after:auto}
.pn{height:210mm;padding:12mm 10mm 11mm;overflow:hidden;position:relative;display:flex;flex-direction:column}
.fit{font-size:10.2pt}
h2{font-family:"Nanum Myeongjo",serif;font-weight:800;color:var(--head);font-size:1.62em;text-align:center;margin:0 0 .85em;letter-spacing:-.01em;line-height:1.25}
.tx+.tx{margin-top:1.6em}
.b{white-space:pre-line;line-height:1.95;font-size:1em}
.sg{margin-top:1.2em;font-weight:700;color:var(--head)}
.mapb{border:.3mm solid #cfd3cc;border-radius:2mm;padding:1.5mm;background:#fff}
.mapb svg{display:block;width:100%;height:auto}
svg .floor{fill:#fff;stroke:#2a2f2b}svg .zone{fill:#eef0ec;stroke:#a9aea7}svg .zl{fill:#6a706a;font-family:sans-serif;font-weight:600}
svg .wall{fill:#2a2f2b}svg .door{fill:var(--deco)}svg .door.exit{fill:#8a6a4a}svg .dl{fill:#2a2f2b;font-weight:700;font-family:sans-serif}svg .tx{fill:#6a706a;font-family:sans-serif}
svg .hold{fill:#fff;stroke:#a9aea7}svg .hold.has{stroke:#2a2f2b;fill:#eef0ec}svg .route{stroke:var(--deco);opacity:.8;stroke-linecap:round}svg .arw{fill:var(--deco)}
svg .badge circle{fill:var(--head)}svg .badge text{fill:#fff;font-weight:700;font-family:sans-serif}
.where{display:flex;align-items:center;gap:2.2mm;justify-content:center;margin:2.6mm 0 0;font-size:.95em}
.where i{width:3.4mm;height:3.4mm;border-radius:50%;background:var(--head);display:inline-block;flex:none}
.way{white-space:pre-line;text-align:center;font-size:.88em;color:#555b56;margin-top:1mm;line-height:1.6}
.hr{height:.5mm;background:var(--head);margin:4.5mm 0 4mm}
.st.same .r{visibility:hidden}.st{display:grid;grid-template-columns:auto 1fr;gap:0 .5em;line-height:1.85;font-size:.95em}.st .r{white-space:nowrap}.st .r:not(:empty)::after{content:" :"}
.qr{margin-top:auto;display:flex;align-items:center;gap:3mm;padding-top:3mm;font-size:.85em;color:#555b56;line-height:1.5}
.qr img{width:17mm;height:17mm;flex:none;image-rendering:pixelated}
.cover{background:${coverBg};color:${coverInk};padding:0;position:relative}
.cover .pat{position:absolute;right:0;bottom:0;width:100%;opacity:.95}
.cover .in{position:relative;height:100%;display:flex;flex-direction:column;padding:12mm 10mm 11mm}
.cover .ti{width:${Math.min(100, (t && t.titleW ? t.titleW : 72) + 22)}%;margin:2mm 0 0 -2mm}
.cover .tt{font-family:${t && t.font === 'gmarket' ? '"GmarketSans",sans-serif' : '"Gowun Batang","Nanum Myeongjo",serif'};font-size:40pt;font-weight:700;line-height:1.08;text-align:right;letter-spacing:-.02em;margin-top:4mm;word-break:keep-all}
.cover .sb{text-align:right;margin-top:3mm;font-size:11.5pt;color:${coverMuted}}
.cover .ft{margin-top:auto;text-align:right}
.cover .ft .d{font-size:7.6pt;line-height:1.7;white-space:pre-line;color:${coverMuted}}
.cover .ft .l{font-size:17pt;font-weight:800;margin-top:2mm;letter-spacing:-.01em}
.wk h2{margin-bottom:.6em}
table{width:100%;border-collapse:collapse;font-size:.74em;line-height:1.35}
th,td{border:.25mm solid #9aa09a;padding:1.1mm 1.2mm;text-align:center;vertical-align:middle}
th{font-weight:700;background:#f1f3ef;color:var(--head)}
td.no{font-weight:800;color:var(--head);width:7mm}
td.who{width:22mm}td.mt{width:23mm;color:#3e443f}
.empty{color:#9aa09a;text-align:center;margin-top:30mm;font-size:.9em;line-height:1.7}
.tick{position:absolute;width:.25mm;height:3mm;background:#c8ccc6}
@media screen{
  body{background:#7d827c;padding:14px 0}
  .page{margin:0 auto 16px;box-shadow:0 4px 24px rgba(0,0,0,.25)}
  .page::before,.page::after{content:"";position:absolute;top:0;bottom:0;border-left:.3mm dashed rgba(120,128,120,.55);pointer-events:none;z-index:3}
  .page::before{left:99mm}.page::after{left:198mm}
  .cap{color:#fff;font:600 12px/1.4 sans-serif;text-align:center;margin:0 0 8px}
}
@media print{ .cap{display:none} }
.pdfing{background:#fff!important;padding:0!important}.pdfing .cap{display:none}.pdfing .page{box-shadow:none!important;margin:0!important}.pdfing .page::before,.pdfing .page::after{display:none!important}
</style></head><body>
<div class="cap">바깥쪽 면 (1쪽)</div>
<div class="page">
  <div class="pn fit">${secBlock(A) || `<div class="empty">[소개] 탭의 회장 축사가<br>여기에 들어가요</div>`}</div>
  <div class="pn fit">
    ${map ? `<h2>전시장 지도</h2><div class="mapb"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${map.vb}">${map.body}</svg></div>` : '<h2>찾아오시는 길</h2>'}
    ${D.place ? `<div class="where"><i></i><span>${esc(D.place)}</span></div>` : ''}${D.way ? `<div class="way">${esc(D.way)}</div>` : ''}
    ${staff ? `<div class="hr"></div><h2>임원진 소개</h2>${staff}` : ''}
    ${qr ? `<div class="qr"><img src="${qr}" alt=""><div>휴대폰 카메라로 찍으면<br>작품 설명과 관람 순서를 볼 수 있어요</div></div>` : ''}
  </div>
  <div class="pn cover">${pat ? `<img class="pat" src="${pat}" alt="">` : ''}<div class="in">
    ${ti ? `<img class="ti" src="${ti}" alt="${esc(title)}">` : `<div class="tt">${esc(title)}</div>${D.sub ? `<div class="sb">${esc(D.sub)}</div>` : ''}`}
    <div class="ft">${D.dates || D.place ? `<div class="d">${esc([D.dates, D.place].filter(Boolean).join('\n'))}</div>` : ''}${D.label ? `<div class="l">${esc(D.label)}</div>` : ''}</div></div></div>
  <span class="tick" style="left:99mm;top:0"></span><span class="tick" style="left:198mm;top:0"></span><span class="tick" style="left:99mm;bottom:0"></span><span class="tick" style="left:198mm;bottom:0"></span>
</div>
<div class="cap">안쪽 면 (2쪽) · 양면 인쇄는 짧은 쪽으로 넘기기</div>
<div class="page">
  <div class="pn fit">${secBlock(B)}</div>
  <div class="pn fit wk"><h2>작품 소개</h2>${rows ? `<table><thead><tr><th>번호</th><th>이름 (기수)</th><th>작품 이름</th><th>재료</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">출품 기획서가 들어오면<br>여기에 작품 표가 생겨요</div>'}</div>
  <div class="pn fit">${secBlock(C) || `<div class="empty">[소개] 탭의 동문 축사가<br>여기에 들어가요</div>`}</div>
  <span class="tick" style="left:99mm;top:0"></span><span class="tick" style="left:198mm;top:0"></span><span class="tick" style="left:99mm;bottom:0"></span><span class="tick" style="left:198mm;bottom:0"></span>
</div>
<script>
(function(){
  function fit(){
    document.querySelectorAll('.fit').forEach(function(p){
      var min = p.classList.contains('wk') ? 6.6 : 7.4, f = 10.2; p.style.fontSize = f + 'pt';
      while (p.scrollHeight > p.clientHeight + 1 && f > min){ f = Math.round((f - 0.2) * 10) / 10; p.style.fontSize = f + 'pt'; }
      p.dataset.over = p.scrollHeight > p.clientHeight + 1 ? '1' : '';
    });
    var z = Math.min(1, (window.innerWidth - 24) / 1123); document.querySelectorAll('.page').forEach(function(pg){ pg.style.zoom = matchMedia('print').matches ? 1 : z; });
    window.__over = [].slice.call(document.querySelectorAll('.fit[data-over="1"]')).length;
  }
  window.__fit = fit;
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function(){ setTimeout(fit, 50); });
  window.addEventListener('resize', fit);
  window.addEventListener('beforeprint', function(){ document.querySelectorAll('.page').forEach(function(pg){ pg.style.zoom = 1; }); });
  window.addEventListener('afterprint', fit);
})();
${PDF_JS}
<\/script></body></html>`;
}
function contrastOK(c){ try { const a = lum(c); return a < 0.4; } catch(e){ return false; } }
async function openSheet(kind){
  const w = $('#lfwrap'); w.hidden = false; S.sheet = kind;
  const name = kind === 'qr' ? '입구 QR 안내판' : '리플렛';
  w.innerHTML = `<div class="lfbar"><b>${name}</b><span class="muted small" id="lfmsg">만드는 중…</span><span class="sp"></span><button class="btn primary sm" data-a="lf-print" disabled>인쇄하기</button><button class="btn sm" data-a="lf-pdf" disabled>PDF 만들기</button><button class="btn sm" data-a="lf-close">닫기</button></div><div class="lfframe"><iframe title="${name}" id="lfif"></iframe></div>`;
  let html; try { html = kind === 'qr' ? await qrSignHTML() : await leafletHTML(); } catch(e){ const m = $('#lfmsg'); if (m) m.textContent = e.message; return; }
  const f = $('#lfif'); if (!f) return;
  f.srcdoc = html;
  f.onload = () => setTimeout(() => {
    $$('[data-a="lf-print"],[data-a="lf-pdf"]').forEach(b => b.disabled = false);
    let over = 0; try { f.contentWindow.__fit && f.contentWindow.__fit(); over = f.contentWindow.__over || 0; } catch(e){}
    const m = $('#lfmsg'); if (m) m.textContent = kind === 'qr' ? 'A4 세로 한 장' : over ? `글이 넘치는 칸이 ${over}곳 있어요. 글을 조금 줄여 주세요.` : 'A4 가로 · 양면 인쇄(짧은 쪽으로 넘기기) · 3단 접기';
  }, 400);
}
const openLeaflet = () => openSheet('leaflet');
function printLeaflet(){
  const f = $('#lfif'); if (!f) return;
  try { f.contentWindow.focus(); f.contentWindow.print(); } catch(e){ toast('인쇄 창을 열지 못했어요. 컴퓨터 브라우저에서 다시 해 주세요.'); }
}
async function pdfSheet(){
  const f = $('#lfif'), b = $('[data-a="lf-pdf"]'); if (!f || !f.contentWindow.__pdf) return;
  const kind = S.sheet, name = `${X.ex.title || '목방 전시회'} ${kind === 'qr' ? '입구 QR' : '리플렛'}.pdf`;
  if (b){ b.disabled = true; b.textContent = 'PDF 만드는 중…'; }
  try { await f.contentWindow.__pdf(name, kind === 'qr' ? 'portrait' : 'landscape'); toast('PDF를 만들었어요. 받은 파일을 확인해 주세요'); }
  catch(e){ toast(e.message || 'PDF를 만들지 못했어요'); }
  finally { if (b){ b.disabled = false; b.textContent = 'PDF 만들기'; } }
}
function closeLf(){ const w = $('#lfwrap'); w.hidden = true; w.innerHTML = ''; }

/* ---------- 미리보기: 관람객 화면을 저장 전 내용 그대로 보여 줘요 ---------- */
function preview(){
  const D = normalize(clone(S.D), S.works);
  const data = { ex: { id: X.exhId, title: X.ex.title }, ready: true, guide: pubGuide(D), works: S.works, theme: S.theme || { mode: 'default' }, at: Date.now() };
  try { localStorage.setItem('dg_ga_pv', JSON.stringify({ s: X.exhId, t: Date.now(), data })); } catch(e){ return toast('미리보기를 열지 못했어요. 저장 공간이 꽉 찼을 수 있어요.'); }
  const w = $('#pvwrap'); w.hidden = false;
  w.innerHTML = `<div class="pvbar"><b>안내 화면 미리보기</b><span class="muted small">저장하지 않은 내용도 보여요</span><span class="sp"></span><button class="btn sm" data-a="pv-close">닫기</button></div>
    <div class="pvphone"><iframe src="${esc(tourUrl())}&pv=1" title="안내 화면 미리보기"></iframe></div>`;
}

/* ---------- 저장 ---------- */
async function save(publish, invPub){
  if (S.saving) return; S.saving = true;
  const D = normalize(clone(S.D), S.works);
  D.published = publish === undefined ? !!(S.A.guide && S.A.guide.published) : !!publish;
  D.inv.pub = invPub === undefined ? !!(S.A.guide && S.A.guide.inv && S.A.guide.inv.pub) : !!invPub;
  const btns = $$('[data-a="save"],[data-a="publish"],[data-a="unpub"],[data-a="inv-pub"],[data-a="inv-unpub"]'); btns.forEach(b => b.disabled = true);
  try {
    const A = await call('gaSave', DG.S.pw, X.exhId, D, X.list);
    S.A = A; S.D = normalize(fromServer(A.guide, X.ex.title), S.works); S.dirty = false; S.restored = false; lsSet(draftKey(), null);
    if (DG.cacheSet) DG.cacheSet(DG.PWK, 'dg_ga_adm_' + X.exhId, A);
    main(); toast(invPub === true ? '저장하고 초대장을 열었어요' : invPub === false ? '초대장을 닫았어요' : publish === true ? '저장하고 안내 화면을 열었어요' : publish === false ? '안내 화면을 닫았어요' : '저장했어요');
  } catch(e){ toast(e.message); btns.forEach(b => b.disabled = false); }
  finally { S.saving = false; }
}
async function refresh(){
  try {
    if (S.dirty && !confirmDiscard()) return;
    const [A, d] = await Promise.all([call('gaAdmin', DG.S.pw, X.exhId), TUTON() ? Promise.resolve(null) : DG.api('exhDetail', DG.S.pw, X.exhId).catch(() => null)]);
    if (d && d.list){ X.list = d.list; S.works = pubWorks(d.list); if (DG.setExhDetail) DG.setExhDetail(X.exhId, d); }
    lsSet(draftKey(), null); setData(A); main(); toast('새로 불러왔어요');
  } catch(e){ toast(e.message); }
}
function confirmDiscard(){ if (!S.discardArm){ S.discardArm = true; setTimeout(() => S.discardArm = false, 3000); toast('저장 안 한 내용이 있어요. 한 번 더 누르면 버리고 새로 불러와요'); return false; } S.discardArm = false; return true; }
function back(){ const lf = $('#lfwrap'); if (lf && !lf.hidden){ closeLf(); return; } const w = $('#pvwrap'); if (w && !w.hidden){ closePv(); return; } DG.openExhDetail(X.exhId); }
function closePv(){ const w = $('#pvwrap'); w.hidden = true; w.innerHTML = ''; }

/* ---------- 누르기 · 적기 (한곳에서 받아요) ---------- */
function wire(){
  root.addEventListener('click', e => {
    const t = e.target;
    const a = t.closest('[data-a]'); if (a){ const k = a.dataset.a;
      if (k === 'back') return back();
      if (k === 'save') return save();
      if (k === 'publish') return save(true);
      if (k === 'unpub'){ if (!a.classList.contains('armed')){ a.classList.add('armed'); a.textContent = '한 번 더 누르면 공개를 내려요'; setTimeout(() => { if (a.isConnected){ a.classList.remove('armed'); a.textContent = '공개 내리기'; } }, 3000); return; } return save(false); }
      if (k === 'refresh') return refresh();
      if (k === 'discard'){ lsSet(draftKey(), null); setData(S.A); S.restored = false; main(); return toast('마지막으로 저장한 내용으로 돌아왔어요'); }
      if (k === 'preview') return preview();
      if (k === 'pv-close') return closePv();
      if (k === 'copy') return copyText(tourUrl(), '안내 화면 링크를 복사했어요');
      if (k === 'day-add'){ const L = S.D.inv.days, last = L[L.length - 1]; let d = ''; if (last && last.d){ const t = new Date(last.d + 'T00:00:00'); t.setDate(t.getDate() + 1); d = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); } L.push({ d, o: last ? last.o : '11:00', c: last ? last.c : '18:00' }); markDirty(); tabInvite(); return; }
      if (k === 'day-del'){ S.D.inv.days.splice(+a.dataset.i, 1); markDirty(); tabInvite(); return; }
      if (k === 'ev-del'){ S.D.inv.ev = null; markDirty(); tabInvite(); return; }
      if (k === 'ev-add'){ const L = S.D.inv.days, last = L[L.length - 1]; S.D.inv.ev = { d: last ? last.d : '', o: last ? last.c : '17:00', c: '', t: '발표회' }; markDirty(); tabInvite(); return; }
      if (k === 'inv-pub') return save(undefined, true);
      if (k === 'inv-unpub'){ if (!a.classList.contains('armed')){ a.classList.add('armed'); a.textContent = '한 번 더 누르면 초대장을 닫아요'; setTimeout(() => { if (a.isConnected){ a.classList.remove('armed'); a.textContent = '초대장 닫기'; } }, 3000); return; } return save(undefined, false); }
      if (k === 'inv-copy') return copyText(inviteUrl(), '초대장 링크를 복사했어요');
      if (k === 'inv-preview') return previewInvite();
      if (k === 'cov-edit'){ S.covEdit = !S.covEdit; tabIntro(); return; }
      if (k === 'staff-add'){ const r = a.dataset.r; let j = -1; S.staff.forEach((y, n) => { if (y.r === r && !y.other) j = n; }); S.staff.splice(j + 1, 0, { r, v: '' }); $('#staff').innerHTML = staffHTML(); const f = $('#st-' + (j + 1)); if (f) f.focus(); return; }
      if (k === 'staff-del'){ S.staff.splice(+a.dataset.i, 1); S.D.staff = staffText(S.staff); markDirty(); $('#staff').innerHTML = staffHTML(); return; }
      if (k === 'prev-open') return openPrev();
      if (k === 'prev-close'){ $('#prevp').innerHTML = ''; return; }
      if (k === 'prev-go') return prevGo();
      if (k === 'leaflet') return openLeaflet();
      if (k === 'lf-print') return printLeaflet();
      if (k === 'lf-close') return closeLf();
      if (k === 'lf-pdf') return pdfSheet();
      if (k === 'qr-sheet') return openSheet('qr');
      if (k === 'design'){ if (S.dirty) toast('쓰던 내용은 이 기기에 남아 있어요'); return DG.openSangju('design'); }
      if (k === 'undo') return undo();
      if (k === 'multi'){ S.multi = !S.multi; return drawMulti(); }
      if (k === 'multi-go') return multiGo();
      if (k === 'auto') return autoOrder();
      if (k === 'pick'){ S.pick = []; S.sel = null; drawMap(); drawSel(); drawOrder(); $('#mapbox').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
      if (k === 'pick-done') return S.pick && S.pick.length ? pickDone() : (S.pick = null, drawMap(), drawOrder());
      if (k === 'pick-cancel'){ S.pick = null; drawMap(); drawOrder(); return; }
      const it = S.sel && itemById(S.D, S.sel);
      if (k === 'rot' && it){ snap(); const cx = it.x + it.w / 2, cy = it.y + it.h / 2; [it.w, it.h] = [it.h, it.w]; it.x = snap10(cx - it.w / 2); it.y = snap10(cy - it.h / 2); markDirty(); drawMap(); drawSel(); return; }
      if (k === 'dup' && it){ snap(); const c = Object.assign(clone(it), { id: uid(), x: it.x + 20, y: it.y + 20 }); if (c.ws) c.ws = []; S.D.map.items.push(c); S.sel = c.id; markDirty(); drawMap(); drawSel(); drawOrder(); return; }
      if (k === 'del' && it){ snap(); S.D.map.items = S.D.map.items.filter(x => x.id !== it.id); S.sel = null; normalize(S.D, S.works); markDirty(); drawMap(); drawSel(); drawOrder(); toast('지웠어요. ↶ 단추로 되돌릴 수 있어요'); return; }
      return;
    }
    const add = t.closest('[data-add]'); if (add){ addItem(add.dataset.add); if (add.dataset.add === 'stand' || add.dataset.add === 'table') toast('놓았어요. 아래에서 올릴 작품을 골라 주세요'); return; }
    const z = t.closest('[data-z]'); if (z){ const box = $('#mapbox'), v = +z.dataset.z, old = S.zoom, cxr = (box.scrollLeft + box.clientWidth / 2) / (box.scrollWidth || 1), cyr = (box.scrollTop + box.clientHeight / 2) / (box.scrollHeight || 1);
      S.zoom = v === 0 ? 1 : Math.max(1, Math.min(6, +(old * (v > 0 ? 1.5 : 1 / 1.5)).toFixed(2))); drawMap();
      box.scrollLeft = cxr * box.scrollWidth - box.clientWidth / 2; box.scrollTop = cyr * box.scrollHeight - box.clientHeight / 2; return; }
    const nb = t.closest('[data-nx],[data-ny]'); if (nb){ const it = itemById(S.D, S.sel); if (!it) return; snap(); it.x += 10 * (+nb.dataset.nx || 0); it.y += 10 * (+nb.dataset.ny || 0); markDirty(); drawMap(); return; }
    const mv = t.closest('[data-mv]'); if (mv){ const o = S.D.order, i = o.indexOf(mv.dataset.id), j = i + +mv.dataset.mv; if (i < 0 || j < 0 || j >= o.length) return; snap(); [o[i], o[j]] = [o[j], o[i]]; markDirty(); drawMap(); drawOrder(); return; }
    const sl = t.closest('[data-selid]'); if (sl){ S.sel = sl.dataset.selid; drawMap(); drawSel(); drawOrder(); $('#mapbox').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
  });
  root.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.f){ S.D[t.dataset.f] = t.value; markDirty(); if (['label', 'sub', 'dates', 'place'].includes(t.dataset.f) && $('#cov')){ $('#cov').innerHTML = coverHTML(); loadCoverImg(); } return; }
    if (t.dataset.fix){ const x = S.D.sections.find(y => y.id === t.closest('[data-sid]').dataset.sid); if (!x) return; x[t.dataset.fix] = t.value; markDirty(); return; }
    if (t.dataset.sv !== undefined){ S.staff[+t.dataset.sv].v = t.value; S.D.staff = staffText(S.staff); markDirty(); return; }
    if (t.dataset.sr !== undefined){ S.staff[+t.dataset.sr].r = t.value.replace(/[:：]/g, '').slice(0, 12); S.D.staff = staffText(S.staff); markDirty(); return; }
    if (t.dataset.inv){ S.D.inv[t.dataset.inv] = t.value; markDirty(); return; }
    if (t.dataset.day !== undefined && t.dataset.k){ const x = S.D.inv.days[+t.dataset.day]; if (!x) return; x[t.dataset.k] = t.value; markDirty(); return; }
    if (t.dataset.ev){ S.D.inv.ev = S.D.inv.ev || { d: '', o: '', c: '', t: '발표회' }; S.D.inv.ev[t.dataset.ev] = t.value; markDirty(); return; }
    if (t.dataset.it){ const it = itemById(S.D, S.sel); if (!it) return; if (!S.typingSnap){ snap(); S.typingSnap = true; }
      if (t.dataset.it === 'lab') it.lab = t.value.slice(0, 40); else { const v = Math.round(+t.value); if (v >= 5 && v <= 10000) it[t.dataset.it] = v; else return; }
      markDirty(); drawMap(); if (t.dataset.it === 'lab') drawOrder(); return; }
    if (t.dataset.m){ S.mset[t.dataset.m] = +t.value; return; }
  });
  root.addEventListener('change', e => {
    const t = e.target; S.typingSnap = false;
    if (t.dataset.room){ const v = Math.round(+t.value * 100); if (!(v >= 200 && v <= 10000)) { t.value = S.D.map[t.dataset.room] / 100; return toast('2m에서 100m 사이로 적어 주세요'); } snap(); S.D.map[t.dataset.room] = v; markDirty(); drawMap(); return; }
    if (t.dataset.day !== undefined && t.dataset.k === 'd'){ tabInvite(); return; }
    if (t.dataset.invck){ S.D.inv[t.dataset.invck] = t.checked; markDirty(); return; }
    if (t.dataset.a === 'route'){ S.D.map.route = t.checked; markDirty(); drawMap(); return; }
    if (t.name === 'mk'){ S.mset.k = t.value; return; }
    if (t.dataset.w){ const it = itemById(S.D, S.sel); if (!it) return; snap(); const wid = t.dataset.w;
      S.D.map.items.forEach(x => { if (x.ws) x.ws = x.ws.filter(y => y !== wid); }); if (t.checked) it.ws.push(wid);
      normalize(S.D, S.works); markDirty(); drawMap(); drawSel(); drawOrder(); return; }
    if (t.dataset.place !== undefined){ snap(); const wid = t.dataset.place; S.D.map.items.forEach(x => { if (x.ws) x.ws = x.ws.filter(y => y !== wid); });
      const it = t.value && itemById(S.D, t.value); if (it) it.ws.push(wid); normalize(S.D, S.works); markDirty(); tabWorks(); return; }
  });
  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', () => { drag = null; });
  document.addEventListener('keydown', e => {
    if (!host || host.hidden || S.tab !== 'map' || !S.sel) return;
    const a = root.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (d){ const it = itemById(S.D, S.sel); if (!it) return; e.preventDefault(); snap(); it.x += d[0] * 10; it.y += d[1] * 10; markDirty(); drawMap(); }
    if (e.key === 'Delete' || e.key === 'Backspace'){ const b = $('[data-a="del"]'); if (b){ e.preventDefault(); b.click(); } }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z'){ e.preventDefault(); undo(); }
  });
  let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (host && !host.hidden && S.tab === 'map') drawMap(); }, 150); });
}

/* ---------- 미리보기 · 튜토리얼용 가짜 서버 (config.js의 서버 주소가 비었을 때만 써요) ---------- */
const Mock = {
  key: 'dg_ga_demo_v1',
  db(){ return (TUTON() ? (Mock.mem = Mock.mem || {}) : lsGet(this.key, null)) || {}; },
  put(db){ if (TUTON()) Mock.mem = db; else lsSet(this.key, db); },
  gaAdmin(pw, exhId){ const db = this.db(), e = db[exhId] || {}; return { ex: { id: exhId, title: (X.ex && X.ex.title) || '' }, guide: e.guide || null, works: e.works || [], theme: { mode: 'default' }, url: '' }; },
  gaSave(pw, exhId, guide, list){ const db = this.db(), ws = pubWorks(list), g = normalize(fromServer(guide, ''), ws); g.at = Date.now(); db[exhId] = { guide: g, works: ws }; this.put(db); return this.gaAdmin(pw, exhId); },
};

/* index.html과 튜토리얼이 부르는 것들 */
function peek(){ return { exhId: X.exhId, tab: S.tab, D: S.D, A: S.A, sel: S.sel, dirty: S.dirty, root }; }
function reset(){ Object.assign(S, { A: null, D: null, sel: null, pick: null, undo: [], dirty: false, restored: false, multi: false }); Object.assign(X, { exhId: '', ex: null, list: [] }); S.themeFor = null; }
window.dgAnnae = { admin, peek, reset, mapSVG, pubWorks, invData: () => invData(normalize(clone(S.D), S.works)) };

const CSS = `*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
:host{display:block;margin:0;background:var(--bg);color:var(--ink);font-family:"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;font-size:14px;line-height:1.55;word-break:keep-all;min-height:100vh;position:relative;text-align:left;color-scheme:var(--scheme)}
button,input,select,textarea{font:inherit;color:inherit}
a{color:inherit}
.top{background:var(--bg);padding:16px 22px 12px;position:sticky;top:0;z-index:20}
.top .in{max-width:880px;margin:0 auto;display:flex;align-items:center;gap:12px;font-size:11.5px;color:var(--muted)}
.top .mk{width:30px;height:26px;flex:none;cursor:pointer;background:none;border:none;padding:0}
.top .mk img{width:100%;height:100%;display:block;object-fit:contain;filter:var(--logo-filter)}
.top .ln{flex:1;height:1px;background:var(--dim);min-width:20px}
.top .ttl{white-space:nowrap}
.top .back{background:none;border:1px solid var(--line);color:var(--ink);border-radius:999px;padding:3px 12px;font-size:11.5px;cursor:pointer;flex:none}
.main{max-width:880px;margin:0 auto;padding:10px 22px 60px}
h1{font-family:"Gowun Batang","Noto Serif KR",serif;font-size:20px;line-height:1.3;letter-spacing:-.02em;font-weight:700}
h2{font-family:"Gowun Batang","Noto Serif KR",serif;font-size:16.5px;margin:0 0 8px;font-weight:700}
h3{font-size:14px;margin:0 0 6px}
.muted{color:var(--muted)}.small{font-size:12px}.grow{flex:1;min-width:0}.sp{flex:1}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:0 0 14px}
.sub{border-top:1px solid var(--line);margin-top:12px;padding-top:12px}
.chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:2px 10px;font-size:11.5px;font-weight:500;border:1px solid var(--line);color:var(--muted);white-space:nowrap}
.chip.on{border-color:var(--accent);color:var(--accent)}.chip.on::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--accent)}
.chip.warn{border-color:var(--warm);color:var(--warm)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--dim);background:transparent;color:var(--ink);border-radius:8px;padding:10px 16px;font-weight:500;cursor:pointer;min-height:44px}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent);font-weight:700}
.btn.ghost{border-color:var(--line)}
.btn.danger{border-color:var(--red);color:var(--red)}.btn.danger.armed{background:var(--red);color:#fff}
.btn.sm{min-height:36px;padding:6px 12px;font-size:12.5px}
.btn:disabled{opacity:.4;cursor:default}
.btn:focus-visible,.inp:focus-visible,.tl:focus-visible,.tabs button:focus-visible{outline:2px solid var(--hi);outline-offset:2px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.stack>*+*{margin-top:12px}
label.f,span.f{display:block;font-size:11.5px;font-weight:500;margin:0 0 5px;color:var(--muted)}
label.f .inp{margin-top:5px}
.inp{width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 11px;background:var(--bg);color:var(--ink);min-height:42px;font-size:15px}
.inp:focus{outline:none;border-color:var(--ink)}
.inp::placeholder{color:var(--dim)}
.inp.n{width:74px;min-height:36px;padding:5px 8px;font-size:14px}
textarea.inp{resize:vertical;line-height:1.6}
.big-ta{min-height:220px}
select.inp{appearance:auto}
.grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
.grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-items:end}
.atop{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:4px 0 8px}
.status{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 10px;min-height:36px}
.part{margin:22px 2px 8px;font-size:16px;display:flex;gap:8px;align-items:baseline}
#tab>.part:first-child{margin-top:4px}
.tabs{display:flex;gap:2px;border-bottom:1px solid var(--line);margin:0 0 14px;overflow-x:auto}
.tabs button{flex:1;border:none;background:none;padding:10px 8px 11px;font-weight:500;cursor:pointer;white-space:nowrap;color:var(--dim);border-bottom:2px solid transparent;margin-bottom:-1px}
.tabs button.on{color:var(--ink);border-bottom-color:var(--ink);font-weight:700}
.ck{display:flex;align-items:center;gap:10px;padding:7px 4px;border-radius:8px;cursor:pointer}
.ck:hover{background:var(--soft)}
.ck input{width:20px;height:20px;accent-color:var(--accent);flex:none}
.ck.sm{font-size:12.5px;padding:4px}
.ck .ld{margin-left:auto;font-size:11px;color:var(--warm);white-space:nowrap}
.radio{display:flex;gap:8px;flex-wrap:wrap}
.radio label{display:flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:8px;padding:6px 12px;cursor:pointer}
.radio label:has(input:checked){border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.radio input{accent-color:var(--accent)}
.tools{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 10px}
.tl{border:1px solid var(--line);background:var(--bg);border-radius:999px;padding:6px 12px;font-size:12.5px;cursor:pointer;min-height:34px}
.tl:hover{border-color:var(--ink)}
.tl[aria-expanded="true"]{background:var(--soft);border-color:var(--ink)}
.mapwrap{position:relative}
.mapbox{overflow:auto;max-height:68vh;border:1px solid var(--line);border-radius:8px;background:var(--bg);-webkit-overflow-scrolling:touch}
.mapbox svg{display:block;touch-action:pan-x pan-y;user-select:none;-webkit-user-select:none}
.zoom{position:absolute;right:8px;top:8px;z-index:2;display:flex;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.zoom button{border:none;background:none;min-width:36px;height:34px;cursor:pointer;font-size:15px;padding:0 8px}
.zoom button+button{border-left:1px solid var(--line)}
.zoom button[data-z="0"]{font-size:11.5px}
svg .floor{fill:var(--card);stroke:var(--ink)}
svg .grid{stroke:var(--line)}
svg .zone{fill:var(--soft);stroke:var(--dim);fill-opacity:.6}
svg .zl{fill:var(--muted);font-weight:600}
svg .wall{fill:var(--ink)}
svg .door{fill:var(--accent)}svg .door.exit{fill:var(--wood)}
svg .dl{fill:var(--ink);font-weight:700}
svg .tx{fill:var(--muted);font-weight:500}
svg .hold{fill:var(--bg);stroke:var(--dim)}svg .hold.has{stroke:var(--ink);fill:var(--soft)}
svg .empty{fill:var(--dim)}
svg .route{stroke:var(--accent);opacity:.75;stroke-linecap:round}
svg .arw{fill:var(--accent)}
svg .badge circle{fill:var(--accent)}svg .badge text{fill:var(--on-accent);font-weight:700;font-family:"IBM Plex Sans KR",sans-serif}
svg .picked{fill:none;stroke:var(--warm);stroke-width:6}
svg .selbox{fill:none;stroke:var(--warm)}
svg .hit{fill:transparent;cursor:pointer}svg .hit.sel{cursor:move;touch-action:none}
.nudge>div{display:flex;gap:4px}
.nudge button{flex:1;min-height:42px;border:1px solid var(--line);background:var(--bg);border-radius:8px;cursor:pointer}
.sws{display:inline-flex;gap:3px;vertical-align:-2px}.swc{width:14px;height:14px;border-radius:50%;border:1px solid var(--line);display:inline-block}
.sec{border-top:1px solid var(--line);padding:12px 0 2px;margin-top:12px}.sec>*+*{margin-top:8px}
.sec .sect{flex:1;min-width:160px;font-weight:700}.sec .secat{width:auto;flex:none}
.sec .mv{display:flex;gap:4px}.sec .mv button{min-width:36px;height:40px;border:1px solid var(--line);background:var(--bg);border-radius:8px;cursor:pointer;padding:0 8px}.sec .mv button:disabled{opacity:.3}.sec .mv button.armed{background:var(--red);color:#fff;border-color:var(--red)}
.lfwrap{position:fixed;inset:0;z-index:55;background:rgba(10,14,12,.6);display:flex;flex-direction:column;padding:12px}
.lfwrap[hidden]{display:none}
.lfbar{display:flex;align-items:center;gap:10px;background:var(--card);border-radius:10px;padding:8px 10px 8px 14px;margin:0 auto 10px;width:min(1100px,100%);flex-wrap:wrap}
.lfframe{flex:1;width:min(1100px,100%);margin:0 auto;border-radius:10px;overflow:hidden;background:#8a8f88}.lfframe iframe{width:100%;height:100%;border:0;display:block}
.tips{margin:0;padding-left:18px}
.duo2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}.duo2>.card{display:flex;flex-direction:column}
@media (max-width:560px){.duo2{grid-template-columns:minmax(0,1fr)}}
.cov{border-radius:10px;padding:22px 20px;background:var(--soft);text-align:center;max-width:420px;margin:0 auto}
.covk{font-size:12px;color:var(--muted)}.covt{font-family:"Gowun Batang",serif;font-size:34px;font-weight:700;line-height:1.1;margin-top:10px}.covs{margin-top:6px;color:var(--muted);font-size:13px}
.covti{display:block;width:88%;margin:12px auto 0}.covd{white-space:pre-line;margin-top:14px;font-size:12.5px;line-height:1.6}
.sgrp{margin-top:10px}.sgrp:first-child{margin-top:2px}.sgh{font-weight:700;font-size:14px;margin:0 0 2px;padding-top:8px;border-top:1px dashed var(--line)}.sgrp:first-child .sgh{border-top:0;padding-top:0}.sadd{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.srow{display:grid;grid-template-columns:84px minmax(0,1fr) auto;gap:8px;align-items:center;margin-top:6px}.srow .sr0{margin:0}.srow .sr0 .inp{min-height:38px;font-size:13px;padding:6px 8px}
.prevrow{align-items:center}
details.fixed>summary{cursor:pointer;color:var(--ink);font-size:14px;padding:0}
.fx{border-top:1px solid var(--line);padding-top:10px;margin-top:10px;display:flex;flex-direction:column;gap:2px}
.dayrow{flex-wrap:wrap}.dayrow .inp{width:auto;min-height:40px;font-size:14px;padding:6px 10px}.dayrow .tm{width:112px}.dayrow .dl{min-width:62px}.dayrow .evn{width:110px}
.secw{margin-top:6px}.secw .ck{padding:2px 4px}.tips li{margin:2px 0}
.wpick{max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:4px}
.olist{list-style:none;margin:8px 0 0;padding:0;counter-reset:o}
.olist li{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line)}
.olist li.sel{background:var(--soft);border-radius:8px}
.olist .no{width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--on-accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12.5px;flex:none}
.olist .lk{flex:1;min-width:0;text-align:left;background:none;border:none;padding:0;cursor:pointer;display:flex;flex-direction:column}
.olist .lk .small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.olist .mv{display:flex;gap:4px}
.olist .mv button{width:36px;height:36px;border:1px solid var(--line);background:var(--bg);border-radius:8px;cursor:pointer}
.olist .mv button:disabled{opacity:.3}
ol.olist:not(:has(.no)) li::before{counter-increment:o;content:counter(o);width:26px;height:26px;border-radius:50%;background:var(--warm);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px}
.wcard .wt{font-size:15px}
.wcard .place{width:auto;max-width:48%;min-height:38px;font-size:13px;padding:5px 8px}
.objs{margin-top:8px;color:var(--muted)}
.desc{white-space:pre-wrap;margin:6px 0 0;font-size:13px}
details>summary{cursor:pointer;color:var(--muted);font-size:12.5px;padding:6px 0 0}
.qrrow{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}
.qrrow>.stack{min-width:220px}
.qr{width:196px;height:196px;background:#fff;padding:8px;border-radius:8px;border:1px solid var(--line);flex:none;display:flex;align-items:center;justify-content:center;font-size:12px;color:#5b665e;text-align:center}
.qr img,.qr canvas{width:180px!important;height:180px!important}
.url{font-size:12.5px;word-break:break-all;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px 10px}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);background:var(--ink);color:var(--bg);padding:11px 18px;border-radius:10px;font-size:13px;font-weight:500;opacity:0;transition:.2s;pointer-events:none;z-index:60;max-width:90vw;text-align:center}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.pvwrap{position:fixed;inset:0;z-index:50;background:rgba(10,14,12,.55);display:flex;flex-direction:column;align-items:center;padding:12px}
.pvwrap[hidden]{display:none}
.pvbar{display:flex;align-items:center;gap:10px;background:var(--card);border-radius:10px;padding:8px 10px 8px 14px;width:min(430px,100%);margin-bottom:10px;flex-wrap:wrap}
.pvphone{flex:1;width:min(430px,100%);border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.3)}
.pvphone iframe{width:100%;height:100%;border:0;display:block}
@media (max-width:560px){ .grid2{grid-template-columns:minmax(0,1fr)} .grid4{grid-template-columns:repeat(2,minmax(0,1fr))} .main{padding:8px 16px 60px} .top{padding:14px 16px 10px} .wcard .place{max-width:100%;width:100%} }
@media (prefers-reduced-motion:reduce){ *{transition:none!important} }`;
})();
