/* =====================================================================
   The visualiser on the right: it plays an algorithm step by step.

   An algorithm ("machine") is registered with MG.viz.define(name, def):
     def.title, def.sub      – the heading
     def.inputs              – the fields of "Change the input": {key, label, type: 'seq' | 'text' | 'number' | 'select',
                               letters (allowed letters, for seq), max, min, options [[value, label]], help}
     def.presets             – {key: {label, input}} – the examples (the first is the default)
     def.code                – lines of pseudo-code; a frame's `line` marks the line that runs
     def.build(input, mode)  – returns {frames, data}; every frame is the whole state after one step:
                               {narr: 'HTML', line, ask?, dwell?, …what the view needs}
                               mode is 'watch' or 'practice'; in practice the frames may ask (see below)
     def.view(stage, data, input) – returns {update(frame, prev, ctx)}, which draws a frame into the stage
                               (ctx.instant: draw without animation; ctx.asking: the frame's question is open)
     def.check(input)        – optional: an error message for an input that cannot be shown
   A frame that asks (practice mode only) has ask = {type, prompt, answer, …}:
     'number'  – a number (answer: a number or a list of right numbers)
     'text'    – a word or sequence (answer: a string or a list; case and spaces do not count)
     'choice'  – buttons (options: [[value, label]], answer: a value)
     'fields'  – several numbers (fields: [{label, answer}])
     'pick'    – click something on the stage: the view marks it with data-pick="id" (answer: an id or a list)
   plus hint (shown after a wrong answer) and explain (shown when it is solved). The frame after it shows the answer.

   Buttons in the instructions: data-viz="machine:preset" (data-viz-mode="practice" to start in "Your turn",
   data-viz-input='{"key":"value"}' for an input of their own). Events for the ticks of tasks:
   viz:load, viz:step, viz:end (the last step was reached), viz:answer, viz:practice (a "Your turn" was finished).
   ===================================================================== */
(function () {
  'use strict';
  const MG = window.MG;
  const { h, esc, bus, store } = MG;
  const V = (MG.viz = MG.viz || {});
  V.machines = {};
  V.define = (name, def) => {
    V.machines[name] = Object.assign({ name }, def);
  };

  const SPEEDS = [
    [0.5, 'Slow'],
    [1, 'Normal'],
    [2, 'Fast'],
    [4, 'Faster']
  ];
  const BASE_MS = 1100;
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let ui = null; // the DOM of the visualiser
  let cur = null; // what is loaded: {name, def, input, preset, mode, frames, data, view, i, stats, reachedEnd}
  let timer = null;
  let speed = store.get('vizSpeed', 1);

  /* ------------------------------------------------------------------
     The frame of the visualiser
     ------------------------------------------------------------------ */
  function mount(root) {
    const btn = (cls, icon, label, title) =>
      h('button.btn.icon-only.' + cls, { type: 'button', 'aria-label': label, title: title || label, html: MG.icon(icon) });
    ui = {};
    ui.root = root;
    ui.title = h('h2.viz-title', 'Visualiser');
    ui.sub = h('div.viz-sub', '');
    ui.preset = h('select.viz-preset', { 'aria-label': 'Example' });
    ui.edit = h('button.btn.small.viz-edit', { type: 'button', html: MG.icon('edit') + '<span>Change the input</span>' });
    ui.modeWatch = h('button.viz-mode-b', { type: 'button', 'data-mode': 'watch', 'aria-pressed': 'true' }, 'Watch');
    ui.modePractice = h('button.viz-mode-b', { type: 'button', 'data-mode': 'practice', 'aria-pressed': 'false' }, 'Your turn');
    ui.mode = h('div.viz-mode', { role: 'group', 'aria-label': 'Watch the algorithm, or do the steps yourself' }, ui.modeWatch, ui.modePractice);
    ui.form = h('form.viz-form', { hidden: true, autocomplete: 'off' });
    ui.stage = h('div.viz-stage', { tabindex: '-1' });
    ui.narr = h('div.viz-narr', { 'aria-live': 'polite' });
    ui.ask = h('div.viz-ask', { hidden: true });
    ui.code = h('pre.viz-code');
    ui.codebox = h('details.viz-codebox', h('summary', 'The algorithm as code'), ui.code);
    ui.first = btn('viz-first', 'first', 'Back to the start');
    ui.prev = btn('viz-prev', 'prev', 'One step back', 'One step back (←)');
    ui.play = btn('viz-play', 'play', 'Play', 'Play / pause (space)');
    ui.next = btn('viz-next', 'next', 'One step on', 'One step on (→)');
    ui.last = btn('viz-last', 'last', 'Jump to the end');
    ui.scrub = h('input.viz-scrub', { type: 'range', min: '0', max: '0', value: '0', 'aria-label': 'Step' });
    ui.count = h('span.viz-count', '');
    ui.speed = h('select.viz-speed', { 'aria-label': 'Speed' }, SPEEDS.map(([v, l]) => h('option', { value: String(v) }, l)));
    ui.speed.value = String(speed);
    ui.score = h('span.viz-score', { hidden: true });
    const ctrl = h('div.viz-ctrl', ui.first, ui.prev, ui.play, ui.next, ui.last, ui.scrub, ui.count, ui.score, ui.speed);
    ui.empty = h('div.viz-empty', { html: '<p><b>Nothing to show yet.</b></p><p>Press a <span class="do">show it</span> button in the instructions: the algorithm opens here, and you can play it, step through it, change its input – or do the steps yourself.</p>' });
    ui.box = h('div.viz', { hidden: true },
      h('div.viz-head', h('div.viz-heading', ui.title, ui.sub), h('div.viz-tools', ui.preset, ui.edit, ui.mode)),
      ui.form,
      ui.stage,
      h('div.viz-bottom', ui.narr, ui.ask, ctrl, ui.codebox));
    root.appendChild(ui.empty);
    root.appendChild(ui.box);

    ui.first.addEventListener('click', () => go(0, true));
    ui.prev.addEventListener('click', () => go(cur.i - 1));
    ui.next.addEventListener('click', () => forward());
    ui.last.addEventListener('click', () => jumpToEnd());
    ui.play.addEventListener('click', () => (timer ? pause() : play()));
    ui.scrub.addEventListener('input', () => go(+ui.scrub.value, true));
    ui.speed.addEventListener('change', () => {
      speed = +ui.speed.value;
      store.set('vizSpeed', speed);
    });
    ui.preset.addEventListener('change', () => {
      if (ui.preset.value === '__custom') return;
      V.load(cur.name, { preset: ui.preset.value, mode: cur.mode });
    });
    ui.edit.addEventListener('click', () => toggleForm());
    [ui.modeWatch, ui.modePractice].forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
    ui.box.addEventListener('keydown', (e) => {
      if (!cur || e.target.closest('input, select, textarea, form, .viz-ask')) return;
      if (e.key === 'ArrowRight') (e.preventDefault(), forward());
      else if (e.key === 'ArrowLeft') (e.preventDefault(), go(cur.i - 1));
      else if (e.key === ' ' && !e.target.closest('button')) (e.preventDefault(), timer ? pause() : play());
      else if (e.key === 'Home') (e.preventDefault(), go(0, true));
      else if (e.key === 'End') (e.preventDefault(), jumpToEnd());
    });
    // a click on something the question asks for
    ui.stage.addEventListener('click', (e) => {
      const t = e.target.closest('[data-pick]');
      if (!t || !cur) return;
      const f = cur.frames[cur.i];
      if (cur.mode !== 'practice' || !f.ask || f.ask.type !== 'pick' || cur.solved[cur.i]) return;
      answer(t.dataset.pick, t);
    });
    window.addEventListener('resize', MG.debounce(() => refit(), 150));
    bus.on('app:bench', (d) => d.name === 'viz' && requestAnimationFrame(() => refit()));
    ui.codebox.open = !!store.get('vizCode', false);
    ui.codebox.addEventListener('toggle', () => {
      store.set('vizCode', ui.codebox.open);
      refit();
    });
  }
  /* The pictures are sized to the stage when they are made: if the stage has changed size since
     (a resize, the panel shown again), make the picture afresh and draw the same step. */
  function stageSize() {
    return [ui.stage.clientWidth, ui.stage.clientHeight];
  }
  function refit() {
    if (!cur || !ui.stage.clientWidth) return;
    const [w, hgt] = stageSize();
    const [w0, h0] = cur.size || [0, 0];
    if (Math.abs(w - w0) < 24 && Math.abs(hgt - h0) < 40) return redraw(true);
    ui.stage.innerHTML = '';
    cur.view = cur.def.view(ui.stage, cur.data, cur.input);
    cur.size = stageSize();
    redraw(true);
  }

  /* ------------------------------------------------------------------
     Loading a machine
     ------------------------------------------------------------------ */
  V.load = (name, opts = {}) => {
    const def = V.machines[name];
    if (!def) {
      console.error('no machine', name);
      return;
    }
    pause();
    const presets = def.presets || {};
    const keys = Object.keys(presets);
    let preset = opts.preset && presets[opts.preset] ? opts.preset : opts.input ? '__custom' : keys[0];
    const input = Object.assign({}, defaults(def), preset !== '__custom' ? presets[preset].input : {}, opts.input || {});
    const mode = opts.mode === 'practice' ? 'practice' : 'watch';
    const err = def.check ? def.check(input) : null;
    if (err) {
      showFormError(err);
      return false;
    }
    let built;
    try {
      built = def.build(input, mode);
    } catch (e) {
      console.error(e);
      showFormError('That input cannot be shown: ' + esc(e.message || e));
      return false;
    }
    cur = { name, def, input, preset, mode, frames: built.frames, data: built.data, i: 0, solved: {}, tries: {}, stats: { asked: 0, first: 0, shown: 0 }, reachedEnd: false };
    cur.frames.forEach((f) => f.ask && cur.stats.asked++);
    ui.score.hidden = true;
    ui.score.textContent = '';
    if (mode === 'practice' && !cur.stats.asked && !opts.quiet) MG.toast('This example has nothing for you to work out – choose another example for “Your turn”, or watch this one.');
    ui.empty.hidden = true;
    ui.box.hidden = false;
    ui.title.textContent = def.title;
    ui.sub.innerHTML = def.sub || '';
    // examples
    ui.preset.innerHTML = '';
    keys.forEach((k) => ui.preset.appendChild(h('option', { value: k }, presets[k].label)));
    if (preset === '__custom') ui.preset.appendChild(h('option', { value: '__custom' }, 'Your own input'));
    ui.preset.value = preset;
    ui.preset.hidden = keys.length < 2 && preset !== '__custom';
    // mode buttons
    ui.modeWatch.setAttribute('aria-pressed', mode === 'watch' ? 'true' : 'false');
    ui.modePractice.setAttribute('aria-pressed', mode === 'practice' ? 'true' : 'false');
    ui.mode.hidden = !def.practice;
    ui.box.classList.toggle('practising', mode === 'practice');
    // code (a machine may show different code for different inputs)
    const code = (def.codeFor && def.codeFor(input)) || def.code || [];
    ui.code.innerHTML = code.map((l, k) => `<span class="cl" data-line="${k}">${esc(l) || ' '}</span>`).join('\n');
    ui.codebox.hidden = !code.length;
    // the form is filled with this input
    fillForm(def, input);
    ui.form.hidden = true;
    ui.edit.classList.remove('on');
    // the view
    ui.stage.innerHTML = '';
    ui.stage.className = 'viz-stage m-' + name;
    cur.view = def.view(ui.stage, cur.data, input);
    cur.size = stageSize();
    ui.scrub.max = String(cur.frames.length - 1);
    store.set('viz', { name, preset, mode, input: preset === '__custom' ? input : null });
    go(0, true, opts.quiet);
    if (!opts.quiet) {
      bus.emit('viz:load', { machine: name, preset, mode });
      if (preset === '__custom') bus.emit('viz:input', { machine: name, input });
      if (MG.app.showWorkbench) MG.app.showWorkbench('viz');
      ui.play.classList.remove('nudge');
      void ui.play.offsetWidth;
      if (mode === 'watch') ui.play.classList.add('nudge');
    }
    return true;
  };

  function defaults(def) {
    const o = {};
    (def.inputs || []).forEach((f) => {
      if (f.default != null) o[f.key] = f.default;
    });
    return o;
  }

  function setMode(mode) {
    if (!cur || mode === cur.mode) return;
    V.load(cur.name, { preset: cur.preset !== '__custom' ? cur.preset : null, input: cur.preset === '__custom' ? cur.input : null, mode });
  }

  /* ------------------------------------------------------------------
     The input form
     ------------------------------------------------------------------ */
  function fillForm(def, input) {
    ui.form.innerHTML = '';
    const fields = def.inputs || [];
    fields.forEach((f) => {
      let inp;
      if (f.type === 'select') {
        inp = h('select', { name: f.key }, (f.options || []).map(([v, l]) => h('option', { value: v }, l)));
        inp.value = input[f.key] != null ? String(input[f.key]) : String((f.options[0] || [''])[0]);
      } else {
        inp = h('input', { name: f.key, type: f.type === 'number' ? 'number' : 'text', spellcheck: 'false', autocapitalize: 'characters' });
        if (f.type === 'number') {
          if (f.min != null) inp.min = f.min;
          if (f.max != null) inp.max = f.max;
          if (f.step != null) inp.step = f.step;
        } else if (f.max) inp.maxLength = f.max + 4;
        inp.value = input[f.key] != null ? String(input[f.key]) : '';
      }
      const lab = h('label.vf', h('span.vf-l', f.label), inp, f.help ? h('span.vf-h', { html: f.help }) : null);
      ui.form.appendChild(lab);
    });
    ui.formErr = h('div.vf-err', { hidden: true, role: 'alert' });
    ui.form.appendChild(ui.formErr);
    ui.form.appendChild(h('div.vf-actions', h('button.btn.primary.small', { type: 'submit' }, 'Show it'), h('button.btn.small', { type: 'button', onclick: () => toggleForm(false) }, 'Cancel')));
    ui.form.onsubmit = (e) => {
      e.preventDefault();
      const input2 = {};
      for (const f of fields) {
        const el = ui.form.elements[f.key];
        let v = el.value;
        if (f.type === 'seq') {
          const raw = String(v).toUpperCase().replace(/\s+/g, '');
          const allowed = f.letters || 'ACGT';
          const bad = raw.replace(new RegExp('[' + allowed.replace(/[$\-]/g, '\\$&') + ']', 'g'), '');
          if (bad) return showFormError(`${esc(f.label)}: only the letters ${esc(allowed.split('').join(' '))} – not ${esc(Array.from(new Set(bad)).join(' '))}.`);
          if (f.min != null && raw.length < f.min) return showFormError(`${esc(f.label)}: at least ${f.min} letters.`);
          if (f.max != null && raw.length > f.max) return showFormError(`${esc(f.label)}: at most ${f.max} letters – the picture would not fit.`);
          v = raw;
        } else if (f.type === 'number') {
          v = Number(v);
          if (!Number.isFinite(v)) return showFormError(`${esc(f.label)}: a number, please.`);
          if (f.min != null && v < f.min) return showFormError(`${esc(f.label)}: at least ${f.min}.`);
          if (f.max != null && v > f.max) return showFormError(`${esc(f.label)}: at most ${f.max}.`);
        } else if (f.type === 'text') {
          v = String(v).trim();
          if (f.max != null && v.length > f.max) return showFormError(`${esc(f.label)}: at most ${f.max} characters.`);
        }
        input2[f.key] = v;
      }
      if (V.load(cur.name, { input: input2, mode: cur.mode }) !== false) toggleForm(false);
    };
  }
  function showFormError(msg) {
    if (!ui || !ui.formErr) return false;
    ui.form.hidden = false;
    ui.formErr.hidden = false;
    ui.formErr.innerHTML = msg;
    return false;
  }
  function toggleForm(on) {
    const show = on != null ? on : ui.form.hidden;
    ui.form.hidden = !show;
    ui.edit.classList.toggle('on', show);
    if (ui.formErr) ui.formErr.hidden = true;
    if (show) {
      pause();
      const first = ui.form.querySelector('input, select');
      if (first) first.focus();
    }
  }

  /* ------------------------------------------------------------------
     Moving through the frames
     ------------------------------------------------------------------ */
  function blockedAt(i) {
    // in "Your turn" a question has to be answered before the next step shows the answer
    const f = cur.frames[i];
    return cur.mode === 'practice' && f && f.ask && !cur.solved[i];
  }
  function forward() {
    if (!cur) return;
    if (blockedAt(cur.i)) {
      flashAsk();
      return;
    }
    go(cur.i + 1);
  }
  function jumpToEnd() {
    if (!cur) return;
    // in "Your turn" the jump stops at the next open question
    let j = cur.i;
    while (j < cur.frames.length - 1 && !blockedAt(j)) j++;
    go(j, true);
  }
  function go(i, instant, quiet) {
    if (!cur) return;
    ui.play.classList.remove('nudge');
    i = Math.max(0, Math.min(cur.frames.length - 1, i));
    // one cannot scrub past an open question
    if (cur.mode === 'practice') {
      for (let k = Math.min(cur.i, i); k < i; k++) {
        if (blockedAt(k)) {
          i = k;
          break;
        }
      }
    }
    const prev = cur.frames[cur.i];
    const back = i < cur.i;
    cur.i = i;
    draw(prev, instant || Math.abs(i - (cur.lastDrawn == null ? i : cur.lastDrawn)) > 1 || reduced(), back, quiet);
    if (i === cur.frames.length - 1 && !cur.reachedEnd && !quiet) {
      cur.reachedEnd = true;
      pause();
      bus.emit('viz:end', { machine: cur.name, preset: cur.preset, mode: cur.mode });
      if (cur.mode === 'practice' && cur.stats.asked) {
        bus.emit('viz:practice', { machine: cur.name, preset: cur.preset, asked: cur.stats.asked, right: cur.stats.first, shown: cur.stats.shown });
        ui.score.hidden = false;
        ui.score.textContent = `${cur.stats.first} of ${cur.stats.asked} right first time`;
      }
    }
    if (i === cur.frames.length - 1) pause();
  }
  function redraw(instant) {
    draw(cur.frames[cur.i], instant, false);
  }
  function draw(prev, instant, back, quiet) {
    landAll();
    const f = cur.frames[cur.i];
    const asking = cur.mode === 'practice' && !!f.ask && !cur.solved[cur.i];
    ui.stage.classList.toggle('instant', !!instant);
    try {
      cur.view.update(f, prev, { instant: !!instant, asking, back, mode: cur.mode, i: cur.i, n: cur.frames.length });
    } catch (e) {
      console.error(e);
    }
    cur.lastDrawn = cur.i;
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => ui.stage.classList.remove('instant')));
    ui.narr.innerHTML = f.narr || '';
    // the line of code
    ui.code.querySelectorAll('.cl.on').forEach((x) => x.classList.remove('on'));
    const lines = f.line == null ? [] : Array.isArray(f.line) ? f.line : [f.line];
    lines.forEach((l) => {
      const el = ui.code.querySelector(`.cl[data-line="${l}"]`);
      if (el) el.classList.add('on');
    });
    // the question
    renderAsk(f, asking);
    ui.scrub.value = String(cur.i);
    ui.count.textContent = `Step ${cur.i + 1} of ${cur.frames.length}`;
    ui.prev.disabled = cur.i === 0;
    ui.first.disabled = cur.i === 0;
    ui.next.disabled = cur.i === cur.frames.length - 1;
    ui.last.disabled = cur.i === cur.frames.length - 1;
    ui.box.classList.toggle('blocked', asking);
    if (!quiet) bus.emit('viz:step', { machine: cur.name, i: cur.i, n: cur.frames.length });
  }

  /* ------------------------------------------------------------------
     Playing
     ------------------------------------------------------------------ */
  function play() {
    if (!cur) return;
    if (cur.i >= cur.frames.length - 1) go(0, true);
    if (blockedAt(cur.i)) {
      flashAsk();
      return;
    }
    ui.play.innerHTML = MG.icon('pause');
    ui.play.setAttribute('aria-label', 'Pause');
    ui.box.classList.add('playing');
    const tick = () => {
      if (!cur) return pause();
      if (blockedAt(cur.i) || cur.i >= cur.frames.length - 1) return pause();
      go(cur.i + 1);
      if (cur.i >= cur.frames.length - 1 || blockedAt(cur.i)) return pause();
      const f = cur.frames[cur.i];
      timer = setTimeout(tick, (BASE_MS * (f.dwell || 1)) / speed);
    };
    timer = setTimeout(tick, (BASE_MS * 0.5) / speed);
  }
  function pause() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (ui) {
      ui.play.innerHTML = MG.icon('play');
      ui.play.setAttribute('aria-label', 'Play');
      ui.box.classList.remove('playing');
    }
  }
  V.pause = pause;
  V.speed = () => speed;

  /* ------------------------------------------------------------------
     "Your turn": the questions
     ------------------------------------------------------------------ */
  function renderAsk(f, asking) {
    ui.ask.innerHTML = '';
    if (cur.mode !== 'practice' || !f.ask) {
      ui.ask.hidden = true;
      return;
    }
    const a = f.ask;
    ui.ask.hidden = false;
    const solved = cur.solved[cur.i];
    const box = h('div.ask-card' + (solved ? '.solved' : ''));
    box.appendChild(h('div.ask-q', { html: '<span class="ask-tag">Your turn</span> ' + a.prompt }));
    const fb = h('div.ask-fb', { 'aria-live': 'polite' });
    if (solved) {
      fb.className = 'ask-fb ok';
      fb.innerHTML = (solved === 'shown' ? 'The answer: ' : '✓ Right. ') + (a.explain || '') ;
      box.appendChild(fb);
      box.appendChild(h('div.ask-row', h('button.btn.primary.small', { type: 'button', onclick: () => go(cur.i + 1) }, 'Next step')));
      ui.ask.appendChild(box);
      return;
    }
    const row = h('div.ask-row');
    let get = null;
    if (a.type === 'number' || a.type === 'text') {
      // a full keyboard: answers may be negative, and phone number pads have no minus key
      const inp = h('input.ask-in', { type: 'text', inputmode: 'text', 'aria-label': 'Your answer', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' });
      inp.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), answer(get(), null)));
      row.appendChild(inp);
      get = () => inp.value;
      setTimeout(() => inp.focus({ preventScroll: true }), 30);
    } else if (a.type === 'fields') {
      const inps = a.fields.map((fl) => {
        const inp = h('input.ask-in.small', { type: 'text', inputmode: 'text', 'aria-label': fl.label, spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' });
        inp.addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), answer(get(), null)));
        row.appendChild(h('label.ask-field', h('span', fl.label), inp));
        return inp;
      });
      get = () => inps.map((i) => i.value);
      setTimeout(() => inps[0] && inps[0].focus({ preventScroll: true }), 30);
    } else if (a.type === 'choice') {
      a.options.forEach(([v, l]) => {
        row.appendChild(h('button.btn.small.ask-opt', { type: 'button', html: l, onclick: (e) => answer(v, e.currentTarget) }));
      });
    } else if (a.type === 'pick') {
      row.appendChild(h('span.ask-pickhint', a.pickHint || 'Click it in the picture above.'));
    }
    if (get) row.appendChild(h('button.btn.primary.small', { type: 'button', onclick: () => answer(get(), null) }, 'Check'));
    row.appendChild(h('button.btn.small.ask-show', { type: 'button', onclick: () => reveal() }, 'Show me'));
    box.appendChild(row);
    box.appendChild(fb);
    ui.fb = fb;
    ui.ask.appendChild(box);
  }
  const normText = (s) => String(s == null ? '' : s).toUpperCase().replace(/[‐-―−]/g, '-').replace(/\s+/g, '');
  /** a typed number: a minus sign of any kind, a decimal comma, or a fraction such as 7/8 */
  function toNumber(s) {
    const t = String(s == null ? '' : s).trim().replace(/[‐-―−]/g, '-').replace(/\s+/g, '').replace(',', '.');
    if (t === '') return NaN;
    const fr = /^(-?[0-9]*\.?[0-9]+)\/([0-9]*\.?[0-9]+)$/.exec(t);
    return fr ? Number(fr[1]) / Number(fr[2]) : Number(t);
  }
  function isRight(a, given) {
    if (a.type === 'number') {
      const v = toNumber(given);
      const ok = (Array.isArray(a.answer) ? a.answer : [a.answer]).map(Number);
      return !Number.isNaN(v) && ok.some((x) => Math.abs(x - v) <= (a.tol || 1e-9));
    }
    if (a.type === 'text') return (Array.isArray(a.answer) ? a.answer : [a.answer]).some((x) => normText(x) === normText(given));
    if (a.type === 'fields') return a.fields.every((fl, k) => !Number.isNaN(toNumber(given[k])) && Math.abs(toNumber(given[k]) - Number(fl.answer)) <= (a.tol || 1e-9));
    if (a.type === 'choice' || a.type === 'pick') return (Array.isArray(a.answer) ? a.answer : [a.answer]).map(String).includes(String(given));
    return false;
  }
  function answer(given, el) {
    const f = cur.frames[cur.i];
    const a = f.ask;
    if (!a || cur.solved[cur.i]) return;
    const ok = isRight(a, given);
    cur.tries[cur.i] = (cur.tries[cur.i] || 0) + 1;
    bus.emit('viz:answer', { machine: cur.name, ok, first: ok && cur.tries[cur.i] === 1 });
    if (ok) {
      if (cur.tries[cur.i] === 1) cur.stats.first++;
      cur.solved[cur.i] = 'right';
      if (el) el.classList.add('pick-right');
      setTimeout(() => go(cur.i + 1), el ? 450 : 250);
      return;
    }
    if (el) {
      el.classList.remove('pick-wrong');
      void el.offsetWidth;
      el.classList.add('pick-wrong');
    }
    if (ui.fb) {
      ui.fb.className = 'ask-fb no';
      const hint = typeof a.hint === 'function' ? a.hint(given) : a.hint;
      ui.fb.innerHTML = '✗ Not quite. ' + (hint || 'Look again, or press <b>Show me</b>.');
    }
  }
  function reveal() {
    cur.solved[cur.i] = 'shown';
    cur.stats.shown++;
    renderAsk(cur.frames[cur.i], false);
    redraw(false);
  }
  function flashAsk() {
    ui.ask.classList.remove('flash');
    void ui.ask.offsetWidth;
    ui.ask.classList.add('flash');
  }

  /* ------------------------------------------------------------------
     Drawing helpers for the machines
     ------------------------------------------------------------------ */
  const LETTER_CLASS = { A: 'bA', C: 'bC', G: 'bG', T: 'bT', U: 'bT', $: 'bS', '-': 'bGap' };
  // amino acids by kind (A C G T are also amino acids – a machine says when its letters are protein)
  const AA_CLASS = {};
  [['AILMFWV', 'pH'], ['KR', 'pP'], ['DE', 'pN'], ['NQST', 'pO'], ['C', 'pC'], ['G', 'pG'], ['P', 'pR'], ['HY', 'pY']].forEach(([ls, k]) => ls.split('').forEach((l) => (AA_CLASS[l] = k)));
  AA_CLASS['-'] = 'bGap';
  V.tileClass = (c, protein) => 'tile ' + ((protein ? AA_CLASS[c] : LETTER_CLASS[c]) || 'bX');
  /** a row of letter tiles */
  V.tiles = (s, cls, protein) => h('div.tiles' + (cls ? '.' + cls : ''), s.split('').map((c) => h('span', { class: V.tileClass(c, protein) }, c)));
  /** keep an element keyed by id inside a parent: create once, then move and restyle */
  V.keyed = (parent, key, make) => {
    let el = parent.querySelector(`:scope > [data-key="${key}"]`);
    if (!el) {
      el = make();
      el.dataset.key = key;
      parent.appendChild(el);
    }
    return el;
  };
  V.seq = (s) => `<code class="seq">${esc(s)}</code>`;
  V.esc = esc;
  /** how long an animation of `ms` (at normal speed) takes now: shorter when played faster, 0 without motion */
  V.dur = (ms, ctx) => (ctx && ctx.instant) || reduced() ? 0 : ms / speed;
  /**
   * A copy of `src` flies to where `dst` is (both inside the stage), then disappears; `dst` is hidden
   * while it flies (pass keep to leave it shown). For letters that move from one place to another.
   */
  V.fly = (src, dst, ctx, opts = {}) => {
    const d = V.dur(opts.ms || 650, ctx);
    if (!src || !dst || !d || !ui || !ui.stage.contains(src) || !ui.stage.contains(dst)) return;
    const st = ui.stage.getBoundingClientRect();
    const a = src.getBoundingClientRect(), b = dst.getBoundingClientRect();
    if (!a.width || !b.width) return;
    const ghost = src.cloneNode(true);
    ghost.classList.add('flying');
    ghost.removeAttribute('data-pick');
    Object.assign(ghost.style, { position: 'absolute', left: a.left - st.left + ui.stage.scrollLeft + 'px', top: a.top - st.top + ui.stage.scrollTop + 'px', width: a.width + 'px', height: a.height + 'px', margin: '0', zIndex: 20, pointerEvents: 'none' });
    ui.stage.appendChild(ghost);
    if (!opts.keep) dst.style.visibility = 'hidden';
    const dx = b.left - a.left, dy = b.top - a.top;
    const lift = opts.arc != null ? opts.arc : Math.min(40, Math.hypot(dx, dy) / 4);
    const anim = ghost.animate(
      [
        { transform: 'translate(0, 0) scale(1)' },
        { transform: `translate(${dx / 2}px, ${dy / 2 - lift}px) scale(1.12)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(${b.width / a.width})` }
      ],
      { duration: d, delay: V.dur(opts.delay || 0, ctx), easing: 'cubic-bezier(0.35, 0.6, 0.25, 1)', fill: 'both' }
    );
    const done = () => {
      ghost.remove();
      dst.style.visibility = '';
    };
    anim.onfinish = done;
    anim.oncancel = done;
    flights.push(anim);
  };
  /** play a keyframe animation on an element (nothing without motion) */
  V.anim = (el, frames, ms, ctx, opts = {}) => {
    const d = V.dur(ms, ctx);
    if (!el || !d || !el.animate) return null;
    const a = el.animate(frames, Object.assign({ duration: d, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'backwards' }, opts, { delay: V.dur(opts.delay || 0, ctx) }));
    flights.push(a);
    return a;
  };
  const flights = [];
  /** stop whatever is still flying (before the next frame is drawn) */
  function landAll() {
    while (flights.length) {
      const a = flights.pop();
      try {
        a.finish();
      } catch (e) {
        /* already gone */
      }
    }
  }

  /* ------------------------------------------------------------------
     Trees (binary search trees, tries, suffix trees, guide trees)
     ------------------------------------------------------------------ */
  /**
   * Lay out a tree: leaves side by side in order, a parent above the middle of its children.
   * nodes: [{id, parent}] (parent null for the root); order: compare two children (default: as given).
   * Returns {pos: {id: [x, depth]}, width: number of leaf columns, depth}.
   */
  V.layoutTree = (nodes, opts = {}) => {
    const kids = {};
    let root = null;
    nodes.forEach((nd) => {
      if (nd.parent == null) root = nd.id;
      else (kids[nd.parent] = kids[nd.parent] || []).push(nd.id);
    });
    if (opts.order) Object.values(kids).forEach((l) => l.sort(opts.order));
    const pos = {};
    let col = 0, maxD = 0;
    const go = (id, d) => {
      maxD = Math.max(maxD, d);
      const ks = kids[id] || [];
      if (!ks.length) {
        pos[id] = [col++, d];
        return;
      }
      ks.forEach((k) => go(k, d + 1));
      pos[id] = [(pos[ks[0]][0] + pos[ks[ks.length - 1]][0]) / 2, d];
    };
    if (root != null) go(root, 0);
    return { pos, width: col, depth: maxD, kids };
  };
  /** a binary search tree: x is the in-order rank of each node (so the values read left to right in order) */
  V.layoutBst = (nodes) => {
    const pos = {};
    let col = 0, maxD = 0;
    const go = (id, d) => {
      if (id == null) return;
      const nd = nodes[id];
      go(nd.left, d + 1);
      pos[id] = [col++, d];
      maxD = Math.max(maxD, d);
      go(nd.right, d + 1);
    };
    if (nodes.length) go(0, 0);
    return { pos, width: col, depth: maxD };
  };
  /**
   * A drawing of a tree whose nodes keep their place from frame to frame and slide when the layout changes.
   * draw(items, ctx): items = [{id, parent, x, y (in px), html, cls, edge (label html), ecls}]
   */
  V.treeView = (parent, opts = {}) => {
    const wrap = h('div.tv');
    parent.appendChild(wrap);
    const els = {};
    function line(x1, y1, x2, y2, el) {
      const len = Math.hypot(x2 - x1, y2 - y1), ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      el.style.left = x1 + 'px';
      el.style.top = y1 + 'px';
      el.style.width = len + 'px';
      el.style.transform = `rotate(${ang}deg)`;
    }
    return {
      el: wrap,
      draw(items, ctx) {
        const seen = new Set();
        const byId = {};
        items.forEach((it) => (byId[it.id] = it));
        let W = 0, H = 0;
        items.forEach((it) => {
          seen.add(it.id);
          let e = els[it.id];
          const fresh = !e;
          if (fresh) {
            e = els[it.id] = { node: h('div.tv-node'), edge: h('div.tv-edge'), lab: h('div.tv-elab') };
            wrap.appendChild(e.edge);
            wrap.appendChild(e.lab);
            wrap.appendChild(e.node);
          }
          const p = it.parent != null ? byId[it.parent] : null;
          // a new node starts at its parent and grows out of it
          if (fresh && p && !ctx.instant) {
            [e.node, e.edge, e.lab].forEach((x) => (x.style.transition = 'none'));
            e.node.style.left = p.x + 'px';
            e.node.style.top = p.y + 'px';
            e.node.style.opacity = '0';
            line(p.x, p.y, p.x, p.y, e.edge);
            e.lab.style.left = p.x + 'px';
            e.lab.style.top = p.y + 'px';
            void e.node.offsetWidth;
            [e.node, e.edge, e.lab].forEach((x) => (x.style.transition = ''));
          } else if (fresh && !p && !ctx.instant) {
            // a new node with nothing above it (a tree built from the leaves up) fades in
            e.node.style.transition = 'none';
            e.node.style.opacity = '0';
            void e.node.offsetWidth;
            e.node.style.transition = '';
          } else if (!fresh && p && e.edge.hidden && !ctx.instant) {
            // an old node gains a parent: its edge grows from it up to the parent
            const ang = (Math.atan2(it.y - p.y, it.x - p.x) * 180) / Math.PI;
            [e.edge, e.lab].forEach((x) => (x.style.transition = 'none'));
            e.edge.hidden = false;
            e.edge.style.left = it.x + 'px';
            e.edge.style.top = it.y + 'px';
            e.edge.style.width = '0px';
            e.edge.style.transform = `rotate(${ang}deg)`;
            e.lab.style.left = it.x + 'px';
            e.lab.style.top = it.y + 'px';
            void e.edge.offsetWidth;
            [e.edge, e.lab].forEach((x) => (x.style.transition = ''));
          }
          e.node.className = 'tv-node' + (it.cls ? ' ' + it.cls : '');
          e.node.innerHTML = it.html;
          if (it.pick) e.node.dataset.pick = it.pick;
          else delete e.node.dataset.pick;
          e.node.style.left = it.x + 'px';
          e.node.style.top = it.y + 'px';
          e.node.style.opacity = '';
          if (p) {
            e.edge.hidden = false;
            e.edge.className = 'tv-edge' + (it.ecls ? ' ' + it.ecls : '');
            line(p.x, p.y, it.x, it.y, e.edge);
            e.lab.hidden = !it.edge;
            e.lab.className = 'tv-elab' + (it.ecls ? ' ' + it.ecls : '');
            e.lab.innerHTML = it.edge || '';
            const f = it.labAt != null ? it.labAt : 0.5;
            e.lab.style.left = p.x + (it.x - p.x) * f + 'px';
            e.lab.style.top = p.y + (it.y - p.y) * f + 'px';
          } else {
            e.edge.hidden = true;
            e.lab.hidden = true;
          }
          W = Math.max(W, it.x);
          H = Math.max(H, it.y);
        });
        Object.keys(els).forEach((id) => {
          if (seen.has(isNaN(+id) ? id : +id) || seen.has(id)) return;
          const e = els[id];
          [e.node, e.edge, e.lab].forEach((x) => x.remove());
          delete els[id];
        });
        wrap.style.width = W + (opts.padX || 40) + 'px';
        wrap.style.height = H + (opts.padY || 40) + 'px';
      },
      node: (id) => els[id] && els[id].node
    };
  };

  /* ------------------------------------------------------------------
     Start: the pane, and the buttons in the instructions
     ------------------------------------------------------------------ */
  V.init = (root) => {
    mount(root);
    MG.actions = MG.actions || {};
    MG.actions.viz = (spec, b) => {
      const [name, preset] = String(spec).split(':');
      let input = null;
      if (b && b.dataset.vizInput) {
        try {
          input = JSON.parse(b.dataset.vizInput);
        } catch (e) {
          input = null;
        }
      }
      V.load(name, { preset: preset || null, input, mode: b && b.dataset.vizMode });
    };
    // what was open last time
    const last = store.get('viz', null);
    if (last && V.machines[last.name]) V.load(last.name, { preset: last.preset !== '__custom' ? last.preset : null, input: last.input || null, mode: last.mode, quiet: true });
  };
  V.current = () => cur;
})();
