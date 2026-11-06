/* 도각도각 미리보기 · 튜토리얼 전용 파일 (42판)
   - 실제 서버 주소(config.js)가 들어간 사이트에서는 [앱 사용 튜토리얼]을 누를 때만 불러와요.
   - 서버 주소를 비워 둔 미리보기에서는 처음에 불러와 가짜 서버로 써요.
   - index.html과 같은 폴더에 두세요. 지우면 튜토리얼과 미리보기가 안 돼요. */

/* 도각도각 핵심 규칙 (서버와 미리보기가 똑같이 씀): 튜토리얼 연습용 사본과 미리보기 가짜 서버가 써요 */
function makeCore(store, env) {
  /* 미리보기용 전시회 목록: 전시회마다 따로 저장해요 (실제 서버는 전시회마다 구글 시트 파일이 따로 생겨요) */
  let EXL = env.exhList || [];
  const exhFind_ = id => { const e = EXL.find(x => x.id === String(id)); if (!e) fail('전시회를 찾을 수 없어요. 처음 화면에서 다시 골라 주세요.'); return e; };
  const exhPubEx = e => ({ id: e.id, title: e.title, open: exhOpenNow(e, now()), closeAt: e.closeAt || '', note: e.note || '' });
  const exhRowsOf = id => store.list('exh').filter(x => x.exh === id);
  function exhMine(e, sn, name) {
    sn = String(sn || '').replace(/\D/g, '');
    const key = 'exhfail_' + e.id + sn; const fails = Number(env.cacheGet(key) || 0);
    if (fails >= 5) fail('여러 번 틀려서 10분 동안 잠겼어요. 잠시 후 다시 시도해 주세요.');
    const m = exhMatch(exhRowsOf(e.id), sn, name);   // 46판: 공동 작품자로 들어간 장도 함께
    if (!m.me){ env.cachePut(key, String(fails + 1), 600); fail('학번과 이름이 맞는 출품 신청이 없어요. 신청할 때 적은 학번과 이름을 확인해 주세요.'); }
    env.cacheRemove(key); return m;
  }
  const exhDetail_ = id => { const e = exhFind_(id); return { ex: Object.assign(exhPubEx(e), { openFlag: !!e.open, at: e.at, url: '' }), list: exhRowsOf(e.id).map(exhPub) }; };
  const exhAdmin_ = () => ({ list: EXL.map(e => { const rs = exhRowsOf(e.id); return Object.assign(exhPubEx(e), { openFlag: !!e.open, at: e.at, url: '', n: rs.length, pn: exhPeople(rs), objN: rs.reduce((k, r) => k + (r.objs || []).length, 0) }); }) });
  const RATED = env.ratings || {};   // 미리보기용 부원 난이도 평가
  const TOOK = env.times || {};      // 미리보기용 부원 걸린 시간
  const PLACES = ['1동방', '2동방'];
  const SELF_KEYS = ['selfScore', 'prepScore', 'planScore'];
  const STATUS = ['ok', 'short', 'none'];

  const cut = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const sc5 = v => { v = Number(v); return v >= 1 && v <= 5 ? Math.round(v) : null; };
  const digits = v => String(v == null ? '' : v).replace(/\D/g, '');
  const safeId = v => String(v || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  const now = () => Date.now();
  const byCreated = (a, b) => (a.createdAt || 0) - (b.createdAt || 0);
  const fail = m => { throw new Error(m); };

  function auth(pw) {
    const real = env.getPassword();
    if (!real || String(real).indexOf('여기에') === 0) fail('아직 설정이 끝나지 않았어요. Code.gs 맨 위의 CLUB_PASSWORD를 동아리 비밀번호로 바꾼 뒤 다시 배포해 주세요.');
    if (String(pw || '') !== String(real)) fail('비밀번호가 맞지 않아요.');
  }
  const sessions = () => store.list('sessions');
  const findSession = sid => sessions().find(s => s.id === String(sid)) || null;
  const findClass = (s, cid) => (s.classes || []).find(c => c.id === String(cid)) || null;
  const sessionDates = s => Array.from(new Set([].concat.apply([], (s.classes || []).map(c => c.dates || [])))).sort();

  function classStats(regs, sid, cid) {
    const rs = regs.filter(r => r.sid === sid && r.classId === cid);
    return { confirmed: rs.filter(r => r.status === 'confirmed').length, waiting: rs.filter(r => r.status === 'waiting').length };
  }
  function waitingPos(regs, r) {
    const q = regs.filter(x => x.sid === r.sid && x.classId === r.classId && x.status === 'waiting').sort(byCreated);
    return q.findIndex(x => x.id === r.id) + 1;
  }
  /* 자리가 나면 대기자를 신청 순서대로 확정 */
  function promote(sid, cid) {
    const s = findSession(sid); const c = s && findClass(s, cid); if (!c) return;
    const regs = store.list('regs').filter(r => r.sid === sid && r.classId === cid);
    let conf = regs.filter(r => r.status === 'confirmed').length;
    regs.filter(r => r.status === 'waiting').sort(byCreated).forEach(w => {
      if (c.capacity && conf >= c.capacity) return;
      w.status = 'confirmed'; w.updatedAt = now(); store.update('regs', w); conf++;
    });
  }
  function publicSession(s) {
    const regs = store.list('regs');
    return {
      id: s.id, title: s.title, desc: s.desc, places: s.places || [], open: applyState(s, now()) === 'open', state: applyState(s, now()), openAt: s.openAt || null, closeAt: s.closeAt || null,
      lead: (s.lead && s.lead.name) || '', assistants: (s.assistants || []).map(a => a.name),
      dates: sessionDates(s), tools: s.tools || [], notes: s.notes || '',
      classes: (s.classes || []).map(c => Object.assign({ id: c.id, label: c.label, dates: c.dates, time: c.time, capacity: c.capacity }, classStats(regs, s.id, c.id))),
    };
  }

  /* ---------------- 참가자: 신청 ---------------- */
  function getApplyInfo(sid) {
    if (sid) { const s = findSession(sid); return { sessions: s ? [publicSession(s)] : [] }; }
    return { sessions: sessions().filter(s => applyState(s, now()) !== 'closed').map(publicSession).sort((a, b) => (a.dates[0] || '').localeCompare(b.dates[0] || '')) };
  }

  function apply(sid, classId, f) {
    f = f || {};
    const o = { name: cut(f.name, 20), dept: cut(f.dept, 30), studentNo: digits(f.studentNo).slice(0, 12), phone: digits(f.phone).slice(0, 11) };
    if (!o.name) fail('이름을 적어 주세요.');
    if (!o.dept) fail('학과를 적어 주세요.');
    if (o.studentNo.length < 5) fail('학번을 숫자로 적어 주세요.');
    if (!/^01\d{8,9}$/.test(o.phone)) fail('전화번호를 010으로 시작하는 숫자로 적어 주세요.');
    if (!f.agree) fail('개인정보 수집·이용에 동의해 주세요.');
    return env.lock(() => {
      const s = findSession(sid); if (!s) fail('학습회를 찾을 수 없어요.');
      const st0 = applyState(s, now());
      if (st0 === 'soon') fail('아직 신청 기간이 아니에요. 신청이 열리는 시간을 확인해 주세요.');
      if (st0 !== 'open') fail('신청이 마감됐어요.');
      const c = findClass(s, classId); if (!c) fail('들을 회차를 골라 주세요.');
      const regs = store.list('regs');
      if (regs.some(r => r.sid === s.id && r.studentNo === o.studentNo && r.status !== 'cancelled'))
        fail('이미 이 학습회에 신청했어요. 아래 "내 신청 확인"에서 상태를 볼 수 있어요.');
      const st = classStats(regs, s.id, c.id);
      const status = (!c.capacity || (st.confirmed < c.capacity && st.waiting === 0)) ? 'confirmed' : 'waiting';
      store.insert('regs', Object.assign({ id: 'g' + env.uid(), sid: s.id, classId: c.id, status: status, attended: [], reviewed: '', createdAt: now(), updatedAt: now() }, o));
      return { status: status, position: status === 'waiting' ? st.waiting + 1 : 0, title: s.title, classLabel: c.label, dates: c.dates, time: c.time, places: s.places || [] };
    });
  }

  function myRegs(studentNo, phone4) {
    const sn = digits(studentNo), p4 = digits(phone4);
    if (sn.length < 5 || p4.length !== 4) fail('학번과 전화번호 뒤 4자리를 입력해 주세요.');
    const regs = store.list('regs'); const ss = sessions();
    return regs.filter(r => r.studentNo === sn && String(r.phone).slice(-4) === p4 && r.status !== 'cancelled').sort(byCreated).map(r => {
      const s = ss.find(x => x.id === r.sid); const c = s && findClass(s, r.classId);
      return { id: r.id, title: s ? s.title : '(삭제된 학습회)', classLabel: c ? c.label : '', dates: c ? c.dates : [], time: c ? c.time : '', places: s ? s.places : [],
        status: r.status, position: r.status === 'waiting' ? waitingPos(regs, r) : 0, attended: (r.attended || []).length > 0, reviewed: !!r.reviewed };
    });
  }

  function cancelMine(regId, studentNo, phone4) {
    const sn = digits(studentNo), p4 = digits(phone4);
    env.lock(() => {
      const r = store.list('regs').find(x => x.id === String(regId));
      if (!r || r.studentNo !== sn || String(r.phone).slice(-4) !== p4) fail('신청을 찾을 수 없어요.');
      if ((r.attended || []).length) fail('이미 출석한 신청은 취소할 수 없어요.');
      const was = r.status; r.status = 'cancelled'; r.updatedAt = now(); store.update('regs', r);
      if (was === 'confirmed') promote(r.sid, r.classId);
    });
    return myRegs(sn, p4);
  }

  /* ---------------- 참가자: 출석한 사람만 익명 평가 ---------------- */
  function getPublicSession(sid) {
    const s = findSession(sid); if (!s) return null;
    return { id: s.id, title: s.title, places: s.places || [], lead: (s.lead && s.lead.name) || '', assistants: (s.assistants || []).map(a => a.name), dates: sessionDates(s),
      classes: (s.classes || []).map(c => ({ id: c.id, label: c.label, dates: c.dates })), review: reviewCfg(s) };
  }
  /* 링크만 있으면 누구나 익명으로 평가 (이름·학번을 받지 않음) */
  const reviewCfg = s => { const c = (s.review && Array.isArray(s.review.metrics)) ? s.review : DEFAULT_REVIEW; return Object.assign({}, c, { difficulty: true, once: c.once !== false }); };
  function submitReview(sid, rv) {
    rv = rv || {};
    const s = findSession(sid); if (!s) fail('학습회를 찾을 수 없어요. 진행자에게 평가 링크를 다시 받아 주세요.');
    const cfg = reviewCfg(s);
    const overall = sc5(rv.overall); if (!overall) fail('전반적인 만족도를 골라 주세요.');
    const c = findClass(s, rv.classId);
    if ((s.classes || []).length > 1 && !c) fail('들은 회차를 골라 주세요.');
    const classId = c ? c.id : ((s.classes || [])[0] || {}).id || '';
    const scores = {}, texts = {};
    const sv = rv.scores || {}, tv = rv.texts || {};
    cfg.metrics.forEach(m => { const v = sc5(sv[m.id] != null ? sv[m.id] : rv[m.id]); if (v) scores[m.id] = v; });
    cfg.texts.forEach(x => { const v = cut(tv[x.id] != null ? tv[x.id] : rv[x.id], 800); if (v) texts[x.id] = v; });
    const o = { overall: overall, difficulty: cfg.difficulty ? sc5(rv.difficulty) : null, answers: { scores: scores, texts: texts, dv: 1 } };   // 난이도 1=너무 쉬움, 5=너무 어려움
    ['finish', 'clarity', 'safety', 'material', 'time', 'again'].forEach(k => o[k] = scores[k] || null);   // 시트에서 바로 보기 쉽게 기본 문항은 칸에도 적어요
    ['good', 'improve', 'nextTopic'].forEach(k => o[k] = texts[k] || '');
    const day = Math.floor(now() / 86400000) * 86400000;     // 시각은 날짜까지만
    env.lock(() => store.insert('reviews', Object.assign({ id: 'r' + env.uid(), sid: s.id, classId: classId, submittedAt: day }, o)));
    return true;
  }

  /* ---------------- 진행자 (동아리 비밀번호) ---------------- */
  function getAll(pw) {
    auth(pw);
    return {
      sessions: sessions(), regs: store.list('regs'), reviews: store.list('reviews'),
      hostlogs: store.list('hostlogs').map(l => { const c = Object.assign({}, l); delete c.pin; return c; }),
      guides: store.list('guides'),
      url: env.url(), version: env.version || '',
    };
  }
  const person = h => ({ id: safeId(h && h.id) || ('h' + env.uid()), name: cut(h && h.name, 20) });
  function cleanClasses(list) {
    return (list || []).slice(0, 10).map((c, i) => {
      const dates = Array.from(new Set((c.dates || []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))).sort().slice(0, 4);
      const cap = Math.round(Number(c.capacity)) || 0;
      return { id: safeId(c.id) || ('c' + env.uid()), label: cut(c.label, 20) || ((i + 1) + '회차'), dates: dates, time: cut(c.time, 30), capacity: Math.max(0, Math.min(200, cap)) };
    });
  }
  function cleanReviewCfg(r) {
    if (!r || !Array.isArray(r.metrics)) return null;
    const seen = {};
    const id = (v, p) => { let x = safeId(v) || (p + env.uid().slice(0, 8)); while (seen[x]) x = p + env.uid().slice(0, 8); seen[x] = 1; return x; };
    const metrics = r.metrics.map(m => ({ q: cut(m && m.q, 80), s: cut(m && m.s, 12), id: m && m.id })).filter(m => m.q).slice(0, 10)
      .map(m => ({ id: id(m.id, 'm'), q: m.q, s: m.s || shortLabel(m.q) }));
    const texts = (r.texts || []).map(x => ({ q: cut(x && x.q, 60), id: x && x.id })).filter(x => x.q).slice(0, 5).map(x => ({ id: id(x.id, 't'), q: x.q }));
    return { metrics: metrics, difficulty: true, once: r.once !== false, texts: texts };
  }
  function saveSession(pw, d) {
    auth(pw); d = d || {};
    const o = {
      title: cut(d.title, 80), term: /^\d{4}-[12]$/.test(d.term || '') ? d.term : '',
      places: PLACES.filter(p => (d.places || []).indexOf(p) >= 0), desc: cut(d.desc, 600),
      lead: person(d.lead), assistants: (d.assistants || []).map(person).filter(h => h.name).slice(0, 10),
      classes: cleanClasses(d.classes),
      tools: (Array.isArray(d.tools) ? d.tools : []).map(t => cut(t, 20)).filter(Boolean).filter((t, i, a) => a.indexOf(t) === i).slice(0, 12),
      notes: cut(d.notes, 800),
      openAt: Number(d.openAt) > 0 ? Math.round(Number(d.openAt)) : '', closeAt: Number(d.closeAt) > 0 ? Math.round(Number(d.closeAt)) : '',
      review: cleanReviewCfg(d.review), updatedAt: now(),
    };
    if (!o.title) fail('학습회 제목을 입력해 주세요.');
    if (!o.classes.length) fail('회차를 하나 이상 넣어 주세요.');
    if (o.classes.some(c => !c.dates.length)) fail('회차마다 날짜를 하나 이상 골라 주세요.');
    if (o.openAt && o.closeAt && o.closeAt <= o.openAt) fail('신청 마감 시간은 여는 시간보다 뒤여야 해요.');
    let id = String(d.id || '');
    env.lock(() => {
      if (id) {
        const cur = findSession(id); if (!cur) fail('학습회를 찾을 수 없어요.');
        const regs = store.list('regs').filter(r => r.sid === id && r.status !== 'cancelled');
        const gone = (cur.classes || []).filter(c => !o.classes.some(n => n.id === c.id) && regs.some(r => r.classId === c.id));
        if (gone.length) fail(gone[0].label + '에 신청자가 있어서 지울 수 없어요. 신청자를 먼저 취소하거나 다른 회차로 옮겨 주세요.');
        store.update('sessions', Object.assign({}, cur, o));
        o.classes.forEach(c => promote(id, c.id));               // 정원을 늘렸으면 대기자 확정
      } else {
        id = 's' + env.uid();
        store.insert('sessions', Object.assign({ id: id, applyOpen: '1', createdAt: now() }, o));
      }
    });
    return { id: id, all: getAll(pw) };
  }
  function deleteSession(pw, sid) {
    auth(pw); sid = String(sid);
    const photos = [].concat.apply([], store.list('hostlogs').concat(store.list('guides')).filter(l => l.sid === sid).map(l => photosOf(l.guide)));
    env.lock(() => {
      ['regs', 'reviews', 'hostlogs', 'guides'].forEach(k => store.list(k).filter(x => x.sid === sid).forEach(x => store.remove(k, x.id)));
      store.remove('sessions', sid);
    });
    trashUnused(photos);
    return getAll(pw);
  }
  function setApplyOpen(pw, sid, open) {
    auth(pw);
    env.lock(() => {
      const s = findSession(sid); if (!s) fail('학습회를 찾을 수 없어요.');
      const t = now();
      if (open) { s.applyOpen = '1'; if (s.openAt && t < Number(s.openAt)) s.openAt = ''; if (s.closeAt && t >= Number(s.closeAt)) s.closeAt = ''; }
      else { s.applyOpen = ''; }
      store.update('sessions', s);
    });
    return getAll(pw);
  }
  function regAction_(pw, regId, fn) {
    auth(pw);
    env.lock(() => { const r = store.list('regs').find(x => x.id === String(regId)); if (!r) fail('신청을 찾을 수 없어요.'); fn(r); });
    return getAll(pw);
  }
  function setAttendance(pw, regId, date, on) {
    return regAction_(pw, regId, r => {
      const s = findSession(r.sid); const c = s && findClass(s, r.classId);
      if (!c || c.dates.indexOf(date) < 0) fail('이 회차의 날짜가 아니에요.');
      const set = (r.attended || []).filter(x => x !== date); if (on) set.push(date);
      r.attended = set.sort(); r.updatedAt = now(); store.update('regs', r);
    });
  }
  function hostCancelReg(pw, regId) {
    return regAction_(pw, regId, r => { const was = r.status; r.status = 'cancelled'; r.updatedAt = now(); store.update('regs', r); if (was === 'confirmed') promote(r.sid, r.classId); });
  }
  function promoteReg(pw, regId) {
    return regAction_(pw, regId, r => { if (r.status !== 'waiting') fail('대기 중인 신청이 아니에요.'); r.status = 'confirmed'; r.updatedAt = now(); store.update('regs', r); });
  }
  function moveReg(pw, regId, classId) {
    return regAction_(pw, regId, r => {
      const s = findSession(r.sid); if (!findClass(s, classId)) fail('회차를 찾을 수 없어요.');
      const from = r.classId; const was = r.status;
      r.classId = String(classId); r.status = 'confirmed'; r.updatedAt = now(); store.update('regs', r);
      if (was === 'confirmed') promote(r.sid, from);
    });
  }
  function addReg(pw, sid, classId, f) {
    auth(pw); f = f || {};
    const o = { name: cut(f.name, 20), dept: cut(f.dept, 30), studentNo: digits(f.studentNo).slice(0, 12), phone: digits(f.phone).slice(0, 11) };
    if (!o.name) fail('이름을 적어 주세요.');
    env.lock(() => {
      const s = findSession(sid); if (!s || !findClass(s, classId)) fail('회차를 찾을 수 없어요.');
      if (o.studentNo && store.list('regs').some(r => r.sid === s.id && r.studentNo === o.studentNo && r.status !== 'cancelled')) fail('같은 학번으로 이미 신청돼 있어요.');
      store.insert('regs', Object.assign({ id: 'g' + env.uid(), sid: s.id, classId: String(classId), status: 'confirmed', attended: [], reviewed: '', createdAt: now(), updatedAt: now() }, o));
    });
    return getAll(pw);
  }

  function deleteReview(pw, id) {
    auth(pw);
    const r = store.list('reviews').find(x => x.id === String(id)); if (!r) fail('평가를 찾을 수 없어요. 이미 지워졌을 수 있어요.');
    env.lock(() => store.remove('reviews', r.id));
    return getAll(pw);
  }
  /* 난이도를 반대로 알고 답한 응답 바로잡기: 이 학습회의 난이도 응답을 모두 1↔5로 뒤집어요 */
  function flipDifficulty(pw, sid) {
    auth(pw); sid = String(sid);
    env.lock(() => {
      store.list('reviews').filter(r => r.sid === sid).forEach(r => {
        const v = Number(r.difficulty); if (!(v >= 1 && v <= 5)) return;
        r.difficulty = 6 - v; store.update('reviews', r);
      });
    });
    return getAll(pw);
  }
  function changePassword(pw, next) {
    auth(pw);
    next = String(next == null ? '' : next);
    if (next.trim() !== next) fail('비밀번호 앞뒤에 빈칸을 넣을 수 없어요.');
    if (next.length < 4 || next.length > 40) fail('새 비밀번호는 4~40자로 정해 주세요.');
    if (next === String(pw)) fail('지금 비밀번호와 같아요.');
    env.setPassword(next);
    return true;
  }

  /* ---------------- 진행자 기록·설명서 (본인 PIN 잠금) ---------------- */
  function pinCheck(log, pin) {
    const key = 'pinfail_' + log.id; const fails = Number(env.cacheGet(key) || 0);
    if (fails >= 5) fail('PIN을 여러 번 틀려서 10분 동안 잠겼어요. 잠시 후 다시 시도해 주세요.');
    const salt = String(log.pin || '').split(':')[0];
    if (!salt || env.hash(String(pin || ''), salt) !== log.pin) { env.cachePut(key, String(fails + 1), 600); fail('PIN이 맞지 않아요.'); }
    env.cacheRemove(key);
  }
  function checkHostPin(pw, id, pin) {
    auth(pw);
    const l = store.list('hostlogs').find(x => x.id === String(id)); if (!l) fail('기록을 찾을 수 없어요.');
    pinCheck(l, pin); return true;
  }
  const PHOTO_ID = /^[A-Za-z0-9_-]{6,120}$/;
  const photoList = (v, m) => (Array.isArray(v) ? v : []).map(String).filter(x => PHOTO_ID.test(x)).slice(0, m);
  const photosOf = g => g ? [].concat.apply([], (g.flow || []).map(f => f.photos || [])).concat(g.finalPhotos || []) : [];
  /* 더 이상 어느 설명서에도 쓰이지 않는 사진만 휴지통으로 */
  function trashUnused(ids) {
    if (!ids.length || !env.trashPhoto) return;
    const used = new Set(); store.list('hostlogs').concat(store.list('guides')).forEach(l => photosOf(l.guide).forEach(x => used.add(x)));
    ids.filter(x => !used.has(x)).forEach(x => { try { env.trashPhoto(x); } catch (e) {} });
  }
  function cleanGuide(g) {
    g = g || {};
    const lines = (v, n, m) => String(v == null ? '' : v).split('\n').map(x => x.trim()).filter(Boolean).slice(0, m).map(x => x.slice(0, n));
    return {
      intro: cut(g.intro, 400), duration: cut(g.duration, 30), makeTime: cut(g.makeTime, 30),
      prep: lines(g.prep, 120, 40), cutting: lines(g.cutting, 300, 30),
      flow: (g.flow || []).slice(0, 20).map(f => ({ title: cut(f.title, 60), min: Math.max(0, Math.min(600, Math.round(Number(f.min)) || 0)), body: cut(f.body, 600), photos: photoList(f.photos, 4) }))
        .filter(f => f.title || f.body || f.photos.length),
      finalPhotos: photoList(g.finalPhotos, 8),
      safety: cut(g.safety, 1000), tips: cut(g.tips, 1000),
    };
  }
  /* 작업 설명서: 진행자 화면에 들어온 사람이면 누구나 쓰고 고쳐요 (PIN 없음) */
  function saveGuide(pw, sid, guide) {
    auth(pw);
    const g = cleanGuide(guide); let removed = [];
    env.lock(() => {
      const s = findSession(sid); if (!s) fail('학습회를 찾을 수 없어요.');
      const cur = store.list('guides').find(x => x.sid === s.id);
      const legacy = s.lead ? store.list('hostlogs').find(l => l.sid === s.id && l.hostId === s.lead.id) : null;
      const old = cur ? cur.guide : (legacy && legacy.guide);
      removed = photosOf(old).filter(x => photosOf(g).indexOf(x) < 0);
      if (cur) store.update('guides', Object.assign({}, cur, { guide: g, updatedAt: now() }));
      else store.insert('guides', { id: 'd' + s.id, sid: s.id, guide: g, updatedAt: now() });
      if (legacy && legacy.guide) { legacy.guide = null; store.update('hostlogs', legacy); }   // 예전 판에서 기록에 붙어 있던 설명서는 옮긴 뒤 비워요
    });
    trashUnused(removed);
    return getAll(pw);
  }
  /* 설명서 사진: 같은 스프레드시트의 '사진' 탭에 나눠 저장 (드라이브 권한 필요 없음) */
  function uploadPhoto(pw, dataUrl, name) {
    auth(pw);
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) fail('사진 형식이 맞지 않아요. JPG나 PNG 사진을 골라 주세요.');
    if (m[2].length > 4000000) fail('사진이 너무 커요. 더 작은 사진을 골라 주세요.');
    return env.savePhoto(m[2], m[1], cut(name, 60) || 'photo.jpg');
  }
  function getPhoto(pw, id) {
    auth(pw);
    if (!PHOTO_ID.test(String(id || ''))) fail('사진을 찾을 수 없어요.');
    return env.readPhoto(String(id));
  }
  function saveHostLog(pw, d, pin) {
    auth(pw); d = d || {}; pin = String(pin || '');
    if (!/^\d{4,6}$/.test(pin)) fail('PIN은 숫자 4~6자리예요.');
    const part = d.part === 'assist' ? 'assist' : 'log';
    let f = {};
    if (part === 'log') {
      f = { needs: (d.needs || []).filter(n => cut(n.t, 120)).slice(0, 40).map(n => ({ t: cut(n.t, 120), cat: cut(n.cat, 20) || '기타', st: STATUS.indexOf(n.st) >= 0 ? n.st : 'ok' })),
        went: cut(d.went, 1000), hard: cut(d.hard, 1000), safety: cut(d.safety, 600), next: cut(d.next, 1000), logAt: now() };
      SELF_KEYS.forEach(k => f[k] = sc5(d[k]));
    }
    let removed = [];
    if (part === 'assist') f = { aRole: cut(d.aRole, 60), aScore: sc5(d.aScore), aGood: cut(d.aGood, 600), aImprove: cut(d.aImprove, 600), logAt: now() };
    env.lock(() => {
      const s = findSession(d.sid); if (!s) fail('학습회를 찾을 수 없어요.');
      const isLead = part !== 'assist';
      const host = isLead ? s.lead : (s.assistants || []).find(a => a.id === String(d.hostId));
      if (!host || !host.name) fail(isLead ? '대표 진행자를 먼저 링크·정보 탭에서 넣어 주세요.' : '보조 진행자를 찾을 수 없어요.');
      const cur = store.list('hostlogs').find(l => l.sid === s.id && l.hostId === host.id);
      if (cur) {
        pinCheck(cur, pin);
        store.update('hostlogs', Object.assign({}, cur, f, { hostName: host.name, updatedAt: now() }));
      } else {
        store.insert('hostlogs', Object.assign({ id: 'l' + env.uid(), sid: s.id, role: isLead ? 'lead' : 'assist', hostId: host.id, hostName: host.name, pin: env.hash(pin), createdAt: now(), updatedAt: now() }, f));
      }
    });
    trashUnused(removed);
    return getAll(pw);
  }
  function deleteHostLog(pw, id, pin) {
    auth(pw);
    const l = store.list('hostlogs').find(x => x.id === String(id)); if (!l) fail('기록을 찾을 수 없어요.');
    pinCheck(l, pin);
    env.lock(() => store.remove('hostlogs', l.id));
    trashUnused(photosOf(l.guide));
    return getAll(pw);
  }

  return {
    getApplyInfo, apply, myRegs, cancelMine, getPublicSession, submitReview, changePassword,
    hostLogin: getAll, getAll, saveSession, deleteSession, setApplyOpen, setAttendance, hostCancelReg, promoteReg, moveReg, addReg,
    checkHostPin, saveHostLog, deleteHostLog, saveGuide, deleteReview, flipDifficulty, uploadPhoto, getPhoto,
    getGuideLibrary: () => buildGuideLibrary(getAll(env.getPassword()), RATED, TOOK),
    /* ---------- 전시회 출품 (전시회 여러 개) ---------- */
    exhInfo: () => ({ list: EXL.map(exhPubEx) }),
    exhSubmit: (exhId, f) => {
      const e = exhFind_(exhId); if (!exhOpenNow(e, now())) fail('지금은 이 전시회 출품 신청을 받지 않아요.');
      const r = exhClean(f);
      const had = exhRowsOf(e.id).filter(x => x.sn === r.sn);
      if (had.length && !exhSameName(had[0].name, r.name)) fail('이 학번은 다른 이름으로 출품 신청돼 있어요. 처음 신청할 때 적은 이름을 그대로 적어 주세요.');
      if (had.length >= 10) fail('한 사람이 낼 수 있는 기획서는 10장까지예요.');
      const rec = Object.assign({ id: 'x' + env.uid(), exh: e.id, exhTitle: e.title, at: exhStamp(now()), upd: exhStamp(now()), pin: '' }, r);
      store.insert('exh', rec); return exhPub(rec);
    },
    exhFind: (exhId, sn, name) => { const e = exhFind_(exhId); const m = exhMine(e, sn, name); const recs = exhMineOut(m); return { recs, rec: recs[0], me: m.me, canEdit: exhOpenNow(e, now()) }; },
    exhUpdate: (exhId, sn, name, f, recId) => {
      const e = exhFind_(exhId); const mine = exhMine(e, sn, name).own; if (!exhOpenNow(e, now())) fail('출품 신청이 마감돼서 고칠 수 없어요. 임원진에게 연락해 주세요.');
      const rec = recId ? mine.find(x => x.id === String(recId)) : mine[0]; if (!rec) fail('고칠 기획서를 찾을 수 없어요. 처음부터 다시 불러와 주세요.');
      const r = exhClean(Object.assign({}, f, { sn: rec.sn })); const nx = Object.assign({}, rec, r, { upd: exhStamp(now()) });
      store.update('exh', nx);
      mine.forEach(x => { if (x.id !== rec.id && (x.name !== r.name || x.gen !== r.gen)) store.update('exh', Object.assign({}, x, { name: r.name, gen: r.gen })); });   // 이름 · 기수는 내 기획서 모두 같이 바꿔요
      return exhPub(nx);
    },
    exhSubmitAll: (exhId, items) => {
      const e = exhFind_(exhId); if (!exhOpenNow(e, now())) fail('지금은 이 전시회 출품 신청을 받지 않아요.');
      const rs = exhCleanAll(items, null);
      const had = exhRowsOf(e.id).filter(x => x.sn === rs[0].sn);
      if (had.length && !exhSameName(had[0].name, rs[0].name)) fail('이 학번은 다른 이름으로 출품 신청돼 있어요. 처음 신청할 때 적은 이름을 그대로 적어 주세요.');
      if (had.length + rs.length > 10) fail('한 사람이 낼 수 있는 기획서는 10장까지예요.' + (had.length ? ` 이미 ${had.length}장을 냈어요.` : ''));
      const t = exhStamp(now());
      const recs = rs.map(r => { const rec = Object.assign({ id: 'x' + env.uid(), exh: e.id, exhTitle: e.title, at: t, upd: t, pin: '' }, r); store.insert('exh', rec); return exhPub(rec); });
      return { recs, had: had.length, canEdit: true };
    },
    exhUpdateAll: (exhId, sn, name, items, dels) => {
      const e = exhFind_(exhId); const m = exhMine(e, sn, name); if (!exhOpenNow(e, now())) fail('출품 신청이 마감돼서 고칠 수 없어요. 임원진에게 연락해 주세요.');
      const plan = exhPlanUpdate(m, items, dels); const t = exhStamp(now()); const done = new Set();
      plan.ups.forEach(u => { const nx = Object.assign({}, u.old, { work: u.r.work, objs: u.r.objs, desc: u.r.desc, co: u.r.co, upd: t }, u.own && plan.who ? plan.who : {}); store.update('exh', nx); done.add(nx.id); });
      if (plan.who) m.own.forEach(x => { if (!done.has(x.id) && !plan.gone.includes(x.id) && (x.name !== plan.who.name || x.gen !== plan.who.gen)) store.update('exh', Object.assign({}, x, plan.who)); });
      plan.gone.forEach(id => store.remove('exh', id));
      plan.adds.forEach(r => store.insert('exh', Object.assign({ id: 'x' + env.uid(), exh: e.id, exhTitle: e.title, at: t, upd: t, pin: '' }, r)));
      const after = exhMatch(exhRowsOf(e.id), m.me.sn, null);
      return { recs: exhMineOut(after), me: after.me || m.me, canEdit: true };
    },
    exhAdmin: pw => { auth(pw); return exhAdmin_(); },
    exhDetail: (pw, id) => { auth(pw); return exhDetail_(id); },
    exhSave: (pw, id, ns) => { auth(pw); ns = ns || {};
      const title = cut(ns.title, 60); if (!title) fail('전시회 이름을 적어 주세요.');
      const v = { title: title, open: !!ns.open, closeAt: Number(ns.closeAt) > 0 ? Number(ns.closeAt) : '', note: cut(ns.note, 1000) };
      let e;
      if (!id){ e = Object.assign({ id: 'e' + env.uid(), at: now() }, v); EXL = [e].concat(EXL); }
      else { e = exhFind_(id); const renamed = e.title !== title; Object.assign(e, v);
        if (renamed) exhRowsOf(e.id).forEach(x => store.update('exh', Object.assign({}, x, { exhTitle: title }))); }
      return exhDetail_(e.id); },
    exhDelete: (pw, exhId, id) => { auth(pw); exhFind_(exhId); store.remove('exh', String(id)); return exhDetail_(exhId); },
    exhDrop: (pw, id) => { auth(pw); exhFind_(id); EXL = EXL.filter(x => x.id !== id); return exhAdmin_(); },

    timeGuide: (sid, who, text) => { who = String(who || '').replace(/[^a-z0-9]/gi, '').slice(0, 8); text = cut(text, 20); if (!who) fail('다시 시도해 주세요.');
      if (!buildGuideLibrary(getAll(env.getPassword())).some(x => x.id === String(sid))) fail('설명서를 찾을 수 없어요.');
      const L = (TOOK[sid] || []).filter(e => e[0] !== who); if (text) L.push([who, parseMinutes(text), text]); TOOK[sid] = L.slice(-80); return tookList(TOOK[sid]); },
    rateGuide: (sid, v, prev) => { v = sc5(v); if (!v) fail('난이도를 골라 주세요.');
      if (!buildGuideLibrary(getAll(env.getPassword())).some(x => x.id === String(sid))) fail('설명서를 찾을 수 없어요.');
      const c = RATED[sid] = RATED[sid] || [0,0,0,0,0]; const pv = sc5(prev); if (pv && c[pv-1] > 0) c[pv-1]--; c[v-1]++; return rateSum(c); },
    getGuidePhoto: id => { if (guideLibraryPhotos(buildGuideLibrary(getAll(env.getPassword()))).indexOf(String(id)) < 0) fail('사진을 찾을 수 없어요.'); return env.readPhoto(String(id)); },
  };
}

/* 미리보기용 가짜 서버: index.html이 clone(복사 함수)을 넘겨 줘요 */
window.dgBuildDemo = function(clone){
  /* ---------- 미리보기용 가짜 서버 (실제와 같은 규칙 makeCore 사용) ---------- */
  const DEMO_URL = 'https://script.google.com/macros/s/배포하면-생기는-주소/exec';
  function demoSeed(){
    const T = (d, h) => new Date(d + 'T' + (h||'12:00') + ':00').getTime();
    const names = ['김하늘','이준서','박서윤','최도현','정예린','강민재','윤지아','장우진','임채원','한지호','오다은','서태윤','신유나','권시우','황보람','안재희','송민서','류하준','전소율','홍지후','고은채','문현우','배수아','조이안'];
    const depts = ['산업디자인과','기계공학과','건축학과','경영학과','시각디자인과','국어국문학과','컴퓨터공학과','화학과'];
    const sessions = [
      {id:'sexrabbit', title:'토끼 모형 깎기', term:'', places:['1동방'], desc:'피나무 블록으로 손바닥만 한 토끼를 깎습니다. 카빙나이프 쥐는 법과 결 방향 읽는 법부터 시작합니다.',
       lead:{id:'hex1',name:'김민지'}, assistants:[{id:'hex2',name:'박도윤'}],
       classes:[{id:'cr1',label:'1회차',dates:['2026-11-09'],time:'19:00~21:00',capacity:6},{id:'cr2',label:'2회차',dates:['2026-11-11'],time:'19:00~21:00',capacity:6},{id:'cr3',label:'3회차',dates:['2026-11-14'],time:'14:00~16:00',capacity:6}],
       tools:['카빙나이프','밴드 쏘'], notes:'방검 장갑은 동방에 비치된 것을 사용합니다.\n완성한 토끼는 가져가셔도 됩니다.',
       applyOpen:'1', openAt:T('2026-11-02','10:00'), closeAt:T('2026-11-08','23:59'), createdAt:T('2026-11-01')},
      {id:'sexjewel', title:'호두나무 보석함 만들기', term:'', places:['1동방','2동방'], desc:'호두나무 판재를 재단하고 짜맞춤으로 뚜껑 있는 작은 보석함을 만듭니다. 재단과 조립을 두 번에 나눠 진행합니다.',
       lead:{id:'hex3',name:'이서연'}, assistants:[{id:'hex4',name:'한유진'},{id:'hex5',name:'최하준'}],
       classes:[{id:'cj1',label:'1회차',dates:['2026-10-19','2026-10-20'],time:'19:00~21:30',capacity:5},{id:'cj2',label:'2회차',dates:['2026-10-21','2026-10-22'],time:'19:00~21:30',capacity:5}],
       tools:['테이블 쏘','밴드 쏘','루터'], notes:'제작한 보석함은 목방 전시회에 반드시 출품해야 합니다.\n작업 진행에 따라 종료 시간이 늦어질 수 있으니 일정에 여유를 두고 신청해 주세요.\n별도의 뒤풀이는 없습니다.',
       applyOpen:'', createdAt:T('2026-10-10')},
      {id:'sexboard', title:'원목 도마 만들기', term:'', places:['2동방'], desc:'체리 판재로 손잡이 달린 도마를 만듭니다.',
       lead:{id:'hex6',name:'정지우'}, assistants:[],
       classes:[{id:'cb1',label:'1회차',dates:['2026-05-12'],time:'18:30~21:00',capacity:8}], applyOpen:'', createdAt:T('2026-05-01')},
    ];
    sessions.push({id:'sexspoon', title:'나무 숟가락 깎기', term:'', places:['1동방'], desc:'벚나무로 한 끼 식사에 쓸 숟가락을 깎습니다.',
       lead:{id:'hex7',name:'박도윤'}, assistants:[], classes:[{id:'cs1',label:'1회차',dates:['2026-11-23'],time:'18:00~20:00',capacity:6},{id:'cs2',label:'2회차',dates:['2026-11-25'],time:'18:00~20:00',capacity:6}],
       tools:['카빙나이프','끌·조각도'], notes:'', applyOpen:'1', openAt:T('2026-11-16','10:00'), closeAt:T('2026-11-20','23:59'), createdAt:T('2026-11-02'),
       review:{metrics:[{id:'finish',q:'숟가락을 끝까지 완성했나요?',s:'완성도'},{id:'mknife',q:'칼 다루는 법이 손에 익었나요?',s:'칼 다루기'},{id:'again',q:'다음 학습회에도 참여하고 싶나요?',s:'재참여 의향'}],difficulty:true,texts:[{id:'comment',q:'자유 의견'}]}});
    const regs = []; let k = 0;
    const add = (sid, cid, status, attended, reviewed, t) => { const n = k++; regs.push({id:'gex'+n, sid, classId:cid, name:names[n % names.length], dept:depts[n % depts.length], studentNo:String(20230101 + n*7), phone:'010' + String(30000000 + n*1371).slice(0,8), status, attended, reviewed: reviewed?'1':'', createdAt:t + n*60000, updatedAt:t + n*60000}); };
    for (let i=0;i<6;i++) add('sexrabbit','cr1','confirmed',[],false,T('2026-11-02','09:00'));
    for (let i=0;i<2;i++) add('sexrabbit','cr1','waiting',[],false,T('2026-11-02','12:00'));
    for (let i=0;i<4;i++) add('sexrabbit','cr2','confirmed',[],false,T('2026-11-02','13:00'));
    add('sexrabbit','cr3','confirmed',[],false,T('2026-11-02','15:00'));
    for (let i=0;i<5;i++) add('sexjewel','cj1','confirmed', i<4 ? ['2026-10-19','2026-10-20'] : ['2026-10-19'], i<4, T('2026-10-12'));
    for (let i=0;i<4;i++) add('sexjewel','cj2','confirmed', i<3 ? ['2026-10-21','2026-10-22'] : [], i<3, T('2026-10-12','15:00'));
    add('sexjewel','cj2','cancelled',[],false,T('2026-10-13'));
    for (let i=0;i<7;i++) add('sexboard','cb1','confirmed',['2026-05-12'], i<5, T('2026-05-05'));
    const R = (sid, cid, o) => ({id:'rex'+Math.random().toString(36).slice(2,8), sid, classId:cid, submittedAt:T('2026-10-23'), ...o});
    const reviews = [
      R('sexjewel','cj1',{overall:5,finish:4,clarity:5,safety:5,material:3,time:4,again:5,difficulty:3,good:'테이블 쏘 안전 설명이 자세해서 안심됐어요.',improve:'경첩이 없어서 뚜껑을 못 달았어요.',nextTopic:'원목 도마'}),
      R('sexjewel','cj1',{overall:4,finish:3,clarity:4,safety:5,material:2,time:3,again:4,difficulty:4,good:'테이블 쏘 안전 설명이 자세해서 좋았어요!',improve:'경첩이 없어서 뚜껑을 못 달아서 아쉬웠어요',nextTopic:'트레이'}),
      R('sexjewel','cj1',{overall:5,finish:5,clarity:5,safety:4,material:4,time:5,again:5,difficulty:3,good:'이틀로 나눠서 여유 있게 만들 수 있었어요.',improve:'클램프가 부족했어요.',nextTopic:'원목 도마'}),
      R('sexjewel','cj1',{overall:4,finish:4,clarity:4,safety:4,material:3,time:3,again:4,difficulty:4,good:'',improve:'클램프가 좀 부족했어요',nextTopic:''}),
      R('sexjewel','cj2',{overall:3,finish:2,clarity:3,safety:5,material:2,time:2,again:4,difficulty:5,good:'짜맞춤을 처음 해 봤는데 신기했어요.',improve:'둘째 날 시간이 모자랐어요.',nextTopic:'원목 도마'}),
      R('sexjewel','cj2',{overall:4,finish:4,clarity:4,safety:5,material:3,time:3,again:5,difficulty:4,good:'이틀로 나눠서 여유가 있었어요',improve:'둘째 날 시간이 좀 모자랐어요',nextTopic:'나무 숟가락'}),
      R('sexjewel','cj2',{overall:4,finish:3,clarity:5,safety:4,material:3,time:3,again:4,difficulty:4,good:'진행자분들이 하나씩 봐 주셨어요.',improve:'',nextTopic:''}),
      R('sexboard','cb1',{overall:5,finish:5,clarity:5,safety:4,material:5,time:4,again:5,difficulty:3,good:'집에서 바로 쓸 수 있는 걸 만들어서 좋았어요.',improve:'',nextTopic:'트레이'}),
      R('sexboard','cb1',{overall:4,finish:4,clarity:4,safety:4,material:4,time:4,again:4,difficulty:3,good:'',improve:'사포질 시간이 길었어요.',nextTopic:''}),
    ];
    const H = s => 'demo:' + s;
    const hostlogs = [
      {id:'lex1', sid:'sexjewel', role:'lead', hostId:'hex3', hostName:'이서연', pin:H('1234'), createdAt:T('2026-10-15'), updatedAt:T('2026-10-24'), logAt:T('2026-10-24'),
       guide:{intro:'호두나무 12mm 판재로 가로 15 × 세로 10 × 높이 7cm 크기의 뚜껑 있는 보석함을 만들어요. 첫날은 재단과 홈 파기, 둘째 날은 조립과 마감이에요.', duration:'회차당 이틀, 하루 2시간 30분',
         prep:['호두나무 판재 12mm (1인당 60 × 15cm 2장)','경첩 25mm 2개와 나사','목공용 본드','클램프 (2인당 2개)','사포 120·240·400방','오일 마감재와 천','푸시 스틱, 보안경, 귀마개'],
         cutting:['판재 결 방향을 확인하고 연필로 옆판 2장(15×7), 마구리판 2장(10×7), 바닥·뚜껑(15×10)을 그려요.','테이블 쏘 펜스를 7cm에 맞추고 푸시 스틱으로 긴 방향부터 켜요.','크로스컷 썰매로 길이를 잘라요. 같은 길이는 스톱블록으로 한 번에 맞춰요.','바닥이 들어갈 홈은 날 높이 6mm, 펜스 6mm로 두 번 지나가게 파요.'],
         flow:[{title:'안전 교육과 기구 시범',min:20,body:'테이블 쏘 앞에 서는 위치, 푸시 스틱 쓰는 법, 반동(킥백)이 생기는 이유를 먼저 보여 줘요.'},{title:'재단',min:60,body:'두 명씩 짝지어 한 명은 재단, 한 명은 받아 주기. 진행자 한 명은 기계 옆에 꼭 붙어 있어요.'},{title:'홈 파기와 가조립',min:50,body:'본드 없이 맞춰 보고 틈이 크면 사포로 조정해요.'},{title:'둘째 날: 본드 조립',min:40,body:'클램프로 고정하고 삐져나온 본드는 젖은 천으로 바로 닦아요.'},{title:'경첩 달기와 마감',min:70,body:'경첩 자리를 끌로 파고 달아요. 마지막에 오일을 바르고 10분 뒤 닦아 내요.'}],
         safety:'테이블 쏘는 한 번에 한 사람만, 진행자가 옆에 있을 때만 써요. 날 높이는 판재보다 3mm만 높게. 폭 10cm보다 좁은 판은 반드시 푸시 스틱으로 밀어요. 장갑은 테이블 쏘 앞에서 벗어요.',
         tips:'재단은 진행자가 미리 절반쯤 해 두면 첫날 시간이 넉넉해요. 경첩은 학습회 일주일 전에 주문하세요.'},
       selfScore:3, prepScore:2, planScore:3, needs:[{t:'테이블 쏘',cat:'대형 기구',st:'ok'},{t:'호두나무 판재 12mm',cat:'목재',st:'ok'},{t:'경첩·작은 나사',cat:'기타',st:'none'},{t:'클램프',cat:'기타',st:'short'}],
       went:'테이블 쏘 안전 수칙을 먼저 시범으로 보여 주니 모두 차분하게 재단했어요. 이틀로 나눈 덕분에 첫날 서두르지 않았어요.', hard:'경첩을 깜빡해서 1회차는 뚜껑을 다음 주에 따로 달았어요. 2회차는 둘째 날 시간이 모자랐어요.', safety:'푸시 스틱 없이 좁은 판을 밀려는 분이 있어 바로 멈췄어요. 다친 사람은 없어요.', next:'경첩 미리 주문하기, 클램프 4개 더 빌리기, 둘째 날 30분 일찍 시작'},
      {id:'lex2', sid:'sexjewel', role:'assist', hostId:'hex4', hostName:'한유진', pin:H('1234'), createdAt:T('2026-10-24'), updatedAt:T('2026-10-24'), logAt:T('2026-10-24'),
       aRole:'테이블 쏘 옆 안전 보조', aScore:4, aGood:'재단 대기 줄을 정리하고 푸시 스틱을 계속 챙겨 줬어요.', aImprove:'홈 파기 순서를 미리 익혀 두면 더 도울 수 있을 것 같아요.'},
      {id:'lex3', sid:'sexrabbit', role:'lead', hostId:'hex1', hostName:'김민지', pin:H('1234'), createdAt:T('2026-11-01'), updatedAt:T('2026-11-01'),
       guide:{intro:'피나무 블록으로 손바닥만 한 토끼를 깎아요. 처음 오는 분도 2시간 안에 완성할 수 있어요.', duration:'회차당 2시간',
         prep:['피나무 블록 50 × 50 × 80mm (밴드 쏘로 옆모습 따 두기)','카빙나이프 (1인 1자루)','방검 장갑 (M·L)','연필, 사포 240방'],
         cutting:['블록에 옆모습 도안을 대고 연필로 그려요.','밴드 쏘로 도안 바깥 2mm를 남기고 잘라 둬요. (진행자가 하루 전에)'],
         flow:[{title:'칼 쥐는 법과 안전',min:15,body:'칼날은 항상 몸 바깥쪽으로. 엄지로 밀어 깎는 법을 연습해요.'},{title:'큰 덩어리 깎기',min:45,body:'귀 사이를 먼저 파고 몸통을 둥글게.'},{title:'다듬기와 얼굴',min:40,body:'결 방향을 따라 얇게. 귀는 거꾸로 깎으면 부러져요.'},{title:'사포와 마무리',min:20,body:''}],
         safety:'칼을 몸 쪽으로 당기지 않아요. 깎는 손 반대편 손에는 꼭 방검 장갑.', tips:'귀는 마지막에 다듬어야 부러지지 않아요.'}},
    ];
    const guides = hostlogs.filter(l => l.guide).map(l => ({id:'d' + l.sid, sid:l.sid, guide:l.guide, updatedAt:l.updatedAt}));
    hostlogs.forEach(l => { delete l.guide; });
    const jw = guides.find(g => g.sid === 'sexjewel').guide;
    jw.flow[1].photos = ['pdemoCut']; jw.flow[4].photos = ['pdemoHinge']; jw.finalPhotos = ['pdemoBox1', 'pdemoBox2'];
    const rb = guides.find(g => g.sid === 'sexrabbit').guide; rb.finalPhotos = ['pdemoRabbit'];
    jw.makeTime = '약 5시간 (두 번)'; rb.makeTime = '약 2시간';
    return {sessions, regs, reviews, guides, hostlogs: hostlogs.filter(l => l.logAt)};
  }
  /* 미리보기용 예시 사진 (나뭇결 그림) */
  function fakePhoto(label, hue){
    try {
      const c = document.createElement('canvas'); c.width = 640; c.height = 460; const x = c.getContext('2d');
      const g = x.createLinearGradient(0,0,640,460); g.addColorStop(0, `hsl(${hue},45%,72%)`); g.addColorStop(1, `hsl(${hue},45%,48%)`);
      x.fillStyle = g; x.fillRect(0,0,640,460);
      x.strokeStyle = `hsla(${hue},40%,30%,.28)`; x.lineWidth = 2;
      for (let i = 0; i < 22; i++){ x.beginPath(); for (let k = 0; k <= 640; k += 16){ const yy = i*22 + Math.sin((k + i*37)/70)*7; k ? x.lineTo(k, yy) : x.moveTo(k, yy); } x.stroke(); }
      x.fillStyle = 'rgba(255,250,240,.9)'; x.beginPath(); x.roundRect ? x.roundRect(170,120,300,200,18) : x.rect(170,120,300,200); x.fill();
      x.fillStyle = `hsl(${hue},35%,30%)`; x.font = '600 26px sans-serif'; x.textAlign = 'center'; x.fillText(label, 320, 228);
      x.font = '16px sans-serif'; x.fillText('미리보기 예시 사진', 320, 262);
      return c.toDataURL('image/jpeg', 0.72);
    } catch(e){ return ''; }
  }
    return (() => {
    const T = demoSeed();
    const dexh = (id, at, name, sn, gen, work, objs, desc, ex) => ({ id, exh: ex || 'edemo', exhTitle: ex === 'edemo25' ? '2025학년도 목방 전시회' : '2026학년도 목방 전시회', at, upd: at, name, sn, gen, work, objs, desc, pin: '' });
    T.exh = [
      dexh('xd1', '2026-11-02 21:14', '김목방', '202400118', '39', '칼, 끌, 나무', [
        { n: '작은 접시', m: '호두', w: 120, d: 70, h: 20 }, { n: '사과', m: '호두', w: 70, d: 50, h: 150 },
        { n: '수달', m: '은행', w: 60, d: 60, h: 60 }, { n: '돌고래', m: '은행', w: 40, d: 40, h: 50 }, { n: '호박', m: '은행, led', w: 170, d: 50, h: 70 }],
        '칼과 끌을 통해 나무를 깎은 작품입니다. 사포로 마감하지 않고 칼의 거친 느낌을 드러낸 제품입니다.'),
      dexh('xd2', '2026-11-03 10:02', '박도윤', '202300542', '38', '결', [
        { n: '스툴', m: '오크', w: 350, d: 350, h: 450 }],
        '판재를 짜맞춤으로 이어 만든 스툴입니다. 오크의 결이 잘 보이도록 오일로만 마감했습니다.'),
      dexh('xd3', '2025-11-12 19:40', '이목공', '202200077', '37', '숲의 소리', [
        { n: '새 모빌', m: '편백', w: 300, d: 300, h: 400 }, { n: '받침대', m: '월넛', w: 200, d: 120, h: 30 }],
        '나뭇조각을 깎아 숲속 새들이 움직이는 모빌로 만들었습니다.', 'edemo25')];
    const mem = { list: k => clone(T[k]), insert: (k,o) => T[k].push(clone(o)),
      update: (k,o) => { const i = T[k].findIndex(x => x.id === o.id); if (i < 0) throw new Error('찾을 수 없어요.'); T[k][i] = clone(o); },
      remove: (k,id) => { T[k] = T[k].filter(x => x.id !== id); } };
    const cache = {}; const photos = {};
    const demoLabels = {pdemoCut:['재단 중',28], pdemoHinge:['경첩 달기',24], pdemoBox1:['완성한 보석함',30], pdemoBox2:['뚜껑을 연 모습',32], pdemoRabbit:['완성한 토끼',38]};
    let demoPw = '1234';
    return makeCore(mem, { exhList: [
      { id: 'edemo', title: '2026학년도 목방 전시회', open: true, closeAt: new Date(new Date().getFullYear(), 10, 20, 23, 50).getTime(), note: '출품작은 전시 하루 전까지 1동방으로 가져와 주세요.\n작품 설명은 3~5문장 정도로 적어 주세요.', at: Date.now() },
      { id: 'edemo25', title: '2025학년도 목방 전시회', open: false, closeAt: '', note: '', at: Date.now() - 365 * 86400000 }], ratings: { sexjewel: [0, 1, 3, 4, 1], sexrabbit: [1, 2, 3, 0, 0] },
      times: { sexjewel: [['d1',300,'5시간'],['d2',270,'4시간 30분'],['d3',360,'6시간 정도'],['d4',null,'2~3시간씩 두 번'],['d5',null,'이틀'],['d6',330,'5시간반'],['d7',240,'4시간'],['d8',420,'7시간']],
               sexrabbit: [['e1',120,'2시간'],['e2',150,'2시간 30분'],['e3',100,'100분'],['e4',120,'두 시간']] }, getPassword: () => demoPw, setPassword: v => { demoPw = v; }, uid: () => Math.random().toString(36).slice(2,10), hash: (pin, salt) => (salt||'demo') + ':' + pin,
      cacheGet: k => cache[k] ?? null, cachePut: (k,v) => { cache[k] = v; }, cacheRemove: k => { delete cache[k]; }, url: () => DEMO_URL, version: '18판', lock: fn => fn(),
      savePhoto: (b64, mime) => { const id = 'pd' + Math.random().toString(36).slice(2,12); photos[id] = `data:${mime};base64,${b64}`; return id; },
      readPhoto: id => { if (!photos[id] && demoLabels[id]) photos[id] = fakePhoto(...demoLabels[id]); if (!photos[id]) throw new Error('사진을 찾을 수 없어요.'); return photos[id]; },
      trashPhoto: id => { delete photos[id]; } });
  })();
};
