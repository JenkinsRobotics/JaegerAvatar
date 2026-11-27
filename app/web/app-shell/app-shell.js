// NexusUI app shell without React: the same container, navigation bar and status bar as AppShell.tsx (same classes,
// same app-shell.css), for apps written in plain JS. Copy this folder into the app; the app owns its copy.
//
//   import { mountAppShell } from './app-shell/app-shell.js';
//   const shell = mountAppShell(document.getElementById('app'), { id: 'jaeger-avatar',
//     brand: { name: 'Jaeger', suffix: 'Avatar', mark: 'mark.svg' },
//     sections: [{ id: 'pages', title: 'Pages', items: [{ id: 'home', label: 'Studio', icon: 'home' }] }],
//     current: 'home', onSelect: id => show(id), settings: { id: 'settings', label: 'Settings', icon: 'settings' },
//     profile: { name: 'Nori', detail: 'Ready', connection: 'connected' }, status: { name: 'Jaeger Avatar', connection: 'local' } });
//   shell.main          // the app's existing content was moved in here, unchanged
//   shell.tools         // an element in the footer for the app's own controls (moved there, ids kept)
//   shell.setCurrent(id); shell.setProfile({...}); shell.setStatus({...}); shell.setBadge(id, value)
import { ICONS } from './icons.js';

const h = (tag, cls, attrs = {}) => { const e = document.createElement(tag); if (cls) e.className = cls; for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); return e; };
const icon = name => { const s = h('span', 'nx-icon', { 'aria-hidden': 'true' }); if (typeof name === 'string') s.innerHTML = ICONS[name] ?? ''; else if (name) s.append(name); return s; };   // repository-owned SVG, never user data
const remembered = (key, fallback) => { try { const v = localStorage.getItem(key); return v ? v === '1' : fallback; } catch { return fallback; } };
const remember = (key, on) => { try { localStorage.setItem(key, on ? '1' : '0'); } catch { /* a device preference only */ } };

export function mountAppShell(root, cfg) {
  const rows = new Map();
  const row = item => {
    const el = item.href && !item.disabled ? h('a', 'nx-row', { href: item.href, target: '_blank', rel: 'noreferrer' }) : h('button', 'nx-row', { type: 'button', disabled: !!item.disabled });
    el.title = item.label; el.setAttribute('aria-label', item.label);
    if (item.id) el.dataset.id = item.id;
    const label = h('span', 'nx-label'); label.textContent = item.label;
    el.append(icon(item.icon), label);
    if (item.badge !== undefined) { const b = h('span', 'nx-badge'); b.textContent = item.badge; el.append(b); }
    el.addEventListener('click', ev => { if (item.onSelect) item.onSelect(ev); else if (!item.href) cfg.onSelect?.(item.id); });
    rows.set(item.id, el);
    return el;
  };

  const app = h('div', 'nx-app');
  const side = h('aside', 'nx-sidebar', { 'aria-label': `${cfg.brand.name} ${cfg.brand.suffix ?? ''} sidebar`.replace('  ', ' ') });
  const railKey = `nx-shell-${cfg.id}-rail`;
  const brand = h('button', 'nx-brand', { type: 'button' });
  const setRail = on => { side.classList.toggle('nx-collapsed', on); brand.setAttribute('aria-expanded', String(!on)); brand.title = on ? 'Expand sidebar' : 'Collapse sidebar'; };
  if (cfg.brand.mark) { const m = h('span', 'nx-mark', { 'aria-hidden': 'true' }); if (typeof cfg.brand.mark === 'string') m.append(Object.assign(h('img', '', { alt: '' }), { src: cfg.brand.mark })); else m.append(cfg.brand.mark); brand.append(m); }
  const word = h('span', 'nx-wordmark'), name = h('b'), suffix = h('i');
  name.textContent = cfg.brand.name; word.append(name); if (cfg.brand.suffix) { suffix.textContent = cfg.brand.suffix; word.append(suffix); }
  brand.append(word);
  brand.addEventListener('click', () => { const on = !side.classList.contains('nx-collapsed'); setRail(on); remember(railKey, on); });
  setRail(remembered(railKey, false));

  const body = h('div', 'nx-sidebar-body'), sections = h('div', 'nx-sections');
  for (const s of cfg.sections) {
    const nav = h('nav', 'nx-section', { 'aria-label': s.title ?? 'Navigation' }), items = h('div', 'nx-section-items');
    if (s.title) {
      const key = `nx-shell-${cfg.id}-${s.id}`, cap = h('button', 'nx-caption', { type: 'button' }), t = h('span');
      t.textContent = s.title;
      const set = open => { items.hidden = !open; cap.setAttribute('aria-expanded', String(open)); cap.setAttribute('aria-label', `${open ? 'Hide' : 'Show'} ${s.title}`); cap.replaceChildren(t, icon(open ? 'chevron-down' : 'chevron-right')); };
      cap.addEventListener('click', () => { const open = items.hidden; set(open); remember(key, open); });
      set(remembered(key, true));
      nav.append(cap);
    }
    for (const it of s.items) items.append(row(it));
    nav.append(items); sections.append(nav);
  }
  body.append(sections);

  const foot = h('div', 'nx-sidebar-footer'), tools = h('div', 'nx-tools');
  for (const t of cfg.tools ?? []) tools.append(row(t));
  foot.append(tools);
  if (cfg.settings || cfg.apps) { const st = h('div', 'nx-settings'); for (const it of [cfg.settings, cfg.apps]) if (it) st.append(row(it)); foot.append(st); }
  const profile = h('div', 'nx-profile'); foot.append(profile);
  side.append(brand, body, foot);

  const main = h('main', 'nx-main');
  while (root.firstChild) main.append(root.firstChild);   // the app's content, unchanged
  const status = h('footer', 'nx-status', { role: 'status' });
  app.append(side, main, status);
  root.append(app);

  const shell = {
    main, tools, sidebar: side,
    setCurrent(id) { for (const el of rows.values()) el.removeAttribute('aria-current'); rows.get(id)?.setAttribute('aria-current', 'page'); },
    setBadge(id, value) { const el = rows.get(id); if (!el) return; let b = el.querySelector('.nx-badge'); if (value === undefined || value === null || value === '') { b?.remove(); return; } if (!b) { b = h('span', 'nx-badge'); el.append(b); } b.textContent = value; },
    setProfile(p) {
      if (!p) { profile.replaceChildren(); return; }
      const av = h('span', 'nx-avatar', { 'aria-hidden': 'true' });
      if (typeof p.avatar === 'string') av.append(Object.assign(h('img', '', { alt: '' }), { src: p.avatar })); else if (p.avatar) av.append(p.avatar); else av.textContent = (p.name || '?').slice(0, 1);
      const text = h('span', 'nx-profile-text'), n = h('b'); n.textContent = p.name; text.append(n);
      if (p.detail) { const d = h('span'); if (p.connection) d.append(h('i', 'nx-dot', { 'data-connection': p.connection })); d.append(p.detail); text.append(d); }
      profile.title = p.detail ? `${p.name} · ${p.detail}` : p.name;
      profile.replaceChildren(av, text);
    },
    setStatus(s) {
      const dot = h('i', 'nx-dot', { 'data-connection': s.connection ?? 'local' }), n = h('span', 'nx-status-name'), m = h('span', 'nx-status-message'), c = h('span', 'nx-status-company');
      n.textContent = s.name; m.textContent = s.message ?? ''; c.textContent = s.company ?? '';
      status.replaceChildren(dot, n, m, c);
    },
  };
  shell.setCurrent(cfg.current);
  shell.setProfile(cfg.profile);
  shell.setStatus(cfg.status ?? { name: `${cfg.brand.name} ${cfg.brand.suffix ?? ''}`.trim() });
  return shell;
}
