/* =====================================================================
   Comparing sequences without aligning them: k-mer sets and Jaccard
   similarity, Bloom filters, MinHash sketches.
   ===================================================================== */
(function () {
  'use strict';
  const MG = window.MG;
  const { h, esc } = MG;
  const V = MG.viz;
  const A = MG.algo;
  const seq = V.seq;
  const dec = (x) => String(Number(x.toFixed(3)));
  const SA = 'ACGTTGCATGCCAT', SB = 'ACGTTGGATGCCAT';
  /** 3, 5 and 12 */
  const listAnd = (xs) => (xs.length < 2 ? String(xs[0]) : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);

  /** move an element to a new parent, sliding it from where it was (FLIP) */
  function moveTo(el, parent, ctx) {
    if (el.parentNode === parent) return;
    const before = el.isConnected ? el.getBoundingClientRect() : null;
    parent.appendChild(el);
    if (!before || !before.width) return;
    const after = el.getBoundingClientRect();
    const dx = before.left - after.left, dy = before.top - after.top;
    if (dx || dy) V.anim(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], 520, ctx);
  }
  /** a k-mer as a small chip of letter tiles */
  const chip = (w, cls) => h('span.km-chip' + (cls ? '.' + cls : ''), { 'data-w': w }, V.tiles(w, 'mini'));

  /* ==================================================================
     k-mer sets and the Jaccard similarity
     ================================================================== */
  V.define('kmers', {
    title: 'k-mers: comparing without aligning',
    sub: 'Break both sequences into k-mers; how much do the two sets share?',
    inputs: [
      { key: 'a', label: 'Sequence A', type: 'seq', letters: 'ACGT', min: 4, max: 18, default: SA },
      { key: 'b', label: 'Sequence B', type: 'seq', letters: 'ACGT', min: 4, max: 18, default: SB },
      { key: 'k', label: 'k', type: 'number', min: 2, max: 6, default: 3 }
    ],
    presets: {
      snp: { label: 'One difference, k = 3', input: { a: SA, b: SB, k: 3 } },
      snp4: { label: 'The same, k = 4', input: { a: SA, b: SB, k: 4 } },
      shuffled: { label: 'The same letters in another order', input: { a: 'ACGTTGCATGCCAT', b: 'CATGCCATACGTTG', k: 3 } },
      other: { label: 'Two unrelated sequences', input: { a: SA, b: 'GGATCCTTAAGTCA', k: 3 } }
    },
    practice: true,
    check(input) {
      const k = Number(input.k);
      if (!(k >= 2 && k <= 6)) return 'k from 2 to 6.';
      if (String(input.a).length < k || String(input.b).length < k) return 'Each sequence needs at least k letters.';
      return null;
    },
    code: [
      'set A = the distinct k-mers of A (each counted once)',
      'set B = the distinct k-mers of B',
      'shared = the k-mers in both;  all = the k-mers in either',
      'Jaccard similarity J = |shared| / |all|        (1: same set, 0: nothing in common)'
    ],
    build(input, mode) {
      const a = String(input.a).toUpperCase(), b = String(input.b).toUpperCase(), k = Number(input.k);
      const frames = [];
      const F = (o) => frames.push(Object.assign({ seqA: 0, seqB: 0, winA: null, winB: null, cur: null, note: null, res: false }, o));
      F({ line: null, narr: `Two sequences. Instead of aligning them, cut each into its k-mers (here k = ${k}) and compare the two <b>sets</b>. The order of the k-mers is forgotten – a “bag of words”.` });
      const nA = a.length - k + 1, nB = b.length - k + 1;
      const seenA = new Set();
      for (let i = 0; i < nA; i++) {
        const w = a.slice(i, i + k);
        const rep = seenA.has(w);
        seenA.add(w);
        F({ seqA: i + 1, winA: i, cur: w, line: 0, narr: rep ? `${seq(w)} again: a set holds each k-mer once.` : `A, position ${i}: ${seq(w)} goes into set A.`, dwell: i < 3 ? 0.8 : 0.35 });
      }
      const seenB = new Set();
      for (let i = 0; i < nB; i++) {
        const w = b.slice(i, i + k);
        const rep = seenB.has(w);
        seenB.add(w);
        F({ seqA: nA, seqB: i + 1, winB: i, cur: w, line: [1, 2], narr: rep ? `${seq(w)} again: already counted.` : seenA.has(w) ? `B, position ${i}: ${seq(w)} is in A too – <b>shared</b>.` : `B, position ${i}: ${seq(w)} is not in A.`, dwell: i < 3 ? 0.8 : 0.35 });
      }
      const J = A.jaccard(A.kmerSet(a, k), A.kmerSet(b, k));
      if (mode === 'practice') {
        F({ seqA: nA, seqB: nB, line: 2, narr: 'Count the k-mers.', ask: { type: 'fields', fields: [{ label: 'shared', answer: J.both.length }, { label: 'in either', answer: J.union }], prompt: 'How many k-mers are shared, and how many are in either set (the union)?', hint: 'Shared: the middle group. In either: all three groups together, each k-mer once.', explain: `${J.both.length} shared; ${J.onlyA.length} + ${J.both.length} + ${J.onlyB.length} = ${J.union} in all.` } });
        F({ seqA: nA, seqB: nB, line: 3, narr: 'And the Jaccard similarity?', ask: { type: 'number', answer: Math.round(J.j * 1000) / 1000, tol: 0.006, prompt: 'What is J = shared / in either? (Two or three decimals.)', hint: `${J.both.length} divided by ${J.union}.`, explain: `${J.both.length} / ${J.union} = ${dec(J.j)}.` } });
      }
      const diffNote = a.length === b.length && A.range(a.length).filter((i) => a[i] !== b[i]).length === 1
        ? ` One different letter changes every k-mer that covers it – up to ${k} of them – so the larger k, the lower J for the same difference.`
        : '';
      F({ seqA: nA, seqB: nB, res: true, line: 3, narr: `J = ${J.both.length} / ${J.union} = <b>${dec(J.j)}</b>.${diffNote} Comparing k-mer sets takes one pass through each sequence, however long – no matrix. Mash, sourmash and Kraken compare whole genomes or sort reads by species this way.`, dwell: 2 });
      return { frames, data: { a, b, k, J } };
    },
    view(stage, data) {
      const { a, b, k, J } = data;
      const box = h('div.km');
      // letters as large as the longer sequence allows
      const W = stage.clientWidth || 700;
      box.style.setProperty('--cell', Math.max(18, Math.min(32, Math.floor((W - 60) / Math.max(a.length, b.length)) - 3)) + 'px');
      const mkSeq = (s, name) => {
        const lane = h('div.km-lane');
        const t = V.tiles(s, '');
        lane.appendChild(t);
        const win = h('div.km-win');
        lane.appendChild(win);
        box.appendChild(h('div.km-seq', h('span.km-name', name), lane));
        return { t: Array.from(t.children), win, lane };
      };
      const SAv = mkSeq(a, 'A');
      const SBv = mkSeq(b, 'B');
      const cols = {};
      const grid = h('div.km-sets');
      [['onlyA', 'only in A'], ['both', 'in both'], ['onlyB', 'only in B']].forEach(([key, lab]) => {
        const c = h('div.km-col.' + key, h('div.km-h', lab), h('div.km-body'));
        cols[key] = { el: c, body: c.lastChild, head: c.firstChild };
        grid.appendChild(c);
      });
      box.appendChild(grid);
      const res = h('div.km-res');
      box.appendChild(res);
      stage.appendChild(box);
      const chips = {};
      const placeWin = (S, i) => {
        if (i == null) return (S.win.hidden = true);
        S.win.hidden = false;
        const t0 = S.t[i], t1 = S.t[i + k - 1];
        S.win.style.left = t0.offsetLeft - 3 + 'px';
        S.win.style.width = t1.offsetLeft + t1.offsetWidth - t0.offsetLeft + 6 + 'px';
      };
      return {
        update(f, prev, ctx) {
          placeWin(SAv, f.winA);
          placeWin(SBv, f.winB);
          SAv.t.forEach((el, i) => el.classList.toggle('dim', f.winA != null && (i < f.winA || i >= f.winA + k)));
          SBv.t.forEach((el, i) => el.classList.toggle('dim', f.winB != null && (i < f.winB || i >= f.winB + k)));
          // the sets so far
          const setA = A.kmerSet(a.slice(0, f.seqA + k - 1), k);
          const setB = f.seqB ? A.kmerSet(b.slice(0, f.seqB + k - 1), k) : [];
          const inA = new Set(setA), inB = new Set(setB);
          const where = {};
          setA.forEach((w) => (where[w] = inB.has(w) ? 'both' : 'onlyA'));
          setB.forEach((w) => (where[w] = inA.has(w) ? 'both' : 'onlyB'));
          Object.keys(chips).forEach((w) => {
            if (!where[w]) {
              chips[w].remove();
              delete chips[w];
            }
          });
          Object.entries(where).forEach(([w, c]) => {
            let el = chips[w];
            const fresh = !el;
            if (fresh) {
              el = chips[w] = chip(w);
              cols[c].body.appendChild(el);
              // a new k-mer slides down from the window that found it
              const src = f.winB != null && w === f.cur ? SBv : f.winA != null && w === f.cur ? SAv : null;
              if (src && !ctx.instant && !ctx.back) {
                const r0 = src.win.getBoundingClientRect(), r1 = el.getBoundingClientRect();
                V.anim(el, [{ transform: `translate(${r0.left - r1.left}px, ${r0.top - r1.top}px)`, opacity: 0.4 }, { transform: 'none', opacity: 1 }], 560, ctx);
              }
            } else moveTo(el, cols[c].body, ctx);
            el.classList.toggle('cur', w === f.cur);
          });
          // keep each group in the order of first appearance
          ['onlyA', 'both', 'onlyB'].forEach((c) => {
            const order = (c === 'onlyB' ? setB : setA.concat(setB)).filter((w, i, arr) => where[w] === c && arr.indexOf(w) === i);
            order.forEach((w) => chips[w] && chips[w].parentNode === cols[c].body && cols[c].body.appendChild(chips[w]));
            const n = order.length;
            cols[c].head.textContent = `${{ onlyA: 'only in A', both: 'in both', onlyB: 'only in B' }[c]} (${n})`;
          });
          const asking = f.ask && ctx.asking;
          res.innerHTML = f.res ? `J = |shared| / |in either| = ${J.both.length} / ${J.union} = <b>${dec(J.j)}</b>` : '';
          if (asking) Object.values(cols).forEach((c) => (c.head.textContent = c.head.textContent.replace(/\(\d+\)/, '(?)')));
        }
      };
    }
  });

  /* ==================================================================
     A Bloom filter
     ================================================================== */
  V.define('bloom', {
    title: 'A Bloom filter',
    sub: 'A row of bits that answers “is this k-mer in the set?” – no, or probably',
    inputs: [
      { key: 'a', label: 'Sequence whose k-mers go in', type: 'seq', letters: 'ACGT', min: 4, max: 18, default: SA },
      { key: 'b', label: 'Sequence whose k-mers are looked up', type: 'seq', letters: 'ACGT', min: 3, max: 18, default: SB },
      { key: 'k', label: 'k', type: 'number', min: 2, max: 5, default: 3 },
      { key: 'm', label: 'Bits', type: 'number', min: 8, max: 32, default: 16 },
      { key: 'nh', label: 'Hash functions', type: 'number', min: 1, max: 3, default: 2 }
    ],
    presets: {
      small: { label: '16 bits, two hash functions', input: { a: SA, b: SB, k: 3, m: 16, nh: 2 } },
      more: { label: '32 bits, two hash functions', input: { a: SA, b: SB, k: 3, m: 32, nh: 2 } },
      three: { label: '16 bits, three hash functions', input: { a: SA, b: SB, k: 3, m: 16, nh: 3 } }
    },
    practice: true,
    check(input) {
      const k = Number(input.k);
      if (String(input.a).length < k || String(input.b).length < k) return 'Each sequence needs at least k letters.';
      return null;
    },
    codeFor(input) {
      const nh = Number(input.nh), m = Number(input.m);
      const hs = A.range(nh).map((i) => `h${i + 1}(w) = (${A.HASH_AB[i][0]} × code(w) + ${A.HASH_AB[i][1]}) mod ${m}`);
      return ['bits = ' + m + ' zeros', 'code(w) = the k-mer as a number in base 4 (A 0, C 1, G 2, T 3)'].concat(hs, ['add w: set the bits h1(w)' + (nh > 1 ? ' … h' + nh + '(w)' : '') + ' to 1', 'look up w: if any of its bits is 0 → definitely not in the set', '           if all are 1 → possibly in the set (or a false positive)']);
    },
    build(input, mode) {
      const a = String(input.a).toUpperCase(), b = String(input.b).toUpperCase();
      const k = Number(input.k), m = Number(input.m), nh = Number(input.nh);
      const setA = A.kmerSet(a, k), setB = A.kmerSet(b, k);
      const bl = A.bloom(setA, setB, m, nh);
      const L0 = 2 + nh; // code line of "add w"
      const frames = [];
      const F = (o) => frames.push(Object.assign({ ins: 0, q: 0, cur: null, mode: null }, o));
      const calc = (x) => `code(${x.w}) = ${x.code}; ` + x.ix.map((v, i) => `h${i + 1} = (${A.HASH_AB[i][0]} × ${x.code} + ${A.HASH_AB[i][1]}) mod ${m} = ${v}`).join('; ');
      F({ line: 0, narr: `A Bloom filter (Bloom, 1970) stores a set in just ${m} bits – here the ${setA.length} distinct ${k}-mers of A. It cannot list what it holds, but it can answer “is this one in?” very fast, in very little memory.` });
      setA.forEach((w, i) => {
        const x = bl.inserts[i];
        if (mode === 'practice' && i === 0) F({ ins: i, cur: { kind: 'ins', i }, hide: true, line: [1, 2], narr: `Add ${seq(w)}.`, ask: { type: 'fields', fields: x.ix.map((v, j) => ({ label: 'h' + (j + 1), answer: v })), prompt: `Which bits does ${w} set? code(${w}) = ${x.code}.`, hint: `h1 = (${A.HASH_AB[0][0]} × ${x.code} + ${A.HASH_AB[0][1]}) mod ${m}: multiply, add, and take the remainder after dividing by ${m}.`, explain: calc(x) + '.' } });
        // the bits it sets (two hash functions may give the same bit), and how many were set already
        const uniq = Array.from(new Set(x.ix));
        const wasU = uniq.map((b) => x.was[x.ix.indexOf(b)]);
        const already = wasU.filter(Boolean).length;
        const setSay = uniq.length === 1 && nh > 1 ? `${nh === 2 ? 'both' : 'all ' + nh} hash functions give bit ${uniq[0]}: set it to 1` : `set bit${uniq.length > 1 ? 's' : ''} ${listAnd(uniq)} to 1`;
        const wasSay = !already ? '' : already === uniq.length ? (uniq.length === 1 ? ' (It was 1 already.)' : uniq.length === 2 ? ' (Both were 1 already.)' : ' (All were 1 already.)') : already === 1 ? ' (One was 1 already.)' : ` (${already} were 1 already.)`;
        F({ ins: i + 1, cur: { kind: 'ins', i }, line: [1, 2, L0], narr: `Add ${seq(w)}: ${calc(x)} – ${setSay}.${wasSay}`, dwell: i < 2 ? 1.1 : 0.45 });
      });
      F({ ins: setA.length, line: L0, narr: `All ${setA.length} k-mers are in: ${bl.ones} of the ${m} bits are 1. The k-mers themselves are not stored at all.` });
      let askedQ = false;
      setB.forEach((w, i) => {
        const x = bl.checks[i];
        const res = !x.all ? 'definitely <b>not</b> in A: one of its bits is 0' : x.truth ? `all its bits are 1: <b>possibly in A</b> – and it is` : `all its bits are 1: <b>possibly in A</b> – but it is not! A <b>false positive</b>: other k-mers set those bits`;
        if (mode === 'practice' && !askedQ && (!x.all || x.fp)) {
          askedQ = true;
          F({ ins: setA.length, q: i, cur: { kind: 'q', i }, hide: true, line: [L0 + 1, L0 + 2], narr: `Look up ${seq(w)}.`, ask: { type: 'choice', options: [['no', 'definitely not in A'], ['maybe', 'possibly in A']], answer: x.all ? 'maybe' : 'no', prompt: `${calc(x)}. What does the filter say?`, hint: 'Look at its bits: is any of them 0?', explain: x.all ? `All of bits ${x.ix.join(', ')} are 1: possibly in A.${x.fp ? ' (In fact it is not – a false positive.)' : ''}` : `Bit ${x.ix.find((v) => !bl.bits[v])} is 0: definitely not in A.` } });
        }
        F({ ins: setA.length, q: i + 1, cur: { kind: 'q', i }, line: x.all ? L0 + 2 : L0 + 1, narr: `Look up ${seq(w)}: ${calc(x)} – ${res}.`, dwell: i < 2 || x.fp ? 1.2 : 0.45 });
      });
      const fps = bl.checks.filter((c) => c.fp).length, nos = bl.checks.filter((c) => !c.all).length;
      F({ ins: setA.length, q: setB.length, line: null, narr: `Of the ${setB.length} k-mers of B, ${nos} ${nos === 1 ? 'was' : 'were'} turned away for certain and ${fps ? `${fps} ${fps === 1 ? 'was a false positive' : 'were false positives'}` : 'none was a false positive'}. A Bloom filter never misses a k-mer that is in the set, but sometimes says yes to one that is not. With n k-mers, m bits and h hash functions, the chance of a false positive is about (1 − e<sup>−hn/m</sup>)<sup>h</sup> – here ${dec(bl.fpRate)}. More bits make it smaller; more hash functions help only up to a point, because each sets more bits. BIGSI and COBS keep a Bloom filter per genome, to find which of hundreds of thousands of genomes contain a sequence.`, dwell: 2 });
      return { frames, data: { setA, setB, bl, m, nh, k } };
    },
    view(stage, data) {
      const { setA, setB, bl, m, nh } = data;
      const box = h('div.bf');
      const top = h('div.bf-top');
      const listA = h('div.bf-list');
      const listB = h('div.bf-list');
      top.appendChild(h('div.bf-side', h('div.viz-label', 'k-mers of A, added'), listA));
      top.appendChild(h('div.bf-side', h('div.viz-label', 'k-mers of B, looked up'), listB));
      box.appendChild(top);
      const calc = h('div.bf-calc');
      box.appendChild(calc);
      const W = stage.clientWidth || 700;
      const bw = Math.max(18, Math.min(36, Math.floor((W - 40) / m) - 3));
      const bitsBox = h('div.bf-bits', { style: { '--bw': bw + 'px' } });
      const bits = A.range(m).map((i) => {
        const el = h('div.bf-bit', h('span.bf-v', '0'), h('span.bf-i', String(i)));
        bitsBox.appendChild(el);
        return el;
      });
      box.appendChild(h('div.viz-label', `The filter: ${m} bits`));
      box.appendChild(bitsBox);
      stage.appendChild(box);
      const chipsA = setA.map((w, i) => {
        const c = h('div.bf-item', chip(w), h('span.bf-ix', bl.inserts[i].ix.join(', ')));
        listA.appendChild(c);
        return c;
      });
      const chipsB = setB.map((w, i) => {
        const x = bl.checks[i];
        const tag = !x.all ? h('span.bf-tag.no', 'no') : x.fp ? h('span.bf-tag.fp', 'false +') : h('span.bf-tag.yes', 'yes');
        const c = h('div.bf-item', chip(w), h('span.bf-ix', x.ix.join(', ')), tag);
        listB.appendChild(c);
        return c;
      });
      return {
        update(f, prev, ctx) {
          // the bits set by the k-mers added so far
          const set = new Array(m).fill(0);
          bl.inserts.slice(0, f.ins).forEach((x) => x.ix.forEach((v) => (set[v] = 1)));
          const curX = f.cur ? (f.cur.kind === 'ins' ? bl.inserts[f.cur.i] : bl.checks[f.cur.i]) : null;
          const hide = !!(f.hide && ctx.asking);
          bits.forEach((el, i) => {
            const was = el.classList.contains('one');
            el.classList.toggle('one', !!set[i]);
            el.firstChild.textContent = String(set[i]);
            const hit = curX && !hide && curX.ix.includes(i);
            el.classList.toggle('hit', !!hit);
            el.classList.toggle('zero', !!hit && !set[i]);
            if (!was && set[i] && !ctx.instant && !ctx.back) V.anim(el, [{ transform: 'scale(1.3)', background: '#ffe6cc' }, { transform: 'none' }], 450, ctx);
          });
          chipsA.forEach((c, i) => {
            c.classList.toggle('on', i < f.ins);
            c.classList.toggle('cur', !!f.cur && f.cur.kind === 'ins' && f.cur.i === i);
            c.classList.toggle('hideix', hide && f.cur.i === i);
          });
          chipsB.forEach((c, i) => {
            c.classList.toggle('on', i < f.q);
            c.classList.toggle('cur', !!f.cur && f.cur.kind === 'q' && f.cur.i === i);
            c.classList.toggle('pend', !!f.cur && f.cur.kind === 'q' && f.cur.i === i && hide);
          });
          calc.innerHTML = curX && !hide ? `<b>${esc(curX.w)}</b>: code ${curX.code} → bit${nh > 1 ? 's' : ''} ${curX.ix.join(', ')}` : curX ? `<b>${esc(curX.w)}</b>: code ${curX.code} → bits ?` : '';
        }
      };
    }
  });

  /* ==================================================================
     MinHash
     ================================================================== */
  V.define('minhash', {
    title: 'MinHash: a small sketch of a big set',
    sub: 'Keep only the smallest hash values – they estimate the Jaccard similarity',
    inputs: [
      { key: 'a', label: 'Sequence A', type: 'seq', letters: 'ACGT', min: 4, max: 18, default: SA },
      { key: 'b', label: 'Sequence B', type: 'seq', letters: 'ACGT', min: 4, max: 18, default: SB },
      { key: 'k', label: 'k', type: 'number', min: 2, max: 4, default: 3 },
      { key: 'method', label: 'Sketch', type: 'select', options: [['many', 'one minimum from each of several hash functions'], ['bottom', 'the s smallest values of one hash function (as Mash)']], default: 'many' },
      { key: 'n', label: 'Hash functions, or s', type: 'number', min: 2, max: 12, default: 8 }
    ],
    presets: {
      many: { label: 'Eight hash functions', input: { a: SA, b: SB, k: 3, method: 'many', n: 8 } },
      bottom: { label: 'A bottom-5 sketch, as Mash', input: { a: SA, b: SB, k: 3, method: 'bottom', n: 5 } }
    },
    practice: true,
    check(input) {
      const k = Number(input.k);
      if (String(input.a).length < k || String(input.b).length < k) return 'Each sequence needs at least k letters.';
      return null;
    },
    codeFor(input) {
      return input.method === 'bottom'
        ? ['h(w) = (3 × code(w) + 1) mod M          one hash function', 'sketch(A) = the s smallest values of h over the k-mers of A', 'sketch(B) = the same for B', 'U = the s smallest values of sketch(A) and sketch(B) together', 'J ≈ (values of U in both sketches) / s']
        : ['for each hash function h_i:', '    minA = the smallest h_i over the k-mers of A', '    minB = the same for B', '    match if minA = minB', 'J ≈ matches / number of hash functions'];
    },
    build(input, mode) {
      const a = String(input.a).toUpperCase(), b = String(input.b).toUpperCase(), k = Number(input.k);
      const n = Number(input.n);
      const sa = A.kmerSet(a, k), sb = A.kmerSet(b, k);
      const M = A.primeAbove(4 ** k);
      const J = A.jaccard(sa, sb);
      const union = sa.concat(sb.filter((w) => !sa.includes(w)));
      const frames = [];
      const F = (o) => frames.push(Object.assign({ upto: 0, col: null, phase: null }, o));
      F({ line: null, narr: `The ${sa.length} distinct ${k}-mers of A and the ${sb.length} of B (${union.length} in all). For whole genomes these sets have millions of k-mers. A <b>sketch</b> keeps a few of them, chosen at random but in the same way for every set – so that two sketches can be compared instead of two genomes. Hashes are worked out with code(w) (the k-mer in base 4) and M = ${M}, a prime above 4<sup>${k}</sup>.` });
      let data;
      if (input.method === 'bottom') {
        const bs = A.bottomSketch(sa, sb, n, M);
        F({ phase: 'hash', line: 0, narr: `One hash function, h(w) = (3 × code(w) + 1) mod ${M}, gives every k-mer a number that looks random but is always the same for the same k-mer.` });
        F({ phase: 'sketch', line: [1, 2], narr: `Each sketch keeps the ${n} smallest values: A {${bs.sa.map((x) => x.v).join(', ')}}, B {${bs.sb.map((x) => x.v).join(', ')}}. A sketch of a whole genome made this way (Mash keeps 1,000 values) is a few kilobytes.` });
        if (mode === 'practice') F({ phase: 'sketch', line: 3, narr: 'Merge the two sketches.', ask: { type: 'number', answer: bs.shared.length, prompt: `Of the ${n} smallest values in the two sketches together, how many are in both sketches?`, hint: `Put the values of both sketches in order, keep the ${n} smallest (each once), and count those found in both.`, explain: `The ${n} smallest: {${bs.uni.join(', ')}}; in both: {${bs.shared.join(', ')}} – ${bs.shared.length}.` } });
        F({ phase: 'union', line: [3, 4], narr: `The ${n} smallest values of the two sketches together are {${bs.uni.join(', ')}}; ${bs.shared.length} of them are in both sketches. Estimate: J ≈ ${bs.shared.length}/${n} = <b>${dec(bs.est)}</b>; the true Jaccard similarity is ${J.both.length}/${J.union} = ${dec(J.j)}. With 1,000 values the estimate is good to a few hundredths. Mash turns J into a distance, an estimate of the fraction of letters that differ: D = −(1/k) ln(2J / (1 + J)).`, dwell: 2 });
        data = { kind: 'bottom', bs, sa, sb, union, M, n, J };
      } else {
        const mh = A.minhash(sa, sb, n, M);
        mh.rows.forEach((r, i) => {
          const fn = `h${i + 1}(w) = (${A.HASH_AB[i][0]} × code(w) + ${A.HASH_AB[i][1]}) mod ${M}`;
          if (mode === 'practice' && i === 0) F({ upto: i, col: i, hide: true, line: [0, 1, 2], narr: `${fn}. Its values are in column h1.`, ask: { type: 'fields', fields: [{ label: 'min of A', answer: r.minA.v }, { label: 'min of B', answer: r.minB.v }], prompt: 'What is the smallest h1 value among the k-mers of A, and among those of B?', hint: 'Rows marked A are k-mers of A, rows marked B of B (some are both).', explain: `A: ${r.minA.w} (${r.minA.v}); B: ${r.minB.w} (${r.minB.v}).` } });
          F({ upto: i + 1, col: i, line: [0, 1, 2, 3], narr: `${fn}. Smallest for A: ${seq(r.minA.w)} (${r.minA.v}); for B: ${seq(r.minB.w)} (${r.minB.v}). ${r.same ? '<b>The same</b> – a match.' : 'Different.'}`, dwell: i < 2 ? 1.2 : 0.6 });
        });
        if (mode === 'practice') F({ upto: n, line: 4, narr: 'Count the matches.', ask: { type: 'number', answer: Math.round(mh.est * 1000) / 1000, tol: 0.006, prompt: `What is the MinHash estimate of J: matches / ${n}?`, hint: 'Count the ✓ under the columns.', explain: `${mh.same} / ${n} = ${dec(mh.est)}.` } });
        F({ upto: n, line: 4, narr: `${mh.same} of ${n} hash functions have the same minimum: J ≈ ${mh.same}/${n} = <b>${dec(mh.est)}</b>; the true value is ${J.both.length}/${J.union} = ${dec(J.j)}. Why it works: the smallest value over A ∪ B is equally likely to belong to any of its ${J.union} k-mers, and it is the minimum of both A and B exactly when that k-mer is shared – which happens with probability J. The error shrinks with the square root of the number of hash functions: a rough rule is an error of about 1/√H, so 100 functions give about ±0.1.`, dwell: 2 });
        data = { kind: 'many', mh, sa, sb, union, M, n, J };
      }
      return { frames, data };
    },
    view(stage, data) {
      const box = h('div.mh');
      stage.appendChild(box);
      const { sa, sb, union, n } = data;
      const inA = new Set(sa), inB = new Set(sb);
      if (data.kind === 'many') {
        const { mh } = data;
        const t = h('table.mh-t');
        t.appendChild(h('tr', h('th', 'k-mer'), h('th', 'in'), A.range(n).map((i) => h('th', 'h' + (i + 1)))));
        const cells = {};
        union.forEach((w) => {
          const tr = h('tr', h('td.mh-w', chip(w)), h('td.mh-in', (inA.has(w) ? 'A' : '') + (inA.has(w) && inB.has(w) ? ' ' : '') + (inB.has(w) ? 'B' : '')));
          A.range(n).forEach((i) => {
            const td = h('td.mh-v');
            cells[w + i] = td;
            tr.appendChild(td);
          });
          t.appendChild(tr);
        });
        const foot = h('tr.mh-foot', h('td', ''), h('td', ''), A.range(n).map(() => h('td')));
        t.appendChild(foot);
        box.appendChild(h('div.mh-wrap', t));
        box.appendChild(h('div.mh-key', h('span.mh-v.minA', '4'), ' smallest value among the k-mers of A ', h('span.mh-v.minB', '4'), ' smallest among those of B ', h('b.yes', '✓'), ' the same k-mer'));
        const est = h('div.mh-est');
        box.appendChild(est);
        return {
          update(f, prev, ctx) {
            const hide = !!(f.hide && ctx.asking);
            union.forEach((w) => A.range(n).forEach((i) => {
              const td = cells[w + i];
              const on = i < f.upto || (f.hide && i === f.col);
              const r = mh.rows[i];
              td.textContent = on ? String(A.hashK(w, i, data.M)) : '';
              const minA = on && !hide && i < f.upto && r.minA.w === w, minB = on && !hide && i < f.upto && r.minB.w === w;
              td.className = 'mh-v' + (minA ? ' minA' : '') + (minB ? ' minB' : '') + (f.col === i ? ' col' : '');
            }));
            Array.from(foot.children).slice(2).forEach((td, i) => {
              const r = mh.rows[i];
              td.textContent = i < f.upto ? (r.same ? '✓' : '✗') : '';
              td.className = i < f.upto ? (r.same ? 'yes' : 'no') : '';
            });
            const done = mh.rows.slice(0, f.upto);
            const same = done.filter((r) => r.same).length;
            est.innerHTML = f.upto ? `${same} match${same === 1 ? '' : 'es'} of ${f.upto}` + (f.upto === n && !(f.ask && ctx.asking) ? ` → J ≈ <b>${dec(same / n)}</b> (true J = ${dec(data.J.j)})` : '') : '';
          }
        };
      }
      // bottom-s sketch
      const { bs, M } = data;
      const hv = (w) => A.hashK(w, 0, M);
      const col = (title, set, cls) => {
        const list = set.map((w) => ({ w, v: hv(w) })).sort((x, y) => x.v - y.v);
        const body = h('div.mh-list');
        const items = list.map((x) => {
          const it = h('div.mh-item', chip(x.w), h('span.mh-hv', String(x.v)));
          it.dataset.v = x.v;
          body.appendChild(it);
          return it;
        });
        const c = h('div.mh-col.' + cls, h('div.viz-label', title), body);
        return { c, items, list };
      };
      const cA = col('k-mers of A, by hash value', sa, 'a');
      const cB = col('k-mers of B, by hash value', sb, 'b');
      const uni = h('div.mh-col.u', h('div.viz-label', 'Smallest values of both sketches'), h('div.mh-list'));
      box.appendChild(h('div.mh-cols', cA.c, cB.c, uni));
      const est = h('div.mh-est');
      box.appendChild(est);
      return {
        update(f, prev, ctx) {
          const sk = f.phase === 'sketch' || f.phase === 'union';
          const keepA = new Set(bs.sa.map((x) => x.v)), keepB = new Set(bs.sb.map((x) => x.v));
          [[cA, keepA], [cB, keepB]].forEach(([c, keep]) => c.items.forEach((it) => {
            it.classList.toggle('shown', !!f.phase);
            it.classList.toggle('kept', sk && keep.has(Number(it.dataset.v)));
            it.classList.toggle('dropped', sk && !keep.has(Number(it.dataset.v)));
          }));
          const body = uni.lastChild;
          body.innerHTML = '';
          if (f.phase === 'union') {
            bs.uni.forEach((v) => body.appendChild(h('div.mh-item.u' + (keepA.has(v) && keepB.has(v) ? '.both' : ''), h('span.mh-hv', String(v)), h('span.mh-tag', keepA.has(v) && keepB.has(v) ? 'A and B' : keepA.has(v) ? 'A only' : 'B only'))));
            est.innerHTML = `J ≈ ${bs.shared.length} / ${bs.uni.length} = <b>${dec(bs.est)}</b> (true J = ${dec(data.J.j)})`;
          } else est.innerHTML = '';
        }
      };
    }
  });
})();
