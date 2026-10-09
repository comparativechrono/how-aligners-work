/* =====================================================================
   Read mappers: minimizers, and one read followed from seeds through
   chaining to the final alignment (the plan of BWA-MEM, Bowtie 2 and
   minimap2, on a reference you can see in one line).
   ===================================================================== */
(function () {
  'use strict';
  const MG = window.MG;
  const { h, esc } = MG;
  const V = MG.viz;
  const A = MG.algo;
  const seq = V.seq;

  /* ==================================================================
     Minimizers
     ================================================================== */
  V.define('minimizer', {
    title: 'Minimizers',
    sub: 'Keep only the smallest k-mer of every window – fewer seeds, the same ones in read and genome',
    inputs: [
      { key: 's', label: 'Sequence', type: 'seq', letters: 'ACGT', min: 6, max: 30, default: 'GATTACAGATTACATTGACCA' },
      { key: 'k', label: 'k', type: 'select', options: [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']], default: '3' },
      { key: 'w', label: 'w (k-mers per window)', type: 'select', options: [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']], default: '4' },
      { key: 'order', label: 'Smallest by', type: 'select', options: [['abc', 'alphabet (A < C < G < T)'], ['hash', 'a scrambled number (as minimap2)']], default: 'abc' }
    ],
    presets: {
      abc: { label: 'k = 3, w = 4, alphabetical', input: { s: 'GATTACAGATTACATTGACCA', k: '3', w: '4', order: 'abc' } },
      hash: { label: 'The same, scrambled order', input: { s: 'GATTACAGATTACATTGACCA', k: '3', w: '4', order: 'hash' } },
      polyA: { label: 'A run of A’s, alphabetical', input: { s: 'CGTAAAAAAAAAAGCTTCAGT', k: '3', w: '4', order: 'abc' } }
    },
    practice: true,
    check(input) {
      if (input.s.length < +input.k + +input.w - 1) return 'The sequence is too short for one window.';
      return null;
    },
    code: [
      'kmers = [s[i:i+k] for i in range(len(s) - k + 1)]',
      'for each window of w consecutive k-mers:',
      '    m = the k-mer with the smallest key (left-most on a tie)',
      '    add m to the minimizers (a k-mer chosen by several windows is kept once)'
    ],
    build(input, mode) {
      const s = input.s, k = +input.k, w = +input.w, order = input.order;
      const mz = A.minimizers(s, k, w, order);
      const frames = [];
      const chosen = new Set();
      const F = (o) => frames.push(Object.assign({ win: null, min: null, chosen: Array.from(chosen) }, o));
      F({ line: 0, narr: `${seq(s)} has ${mz.kmers.length} k-mers of ${k} letters. Storing all of them (in the index of a genome, billions) takes a lot of memory. A <b>minimizer</b> scheme keeps only some: in each window of ${w} consecutive k-mers, the smallest one${order === 'hash' ? ' – smallest by a scrambled number, not by the alphabet' : ' (alphabetical order)'}.` });
      let asked = 0;
      mz.windows.forEach((wd) => {
        if (mode === 'practice' && asked < 5) {
          asked++;
          F({ win: wd.start, line: [1, 2], narr: `Window ${wd.start}: k-mers ${wd.start} to ${wd.start + w - 1}.`, ask: { type: 'pick', answer: 'k' + wd.min, prompt: 'Which k-mer of the window is the minimizer? Click it.', pickHint: 'Click a k-mer inside the bracket.', hint: order === 'hash' ? 'The smallest number shown under the k-mers of the window.' : 'The first in alphabetical order; the left-most if two are equal.', explain: `${seq(mz.kmers[wd.min].w)} (at ${wd.min}).` } });
        }
        chosen.add(wd.min);
        F({ win: wd.start, min: wd.min, line: wd.isNew ? 3 : 2, narr: `Window ${wd.start}: the smallest is ${seq(mz.kmers[wd.min].w)} at ${wd.min}${wd.isNew ? ' – a new minimizer.' : ' – already chosen by the window before.'}`, dwell: 0.9 });
      });
      F({ line: null, done: true, narr: `<b>${mz.chosen.length}</b> minimizers instead of ${mz.kmers.length} k-mers${mz.chosen.length / mz.kmers.length > 3 / (w + 1) ? ` – more than the 2/(w + 1) = ${(2 / (w + 1)).toFixed(2)} expected on average for random sequence` : ` – on average, for random sequence, about 2/(w + 1) of them`}. Every stretch of ${w + k - 1} letters still contains at least one, and a read and the genome pick the <b>same</b> minimizers where they share such a stretch: that is what makes them useful seeds.${order === 'abc' && /AAA/.test(s) ? ' With alphabetical order, runs of A win every window – one reason minimap2 scrambles the order.' : ''}` });
      return { frames, data: { s, k, w, mz, order } };
    },
    view(stage, data) {
      const { s, k, w, mz } = data;
      const W = (stage.clientWidth || 640) - 90;
      const size = Math.max(18, Math.min(32, Math.floor(W / s.length) - 3));
      stage.style.setProperty('--cell', size + 'px');
      const pitch = size + 3;
      const tiles = s.split('').map((c) => h('span', { class: V.tileClass(c) }, c));
      stage.appendChild(h('div.sl-row.trie-top.wide', h('span.viz-label', 'Sequence'), h('div.tiles', tiles.map((t, i) => h('span.tilebox', h('span.posn', String(i)), t)))));
      const lane = h('div.mz-lane', { style: { height: 4 * 30 + 30 + 'px', width: s.length * pitch + 'px' } });
      const brk = h('div.mz-win');
      lane.appendChild(brk);
      const chips = mz.kmers.map((x, i) => {
        const c = h('div.mz-chip', { 'data-pick': 'k' + i, style: { left: i * pitch + 'px', top: (i % 4) * 30 + 'px', width: k * pitch - 3 + 'px' } }, h('span.mz-w', x.w), data.order === 'hash' ? h('span.mz-key', String(x.key)) : null);
        lane.appendChild(c);
        return c;
      });
      stage.appendChild(h('div.mz-wrap', h('span.viz-label', 'k-mers'), lane));
      const count = h('div.sl-counts');
      stage.appendChild(count);
      return {
        update(f, prev, ctx) {
          const ch = new Set(f.chosen);
          chips.forEach((c, i) => {
            const inWin = f.win != null && i >= f.win && i < f.win + w;
            c.classList.toggle('in', inWin);
            c.classList.toggle('min', f.min === i);
            c.classList.toggle('chosen', ch.has(i));
            c.classList.toggle('pickable', !!(ctx.asking && inWin));
          });
          lane.classList.toggle('picking', !!ctx.asking);
          brk.hidden = f.win == null;
          if (f.win != null) {
            brk.style.left = f.win * pitch - 4 + 'px';
            brk.style.width = (w + k - 1) * pitch + 5 + 'px';
          }
          tiles.forEach((t, i) => t.classList.toggle('cur', f.win != null && i >= f.win && i < f.win + w + k - 1));
          count.innerHTML = `<span><b>${f.chosen.length}</b> minimizer${f.chosen.length === 1 ? '' : 's'} so far</span><span>${mz.kmers.length} k-mers</span>`;
        }
      };
    }
  });

  /* ==================================================================
     Mapping one read: seeds, chain, extend
     ================================================================== */
  const REF = 'TTGCACGGATCCATTAGGCTACGTTAGCCATGCAAGTCCGATTACAGGCTTAACCGTAGC';
  V.define('mapper', {
    title: 'Mapping a read: seed, chain, extend',
    sub: 'How BWA-MEM, Bowtie 2 and minimap2 place a read on a genome',
    inputs: [
      { key: 'ref', label: 'Reference (the “genome”)', type: 'seq', letters: 'ACGT', min: 20, max: 64, default: REF },
      { key: 'read', label: 'Read', type: 'seq', letters: 'ACGT', min: 8, max: 26, default: 'GCTACGTTAGCCATGCAGTCCGA' },
      { key: 'mode', label: 'Seeds', type: 'select', options: [['kmer', 'every k-mer of the read'], ['minimizer', 'minimizers only (w = 4)']], default: 'kmer' },
      { key: 'k', label: 'k', type: 'select', options: [['4', '4'], ['5', '5'], ['6', '6']], default: '5' }
    ],
    presets: {
      del: { label: 'A read with a deletion', input: { ref: REF, read: 'GCTACGTTAGCCATGCAGTCCGA', mode: 'kmer', k: '5' } },
      snp: { label: 'A read with a substitution (minimizer seeds)', input: { ref: REF, read: 'TAGGCTACGATAGCCATGCA', mode: 'minimizer', k: '5' } },
      ins: { label: 'A read with an insertion', input: { ref: REF, read: 'CATTAGGCTACGTTTAGCCATGC', mode: 'kmer', k: '5' } },
      repeat: { label: 'A read from a repeat: two equally good places', input: { ref: 'GGATCCATGCTTACGGATCAACGTTGGCATGCTTACGGATCAGCTTAGGCAT', read: 'CATGCTTACGGATCA', mode: 'kmer', k: '5' } }
    },
    practice: true,
    code: [
      'index = {kmer: [positions in the reference]}     # made once (a hash table, or an FM-index)',
      'anchors = [(i, p) for each seed of the read at i, for p in index[seed]]',
      'chains = groups of anchors in the same order in read and reference, on about one diagonal',
      'best chain → the read starts near p - i',
      'align the read there with dynamic programming (banded) → position, CIGAR',
      'MAPQ: how much better the best place is than the next best'
    ],
    build(input, mode) {
      const ref = input.ref, read = input.read, k = +input.k, md = input.mode;
      const m = A.mapRead(read, ref, k, md, 4, 'abc');
      const sd = m.seeds;
      const frames = [];
      const F = (o) => frames.push(Object.assign({ anchors: [], seed: null, chain: null, aln: null, phase: 'index' }, o));
      F({ line: 0, narr: `A reference of ${ref.length} letters stands in for a genome; the read has ${read.length}. Comparing the read with every position would be slow on a real genome. Instead, the reference is <b>indexed</b> once: each of its ${md === 'kmer' ? `${k}-mers` : `minimizers (${k}-mers, w = 4)`} is stored with the positions where it occurs – ${sd.refSeeds.length} entries.` });
      const anchors = [];
      let asked = 0;
      sd.readSeeds.forEach((rs) => {
        const hits = sd.index[rs.w] || [];
        hits.forEach((r) => anchors.push({ q: rs.i, r, w: rs.w, d: r - rs.i }));
        F({ phase: 'seed', seed: rs.i, anchors: anchors.slice(), line: 1, narr: `Seed ${seq(rs.w)} (read position ${rs.i}): ${hits.length ? `in the reference at ${hits.join(', ')} – ${hits.length === 1 ? 'an anchor' : hits.length + ' anchors'}` : 'not in the reference (a sequencing error or a difference from the reference covers it)'}.`, dwell: hits.length ? 0.8 : 0.6 });
      });
      if (!m.best) {
        F({ phase: 'seed', anchors: anchors.slice(), line: null, narr: 'No seed occurs in the reference: the read stays <b>unmapped</b>.' });
        return { frames, data: { ref, read, k, m } };
      }
      const best = m.best;
      const d0 = best.anchors[0].d;
      F({ phase: 'chain', anchors: anchors.slice(), chain: 0, line: 2, narr: `${anchors.length} anchors. Anchors from the read’s true place lie on one <b>diagonal</b> (reference position − read position) and in the same order in both: a <b>chain</b>. The best chain has ${best.anchors.length} anchors on diagonal ${d0}${best.anchors.some((a) => a.d !== d0) ? ' – with a small shift along the way: an insertion or deletion' : ''}.${m.chains.length > 1 ? ` ${m.chains.length - 1} other chain${m.chains.length > 2 ? 's' : ''} (grey) come${m.chains.length > 2 ? '' : 's'} from seeds that also occur elsewhere.` : ''}` });
      if (mode === 'practice') {
        F({ phase: 'chain', anchors: anchors.slice(), chain: 0, line: 3, narr: `The first anchor of the best chain is read position ${best.anchors[0].q} at reference position ${best.anchors[0].r}.`, ask: { type: 'number', answer: d0, prompt: 'At which reference position does the read start, if it has no insertion or deletion before that anchor?', hint: 'Reference position minus read position.', explain: `${best.anchors[0].r} − ${best.anchors[0].q} = ${d0}.` } });
      }
      const a = m.aln;
      F({ phase: 'extend', anchors: anchors.slice(), chain: 0, aln: a, line: 4, narr: `Seeds are only exact pieces. To place every letter, align the whole read to the reference around the chain (positions ${a.lo}–${a.hi - 1}) by dynamic programming – here the edit distance, with the read free to start anywhere in that stretch (chapter 6). Real mappers align in a narrow band, with scores and affine gaps (chapter 7).`, dwell: 1.4 });
      const tie = m.chains.length > 1 && m.chains[1].score === best.score;
      F({ phase: 'done', anchors: anchors.slice(), chain: 0, aln: a, line: [4, 5], tie, narr: `The read maps at reference position <b>${a.start}</b> (${a.start + 1} counting from 1, as SAM files do) with ${a.edits} edit${a.edits === 1 ? '' : 's'}: CIGAR <b>${a.cigar}</b> (M aligned, I extra letters in the read, D letters missing from it). ${tie ? `But another chain is just as good: the read fits two places equally well. A mapper reports one of them with <b>mapping quality 0</b> – “it could be either”.` : 'No other place comes close, so the mapping quality (MAPQ) is high: the chance that this place is wrong is small.'}`, dwell: 2 });
      return { frames, data: { ref, read, k, m } };
    },
    view(stage, data) {
      const { ref, read, k, m } = data;
      const R = ref.length, Q = read.length;
      const W = (stage.clientWidth || 640) - 70;
      const cw = Math.max(9, Math.min(20, Math.floor(W / (R + 1))));
      stage.style.setProperty('--mc', cw + 'px');
      const refTiles = ref.split('').map((c) => h('span', { class: V.tileClass(c) }, c));
      const refRow = h('div.mp-ref', refTiles);
      // the anchors plot: read down, reference across
      const plot = h('div.mp-plot', { style: { width: R * cw + 'px', height: Q * cw + 'px' } });
      const readCol = h('div.mp-readcol', read.split('').map((c) => h('span', { class: V.tileClass(c) }, c)));
      const alnBox = h('div.mp-aln');
      stage.appendChild(h('div.mp', h('div.mp-row', h('span.mp-lab', 'Reference'), refRow), h('div.mp-row', readCol, plot), alnBox));
      const marks = {};
      return {
        update(f) {
          // anchors as short strokes along their diagonal
          const keep = new Set();
          const chainSet = new Set((f.chain != null ? m.chains[f.chain].anchors : []).map((a) => a.q + ':' + a.r));
          f.anchors.forEach((a) => {
            const key = a.q + ':' + a.r;
            keep.add(key);
            let el = marks[key];
            if (!el) {
              el = marks[key] = h('div.mp-anc', { style: { left: a.r * cw + 'px', top: a.q * cw + 'px', width: k * cw * Math.SQRT2 + 'px' } });
              plot.appendChild(el);
            }
            el.classList.toggle('chain', chainSet.has(key));
            el.classList.toggle('other', f.chain != null && !chainSet.has(key));
            el.classList.toggle('now', f.seed === a.q);
          });
          Object.keys(marks).forEach((key) => {
            if (!keep.has(key)) {
              marks[key].remove();
              delete marks[key];
            }
          });
          readCol.querySelectorAll('.tile').forEach((t, i) => t.classList.toggle('cur', f.seed != null && i >= f.seed && i < f.seed + k));
          refTiles.forEach((t, i) => {
            const inAnc = f.seed != null && f.anchors.some((a) => a.q === f.seed && i >= a.r && i < a.r + k);
            t.classList.toggle('cur', inAnc);
            t.classList.toggle('found', !!(f.aln && f.phase === 'done' && i >= f.aln.start && i < f.aln.start + f.aln.ay.replace(/-/g, '').length));
            t.classList.toggle('dim', !!(f.aln && (i < f.aln.lo || i >= f.aln.hi)));
          });
          alnBox.innerHTML = '';
          if (f.aln) {
            const a = f.aln;
            const top = h('div.tiles'), mid = h('div.aln-mid'), bot = h('div.tiles');
            a.ay.split('').forEach((c, k2) => {
              const r = a.ax[k2];
              top.appendChild(h('span', { class: V.tileClass(c) }, c));
              mid.appendChild(h('span', c === r ? '|' : c === '-' || r === '-' ? ' ' : '·'));
              bot.appendChild(h('span', { class: V.tileClass(r) }, r));
            });
            alnBox.appendChild(h('div.viz-label', `Reference from ${a.start} / read`));
            alnBox.appendChild(h('div.aln', top, mid, bot));
            if (f.phase === 'done') alnBox.appendChild(h('div.mp-sam', h('span.viz-label', 'In the SAM file'), h('span', { html: `POS <b>${a.start + 1}</b>` }), h('span', { html: `CIGAR <b>${esc(a.cigar)}</b>` }), h('span', { html: `NM:i:<b>${a.edits}</b>` }), f.tie ? h('span', { html: 'MAPQ <b>0</b> (two places)' }) : null));
          }
        }
      };
    }
  });
})();
