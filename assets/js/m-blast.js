/* =====================================================================
   Database search: BLAST's neighbourhood words, its scan, the two-hit
   rule and the X-drop extension, its statistics – and how a substitution
   table such as BLOSUM is made from blocks of aligned proteins.
   ===================================================================== */
(function () {
  'use strict';
  const MG = window.MG;
  const { h, esc } = MG;
  const V = MG.viz;
  const A = MG.algo;
  const seq = V.seq;
  const AA = 'ARNDCQEGHILKMFPSTWYV';
  const sg = (v) => (v < 0 ? '−' + -v : String(v));
  const ptile = (c, cls) => `<span class="${V.tileClass(c, true)}${cls ? ' ' + cls : ''}">${esc(c)}</span>`;
  const T_OPTS = [['10', '10'], ['11', '11 (blastp’s default)'], ['12', '12'], ['13', '13'], ['14', '14'], ['15', '15']];

  /* ==================================================================
     The neighbourhood of a word
     ================================================================== */
  V.define('words', {
    title: 'The neighbourhood of a word',
    sub: 'All the words that score at least T against it (BLOSUM62)',
    inputs: [
      { key: 'word', label: 'A word of 3 amino acids', type: 'seq', letters: AA, min: 3, max: 3, default: 'PQG' },
      { key: 'T', label: 'Threshold T', type: 'select', options: T_OPTS, default: '13' }
    ],
    presets: {
      pqg: { label: 'PQG, T = 13', input: { word: 'PQG', T: '13' } },
      pqg11: { label: 'PQG, T = 11', input: { word: 'PQG', T: '11' } },
      ail: { label: 'AIL, T = 13: not even itself', input: { word: 'AIL', T: '13' } },
      wcw: { label: 'WCH, T = 13: rare residues', input: { word: 'WCH', T: '13' } }
    },
    practice: true,
    code: [
      'for x in all 20 × 20 × 20 words:',
      '    score = s(w[0], x[0]) + s(w[1], x[1]) + s(w[2], x[2])   # BLOSUM62',
      '    if score >= T: neighbours.append(x)'
    ],
    build(input, mode) {
      const w = input.word, T = +input.T;
      const nb = A.neighbourhood(w, T);
      const near = A.nearMisses(w, T, 4);
      const self = A.wordScore(w, w);
      const all = A.neighbourhood(w, -99).length;
      const frames = [];
      const parts = (x) => x.split('').map((c, k) => `${esc(w[k])}–${esc(c)} ${sg(A.blosum62(w[k], c))}`).join(', ');
      const F = (o) => frames.push(Object.assign({ shown: 0, near: false }, o));
      F({ line: null, narr: `There are 20 × 20 × 20 = ${all} words of three amino acids. BLAST keeps those that score at least <b>T = ${T}</b> against ${seq(w)}, adding up BLOSUM62 scores letter by letter. ${seq(w)} against itself scores ${self}${self < T ? ' – <b>below</b> the threshold: not even the word itself is kept, so BLAST cannot find this part of the query from this word' : ''}.` });
      let asked = 0;
      nb.forEach((x, k) => {
        if (mode === 'practice' && asked < 3 && k > 0) {
          asked++;
          F({ shown: k, cur: k, hide: true, line: 1, narr: `Next candidate: ${seq(x.w)}.`, ask: { type: 'number', answer: x.s, prompt: `What does ${seq(x.w)} score against ${seq(w)}? (Look the pairs up in the Score tables tab.)`, hint: `${parts(x.w).replace(/ [−\d]+(,|$)/g, ' ?$1')}`, explain: `${parts(x.w)}: ${x.s}.` } });
        }
        F({ shown: k + 1, cur: k, line: [1, 2], narr: `${seq(x.w)}: ${parts(x.w)} = <b>${x.s}</b> ≥ ${T}: a neighbour.`, dwell: nb.length > 12 ? 0.4 : 0.7 });
      });
      F({ shown: nb.length, near: true, line: 2, narr: near.length ? `Just below the line: ${near.map((x) => `${seq(x.w)} ${x.s}`).join(', ')} – left out.` : 'Nothing comes close below the line.' });
      F({ shown: nb.length, near: true, line: null, narr: `<b>${nb.length}</b> neighbour${nb.length === 1 ? '' : 's'} of ${seq(w)} at T = ${T}. A lower T keeps more words: more hits, more sensitive, slower. Every word of the query gets its neighbourhood, and all of them go into one lookup table.` });
      return { frames, data: { w, T, nb, near } };
    },
    view(stage, data) {
      const head = h('div.nb-head', h('span.viz-label', 'Word'), h('span.tiles', data.w.split('').map((c) => h('span', { class: V.tileClass(c, true) }, c))), h('span.nb-t', `T = ${data.T}`));
      const list = h('div.nb-list');
      const rows = data.nb.map((x) => {
        const r = h('div.nb-row', h('span.tiles.mini', x.w.split('').map((c, k) => h('span', { class: V.tileClass(c, true) + (c === data.w[k] ? ' same' : '') }, c))), h('span.nb-bar', h('i', { style: { width: Math.max(4, (x.s / 20) * 100) + '%' } })), h('span.nb-s', String(x.s)));
        list.appendChild(r);
        return r;
      });
      const line = h('div.nb-line', `threshold T = ${data.T}`);
      list.appendChild(line);
      const nearRows = data.near.map((x) => {
        const r = h('div.nb-row.near', h('span.tiles.mini', x.w.split('').map((c) => h('span', { class: V.tileClass(c, true) }, c))), h('span.nb-bar', h('i', { style: { width: Math.max(4, (x.s / 20) * 100) + '%' } })), h('span.nb-s', String(x.s)));
        list.appendChild(r);
        return r;
      });
      const count = h('div.nb-count');
      stage.appendChild(head);
      stage.appendChild(count);
      stage.appendChild(list);
      return {
        update(f, prev, ctx) {
          rows.forEach((r, k) => {
            r.hidden = k >= f.shown && !(ctx.asking && k === f.cur);
            r.classList.toggle('cur', k === f.cur);
            r.classList.toggle('hide', !!(ctx.asking && k === f.cur));
          });
          line.hidden = !f.near && f.shown < data.nb.length;
          nearRows.forEach((r) => (r.hidden = !f.near));
          count.textContent = `${f.shown} of ${data.nb.length} neighbours`;
          const cur = rows[f.cur];
          if (cur && !ctx.instant) cur.scrollIntoView({ block: 'nearest' });
        }
      };
    }
  });

  /* ==================================================================
     BLAST: scan, two hits, extend, score
     ================================================================== */
  V.define('blast', {
    title: 'BLAST, step by step',
    sub: 'Words, hits, extension, E-value',
    inputs: [
      { key: 'q', label: 'Query (protein)', type: 'seq', letters: AA, min: 6, max: 20, default: 'AALLNKCKTPQGQRLVNQ' },
      { key: 's', label: 'Database sequence (protein)', type: 'seq', letters: AA, min: 6, max: 34, default: 'GHMKEWLDKCRSPEGQKIVNSYTDAHPQGF' },
      { key: 'T', label: 'Word threshold T', type: 'select', options: T_OPTS, default: '13' },
      { key: 'rule', label: 'Start an extension from', type: 'select', options: [['two', 'two hits on one diagonal, at most 40 apart'], ['one', 'every single hit']], default: 'two' },
      { key: 'X', label: 'X-drop', type: 'select', options: [['5', '5'], ['10', '10'], ['15', '15'], ['20', '20']], default: '15', help: 'The extension stops when the score falls this far below the best so far.' }
    ],
    presets: {
      main: { label: 'A query against a related protein', input: { q: 'AALLNKCKTPQGQRLVNQ', s: 'GHMKEWLDKCRSPEGQKIVNSYTDAHPQGF', T: '13', rule: 'two', X: '15' } },
      one: { label: 'The same, extending every single hit', input: { q: 'AALLNKCKTPQGQRLVNQ', s: 'GHMKEWLDKCRSPEGQKIVNSYTDAHPQGF', T: '13', rule: 'one', X: '15' } },
      unrelated: { label: 'Against an unrelated protein', input: { q: 'AALLNKCKTPQGQRLVNQ', s: 'MSEYTIDGFHRAWVLPNDISQTAMGEYKH', T: '13', rule: 'two', X: '15' } }
    },
    practice: true,
    code: [
      'table = {neighbour word: [query positions]}   # the words of the query and their neighbourhoods',
      'for j in range(len(s) - 2):                  # scan the database once',
      '    for i in table.get(s[j:j+3], []): hit(i, j)',
      'two hits on one diagonal (j - i), ≤ 40 apart → extend',
      'extend right, then left, while best - score ≤ X   # X-drop',
      'HSP: the best segment; E = K m n e^(-λS)'
    ],
    build(input, mode) {
      const q = input.q, s = input.s, T = +input.T, X = +input.X;
      const hits = A.blastHits(q, s, T, 3);
      const trig = input.rule === 'two' ? A.twoHits(hits, 40, 3) : hits.slice().sort((a, b) => a.j - b.j || a.i - b.i);
      const frames = [];
      const F = (o) => frames.push(Object.assign({ hits: [], win: null, ext: null, hsps: [], trig: [], phase: 'words' }, o));
      const sizes = A.range(q.length - 2).map((i) => A.neighbourhood(q.slice(i, i + 3), T).length);
      F({ line: null, narr: `The query ${seq(q)} (${q.length} amino acids) against one database sequence (${s.length}). BLAST does not fill a dynamic-programming matrix for every pair: it first looks for short words the two share – or nearly share.` });
      F({ phase: 'words', sizes, line: 0, narr: `Every word of three letters of the query, and every word that scores at least ${T} against it (its neighbourhood), goes into a lookup table with the position in the query. Here the ${q.length - 2} query words have ${sizes.reduce((a, b) => a + b, 0)} neighbours in all; some have none – their self-score is below ${T}.` });
      // the scan
      const found = [];
      let asked = 0;
      for (let j = 0; j + 3 <= s.length; j++) {
        const here = hits.filter((x) => x.j === j);
        const sw = s.slice(j, j + 3);
        if (mode === 'practice' && asked < 3 && (here.length || j % 7 === 3)) {
          asked++;
          F({ phase: 'scan', hits: found.slice(), win: j, line: [1, 2], narr: `Database word at ${j}: ${seq(sw)}.`, ask: { type: 'choice', options: [['yes', 'A hit'], ['no', 'No hit']], answer: here.length ? 'yes' : 'no', prompt: `Is ${seq(sw)} in the table – does it score at least ${T} against some word of the query?`, hint: 'Look for a query word with the same or similar letters, and add up the three BLOSUM62 scores.', explain: here.length ? `Yes: ${here.map((x) => `${seq(q.slice(x.i, x.i + 3))} at ${x.i} (${x.s})`).join(', ')}.` : 'No query word scores that high against it.' } });
        }
        here.forEach((x) => found.push(x));
        F({ phase: 'scan', hits: found.slice(), win: j, newHits: here, line: [1, 2], narr: here.length ? `${seq(sw)} at ${j}: a hit with ${here.map((x) => `${seq(q.slice(x.i, x.i + 3))} (query ${x.i}, score ${x.s})`).join(' and ')}.` : `${seq(sw)} at ${j}: not in the table.`, dwell: here.length ? 1 : 0.4 });
      }
      F({ phase: 'scan', hits: found.slice(), line: 3, narr: found.length ? `${found.length} hit${found.length === 1 ? '' : 's'}. Each lies on a diagonal (database position − query position): hits that belong to one alignment share a diagonal.` : 'No hits: none of the words of the database is in the table.' });
      // which hits start an extension
      const covered = [];
      const used = [];
      trig.forEach((t) => {
        if (covered.some((c) => c.d === t.d && t.i >= c.q0 && t.i + 3 <= c.q0 + c.len)) return;
        used.push(t);
        const x = A.xdrop(q, s, t.i, t.j, 3, X);
        covered.push({ d: t.d, q0: x.q0, len: x.len, x, t });
      });
      const pairs = input.rule === 'two' ? used.concat(used.map((t) => t.partner).filter(Boolean)) : used;
      if (input.rule === 'two') F({ phase: 'two', hits: found.slice(), trig: pairs, line: 3, narr: used.length ? `The two-hit rule: only a hit with a second hit on the same diagonal, within 40 letters, is worth extending – ${used.length === 1 ? 'here one pair' : `here ${used.length} pairs`}. A lone hit (grey) is skipped: most random hits are lone. This saves most of the work.` : 'The two-hit rule: no diagonal has two hits close together, so nothing is extended – BLAST moves on to the next sequence of the database.' });
      // extensions
      const hsps = [];
      covered.forEach((cv, k) => {
        const x = cv.x, t = cv.t;
        F({ phase: 'ext', hits: found.slice(), trig: pairs, hsps: hsps.slice(), ext: { i: t.i, j: t.j, seed: x.seed, afterRight: x.afterRight, steps: [], dir: 'seed', run: x.seed, best: x.seed }, line: 4, narr: `Extend the hit ${seq(q.slice(t.i, t.i + 3))}/${seq(s.slice(t.j, t.j + 3))} (query ${t.i}, database ${t.j}): its score is ${x.seed}. Go right, adding one pair at a time, as long as the score stays within X = ${X} of the best so far.` });
        let a2 = 0;
        x.right.forEach((st, r) => {
          if (mode === 'practice' && a2 < 2 && k === 0) {
            a2++;
            F({ phase: 'ext', hits: found.slice(), trig: pairs, hsps: hsps.slice(), ext: { i: t.i, j: t.j, seed: x.seed, afterRight: x.afterRight, steps: x.right.slice(0, r), dir: 'right', run: r ? x.right[r - 1].run : x.seed, best: r ? x.right[r - 1].best : x.seed }, line: 4, narr: `Next pair: ${seq(q[st.qi])} and ${seq(s[st.sj])}.`, ask: { type: 'number', answer: st.run, prompt: `The score so far is ${r ? x.right[r - 1].run : x.seed}. What is it after adding ${esc(q[st.qi])}–${esc(s[st.sj])}?`, hint: `BLOSUM62 gives ${esc(q[st.qi])}–${esc(s[st.sj])} ${sg(st.sc)}.`, explain: `${r ? x.right[r - 1].run : x.seed} ${st.sc < 0 ? '−' : '+'} ${Math.abs(st.sc)} = ${st.run}.` } });
          }
          F({ phase: 'ext', hits: found.slice(), trig: pairs, hsps: hsps.slice(), ext: { i: t.i, j: t.j, seed: x.seed, afterRight: x.afterRight, steps: x.right.slice(0, r + 1), dir: 'right', run: st.run, best: st.best }, line: 4, narr: `${seq(q[st.qi])}–${seq(s[st.sj])} ${sg(st.sc)}: score ${st.run}, best ${st.best}${st.best - st.run > X ? ` – now more than ${X} below the best: <b>stop</b>` : ''}.`, dwell: 0.7 });
        });
        const lastR = x.right[x.right.length - 1];
        if (!lastR || lastR.best - lastR.run <= X) F({ phase: 'ext', hits: found.slice(), trig: pairs, hsps: hsps.slice(), ext: { i: t.i, j: t.j, seed: x.seed, afterRight: x.afterRight, steps: x.right, dir: 'right', run: x.afterRight, best: x.afterRight }, line: 4, narr: 'The end of a sequence: stop.' });
        const rightDone = x.right;
        x.left.forEach((st, l) => {
          F({ phase: 'ext', hits: found.slice(), trig: pairs, hsps: hsps.slice(), ext: { i: t.i, j: t.j, seed: x.seed, afterRight: x.afterRight, steps: rightDone, lsteps: x.left.slice(0, l + 1), dir: 'left', run: st.run, best: st.best }, line: 4, narr: `To the left: ${seq(q[st.qi])}–${seq(s[st.sj])} ${sg(st.sc)}: score ${st.run}, best ${st.best}${st.best - st.run > X ? ` – more than ${X} below the best: <b>stop</b>` : l === x.left.length - 1 && (st.qi === 0 || st.sj === 0) ? ` – the start of the ${st.qi === 0 ? 'query' : 'database sequence'}: <b>stop</b>` : ''}.`, dwell: 0.7 });
        });
        hsps.push({ q0: x.q0, s0: x.s0, len: x.len, score: x.score, qseg: x.qseg, sseg: x.sseg });
        const st1 = A.blastStats(x.score, q.length, s.length, 0.267, 0.041);
        F({ phase: 'hsp', hits: found.slice(), trig: pairs, hsps: hsps.slice(), line: 5, narr: `The best segment is a <b>high-scoring segment pair (HSP)</b>: ${seq(x.qseg)} against ${seq(x.sseg)}, score <b>${x.score}</b>, ${st1.bits.toFixed(1)} bits.`, hsp: hsps.length - 1, dwell: 1.6 });
      });
      if (hsps.length) {
        const best = hsps.reduce((a, b) => (b.score > a.score ? b : a));
        const e1 = A.blastStats(best.score, q.length, s.length, 0.267, 0.041);
        const e2 = A.blastStats(best.score, q.length, 1e9, 0.267, 0.041);
        const fmt = (E) => (E < 0.001 ? E.toExponential(1).replace('e', ' × 10^').replace(/\^(-?\d+)/, (m0, p) => `<sup>${p.replace('-', '−')}</sup>`) : E < 10 ? E.toFixed(3) : Math.round(E).toString());
        F({ phase: 'hsp', hits: found.slice(), trig: pairs, hsps: hsps.slice(), hsp: hsps.indexOf(best), line: 5, stats: { S: best.score, bits: e1.bits, e1: e1.E, e2: e2.E }, narr: `How surprising is a score of ${best.score}? The <b>E-value</b> is the number of hits this good expected by chance: E = K m n e<sup>−λS</sup>. (BLAST reports E-values for its final alignments, with gaps allowed: for BLOSUM62 with gaps of 11 + 1, λ = 0.267 and K = 0.041. This HSP needs no gaps, so its score stands.) Against this one sequence, E = ${fmt(e1.E)}; against a database of 10<sup>9</sup> letters, E = ${fmt(e2.E)} – the same alignment, but with a billion places to look, chance does this well ${e2.E > 1 ? 'many times over: <b>not significant</b>' : 'rarely'}. A longer query gives higher scores. (BLAST redoes the best HSPs as gapped alignments before it reports them.)`, dwell: 2.5 });
      } else F({ phase: 'two', hits: found.slice(), trig: pairs, line: null, narr: `No HSP: nothing in this sequence is worth an alignment. Most of a database looks like this – which is why BLAST is fast.` });
      return { frames, data: { q, s, T, X } };
    },
    view(stage, data) {
      const { q, s } = data;
      const m = q.length, n = s.length;
      // the grid leaves room on its right for the chart, the HSP and the statistics
      const sw = stage.clientWidth || 640;
      const W = sw - 60 - (sw > 700 ? 280 : 0), Hh = (stage.clientHeight || 520) - (sw > 700 ? 60 : 260);
      const size = Math.max(12, Math.min(26, Math.floor(W / (n + 1.5)), Math.floor(Hh / (m + 1.5))));
      stage.style.setProperty('--bc', size + 'px');
      const grid = h('div.bl-grid', { style: { gridTemplateColumns: `repeat(${n + 1}, var(--bc))`, gridTemplateRows: `repeat(${m + 1}, var(--bc))` } });
      grid.appendChild(h('span.bl-h'));
      const topH = s.split('').map((c) => {
        const e = h('span.bl-h', h('span', { class: V.tileClass(c, true) }, c));
        grid.appendChild(e);
        return e;
      });
      const cells = [];
      const sideH = [];
      q.split('').forEach((c, i) => {
        const e = h('span.bl-h.side', h('span', { class: V.tileClass(c, true) }, c));
        grid.appendChild(e);
        sideH.push(e);
        cells.push(s.split('').map(() => {
          const el = h('span.bl-c');
          grid.appendChild(el);
          return el;
        }));
      });
      const chart = h('div.bl-chart');
      const stats = h('div.bl-stats');
      const aln = h('div.bl-aln');
      stage.appendChild(h('div.bl', h('div.bl-left', grid), h('div.bl-right', chart, aln, stats)));
      const NS = 'http://www.w3.org/2000/svg';
      function drawChart(ext) {
        chart.innerHTML = '';
        if (!ext) return;
        // the running score: from the seed to the right, then (starting again from the best) to the left
        const series = [{ x: 0, y: ext.seed }];
        (ext.steps || []).forEach((st, k) => series.push({ x: k + 1, y: st.run }));
        if (ext.lsteps && ext.lsteps.length) {
          const base = series.length;
          series.push({ x: base, y: ext.afterRight, jump: true });
          ext.lsteps.forEach((st, k) => series.push({ x: base + k + 1, y: st.run }));
        }
        const ys = series.map((p) => p.y).concat([ext.best, ext.best - data.X]);
        const ymin = Math.min(...ys), ymax = Math.max(...ys);
        const Wc = 260, Hc = 120, padL = 8, padB = 10;
        const n = Math.max(10, series.length);
        const sx = (x) => padL + (x / n) * (Wc - padL - 64);
        const sy = (y) => Hc - padB - ((y - ymin) / (ymax - ymin || 1)) * (Hc - padB - 10);
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', `0 0 ${Wc} ${Hc}`);
        svg.setAttribute('class', 'bl-svg');
        const add = (tag, attrs, text) => {
          const el = document.createElementNS(NS, tag);
          Object.entries(attrs).forEach(([a, v]) => el.setAttribute(a, v));
          if (text) el.textContent = text;
          svg.appendChild(el);
          return el;
        };
        add('line', { x1: padL, y1: sy(ext.best), x2: Wc - 60, y2: sy(ext.best), class: 'best' });
        add('line', { x1: padL, y1: sy(ext.best - data.X), x2: Wc - 60, y2: sy(ext.best - data.X), class: 'drop' });
        add('text', { x: Wc - 56, y: sy(ext.best) + 4, class: 'lab' }, 'best ' + ext.best);
        add('text', { x: Wc - 56, y: sy(ext.best - data.X) + 4, class: 'lab drop' }, 'best − X');
        const right = series.filter((p, k) => !ext.lsteps || !ext.lsteps.length || k < series.findIndex((q) => q.jump));
        add('polyline', { points: right.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' '), class: 'run' });
        if (ext.lsteps && ext.lsteps.length) add('polyline', { points: series.slice(series.findIndex((q) => q.jump)).map((p) => `${sx(p.x)},${sy(p.y)}`).join(' '), class: 'run left' });
        const last = series[series.length - 1];
        add('circle', { cx: sx(last.x), cy: sy(last.y), r: 3.5, class: 'dot' });
        chart.appendChild(h('div.viz-label', ext.lsteps && ext.lsteps.length ? 'Running score: to the right, then to the left' : 'Running score of the extension'));
        chart.appendChild(svg);
      }
      return {
        update(f) {
          const hitCells = new Map();
          f.hits.forEach((x) => {
            for (let k = 0; k < 3; k++) hitCells.set(x.i + k + ',' + (x.j + k), x);
          });
          const trigSet = new Set((f.trig || []).map((x) => x.i + ',' + x.j));
          const extCells = new Set();
          if (f.ext) {
            for (let k = 0; k < 3; k++) extCells.add(f.ext.i + k + ',' + (f.ext.j + k));
            (f.ext.steps || []).forEach((st) => extCells.add(st.qi + ',' + st.sj));
            (f.ext.lsteps || []).forEach((st) => extCells.add(st.qi + ',' + st.sj));
          }
          const hspCells = new Set();
          (f.hsps || []).forEach((hp, k) => {
            if (f.hsp != null && k !== f.hsp && f.phase === 'hsp') return;
            for (let t = 0; t < hp.len; t++) hspCells.add(hp.q0 + t + ',' + (hp.s0 + t));
          });
          const newSet = new Set((f.newHits || []).map((x) => x.i + ',' + x.j));
          cells.forEach((row, i) => row.forEach((el, j) => {
            const key = i + ',' + j;
            const hx = hitCells.get(key);
            el.className = 'bl-c' + (hx ? ' hit' : '') + (hx && f.phase !== 'scan' && f.phase !== 'words' && !trigSet.has(hx.i + ',' + hx.j) && f.trig && f.trig.length ? ' lone' : '') + (hx && trigSet.has(hx.i + ',' + hx.j) ? ' trig' : '') + (hx && newSet.has(hx.i + ',' + hx.j) ? ' fresh' : '') + (extCells.has(key) ? ' ext' : '') + (hspCells.has(key) ? ' hsp' : '') + (f.win != null && j >= f.win && j < f.win + 3 ? ' col' : '');
          }));
          topH.forEach((e, j) => e.classList.toggle('hl', f.win != null && j >= f.win && j < f.win + 3));
          // the neighbourhood sizes, as small numbers beside the query
          sideH.forEach((e, i) => {
            e.dataset.n = f.sizes && i < f.sizes.length ? String(f.sizes[i]) : '';
          });
          drawChart(f.phase === 'ext' ? f.ext : null);
          aln.innerHTML = '';
          if (f.phase === 'hsp' && f.hsp != null) {
            const hp = f.hsps[f.hsp];
            const mid = hp.qseg.split('').map((c, k) => (c === hp.sseg[k] ? c : A.blosum62(c, hp.sseg[k]) > 0 ? '+' : ' ')).join('');
            aln.appendChild(h('div.viz-label', `HSP, score ${hp.score}`));
            aln.appendChild(h('div.bl-hsp', { html: `<div>Query ${String(hp.q0).padStart(2)} ${esc(hp.qseg)}</div><div>         ${esc(mid)}</div><div>Sbjct ${String(hp.s0).padStart(2)} ${esc(hp.sseg)}</div>` }));
          }
          stats.innerHTML = f.stats ? `<div class="viz-label">Statistics</div><div>raw score S = ${f.stats.S}, bit score ${f.stats.bits.toFixed(1)}</div><div>E (this sequence) = ${f.stats.e1.toExponential(1)}</div><div>E (10<sup>9</sup> letters) = ${f.stats.e2 < 10 ? f.stats.e2.toFixed(2) : Math.round(f.stats.e2)}</div>` : '';
        }
      };
    }
  });

  /* ==================================================================
     Making a substitution table from blocks (BLOSUM)
     ================================================================== */
  V.define('blosum', {
    title: 'Making a substitution table',
    sub: 'Count the pairs in blocks of aligned proteins; compare with chance; take the log',
    inputs: [{ key: 'block', label: 'A block of aligned sequences (one per line, no gaps)', type: 'text', max: 120, default: 'KIFIMK NLFKTR KIFKTK KLFESR KIFKGR', help: 'Separate the sequences with spaces: 3 to 8 sequences of equal length (at most 10 letters).' }],
    presets: { block: { label: 'Five sequences, six columns', input: { block: 'KIFIMK NLFKTR KIFKTK KLFESR KIFKGR' } } },
    practice: true,
    check(input) {
      const rows = String(input.block).toUpperCase().split(/[\s,]+/).filter(Boolean);
      if (rows.length < 3 || rows.length > 8) return 'Give 3 to 8 sequences.';
      if (rows.some((r) => r.length !== rows[0].length)) return 'The sequences must all have the same length (an ungapped block).';
      if (rows[0].length > 10) return 'At most 10 letters each.';
      if (rows.some((r) => /[^ARNDCQEGHILKMFPSTWYV]/.test(r))) return 'Amino-acid letters only.';
      return null;
    },
    code: [
      'for each column: for each pair of sequences: h[a][b] += 1   # a, b: the two residues',
      'T = number of pairs = columns × s(s - 1)/2',
      'f[a][b] = h[a][b] / T                                   # observed',
      'p[a] = (h[a][a] + sum of h[a][b] / 2) / T               # how common a is',
      'e[a][a] = p[a]², e[a][b] = 2 p[a] p[b]                  # expected by chance',
      'score[a][b] = round(2 × log2(f[a][b] / e[a][b]))         # half-bits, as BLOSUM'
    ],
    build(input, mode) {
      const rows = String(input.block).toUpperCase().split(/[\s,]+/).filter(Boolean);
      const sN = rows.length, w = rows[0].length;
      const letters = Array.from(new Set(rows.join('').split(''))).sort((a, b) => AA.indexOf(a) - AA.indexOf(b));
      const key = (a, b) => (AA.indexOf(a) <= AA.indexOf(b) ? a + b : b + a);
      // a pair is written in alphabetical order, as in the questions (K–R)
      const show = (k) => k.split('').sort().join('–');
      const hTot = {};
      const frames = [];
      const F = (o) => frames.push(Object.assign({ col: null, h: Object.assign({}, hTot), phase: 'count' }, o));
      F({ line: null, narr: `A <b>block</b>: ${sN} related protein segments, aligned without gaps (${w} columns). In every column, compare each sequence with each other: ${sN} sequences give ${(sN * (sN - 1)) / 2} pairs per column.` });
      let asked = 0;
      for (let c = 0; c < w; c++) {
        const colH = {};
        for (let a = 0; a < sN; a++) for (let b = a + 1; b < sN; b++) {
          const k = key(rows[a][c], rows[b][c]);
          colH[k] = (colH[k] || 0) + 1;
        }
        const desc = Object.keys(colH).sort().map((k) => `h(${show(k)}) = ${colH[k]}`).join(', ');
        if (mode === 'practice' && asked < 2 && Object.keys(colH).length > 1) {
          asked++;
          const ks = Object.keys(colH).sort();
          F({ col: c, line: 0, narr: `Column ${c + 1}: ${rows.map((r) => esc(r[c])).join(' ')}.`, ask: { type: 'fields', fields: ks.map((k) => ({ label: show(k), answer: colH[k] })), prompt: 'Count the pairs of each kind in this column (each sequence with each other one).', hint: `For a letter that occurs n times, there are n(n − 1)/2 pairs of it with itself; two letters occurring n and m times give n × m mixed pairs.`, explain: desc + '.' } });
        }
        Object.entries(colH).forEach(([k, v]) => (hTot[k] = (hTot[k] || 0) + v));
        F({ col: c, colH, line: 0, narr: `Column ${c + 1}: ${rows.map((r) => esc(r[c])).join(' ')} – ${desc}.`, dwell: 1.2 });
      }
      const T = (w * sN * (sN - 1)) / 2;
      // the pair to show as an example: K–R if the block has it, else the commonest pair of two different residues
      const mixed = Object.keys(hTot).filter((k) => k[0] !== k[1]).sort((a, b) => hTot[b] - hTot[a]);
      const ex = hTot[key('K', 'R')] ? key('K', 'R') : mixed[0];
      const f = {}, p = {};
      Object.keys(hTot).forEach((k) => (f[k] = hTot[k] / T));
      letters.forEach((a) => {
        let sum = 0;
        Object.keys(hTot).forEach((k) => {
          if (k === a + a) sum += hTot[k];
          else if (k.includes(a)) sum += hTot[k] / 2;
        });
        p[a] = sum / T;
      });
      F({ phase: 'freq', line: [1, 2, 3], T, f, p, narr: `T = ${w} columns × ${(sN * (sN - 1)) / 2} pairs = <b>${T}</b> pairs. The observed frequency of a pair is f<sub>ab</sub> = h<sub>ab</sub>/T ${ex ? ` – for example f(${show(ex)}) = ${hTot[ex]}/${T} = ${(hTot[ex] / T).toFixed(3)}` : ''}. Each residue’s own frequency p<sub>a</sub> counts its pairs (half for mixed ones): ${letters.map((a) => `p<sub>${a}</sub> = ${p[a].toFixed(3)}`).join(', ')}.`, dwell: 2 });
      const e = {}, sc = {};
      letters.forEach((a) => letters.forEach((b) => {
        const k = key(a, b);
        e[k] = a === b ? p[a] * p[a] : 2 * p[a] * p[b];
        sc[k] = f[k] ? Math.round(2 * Math.log2(f[k] / e[k])) : null;
      }));
      F({ phase: 'score', line: [4, 5], T, f, p, e, sc, narr: `By chance alone, a and b would pair with frequency e<sub>aa</sub> = p<sub>a</sub>² or e<sub>ab</sub> = 2p<sub>a</sub>p<sub>b</sub>. The score is the log-odds 2 × log<sub>2</sub>(f/e): positive when a pair is seen more often than chance, negative when less. ${ex ? `For ${show(ex)}: f = ${f[ex].toFixed(3)}, e = ${e[ex].toFixed(3)}, score round(2 × log<sub>2</sub>(${f[ex].toFixed(3)} / ${e[ex].toFixed(3)})) = ${sg(sc[ex])}.` : ''}`, dwell: 2 });
      F({ phase: 'score', line: null, T, f, p, e, sc, narr: `Done for one block. BLOSUM62 was made this way from about 2,000 blocks of protein families, after merging sequences that were 62% identical or more (so that close relatives do not dominate). Pairs never seen in a block (–) get scores from the other blocks.` });
      return { frames, data: { rows, letters, key } };
    },
    view(stage, data) {
      const { rows, letters, key } = data;
      const blk = h('div.bs-block', rows.map((r) => h('div.tiles', r.split('').map((c, k) => h('span', { class: V.tileClass(c, true), 'data-c': String(k) }, c)))));
      const counts = h('div.bs-counts');
      const mat = h('div.bs-mat');
      stage.appendChild(h('div.bs', h('div', h('div.viz-label', 'Block'), blk), h('div', counts), mat));
      return {
        update(f) {
          blk.querySelectorAll('.tile').forEach((t) => t.classList.toggle('cur', f.col != null && +t.dataset.c === f.col));
          blk.querySelectorAll('.tile').forEach((t) => t.classList.toggle('dim', f.col != null && +t.dataset.c > f.col && f.phase === 'count'));
          const ks = Object.keys(f.h).sort();
          counts.innerHTML = `<div class="viz-label">Pairs counted, h<sub>ab</sub></div>` + (ks.length ? `<table class="pi-t bs-h"><tr><th>pair</th>${ks.map((k) => `<td class="${f.colH && f.colH[k] ? 'use' : ''}">${k.split('').sort().join('–')}</td>`).join('')}</tr><tr class="v"><th>h</th>${ks.map((k) => `<td class="${f.colH && f.colH[k] ? 'use' : ''}">${f.h[k]}</td>`).join('')}</tr>${f.f ? `<tr><th>f</th>${ks.map((k) => `<td>${f.f[k].toFixed(2)}</td>`).join('')}</tr>` : ''}${f.e ? `<tr><th>e</th>${ks.map((k) => `<td>${f.e[k].toFixed(2)}</td>`).join('')}</tr>` : ''}</table>` : '<p class="muted">none yet</p>');
          mat.innerHTML = '';
          if (f.sc) {
            const t = h('table.b62.bs-sc');
            t.appendChild(h('tr', h('th', ''), letters.map((c) => h('th', c))));
            letters.forEach((a) => t.appendChild(h('tr', h('th', a), letters.map((b) => {
              const v = f.sc[key(a, b)];
              return h('td', { class: v == null ? 'zero' : v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero' }, v == null ? '–' : sg(v));
            }))));
            mat.appendChild(h('div.viz-label', 'Log-odds scores from this block'));
            mat.appendChild(t);
          }
        }
      };
    }
  });
})();
