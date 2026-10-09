/* =====================================================================
   Multiple alignment: a guide tree by UPGMA, then star or progressive
   alignment, scored by the sum of pairs.
   ===================================================================== */
(function () {
  'use strict';
  const MG = window.MG;
  const { h, esc } = MG;
  const V = MG.viz;
  const A = MG.algo;
  const seq = V.seq;
  const fmt = (x) => (Math.round(x * 100) / 100).toString();
  const num = (x) => String(x).replace('-', '−');

  /* ==================================================================
     UPGMA
     ================================================================== */
  const FIVE_D = '3 7 8 10 6 8 7 4 5 6';
  function parseD(names, text) {
    const n = names.length;
    const v = String(text).split(/[\s,;]+/).filter(Boolean).map(Number);
    if (v.length !== (n * (n - 1)) / 2 || v.some((x) => !Number.isFinite(x) || x < 0)) return null;
    const D = A.range(n).map(() => new Array(n).fill(0));
    let k = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) D[i][j] = D[j][i] = v[k++];
    return D;
  }
  V.define('upgma', {
    title: 'A tree from distances: UPGMA',
    sub: 'Join the two closest; average the distances; repeat',
    inputs: [
      { key: 'names', label: 'Names', type: 'text', max: 40, default: 'a b c d e', help: '3 to 7 short names.' },
      { key: 'd', label: 'Distances, row by row (a–b, a–c, … then b–c, …)', type: 'text', max: 200, default: FIVE_D }
    ],
    presets: {
      five: { label: 'Five sequences a–e', input: { names: 'a b c d e', d: FIVE_D } },
      four: { label: 'Four sequences, two pairs', input: { names: 'human chimp mouse rat', d: '1 8 8 8 8 2' } }
    },
    practice: true,
    check(input) {
      const names = String(input.names).split(/[\s,]+/).filter(Boolean);
      if (names.length < 3 || names.length > 7) return 'Give 3 to 7 names.';
      if (!parseD(names, input.d)) return `Give ${(names.length * (names.length - 1)) / 2} distances (every pair once), separated by spaces.`;
      return null;
    },
    code: [
      'clusters = each sequence on its own',
      'while more than one cluster:',
      '    join the two closest clusters A and B, at height d(A, B) / 2',
      '    d(AB, C) = average of d(x, y) over all x in AB, y in C'
    ],
    build(input, mode) {
      const names = String(input.names).split(/[\s,]+/).filter(Boolean);
      const D = parseD(names, input.d);
      const u = A.upgma(names, D);
      const nodes = u.nodes;
      const frames = [];
      const F = (o) => frames.push(Object.assign({ joined: [], cur: null, matrix: null, pair: null }, o));
      const name = (id) => nodes[id].name;
      F({ step: 0, matrix: u.steps[0].matrixBefore, clusters: u.steps[0].before, line: 0, narr: `Distances between ${names.length} sequences (for example 1 − the fraction of identical positions). UPGMA builds a tree by joining the closest pair, again and again.` });
      let asked = 0;
      u.steps.forEach((st, k) => {
        const ia = st.before.findIndex((c) => c.id === st.join[0]), ib = st.before.findIndex((c) => c.id === st.join[1]);
        if (mode === 'practice' && asked < 3) {
          asked++;
          F({ step: k, matrix: st.matrixBefore, clusters: st.before, joined: u.steps.slice(0, k).map((x) => x.node), line: 2, narr: `Step ${k + 1}: which two are closest?`, ask: { type: 'pick', answer: [`m-${ia}-${ib}`, `m-${ib}-${ia}`], prompt: 'Click the smallest distance in the table.', pickHint: 'Click a cell of the table.', hint: 'Look for the smallest number off the diagonal.', explain: `${esc(st.names[0])} and ${esc(st.names[1])}: ${fmt(st.d)}.` } });
        }
        F({ step: k, matrix: st.matrixBefore, clusters: st.before, pair: [ia, ib], joined: u.steps.slice(0, k).map((x) => x.node), line: 2, narr: `The smallest distance is ${fmt(st.d)}, between ${esc(st.names[0])} and ${esc(st.names[1])}.`, dwell: 1.1 });
        F({ step: k, matrix: st.matrixBefore, clusters: st.before, pair: [ia, ib], joined: u.steps.slice(0, k + 1).map((x) => x.node), cur: st.node, line: 2, narr: `Join them at height ${fmt(st.d)}/2 = <b>${fmt(st.height)}</b>; their branches are ${fmt(st.branch[0])} and ${fmt(st.branch[1])} long (the new height minus each one’s own).`, dwell: 1.2 });
        const nxt = u.steps[k + 1];
        if (nxt) {
          const newId = st.node;
          const others = nxt.before.filter((c) => c.id !== newId);
          const memA = (id) => {
            const out = [];
            const go = (x) => (nodes[x].kids.length ? nodes[x].kids.forEach(go) : out.push(x));
            go(id);
            return out;
          };
          const mNew = memA(newId);
          const exp = others.slice(0, 2).map((c) => {
            const mo = memA(c.id);
            const parts = [];
            mNew.forEach((x) => mo.forEach((y) => parts.push(D[x][y])));
            return `d(${esc(name(newId))}, ${esc(name(c.id))}) = (${parts.join(' + ')}) / ${parts.length} = ${fmt(parts.reduce((s2, v) => s2 + v, 0) / parts.length)}`;
          });
          const use = [];
          if (others.length) memA(others[0].id).forEach((y) => mNew.forEach((x) => use.push([x, y])));
          if (mode === 'practice' && asked < 5 && others.length) {
            asked++;
            const c = others[0];
            const mo = memA(c.id);
            let t = 0;
            mNew.forEach((x) => mo.forEach((y) => (t += D[x][y])));
            const val = t / (mNew.length * mo.length);
            F({ step: k + 1, matrix: nxt.matrixBefore, clusters: nxt.before, joined: u.steps.slice(0, k + 1).map((x) => x.node), hideNew: nxt.before.findIndex((x) => x.id === newId), line: 3, narr: `The table shrinks: ${esc(name(newId))} replaces its two members.`, ask: { type: 'number', answer: Math.round(val * 100) / 100, tol: 0.011, prompt: `What is the distance from ${esc(name(newId))} to ${esc(name(c.id))}? (The average over all pairs of their members; two decimals.)`, hint: 'Add up the original distances between every member of one and every member of the other, and divide by the number of pairs.', explain: exp[0] + '.' } });
          }
          F({ step: k + 1, matrix: nxt.matrixBefore, clusters: nxt.before, joined: u.steps.slice(0, k + 1).map((x) => x.node), newRow: nxt.before.findIndex((c) => c.id === newId), use, line: 3, narr: `The table shrinks: ${esc(name(newId))} replaces its two members. Its distance to each other cluster is the average over all pairs of members: ${exp.join('; ')}${others.length > 2 ? ' …' : ''}.`, dwell: 1.6 });
        }
      });
      F({ joined: u.steps.map((x) => x.node), line: null, done: true, narr: `The tree: ${esc(nodes[u.root].name)}. UPGMA assumes every lineage changes at the same rate (a molecular clock), so all leaves end at the same level. Neighbour-joining does not assume a clock; ClustalW uses it for its guide tree, and it is common for quick phylogenies. For a guide tree only the order of the joins matters, so Clustal Omega and MUSCLE use UPGMA.` });
      return { frames, data: { names, D, u } };
    },
    view(stage, data) {
      const { u } = data;
      const nodes = u.nodes;
      const box = h('div.up');
      const mat = h('div.up-mat');
      const treeBox = h('div.up-tree');
      box.appendChild(mat);
      box.appendChild(treeBox);
      stage.appendChild(box);
      // leaf order from the final tree
      const order = [];
      const go = (id) => (nodes[id].kids.length ? nodes[id].kids.forEach(go) : order.push(id));
      go(u.root);
      const maxH = nodes[u.root].height || 1;
      const W = Math.max(200, Math.min(380, (stage.clientWidth || 640) - 340));
      const Ht = Math.max(180, Math.min(300, (stage.clientHeight || 500) - 120));
      const xOf = {};
      order.forEach((id, k) => (xOf[id] = 20 + (k * (W - 40)) / Math.max(1, order.length - 1)));
      const xNode = (id) => (nodes[id].kids.length ? (xNode(nodes[id].kids[0]) + xNode(nodes[id].kids[1])) / 2 : xOf[id]);
      const yNode = (id) => Ht - 30 - (nodes[id].height / maxH) * (Ht - 60);
      const tv = V.treeView(treeBox, { padY: 20 });
      return {
        update(f, prev, ctx) {
          // the table
          mat.innerHTML = '';
          if (f.matrix) {
            const t = h('table.up-t');
            t.appendChild(h('tr', h('th', ''), f.clusters.map((c) => h('th', c.name))));
            f.matrix.forEach((row, i) => t.appendChild(h('tr', h('th', f.clusters[i].name), row.map((v, j) => {
              const isPair = f.pair && ((i === f.pair[0] && j === f.pair[1]) || (i === f.pair[1] && j === f.pair[0]));
              const isNew = f.newRow != null && (i === f.newRow || j === f.newRow) && i !== j;
              const hidden = f.hideNew != null && (i === f.hideNew || j === f.hideNew) && i !== j;
              const td = h('td', { class: (i === j ? 'dg' : '') + (isPair ? ' pair' : '') + (isNew ? ' new' : ''), 'data-pick': i === j ? null : `m-${i}-${j}` }, i === j ? '–' : hidden ? '?' : fmt(v));
              return td;
            }))));
            mat.appendChild(h('div.viz-label', 'Distances'));
            mat.appendChild(t);
            // once clusters have formed, the distances between the sequences themselves are still needed
            if (f.matrix.length < data.names.length) {
              const used = (x, y) => x < y && (f.use || []).some(([p, q]) => (p === x && q === y) || (p === y && q === x));
              const o = h('table.up-t.small');
              o.appendChild(h('tr', h('th', ''), data.names.map((nm) => h('th', nm))));
              data.D.forEach((row, x) => o.appendChild(h('tr', h('th', data.names[x]), row.map((v, y) => h('td', { class: (x === y ? 'dg' : '') + (x !== y && used(x, y) ? ' use' : '') }, x === y ? '–' : fmt(v))))));
              mat.appendChild(h('div.viz-label.up-sub', 'Between the sequences'));
              mat.appendChild(o);
            }
          }
          mat.classList.toggle('picking', !!ctx.asking && f.ask && f.ask.type === 'pick');
          // the tree so far
          const shown = new Set(order);
          f.joined.forEach((id) => shown.add(id));
          const items = Array.from(shown).map((id) => {
            const nd = nodes[id];
            const par = nd.parent != null && shown.has(nd.parent) ? nd.parent : null;
            const br = par != null ? nodes[par].height - nd.height : null;
            return { id, parent: par, x: xNode(id), y: yNode(id), html: nd.kids.length ? '' : esc(nd.name), cls: nd.kids.length ? 'small' + (f.cur === id ? ' cur' : '') : 'leaf', edge: br != null ? fmt(br) : '', ecls: f.cur === nd.parent ? 'new' : '' };
          });
          tv.draw(items, ctx);
        }
      };
    }
  });

  /* ==================================================================
     Multiple alignment: star or progressive
     ================================================================== */
  const DEF_SEQS = 'AVSSQQAVV AVQQAAVVV AVQVVQVV AVVSQQSAV';
  const PAIRS = 'GATTACAGT GATTCCAGT GATTACTTAGT GACTACTTAGT';
  V.define('msa', {
    title: 'Multiple alignment',
    sub: 'Pairwise alignments, a centre or a guide tree, then merging – once a gap, always a gap',
    inputs: [
      { key: 'seqs', label: 'Sequences (separated by spaces)', type: 'text', max: 80, default: DEF_SEQS, help: '3 to 5 sequences of up to 12 letters.' },
      { key: 'method', label: 'Method', type: 'select', options: [['star', 'star alignment'], ['progressive', 'progressive alignment (guide tree)']], default: 'star' },
      { key: 'scores', label: 'Scores', type: 'select', options: [['b62', 'BLOSUM62, gap −4 (proteins)'], ['dna', 'match +1, mismatch −1, gap −2 (DNA)']], default: 'b62' }
    ],
    presets: {
      star: { label: 'Star alignment of four short proteins', input: { seqs: DEF_SEQS, method: 'star', scores: 'b62' } },
      progressive: { label: 'The same proteins, progressive', input: { seqs: DEF_SEQS, method: 'progressive', scores: 'b62' } },
      pairs: { label: 'Two pairs of DNA sequences, progressive', input: { seqs: PAIRS, method: 'progressive', scores: 'dna' } },
      pairsStar: { label: 'The same DNA, star', input: { seqs: PAIRS, method: 'star', scores: 'dna' } },
      five: { label: 'Five DNA sequences, star', input: { seqs: 'GATTACAGT GATCACAGT GTTACAGT CATTACGGT GATTACAAGT', method: 'star', scores: 'dna' } }
    },
    practice: true,
    check(input) {
      const ss = String(input.seqs).toUpperCase().split(/[\s,]+/).filter(Boolean);
      if (ss.length < 3 || ss.length > 5) return 'Give 3 to 5 sequences.';
      if (ss.some((x) => x.length > 12 || x.length < 2)) return 'Sequences of 2 to 12 letters.';
      if (input.scores === 'dna' && ss.some((x) => /[^ACGT]/.test(x))) return 'With DNA scores, use A C G T only.';
      if (ss.some((x) => /[^ARNDCQEGHILKMFPSTWYV]/.test(x))) return 'Letters of amino acids (or A C G T) only.';
      return null;
    },
    codeFor(input) {
      return input.method === 'star'
        ? ['score every pair (global alignment, % identical)', 'centre = the sequence most similar to all the others', 'align each other sequence to the centre', 'merge: a gap in the centre of one pairwise alignment', '       becomes a gap column in every row (once a gap, always a gap)']
        : ['score every pair; distance = 1 − identity', 'guide tree = UPGMA of the distances', 'following the tree from the leaves: align the two groups below each node', '    (a group is a profile: its columns are scored by the average of all their pairs)', '    gaps already in a group stay (once a gap, always a gap)'];
    },
    build(input, mode) {
      const seqs = String(input.seqs).toUpperCase().split(/[\s,]+/).filter(Boolean);
      const sc = input.scores === 'dna' ? Object.assign(A.scheme('simple', { match: 1, mismatch: -1 }), { gap: -2 }) : A.scheme('blosum62', { gap: -4 });
      const n = seqs.length;
      const nm = (i) => String.fromCharCode(97 + i);
      const frames = [];
      const F = (o) => frames.push(Object.assign({ rows: seqs.slice(), ids: null, center: null, tree: null, active: [] }, o));
      F({ line: null, narr: `${n} related sequences of different lengths. A multiple alignment puts them in columns of corresponding letters, with gaps. Dynamic programming in n dimensions would be exact, but its cost grows as length<sup>n</sup> – so programs build the alignment from pairwise ones.` });
      // pairwise identities
      const ids = A.range(n).map(() => new Array(n).fill(null));
      const pairs = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
      pairs.forEach(([i, j]) => {
        const r = A.identity(seqs[i], seqs[j], sc);
        ids[i][j] = ids[j][i] = r.id;
        F({ ids: ids.map((row) => row.slice()), pairShow: { i, j, ax: r.ax, ay: r.ay }, line: 0, narr: `${nm(i)} and ${nm(j)}: aligned, ${r.same} of ${r.len} columns identical – ${Math.round(r.id * 100)}%.`, dwell: 0.8 });
      });
      let result;
      if (input.method === 'star') {
        const st = A.star(seqs, sc);
        // the sums of the identities as the table shows them (rounded %), so that they can be checked by hand
        const pct = A.range(n).map((i) => A.range(n).reduce((t, j) => t + (j === i ? 0 : Math.round(ids[i][j] * 100)), 0));
        const sumsSay = pct.map((x, i) => `${nm(i)} ${x}`).join(', ');
        if (mode === 'practice') F({ ids: ids.map((row) => row.slice()), line: 1, narr: 'Which sequence is the most similar to all the others?', ask: { type: 'choice', options: A.range(n).map((i) => [String(i), nm(i)]), answer: String(st.center), prompt: 'Add up each row of the identity table. Which sequence has the largest total?', hint: 'The centre has the highest sum of identities with the others.', explain: `${nm(st.center)} (sums of each row: ${sumsSay}).` } });
        F({ ids: ids.map((row) => row.slice()), center: st.center, line: 1, narr: `The <b>centre</b> is the sequence most similar to all the others: ${nm(st.center)} (sums of each row of the table: ${sumsSay}).` });
        let prevCentre = seqs[st.center];
        const gapsIn = (x) => x.split('-').length - 1;
        st.steps.forEach((s2, k) => {
          const p = st.pairs[k];
          const rows = A.range(n).map((i) => (s2.rows[i] != null ? s2.rows[i] : seqs[i]));
          const placed = Object.keys(s2.rows).map(Number);
          const centreNow = s2.rows[st.center];
          const fresh = gapsIn(centreNow) - gapsIn(prevCentre);
          prevCentre = centreNow;
          const how = fresh > 0
            ? `It puts ${fresh === 1 ? 'a gap' : fresh + ' gaps'} into the centre where the centre had none: ${fresh === 1 ? 'a new column' : 'new columns'}, and every row already merged gets a gap there (once a gap, always a gap).`
            : p.ac.includes('-')
              ? 'It puts a gap into the centre where the centre already has a gap column, so no new column is needed.'
              : centreNow.includes('-')
                ? `No new gap in the centre – but the centre already has a gap column from an earlier sequence, so ${nm(p.j)} gets a gap there too.`
                : 'No gap in the centre: the columns stay as they are.';
          F({ ids: ids.map((row) => row.slice()), center: st.center, rows, placed, active: [st.center, p.j], pairShow: { i: st.center, j: p.j, ax: p.ac, ay: p.aj }, line: [2, 3, 4], narr: `Align ${nm(p.j)} to the centre: ${seq(p.ac)} / ${seq(p.aj)}. ${how}`, dwell: 1.4 });
        });
        result = { rows: st.rows, sp: st.sp };
      } else {
        const pr = A.progressive(seqs, sc);
        const tnodes = pr.tree.nodes;
        if (mode === 'practice') {
          let top = -1;
          pairs.forEach(([i, j]) => (top = Math.max(top, ids[i][j])));
          const best = pairs.filter(([i, j]) => Math.abs(ids[i][j] - top) < 1e-9);
          F({ ids: ids.map((row) => row.slice()), line: 1, narr: 'The guide tree joins the most similar sequences first, and they are aligned first.', ask: { type: 'pick', answer: best.flatMap(([i, j]) => [`p-${i}-${j}`, `p-${j}-${i}`]), prompt: 'Which two sequences are aligned first? Click their identity in the table.', pickHint: 'Click a cell of the identity table.', hint: 'The highest identity: the smallest distance (1 − identity).', explain: `${best.map(([i, j]) => `${nm(i)} and ${nm(j)}`).join(' or ')}: ${Math.round(top * 100)}% identical.` } });
        }
        F({ ids: ids.map((row) => row.slice()), tree: { nodes: tnodes, joined: pr.tree.steps.map((x) => x.node) }, line: 1, narr: `Distances 1 − identity give a <b>guide tree</b> (UPGMA): ${esc(tnodes[pr.tree.root].name)}. The most similar sequences are aligned first; their alignment is then aligned with the next group, and so on to the root.` });
        const mergedSoFar = new Set();
        const grp = (g) => (g.length > 1 ? `the group {${g.map(nm).join(', ')}}` : nm(g[0]));
        pr.merges.forEach((mg) => {
          mg.members.forEach((i) => mergedSoFar.add(i));
          const rowsNow = A.range(n).map((i) => {
            const k = mg.members.indexOf(i);
            return k >= 0 ? mg.rows[k] : null;
          });
          const prevRows = A.range(n).map((i) => {
            // rows from earlier merges
            for (let q = pr.merges.indexOf(mg) - 1; q >= 0; q--) {
              const k = pr.merges[q].members.indexOf(i);
              if (k >= 0) return pr.merges[q].rows[k];
            }
            return seqs[i];
          });
          const rows = A.range(n).map((i) => rowsNow[i] || prevRows[i]);
          const both = mg.inA.length > 1 && mg.inB.length > 1, one = mg.inA.length > 1 || mg.inB.length > 1;
          const how = both
            ? 'Two groups: each column of one is scored against each column of the other by the average over all the pairs of letters between them (profile–profile alignment). A gap put into a group goes into all of its rows at once.'
            : one
              ? 'A sequence against a group: each letter is scored against a whole column of the group (a profile) – the average over its letters. A gap put into the group goes into all of its rows; gaps already in the group stay.'
              : 'Two single sequences: an ordinary pairwise alignment (Needleman–Wunsch).';
          F({ ids: ids.map((row) => row.slice()), tree: { nodes: tnodes, joined: pr.tree.steps.map((x) => x.node), cur: mg.node }, rows, placed: Array.from(mergedSoFar), active: mg.members, line: [2, 3, 4], narr: `Node ${esc(tnodes[mg.node].name)}: align ${grp(mg.inA)} with ${grp(mg.inB)}. ${how}`, dwell: 1.6 });
        });
        result = { rows: pr.rows, sp: pr.sp };
      }
      const cons = result.rows[0].split('').map((_, c) => {
        const col = result.rows.map((r) => r[c]);
        if (col.includes('-')) return ' ';
        if (col.every((x) => x === col[0])) return '*';
        const minS = Math.min(...col.flatMap((x, a) => col.slice(a + 1).map((y) => sc.sub(x, y))));
        return minS > 0 ? ':' : minS >= 0 ? '.' : ' ';
      }).join('');
      // ask about the most varied column (several letters, a gap if possible)
      let best = 0, bestV = -1;
      result.rows[0].split('').forEach((_, c) => {
        const col = result.rows.map((r) => r[c]);
        const v = new Set(col.filter((x) => x !== '-')).size + (col.includes('-') ? 0.5 : 0);
        if (v > bestV) (bestV = v), (best = c);
      });
      const colOf = result.rows.map((r) => r[best]);
      const pairList = [];
      const say = (c) => (c === '-' ? 'gap' : c);
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairList.push(`${say(colOf[a])}–${say(colOf[b])} ${num(A.pairScore(colOf[a], colOf[b], sc))}`);
      if (mode === 'practice') F({ ids: ids.map((row) => row.slice()), rows: result.rows, placed: A.range(n), final: true, col: best, line: null, narr: `The finished alignment. Column ${best + 1} (ringed): ${colOf.map(esc).join(' ')}.`, ask: { type: 'number', answer: result.sp.cols[best], prompt: `What is the sum-of-pairs score of column ${best + 1}? (All ${(n * (n - 1)) / 2} pairs of its letters; a letter against a gap ${num(sc.gap)}, a gap against a gap 0.)`, hint: input.scores === 'dna' ? 'Match +1, mismatch −1, a letter against a gap −2.' : 'Look the pairs up in BLOSUM62 (Score tables tab); a letter against a gap −4.', explain: `${pairList.join(', ')}: ${num(result.sp.cols[best])}.` } });
      const marksSay = input.scores === 'dna' ? '<b>*</b> under the columns where all are identical' : 'marks like Clustal’s under the columns: <b>*</b> identical, <b>:</b> similar, <b>.</b> weakly similar (judged here with BLOSUM62)';
      F({ ids: ids.map((row) => row.slice()), rows: result.rows, placed: A.range(n), final: true, cons, sp: result.sp, line: null, narr: `The alignment, with ${marksSay}. Its <b>sum-of-pairs</b> score – every pair of letters in every column, a letter against a gap ${num(sc.gap)} – is <b>${num(result.sp.total)}</b>. ${input.method === 'star' ? 'Try the progressive method on the same sequences and compare the scores.' : 'Compare with the star alignment of the same sequences.'} Neither method is sure to find the best: a gap placed early can never move.`, dwell: 2 });
      const maxCols = Math.max(...frames.map((f) => Math.max(...f.rows.map((r) => r.length))));
      return { frames, data: { seqs, n, prot: input.scores !== 'dna', maxCols } };
    },
    view(stage, data) {
      const { seqs, n, prot, maxCols } = data;
      const nm = (i) => String.fromCharCode(97 + i);
      const block = h('div.ms-block');
      const lanes = seqs.map((x, i) => {
        const lane = h('div.ms-lane');
        const row = h('div.ms-row', h('span.ms-n', nm(i)), lane);
        block.appendChild(row);
        return { row, lane, tiles: {} };
      });
      const consLane = h('div.ms-lane.ms-cons');
      const spLane = h('div.ms-lane.ms-cons.sp');
      const consRow = h('div.ms-row.cons', h('span.ms-n', ''), consLane);
      const spRow = h('div.ms-row.cons', h('span.ms-n', { title: 'sum of pairs of each column' }, 'SP'), spLane);
      block.appendChild(consRow);
      block.appendChild(spRow);
      const idBox = h('div.ms-ids');
      const pairBox = h('div.ms-pair');
      const treeBox = h('div.ms-tree');
      stage.appendChild(h('div.ms', h('div.ms-main', h('div.viz-label', 'Alignment'), block), h('div.ms-side', idBox, pairBox, treeBox)));
      // letters as large as the longest row allows
      const sw = stage.clientWidth || 640;
      const sideW = sw > 720 ? 270 : 0;
      const cell = Math.max(18, Math.min(32, Math.floor((sw - sideW - 80) / maxCols) - 3));
      const pitch = cell + 3;
      block.style.setProperty('--cell', cell + 'px');
      lanes.forEach((L) => (L.lane.style.width = maxCols * pitch + 'px'));
      consLane.style.width = spLane.style.width = maxCols * pitch + 'px';
      // each letter keeps its tile, so inserted gap columns push the letters after them along
      function place(L, r, f, ctx) {
        const seen = new Set();
        let k = 0, o = 0;
        r.split('').forEach((c, col) => {
          let key;
          if (c === '-') key = `g${k}-${o++}`;
          else (key = `l${k++}`), (o = 0);
          seen.add(key);
          let t = L.tiles[key];
          const fresh = !t;
          if (fresh) {
            t = L.tiles[key] = h('span');
            L.lane.appendChild(t);
          }
          t.className = V.tileClass(c, prot) + (f.col === col ? ' cur' : '');
          t.textContent = c;
          if (fresh && !ctx.instant) {
            t.style.transition = 'none';
            t.style.opacity = '0';
            t.style.transform = `translateX(${col * pitch}px) scale(0.5)`;
            void t.offsetWidth;
            t.style.transition = '';
            t.style.opacity = '';
          }
          t.style.transform = `translateX(${col * pitch}px)`;
        });
        Object.keys(L.tiles).forEach((key) => {
          if (seen.has(key)) return;
          L.tiles[key].remove();
          delete L.tiles[key];
        });
      }
      const marks = (lane, items) => {
        lane.innerHTML = '';
        items.forEach((x, col) => lane.appendChild(h('span', { style: { left: col * pitch + 'px', width: cell + 'px' } }, x)));
      };
      const smallTiles = (str) => h('span.tiles', str.split('').map((c) => h('span', { class: V.tileClass(c, prot) }, c)));
      let tv = null;
      return {
        update(f, prev, ctx) {
          const placed = new Set(f.placed || []);
          f.rows.forEach((r, i) => {
            const L = lanes[i];
            place(L, r, f, ctx);
            L.row.classList.toggle('active', f.active.includes(i));
            L.row.classList.toggle('center', f.center === i);
            L.row.classList.toggle('raw', !placed.has(i) && !f.final);
          });
          consRow.hidden = !f.cons;
          if (f.cons) marks(consLane, f.cons.split(''));
          spRow.hidden = !f.sp;
          if (f.sp) marks(spLane, f.sp.cols.map(num));
          // identities
          idBox.innerHTML = '';
          if (f.ids) {
            const t = h('table.up-t');
            t.appendChild(h('tr', h('th', '%'), A.range(n).map((j) => h('th', nm(j)))));
            A.range(n).forEach((i) => t.appendChild(h('tr', { class: f.center === i ? 'center' : '' }, h('th', nm(i)), A.range(n).map((j) => {
              const isPair = f.pairShow && ((f.pairShow.i === i && f.pairShow.j === j) || (f.pairShow.i === j && f.pairShow.j === i));
              return h('td', { class: (i === j ? 'dg' : '') + (isPair ? ' pair' : ''), 'data-pick': i === j ? null : `p-${i}-${j}` }, i === j ? '–' : f.ids[i][j] == null ? '' : String(Math.round(f.ids[i][j] * 100)));
            }))));
            idBox.classList.toggle('picking', !!ctx.asking && f.ask && f.ask.type === 'pick');
            idBox.appendChild(h('div.viz-label', 'Identity of each pair (%)'));
            idBox.appendChild(t);
          }
          // the pairwise alignment of this step
          pairBox.innerHTML = '';
          if (f.pairShow && !f.final) {
            const { ax, ay } = f.pairShow;
            pairBox.appendChild(h('div.viz-label', `Pairwise alignment, ${nm(f.pairShow.i)} / ${nm(f.pairShow.j)}`));
            pairBox.appendChild(h('div.ms-pa', smallTiles(ax), h('span.ms-bars', ax.split('').map((c, k) => h('span', c === ay[k] && c !== '-' ? '|' : ''))), smallTiles(ay)));
          }
          // the guide tree
          if (f.tree) {
            if (!tv) tv = V.treeView(treeBox, { padY: 14, padX: 24 });
            const nodes = f.tree.nodes;
            const root = nodes[nodes.length - 1].id;
            const order = [];
            const go = (id) => (nodes[id].kids.length ? nodes[id].kids.forEach(go) : order.push(id));
            go(root);
            const under = new Set();
            const mark = (id) => {
              under.add(id);
              nodes[id].kids.forEach(mark);
            };
            if (f.tree.cur != null) mark(f.tree.cur);
            const maxH = nodes[root].height || 1;
            const W = 210, Ht = 140;
            const xOf = {};
            order.forEach((id, k) => (xOf[id] = 14 + (k * (W - 28)) / Math.max(1, order.length - 1)));
            const xN = (id) => (nodes[id].kids.length ? (xN(nodes[id].kids[0]) + xN(nodes[id].kids[1])) / 2 : xOf[id]);
            const yN = (id) => Ht - 18 - (nodes[id].height / maxH) * (Ht - 36);
            treeBox.hidden = false;
            tv.draw(nodes.map((nd) => ({ id: nd.id, parent: nd.parent, x: xN(nd.id), y: yN(nd.id), html: nd.kids.length ? '' : esc(nd.name), cls: (nd.kids.length ? 'small' : 'leaf') + (f.tree.cur === nd.id ? ' cur' : under.has(nd.id) ? ' path' : ''), ecls: under.has(nd.id) && nd.id !== f.tree.cur ? 'path' : '' })), ctx);
          } else treeBox.hidden = true;
        }
      };
    }
  });
})();
