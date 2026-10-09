/* =====================================================================
   The algorithms themselves – plain functions without any drawing, so
   that the visualiser and the tests use exactly the same code.
   In the browser they are MG.algo; in Node, require('./algos.js').
   Positions are 0-based throughout (the text of the page says so where
   it counts from 1, as for alignment columns).
   ===================================================================== */
(function (root) {
  'use strict';
  const A = {};

  /* ------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------ */
  A.range = (n) => Array.from({ length: n }, (_, i) => i);
  // '$' sorts before every letter (it does in plain JavaScript string order too: '$' < 'A')
  A.cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  A.alphabetOf = (s) => Array.from(new Set(s.split(''))).sort(A.cmp);
  A.clean = (s, letters) => String(s || '').toUpperCase().replace(new RegExp('[^' + (letters || 'A-Z') + ']', 'g'), '');

  /* ------------------------------------------------------------------
     Burrows–Wheeler transform, suffix array and FM-index
     ------------------------------------------------------------------ */
  A.withSentinel = (t) => (t.endsWith('$') ? t : t + '$');

  /** all rotations of t (t ends with $), in the order they are made */
  A.rotations = (t) => A.range(t.length).map((k) => ({ start: k, str: t.slice(k) + t.slice(0, k) }));

  /** the rotations in sorted order; because $ occurs once, this is also the order of the suffixes */
  A.sortedRotations = (t) => A.rotations(t).sort((a, b) => A.cmp(a.str, b.str));

  /** the suffix array: start positions of the suffixes in sorted order */
  A.suffixArray = (t) => A.range(t.length).sort((a, b) => A.cmp(t.slice(a), t.slice(b)));

  /** BWT: the last column of the sorted rotations = the character before each suffix */
  A.bwt = (t) => A.suffixArray(t).map((p) => t[(p - 1 + t.length) % t.length]).join('');

  /**
   * The sort of the rotations as a teacher would do it: first by their first character, then rows that
   * are still tied are told apart by the second character, and so on. Returns the stages: for each,
   * the order of the rotations (their start positions) and the length k of the prefix compared so far,
   * with the groups that are still tied.
   */
  A.sortStages = (t) => {
    const n = t.length;
    const rot = A.rotations(t);
    const stages = [];
    let order = rot.map((r) => r.start); // as made
    for (let k = 1; k <= n; k++) {
      const key = (s) => rot[s].str.slice(0, k);
      // a stable sort on the first k characters (JavaScript's sort is stable): rows tied so far keep their order
      order = order.slice().sort((a, b) => A.cmp(key(a), key(b)));
      const groups = [];
      order.forEach((s) => {
        const g = groups[groups.length - 1];
        if (g && g.key === key(s)) g.rows.push(s);
        else groups.push({ key: key(s), rows: [s] });
      });
      stages.push({ k, order: order.slice(), groups: groups.map((g) => g.rows.slice()), done: groups.every((g) => g.rows.length === 1) });
      if (groups.every((g) => g.rows.length === 1)) break;
    }
    return stages;
  };

  /** rank of each character of s among the equal characters before it (written A0, A1 …) */
  A.ranks = (s) => {
    const seen = {};
    return s.split('').map((c) => {
      const r = seen[c] || 0;
      seen[c] = r + 1;
      return r;
    });
  };

  /** the FM-index of t (t ends with $): F, L, SA, C and Occ */
  A.fmIndex = (t) => {
    t = A.withSentinel(t);
    const n = t.length;
    const sa = A.suffixArray(t);
    const L = sa.map((p) => t[(p - 1 + n) % n]).join('');
    const F = sa.map((p) => t[p]).join('');
    const alphabet = A.alphabetOf(t);
    // C[c]: how many characters of t are smaller than c = the first row of F that starts with c
    const C = {};
    let total = 0;
    alphabet.forEach((c) => {
      C[c] = total;
      total += t.split('').filter((x) => x === c).length;
    });
    // occ[c][i]: how many times c occurs in L[0 .. i-1] (the tally table, with an extra 0 row on top)
    const occ = {};
    alphabet.forEach((c) => {
      const row = [0];
      for (let i = 0; i < n; i++) row.push(row[i] + (L[i] === c ? 1 : 0));
      occ[c] = row;
    });
    const Occ = (c, i) => (occ[c] ? occ[c][i] : 0);
    const rows = sa.map((p) => t.slice(p) + t.slice(0, p));
    return { t, n, sa, L, F, C, occ, Occ, alphabet, rows, lRank: A.ranks(L), fRank: A.ranks(F) };
  };

  /** LF mapping: the row of F that holds the same text character as L[i] */
  A.lf = (fm, i) => fm.C[fm.L[i]] + fm.Occ(fm.L[i], i);

  /**
   * Backward search of pattern P: the range [top, bottom) of rows whose rotations start with the suffix of P
   * matched so far. Returns every step with the numbers the formula uses.
   */
  A.backwardSearch = (fm, P) => {
    let top = 0, bottom = fm.n;
    const steps = [];
    for (let i = P.length - 1; i >= 0; i--) {
      const c = P[i];
      const known = c in fm.C;
      const occTop = known ? fm.Occ(c, top) : 0;
      const occBottom = known ? fm.Occ(c, bottom) : 0;
      const nTop = known ? fm.C[c] + occTop : 0;
      const nBottom = known ? fm.C[c] + occBottom : 0;
      steps.push({ i, c, known, fromTop: top, fromBottom: bottom, Cc: known ? fm.C[c] : null, occTop, occBottom, top: nTop, bottom: nBottom, suffix: P.slice(i) });
      top = nTop;
      bottom = nBottom;
      if (top >= bottom) break;
    }
    const found = top < bottom && steps.length === P.length;
    const positions = found ? A.range(bottom - top).map((k) => fm.sa[top + k]).sort((a, b) => a - b) : [];
    return { steps, top, bottom, found, positions };
  };

  /**
   * Locate with a sampled suffix array: only the SA values of rows whose value is a multiple of `every`
   * are kept. From a row without a value, LF steps go one character to the left in the text until a row
   * with a value is reached; position = value + steps.
   */
  A.locate = (fm, row, every) => {
    const walk = [];
    let r = row, steps = 0;
    while (fm.sa[r] % every !== 0) {
      walk.push({ row: r, char: fm.L[r] });
      r = A.lf(fm, r);
      steps++;
    }
    return { row, walk, sampledRow: r, value: fm.sa[r], steps, position: fm.sa[r] + steps };
  };

  /** the BWT turned back into the text, by LF mapping from the row that starts with $ */
  A.inverseBwt = (L) => {
    const n = L.length;
    const F = L.split('').sort(A.cmp).join('');
    const alphabet = A.alphabetOf(L);
    const C = {};
    let total = 0;
    alphabet.forEach((c) => {
      C[c] = total;
      total += L.split('').filter((x) => x === c).length;
    });
    const lRank = A.ranks(L);
    const walk = [];
    let row = 0; // F[0] is '$'
    let text = '$';
    for (let k = 0; k < n - 1; k++) {
      const c = L[row];
      const next = C[c] + lRank[row];
      walk.push({ row, char: c, rank: lRank[row], next });
      text = c + text;
      row = next;
    }
    return { text, F, C, lRank, fRank: A.ranks(F), walk };
  };

  /* ------------------------------------------------------------------
     Dynamic programming for pairwise alignment
     ------------------------------------------------------------------ */
  const PUR = { A: 1, G: 1 };
  const PYR = { C: 1, T: 1, U: 1 };
  A.isTransition = (a, b) => a !== b && ((PUR[a] && PUR[b]) || (PYR[a] && PYR[b]));

  /**
   * Scoring schemes. kind 'min' = penalties (distance, smaller is better); 'max' = similarity scores.
   *  edit: the unit edit distance: 0 for a match, 1 for a substitution or a gap.
   *  penalty: a DNA penalty matrix: transitions 2, transversions 4, gaps 8.
   *  dna: a DNA similarity matrix: match 1, transition −1, transversion −3, gap −7.
   *  simple: match +1, mismatch −1, gap −1.
   *  blosum62: BLOSUM62 with a linear gap of −4 (or the gap of the options).
   */
  A.schemes = {
    edit: { kind: 'min', name: 'Edit distance (match 0, substitution 1, gap 1)', sub: (a, b) => (a === b ? 0 : 1), gap: 1 },
    penalty: { kind: 'min', name: 'DNA penalties (match 0, transition 2, transversion 4, gap 8)', sub: (a, b) => (a === b ? 0 : A.isTransition(a, b) ? 2 : 4), gap: 8 },
    dna: { kind: 'max', name: 'DNA scores (match +1, transition −1, transversion −3, gap −7)', sub: (a, b) => (a === b ? 1 : A.isTransition(a, b) ? -1 : -3), gap: -7 },
    simple: { kind: 'max', name: 'Simple scores (match +1, mismatch −1, gap −1)', sub: (a, b) => (a === b ? 1 : -1), gap: -1 },
    blosum62: { kind: 'max', name: 'BLOSUM62, gap −4', sub: (a, b) => A.blosum62(a, b), gap: -4 }
  };
  A.scheme = (name, opts) => {
    const s = Object.assign({}, A.schemes[name] || A.schemes.simple);
    if (opts && opts.gap != null) s.gap = +opts.gap;
    if (opts && (opts.match != null || opts.mismatch != null)) {
      const m = opts.match != null ? +opts.match : 1, mm = opts.mismatch != null ? +opts.mismatch : -1;
      s.sub = (a, b) => (a === b ? m : mm);
    }
    return s;
  };

  /**
   * Fill a dynamic-programming matrix for x (down the rows) against y (across the columns).
   *   mode 'global'  – Needleman–Wunsch / edit distance: first row and column are gap costs;
   *   mode 'local'   – Smith–Waterman: no cell below 0 (scores) – an alignment may start anywhere;
   *   mode 'fit'     – x is a pattern to find in y (approximate matching): the first row is 0, so the
   *                    pattern may start at any column, and the answer is the best cell of the last row.
   * Returns the matrix, the candidate values of every cell, the arrows that give its value,
   * the cell(s) where the answer is, one traceback (diagonal preferred on ties) and the alignment.
   */
  A.dp = (x, y, scheme, mode) => {
    mode = mode || 'global';
    const m = x.length, n = y.length;
    const better = scheme.kind === 'min' ? (a, b) => a < b : (a, b) => a > b;
    const best = (vals) => vals.reduce((p, v) => (p === null || better(v, p) ? v : p), null);
    const V = A.range(m + 1).map(() => new Array(n + 1).fill(0));
    const cand = A.range(m + 1).map(() => new Array(n + 1).fill(null));
    const ptr = A.range(m + 1).map(() => new Array(n + 1).fill(null)); // arrows: 'd' diagonal, 'u' from above, 'l' from the left
    const g = scheme.gap;
    for (let i = 0; i <= m; i++) {
      for (let j = 0; j <= n; j++) {
        if (i === 0 && j === 0) {
          V[0][0] = 0;
          ptr[0][0] = [];
          continue;
        }
        if (i === 0) {
          // first row: gaps in x – except when the pattern may start anywhere (fit) or locally
          if (mode === 'fit' || mode === 'local') {
            V[0][j] = 0;
            ptr[0][j] = [];
          } else {
            V[0][j] = V[0][j - 1] + g;
            ptr[0][j] = ['l'];
          }
          continue;
        }
        if (j === 0) {
          if (mode === 'local') {
            V[i][0] = 0;
            ptr[i][0] = [];
          } else {
            V[i][0] = V[i - 1][0] + g;
            ptr[i][0] = ['u'];
          }
          continue;
        }
        const s = scheme.sub(x[i - 1], y[j - 1]);
        const c = { d: V[i - 1][j - 1] + s, l: V[i][j - 1] + g, u: V[i - 1][j] + g, s };
        let v = best([c.d, c.l, c.u]);
        let arrows = ['d', 'u', 'l'].filter((k) => c[k] === v);
        if (mode === 'local' && v <= 0) {
          // Smith–Waterman: no alignment is worse than the empty one, which scores 0 – start afresh here
          arrows = v === 0 ? arrows.concat(['0']) : ['0'];
          v = 0;
        }
        c.v = v;
        V[i][j] = v;
        cand[i][j] = c;
        ptr[i][j] = arrows;
      }
    }
    // where the answer is
    let ends = [];
    if (mode === 'global') ends = [[m, n]];
    else if (mode === 'fit') {
      const last = V[m];
      const b = best(last.slice(0));
      last.forEach((v, j) => v === b && ends.push([m, j]));
    } else {
      let b = 0;
      V.forEach((row, i) => row.forEach((v, j) => {
        if (v > b) b = v;
      }));
      if (b > 0) V.forEach((row, i) => row.forEach((v, j) => v === b && ends.push([i, j])));
    }
    const score = ends.length ? V[ends[0][0]][ends[0][1]] : 0;
    const tb = ends.length ? A.traceback(x, y, V, ptr, ends[0], mode) : null;
    return { x, y, m, n, V, cand, ptr, ends, score, tb, mode, scheme };
  };

  /** one traceback, preferring the diagonal, then a step up, then a step left */
  A.traceback = (x, y, V, ptr, end, mode) => {
    let [i, j] = end;
    const path = [[i, j]];
    const ax = [], ay = [], ops = [];
    for (;;) {
      if (mode === 'local' && V[i][j] === 0) break;
      if (mode === 'fit' && i === 0) break;
      if (i === 0 && j === 0) break;
      const p = ptr[i][j] || [];
      let step = p.includes('d') ? 'd' : p.includes('u') ? 'u' : p.includes('l') ? 'l' : null;
      if (!step) break;
      if (step === 'd') {
        ax.unshift(x[i - 1]);
        ay.unshift(y[j - 1]);
        ops.unshift(x[i - 1] === y[j - 1] ? 'M' : 'S');
        i--;
        j--;
      } else if (step === 'u') {
        ax.unshift(x[i - 1]);
        ay.unshift('-');
        ops.unshift('D'); // x has a character that y lacks (a deletion from x, reading the alignment as an edit of x into y)
        i--;
      } else {
        ax.unshift('-');
        ay.unshift(y[j - 1]);
        ops.unshift('I'); // y has a character that x lacks (an insertion)
        j--;
      }
      path.unshift([i, j]);
    }
    return { path, ax: ax.join(''), ay: ay.join(''), ops: ops.join(''), start: [i, j] };
  };

  /**
   * The calls of the plain recursive edit distance (or the memoised one), in the order they are made.
   * Each call: {id, parent, i, j (lengths of the prefixes), depth, value, memo (answered from the memo), order}.
   */
  A.editCalls = (x, y, memo) => {
    const calls = [];
    const seen = new Map();
    const events = []; // {type: 'call' | 'return', id}
    const go = (i, j, parent, depth) => {
      const id = calls.length;
      const c = { id, parent, i, j, depth, value: null, memo: false, kids: [] };
      calls.push(c);
      if (parent != null) calls[parent].kids.push(id);
      events.push({ type: 'call', id });
      const key = i + ',' + j;
      let v;
      if (memo && seen.has(key)) {
        c.memo = true;
        v = seen.get(key);
      } else if (i === 0) v = j;
      else if (j === 0) v = i;
      else {
        const d = x[i - 1] === y[j - 1] ? 0 : 1;
        const a = go(i - 1, j - 1, id, depth + 1) + d;
        const b = go(i - 1, j, id, depth + 1) + 1;
        const e = go(i, j - 1, id, depth + 1) + 1;
        v = Math.min(a, b, e);
      }
      if (memo && !seen.has(key)) seen.set(key, v);
      c.value = v;
      events.push({ type: 'return', id });
      return v;
    };
    go(x.length, y.length, null, 0);
    return { calls, events, value: calls[0].value };
  };
  /** how many calls the plain recursion makes for prefixes of lengths m and n (without making them) */
  A.editCallCount = (m, n) => {
    const C = A.range(m + 1).map(() => new Array(n + 1).fill(1));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) C[i][j] = 1 + C[i - 1][j - 1] + C[i - 1][j] + C[i][j - 1];
    return C[m][n];
  };
  /** a dot plot: a dot where the windows of length w starting at i (in a) and j (in b) have at least t matches */
  A.dotPlot = (a, b, w, t) => {
    const dots = [];
    for (let i = 0; i + w <= a.length; i++) {
      for (let j = 0; j + w <= b.length; j++) {
        let mt = 0;
        for (let k = 0; k < w; k++) if (a[i + k] === b[j + k]) mt++;
        if (mt >= t) dots.push([i, j, mt]);
      }
    }
    return dots;
  };

  /** the number of cells a dynamic-programming matrix fills: (m+1)(n+1) */
  A.cells = (m, n) => (m + 1) * (n + 1);

  /** Hamming distance (equal lengths): the number of positions that differ */
  A.hamming = (a, b) => {
    if (a.length !== b.length) return null;
    let d = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
    return d;
  };

  /* ------------------------------------------------------------------
     Searching and sorting (each returns the steps it takes)
     ------------------------------------------------------------------ */
  A.cmpKey = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : A.cmp(String(a), String(b)));
  /** linear search: look at every item from the start */
  A.linearSearch = (arr, x) => {
    const steps = [];
    for (let i = 0; i < arr.length; i++) {
      const hit = A.cmpKey(arr[i], x) === 0;
      steps.push({ i, hit });
      if (hit) return { steps, found: i };
    }
    return { steps, found: -1 };
  };
  /** binary search of a sorted array: halve the range [lo, hi] each time */
  A.binarySearch = (arr, x) => {
    const steps = [];
    let lo = 0, hi = arr.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const c = A.cmpKey(arr[mid], x);
      steps.push({ lo, hi, mid, c });
      if (c === 0) return { steps, found: mid };
      if (c < 0) lo = mid + 1;
      else hi = mid - 1;
    }
    steps.push({ lo, hi, mid: null, c: null });
    return { steps, found: -1, insertAt: lo };
  };
  /**
   * Sorting, step by step. Every step is one comparison or one move, with the array after it:
   * {op: 'cmp' | 'swap' | 'set' | 'take' | 'put' | 'pivot' | 'done' | 'split' | 'merge', i, j, a: [...], …}
   */
  A.sortSteps = (input, algo, key) => {
    const a = input.slice();
    const steps = [];
    let comparisons = 0, moves = 0;
    const S = (o) => steps.push(Object.assign({ a: a.slice(), comparisons, moves }, o));
    const kf = key || ((x) => x);
    const less = (x, y) => A.cmpKey(kf(x), kf(y)) < 0;
    if (algo === 'bubble') {
      let n = a.length, pass = 0;
      for (;;) {
        pass++;
        let swapped = false;
        for (let i = 0; i < n - 1; i++) {
          comparisons++;
          const sw = less(a[i + 1], a[i]);
          S({ op: 'cmp', i, j: i + 1, swap: sw, pass, sorted: a.length - (n) });
          if (sw) {
            [a[i], a[i + 1]] = [a[i + 1], a[i]];
            moves++;
            swapped = true;
            S({ op: 'swap', i, j: i + 1, pass, sorted: a.length - n });
          }
        }
        n--;
        S({ op: 'pass', pass, swapped, sorted: a.length - n });
        if (!swapped || n <= 1) break;
      }
    } else if (algo === 'selection') {
      for (let k = 0; k < a.length - 1; k++) {
        let min = k;
        S({ op: 'start', k, min, sorted: k });
        for (let i = k + 1; i < a.length; i++) {
          comparisons++;
          const smaller = less(a[i], a[min]);
          S({ op: 'cmp', i, j: min, k, min, smaller, sorted: k });
          if (smaller) {
            min = i;
            S({ op: 'min', k, min, sorted: k });
          }
        }
        if (min !== k) {
          [a[k], a[min]] = [a[min], a[k]];
          moves++;
          S({ op: 'swap', i: k, j: min, k, sorted: k + 1 });
        } else S({ op: 'stay', k, sorted: k + 1 });
      }
    } else if (algo === 'insertion') {
      for (let k = 1; k < a.length; k++) {
        const tmp = a[k];
        S({ op: 'take', k, tmp, hole: k, sorted: k });
        let j = k - 1;
        let hole = k;
        while (j >= 0) {
          comparisons++;
          const bigger = less(tmp, a[j]);
          S({ op: 'cmp', i: j, k, tmp, hole, bigger, sorted: k });
          if (!bigger) break;
          a[j + 1] = a[j];
          moves++;
          hole = j;
          S({ op: 'shift', i: j, k, tmp, hole, sorted: k });
          j--;
        }
        a[hole] = tmp;
        S({ op: 'put', i: hole, k, tmp, sorted: k + 1 });
      }
    } else if (algo === 'merge') {
      const rec = (lo, hi, depth) => {
        if (hi - lo <= 1) return;
        const mid = Math.floor((lo + hi) / 2);
        S({ op: 'split', lo, hi, mid, depth });
        rec(lo, mid, depth + 1);
        rec(mid, hi, depth + 1);
        // merge a[lo:mid] and a[mid:hi]
        const left = a.slice(lo, mid), right = a.slice(mid, hi);
        let i = 0, j = 0, k = lo;
        S({ op: 'merge', lo, hi, mid, depth, left: left.slice(), right: right.slice(), out: [] });
        const out = [];
        while (i < left.length && j < right.length) {
          comparisons++;
          const takeLeft = !less(right[j], left[i]); // <= keeps it stable
          S({ op: 'mcmp', lo, hi, mid, depth, li: i, ri: j, takeLeft, left, right, out: out.slice() });
          out.push(takeLeft ? left[i++] : right[j++]);
          moves++;
        }
        while (i < left.length) (out.push(left[i++]), moves++);
        while (j < right.length) (out.push(right[j++]), moves++);
        out.forEach((v) => (a[k++] = v));
        S({ op: 'merged', lo, hi, mid, depth, out: out.slice() });
      };
      rec(0, a.length, 0);
    } else if (algo === 'quick') {
      const rec = (lo, hi, depth) => {
        // a[lo..hi] inclusive; the pivot is the last element (Lomuto's scheme)
        if (lo >= hi) {
          if (lo === hi) S({ op: 'single', lo, hi, depth });
          return;
        }
        const pivot = a[hi];
        S({ op: 'pivot', lo, hi, p: hi, depth, pivot });
        let l = lo, r = hi - 1;
        for (;;) {
          while (l <= r) {
            comparisons++;
            const stop = !less(a[l], pivot);
            S({ op: 'scanL', lo, hi, l, r, depth, pivot, stop });
            if (stop) break;
            l++;
          }
          while (r >= l) {
            comparisons++;
            const stop = less(a[r], pivot);
            S({ op: 'scanR', lo, hi, l, r, depth, pivot, stop });
            if (stop) break;
            r--;
          }
          if (l >= r) break;
          [a[l], a[r]] = [a[r], a[l]];
          moves++;
          S({ op: 'swap', i: l, j: r, lo, hi, l, r, depth, pivot });
          l++;
          r--;
        }
        if (l !== hi) {
          [a[l], a[hi]] = [a[hi], a[l]];
          moves++;
        }
        S({ op: 'placed', lo, hi, p: l, depth, pivot });
        rec(lo, l - 1, depth + 1);
        rec(l + 1, hi, depth + 1);
      };
      rec(0, a.length - 1, 0);
    }
    S({ op: 'done' });
    return { steps, sorted: a, comparisons, moves };
  };

  /* ------------------------------------------------------------------
     Hash tables and k-mers
     ------------------------------------------------------------------ */
  /** a k-mer as a number in base 4 (A=0 C=1 G=2 T=3) – 2 bits per letter */
  A.kmerCode = (w) => w.split('').reduce((acc, c) => acc * 4 + 'ACGT'.indexOf(c), 0);
  /** every k-mer of s, with its start */
  A.kmers = (s, k) => A.range(Math.max(0, s.length - k + 1)).map((i) => ({ i, w: s.slice(i, i + k) }));
  /**
   * Put the k-mers of s into a table of N slots, slot = code mod N.
   * mode 'chain': each slot holds a list (chaining); 'probe': a full slot passes the k-mer to the next one (linear probing).
   * A k-mer met again only adds its position to its entry.
   */
  A.hashKmers = (s, k, N, mode) => {
    const slots = A.range(N).map(() => []); // each: list of {w, pos: []}
    const steps = [];
    A.kmers(s, k).forEach(({ i, w }) => {
      const code = A.kmerCode(w);
      const home = code % N;
      if (mode === 'probe') {
        const probes = [];
        let slot = home, placed = null;
        for (let t = 0; t < N; t++) {
          const e = slots[slot][0];
          if (!e) {
            slots[slot].push({ w, pos: [i] });
            placed = { slot, kind: probes.length ? 'probed' : 'new' };
            probes.push({ slot, state: 'free' });
            break;
          }
          if (e.w === w) {
            e.pos.push(i);
            placed = { slot, kind: 'again' };
            probes.push({ slot, state: 'same' });
            break;
          }
          probes.push({ slot, state: 'full' });
          slot = (slot + 1) % N;
        }
        steps.push({ i, w, code, home, probes, placed, slots: slots.map((l) => l.map((e) => ({ w: e.w, pos: e.pos.slice() }))) });
      } else {
        const list = slots[home];
        const e = list.find((x) => x.w === w);
        let kind;
        if (e) {
          e.pos.push(i);
          kind = 'again';
        } else {
          kind = list.length ? 'collision' : 'new';
          list.push({ w, pos: [i] });
        }
        steps.push({ i, w, code, home, kind, slots: slots.map((l) => l.map((x) => ({ w: x.w, pos: x.pos.slice() }))) });
      }
    });
    return { steps, slots };
  };
  /** look a k-mer up in a table made by hashKmers */
  A.hashLookup = (slots, w, mode) => {
    const N = slots.length, code = A.kmerCode(w), home = code % N;
    const probes = [];
    if (mode === 'probe') {
      let slot = home;
      for (let t = 0; t < N; t++) {
        const e = slots[slot][0];
        if (!e) {
          probes.push({ slot, state: 'free' });
          return { code, home, probes, found: null };
        }
        if (e.w === w) {
          probes.push({ slot, state: 'same' });
          return { code, home, probes, found: e };
        }
        probes.push({ slot, state: 'full' });
        slot = (slot + 1) % N;
      }
      return { code, home, probes, found: null };
    }
    const list = slots[home];
    const looked = [];
    for (const e of list) {
      looked.push(e.w);
      if (e.w === w) return { code, home, looked, found: e };
    }
    return { code, home, looked, found: null };
  };

  /* ------------------------------------------------------------------
     Binary search trees
     ------------------------------------------------------------------ */
  /** insert the values one by one; returns the nodes and, for each insert, the path of comparisons */
  A.bstBuild = (values) => {
    const nodes = [];
    const steps = [];
    values.forEach((v) => {
      const path = [];
      if (!nodes.length) {
        nodes.push({ id: 0, value: v, left: null, right: null, parent: null, depth: 0 });
        steps.push({ v, path, node: 0, side: null, parent: null, dup: false });
        return;
      }
      let cur = 0;
      for (;;) {
        const c = A.cmpKey(v, nodes[cur].value);
        path.push({ node: cur, c });
        if (c === 0) {
          steps.push({ v, path, node: cur, dup: true });
          return;
        }
        const side = c < 0 ? 'left' : 'right';
        if (nodes[cur][side] == null) {
          const id = nodes.length;
          nodes.push({ id, value: v, left: null, right: null, parent: cur, depth: nodes[cur].depth + 1 });
          nodes[cur][side] = id;
          steps.push({ v, path, node: id, side, parent: cur, dup: false });
          return;
        }
        cur = nodes[cur][side];
      }
    });
    return { nodes, steps };
  };
  A.bstSearch = (nodes, v) => {
    const path = [];
    let cur = nodes.length ? 0 : null;
    while (cur != null) {
      const c = A.cmpKey(v, nodes[cur].value);
      path.push({ node: cur, c });
      if (c === 0) return { path, found: cur };
      cur = c < 0 ? nodes[cur].left : nodes[cur].right;
    }
    return { path, found: null };
  };

  /* ------------------------------------------------------------------
     Tries, suffix tries, suffix trees and suffix arrays
     ------------------------------------------------------------------ */
  /** a trie of words: nodes {id, parent, edge (letter), depth, children {letter: id}, ends [word numbers]} */
  A.trieBuild = (words) => {
    const nodes = [{ id: 0, parent: null, edge: '', depth: 0, children: {}, ends: [] }];
    const steps = [];
    words.forEach((w, wi) => {
      let cur = 0;
      const path = [0], created = [];
      for (const c of w) {
        let nx = nodes[cur].children[c];
        if (nx == null) {
          nx = nodes.length;
          nodes.push({ id: nx, parent: cur, edge: c, depth: nodes[cur].depth + 1, children: {}, ends: [] });
          nodes[cur].children[c] = nx;
          created.push(nx);
        }
        cur = nx;
        path.push(cur);
      }
      nodes[cur].ends.push(wi);
      steps.push({ w, wi, path, created, count: nodes.length, end: cur });
    });
    return { nodes, steps };
  };
  /** walk the trie from the root along s; returns the nodes passed and how far it got */
  A.trieWalk = (nodes, s) => {
    const path = [0];
    let cur = 0, k = 0;
    while (k < s.length && nodes[cur].children[s[k]] != null) {
      cur = nodes[cur].children[s[k]];
      path.push(cur);
      k++;
    }
    return { path, matched: k, end: cur };
  };
  /** scan a text with a trie of patterns: from every start, walk as far as the trie allows; report the words that end */
  A.trieScan = (nodes, words, T) => {
    const steps = [], hits = [];
    for (let i = 0; i < T.length; i++) {
      const wk = A.trieWalk(nodes, T.slice(i));
      const found = [];
      wk.path.forEach((id, d) => nodes[id].ends.forEach((wi) => found.push({ wi, w: words[wi], at: i, len: d })));
      found.forEach((f) => hits.push(f));
      steps.push({ i, path: wk.path, matched: wk.matched, found });
    }
    return { steps, hits };
  };
  /** the suffix trie of T: the trie of all its suffixes; the leaf (or the node) where suffix i ends holds i */
  A.suffixTrie = (T) => {
    const suffixes = A.range(T.length).map((i) => T.slice(i));
    const t = A.trieBuild(suffixes);
    return { nodes: t.nodes, steps: t.steps, suffixes };
  };
  /** the leaves (suffix starts) under a node of a (suffix) trie */
  A.trieLeaves = (nodes, id) => {
    const out = [];
    const go = (x) => {
      nodes[x].ends.forEach((e) => out.push(e));
      Object.keys(nodes[x].children).sort(A.cmp).forEach((c) => go(nodes[x].children[c]));
    };
    go(id);
    return out.sort((a, b) => a - b);
  };
  /**
   * Compress a trie into a radix tree (for a suffix trie: the suffix tree). Only the root, the branching
   * nodes and the leaves are kept; a chain of nodes with one child each becomes one edge with a longer label.
   * Returns the kept nodes, the parent of each among the kept ones, the label of the edge into it, and the
   * word ends that sat on a merged node – for suffixes without a $ these are the suffixes that are "lost".
   */
  A.compressTrie = (nodes) => {
    const nkids = (nd) => Object.keys(nd.children).length;
    const keep = new Set([0]);
    nodes.forEach((nd) => {
      if (nd.id !== 0 && nkids(nd) !== 1) keep.add(nd.id);
    });
    const parent = {}, label = {}, lost = [];
    nodes.forEach((nd) => {
      if (!keep.has(nd.id)) nd.ends.forEach((e) => lost.push({ end: e, node: nd.id }));
    });
    keep.forEach((id) => {
      if (id === 0) return;
      let p = nodes[id].parent;
      let lab = nodes[id].edge;
      while (!keep.has(p)) {
        lab = nodes[p].edge + lab;
        p = nodes[p].parent;
      }
      parent[id] = p;
      label[id] = lab;
    });
    return { keep: Array.from(keep).sort((a, b) => a - b), parent, label, lost };
  };
  /**
   * Search a pattern in a suffix array: binary search for the first suffix that is not smaller than P,
   * then the rows from there on that start with P.
   */
  A.saSearch = (T, sa, P) => {
    const steps = [];
    const pre = (r) => T.slice(sa[r], sa[r] + P.length);
    let lo = 0, hi = sa.length; // the first row with suffix >= P is in [lo, hi]
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const c = A.cmp(pre(mid), P); // the first |P| letters of the suffix against P
      steps.push({ lo, hi, mid, c, suffix: T.slice(sa[mid]) });
      if (c < 0) lo = mid + 1;
      else hi = mid;
    }
    const first = lo;
    const rows = [];
    let r = first;
    while (r < sa.length && pre(r) === P) {
      rows.push(r);
      r++;
    }
    return { steps, first, rows, positions: rows.map((x) => sa[x]).sort((a, b) => a - b), stopRow: r < sa.length ? r : null };
  };

  /* ------------------------------------------------------------------
     Exact pattern matching: naive, Knuth–Morris–Pratt, Boyer–Moore, Rabin–Karp
     Each returns the alignments ("shifts") it tries, with the comparisons made at each.
     ------------------------------------------------------------------ */
  /** naive: try every shift; compare left to right until a mismatch */
  A.naiveSearch = (T, P) => {
    const n = T.length, m = P.length;
    const steps = [], hits = [];
    let comparisons = 0;
    for (let s = 0; s + m <= n; s++) {
      const comps = [];
      let j = 0;
      while (j < m) {
        const ok = T[s + j] === P[j];
        comps.push({ j, ok });
        comparisons++;
        if (!ok) break;
        j++;
      }
      const match = j === m;
      if (match) hits.push(s);
      steps.push({ s, comps, match, shift: 1 });
    }
    return { steps, hits, comparisons };
  };

  /**
   * The KMP failure table in the form used on the page: pi[0] = -1, and pi[i] (i = 1 … m) is the length of the
   * longest proper border of P[0 .. i-1] (a prefix that is also a suffix). Returns pi and how each entry was found.
   */
  A.kmpTable = (P) => {
    const m = P.length;
    const pi = new Array(m + 1);
    pi[0] = -1;
    const how = [null];
    for (let i = 1; i <= m; i++) {
      let k = pi[i - 1];
      const tries = [];
      while (k >= 0 && P[k] !== P[i - 1]) {
        tries.push({ k, ok: false });
        k = pi[k];
      }
      if (k >= 0) tries.push({ k, ok: true });
      pi[i] = k + 1;
      how.push({ i, tries, value: pi[i] });
    }
    return { pi, how };
  };

  /** KMP search: after i matched letters and a mismatch, shift by i - pi[i] and keep pi[i] letters as matched */
  A.kmpSearch = (T, P) => {
    const n = T.length, m = P.length;
    const { pi } = A.kmpTable(P);
    const steps = [], hits = [];
    let s = 0, q = 0, comparisons = 0;
    while (s + m <= n) {
      const start = q;
      const comps = [];
      while (q < m) {
        const ok = T[s + q] === P[q];
        comps.push({ j: q, ok });
        comparisons++;
        if (!ok) break;
        q++;
      }
      const match = q === m;
      if (match) hits.push(s);
      const i = q; // letters matched
      const shift = i - pi[i];
      steps.push({ s, start, comps, match, i, pi: pi[i], shift, keep: Math.max(pi[i], 0) });
      s += shift;
      q = Math.max(pi[i], 0);
    }
    return { steps, hits, comparisons, pi };
  };

  /**
   * Boyer–Moore tables. Bad character (the extended rule): a mismatch at pattern position j against text
   * letter c shifts the pattern so that the right-most c left of j lies under it: shift j - k (k = -1 if none).
   * Good suffix (after H. W. Lang): f[i] is where the widest border of the suffix P[i..] starts, and s[i] the
   * shift when the suffix P[i..] has matched and P[i-1] has not (s[0]: after a whole match).
   */
  A.bmTables = (P, alphabet) => {
    const m = P.length;
    const letters = alphabet || A.alphabetOf(P);
    const bad = {};
    letters.forEach((c) => {
      bad[c] = [];
      let last = -1;
      for (let j = 0; j < m; j++) {
        bad[c].push(P[j] === c ? null : j - last); // null: no mismatch is possible there with this letter
        if (P[j] === c) last = j;
      }
    });
    const f = new Array(m + 1).fill(0), sh = new Array(m + 1).fill(0);
    let i = m, j = m + 1;
    f[i] = j;
    while (i > 0) {
      while (j <= m && P[i - 1] !== P[j - 1]) {
        if (sh[j] === 0) sh[j] = j - i;
        j = f[j];
      }
      i--;
      j--;
      f[i] = j;
    }
    j = f[0];
    for (i = 0; i <= m; i++) {
      if (sh[i] === 0) sh[i] = j;
      if (i === j) j = f[j];
    }
    const badShift = (c, pos) => {
      for (let k = pos - 1; k >= 0; k--) if (P[k] === c) return pos - k;
      return pos + 1;
    };
    return { bad, badShift, f, s: sh };
  };

  /** Boyer–Moore search: compare right to left; on a mismatch take the larger of the two shifts */
  A.bmSearch = (T, P, opts = {}) => {
    const n = T.length, m = P.length;
    const tb = A.bmTables(P, A.alphabetOf(T + P));
    const steps = [], hits = [];
    let s = 0, comparisons = 0;
    while (s + m <= n) {
      let j = m - 1;
      const comps = [];
      while (j >= 0) {
        const ok = T[s + j] === P[j];
        comps.push({ j, ok });
        comparisons++;
        if (!ok) break;
        j--;
      }
      let shift, bc = null, gs, why;
      if (j < 0) {
        hits.push(s);
        gs = tb.s[0];
        shift = opts.goodSuffix === false ? 1 : gs;
        why = 'match';
      } else {
        bc = tb.badShift(T[s + j], j);
        gs = tb.s[j + 1];
        if (opts.goodSuffix === false) shift = bc, (why = 'bad');
        else if (opts.badChar === false) shift = gs, (why = 'good');
        else {
          shift = Math.max(bc, gs);
          why = bc > gs ? 'bad' : gs > bc ? 'good' : 'both';
        }
      }
      steps.push({ s, comps, match: j < 0, j, c: j >= 0 ? T[s + j] : null, bc, gs, shift, why });
      s += shift;
    }
    return { steps, hits, comparisons, tables: tb };
  };

  /** codes of letters for the rolling hash: digits are themselves, A C G T are 0 1 2 3 */
  A.rkCode = (c) => (/[0-9]/.test(c) ? +c : 'ACGT'.indexOf(c));
  /**
   * Rabin–Karp with the rolling hash h = (number of the window, in base `base`) mod q.
   * Every window's hash comes from the one before: ((h - out * base^(m-1)) * base + in) mod q.
   */
  A.rabinKarp = (T, P, base, q) => {
    const n = T.length, m = P.length;
    const code = A.rkCode;
    const pow = (b, e) => {
      let r = 1;
      for (let k = 0; k < e; k++) r = (r * b) % q;
      return r;
    };
    const hm = pow(base, m - 1);
    const full = (str) => str.split('').reduce((acc, c) => acc * base + code(c), 0);
    let hp = 0, h = 0;
    for (let k = 0; k < m; k++) {
      hp = (hp * base + code(P[k])) % q;
      h = (h * base + code(T[k])) % q;
    }
    const steps = [], hits = [];
    let comparisons = 0, spurious = 0;
    for (let s = 0; s + m <= n; s++) {
      if (s > 0) {
        const out = code(T[s - 1]), inn = code(T[s + m - 1]);
        const before = h;
        h = (((h - ((out * hm) % q) + q) % q) * base + inn) % q;
        steps.push({ s, roll: { before, out, inn, after: h } });
      } else steps.push({ s, roll: null });
      const st = steps[steps.length - 1];
      st.h = h;
      st.value = full(T.slice(s, s + m));
      st.same = h === hp;
      st.comps = [];
      if (st.same) {
        let j = 0;
        while (j < m) {
          const ok = T[s + j] === P[j];
          st.comps.push({ j, ok });
          comparisons++;
          if (!ok) break;
          j++;
        }
        st.match = j === m;
        if (st.match) hits.push(s);
        else spurious++;
      }
    }
    return { steps, hits, comparisons, spurious, hp, pValue: full(P), q, base, hm };
  };

  /* ------------------------------------------------------------------
     Multiple alignment: distances, UPGMA, profiles, star and progressive alignment
     ------------------------------------------------------------------ */
  /** score of two letters of a multiple alignment: gap against letter `gap`, gap against gap 0 */
  A.pairScore = (a, b, sc) => (a === '-' && b === '-' ? 0 : a === '-' || b === '-' ? sc.gap : sc.sub(a, b));
  /** sum-of-pairs score of every column of an alignment (rows of equal length) */
  A.sumOfPairs = (rows, sc) => {
    const cols = [];
    for (let c = 0; c < rows[0].length; c++) {
      let t = 0;
      for (let a = 0; a < rows.length; a++) for (let b = a + 1; b < rows.length; b++) t += A.pairScore(rows[a][c], rows[b][c], sc);
      cols.push(t);
    }
    return { cols, total: cols.reduce((x, y) => x + y, 0) };
  };
  /** the identity of two sequences after a global alignment: identical columns / columns */
  A.identity = (x, y, sc) => {
    const r = A.dp(x, y, sc, 'global');
    const ax = r.tb.ax, ay = r.tb.ay;
    let same = 0;
    for (let k = 0; k < ax.length; k++) if (ax[k] === ay[k]) same++;
    return { id: same / ax.length, same, len: ax.length, ax, ay, score: r.score };
  };
  /**
   * UPGMA: join the two closest clusters; the distance of the new cluster to another is the average over
   * all pairs of their members. Heights are half the joining distance.
   */
  A.upgma = (names, D) => {
    let clusters = names.map((n, i) => ({ id: i, name: n, members: [i], height: 0 }));
    const nodes = clusters.map((c) => ({ id: c.id, name: c.name, parent: null, height: 0, kids: [] }));
    const d0 = (i, j) => D[i][j];
    const dist = (a, b) => {
      let t = 0;
      a.members.forEach((i) => b.members.forEach((j) => (t += d0(i, j))));
      return t / (a.members.length * b.members.length);
    };
    const steps = [];
    let next = names.length;
    while (clusters.length > 1) {
      let best = null;
      for (let x = 0; x < clusters.length; x++) for (let y = x + 1; y < clusters.length; y++) {
        const dd = dist(clusters[x], clusters[y]);
        if (!best || dd < best.d - 1e-12) best = { x, y, d: dd };
      }
      const a = clusters[best.x], b = clusters[best.y];
      const nc = { id: next++, name: '(' + a.name + ',' + b.name + ')', members: a.members.concat(b.members), height: best.d / 2 };
      nodes.push({ id: nc.id, name: nc.name, parent: null, height: nc.height, kids: [a.id, b.id] });
      nodes[a.id].parent = nc.id;
      nodes[b.id].parent = nc.id;
      const before = clusters.map((c) => ({ id: c.id, name: c.name }));
      const matrixBefore = clusters.map((c1) => clusters.map((c2) => (c1 === c2 ? 0 : dist(c1, c2))));
      // the new cluster takes the place of the first of its two members
      clusters = clusters.map((c) => (c === a ? nc : c)).filter((c) => c !== b);
      steps.push({ join: [a.id, b.id], names: [a.name, b.name], d: best.d, height: nc.height, node: nc.id, before, matrixBefore, branch: [nc.height - a.height, nc.height - b.height] });
    }
    return { nodes, steps, root: clusters[0].id };
  };
  /**
   * Align two alignments ("profiles") by dynamic programming: a column against a column scores the average
   * of the pair scores between them; a gap puts a column of gaps into the other profile. Gaps already in
   * a profile stay (once a gap, always a gap).
   */
  A.profileAlign = (P, Q, sc) => {
    const m = P[0].length, n = Q[0].length;
    const col = (rows, k) => rows.map((r) => r[k]);
    const cs = (a, b) => {
      let t = 0;
      a.forEach((x) => b.forEach((y) => (t += A.pairScore(x, y, sc))));
      return t / (a.length * b.length);
    };
    const gp = (a) => {
      let t = 0;
      a.forEach((x) => (t += x === '-' ? 0 : sc.gap));
      return t / a.length;
    };
    const S = A.range(m + 1).map(() => new Array(n + 1).fill(0));
    const B = A.range(m + 1).map(() => new Array(n + 1).fill(null));
    for (let i = 1; i <= m; i++) (S[i][0] = S[i - 1][0] + gp(col(P, i - 1))), (B[i][0] = 'u');
    for (let j = 1; j <= n; j++) (S[0][j] = S[0][j - 1] + gp(col(Q, j - 1))), (B[0][j] = 'l');
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
      const d = S[i - 1][j - 1] + cs(col(P, i - 1), col(Q, j - 1));
      const u = S[i - 1][j] + gp(col(P, i - 1));
      const l = S[i][j - 1] + gp(col(Q, j - 1));
      const best = Math.max(d, u, l);
      S[i][j] = best;
      B[i][j] = d === best ? 'd' : u === best ? 'u' : 'l';
    }
    const outP = P.map(() => []), outQ = Q.map(() => []);
    let i = m, j = n;
    while (i > 0 || j > 0) {
      const b = B[i][j];
      if (b === 'd') {
        P.forEach((r, k) => outP[k].unshift(r[i - 1]));
        Q.forEach((r, k) => outQ[k].unshift(r[j - 1]));
        i--;
        j--;
      } else if (b === 'u') {
        P.forEach((r, k) => outP[k].unshift(r[i - 1]));
        Q.forEach((r, k) => outQ[k].unshift('-'));
        i--;
      } else {
        P.forEach((r, k) => outP[k].unshift('-'));
        Q.forEach((r, k) => outQ[k].unshift(r[j - 1]));
        j--;
      }
    }
    return { rows: outP.map((r) => r.join('')).concat(outQ.map((r) => r.join(''))), score: S[m][n] };
  };
  /** progressive alignment along a UPGMA guide tree of (1 - identity) distances */
  A.progressive = (seqs, sc) => {
    const n = seqs.length;
    const ids = A.range(n).map((i) => A.range(n).map((j) => (i === j ? { id: 1 } : null)));
    const D = A.range(n).map(() => new Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const r = A.identity(seqs[i], seqs[j], sc);
      ids[i][j] = ids[j][i] = r;
      D[i][j] = D[j][i] = 1 - r.id;
    }
    const tree = A.upgma(seqs.map((x, i) => String.fromCharCode(97 + i)), D);
    const prof = {};
    seqs.forEach((x, i) => (prof[i] = { rows: [x], members: [i] }));
    const merges = [];
    tree.steps.forEach((st) => {
      const [a, b] = st.join;
      const P = prof[a], Q = prof[b];
      const r = A.profileAlign(P.rows, Q.rows, sc);
      prof[st.node] = { rows: r.rows, members: P.members.concat(Q.members) };
      merges.push({ node: st.node, a, b, inA: P.members, inB: Q.members, rowsA: P.rows, rowsB: Q.rows, rows: r.rows, members: P.members.concat(Q.members) });
    });
    const fin = prof[tree.root];
    // put the rows back in the input order
    const order = fin.members;
    const rows = A.range(n).map((i) => fin.rows[order.indexOf(i)]);
    return { D, ids, tree, merges, rows, sp: A.sumOfPairs(rows, sc) };
  };
  /** star alignment: align every sequence to the centre (the one most similar to all), then merge */
  A.star = (seqs, sc) => {
    const n = seqs.length;
    const S = A.range(n).map(() => new Array(n).fill(0));
    const al = {};
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const r = A.identity(seqs[i], seqs[j], sc);
      S[i][j] = S[j][i] = r.id;
      al[i + ',' + j] = r;
    }
    const sums = S.map((row) => row.reduce((x, y) => x + y, 0));
    const c = sums.indexOf(Math.max(...sums));
    const pairs = [];
    for (let j = 0; j < n; j++) {
      if (j === c) continue;
      const r = A.dp(seqs[c], seqs[j], sc, 'global');
      pairs.push({ j, ac: r.tb.ax, aj: r.tb.ay });
    }
    // merge: walk the centre's letters; the merged centre gets a gap column wherever any pairwise alignment has one
    let merged = { center: '', rows: {} };
    // gaps before each centre letter, per pair
    const gapsBefore = (ac) => {
      const g = new Array(seqs[c].length + 1).fill(0);
      let k = 0;
      for (const ch of ac) ch === '-' ? g[k]++ : k++;
      return g;
    };
    const steps = [];
    let rows = { [c]: '' };
    // merge the first `upto` pairwise alignments: the gap columns are those of the pairs merged so far
    const build = (upto) => {
      const G = A.range(seqs[c].length + 1).map((k) => Math.max(0, ...pairs.slice(0, upto).map((p) => gapsBefore(p.ac)[k])));
      const out = {};
      out[c] = '';
      for (let k = 0; k <= seqs[c].length; k++) {
        out[c] += '-'.repeat(G[k]) + (k < seqs[c].length ? seqs[c][k] : '');
      }
      pairs.slice(0, upto).forEach((p) => {
        // the pair's own gaps are placed first in each block, the rest are new gap columns
        let o = '', ci = 0, pi = 0;
        const g = gapsBefore(p.ac);
        for (let k = 0; k <= seqs[c].length; k++) {
          // the letters of j aligned to the gaps before centre letter k
          let mine = '';
          for (let t = 0; t < g[k]; t++) mine += p.aj[pi++];
          o += mine + '-'.repeat(G[k] - g[k]);
          if (k < seqs[c].length) {
            o += p.aj[pi++];
            ci++;
          }
        }
        out[p.j] = o;
      });
      return out;
    };
    pairs.forEach((p, k) => steps.push({ add: p.j, rows: build(k + 1) }));
    rows = build(pairs.length);
    merged = A.range(n).map((i) => rows[i]);
    return { S, sums, center: c, pairs, steps, rows: merged, sp: A.sumOfPairs(merged, sc) };
  };

  /* ------------------------------------------------------------------
     Read mapping: minimizers, seeds, chains, and the final alignment
     ------------------------------------------------------------------ */
  /**
   * A k-mer's order key. 'abc': alphabetical (easy by hand). 'hash': a scrambled order, as minimap2 uses
   * (so that AAAA… is not always the smallest): the base-4 number multiplied by an odd number, modulo 4^k.
   */
  A.kmerKey = (w, order) => {
    const c = A.kmerCode(w);
    if (order !== 'hash') return c;
    const M = Math.pow(4, w.length);
    return (c * 2654435761) % M;
  };
  /** minimizers: in every window of w consecutive k-mers, the one with the smallest key (the left-most on a tie) */
  A.minimizers = (s, k, w, order) => {
    const km = A.kmers(s, k).map((x) => Object.assign(x, { key: A.kmerKey(x.w, order) }));
    const windows = [];
    const chosen = new Set();
    for (let st = 0; st + w <= km.length; st++) {
      let best = st;
      for (let t = st + 1; t < st + w; t++) if (km[t].key < km[best].key) best = t;
      windows.push({ start: st, min: best, isNew: !chosen.has(best) });
      chosen.add(best);
    }
    return { kmers: km, windows, chosen: Array.from(chosen).sort((a, b) => a - b) };
  };
  /** seeds of a read in a reference: every k-mer (or minimizer) of the read that occurs in the reference */
  A.seeds = (read, ref, k, mode, w, order) => {
    const pick = (s) => (mode === 'minimizer' ? A.minimizers(s, k, w, order).chosen.map((i) => ({ i, w: s.slice(i, i + k) })) : A.kmers(s, k));
    const index = {};
    pick(ref).forEach(({ i, w: x }) => (index[x] = index[x] || []).push(i));
    const anchors = [];
    pick(read).forEach(({ i, w: x }) => (index[x] || []).forEach((r) => anchors.push({ q: i, r, w: x, d: r - i })));
    return { anchors, index, readSeeds: pick(read), refSeeds: pick(ref) };
  };
  /**
   * Chain anchors: a chain is a list of anchors that go forward in both the read and the reference, with
   * nearly the same diagonal. Score: each anchor adds the letters it newly covers (at most k); a change of
   * diagonal (an insertion or deletion) costs its size. Returns the chains, best first.
   */
  A.chainAnchors = (anchors, k, maxShift) => {
    const a = anchors.slice().sort((x, y) => x.r - y.r || x.q - y.q);
    const f = a.map(() => 0), from = a.map(() => -1);
    a.forEach((x, i) => {
      f[i] = k;
      for (let j = 0; j < i; j++) {
        const y = a[j];
        if (y.r >= x.r || y.q >= x.q) continue;
        const shift = Math.abs(x.d - y.d);
        if (shift > maxShift) continue;
        // a tiny bonus per anchor makes a chain take all the anchors it can (coverage alone would tie)
        const gain = Math.min(k, x.q - y.q, x.r - y.r) - shift + 0.001;
        if (f[j] + gain > f[i]) {
          f[i] = f[j] + gain;
          from[i] = j;
        }
      }
    });
    const used = new Set();
    const chains = [];
    a.map((x, i) => i).sort((p, q) => f[q] - f[p]).forEach((i) => {
      if (used.has(i)) return;
      const list = [];
      let t = i;
      while (t >= 0 && !used.has(t)) {
        list.unshift(a[t]);
        used.add(t);
        t = from[t];
      }
      chains.push({ score: Math.floor(f[i] + 1e-9), anchors: list });
    });
    return { sorted: a, chains };
  };
  /** CIGAR of an alignment transcript (M/S → M, I → I, D → D, as SAM files write it) */
  A.cigar = (ops) => {
    const s = ops.replace(/S/g, 'M');
    let out = '', run = 0, cur = '';
    for (const c of s + '#') {
      if (c === cur) run++;
      else {
        if (cur) out += run + cur;
        cur = c;
        run = 1;
      }
    }
    return out;
  };
  /**
   * Map a read: seeds, the best chain, then dynamic programming of the read against the reference around it
   * ('fit': the whole read, anywhere in that stretch). Returns everything, and where the read starts.
   */
  A.mapRead = (read, ref, k, mode, w, order) => {
    const sd = A.seeds(read, ref, k, mode, w, order);
    const ch = A.chainAnchors(sd.anchors, k, 4);
    const best = ch.chains[0] || null;
    let aln = null;
    if (best) {
      const d = best.anchors[0].d;
      const pad = 4;
      const lo = Math.max(0, d - pad), hi = Math.min(ref.length, d + read.length + pad + Math.max(0, best.anchors[best.anchors.length - 1].d - d));
      const win = ref.slice(lo, hi);
      // the read (sequence 1) fitted anywhere in the window (sequence 2): edit distance, the read used whole
      const r = A.dp(read, win, A.scheme('edit'), 'fit');
      // swap the transcript to the read's point of view: a gap in the read is a deletion from it (D), extra letters in the read are insertions (I)
      const ops = r.tb.ops.replace(/[ID]/g, (c) => (c === 'I' ? 'X' : 'Y')).replace(/X/g, 'D').replace(/Y/g, 'I');
      aln = { lo, hi, win, start: lo + r.tb.start[1], edits: r.score, ax: r.tb.ax, ay: r.tb.ay, ops, cigar: A.cigar(ops), res: r };
    }
    return { seeds: sd, chains: ch.chains, best, aln };
  };

  /* ------------------------------------------------------------------
     BLAST (protein): words, neighbourhoods, hits, the two-hit rule, X-drop
     ------------------------------------------------------------------ */
  A.AA = 'ARNDCQEGHILKMFPSTWYV';
  A.wordScore = (a, b) => {
    let s = 0;
    for (let k = 0; k < a.length; k++) s += A.blosum62(a[k], b[k]);
    return s;
  };
  /** every word of length w (3) whose BLOSUM62 score against `word` is at least T, best first */
  A.neighbourhood = (word, T) => {
    const out = [];
    const aa = A.AA;
    for (const a of aa) for (const b of aa) for (const c of aa) {
      const x = a + b + c;
      const sc = A.wordScore(word, x);
      if (sc >= T) out.push({ w: x, s: sc });
    }
    out.sort((p, q) => q.s - p.s || A.cmp(p.w, q.w));
    return out;
  };
  /** the scores of the best words just below the threshold, for showing where it cuts */
  A.nearMisses = (word, T, k) => {
    const out = [];
    const aa = A.AA;
    for (const a of aa) for (const b of aa) for (const c of aa) {
      const x = a + b + c;
      const sc = A.wordScore(word, x);
      if (sc < T && sc >= T - 2) out.push({ w: x, s: sc });
    }
    out.sort((p, q) => q.s - p.s || A.cmp(p.w, q.w));
    return out.slice(0, k || 3);
  };
  /** word hits: subject word j scores at least T against query word i */
  A.blastHits = (q, s, T, w) => {
    w = w || 3;
    const hits = [];
    for (let j = 0; j + w <= s.length; j++) {
      const sw = s.slice(j, j + w);
      for (let i = 0; i + w <= q.length; i++) {
        const sc = A.wordScore(q.slice(i, i + w), sw);
        if (sc >= T) hits.push({ i, j, s: sc, d: j - i });
      }
    }
    return hits;
  };
  /**
   * The two-hit rule: a hit starts an extension only if an earlier hit on the same diagonal ends before it
   * starts and lies within A letters of it. Returns the hits that trigger, each with its partner.
   */
  A.twoHits = (hits, Adist, w) => {
    w = w || 3;
    const byD = {};
    hits.forEach((h) => (byD[h.d] = byD[h.d] || []).push(h));
    const out = [];
    Object.values(byD).forEach((list) => {
      list.sort((a, b) => a.i - b.i);
      for (let k = 1; k < list.length; k++) {
        for (let p = k - 1; p >= 0; p--) {
          const gap = list[k].i - list[p].i;
          if (gap >= w && gap <= Adist) {
            out.push(Object.assign({ partner: list[p] }, list[k]));
            break;
          }
        }
      }
    });
    return out.sort((a, b) => a.j - b.j || a.i - b.i);
  };
  /**
   * Ungapped extension of a word hit along its diagonal, right then left, stopping when the running score
   * falls more than X below the best seen. Returns the best segment and every step, for drawing.
   */
  A.xdrop = (q, s, i, j, w, X) => {
    w = w || 3;
    const seed = A.wordScore(q.slice(i, i + w), s.slice(j, j + w));
    const right = [], left = [];
    let run = seed, best = seed, bestR = 0; // letters added on the right at the best
    for (let k = 0; i + w + k < q.length && j + w + k < s.length; k++) {
      const sc = A.blosum62(q[i + w + k], s[j + w + k]);
      run += sc;
      if (run > best) {
        best = run;
        bestR = k + 1;
      }
      right.push({ qi: i + w + k, sj: j + w + k, sc, run, best });
      if (best - run > X) break;
    }
    run = best;
    let bestL = 0;
    const afterRight = best;
    for (let k = 1; i - k >= 0 && j - k >= 0; k++) {
      const sc = A.blosum62(q[i - k], s[j - k]);
      run += sc;
      if (run > best) {
        best = run;
        bestL = k;
      }
      left.push({ qi: i - k, sj: j - k, sc, run, best });
      if (best - run > X) break;
    }
    const q0 = i - bestL, s0 = j - bestL, len = w + bestL + bestR;
    return { seed, right, left, afterRight, score: best, q0, s0, len, qseg: q.slice(q0, q0 + len), sseg: s.slice(s0, s0 + len) };
  };
  /** Karlin–Altschul statistics: bit score and E-value of a raw score S, query length m, database length n */
  A.blastStats = (S, m, n, lambda, K) => {
    const bits = (lambda * S - Math.log(K)) / Math.LN2;
    const E = K * m * n * Math.exp(-lambda * S);
    return { bits, E };
  };

  /* ------------------------------------------------------------------
     Profiles (position-specific scoring matrices) and hidden Markov models
     ------------------------------------------------------------------ */
  /**
   * The profile of an ungapped block of aligned sequences: for each column the counts and frequencies of
   * the letters, and log-odds scores log2(p / q), where p = (count + pc·q) / (N + pc) adds pseudocounts and
   * q is the background frequency (1/4 for DNA, 1/20 for amino acids). pc = 0: no pseudocounts.
   */
  A.profile = (rows, alphabet, pc) => {
    const N = rows.length, L = rows[0].length;
    const q = 1 / alphabet.length;
    const cols = A.range(L).map((c) => {
      const count = {}, freq = {}, prob = {}, score = {};
      alphabet.split('').forEach((a) => (count[a] = 0));
      rows.forEach((r) => (count[r[c]] = (count[r[c]] || 0) + 1));
      alphabet.split('').forEach((a) => {
        freq[a] = count[a] / N;
        prob[a] = (count[a] + pc * q) / (N + pc);
        score[a] = prob[a] > 0 ? Math.log2(prob[a] / q) : -Infinity;
      });
      return { count, freq, prob, score };
    });
    return { N, L, q, pc, alphabet, cols };
  };
  /** slide a profile along a sequence: each window scores the sum of its letters' scores in their columns */
  A.profileScan = (prof, s) => {
    const out = [];
    for (let w = 0; w + prof.L <= s.length; w++) {
      const parts = A.range(prof.L).map((i) => prof.cols[i].score[s[w + i]]);
      out.push({ w, parts, total: parts.reduce((x, y) => x + y, 0) });
    }
    return out;
  };
  /**
   * A two-state hidden Markov model, the usual textbook example: state + emits C and G more often (as in a
   * CpG island), state − emits A and T more often; each state tends to stay as it is.
   */
  A.HMM_CG = {
    states: ['+', '−'],
    start: { '+': 0.5, '−': 0.5 },
    trans: { '+': { '+': 0.5, '−': 0.5 }, '−': { '+': 0.4, '−': 0.6 } },
    emit: { '+': { A: 0.2, C: 0.3, G: 0.3, T: 0.2 }, '−': { A: 0.3, C: 0.2, G: 0.2, T: 0.3 } }
  };
  /**
   * Viterbi (decoding): the most probable path of hidden states, in log2 probabilities.
   * V[k][0] = log2 start(k) + log2 e_k(x_0);  V[k][i] = log2 e_k(x_i) + max over j of (V[j][i−1] + log2 a(j→k)).
   */
  A.viterbi = (hmm, x) => {
    const S = hmm.states, L = x.length;
    const V = S.map(() => new Array(L).fill(0));
    const P = S.map(() => new Array(L).fill(null));
    const cand = S.map(() => new Array(L).fill(null));
    S.forEach((k, a) => (V[a][0] = Math.log2(hmm.start[k]) + Math.log2(hmm.emit[k][x[0]])));
    for (let i = 1; i < L; i++) {
      S.forEach((k, a) => {
        const c = S.map((j, b) => V[b][i - 1] + Math.log2(hmm.trans[j][k]));
        let best = 0;
        c.forEach((v, b) => {
          if (v > c[best] + 1e-12) best = b;
        });
        cand[a][i] = c;
        P[a][i] = best;
        V[a][i] = c[best] + Math.log2(hmm.emit[k][x[i]]);
      });
    }
    let end = 0;
    S.forEach((_, a) => {
      if (V[a][L - 1] > V[end][L - 1] + 1e-12) end = a;
    });
    const idx = new Array(L);
    let a = end;
    for (let i = L - 1; i >= 0; i--) {
      idx[i] = a;
      if (i > 0) a = P[a][i];
    }
    return { V, P, cand, pathIdx: idx, path: idx.map((b) => S[b]), best: V[end][L - 1], end };
  };
  /** forward (evaluation): the probability of the sequence summed over all paths of hidden states */
  A.forward = (hmm, x) => {
    const S = hmm.states, L = x.length;
    const F = S.map(() => new Array(L).fill(0));
    S.forEach((k, a) => (F[a][0] = hmm.start[k] * hmm.emit[k][x[0]]));
    for (let i = 1; i < L; i++) {
      S.forEach((k, a) => {
        let t = 0;
        S.forEach((j, b) => (t += F[b][i - 1] * hmm.trans[j][k]));
        F[a][i] = t * hmm.emit[k][x[i]];
      });
    }
    return { F, total: S.reduce((t, _, a) => t + F[a][L - 1], 0) };
  };
  /**
   * A profile HMM from a multiple alignment, without pseudocounts. A column is a match column if at least
   * half of its sequences have a letter there (as HMMER's default rule); the others are insert columns. Each sequence is a path: a letter
   * in match column j is emitted by M_j, a gap there is the silent D_j, a letter in an insert column after
   * match column j is emitted by I_j (a gap there is skipped). B (begin) and E (end) emit nothing.
   * Probabilities are counts divided by totals.
   */
  A.phmmBuild = (rows) => {
    const n = rows.length, L = rows[0].length;
    const isMatch = A.range(L).map((c) => rows.filter((r) => r[c] !== '-').length * 2 >= n);
    const matchCols = A.range(L).filter((c) => isMatch[c]);
    const k = matchCols.length;
    const paths = rows.map((r) => {
      const p = [{ s: 'B' }];
      let j = 0;
      for (let c = 0; c < L; c++) {
        if (isMatch[c]) {
          j++;
          p.push(r[c] === '-' ? { s: 'D' + j, col: c } : { s: 'M' + j, col: c, a: r[c] });
        } else if (r[c] !== '-') p.push({ s: 'I' + j, col: c, a: r[c] });
      }
      p.push({ s: 'E' });
      return p;
    });
    const emitN = {}, transN = {};
    paths.forEach((p) =>
      p.forEach((st, t) => {
        if (st.a) {
          emitN[st.s] = emitN[st.s] || {};
          emitN[st.s][st.a] = (emitN[st.s][st.a] || 0) + 1;
        }
        if (t > 0) {
          const f = p[t - 1].s;
          transN[f] = transN[f] || {};
          transN[f][st.s] = (transN[f][st.s] || 0) + 1;
        }
      })
    );
    const norm = (o) => {
      const out = {};
      Object.keys(o).forEach((st) => {
        const tot = Object.values(o[st]).reduce((x, y) => x + y, 0);
        out[st] = {};
        Object.keys(o[st]).forEach((t) => (out[st][t] = o[st][t] / tot));
      });
      return out;
    };
    return { n, k, isMatch, matchCols, paths, emitN, transN, emit: norm(emitN), trans: norm(transN) };
  };
  /**
   * The most probable path of a sequence through a profile HMM (Viterbi), in log2 probabilities.
   * Steps the model has never seen have probability 0 (log −∞); returns null if no path is possible.
   */
  A.phmmViterbi = (m, x) => {
    const L = x.length, k = m.k;
    const lg = (p) => (p > 0 ? Math.log2(p) : -Infinity);
    const tr = (f, t) => lg((m.trans[f] && m.trans[f][t]) || 0);
    const em = (s, a) => lg((m.emit[s] && m.emit[s][a]) || 0);
    const V = {}, B = {};
    const key = (s, i) => s + '@' + i;
    const get = (s, i) => (V[key(s, i)] != null ? V[key(s, i)] : -Infinity);
    V[key('B', 0)] = 0;
    const prevOf = (j) => (j === 0 ? 'B' : 'M' + j);
    const setBest = (s, i, opts, emitLog) => {
      let best = null;
      opts.forEach(([f, fi]) => {
        const v = get(f, fi) + tr(f, s);
        if (v > -Infinity && (!best || v > best.v + 1e-12)) best = { v, f, fi };
      });
      if (best) {
        V[key(s, i)] = best.v + emitLog;
        B[key(s, i)] = [best.f, best.fi];
      }
    };
    for (let i = 0; i <= L; i++) {
      for (let j = 0; j <= k; j++) {
        if (j >= 1 && i >= 1) setBest('M' + j, i, [[prevOf(j - 1), i - 1], ['I' + (j - 1), i - 1], ['D' + (j - 1), i - 1]], em('M' + j, x[i - 1]));
        if (i >= 1) setBest('I' + j, i, [[prevOf(j), i - 1], ['I' + j, i - 1], ['D' + j, i - 1]], em('I' + j, x[i - 1]));
        if (j >= 1) setBest('D' + j, i, [[prevOf(j - 1), i], ['I' + (j - 1), i], ['D' + (j - 1), i]], 0);
      }
    }
    setBest('E', L, [['M' + k, L], ['I' + k, L], ['D' + k, L]], 0);
    if (V[key('E', L)] == null || V[key('E', L)] === -Infinity) return null;
    // trace back
    const path = [];
    let cur = ['E', L];
    while (cur) {
      const [s, i] = cur;
      const emits = s[0] === 'M' || s[0] === 'I';
      path.unshift({ s, i, a: emits ? x[i - 1] : null });
      cur = B[key(s, i)] || null;
    }
    // the factors of the product
    const terms = [];
    for (let t = 1; t < path.length; t++) {
      terms.push({ kind: 't', from: path[t - 1].s, to: path[t].s, p: m.trans[path[t - 1].s][path[t].s] });
      if (path[t].a) terms.push({ kind: 'e', s: path[t].s, a: path[t].a, p: m.emit[path[t].s][path[t].a] });
    }
    const prob = terms.reduce((t, x2) => t * x2.p, 1);
    return { path, terms, log2: V[key('E', L)], prob };
  };

  /* ------------------------------------------------------------------
     Comparing sequences without aligning them: k-mer sets, Jaccard
     similarity, Bloom filters and MinHash
     ------------------------------------------------------------------ */
  /** the distinct k-mers of s, in the order they first appear */
  A.kmerSet = (s, k) => {
    const out = [], seen = new Set();
    for (let i = 0; i + k <= s.length; i++) {
      const w = s.slice(i, i + k);
      if (!seen.has(w)) seen.add(w) && out.push(w);
    }
    return out;
  };
  /** Jaccard similarity of two sets of k-mers: |A ∩ B| / |A ∪ B| */
  A.jaccard = (a, b) => {
    const sa = new Set(a), sb = new Set(b);
    const both = a.filter((x) => sb.has(x)), onlyA = a.filter((x) => !sb.has(x)), onlyB = b.filter((x) => !sa.has(x));
    const union = both.length + onlyA.length + onlyB.length;
    return { both, onlyA, onlyB, union, j: union ? both.length / union : 0 };
  };
  /**
   * Hash functions simple enough to work out by hand: h_i(w) = (a_i × code(w) + b_i) mod M, where code(w)
   * is the k-mer read as a number in base 4 (A 0, C 1, G 2, T 3).
   */
  A.HASH_AB = [[3, 1], [5, 7], [7, 2], [11, 5], [13, 3], [17, 11], [19, 6], [23, 9], [29, 4], [31, 8], [37, 10], [41, 12]];
  A.hashK = (w, i, M) => (A.HASH_AB[i][0] * A.kmerCode(w) + A.HASH_AB[i][1]) % M;
  A.isPrime = (n) => {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
    return true;
  };
  A.primeAbove = (n) => {
    let p = n + 1;
    while (!A.isPrime(p)) p++;
    return p;
  };
  /**
   * A Bloom filter of m bits with nh hash functions: each k-mer of the set sets nh bits; a query is
   * "possibly in the set" if all its bits are set, "definitely not" if any is 0.
   */
  A.bloom = (set, queries, m, nh) => {
    const bits = new Array(m).fill(0);
    const idx = (w) => A.range(nh).map((i) => A.hashK(w, i, m));
    const inserts = set.map((w) => {
      const ix = idx(w);
      const was = ix.map((b) => bits[b]);
      ix.forEach((b) => (bits[b] = 1));
      return { w, code: A.kmerCode(w), ix, was };
    });
    const inSet = new Set(set);
    const checks = queries.map((w) => {
      const ix = idx(w);
      const all = ix.every((b) => bits[b]);
      return { w, code: A.kmerCode(w), ix, all, truth: inSet.has(w), fp: all && !inSet.has(w) };
    });
    const ones = bits.filter(Boolean).length;
    return { m, nh, bits, inserts, checks, ones, fpRate: Math.pow(1 - Math.exp((-nh * set.length) / m), nh) };
  };
  /** MinHash with H hash functions: for each, the smallest hash over each set; the fraction that agree estimates J */
  A.minhash = (a, b, H, M) => {
    const rows = [];
    for (let i = 0; i < H; i++) {
      const ha = a.map((w) => ({ w, v: A.hashK(w, i, M) }));
      const hb = b.map((w) => ({ w, v: A.hashK(w, i, M) }));
      const minA = ha.reduce((x, y) => (y.v < x.v ? y : x));
      const minB = hb.reduce((x, y) => (y.v < x.v ? y : x));
      rows.push({ i, minA, minB, same: minA.v === minB.v });
    }
    const same = rows.filter((r) => r.same).length;
    return { rows, same, est: same / H, j: A.jaccard(a, b).j, M };
  };
  /** a bottom-s sketch (as Mash): one hash function, keep the s smallest values of each set; J from the union sketch */
  A.bottomSketch = (a, b, s, M) => {
    const hv = (w) => A.hashK(w, 0, M);
    const sk = (set) => set.map((w) => ({ w, v: hv(w) })).sort((x, y) => x.v - y.v).slice(0, s);
    const sa = sk(a), sb = sk(b);
    const va = new Set(sa.map((x) => x.v)), vb = new Set(sb.map((x) => x.v));
    const uni = Array.from(new Set(sa.concat(sb).map((x) => x.v))).sort((x, y) => x - y).slice(0, s);
    const shared = uni.filter((v) => va.has(v) && vb.has(v));
    return { sa, sb, uni, shared, est: shared.length / uni.length, j: A.jaccard(a, b).j, M };
  };

  /* ------------------------------------------------------------------
     BLOSUM62 (Henikoff & Henikoff 1992), as distributed with NCBI BLAST
     ------------------------------------------------------------------ */
  const B62_ORDER = 'ARNDCQEGHILKMFPSTWYVBZX*';
  const B62_ROWS = [
    '4 -1 -2 -2 0 -1 -1 0 -2 -1 -1 -1 -1 -2 -1 1 0 -3 -2 0 -2 -1 0 -4',
    '-1 5 0 -2 -3 1 0 -2 0 -3 -2 2 -1 -3 -2 -1 -1 -3 -2 -3 -1 0 -1 -4',
    '-2 0 6 1 -3 0 0 0 1 -3 -3 0 -2 -3 -2 1 0 -4 -2 -3 3 0 -1 -4',
    '-2 -2 1 6 -3 0 2 -1 -1 -3 -4 -1 -3 -3 -1 0 -1 -4 -3 -3 4 1 -1 -4',
    '0 -3 -3 -3 9 -3 -4 -3 -3 -1 -1 -3 -1 -2 -3 -1 -1 -2 -2 -1 -3 -3 -2 -4',
    '-1 1 0 0 -3 5 2 -2 0 -3 -2 1 0 -3 -1 0 -1 -2 -1 -2 0 3 -1 -4',
    '-1 0 0 2 -4 2 5 -2 0 -3 -3 1 -2 -3 -1 0 -1 -3 -2 -2 1 4 -1 -4',
    '0 -2 0 -1 -3 -2 -2 6 -2 -4 -4 -2 -3 -3 -2 0 -2 -2 -3 -3 -1 -2 -1 -4',
    '-2 0 1 -1 -3 0 0 -2 8 -3 -3 -1 -2 -1 -2 -1 -2 -2 2 -3 0 0 -1 -4',
    '-1 -3 -3 -3 -1 -3 -3 -4 -3 4 2 -3 1 0 -3 -2 -1 -3 -1 3 -3 -3 -1 -4',
    '-1 -2 -3 -4 -1 -2 -3 -4 -3 2 4 -2 2 0 -3 -2 -1 -2 -1 1 -4 -3 -1 -4',
    '-1 2 0 -1 -3 1 1 -2 -1 -3 -2 5 -1 -3 -1 0 -1 -3 -2 -2 0 1 -1 -4',
    '-1 -1 -2 -3 -1 0 -2 -3 -2 1 2 -1 5 0 -2 -1 -1 -1 -1 1 -3 -1 -1 -4',
    '-2 -3 -3 -3 -2 -3 -3 -3 -1 0 0 -3 0 6 -4 -2 -2 1 3 -1 -3 -3 -1 -4',
    '-1 -2 -2 -1 -3 -1 -1 -2 -2 -3 -3 -1 -2 -4 7 -1 -1 -4 -3 -2 -2 -1 -2 -4',
    '1 -1 1 0 -1 0 0 0 -1 -2 -2 0 -1 -2 -1 4 1 -3 -2 -2 0 0 0 -4',
    '0 -1 0 -1 -1 -1 -1 -2 -2 -1 -1 -1 -1 -2 -1 1 5 -2 -2 0 -1 -1 0 -4',
    '-3 -3 -4 -4 -2 -2 -3 -2 -2 -3 -2 -3 -1 1 -4 -3 -2 11 2 -3 -4 -3 -2 -4',
    '-2 -2 -2 -3 -2 -1 -2 -3 2 -1 -1 -2 -1 3 -3 -2 -2 2 7 -1 -3 -2 -1 -4',
    '0 -3 -3 -3 -1 -2 -2 -3 -3 3 1 -2 1 -1 -2 -2 0 -3 -1 4 -3 -2 -1 -4',
    '-2 -1 3 4 -3 0 1 -1 0 -3 -4 0 -3 -3 -2 0 -1 -4 -3 -3 4 1 -1 -4',
    '-1 0 0 1 -3 3 4 -2 0 -3 -3 1 -1 -3 -1 0 -1 -3 -2 -2 1 4 -1 -4',
    '0 -1 -1 -1 -2 -1 -1 -1 -1 -1 -1 -1 -1 -1 -2 0 0 -2 -1 -1 -1 -1 -1 -4',
    '-4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 1'
  ];
  const B62 = {};
  B62_ROWS.forEach((row, i) => {
    const vals = row.trim().split(/\s+/).map(Number);
    B62[B62_ORDER[i]] = {};
    vals.forEach((v, j) => (B62[B62_ORDER[i]][B62_ORDER[j]] = v));
  });
  A.BLOSUM62_ORDER = 'ARNDCQEGHILKMFPSTWYV';
  A.blosum62 = (a, b) => {
    const r = B62[a] || B62.X;
    return r[b] != null ? r[b] : r.X;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = A;
  else {
    root.MG = root.MG || {};
    root.MG.algo = A;
  }
})(typeof window !== 'undefined' ? window : globalThis);
