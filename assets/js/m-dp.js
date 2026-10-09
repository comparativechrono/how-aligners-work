/* =====================================================================
   Dynamic programming for pairwise alignment: one machine for the edit
   distance, approximate matching, Needleman–Wunsch (global) and
   Smith–Waterman (local) – the matrix is filled cell by cell, then
   traced back.
   ===================================================================== */
(function () {
  'use strict';
  const MG = window.MG;
  const { h, esc } = MG;
  const V = MG.viz;
  const A = MG.algo;
  const seq = V.seq;
  const DNA = 'ACGT';
  const PROTEIN = 'ACDEFGHIKLMNPQRSTVWY';

  const SCHEMES = [
    ['edit', 'Edit distance: 0 / 1 / gap 1 (smaller is better)'],
    ['penalty', 'DNA penalties: transition 2, transversion 4, gap 8 (smaller is better)'],
    ['dna', 'DNA scores: match +1, transition −1, transversion −3, gap −7'],
    ['simple', 'Simple scores: match +1, mismatch −1, gap −1'],
    ['sw246', 'Match +2, mismatch −4, gap −6'],
    ['blosum62', 'Proteins: BLOSUM62, gap −8']
  ];
  const SHORT = {
    edit: 's: match 0, substitution 1 · gap 1',
    penalty: 's: match 0, transition 2, transversion 4 · gap 8',
    dna: 's: match +1, transition −1, transversion −3 · gap −7',
    simple: 's: match +1, mismatch −1 · gap −1',
    sw246: 's: match +2, mismatch −4 · gap −6',
    blosum62: 's: BLOSUM62 (see Score tables) · gap −8'
  };
  function schemeOf(name) {
    let sc;
    if (name === 'sw246') sc = Object.assign(A.scheme('simple', { match: 2, mismatch: -4, gap: -6 }), { name: 'match +2, mismatch −4, gap −6' });
    else if (name === 'blosum62') sc = Object.assign(A.scheme('blosum62', { gap: -8 }), { name: 'BLOSUM62, gap −8' });
    else sc = A.scheme(name);
    sc.short = SHORT[name];
    return sc;
  }
  const MODES = [
    ['global', 'Global (Needleman–Wunsch / edit distance)'],
    ['local', 'Local (Smith–Waterman)'],
    ['fit', 'Find sequence 1 inside sequence 2 (approximate matching)']
  ];

  V.define('dp', {
    title: 'Dynamic programming',
    sub: 'Fill the matrix, then trace back',
    inputs: [
      { key: 'x', label: 'Sequence 1 (down the side)', type: 'seq', letters: PROTEIN, min: 1, max: 14, default: 'ACG' },
      { key: 'y', label: 'Sequence 2 (across the top)', type: 'seq', letters: PROTEIN, min: 1, max: 22, default: 'CCG' },
      { key: 'mode', label: 'Kind of alignment', type: 'select', options: MODES, default: 'global' },
      { key: 'scheme', label: 'Scores', type: 'select', options: SCHEMES, default: 'edit' },
      { key: 'steps', label: 'Steps', type: 'select', options: [['cell', 'one cell at a time'], ['row', 'one row at a time']], default: 'cell' },
      { key: 'ask', label: 'In “Your turn”, you fill', type: 'select', options: [['8', 'the first 8 cells, then trace back'], ['all', 'every cell, then trace back'], ['0', 'no cells – only the traceback']], default: '8' }
    ],
    presets: {
      tiny: { label: 'Edit distance: ACG / CCG', input: { x: 'ACG', y: 'CCG', mode: 'global', scheme: 'edit', steps: 'cell' } },
      edit: { label: 'Edit distance: CGCATACGTGCG / CGATACGGTGCG', input: { x: 'CGCATACGTGCG', y: 'CGATACGGTGCG', mode: 'global', scheme: 'edit', steps: 'row' } },
      approx: { label: 'Approximate matching: ATGCAGTCG in TTGGGATACAGTACGGAACCT', input: { x: 'ATGCAGTCG', y: 'TTGGGATACAGTACGGAACCT', mode: 'fit', scheme: 'edit', steps: 'row' } },
      penalty: { label: 'DNA penalties: TACGTCAGC / TATGTCATGC', input: { x: 'TACGTCAGC', y: 'TATGTCATGC', mode: 'global', scheme: 'penalty', steps: 'row' } },
      nw: { label: 'Needleman–Wunsch: TACGTCAGC / TATGTCATGC', input: { x: 'TACGTCAGC', y: 'TATGTCATGC', mode: 'global', scheme: 'dna', steps: 'row' } },
      swsmall: { label: 'Smith–Waterman: GTG / AGTC', input: { x: 'GTG', y: 'AGTC', mode: 'local', scheme: 'simple', steps: 'cell' } },
      sw: { label: 'Smith–Waterman: GGTATGCTGGCGCTA / TATATGCGGCGTTT', input: { x: 'GGTATGCTGGCGCTA', y: 'TATATGCGGCGTTT', mode: 'local', scheme: 'sw246', steps: 'row' } },
      protein: { label: 'Proteins, local, BLOSUM62: PAWHEAE / HEAGAWGHEE', input: { x: 'PAWHEAE', y: 'HEAGAWGHEE', mode: 'local', scheme: 'blosum62', steps: 'row' } }
    },
    practice: true,
    code: [
      'D[0][0] = 0',
      'D[i][0] = D[i-1][0] + gap   # first column: only gaps',
      'D[0][j] = D[0][j-1] + gap   # first row (0 when the start is free)',
      'for i in 1..len(x):',
      '  for j in 1..len(y):',
      '    D[i][j] = best(D[i-1][j-1] + s(x[i-1], y[j-1]),  # ↖ match or substitution',
      '                   D[i][j-1] + gap,                   # ← gap in sequence 1',
      '                   D[i-1][j] + gap)                   # ↑ gap in sequence 2',
      '    # local: best(…, 0) – an alignment may start here',
      'trace back from the answer cell, following the arrows'
    ],
    check(input) {
      const dnaOnly = input.scheme !== 'blosum62';
      for (const k of ['x', 'y']) {
        if (dnaOnly && /[^ACGT]/.test(input[k])) return `With these scores the sequences must be DNA (A C G T). For proteins choose BLOSUM62.`;
      }
      if (input.mode === 'local' && A.schemes[input.scheme] && A.schemes[input.scheme].kind === 'min') return 'A local alignment needs scores (positive for matches) – choose one of the score schemes, not penalties.';
      return null;
    },
    build(input, mode) {
      const x = input.x, y = input.y;
      const sc = schemeOf(input.scheme);
      const res = A.dp(x, y, sc, input.mode);
      const m = x.length, n = y.length;
      const minimise = sc.kind === 'min';
      const word = minimise ? 'smallest' : 'largest';
      const frames = [];
      const base = { initRow: false, initCol: false, upto: 0, cur: null, cand: false, ends: null, path: null, tbStep: -1 };
      const F = (o) => frames.push(Object.assign({}, base, o));
      const subTxt = (a, b) => {
        const s = sc.sub(a, b);
        const what = a === b ? 'match' : input.scheme === 'penalty' || input.scheme === 'dna' ? (A.isTransition(a, b) ? 'transition' : 'transversion') : minimise ? 'substitution' : 'mismatch';
        return { s, what };
      };
      const gapTxt = (g) => (g < 0 ? `− ${-g}` : `+ ${g}`);
      const mn = (v) => String(v).replace('-', '−'); // a real minus sign
      const sgn = (v) => (v < 0 ? `− ${-v}` : `+ ${v}`);
      const meaning = input.mode === 'global'
        ? (minimise ? 'Each cell D[i][j] will hold the <b>smallest cost</b> of turning the first i letters of sequence 1 into the first j letters of sequence 2.' : 'Each cell S[i][j] will hold the <b>best score</b> of aligning the first i letters of sequence 1 with the first j letters of sequence 2.')
        : input.mode === 'local'
          ? 'Each cell V[i][j] will hold the best score of an alignment that <b>ends</b> at letter i of sequence 1 and letter j of sequence 2 – or 0, the empty alignment, if nothing better ends there.'
          : 'Each cell D[i][j] will hold the fewest edits for the first i letters of the pattern, ending at letter j of the text – the pattern may start anywhere.';
      F({ line: null, narr: `${meaning} Scores: ${esc(sc.name)}.` });
      // first column and row
      F({ initCol: true, line: 1, narr: input.mode === 'local' ? 'First column: 0 – an alignment can start anywhere.' : `First column: the first i letters of sequence 1 against nothing – i gaps, ${minimise ? 'costing' : 'scoring'} ${mn(sc.gap)} each.` });
      F({ initCol: true, initRow: true, line: 2, narr: input.mode === 'global' ? `First row: likewise, j gaps.` : input.mode === 'fit' ? 'First row: <b>0</b> everywhere – the pattern may start at any position of the text at no cost.' : 'First row: 0 as well.' });
      const askCells = input.ask === 'all' ? Infinity : input.ask === '0' ? 0 : +input.ask || 8;
      let asked = 0;
      let k = 0;
      for (let i = 1; i <= m; i++) {
        // a row at a time (in "Your turn", once the cells to fill are done)
        if (input.steps === 'row' && (mode !== 'practice' || asked >= askCells)) {
          k += n;
          F({ initRow: true, initCol: true, upto: k, cur: null, rowDone: i, line: [3, 4, 5, 6, 7], narr: `Row ${i} (${seq(x[i - 1])}): every cell takes the ${word} of its three candidates${input.mode === 'local' ? ', or 0' : ''}.`, dwell: 1.2 });
          continue;
        }
        for (let j = 1; j <= n; j++) {
          const c = res.cand[i][j];
          const { s, what } = subTxt(x[i - 1], y[j - 1]);
          const lines = [
            `↖ ${mn(res.V[i - 1][j - 1])} ${sgn(s)} (${seq(x[i - 1])}–${seq(y[j - 1])}: ${what}) = <b>${mn(c.d)}</b>`,
            `← ${mn(res.V[i][j - 1])} ${gapTxt(sc.gap)} (gap) = <b>${mn(c.l)}</b>`,
            `↑ ${mn(res.V[i - 1][j])} ${gapTxt(sc.gap)} (gap) = <b>${mn(c.u)}</b>`
          ];
          const v = res.V[i][j];
          const tail = input.mode === 'local' && (c.d < 0 && c.l < 0 && c.u < 0) ? ' – all below 0, so <b>0</b> (start afresh)' : '';
          const calc = { d: c.d, l: c.l, u: c.u, v, s, what, win: res.ptr[i][j] };
          if (mode === 'practice' && asked < askCells) {
            asked++;
            F({
              initRow: true, initCol: true, upto: k, cur: [i, j], cand: true, calc, hide: true, line: [5, 6, 7],
              narr: `Cell [${i}][${j}]: ${seq(x[i - 1])} against ${seq(y[j - 1])}.`,
              ask: {
                type: 'number', answer: v,
                prompt: `What goes in cell [${i}][${j}]? Take the ${word} of the three candidates${input.mode === 'local' ? ' (or 0)' : ''}.`,
                hint: `↖ ${res.V[i - 1][j - 1]} ${sgn(s)}, ← ${res.V[i][j - 1]} ${gapTxt(sc.gap)}, ↑ ${res.V[i - 1][j]} ${gapTxt(sc.gap)}.`,
                explain: lines.join('; ') + ` → <b>${v}</b>.`
              }
            });
          }
          k++;
          F({ initRow: true, initCol: true, upto: k, cur: [i, j], cand: true, calc, line: [5, 6, 7], narr: `Cell [${i}][${j}]: ${lines.join('; ')}. ${minimise ? 'Smallest' : 'Largest'}: <b>${v}</b>${tail}.`, dwell: 1.1 });
        }
      }
      const full = { initRow: true, initCol: true, upto: m * n };
      // where the answer is
      const endsTxt = res.ends.map(([i, j]) => `[${i}][${j}]`).join(', ');
      if (input.mode === 'global') F(Object.assign({}, full, { ends: res.ends, line: 9, narr: `The bottom-right cell holds the answer: ${input.scheme === 'edit' ? 'the edit distance is' : minimise ? 'the smallest total penalty is' : 'the best global score is'} <b>${res.score}</b>.` }));
      else if (input.mode === 'fit') F(Object.assign({}, full, { ends: res.ends, line: 9, narr: `The best cell of the <b>last row</b> is the answer: the pattern fits the text with <b>${res.score}</b> edit${res.score === 1 ? '' : 's'}, ending at ${res.ends.length > 1 ? 'columns ' : 'column '}${res.ends.map((e) => e[1]).join(', ')} of the matrix (text position${res.ends.length > 1 ? 's' : ''} ${res.ends.map((e) => e[1] - 1).join(', ')}).` }));
      else F(Object.assign({}, full, { ends: res.ends, line: 9, narr: res.ends.length ? `The highest value anywhere in the matrix is the best local score: <b>${res.score}</b>, at ${endsTxt}. The many zeros are places where no alignment does better than none.` : 'Every cell is 0: no stretch of the two sequences scores above 0.' }));
      // traceback
      if (res.tb && res.score !== null) {
        const path = res.tb.path; // from the start to the end
        const back = path.slice().reverse();
        for (let s = 1; s < back.length; s++) {
          const [i, j] = back[s - 1];
          const [pi, pj] = back[s];
          const dir = pi === i - 1 && pj === j - 1 ? 'd' : pi === i - 1 ? 'u' : 'l';
          const what = dir === 'd' ? (x[i - 1] === y[j - 1] ? `${seq(x[i - 1])} is aligned with ${seq(y[j - 1])} (match)` : `${seq(x[i - 1])} is aligned with ${seq(y[j - 1])} (substitution)`) : dir === 'u' ? `${seq(x[i - 1])} of sequence 1 is aligned with a gap` : `${seq(y[j - 1])} of sequence 2 is aligned with a gap`;
          if (mode === 'practice') {
            const options = (res.ptr[i][j] || []).filter((p) => p !== '0').map((p) => (p === 'd' ? `c-${i - 1}-${j - 1}` : p === 'u' ? `c-${i - 1}-${j}` : `c-${i}-${j - 1}`));
            F(Object.assign({}, full, {
              ends: res.ends, path: back.slice(0, s), tbStep: s - 1, line: 9,
              narr: `Traceback: from [${i}][${j}], which cell did its value come from?`,
              ask: { type: 'pick', answer: options, prompt: `Click the cell the traceback goes to from [${i}][${j}].`, pickHint: 'Click a neighbouring cell: up, left or diagonally up-left.', hint: 'Which of the three candidates gave this cell its value? Follow that arrow.', explain: options.length > 1 ? 'Here two moves give the same value – both alignments are equally good. The page follows the diagonal when it can.' : `It came from [${pi}][${pj}].` }
            }));
          }
          F(Object.assign({}, full, { ends: res.ends, path: back.slice(0, s + 1), tbStep: s, line: 9, narr: `From [${i}][${j}] to [${pi}][${pj}]: ${what}.`, dwell: 0.9 }));
        }
        const startTxt = input.mode === 'local' ? 'The traceback stops at a 0: the alignment starts here.' : input.mode === 'fit' ? 'The traceback reaches the top row: the pattern starts here in the text.' : 'Back at the top-left corner.';
        F(Object.assign({}, full, { ends: res.ends, path: back, tbStep: back.length, done: true, line: 9, narr: `${startTxt} The alignment next to the matrix has ${minimise ? 'a cost' : 'a score'} of <b>${res.score}</b>.` }));
      }
      return { frames, data: { x, y, m, n, res, sc, mode: input.mode } };
    },
    view(stage, data) {
      const { x, y, m, n, res } = data;
      const wrap = h('div.dp');
      stage.appendChild(wrap);
      // the cells are as large as the stage allows; the card of the calculation and the alignment sit
      // beside the matrix on a wide stage, below it on a narrow one
      const sw = stage.clientWidth || 640, sh0 = stage.clientHeight || 560;
      const wide = sw >= 700;
      const W = sw - 44 - (wide ? 270 : 0);
      const Hh = sh0 - 44 - (wide ? 0 : 190);
      const fit = (k, room) => room / (k + 2 + 0.16 * (k + 2));
      const size = Math.max(20, Math.min(54, Math.floor(fit(n, W)), Math.floor(fit(m, Hh))));
      wrap.classList.toggle('wide', wide);
      const gap = Math.max(3, Math.round(size * 0.16));
      stage.style.setProperty('--cell', size + 'px');
      const grid = h('div.dp-grid', { style: { gridTemplateColumns: `repeat(${n + 2}, var(--cell))`, gap: gap + 'px' } });
      // header row
      grid.appendChild(h('span.dp-h.corner', ''));
      grid.appendChild(h('span.dp-h.eps', 'ε', h('span.ix.top', '0')));
      const prot = /blosum/i.test(data.sc.name || '');
      for (let j = 0; j < n; j++) grid.appendChild(h('span.dp-h.top', { 'data-j': String(j + 1) }, h('span', { class: V.tileClass(y[j], prot) }, y[j]), h('span.ix.top', String(j + 1))));
      const cells = [];
      for (let i = 0; i <= m; i++) {
        grid.appendChild(i === 0 ? h('span.dp-h.eps', 'ε', h('span.ix.side', '0')) : h('span.dp-h.side', { 'data-i': String(i) }, h('span', { class: V.tileClass(x[i - 1], prot) }, x[i - 1]), h('span.ix.side', String(i))));
        cells.push([]);
        for (let j = 0; j <= n; j++) {
          const c = h('span.dp-c', { 'data-pick': `c-${i}-${j}` }, h('span.v', ''), h('span.ar', ''));
          grid.appendChild(c);
          cells[i].push(c);
        }
      }
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'dp-svg');
      const gridWrap = h('div.dp-gw', grid, svg);
      const calc = h('div.dp-calc', { hidden: true });
      const alnBox = h('div.dp-aln');
      wrap.appendChild(h('div.dp-main', gridWrap, h('div.dp-side', calc, alnBox)));
      const AR = { d: '↖', u: '↑', l: '←', '0': '' };
      const NS = 'http://www.w3.org/2000/svg';
      function centre(i, j) {
        const c = cells[i][j];
        return [c.offsetLeft + c.offsetWidth / 2, c.offsetTop + c.offsetHeight / 2];
      }
      function arrow(from, to, cls) {
        const [x1, y1] = centre(from[0], from[1]);
        const [x2, y2] = centre(to[0], to[1]);
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
        const sh = size * 0.3;
        const l = document.createElementNS(NS, 'line');
        l.setAttribute('x1', x1 + (dx / len) * sh);
        l.setAttribute('y1', y1 + (dy / len) * sh);
        l.setAttribute('x2', x2 - (dx / len) * sh);
        l.setAttribute('y2', y2 - (dy / len) * sh);
        l.setAttribute('class', cls);
        l.setAttribute('marker-end', 'url(#dpArrow' + (cls.includes('win') ? 'W' : cls.includes('path') ? 'P' : '') + ')');
        svg.appendChild(l);
      }
      function markers() {
        svg.innerHTML = `<defs>
          <marker id="dpArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="mk"/></marker>
          <marker id="dpArrowW" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="mk win"/></marker>
          <marker id="dpArrowP" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="mk path"/></marker></defs>`;
      }
      return {
        update(f, prev, ctx) {
          const filled = (i, j) => (i === 0 && j === 0) || (i === 0 && f.initRow) || (j === 0 && f.initCol) || (i > 0 && j > 0 && (i - 1) * n + j <= f.upto);
          for (let i = 0; i <= m; i++) {
            for (let j = 0; j <= n; j++) {
              const c = cells[i][j];
              const isCur = f.cur && f.cur[0] === i && f.cur[1] === j;
              const on = filled(i, j) && !(isCur && f.hide);
              c.classList.toggle('filled', on);
              c.firstChild.textContent = on ? String(res.V[i][j]).replace('-', '−') : isCur && f.hide ? '?' : '';
              c.lastChild.textContent = on && i + j > 0 ? (res.ptr[i][j] || []).map((p) => AR[p]).join('') : '';
              c.classList.toggle('cur', !!isCur);
              c.classList.toggle('zero', on && data.mode === 'local' && res.V[i][j] === 0);
              c.classList.toggle('end', !!(f.ends && f.ends.some((e) => e[0] === i && e[1] === j)));
              c.classList.toggle('src', !!(f.cur && f.cand && ((i === f.cur[0] - 1 && j === f.cur[1] - 1) || (i === f.cur[0] && j === f.cur[1] - 1) || (i === f.cur[0] - 1 && j === f.cur[1]))));
              c.classList.toggle('onpath', !!(f.path && f.path.some((p) => p[0] === i && p[1] === j)));
              c.classList.toggle('pickable', !!(ctx.asking && f.path && f.path.length && (() => {
                const [pi, pj] = f.path[f.path.length - 1];
                return (i === pi - 1 && j === pj - 1) || (i === pi - 1 && j === pj) || (i === pi && j === pj - 1);
              })()));
            }
          }
          grid.querySelectorAll('.dp-h.top').forEach((e) => e.classList.toggle('hl', !!f.cur && +e.dataset.j === f.cur[1]));
          grid.querySelectorAll('.dp-h.side').forEach((e) => e.classList.toggle('hl', !!f.cur && +e.dataset.i === f.cur[0]));
          if (f.rowDone) grid.querySelectorAll('.dp-h.side').forEach((e) => e.classList.toggle('hl', +e.dataset.i === f.rowDone));
          stage.classList.toggle('picking', !!ctx.asking && !!f.path);
          // arrows
          svg.setAttribute('width', grid.offsetWidth);
          svg.setAttribute('height', grid.offsetHeight);
          markers();
          if (f.cur && f.cand) {
            const [i, j] = f.cur;
            const win = ctx.asking ? [] : f.calc.win || [];
            arrow([i - 1, j - 1], [i, j], 'ar-d' + (win.includes('d') ? ' win' : ''));
            arrow([i, j - 1], [i, j], 'ar-l' + (win.includes('l') ? ' win' : ''));
            arrow([i - 1, j], [i, j], 'ar-u' + (win.includes('u') ? ' win' : ''));
          }
          if (f.path) for (let s = 1; s < f.path.length; s++) arrow(f.path[s - 1], f.path[s], 'path');
          // the calculation card (in "Your turn" without the sums: those are for the student)
          if (f.cur && f.cand && f.calc) {
            calc.hidden = false;
            const cc = f.calc;
            const hide = ctx.asking;
            const best = (k) => !hide && (cc.win || []).includes(k);
            const [i, j] = f.cur;
            const g = data.sc.gap;
            const sg = (v) => (v < 0 ? '− ' + -v : '+ ' + v);
            const sub = hide ? `+ s(${esc(x[i - 1])}, ${esc(y[j - 1])})` : sg(cc.s);
            const gp = hide ? '+ gap' : sg(g);
            const val = (v) => (hide ? '' : '= ' + v);
            calc.innerHTML = `<div class="cc-t">Cell [${i}][${j}]: ${esc(x[i - 1])} against ${esc(y[j - 1])}</div>
              <div class="cc-r${best('d') ? ' win' : ''}"><span class="cc-a">↖</span><span>${res.V[i - 1][j - 1]} ${sub}</span><span class="cc-v">${val(cc.d)}</span></div>
              <div class="cc-r${best('l') ? ' win' : ''}"><span class="cc-a">←</span><span>${res.V[i][j - 1]} ${gp}</span><span class="cc-v">${val(cc.l)}</span></div>
              <div class="cc-r${best('u') ? ' win' : ''}"><span class="cc-a">↑</span><span>${res.V[i - 1][j]} ${gp}</span><span class="cc-v">${val(cc.u)}</span></div>
              ${data.mode === 'local' ? `<div class="cc-r${best('0') ? ' win' : ''}"><span class="cc-a">ε</span><span>start afresh</span><span class="cc-v">= 0</span></div>` : ''}
              <div class="cc-res">${data.sc.kind === 'min' ? 'smallest' : 'largest'}: <b>${hide ? '?' : cc.v}</b></div>
              ${hide ? `<div class="cc-key">${esc(data.sc.short || data.sc.name)}</div>` : ''}`;
          } else calc.hidden = true;
          // the alignment, built from the right during the traceback
          alnBox.innerHTML = '';
          if (f.path && f.path.length > 1) {
            const cols = [];
            for (let s = 1; s < f.path.length; s++) {
              const [i, j] = f.path[s - 1];
              const [pi, pj] = f.path[s];
              if (pi === i - 1 && pj === j - 1) cols.unshift([x[i - 1], y[j - 1]]);
              else if (pi === i - 1) cols.unshift([x[i - 1], '-']);
              else cols.unshift(['-', y[j - 1]]);
            }
            const top = h('div.tiles'), mid = h('div.aln-mid'), bot = h('div.tiles');
            cols.forEach(([a, b], k) => {
              const fresh = k === 0 && !f.done && !ctx.back && !ctx.instant ? ' new' : '';
              top.appendChild(h('span', { class: V.tileClass(a, prot) + fresh }, a));
              mid.appendChild(h('span', a === b ? '|' : a === '-' || b === '-' ? ' ' : prot && data.sc.sub(a, b) > 0 ? '+' : '·'));
              bot.appendChild(h('span', { class: V.tileClass(b, prot) + fresh }, b));
            });
            const room = (alnBox.clientWidth || 260) - 20;
            alnBox.style.setProperty('--cell', Math.max(13, Math.min(26, Math.floor(room / cols.length) - 2)) + 'px');
            alnBox.appendChild(h('div.aln-l', f.done ? `Alignment – ${data.sc.kind === 'min' ? 'cost' : 'score'} ${res.score}` : 'Alignment so far (built from the right)'));
            alnBox.appendChild(h('div.aln', top, mid, bot));
            if (f.done) {
              const ops = cols.map(([a, b]) => (a === '-' ? 'I' : b === '-' ? 'D' : a === b ? 'M' : 'S')).join('');
              alnBox.appendChild(h('div.aln-ops', { html: `Edit transcript: <code>${ops}</code> <span class="muted">(M match, S substitution, D gap in sequence 2, I gap in sequence 1)</span>` }));
            }
          }
        }
      };
    }
  });
})();

/* =====================================================================
   Dot plots, and the recursive edit distance (why dynamic programming)
   ===================================================================== */
(function () {
  'use strict';
  const MG = window.MG;
  const { h, esc } = MG;
  const V = MG.viz;
  const A = MG.algo;
  const seq = V.seq;

  /* ==================================================================
     Dot plot
     ================================================================== */
  V.define('dotplot', {
    title: 'Dot plot',
    sub: 'A dot wherever the two sequences match; similar stretches make diagonals',
    inputs: [
      { key: 'a', label: 'Sequence 1 (down the side)', type: 'seq', letters: 'ACGT', min: 2, max: 32, default: 'CGCAGC' },
      { key: 'b', label: 'Sequence 2 (across the top)', type: 'seq', letters: 'ACGT', min: 2, max: 40, default: 'CGACAC' },
      { key: 'w', label: 'Window', type: 'select', options: [['1', '1 letter'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']], default: '1' },
      { key: 't', label: 'Matches needed in the window', type: 'select', options: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']], default: '1' }
    ],
    presets: {
      small: { label: 'CGCAGC against CGACAC', input: { a: 'CGCAGC', b: 'CGACAC', w: '1', t: '1' } },
      indel: { label: 'An insertion: a gene and the same with 3 extra letters', input: { a: 'ATGGCTAGCTTACGGATCC', b: 'ATGGCTAGCGGATTACGGATCC', w: '1', t: '1' } },
      filtered: { label: 'The same, window 3, all 3 must match', input: { a: 'ATGGCTAGCTTACGGATCC', b: 'ATGGCTAGCGGATTACGGATCC', w: '3', t: '3' } },
      repeat: { label: 'A sequence against itself: a repeat', input: { a: 'TTGACGTACGTACGTCCA', b: 'TTGACGTACGTACGTCCA', w: '2', t: '2' } }
    },
    practice: true,
    check(input) {
      if (+input.t > +input.w) return 'The matches needed cannot be more than the window.';
      if (+input.w > Math.min(input.a.length, input.b.length)) return 'The window is longer than a sequence.';
      return null;
    },
    code: [
      'for i in range(len(a) - w + 1):',
      '    for j in range(len(b) - w + 1):',
      '        matches = sum(a[i+k] == b[j+k] for k in range(w))',
      '        if matches >= t: dot(i, j)'
    ],
    build(input, mode) {
      const a = input.a, b = input.b, w = +input.w, t = +input.t;
      const dots = A.dotPlot(a, b, w, t);
      const rows = a.length - w + 1;
      const frames = [];
      const F = (o) => frames.push(Object.assign({ upto: 0, cur: null }, o));
      F({ line: null, narr: `Sequence 1 runs down the side, sequence 2 across the top. Every cell compares ${w === 1 ? 'a letter of each' : `a window of ${w} letters of each, starting there`}; a dot means ${w === 1 ? 'they are the same' : `at least ${t} of the ${w} letters match`}.` });
      let asked = 0;
      for (let i = 0; i < rows; i++) {
        if (mode === 'practice' && asked < 3 && b.length <= 14) {
          asked++;
          const rowDots = dots.filter((d) => d[0] === i).length;
          F({ upto: i, cur: i, line: [1, 2, 3], narr: `Row ${i}: ${seq(a.slice(i, i + w))} against every ${w === 1 ? 'letter' : 'window'} of sequence 2.`, ask: { type: 'number', answer: rowDots, prompt: `How many dots does row ${i} get?`, hint: w === 1 ? `Count the ${esc(a[i])}’s in ${esc(b)}.` : `Compare ${esc(a.slice(i, i + w))} with each window of ${w} letters of sequence 2.`, explain: `${rowDots}.` } });
        }
        F({ upto: i + 1, cur: i, line: [0, 1, 2, 3], narr: `Row ${i}: ${seq(a.slice(i, i + w))} – ${dots.filter((d) => d[0] === i).length} dot${dots.filter((d) => d[0] === i).length === 1 ? '' : 's'}.`, dwell: rows > 12 ? 0.45 : 0.8 });
      }
      // the longest diagonal run
      const set = new Set(dots.map((d) => d[0] + ',' + d[1]));
      let best = null;
      dots.forEach(([i, j]) => {
        if (set.has(i - 1 + ',' + (j - 1))) return;
        let L = 0;
        while (set.has(i + L + ',' + (j + L))) L++;
        if (!best || L > best.L) best = { i, j, L };
      });
      const runs = [];
      dots.forEach(([i, j]) => {
        if (set.has(i - 1 + ',' + (j - 1))) return;
        let L = 0;
        while (set.has(i + L + ',' + (j + L))) L++;
        if (L >= Math.max(3, Math.ceil(Math.min(a.length, b.length) / 4))) runs.push({ i, j, L });
      });
      F({ upto: rows, runs, line: null, narr: `${dots.length} dots. ${best ? `The longest diagonal run is ${best.L} long (from row ${best.i}, column ${best.j}): the two sequences share a stretch there.` : ''} ${runs.length > 1 ? 'Diagonals that are shifted sideways from each other mean an insertion or deletion between them; parallel diagonals in a sequence against itself mean a repeat.' : ''} ${w === 1 && dots.length > 0.2 * a.length * b.length ? 'With single letters, a quarter of all cells match by chance (four letters) – a longer window with a threshold filters this noise.' : ''}`, dwell: 2 });
      return { frames, data: { a, b, w, dots } };
    },
    view(stage, data) {
      const { a, b } = data;
      const W = (stage.clientWidth || 640) - 70, Hh = (stage.clientHeight || 520) - 70;
      const size = Math.max(10, Math.min(34, Math.floor(W / (b.length + 1)), Math.floor(Hh / (a.length + 1))));
      stage.style.setProperty('--dot', size + 'px');
      const grid = h('div.dot-grid', { style: { gridTemplateColumns: `repeat(${b.length + 1}, var(--dot))`, gridTemplateRows: `repeat(${a.length + 1}, var(--dot))` } });
      grid.appendChild(h('span.dot-h'));
      b.split('').forEach((c) => grid.appendChild(h('span.dot-h', h('span', { class: V.tileClass(c) }, c))));
      const cells = [];
      a.split('').forEach((c, i) => {
        grid.appendChild(h('span.dot-h.side', { 'data-i': String(i) }, h('span', { class: V.tileClass(c) }, c)));
        cells.push(b.split('').map((_, j) => {
          const el = h('span.dot-c');
          grid.appendChild(el);
          return el;
        }));
      });
      stage.appendChild(h('div.dot-wrap', grid));
      const byRow = {};
      data.dots.forEach(([i, j]) => (byRow[i] = byRow[i] || []).push(j));
      return {
        update(f) {
          const run = new Set();
          (f.runs || []).forEach((r) => {
            for (let k = 0; k < r.L; k++) run.add(r.i + k + ',' + (r.j + k));
          });
          cells.forEach((row, i) => row.forEach((el, j) => {
            const on = i < f.upto && (byRow[i] || []).includes(j);
            el.classList.toggle('on', on);
            el.classList.toggle('run', on && run.has(i + ',' + j));
            el.classList.toggle('cur', f.cur === i);
          }));
          grid.querySelectorAll('.dot-h.side').forEach((e) => e.classList.toggle('hl', +e.dataset.i === f.cur));
        }
      };
    }
  });

  /* ==================================================================
     The recursive edit distance: the calls, and the memo
     ================================================================== */
  V.define('recur', {
    title: 'Edit distance by recursion',
    sub: 'Every call makes three more – and solves the same small problems again and again',
    inputs: [
      { key: 'x', label: 'Sequence 1', type: 'seq', letters: 'ACGT', min: 1, max: 4, default: 'ACG' },
      { key: 'y', label: 'Sequence 2', type: 'seq', letters: 'ACGT', min: 1, max: 4, default: 'CCG' },
      { key: 'memo', label: 'Remember answers (memoisation)', type: 'select', options: [['no', 'no – plain recursion'], ['yes', 'yes – look up a problem solved before']], default: 'no' }
    ],
    presets: {
      small: { label: 'AC / CC: 19 calls', input: { x: 'AC', y: 'CC', memo: 'no' } },
      plain: { label: 'ACG / CCG: 94 calls', input: { x: 'ACG', y: 'CCG', memo: 'no' } },
      memo: { label: 'ACG / CCG with a memo: 28 calls', input: { x: 'ACG', y: 'CCG', memo: 'yes' } }
    },
    practice: true,
    check(input) {
      if (A.editCallCount(input.x.length, input.y.length) > 200) return `Plain recursion would make ${A.editCallCount(input.x.length, input.y.length)} calls – too many to draw. Use shorter sequences (3 and 4 letters at most).`;
      return null;
    },
    code: [
      'def edit(a, b):',
      '    if (a, b) in memo: return memo[(a, b)]       # only with memoisation',
      '    if len(a) == 0: return len(b)',
      '    if len(b) == 0: return len(a)',
      '    delta = 0 if a[-1] == b[-1] else 1',
      '    d = min(edit(a[:-1], b[:-1]) + delta,',
      '            edit(a[:-1], b) + 1,',
      '            edit(a, b[:-1]) + 1)',
      '    memo[(a, b)] = d; return d'
    ],
    build(input, mode) {
      const x = input.x, y = input.y, memo = input.memo === 'yes';
      const r = A.editCalls(x, y, memo);
      const calls = r.calls;
      const m = x.length, n = y.length;
      const frames = [];
      const name = (c) => `edit(${JSON.stringify(x.slice(0, c.i))}, ${JSON.stringify(y.slice(0, c.j))})`;
      const shown = new Set(), done = new Set();
      const counts = A.range(m + 1).map(() => new Array(n + 1).fill(0));
      const F = (o) => frames.push(Object.assign({ shown: Array.from(shown), done: Array.from(done), counts: counts.map((row) => row.slice()) }, o));
      F({ line: 0, narr: `${name(calls[0])}: the edit distance of ${seq(x)} and ${seq(y)}, worked out from the edit distances of shorter prefixes. ${memo ? 'This time a memo remembers every answer: a problem met again is looked up, not solved again.' : 'Watch how often the same pair of prefixes comes back.'}` });
      let asked = 0;
      r.events.forEach((ev) => {
        const c = calls[ev.id];
        if (ev.type === 'call') {
          shown.add(c.id);
          counts[c.i][c.j]++;
          const times = counts[c.i][c.j];
          const narr = c.memo ? `${name(c)} again – looked up in the memo: ${c.value}.` : c.i === 0 || c.j === 0 ? `${name(c)}: one sequence is empty, so ${c.i + c.j} edit${c.i + c.j === 1 ? '' : 's'} – a base case.` : `${name(c)} is called${times > 1 ? ` – for the <b>${times}${times === 2 ? 'nd' : times === 3 ? 'rd' : 'th'} time</b>` : ''}. It calls three smaller problems.`;
          F({ cur: c.id, line: c.memo ? 1 : c.i === 0 || c.j === 0 ? [2, 3] : [4, 5, 6, 7], narr, dwell: calls.length > 40 ? 0.32 : 0.7 });
        } else {
          done.add(c.id);
          if (mode === 'practice' && asked < 6 && !c.memo && c.kids.length) {
            asked++;
            const kv = c.kids.map((k) => calls[k].value);
            const d = x[c.i - 1] === y[c.j - 1] ? 0 : 1;
            done.delete(c.id);
            F({ cur: c.id, line: [5, 6, 7], narr: `${name(c)}: its three calls returned ${kv.join(', ')}.`, ask: { type: 'number', answer: c.value, prompt: `What does ${esc(name(c))} return? min(${kv[0]} + ${d}, ${kv[1]} + 1, ${kv[2]} + 1)`, hint: `The last letters, ${esc(x[c.i - 1])} and ${esc(y[c.j - 1])}, are ${d ? 'different (+1)' : 'the same (+0)'}.`, explain: `min(${kv[0] + d}, ${kv[1] + 1}, ${kv[2] + 1}) = ${c.value}.` } });
            done.add(c.id);
          }
          if (c.kids.length) F({ cur: c.id, line: 8, narr: `${name(c)} returns <b>${c.value}</b>.`, dwell: calls.length > 40 ? 0.3 : 0.6 });
        }
      });
      const distinct = (m + 1) * (n + 1);
      const most = Math.max(...counts.flat());
      F({ line: null, narr: memo ? `${calls.length} calls instead of ${A.editCallCount(m, n)}: each of the ${distinct} pairs of prefixes was solved once, the rest looked up. Store those ${distinct} answers in a table and fill it in order, and you have <b>dynamic programming</b> – the matrix of the next section.` : `${calls.length} calls for only ${distinct} different pairs of prefixes – one of them was solved ${most} times. The number of calls grows about five-fold each time both sequences get one letter longer: for two sequences of 10 letters it is more than 12 million. The answer is ${r.value}.`, dwell: 2 });
      return { frames, data: { calls, m, n, x, y, memo } };
    },
    view(stage, data) {
      const { calls, m, n, x, y } = data;
      const palette = (i, j) => `hsl(${Math.round((((i * (n + 1) + j) * 360) / ((m + 1) * (n + 1)) + 200) % 360)}, 62%, ${i === 0 || j === 0 ? 82 : 66}%)`;
      // the table of subproblems, with how often each was called
      const tbl = h('table.rc-t');
      tbl.appendChild(h('tr', h('th', ''), h('th', 'ε'), y.split('').map((c, j) => h('th', y.slice(0, j + 1)))));
      const cells = [];
      for (let i = 0; i <= m; i++) {
        const row = h('tr', h('th', i === 0 ? 'ε' : x.slice(0, i)));
        cells.push([]);
        for (let j = 0; j <= n; j++) {
          const td = h('td', { style: { '--c': palette(i, j) } }, h('span.rc-n', ''));
          row.appendChild(td);
          cells[i].push(td);
        }
        tbl.appendChild(row);
      }
      const side = h('div.rc-side', h('div.viz-label', 'Calls of each pair of prefixes'), tbl);
      const L = V.layoutTree(calls.map((c) => ({ id: c.id, parent: c.parent })));
      // a wide tree gets the whole width, with the table above it
      const wideTree = L.width > 20;
      const W = (stage.clientWidth || 640) - 76 - (wideTree ? 0 : 230), Hh = (stage.clientHeight || 520) - 60 - (wideTree ? 40 * (m + 2) : 0);
      const ux = Math.max(12, Math.min(44, W / Math.max(1, L.width)));
      const uy = Math.max(30, Math.min(64, Hh / (L.depth + 1)));
      const treeBox = h('div.rc-tree');
      stage.appendChild(wideTree ? h('div.rc.stack', side, treeBox) : h('div.rc', treeBox, side));
      const tv = V.treeView(treeBox, { padX: 30 });
      const small = ux < 26;
      treeBox.classList.toggle('tiny', small);
      return {
        update(f, prev, ctx) {
          const shown = new Set(f.shown), done = new Set(f.done);
          tv.draw(calls.filter((c) => shown.has(c.id)).map((c) => ({
            id: c.id, parent: c.parent, x: 16 + L.pos[c.id][0] * ux, y: 16 + c.depth * uy,
            html: small ? '' : done.has(c.id) || c.memo ? String(c.value) : '',
            cls: 'rc-node' + (f.cur === c.id ? ' cur' : '') + (c.memo ? ' memo' : '') + (done.has(c.id) ? ' ret' : ''),
          })), ctx);
          calls.forEach((c) => {
            const el = tv.node(c.id);
            if (el) {
              el.style.setProperty('--c', palette(c.i, c.j));
              el.title = `edit("${x.slice(0, c.i)}", "${y.slice(0, c.j)}")${done.has(c.id) || c.memo ? ' = ' + c.value : ''}`;
            }
          });
          for (let i = 0; i <= m; i++) for (let j = 0; j <= n; j++) {
            const k = f.counts[i][j];
            cells[i][j].firstChild.textContent = k ? '×' + k : '';
            cells[i][j].classList.toggle('many', k > 1);
            cells[i][j].classList.toggle('now', f.cur != null && calls[f.cur].i === i && calls[f.cur].j === j);
          }
        }
      };
    }
  });
})();
