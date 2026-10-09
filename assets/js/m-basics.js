/* =====================================================================
   The basic algorithms behind the rest: linear and binary search, five
   sorting methods, a hash table of k-mers and a binary search tree.
   ===================================================================== */
(function () {
  'use strict';
  const MG = window.MG;
  /** items 3–5, or item 3 */
  const span = (a, b) => (a === b ? `item ${a}` : `items ${a}–${b}`);
  const { h, esc } = MG;
  const V = MG.viz;
  const A = MG.algo;
  const seq = V.seq;

  /** a list typed by the student: numbers if they all are, otherwise words (upper case) */
  function parseList(text) {
    const parts = String(text || '').split(/[\s,;]+/).filter(Boolean);
    const nums = parts.every((p) => /^-?\d+(\.\d+)?$/.test(p));
    return nums ? parts.map(Number) : parts.map((p) => p.toUpperCase());
  }
  const parseOne = (t, likeNumbers) => (likeNumbers ? Number(t) : String(t).trim().toUpperCase());
  const show = (v) => esc(String(v));

  /* ==================================================================
     Linear and binary search
     ================================================================== */
  V.define('search', {
    title: 'Linear and binary search',
    sub: 'Look at every item – or halve a sorted list at every step',
    inputs: [
      { key: 'items', label: 'The list (numbers or words)', type: 'text', max: 120, default: '3 17 24 30 41 52 61 68 80 85 93 99', help: 'Up to 16 items. Binary search sorts the list first if it is not sorted.' },
      { key: 'target', label: 'Look for', type: 'text', max: 12, default: '68' },
      { key: 'method', label: 'Method', type: 'select', options: [['both', 'both, side by side'], ['binary', 'binary search'], ['linear', 'linear search']], default: 'both' }
    ],
    presets: {
      race: { label: 'Both: 68 in 12 sorted numbers', input: { items: '3 17 24 30 41 52 61 68 80 85 93 99', target: '68', method: 'both' } },
      binary: { label: 'Binary search: 68', input: { items: '3 17 24 30 41 52 61 68 80 85 93 99', target: '68', method: 'binary' } },
      absent: { label: 'Binary search: 75 is not there', input: { items: '3 17 24 30 41 52 61 68 80 85 93 99', target: '75', method: 'binary' } },
      kmers: { label: 'Words: GAT in a sorted list of 3-mers', input: { items: 'AAC ACG AGT ATT CAT CCA CGT GAT GCA GGC TAC TCA TGG TTA', target: 'GAT', method: 'both' } }
    },
    practice: true,
    check(input) {
      const items = parseList(input.items);
      if (items.length < 2) return 'Give at least two items.';
      if (items.length > 16) return 'At most 16 items – the picture would not fit.';
      if (!String(input.target).trim()) return 'Say what to look for.';
      return null;
    },
    code: [
      '# linear search',
      'for i in range(len(a)):',
      '    if a[i] == x: return i',
      '# binary search (a is sorted)',
      'lo, hi = 0, len(a) - 1',
      'while lo <= hi:',
      '    mid = (lo + hi) // 2',
      '    if a[mid] == x: return mid',
      '    if a[mid] < x: lo = mid + 1     # x is in the right half',
      '    else: hi = mid - 1              # x is in the left half'
    ],
    build(input, mode) {
      let items = parseList(input.items);
      const nums = typeof items[0] === 'number';
      const x = parseOne(input.target, nums);
      const method = mode === 'practice' && input.method === 'linear' ? 'binary' : input.method;
      const wasSorted = items.every((v, i) => i === 0 || A.cmpKey(items[i - 1], v) <= 0);
      const sorted = items.slice().sort(A.cmpKey);
      const lin = A.linearSearch(method === 'binary' ? sorted : items, x);
      const bin = A.binarySearch(sorted, x);
      const frames = [];
      const base = { li: -1, lfound: null, lsteps: 0, b: null, bsteps: 0, bfound: null };
      const F = (o) => frames.push(Object.assign({}, base, o));
      const list = method === 'binary' ? sorted : items;
      F({ line: null, narr: `Look for ${show(x)} in a list of ${items.length} items.${method !== 'linear' && !wasSorted ? ' Binary search needs a sorted list, so the list is sorted first.' : ''} ${method === 'both' ? 'Linear search (top) looks at the items one by one; binary search (below) looks at the middle of what is left and throws half away.' : method === 'binary' ? 'Binary search compares with the middle item and keeps the half where the item must be.' : 'Linear search looks at the items one by one from the start.'}` });
      const nl = method === 'binary' ? 0 : lin.steps.length;
      const nb = method === 'linear' ? 0 : bin.steps.length;
      const steps = Math.max(nl, nb);
      let asked = 0;
      for (let k = 0; k < steps; k++) {
        const o = {};
        const parts = [];
        if (k < nl) {
          const st = lin.steps[k];
          o.li = st.i;
          o.lsteps = k + 1;
          o.lfound = st.hit ? st.i : null;
          parts.push(`Linear: item ${st.i} is ${show(list[st.i])}${st.hit ? ' – <b>found</b>' : ''}.`);
        } else if (nl) {
          o.li = lin.found;
          o.lsteps = nl;
          o.lfound = lin.found >= 0 ? lin.found : null;
        }
        if (k < nb) {
          const st = bin.steps[k];
          if (mode === 'practice' && st.mid != null && asked < 6) {
            asked++;
            F(Object.assign({}, o, { b: { lo: st.lo, hi: st.hi, mid: null }, bsteps: k, line: [5, 6], narr: `Items ${st.lo} to ${st.hi} are left.`, ask: { type: 'number', answer: st.mid, prompt: `Which index is in the middle? ((lo + hi) // 2, rounding down)`, hint: `(${st.lo} + ${st.hi}) // 2.`, explain: `(${st.lo} + ${st.hi}) // 2 = ${st.mid}: ${show(sorted[st.mid])}.` } }));
            if (st.c !== 0) {
              asked++;
              F(Object.assign({}, o, { b: { lo: st.lo, hi: st.hi, mid: st.mid }, bsteps: k + 1, line: [7, 8, 9], narr: `The middle item is ${show(sorted[st.mid])}.`, ask: { type: 'choice', options: [['left', 'Keep the left half'], ['right', 'Keep the right half']], answer: st.c < 0 ? 'right' : 'left', prompt: `${show(x)} or ${show(sorted[st.mid])}: which half can ${show(x)} be in?`, hint: 'The list is sorted: smaller items are on the left.', explain: `${show(sorted[st.mid])} is ${st.c < 0 ? 'smaller' : 'larger'} than ${show(x)}, so keep the ${st.c < 0 ? 'right' : 'left'} half.` } }));
            }
          }
          o.b = { lo: st.lo, hi: st.hi, mid: st.mid };
          o.bsteps = k + 1;
          o.bfound = st.c === 0 ? st.mid : null;
          if (st.mid == null) parts.push(`Binary: nothing is left – ${show(x)} is not in the list (it would go at index ${bin.insertAt}).`);
          else parts.push(`Binary: ${st.lo === st.hi ? `only item ${st.lo} is left` : `items ${st.lo}–${st.hi} are left`}; the middle one, ${st.mid}, is ${show(sorted[st.mid])}: ${st.c === 0 ? '<b>found</b>' : st.c < 0 ? `smaller than ${show(x)}, so keep the right half` : `larger than ${show(x)}, so keep the left half`}.`);
        } else if (nb) {
          const st = bin.steps[nb - 1];
          o.b = { lo: st.lo, hi: st.hi, mid: st.mid, done: true };
          o.bsteps = nb;
          o.bfound = bin.found >= 0 ? bin.found : null;
        }
        F(Object.assign(o, { line: k < nb ? [6, 7, 8, 9] : [1, 2], narr: parts.join(' '), dwell: 1.1 }));
      }
      const summary = [];
      if (nl) summary.push(`linear search: ${nl} comparison${nl > 1 ? 's' : ''}`);
      if (nb) {
        const nbc = bin.steps.filter((s) => s.mid != null).length;
        summary.push(`binary search: ${nbc} comparison${nbc === 1 ? '' : 's'}`);
      }
      F(Object.assign({}, frames[frames.length - 1], { ask: null, line: null, narr: `${summary.join('; ')}. For n items, linear search needs up to n comparisons – O(n); binary search about log₂ n – O(log n): 7 for 100 items, 20 for a million, 32 for 4 billion.` }));
      return { frames, data: { items: list, sorted, method, x, nums } };
    },
    view(stage, data) {
      const rows = [];
      const n = data.sorted.length;
      const W = (stage.clientWidth || 640) - 110;
      const longest = Math.max(...data.sorted.map((v) => String(v).length));
      const cw = Math.max(30, Math.min(56, Math.floor(W / n) - 4));
      stage.style.setProperty('--sw', cw + 'px');
      stage.style.setProperty('--sfs', Math.min(15, Math.floor((cw - 6) / Math.max(2, longest) * 1.6)) + 'px');
      const mk = (label, arr, kind) => {
        const cells = arr.map((v, i) => h('div.s-cell', { 'data-i': String(i) }, h('span.s-ix', String(i)), h('span.s-v', String(v))));
        const lane = h('div.s-lane', cells, kind === 'b' ? h('div.s-range') : null, h('div.s-ptr', kind === 'b' ? 'mid' : 'i'));
        const row = h('div.s-row', h('div.s-label', label, h('span.s-count', '')), lane);
        stage.appendChild(row);
        return { row, cells, lane, range: lane.querySelector('.s-range'), ptr: lane.querySelector('.s-ptr'), count: row.querySelector('.s-count') };
      };
      const lin = data.method !== 'binary' ? mk('Linear', data.items, 'l') : null;
      const bin = data.method !== 'linear' ? mk('Binary', data.sorted, 'b') : null;
      void rows;
      const px = (i) => i * (cw + 4);
      return {
        update(f) {
          if (lin) {
            lin.cells.forEach((c, i) => {
              c.classList.toggle('seen', f.li >= 0 && i < f.li);
              c.classList.toggle('cur', i === f.li);
              c.classList.toggle('hit', f.lfound === i);
            });
            lin.ptr.hidden = f.li < 0;
            lin.ptr.style.transform = `translateX(${px(Math.max(0, f.li))}px)`;
            lin.count.textContent = `${f.lsteps} comparison${f.lsteps === 1 ? '' : 's'}`;
          }
          if (bin) {
            const b = f.b;
            bin.cells.forEach((c, i) => {
              const out = b && (i < b.lo || i > b.hi) && f.bfound !== i;
              c.classList.toggle('out', !!out);
              c.classList.toggle('cur', !!b && b.mid === i && !b.done);
              c.classList.toggle('hit', f.bfound === i);
            });
            const live = b && b.lo <= b.hi;
            bin.range.hidden = !live;
            if (live) {
              bin.range.style.transform = `translateX(${px(b.lo) - 3}px)`;
              bin.range.style.width = px(b.hi - b.lo) + cw + 6 + 'px';
            }
            bin.ptr.hidden = !(b && b.mid != null);
            if (b && b.mid != null) bin.ptr.style.transform = `translateX(${px(b.mid)}px)`;
            bin.count.textContent = `${f.bsteps} comparison${f.bsteps === 1 ? '' : 's'}`;
          }
        }
      };
    }
  });

  /* ==================================================================
     Sorting
     ================================================================== */
  const SORTS = [
    ['bubble', 'Bubble sort'],
    ['selection', 'Selection sort'],
    ['insertion', 'Insertion sort'],
    ['merge', 'Merge sort'],
    ['quick', 'Quicksort']
  ];
  const SORT_CODE = {
    bubble: ['repeat:', '    for i in range(n - 1):', '        if a[i] > a[i+1]: swap(a[i], a[i+1])', '    n -= 1                     # the largest has bubbled to the end', 'until a pass makes no swap'],
    selection: ['for k in range(n - 1):', '    m = k', '    for i in range(k + 1, n):', '        if a[i] < a[m]: m = i  # the smallest so far', '    swap(a[k], a[m])           # it goes to place k'],
    insertion: ['for k in range(1, n):', '    tmp = a[k]                 # take it out', '    j = k - 1', '    while j >= 0 and a[j] > tmp:', '        a[j+1] = a[j]; j -= 1   # shift bigger ones right', '    a[j+1] = tmp               # put it in the gap'],
    merge: ['def merge_sort(a):', '    if len(a) <= 1: return a', '    left = merge_sort(a[:mid]); right = merge_sort(a[mid:])', '    merge: take the smaller front item of left and right, again and again', '    (left[i] <= right[j] keeps equal items in order: stable)'],
    quick: ['def quicksort(a, lo, hi):', '    pivot = a[hi]                       # the last item', '    move l right to an item >= pivot; r left to an item < pivot; swap them', '    when l and r meet: swap the pivot into place l', '    quicksort(a, lo, l - 1); quicksort(a, l + 1, hi)']
  };
  V.define('sort', {
    title: 'Sorting',
    sub: 'Five ways to put a list in order – and how many steps each takes',
    inputs: [
      { key: 'items', label: 'Numbers to sort', type: 'text', max: 60, default: '5 3 8 2 4', help: 'Up to 12 whole numbers from 0 to 99.' },
      { key: 'algo', label: 'Method', type: 'select', options: SORTS, default: 'bubble' }
    ],
    presets: {
      bubble: { label: 'Bubble sort: 5 3 8 2 4', input: { items: '5 3 8 2 4', algo: 'bubble' } },
      selection: { label: 'Selection sort: 5 3 8 2 4', input: { items: '5 3 8 2 4', algo: 'selection' } },
      insertion: { label: 'Insertion sort: 5 3 8 2 4', input: { items: '5 3 8 2 4', algo: 'insertion' } },
      merge: { label: 'Merge sort: 38 27 43 3 9 82 10 51', input: { items: '38 27 43 3 9 82 10 51', algo: 'merge' } },
      quick: { label: 'Quicksort: 38 27 43 3 9 82 10 51', input: { items: '38 27 43 3 9 82 10 51', algo: 'quick' } },
      nearly: { label: 'Insertion sort on a nearly sorted list', input: { items: '2 4 5 7 6 9 11 12 15', algo: 'insertion' } },
      worst: { label: 'Quicksort on a sorted list (its worst case)', input: { items: '1 2 3 4 5 6 7 8 9', algo: 'quick' } }
    },
    practice: true,
    check(input) {
      const v = parseList(input.items);
      if (v.length < 2) return 'Give at least two numbers.';
      if (v.length > 12) return 'At most 12 numbers.';
      if (v.some((x) => typeof x !== 'number' || x < 0 || x > 99 || Math.round(x) !== x)) return 'Whole numbers from 0 to 99.';
      return null;
    },
    build(input, mode) {
      const values = parseList(input.items);
      const algo = input.algo;
      const items = values.map((v, id) => ({ v, id }));
      const r = A.sortSteps(items, algo, (x) => x.v);
      const frames = [];
      const ids = (arr) => arr.map((x) => x.id);
      const name = SORTS.find((s) => s[0] === algo)[1];
      const F = (o) => frames.push(Object.assign({ order: ids(items), hl: {}, sorted: [], cmp: 0, mv: 0 }, o));
      F({ line: null, narr: `${name} of ${values.join(', ')}. ${{ bubble: 'Go along the list comparing neighbours, swapping any that are in the wrong order; the largest bubbles to the end. Repeat until a pass makes no swap.', selection: 'Find the smallest item and swap it to the front; then the smallest of the rest into place 1, and so on.', insertion: 'Take each item in turn and slide it left into its place among the sorted items before it.', merge: 'Split the list in halves until each part has one item, then merge the sorted parts in pairs.', quick: 'Pick a pivot (here the last item), move smaller items to its left and larger ones to its right, then sort each side the same way.' }[algo]}` });
      let asked = 0;
      const ask = (o) => mode === 'practice' && asked++ < 8 && o;
      const cnt = (st) => ({ cmp: st.comparisons, mv: st.moves });
      r.steps.forEach((st, k) => {
        const order = ids(st.a);
        const val = (pos) => st.a[pos].v;
        const c = cnt(st);
        if (algo === 'bubble') {
          const done = A.range(st.sorted || 0).map((q) => order[order.length - 1 - q]);
          if (st.op === 'cmp') {
            const a = ask({ type: 'choice', options: [['swap', 'Swap them'], ['keep', 'Leave them']], answer: st.swap ? 'swap' : 'keep', prompt: `${val(st.i)} and ${val(st.j)}: swap them?`, hint: 'Swap when the left one is larger.', explain: st.swap ? `${val(st.i)} > ${val(st.j)}: swap.` : `${val(st.i)} ≤ ${val(st.j)}: leave them.` });
            if (a) F(Object.assign({ order, hl: { [order[st.i]]: 'cmp', [order[st.j]]: 'cmp' }, sorted: done, line: 2, narr: `Pass ${st.pass}: compare ${val(st.i)} and ${val(st.j)}.`, ask: a }, c));
            F(Object.assign({ order, hl: { [order[st.i]]: 'cmp', [order[st.j]]: 'cmp' }, sorted: done, line: 2, narr: `Pass ${st.pass}: ${val(st.i)} and ${val(st.j)} – ${st.swap ? 'in the wrong order: swap' : 'in order'}.`, dwell: 0.8 }, c));
          } else if (st.op === 'swap') F(Object.assign({ order, hl: { [order[st.i]]: 'mv', [order[st.j]]: 'mv' }, sorted: done, line: 2, narr: `Swapped.`, dwell: 0.7 }, c));
          else if (st.op === 'pass') F(Object.assign({ order, sorted: done, line: [3, 4], narr: `End of pass ${st.pass}: ${val(order.length - st.sorted)} is in its final place.${st.swapped ? '' : ' No swap in this pass: the list is sorted.'}` }, c));
        } else if (algo === 'selection') {
          const done = order.slice(0, st.sorted || 0);
          if (st.op === 'start') F(Object.assign({ order, sorted: done, hl: { [order[st.k]]: 'min' }, line: [0, 1], narr: `Place ${st.k}: find the smallest of items ${st.k}–${order.length - 1}. So far: ${val(st.k)}.` }, c));
          else if (st.op === 'cmp') F(Object.assign({ order, sorted: done, hl: { [order[st.i]]: 'cmp', [order[st.min]]: 'min' }, line: [2, 3], narr: `${val(st.i)} against the smallest so far, ${val(st.min)}: ${st.smaller ? 'smaller' : 'not smaller'}.`, dwell: 0.7 }, c));
          else if (st.op === 'min') F(Object.assign({ order, sorted: done, hl: { [order[st.min]]: 'min' }, line: 3, narr: `The smallest so far is now ${val(st.min)}.`, dwell: 0.6 }, c));
          else if (st.op === 'swap' || st.op === 'stay') {
            const a = ask({ type: 'number', answer: val(st.k), prompt: `Which number goes into place ${st.k}?`, hint: `The smallest of the items from place ${st.k} on.`, explain: `${val(st.k)}.` });
            if (a) F(Object.assign({ order: ids(r.steps[k - 1].a), sorted: done.slice(0, -1), line: 4, narr: `All of items ${st.k}–${order.length - 1} have been compared.`, ask: a }, cnt(r.steps[k - 1])));
            F(Object.assign({ order, sorted: done, hl: { [order[st.k]]: 'mv' }, line: 4, narr: st.op === 'swap' ? `Swap the smallest, ${val(st.k)}, into place ${st.k}.` : `${val(st.k)} is already in place ${st.k}.` }, c));
          }
        } else if (algo === 'insertion') {
          const done = order.slice(0, st.sorted || 0);
          if (st.op === 'take') F(Object.assign({ order, sorted: done, out: st.tmp.id, hole: st.hole, hl: { [st.tmp.id]: 'min' }, line: [0, 1], narr: `Take out ${st.tmp.v} (item ${st.k}) and find its place among the sorted items to its left.` }, c));
          else if (st.op === 'cmp') F(Object.assign({ order, sorted: done, out: st.tmp.id, hole: st.hole, hl: { [order[st.i]]: 'cmp', [st.tmp.id]: 'min' }, line: 3, narr: `${val(st.i)} > ${st.tmp.v}? ${st.bigger ? 'Yes: it moves one place right.' : 'No: the gap is the place.'}`, dwell: 0.7 }, c));
          else if (st.op === 'shift') F(Object.assign({ order, sorted: done, out: st.tmp.id, hole: st.hole, hl: { [order[st.i + 1]]: 'mv', [st.tmp.id]: 'min' }, line: 4, narr: 'Shifted right.', dwell: 0.6 }, c));
          else if (st.op === 'put') {
            const a = ask({ type: 'number', answer: st.i, prompt: `At which index does ${st.tmp.v} go back in? (counting from 0)`, hint: 'Count how many of the sorted items to its left are not bigger than it.', explain: `At index ${st.i}.` });
            if (a) F(Object.assign({ order: ids(r.steps[k - 1].a), sorted: order.slice(0, st.k), out: st.tmp.id, hole: r.steps[k - 1].hole, line: 5, narr: `Where does ${st.tmp.v} belong?`, ask: a }, cnt(r.steps[k - 1])));
            F(Object.assign({ order, sorted: done, hl: { [st.tmp.id]: 'mv' }, line: 5, narr: `Put ${st.tmp.v} into the gap at index ${st.i}.` }, c));
          }
        } else if (algo === 'merge') {
          if (st.op === 'split') F(Object.assign({ order, range: [st.lo, st.hi], depth: st.depth, mid: st.mid, line: 2, narr: `Split ${span(st.lo, st.hi - 1)} into ${span(st.lo, st.mid - 1)} and ${span(st.mid, st.hi - 1)}.`, dwell: 0.8 }, c));
          else if (st.op === 'merge') F(Object.assign({ order, range: [st.lo, st.hi], depth: st.depth, mid: st.mid, buf: [], bufAt: st.lo, line: 3, narr: `Merge the sorted halves ${st.left.map((x) => x.v).join(' ')} and ${st.right.map((x) => x.v).join(' ')}.` }, c));
          else if (st.op === 'mcmp') {
            const L = st.left[st.li], R = st.right[st.ri];
            const a = ask({ type: 'choice', options: [['left', `${L.v} (left)`], ['right', `${R.v} (right)`]], answer: st.takeLeft ? 'left' : 'right', prompt: 'Which comes next in the merged list?', hint: 'The smaller of the two front items (the left one if they are equal).', explain: `${st.takeLeft ? L.v : R.v}.` });
            if (a) F(Object.assign({ order, range: [st.lo, st.hi], depth: st.depth, mid: st.mid, buf: st.out.map((x) => x.id), bufAt: st.lo, hl: { [L.id]: 'cmp', [R.id]: 'cmp' }, line: 3, narr: `Front items: ${L.v} and ${R.v}.`, ask: a }, c));
            const out2 = st.out.concat([st.takeLeft ? L : R]);
            F(Object.assign({ order, range: [st.lo, st.hi], depth: st.depth, mid: st.mid, buf: out2.map((x) => x.id), bufAt: st.lo, hl: { [L.id]: 'cmp', [R.id]: 'cmp' }, line: [3, 4], narr: `${L.v} or ${R.v}: take ${st.takeLeft ? L.v : R.v}.`, dwell: 0.8 }, c));
          } else if (st.op === 'merged') F(Object.assign({ order, range: [st.lo, st.hi], depth: st.depth, line: 3, narr: `Merged: ${st.out.map((x) => x.v).join(' ')}.`, dwell: 0.9 }, c));
        } else if (algo === 'quick') {
          const pv = st.pivot ? st.pivot.v : null;
          if (st.op === 'pivot') F(Object.assign({ order, range: [st.lo, st.hi + 1], pivot: order[st.hi], hl: { [order[st.hi]]: 'pivot' }, line: 1, narr: `Partition items ${st.lo}–${st.hi} around the pivot ${pv} (the last one).` }, c));
          else if (st.op === 'scanL' || st.op === 'scanR') F(Object.assign({ order, range: [st.lo, st.hi + 1], pivot: order[st.hi], ptrL: st.l, ptrR: st.r, hl: { [order[st.hi]]: 'pivot', [order[st.op === 'scanL' ? st.l : st.r]]: 'cmp' }, line: 2, narr: st.op === 'scanL' ? `Left pointer: ${val(st.l)} ${st.stop ? '≥' : '<'} ${pv}${st.stop ? ' – stop here.' : ' – move on.'}` : `Right pointer: ${val(st.r)} ${st.stop ? '<' : '≥'} ${pv}${st.stop ? ' – stop here.' : ' – move on.'}`, dwell: 0.7 }, c));
          else if (st.op === 'swap') F(Object.assign({ order, range: [st.lo, st.hi + 1], pivot: order[st.hi], ptrL: st.l, ptrR: st.r, hl: { [order[st.i]]: 'mv', [order[st.j]]: 'mv', [order[st.hi]]: 'pivot' }, line: 2, narr: `Swap ${val(st.j)} and ${val(st.i)}: the small one goes left, the large one right.` }, c));
          else if (st.op === 'placed') {
            const a = ask({ type: 'number', answer: st.p, prompt: `The pointers have met. At which index does the pivot ${pv} end up?`, hint: `The first index of this part (${st.lo}), plus the number of its items that are smaller than the pivot.`, explain: `Index ${st.p}: everything left of it is smaller, everything right of it is not.` });
            if (a) F(Object.assign({ order: ids(r.steps[k - 1].a), range: [st.lo, st.hi + 1], pivot: r.steps[k - 1].a[st.hi].id, hl: { [r.steps[k - 1].a[st.hi].id]: 'pivot' }, line: 3, narr: 'Where does the pivot go?', ask: a }, cnt(r.steps[k - 1])));
            F(Object.assign({ order, range: [st.lo, st.hi + 1], fixed: order[st.p], hl: { [order[st.p]]: 'pivot' }, line: [3, 4], narr: `The pivot ${pv} goes to index ${st.p}: in its final place. Now sort the part on each side.` }, c));
          }
        }
        if (st.op === 'done') F(Object.assign({ order, sorted: order.slice(), line: null, narr: `Sorted: ${st.a.map((x) => x.v).join(' ')}. ${st.comparisons} comparisons and ${st.moves} ${algo === 'insertion' || algo === 'merge' ? 'move' : 'swap'}${st.moves === 1 ? '' : 's'}. ${{ bubble: 'Bubble sort makes about n²/2 comparisons – O(n²).', selection: 'Selection sort always makes about n²/2 comparisons, but at most n swaps – O(n²).', insertion: 'Insertion sort is O(n²) in the worst case, but nearly sorted lists take only about n steps.', merge: 'Merge sort takes O(n log n): log₂ n levels of splitting, n steps of merging on each. It is stable: equal items keep their order.', quick: 'Quicksort takes O(n log n) on average; a bad pivot every time (as on a sorted list with the last item as pivot) makes it O(n²).' }[algo]}` }, c));
      });
      return { frames, data: { items, algo } };
    },
    view(stage, data) {
      const n = data.items.length;
      const W = (stage.clientWidth || 640) - 60;
      const bw = Math.max(26, Math.min(58, Math.floor(W / n) - 6));
      const pitch = bw + 6;
      const maxV = Math.max(...data.items.map((x) => x.v), 1);
      const H = data.algo === 'merge' ? Math.max(70, Math.min(130, ((stage.clientHeight || 500) - 150) / 2 - 40)) : Math.max(120, Math.min(220, (stage.clientHeight || 500) - 260));
      const wrap = h('div.so', { style: { width: n * pitch + 'px' } });
      const counts = h('div.sl-counts');
      stage.appendChild(counts);
      stage.appendChild(wrap);
      const lane = h('div.so-lane', { style: { height: H + 30 + 'px' } });
      const buf = h('div.so-buf', { style: { height: H + 30 + 'px' } });
      const rng = h('div.so-range');
      const ptrL = h('div.so-ptr', 'l'), ptrR = h('div.so-ptr', 'r');
      wrap.appendChild(rng);
      wrap.appendChild(lane);
      wrap.appendChild(buf);
      wrap.appendChild(ptrL);
      wrap.appendChild(ptrR);
      const bars = {};
      data.items.forEach((it) => {
        const b = h('div.so-bar', { style: { width: bw + 'px' } }, h('div.so-col', { style: { height: Math.max(6, (it.v / maxV) * H) + 'px' } }), h('div.so-v', String(it.v)));
        lane.appendChild(b);
        bars[it.id] = b;
      });
      const merge = data.algo === 'merge';
      buf.hidden = !merge;
      return {
        update(f) {
          const sorted = new Set(f.sorted || []);
          const inBuf = new Map();
          (f.buf || []).forEach((id, k) => inBuf.set(id, f.bufAt + k));
          // where each bar goes: its place in the list, or in the merge buffer below; the item taken out by
          // insertion sort hovers above the gap (while the others shift, it is not in the list at all)
          const at = {};
          f.order.forEach((id, pos) => {
            if (id === f.out) return;
            at[id] = inBuf.has(id) ? [inBuf.get(id) * pitch, H + 40] : [pos * pitch, 0];
          });
          if (f.out != null) at[f.out] = [(f.hole != null ? f.hole : f.order.indexOf(f.out)) * pitch, -26];
          Object.keys(at).forEach((id) => {
            const b = bars[id];
            b.style.transform = `translate(${at[id][0]}px, ${at[id][1]}px)`;
            b.className = 'so-bar' + (f.hl && f.hl[id] ? ' ' + f.hl[id] : '') + (sorted.has(+id) ? ' done' : '') + (f.fixed === +id ? ' fixed' : '') + (f.out === +id ? ' lifted' : '');
          });
          // the part being worked on
          if (f.range) {
            rng.hidden = false;
            rng.style.transform = `translateX(${f.range[0] * pitch - 4}px)`;
            rng.style.width = (f.range[1] - f.range[0]) * pitch + 2 + 'px';
            rng.dataset.depth = f.depth != null ? 'level ' + f.depth : '';
          } else rng.hidden = true;
          ptrL.hidden = f.ptrL == null;
          ptrR.hidden = f.ptrR == null;
          if (f.ptrL != null) ptrL.style.transform = `translateX(${f.ptrL * pitch + bw / 2 - 8}px)`;
          if (f.ptrR != null) ptrR.style.transform = `translateX(${f.ptrR * pitch + bw / 2 - 8}px)`;
          counts.innerHTML = `<span><b>${f.cmp}</b> comparisons</span><span><b>${f.mv}</b> ${data.algo === 'insertion' || data.algo === 'merge' ? 'moves' : 'swaps'}</span>`;
        }
      };
    }
  });
  V.machines.sort.codeFor = (input) => SORT_CODE[input.algo];

  /* ==================================================================
     A hash table of k-mers
     ================================================================== */
  V.define('hash', {
    title: 'A hash table of k-mers',
    sub: 'Turn each k-mer into a number; the remainder says where it is stored',
    inputs: [
      { key: 'text', label: 'Sequence', type: 'seq', letters: 'ACGT', min: 3, max: 20, default: 'GATTACAGATTACA' },
      { key: 'k', label: 'k (length of the words)', type: 'select', options: [['2', '2'], ['3', '3'], ['4', '4']], default: '3' },
      { key: 'N', label: 'Slots in the table', type: 'select', options: [['5', '5'], ['7', '7'], ['11', '11'], ['13', '13']], default: '11' },
      { key: 'mode', label: 'When two k-mers want the same slot', type: 'select', options: [['chain', 'keep a list in the slot (chaining)'], ['probe', 'use the next free slot (linear probing)']], default: 'chain' },
      { key: 'query', label: 'Look up', type: 'seq', letters: 'ACGT', min: 2, max: 4, default: 'TAC' }
    ],
    presets: {
      chain: { label: 'Chaining: 3-mers of GATTACAGATTACA', input: { text: 'GATTACAGATTACA', k: '3', N: '11', mode: 'chain', query: 'TAC' } },
      probe: { label: 'Linear probing: the same 3-mers', input: { text: 'GATTACAGATTACA', k: '3', N: '11', mode: 'probe', query: 'TAC' } },
      crowded: { label: 'A small table: 7 slots', input: { text: 'ACGTTGCAAGCT', k: '3', N: '7', mode: 'chain', query: 'GCA' } }
    },
    practice: true,
    check(input) {
      if (input.query.length !== +input.k) return `The k-mer to look up must have k = ${input.k} letters.`;
      if (input.text.length < +input.k) return 'The sequence is shorter than k.';
      return null;
    },
    code: [
      'def code(kmer): return the k-mer as a number in base 4 (A=0 C=1 G=2 T=3)',
      'for i in range(len(s) - k + 1):',
      '    kmer = s[i:i+k]; slot = code(kmer) % N',
      '    if kmer is already in the slot: add i to its positions',
      '    else: store (kmer, [i]) in the slot     # a list, or the next free slot',
      'lookup(q): slot = code(q) % N; look only in that slot'
    ],
    build(input, mode) {
      const s = input.text, k = +input.k, N = +input.N, md = input.mode;
      const r = A.hashKmers(s, k, N, md);
      const look = A.hashLookup(r.slots, input.query, md);
      const frames = [];
      const empty = A.range(N).map(() => []);
      const F = (o) => frames.push(Object.assign({ slots: empty, win: null, calc: null, probes: null, look: null }, o));
      const codeTxt = (w) => `${w.split('').map((c, j) => `${'ACGT'.indexOf(c)}×4${k - 1 - j > 0 ? `<sup>${k - 1 - j}</sup>` : '<sup>0</sup>'}`).join(' + ')} = ${A.kmerCode(w)}`;
      F({ line: 0, narr: `A hash table finds a key in about one step, whatever its size. Each ${k}-mer (word of ${k} letters) of ${seq(s)} becomes a number – its letters as digits in base 4, A = 0, C = 1, G = 2, T = 3 – and the remainder after dividing by the ${N} slots says where it is stored, with the positions where it occurs: a <b>k-mer index</b>.` });
      let asked = 0;
      let prevSlots = empty;
      r.steps.forEach((st) => {
        if (mode === 'practice' && asked < 5) {
          asked++;
          F({ slots: prevSlots, win: st.i, line: [0, 2], narr: `The ${k}-mer at position ${st.i}: ${seq(st.w)}.`, ask: { type: 'number', answer: st.home, prompt: `In which slot does ${seq(st.w)} belong? (its number mod ${N})`, hint: `${seq(st.w)} = ${codeTxt(st.w)}. Divide by ${N}: the remainder.`, explain: `${A.kmerCode(st.w)} mod ${N} = ${st.home}.` } });
        }
        F({ slots: prevSlots, win: st.i, calc: { w: st.w, code: st.code, home: st.home }, line: 2, narr: `Position ${st.i}: ${seq(st.w)} = ${codeTxt(st.w)}; ${st.code} mod ${N} = <b>${st.home}</b>.`, dwell: 1.1 });
        let narr;
        if (md === 'probe') {
          const pl = st.placed;
          if (pl.kind === 'again') narr = `${seq(st.w)} is already in slot ${pl.slot}${st.probes.length > 1 ? ` (found after ${st.probes.length} slots)` : ''}: add position ${st.i} to it.`;
          else if (pl.kind === 'probed') narr = `Slot ${st.home} is taken by another k-mer – a <b>collision</b>. Try the next slot${st.probes.length > 2 ? 's' : ''}: ${seq(st.w)} goes into slot ${pl.slot}.`;
          else narr = `Slot ${st.home} is free: store ${seq(st.w)} there with position ${st.i}.`;
        } else narr = st.kind === 'again' ? `${seq(st.w)} is already in slot ${st.home}: add position ${st.i} to its list.` : st.kind === 'collision' ? `Slot ${st.home} already holds another k-mer – a <b>collision</b>. Add ${seq(st.w)} to the slot’s list (a chain).` : `Slot ${st.home} is empty: store ${seq(st.w)} there with position ${st.i}.`;
        F({ slots: st.slots, win: st.i, calc: { w: st.w, code: st.code, home: st.home }, probes: st.probes || null, placed: md === 'probe' ? st.placed.slot : st.home, kind: md === 'probe' ? st.placed.kind : st.kind, line: [3, 4], narr, dwell: 1.2 });
        prevSlots = st.slots;
      });
      const used = r.slots.filter((l) => l.length).length;
      const distinct = r.slots.reduce((a, l) => a + l.length, 0);
      F({ slots: prevSlots, line: null, narr: `All ${s.length - k + 1} ${k}-mers are in: ${distinct} different ones in ${used} of the ${N} slots (load ${(distinct / N).toFixed(2)}).${distinct < s.length - k + 1 ? ' Repeated k-mers share one entry with several positions.' : ''}` });
      const q = input.query;
      F({ slots: prevSlots, calc: { w: q, code: look.code, home: look.home }, look: { home: look.home }, line: 5, narr: `Look up ${seq(q)}: ${codeTxt(q)}; ${look.code} mod ${N} = <b>${look.home}</b>. Only slot ${look.home} needs to be looked at${md === 'probe' ? ' (and the slots after it, until the k-mer or a free slot)' : ''}.` });
      F({ slots: prevSlots, calc: { w: q, code: look.code, home: look.home }, look: { home: look.home, probes: look.probes, found: look.found ? look.found.w : null }, line: 5, narr: look.found ? `Found: ${seq(q)} occurs at position${look.found.pos.length > 1 ? 's' : ''} <b>${look.found.pos.join(', ')}</b> – without scanning the sequence. ${md === 'chain' && look.looked.length > 1 ? `(${look.looked.length} entries of the slot were compared.)` : ''}` : `${seq(q)} is not in the table: it does not occur in the sequence.` });
      return { frames, data: { s, k, N, md } };
    },
    view(stage, data) {
      const { s, k, N } = data;
      const W = (stage.clientWidth || 640) - 110;
      const size = Math.max(20, Math.min(34, Math.floor(W / s.length) - 3));
      stage.style.setProperty('--cell', size + 'px');
      const tiles = s.split('').map((c) => h('span', { class: V.tileClass(c) }, c));
      const textRow = h('div.tiles', tiles.map((t, i) => h('span.tilebox', h('span.posn', String(i)), t)));
      stage.appendChild(h('div.sl-row.trie-top.wide', h('span.viz-label', 'Sequence'), textRow));
      const calc = h('div.hs-calc');
      stage.appendChild(calc);
      const tbl = h('div.hs-table');
      const rows = A.range(N).map((i) => {
        const row = h('div.hs-row', h('span.hs-i', String(i)), h('div.hs-cell'));
        tbl.appendChild(row);
        return row;
      });
      stage.appendChild(tbl);
      return {
        update(f, prev, ctx) {
          tiles.forEach((t, i) => t.classList.toggle('cur', f.win != null && i >= f.win && i < f.win + k));
          calc.innerHTML = f.calc ? `${seq(f.calc.w)} → ${f.calc.code} → ${f.calc.code} mod ${N} = <b>${f.calc.home}</b>` : '';
          calc.classList.toggle('on', !!f.calc);
          const probed = new Map();
          (f.probes || (f.look && f.look.probes) || []).forEach((p) => probed.set(p.slot, p.state));
          rows.forEach((row, i) => {
            const cell = row.lastChild;
            cell.innerHTML = '';
            f.slots[i].forEach((e) => {
              const chip = h('span.hs-chip', h('span.hs-w', e.w), h('span.hs-pos', e.pos.join(',')));
              if (f.calc && e.w === f.calc.w) chip.classList.add('cur');
              if (f.look && f.look.found === e.w) chip.classList.add('hit');
              cell.appendChild(chip);
            });
            row.classList.toggle('home', !!f.calc && f.calc.home === i);
            row.classList.toggle('placed', f.placed === i && f.kind !== 'again');
            row.dataset.probe = probed.get(i) || '';
          });
          // the new entry flies into its slot
          if (prev && f.placed != null && !ctx.back && f.win != null && f.kind !== 'again') {
            const chip = Array.from(rows[f.placed].querySelectorAll('.hs-chip')).find((c) => c.querySelector('.hs-w').textContent === f.calc.w);
            if (chip) V.fly(tiles[f.win], chip, ctx, { ms: 600 });
          }
        }
      };
    }
  });

  /* ==================================================================
     A binary search tree
     ================================================================== */
  V.define('bst', {
    title: 'A binary search tree',
    sub: 'Smaller to the left, larger to the right: a search halves the tree at each step',
    inputs: [
      { key: 'items', label: 'Numbers, in the order they are inserted', type: 'text', max: 60, default: '50 30 70 20 40 60 80 52 61', help: 'Up to 15 whole numbers.' },
      { key: 'find', label: 'Then search for', type: 'text', max: 4, default: '61' }
    ],
    presets: {
      balanced: { label: 'Nine numbers, then search 61', input: { items: '50 30 70 20 40 60 80 52 61', find: '61' } },
      insert45: { label: 'Search 45 (not there)', input: { items: '50 30 70 20 40 60 80 52 61', find: '45' } },
      vine: { label: 'Sorted input: a “vine”', input: { items: '20 30 40 50 52 60 61 70 80', find: '61' } }
    },
    practice: true,
    check(input) {
      const v = parseList(input.items);
      if (v.length < 2 || v.length > 15) return 'Between 2 and 15 numbers.';
      if (v.some((x) => typeof x !== 'number' || Math.round(x) !== x || x < 0 || x > 999)) return 'Whole numbers from 0 to 999.';
      if (!/^\d+$/.test(String(input.find).trim())) return 'Search for a whole number.';
      return null;
    },
    code: [
      'def insert(node, x):',
      '    if node is None: return Node(x)',
      '    if x < node.value: node.left = insert(node.left, x)',
      '    else: node.right = insert(node.right, x)',
      'def search(node, x):',
      '    while node and node.value != x:',
      '        node = node.left if x < node.value else node.right'
    ],
    build(input, mode) {
      const vals = parseList(input.items);
      const x = Number(input.find);
      const b = A.bstBuild(vals);
      const nodes = b.nodes;
      const frames = [];
      const F = (o) => frames.push(Object.assign({ count: 0, path: [], cur: null, hit: null }, o));
      F({ line: null, narr: `Insert ${vals.join(', ')} one by one. Each new number goes left at a node with a larger value, right at a node with a smaller one, until there is a free place.` });
      let count = 0, asked = 0;
      b.steps.forEach((st) => {
        if (st.dup) {
          F({ count, path: st.path.map((p) => p.node), line: 0, narr: `${st.v} is already in the tree.` });
          return;
        }
        st.path.forEach((p, k) => {
          const nv = nodes[p.node].value;
          if (mode === 'practice' && asked < 8) {
            asked++;
            F({ count, path: st.path.slice(0, k).map((q) => q.node), cur: p.node, newv: st.v, line: [2, 3], narr: `Insert ${st.v}: at ${nv}.`, ask: { type: 'choice', options: [['left', 'Go left'], ['right', 'Go right']], answer: p.c < 0 ? 'left' : 'right', prompt: `${st.v} at the node ${nv}: left or right?`, hint: 'Left for smaller, right for larger.', explain: `${st.v} ${p.c < 0 ? '<' : '>'} ${nv}: ${p.c < 0 ? 'left' : 'right'}.` } });
          }
          F({ count, path: st.path.slice(0, k + 1).map((q) => q.node), cur: p.node, newv: st.v, line: [2, 3], narr: `Insert ${st.v}: ${st.v} ${p.c < 0 ? '<' : '>'} ${nv}, go ${p.c < 0 ? 'left' : 'right'}.`, dwell: 0.7 });
        });
        count = st.node + 1;
        F({ count, path: st.path.map((p) => p.node).concat([st.node]), fresh: st.node, line: 1, narr: st.parent == null ? `${st.v} is the root.` : `A free place: ${st.v} becomes the ${st.side} child of ${nodes[st.parent].value}.`, dwell: 0.9 });
      });
      const depth = Math.max(...nodes.map((nd) => nd.depth));
      F({ count, line: null, narr: `The tree has ${nodes.length} nodes and ${depth + 1} levels.${depth + 1 >= nodes.length - 1 ? ' Inserted in sorted order, every number went right: the tree is a <b>vine</b>, and a search is as slow as a linear search.' : ' Read from left to right, the values are in order.'}` });
      const sr = A.bstSearch(nodes, x);
      sr.path.forEach((p, k) => {
        const nv = nodes[p.node].value;
        F({ count, path: sr.path.slice(0, k + 1).map((q) => q.node), cur: p.node, hit: p.c === 0 ? p.node : null, line: [5, 6], narr: p.c === 0 ? `Search ${x}: <b>found</b> after ${k + 1} comparison${k ? 's' : ''}.` : `Search ${x}: ${x} ${p.c < 0 ? '<' : '>'} ${nv}, go ${p.c < 0 ? 'left' : 'right'}.`, dwell: 0.9 });
      });
      if (sr.found == null) F({ count, path: sr.path.map((p) => p.node), line: [5, 6], narr: `Search ${x}: the path runs out after ${sr.path.length} comparisons – ${x} is not in the tree (it would be inserted there).` });
      F({ count, path: sr.path.map((p) => p.node), hit: sr.found, line: null, narr: `A balanced tree of n nodes has about log₂ n levels, so a search takes O(log n) steps – like binary search. An unbalanced one can take n.` });
      return { frames, data: { nodes } };
    },
    view(stage, data) {
      const nodes = data.nodes;
      const tv = V.treeView(stage);
      return {
        update(f, prev, ctx) {
          const present = nodes.slice(0, f.count);
          const L = V.layoutBst(present.map((nd) => Object.assign({}, nd, { left: nd.left != null && nd.left < f.count ? nd.left : null, right: nd.right != null && nd.right < f.count ? nd.right : null })));
          const W = (stage.clientWidth || 640) - 80, Hh = (stage.clientHeight || 500) - 70;
          const ux = Math.max(30, Math.min(64, W / Math.max(1, nodes.length)));
          const maxD = Math.max(1, ...nodes.map((nd) => nd.depth));
          const uy = Math.max(36, Math.min(70, Hh / (maxD + 1)));
          const onPath = new Set(f.path);
          tv.draw(present.map((nd) => ({
            id: nd.id, parent: nd.parent, x: 30 + L.pos[nd.id][0] * ux, y: 24 + nd.depth * uy, html: String(nd.value),
            cls: [f.cur === nd.id ? 'cur' : '', onPath.has(nd.id) ? 'path' : '', f.hit === nd.id ? 'hit' : '', f.fresh === nd.id ? 'new' : ''].filter(Boolean).join(' '),
            ecls: onPath.has(nd.id) && onPath.has(nd.parent) ? 'path' : ''
          })), ctx);
        }
      };
    }
  });
})();
