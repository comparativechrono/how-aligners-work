/* =====================================================================
   "How aligners work" – page set-up: the visualiser (right), the score
   tables, and the help.
   ===================================================================== */
(function () {
  'use strict';
  const MG = window.MG;
  const { h, esc } = MG;
  const A = MG.algo;
  MG.app = MG.app || {};
  MG.checks = MG.checks || {};

  const page = (MG.page = MG.page || {});
  page.firstBench = 'viz';
  page.resetNote = ' (and which animation was open)';

  page.init = function () {
    MG.viz.init(document.getElementById('vizRoot'));
  };

  page.lazy = {
    tables: (pane) => scoreTables(pane.querySelector('#tablesRoot'))
  };

  /* ------------------------------------------------------------------
     The score tables: BLOSUM62 and two DNA tables, with a
     small calculator that scores two words letter by letter.
     ------------------------------------------------------------------ */
  function scoreTables(root) {
    const order = A.BLOSUM62_ORDER.split('');
    const wrap = h('div.tables');
    root.appendChild(wrap);
    wrap.appendChild(h('h2.tables-h', 'BLOSUM62'));
    wrap.appendChild(h('p.tables-p', { html: 'The score of aligning one amino acid with another (Henikoff &amp; Henikoff, 1992). Positive: the pair is seen in related proteins more often than chance; negative: less often. Point at a cell to see the pair; the diagonal is a match.' }));
    // the scorer
    const w1 = h('input', { type: 'text', value: 'PQG', 'aria-label': 'First word', maxlength: '12', spellcheck: 'false' });
    const w2 = h('input', { type: 'text', value: 'PEG', 'aria-label': 'Second word', maxlength: '12', spellcheck: 'false' });
    const out = h('div.scorer-out', { 'aria-live': 'polite' });
    const scorer = h('div.scorer', h('span.scorer-t', 'Score two words:'), w1, h('span', 'against'), w2, out);
    wrap.appendChild(scorer);
    function score() {
      const a = A.clean(w1.value, A.BLOSUM62_ORDER), b = A.clean(w2.value, A.BLOSUM62_ORDER);
      highlight(null);
      if (!a || !b) {
        out.innerHTML = '<span class="muted">Type two words of amino-acid letters.</span>';
        return;
      }
      const n = Math.min(a.length, b.length);
      const parts = [];
      let total = 0;
      for (let i = 0; i < n; i++) {
        const s = A.blosum62(a[i], b[i]);
        total += s;
        parts.push(`<span class="sc-pair" data-a="${a[i]}" data-b="${b[i]}">${a[i]}–${b[i]} <b>${s < 0 ? '−' + -s : s}</b></span>`);
      }
      out.innerHTML = parts.join(' + ') + ` = <b class="sc-total">${total < 0 ? '−' + -total : total}</b>` + (a.length !== b.length ? ' <span class="muted">(only the first ' + n + ' letters: the words differ in length)</span>' : '');
    }
    w1.addEventListener('input', score);
    w2.addEventListener('input', score);
    out.addEventListener('mouseover', (e) => {
      const p = e.target.closest('.sc-pair');
      highlight(p ? [p.dataset.a, p.dataset.b] : null);
    });
    out.addEventListener('mouseleave', () => highlight(null));
    // the matrix
    const tbl = h('table.b62');
    const head = h('tr', h('th', ''), order.map((c) => h('th', { 'data-col': c }, c)));
    tbl.appendChild(h('thead', head));
    const tb = h('tbody');
    order.forEach((r) => {
      tb.appendChild(h('tr', h('th', { 'data-row': r }, r), order.map((c) => {
        const v = A.blosum62(r, c);
        return h('td', { class: 'v' + (v > 0 ? ' pos' : v < 0 ? ' neg' : ' zero') + (r === c ? ' diag' : ''), 'data-r': r, 'data-c': c, title: `${r}–${c}: ${v}` }, v < 0 ? '−' + -v : String(v));
      })));
    });
    tbl.appendChild(tb);
    const info = h('div.b62-info', { 'aria-live': 'polite' }, ' ');
    wrap.appendChild(h('div.b62-wrap', tbl));
    wrap.appendChild(info);
    function highlight(pair) {
      tbl.querySelectorAll('.hl, .hlx').forEach((e) => e.classList.remove('hl', 'hlx'));
      if (!pair) return;
      const [r, c] = pair;
      tbl.querySelectorAll(`[data-r="${r}"], th[data-row="${r}"]`).forEach((e) => e.classList.add('hl'));
      tbl.querySelectorAll(`[data-c="${c}"], th[data-col="${c}"]`).forEach((e) => e.classList.add('hl'));
      const cell = tbl.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
      if (cell) cell.classList.add('hlx');
    }
    tbl.addEventListener('mouseover', (e) => {
      const td = e.target.closest('td');
      if (!td) return;
      highlight([td.dataset.r, td.dataset.c]);
      const v = A.blosum62(td.dataset.r, td.dataset.c);
      info.innerHTML = `${esc(AA[td.dataset.r] || td.dataset.r)} with ${esc(AA[td.dataset.c] || td.dataset.c)}: <b>${v < 0 ? '−' + -v : v}</b>`;
    });
    tbl.addEventListener('mouseleave', () => highlight(null));
    score();
    // two DNA tables
    wrap.appendChild(h('h2.tables-h', 'DNA'));
    wrap.appendChild(h('p.tables-p', { html: 'Transitions (A↔G, C↔T: purine to purine, pyrimidine to pyrimidine) happen more often than transversions, so they cost less (or score more). Two tables for DNA:' }));
    const dna = 'ACGT'.split('');
    const mk = (title, f, gap, note) => {
      const t = h('table.b62.dna');
      t.appendChild(h('thead', h('tr', h('th', ''), dna.map((c) => h('th', c)))));
      t.appendChild(h('tbody', dna.map((r) => h('tr', h('th', r), dna.map((c) => {
        const v = f(r, c);
        return h('td', { class: 'v' + (r === c ? ' diag' : '') }, v < 0 ? '−' + -v : String(v));
      })))));
      return h('div.dna-t', h('div.dna-title', title), t, h('div.dna-gap', { html: gap }), note ? h('div.dna-note', note) : null);
    };
    wrap.appendChild(h('div.dna-row',
      mk('Penalties (smaller is better)', (a, b) => A.schemes.penalty.sub(a, b), 'gap: 8'),
      mk('Scores (larger is better)', (a, b) => A.schemes.dna.sub(a, b), 'gap: −7')));
  }
  const AA = { A: 'Ala (A)', R: 'Arg (R)', N: 'Asn (N)', D: 'Asp (D)', C: 'Cys (C)', Q: 'Gln (Q)', E: 'Glu (E)', G: 'Gly (G)', H: 'His (H)', I: 'Ile (I)', L: 'Leu (L)', K: 'Lys (K)', M: 'Met (M)', F: 'Phe (F)', P: 'Pro (P)', S: 'Ser (S)', T: 'Thr (T)', W: 'Trp (W)', Y: 'Tyr (Y)', V: 'Val (V)' };

  /* ------------------------------------------------------------------
     Help
     ------------------------------------------------------------------ */
  page.help = function () {
    MG.modal(
      'How this page works',
      `<ul>
<li><b>Instructions</b> are on the left, the <b>animations</b> on the right. Drag the divider to resize.</li>
<li>A <span class="do">show it</span> button in the instructions opens an algorithm on the right, with an example.</li>
<li><b>Play</b> runs it step by step; <b>◀ ▶</b> (or the arrow keys) go one step back or on; the slider jumps anywhere. <b>Speed</b> sets how fast it plays.</li>
<li>Each step is explained under the picture. <b>The algorithm as code</b> shows the lines that run in that step.</li>
<li><b>Change the input</b> runs the same algorithm on sequences of your own; the list next to it has more examples.</li>
<li><b>Your turn</b>: you do the steps – the animation stops at each question and goes on when you answer. <b>Show me</b> gives the answer.</li>
<li><b>Score tables</b> (tab on the right): BLOSUM62 and the DNA tables, for working by hand.</li>
<li><b>Saved in this browser:</b> your ticks and answers. <b>My answers</b> downloads them, or saves all your work to a file for another computer. To start again: <b>My answers → Start again</b>.</li>
</ul>`
    );
  };
})();
