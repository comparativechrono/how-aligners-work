"""Helpers that write the HTML of the instructions (used by chapters.py)."""
import html
import json


def esc(s):
    return html.escape(str(s), quote=True)


def c(s):
    """inline code"""
    return f'<code>{esc(s)}</code>'


def bench(name, label):
    return f'<button class="do showme" type="button" data-bench="{esc(name)}">{label}</button>'


def goto(target, label):
    return f'<button class="do showme" type="button" data-goto="{esc(target)}">{label}</button>'


def task(tid, body, auto=None, check=None):
    a = f' data-auto="{esc(auto)}"' if auto else ''
    k = f' data-check="{esc(check)}"' if check else ''
    return f'<li data-task="{esc(tid)}"{a}{k}>{body}</li>'


def activity(title, tasks, extra=''):
    return f'<div class="activity">\n  <div class="act-t">{title}</div>\n  <ol class="steps">\n    ' + '\n    '.join(tasks) + f'\n  </ol>{extra}\n</div>'


def q(qid, text, model, accept=None, hint=None, placeholder=None):
    a = f' data-accept="{esc(accept)}"' if accept else ''
    h = f' data-hint="{esc(hint)}"' if hint else ''
    p = f' data-placeholder="{esc(placeholder)}"' if placeholder else ''
    return f'<div class="q" data-q="{esc(qid)}"{a}{h}{p}>\n  <div class="q-text">{text}</div>\n  <div class="q-model">{model}</div>\n</div>'


def mcq(qid, text, options, model=None):
    """options: list of (html, correct, why)"""
    labs = ''.join(f'<label{" data-correct" if ok else ""} data-why="{esc(why)}"><input type="radio"> <span>{opt}</span></label>' for opt, ok, why in options)
    m = f'\n  <div class="q-model">{model}</div>' if model else ''
    return f'<div class="q" data-q="{esc(qid)}" data-type="mcq">\n  <div class="q-text">{text}</div>\n  <div class="mcq">{labs}</div>{m}\n</div>'


def callout(kind, title, body):
    return f'<div class="callout {kind}">\n  <div class="co-t">{title}</div>\n  {body}\n</div>'


def chapter(cid, num, title, bench_name, h1, minutes, lede, body):
    t = f'  <div class="meta-row"><span class="pill time">≈ {minutes} min</span></div>\n' if minutes else ''
    return (f'<section class="chapter" id="{cid}" data-num="{num}" data-title="{esc(title)}" data-bench="{bench_name}" hidden>\n'
            f'  <h1>{h1}</h1>\n{t}  <p class="lede">{lede}</p>\n{body}\n</section>\n')


def viz(spec, label='show it', mode=None, inp=None):
    """a button that opens an algorithm on the right: spec is "machine:example";
    mode='practice' opens it in "Your turn"; inp is an input of its own (a dict)"""
    m = f' data-viz-mode="{esc(mode)}"' if mode else ''
    i = f" data-viz-input='{esc(json.dumps(inp))}'" if inp else ''
    return f'<button class="do" type="button" data-viz="{esc(spec)}"{m}{i}>{label}</button>'


def turn(spec, label='your turn'):
    """the same, in "Your turn" (the student does the steps)"""
    return viz(spec, label, mode='practice')


def seq(s):
    """a sequence in the text"""
    return f'<code class="seq">{esc(s)}</code>'


def tiles(s, cls=''):
    """a sequence as small coloured tiles, as in the animations"""
    kinds = {'A': 'bA', 'C': 'bC', 'G': 'bG', 'T': 'bT', '$': 'bS', '-': 'bGap'}
    cells = ''.join(f'<span class="tile {kinds.get(ch, "bX")}">{esc(ch)}</span>' for ch in s)
    return f'<span class="tiles mini{(" " + cls) if cls else ""}">{cells}</span>'


def tools(*items):
    """'In real tools' list: (tool, what it does with this algorithm)"""
    rows = ''.join(f'<tr><th>{t}</th><td>{d}</td></tr>' for t, d in items)
    return f'<table class="table tools">{rows}</table>'


def alnfig(a, b, caption=None, protein=False):
    """two aligned sequences as tiles, with | for a match and · for a substitution"""
    kinds = {'A': 'bA', 'C': 'bC', 'G': 'bG', 'T': 'bT', '$': 'bS', '-': 'bGap'}
    row = lambda s: ''.join(f'<span class="tile {kinds.get(ch, "bX") if not protein else "bX"}">{esc(ch)}</span>' for ch in s)
    mid = ''.join(f'<span>{"|" if x == y else (" " if "-" in (x, y) else "·")}</span>' for x, y in zip(a, b))
    cap = f'<figcaption>{caption}</figcaption>' if caption else ''
    return (f'<figure class="alnfig"><div class="aln mini"><div class="tiles">{row(a)}</div>'
            f'<div class="aln-mid">{mid}</div><div class="tiles">{row(b)}</div></div>{cap}</figure>')


def keypoints(*items):
    lis = ''.join(f'<li>{x}</li>' for x in items)
    return callout('key', 'Key points', f'<ul>{lis}</ul>')


def formula(text):
    return f'<div class="formula">{text}</div>'


AA_KINDS = {'-': 'bGap'}
for _ls, _k in [('AILMFWV', 'pH'), ('KR', 'pP'), ('DE', 'pN'), ('NQST', 'pO'), ('C', 'pC'), ('G', 'pG'), ('P', 'pR'), ('HY', 'pY')]:
    for _l in _ls:
        AA_KINDS[_l] = _k


def msafig(rows, names=None, caption=None, marks=None, protein=False):
    """a multiple alignment as rows of small tiles, with names and (optionally) a row of marks under the columns"""
    kinds = AA_KINDS if protein else {'A': 'bA', 'C': 'bC', 'G': 'bG', 'T': 'bT', '$': 'bS', '-': 'bGap'}
    names = names or [chr(97 + i) for i in range(len(rows))]
    cells = lambda s: ''.join(f'<span class="tile {kinds.get(ch, "bX")}">{esc(ch)}</span>' for ch in s)
    body = ''.join(f'<div class="msaf-row"><span class="msaf-n">{esc(n)}</span><span class="tiles">{cells(r)}</span></div>' for n, r in zip(names, rows))
    if marks:
        body += '<div class="msaf-row"><span class="msaf-n"></span><span class="aln-mid">' + ''.join(f'<span>{esc(m)}</span>' for m in marks) + '</span></div>'
    cap = f'<figcaption>{caption}</figcaption>' if caption else ''
    return f'<figure class="alnfig msafig"><div class="aln">{body}</div>{cap}</figure>'
