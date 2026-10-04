/*
 * Small text diff for comparing draft versions: line-level LCS, then word-level
 * LCS inside lines that changed. Returns HTML with <ins> and <del>.
 */
(function (WP) {
  'use strict';

  function lcs(a, b) {
    const n = a.length;
    const m = b.length;
    if (n * m > 4e6) return a.map((v) => ({ t: '-', v })).concat(b.map((v) => ({ t: '+', v })));
    const w = m + 1;
    const dp = new Int32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * w + j] = a[i] === b[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
      }
    }
    const ops = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        ops.push({ t: '=', v: a[i] });
        i++;
        j++;
      } else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) ops.push({ t: '-', v: a[i++] });
      else ops.push({ t: '+', v: b[j++] });
    }
    while (i < n) ops.push({ t: '-', v: a[i++] });
    while (j < m) ops.push({ t: '+', v: b[j++] });
    return ops;
  }

  const words = (s) => s.match(/\s+|[^\s]+/g) || [];

  function wordDiff(a, b, esc) {
    return lcs(words(a), words(b)).map((o) => (o.t === '=' ? esc(o.v) : o.t === '-' ? `<del>${esc(o.v)}</del>` : `<ins>${esc(o.v)}</ins>`)).join('');
  }

  /** Diff of two texts as HTML, plus counts of words added and removed. */
  function diff(before, after, esc) {
    const ops = lcs(before.split('\n'), after.split('\n'));
    const out = [];
    let added = 0;
    let removed = 0;
    for (let k = 0; k < ops.length;) {
      if (ops[k].t === '=') {
        out.push(esc(ops[k].v));
        k++;
        continue;
      }
      const dels = [];
      const ins = [];
      while (k < ops.length && ops[k].t !== '=') (ops[k].t === '-' ? dels : ins).push(ops[k++].v);
      const pairs = Math.min(dels.length, ins.length);
      for (let p = 0; p < pairs; p++) {
        const w = lcs(words(dels[p]), words(ins[p]));
        w.forEach((o) => {
          if (/\S/.test(o.v)) {
            if (o.t === '+') added++;
            if (o.t === '-') removed++;
          }
        });
        out.push(wordDiff(dels[p], ins[p], esc));
      }
      dels.slice(pairs).forEach((l) => {
        removed += words(l).filter((x) => /\S/.test(x)).length;
        out.push(`<del>${esc(l)}</del>`);
      });
      ins.slice(pairs).forEach((l) => {
        added += words(l).filter((x) => /\S/.test(x)).length;
        out.push(`<ins>${esc(l)}</ins>`);
      });
    }
    return { html: out.join('\n'), added, removed };
  }

  WP.diff = diff;
})(window.WP = window.WP || {});
