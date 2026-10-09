/* =====================================================================
   Exact pattern matching: the naive search, Knuth–Morris–Pratt, Boyer–Moore
   and Rabin–Karp. The pattern slides along the text; the comparisons light
   up; the tables the faster methods make from the pattern are shown.
   ===================================================================== */
(function () {
  'use strict';
  const MG = window.MG;
  const { h, esc } = MG;
  const V = MG.viz;
  const A = MG.algo;
  const seq = V.seq;
  const sgn = (v) => (v < 0 ? '−' + -v : String(v));

  const TEXT = { key: 'text', label: 'Text (searched in)', type: 'seq', letters: 'ACGT', min: 2, max: 26 };
  const PAT = { key: 'pattern', label: 'Pattern (searched for)', type: 'seq', letters: 'ACGT', min: 1, max: 10 };
  const checkLen = (input) => (input.pattern.length > input.text.length ? 'The pattern is longer than the text.' : null);

  /* ------------------------------------------------------------------
     The picture shared by the four machines: the text, the pattern under
     it at the current shift, the counts, and room for a table.
     ------------------------------------------------------------------ */
  function slider(stage, T, P) {
    const n = T.length, m = P.length;
    const W = (stage.clientWidth || 640) - 50 - 80; // the labels take about 80 px
    const size = Math.max(18, Math.min(40, Math.floor(W / n) - 3));
    stage.style.setProperty('--cell', size + 'px');
    const pitch = size + 3;
    const wrap = h('div.sl');
    stage.appendChild(wrap);
    const counts = h('div.sl-counts');
    const textTiles = T.split('').map((c) => h('span', { class: V.tileClass(c) }, c));
    const textRow = h('div.tiles.sl-text', textTiles.map((t, i) => h('span.tilebox', h('span.posn', String(i)), t)));
    const patTiles = P.split('').map((c) => h('span', { class: V.tileClass(c) }, c));
    const patRow = h('div.tiles.sl-pat', patTiles);
    const shiftLab = h('div.sl-shiftlab');
    const lane = h('div.sl-lane', patRow, shiftLab);
    const area = h('div.sl-area', h('div.sl-row', h('span.viz-label', 'Text'), textRow), h('div.sl-row', h('span.viz-label', 'Pattern'), lane));
    const extra = h('div.sl-extra');
    wrap.appendChild(counts);
    wrap.appendChild(area);
    wrap.appendChild(extra);
    let shown = null;
    return {
      size, pitch, wrap, extra, counts, textTiles, patTiles, patRow,
      /** put the pattern at shift s (it slides there) */
      at(s, ctx) {
        patRow.style.transform = `translateX(${s * pitch}px)`;
        if (shown != null && s !== shown && ctx && !ctx.instant && !ctx.back) patRow.classList.add('moving');
        else patRow.classList.remove('moving');
        shown = s;
      },
      /** colour the comparisons: list of {j, ok}; cur = the one being made now */
      marks(s, comps, curIdx, known) {
        textTiles.forEach((t) => t.classList.remove('ok', 'bad', 'cur', 'known'));
        patTiles.forEach((t) => t.classList.remove('ok', 'bad', 'cur', 'known'));
        (known || []).forEach((j) => {
          if (textTiles[s + j]) textTiles[s + j].classList.add('known');
          patTiles[j].classList.add('known');
        });
        (comps || []).forEach((c, k) => {
          const cls = k === curIdx ? (c.ok ? 'ok' : 'bad') : c.ok ? 'ok' : 'bad';
          if (textTiles[s + c.j]) textTiles[s + c.j].classList.add(cls);
          patTiles[c.j].classList.add(cls);
          if (k === curIdx) {
            if (textTiles[s + c.j]) textTiles[s + c.j].classList.add('cur');
            patTiles[c.j].classList.add('cur');
          }
        });
      },
      /** underline the occurrences found so far */
      found(hits) {
        const on = new Set();
        hits.forEach((p) => {
          for (let k = 0; k < m; k++) on.add(p + k);
        });
        textTiles.forEach((t, i) => t.classList.toggle('found', on.has(i)));
      },
      shiftLabel(txt) {
        shiftLab.innerHTML = txt || '';
        shiftLab.classList.toggle('on', !!txt);
      },
      setCounts(html) {
        counts.innerHTML = html;
      },
      shake(j, ctx) {
        if (patTiles[j]) V.anim(patTiles[j], [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], 300, ctx);
      }
    };
  }
  const countsHtml = (f, extra) =>
    `<span><b>${f.comparisons}</b> comparison${f.comparisons === 1 ? '' : 's'}</span><span><b>${f.shifts}</b> place${f.shifts === 1 ? '' : 's'} tried</span><span>found at: <b>${f.hits.length ? f.hits.join(', ') : '–'}</b></span>${extra || ''}`;

  /* ==================================================================
     Naive search
     ================================================================== */
  V.define('naive', {
    title: 'Naive search',
    sub: 'Try every position; compare from the left until a mismatch',
    inputs: [Object.assign({}, TEXT, { default: 'ATACGATATAGA' }), Object.assign({}, PAT, { default: 'TATA' })],
    presets: {
      tata: { label: 'TATA in ATACGATATAGA', input: { text: 'ATACGATATAGA', pattern: 'TATA' } },
      twice: { label: 'GAT in GATTACAGATTACA (twice)', input: { text: 'GATTACAGATTACA', pattern: 'GAT' } },
      worst: { label: 'A bad case: AAAAG in AAAAAAAAAAAG', input: { text: 'AAAAAAAAAAAG', pattern: 'AAAAG' } }
    },
    practice: true,
    check: checkLen,
    code: [
      'for s in range(len(T) - len(P) + 1):   # every shift',
      '    j = 0',
      '    while j < len(P) and T[s + j] == P[j]:',
      '        j += 1                           # compare from the left',
      '    if j == len(P): report(s)            # all letters matched',
      '    # a mismatch (or a match): move the pattern one place on'
    ],
    build(input, mode) {
      const T = input.text, P = input.pattern, m = P.length;
      const r = A.naiveSearch(T, P);
      const frames = [];
      let comparisons = 0, shifts = 1; // shifts: the places of the pattern tried so far
      const hits = [];
      const F = (o) => frames.push(Object.assign({ comparisons, shifts, hits: hits.slice() }, o));
      F({ s: 0, comps: [], narr: `Put the pattern ${seq(P)} under the start of the text, and compare letter by letter from the left. At the first mismatch, move the pattern one place on and start again.`, line: 0 });
      let asked = 0;
      r.steps.forEach((st, k) => {
        if (k > 0) {
          shifts++;
          F({ s: st.s, comps: [], line: 0, narr: `Move the pattern one place on: shift ${st.s}.`, dwell: 0.7 });
        }
        if (mode === 'practice' && asked < 6) {
          asked++;
          const okN = st.comps.filter((c) => c.ok).length;
          F({ s: st.s, comps: [], line: [2, 3], narr: `Shift ${st.s}: the pattern is under ${seq(T.slice(st.s, st.s + m))}.`,
            ask: { type: 'number', answer: okN, prompt: `How many letters match, counting from the left, before the first mismatch? (All ${m}: a match.)`, hint: `Compare ${seq(P)} with ${seq(T.slice(st.s, st.s + m))} letter by letter from the left.`, explain: okN === m ? 'All of them – the pattern is here.' : `${okN} – then ${seq(T[st.s + okN])} against ${seq(P[okN])}.` } });
        }
        st.comps.forEach((c, ci) => {
          comparisons++;
          const last = ci === st.comps.length - 1;
          let narr = `${seq(T[st.s + c.j])} against ${seq(P[c.j])}: ${c.ok ? 'the same' : '<b>different</b> – a mismatch'}.`;
          if (last && st.match) {
            hits.push(st.s);
            narr = `${seq(T[st.s + c.j])} against ${seq(P[c.j])}: the same. All ${m} letters match: <b>the pattern is at position ${st.s}</b>.`;
          }
          F({ s: st.s, comps: st.comps.slice(0, ci + 1), cur: ci, line: last && st.match ? 4 : [2, 3], narr, dwell: 0.6, shake: !c.ok ? c.j : null });
        });
      });
      F({ s: r.steps.length ? r.steps[r.steps.length - 1].s : 0, comps: [], done: true, line: null, narr: `Done: ${hits.length ? `${seq(P)} occurs at ${hits.length === 1 ? 'position' : 'positions'} <b>${hits.join(', ')}</b>` : `${seq(P)} does not occur`}. ${comparisons} comparisons at ${r.steps.length} places (the pattern moved ${r.steps.length - 1} times) – in the worst case (m × n) every letter of the pattern is compared at every place.` });
      return { frames, data: { T, P } };
    },
    view(stage, data) {
      const sl = slider(stage, data.T, data.P);
      return {
        update(f, prev, ctx) {
          sl.at(f.s, ctx);
          sl.marks(f.s, f.comps, f.cur);
          sl.found(f.hits);
          sl.setCounts(countsHtml(f));
          sl.shiftLabel('');
          if (f.shake != null && !ctx.back) sl.shake(f.shake, ctx);
        }
      };
    }
  });

  /* ==================================================================
     Knuth–Morris–Pratt
     ================================================================== */
  V.define('kmp', {
    title: 'Knuth–Morris–Pratt',
    sub: 'A table made from the pattern says how far it can jump',
    inputs: [Object.assign({}, TEXT, { default: 'ATCTATCGATTCGATCGATGA' }), Object.assign({}, PAT, { default: 'ATCGATG' }), { key: 'part', label: 'Show', type: 'select', options: [['both', 'the table, then the search'], ['table', 'only the table'], ['search', 'only the search']], default: 'both' }],
    presets: {
      atcgatg: { label: 'ATCGATG in ATCTATCGATTCGATCGATGA', input: { text: 'ATCTATCGATTCGATCGATGA', pattern: 'ATCGATG', part: 'both' } },
      table: { label: 'The table of TATATATAGT', input: { text: 'TATATATAGTATATATAGT', pattern: 'TATATATAGT', part: 'table' } },
      repeats: { label: 'TATAG in TATATATAGTATAG', input: { text: 'TATATATAGTATAG', pattern: 'TATAG', part: 'both' } }
    },
    practice: true,
    check: checkLen,
    code: [
      '# the table: pi[i] = length of the longest border of P[:i]',
      'pi[0] = -1',
      'for i in 1..m: k = pi[i-1]; while k >= 0 and P[k] != P[i-1]: k = pi[k]; pi[i] = k + 1',
      '# the search',
      's, q = 0, 0                    # q letters are already known to match',
      'while s <= n - m:',
      '    while q < m and T[s+q] == P[q]: q += 1',
      '    if q == m: report(s)',
      '    s += q - pi[q]             # jump: i = q letters matched',
      '    q = max(pi[q], 0)          # these letters need not be compared again'
    ],
    build(input, mode) {
      const T = input.text, P = input.pattern, m = P.length;
      const tb = A.kmpTable(P);
      const r = A.kmpSearch(T, P);
      const part = input.part || 'both';
      const frames = [];
      let comparisons = 0, shifts = 1; // shifts: the places of the pattern tried so far
      const hits = [];
      let piShown = part === 'search' ? m : 0;
      const F = (o) => frames.push(Object.assign({ comparisons, shifts, hits: hits.slice(), piShown, phase: 'table', s: 0, comps: [] }, o));
      if (part !== 'search') {
        F({ line: 0, narr: `First, a table from the pattern alone. π[i] is the length of the longest <b>border</b> of the first i letters: a part that is both a prefix and a suffix of them (but not all of them). If a mismatch comes after i matched letters, the pattern can jump so that this border lines up – the letters of the border need not be compared again.` });
        F({ line: 1, piShown: 0, narr: 'π[0] = −1 by definition: a mismatch on the very first letter means a plain shift of one.' });
        let asked = 0;
        tb.how.slice(1).forEach((hw) => {
          const i = hw.i;
          const pre = P.slice(0, i);
          const v = tb.pi[i];
          const border = v ? `${seq(pre.slice(0, v))} is both its prefix and its suffix` : 'no border: no proper prefix is also a suffix';
          if (mode === 'practice' && asked < m) {
            asked++;
            F({ line: 2, piShown: i - 1, focus: i, narr: `${i === 1 ? 'The first letter' : `The first ${i} letters`}: ${seq(pre)}.`, ask: { type: 'number', answer: v, prompt: `π[${i}]: how long is the longest border of ${seq(pre)}?`, hint: 'Find the longest part that is both a prefix and a suffix – but not the whole thing. None: 0.', explain: `${v} – ${border}.` } });
          }
          piShown = i;
          F({ line: 2, piShown: i, focus: i, border: v, narr: `π[${i}] = <b>${v}</b>: ${i === 1 ? 'the first letter is' : `the first ${i} letters are`} ${seq(pre)} – ${border}.`, dwell: 1.2 });
        });
        piShown = m;
        if (part === 'table') {
          F({ line: null, done: true, narr: `The table of ${seq(P)}: ${tb.pi.map((x) => sgn(x)).join(' ')}. Making it takes time proportional to the length of the pattern.` });
          return { frames, data: { T, P, pi: tb.pi, part } };
        }
      }
      // the search
      F({ phase: 'search', s: 0, comps: [], line: 4, narr: `Now the search. Compare from the left as in the naive search; at a mismatch after i matched letters, jump i − π[i] places, and continue <i>after</i> the border instead of from the start of the pattern.` });
      let asked = 0;
      r.steps.forEach((st, k) => {
        const known = A.range(st.start);
        if (k > 0) {
          shifts++;
          F({ phase: 'search', s: st.s, comps: [], known, line: 9, narr: known.length ? `The pattern is at shift ${st.s}. Its first ${known.length} letter${known.length > 1 ? 's' : ''} (${seq(P.slice(0, known.length))}) already match – no need to compare them again.` : `The pattern is at shift ${st.s}; compare from its first letter.`, dwell: 0.9 });
        }
        st.comps.forEach((c, ci) => {
          comparisons++;
          const last = ci === st.comps.length - 1;
          if (last && st.match) hits.push(st.s);
          F({ phase: 'search', s: st.s, comps: st.comps.slice(0, ci + 1), cur: ci, known, line: last && st.match ? 7 : 6, shake: c.ok ? null : c.j, narr: `${seq(T[st.s + c.j])} against ${seq(P[c.j])}: ${c.ok ? (last && st.match ? `the same – all ${m} match: <b>found at ${st.s}</b>` : 'the same') : '<b>mismatch</b>'}.`, dwell: 0.6 });
        });
        const i = st.i;
        const why = st.match ? `The whole pattern matched (i = ${m}); π[${m}] = ${st.pi}, so it jumps ${m} − ${st.pi} = <b>${st.shift}</b>` : i === 0 ? `No letter matched (i = 0); π[0] = −1, so the jump is 0 − (−1) = <b>1</b>` : `${i} letter${i > 1 ? 's' : ''} matched (i = ${i}); π[${i}] = ${st.pi}, so it jumps ${i} − ${st.pi} = <b>${st.shift}</b>`;
        if (st.s + st.shift + m > T.length) {
          F({ phase: 'search', s: st.s, comps: st.comps, known, line: 8, narr: `${why} – past the end of the text. Done.` });
          return;
        }
        if (mode === 'practice' && asked < 5) {
          asked++;
          F({ phase: 'search', s: st.s, comps: st.comps, known, line: 8, narr: st.match ? `Found at ${st.s}. How far may the pattern jump now?` : `A mismatch after ${i} matched letter${i === 1 ? '' : 's'}.`, ask: { type: 'number', answer: st.shift, prompt: `How many places does the pattern jump? (i − π[i], with i = ${i})`, hint: `π[${i}] = ${String(st.pi).replace('-', '−')} (see the table).`, explain: why + '.' } });
        }
        F({ phase: 'search', s: st.s, comps: st.comps, known, line: 8, narr: why + (st.keep ? `, keeping its first ${st.keep} letter${st.keep > 1 ? 's' : ''} lined up with the text.` : '.'), label: `+${st.shift}`, dwell: 1.2 });
      });
      F({ phase: 'search', s: r.steps.length ? r.steps[r.steps.length - 1].s : 0, comps: [], done: true, line: null, narr: `Done: ${hits.length ? `found at <b>${hits.join(', ')}</b>` : 'not found'}. ${comparisons} comparisons (the naive search makes ${A.naiveSearch(T, P).comparisons}). KMP never compares a letter of the text twice after a match: its time grows with n + m.` });
      return { frames, data: { T, P, pi: tb.pi, part } };
    },
    view(stage, data) {
      const sl = slider(stage, data.T, data.P);
      const m = data.P.length;
      // the table: i, P[i-1], pi[i]
      const tbl = h('table.pi-t');
      const rowI = h('tr', h('th', 'i'), A.range(m + 1).map((i) => h('td', String(i))));
      const rowP = h('tr', h('th', 'P'), A.range(m + 1).map((i) => h('td', i === 0 ? '' : h('span', { class: V.tileClass(data.P[i - 1]) }, data.P[i - 1]))));
      const rowV = h('tr.v', h('th', 'π[i]'), A.range(m + 1).map((i) => h('td', { 'data-i': String(i) }, sgn(data.pi[i]))));
      tbl.appendChild(h('tbody', rowI, rowP, rowV));
      sl.extra.appendChild(h('div.sl-table', h('div.viz-label', 'Failure table π'), tbl));
      return {
        update(f, prev, ctx) {
          const search = f.phase === 'search';
          sl.wrap.classList.toggle('tablephase', !search);
          sl.at(search ? f.s : 0, ctx);
          // the table phase: the prefix looked at, and its border
          if (!search) {
            sl.marks(0, [], -1, []);
            sl.patTiles.forEach((t, j) => {
              t.classList.toggle('dim', !!f.focus && j >= f.focus);
              t.classList.toggle('border', !!f.focus && f.border > 0 && (j < f.border || (j >= f.focus - f.border && j < f.focus)));
            });
          } else {
            sl.patTiles.forEach((t) => t.classList.remove('dim', 'border'));
            sl.marks(f.s, f.comps, f.cur, f.known);
          }
          rowV.querySelectorAll('td').forEach((td, i) => {
            td.classList.toggle('hid', i > f.piShown || (ctx.asking && i === f.focus));
            td.classList.toggle('on', !search && f.focus === i && !ctx.asking);
            td.classList.toggle('use', search && !!f.label && i === (f.comps.filter((c) => c.ok).length + (f.known || []).length));
          });
          sl.found(f.hits);
          sl.setCounts(search ? countsHtml(f) : '<span>Making the table from the pattern</span>');
          sl.shiftLabel(f.label ? 'jump ' + f.label : '');
          if (f.shake != null && !ctx.back) sl.shake(f.shake, ctx);
        }
      };
    }
  });

  /* ==================================================================
     Boyer–Moore
     ================================================================== */
  V.define('bm', {
    title: 'Boyer–Moore',
    sub: 'Compare from the right; two rules say how far to jump',
    inputs: [Object.assign({}, TEXT, { default: 'ATTATATACTATA' }), Object.assign({}, PAT, { default: 'TATAC' }), { key: 'rules', label: 'Rules', type: 'select', options: [['both', 'bad character and good suffix'], ['bad', 'bad character only'], ['good', 'good suffix only']], default: 'both' }],
    presets: {
      notin: { label: 'Bad character not in the pattern: TATAC in ATTAGATACTATA', input: { text: 'ATTAGATACTATA', pattern: 'TATAC', rules: 'both' } },
      tatac: { label: 'Bad character in the pattern: TATAC in ATTATATACTATA', input: { text: 'ATTATATACTATA', pattern: 'TATAC', rules: 'both' } },
      suffix1: { label: 'Good suffix found again: CATAT in ATAATATACTA', input: { text: 'ATAATATACTA', pattern: 'CATAT', rules: 'both' } },
      suffix2: { label: 'Good suffix, only a prefix fits: ATTAT in AATATATACTA', input: { text: 'AATATATACTA', pattern: 'ATTAT', rules: 'both' } },
      read: { label: 'A longer text: GATTACA in AGCTTGATCGATTACAGGATTACA', input: { text: 'AGCTTGATCGATTACAGGATTACA', pattern: 'GATTACA', rules: 'both' } }
    },
    practice: true,
    check: checkLen,
    code: [
      's = 0',
      'while s <= n - m:',
      '    j = m - 1',
      '    while j >= 0 and P[j] == T[s+j]: j -= 1   # right to left',
      '    if j < 0: report(s); s += goodsuffix[0]',
      '    else: s += max(badchar(T[s+j], j),        # line up that letter',
      '                   goodsuffix[j+1])           # line up the matched suffix'
    ],
    build(input, mode) {
      const T = input.text, P = input.pattern, m = P.length;
      const rules = input.rules || 'both';
      const r = A.bmSearch(T, P, { badChar: rules !== 'good', goodSuffix: rules !== 'bad' });
      const tb = r.tables;
      const frames = [];
      let comparisons = 0, shifts = 1; // shifts: the places of the pattern tried so far
      const hits = [];
      const F = (o) => frames.push(Object.assign({ comparisons, shifts, hits: hits.slice(), s: 0, comps: [] }, o));
      F({ line: 0, narr: `Boyer–Moore compares the pattern ${seq(P)} with the text from its <b>right</b> end. At a mismatch, two rules each propose a jump, and it takes the larger: the <b>bad-character</b> rule (move the pattern until a matching letter is under the mismatched one) and the <b>good-suffix</b> rule (move it until the part already matched lines up again). Both come from tables made from the pattern first.` });
      let asked = 0;
      r.steps.forEach((st, k) => {
        if (k > 0) {
          shifts++;
          F({ s: st.s, comps: [], line: 2, narr: `Shift ${st.s}: compare from the right end again.`, dwell: 0.7 });
        }
        st.comps.forEach((c, ci) => {
          comparisons++;
          const last = ci === st.comps.length - 1;
          if (last && st.match) hits.push(st.s);
          F({ s: st.s, comps: st.comps.slice(0, ci + 1), cur: ci, line: last && st.match ? 4 : 3, shake: c.ok ? null : c.j, narr: `${seq(T[st.s + c.j])} against ${seq(P[c.j])}: ${c.ok ? (last && st.match ? `the same – all ${m} letters match: <b>found at ${st.s}</b>` : 'the same') : '<b>mismatch</b>'}.`, dwell: 0.6 });
        });
        let narr;
        const sufLen = m - 1 - st.j;
        const bcTxt = st.bc == null ? '' : (() => {
          const k2 = A.range(st.j).reverse().find((x) => P[x] === st.c);
          return k2 != null ? `bad character ${seq(st.c)}: the right-most ${seq(st.c)} of the pattern left of the mismatch is ${st.j - k2} place${st.j - k2 > 1 ? 's' : ''} back, so <b>${st.bc}</b>` : `bad character ${seq(st.c)}: there is no ${seq(st.c)} in the pattern left of the mismatch, so the pattern can pass it: <b>${st.bc}</b>`;
        })();
        // why the good-suffix table says what it says (checked against the table; otherwise just the number)
        const gsWhy = (() => {
          if (st.match || sufLen === 0) return '';
          const u = P.slice(st.j + 1);
          for (let k = st.j; k >= 0; k--) {
            if (P.slice(k, k + u.length) === u && k + u.length < m && (k === 0 || P[k - 1] !== P[st.j]) && st.j + 1 - k === st.gs) return ` (${seq(u)} occurs again at ${k}${k > 0 ? `, after ${seq(P[k - 1])}, not ${seq(P[st.j])}` : ''}: move it under the matched letters)`;
          }
          for (let l = u.length - 1; l > 0; l--) if (P.startsWith(u.slice(u.length - l)) && m - l === st.gs) return ` (${seq(u)} does not occur again, but its end ${seq(u.slice(u.length - l))} is how the pattern starts: move that start under it)`;
          return m === st.gs ? ` (no part of ${seq(u)} starts the pattern: move past it)` : '';
        })();
        const gsTxt = st.match ? `after a whole match the good-suffix table says <b>${st.gs}</b>` : sufLen === 0 ? `good suffix: nothing matched yet, so <b>${st.gs}</b>` : `good suffix ${seq(P.slice(st.j + 1))}: the table says <b>${st.gs}</b>${gsWhy}`;
        if (st.match) narr = `Found at ${st.s}. To look for more: ${gsTxt}.`;
        else if (rules === 'bad') narr = `Only the bad-character rule: ${bcTxt}.`;
        else if (rules === 'good') narr = `Only the good-suffix rule: ${gsTxt}.`;
        else narr = `Two proposals – ${bcTxt}; ${gsTxt}. The larger wins: jump <b>${st.shift}</b>.`;
        if (st.s + st.shift + m > T.length) {
          F({ s: st.s, comps: st.comps, line: st.match ? 4 : [5, 6], why: st.why, j: st.j, narr: narr.replace(/\.$/, '') + ' – past the end of the text. Done.' });
          return;
        }
        if (mode === 'practice' && !st.match && asked < 5) {
          asked++;
          const fields = [];
          if (rules !== 'good') fields.push({ label: 'bad character', answer: st.bc });
          if (rules !== 'bad') fields.push({ label: 'good suffix', answer: st.gs });
          F({ s: st.s, comps: st.comps, line: [5, 6], j: st.j, narr: `A mismatch: ${seq(st.c)} in the text against ${seq(P[st.j])} in the pattern${sufLen ? `, after ${seq(P.slice(st.j + 1))} matched` : ''}.`, ask: { type: 'fields', fields, prompt: 'How far does each rule move the pattern? (Use the tables.)', hint: `Bad character: row ${esc(st.c)}, column ${st.j} of its table. Good suffix: entry ${st.j + 1} of its table.`, explain: narr } });
        }
        F({ s: st.s, comps: st.comps, line: st.match ? 4 : [5, 6], why: st.why, j: st.j, narr, label: `+${st.shift}`, dwell: 1.4 });
      });
      F({ s: r.steps.length ? r.steps[r.steps.length - 1].s : 0, comps: [], done: true, line: null, narr: `Done: ${hits.length ? `found at <b>${hits.join(', ')}</b>` : 'not found'}. ${comparisons} comparisons and ${r.steps.length} alignments, where the naive search makes ${A.naiveSearch(T, P).comparisons} comparisons at ${Math.max(0, T.length - m + 1)} alignments. The longer the pattern, the longer the jumps.` });
      return { frames, data: { T, P, tb, rules } };
    },
    view(stage, data) {
      const sl = slider(stage, data.T, data.P);
      const m = data.P.length;
      const letters = Object.keys(data.tb.bad).sort(A.cmp);
      // bad character table
      const bt = h('table.pi-t.bc-t');
      bt.appendChild(h('thead', h('tr', h('th', ''), A.range(m).map((j) => h('th', h('span.colj', String(j)), h('span', { class: V.tileClass(data.P[j]) }, data.P[j]))))));
      const btb = h('tbody');
      letters.forEach((c) => btb.appendChild(h('tr', h('th', h('span', { class: V.tileClass(c) }, c)), A.range(m).map((j) => h('td', { 'data-c': c, 'data-j': String(j) }, data.tb.bad[c][j] == null ? '–' : String(data.tb.bad[c][j]))))));
      bt.appendChild(btb);
      // good suffix shifts
      const gt = h('table.pi-t.gs-t');
      gt.appendChild(h('tbody',
        h('tr', h('th', 'i'), A.range(m + 1).map((i) => h('td', String(i)))),
        h('tr', h('th', 'suffix'), A.range(m + 1).map((i) => h('td.suf', i === m ? 'ε' : data.P.slice(i)))),
        h('tr.v', h('th', 'shift'), A.range(m + 1).map((i) => h('td', { 'data-i': String(i) }, String(data.tb.s[i]))))));
      const showBad = data.rules !== 'good', showGood = data.rules !== 'bad';
      sl.extra.appendChild(h('div.sl-tables',
        showBad ? h('div.sl-table', h('div.viz-label', 'Bad character: jump for a mismatch at position j against letter c'), bt) : null,
        showGood ? h('div.sl-table', h('div.viz-label', 'Good suffix: jump when P[i:] has matched (i = 0: after a whole match)'), gt) : null));
      return {
        update(f, prev, ctx) {
          sl.at(f.s, ctx);
          sl.marks(f.s, f.comps, f.cur);
          sl.found(f.hits);
          sl.setCounts(countsHtml(f));
          sl.shiftLabel(f.label ? 'jump ' + f.label : '');
          if (f.shake != null && !ctx.back) sl.shake(f.shake, ctx);
          const deciding = f.j != null && (f.label || ctx.asking);
          const mis = f.j != null && f.j >= 0;
          bt.querySelectorAll('td').forEach((td) => td.classList.toggle('use', !!(deciding && mis && !ctx.asking && td.dataset.c === data.T[f.s + f.j] && +td.dataset.j === f.j)));
          bt.querySelectorAll('td').forEach((td) => td.classList.toggle('win', !!(deciding && mis && !ctx.asking && (f.why === 'bad' || f.why === 'both') && td.dataset.c === data.T[f.s + f.j] && +td.dataset.j === f.j)));
          gt.querySelectorAll('tr.v td').forEach((td) => {
            const i = +td.dataset.i;
            const target = f.j != null ? f.j + 1 : -1;
            td.classList.toggle('use', !!(deciding && !ctx.asking && i === target));
            td.classList.toggle('win', !!(deciding && !ctx.asking && i === target && (f.why === 'good' || f.why === 'both' || f.why === 'match')));
          });
        }
      };
    }
  });

  /* ==================================================================
     Rabin–Karp
     ================================================================== */
  V.define('rk', {
    title: 'Rabin–Karp',
    sub: 'Compare numbers (hashes) instead of letters; a rolling hash updates in one step',
    inputs: [
      { key: 'text', label: 'Text: A C G T, or digits', type: 'seq', letters: 'ACGT0123456789', min: 2, max: 24, default: '512849998013452' },
      { key: 'pattern', label: 'Pattern', type: 'seq', letters: 'ACGT0123456789', min: 1, max: 6, default: '1284' },
      { key: 'q', label: 'Divide by (mod)', type: 'select', options: [['7', '7'], ['11', '11'], ['13', '13'], ['97', '97'], ['101', '101']], default: '97', help: 'The hash is the remainder after dividing by this number. Small numbers give more false alarms.' }
    ],
    presets: {
      phone: { label: 'Digits: 1284 in 512849998013452', input: { text: '512849998013452', pattern: '1284', q: '97' } },
      dna: { label: 'DNA: TAC in GATTACAGATTAC (mod 7: false alarms)', input: { text: 'GATTACAGATTAC', pattern: 'TAC', q: '7' } },
      dna13: { label: 'DNA: TAC in GATTACAGATTAC (mod 13)', input: { text: 'GATTACAGATTAC', pattern: 'TAC', q: '13' } }
    },
    practice: true,
    check(input) {
      const dig = /^[0-9]+$/, dna = /^[ACGT]+$/;
      if (!((dig.test(input.text) && dig.test(input.pattern)) || (dna.test(input.text) && dna.test(input.pattern)))) return 'Use either digits or the letters A C G T – in both the text and the pattern.';
      return checkLen(input);
    },
    code: [
      'B = 10 for digits, 4 for DNA (A=0 C=1 G=2 T=3)',
      'hp = number(P) mod q; h = number(T[0:m]) mod q',
      'for s in 0 .. n-m:',
      '    if s > 0: h = ((h - T[s-1] * B**(m-1)) * B + T[s+m-1]) mod q   # roll',
      '    if h == hp:                     # the same number: maybe a match',
      '        compare the letters         # different letters: a false alarm'
    ],
    build(input, mode) {
      const T = input.text, P = input.pattern, m = P.length;
      const dig = /^[0-9]+$/.test(P);
      const B = dig ? 10 : 4, q = +input.q;
      const r = A.rabinKarp(T, P, B, q);
      const frames = [];
      let comparisons = 0, shifts = 1; // shifts: the places of the pattern tried so far
      const hits = [];
      const hashes = [];
      const F = (o) => frames.push(Object.assign({ comparisons, shifts, hits: hits.slice(), hashes: hashes.slice(), s: 0, comps: [] }, o));
      const val = (str) => str.split('').reduce((a, c) => a * B + A.rkCode(c), 0);
      F({ line: [0, 1], narr: dig ? `Read the pattern ${seq(P)} as a number, ${val(P)}, and keep only its remainder after dividing by ${q}: hash = ${val(P)} mod ${q} = <b>${r.hp}</b>. Each window of ${m} digits of the text gets the same treatment, and only windows with the same hash are compared letter by letter.` : `Turn letters into digits, A = 0, C = 1, G = 2, T = 3, and read the pattern ${seq(P)} as a number in base 4: ${P.split('').map((c, k) => `${A.rkCode(c)}×4<sup>${m - 1 - k}</sup>`).join(' + ')} = ${val(P)}. Its hash is ${val(P)} mod ${q} = <b>${r.hp}</b>.` });
      let asked = 0;
      r.steps.forEach((st, k) => {
        const w = T.slice(st.s, st.s + m);
        if (k === 0) {
          hashes.push(st.h);
          F({ s: 0, line: 1, narr: `The first window, ${seq(w)}${/^[0-9]+$/.test(w) ? '' : ` = ${val(w)}`}: hash ${val(w)} mod ${q} = <b>${st.h}</b>${st.same ? ' – the same as the pattern’s' : `, not ${r.hp}`}.`, cmp: st.same ? 'same' : 'diff' });
        } else {
          shifts++;
          const prevVal = r.steps[k - 1].value;
          const out = A.rkCode(T[st.s - 1]), inn = A.rkCode(T[st.s + m - 1]);
          const calc = `(${prevVal} − ${out}×${B}<sup>${m - 1}</sup>) × ${B} + ${inn} = ${st.value}, and ${st.value} mod ${q} = <b>${st.h}</b>`;
          if (mode === 'practice' && asked < 4) {
            asked++;
            F({ s: st.s, line: 3, narr: `Slide one place: ${seq(T[st.s - 1])} leaves the window, ${seq(T[st.s + m - 1])} joins it. The window is now ${seq(w)}.`, ask: { type: 'number', answer: st.h, prompt: `What is the hash of the new window? Roll the number on – (${prevVal} − ${out}×${B}<sup>${m - 1}</sup>) × ${B} + ${inn} – then take the remainder after dividing by ${q}.`, hint: `The window’s number is ${st.value}. ${st.value} divided by ${q}: what is left over?`, explain: `${st.value} mod ${q} = ${st.h}.` } });
          }
          hashes.push(st.h);
          F({ s: st.s, line: 3, narr: `Roll on to ${seq(w)}: take away the ${dig ? 'digit' : 'letter'} that left, multiply by ${B}, add the one that joined – ${calc}. ${st.same ? `The same as the pattern’s hash ${r.hp}: check the letters.` : `Not ${r.hp}: skip – no letters compared.`}`, cmp: st.same ? 'same' : 'diff', dwell: 1.1 });
        }
        if (st.same) {
          st.comps.forEach((c, ci) => {
            comparisons++;
            const last = ci === st.comps.length - 1;
            if (last && st.match) hits.push(st.s);
            F({ s: st.s, comps: st.comps.slice(0, ci + 1), cur: ci, line: 5, cmp: 'same', shake: c.ok ? null : c.j, narr: `${seq(T[st.s + c.j])} against ${seq(P[c.j])}: ${c.ok ? (last && st.match ? `the same – <b>a real match at ${st.s}</b>` : 'the same') : '<b>different</b> – the hashes were equal by chance: a <b>false alarm</b> (spurious hit)'}.`, dwell: 0.6 });
          });
        }
      });
      F({ s: r.steps.length ? r.steps[r.steps.length - 1].s : 0, done: true, line: null, narr: `Done: ${hits.length ? `found at <b>${hits.join(', ')}</b>` : 'not found'}. Only ${comparisons} letter comparisons${r.spurious ? `, ${r.spurious} false alarm${r.spurious > 1 ? 's' : ''}` : ''}: every window cost one small calculation. Several patterns can be looked for at once – compare each window’s hash with all their hashes.` });
      return { frames, data: { T, P, r, B, q } };
    },
    view(stage, data) {
      const sl = slider(stage, data.T, data.P);
      const n = data.T.length, m = data.P.length;
      // a row of hashes under the text: one per window, under its first letter
      const hrow = h('div.tiles.rk-hashes', A.range(n).map((i) => h('span.tile.hv', { 'data-i': String(i) }, '')));
      sl.wrap.querySelector('.sl-area').appendChild(h('div.sl-row', h('span.viz-label', 'Hash'), hrow));
      const pbox = h('div.rk-p', h('span.viz-label', 'Pattern hash'), h('span.rk-hp', String(data.r.hp)), h('span.rk-mod', `mod ${data.q}`));
      sl.extra.appendChild(pbox);
      return {
        update(f, prev, ctx) {
          sl.at(f.s, ctx);
          sl.marks(f.s, f.comps, f.cur);
          sl.found(f.hits);
          sl.setCounts(countsHtml(f));
          sl.shiftLabel('');
          hrow.querySelectorAll('.hv').forEach((t, i) => {
            const has = i < f.hashes.length && i <= n - m;
            t.textContent = has ? String(f.hashes[i]) : '';
            t.classList.toggle('on', has);
            t.classList.toggle('cur', has && i === f.s && !ctx.asking);
            t.classList.toggle('same', has && f.hashes[i] === data.r.hp);
            if (ctx.asking && i === f.s) {
              t.textContent = '?';
              t.classList.add('on');
            }
          });
          pbox.classList.toggle('same', f.cmp === 'same');
          if (f.shake != null && !ctx.back) sl.shake(f.shake, ctx);
        }
      };
    }
  });
  function sup(k) {
    return `<sup>${k}</sup>`;
  }
})();
