/**
 * Small DOM helpers. Deliberately thin — the game is not a web app and does
 * not need a framework, but a handful of shortcuts keep the screen code
 * readable.
 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * el('div.klass#id', { attrs }, ...children)
 * Children may be nodes, strings, or falsy (skipped).
 */
export function el(spec, attrs = null, ...children) {
  const [tagAndClass, id] = spec.split('#');
  const [tag, ...classes] = tagAndClass.split('.');
  const node = document.createElement(tag || 'div');
  if (id) node.id = id;
  if (classes.length) node.className = classes.join(' ');

  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    }
  }

  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/**
 * Append children, skipping null/false.
 *
 * Native Element.append() stringifies null into the literal text "null", so a
 * conditional child that evaluates to null renders as visible junk — two of
 * them side by side produced "nullnull" on the map's node card.
 */
export function append(node, ...children) {
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function show(node, on = true) {
  if (node) node.hidden = !on;
}

/** Format seconds as h:mm:ss / m:ss. */
export function duration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

export function relativeTime(ts) {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** A shared tooltip that follows the pointer. */
let tipEl = null;

export function tooltip(target, contentFn) {
  if (!tipEl) {
    tipEl = el('div.tip', { hidden: true });
    document.body.append(tipEl);
  }
  const move = e => {
    const pad = 14;
    const r = tipEl.getBoundingClientRect();
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - pad;
    tipEl.style.left = `${Math.max(6, x)}px`;
    tipEl.style.top = `${Math.max(6, y)}px`;
  };
  target.addEventListener('pointerenter', e => {
    const content = contentFn();
    if (!content) return;
    clear(tipEl);
    tipEl.append(content instanceof Node ? content : document.createTextNode(content));
    tipEl.hidden = false;
    move(e);
  });
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerleave', () => { tipEl.hidden = true; });
  return target;
}

export function hideTooltip() { if (tipEl) tipEl.hidden = true; }

/** Build the standard tooltip body: a name, a description, and stat lines. */
export function tipContent(name, desc, stats = []) {
  return el('div', null,
    el('span.tipname', { text: name }),
    desc ? el('span', { text: desc }) : null,
    ...stats.filter(Boolean).map(s => el('span.tipstat', { text: s })));
}
