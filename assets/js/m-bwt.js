/* =====================================================================
   The Burrows–Wheeler transform: building it (rotations, sorting, the
   last column), reversing it (LF mapping), and searching it (backward
   search with the FM-index, as BWA and Bowtie do).
   ===================================================================== */
(function () {
  'use strict';
  const MG = window.MG;
  const { h, esc } = MG;
  const V = MG.viz;
  const A = MG.algo;
  const seq = V.seq;
  const sub = (n) => `<sub>${n}</sub>`;

  const TEXT_FIELD = { key: 'text', label: 'Text', type: 'seq', letters: 'ACGT', min: 2, max: 13, default: 'ATAATA', help: 'Letters A C G T; the page adds the $.' };

  /* ------------------------------------------------------------------
     A list of rows of tiles that can move (rotations, rows of the BWT matrix)
     ------------------------------------------------------------------ */
  function rowList(stage, cls) {
    const wrap = h('div.rowlist' + (cls ? '.' + cls : ''));
    stage.appendChild(wrap);
    return wrap;
  }
  function cellSize(stage, cols, extra) {
    const w = (stage.clientWidth || 600) - (extra || 0);
    return Math.max(22, Math.min(38, Math.floor(w / (cols + 0.5))));
  }

  /* ==================================================================
     1. Building the BWT
     ================================================================== */
  V.define('bwt', {
    title: 'Building the Burrows–Wheeler transform',
    sub: 'Rotate, sort, read the last column',
    inputs: [TEXT_FIELD],
    presets: {
      ataata: { label: 'ATAATA', input: { text: 'ATAATA' } },
      gattaca: { label: 'GATTACA', input: { text: 'GATTACA' } },
      repeats: { label: 'A repeat: ACACAC', input: { text: 'ACACAC' } },
      read: { label: 'A short read: TGCATGCA', input: { text: 'TGCATGCA' } }
    },
    practice: true,
    code: [
      't = text + "$"',
      'rotations = [t[i:] + t[:i] for i in range(len(t))]',
      'rotations.sort()',
      'bwt = "".join(r[-1] for r in rotations)'
    ],
    build(input, mode) {
      const t = A.withSentinel(input.text);
      const n = t.length;
      const rot = A.rotations(t);
      const sorted = A.sortedRotations(t).map((r) => r.start);
      const stages = A.sortStages(t);
      const L = A.bwt(t);
      const frames = [];
      const made = (k) => A.range(k);
      const base = { order: [], made: 0, groups: null, showF: false, showL: false, readL: 0, showSA: false, cur: null, sortedCount: 0 };
      const F = (o) => frames.push(Object.assign({}, base, o));
      F({ narr: `The text ${seq(input.text)} gets a <b>$</b> at the end: a character that occurs only once and comes <b>before every letter</b> in sorted order. It marks where the text ends.`, line: 0 });
      // the rotations, one by one
      for (let k = 0; k < n; k++) {
        F({ order: made(k + 1), made: k + 1, cur: k, line: 1, narr: k === 0 ? `Rotation 0 is the text itself: ${seq(rot[0].str)}.` : `Rotation ${k}: the first letter of rotation ${k - 1} moves to the end – ${seq(rot[k].str)}.`, dwell: 1.1 });
      }
      if (mode === 'practice') {
        // the student sorts: click the rotation that comes next
        let placed = [];
        for (let r = 0; r < n; r++) {
          const rest = A.range(n).filter((k) => !placed.includes(k));
          const next = sorted[r];
          F({
            order: placed.concat(rest), made: n, sortedCount: placed.length, line: 2,
            narr: placed.length ? `${placed.length} of ${n} rows ${placed.length === 1 ? 'is' : 'are'} in place. Compare the rest letter by letter – remember that <b>$</b> comes first.` : 'Now sort the rotations, as in a dictionary. <b>$</b> comes before A, A before C, C before G, G before T.',
            ask: {
              type: 'pick', answer: 'r' + next,
              prompt: r === 0 ? 'Which rotation comes <b>first</b>? Click it.' : `Which rotation comes <b>next</b> (row ${r})? Click it.`,
              pickHint: 'Click a row that is not in place yet.',
              hint: 'Compare the first letters; if they are equal, the second letters, and so on. $ is the smallest.',
              explain: `${seq(rot[next].str)} is the smallest of the rows left.`
            },
            pickable: rest
          });
          placed = placed.concat([next]);
        }
        F({ order: sorted, made: n, sortedCount: n, line: 2, narr: 'All rotations are sorted. Now look at the <b>last column</b>.' });
        F({
          order: sorted, made: n, sortedCount: n, showF: true, showL: true, line: 3,
          narr: 'The last column, read from top to bottom, is the BWT.',
          ask: { type: 'text', answer: L, prompt: 'Type the <b>last column</b>, from top to bottom (with the $).', hint: 'Read the last letter of each row, from the top row down.', explain: `The BWT of ${seq(t)} is ${seq(L)}.` }
        });
        F({ order: sorted, made: n, sortedCount: n, showF: true, showL: true, readL: n, line: 3, narr: `BWT = ${seq(L)}. Same letters as the text – in another order, with equal letters often next to each other.` });
        F({ order: sorted, made: n, sortedCount: n, showF: true, showL: true, readL: n, showSA: true, narr: `The numbers on the left say where each rotation starts in the text: that column is the <b>suffix array</b> (${sorted.join(', ')}). The BWT letter of each row is the character just <i>before</i> that position.` });
        return { frames, data: { t, rot, sorted, L, n } };
      }
      // watch: sort, refined letter by letter
      let order = made(n);
      stages.forEach((s, si) => {
        const groups = {};
        s.groups.forEach((g, gi) => g.forEach((k) => (groups[k] = g.length > 1 ? gi : -1)));
        const tied = s.groups.filter((g) => g.length > 1);
        let narr;
        if (si === 0) narr = `Sort the rows by their <b>first</b> letter. ${tied.length ? `Rows that start with the same letter (${tied.map((g) => seq(rot[g[0]].str[0])).join(', ')}) are still tied – shown in the same colour.` : 'No two rows start with the same letter: they are in order.'}`;
        else narr = `Rows that were tied are compared by their first <b>${s.k}</b> letters. ${s.done ? 'Now every row is different – the sort is finished.' : `Still tied: ${tied.map((g) => g.map((k) => seq(rot[k].str.slice(0, s.k))).join(' and ')).join('; ')}.`}`;
        F({ order: s.order, made: n, groups, prefix: s.k, line: 2, narr, dwell: 1.6 });
        order = s.order;
      });
      F({ order: sorted, made: n, showF: true, line: 2, narr: 'The first column (<b>F</b>) is just the letters of the text in sorted order: $ first, then all the A’s, then C, G and T.' });
      F({ order: sorted, made: n, showF: true, showL: true, line: 3, narr: 'The last column (<b>L</b>) is the BWT. Read it from top to bottom.' });
      for (let r = 0; r < n; r++) {
        F({ order: sorted, made: n, showF: true, showL: true, readL: r + 1, cur: sorted[r], line: 3, narr: `Row ${r} ends with ${seq(L[r])}.`, dwell: 0.8 });
      }
      F({ order: sorted, made: n, showF: true, showL: true, readL: n, line: 3, narr: `BWT = ${seq(L)}. It has exactly the letters of the text, in another order – runs of the same letter make it easy to compress.` });
      F({ order: sorted, made: n, showF: true, showL: true, readL: n, showSA: true, narr: `The numbers on the left say where each rotation starts in the text. In sorted order they are the <b>suffix array</b>: ${sorted.join(', ')}. Each BWT letter is the character just <i>before</i> that position (the $ is before position 0).` });
      return { frames, data: { t, rot, sorted, L, n } };
    },
    view(stage, data) {
      const n = data.n;
      const textRow = h('div.bwt-text');
      stage.appendChild(textRow);
      // the column heads F and L, over the first and last letters of the rows
      const head = h('div.bwt-colhead', h('span.rot-start', ''), h('div.tiles', A.range(n).map((j) => h('span.tile.hd', j === 0 ? 'F' : j === n - 1 ? 'L' : ''))));
      stage.appendChild(head);
      const table = rowList(stage, 'bwt-rows');
      const out = h('div.bwt-out');
      stage.appendChild(out);
      let size = 0;
      function layout() {
        size = cellSize(stage, n + 3, 60);
        stage.style.setProperty('--cell', size + 'px');
        table.style.height = n * (size + 6) + 'px';
      }
      layout();
      // the text, with positions
      textRow.appendChild(h('div.bwt-label', 'Text'));
      textRow.appendChild(h('div.tiles.pos', data.t.split('').map((c, i) => h('span.tilebox', h('span.posn', String(i)), h('span', { class: V.tileClass(c) }, c)))));
      // one row per rotation, keyed by its start
      const rows = data.rot.map((r) => {
        const el = h('div.rot.gone', { 'data-pick': 'r' + r.start },
          h('span.rot-start', { title: 'where this rotation starts in the text' }, String(r.start)),
          h('div.tiles', r.str.split('').map((c, j) => h('span', { class: V.tileClass(c) + (j === 0 ? ' colF' : '') + (j === n - 1 ? ' colL' : '') }, c))));
        table.appendChild(el);
        return el;
      });
      const outTiles = h('div.tiles');
      out.appendChild(h('div.bwt-label', 'BWT'));
      out.appendChild(outTiles);
      return {
        update(f, prev, ctx) {
          const rowH = size + 6, pitch = size + 3;
          const pos = {};
          f.order.forEach((k, idx) => (pos[k] = idx));
          rows.forEach((el, k) => {
            const shown = k < f.made;
            const y = (pos[k] != null ? pos[k] : k) * rowH;
            // a new rotation: it starts as a copy of the one before, then its letters move one place left
            const appearing = shown && el.classList.contains('gone') && !ctx.instant && !ctx.back && k > 0 && prev && prev.made === k;
            if (appearing) el.style.transition = 'none';
            el.classList.toggle('gone', !shown);
            el.style.transform = `translateY(${y}px)`;
            if (appearing) {
              void el.offsetWidth;
              el.style.transition = '';
              V.anim(el, [{ transform: `translateY(${(k - 1) * rowH}px)`, opacity: 0.4 }, { transform: `translateY(${y}px)`, opacity: 1 }], 420, ctx);
              el.querySelectorAll('.tiles > .tile').forEach((t, j) => {
                if (j < n - 1) V.anim(t, [{ transform: `translateX(${pitch}px)` }, { transform: 'none' }], 520, ctx, { delay: 360 });
                else V.anim(t, [{ transform: `translateX(${-(n - 1) * pitch}px)` }, { transform: `translate(${(-(n - 1) * pitch) / 2}px, ${-0.85 * size}px)`, offset: 0.5 }, { transform: 'none' }], 520, ctx, { delay: 360 });
              });
            }
            el.classList.toggle('cur', f.cur === k && !f.showL);
            const g = f.groups ? f.groups[k] : null;
            el.dataset.group = g != null && g >= 0 ? String(g % 6) : '';
            el.classList.toggle('placed', f.sortedCount > 0 && pos[k] < f.sortedCount);
            el.classList.toggle('pickable', !!(ctx.asking && f.pickable && f.pickable.includes(k)));
            const tl = el.querySelectorAll('.tiles > .tile');
            tl.forEach((t, j) => t.classList.toggle('prefix', !!f.prefix && j < f.prefix && g != null));
            tl[n - 1].classList.toggle('cur', f.cur === k && !!f.showL);
          });
          table.classList.toggle('showF', !!f.showF);
          table.classList.toggle('showL', !!f.showL);
          table.classList.toggle('showSA', !!f.showSA);
          table.classList.toggle('picking', !!ctx.asking);
          head.classList.toggle('showF', !!f.showF);
          head.classList.toggle('showL', !!f.showL);
          // the BWT read so far
          outTiles.innerHTML = '';
          const L = data.L;
          for (let r = 0; r < n; r++) outTiles.appendChild(h('span', { class: V.tileClass(L[r]) + (r < f.readL ? '' : ' ghost') }, r < f.readL ? L[r] : ''));
          out.classList.toggle('on', f.readL > 0);
          // the letter just read flies down from the last column
          if (prev && f.readL === prev.readL + 1 && f.readL > 0 && !ctx.back) {
            const r = f.readL - 1;
            V.fly(rows[data.sorted[r]].querySelectorAll('.tiles > .tile')[n - 1], outTiles.children[r], ctx, { ms: 600 });
          }
        }
      };
    }
  });

  /* ==================================================================
     2. Reversing the BWT: LF mapping
     ================================================================== */
  V.define('lf', {
    title: 'Reversing the BWT with LF mapping',
    sub: 'From the last column back to the text',
    inputs: [{ key: 'text', label: 'Text (the page makes its BWT)', type: 'seq', letters: 'ACGT', min: 2, max: 13, default: 'ATAATA', help: 'The animation starts from the BWT of this text.' }],
    presets: {
      ataata: { label: 'BWT of ATAATA', input: { text: 'ATAATA' } },
      gattaca: { label: 'BWT of GATTACA', input: { text: 'GATTACA' } },
      repeats: { label: 'BWT of ACACAC', input: { text: 'ACACAC' } }
    },
    practice: true,
    code: [
      'F = sorted(L)',
      'row = 0                     # F[0] is $: the end of the text',
      'text = "$"',
      'while len(text) < len(L):',
      '    c = L[row]               # the character before this row',
      '    text = c + text',
      '    row = C[c] + rank(L, row) # LF: the same c in F'
    ],
    build(input, mode) {
      const fm = A.fmIndex(input.text);
      const L = fm.L, n = fm.n;
      const inv = A.inverseBwt(L);
      const frames = [];
      const base = { showF: false, ranks: false, links: false, row: null, link: null, text: '', next: null };
      const F = (o) => frames.push(Object.assign({}, base, o));
      F({ narr: `All we have is the BWT, ${seq(L)} – the last column <b>L</b> of the sorted rotations. Can the text be read back from it?` });
      F({ showF: true, line: 0, narr: 'The first column <b>F</b> comes back at once: it is just the letters of L in sorted order.' });
      F({ showF: true, ranks: true, line: 0, narr: `Number each letter by how many of the same letter came before it in its column: A${sub(0)}, A${sub(1)} … They are not stored: when the method needs the rank of a letter of L, it counts the same letters above it (Occ).` });
      F({ showF: true, ranks: true, links: true, line: 0, narr: `<b>LF mapping</b>: the k-th A in L is the same character of the text as the k-th A in F (and so for every letter). The lines join each letter of L to its place in F.`, dwell: 1.6 });
      let text = '$';
      inv.walk.forEach((w, s) => {
        const c = w.char;
        if (s === 0) F({ showF: true, ranks: true, row: 0, text, line: [1, 2], narr: `Start at row 0: its F is <b>$</b>, the end of the text. The text so far: ${seq(text)}.` });
        F({ showF: true, ranks: true, row: w.row, cur: true, text, line: 4, narr: `Row ${w.row} ends with ${seq(c)}${sub(w.rank)} in L: that is the character <b>before</b> ${seq(text[0])} in the text.` });
        const before = text;
        text = c + text;
        if (mode === 'practice') {
          F({
            showF: true, ranks: true, row: w.row, cur: true, text, line: 6,
            narr: `The text so far: ${seq(text)}. Where is this ${seq(c)}${sub(w.rank)} in F?`,
            ask: { type: 'pick', answer: 'f' + w.next, prompt: `Click the row of <b>F</b> that holds ${seq(c)}${sub(w.rank)} – the ${ordinal(w.rank)} ${esc(c)} of F.`, pickHint: 'Click a letter in the F column.', hint: `Count the ${esc(c)}’s in F from the top: you need number ${w.rank} (counting from 0).`, explain: `${seq(c)}${sub(w.rank)} is in row ${w.next}.` }
          });
        }
        F({ showF: true, ranks: true, row: w.row, link: { from: w.row, to: w.next }, text, line: [5, 6], narr: `Text: ${seq(text)}. LF mapping: ${seq(c)}${sub(w.rank)} is in row <b>${w.next}</b> of F (C[${esc(c)}] = ${fm.C[c]}, plus rank ${w.rank}).`, dwell: 1.3 });
        void before;
      });
      F({ showF: true, ranks: true, row: 0, text, done: true, line: 3, narr: `Back at the $: the text is ${seq(text)}. The BWT can be reversed – nothing was lost, and only two columns and the counts were needed.` });
      return { frames, data: { fm, inv, L, n } };
    },
    view(stage, data) {
      const n = data.n, L = data.L, F = data.inv.F;
      const lRank = data.inv.lRank, fRank = data.inv.fRank;
      const wrap = h('div.lf');
      stage.appendChild(wrap);
      const size = Math.max(26, Math.min(40, Math.floor(((stage.clientHeight || 520) - 130) / (n + 1))));
      stage.style.setProperty('--cell', size + 'px');
      const rowH = size + 6;
      const grid = h('div.lf-grid', { style: { height: n * rowH + 'px' } });
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'lf-links');
      const colF = h('div.lf-col.F');
      const colL = h('div.lf-col.L');
      const rowsNum = h('div.lf-col.num');
      for (let r = 0; r < n; r++) {
        rowsNum.appendChild(h('div.lf-num', { style: { top: r * rowH + 'px' } }, String(r)));
        colF.appendChild(h('div.lf-cell', { style: { top: r * rowH + 'px' }, 'data-pick': 'f' + r }, h('span', { class: V.tileClass(F[r]) }, F[r], F[r] === '$' ? null : h('sub.rk', String(fRank[r])))));
        colL.appendChild(h('div.lf-cell', { style: { top: r * rowH + 'px' } }, h('span', { class: V.tileClass(L[r]) }, L[r], L[r] === '$' ? null : h('sub.rk', String(lRank[r])))));
      }
      // the middle of each row is not stored – it is shown faded, only to follow
      const colMid = h('div.lf-col.mid');
      data.fm.rows.forEach((row, r) => colMid.appendChild(h('div.lf-midc', { style: { top: r * rowH + 'px' } }, row.slice(1, -1))));
      grid.appendChild(h('div.lf-head', h('span', ''), h('span', 'F'), h('span.gap', 'not stored'), h('span', 'L')));
      const body = h('div.lf-body', { style: { height: n * rowH + 'px' } }, rowsNum, colF, colMid, colL, svg);
      grid.appendChild(body);
      wrap.appendChild(grid);
      const textBox = h('div.lf-text', h('div.bwt-label', 'Text so far'), h('div.tiles.lf-tiles'));
      wrap.appendChild(textBox);
      const NS = 'http://www.w3.org/2000/svg';
      function lines(f) {
        svg.innerHTML = '';
        const bw = body.clientWidth, fx = colF.offsetLeft + colF.offsetWidth, lx = colL.offsetLeft;
        svg.setAttribute('width', bw);
        svg.setAttribute('height', n * rowH);
        const y = (r) => r * rowH + size / 2;
        const add = (r1, r2, cls) => {
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', `M ${lx - 4} ${y(r1)} C ${(lx + fx) / 2} ${y(r1)}, ${(lx + fx) / 2} ${y(r2)}, ${fx + 4} ${y(r2)}`);
          p.setAttribute('class', cls);
          svg.appendChild(p);
        };
        if (f.links) for (let r = 0; r < n; r++) add(r, data.fm.C[L[r]] + lRank[r], 'lk lk-' + (L[r] === '$' ? 'S' : L[r]));
        if (f.link) add(f.link.from, f.link.to, 'lk on');
      }
      return {
        update(f, prev, ctx) {
          colF.classList.toggle('hide', !f.showF);
          wrap.classList.toggle('ranks', !!f.ranks);
          colF.querySelectorAll('.lf-cell').forEach((c, r) => {
            c.classList.toggle('row', f.row === r || (f.link && f.link.to === r && !ctx.asking));
            c.classList.toggle('pickable', !!ctx.asking);
          });
          colL.querySelectorAll('.lf-cell').forEach((c, r) => c.classList.toggle('row', f.row === r));
          rowsNum.querySelectorAll('.lf-num').forEach((c, r) => c.classList.toggle('row', f.row === r));
          stage.classList.toggle('picking', !!ctx.asking);
          lines(ctx.asking ? Object.assign({}, f, { link: null }) : f);
          const tiles = textBox.querySelector('.lf-tiles');
          tiles.innerHTML = '';
          (f.text || '').split('').forEach((c, k) => tiles.appendChild(h('span', { class: V.tileClass(c) }, c)));
          textBox.classList.toggle('on', !!f.text);
          // the letter read from L flies to the front of the text
          if (prev && f.text && prev.text && f.text.length === prev.text.length + 1 && !ctx.back && f.row != null) {
            const src = colL.querySelectorAll('.lf-cell')[f.row];
            V.fly(src && src.querySelector('.tile'), tiles.firstChild, ctx, { ms: 650 });
          }
        }
      };
    }
  });
  function ordinal(r) {
    return ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][r] || r + 1 + 'th';
  }

  /* ==================================================================
     3. Searching with the FM-index: backward search
     ================================================================== */
  V.define('fm', {
    title: 'Backward search with the FM-index',
    sub: 'How BWA and Bowtie find a read in the BWT',
    inputs: [
      TEXT_FIELD,
      { key: 'pattern', label: 'Pattern (the read)', type: 'seq', letters: 'ACGT', min: 1, max: 8, default: 'ATA' },
      { key: 'sample', label: 'Suffix array kept', type: 'select', options: [['1', 'all of it'], ['2', 'every 2nd value (a sample)'], ['3', 'every 3rd value (a sample)']], default: '1', help: 'Real indexes keep only a sample, to save memory; the rest is found by LF steps.' }
    ],
    presets: {
      ataata: { label: 'ATA in ATAATA', input: { text: 'ATAATA', pattern: 'ATA' } },
      once: { label: 'TAAT in ATAATA (once)', input: { text: 'ATAATA', pattern: 'TAAT' } },
      absent: { label: 'ATT in ATAATA (not there)', input: { text: 'ATAATA', pattern: 'ATT' } },
      genome: { label: 'GCA in TGCATGCATTGCA', input: { text: 'TGCATGCATTGCA', pattern: 'GCA' } },
      sample: { label: 'With a sampled suffix array', input: { text: 'TGCATGCATTGCA', pattern: 'GCA', sample: '3' } }
    },
    practice: true,
    code: [
      'top, bottom = 0, len(L)          # every row',
      'for c in reversed(pattern):',
      '    top    = C[c] + Occ(c, top)    # c’s in L above the range',
      '    bottom = C[c] + Occ(c, bottom) # c’s in L up to its end',
      '    if top >= bottom: not found',
      'positions = [SA[r] for r in range(top, bottom)]'
    ],
    build(input, mode) {
      const fm = A.fmIndex(input.text);
      const P = input.pattern;
      const res = A.backwardSearch(fm, P);
      const every = +input.sample || 1;
      const n = fm.n;
      const frames = [];
      const base = { top: 0, bottom: n, pi: null, phase: 'start', hlL: null, occAt: null, showSA: false, found: null, locate: null, show: [] };
      const F = (o) => frames.push(Object.assign({}, base, o));
      const rowsTxt = (t, b) => (b - t <= 0 ? 'no rows' : b - t === 1 ? `row ${t}` : `rows ${t} to ${b - 1}`);
      F({ line: 0, narr: `The index of ${seq(fm.t)}: the sorted rotations (only the last column <b>L</b> is stored; the first column <b>F</b> follows from the counts <b>C</b>), the counts <b>C</b> (how many letters are smaller) and the running counts <b>Occ</b> of each letter in L. We look for ${seq(P)}, starting from its <b>last</b> letter.` });
      F({ line: 0, narr: `At first every row is possible: the range is ${rowsTxt(0, n)}.`, top: 0, bottom: n });
      let top = 0, bottom = n;
      for (const s of res.steps) {
        const c = s.c;
        if (!s.known) {
          F({ pi: s.i, top, bottom, line: [2, 3], narr: `${seq(c)} does not occur in the text at all – ${seq(P)} cannot be there.`, found: false });
          break;
        }
        F({ pi: s.i, top, bottom, phase: 'look', hlL: c, line: 1, narr: s.suffix.length > 1 ? `Next letter of the pattern (from the right): ${seq(c)}. Which rows in the range have ${seq(c)} in <b>L</b>? In those rows ${seq(c)} stands just before ${seq(s.suffix.slice(1))}, the part matched so far.` : `The last letter of the pattern: ${seq(c)}. The range is the whole table, and the rows that start with ${seq(c)} are the ${seq(c)} block of <b>F</b>: count the ${seq(c)}’s of L to find it.` });
        F({ pi: s.i, top, bottom, phase: 'count', hlL: c, occAt: [top, bottom], line: [2, 3], narr: `Count ${seq(c)}’s in L: <b>Occ(${esc(c)}, ${top}) = ${s.occTop}</b> above the range, <b>Occ(${esc(c)}, ${bottom}) = ${s.occBottom}</b> down to its end – so ${s.occBottom - s.occTop} row${s.occBottom - s.occTop === 1 ? ' in the range ends' : 's in the range end'} with ${seq(c)}.`, dwell: 1.5 });
        if (mode === 'practice') {
          F({
            pi: s.i, top, bottom, phase: 'count', hlL: c, occAt: [top, bottom], line: [2, 3],
            narr: `LF mapping takes those ${seq(c)}’s to the ${seq(c)} block of F, which starts at row C[${esc(c)}] = ${s.Cc}.`,
            ask: s.top < s.bottom
              ? { type: 'fields', fields: [{ label: 'first row', answer: s.top }, { label: 'last row', answer: s.bottom - 1 }], prompt: `Which rows start with ${seq(s.suffix)}? Give the first and the last row of the new range.`, hint: `First row = C[${esc(c)}] + Occ(${esc(c)}, top); last row = C[${esc(c)}] + Occ(${esc(c)}, bottom) − 1.`, explain: `C[${esc(c)}] + ${s.occTop} = ${s.top} to C[${esc(c)}] + ${s.occBottom} − 1 = ${s.bottom - 1}.` }
              : { type: 'choice', options: [['none', 'No row – the pattern is not there'], ['some', 'Some rows remain']], answer: 'none', prompt: `How many rows start with ${seq(s.suffix)}?`, hint: `Occ(${esc(c)}, top) and Occ(${esc(c)}, bottom) are equal: no ${esc(c)} in the range.`, explain: 'The range is empty.' }
          });
        }
        top = s.top;
        bottom = s.bottom;
        F({ pi: s.i, top, bottom, phase: 'map', hlL: null, line: [2, 3], narr: s.top < s.bottom ? `New range: C[${esc(c)}] + ${s.occTop} = <b>${s.top}</b> … C[${esc(c)}] + ${s.occBottom} − 1 = <b>${s.bottom - 1}</b>. These rows start with ${seq(s.suffix)}.` : `The range is empty: no rotation starts with ${seq(s.suffix)}, so ${seq(P)} is not in the text. (Found out after ${P.length - s.i} of ${P.length} letters.)`, found: s.top < s.bottom ? null : false, dwell: 1.3 });
        if (s.top >= s.bottom) break;
      }
      if (res.found) {
        const k = bottom - top;
        F({ top, bottom, phase: 'done', line: 5, narr: `The whole pattern is matched: ${k} row${k === 1 ? '' : 's'} – ${seq(P)} occurs <b>${k === 1 ? 'once' : k === 2 ? 'twice' : k + ' times'}</b>. Counting needed only ${P.length} steps, however long the text.`, found: true });
        if (every === 1) {
          F({ top, bottom, phase: 'done', showSA: true, line: 5, narr: `Where? The suffix array gives each row’s start in the text: <b>${res.positions.join(', ')}</b>.`, found: true, show: res.positions });
        } else {
          const located = [];
          for (let r = top; r < bottom; r++) {
            const loc = A.locate(fm, r, every);
            if (loc.steps === 0) F({ top, bottom, phase: 'done', showSA: true, sampled: every, locate: { row: r, walk: [] }, line: 5, narr: `Row ${r}: its suffix-array value is kept – position <b>${loc.position}</b>.`, found: true, show: located.slice() });
            else {
              F({ top, bottom, phase: 'done', showSA: true, sampled: every, locate: { row: r, walk: loc.walk.map((w) => w.row).concat([loc.sampledRow]) }, line: 5, narr: `Row ${r}: its value was not kept. LF steps go one letter left in the text each time: ${loc.walk.map((w) => 'row ' + w.row).join(' → ')} → row ${loc.sampledRow}, whose value is kept: ${loc.value}. Position = ${loc.value} + ${loc.steps} step${loc.steps > 1 ? 's' : ''} = <b>${loc.position}</b>.`, found: true, show: located.slice(), dwell: 1.8 });
            }
            located.push(loc.position);
          }
          F({ top, bottom, phase: 'done', showSA: true, sampled: every, line: 5, narr: `Positions: <b>${located.slice().sort((a, b) => a - b).join(', ')}</b>. Keeping every ${every === 2 ? '2nd' : '3rd'} value saves memory and costs a few LF steps.`, found: true, show: located });
        }
      }
      return { frames, data: { fm, P, res, every } };
    },
    view(stage, data) {
      const fm = data.fm, n = fm.n, P = data.P;
      const alph = fm.alphabet;
      const wrap = h('div.fm');
      stage.appendChild(wrap);
      const cols = n + alph.length + 6;
      const size = Math.max(22, Math.min(34, Math.floor(((stage.clientWidth || 640) - 40) / cols), Math.floor(((stage.clientHeight || 560) - 150) / (n + 2))));
      stage.style.setProperty('--cell', size + 'px');
      // the pattern
      const pat = h('div.fm-pat', h('span.bwt-label', 'Pattern'), h('div.tiles', P.split('').map((c) => h('span', { class: V.tileClass(c) }, c))));
      // C
      const ctab = h('div.fm-c', h('span.bwt-label', 'C'), alph.map((c) => h('span.fm-cc', { 'data-c': c }, h('b', c === '$' ? '$' : c), h('span', String(fm.C[c])))));
      wrap.appendChild(h('div.fm-top', pat, ctab));
      // the table: row, SA, F … L, Occ per letter
      const tbl = h('table.fm-t');
      const head = h('tr', h('th', 'row'), h('th.sa', 'SA'), h('th', 'F'), h('th.mid', ''), h('th', 'L'), alph.filter((c) => c !== '$').map((c) => h('th.occ', { 'data-c': c }, 'Occ ' + c)));
      tbl.appendChild(h('thead', head));
      const tb = h('tbody');
      // one more row on top for Occ(c, 0) = 0, which the formula uses
      const zero = h('tr.zero', h('td', ''), h('td.sa', ''), h('td', ''), h('td.mid', ''), h('td', ''), alph.filter((c) => c !== '$').map((c) => h('td.occ', { 'data-c': c, 'data-i': '0' }, '0')));
      tb.appendChild(zero);
      const trs = [];
      for (let r = 0; r < n; r++) {
        const row = fm.rows[r];
        const tr = h('tr', { 'data-r': String(r) },
          h('td.rn', String(r)),
          h('td.sa', { 'data-sa': String(fm.sa[r]) }, String(fm.sa[r])),
          h('td.Fc', h('span', { class: V.tileClass(row[0]) }, row[0])),
          h('td.mid', h('span.midtxt', row.slice(1, -1))),
          h('td.Lc', h('span', { class: V.tileClass(row[n - 1]) }, row[n - 1])),
          alph.filter((c) => c !== '$').map((c) => h('td.occ', { 'data-c': c, 'data-i': String(r + 1) }, String(fm.occ[c][r + 1]))));
        tb.appendChild(tr);
        trs.push(tr);
      }
      tbl.appendChild(tb);
      const tableWrap = h('div.fm-tw', tbl, h('div.fm-range'));
      wrap.appendChild(tableWrap);
      const result = h('div.fm-res');
      wrap.appendChild(result);
      const range = tableWrap.querySelector('.fm-range');
      return {
        update(f, prev, ctx) {
          // the pattern: letters done, the current one
          pat.querySelectorAll('.tiles > span').forEach((t, i) => {
            t.classList.toggle('cur', f.pi === i);
            t.classList.toggle('done', f.pi != null ? i > f.pi : f.phase === 'done');
          });
          // the range
          const ok = f.top < f.bottom;
          trs.forEach((tr, r) => {
            tr.classList.toggle('inrange', ok && r >= f.top && r < f.bottom);
            const lc = tr.querySelector('.Lc span');
            lc.classList.toggle('hl', !!f.hlL && r >= f.top && r < f.bottom && fm.L[r] === f.hlL);
            tr.classList.toggle('loc', !!(f.locate && f.locate.walk.concat([f.locate.row]).includes(r)));
          });
          // Occ cells used by the formula: the rows just above the range and at its end
          tbl.querySelectorAll('td.occ').forEach((td) => td.classList.remove('use'));
          if (f.occAt && f.hlL) f.occAt.forEach((i) => {
            const td = tbl.querySelector(`td.occ[data-c="${f.hlL}"][data-i="${i}"]`);
            if (td) td.classList.add('use');
          });
          tbl.querySelectorAll('th.occ').forEach((th) => th.classList.toggle('use', th.dataset.c === f.hlL));
          ctab.querySelectorAll('.fm-cc').forEach((e) => e.classList.toggle('use', f.phase === 'map' && f.pi != null && e.dataset.c === P[f.pi]));
          // the bracket of the range
          const first = trs[0];
          if (ok && first) {
            const y0 = trs[f.top].offsetTop, y1 = trs[f.bottom - 1].offsetTop + trs[f.bottom - 1].offsetHeight;
            range.style.transform = `translateY(${y0}px)`;
            range.style.height = Math.max(4, y1 - y0) + 'px';
            range.classList.remove('empty');
          } else range.classList.add('empty');
          wrap.classList.toggle('showSA', !!f.showSA);
          tbl.querySelectorAll('td.sa').forEach((td, k) => {
            const r = k - 1; // the first td.sa is the zero row
            if (r < 0) return;
            const kept = !f.sampled || fm.sa[r] % f.sampled === 0;
            td.classList.toggle('dropped', !kept);
          });
          result.innerHTML = '';
          if (f.found === false) result.appendChild(h('div.fm-none', 'Not in the text.'));
          if (f.show && f.show.length) {
            const tl = h('div.tiles.fm-hit');
            const hits = new Set();
            f.show.forEach((p) => {
              for (let k = 0; k < P.length; k++) hits.add(p + k);
            });
            fm.t.split('').forEach((c, i) => tl.appendChild(h('span.tilebox', h('span.posn', String(i)), h('span', { class: V.tileClass(c) + (hits.has(i) ? ' hit' : '') }, c))));
            result.appendChild(h('span.bwt-label', 'Text'));
            result.appendChild(tl);
          }
        }
      };
    }
  });
})();
