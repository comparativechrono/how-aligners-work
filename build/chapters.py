"""The chapters of "How aligners work".

Every number in the text and every answer that is checked comes from the algorithms in
../assets/js/algos.js; tests/check_algos.js checks the numbers quoted here
(node build/tests/check_algos.js). If an example changes, run it again."""
from lib import *

# the scripts of the animations, in the order they are loaded
MACHINES = ['m-basics.js', 'm-match.js', 'm-index.js', 'm-bwt.js', 'm-dp.js', 'm-blast.js', 'm-map.js', 'm-msa.js', 'm-hmm.js', 'm-kmer.js']

# answers that are checked (kept out of the f-strings: a backslash may not appear in an f-string expression before Python 3.12)
RANGE = r'(\s*(-|–|—|to|and|,|\.\.|…)\s*|\s+)'
RE_RANGE_56 = '^(rows? )?5' + RANGE + '6$'
RE_RANGE_12 = '^(rows? )?1' + RANGE + '2$'
RE_BWT_GATTACA = r"^actga\$ta$"
RE_BWT_CATCAT = r"^tcct\$aa$"
RE_BWT_ACACAC = r"^ccc\$aaa$"
RE_AGTAGT = r"^agtagt\$?$"
F_LF = "LF(c, k) = C[c] + k\nC[c]: how many letters of the text are smaller than c\nk: which c of L it is, counting from 0"
RE_MINIMIZER_FRACTION = r"^(about |~ ?|≈ ?)?(2 ?/ ?11|0?[.,]18[0-9]*|18([.,][0-9]+)? ?%|0?[.,]2|1 ?/ ?5|20 ?%)$"
RE_1024 = r"^(about |~ ?)?(1024|1 024|1,024|2 ?\^ ?10|2¹⁰|1000)( times)?$"
F_BACKWARD = "top    = C[b] + Occ(b, top)\nbottom = C[b] + Occ(b, bottom)\nOcc(b, i) = how many b's are in L above row i"
F_EDIT = "D[i][j] = min( D[i-1][j-1] + cost,    ↖ match or substitution\n               D[i-1][j]   + 1,       ↑ gap in sequence 2\n               D[i][j-1]   + 1 )      ← gap in sequence 1\ncost = 0 if x[i-1] == y[j-1], else 1\nD[i][0] = i,  D[0][j] = j"
MINIMAT_GAT = '<pre class="minimat">   ε  G  C  A  T\nε  0  1  2  3  4\nG  1  0  1  2  3\nA  2  1  1  1  2\nT  3  2  2  2  1</pre>'
F_NW = "S[i][j] = max( S[i-1][j-1] + s(x[i-1], y[j-1]),   ↖\n               S[i-1][j]   + gap,                ↑\n               S[i][j-1]   + gap )               ←\nhere: match +1, transition −1, transversion −3, gap −7"


# ======================================================================
# 0. Start here
# ======================================================================
def ch_start():
    body = f'''
<h2 id="s-page">This page</h2>
<p>On the left, the instructions: chapter by chapter, from the basic algorithms to the ones inside the tools you use. On the right, the <b>animation</b> of the algorithm you are reading about. A button like {viz('dp:tiny', 'show it')} opens an algorithm on the right with an example, ready to play.</p>
<p>Each animation can be played, stepped through, run on sequences of your own (<b>Change the input</b>), or done by you (<b>Your turn</b>): the animation then stops at every step and waits for your answer. The aim is that you can do each algorithm on paper, on a short sequence, without help.</p>

{activity("Try the controls", [
    task("s-open", f'Open an example: {viz("dp:tiny")} – the edit distance between two short sequences (chapter 6 explains it).', auto="viz:load machine=dp"),
    task("s-play", 'Press <b>▶</b> (Play). Each step is explained under the picture. Use <b>◀</b> and <b>▶</b> next to it, or the <kbd>←</kbd> <kbd>→</kbd> keys, to go one step at a time; <b>Speed</b> sets how fast it plays. Go to the last step.', auto="viz:end machine=dp"),
    task("s-code", 'Open <b>The algorithm as code</b> under the controls: the highlighted line is the one that ran in this step. Step back and forth and watch it move.'),
    task("s-turn", 'Press <b>Your turn</b> (top right of the animation) and do the steps yourself. Each cell asks for a number: the smallest of the three candidates shown next to the matrix. <b>Show me</b> gives the answer if you are stuck.', auto="viz:practice machine=dp"),
])}

<h2 id="s-map">Algorithms inside the tools</h2>
<p>Each tool below is a few of these algorithms put together. The chapters build up to them: first the basic ideas (searching, sorting, hashing, trees), then exact matching, then alignment with errors.</p>
<table class="table mapt">
<tr><th>Tool</th><th>Job</th><th>Algorithms inside (chapter)</th></tr>
<tr><td>grep, Python’s <code>re</code>, motif scanners</td><td>Find a pattern exactly</td><td>Naive search, Knuth–Morris–Pratt, Boyer–Moore (3)</td></tr>
<tr><td><b>BWA</b>, <b>Bowtie</b>, <b>Bowtie 2</b>, HISAT2</td><td>Map short reads to a genome</td><td>Suffix arrays (4), the Burrows–Wheeler transform and FM-index (5), dynamic programming (6, 7)</td></tr>
<tr><td><b>minimap2</b></td><td>Map long and short reads, align genomes</td><td>Hash tables (2), minimizers and chaining (9), dynamic programming (6, 7)</td></tr>
<tr><td><b>BLAST</b>, FASTA</td><td>Search a database for similar sequences</td><td>Words and hash tables (2, 8), substitution matrices and extension (7, 8), E-values (8)</td></tr>
<tr><td>EMBOSS <b>needle</b> and <b>water</b></td><td>Align two sequences</td><td>Needleman–Wunsch and Smith–Waterman (7)</td></tr>
<tr><td><b>Clustal Omega</b>, MUSCLE, MAFFT</td><td>Align many sequences</td><td>Guide trees, progressive alignment, profiles (10)</td></tr>
<tr><td><b>HMMER</b>, Pfam</td><td>Find protein families and domains</td><td>Profile hidden Markov models (11)</td></tr>
<tr><td>Mash, sourmash</td><td>Compare genomes without aligning them</td><td>k-mers and MinHash (12)</td></tr>
</table>
<p>Chapter 13 has the same map, with a button for each step, and a checklist of what you can do by hand at the end.</p>

<h2 id="s-conv">How the animations show things</h2>
<ul>
<li>Positions in a sequence count from <b>0</b>, as in Python: the first letter is at position 0. Columns of an alignment or a profile, and the steps of an algorithm, are numbered from 1.</li>
<li>Each base has its colour: {tiles("ACGT")}. The {tiles("$")} marks the end of a text (chapter 5).</li>
<li>In a matrix, sequence 1 runs down the side and sequence 2 across the top.</li>
<li>Whatever is being looked at in a step has a <b>blue ring</b>; in <b>Your turn</b>, what you can click has an <b>orange</b> one.</li>
</ul>

{mcq("s-q1", "A human genome has about 3.1 billion bases. To look for one 100-base read by comparing it, letter by letter, with every position of the genome, roughly how many letter comparisons are needed in the worst case?", [
    ("About 3 × 10<sup>9</sup>", False, "That is the number of positions – each needs up to 100 comparisons."),
    ("About 3 × 10<sup>11</sup>", True, "3.1 × 10⁹ positions × 100 letters. For a run of 100 million reads that is 3 × 10¹⁹ – which is why mappers build an index of the genome first (chapters 4, 5 and 9)."),
    ("About 3 × 10<sup>15</sup>", False, "Too many: 3.1 × 10⁹ positions × 100 letters each."),
])}

<h2 id="s-name">Your answers</h2>
<p>Your ticks and answers are saved in this browser. <b>My answers</b> (top right) downloads them as a file, or saves all your work to continue on another computer. Put your name on the file:</p>
<div class="name-field"><label for="studentName"><b>Your name</b></label> <input id="studentName" type="text" data-student-name autocomplete="name" placeholder="Name (optional)"></div>
'''
    return chapter('start', 0, 'Start here', 'viz', 'How aligners work', 5,
                   'BWA, BLAST and Clustal are programs built from algorithms that work on letters. Here you watch those algorithms run, one step at a time, on sequences short enough to follow – then change the sequences, and do the steps yourself until you can do them on paper.', body)


# ======================================================================
# 5. The Burrows–Wheeler transform and the FM-index
# ======================================================================
def ch_bwt():
    body = f'''
<h2 id="b-why">Why not search the genome itself?</h2>
<p>A sequencing run gives some 100 million reads of 100–150 bases; a human genome has 3.1 billion. Comparing every read with every position letter by letter would take about 3 × 10<sup>19</sup> comparisons. Mappers therefore build an <b>index</b> of the genome once, and look each read up in it.</p>
<p>A suffix array (chapter 4) is such an index, but it stores one number per position – for the human genome, with 4 bytes per number, more than 12 GB. The <b>Burrows–Wheeler transform</b> (BWT) with the <b>FM-index</b> does the same job in a fraction of the memory: Bowtie’s index of the human genome is about 2.2 GB, and the program needs about 1.3 GB of memory while it maps (Langmead et al., 2009). BWA, Bowtie, Bowtie 2 and HISAT2 are all built on it.</p>
{callout("concept", "Four steps", """<ol class="plain">
<li><b>Build</b> the BWT: rotate, sort, read the last column.</li>
<li><b>Turn it back</b> into the text: LF mapping – the reason the BWT can be searched at all.</li>
<li><b>Search</b> it for a read: backward search, one letter at a time.</li>
<li><b>Locate</b> the matches in the text: the suffix array.</li></ol>""")}

<h2 id="b-build">1. Build the BWT</h2>
<ol class="plain">
<li>Add a <b>$</b> to the end of the text. The $ occurs only once and sorts <b>before</b> A, C, G and T.</li>
<li>Write every <b>rotation</b> of the text: move the first character to the end, again and again. A text of n characters (with its $) has n rotations.</li>
<li><b>Sort</b> the rotations alphabetically, as in a dictionary, and read the <b>last column</b> from top to bottom. That column is the BWT.</li>
</ol>
<p>For {seq("ATAATA")}: the text with its $ is {tiles("ATAATA$")}, and its BWT is {tiles("ATTA$AA")}.</p>

{activity("Watch it", [
    task("b-w1", f'Open {viz("bwt:ataata")} – the BWT of ATAATA – and play it to the end. Watch the rows move as they are sorted: rows that are still tied share a colour, and the underlined letters are the ones compared so far.', auto="viz:end machine=bwt"),
    task("b-w2", 'Choose <b>GATTACA</b> in the list of examples (top right of the animation) and play it.', auto="viz:end machine=bwt preset=gattaca"),
])}

{mcq("b-q1", "Why is the $ added to the text?", [
    ("To mark the end: as a unique character that sorts first, it makes every rotation different and puts the rotations in the order of the suffixes of the text", True, "With the $, the sorted rows are the sorted suffixes of the text (each followed by the rest of the rotation) – this is what makes the BWT reversible and searchable."),
    ("To make the text easier to compress", False, "The compression comes from the sorting, which brings equal letters together."),
    ("Because A, C, G and T cannot be sorted without it", False, "They can – but two rotations of a repetitive text could then be identical, and the order of the suffixes would be lost."),
])}
{q("b-q2", "What is the BWT of GATTACA (with its $)?", "<p><code>ACTGA$TA</code>. The sorted rotations start with $GATTACA, A$GATTAC, ACA$GATT, ATTACA$G, CA$GATTA, GATTACA$, TACA$GAT, TTACA$GA – their last letters, top to bottom.</p>", accept=RE_BWT_GATTACA, hint="Read the last column of the sorted rotations, top to bottom (8 characters, with the $).")}
{q("b-q3", "The last step of the animation shows numbers on the left of the rows: where each rotation starts in the text. These numbers, read from top to bottom in the order of the sorted rows, are the <b>suffix array</b>. How is the BWT letter of a row related to its number?", "<p>The BWT letter of a row is the character just <b>before</b> the position where the row starts: BWT[i] = text[SA[i] − 1], and $ for the row that starts at 0. So the BWT can be read straight off a suffix array – which is how programs actually build it (sorting all rotations would take too much memory).</p>")}

{activity("Your turn", [
    task("b-p1", f'Open {turn("bwt:ataata")}. Sort the rotations yourself: click the rotation that comes next, row by row. Then type the BWT.', auto="viz:practice machine=bwt"),
    task("b-p2", 'On paper: build the BWT of <b>CATCAT</b>. Write its 7 rotations, sort them, read the last column, and type it in the question below.'),
    task("b-p3", 'Check your answer in the animation: <b>Change the input</b> → Text: <code>CATCAT</code> → <b>Show it</b>.', auto="viz:input machine=bwt"),
])}
{q("b-q4", "The BWT of CATCAT:", "<p><code>TCCT$AA</code>. Sorted rotations: $CATCAT, AT$CATC, ATCAT$C, CAT$CAT, CATCAT$, T$CATCA, TCAT$CA.</p>", accept=RE_BWT_CATCAT, hint="7 rotations: CATCAT$, ATCAT$C, TCAT$CA … The $ sorts first.")}

<h2 id="b-runs">Runs of equal letters</h2>
<p>Burrows and Wheeler invented the transform in 1994 to <b>compress</b> text – it is at the heart of the bzip2 program. Rows that begin with the same letters are sorted next to each other, and in a text with repeats they are often preceded by the same letter: the BWT has <b>runs</b> of equal letters, which are easy to compress. Genomes are full of repeats (about half of the human genome).</p>
{activity("Watch it", [
    task("b-r1", f'Open {viz("bwt:repeats")} – the BWT of a repeat, ACACAC.', auto="viz:end machine=bwt preset=repeats"),
])}
{q("b-q5", "What is the BWT of ACACAC?", "<p><code>CCC$AAA</code>: every C comes just after an A, so the three rows that start with C all have A in L (AAA at the end); the rows that start with $ or A have C in L – except the whole text, ACACAC$, whose L is $. The letters come out in runs.</p>", accept=RE_BWT_ACACAC, hint="Play the example to the end, or build it on paper: 7 rotations.")}

<h2 id="b-lf">2. Turn it back: LF mapping</h2>
<p>Nothing is lost in the BWT: the text can be read back from the last column alone. Two facts make it work.</p>
<ol class="plain">
<li>The <b>first column</b> (F) is the BWT sorted: just put its letters in order.</li>
<li><b>LF mapping</b>: the k-th A in the last column (L) is the <i>same</i> A of the text as the k-th A in the first column (F) – and so for every letter. Both lists of A’s are in the same order, because both are sorted by the text that follows each A.</li>
</ol>
<p>So start at the row whose F is $ (row 0): its L is the last letter of the text. Find that letter in F (LF mapping): the L of that row is the letter before it. Repeat, and the text appears from right to left. Where is the k-th c of L in F? In row</p>
{formula(F_LF)}
{activity("Watch it", [
    task("b-l1", f'Open {viz("lf:ataata")} and play it. The small numbers count each letter in its column, from 0 (A<sub>0</sub>, A<sub>1</sub> …). They are not stored: the rank of a letter of L is counted when it is needed (Occ).', auto="viz:end machine=lf"),
])}
{activity("Your turn", [
    task("b-l2", f'Open {turn("lf:ataata")} and click the row of F that each letter maps to.', auto="viz:practice machine=lf"),
])}
{q("b-q6", "On paper: the BWT of a text is <code>TT$AAGG</code>. What is the text?", "<p><code>AGTAGT</code>. F = $AAGGTT. Row 0: L = T, the last letter; it is the first T of L, so it is row C[T] + 0 = 5 of F. Row 5: L = G … and so on: T, G, A, T, G, A read backwards.</p>", accept=RE_AGTAGT, hint="F = $AAGGTT. Start at row 0: L[0] = T is the last letter of the text. Which row of F holds that T?")}
{q("b-q7", "Why must the A’s of L and the A’s of F be in the same order? Use ATAATA to explain.", "<p>The rows are sorted by their whole text. Take the rows that <i>end</i> with A (the A’s in L): each row is that A’s rotation shifted by one, so the text that follows each A is the beginning of its row. Sorting the rows sorts these A’s by what follows them. The rows that <i>start</i> with A (the A’s in F) are sorted by what follows the A as well – the same order. In ATAATA, the A’s of L (rows 0, 3, 5, 6) and of F (rows 1–4) are each in the order A$…, AATA$…, ATA$…, ATAATA$.</p>")}

<h2 id="b-search">3. Search it: backward search</h2>
<p>Each row of the sorted matrix starts with a suffix of the text, so the rows that start with a pattern P are next to each other: a <b>range</b> of rows. Backward search finds that range one letter of P at a time, from its <b>last</b> letter to its first.</p>
<ol class="plain">
<li>The last letter c of P: the rows that start with c are the c-block of F.</li>
<li>The next letter to the left, b: among the rows of the range, those with b in L are the places where b comes just before what has been matched. LF mapping takes them to the rows that start with b + what has been matched – again a range.</li>
<li>Repeat until P is used up. If the range becomes empty, P is not in the text – often found out long before the end of P.</li>
</ol>
{formula(F_BACKWARD)}
<p>The range runs from row <i>top</i> to row <i>bottom − 1</i>. C and Occ are the <b>FM-index</b> (Ferragina and Manzini, 2000). Each step takes the same short time however long the genome is: a read of 100 bases needs 100 steps, whether the genome has a thousand letters or three billion.</p>
{activity("Watch it", [
    task("b-s1", f'Open {viz("fm:ataata")} – ATA in ATAATA. Watch the blue bracket (the range) and the two Occ numbers used at each step.', auto="viz:end machine=fm"),
    task("b-s2", f'Open {viz("fm:absent")} – a pattern that is not there. At which letter does the search stop?', auto="viz:end machine=fm preset=absent"),
])}
{activity("Your turn", [
    task("b-s3", f'Open {turn("fm:ataata")} and give the new range at each step.', auto="viz:practice machine=fm"),
])}
<p>On paper: search <b>AT</b> in CATCAT. Its BWT is {tiles("TCCT$AA")}, F is {tiles("$AACCTT")}, and C is: $ 0, A 1, C 3, T 5.</p>
{q("b-q8", "First step, the last letter T: which rows start with T? (first – last)", "<p>Rows 5–6: C[T] = 5, and there are two T’s.</p>", accept=RE_RANGE_56, hint="The T block of F starts at C[T] = 5; how many T's are there?")}
{q("b-q9", "Second step, A: which rows start with AT?", "<p>Rows 1–2: top = C[A] + Occ(A, 5) = 1 + 0 = 1; bottom = C[A] + Occ(A, 7) = 1 + 2 = 3, so rows 1 to 2. AT occurs twice.</p>", accept=RE_RANGE_12, hint="top = C[A] + Occ(A, 5) and bottom = C[A] + Occ(A, 7): count the A's of L = TCCT$AA above row 5 and above row 7.")}
{q("b-q10", "Why is it useful for a mapper that backward search can stop before the end of the pattern?", "<p>Most places in a genome do not match a read: the search for a read (or a seed) that is not there ends as soon as the range is empty, after a few letters – the mapper does not waste time on it. And the work for a read that is there grows with the length of the read, not of the genome.</p>")}

<h2 id="b-where">4. Where in the text? The suffix array</h2>
<p>The range says <i>how many</i> times the pattern occurs; the suffix-array values of its rows say <i>where</i>. Keeping the whole suffix array would undo the savings, so an FM-index keeps only a <b>sample</b> – say every 32nd value. For a row without a value, LF steps walk one letter to the left in the text at a time, until a row with a value is reached; the position is that value plus the number of steps.</p>
{activity("Watch it", [
    task("b-x1", f'Open {viz("fm:sample")} – here only the suffix-array values that are multiples of 3 are kept (the hatched cells are missing).', auto="viz:end machine=fm preset=sample"),
])}
{mcq("b-q11", "A row of the range has no suffix-array value. Two LF steps lead to a row whose value is 9. Where does the match start?", [
    ("At 7", False, "Each LF step goes one letter to the <i>left</i> in the text, so the starting row is to the right of 9."),
    ("At 9", False, "9 is where the row reached after two steps starts."),
    ("At 11", True, "Each LF step goes one letter to the left, so the row you started from begins 2 letters after 9: 9 + 2 = 11."),
])}

<h2 id="b-tools">In BWA and Bowtie</h2>
{tools(
    ("<code>bwa index</code>, <code>bowtie2-build</code>", "Build the BWT of the genome, the counts (C and checkpoints of Occ) and a sampled suffix array. Done once per genome."),
    ("BWA-backtrack (<code>bwa aln</code>, reads up to about 100 bp)", "Backward search of the whole read. Where the range becomes empty, it backtracks and tries another letter, so a few mismatches and gaps are allowed (Li and Durbin, 2009)."),
    ("Bowtie", "Backward search with <i>quality-aware</i> backtracking: substitutions are tried first at bases of low quality. Two indexes – of the genome and of the genome reversed (the “mirror” index) – limit the backtracking."),
    ("BWA-MEM (<code>bwa mem</code>, 70 bp to 1 Mbp)", "Finds the longest exact matches between the read and the genome with the FM-index (SMEMs, at least 19 bases by default), groups nearby ones into chains, and extends them by Smith–Waterman alignment in a band (chapter 7)."),
    ("Bowtie 2", "Cuts the read into seeds (22 bases each in the default mode, spaced 1 + 1.15 × √(read length) apart), finds them exactly with the FM-index, then extends the most promising by dynamic programming (chapters 6 and 7)."),
)}
<p>Exact matching alone is not enough: reads have sequencing errors, and the sample differs from the reference. So the modern mappers use the FM-index to find <b>seeds</b>, and finish with an <b>alignment by dynamic programming</b> – the subject of the next two chapters.</p>
{mcq("b-q12", "Why does Bowtie 2 look up several short seeds instead of the whole read?", [
    ("One mismatch anywhere in the read empties the range of an exact search; short seeds are likely to contain no error, so some of them are found", True, "Then dynamic programming checks the whole read at the places the seeds point to – allowing mismatches and gaps."),
    ("The FM-index cannot search patterns longer than 22 letters", False, "Backward search works for a pattern of any length."),
    ("Short seeds need less memory in the index", False, "The index is the same whatever is searched."),
])}
{keypoints(
    "The BWT is the last column of the sorted rotations of text + $; it is the character before each suffix of the suffix array.",
    "LF mapping: the k-th c of L is the k-th c of F. It turns the BWT back into the text and makes it searchable.",
    "Backward search finds the range of rows that start with a pattern, one letter at a time from the right: top/bottom = C[c] + Occ(c, top/bottom).",
    "A sampled suffix array plus LF steps gives the positions.",
    "BWA and Bowtie search with the FM-index; BWA-MEM and Bowtie 2 use it for seeds and finish with dynamic programming.",
)}
'''
    return chapter('bwt', 5, 'BWT and FM-index', 'viz', 'BWA and Bowtie: the Burrows–Wheeler transform', 45,
                   'BWA and Bowtie find where millions of reads come from in a genome of billions of letters, using a few gigabytes of memory. They do not search the genome itself: they search its Burrows–Wheeler transform with an FM-index. Here you build the transform of a short sequence, turn it back, and use it to find a read – the steps those mappers take, on a genome you can see at a glance.', body)


# ======================================================================
# 6. Edit distance and dynamic programming
# ======================================================================
RECURSIVE = '''def edit_distance(x, y):
    if len(x) == 0: return len(y)          # only insertions left
    if len(y) == 0: return len(x)          # only deletions left
    diff = 0 if x[-1] == y[-1] else 1
    return min(edit_distance(x[:-1], y[:-1]) + diff,   # last letters aligned
               edit_distance(x[:-1], y) + 1,           # x's last letter against a gap
               edit_distance(x, y[:-1]) + 1)           # y's last letter against a gap'''


def ch_edit():
    body = f'''
<h2 id="e-ham">Hamming distance</h2>
<p>For two sequences of the same length, the <b>Hamming distance</b> is the number of positions where they differ – the number of substitutions:</p>
{alnfig("AGGCTCTAGGATATA", "AGGCTATAGGAGATA")}
{q("e-q1", "What is the Hamming distance of AGGCTCTAGGATATA and AGGCTATAGGAGATA?", "<p>2: C/A at position 5 and T/G at position 11.</p>", accept=r"^2$")}
<p>One insertion or deletion ruins it. These two sequences differ at <b>all 8</b> positions, yet deleting the first A and adding an A at the end turns one into the other:</p>
{alnfig("ACGTACGT", "CGTACGTA", "Hamming distance 8.")}
{alnfig("ACGTACGT-", "-CGTACGTA", "With gaps: 2 edits.")}

<h2 id="e-dot">Dot plots</h2>
<p>A <b>dot plot</b> shows two sequences against each other: one down the side, one across the top, and a dot wherever they match. A stretch the two share becomes a <b>diagonal</b>; an insertion or deletion shifts the diagonal sideways; a repeat gives parallel diagonals. With single letters, a quarter of the cells of two DNA sequences match by chance, so the plot is usually filtered: a dot only where a window of w letters has at least t matches.</p>
{activity("Watch it", [
    task("e-d1", f'Open {viz("dotplot:small")}, then {viz("dotplot:indel", "an insertion")} and {viz("dotplot:filtered", "the same, filtered")}.', auto="viz:end machine=dotplot preset=filtered"),
    task("e-d2", f'Open {viz("dotplot:repeat")} – a sequence against itself. Where do the extra diagonals come from?', auto="viz:end machine=dotplot preset=repeat"),
])}
{q("e-qd", "In the insertion example, the main diagonal breaks and continues three columns further right. What does that say about the two sequences?", "<p>Sequence 2 has three letters that sequence 1 lacks (an insertion in sequence 2, or a deletion in sequence 1): after them, the two match again, three positions further along sequence 2.</p>")}

<h2 id="e-edit">Edit distance</h2>
<p>The <b>edit distance</b> (or Levenshtein distance) of two sequences is the smallest number of <b>substitutions</b>, <b>insertions</b> and <b>deletions</b> that turn one into the other. An <b>alignment</b> shows the edits: a gap (–) in one sequence stands for a letter that only the other has. In a dot plot, an alignment is a path from the top-left to the bottom-right corner: diagonal steps for letters aligned with letters, sideways or downward steps for gaps.</p>
{alnfig("CGCATAC-GTGCG", "CG-ATACGGTGCG", "Edit distance 2: a deletion and an insertion.")}
<p>The page also writes the edits as a <b>transcript</b>, one letter per column: <b>M</b> match, <b>S</b> substitution, <b>D</b> deletion (a gap in sequence 2), <b>I</b> insertion (a gap in sequence 1). Here: <code>MMDMMMMIMMMMM</code>.</p>

<h2 id="e-rec">A recursive idea – and its cost</h2>
<p>Look at the <b>last column</b> of the best alignment of x and y. It can only be one of three things: x’s last letter against y’s last letter (a match or a substitution), x’s last letter against a gap, or a gap against y’s last letter. Whichever it is, the rest is the best alignment of what is left. That is a recursive definition:</p>
<pre class="codeblock">{esc(RECURSIVE)}</pre>
{activity("Watch it", [
    task("e-r1", f'Open {viz("recur:small")}, then {viz("recur:plain", "ACG and CCG")}. Each dot is a call, coloured by the pair of prefixes it solves; the table counts the calls of each pair.', auto="viz:end machine=recur preset=plain"),
    task("e-r2", f'Open {viz("recur:memo")} – the same with a memo: an answer is stored the first time and looked up after that (dashed).', auto="viz:end machine=recur preset=memo"),
])}
{q("e-qr", "With ACG and CCG, how many calls does the plain recursion make, and how many different pairs of prefixes are there? (Two numbers.)", "<p>94 calls for 16 pairs (4 × 4: each prefix of ACG, from empty to all three letters, against each prefix of CCG). For two sequences of 10 letters it is more than 12 million calls for 121 pairs.</p>", accept=r"^94[^0-9]+16$")}
<p><b>Dynamic programming</b> solves each pair of prefixes only once: it keeps the answers in a matrix D, where D[i][j] is the edit distance of the first i letters of x and the first j letters of y, and fills it in an order where the three cells each needs are already there.</p>
{formula(F_EDIT)}

<h2 id="e-fill">Fill the matrix</h2>
{activity("Watch it", [
    task("e-w1", f'Open {viz("dp:tiny")} – ACG against CCG. For each cell, the card next to the matrix shows the three candidates; the winner is orange.', auto="viz:end machine=dp preset=tiny"),
    task("e-w2", f'Open {viz("dp:edit")} – two 12-letter sequences, a row at a time – and play it to the end.', auto="viz:end machine=dp preset=edit"),
])}
{q("e-q2", "What is the edit distance of ACG and CCG?", "<p>1 – one substitution (A→C).</p>", accept=r"^1$")}
{q("e-q3", "In the 12-letter example the bottom-right cell is 2. Which two edits does the alignment show?", "<p>A deletion – the second C of CGCATACGTGCG has no partner (CG-ATACG…) – and an insertion: the extra G of CGATACGGTGCG (…ACGGTG… against …AC-GTG…). CGCATAC-GTGCG / CG-ATACGGTGCG.</p>")}
{activity("Your turn", [
    task("e-p1", f'Open {turn("dp:tiny")} and fill the cells yourself, then trace back.', auto="viz:practice machine=dp preset=tiny"),
    task("e-p2", 'On paper: fill the matrix of <b>GAT</b> (down the side) against <b>GCAT</b> (across the top), and answer below. Check it with <b>Change the input</b>.'),
])}
{q("e-q4", "The edit distance of GAT and GCAT:", "<p>1 – one insertion: G-AT / GCAT. The matrix:</p>" + MINIMAT_GAT, accept=r"^1$")}

<h2 id="e-trace">Trace back</h2>
<p>The bottom-right cell holds the distance; the <b>alignment</b> comes from tracing back how each value was reached, from the bottom-right corner to the top-left. A diagonal step (↖) aligns two letters; a step up (↑) aligns a letter of sequence 1 with a gap; a step left (←) aligns a letter of sequence 2 with a gap. When two moves give the same value there is more than one best alignment – the page, like most programs, takes the diagonal when it can. The 12-letter example has two equally good alignments: the inserted G can be either G of …CGGTG….</p>
{mcq("e-q5", "During the traceback you move straight <b>up</b> one cell. What does that column of the alignment show?", [
    ("A letter of sequence 1 against a gap", True, "Up means i goes down by one while j stays: sequence 1 uses a letter, sequence 2 does not – a deletion, D in the transcript."),
    ("A letter of sequence 2 against a gap", False, "That is a step to the left."),
    ("A match or a substitution", False, "Those are diagonal steps."),
])}

<h2 id="e-approx">Find a pattern in a longer sequence</h2>
<p>To find where a short pattern fits a long text best, with edits allowed, change two things: make the <b>first row all 0</b> – the pattern may start anywhere in the text at no cost – and take the <b>smallest value of the last row</b>: the fewest edits, ending at that column. The traceback stops when it reaches the top row: that is where the match starts.</p>
{activity("Watch it", [
    task("e-a1", f'Open {viz("dp:approx")} – ATGCAGTCG in TTGGGATACAGTACGGAACCT.', auto="viz:end machine=dp preset=approx"),
])}
{q("e-q6", "How many edits does ATGCAGTCG need to fit the text best?", "<p>2: a substitution (G→A) and an insertion: ATGCAGT-CG / ATACAGTACG.</p>", accept=r"^2$")}
{q("e-q7", "Which stretch of the text does it match?", "<p><code>ATACAGTACG</code>.</p>", accept=r"^atacagtacg$", hint="Read the top sequence of the alignment at the end, without the gaps.")}

<h2 id="e-cost">Why mappers do not do this with the whole genome</h2>
<p>The matrix has (m + 1)(n + 1) cells. A 100-base read against a 3.1-billion-base genome: about 3 × 10<sup>11</sup> cells – for one read. So mappers first find a few likely places with an index (chapters 5 and 9) and run dynamic programming only there – often only in a <b>band</b> around the diagonal, since a good alignment does not stray far from it (with BWA-MEM’s default band, gaps longer than 100 bases are not found).</p>
{q("e-q8", "How many cells does the matrix of a 150-base read against a 10,000-base region have?", "<p>151 × 10,001 = 1,510,151.</p>", accept=r"^1[ ,.]?510[ ,.]?151$", hint="(m + 1) × (n + 1).")}
{keypoints(
    "Hamming distance counts substitutions; edit distance also counts insertions and deletions.",
    "The recursive definition is right but repeats work; dynamic programming stores each prefix result once: (m + 1)(n + 1) cells.",
    "Each cell takes the best of three: ↖ (letter with letter), ↑ and ← (letter with a gap). The traceback gives the alignment; ties give equally good alternatives.",
    "First row 0 and the best of the last row: the pattern may sit anywhere in the text (approximate matching).",
)}
'''
    return chapter('edit', 6, 'Edit distance', 'viz', 'How far apart? Edit distance and dynamic programming', 40,
                   'A read never matches the genome perfectly: sequencing errors, SNPs and small insertions and deletions see to that. To decide where a read belongs, a program must measure how different two sequences are, and line them up so that the differences show. Dynamic programming does both – it is the last step of every read mapper.', body)


# ======================================================================
# 7. Global and local alignment with scores
# ======================================================================
def ch_scores():
    body = f'''
<h2 id="sc-pen">Penalties for DNA</h2>
<p>The edit distance counts every change as 1. In DNA, <b>transitions</b> (A↔G and C↔T: purine for purine, pyrimidine for pyrimidine) are about twice as common as <b>transversions</b> in the human genome, and insertions and deletions are rarer than substitutions. A penalty table can say so: transition 2, transversion 4, gap 8. The matrix is filled as before, taking the <b>smallest</b> total. The tables are in the <b>Score tables</b> tab {bench("tables", "show them")}.</p>
{activity("Watch it", [
    task("sc-w1", f'Open {viz("dp:penalty")} – TACGTCAGC against TATGTCATGC.', auto="viz:end machine=dp preset=penalty"),
])}
{q("sc-q1", "What is the total penalty of the best alignment?", "<p>10: a transition (C→T, 2) and one gap (8): TACGTCA-GC / TATGTCATGC.</p>", accept=r"^10$")}

<h2 id="sc-nw">Scores: Needleman–Wunsch</h2>
<p>Instead of penalties to keep small, alignments are usually given <b>scores</b> to make large: positive for a match, negative for a difference. With scores, the same matrix (Needleman and Wunsch, 1970) takes the <b>largest</b> of the three candidates. A <b>global</b> alignment covers both sequences from end to end: the answer is in the bottom-right cell.</p>
{formula(F_NW)}
{activity("Watch it", [
    task("sc-w2", f'Open {viz("dp:nw")} – the same two sequences, with scores.', auto="viz:end machine=dp preset=nw"),
])}
{q("sc-q2", "What is the score of the best global alignment?", "<p>0: eight matches (+8), one transition (−1) and one gap (−7). The alignment is the same as with penalties – these scores say the same thing about DNA as the penalty table.</p>", accept=r"^0$")}

<h2 id="sc-sw">Local alignment: Smith–Waterman</h2>
<p>Often only <b>part</b> of two sequences is related: a shared domain, a read that runs off the end of a contig. Smith and Waterman (1981) changed one thing: no cell may fall <b>below 0</b>. A 0 means “nothing ending here is better than no alignment at all” – an alignment may start afresh anywhere. The best local alignment ends at the <b>highest cell anywhere</b> in the matrix, and the traceback stops at the first 0.</p>
{formula("V[i][j] = max( 0, V[i-1][j-1] + s(x[i-1], y[j-1]), V[i-1][j] + gap, V[i][j-1] + gap )")}
{activity("Watch it", [
    task("sc-w3", f'Open {viz("dp:swsmall")} – GTG against AGTC with match +1, mismatch −1, gap −1.', auto="viz:end machine=dp preset=swsmall"),
    task("sc-w4", f'Open {viz("dp:sw")} – two longer sequences, match +2, mismatch −4, gap −6. Notice the sea of zeros and the island of high scores.', auto="viz:end machine=dp preset=sw"),
])}
{q("sc-q3", "The best local score of GTG and AGTC:", "<p>2: GT against GT.</p>", accept=r"^2$")}
{q("sc-q4", "In the longer example, which part of GGTATGCTGGCGCTA is aligned?", "<p><code>TATGCTGGCG</code>, against TATGC-GGCG of the other sequence: 9 matches (+18) and one gap (−6) = 12.</p>", accept=r"^tatgctggcg$")}
{activity("Your turn", [
    task("sc-p1", f'Open {turn("dp:swsmall")}: fill the matrix (remember the 0) and trace back.', auto="viz:practice machine=dp preset=swsmall"),
])}

<h2 id="sc-prot">Proteins: BLOSUM62</h2>
<p>For proteins, a table of 20 × 20 scores says how often each amino acid replaces each other in related proteins. <b>BLOSUM62</b> is the one BLAST uses for proteins by default (chapter 8 shows how such a table is made). Look it up in the <b>Score tables</b> tab {bench("tables", "show it")}: scores are high on the diagonal for rare, important residues (W–W 11, C–C 9), positive for similar ones (I–L 2), and negative for unlike ones (W–A −3).</p>
{activity("Watch it", [
    task("sc-w5", f'Open {viz("dp:protein")} – a local alignment of two short proteins with BLOSUM62 and a gap of −8.', auto="viz:end machine=dp preset=protein"),
])}
{q("sc-q5", "What is the best local score, and which residues are aligned?", "<p>20: AW-HE against AWGHE (A–A 4, W–W 11, a gap −8, H–H 8, E–E 5).</p>", accept=r"^20([^0-9]|$)")}

<h2 id="sc-gaps">Gaps: one long or several short?</h2>
<p>An insertion or deletion of several letters is usually one event, so a gap of 3 should cost less than three gaps of 1. <b>Affine</b> gap costs charge for opening a gap and less for each letter it covers: BLAST’s default for proteins is 11 to open plus 1 per residue, so a gap of k residues costs 11 + k. Gotoh (1982) showed how to fill the matrix with affine gaps in the same (m + 1)(n + 1) steps, using three matrices instead of one.</p>
{q("sc-q6", "With BLAST’s gap costs (11 + 1 per residue), what does one gap of 3 residues cost? (And three separate gaps of 1?)", "<p>11 + 3 = 14; three gaps of 1 cost 3 × 12 = 36 – so the alignment with one longer gap wins.</p>", accept=r"^14([^0-9]|$)")}

<h2 id="sc-tools">In real tools</h2>
{tools(
    ("EMBOSS <code>needle</code>", "Needleman–Wunsch, global. Gap open 10, extend 0.5; EBLOSUM62 for proteins, EDNAFULL for DNA. Gaps at the ends are free by default."),
    ("EMBOSS <code>water</code>", "Smith–Waterman, local; the same defaults."),
    ("BLAST", "Extends its hits by local alignment with gaps: BLOSUM62 and gap 11 + 1 per residue for proteins (chapter 8)."),
    ("BWA-MEM", "Extends its seeds by Smith–Waterman in a band: match 1, mismatch −4, gap 6 to open + 1 per base."),
    ("Bowtie 2", "End-to-end by default: match 0, mismatch up to −6 (less at low-quality bases), gap 5 + 3 per base. With <code>--local</code>, matches score +2 and the ends may be clipped."),
    ("minimap2", "Match 2, mismatch −4, gap 4 + 2 per base – or 24 + 1 per base for long gaps, whichever is cheaper."),
)}
{keypoints(
    "Penalties (smallest wins) and scores (largest wins) use the same matrix; only the rule of each cell changes.",
    "Needleman–Wunsch is global: from end to end, answer in the bottom-right cell.",
    "Smith–Waterman is local: no cell below 0, the answer is the highest cell, the traceback stops at 0.",
    "BLOSUM62 scores amino-acid pairs; affine gaps (open + extend) prefer one long gap to several short ones.",
)}
'''
    return chapter('scores', 7, 'Global and local alignment', 'viz', 'Scores: Needleman–Wunsch and Smith–Waterman', 35,
                   'Not every difference is equally likely. In DNA, transitions are more common than transversions; in proteins, an isoleucine is often replaced by a leucine, hardly ever by a tryptophan. With scores that say so, the same matrix gives the alignments that EMBOSS needle and water compute – and the last step of BLAST and of every read mapper.', body)


# ======================================================================
# 3. Exact matching
# ======================================================================
RE_PI_ATCGATG = r"^-1\s*,?\s*0\s*,?\s*0\s*,?\s*0\s*,?\s*0\s*,?\s*1\s*,?\s*2\s*,?\s*0$"
F_PI = "i       0  1  2  3  4  5  6  7  8  9 10\nP          T  A  T  A  T  A  T  A  G  T\nπ[i]   −1  0  0  1  2  3  4  5  6  0  1"
RE_23_32 = r"^23\D+32$"
F_ROLL = "5128 → (5128 − 5×1000) × 10 + 4 = 1284"


def ch_exact():
    body = f'''
<h2 id="x-naive">The naive search</h2>
<p>The plainest way to find a pattern P (length m) in a text T (length n): put P under the start of T and compare letter by letter from the left; at the first mismatch, or when every letter has matched, move P one place on and start again. There are n − m + 1 places to try, and up to m comparisons at each: in the worst case about <b>m × n</b> comparisons – O(mn).</p>
{activity("Watch it", [
    task("x-n1", f'Open {viz("naive:tata")} – TATA in ATACGATATAGA – and play it. The counts above the text keep the score.', auto="viz:end machine=naive"),
    task("x-n2", f'Try a bad case: {viz("naive:worst")}. Why does each shift take so many comparisons?', auto="viz:end machine=naive preset=worst"),
])}
{q("x-q1", "How many places does the naive search try for a pattern of 4 letters in a text of 12?", "<p>12 − 4 + 1 = 9: shifts 0 to 8.</p>", accept=r"^9$")}
{activity("Your turn", [
    task("x-n3", f'Open {turn("naive:tata")}: at each shift, say how many letters match before the first mismatch.', auto="viz:practice machine=naive"),
])}
<p>Comparisons that matched are thrown away at every shift: after matching TATA’s first three letters, the naive search moves one place and compares the same text letters again. The next two methods use what they have already seen.</p>

<h2 id="x-kmp">Knuth–Morris–Pratt: never look back</h2>
<p>Knuth, Morris and Pratt (1977) first make a table from the pattern alone. For each i, <b>π[i]</b> is the length of the longest <b>border</b> of the first i letters: a part that is both a prefix and a suffix of them (not all of them). For TATATATAGT:</p>
{formula(F_PI)}
<p>π[0] = −1 by convention: when nothing has matched, the pattern moves on by 0 − (−1) = 1 place. If i letters have matched and the next one does not, the matched part ends with its border – which is also how the pattern starts. So the pattern can jump <b>i − π[i]</b> places, the border stays lined up with the text, and the comparison carries on after it. A text letter that has matched is never compared again: the search takes time proportional to n, and the table to m – O(n + m).</p>
{activity("Watch it", [
    task("x-k1", f'Open {viz("kmp:table")} – how the table of TATATATAGT is made, one border at a time.', auto="viz:end machine=kmp preset=table"),
    task("x-k2", f'Open {viz("kmp:atcgatg")} – the table of ATCGATG, then the search. Watch for jumps of more than one, and for the letters kept from one shift to the next (green rings).', auto="viz:end machine=kmp preset=atcgatg"),
])}
{q("x-q2", "On paper: the table of <b>ATCGATG</b>, π[0] to π[7]. (Type the 8 numbers with spaces.)", "<p><code>-1 0 0 0 0 1 2 0</code>: π[5] = 1 (A…A), π[6] = 2 (AT…AT), and ATCGATG ends in G, which does not start the pattern.</p>", accept=RE_PI_ATCGATG, hint="π[0] is −1 by definition. π[i] is the longest border of the first i letters: for ATCGA it is A.")}
{q("x-q3", "In that search, after six letters (ATCGAT) have matched, the seventh does not. How far does the pattern jump?", "<p>i − π[i] = 6 − 2 = 4: the border AT of ATCGAT is moved under the AT at the end of the matched text.</p>", accept=r"^4$")}
{q("x-q4", "How many comparisons did KMP make in that example – and how many does the naive search make on the same text and pattern? (Two numbers.)", "<p>23 for KMP and 32 for the naive search (the last step of the KMP animation says both).</p>", accept=RE_23_32)}
{activity("Your turn", [
    task("x-k3", f'Open {turn("kmp:atcgatg")}: fill in the table, then say how far the pattern jumps at each mismatch.', auto="viz:practice machine=kmp"),
])}

<h2 id="x-bm">Boyer–Moore: compare from the right</h2>
<p>Boyer and Moore (1977) compare the pattern with the text <b>from its right end</b>. A mismatch then tells something about the text letters further on, and two rules each propose a jump – the larger one is taken:</p>
<ul>
<li><b>Bad character</b>: move the pattern until a letter equal to the mismatched text letter lies under it. If that letter is not in the pattern at all, the whole pattern can pass it.</li>
<li><b>Good suffix</b>: the letters that did match (a suffix of the pattern) are moved to where the same letters occur again in the pattern – or, failing that, to where a prefix of the pattern fits their end.</li>
</ul>
<p>Both rules come from tables made from the pattern. Long patterns give long jumps: Boyer–Moore often makes far fewer than n comparisons. With only four letters, DNA gives the bad-character rule less to work with than English text; the good-suffix rule makes up for it.</p>
{activity("Watch it", [
    task("x-b1", f'Open {viz("bm:notin")}: the first mismatched text letter, G, is not in TATAC – a jump of 5.', auto="viz:end machine=bm preset=notin"),
    task("x-b2", f'Open {viz("bm:tatac")}: here the mismatched letter is in the pattern.', auto="viz:end machine=bm preset=tatac"),
    task("x-b3", f'Open the good-suffix examples {viz("bm:suffix1", "found again")} and {viz("bm:suffix2", "only a prefix fits")}. In the tables, the cells used light up; the winning rule is orange.', auto="viz:end machine=bm preset=suffix2"),
])}
{q("x-q5", "Pattern TCGC, compared from the right with the text, mismatches at its position 2 (the G) against a T in the text. How far does the bad-character rule move the pattern?", "<p>2: the nearest T to the left in the pattern is at position 0, two places back – 1 more than the naive shift.</p>", accept=r"^2$", hint="Count from position 2 back to the nearest T of TCGC.")}
{mcq("x-q6", "Why does Boyer–Moore get <i>faster</i> as the pattern gets longer?", [
    ("A mismatch near the right end can move the pattern up to its whole length, so longer patterns skip more of the text", True, "With a long pattern and a letter that is not in it (or a suffix that does not recur), one comparison can skip m letters of the text."),
    ("Longer patterns have fewer matches", False, "That is often true, but the speed comes from the length of the jumps."),
    ("It compares several letters at once", False, "It compares one letter at a time, like the others."),
])}
{activity("Your turn", [
    task("x-b4", f'Open {turn("bm:read")}: at each mismatch, give the jump of each rule from the tables.', auto="viz:practice machine=bm"),
])}

<h2 id="x-rk">Rabin–Karp: compare numbers instead of letters</h2>
<p>Karp and Rabin (1987) turn the pattern into a number – its <b>hash</b> – and compare it with the hash of each window of the text. Only a window with the same hash is compared letter by letter. For digits, the window 1284 is the number 1284; the hash is the remainder after dividing by a chosen number q: 1284 mod 97 = 23. DNA letters become digits in base 4 (A = 0, C = 1, G = 2, T = 3).</p>
<p>The trick is the <b>rolling hash</b>: the next window’s number comes from the last one in one step – take away the digit that leaves, multiply by the base, add the digit that joins:</p>
{formula(F_ROLL)}
<p>Programs do the same sums on the remainders – ((h − out × B<sup>m−1</sup>) × B + in) mod q, for base B and pattern length m – so the numbers stay small. Two different windows can have the same remainder: a <b>false alarm</b> (spurious hit), which the letter-by-letter check catches. Hashes of several patterns can be checked at every window at once.</p>
{activity("Watch it", [
    task("x-r1", f'Open {viz("rk:phone")} – looking for the number 1284 in a stream of digits.', auto="viz:end machine=rk preset=phone"),
    task("x-r2", f'Open {viz("rk:dna")} – DNA, with a small q (7). How many false alarms are there?', auto="viz:end machine=rk preset=dna"),
])}
{q("x-q7", "What is the hash of the window 2849 with q = 97?", "<p>2849 mod 97 = 36 (97 × 29 = 2813; 2849 − 2813 = 36).</p>", accept=r"^36$")}
{q("x-q8", "Why does a larger q (say 101 instead of 7) give fewer false alarms?", "<p>The hash can take q different values. With q = 7, a random window has the pattern’s hash about one time in seven; with q = 101, about one time in a hundred. Real programs use very large q (or 64-bit hashes), so false alarms are rare.</p>")}
{activity("Your turn", [
    task("x-r3", f'Open {turn("rk:phone")} and roll the hash on yourself for a few windows.', auto="viz:practice machine=rk"),
])}

<h2 id="x-regex">Patterns with choices</h2>
<p>Motifs are rarely one exact word. A PROSITE pattern such as <code>C-x-H-x-[LIVMFY]-C-x(2)-C-[LIVMYA]</code> means: C, any residue, H, any, one of L I V M F Y, C, any two, C, one of L I V M Y A. In Python the same is the regular expression <code>C.H.[LIVMFY]C.{{2}}C[LIVMYA]</code>, and <code>re.finditer</code> finds every match. Tools such as grep turn the pattern into a small machine (an automaton) that reads the text one letter at a time – the idea of the KMP table, for a pattern with choices. (Python’s <code>re</code> instead tries the pattern at each position, going back when a choice fails.)</p>

<h2 id="x-tools">In real tools</h2>
{tools(
    ("<code>grep</code>", "GNU grep finds fixed strings with a variant of Boyer–Moore, and looks for many patterns at once with a trie of the patterns (chapter 4)."),
    ("Python <code>re</code>, ScanProsite", "Regular expressions and PROSITE patterns: motifs with choices and stretches of any letter."),
    ("k-mer tools", "Rolling hashes (for example ntHash) give the hash of every k-mer of a read in one step each – the start of minimizers and of k-mer counting (chapters 9 and 12)."),
    ("Read mappers", "Do not scan the genome for each read: with billions of letters even n + m steps per read is too slow. They index the genome once (chapters 4 and 5), and then each read is found in time that depends on the read, not on the genome."),
)}
{keypoints(
    "Naive search: every shift, compare from the left – up to m × n comparisons.",
    "KMP: a failure table π (longest borders) lets the pattern jump i − π[i] after i matched letters; no text letter is compared again after it has matched – O(n + m).",
    "Boyer–Moore: compare from the right; jump by the larger of the bad-character and good-suffix rules. Long patterns, long jumps.",
    "Rabin–Karp: compare hashes; a rolling hash updates in one step; equal hashes are checked letter by letter (false alarms).",
)}
'''
    return chapter('exact', 3, 'Exact matching', 'viz', 'Finding a pattern: exact matching', 40,
                   'The simplest search question – where in this sequence does this exact pattern occur? – already has four classic answers. Each is faster than the last because it uses more of what it has already seen. The same ideas come back in every index and every mapper.', body)


# ======================================================================
# 4. Tries, suffix trees and suffix arrays
# ======================================================================
RE_SA_CGCTACTA = r"^\[?\s*8\D+7\D+4\D+0\D+5\D+2\D+1\D+6\D+3\s*\]?$"
RE_C_POS = r"^0\D+2\D+5$"
RE_LOST = r"^3\D+4$"


def ch_index():
    body = f'''
<h2 id="i-why">Prepare the text, not the pattern</h2>
<p>KMP and Boyer–Moore prepare the <b>pattern</b> and then read the whole text for each search. A genome is searched again and again – for millions of reads – while it stays the same. So the genome is prepared once, as an <b>index</b>, and every search then takes time that depends on the pattern, not on the genome. This chapter builds three indexes; the next one compresses the last of them into the index of BWA and Bowtie.</p>

<h2 id="i-trie">A trie of patterns</h2>
<p>A <b>trie</b> (from re<i>trie</i>val) stores a set of words as a tree whose <b>edges carry letters</b>. Each word is a path from the root, and words that start alike share the start of their path – AAA and AAG share AA. To find every word of the set in a text, start at each position of the text and follow its letters down from the root as far as the trie allows; each marked node passed is a word found there.</p>
{activity("Watch it", [
    task("i-t1", f'Open {viz("trie:codons")} – the eight codons of lysine and arginine (the two positively charged amino acids), then a scan along a sequence.', auto="viz:end machine=trie"),
])}
{q("i-q1", "The eight codons have 24 letters. How many nodes does their trie have, with the root?", "<p>14: the root, A and C, then AA, AG and CG, then the eight leaves. Shared beginnings are stored once.</p>", accept=r"^14$", hint="Count them at the end of the animation.")}
{activity("Your turn", [
    task("i-t2", f'Open {turn("trie:small")}: say how many nodes each word adds, then whether a word starts at each position.', auto="viz:practice machine=trie"),
])}
<p>The scan follows the text from every position and so can read a letter several times. The <b>Aho–Corasick</b> algorithm adds to the trie links like KMP’s failure table, so that the text is read only once however many words are looked for.</p>

<h2 id="i-stree">Suffix tries and suffix trees</h2>
<p>Turn it round: build a trie of every <b>suffix of the text</b>. Every substring of the text is the start of some suffix, so every substring is a path from the root – and the <b>leaves</b> below the end of that path are the suffixes that start with it: one leaf per occurrence, labelled with where it starts.</p>
<p>Two refinements make it work. A <b>$</b> at the end: without it, a suffix that is also the start of a longer suffix (TA in TACTA) ends inside another path and gets no leaf. And <b>compression</b>: a suffix trie has long chains of nodes with one child each; merging every chain into one edge with a longer label gives the <b>suffix tree</b>, with at most 2n nodes. Searching a pattern of m letters then takes m steps plus one per occurrence, however long the text.</p>
{activity("Watch it", [
    task("i-s1", f'Open {viz("stree:tacta")} – the suffix trie of TACTA$, compressed into a suffix tree, then a search for TA.', auto="viz:end machine=stree preset=tacta"),
    task("i-s2", f'Open {viz("stree:nodollar")} – the same text without the $.', auto="viz:end machine=stree preset=nodollar"),
    task("i-s3", f'Open {viz("stree:longer")} – CGCTACTA$, searching C.', auto="viz:end machine=stree preset=longer"),
])}
{q("i-q2", "Without the $, which two suffixes of TACTA have no leaf in the suffix tree? (Their start positions.)", "<p>3 (TA) and 4 (A): each is also the start of a longer suffix (TACTA and ACTA), so it ends in the middle of that suffix’s path.</p>", accept=RE_LOST)}
{q("i-q3", "Where does C occur in CGCTACTA$? (The leaf labels, smallest first.)", "<p>0, 2 and 5: the three leaves below the edge C.</p>", accept=RE_C_POS)}
{activity("Your turn", [
    task("i-s4", f'Open {turn("stree:cta")} and count the occurrences of CTA from the tree.', auto="viz:practice machine=stree"),
])}
<p>Suffix trees can be built in time proportional to the length of the text (Ukkonen, 1995), and they answer many questions at once – the longest repeat, the longest common substring of two genomes. Their weakness is memory: each node needs pointers and the positions of its label, about 20 bytes for every letter of the text – some 60 GB for a human genome.</p>

<h2 id="i-sa">Suffix arrays</h2>
<p>A <b>suffix array</b> keeps only what a search needs: the start positions of the suffixes, in sorted order. All the suffixes that start with a pattern are next to each other in it, so <b>binary search</b> (chapter 1) finds them: about log<sub>2</sub> n steps, each comparing up to m letters. One number per letter – 4 bytes each, about 12 GB for a human genome – much less than a suffix tree, and the starting point of the BWT (chapter 5).</p>
{activity("Watch it", [
    task("i-a1", f'Open {viz("sa:cta")} – the suffixes of CGCTACTA$ sorted, then a binary search for CTA. The bracket shows where the first match can still be.', auto="viz:end machine=sa preset=cta"),
    task("i-a2", f'Try {viz("sa:absent")} – a pattern that is not there.', auto="viz:end machine=sa preset=absent"),
])}
{q("i-q4", "On paper: the suffix array of CGCTACTA$ (the start positions of its 9 sorted suffixes).", "<p>8 7 4 0 5 2 1 6 3: $, A$, ACTA$, CGCTACTA$, CTA$, CTACTA$, GCTACTA$, TA$, TACTA$.</p>", accept=RE_SA_CGCTACTA, hint="Write the 9 suffixes with their starts, sort them ($ first), read the starts.")}
{q("i-q5", "About how many steps does a binary search need in a suffix array of a billion suffixes?", "<p>About 30: each step halves the range, and 2<sup>30</sup> is about 1.07 billion.</p>", accept=r"^(29|30|31)$")}
{activity("Your turn", [
    task("i-a3", f'Open {turn("sa:ta")}: at each step of the binary search, say which half to keep.', auto="viz:practice machine=sa"),
])}

<h2 id="i-tools">In real tools</h2>
{tools(
    ("MUMmer", "Aligns whole genomes by first finding long exact matches between them – with a suffix tree in its first versions; MUMmer 4 replaced the tree with a suffix array, which copes with much larger genomes."),
    ("BWA, Bowtie, Bowtie 2", "Their index is the BWT of the genome, which is made by sorting the suffixes – a suffix array – and is searched with the FM-index (chapter 5)."),
    ("Many patterns at once", "A trie of the patterns (with Aho–Corasick links) finds all of them in one pass along the text."),
)}
{keypoints(
    "A trie stores words as paths whose edges carry letters; shared beginnings are stored once.",
    "A suffix tree is the compressed trie of all suffixes of text + $: a pattern is a path from the root, its occurrences the leaves below – O(m + occurrences), but about 20 bytes per letter.",
    "A suffix array is the sorted list of suffix starts: binary search finds a pattern in about log₂ n steps; 4 bytes per letter.",
)}
'''
    return chapter('index', 4, 'Tries and suffix trees', 'viz', 'Indexing a text: tries, suffix trees and suffix arrays', 35,
                   'A genome is searched millions of times and never changes. So instead of preparing each pattern, prepare the genome once – as a tree or a sorted list of its suffixes – and every search becomes a short walk.', body)


# ======================================================================
# 1. Searching and sorting
# ======================================================================
def bigo_table():
    rows = [
        ('10', '3', '33', '100'),
        ('1,000', '10', '10,000', '1,000,000'),
        ('1,000,000', '20', '2 × 10<sup>7</sup>', '10<sup>12</sup>'),
        ('3.1 × 10<sup>9</sup> (a human genome)', '32', '10<sup>11</sup>', '10<sup>19</sup>'),
    ]
    tr = ''.join(f'<tr><td>{a}</td><td>{b}</td><td>{c}</td><td>{d}</td></tr>' for a, b, c, d in rows)
    return f'<table class="table bigo"><tr><th>n</th><th>log<sub>2</sub> n</th><th>n log<sub>2</sub> n</th><th>n<sup>2</sup></th></tr>{tr}</table>'


def ch_basics():
    body = f'''
<h2 id="o-steps">Counting steps</h2>
<p>To compare algorithms, count the <b>steps</b> they take – comparisons, moves – and ask how that number grows with the size n of the data. <b>Big O</b> keeps only the term that grows fastest, for the worst case: reading item i of a list is O(1), whatever its length; looking at every item is O(n); halving the data at every step is O(log n). On a genome, the difference between these is the difference between a second and a lifetime:</p>
{bigo_table()}
<p>At a billion simple steps a second, 10<sup>11</sup> steps take under two minutes; 10<sup>19</sup> take some 300 years.</p>

<h2 id="o-search">Linear and binary search</h2>
<p><b>Linear search</b> looks at the items one by one: up to n comparisons. If the list is <b>sorted</b>, <b>binary search</b> does much better: compare with the middle item, and keep only the half where the item must be. Every comparison halves what is left, so about log<sub>2</sub> n comparisons are enough: 7 for 100 items, 14 for 10,000, 32 for 3 billion.</p>
{activity("Watch it", [
    task("o-s1", f'Open {viz("search:race")} – both searches side by side on the same list.', auto="viz:end machine=search"),
    task("o-s2", f'Open {viz("search:kmers")}: binary search works for words too, in alphabetical order – this is how a suffix array is searched (chapter 4).', auto="viz:end machine=search preset=kmers"),
])}
{q("o-q1", "About how many comparisons does binary search need, at most, in a sorted list of 1,000,000 items?", "<p>20: 2<sup>20</sup> is just over a million, and each comparison halves what is left.</p>", accept=r"^(19|20|21)$")}
{activity("Your turn", [
    task("o-s3", f'Open {turn("search:binary")}: find the middle item and say which half to keep, until 68 is found.', auto="viz:practice machine=search"),
])}

<h2 id="o-sort">Sorting</h2>
<p>Binary search needs sorted data, and so do suffix arrays and the BWT. Five ways to sort, from the slowest:</p>
<ul>
<li><b>Bubble sort</b>: compare neighbours along the list and swap any pair in the wrong order; each pass carries the largest item to the end. About n²/2 comparisons – O(n²).</li>
<li><b>Selection sort</b>: find the smallest item and swap it to the front, then the smallest of the rest… Also n²/2 comparisons, but at most n swaps.</li>
<li><b>Insertion sort</b>: take each item in turn and slide it left into its place. O(n²) at worst, but on a list that is nearly sorted only about n steps.</li>
<li><b>Merge sort</b>: split the list in halves until each part has one item, then merge sorted parts by repeatedly taking the smaller front item. log<sub>2</sub> n levels of n steps each: O(n log n), always. It is <b>stable</b>: equal items keep their order.</li>
<li><b>Quicksort</b>: put a <b>pivot</b> in its final place, with smaller items to its left and larger ones to its right, then sort each side the same way. O(n log n) on average – but O(n²) if the pivot is always the largest or smallest item.</li>
</ul>
<p>Merge sort and quicksort are <b>recursive</b>: they solve a problem by solving smaller copies of it, down to a <b>base case</b> (a list of one item) that needs no work.</p>
{activity("Watch it", [
    task("o-o1", f'Open {viz("sort:bubble")} and play it. Then choose <b>Selection sort</b> and <b>Insertion sort</b> in the list of examples, on the same five numbers.', auto="viz:end machine=sort preset=insertion"),
    task("o-o2", f'Open {viz("sort:merge")}: the bracket shows the part being worked on and its level of recursion; merged items collect in the row below.', auto="viz:end machine=sort preset=merge"),
    task("o-o3", f'Open {viz("sort:quick")}: the purple bar is the pivot; the pointers l and r meet in the middle.', auto="viz:end machine=sort preset=quick"),
])}
{q("o-q2", "How many comparisons does bubble sort make on 5 3 8 2 4? Explain the number.", "<p>10 = 4 + 3 + 2 + 1: the first pass compares 4 pairs, and each pass after it one pair fewer, because the largest items are already at the end. In general (n − 1) + (n − 2) + … + 1 = n(n − 1)/2 – O(n²).</p>")}
{mcq("o-q3", "A list of a million reads is already sorted by position, except for a few reads out of place. Which method finishes fastest?", [
    ("Insertion sort", True, "On nearly sorted data each item moves only a few places: about n steps. (Python’s own sort, Timsort, looks for such sorted runs too.)"),
    ("Selection sort", False, "It always makes about n²/2 comparisons, however sorted the data already is."),
    ("Quicksort with the last item as pivot", False, "On sorted data that pivot is always the largest item: its worst case, O(n²)."),
])}
{activity("Your turn", [
    task("o-o4", f'Open {turn("sort:merge")}: at each step of a merge, say which item comes next.', auto="viz:practice machine=sort preset=merge"),
    task("o-o5", f'Open {turn("sort:quick")}: say where each pivot ends up.', auto="viz:practice machine=sort preset=quick"),
])}

<h2 id="o-tools">In real tools</h2>
{tools(
    ("<code>sort</code> (Unix), <code>samtools sort</code>", "Merge sort: data larger than the memory is sorted in pieces, written to temporary files, and the files are merged – an external merge sort."),
    ("Python’s <code>sorted()</code>", "Timsort: merge sort that first finds runs that are already in order, sorting short stretches by insertion. Stable, O(n log n)."),
    ("<code>bwa index</code>, <code>bowtie2-build</code>", "Sort all the suffixes of the genome to make the BWT (chapter 5) – billions of items, with special sorting methods for suffixes."),
)}
{keypoints(
    "Count steps and see how they grow with n: O(1), O(log n), O(n), O(n log n), O(n²).",
    "Binary search halves a sorted list at every step: about log₂ n comparisons.",
    "Bubble, selection and insertion sort are O(n²); merge sort and quicksort (on average) O(n log n). Insertion sort is fast on nearly sorted data; merge sort is stable.",
)}
'''
    return chapter('basics', 1, 'Searching and sorting', 'viz', 'Searching and sorting', 30,
                   'Two jobs come before any alignment: finding things and putting them in order. Every index of a genome is made by sorting and searched by halving – so first, how to count the steps an algorithm takes, and why the way they grow matters more than how fast the computer is.', body)


# ======================================================================
# 2. Hash tables and trees
# ======================================================================
def ch_hashing():
    body = f'''
<h2 id="h-hash">Hash tables</h2>
<p>Binary search needs about log<sub>2</sub> n steps. A <b>hash table</b> usually needs one. A <b>hash function</b> turns each key into a number, and the number says which of the table’s N <b>slots</b> holds it: slot = number mod N. To look a key up, compute its slot and look only there.</p>
<p>For DNA the number is easy: read a k-mer as a number in base 4, A = 0, C = 1, G = 2, T = 3 – two bits per letter:</p>
{formula("GAT = 2×4² + 0×4¹ + 3×4⁰ = 32 + 0 + 3 = 35;   35 mod 11 = 2")}
<p>Two keys can land in the same slot – a <b>collision</b>. With <b>chaining</b> each slot holds a list; with <b>open addressing</b> (linear probing) the newcomer takes the next free slot. Either way, the fuller the table (its <b>load factor</b>), the more collisions, and the slower the lookups.</p>
{activity("Watch it", [
    task("h-w1", f'Open {viz("hash:chain")} – every 3-mer of GATTACAGATTACA in a table of 11 slots, then a lookup. The table maps each 3-mer to the positions where it occurs: a <b>k-mer index</b>.', auto="viz:end machine=hash preset=chain"),
    task("h-w2", f'Open {viz("hash:probe")} – the same, with linear probing.', auto="viz:end machine=hash preset=probe"),
])}
{q("h-q1", "What is the number of ATT, and its slot in a table of 11? (Two numbers.)", "<p>ATT = 0×16 + 3×4 + 3 = 15, and 15 mod 11 = 4.</p>", accept=r"^15[^0-9]+4$")}
{q("h-q2", "Which two 3-mers of GATTACAGATTACA collide in slot 4, and which in slot 5?", "<p>ATT (15) and ACA (4): both 4 mod 11. TTA (60) and TAC (49): both 5 mod 11.</p>")}
{activity("Your turn", [
    task("h-p1", f'Open {turn("hash:chain")} and work out the slot of each new 3-mer.', auto="viz:practice machine=hash"),
])}

<h2 id="h-rec">Recursion</h2>
<p>A function that calls itself on a smaller part of the problem is <b>recursive</b>: merge sort sorts a list by sorting its two halves. It needs a <b>base case</b> that ends the calls (a list of one item is sorted), and each call must move towards it. Every call waits on the <b>call stack</b> until the calls it made return – deep recursion costs memory. Recursion gives short, clear definitions; chapter 6 shows how a recursive definition of the edit distance becomes slow, and how dynamic programming fixes it.</p>

<h2 id="h-bst">Binary search trees</h2>
<p>A <b>binary search tree</b> keeps data in order without an array: each node has at most two children: everything in its left subtree is smaller, everything in its right subtree larger. A search starts at the root and goes left or right at each node, throwing away half of what is left – like binary search. New items are inserted where the search for them ends.</p>
{activity("Watch it", [
    task("h-t1", f'Open {viz("bst:balanced")} – nine numbers inserted, then a search for 61.', auto="viz:end machine=bst preset=balanced"),
    task("h-t2", f'Open {viz("bst:vine")} – the same numbers inserted in sorted order.', auto="viz:end machine=bst preset=vine"),
])}
{q("h-q3", "In the first tree, how many comparisons does the search for 61 take? And in the vine?", "<p>4 (50, 70, 60, 61) in the balanced tree; 7 in the vine (20, 30, 40, 50, 52, 60, 61), where every node has only a right child – as slow as a linear search. Real programs keep their trees balanced.</p>", accept=r"^4[^0-9]+7$")}
{activity("Your turn", [
    task("h-t3", f'Open {turn("bst:balanced")}: at each node, go left or right.', auto="viz:practice machine=bst"),
])}
<p>Trees appear all through bioinformatics: tries and suffix trees index sequences (chapter 4), and guide trees and phylogenies order sequences by similarity (chapter 10).</p>

<h2 id="h-tools">In real tools</h2>
{tools(
    ("BLAST", "Puts the words of the query in a lookup table, then reads the database once, looking each of its words up (chapter 8)."),
    ("minimap2", "Indexes the minimizers of the reference in a hash table: a lookup gives every place where a minimizer of the read occurs (chapter 9)."),
    ("Jellyfish", "Counts every k-mer of a sequencing run in a hash table of billions of entries."),
    ("Python <code>dict</code> and <code>set</code>", "Hash tables: <code>kmer in seen</code> takes about one step however large the set."),
)}
{keypoints(
    "A hash table finds a key in about one step: slot = hash(key) mod N. Collisions are handled by chaining or open addressing.",
    "A k-mer is a number in base 4 (2 bits per letter); a k-mer index maps each k-mer to where it occurs.",
    "Recursion solves a problem through smaller copies of itself, down to a base case.",
    "A balanced binary search tree finds an item in about log₂ n steps; an unbalanced one can take n.",
)}
'''
    return chapter('hashing', 2, 'Hash tables and trees', 'viz', 'Hash tables, recursion and trees', 30,
                   'Tools that compare sequences rarely search letter by letter: they look things up. Hash tables find a word of DNA in one step and trees keep data in order – the data structures inside BLAST, minimap2 and every k-mer counter.', body)


# ======================================================================
# 8. BLAST and FASTA
# ======================================================================
F_EVALUE = "E = K · m · n · e^(−λS)\nm: length of the query, n: length of the database\nbit score S' = (λS − ln K) / ln 2,   so   E = m · n · 2^(−S')"


def ch_blast():
    body = f'''
<h2 id="bl-why">Too many cells</h2>
<p>Smith–Waterman finds the best local alignment, but fills m × n cells. A 300-residue protein against a database of a hundred billion residues is some 3 × 10<sup>13</sup> cells for one search. Yet almost every sequence in the database is unrelated to the query, and related ones nearly always share at least a few short words – exactly, or nearly (the <b>pigeonhole</b> principle: scatter a few differences along an alignment and some stretches between them must be untouched). So <b>BLAST</b> (Altschul et al., 1990) looks for shared words first, and aligns only where it finds them:</p>
<ol class="plain">
<li>Make a table of the query’s words (3 letters for proteins) and their <b>neighbours</b>: words that score at least T against them.</li>
<li>Read the database once, looking every word up in the table: each match is a <b>hit</b>.</li>
<li>Keep hits with a second hit on the same diagonal nearby (the <b>two-hit</b> rule).</li>
<li><b>Extend</b> those hits in both directions without gaps, until the score drops X below the best: a <b>high-scoring segment pair</b> (HSP).</li>
<li>Judge each HSP by its <b>E-value</b>; redo the good ones as gapped alignments.</li>
</ol>

<h2 id="bl-words">Words and their neighbourhoods</h2>
<p>Exact words would miss most related proteins, which differ at many positions. BLAST also looks for words that are merely <i>similar</i>: every word whose BLOSUM62 score against a query word is at least the threshold <b>T</b>.</p>
{activity("Watch it", [
    task("bl-w1", f'Open {viz("words:pqg")} – the neighbourhood of PQG at T = 13.', auto="viz:end machine=words preset=pqg"),
    task("bl-w2", f'Compare {viz("words:pqg11", "T = 11")} and {viz("words:ail", "AIL at T = 13")}.', auto="viz:end machine=words preset=ail"),
])}
{q("bl-q1", "What does PEG score against PQG? (Use the Score tables tab.)", "<p>15: P–P 7, Q–E 2, G–G 6.</p>", accept=r"^15$")}
{q("bl-q2", "Why can BLAST, at T = 13, find nothing from the query word AIL – not even AIL itself?", "<p>AIL against itself scores only 12 (A–A 4, I–I 4, L–L 4), below 13: common residues have low self-scores in BLOSUM62, so a word of them has no neighbours – not even itself. Hits there must come from other words of the query.</p>")}
{activity("Your turn", [
    task("bl-w3", f'Open {turn("words:pqg")} and score candidate words yourself.', auto="viz:practice machine=words"),
])}

<h2 id="bl-scan">Hits, the two-hit rule and the extension</h2>
<p>A hit is a pair of positions (query, database) where the words match: on a dot plot, a short diagonal stroke. Hits from one real alignment line up on the same diagonal; random hits are scattered and alone. Since 1997, BLAST extends a hit only if another hit lies on the same diagonal within 40 residues – most random hits are skipped, which makes it fast enough to use a lower T (more neighbours, more sensitive). The <b>extension</b> adds one pair at a time to each side and keeps the running score; it stops when the score has fallen more than <b>X</b> below the best seen, and keeps the best stretch.</p>
{activity("Watch it", [
    task("bl-s1", f'Open {viz("blast:main")} – a query against a related protein: the table, the scan, the two hits, the extension and the E-value. Orange cells are hits; grey hits are alone.', auto="viz:end machine=blast preset=main"),
    task("bl-s2", f'Open {viz("blast:unrelated")} – the same query against an unrelated protein.', auto="viz:end machine=blast preset=unrelated"),
])}
{q("bl-q3", "In the first example, why is the hit of PQG at database position 26 – an exact match – not extended?", "<p>It is alone on its diagonal: there is no second hit on the same diagonal within 40 residues, so the two-hit rule skips it. (The real alignment is on another diagonal.)</p>")}
{mcq("bl-q4", "What does the X-drop rule do?", [
    ("It stops the extension when the running score falls more than X below the best score seen so far", True, "A few bad pairs may be followed by good ones, so the extension goes on through small dips – but a long run of negative scores means the similarity has ended."),
    ("It stops the extension at the first pair with a negative score", False, "That would stop at the first mismatch; X lets the extension cross short dips."),
    ("It removes X letters from each end of the alignment", False, "The ends are where the best score was reached, not a fixed number of letters."),
])}
{activity("Your turn", [
    task("bl-s3", f'Open {turn("blast:main")}: decide which database words are hits, and add up the extension.', auto="viz:practice machine=blast"),
])}

<h2 id="bl-e">Is it significant? The E-value</h2>
<p>Any two long sequences have <i>some</i> local alignment with a positive score. Karlin and Altschul (1990) worked out how high the best score of unrelated sequences tends to be: scores of random local alignments follow an <b>extreme-value</b> distribution, and the number of alignments expected by chance with a score of at least S is</p>
{formula(F_EVALUE)}
<p>λ and K depend on the scores and the amino-acid frequencies (for BLOSUM62 with gaps of 11 + 1, λ = 0.267 and K = 0.041). The <b>E-value</b> is an expected number, not a probability: E = 0.01 means a score this good turns up by chance once in a hundred searches of a database this size. The bit score does not depend on the database; the E-value does.</p>
{q("bl-q5", "A hit has E = 0.002 in your search. The database doubles in size. What is its E-value now?", "<p>0.004: E is proportional to the size of the database (n) – twice as many places for a chance match.</p>", accept=r"^0?[.,]004$")}
{q("bl-q6", "Two hits differ by 10 bits. How many times smaller is the E-value of the better one?", "<p>2<sup>10</sup> = 1024 times: E = m n 2<sup>−S′</sup>, so each extra bit halves it.</p>", accept=RE_1024)}

<h2 id="bl-fasta">FASTA</h2>
<p>FASTA (Lipman and Pearson, 1985) also starts from short exact words – <b>k-tuples</b>, 2 letters for proteins and 6 for DNA by default – found with a lookup table. It counts the hits on each diagonal of the dot plot, scores the best diagonal runs with a substitution matrix, joins runs that can be connected with gaps, and finally runs Smith–Waterman in a <b>band</b> around the best diagonal. BLAST and FASTA are variations on one idea: exact matching to find the places, dynamic programming to align them.</p>

<h2 id="bl-blosum">Where the scores come from: BLOSUM and PAM</h2>
<p>A substitution score is a <b>log-odds</b>: how much more (or less) often two residues are aligned in related proteins than they would be by chance. Henikoff and Henikoff (1992) counted the pairs in some 2,000 <b>blocks</b> – ungapped stretches of aligned protein families. For BLOSUM62, sequences 62% identical or more were merged first, so that close relatives do not dominate; BLOSUM80 suits closer relatives, BLOSUM45 more distant ones. The older <b>PAM</b> matrices (Dayhoff et al., 1978) were built the other way round: from very similar sequences, extrapolated to longer evolutionary distances (PAM250 for distant relatives).</p>
{activity("Watch it", [
    task("bl-b1", f'Open {viz("blosum:block")} – counting the pairs of a block of five sequences, column by column, then the log-odds scores.', auto="viz:end machine=blosum"),
])}
{q("bl-q7", "The last column of the block reads K R K R R. How many K–R pairs does it contain, and how many pairs in all? (Two numbers.)", "<p>6 K–R pairs (2 K × 3 R) of 10 in all (5 × 4 / 2): also 1 K–K and 3 R–R.</p>", accept=r"^6[^0-9]+10$")}
{q("bl-q8", "How many pairs does the whole block (5 sequences, 6 columns) have?", "<p>60: 6 columns × 10 pairs per column. In general w × s(s − 1)/2 for w columns and s sequences.</p>", accept=r"^60$")}
{activity("Your turn", [
    task("bl-b2", f'Open {turn("blosum:block")} and count the pairs of two columns yourself.', auto="viz:practice machine=blosum"),
])}

<h2 id="bl-tools">In real tools</h2>
{tools(
    ("<code>blastp</code>", "Words of 3, threshold T = 11, BLOSUM62, gaps 11 + 1 per residue, two hits within 40 residues."),
    ("<code>blastn</code>", "Its default task, megablast, uses exact words of 28 letters and scores +1/−2 – for very similar sequences. <code>-task blastn</code> uses words of 11 and +2/−3, for more distant ones."),
    ("<code>blastx</code>, <code>tblastn</code>, <code>tblastx</code>", "Translate DNA in all six reading frames, because protein similarity lasts longer through evolution than DNA similarity."),
    ("PSI-BLAST", "Builds a profile (a position-specific scoring matrix, chapter 11) from its first hits and searches again with it, round after round – finding more distant relatives."),
    ("FASTA (<code>fasta36</code>)", "k-tuples (2 for proteins, 6 for DNA), diagonals, then banded Smith–Waterman."),
)}
{keypoints(
    "BLAST: neighbourhood words (score ≥ T) in a lookup table → one scan of the database → hits → two hits on a diagonal → ungapped X-drop extension → HSP → E-value → gapped alignment.",
    "A lower T or a smaller word means more hits: more sensitive, slower.",
    "E = K m n e^(−λS): the number of hits at least this good expected by chance; it grows with the size of the database and halves with each extra bit.",
    "Substitution scores are log-odds of pair frequencies in related proteins (BLOSUM from blocks, PAM from close relatives).",
)}
'''
    return chapter('blast', 8, 'BLAST and FASTA', 'viz', 'Searching databases: BLAST', 40,
                   'Smith–Waterman against a whole database would take far too long – and almost every sequence in it is unrelated to the query anyway. BLAST finds the few worth aligning by looking first for short words the query and the database share, then extends only those hits, and finally asks how likely such a match is by chance.', body)


# ======================================================================
# 9. Read mappers
# ======================================================================
def ch_mappers():
    body = f'''
<h2 id="m-plan">Seed, chain, extend</h2>
<p>A sequencing run gives hundreds of millions of reads; each must be placed on a genome of billions of letters, allowing for sequencing errors and real differences. Every modern mapper does it in three steps:</p>
<ol class="plain">
<li><b>Seed</b>: find short exact matches between the read and the genome, with an index made once (an FM-index, chapter 5, or a hash table of k-mers, chapter 2).</li>
<li><b>Chain</b>: seeds from the read’s true place lie on one diagonal, in the same order in read and genome; group them, and pick the best group.</li>
<li><b>Extend</b>: align the whole read there by dynamic programming (chapters 6 and 7), in a narrow band – the only place where the full alignment is computed.</li>
</ol>
<p>Why exact seeds work: a few errors cannot break up a read everywhere. A 100-base read with 3 differences has at most 4 stretches without one, and 97 letters to share between them – so at least one stretch of 25 or more letters matches exactly (the pigeonhole principle again).</p>
{q("m-q1", "A 150-base read differs from the genome at 4 positions. How long a stretch without a difference must it contain, at least?", "<p>30: the 4 differences cut the read into at most 5 stretches holding 146 matching letters, so one of them has at least ⌈146/5⌉ = 30.</p>", accept=r"^30$")}

<h2 id="m-watch">One read, all the way</h2>
{activity("Watch it", [
    task("m-w1", f'Open {viz("mapper:del")} – a read with one base missing. The plot has the read down the side and the reference across the top: each seed found in the reference is a short diagonal stroke (an <b>anchor</b>).', auto="viz:end machine=mapper preset=del"),
    task("m-w2", f'Try {viz("mapper:ins", "an insertion")} and {viz("mapper:snp", "a substitution, with minimizer seeds")}. How does each difference show in the plot, and in the CIGAR?', auto="viz:end machine=mapper preset=snp"),
    task("m-w3", f'Open {viz("mapper:repeat")} – a read from a sequence that occurs twice.', auto="viz:end machine=mapper preset=repeat"),
])}
{q("m-q2", "The CIGAR of the first read is 16M1D7M. Read it in words.", "<p>16 bases aligned (matching or not), then 1 base of the reference that the read lacks (a deletion), then 7 more aligned bases. The read is 23 bases long and covers 24 of the reference.</p>")}
<p>Careful with the names: SAM writes the edits from the reference’s side – <b>I</b> is a letter of the read that the reference lacks, <b>D</b> a letter of the reference missing from the read. The edit transcripts of chapter 6, with the read as sequence 1, called these the other way round (a letter of sequence 1 against a gap was D).</p>
{q("m-q3", "In the plot, how does a deletion in the read show? (Compare the strokes before and after it.)", "<p>The strokes after it lie on a diagonal one column further to the right: from there on, reference position − read position is one larger, because the reference has a letter the read lacks. An insertion shifts the diagonal the other way.</p>")}
{activity("Your turn", [
    task("m-w4", f'Open {turn("mapper:del")} and work out where the read starts from the best chain.', auto="viz:practice machine=mapper"),
])}

<h2 id="m-min">Fewer seeds: minimizers</h2>
<p>Indexing every k-mer of a genome takes a lot of memory, and a read gives many seeds that say the same thing. A <b>minimizer</b> scheme keeps one k-mer from every window of w consecutive k-mers: the smallest by some order. Neighbouring windows mostly agree, so only about 2/(w + 1) of the k-mers are kept – yet a read and the genome choose the <b>same</b> minimizers wherever they share a long enough stretch. minimap2 indexes only minimizers; it orders k-mers by a scrambled number rather than the alphabet, so that runs like AAAA… do not win every window.</p>
{activity("Watch it", [
    task("m-z1", f'Open {viz("minimizer:abc")}, then {viz("minimizer:hash", "the scrambled order")} and {viz("minimizer:polyA", "a run of A’s")}.', auto="viz:end machine=minimizer preset=polyA"),
])}
{q("m-q4", "About what fraction of the k-mers are kept as minimizers with w = 10 (minimap2’s default)?", "<p>About 2/11, a little under one in five: 2/(w + 1).</p>", accept=RE_MINIMIZER_FRACTION)}
{activity("Your turn", [
    task("m-z2", f'Open {turn("minimizer:abc")} and pick the minimizer of each window.', auto="viz:practice machine=minimizer"),
])}

<h2 id="m-mapq">Mapping quality</h2>
<p>A read from a repeat fits several places equally well, and the mapper cannot know which is right. It still reports one place, with a <b>mapping quality</b> (MAPQ): −10 log<sub>10</sub> of the probability that the place is wrong, worked out from how much better the best alignment is than the second best. MAPQ 30 means a 1-in-1,000 chance of being wrong; a read with two equally good places gets 0 (BWA) or 0–1 (Bowtie 2). Variant callers ignore reads of low MAPQ – which is why variants in repeats are hard to find with short reads.</p>
{mcq("m-q5", "A read has MAPQ 20. What does that mean?", [
    ("The mapper thinks there is a 1 in 100 chance that the read is in the wrong place", True, "10^(−20/10) = 0.01."),
    ("The read has 20 mismatches", False, "That would be its edit distance (the NM tag)."),
    ("The read’s bases have an average quality of 20", False, "Base qualities are in the FASTQ file; MAPQ is about the position."),
])}

<h2 id="m-tools">The mappers</h2>
{tools(
    ("BWA-MEM", "Seeds: the longest exact matches between the read and the genome (SMEMs, at least 19 bases), found with the FM-index of the genome. Chains nearby seeds, then extends them with banded Smith–Waterman (match 1, mismatch −4, gap 6 + 1 per base). For reads of 70 bases to 1 Mbp."),
    ("Bowtie 2", "Seeds: substrings of 22 bases taken from the read at intervals (and from its reverse complement), looked up exactly in the FM-index. Extends the most promising with dynamic programming, end to end by default."),
    ("minimap2", "Seeds: minimizers (k = 15, w = 10 by default; k = 21, w = 11 for short reads with <code>-x sr</code>), looked up in a hash table. Chains the anchors by dynamic programming, then aligns between and beyond them with affine gaps. Made for long reads, works for short ones."),
    ("HISAT2, STAR (RNA-seq)", "Reads from mRNA can span an intron, so one part of the read maps here and the rest thousands of bases away: spliced alignment. HISAT2 uses FM-indexes; STAR finds the longest exactly matching prefix of the read with a suffix array, then the rest."),
)}
{keypoints(
    "Every mapper: seed (exact matches from an index), chain (anchors on one diagonal, in order), extend (banded dynamic programming of the whole read).",
    "Indels shift the diagonal of the anchors; the CIGAR records them (M aligned, I extra in the read, D missing from it).",
    "Minimizers keep about 2/(w + 1) of the k-mers, and the read and the genome pick the same ones.",
    "MAPQ = −10 log₁₀ P(wrong place); a read with two equally good places gets 0 (BWA).",
)}
'''
    return chapter('mappers', 9, 'Read mappers', 'viz', 'Mapping reads: BWA-MEM, Bowtie 2 and minimap2', 35,
                   'A mapper puts each of millions of reads where it came from in the genome, allowing for errors and real differences – in minutes. Whatever the tool, the plan is the same: find short exact seeds with an index, chain the seeds that agree, and run dynamic programming only there. They differ in how they find the seeds.', body)


# ======================================================================
# 10. Multiple alignment
# ======================================================================
RE_6_5 = r"^6[.,]5$"
RE_7_25 = r"^(7[.,]25|29 ?/ ?4)$"
RE_ROOT = r"(^|[^0-9])3[.,]8(3[0-9]*)?[^0-9]+2[.,]3(3[0-9]*)?([^0-9]|$)"
RE_MINUS_8 = r"^(-|−|–) ?8$"
STAR_ROWS = ['AVSSQQA-VV', 'AV-QQAAVVV', 'AVQVVQ--VV', 'AVVSQQS-AV']


def ch_msa():
    body = f'''
<h2 id="ms-why">Why not dynamic programming?</h2>
<p>A multiple alignment puts related sequences in columns of corresponding letters, with gaps where some lack letters the others have. It shows what a family has kept – active sites, the core of the fold, binding motifs – and it is where profiles (chapter 11) and trees of evolution start.</p>
{msafig(STAR_ROWS, protein=True, marks='**       *', caption='Four short proteins aligned (the example of this chapter). * marks a column where all are identical.')}
<p>For two sequences, dynamic programming fills a matrix of (m&nbsp;+&nbsp;1)(n&nbsp;+&nbsp;1) cells. For three it fills a box, and each cell has 7 neighbours to consider instead of 3; for N sequences of length L, about L<sup>N</sup> cells with 2<sup>N</sup> − 1 neighbours each. The exact answer is out of reach beyond a handful of sequences, so every program builds a multiple alignment from <b>pairwise</b> alignments, done in a well-chosen order. The result is good, but not guaranteed to be the best.</p>
{mcq("ms-q1", "Dynamic programming on 10 sequences of 100 letters would fill a box of about how many cells?", [
    ("About 1,000 (10 × 100)", False, "That counts the letters, not the cells: every combination of positions, one in each sequence, is a cell."),
    ("About 10<sup>20</sup> (100<sup>10</sup>)", True, "One axis per sequence: 100 × 100 × … ten times. At a billion cells a second that would take some three thousand years."),
    ("About 10<sup>4</sup> (100 × 100)", False, "That is two sequences; each further sequence multiplies the cells by about 100."),
])}

<h2 id="ms-sp">A score for a multiple alignment: the sum of pairs</h2>
<p>To say which of two multiple alignments is better, each column gets a score: the <b>sum of pairs</b> (SP). Every pair of letters in the column is looked up in a substitution table, a letter against a gap scores as a gap, and a gap against a gap scores 0 (neither sequence has a letter there, so the pair says nothing). The score of the alignment is the total over its columns.</p>
{q("ms-q2", "With BLOSUM62, what is the sum-of-pairs score of a column A A S A? (Score tables tab.)", "<p>15: four letters make 6 pairs – three A–A pairs (4 each) and three A–S pairs (1 each).</p>", accept=r"^15$")}
{q("ms-q3", "And of a column A V A –, with −4 for a letter against a gap?", "<p>−8: A–V 0, A–A 4, V–A 0, and three letters against the gap, −4 each.</p>", accept=RE_MINUS_8)}
<p>Near-identical sequences would dominate the score: ten copies of almost the same sequence make 45 pairs that all agree. ClustalW therefore gives each sequence a <b>weight</b>, and close relatives share theirs.</p>

<h2 id="ms-star">Star alignment</h2>
<p>The simplest plan: find the sequence most similar to all the others – the <b>centre</b> – align every other sequence to it, and merge the pairwise alignments through the centre. Merging follows one rule: <b>once a gap, always a gap</b>. When a pairwise alignment puts a gap into the centre, that gap becomes a column of the multiple alignment, and every sequence already merged gets a gap in it too.</p>
{activity("Watch it", [
    task("ms-w1", f'Open {viz("msa:star")} – four short proteins. First every pair is aligned and its identity (the % of identical columns) goes into the table; then the centre is chosen and the others are merged onto it.', auto="viz:end machine=msa preset=star"),
])}
{q("ms-q4", "Which sequence is the centre, and why that one?", "<p>a: its identities with b, c and d (60, 56 and 67%) add up to the most, 183. (b: 171, c: 156, d: 166.)</p>")}
{q("ms-q5", "In the merged alignment, d has a gap in column 8, although its own alignment with a has no gap at all. Where does that gap come from?", "<p>From b: aligning b to the centre put a gap into a (AVSSQQA-VV). Once a gap, always a gap – that column is now part of the multiple alignment, and every other row needs something in it, so d gets a gap.</p>")}

<h2 id="ms-tree">A guide tree: UPGMA</h2>
<p>Usually no single sequence sits in the middle: the sequences fall into groups. Progressive alignment (next section) aligns the closest sequences first and then the groups, in the order of a <b>guide tree</b>, built from the <b>distances</b> between the sequences – for example 1 − identity. The simplest way to build it is <b>UPGMA</b> (the unweighted pair-group method with arithmetic mean):</p>
<ol class="plain">
<li>Find the two closest clusters (at first, each sequence is a cluster of its own) and join them, at a height of half their distance.</li>
<li>In the table, replace them by the new cluster. Its distance to each other cluster is the <b>average</b> of the distances between their members.</li>
<li>Repeat until one cluster is left: the root of the tree.</li>
</ol>
{activity("Watch it", [
    task("ms-t1", f'Open {viz("upgma:five")} – five sequences, a to e, and the distances between them.', auto="viz:end machine=upgma preset=five"),
])}
{q("ms-q6", "After a and b are joined, what is the distance from (a,b) to c?", "<p>6.5: the average of d(a, c) = 7 and d(b, c) = 6.</p>", accept=RE_6_5)}
{q("ms-q7", "When c and d are joined too, what is the distance between (a,b) and (c,d)?", "<p>7.25: the average of the four distances a–c 7, a–d 8, b–c 6 and b–d 8, which is 29/4.</p>", accept=RE_7_25)}
{q("ms-q8", "At what height is the root, and how long is the branch from (a,b) up to it? (Two numbers.)", "<p>The last join is (a,b) with ((c,d),e), at the average of the six distances 7, 8, 10, 6, 8 and 7: 46/6 = 7.67. The root is at half that, 3.83. (a,b) sits at 1.5, so its branch is 3.83 − 1.5 = 2.33.</p>", accept=RE_ROOT)}
{mcq("ms-q9", "In a UPGMA tree all the leaves end at the same level. What does that assume about evolution?", [
    ("That every lineage changes at the same rate (a molecular clock)", True, "Each join is placed at half the distance, as if both sides had changed equally. When rates differ, UPGMA can join the wrong pair; neighbour-joining does not assume a clock."),
    ("That the sequences all have the same length", False, "Sequences of any length can be compared: the distances come from their alignments."),
    ("That the oldest sequence is the root", False, "The root is the last join, not one of the sequences."),
])}
{activity("Your turn", [
    task("ms-t2", f'Open {turn("upgma:five")}: click the smallest distance and work out the new distances for the first joins, then watch the rest.', auto="viz:practice machine=upgma"),
])}
<p><b>Neighbour-joining</b> (Saitou and Nei, 1987) is the other common method, and the one ClustalW uses. It starts from a star-shaped tree and repeatedly joins the pair of neighbours that makes the total length of the tree smallest, without assuming a clock. MUSCLE and Clustal Omega build their guide trees with UPGMA. A guide tree only has to give a good order of joins; trees meant to show evolution are built with more careful methods (maximum parsimony, maximum likelihood).</p>

<h2 id="ms-prog">Progressive alignment</h2>
<p>Progressive alignment (Feng and Doolittle, 1987; Higgins and Sharp, 1988) follows the guide tree from the leaves to the root. At each node it aligns the two things below it: two sequences, a sequence and a group, or two groups. A group is aligned as a whole, as a <b>profile</b> – a series of columns. A letter against a column scores the average of its scores against the letters of the column; a column against a column, the average over all the pairs between them. A gap put into a group goes into all of its rows, and the gaps already in a group stay: once a gap, always a gap.</p>
{activity("Watch it", [
    task("ms-p1", f'Open {viz("msa:pairs")} – two pairs of related DNA sequences. The guide tree joins a with b and c with d; then the two pairs are aligned as groups.', auto="viz:end machine=msa preset=pairs"),
    task("ms-p2", f'Now open {viz("msa:pairsStar", "the same sequences by the star method")}, and compare the two alignments and their sum-of-pairs scores.', auto="viz:end machine=msa preset=pairsStar"),
])}
{q("ms-q10", "The progressive alignment scores 28, the star alignment 25. Where do they differ, and why did the star method do worse?", "<p>In b’s row. The star method aligned b to the centre, c, on its own – and there were three equally good ways to do that (GATT-C-CAGT, GATT-CC-AGT and GATTCC--AGT). It took the first, with gaps in two places, not knowing that a, the sequence most like b, has its gap after GATTAC. Progressive alignment aligned a and b with each other first, then the pair as one profile against (c,d), so b’s gaps went into the same columns as a’s.</p>")}
{activity("Your turn", [
    task("ms-p3", f'Open {turn("msa:progressive")} – the four proteins again. Choose the pair that is aligned first, then score a column of the result.', auto="viz:practice machine=msa"),
])}

<h2 id="ms-better">Doing better</h2>
<p>Progressive alignment is fast, but a mistake made early – a gap in the wrong place, a wrong join in the guide tree – is locked in. Programs improve on it in three ways:</p>
<ul>
<li><b>Iterative refinement</b>: cut the finished alignment in two along a branch of the tree, realign the two parts as profiles, and keep the result if the sum of pairs improves; repeat (MUSCLE; MAFFT’s FFT-NS-i).</li>
<li><b>Consistency</b>: before aligning, collect the alignments of every pair (global and local); when two sequences or groups are aligned, prefer the columns the other pairs agree with (T-Coffee, MAFFT’s L-INS-i, ProbCons and MUSCLE 5).</li>
<li><b>Hidden Markov models</b>: align groups as profile HMMs (chapter 11), which score each gap by where it falls (Clustal Omega).</li>
</ul>
<p>The result is written as FASTA with gaps (often <code>.afa</code>) or in Clustal format: blocks of columns with marks underneath – <b>*</b> all identical, <b>:</b> strongly similar, <b>.</b> weakly similar. Viewers such as Jalview colour the residues by kind, as the tiles here, and plot the conservation of each column.</p>

<h2 id="ms-tools">In real tools</h2>
{tools(
    ("ClustalW", "Aligns every pair; distances from their identities; a neighbour-joining guide tree; progressive alignment with sequence weights, and gap penalties lowered where gaps already are (and raised next to them)."),
    ("Clustal Omega (<code>clustalo</code>)", "Distances from shared k-tuples, worked out against a small sample of the sequences rather than for every pair (mBed); a UPGMA guide tree; progressive alignment of profile hidden Markov models (HHalign). Aligns hundreds of thousands of sequences."),
    ("MUSCLE", "Version 3: k-mer distances, a UPGMA tree and a draft progressive alignment; distances from the draft, a second tree and realignment; then iterative refinement. Version 5 makes an ensemble of alignments with varied parameters and guide trees, which shows how reliable each column is."),
    ("MAFFT", "Finds similar segments quickly with the fast Fourier transform; a first guide tree from shared 6-mers and a quick alignment, then a second tree from that alignment and the final progressive alignment (FFT-NS-2). FFT-NS-i refines iteratively; L-INS-i, among the most accurate for up to about 200 sequences, adds consistency from local pairwise alignments."),
    ("T-Coffee", "Builds a library of global and local pairwise alignments and aligns progressively, favouring columns the library agrees on (consistency)."),
)}
{keypoints(
    "Exact multiple alignment needs about L<sup>N</sup> cells, so programs build it from pairwise alignments.",
    "The sum of pairs scores a column by all its pairs: substitution scores, a gap against a letter, 0 for gap against gap.",
    "Star alignment merges every sequence onto a centre; progressive alignment follows a guide tree (UPGMA, neighbour-joining) and aligns groups as profiles.",
    "Once a gap, always a gap: early mistakes stay – iterative refinement and consistency repair some of them.",
)}
'''
    return chapter('msa', 10, 'Multiple alignment', 'viz', 'Multiple alignment: Clustal, MUSCLE and MAFFT', 40,
                   'BLAST finds the relatives of a sequence; a multiple alignment lines them all up, column by column, to show what the family has kept. Clustal, MUSCLE and MAFFT cannot afford the exact answer, so they build it from pairwise alignments: score every pair, build a guide tree, and align along it.', body)


# ======================================================================
# 11. Profiles and hidden Markov models
# ======================================================================
RE_0875 = r"^(0?[.,]875|0?[.,]88|7/8)$"
RE_M158 = r"^- ?1[.,](58[0-9]*|59|6)$"
RE_M274 = r"^- ?2[.,](74?|73[5-9][0-9]*)$"
RE_PATH_GGC = r"^(\+ ?){3}(- ?){5}-$"
RE_0144 = r"^0?[.,]144$"
F_LOGODDS = "p(a) = (count(a) + 1) / (N + 4)       add 1 to every count\nscore(a) = log2( p(a) / 0.25 )        0.25: random DNA"
F_VITERBI = "V[k][i] = log2 e_k(x_i) + max_j ( V[j][i−1] + log2 a(j→k) )\nmax_j: the largest over the states j\ne_k(x): the chance that state k emits letter x\na(j→k): the chance that state j is followed by state k"


def ch_hmm():
    body = f'''
<h2 id="hm-prof">One score table per position: profiles</h2>
<p>BLOSUM62 scores an isoleucine against a leucine the same wherever they meet. A family of proteins – or of binding sites in DNA – knows better: at some positions every member has the same letter, at others almost anything goes. A <b>profile</b> (a position-specific scoring matrix, PSSM) is built from an alignment of the family and gives every position its own column of scores:</p>
<ol class="plain">
<li><b>Count</b> the letters in each column, and divide by the number of sequences: the <b>frequencies</b>.</li>
<li>Add <b>pseudocounts</b>, so that no letter has a probability of exactly 0 (next section).</li>
<li>Turn each probability into a <b>log-odds score</b>: log2 of how much more common the letter is at this position than in random sequence – the same kind of number as a BLOSUM score.</li>
</ol>
{formula(F_LOGODDS)}
<p>To search a sequence, slide the profile along it: each window scores the sum of its letters’ scores, each looked up in its own column.</p>
{activity("Watch it", [
    task("hm-w1", f'Open {viz("profile:tata")} – eight TATA boxes, the binding sites of a protein that starts transcription, then a sequence scanned with their profile.', auto="viz:end machine=profile preset=tata"),
])}
{q("hm-q1", "What is the frequency of T in column 1?", "<p>0.875: 7 of the 8 sites have T there (the other has C).</p>", accept=RE_0875)}
{q("hm-q2", "Column 2 has A in all 8 sites. With pseudocounts, what is the score of C there?", "<p>−1.58: p = (0 + 1) / (8 + 4) = 0.083, and log2(0.083 / 0.25) = log2(1/3) = −1.58. C is a third as likely there as in random DNA – but not impossible.</p>", accept=RE_M158)}
{q("hm-q3", "The window at position 14, TATATC, starts like a TATA box but scores 3.83, against 8.64 for TATAAA at position 4. Which columns cost it most?", "<p>The last two: T in column 5 scores −0.58 (A would score 1.42) and C in column 6 scores −1.58 (A: 1.22). The first four letters score the same in both windows.</p>")}
{activity("Your turn", [
    task("hm-w2", f'Open {turn("profile:tata")}: count a column, work out a score, then add up a window.', auto="viz:practice machine=profile"),
])}

<h2 id="hm-pc">Why pseudocounts?</h2>
<p>Eight sequences are a small sample. A letter that none of them has at a position may still occur there in other members of the family. Without pseudocounts its probability is 0, and its score log2(0) = −∞: a single such letter rules a window out, however well the rest of it fits.</p>
{activity("Watch it", [
    task("hm-w3", f'Open {viz("profile:nopc")} – the same profile without pseudocounts, scanning another sequence.', auto="viz:end machine=profile preset=nopc"),
    task("hm-w4", f'Then {viz("profile:pc", "the same sequence with pseudocounts")}.', auto="viz:end machine=profile preset=pc"),
])}
{q("hm-q4", "Without pseudocounts, the window TATAAC (at position 3) scores −∞, and the best window is CATTAA. With them, TATAAC is the best. Why the difference?", "<p>None of the eight sites has C in column 6, so without pseudocounts C has probability 0 there and the whole window scores −∞ – although its other five letters fit perfectly. With pseudocounts C only costs −1.58, and TATAAC scores 5.83. CATTAA, with two rare letters but no unseen one, wins only when unseen letters are forbidden.</p>")}

<h2 id="hm-psi">PSI-BLAST: profiles for searching</h2>
<p>PSI-BLAST (position-specific iterated BLAST) turns a BLAST search into a profile search. A first search uses BLOSUM62; the hits with a small enough E-value (0.002 by default) are aligned with the query, and a profile is built from them – pseudocounts included. The database is searched again with the profile, which catches relatives that BLOSUM62 missed; their sequences go into the next profile, and so on – for a set number of rounds, or until no new sequences turn up. It finds much more distant relatives than BLAST – but one wrong sequence let in can lead the profile astray in later rounds.</p>
{activity("Watch it", [
    task("hm-w5", f'Open {viz("profile:protein")} – a block of five related proteins. The frequencies of column 1 are {{K: 0.8, N: 0.2}}: a profile is just such a table per position.', auto="viz:end machine=profile preset=protein"),
])}

<h2 id="hm-hmm">Hidden Markov models</h2>
<p>A profile treats each column on its own, with no place for insertions and deletions. A <b>hidden Markov model</b> (HMM) adds them. It is a set of <b>states</b>, each of which <b>emits</b> letters with its own probabilities, and <b>transitions</b> between the states, each with a probability. A path through the states produces a sequence. We see the sequence, but not the path: the states are <b>hidden</b>.</p>
<p>A small example: DNA in a CpG island is rich in C and G. An HMM with two states, + (emits C and G more often) and − (emits A and T more often), can say which stretches of a sequence probably came from which. Three questions can be asked of an HMM:</p>
<ul>
<li><b>Decoding</b>: which path of states most probably produced the sequence? The <b>Viterbi</b> algorithm.</li>
<li><b>Evaluation</b>: how probable is the sequence under the model, over all paths? The <b>forward</b> algorithm.</li>
<li><b>Learning</b>: which probabilities make a set of sequences most probable, when their paths are unknown? The <b>Baum–Welch</b> algorithm (training).</li>
</ul>
<p>Viterbi is dynamic programming, like the alignment matrices of chapter 6: a matrix of states × letters, filled from left to right. Each cell keeps the best way to reach that state at that letter, and remembers where it came from; the answer is traced back from the last column. Probabilities are multiplied along a path, and a product of hundreds of small numbers would be too small for a computer to store, so the cells hold log2 probabilities, which are added.</p>
{formula(F_VITERBI)}
{activity("Watch it", [
    task("hm-w6", f'Open {viz("viterbi:classic")} – the most probable path of states for GGCACTGAA.', auto="viz:end machine=viterbi preset=classic"),
    task("hm-w7", f'Try {viz("viterbi:island", "a GC-rich stretch in AT-rich DNA")}.', auto="viz:end machine=viterbi preset=island"),
])}
{q("hm-q5", "What is V+(1), the first cell of the + row? (log2 0.5 = −1, log2 0.3 = −1.74.)", "<p>−2.74: log2 start(+) + log2 e+(G) = −1 + (−1.74).</p>", accept=RE_M274)}
{q("hm-q6", "Which path of states does Viterbi give for GGCACTGAA? (One + or − per letter.)", "<p>+++−−−−−−: GGC from the + state, ACTGAA from the − state. Its probability is 2<sup>−24.49</sup>.</p>", accept=RE_PATH_GGC)}
{activity("Your turn", [
    task("hm-w8", f'Open {turn("viterbi:classic")}: fill the first cells, then trace the path back.', auto="viz:practice machine=viterbi"),
])}
{mcq("hm-q7", f'Open {viz("viterbi:forward", "the forward algorithm")} on the same sequence. How does it differ from Viterbi?', [
    ("It adds up the probabilities of the paths into each cell instead of keeping the best, giving the probability of the sequence over all paths", True, "Forward answers the evaluation question: how well does the sequence fit the model at all? HMMER scores sequences this way."),
    ("It goes through the sequence from right to left", False, "That is the backward algorithm, used with forward to train models and to give the probability of each state at each letter."),
    ("It finds the same path as Viterbi, faster", False, "It finds no path at all: it sums over all of them."),
])}
<p>Because forward adds probabilities, it cannot simply add logs as Viterbi does. Programs rescale each column of the matrix so that the numbers stay in range, or add the logs with care (the log-sum-exp trick).</p>

<h2 id="hm-phmm">Profile HMMs</h2>
<p>A <b>profile HMM</b> is a profile turned into an HMM, built from a multiple alignment. Each column with letters in at least half of the sequences becomes a <b>match</b> state, which emits the letters of its column with their frequencies. Under each match state is a <b>delete</b> state, silent, for a gap in that column; between neighbouring match states is an <b>insert</b> state, for extra letters. Each sequence of the alignment is a path through the states; counting how often the paths take each arrow gives the transition probabilities.</p>
{activity("Watch it", [
    task("hm-w9", f'Open {viz("phmm:family")} – five aligned sequences become a model, and a new sequence, TCGW, is scored by its most probable path.', auto="viz:end machine=phmm preset=family"),
    task("hm-w10", f'Score more sequences: {viz("phmm:insert", "ACGGF")}, {viz("phmm:deletion", "TCW")} and {viz("phmm:nopath", "TGGF")}.', auto="viz:end machine=phmm preset=nopath"),
])}
{q("hm-q8", "Why does column 4 of the alignment become an insert state, not a match state?", "<p>Only 1 of its 5 sequences (TCGGF) has a letter there – fewer than half. That G is treated as an extra letter, emitted by the insert state I3.</p>")}
{q("hm-q9", "What is the probability of TCGW along its path B → M1 → M2 → M3 → M4 → E?", "<p>0.144: the transitions B→M1 1, M1→M2 1, M2→M3 0.8, M3→M4 0.75, M4→E 1, times the emissions T at M1 0.6, C at M2 1, G at M3 1, W at M4 0.4. That is 0.6 × 0.8 × 0.75 × 0.4 = 0.144.</p>", accept=RE_0144)}
{q("hm-q10", "TGGF has no path through the model at all. Why – and what do real tools do about it?", "<p>After T (M1), the only way on is to M2, which only ever emitted C – so no path emits G next, and the probability is 0. Real tools add pseudocounts (HMMER uses mixture Dirichlet priors: amino-acid distributions typical of alignment columns), so that every letter and every arrow has some small probability.</p>")}
{activity("Your turn", [
    task("hm-w11", f'Open {turn("phmm:family")}: classify a column, work out an emission and a transition, find a delete state, and multiply along a path.', auto="viz:practice machine=phmm"),
])}

<h2 id="hm-tools">In real tools</h2>
{tools(
    ("PSI-BLAST (<code>psiblast</code>)", "Builds a position-specific scoring matrix from the hits of each round (E-value below 0.002 by default) and searches again with it."),
    ("HMMER (<code>hmmbuild</code>, <code>hmmsearch</code>, <code>hmmscan</code>, <code>jackhmmer</code>)", "Builds profile HMMs from alignments (by default a match state for each column with letters in at least half of the sequences), with pseudocounts from mixture Dirichlet priors. Scores sequences in bits with the forward algorithm, after fast filters that discard most of the database. <code>jackhmmer</code> iterates, like PSI-BLAST."),
    ("Pfam", "More than 20,000 protein families and domains, each a profile HMM built from a curated seed alignment and searched with HMMER. Its families are browsed through the InterPro website."),
    ("AUGUSTUS, GlimmerHMM, SNAP", "Gene finders: HMMs whose states are exons, introns, splice sites and the DNA between genes; Viterbi decoding labels a genome."),
    ("Clustal Omega, HH-suite", "Align profile HMMs with each other (HHalign) – for multiple alignment (chapter 10) and for finding very distant relatives."),
)}
{keypoints(
    "A profile has a column of scores per position: counts → frequencies → pseudocounts → log2(p / background).",
    "Pseudocounts keep unseen letters possible; without them one unseen letter scores −∞.",
    "An HMM has hidden states that emit letters and transitions between them. Viterbi finds the most probable path (max), forward the probability over all paths (sum) – both dynamic programming.",
    "A profile HMM has match, insert and delete states, built from a multiple alignment; HMMER and Pfam use them to find protein families.",
)}
'''
    return chapter('hmm', 11, 'Profiles and HMMs', 'viz', 'Profiles and hidden Markov models: PSI-BLAST, HMMER and Pfam', 45,
                   'BLOSUM62 scores a pair of amino acids the same wherever it falls. A protein family knows better: some positions never change, others vary freely. Profiles give every position its own scores; hidden Markov models add the chances of insertions and deletions – and power HMMER, Pfam and gene finders.', body)


# ======================================================================
# 12. k-mers and sketches
# ======================================================================
RE_0692 = r"^(0?[.,]69(2[0-9]*)?|9 ?/ ?13)$"
RE_0625 = r"^(0?[.,]625?|5 ?/ ?8)$"
RE_10000 = r"^(about |~ ?)?(10[ ,.]?000|10 ?\^ ?4|10⁴|1e4)$"
F_JACCARD = "J(A, B) = |A ∩ B| / |A ∪ B|\n         = the k-mers in both / the k-mers in either"
F_BLOOM = "P(false positive) ≈ (1 − e^(−h·n/m))^h\nn: k-mers in the filter, m: bits, h: hash functions"


def ch_kmers():
    body = f'''
<h2 id="km-bag">k-mers: a bag of words</h2>
<p>A sequence of length N has N − k + 1 overlapping k-mers. Put them in a set and their order is lost – a “bag of words” – but each k-mer still keeps the order of its own k letters. The longer k, the more different k-mers are possible (4<sup>k</sup> for DNA), and the more a k-mer says about where it came from: in a random sequence the length of a human genome, a given 16-mer is expected about once, and most 31-mers of a real genome occur only once.</p>
<p>k-mers have already appeared several times: as the words of a hash-table index (chapter 2), the seeds of BLAST and of read mappers (chapters 8 and 9), and the minimizers of minimap2 (chapter 9). Assemblers join reads through the k-mers they share (de Bruijn graphs), and k-mer counts expose sequencing errors, which make rare k-mers. This chapter uses them to compare sequences <b>without aligning them</b>.</p>
{q("km-q1", "How many 21-mers does a read of 100 bases have?", "<p>80: 100 − 21 + 1. (Out of 4<sup>21</sup> ≈ 4.4 × 10<sup>12</sup> possible 21-mers.)</p>", accept=r"^80$")}

<h2 id="km-jac">Jaccard similarity</h2>
<p>Two sequences are similar if they share many k-mers. The <b>Jaccard similarity</b> of two sets compares what they share with what they hold together:</p>
{formula(F_JACCARD)}
<p>J = 1 for identical sets and 0 for sets with nothing in common. It takes one pass through each sequence, however long – no matrix, no alignment – so whole genomes, or millions of reads, can be compared in seconds.</p>
{activity("Watch it", [
    task("km-w1", f'Open {viz("kmers:snp")} – two sequences that differ in one letter, cut into 3-mers.', auto="viz:end machine=kmers preset=snp"),
    task("km-w2", f'Compare {viz("kmers:snp4", "the same with k = 4")}, {viz("kmers:shuffled", "the same letters in another order")} and {viz("kmers:other", "two unrelated sequences")}.', auto="viz:end machine=kmers preset=other"),
])}
{q("km-q2", "What is J for the two sequences with one difference, with k = 3?", "<p>9 / 13 = 0.692: 9 k-mers shared, 1 only in A (GCA), 3 only in B (TGG, GGA, GAT).</p>", accept=RE_0692)}
{q("km-q3", "With k = 4, J falls to 7/15 = 0.467 for the same single difference. Why does a larger k give a lower J?", "<p>A changed letter alters every k-mer that covers it – up to k of them in each sequence. With k = 3, two of the three changed 3-mers of A (TGC and CAT) also occur elsewhere in A, so A loses only GCA, and B gains TGG, GGA and GAT: 9 shared out of 13. With k = 4 all four changed 4-mers are unique: 4 only in A and 4 only in B, so 7 shared out of 15. Larger k makes k-mers more specific, but also more easily broken by differences: tools choose k to balance the two (21 or 31 for genomes).</p>")}
{q("km-q4", "The sequence with its first six letters moved to the end (CATGCCATACGTTG) scores J = 0.75 – higher than the sequence with one changed letter. What does that say about k-mer similarity?", "<p>The order of the k-mers is lost: rearranging long stretches keeps almost every k-mer, so J barely notices a rearrangement that an alignment would show at once. k-mer methods measure shared content, not shared order.</p>")}
{activity("Your turn", [
    task("km-w3", f'Open {turn("kmers:snp")} and work out J yourself.', auto="viz:practice machine=kmers"),
])}

<h2 id="km-bloom">Bloom filters</h2>
<p>To ask “is this k-mer in the set?” for billions of k-mers, storing the k-mers themselves takes too much memory. A <b>Bloom filter</b> (Bloom, 1970) keeps only a row of m bits. Adding a k-mer sets h bits (fewer if two hash functions pick the same bit), chosen by h hash functions; looking one up checks the same bits. If any is 0, the k-mer is <b>definitely not</b> in the set. If all are 1, it is <b>possibly</b> in the set – or the bits were set by other k-mers, a <b>false positive</b>. A Bloom filter never misses a k-mer that is there.</p>
{formula(F_BLOOM)}
{activity("Watch it", [
    task("km-w4", f'Open {viz("bloom:small")} – the 10 distinct 3-mers of one sequence in 16 bits, then the 3-mers of another looked up.', auto="viz:end machine=bloom preset=small"),
    task("km-w5", f'Compare {viz("bloom:more", "32 bits")} and {viz("bloom:three", "16 bits with three hash functions")}.', auto="viz:end machine=bloom preset=three"),
])}
{q("km-q5", "With 16 bits, GAT is reported as “possibly in A”, but it is not. Why?", "<p>Its two bits, 10 and 6, had both been set by other k-mers (CAT sets 10 and 6 as well – a collision). The filter cannot tell which k-mer set a bit.</p>")}
{mcq("km-q6", "The formula gives a false-positive rate of about 0.51 for 16 bits and 2 hash functions, 0.22 for 32 bits, and 0.61 for 16 bits with 3 hash functions. Why does a third hash function make it worse here?", [
    ("Each k-mer then sets three bits, so the 16 bits fill up – 14 of 16 are 1 – and almost any lookup finds its bits set", True, "More hash functions help only while the filter is mostly empty: the best number is about (m/n) ln 2 – here about 1."),
    ("Three hash functions are slower", False, "Slower, a little – but speed is not what the false-positive rate measures."),
    ("Some hash functions are better than others", False, "All three spread the k-mers about equally well; the trouble is how full the filter gets."),
])}
{activity("Your turn", [
    task("km-w6", f'Open {turn("bloom:small")}: work out the bits of a k-mer, and look one up.', auto="viz:practice machine=bloom"),
])}

<h2 id="km-mh">MinHash sketches</h2>
<p>A Bloom filter is small, but it still grows with the set. To compare thousands of genomes with each other, each is reduced to a <b>sketch</b> of fixed size. <b>MinHash</b> (Broder, 1997) keeps, for each of several hash functions, only the k-mer with the <b>smallest</b> hash value. A hash function gives each k-mer a number that looks random but is always the same for the same k-mer, so if two genomes share a k-mer that is the smallest for one of them, it may well be the smallest for the other too.</p>
<p>Why it works: of all the k-mers in A ∪ B, each is equally likely to have the smallest hash value. The minimum of A and the minimum of B are the same exactly when that k-mer is in both – which happens with probability J. So the fraction of hash functions whose minima agree estimates J; its error shrinks with the square root of the number of hash functions (roughly 1/√H).</p>
{activity("Watch it", [
    task("km-w7", f'Open {viz("minhash:many")} – the same two sequences, eight hash functions.', auto="viz:end machine=minhash preset=many"),
    task("km-w8", f'Open {viz("minhash:bottom")} – one hash function, keeping its five smallest values, as Mash does.', auto="viz:end machine=minhash preset=bottom"),
])}
{q("km-q7", "What is the estimate of J from the eight hash functions?", "<p>5/8 = 0.625: 0.07 below the true value, 0.692. That is well within what eight hash functions can promise: the rough rule that the error is about 1/√H gives ±0.35 for H = 8.</p>", accept=RE_0625)}
{q("km-q8", "About how many hash functions would be needed for an error of about 0.01?", "<p>About 10,000, by the rough rule that the error is about 1/√H: 1/√10,000 = 0.01. Working out 10,000 hash values for every k-mer would be slow, which is why Mash uses one hash function and keeps its 1,000 smallest values: one hash per k-mer, with an error of about 1/√1000 ≈ 0.03.</p>", accept=RE_10000)}
{activity("Your turn", [
    task("km-w9", f'Open {turn("minhash:many")}: find the minima for the first hash function, then estimate J.', auto="viz:practice machine=minhash"),
])}

<h2 id="km-tools">In real tools</h2>
{tools(
    ("Mash", "Bottom-s MinHash sketches: by default the 1,000 smallest hash values of the 21-mers of a genome or read set. Estimates J from the union of two sketches, and turns it into a distance D = −(1/k) ln(2J / (1 + J)), close to the fraction of letters that differ."),
    ("sourmash", "FracMinHash: keeps every hash value below a threshold (scaled = 1000 keeps about 1 in 1,000; k = 31 by default), so sketches grow with the genome and can tell how much of a genome is contained in a metagenome."),
    ("Kraken 2", "Assigns each read to a taxon (a species, or a higher group when the read fits several): each 35-mer of a read, represented by its 31-base minimizer, is looked up in a compact hash table built from reference genomes."),
    ("BIGSI, COBS", "A Bloom filter for each of hundreds of thousands of bacterial and viral datasets, stored side by side, to find every dataset that contains a gene or a resistance mutation."),
    ("Jellyfish, KMC", "Count every k-mer of a sequencing run (Jellyfish in a hash table shared by many threads); the counts show genome size, repeats and errors."),
    ("MUSCLE 3", "Its first guide tree comes from k-mer distances, not alignments (chapter 10)."),
)}
{keypoints(
    "A sequence has N − k + 1 k-mers; as a set their order is lost, but each keeps the order of its own letters.",
    "Jaccard similarity J = shared / in either: one pass, no alignment. One different letter changes up to k k-mers.",
    "A Bloom filter stores a set as bits: “definitely not” or “possibly” – false positives, never false negatives.",
    "MinHash keeps the smallest hash values: the fraction that agree between two sketches estimates J (Mash, sourmash).",
)}
'''
    return chapter('kmers', 12, 'k-mers and sketches', 'viz', 'Comparing without aligning: k-mers, Bloom filters and MinHash', 35,
                   'Aligning is slow when there are thousands of genomes, or millions of reads from unknown species. Cutting sequences into k-mers and comparing the sets is fast – and with Bloom filters and MinHash sketches, it fits in very little memory. Mash, sourmash and Kraken are built this way.', body)


# ======================================================================
# 13. Summary: tools and the algorithms inside them
# ======================================================================
def ch_summary():
    def row(tool, job, parts):
        return f'<tr><th>{tool}</th><td>{job}</td><td>{" ".join(parts)}</td></tr>'
    tmap = ''.join([
        row('grep, motif finders', 'Find a pattern exactly', [viz('bm:read', 'Boyer–Moore'), viz('kmp:atcgatg', 'Knuth–Morris–Pratt')]),
        row('<b>BWA-MEM</b>', 'Map short reads to a genome', [viz('fm:genome', 'FM-index seeds'), viz('mapper:del', 'chaining'), viz('dp:sw', 'banded Smith–Waterman')]),
        row('<b>Bowtie 2</b>', 'Map short reads to a genome', [viz('bwt:read', 'the BWT'), viz('fm:ataata', 'backward search'), viz('dp:nw', 'dynamic programming')]),
        row('HISAT2, STAR', 'Map RNA-seq reads, across introns', [viz('fm:once', 'FM-index (HISAT2)'), viz('sa:cta', 'suffix array (STAR)')]),
        row('<b>minimap2</b>', 'Map long reads, align genomes', [viz('minimizer:hash', 'minimizers'), viz('hash:chain', 'hash table'), viz('mapper:snp', 'seed, chain, extend')]),
        row('<b>BLAST</b>', 'Search a database for similar sequences', [viz('words:pqg', 'neighbourhood words'), viz('blast:main', 'hits, two hits, X-drop'), viz('blosum:block', 'BLOSUM')]),
        row('EMBOSS needle, water', 'Align two sequences', [viz('dp:nw', 'Needleman–Wunsch'), viz('dp:sw', 'Smith–Waterman')]),
        row('<b>Clustal Omega</b>, MUSCLE, MAFFT', 'Align many sequences', [viz('upgma:five', 'guide tree'), viz('msa:progressive', 'progressive alignment')]),
        row('PSI-BLAST', 'Find distant relatives', [viz('profile:protein', 'profiles')]),
        row('<b>HMMER</b>, Pfam', 'Find protein families and domains', [viz('phmm:family', 'profile HMM'), viz('viterbi:forward', 'forward algorithm')]),
        row('AUGUSTUS, GlimmerHMM', 'Find genes', [viz('viterbi:island', 'Viterbi decoding')]),
        row('Mash, sourmash', 'Compare genomes without aligning', [viz('kmers:snp', 'k-mer sets'), viz('minhash:bottom', 'MinHash')]),
        row('Kraken 2', 'Sort reads by taxon (species, genus …)', [viz('minimizer:hash', 'minimizers'), viz('hash:chain', 'hash table')]),
        row('BIGSI, COBS', 'Find the genomes that contain a sequence', [viz('bloom:small', 'Bloom filters')]),
    ])
    costs = ''.join(f'<tr><td>{a}</td><td>{t}</td><td>{m}</td><td>{c}</td></tr>' for a, t, m, c in [
        ('Naive search', 'up to n × m', '–', '3'),
        ('Knuth–Morris–Pratt', 'n + m', 'a table of m', '3'),
        ('Boyer–Moore', 'often less than n (it skips)', 'tables of m and the alphabet', '3'),
        ('Suffix array: search', 'm × log n', 'a number per letter of the text', '4'),
        ('FM-index: count', 'm (one step per letter of the pattern)', 'a fraction of the text’s size', '5'),
        ('Edit distance, Needleman–Wunsch, Smith–Waterman', 'm × n', 'm × n (less for the score alone)', '6, 7'),
        ('BLAST', 'one pass through the database, plus extensions', 'a table of words', '8'),
        ('Exact multiple alignment of N sequences', 'about L<sup>N</sup> × 2<sup>N</sup>', 'about L<sup>N</sup>', '10'),
        ('Progressive alignment', 'N(N − 1)/2 pairwise alignments, then N − 1 merges', 'the alignments', '10'),
        ('Viterbi, forward', 'L × S² (S states)', 'L × S', '11'),
        ('k-mer sets, Jaccard', 'one pass through each sequence', 'the k-mers', '12'),
        ('MinHash', 'one pass to sketch; s to compare', 's values per genome', '12'),
    ])
    hand = [
        ('su-h1', 'Write the Burrows–Wheeler transform of a short word', 'bwt:gattaca', 'bwt'),
        ('su-h2', 'Turn a BWT back into its text (LF mapping)', 'lf:gattaca', 'lf'),
        ('su-h3', 'Count a pattern with backward search', 'fm:ataata', 'fm'),
        ('su-h4', 'Find a pattern in a suffix array', 'sa:cta', 'sa'),
        ('su-h5', 'Build the table of Knuth–Morris–Pratt', 'kmp:table', 'kmp'),
        ('su-h6', 'Work out Boyer–Moore’s shifts', 'bm:tatac', 'bm'),
        ('su-h7', 'Fill an edit-distance matrix and trace it back', 'dp:tiny', 'dp'),
        ('su-h8', 'Do a Smith–Waterman alignment', 'dp:swsmall', 'dp'),
        ('su-h9', 'Find BLAST’s neighbourhood words', 'words:pqg', 'words'),
        ('su-h10', 'Pick the minimizers of a sequence', 'minimizer:abc', 'minimizer'),
        ('su-h11', 'Build a UPGMA guide tree', 'upgma:five', 'upgma'),
        ('su-h12', 'Decode a sequence with Viterbi', 'viterbi:classic', 'viterbi'),
        ('su-h13', 'Build a profile HMM and score a sequence', 'phmm:family', 'phmm'),
        ('su-h14', 'Work out a Jaccard similarity', 'kmers:snp', 'kmers'),
        ('su-h15', 'Add k-mers to a Bloom filter and look one up', 'bloom:small', 'bloom'),
        ('su-h16', 'Estimate J with MinHash', 'minhash:many', 'minhash'),
    ]
    hand_tasks = [task(t, f'{lab}: {turn(spec)}', auto=f'viz:practice machine={mach}') for t, lab, spec, mach in hand]
    gloss = [
        ('Alignment, global and local', 'Letters of two sequences placed in columns, with gaps. Global covers both from end to end (Needleman–Wunsch); local finds the best-matching parts (Smith–Waterman). Chapters 6–7.'),
        ('Anchor', 'An exact match between a read and the genome (a seed found), drawn as a short diagonal; chains of anchors show where a read belongs. Chapter 9.'),
        ('Bloom filter', 'A row of bits that answers “is this in the set?” with “definitely not” or “possibly” – false positives, never false negatives. Chapter 12.'),
        ('BLOSUM62', 'A table of log-odds scores for pairs of amino acids, counted from blocks of related proteins. Chapters 7–8.'),
        ('Burrows–Wheeler transform (BWT)', 'The last column of the sorted rotations of a text: reversible, compressible and searchable. Chapter 5.'),
        ('CIGAR', 'The summary of an alignment in a SAM file: 16M1D7M = 16 aligned, 1 deleted, 7 aligned. Chapter 9.'),
        ('Dynamic programming', 'Solving a problem from the answers to its smaller parts, kept in a table so that none is worked out twice. Chapters 6, 7, 11.'),
        ('E-value', 'The number of matches at least this good expected by chance in a search of this size. Chapter 8.'),
        ('FM-index', 'The BWT with tables C and Occ, which find a pattern in one step per letter (backward search). Chapter 5.'),
        ('Forward algorithm', 'Dynamic programming that adds up the probability of a sequence over every path of hidden states. Chapter 11.'),
        ('Guide tree', 'A tree of the sequences built from their distances (UPGMA, neighbour-joining) that sets the order of progressive alignment. Chapter 10.'),
        ('Hash table', 'Slots addressed by a number computed from the key: a lookup takes one step on average. Chapter 2.'),
        ('Hidden Markov model', 'States that emit letters, with transition probabilities; the path of states is hidden. Chapter 11.'),
        ('HSP', 'A high-scoring segment pair: a stretch of query and database sequence aligned without gaps by BLAST’s extension. Chapter 8.'),
        ('Jaccard similarity', 'Shared k-mers over all k-mers of two sets. Chapter 12.'),
        ('k-mer', 'A word of k letters; a sequence of length N has N − k + 1 of them. Chapters 2, 8, 9, 12.'),
        ('MAPQ', 'Mapping quality: −10 log₁₀ of the probability that a read is in the wrong place. Chapter 9.'),
        ('MinHash', 'A sketch of a set: for each of several hash functions, the smallest hash value of its elements; matching minima estimate the Jaccard similarity. Chapter 12.'),
        ('Minimizer', 'The smallest k-mer (by some order) in each window of w k-mers; a read and the genome choose the same ones. Chapter 9.'),
        ('Profile (PSSM)', 'A column of scores for each position of a family’s alignment. Chapter 11.'),
        ('Profile HMM', 'A hidden Markov model built from a multiple alignment, with match, insert and delete states for each column. Chapter 11.'),
        ('Pseudocount', 'A small count added to every letter so that none has probability 0. Chapter 11.'),
        ('Seed', 'A short exact match used to find where to align (BLAST words, mapper seeds). Chapters 8–9.'),
        ('Suffix array', 'The start positions of all suffixes of a text, in alphabetical order of the suffixes. Chapter 4.'),
        ('Suffix tree', 'A compressed trie of all the suffixes of a text. Chapter 4.'),
        ('Sum of pairs', 'The score of a multiple alignment: every pair of letters in every column. Chapter 10.'),
        ('UPGMA', 'Builds a tree by joining the two closest clusters and averaging their distances to the others, again and again. Chapter 10.'),
        ('Viterbi algorithm', 'Dynamic programming that finds the most probable path of hidden states. Chapter 11.'),
    ]
    gl = ''.join(f'<dt>{t}</dt><dd>{d}</dd>' for t, d in gloss)
    body = f'''
<h2 id="su-map">The tools, part by part</h2>
<p>Each tool is a few of the algorithms of this course put together. The buttons open the animation of each part.</p>
<table class="table mapt su-map">
<tr><th>Tool</th><th>Job</th><th>What is inside</th></tr>
{tmap}
</table>
{q("su-q1", "A colleague maps reads with BWA-MEM and asks what “FM-index” and “Smith–Waterman” in its paper mean. In two or three sentences, what would you tell them?", "<p>The FM-index is a compressed index of the genome built from its Burrows–Wheeler transform: it finds every place where a short piece of the read occurs exactly, in one step per letter, whatever the size of the genome. Those exact matches (seeds) show where the read probably belongs; Smith–Waterman then aligns the whole read there, allowing mismatches and gaps, by dynamic programming in a narrow band.</p>")}

<h2 id="su-cost">What each step costs</h2>
<p>For a text (or genome, or database) of length n and a pattern (or read, or query) of length m. These numbers say why each tool is built the way it is: an index makes a search independent of the genome’s size; dynamic programming is kept to small pieces; sketches make whole genomes comparable in a moment.</p>
<table class="table su-cost">
<tr><th>Algorithm</th><th>Time</th><th>Memory</th><th>Chapter</th></tr>
{costs}
</table>

<h2 id="su-hand">By hand: a checklist</h2>
<p>Each of these can be done on paper with a short sequence. Do each in <b>Your turn</b>; the item ticks itself when you finish it. If one still feels hard, go back to its chapter and watch it again first.</p>
{activity("Your turn", hand_tasks)}

<h2 id="su-gloss">Glossary</h2>
<dl class="gloss">{gl}</dl>
'''
    return chapter('summary', 13, 'Summary', 'viz', 'Summary: the algorithms inside the tools', 20,
                   'Every tool in a sequencing pipeline is a few of these algorithms put together. Here they are, tool by tool, with what each step costs – and a checklist of what you can now do by hand.', body)


def ALL():
    return [ch_start(), ch_basics(), ch_hashing(), ch_exact(), ch_index(), ch_bwt(), ch_edit(), ch_scores(), ch_blast(), ch_mappers(), ch_msa(), ch_hmm(), ch_kmers(), ch_summary()]
