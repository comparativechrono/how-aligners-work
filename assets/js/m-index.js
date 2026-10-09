/* =====================================================================
   Indexes of a sequence: a trie of patterns, the suffix trie and suffix
   tree of a text, and the suffix array with its binary search.
   ===================================================================== */
(function () {
  'use strict';
  const MG = window.MG;
  const { h, esc } = MG;
  const V = MG.viz;
  const A = MG.algo;
  const seq = V.seq;
  const tile = (c) => `<span class="${V.tileClass(c)}">${esc(c)}</span>`;

  /** the size of a tree drawing that fits the stage */
  function treeScale(stage, width, depth, extraH, minUx) {
    const W = (stage.clientWidth || 640) - 70;
    const H = (stage.clientHeight || 520) - 60 - (extraH || 0);
    const ux = Math.max(minUx || 30, Math.min(Math.max(78, minUx || 0), W / Math.max(1, width)));
    const uy = Math.max(38, Math.min(70, H / Math.max(1, depth + 0.6)));
    return { ux, uy, x: (c) => 24 + c * ux, y: (d) => 22 + d * uy };
  }

  /* ==================================================================
     A trie of patterns
     ================================================================== */
  V.define('trie', {
    title: 'A trie of patterns',
    sub: 'One path per word; words that start alike share a path',
    inputs: [
      { key: 'words', label: 'Words (separated by spaces)', type: 'text', max: 60, default: 'AAA AAG AGA AGG CGA CGC CGG CGT', help: 'Up to 10 words of A C G T, at most 6 letters each.' },
      { key: 'text', label: 'Text to scan', type: 'seq', letters: 'ACGT', min: 1, max: 22, default: 'ATGAAACGTAGGC' }
    ],
    presets: {
      codons: { label: 'Codons of lysine and arginine, scanned along a sequence', input: { words: 'AAA AAG AGA AGG CGA CGC CGG CGT', text: 'ATGAAACGTAGGC' } },
      small: { label: 'Four short words: AT ATG CAT CA', input: { words: 'AT ATG CAT CA', text: 'GCATGCA' } }
    },
    practice: true,
    check(input) {
      const ws = String(input.words || '').toUpperCase().split(/[\s,]+/).filter(Boolean);
      if (!ws.length) return 'Give at least one word.';
      if (ws.length > 10) return 'At most 10 words.';
      if (ws.some((w) => /[^ACGT]/.test(w))) return 'Words of the letters A C G T only.';
      if (ws.some((w) => w.length > 6)) return 'Words of at most 6 letters.';
      return null;
    },
    code: [
      'for word in words:              # build',
      '    node = root',
      '    for letter in word:',
      '        if letter not in node.children: node.children[letter] = new node',
      '        node = node.children[letter]',
      '    node.word_ends_here = word',
      'for i in range(len(text)):      # scan: from every start',
      '    follow text[i], text[i+1] … from the root while the trie has the letter',
      '    report every word that ends on the way'
    ],
    build(input, mode) {
      const words = Array.from(new Set(String(input.words).toUpperCase().split(/[\s,]+/).filter(Boolean)));
      const T = input.text;
      const tr = A.trieBuild(words);
      const scan = A.trieScan(tr.nodes, words, T);
      const frames = [];
      const F = (o) => frames.push(Object.assign({ count: 1, path: [], created: [], ends: [], phase: 'build', i: null, hits: [] }, o));
      F({ line: null, narr: `A <b>trie</b> stores a set of words as a tree whose <b>edges</b> carry letters: each word is a path from the root, and words that begin alike share the beginning of their path. Here: ${words.map(seq).join(' ')}.` });
      let endsSoFar = [];
      let asked = 0;
      tr.steps.forEach((st) => {
        const shared = st.path.length - 1 - st.created.length;
        if (mode === 'practice' && asked < 4) {
          asked++;
          F({ count: st.count - st.created.length, path: [], ends: endsSoFar.slice(), line: [0, 3], narr: `Next word: ${seq(st.w)}.`, ask: { type: 'number', answer: st.created.length, prompt: `How many new nodes does ${seq(st.w)} add to the trie?`, hint: 'Follow its letters from the root: count the letters for which there is no edge yet.', explain: `${st.created.length} – ${shared ? `the first ${shared} letter${shared > 1 ? 's are' : ' is'} already there` : 'none of its path was there'}.` } });
        }
        F({ count: st.count, path: st.path, created: st.created, ends: endsSoFar.slice(), line: [2, 3, 4], word: st.w, narr: `${seq(st.w)}: ${shared ? (shared === 1 ? 'its first letter follows an existing path' : `its first ${shared} letters follow an existing path`) : 'a new path from the root'}${st.created.length ? `, then ${st.created.length} new node${st.created.length > 1 ? 's' : ''}` : ' – no new nodes'}.`, dwell: 1.2 });
        endsSoFar = endsSoFar.concat([st.end]);
        F({ count: st.count, path: st.path, ends: endsSoFar.slice(), line: 5, narr: `The node where ${seq(st.w)} ends is marked: a word ends here.`, dwell: 0.6 });
      });
      F({ count: tr.nodes.length, ends: endsSoFar.slice(), line: null, narr: `The trie of ${words.length} words has ${tr.nodes.length} nodes (with the root) for ${words.join('').length} letters: shared beginnings are stored once. Now scan the text ${seq(T)}: from every position, follow its letters down from the root.` });
      const hits = [];
      let asked2 = 0;
      scan.steps.forEach((st) => {
        const found = st.found.map((f) => seq(f.w)).join(' and ');
        if (mode === 'practice' && asked2 < 4 && st.matched > 0) {
          asked2++;
          F({ phase: 'scan', count: tr.nodes.length, ends: endsSoFar.slice(), i: st.i, path: [0], hits: hits.slice(), line: [6, 7], narr: `Position ${st.i}: the text from here is ${seq(T.slice(st.i, st.i + 6))}…`, ask: { type: 'choice', options: [['yes', 'Yes, a word starts here'], ['no', 'No word starts here']], answer: st.found.length ? 'yes' : 'no', prompt: 'Does one of the words start at this position?', hint: 'Follow the letters from the root; a word is found only if you reach a marked node.', explain: st.found.length ? `Yes: ${found}.` : `No: the path stops after ${st.matched} letter${st.matched === 1 ? '' : 's'} without reaching the end of a word.` } });
        }
        st.found.forEach((f) => hits.push(f));
        F({ phase: 'scan', count: tr.nodes.length, ends: endsSoFar.slice(), i: st.i, path: st.path, matched: st.matched, hits: hits.slice(), found: st.found.map((f) => f.wi), line: st.found.length ? 8 : 7, narr: st.matched === 0 ? `Position ${st.i}: no edge from the root for ${seq(T[st.i])} – nothing starts here.` : `Position ${st.i}: the path follows ${seq(T.slice(st.i, st.i + st.matched))}${st.i + st.matched < T.length ? ` and stops: no edge for ${seq(T[st.i + st.matched])}` : ' to the end of the text'}. ${st.found.length ? `Found: ${found}.` : 'No word ends on the way.'}`, dwell: st.found.length ? 1.4 : 0.9 });
      });
      F({ phase: 'scan', count: tr.nodes.length, ends: endsSoFar.slice(), hits: hits.slice(), done: true, line: null, narr: `${hits.length ? `Found ${hits.map((f) => `${seq(f.w)} at ${f.at}`).join(', ')}.` : 'No word occurs in the text.'} All the words were looked for at once: one walk down the trie from each position of the text, each at most as long as the longest word.` });
      return { frames, data: { words, T, tr } };
    },
    view(stage, data) {
      const nodes = data.tr.nodes;
      const textRow = h('div.tiles.trie-text', data.T.split('').map((c, i) => h('span.tilebox', h('span.posn', String(i)), h('span', { class: V.tileClass(c) }, c))));
      stage.appendChild(h('div.sl-row.trie-top', h('span.viz-label', 'Text'), textRow));
      const lay = V.layoutTree(nodes.map((nd) => ({ id: nd.id, parent: nd.parent })), { order: (a, b) => A.cmp(nodes[a].edge, nodes[b].edge) });
      const tv = V.treeView(stage);
      return {
        update(f, prev, ctx) {
          const present = nodes.filter((nd) => nd.id < f.count);
          const L = V.layoutTree(present.map((nd) => ({ id: nd.id, parent: nd.parent })), { order: (a, b) => A.cmp(nodes[a].edge, nodes[b].edge) });
          const sc2 = treeScale(stage, Math.max(L.width, 1), lay.depth, 70);
          const onPath = new Set(f.path || []);
          const fresh = new Set(f.created || []);
          const ends = new Set(f.ends || []);
          const found = new Set();
          (f.found || []).forEach((wi) => found.add(A.trieWalk(nodes, data.words[wi]).end));
          tv.draw(present.map((nd) => {
            const [cx, d] = L.pos[nd.id];
            const isEnd = ends.has(nd.id);
            const cls = [nd.id === 0 ? 'root' : 'small', isEnd ? 'end' : '', onPath.has(nd.id) ? 'path' : '', fresh.has(nd.id) ? 'new' : '', found.has(nd.id) ? 'hit' : ''].filter(Boolean).join(' ');
            return {
              id: nd.id, parent: nd.parent, x: sc2.x(cx), y: sc2.y(d),
              html: '', cls,
              edge: nd.id === 0 ? '' : tile(nd.edge), ecls: onPath.has(nd.id) && onPath.has(nd.parent) ? 'path' : fresh.has(nd.id) ? 'new' : '',
              labAt: 0.5
            };
          }), ctx);
          // the word that ends at a node is written under it
          present.forEach((nd) => {
            const el = tv.node(nd.id);
            if (!el) return;
            const isEnd = ends.has(nd.id);
            el.title = isEnd ? nd.ends.map((wi) => data.words[wi]).join(', ') : '';
            let tag = el.querySelector('.tv-word');
            if (isEnd) {
              if (!tag) {
                tag = h('span.tv-word');
                el.appendChild(tag);
              }
              tag.textContent = nd.ends.map((wi) => data.words[wi]).join(' ');
            } else if (tag) tag.remove();
          });
          // the text: where the scan is, and what it found
          const tiles = textRow.querySelectorAll('.tile');
          const hitSet = new Set();
          (f.hits || []).forEach((x) => {
            for (let k = 0; k < x.len; k++) hitSet.add(x.at + k);
          });
          tiles.forEach((t, i) => {
            t.classList.toggle('found', hitSet.has(i));
            t.classList.toggle('cur', f.i != null && i >= f.i && i < f.i + Math.max(1, f.matched || 0) && f.phase === 'scan');
            t.classList.toggle('dim', f.phase !== 'scan');
          });
        }
      };
    }
  });

  /* ==================================================================
     Suffix trie and suffix tree
     ================================================================== */
  V.define('stree', {
    title: 'Suffix trie and suffix tree',
    sub: 'Every suffix of the text, in one tree: a search follows one path',
    inputs: [
      { key: 'text', label: 'Text (add $ to mark the end)', type: 'seq', letters: 'ACGT$', min: 2, max: 9, default: 'TACTA$' },
      { key: 'pattern', label: 'Pattern to search', type: 'seq', letters: 'ACGT', min: 1, max: 5, default: 'TA' }
    ],
    presets: {
      tacta: { label: 'TACTA$, search TA', input: { text: 'TACTA$', pattern: 'TA' } },
      nodollar: { label: 'TACTA without a $: two suffixes go missing', input: { text: 'TACTA', pattern: 'TA' } },
      longer: { label: 'CGCTACTA$, search C', input: { text: 'CGCTACTA$', pattern: 'C' } },
      cta: { label: 'CGCTACTA$, search CTA', input: { text: 'CGCTACTA$', pattern: 'CTA' } }
    },
    practice: true,
    check(input) {
      const t = input.text;
      if (t.indexOf('$') >= 0 && t.indexOf('$') !== t.length - 1) return 'The $ may only be the last character.';
      return null;
    },
    code: [
      'for i in range(len(T)):          # the suffix trie: a trie of all suffixes',
      '    insert T[i:] into the trie; mark where it ends with i',
      'compress: merge every node that has one child into that child',
      'search P: follow its letters from the root',
      '    the leaves below the end of the path are the positions of P'
    ],
    build(input, mode) {
      const T = input.text, P = input.pattern;
      const st = A.suffixTrie(T);
      const ct = A.compressTrie(st.nodes);
      const hasEnd = T.endsWith('$');
      const frames = [];
      const F = (o) => frames.push(Object.assign({ count: 1, path: [], created: [], ends: [], phase: 'trie' }, o));
      F({ line: null, narr: `The suffixes of ${seq(T)}: ${st.suffixes.map((x, i) => `${seq(x)} (${i})`).join(', ')}. Put them all into one trie, and every substring of the text becomes a path from the root – every substring is the start of some suffix.` });
      let ends = [];
      let asked = 0;
      st.steps.forEach((s2) => {
        const shared = s2.path.length - 1 - s2.created.length;
        F({ count: s2.count, path: s2.path, created: s2.created, ends: ends.slice(), line: 1, narr: `Suffix ${s2.wi}, ${seq(s2.w)}: ${shared ? (shared === 1 ? 'the first letter is already a path' : `the first ${shared} letters are already a path`) : 'a new path from the root'}${s2.created.length ? `; ${s2.created.length} new node${s2.created.length > 1 ? 's' : ''}` : ''}.`, dwell: 1.1 });
        ends = ends.concat([s2.end]);
        const inner = Object.keys(st.nodes[s2.end].children).length > 0;
        F({ count: s2.count, path: s2.path, ends: ends.slice(), line: 1, narr: inner ? `Suffix ${s2.wi} ends <b>inside</b> the path of a longer suffix, not at a leaf of its own.${hasEnd ? '' : ' Without a $, a suffix that is also the start of another suffix has no leaf.'}` : `Suffix ${s2.wi} ends at a leaf, labelled ${s2.wi}: where it starts in the text.`, dwell: 0.7 });
      });
      F({ count: st.nodes.length, ends: ends.slice(), line: 2, narr: `The suffix <b>trie</b> has ${st.nodes.length} nodes. Most have a single child – long chains that store the text over and over. A <b>suffix tree</b> merges each chain into one edge with a longer label.` });
      F({ phase: 'tree', count: st.nodes.length, ends: ends.slice(), line: 2, narr: `The suffix tree: ${ct.keep.length} nodes. Each leaf is one suffix, and its label is where that suffix starts.${ct.lost.length ? ` But suffix${ct.lost.length > 1 ? 'es' : ''} ${ct.lost.map((l) => l.end).join(' and ')} ended on a merged node: ${ct.lost.length > 1 ? 'they have' : 'it has'} <b>no leaf</b> now, so a search would miss ${ct.lost.length > 1 ? 'them' : 'it'}. That is why a unique end character, $, is added: then no suffix is the start of another.` : ' With the $ at the end, no suffix is the start of another, so every suffix has its own leaf.'}`, dwell: 1.6 });
      // the search
      const wk = A.trieWalk(st.nodes, P);
      const ok = wk.matched === P.length;
      const leaves = ok ? A.trieLeaves(st.nodes, wk.end).filter((e) => !ct.lost.some((l) => l.end === e)) : [];
      const truth = [];
      for (let s = 0; s + P.length <= T.length; s++) if (T.slice(s, s + P.length) === P) truth.push(s);
      F({ phase: 'tree', count: st.nodes.length, ends: ends.slice(), search: true, path: [0], line: 3, narr: `Search ${seq(P)}: follow its letters from the root.` });
      if (mode === 'practice') {
        F({ phase: 'tree', count: st.nodes.length, ends: ends.slice(), search: true, path: wk.path, line: 4, narr: ok ? `${seq(P)} is a path from the root.` : `${seq(P)} is not a path from the root.`, ask: { type: 'number', answer: leaves.length, prompt: `How many occurrences of ${seq(P)} does the tree report? (Count the leaves below the end of the path.)`, hint: 'Every leaf below that point is a suffix that starts with the pattern.', explain: `${leaves.length}${leaves.length ? ': at ' + leaves.join(', ') : ''}.` } });
      }
      F({ phase: 'tree', count: st.nodes.length, ends: ends.slice(), search: true, path: wk.path, below: ok ? wk.end : null, line: 4, narr: ok ? `${seq(P)} ends here. The leaves below are the suffixes that start with ${seq(P)}: <b>${leaves.length}</b> occurrence${leaves.length === 1 ? '' : 's'}, at ${leaves.join(', ') || '–'}. The search took ${P.length} step${P.length === 1 ? '' : 's'}, plus one per occurrence – however long the text.${!hasEnd && leaves.length < truth.length ? ` (In fact ${seq(P)} occurs at ${truth.join(', ')}: the lost suffix is missing.)` : ''}` : `After ${seq(P.slice(0, wk.matched))} there is no edge for ${seq(P[wk.matched])}: ${seq(P)} does not occur.`, dwell: 2 });
      return { frames, data: { T, P, st, ct } };
    },
    view(stage, data) {
      const nodes = data.st.nodes, ct = data.ct;
      const order = (a, b) => A.cmp(nodes[a].edge, nodes[b].edge);
      const textRow = h('div.tiles', data.T.split('').map((c, i) => h('span.tilebox', h('span.posn', String(i)), h('span', { class: V.tileClass(c) }, c))));
      stage.appendChild(h('div.sl-row.trie-top', h('span.viz-label', 'Text'), textRow));
      const fullLay = V.layoutTree(nodes.map((nd) => ({ id: nd.id, parent: nd.parent })), { order });
      const tv = V.treeView(stage);
      return {
        update(f, prev, ctx) {
          const tree = f.phase === 'tree';
          let present, L;
          if (!tree) {
            present = nodes.filter((nd) => nd.id < f.count).map((nd) => ({ id: nd.id, parent: nd.parent }));
            L = V.layoutTree(present, { order });
          } else {
            present = ct.keep.map((id) => ({ id, parent: id === 0 ? null : ct.parent[id] }));
            L = V.layoutTree(present, { order: (a, b) => A.cmp(ct.label[a], ct.label[b]) });
          }
          // edge labels of the tree are words: give them room
          const longest = tree ? Math.max(1, ...ct.keep.filter((id) => id).map((id) => ct.label[id].length)) : 1;
          const sc = treeScale(stage, Math.max(L.width, 1), tree ? Math.max(L.depth, 2) : fullLay.depth, 70, tree ? Math.min(150, 14 + longest * 9.5) : 30);
          const onPath = new Set(f.path || []);
          const fresh = new Set(f.created || []);
          const ends = new Set(f.ends || []);
          // in the tree, a path node is a kept node on the path, or the kept node below the end of the path
          let below = new Set();
          if (f.below != null) {
            const under = (id) => {
              below.add(id);
              Object.values(nodes[id].children).forEach(under);
            };
            under(f.below);
          }
          const items = present.map((p) => {
            const nd = nodes[p.id];
            const [cx, d] = L.pos[p.id];
            const isLeaf = Object.keys(nd.children).length === 0;
            const endHere = ends.has(nd.id) && nd.ends.length;
            const lostHere = tree && ct.lost.some((l) => l.node === nd.id);
            let html = '';
            let cls = nd.id === 0 ? 'root' : isLeaf ? 'leaf' : 'small';
            if (isLeaf && endHere) html = String(nd.ends[0]);
            else if (endHere && !tree) {
              cls = 'leaf inner';
              html = String(nd.ends[0]);
            }
            if (onPath.has(nd.id)) cls += ' path';
            if (fresh.has(nd.id)) cls += ' new';
            if (below.has(nd.id) && isLeaf) cls += ' hit';
            if (lostHere) cls += ' lost';
            const lab = tree ? (nd.id === 0 ? '' : esc(ct.label[nd.id])) : nd.id === 0 ? '' : tile(nd.edge);
            const pathEdge = !tree && onPath.has(nd.id) && onPath.has(nd.parent);
            return { id: nd.id, parent: p.parent, x: sc.x(cx), y: sc.y(d), html, cls, edge: lab, ecls: pathEdge ? 'path' : fresh.has(nd.id) ? 'new' : '', labAt: tree ? 0.74 : 0.5 };
          });
          // in the tree, an edge is on the path when its lower node is reached by the walk (the walk passes merged nodes too)
          if (tree && f.path && f.path.length > 1) {
            const reached = new Set(f.path);
            items.forEach((it) => {
              if (it.parent == null) return;
              // the edge from the kept parent down to this kept node covers trie nodes; it is on the path if any of them is reached
              let x = it.id, on = false;
              while (x != null && x !== it.parent) {
                if (reached.has(x)) on = true;
                x = nodes[x].parent;
              }
              it.ecls = on ? 'path' : '';
            });
          }
          tv.draw(items, ctx);
          const occ = f.below != null ? A.trieLeaves(nodes, f.below).filter((e) => !ct.lost.some((l) => l.end === e)) : [];
          textRow.querySelectorAll('.tile').forEach((t, i) => t.classList.toggle('found', occ.some((st) => i >= st && i < st + data.P.length)));
        }
      };
    }
  });

  /* ==================================================================
     The suffix array, and binary search in it
     ================================================================== */
  V.define('sa', {
    title: 'The suffix array',
    sub: 'The suffixes in sorted order; a pattern is found by binary search',
    inputs: [
      { key: 'text', label: 'Text (the page adds the $)', type: 'seq', letters: 'ACGT', min: 2, max: 13, default: 'CGCTACTA' },
      { key: 'pattern', label: 'Pattern', type: 'seq', letters: 'ACGT', min: 1, max: 6, default: 'CTA' }
    ],
    presets: {
      cta: { label: 'CGCTACTA$, search CTA', input: { text: 'CGCTACTA', pattern: 'CTA' } },
      ta: { label: 'CGCTACTA$, search TA', input: { text: 'CGCTACTA', pattern: 'TA' } },
      c: { label: 'CGCTACTA$, search C', input: { text: 'CGCTACTA', pattern: 'C' } },
      absent: { label: 'CGCTACTA$, search GA (not there)', input: { text: 'CGCTACTA', pattern: 'GA' } }
    },
    practice: true,
    code: [
      'SA = sorted(range(len(T)), key=lambda i: T[i:])   # the starts of the sorted suffixes',
      'lo, hi = 0, len(SA)',
      'while lo < hi:                  # binary search: the first suffix >= P',
      '    mid = (lo + hi) // 2',
      '    if T[SA[mid]:][:len(P)] < P: lo = mid + 1',
      '    else: hi = mid',
      'rows lo, lo+1 … while the suffix starts with P: P occurs at SA[row]'
    ],
    build(input, mode) {
      const T = A.withSentinel(input.text), P = input.pattern, n = T.length;
      const sa = A.suffixArray(T);
      const res = A.saSearch(T, sa, P);
      const frames = [];
      const textOrder = A.range(n);
      const F = (o) => frames.push(Object.assign({ order: textOrder, sorted: false, lo: null, hi: null, mid: null, rows: [], showSA: false }, o));
      F({ line: null, narr: `The ${n} suffixes of ${seq(T)}, each with the position where it starts.` });
      F({ order: sa, sorted: true, line: 0, narr: 'Sort them alphabetically ($ first). The list of their start positions, in this order, is the <b>suffix array</b>: one number per letter of the text – much smaller than a suffix tree.', dwell: 1.8 });
      F({ order: sa, sorted: true, showSA: true, line: 0, narr: `SA = ${sa.join(', ')}. All the suffixes that start with the same letters are now next to each other – so a pattern can be found by <b>binary search</b>, as in a sorted dictionary.` });
      let lo = 0, hi = n;
      F({ order: sa, sorted: true, showSA: true, lo, hi, line: 1, narr: `Search ${seq(P)}. Binary search looks for the first suffix that is not smaller than ${seq(P)}: at first it can be any row, 0 to ${hi - 1} – or none (row ${hi}, past the end).` });
      let asked = 0;
      res.steps.forEach((s2) => {
        const word = s2.c < 0 ? 'smaller' : s2.c > 0 ? 'larger' : 'equal';
        const start = T.slice(sa[s2.mid], sa[s2.mid] + P.length);
        if (mode === 'practice' && asked < 5) {
          asked++;
          F({ order: sa, sorted: true, showSA: true, lo: s2.lo, hi: s2.hi, mid: s2.mid, line: [3, 4], narr: `The middle row, ${s2.mid}, starts ${seq(start)}.`, ask: { type: 'choice', options: [['down', 'Look further down (larger)'], ['up', 'Look here or further up']], answer: s2.c < 0 ? 'down' : 'up', prompt: `Is ${seq(start)} smaller than ${seq(P)} (then the pattern is further down)?`, hint: 'Compare letter by letter, as in a dictionary; $ comes first.', explain: `${seq(start)} is ${word === 'equal' ? 'equal to' : word + ' than'} ${seq(P)}.` } });
        }
        lo = s2.c < 0 ? s2.mid + 1 : s2.lo;
        hi = s2.c < 0 ? s2.hi : s2.mid;
        F({ order: sa, sorted: true, showSA: true, lo: s2.lo, hi: s2.hi, mid: s2.mid, line: [3, 4, 5], narr: `Middle row ${s2.mid}: ${seq(start)} is ${word === 'equal' ? 'equal to' : word + ' than'} ${seq(P)}, so ${s2.c < 0 ? `the first match is further down: rows ${lo} to ${hi}` : `the first match is here or above: rows ${lo} to ${hi}`}.`, dwell: 1.3 });
        F({ order: sa, sorted: true, showSA: true, lo, hi, line: 2, narr: lo < hi ? `Half of the rows are left out: rows ${lo} to ${hi} are left.` : `The range has shrunk to row ${lo}.`, dwell: 0.6 });
      });
      if (res.rows.length) F({ order: sa, sorted: true, showSA: true, rows: res.rows, line: 6, narr: `Row ${res.first} is the first suffix that starts with ${seq(P)}; ${res.rows.length > 1 ? `below it, ${res.rows.length > 2 ? `rows ${res.rows.slice(1).join(', ')} also start` : `row ${res.rows[1]} also starts`} with ${seq(P)}` : 'the next row does not'}. ${seq(P)} occurs at <b>${res.positions.join(', ')}</b> – the suffix-array values of those rows. About log₂ n steps of binary search, each comparing up to m letters.`, found: res.positions });
      else F({ order: sa, sorted: true, showSA: true, lo, hi: lo, line: 6, narr: `Row ${res.first} ${res.first < n ? `starts ${seq(T.slice(sa[res.first], sa[res.first] + P.length))}, not` : 'is past the end – no suffix starts with'} ${seq(P)}: the pattern does not occur.`, found: [] });
      return { frames, data: { T, P, sa, n } };
    },
    view(stage, data) {
      const n = data.n;
      const W = (stage.clientWidth || 640) - 140;
      const size = Math.max(18, Math.min(30, Math.floor(W / (n + 2)) - 3, Math.floor(((stage.clientHeight || 520) - 90) / (n + 1)) - 6));
      stage.style.setProperty('--cell', size + 'px');
      const rowH = size + 6;
      const textRow = h('div.tiles', data.T.split('').map((c, i) => h('span.tilebox', h('span.posn', String(i)), h('span', { class: V.tileClass(c) }, c))));
      stage.appendChild(h('div.sl-row.trie-top', h('span.viz-label', 'Text'), textRow));
      const list = h('div.sa-list', { style: { height: n * rowH + 'px' } });
      const brk = h('div.sa-range');
      const midTag = h('div.sa-mid', 'mid');
      list.appendChild(brk);
      list.appendChild(midTag);
      const rows = A.range(n).map((i) => {
        const suf = data.T.slice(i);
        const el = h('div.sa-row', h('span.sa-rn', ''), h('span.sa-sa', String(i)), h('div.tiles', suf.split('').map((c) => h('span', { class: V.tileClass(c) }, c))));
        list.appendChild(el);
        return el;
      });
      stage.appendChild(h('div.sa-head', h('span.sa-rn', 'row'), h('span.sa-sa', 'start'), h('span', 'suffix')));
      stage.appendChild(list);
      return {
        update(f, prev, ctx) {
          const pos = {};
          f.order.forEach((k, r) => (pos[k] = r));
          rows.forEach((el, k) => {
            const r = pos[k];
            el.style.transform = `translateY(${r * rowH}px)`;
            el.querySelector('.sa-rn').textContent = f.sorted ? String(r) : '';
            el.classList.toggle('mid', f.mid != null && r === f.mid);
            el.classList.toggle('out', f.lo != null && (r < f.lo || r > f.hi) && !f.rows.length);
            el.classList.toggle('hit', f.rows.includes(r));
            el.querySelectorAll('.tile').forEach((t, j) => t.classList.toggle('pre', (f.mid != null && r === f.mid && j < data.P.length) || (f.rows.includes(r) && j < data.P.length)));
          });
          list.classList.toggle('showSA', !!f.showSA);
          stage.querySelector('.sa-head').classList.toggle('showSA', !!f.showSA);
          if (f.lo != null && f.hi != null && !f.rows.length) {
            // the first suffix that is not smaller than P is one of the rows lo … hi (hi = n: past the end)
            const last = Math.min(f.hi, n - 1);
            brk.hidden = false;
            brk.style.transform = `translateY(${Math.min(f.lo, n - 1) * rowH}px)`;
            brk.style.height = Math.max(1, last - f.lo + 1) * rowH - 4 + 'px';
          } else brk.hidden = true;
          midTag.hidden = f.mid == null;
          if (f.mid != null) midTag.style.transform = `translateY(${f.mid * rowH}px)`;
          const hitSet = new Set();
          (f.found || []).forEach((p) => {
            for (let k = 0; k < data.P.length; k++) hitSet.add(p + k);
          });
          textRow.querySelectorAll('.tile').forEach((t, i) => t.classList.toggle('found', hitSet.has(i)));
        }
      };
    }
  });
})();
