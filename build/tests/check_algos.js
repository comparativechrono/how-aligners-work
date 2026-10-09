/* =====================================================================
   Checks that the algorithms behind the animations still give the
   numbers the chapters quote (questions, model answers, narration).
   Run it after changing assets/js/algos.js or an example:

       node build/tests/check_algos.js

   No packages needed (Node 14 or later). It prints one line per check
   and ends with "all N checks pass" – or exits with an error.
   ===================================================================== */
'use strict';
const path = require('path');
const A = require(path.join(__dirname, '..', '..', 'assets', 'js', 'algos.js'));

let n = 0;
const fails = [];
function check(what, got, want) {
  n++;
  const same = typeof want === 'number' ? Math.abs(got - want) < 0.006 : JSON.stringify(got) === JSON.stringify(want);
  console.log((same ? 'ok   ' : 'FAIL ') + what + (same ? '' : `  – got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`));
  if (!same) fails.push(what);
}
const round2 = (x) => Math.round(x * 100) / 100;
// the schemes the dynamic-programming animation builds (assets/js/m-dp.js)
const sw246 = A.scheme('simple', { match: 2, mismatch: -4, gap: -6 });
const b62gap8 = A.scheme('blosum62', { gap: -8 });

/* 1. Searching and sorting */
check('ch 1: bubble sort of 5 3 8 2 4 makes 10 comparisons', A.sortSteps([5, 3, 8, 2, 4], 'bubble').comparisons, 10);
check('ch 1: 2^20 > 1,000,000 > 2^19 (20 steps of binary search)', [2 ** 20 > 1e6, 2 ** 19 < 1e6], [true, true]);

/* 2. Hashing */
check('ch 2: ATT = 15, slot 4 of 11', [A.kmerCode('ATT'), A.kmerCode('ATT') % 11], [15, 4]);
check('ch 2: ACA 4 and TTA 60, TAC 49', [A.kmerCode('ACA'), A.kmerCode('TTA'), A.kmerCode('TAC')], [4, 60, 49]);

/* 3. Exact matching */
check('ch 3: KMP table of ATCGATG', A.kmpTable('ATCGATG').pi, [-1, 0, 0, 0, 0, 1, 2, 0]);
check('ch 3: KMP 23 comparisons, naive 32', [A.kmpSearch('ATCTATCGATTCGATCGATGA', 'ATCGATG').comparisons, A.naiveSearch('ATCTATCGATTCGATCGATGA', 'ATCGATG').comparisons], [23, 32]);
check('ch 3: 2849 mod 97 = 36', 2849 % 97, 36);

/* 4. Tries, suffix trees and suffix arrays */
check('ch 4: trie of 8 codons has 14 nodes', A.trieBuild(['AAA', 'AAG', 'AGA', 'AGG', 'CGA', 'CGC', 'CGG', 'CGT']).nodes.length, 14);
check('ch 4: suffix array of CGCTACTA$', A.suffixArray('CGCTACTA$'), [8, 7, 4, 0, 5, 2, 1, 6, 3]);

/* 5. Burrows–Wheeler transform and FM-index */
check('ch 5: BWT of GATTACA', A.bwt('GATTACA$'), 'ACTGA$TA');
check('ch 5: BWT of CATCAT', A.bwt('CATCAT$'), 'TCCT$AA');
check('ch 5: BWT of ACACAC', A.bwt('ACACAC$'), 'CCC$AAA');
check('ch 5: TT$AAGG turns back into AGTAGT', A.inverseBwt('TT$AAGG').text, 'AGTAGT$');
{
  const bs = A.backwardSearch(A.fmIndex('CATCAT'), 'AT');
  check('ch 5: AT in CATCAT: rows 5–6 start with T, rows 1–2 with AT', bs.steps.map((s) => [s.top, s.bottom - 1]), [[5, 6], [1, 2]]);
}

/* 6. Edit distance */
check('ch 6: Hamming distance 2', A.hamming('AGGCTCTAGGATATA', 'AGGCTATAGGAGATA'), 2);
check('ch 6: edit distance ACG / CCG = 1', A.dp('ACG', 'CCG', A.scheme('edit'), 'global').score, 1);
check('ch 6: edit distance GAT / GCAT = 1', A.dp('GAT', 'GCAT', A.scheme('edit'), 'global').score, 1);
check('ch 6: 12-letter example: distance 2', A.dp('CGCATACGTGCG', 'CGATACGGTGCG', A.scheme('edit'), 'global').score, 2);
{
  const f = A.dp('ATGCAGTCG', 'TTGGGATACAGTACGGAACCT', A.scheme('edit'), 'fit');
  check('ch 6: approximate match: 2 edits, ATACAGTACG', [f.score, f.tb.ay.replace(/-/g, '')], [2, 'ATACAGTACG']);
}
check('ch 6: plain recursion makes 94 calls for ACG / CCG', A.editCallCount(3, 3), 94);

/* 7. Global and local alignment */
check('ch 7: penalties TACGTCAGC / TATGTCATGC = 10', A.dp('TACGTCAGC', 'TATGTCATGC', A.scheme('penalty'), 'global').score, 10);
check('ch 7: Needleman–Wunsch score 0', A.dp('TACGTCAGC', 'TATGTCATGC', A.scheme('dna'), 'global').score, 0);
check('ch 7: Smith–Waterman GTG / AGTC = 2', A.dp('GTG', 'AGTC', A.scheme('simple'), 'local').score, 2);
{
  const d = A.dp('GGTATGCTGGCGCTA', 'TATATGCGGCGTTT', sw246, 'local');
  check('ch 7: Smith–Waterman (+2/−4/−6) = 12, TATGCTGGCG', [d.score, d.tb.ax.replace(/-/g, '')], [12, 'TATGCTGGCG']);
}
check('ch 7: proteins, BLOSUM62 and gap −8: 20', A.dp('PAWHEAE', 'HEAGAWGHEE', b62gap8, 'local').score, 20);

/* 8. BLAST */
check('ch 8: PEG against PQG = 15; AIL against itself = 12', [A.wordScore('PEG', 'PQG'), A.wordScore('AIL', 'AIL')], [15, 12]);

/* 10. Multiple alignment */
{
  const b62 = A.scheme('blosum62', { gap: -4 });
  check('ch 10: sum of pairs of A A S A = 15', A.sumOfPairs(['A', 'A', 'S', 'A'], b62).total, 15);
  check('ch 10: sum of pairs of A V A – = −8', A.sumOfPairs(['A', 'V', 'A', '-'], b62).total, -8);
  const seqs = 'AVSSQQAVV AVQQAAVVV AVQVVQVV AVVSQQSAV'.split(' ');
  const st = A.star(seqs, b62);
  check('ch 10: star alignment: centre a, sum of pairs 69', [st.center, st.sp.total], [0, 69]);
  check('ch 10: star alignment rows', st.rows, ['AVSSQQA-VV', 'AV-QQAAVVV', 'AVQVVQ--VV', 'AVVSQQS-AV']);
  const ids = [[0, 1], [0, 2], [0, 3]].map(([i, j]) => Math.round(A.identity(seqs[i], seqs[j], b62).id * 100));
  check('ch 10: identities of a with b, c, d: 60, 56, 67 (sum 183)', ids, [60, 56, 67]);
  const dna = Object.assign(A.scheme('simple', { match: 1, mismatch: -1 }), { gap: -2 });
  const pairs = 'GATTACAGT GATTCCAGT GATTACTTAGT GACTACTTAGT'.split(' ');
  check('ch 10: two pairs of DNA: progressive 28, star 25', [A.progressive(pairs, dna).sp.total, A.star(pairs, dna).sp.total], [28, 25]);
  const names = 'a b c d e'.split(' ');
  const v = '3 7 8 10 6 8 7 4 5 6'.split(' ').map(Number);
  const D = names.map(() => names.map(() => 0));
  let k = 0;
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) D[i][j] = D[j][i] = v[k++];
  const u = A.upgma(names, D);
  check('ch 10: UPGMA tree ((a,b),((c,d),e))', u.nodes[u.root].name, '((a,b),((c,d),e))');
  check('ch 10: UPGMA joins at 3, 4, 5.5, 7.67', u.steps.map((s) => round2(s.d)), [3, 4, 5.5, 7.67]);
  check('ch 10: UPGMA d((a,b),c) = 6.5 and d((a,b),(c,d)) = 7.25', [round2(u.steps[1].matrixBefore[0][1]), round2(u.steps[2].matrixBefore[0][1])], [6.5, 7.25]);
  check('ch 10: root at 3.83, branch (a,b) 2.33', [round2(u.steps[3].height), round2(u.steps[3].branch[0])], [3.83, 2.33]);
}

/* 11. Profiles and hidden Markov models */
{
  const sites = 'TATAAA TATAAT TATATA TATAAA TATTAA TATAAG CATAAA TATAAA'.split(' ');
  const P = A.profile(sites, 'ACGT', 4);
  check('ch 11: frequency of T in column 1 = 0.875', P.cols[0].freq.T, 0.875);
  check('ch 11: score of C in column 2 = −1.58', round2(P.cols[1].score.C), -1.58);
  const sc = A.profileScan(P, 'GCGCTATAAAGGCTTATATCCG');
  check('ch 11: TATAAA at 4 scores 8.64; TATATC at 14 scores 3.83', [round2(sc[4].total), round2(sc[14].total)], [8.64, 3.83]);
  const q2 = 'GGCTATAACGCATTAAAGC';
  check('ch 11: TATAAC at 3: −∞ without pseudocounts, 5.83 with', [A.profileScan(A.profile(sites, 'ACGT', 0), q2)[3].total, round2(A.profileScan(P, q2)[3].total)], [-Infinity, 5.83]);
  const blk = A.profile('KIFIMK NLFKTR KIFKTK KLYESR KIFKGR'.split(' '), 'ACDEFGHIKLMNPQRSTVWY', 1);
  check('ch 11: protein block column 1 = {K: 0.8, N: 0.2}', [blk.cols[0].freq.K, blk.cols[0].freq.N], [0.8, 0.2]);
  const vt = A.viterbi(A.HMM_CG, 'GGCACTGAA');
  check('ch 11: Viterbi V+(1) = −2.74, best −24.49', [round2(vt.V[0][0]), round2(vt.best)], [-2.74, -24.49]);
  check('ch 11: Viterbi path +++−−−−−−', vt.path.join(''), '+++−−−−−−');
  check('ch 11: forward P(GGCACTGAA) = 3.79e-6', round2(A.forward(A.HMM_CG, 'GGCACTGAA').total * 1e6), 3.79);
  const m = A.phmmBuild('TCGGF ACG-F NCG-F TCG-W TC--W'.split(' '));
  check('ch 11: profile HMM: column 4 is an insert column', m.isMatch, [true, true, true, false, true]);
  check('ch 11: M1 emits T 0.6; M2→M3 0.8; M3→I3 0.25', [m.emit.M1.T, m.trans.M2.M3, m.trans.M3.I3], [0.6, 0.8, 0.25]);
  const pr = (q) => {
    const r = A.phmmViterbi(m, q);
    return r ? Math.round(r.prob * 1000) / 1000 : null;
  };
  check('ch 11: TCGW 0.144, ACGGF 0.024, TCW 0.048, TGGF no path', [pr('TCGW'), pr('ACGGF'), pr('TCW'), pr('TGGF')], [0.144, 0.024, 0.048, null]);
}

/* 12. k-mers, Bloom filters and MinHash */
{
  const a = 'ACGTTGCATGCCAT', b = 'ACGTTGGATGCCAT';
  const J3 = A.jaccard(A.kmerSet(a, 3), A.kmerSet(b, 3));
  check('ch 12: k = 3: 9 shared of 13; only A: GCA; only B: TGG GGA GAT', [J3.both.length, J3.union, J3.onlyA, J3.onlyB], [9, 13, ['GCA'], ['TGG', 'GGA', 'GAT']]);
  const J4 = A.jaccard(A.kmerSet(a, 4), A.kmerSet(b, 4));
  check('ch 12: k = 4: 7 shared of 15', [J4.both.length, J4.union], [7, 15]);
  check('ch 12: swapped order: J = 0.75', A.jaccard(A.kmerSet(a, 3), A.kmerSet('CATGCCATACGTTG', 3)).j, 0.75);
  const bl = A.bloom(A.kmerSet(a, 3), A.kmerSet(b, 3), 16, 2);
  const gat = bl.checks.find((c) => c.w === 'GAT');
  check('ch 12: Bloom filter, 16 bits: GAT is a false positive (bits 10, 6); 11 bits set', [gat.fp, gat.ix, bl.ones], [true, [10, 6], 11]);
  check('ch 12: false-positive rates 0.51, 0.22, 0.61', [bl.fpRate, A.bloom(A.kmerSet(a, 3), [], 32, 2).fpRate, A.bloom(A.kmerSet(a, 3), [], 16, 3).fpRate].map(round2), [0.51, 0.22, 0.61]);
  const M = A.primeAbove(64);
  check('ch 12: MinHash with 8 functions: 5 of 8 (0.625)', A.minhash(A.kmerSet(a, 3), A.kmerSet(b, 3), 8, M).same, 5);
  check('ch 12: bottom-5 sketch: 4 of 5 (0.8)', A.bottomSketch(A.kmerSet(a, 3), A.kmerSet(b, 3), 5, M).shared.length, 4);
}

console.log(fails.length ? `\n${fails.length} of ${n} checks FAIL` : `\nall ${n} checks pass`);
if (fails.length) process.exit(1);
