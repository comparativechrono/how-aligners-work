/* =====================================================================
   Profiles and hidden Markov models: a position-specific scoring
   matrix, the Viterbi and forward algorithms on a two-state HMM, and a
   profile HMM built from a multiple alignment.
   ===================================================================== */
(function () {
  'use strict';
  const MG = window.MG;
  const { h, esc } = MG;
  const V = MG.viz;
  const A = MG.algo;
  const seq = V.seq;
  /** a number with d decimals and a real minus sign; −∞ for minus infinity */
  const num = (x, d = 2) => {
    if (x === -Infinity) return '−∞';
    const r = Math.round(x * 10 ** d) / 10 ** d;
    return (Object.is(r, -0) ? 0 : r).toFixed(d).replace('-', '−');
  };
  /** a probability: 3 significant figures, or a power of ten when small */
  const prob = (x) => {
    if (x === 0) return '0';
    if (x >= 0.001) return String(Number(x.toPrecision(3)));
    const e = Math.floor(Math.log10(x));
    const m = x / 10 ** e;
    const sup = String(e).replace('-', '⁻').replace(/[0-9]/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]);
    return `${m.toFixed(2)}×10${sup}`;
  };
  /** a frequency or probability: up to 3 decimals, trailing zeros dropped */
  const dec = (x) => String(Number(x.toFixed(3)));
  /** a sum of numbers written out with their signs: 1.42 + 1.58 − 1.58 */
  const sumStr = (xs, d = 2) => xs.map((x, i) => (i === 0 ? num(x, d) : x < 0 || x === -Infinity ? '− ' + num(x, d).replace('−', '') : '+ ' + num(x, d))).join(' ');
  const DNA = 'ACGT', AA = 'ACDEFGHIKLMNPQRSTVWY';

  /* ==================================================================
     A profile (position-specific scoring matrix)
     ================================================================== */
  const TATA = 'TATAAA TATAAT TATATA TATAAA TATTAA TATAAG CATAAA TATAAA';
  const BLOCK = 'KIFIMK NLFKTR KIFKTK KLYESR KIFKGR';
  V.define('profile', {
    title: 'A profile: one score table per position',
    sub: 'Count each column, add pseudocounts, take log-odds – then slide it along a sequence',
    inputs: [
      { key: 'sites', label: 'Aligned sequences, all the same length', type: 'text', max: 120, default: TATA, help: '3 to 10 sequences of 3 to 8 letters, separated by spaces.' },
      { key: 'query', label: 'Sequence to scan', type: 'text', max: 30, default: 'GCGCTATAAAGGCTTATATCCG' },
      { key: 'kind', label: 'Letters', type: 'select', options: [['dna', 'DNA'], ['protein', 'protein']], default: 'dna' },
      { key: 'pc', label: 'Pseudocounts', type: 'select', options: [['yes', 'yes'], ['no', 'none']], default: 'yes' }
    ],
    presets: {
      tata: { label: 'TATA boxes: build a profile, scan a sequence', input: { sites: TATA, query: 'GCGCTATAAAGGCTTATATCCG', kind: 'dna', pc: 'yes' } },
      nopc: { label: 'A profile without pseudocounts', input: { sites: TATA, query: 'GGCTATAACGCATTAAAGC', kind: 'dna', pc: 'no' } },
      pc: { label: 'The same, with pseudocounts', input: { sites: TATA, query: 'GGCTATAACGCATTAAAGC', kind: 'dna', pc: 'yes' } },
      protein: { label: 'A block of five proteins', input: { sites: BLOCK, query: 'MSAKLFKTREDW', kind: 'protein', pc: 'yes' } }
    },
    practice: true,
    check(input) {
      const rows = String(input.sites).toUpperCase().split(/[\s,]+/).filter(Boolean);
      const q = String(input.query).toUpperCase().replace(/\s+/g, '');
      const alpha = input.kind === 'protein' ? AA : DNA;
      if (rows.length < 3 || rows.length > 10) return 'Give 3 to 10 aligned sequences.';
      if (rows.some((r) => r.length !== rows[0].length)) return 'The aligned sequences must all have the same length (no gaps).';
      if (rows[0].length < 3 || rows[0].length > 8) return 'Sequences of 3 to 8 letters.';
      const bad = new RegExp(`[^${alpha}]`);
      if (rows.some((r) => bad.test(r)) || bad.test(q)) return input.kind === 'protein' ? 'Use the 20 amino-acid letters only.' : 'Use A, C, G and T only.';
      if (q.length < rows[0].length || q.length > 30) return `The sequence to scan needs ${rows[0].length} to 30 letters.`;
      return null;
    },
    codeFor(input) {
      const prot = input.kind === 'protein';
      const noPc = input.pc === 'no';
      return [
        'for each column c of the alignment:',
        '    count[c][a] = how many sequences have letter a there',
        noPc ? 'p[c][a] = count[c][a] / N                    (no pseudocounts)' : prot ? 'p[c][a] = (count[c][a] + 0.05) / (N + 1)     (pseudocount 1, shared by 20 letters)' : 'p[c][a] = (count[c][a] + 1) / (N + 4)        (add 1 to every count)',
        `score[c][a] = log2(p[c][a] / ${prot ? '0.05' : '0.25'})        (log-odds against random ${prot ? 'protein' : 'DNA'})`,
        'for each window w of the sequence:',
        '    total[w] = sum over c of score[c][ s[w + c] ]',
        'best = the windows with the highest total'
      ];
    },
    build(input, mode) {
      const rows = String(input.sites).toUpperCase().split(/[\s,]+/).filter(Boolean);
      const q = String(input.query).toUpperCase().replace(/\s+/g, '');
      const prot = input.kind === 'protein';
      const alpha = prot ? AA : DNA;
      const pcw = input.pc === 'no' ? 0 : prot ? 1 : 4;
      const P = A.profile(rows, alpha, pcw);
      const N = rows.length, L = P.L;
      const bg = prot ? '0.05' : '0.25';
      // the rows of the table: DNA all four letters; protein the letters of the block, then one row for all others
      const seen = alpha.split('').filter((a) => rows.some((r) => r.includes(a)));
      const other = prot ? alpha.split('').find((a) => !seen.includes(a)) : null;
      const tRows = prot ? seen.concat(other ? ['*'] : []) : alpha.split('');
      const rowOf = (a) => (prot && !seen.includes(a) ? '*' : a);
      const scan = A.profileScan(P, q);
      const frames = [];
      const F = (o) => frames.push(Object.assign({ phase: 'count', upto: 0, col: null, win: null, done: 0, look: null, best: null }, o));
      F({ line: null, narr: `${N} aligned sequences of the same kind, without gaps${prot ? '' : ' – here, binding sites of a protein'}. Some positions hardly vary, others do; a single substitution table would treat them all alike. A <b>profile</b> gives every position its own column of scores.` });
      A.range(L).forEach((c) => {
        const cnt = P.cols[c].count;
        const present = alpha.split('').filter((a) => cnt[a] > 0).sort((a, b) => cnt[b] - cnt[a]);
        const say = present.map((a) => `${a} ${cnt[a]}`).join(', ');
        if (mode === 'practice' && c === 0) {
          if (prot) F({ upto: c, col: c, line: [0, 1], narr: `Column ${c + 1}.`, ask: { type: 'number', answer: cnt[present[0]], prompt: `How many sequences have ${present[0]} in column ${c + 1}?`, hint: 'Count down the ringed column.', explain: say + '.' } });
          else F({ upto: c, col: c, line: [0, 1], narr: `Column ${c + 1}.`, ask: { type: 'fields', fields: alpha.split('').map((a) => ({ label: a, answer: cnt[a] })), prompt: `Count each letter in column ${c + 1}.`, hint: 'Count down the ringed column; the four counts add up to ' + N + '.', explain: say + '.' } });
        }
        F({ upto: c + 1, col: c, line: [0, 1], fly: true, narr: `Column ${c + 1}: ${say}.`, dwell: c < 2 ? 1 : 0.6 });
      });
      const c0 = P.cols[0];
      const top0 = alpha.split('').sort((a, b) => c0.count[b] - c0.count[a])[0];
      F({ phase: 'freq', upto: L, line: 2, narr: `Divided by ${N}, the counts become <b>frequencies</b>: column 1 is {${alpha.split('').filter((a) => c0.count[a] > 0).sort((a, b) => c0.count[b] - c0.count[a]).map((a) => `${a}: ${dec(c0.freq[a])}`).join(', ')}}. This is a profile as many programs store it – one table of frequencies per position.` });
      if (pcw > 0) {
        F({ phase: 'prob', upto: L, line: 2, narr: prot ? `A letter never seen in a column would get probability 0, although ${N} sequences are far too few to rule it out. <b>Pseudocounts</b> fix that: add 0.05 to every count (one extra count, shared by the 20 amino acids) and divide by ${N} + 1.` : `A letter never seen in a column would get probability 0, although ${N} sequences are far too few to rule it out. <b>Pseudocounts</b> fix that: add 1 to every count and divide by ${N} + 4. Column 1: ${top0} (${c0.count[top0]} + 1) / ${N + 4} = ${dec(c0.prob[top0])}.` });
      } else {
        F({ phase: 'prob', upto: L, line: 2, narr: 'No pseudocounts: the probabilities are the frequencies, and a letter never seen in a column gets probability 0.' });
      }
      if (mode === 'practice') F({ phase: 'prob', upto: L, line: 3, col: 0, narr: `Now the scores: log2 of p divided by ${bg}, the chance of the letter in random ${prot ? 'protein' : 'DNA'}.`, ask: { type: 'number', answer: Math.round(c0.score[top0] * 100) / 100, tol: 0.021, prompt: `What is the score of ${top0} in column 1? log2(${num(c0.prob[top0], 3)} / ${bg}), two decimals.`, hint: `Divide ${num(c0.prob[top0], 3)} by ${bg}, then take log2 (log2 x = ln x / ln 2).`, explain: `log2(${num(c0.prob[top0], 3)} / ${bg}) = log2(${num(c0.prob[top0] / P.q, 3)}) = ${num(c0.score[top0])}.` } });
      F({ phase: 'score', upto: L, line: 3, narr: `The <b>scores</b>: log2(p / ${bg}). Positive: the letter is more common at this position than in random sequence; negative: rarer; 0: no information. ${pcw ? '' : 'An unseen letter scores −∞. '}Column 1, ${top0}: ${num(c0.score[top0])}.` });
      // scanning
      let bestT = -Infinity;
      scan.forEach((s) => (bestT = Math.max(bestT, s.total)));
      const bestW = scan.filter((s) => s.total === bestT).map((s) => s.w);
      const askW = mode === 'practice' ? bestW[0] : -1;
      scan.forEach((s, k) => {
        const word = q.slice(s.w, s.w + L);
        const look = A.range(L).map((c) => [c, rowOf(q[s.w + c])]);
        if (k === askW) F({ phase: 'scan', upto: L, win: s.w, done: k, look, line: 5, narr: `The window at position ${s.w}: ${seq(word)}.`, ask: { type: 'number', answer: Math.round(s.total * 100) / 100, tol: 0.06, prompt: `What is the total score of this window? Add up the score of each of its letters in its column.`, hint: `Look up each letter of the window in its column of the table (ringed), and add the ${L} scores.`, explain: `${sumStr(s.parts)} = ${num(s.total)}.` } });
        F({ phase: 'scan', upto: L, win: s.w, done: k + 1, look, line: [4, 5], narr: `Position ${s.w}, ${seq(word)}: ${sumStr(s.parts)} = <b>${num(s.total)}</b>.`, dwell: k < 2 ? 1.2 : 0.5 });
      });
      const bw = bestW.map((w) => `${w} (${seq(q.slice(w, w + L))})`).join(' and ');
      const infs = scan.filter((s) => s.total === -Infinity).length;
      let fin = `The best window starts at position ${bw}, score ${num(bestT)}. `;
      if (!pcw && infs) fin += `${infs} of ${scan.length} windows score −∞: one letter the ${N} sequences never had at that position rules a window out, however well the rest fits. Compare with pseudocounts. `;
      else fin += 'A window scores well only if it has the right letter at the positions that matter; the positions that vary count for less. ';
      fin += prot ? 'PSI-BLAST builds such a profile from its first hits and searches again with it.' : 'Motif scanners such as FIMO score every window of a genome this way, with profiles from databases such as JASPAR.';
      F({ phase: 'scan', upto: L, win: bestW[0], done: scan.length, best: bestW, look: A.range(L).map((c) => [c, rowOf(q[bestW[0] + c])]), line: 6, narr: fin, dwell: 2 });
      return { frames, data: { rows, q, P, tRows, rowOf, prot, N, L, other, scan, pcw } };
    },
    view(stage, data) {
      const { rows, q, P, tRows, prot, N, L, other, scan } = data;
      const box = h('div.pf');
      const top = h('div.pf-top');
      const blockBox = h('div.pf-block');
      const tableBox = h('div.pf-tab');
      top.appendChild(blockBox);
      top.appendChild(tableBox);
      box.appendChild(top);
      const scanBox = h('div.pf-scan');
      box.appendChild(scanBox);
      stage.appendChild(box);
      // the aligned sequences
      blockBox.appendChild(h('div.viz-label', `${N} aligned sequences`));
      const nums = h('div.pf-row.pf-nums', A.range(L).map((c) => h('span', String(c + 1))));
      blockBox.appendChild(nums);
      const tileAt = [];
      rows.forEach((r) => {
        const t = V.tiles(r, '', prot);
        tileAt.push(Array.from(t.children));
        blockBox.appendChild(h('div.pf-row', t));
      });
      // the profile table
      const label = h('div.viz-label', '');
      tableBox.appendChild(label);
      const t = h('table.pf-t');
      t.appendChild(h('tr', h('th', ''), A.range(L).map((c) => h('th', String(c + 1)))));
      const cellOf = {};
      tRows.forEach((a) => {
        const tr = h('tr', h('th', a === '*' ? h('span.pf-other', { title: 'every amino acid not in the block' }, 'other') : h('span', { class: V.tileClass(a, prot) }, a)));
        A.range(L).forEach((c) => {
          const td = h('td');
          cellOf[a + c] = td;
          tr.appendChild(td);
        });
        t.appendChild(tr);
      });
      tableBox.appendChild(t);
      // the scan
      const W = stage.clientWidth || 700;
      const qc = Math.max(16, Math.min(28, Math.floor((W - 70) / q.length) - 3));
      const pitch = qc + 3;
      scanBox.style.setProperty('--qc', qc + 'px');
      scanBox.appendChild(h('div.viz-label', 'Scanning the sequence'));
      const lane = h('div.pf-q', { style: { width: q.length * pitch + 'px' } });
      const qt = V.tiles(q, '', prot);
      lane.appendChild(qt);
      const win = h('div.pf-win', { style: { width: L * pitch + 1 + 'px' } });
      lane.appendChild(win);
      const parts = h('div.pf-parts');
      lane.appendChild(parts);
      scanBox.appendChild(lane);
      const sum = h('div.pf-sum');
      scanBox.appendChild(sum);
      // the score track: a bar per window, under the middle of the window
      const finite = scan.map((s) => s.total).filter((x) => x > -Infinity);
      const hi = Math.max(1, ...finite.map((x) => Math.abs(x)));
      const TH = 46;
      const track = h('div.pf-track', { style: { width: q.length * pitch + 'px', height: 2 * TH + 2 + 'px' } });
      track.appendChild(h('div.pf-zero', { style: { top: TH + 'px' } }));
      const bars = scan.map((s) => {
        const b = h('div.pf-bar', { title: `window at ${s.w}: ${num(s.total)}` });
        const x = (s.w + L / 2) * pitch - pitch / 2 + 2;
        b.style.left = x + 'px';
        b.style.width = Math.max(6, qc - 6) + 'px';
        if (s.total === -Infinity) {
          b.classList.add('inf');
          b.style.top = TH + 'px';
          b.style.height = TH + 'px';
          b.textContent = '−∞';
        } else if (s.total >= 0) {
          const hh = (s.total / hi) * TH;
          b.style.top = TH - hh + 'px';
          b.style.height = Math.max(1, hh) + 'px';
        } else {
          const hh = (-s.total / hi) * TH;
          b.classList.add('neg');
          b.style.top = TH + 'px';
          b.style.height = Math.max(1, hh) + 'px';
        }
        track.appendChild(b);
        return b;
      });
      scanBox.appendChild(h('div.pf-tracklab', 'Score of each window'));
      scanBox.appendChild(track);
      const shade = (x) => {
        if (x === -Infinity) return 'inf';
        return x > 0.05 ? 'pos' : x < -0.05 ? 'neg' : 'zero';
      };
      return {
        update(f, prev, ctx) {
          const ph = f.phase;
          label.textContent = { count: 'Counts', freq: 'Frequencies', prob: P.pc ? 'Probabilities, with pseudocounts' : 'Probabilities (no pseudocounts)', score: 'Scores: log2(p / ' + (prot ? '0.05' : '0.25') + ')', scan: 'Scores: log2(p / ' + (prot ? '0.05' : '0.25') + ')' }[ph];
          // the aligned sequences: the current column ringed
          tileAt.forEach((rowT) => rowT.forEach((el, c) => el.classList.toggle('cur', f.col === c && ph === 'count')));
          Array.from(nums.children).forEach((el, c) => el.classList.toggle('on', f.col === c));
          // the table
          tRows.forEach((a) => {
            A.range(L).forEach((c) => {
              const td = cellOf[a + c];
              const col = P.cols[c];
              const x = a === '*' ? other : a;
              let txt = '';
              let cls = '';
              if (c < f.upto) {
                if (ph === 'count') txt = String(col.count[x]);
                else if (ph === 'freq') txt = dec(col.freq[x]);
                else if (ph === 'prob') txt = dec(col.prob[x]);
                else {
                  txt = num(col.score[x]);
                  cls = 'sc ' + shade(col.score[x]);
                }
                if ((ph === 'count' || ph === 'freq') && col.count[x] === 0) cls += ' nil';
              }
              const isLook = f.look && f.look.some(([lc, la]) => lc === c && la === a);
              td.className = cls + (f.col === c && ph !== 'scan' ? ' cur' : '') + (isLook ? ' look' : '');
              if (td.textContent !== txt) {
                td.textContent = txt;
                if (txt && !ctx.instant && prev && ph === prev.phase && c === f.col) V.anim(td, [{ transform: 'scale(1.35)', background: '#ffe6cc' }, { transform: 'none' }], 450, ctx);
              }
            });
          });
          // letters drop into the count table
          if (f.fly && !ctx.back && !ctx.instant) {
            rows.forEach((r, k) => V.fly(tileAt[k][f.col], cellOf[(prot && !tRows.includes(r[f.col]) ? '*' : r[f.col]) + f.col], ctx, { ms: 520, delay: k * 50, keep: true, arc: 20 }));
          }
          // the scan
          const on = f.win != null;
          win.hidden = !on;
          parts.innerHTML = '';
          qt.querySelectorAll('.tile').forEach((el, i) => el.classList.toggle('dim', on && (i < f.win || i >= f.win + L)));
          if (on) {
            win.style.left = f.win * pitch - 2 + 'px';
            const s = scan.find((x) => x.w === f.win);
            const shown = !(f.ask && ctx.asking);
            s.parts.forEach((v, c) => parts.appendChild(h('span', { class: 'pfp ' + shade(v), style: { left: (f.win + c) * pitch + 'px', width: qc + 'px' } }, shown ? num(v, 1) : '?')));
            sum.innerHTML = shown ? `Window at position ${f.win}: total <b>${num(s.total)}</b>` : `Window at position ${f.win}: total <b>?</b>`;
            win.classList.toggle('best', !!(f.best && f.best.includes(f.win)));
          } else sum.innerHTML = '';
          bars.forEach((b, k) => {
            b.hidden = k >= f.done;
            b.classList.toggle('now', on && scan[k].w === f.win && !f.best);
            b.classList.toggle('best', !!(f.best && f.best.includes(scan[k].w)));
          });
        }
      };
    }
  });

  /* ==================================================================
     A two-state HMM: Viterbi and forward
     ================================================================== */
  const M2 = A.HMM_CG;
  const L2 = (p) => Math.log2(p);
  V.define('viterbi', {
    title: 'Hidden states: Viterbi and forward',
    sub: 'Which hidden state produced each letter? Dynamic programming over the states',
    inputs: [
      { key: 'x', label: 'DNA sequence', type: 'seq', letters: 'ACGT', min: 2, max: 12, default: 'GGCACTGAA' },
      { key: 'method', label: 'Algorithm', type: 'select', options: [['viterbi', 'Viterbi: the most probable path'], ['forward', 'forward: the probability of the sequence']], default: 'viterbi' }
    ],
    presets: {
      classic: { label: 'GGCACTGAA: the most probable path (Viterbi)', input: { x: 'GGCACTGAA', method: 'viterbi' } },
      island: { label: 'A GC-rich stretch in AT-rich DNA', input: { x: 'TTAGCGCGCATT', method: 'viterbi' } },
      forward: { label: 'GGCACTGAA: all paths together (forward)', input: { x: 'GGCACTGAA', method: 'forward' } }
    },
    practice: true,
    codeFor(input) {
      return input.method === 'forward'
        ? ['f[k][1] = start(k) × e_k(x[0])                (letters x[0] … x[n−1]; columns 1 … n)', 'for i = 2 … n, for each state k:', '    f[k][i] = e_k(x[i−1]) × ( f[+][i−1] × a(+→k)  +  f[−][i−1] × a(−→k) )', 'P(x) = f[+][n] + f[−][n]        (all paths added up)']
        : ['V[k][1] = log2 start(k) + log2 e_k(x[0])      (letters x[0] … x[n−1]; columns 1 … n)', 'for i = 2 … n, for each state k:', '    V[k][i] = log2 e_k(x[i−1]) + max( V[+][i−1] + log2 a(+→k),  V[−][i−1] + log2 a(−→k) )', '    remember which one gave the max', 'end in the state with the larger V[k][n]', 'trace back the remembered choices: the most probable path'];
    },
    build(input, mode) {
      const x = String(input.x).toUpperCase();
      const n = x.length;
      const S = M2.states;
      const frames = [];
      const F = (o) => frames.push(Object.assign({ filled: [], cur: null, chosen: {}, path: null, pathFrom: n, calc: null }, o));
      const fw = input.method === 'forward';
      const res = fw ? A.forward(M2, x) : A.viterbi(M2, x);
      const val = (a, i) => (fw ? res.F[a][i] : res.V[a][i]);
      F({ line: null, narr: `Two hidden states: <b>+</b>, which emits C and G more often (like DNA in a CpG island), and <b>−</b>, which emits A and T more often. Each letter comes from one state; we see the letters ${seq(x)}, not the states – they are <b>hidden</b>. ${fw ? 'The forward algorithm adds up the probability of the sequence over every possible path of states.' : 'The Viterbi algorithm finds the single most probable path of states: one cell per state and letter, filled left to right, as in an alignment matrix.'}` });
      const filled = [];
      const chosen = {};
      let asked = 0;
      for (let i = 0; i < n; i++) {
        S.forEach((k, a) => {
          let calc, narr;
          const e = M2.emit[k][x[i]];
          if (i === 0) {
            calc = fw ? `f${k}(1) = start(${k}) × e${k}(${x[0]}) = ${M2.start[k]} × ${e} = <b>${prob(val(a, 0))}</b>` : `V${k}(1) = log2 start(${k}) + log2 e${k}(${x[0]}) = ${sumStr([L2(M2.start[k]), L2(e)])} = <b>${num(val(a, 0))}</b>`;
            narr = `The first letter, ${x[0]}, from state ${k}: the chance of starting in ${k} (${M2.start[k]}) times the chance that ${k} emits ${x[0]} (${e})${fw ? '' : ' – in log2, a sum'}.`;
          } else if (fw) {
            const t = S.map((j, b) => `${prob(val(b, i - 1))} × ${M2.trans[j][k]}`).join(' + ');
            calc = `f${k}(${i + 1}) = e${k}(${x[i]}) × (f+(${i}) × a(+→${k}) + f−(${i}) × a(−→${k})) = ${e} × (${t}) = <b>${prob(val(a, i))}</b>`;
            narr = `Letter ${i + 1}, ${x[i]}, in state ${k}: the paths can come from either state, so their probabilities are <b>added</b>, then multiplied by the chance that ${k} emits ${x[i]}.`;
          } else {
            const c = res.cand[a][i];
            const b = res.P[a][i];
            calc = `V${k}(${i + 1}) = log2 e${k}(${x[i]}) + max(V+(${i}) + log2 a(+→${k}), V−(${i}) + log2 a(−→${k})) = ${num(L2(e))} + max(${num(val(0, i - 1))} ${num(L2(M2.trans['+'][k])).replace('−', '− ')}, ${num(val(1, i - 1))} ${num(L2(M2.trans['−'][k])).replace('−', '− ')}) = ${num(L2(e))} + max(${num(c[0])}, ${num(c[1])}) = <b>${num(val(a, i))}</b>`;
            narr = `Letter ${i + 1}, ${x[i]}, in state ${k}: the best way to get here is from state ${S[b]} (${num(c[b])} against ${num(c[1 - b])}). Remember that choice – the arrow – and add log2 of the chance that ${k} emits ${x[i]}.`;
          }
          const isAsk = mode === 'practice' && (fw ? i <= 1 : i <= 1 || (i === 2 && a === 0));
          if (isAsk) {
            asked++;
            const ans = fw ? val(a, i) : Math.round(val(a, i) * 100) / 100;
            F({ filled: filled.slice(), chosen: Object.assign({}, chosen), cur: [a, i], calc: calc.replace(/<b>[^<]*<\/b>$/, '<b>?</b>'), line: i === 0 ? 0 : 2, narr, ask: { type: 'number', answer: ans, tol: fw ? Math.max(0.00051, ans * 0.01) : 0.021, prompt: fw ? `What is f${k}(${i + 1})? (3 significant figures are enough.)` : `What is V${k}(${i + 1})? (Two decimals.)`, hint: fw ? 'Multiply and add as the calculation above shows.' : `log2 0.5 = −1, log2 0.4 = −1.32, log2 0.6 = −0.74, log2 0.3 = −1.74, log2 0.2 = −2.32.`, explain: calc.replace(/<\/?b>/g, '') + '.' } });
          }
          filled.push([a, i]);
          if (!fw && i > 0) chosen[a + ',' + i] = res.P[a][i];
          F({ filled: filled.slice(), chosen: Object.assign({}, chosen), cur: [a, i], calc, line: i === 0 ? 0 : fw ? [1, 2] : [1, 2, 3], narr, dwell: i < 2 ? 1.2 : 0.5 });
        });
      }
      if (fw) {
        F({ filled: filled.slice(), cur: null, calc: `P(${x}) = f+(${n}) + f−(${n}) = ${prob(res.F[0][n - 1])} + ${prob(res.F[1][n - 1])} = <b>${prob(res.total)}</b>`, sumEnd: true, line: 3, narr: `The probability of the sequence, over all ${2 ** n} paths of states: the sum of the last column, <b>${prob(res.total)}</b>. Database searches with HMMs (HMMER) score a sequence this way – how well it fits the model, against how well it fits a random model.`, dwell: 2 });
      } else {
        const e = res.end;
        F({ filled: filled.slice(), chosen: Object.assign({}, chosen), cur: [e, n - 1], calc: `best = max(V+(${n}), V−(${n})) = max(${num(res.V[0][n - 1])}, ${num(res.V[1][n - 1])}) = <b>${num(res.best)}</b>`, line: 4, narr: `The most probable path ends in state ${S[e]}, the larger of the two cells in the last column. Its probability is 2<sup>${num(res.best)}</sup> = ${prob(2 ** res.best)}.` });
        if (mode === 'practice') {
          const p = res.path.join('');
          F({ filled: filled.slice(), chosen: Object.assign({}, chosen), cur: [e, n - 1], path: null, line: 5, narr: 'Now trace back along the arrows, from the last column to the first.', ask: { type: 'text', answer: [p, p.replace(/−/g, '-')], prompt: `Follow the arrows back. What is the most probable path? Write one + or − per letter (${n} in all), from the first letter to the last.`, hint: `Start at state ${S[e]} in the last column; at each cell, the arrow says which state came before.`, explain: p + '.' } });
        }
        for (let i = n - 1; i >= 0; i--) {
          F({ filled: filled.slice(), chosen: Object.assign({}, chosen), cur: [res.pathIdx[i], i], path: res.pathIdx, pathFrom: i, line: 5, narr: i === n - 1 ? `Trace back: start at ${S[res.pathIdx[i]]} in the last column and follow the arrows.` : `Letter ${i + 1}, ${x[i]}: state ${S[res.pathIdx[i]]}.`, dwell: 0.45 });
        }
        const runs = [];
        res.path.forEach((s, i) => (runs.length && runs[runs.length - 1].s === s ? runs[runs.length - 1].n++ : runs.push({ s, n: 1, at: i })));
        const desc = runs.map((r) => `${seq(x.slice(r.at, r.at + r.n))} ${r.s}`).join(', ');
        F({ filled: filled.slice(), chosen: Object.assign({}, chosen), path: res.pathIdx, pathFrom: 0, line: null, narr: `The most probable path: ${desc}. That is the <b>decoding</b>: each letter labelled with the state most likely to have produced it. Gene finders such as AUGUSTUS decode genomes this way, with states for exons, introns and the sequence between genes. (Real CpG-island models stay in a state for hundreds of letters: their chance of staying is close to 1, not 0.5 or 0.6.)`, dwell: 2 });
      }
      return { frames, data: { x, n, fw, res } };
    },
    view(stage, data) {
      const { x, n, fw, res } = data;
      const S = M2.states;
      const box = h('div.vt');
      // the model
      const model = h('div.vt-model');
      model.innerHTML = `<svg viewBox="0 0 300 150" class="vt-svg" aria-label="the two-state model">
        <defs><marker id="vtA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6b7686"/></marker></defs>
        <path d="M96,52 C130,30 170,30 204,52" class="vt-e" marker-end="url(#vtA)"/>
        <path d="M204,80 C170,102 130,102 96,80" class="vt-e" marker-end="url(#vtA)"/>
        <path d="M58,40 C30,0 100,0 82,38" class="vt-e" marker-end="url(#vtA)"/>
        <path d="M218,40 C200,0 270,0 242,38" class="vt-e" marker-end="url(#vtA)"/>
        <circle cx="70" cy="66" r="28" class="vt-s plus"/><text x="70" y="74" class="vt-st">+</text>
        <circle cx="230" cy="66" r="28" class="vt-s minus"/><text x="230" y="74" class="vt-st">−</text>
        <text x="150" y="28" class="vt-p">${M2.trans['+']['−']}</text><text x="150" y="112" class="vt-p">${M2.trans['−']['+']}</text>
        <text x="40" y="12" class="vt-p">${M2.trans['+']['+']}</text><text x="262" y="12" class="vt-p">${M2.trans['−']['−']}</text>
        <text x="70" y="134" class="vt-em">A .2 C .3 G .3 T .2</text><text x="230" y="134" class="vt-em">A .3 C .2 G .2 T .3</text>
      </svg>`;
      const calc = h('div.vt-calc');
      box.appendChild(h('div.vt-top', model, h('div.vt-side', h('div.viz-label', 'This step'), calc, h('div.vt-note', `Start: + ${M2.start['+']}, − ${M2.start['−']}. Arrows: the chance of the next state. Under each state: its chance of emitting each letter.`))));
      // the matrix of states × letters
      const W = stage.clientWidth || 700;
      const gx = 22, ch = 38, gy = 34, x0 = 34, y0 = 44;
      const cw = Math.max(42, Math.min(66, Math.floor((W - 50) / n) - gx));
      const cx = (i) => x0 + i * (cw + gx);
      const cy = (a) => y0 + a * (ch + gy);
      const gridW = x0 + n * (cw + gx), gridH = y0 + 2 * ch + gy + 46;
      const grid = h('div.vt-grid', { style: { width: gridW + 'px', height: gridH + 'px', '--vf': fw ? '0.64rem' : cw < 56 ? '0.7rem' : '0.8rem' } });
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'vt-arrows');
      svg.setAttribute('width', gridW);
      svg.setAttribute('height', gridH);
      // arrowheads, one per colour (a marker does not take the colour of its line)
      const heads = { cand: '#c3cbd6', chosen: '#9aa6b8', now: '#b8480b', sum: '#c3cbd6', path: '#0b6b8a' };
      svg.innerHTML = '<defs>' + Object.entries(heads).map(([k, c]) => `<marker id="vt-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${c}"/></marker>`).join('') + '</defs>';
      grid.appendChild(svg);
      const arrows = {};
      for (let i = 1; i < n; i++) {
        S.forEach((_, a) => S.forEach((__, b) => {
          const l = document.createElementNS(svgNS, 'line');
          l.setAttribute('x1', cx(i - 1) + cw);
          l.setAttribute('y1', cy(b) + ch / 2);
          l.setAttribute('x2', cx(i) - 2);
          l.setAttribute('y2', cy(a) + ch / 2);
          svg.appendChild(l);
          arrows[`${b}>${a},${i}`] = l;
        }));
      }
      // letters across the top, states down the side
      x.split('').forEach((c, i) => {
        grid.appendChild(h('div.vt-col', { style: { left: cx(i) + 'px', width: cw + 'px' } }, h('span.vt-i', String(i + 1)), h('span', { class: V.tileClass(c) }, c)));
      });
      S.forEach((k, a) => grid.appendChild(h('div.vt-row', { class: a ? 'minus' : 'plus', style: { top: cy(a) + 'px', height: ch + 'px' } }, k)));
      const cells = S.map((_, a) => A.range(n).map((i) => {
        const c = h('div.vt-cell', { style: { left: cx(i) + 'px', top: cy(a) + 'px', width: cw + 'px', height: ch + 'px' } });
        grid.appendChild(c);
        return c;
      }));
      // the decoded path, as a band under the letters
      const band = A.range(n).map((i) => {
        const b = h('div.vt-band', { style: { left: cx(i) + 'px', top: y0 + 2 * ch + gy + 14 + 'px', width: cw + 'px' } });
        grid.appendChild(b);
        return b;
      });
      box.appendChild(h('div.vt-wrap', grid));
      stage.appendChild(box);
      return {
        update(f, prev, ctx) {
          calc.innerHTML = f.calc || '';
          const filled = new Set(f.filled.map(([a, i]) => a + ',' + i));
          const asking = f.ask && ctx.asking;
          S.forEach((_, a) => A.range(n).forEach((i) => {
            const c = cells[a][i];
            const isF = filled.has(a + ',' + i);
            const isCur = f.cur && f.cur[0] === a && f.cur[1] === i;
            const v = fw ? res.F[a][i] : res.V[a][i];
            const txt = isF ? (fw ? prob(v) : num(v)) : isCur && asking ? '?' : '';
            const inPath = f.path && i >= f.pathFrom && f.path[i] === a;
            c.className = 'vt-cell' + (isF ? ' on' : '') + (isCur ? ' cur' : '') + (inPath ? ' path' : '') + (a ? ' minus' : ' plus');
            if (c.textContent !== txt) {
              c.textContent = txt;
              if (isF && isCur && !ctx.instant && !ctx.back) V.anim(c, [{ transform: 'scale(1.2)', background: '#ffe6cc' }, { transform: 'none' }], 450, ctx);
            }
          }));
          // arrows: candidates of the current cell, the remembered choices, the traced path
          Object.entries(arrows).forEach(([key, l]) => {
            const [ba, i] = key.split(',');
            const [b, a] = ba.split('>').map(Number);
            const ii = Number(i);
            let cls = '';
            const curHere = !f.path && f.cur && f.cur[0] === a && f.cur[1] === ii;
            if (fw) {
              if (filled.has(a + ',' + ii)) cls = 'sum';
              if (curHere) cls = 'cand';
            } else {
              const ch2 = f.chosen[a + ',' + ii];
              if (ch2 === b) cls = 'chosen';
              if (curHere) cls = ch2 === b ? 'chosen now' : 'cand';
              if (f.path && ii > f.pathFrom && f.path[ii] === a && f.path[ii - 1] === b) cls = 'path';
            }
            l.setAttribute('class', cls);
            const head = cls.split(' ').pop();
            if (head) l.setAttribute('marker-end', `url(#vt-${head})`);
            else l.removeAttribute('marker-end');
          });
          band.forEach((b, i) => {
            const on = f.path && i >= f.pathFrom;
            b.className = 'vt-band' + (on ? (f.path[i] ? ' minus' : ' plus') : '');
            b.textContent = on ? S[f.path[i]] : '';
          });
        }
      };
    }
  });

  /* ==================================================================
     A profile HMM from a multiple alignment
     ================================================================== */
  const FAMILY = 'TCGGF ACG-F NCG-F TCG-W TC--W';
  V.define('phmm', {
    title: 'A profile hidden Markov model',
    sub: 'Built from a multiple alignment; every sequence is a path through it',
    inputs: [
      { key: 'aln', label: 'Aligned sequences, - for a gap', type: 'text', max: 90, default: FAMILY, help: '3 to 8 sequences, all the same length (3 to 10 columns).' },
      { key: 'query', label: 'New sequence to score', type: 'text', max: 12, default: 'TCGW' },
      { key: 'show', label: 'Show', type: 'select', options: [['all', 'building the model, then the score'], ['score', 'only the score']], default: 'all' }
    ],
    presets: {
      family: { label: 'Build the model, then score TCGW', input: { aln: FAMILY, query: 'TCGW', show: 'all' } },
      insert: { label: 'Score ACGGF (with an insertion)', input: { aln: FAMILY, query: 'ACGGF', show: 'score' } },
      deletion: { label: 'Score TCW (with a deletion)', input: { aln: FAMILY, query: 'TCW', show: 'score' } },
      nopath: { label: 'Score TGGF (never seen)', input: { aln: FAMILY, query: 'TGGF', show: 'score' } }
    },
    practice: true,
    check(input) {
      const rows = String(input.aln).toUpperCase().split(/[\s,]+/).filter(Boolean);
      const q = String(input.query).toUpperCase().replace(/\s+/g, '');
      if (rows.length < 3 || rows.length > 8) return 'Give 3 to 8 aligned sequences.';
      if (rows.some((r) => r.length !== rows[0].length)) return 'The aligned sequences must all have the same length (use - for gaps).';
      if (rows[0].length < 3 || rows[0].length > 10) return 'Alignments of 3 to 10 columns.';
      if (rows.some((r) => /[^A-Z-]/.test(r)) || /[^A-Z]/.test(q)) return 'Letters (and - in the alignment) only.';
      if (rows.some((r) => !/[A-Z]/.test(r))) return 'Every sequence needs at least one letter.';
      if (!A.phmmBuild(rows).k) return 'No column has letters in at least half of the sequences.';
      if (q.length < 1 || q.length > 12) return 'The new sequence needs 1 to 12 letters.';
      return null;
    },
    codeFor() {
      return [
        'match columns = columns with letters in at least half of the sequences',
        'states: M (match, emits a letter), I (insert, emits a letter), D (delete, silent)',
        'emission e_M(a) = how often column j has letter a / letters in column j',
        'each sequence = a path: letter in match column j → Mj, gap there → Dj, letter in an insert column → I',
        'transition a(s→t) = paths going s→t / paths leaving s',
        'P(sequence, path) = product of the transitions and emissions along the path',
        'Viterbi: the path with the highest P; score = log2( P / P(random) ) in bits'
      ];
    },
    build(input, mode) {
      const rows = String(input.aln).toUpperCase().split(/[\s,]+/).filter(Boolean);
      const q = String(input.query).toUpperCase().replace(/\s+/g, '');
      const m = A.phmmBuild(rows);
      const n = rows.length, L = rows[0].length, k = m.k;
      const all = input.show !== 'score';
      const frames = [];
      const empty = { emitUpto: 0, counts: {}, probs: false, iemit: {} };
      const full = { emitUpto: k, counts: m.transN, probs: true, iemit: m.emitN };
      const F = (o) => frames.push(Object.assign({ colsUpto: all ? 0 : L, col: null, model: !all, token: null, path: null, pathUpto: 0, nowEdges: [], qpath: null, terms: null, rowOn: null }, all ? empty : full, o));
      const mIndex = {};
      m.matchCols.forEach((c, j) => (mIndex[c] = j + 1));
      const colSay = (c) => {
        const g = rows.filter((r) => r[c] === '-').length;
        const has = `${n - g} of ${n} sequences ${n - g === 1 ? 'has' : 'have'} a letter here`;
        return m.isMatch[c] ? `${has}: a <b>match</b> column, state M${mIndex[c]}.` : `only ${has}: an <b>insert</b> column – letters here are extras, emitted by an insert state.`;
      };
      if (all) {
        F({ line: null, narr: `${n} aligned sequences of a family. A profile HMM turns the alignment into a chain of states that can produce – <b>emit</b> – every sequence of the family, and others like them, each with a probability.` });
        let askedCol = false;
        A.range(L).forEach((c) => {
          if (mode === 'practice' && !askedCol && !m.isMatch[c]) {
            askedCol = true;
            F({ colsUpto: c, col: c, line: 0, narr: `Column ${c + 1}.`, ask: { type: 'choice', options: [['match', 'a match column'], ['insert', 'an insert column']], answer: 'insert', prompt: `Column ${c + 1}: a match column or an insert column?`, hint: 'A match column needs letters in at least half of the sequences.', explain: colSay(c).replace(/<\/?b>/g, '') } });
          }
          F({ colsUpto: c + 1, col: c, line: 0, narr: `Column ${c + 1}: ${colSay(c)}`, dwell: 0.8 });
        });
        F({ colsUpto: L, model: true, line: 1, narr: `The model: one <b>match</b> state (square) per match column, M1 to M${k}, from begin (B) to end (E). Under them, <b>delete</b> states (circles), which emit nothing – a gap in a match column – and <b>insert</b> states (diamonds), for extra letters between match columns. The grey arrows are every step the model allows.` });
        A.range(k).forEach((j) => {
          const e = m.emitN['M' + (j + 1)] || {};
          const tot = Object.values(e).reduce((x, y) => x + y, 0);
          const say = Object.keys(e).sort((a, b) => e[b] - e[a]).map((a) => `${a} ${e[a]}/${tot} = ${num(e[a] / tot)}`).join(', ');
          if (mode === 'practice' && j === 0) {
            const top = Object.keys(e).sort((a, b) => e[b] - e[a])[0];
            F({ colsUpto: L, model: true, emitUpto: j, col: m.matchCols[j], line: 2, narr: `M${j + 1}: the letters of column ${m.matchCols[j] + 1}.`, ask: { type: 'number', answer: Math.round((e[top] / tot) * 1000) / 1000, tol: 0.006, prompt: `What is the probability that M${j + 1} emits ${top}?`, hint: `How many of the ${tot} letters in column ${m.matchCols[j] + 1} are ${top}?`, explain: say + '.' } });
          }
          F({ colsUpto: L, model: true, emitUpto: j + 1, col: m.matchCols[j], line: 2, narr: `M${j + 1} emits the letters of column ${m.matchCols[j] + 1}, with their frequencies: ${say}.`, dwell: 0.7 });
        });
        // the paths of the sequences
        const counts = {};
        const iemit = {};
        let askedD = false;
        rows.forEach((r, ri) => {
          const p = m.paths[ri];
          const edges = [];
          for (let t = 1; t < p.length; t++) {
            edges.push(p[t - 1].s + '>' + p[t].s);
          }
          const before = JSON.parse(JSON.stringify(counts));
          const ibefore = JSON.parse(JSON.stringify(iemit));
          edges.forEach((e) => {
            const [f2, t2] = e.split('>');
            counts[f2] = counts[f2] || {};
            counts[f2][t2] = (counts[f2][t2] || 0) + 1;
          });
          p.forEach((st) => {
            if (st.s[0] === 'I') {
              iemit[st.s] = iemit[st.s] || {};
              iemit[st.s][st.a] = (iemit[st.s][st.a] || 0) + 1;
            }
          });
          const desc = p.slice(1, -1).map((st) => (st.a ? `${st.s} (${st.a})` : st.s)).join(' → ');
          const dState = p.find((st) => st.s[0] === 'D');
          if (mode === 'practice' && !askedD && dState) {
            askedD = true;
            F({ colsUpto: L, model: true, emitUpto: k, counts: before, iemit: ibefore, rowOn: ri, line: 3, narr: `Sequence ${ri + 1}, ${seq(r)}.`, ask: { type: 'pick', answer: 'n-' + dState.s, prompt: `Its gap in column ${dState.col + 1} – which state does the path pass through there? Click it.`, pickHint: 'Click a state of the model.', hint: 'A gap in a match column emits nothing.', explain: `${dState.s}, a delete state: it emits nothing.` } });
          }
          F({ colsUpto: L, model: true, emitUpto: k, counts: JSON.parse(JSON.stringify(counts)), iemit: JSON.parse(JSON.stringify(iemit)), path: p, rowOn: ri, nowEdges: edges, token: 'run', line: 3, narr: `Sequence ${ri + 1}, ${seq(r)}, is a path: B → ${desc} → E. Each step along an arrow adds 1 to its count.${p.some((st) => st.s[0] === 'I') ? ' Its extra letter goes to an insert state.' : ''}${dState ? ` Its gap is the silent state ${dState.s}.` : ''}`, dwell: 1.4 });
        });
        // transition probabilities
        const ex = Object.keys(m.transN).find((s2) => Object.keys(m.transN[s2]).length > 1);
        const exSay = ex ? (() => {
          const o = m.transN[ex];
          const tot = Object.values(o).reduce((x, y) => x + y, 0);
          return `${ex}: ${Object.keys(o).map((t) => `${o[t]} of ${tot} paths ${o[t] === 1 ? 'goes' : 'go'} on to ${t} (${num(o[t] / tot)})`).join(', ')}`;
        })() : '';
        if (mode === 'practice' && ex) {
          const o = m.transN[ex];
          const tot = Object.values(o).reduce((x, y) => x + y, 0);
          const t0 = Object.keys(o).sort((a, b) => o[b] - o[a])[0];
          F({ colsUpto: L, model: true, emitUpto: k, counts: m.transN, iemit: m.emitN, line: 4, narr: 'Now the counts become probabilities.', ask: { type: 'number', answer: Math.round((o[t0] / tot) * 1000) / 1000, tol: 0.006, prompt: `What is the probability of the step ${ex} → ${t0}?`, hint: `Of the paths leaving ${ex}, what fraction go to ${t0}?`, explain: exSay + '.' } });
        }
        F({ colsUpto: L, model: true, emitUpto: k, counts: m.transN, iemit: m.emitN, probs: true, line: 4, narr: `Divide each count by the number of paths leaving the state: the <b>transition probabilities</b>. ${exSay}. The model is trained: arrows never used have probability 0.`, dwell: 1.5 });
      } else {
        F({ line: null, narr: `The model built from the ${n} aligned sequences (watch “Build the model” to see how): match states with their emission probabilities, and the transition probabilities on the arrows the sequences use.` });
      }
      // scoring the new sequence, with the whole trained model on show
      const S = (o) => F(Object.assign({ model: true, colsUpto: L }, full, o));
      const v = A.phmmViterbi(m, q);
      if (!v) {
        // find where every path breaks off: the states reachable so far cannot emit the next letter
        const succ = (st) => Object.keys(m.trans[st] || {}).filter((t2) => m.trans[st][t2] > 0);
        const reachEmit = (set) => {
          const out = new Set(), stack = Array.from(set), seenD = new Set();
          while (stack.length) {
            succ(stack.pop()).forEach((t2) => {
              if (t2[0] === 'D') {
                if (!seenD.has(t2)) seenD.add(t2) && stack.push(t2);
              } else out.add(t2);
            });
          }
          return out;
        };
        let curS = new Set(['B']), fail = null;
        for (let i = 0; i < q.length && !fail; i++) {
          const cand = reachEmit(curS);
          const ok = Array.from(cand).filter((st) => st !== 'E' && m.emit[st] && m.emit[st][q[i]] > 0);
          if (!ok.length) fail = { i, cand: Array.from(cand) };
          else curS = new Set(ok);
        }
        if (!fail) fail = { i: q.length, cand: Array.from(reachEmit(curS)) };
        const what = (st) => (st === 'E' ? 'the end' : `${st} (${Object.keys(m.emit[st] || {}).join(', ')})`);
        const why = fail.i < q.length
          ? `after ${fail.i ? seq(q.slice(0, fail.i)) : 'the start'}, ${fail.cand.length === 1 ? `the only way on is ${what(fail.cand[0])}, which does not emit ${q[fail.i]}` : `the only ways on are ${fail.cand.map(what).join(' and ')}, and none of them emits ${q[fail.i]}`}`
          : `after the last letter, no path can reach the end without emitting more letters`;
        S({ line: 6, narr: `Is ${seq(q)} like the family? There is <b>no path</b> through the model that emits it: ${why}. Every path has probability 0. With just ${n} sequences that is too strict, so real tools add <b>pseudocounts</b> (HMMER mixes in typical amino-acid frequencies), giving every path a small probability.`, dwell: 2 });
      } else {
        const path = v.path;
        S({ line: 6, qpath: path, pathUpto: 0, terms: [], narr: `Now a new sequence, ${seq(q)}. Of all the paths that emit it, Viterbi finds the most probable – dynamic programming over the states, as in the previous animation. Follow it:` });
        let t = 0;
        const terms = [];
        for (let st = 1; st < path.length; st++) {
          const tr = v.terms[t++];
          terms.push(tr);
          let em = null;
          if (path[st].a) {
            em = v.terms[t++];
            terms.push(em);
          }
          const say = `${tr.from} → ${tr.to}: × ${num(tr.p)}` + (em ? `; ${em.s} emits ${em.a}: × ${num(em.p)}` : path[st].s[0] === 'D' ? ` (a delete state: no letter)` : '');
          S({ line: 5, qpath: path, pathUpto: st, terms: terms.slice(), narr: say + '.', dwell: 0.6 });
        }
        const rnd = (1 / 20) ** q.length;
        const bits = Math.log2(v.prob / rnd);
        if (mode === 'practice') S({ line: 5, qpath: path, pathUpto: path.length - 1, terms: terms.slice(), hideP: true, narr: 'The probability of the sequence along this path is the product of all the factors.', ask: { type: 'number', answer: Number(v.prob.toPrecision(3)), tol: Math.max(0.0006, v.prob * 0.01), prompt: `What is P(${q}, this path)? Multiply the factors.`, hint: 'Multiply the numbers listed on the right (the factors of 1 change nothing).', explain: `${terms.map((x) => num(x.p)).join(' × ')} = ${prob(v.prob)}.` } });
        S({ line: 6, qpath: path, pathUpto: path.length - 1, terms: terms.slice(), done: { p: v.prob, rnd, bits }, narr: `P(${q}, best path) = <b>${prob(v.prob)}</b>. A random protein sequence of ${q.length} letters has probability (1/20)<sup>${q.length}</sup> = ${prob(rnd)} (each amino acid 1/20, a simple random model). The score is log2 of the ratio: <b>${num(bits, 1)} bits</b> – as in BLAST, the more bits, the less likely by chance. HMMER scores sequences against Pfam’s profile HMMs this way (summing over all paths with the forward algorithm, and with pseudocounts).`, dwell: 2 });
      }
      return { frames, data: { rows, q, m, n, L, k } };
    },
    view(stage, data) {
      const { rows, m, n, L, k } = data;
      const box = h('div.ph');
      // the alignment
      const alnBox = h('div.ph-aln');
      alnBox.appendChild(h('div.viz-label', 'The alignment'));
      const tileRows = rows.map((r) => {
        const t = V.tiles(r, '', true);
        alnBox.appendChild(h('div.ph-arow', t));
        return Array.from(t.children);
      });
      const marks = h('div.ph-marks', A.range(L).map(() => h('span')));
      alnBox.appendChild(marks);
      const side = h('div.ph-side');
      box.appendChild(h('div.ph-top', alnBox, side));
      // the graph
      const W = Math.max(420, (stage.clientWidth || 700) - 10);
      const dx = Math.min(122, (W - 60) / (k + 1.5));
      const X = (j) => 26 + j * dx;
      const yM = 104, yD = 170, yI = 232, GH = 276;
      const GW = X(k + 1) + 30;
      const graph = h('div.ph-graph', { style: { width: GW + 'px', height: GH + 'px' } });
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('width', GW);
      svg.setAttribute('height', GH);
      svg.setAttribute('class', 'ph-svg');
      const heads = { sk: '#d5dbe4', used: '#7d8898', now: '#b8480b', qp: '#0b6b8a' };
      svg.innerHTML = '<defs>' + Object.entries(heads).map(([c, col]) => `<marker id="ph-${c}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${col}"/></marker>`).join('') + '</defs>';
      graph.appendChild(svg);
      // states
      const pos = {};
      pos.B = [X(0), yM];
      pos.E = [X(k + 1), yM];
      for (let j = 1; j <= k; j++) {
        pos['M' + j] = [X(j), yM];
        pos['D' + j] = [X(j), yD];
      }
      for (let j = 0; j <= k; j++) pos['I' + j] = [X(j) + dx / 2, yI];
      const nodes = {};
      Object.entries(pos).forEach(([id, [x, y]]) => {
        const kind = id === 'B' || id === 'E' ? 'be' : id[0].toLowerCase();
        const el = h('div.ph-n.' + kind, { 'data-pick': 'n-' + id, style: { left: x + 'px', top: y + 'px' } }, h('span', id));
        nodes[id] = el;
        graph.appendChild(el);
      });
      // emission boxes above the match states, below the insert states
      const emBox = {};
      for (let j = 1; j <= k; j++) {
        const el = h('div.ph-em', { style: { left: X(j) + 'px', bottom: GH - yM + 22 + 'px' } });
        emBox['M' + j] = el;
        graph.appendChild(el);
      }
      for (let j = 0; j <= k; j++) {
        const el = h('div.ph-em.ins', { style: { left: X(j) + dx / 2 + 'px', top: yI + 16 + 'px' } });
        emBox['I' + j] = el;
        graph.appendChild(el);
      }
      // the arrows the model allows
      const edges = {};
      const R = { M: 17, B: 16, E: 16, D: 15, I: 15 };
      const addEdge = (f, t) => {
        const [x1, y1] = pos[f], [x2, y2] = pos[t];
        const g = document.createElementNS(svgNS, 'g');
        const path = document.createElementNS(svgNS, 'path');
        let d, lx, ly;
        if (f === t) {
          d = `M${x1 - 8},${y1 + 12} C${x1 - 26},${y1 + 44} ${x1 + 26},${y1 + 44} ${x1 + 8},${y1 + 13}`;
          lx = x1 + 22;
          ly = y1 + 40;
        } else {
          const len = Math.hypot(x2 - x1, y2 - y1);
          const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
          const r1 = R[f[0]], r2 = R[t[0]] + 2;
          d = `M${x1 + ux * r1},${y1 + uy * r1} L${x2 - ux * r2},${y2 - uy * r2}`;
          // where along the arrow its number goes, so that crossing arrows keep theirs apart
          const kind = (f[0] === 'B' ? 'M' : f[0]) + (t[0] === 'E' ? 'M' : t[0]);
          const at = { MI: 0.72, MD: 0.3, IM: 0.35, DM: 0.7 }[kind] || 0.5;
          lx = x1 + (x2 - x1) * at - uy * 9;
          ly = y1 + (y2 - y1) * at + ux * 9 + 4;
        }
        path.setAttribute('d', d);
        const lab = document.createElementNS(svgNS, 'text');
        lab.setAttribute('x', lx);
        lab.setAttribute('y', ly);
        lab.setAttribute('class', 'ph-lab');
        g.appendChild(path);
        g.appendChild(lab);
        svg.appendChild(g);
        edges[f + '>' + t] = { g, path, lab };
      };
      for (let j = 0; j <= k; j++) {
        const fromM = j === 0 ? 'B' : 'M' + j;
        const toM = j === k ? 'E' : 'M' + (j + 1);
        addEdge(fromM, toM);
        addEdge(fromM, 'I' + j);
        if (j < k) addEdge(fromM, 'D' + (j + 1));
        addEdge('I' + j, 'I' + j);
        addEdge('I' + j, toM);
        if (j < k) addEdge('I' + j, 'D' + (j + 1));
        if (j >= 1) {
          addEdge('D' + j, toM);
          addEdge('D' + j, 'I' + j);
          if (j < k) addEdge('D' + j, 'D' + (j + 1));
        }
      }
      const token = h('div.ph-token');
      graph.appendChild(token);
      box.appendChild(h('div.ph-wrap', graph));
      stage.appendChild(box);
      const centre = (id) => pos[id];
      return {
        update(f, prev, ctx) {
          // the alignment: columns marked once judged
          const mi = {};
          m.matchCols.forEach((c, j) => (mi[c] = j + 1));
          Array.from(marks.children).forEach((sp, c) => {
            sp.textContent = c < f.colsUpto ? (m.isMatch[c] ? 'M' + mi[c] : 'ins') : '';
            sp.className = c < f.colsUpto ? (m.isMatch[c] ? 'm' : 'i') : '';
          });
          tileRows.forEach((tr, ri) => {
            tr.forEach((el, c) => el.classList.toggle('cur', f.col === c));
            tr[0].parentNode.parentNode.classList.toggle('on', f.rowOn === ri);
          });
          graph.classList.toggle('off', !f.model);
          graph.classList.toggle('picking', !!ctx.asking && f.ask && f.ask.type === 'pick');
          // emissions
          for (let j = 1; j <= k; j++) {
            const e = m.emitN['M' + j] || {};
            const tot = Object.values(e).reduce((x, y) => x + y, 0);
            const on = j <= f.emitUpto;
            emBox['M' + j].innerHTML = on ? Object.keys(e).sort((a, b) => e[b] - e[a]).map((a) => `<div><span class="${V.tileClass(a, true)}">${esc(a)}</span>${num(e[a] / tot)}</div>`).join('') : '';
            emBox['M' + j].classList.toggle('cur', f.emitUpto === j && f.col === m.matchCols[j - 1]);
          }
          for (let j = 0; j <= k; j++) {
            const e = (f.iemit || {})['I' + j];
            const el = emBox['I' + j];
            if (e) {
              const tot = Object.values(e).reduce((x, y) => x + y, 0);
              el.innerHTML = Object.keys(e).map((a) => `<div><span class="${V.tileClass(a, true)}">${esc(a)}</span>${num(e[a] / tot)}</div>`).join('');
            } else el.innerHTML = '';
          }
          // arrows: counts or probabilities
          const qEdges = new Set();
          if (f.qpath) for (let t = 1; t <= f.pathUpto; t++) qEdges.add(f.qpath[t - 1].s + '>' + f.qpath[t].s);
          const now = new Set(f.nowEdges || []);
          Object.entries(edges).forEach(([key, e]) => {
            const [a, b] = key.split('>');
            const c = (f.counts[a] && f.counts[a][b]) || 0;
            let cls = 'sk';
            if (c) cls = 'used';
            if (now.has(key)) cls = 'now';
            if (qEdges.has(key)) cls = 'qp';
            e.g.setAttribute('class', 'ph-e ' + cls);
            e.path.setAttribute('marker-end', `url(#ph-${cls})`);
            let txt = '';
            if (c) {
              if (f.probs) {
                const tot = Object.values(f.counts[a]).reduce((x, y) => x + y, 0);
                txt = num(c / tot).replace(/^1\.00$/, '1');
              } else txt = String(c);
            }
            e.lab.textContent = txt;
          });
          // states on the path of the new sequence
          const onQ = new Set();
          if (f.qpath) for (let t = 0; t <= f.pathUpto; t++) onQ.add(f.qpath[t].s);
          Object.entries(nodes).forEach(([id, el]) => {
            el.classList.toggle('qp', onQ.has(id));
            el.classList.toggle('cur', !!f.qpath && f.qpath[f.pathUpto] && f.qpath[f.pathUpto].s === id && f.pathUpto > 0);
            const used = id === 'B' || id === 'E' || Object.keys(f.counts).includes(id) || Object.values(f.counts).some((o) => o[id]);
            el.classList.toggle('used', used);
          });
          // the token
          token.getAnimations().forEach((a) => a.cancel());
          if (f.token === 'run' && f.path) {
            const pts = f.path.map((st) => centre(st.s));
            const last = pts[pts.length - 1];
            token.hidden = false;
            token.textContent = '';
            token.style.left = last[0] + 'px';
            token.style.top = last[1] + 'px';
            token.style.opacity = '0';
            const d = V.dur(320 * pts.length, ctx);
            if (d && !ctx.back) {
              token.animate(pts.map(([x, y], i) => ({ left: x + 'px', top: y + 'px', opacity: i === pts.length - 1 ? 0 : 1 })), { duration: d, easing: 'linear', fill: 'none' });
            }
          } else if (f.qpath && f.qpath[f.pathUpto].s !== 'B' && f.qpath[f.pathUpto].s !== 'E') {
            const st = f.qpath[f.pathUpto];
            const [x, y] = centre(st.s);
            token.hidden = false;
            token.style.opacity = '';
            token.textContent = st.a || '';
            token.style.left = x + 'px';
            token.style.top = y + 'px';
          } else token.hidden = true;
          // the side panel: the product along the path
          side.innerHTML = '';
          if (f.terms) {
            side.appendChild(h('div.viz-label', 'P(sequence, path) ='));
            const list = h('div.ph-terms');
            f.terms.forEach((t, i) => list.appendChild(h('div', { class: 'ph-term ' + t.kind + (i >= f.terms.length - 2 && (t.kind === 'e' || i === f.terms.length - 1) ? ' last' : ''), title: t.kind === 't' ? `the step ${t.from} → ${t.to}` : `${t.s} emits ${t.a}` }, h('span.ph-tw', t.kind === 't' ? `${t.from}→${t.to}` : `${t.s}:${t.a}`), h('b', num(t.p).replace(/^1\.00$/, '1')))));
            side.appendChild(list);
            const pNow = f.terms.reduce((x, t) => x * t.p, 1);
            side.appendChild(h('div.ph-prod', { html: f.hideP && ctx.asking ? 'product = <b>?</b>' : `product = <b>${prob(pNow)}</b>` }));
            if (f.done) side.appendChild(h('div.ph-bits', { html: `random: (1/20)<sup>${data.q.length}</sup> = ${prob(f.done.rnd)}<br>score = log2(${prob(f.done.p)} / ${prob(f.done.rnd)}) = <b>${num(f.done.bits, 1)} bits</b>` }));
          } else {
            side.appendChild(h('div.viz-label', 'States'));
            side.appendChild(h('div.ph-key', { html: '<span class="ph-n m sm"></span> match: emits a letter of its column<br><span class="ph-n d sm"></span> delete: a gap, emits nothing<br><span class="ph-n i sm"></span> insert: an extra letter<br>B, E: begin and end' }));
          }
        }
      };
    }
  });
})();
