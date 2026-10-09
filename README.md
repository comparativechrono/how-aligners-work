# How aligners work

An interactive tutorial on the algorithms inside sequence aligners and read mappers – from binary search and hash tables to the Burrows–Wheeler transform, dynamic programming, BLAST, multiple alignment, hidden Markov models and MinHash.

On the left of the page are the instructions, chapter by chapter, with questions. On the right, each algorithm runs as an animation on short sequences, one step at a time. Students can watch it, change the sequences, or do the steps themselves (**Your turn**): the animation then stops at each step and waits for their answer. The aim is that they can do each algorithm on paper.

The page is self-contained: plain HTML, CSS and JavaScript, with no libraries, fonts or data loaded from elsewhere, and nothing sent anywhere.

## Using it

- **On your own computer:** open `index.html` in a recent Chrome, Edge, Firefox or Safari. No installation and no internet connection are needed. (If a managed computer refuses to run local files, `python3 serve.py` serves the folder at http://localhost:8000.)
- **On the web:** put the whole folder in a GitHub repository and turn on GitHub Pages (Settings → Pages → deploy from the branch, root folder; the `.nojekyll` file is included). Any web server, or a VLE that serves HTML files, works the same way.

Students' ticks and answers are kept in their own browser only (local storage). **My answers** (top right) downloads them as a file – to hand in, or to carry on in another browser.

## The chapters

| | Chapter | Animations | ≈ min |
|---|---|---|---|
| 0 | Start here: the controls, and which algorithms are inside which tools | | 5 |
| 1 | Searching and sorting | linear and binary search; bubble, selection, insertion, merge and quicksort | 30 |
| 2 | Hash tables, recursion and trees | chaining and linear probing of k-mers; binary search trees | 30 |
| 3 | Exact matching | naive search, Knuth–Morris–Pratt, Boyer–Moore, Rabin–Karp | 40 |
| 4 | Tries, suffix trees and suffix arrays | tries, building a suffix tree, searching a suffix array | 35 |
| 5 | The Burrows–Wheeler transform and FM-index (BWA, Bowtie) | the BWT, LF mapping, backward search, locating hits | 45 |
| 6 | Edit distance | dynamic programming, approximate matching, dot plots, recursion with and without a memo | 40 |
| 7 | Global and local alignment | Needleman–Wunsch, Smith–Waterman, BLOSUM62 | 35 |
| 8 | BLAST and FASTA | neighbourhood words, hits, the two-hit rule, X-drop extension, E-values, building BLOSUM | 40 |
| 9 | Read mappers (BWA-MEM, Bowtie 2, minimap2) | minimizers; seed, chain and extend a read | 35 |
| 10 | Multiple alignment (Clustal, MUSCLE, MAFFT) | UPGMA guide trees; star and progressive alignment | 40 |
| 11 | Profiles and hidden Markov models (PSI-BLAST, HMMER, Pfam) | profiles (PSSMs); Viterbi and forward; profile HMMs | 45 |
| 12 | k-mers and sketches (Mash, sourmash, Kraken) | k-mer sets and Jaccard similarity; Bloom filters; MinHash | 35 |
| 13 | Summary | every tool, step by step; a checklist of what to do by hand; glossary | 20 |

In all, about eight hours of work: chapters can be set separately, but each builds on the ones before it.

## Changing it

| To change | Edit | Then |
|---|---|---|
| The title, or whether questions have a **Show answer** button | `assets/js/config.js` | reload the page |
| The text of the chapters, their questions and model answers | `build/chapters.py` (helpers in `build/lib.py`) | `python3 build/make_page.py` (Python 3.8 or later) rewrites `index.html` |
| The examples of an animation | the `presets` of its file, `assets/js/m-*.js` | reload; buttons in the text name them as `machine:example` |
| An algorithm | `assets/js/algos.js` | `node build/tests/check_algos.js` checks the numbers the chapters quote |

The files:

```
index.html              the page (made by build/make_page.py – edit build/chapters.py, not this)
assets/js/algos.js      every algorithm, written to be read; also runs in Node
assets/js/viz.js        the animation player: controls, "Your turn" questions, code panel
assets/js/m-*.js        one file of animations per group of chapters
assets/js/tutorial.js   chapters, tasks, questions, progress and saved answers
assets/js/page-align.js the Score tables tab and the help
assets/css/             app.css (page), viz.css (animations)
build/                  chapters.py, lib.py, template.html, make_page.py, tests/
```

## Accessibility

Every control works from the keyboard; in an animation, ← and → step, Space plays and pauses, Home and End jump to the start and end. If the computer is set to reduce motion, steps change without moving. Colours are never the only sign: letters are always printed, and rings and labels mark what changes.

## Credits

Text, animations and code were written for this course. The BLOSUM62 table is the one distributed with NCBI BLAST (Henikoff and Henikoff, 1992).
