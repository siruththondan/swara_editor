
// ═══════════════════════════════════════════════════════
//  SWARA DEFINITIONS
//  Each entry: { label, char }  (char = Tamil string to insert)
// ═══════════════════════════════════════════════════════
const SWARAS = [
  { label:'ச',   char:'ச'  },   // Sa
  { label:'ரி',  char:'ரி' },   // Ri
  { label:'க',   char:'க'  },   // Ga
  { label:'ம',   char:'ம'  },   // Ma
  { label:'ப',   char:'ப'  },   // Pa
  { label:'த',   char:'த'  },   // Dha
  { label:'நி',  char:'நி' },   // Ni
];

// ═══════════════════════════════════════════════════════
//  BUILD PICKER GRIDS
// ═══════════════════════════════════════════════════════
['fwd','rev'].forEach(mode => {
  const grid = document.getElementById('grid-' + mode);
  SWARAS.forEach(sw => {
    const btn = document.createElement('button');
    btn.className = 'swara-btn';
    btn.title = `Insert ${sw.label}`;
    btn.innerHTML = `
      <span class="sb-dot-t">&#9679;</span>
      <span class="sb-char">${sw.char}</span>
      <span class="sb-dot-b">&#9679;</span>`;
    btn.addEventListener('click', () => insertSwara(mode, sw.char));
    grid.appendChild(btn);
  });
});

// ═══════════════════════════════════════════════════════
//  OCTAVE STATE
// ═══════════════════════════════════════════════════════
const octaveState = { fwd: 'middle', rev: 'middle' };
const PREVIEW_CHAR = { fwd: 'ச', rev: 'ச' };  // last hovered

function setOctave(pickerId, octave) {
  const picker = document.getElementById(pickerId);
  const mode   = picker.dataset.mode;
  picker.dataset.octave = octave;
  octaveState[mode] = octave;
  updatePreview(mode, PREVIEW_CHAR[mode]);
}

function updatePreview(mode, char) {
  PREVIEW_CHAR[mode] = char;
  const oct = octaveState[mode];
  const dotAbove = oct === 'upper' ? '&#9679;' : oct === 'atitara' ? '&#9679;&#9679;' : '';
  const dotBelow = oct === 'lower' ? '&#9679;' : oct === 'anumandra' ? '&#9679;&#9679;' : '';
  document.getElementById('pdot-t-' + mode).innerHTML = dotAbove;
  document.getElementById('pdot-b-' + mode).innerHTML = dotBelow;
  document.getElementById('preview-char-' + mode).textContent = char;
}

// Update preview on button hover
['fwd','rev'].forEach(mode => {
  document.getElementById('grid-' + mode).querySelectorAll('.swara-btn').forEach((btn, i) => {
    btn.addEventListener('mouseenter', () => updatePreview(mode, SWARAS[i].char));
  });
});

// ═══════════════════════════════════════════════════════
//  INSERT INTO TEXTAREA
// ═══════════════════════════════════════════════════════
function insertSwara(mode, char) {
  const ta  = document.getElementById(mode === 'fwd' ? 'fwd-input' : 'rev-input');
  const oct = octaveState[mode];
  let snippet;

  if (mode === 'fwd') {
    if      (oct === 'atitara')   snippet = `\\overset{\\text{..}}{${char}}\\ `;
    else if (oct === 'upper')     snippet = `\\overset{\\text{.}}{${char}}\\ `;
    else if (oct === 'lower')     snippet = `\\underset{\\text{.}}{${char}}\\ `;
    else if (oct === 'anumandra') snippet = `\\underset{\\text{..}}{${char}}\\ `;
    else                          snippet = `${char}\\ `;
  } else {
    if      (oct === 'atitara')   snippet = `${char}.. `;
    else if (oct === 'upper')     snippet = `${char}. `;
    else if (oct === 'lower')     snippet = `.${char} `;
    else if (oct === 'anumandra') snippet = `..${char} `;
    else                          snippet = `${char} `;
  }

  insertAtCursor(ta, snippet);
  ta.focus();
  if (mode === 'fwd') { clearTimeout(fwdT); fwdT = setTimeout(convertFwd, 180); }
  else { clearTimeout(revT); revT = setTimeout(convertRev, 180); }
}

function insertBar(taId, mode) {
  const ta = document.getElementById(taId);
  const snippet = mode === 'fwd' ? ' \\;\\big|\\;\n' : ' | ';
  insertAtCursor(ta, snippet);
  ta.focus();
  if (mode === 'fwd') { clearTimeout(fwdT); fwdT = setTimeout(convertFwd, 180); }
  else { clearTimeout(revT); revT = setTimeout(convertRev, 180); }
}

function insertAtCursor(ta, text) {
  const start = ta.selectionStart, end = ta.selectionEnd;
  const val   = ta.value;
  ta.value = val.slice(0, start) + text + val.slice(end);
  const pos = start + text.length;
  ta.setSelectionRange(pos, pos);
}

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════
function tamilCluster(src, i) {
  let j = i + 1;
  while (j < src.length) {
    const cp = src.codePointAt(j);
    if ((cp >= 0x0BBE && cp <= 0x0BCD) || cp === 0x0BD7) j += cp > 0xFFFF ? 2 : 1;
    else break;
  }
  return src.slice(i, j);
}

function escHTML(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function flashPanel(id, html) {
  const el = document.getElementById(id);
  el.innerHTML = html;
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => {
    document.querySelectorAll('button.sec').forEach(b => {
      if (b.textContent.includes('Copy')) {
        const o = b.textContent;
        b.textContent = 'Copied ✓';
        setTimeout(() => b.textContent = o, 1500);
      }
    });
  });
}

// ═══════════════════════════════════════════════════════
//  FORWARD: LaTeX → Rendered
// ═══════════════════════════════════════════════════════
function tokeniseFwd(src) {
  const tokens = []; let i = 0;
  while (i < src.length) {
    if (/[\n\r]/.test(src[i])) { i++; continue; }
    if (src.startsWith('\\;', i)) { i += 2; continue; }
    if (src.startsWith('\\ ', i)) { i += 2; continue; }
    const OVER2  = '\\overset{\\text{..}}{';
    const UNDER2 = '\\underset{\\text{..}}{';
    const OVER   = '\\overset{\\text{.}}{';
    const UNDER  = '\\underset{\\text{.}}{';
    // double-dot must be checked BEFORE single-dot (longer prefix first)
    if (src.startsWith(OVER2, i)) {
      const s = i + OVER2.length, e = src.indexOf('}', s);
      if (e !== -1) { tokens.push({ type:'atitara', text: src.slice(s,e) }); i = e+1; continue; }
    }
    if (src.startsWith(UNDER2, i)) {
      const s = i + UNDER2.length, e = src.indexOf('}', s);
      if (e !== -1) { tokens.push({ type:'anumandra', text: src.slice(s,e) }); i = e+1; continue; }
    }
    if (src.startsWith(OVER, i)) {
      const s = i + OVER.length, e = src.indexOf('}', s);
      if (e !== -1) { tokens.push({ type:'upper', text: src.slice(s,e) }); i = e+1; continue; }
    }
    if (src.startsWith(UNDER, i)) {
      const s = i + UNDER.length, e = src.indexOf('}', s);
      if (e !== -1) { tokens.push({ type:'lower', text: src.slice(s,e) }); i = e+1; continue; }
    }
    if (src.startsWith('\\big|', i)) { tokens.push({ type:'bar' }); i += 5; continue; }
    if (src[i] === '\\') { i++; while (i < src.length && /[a-zA-Z]/.test(src[i])) i++; continue; }
    if (src.charCodeAt(i) > 127) {
      const ch = tamilCluster(src, i);
      if (ch.trim()) tokens.push({ type:'normal', text: ch });
      i += ch.length; continue;
    }
    if (src[i] === '|') { tokens.push({ type:'bar' }); i++; continue; }
    i++;
  }
  return tokens;
}

function swaraHTML(tok) {
  const dT = tok.type === 'atitara' ? '&#9679;&#9679;' : tok.type === 'upper' ? '&#9679;' : '';
  const dB = tok.type === 'anumandra' ? '&#9679;&#9679;' : tok.type === 'lower' ? '&#9679;' : '';
  return `<span class="s"><span class="dot-top" style="letter-spacing:.5px">${dT}</span><span>${tok.text}</span><span class="dot-bot" style="letter-spacing:.5px">${dB}</span></span>`;
}

function renderFwd(tokens) {
  if (!tokens.length) return '<div class="placeholder">No swaras detected.</div>';
  return '<div class="notation-line">' + tokens.map(t =>
    t.type === 'bar'
      ? '<span class="bar"><span></span><span class="bar-mid">|</span><span></span></span>'
      : swaraHTML(t)
  ).join('') + '</div>';
}

function convertFwd() {
  flashPanel('fwd-output', renderFwd(tokeniseFwd(document.getElementById('fwd-input').value)));
}

function copyFwdPlain() {
  const tokens = tokeniseFwd(document.getElementById('fwd-input').value);
  // Build parts, then join with single space — bars get no extra padding
  const parts = tokens.map(t => {
    if (t.type === 'bar')       return '|';
    if (t.type === 'atitara')   return t.text + '..';
    if (t.type === 'upper')     return t.text + '.';
    if (t.type === 'lower')     return '.' + t.text;
    if (t.type === 'anumandra') return '..' + t.text;
    return t.text;
  });
  copyText(parts.join(' '));
}

function clearFwd() {
  document.getElementById('fwd-input').value = '';
  document.getElementById('fwd-output').innerHTML = '<div class="placeholder">Converted notation will appear here\u2026</div>';
}

// ═══════════════════════════════════════════════════════
//  REVERSE: Plain → LaTeX
// ═══════════════════════════════════════════════════════
function tokeniseRev(src) {
  const tokens = []; let i = 0;
  const skipWS = () => { while (i < src.length && /[ \t]/.test(src[i])) i++; };
  const isDot  = (c) => c === '.' || c === '\u00B7' || c === '\u2022';

  while (i < src.length) {
    if (/[\n\r]/.test(src[i])) { i++; continue; }
    skipWS(); if (i >= src.length) break;
    if (src[i] === '|') { tokens.push({ type:'bar' }); i++; continue; }

    // Pre-dots (lower / anumandra): count consecutive dots before Tamil char
    if (isDot(src[i])) {
      let dots = 0;
      while (i < src.length && isDot(src[i])) { dots++; i++; }
      skipWS();
      if (i < src.length && src.charCodeAt(i) > 127) {
        const ch = tamilCluster(src, i); i += ch.length;
        tokens.push({ type: dots >= 2 ? 'anumandra' : 'lower', text: ch }); continue;
      }
      continue; // lone dot(s) — skip
    }

    // Tamil cluster
    if (src.charCodeAt(i) > 127) {
      const ch = tamilCluster(src, i); i += ch.length;
      // Count post-dots
      let dots = 0;
      while (i < src.length && isDot(src[i])) { dots++; i++; }
      if (dots >= 2) { tokens.push({ type:'atitara',  text: ch }); continue; }
      if (dots === 1){ tokens.push({ type:'upper',    text: ch }); continue; }
      tokens.push({ type:'normal', text: ch }); continue;
    }

    i++;
  }
  return tokens;
}

function tokensToLatex(tokens) {
  return tokens.map(t => {
    if (t.type === 'bar')       return '\\;\\big|\\;';
    if (t.type === 'atitara')   return `\\overset{\\text{..}}{${t.text}}`;
    if (t.type === 'upper')     return `\\overset{\\text{.}}{${t.text}}`;
    if (t.type === 'lower')     return `\\underset{\\text{.}}{${t.text}}`;
    if (t.type === 'anumandra') return `\\underset{\\text{..}}{${t.text}}`;
    return t.text;
  }).join('\\ ');
}

function convertRev() {
  const tokens = tokeniseRev(document.getElementById('rev-input').value);
  const latex  = tokensToLatex(tokens);
  flashPanel('rev-output',
    latex
      ? `<div class="latex-out">${escHTML(latex)}</div>`
      : '<div class="placeholder">No swaras detected.</div>'
  );
}

function copyLatex() {
  copyText(tokensToLatex(tokeniseRev(document.getElementById('rev-input').value)));
}

function clearRev() {
  document.getElementById('rev-input').value = '';
  document.getElementById('rev-output').innerHTML = '<div class="placeholder">LaTeX code will appear here\u2026</div>';
}

// ═══════════════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════════════
function setMode(mode) {
  document.getElementById('mode-fwd').style.display = mode === 'fwd' ? '' : 'none';
  document.getElementById('mode-rev').style.display = mode === 'rev' ? '' : 'none';
  document.getElementById('tab-fwd').classList.toggle('active', mode === 'fwd');
  document.getElementById('tab-rev').classList.toggle('active', mode === 'rev');
}

// ═══════════════════════════════════════════════════════
//  REFERENCE TABLE
// ═══════════════════════════════════════════════════════
const REF = [
  ['\\overset{\\text{..}}{X}  /  X..', 'atitara',   'X', 'Ati-tāra sthāyi (s..)'],
  ['\\overset{\\text{.}}{X}  /  X.',   'upper',     'X', 'Tāra sthāyi (s.)'],
  ['X  (plain Tamil)',                  'normal',    'X', 'Madhya sthāyi (s)'],
  ['\\underset{\\text{.}}{X}  /  .X',  'lower',     'X', 'Mandra sthāyi (.s)'],
  ['\\underset{\\text{..}}{X}  /  ..X','anumandra', 'X', 'Anu-mandra sthāyi (..s)'],
  ['\\;\\big|\\;  /  |',               'bar',       '|', 'Beat / bar separator'],
];

(function buildRef() {
  const tb = document.getElementById('ref-body');
  REF.forEach(([latex, type, ch, desc]) => {
    const tr = document.createElement('tr');
    let cell;
    if (type === 'bar') {
      cell = `<span class="bar" style="font-size:.95rem"><span></span><span class="bar-mid">|</span><span></span></span>`;
    } else {
      const dT = type === 'atitara' ? '&#9679;&#9679;' : type === 'upper' ? '&#9679;' : '';
      const dB = type === 'anumandra' ? '&#9679;&#9679;' : type === 'lower' ? '&#9679;' : '';
      cell = `<span class="s" style="font-size:.95rem"><span class="dot-top" style="letter-spacing:.5px">${dT}</span><span>${ch}</span><span class="dot-bot" style="letter-spacing:.5px">${dB}</span></span>`;
    }
    tr.innerHTML = `<td>${escHTML(latex)}</td><td>${cell}</td><td>${desc}</td>`;
    tb.appendChild(tr);
  });
})();

// ═══════════════════════════════════════════════════════
//  DARK MODE SYNC (PaperMod adds .dark to <html>)
// ═══════════════════════════════════════════════════════
(function syncDark() {
  const html = document.documentElement;
  const sync = () => document.body.classList.toggle('dark', html.classList.contains('dark'));
  new MutationObserver(sync).observe(html, { attributes:true, attributeFilter:['class'] });
  sync();
})();

// ═══════════════════════════════════════════════════════
//  LIVE PREVIEW + INIT
// ═══════════════════════════════════════════════════════
let fwdT, revT;
document.getElementById('fwd-input').addEventListener('input', () => { clearTimeout(fwdT); fwdT = setTimeout(convertFwd, 280); });
document.getElementById('rev-input').addEventListener('input', () => { clearTimeout(revT); revT = setTimeout(convertRev, 280); });

convertFwd();
