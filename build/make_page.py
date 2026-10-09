"""Write ../index.html: the page shell (template.html) with the chapters (chapters.py) and the
scripts of the animations in it.
Run:  python3 make_page.py"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import chapters

# the scripts of the algorithms ("machines"), in this order
MACHINES = getattr(chapters, 'MACHINES', [])

html = '\n'.join(chapters.ALL())
# the first chapter is visible when the page loads
html = html.replace(' hidden>', '>', 1)
shell = open(os.path.join(HERE, 'template.html'), encoding='utf-8').read()
a = shell.index('<!--CHAPTERS-->') + len('<!--CHAPTERS-->')
b = shell.index('<!--/CHAPTERS-->')
page = shell[:a] + '\n' + html + shell[b:]
js = os.path.join(HERE, '..', 'assets', 'js')
missing = [m for m in MACHINES if not os.path.exists(os.path.join(js, m))]
if missing:
    sys.exit('missing scripts: ' + ', '.join(missing))
page = page.replace('<!--MACHINES-->', '\n'.join(f'<script src="assets/js/{m}"></script>' for m in MACHINES))
open(os.path.join(HERE, '..', 'index.html'), 'w', encoding='utf-8').write(page)
# every task and question needs its own name
for what, pat in (('task', r'data-task="([^"]+)"'), ('question', r'data-q="([^"]+)"'), ('heading', r'<h2 id="([^"]+)"')):
    ids = re.findall(pat, html)
    dup = sorted({x for x in ids if ids.count(x) > 1})
    print(f'{len(ids)} {what}s' + (f' – used twice: {dup}' if dup else ''))
# every button opens a machine and an example that exist
specs = re.findall(r'data-viz="([^"]+)"', html)
print(len(specs), 'animation buttons;', len(MACHINES), 'scripts')
print(len(html), 'bytes of chapters')
