const { Plugin, PluginSettingTab, Setting } = require('obsidian');

/**
 * Cursor rules
 * ------------
 * For every combination of
 *   input device : 'mouse' | 'pen'  (pen = Windows Ink pen and touch)
 *   area         : 'excalidraw' (inside Excalidraw views) | 'elsewhere' (rest of Obsidian)
 * the user picks one cursor behaviour:
 *   unchanged         -> plugin does nothing, Obsidian's normal cursor
 *   system            -> native Windows arrow
 *   crosshair         -> native crosshair
 *   hidden            -> native cursor hidden, nothing drawn
 *   virtual-dot       -> native cursor hidden, virtual dot drawn (always visible)
 *   virtual-arrow     -> native cursor hidden, virtual Windows-style arrow drawn (always visible)
 *   virtual-brush     -> native cursor hidden, virtual paintbrush drawn (always visible)
 *   virtual-crosshair -> native cursor hidden, precision reticle crosshair (always visible)
 *   virtual-nib       -> native cursor hidden, calligraphy fountain pen nib (always visible)
 *   virtual-mac       -> native cursor hidden, sleek rounded modern pointer (always visible)
 *   virtual-laser     -> native cursor hidden, glowing laser pointer dot (always visible)
 *   virtual-wand      -> native cursor hidden, sparkle magic wand (always visible)
 */
const CURSOR_OPTIONS = {
  unchanged: 'Leave as is (Obsidian default)',
  system: 'Windows arrow (native)',
  crosshair: 'Crosshair (native)',
  hidden: 'Hidden (no cursor)',
  'virtual-dot': 'Virtual dot (always visible)',
  'virtual-arrow': 'Virtual arrow (always visible)',
  'virtual-brush': 'Virtual brush (always visible)',
  'virtual-crosshair': 'Virtual precision reticle (always visible)',
  'virtual-nib': 'Virtual fountain pen nib (always visible)',
  'virtual-mac': 'Virtual sleek pointer (always visible)',
  'virtual-laser': 'Virtual laser pointer (always visible)',
  'virtual-wand': 'Virtual sparkle wand (always visible)',
};

/** CSS cursor value for the native-cursor override ('unchanged' has none). */
const CURSOR_CSS = {
  system: 'default',
  crosshair: 'crosshair',
  hidden: 'none',
  'virtual-dot': 'none',
  'virtual-arrow': 'none',
  'virtual-brush': 'none',
  'virtual-crosshair': 'none',
  'virtual-nib': 'none',
  'virtual-mac': 'none',
  'virtual-laser': 'none',
  'virtual-wand': 'none',
};

const VIRTUAL = [
  'virtual-dot',
  'virtual-arrow',
  'virtual-brush',
  'virtual-crosshair',
  'virtual-nib',
  'virtual-mac',
  'virtual-laser',
  'virtual-wand',
];

const SHAPE_CLASSES = [
  'vpc-shape-arrow',
  'vpc-shape-brush',
  'vpc-shape-crosshair',
  'vpc-shape-nib',
  'vpc-shape-mac',
  'vpc-shape-laser',
  'vpc-shape-wand',
];

const CLICK_EFFECTS = {
  ripple: 'Expanding ripple ring',
  burst: 'Particle starburst',
  pulse: 'Soft color pulse',
  ring: 'Double shockwave',
  shrink: 'Cursor press only (no burst)',
  none: 'None',
};

const DEVICES = ['mouse', 'pen'];
const AREAS = ['excalidraw', 'elsewhere'];

/**
 * After pen activity Windows/Chromium can emit emulated 'mouse' pointer events (e.g. when the
 * pen lifts). Mouse events within this window (ms) of the last pen event are ignored so the
 * mouse's cursor rules don't flash up.
 */
const PEN_GRACE_MS = 600;

const DEFAULT_COLORS = {
  dotBorder: '#7c3aed',
  dotFill: '#ffffff',
  dotFillOpacity: 0.4,
  arrowFill: '#ffffff',
  arrowStroke: '#000000',
  brushTip: '#7c3aed',
  brushHandle: '#d97706',
  brushFerrule: '#9ca3af',
  crosshairStroke: '#06b6d4',
  crosshairCenter: '#f43f5e',
  nibBody: '#f59e0b',
  nibAccent: '#1e293b',
  macFill: '#111827',
  macStroke: '#ffffff',
  laserCore: '#ffffff',
  laserGlow: '#ef4444',
  wandStar: '#facc15',
  wandShaft: '#a855f7',
};

const DEFAULT_CLICK_ANIM = {
  effect: 'ripple', // 'ripple' | 'burst' | 'pulse' | 'ring' | 'shrink' | 'none'
  pressShrink: true,
  color: '#7c3aed',
  size: 36, // px diameter
  duration: 400, // ms
  devices: 'both', // 'pen' | 'mouse' | 'both'
};

const DEFAULT_PRESSURE = {
  enabled: false,
  minScale: 0.75, // Multiplier at lightest touch (pressure -> 0+)
  maxScale: 1.85, // Multiplier at maximum stylus pressure (pressure = 1.0)
};

const DEFAULT_SETTINGS = {
  rules: {
    mouse: { excalidraw: 'virtual-dot', elsewhere: 'unchanged' },
    pen: { excalidraw: 'virtual-dot', elsewhere: 'unchanged' },
  },
  fadeDelay: 3, // seconds of inactivity before virtual cursor fades (0 = never)
  cursorScale: 1, // size multiplier for the virtual cursors
  colors: Object.assign({}, DEFAULT_COLORS),
  clickAnim: Object.assign({}, DEFAULT_CLICK_ANIM),
  pressure: Object.assign({}, DEFAULT_PRESSURE),
};

const PRESETS = [
  {
    name: 'Excalidraw: virtual dot',
    desc: 'Virtual dot in Excalidraw for pen and mouse, rest of Obsidian untouched.',
    rules: {
      mouse: { excalidraw: 'virtual-dot', elsewhere: 'unchanged' },
      pen: { excalidraw: 'virtual-dot', elsewhere: 'unchanged' },
    },
  },
  {
    name: 'Excalidraw: virtual brush',
    desc: 'Virtual paintbrush in Excalidraw for pen and mouse, rest of Obsidian untouched.',
    rules: {
      mouse: { excalidraw: 'virtual-brush', elsewhere: 'unchanged' },
      pen: { excalidraw: 'virtual-brush', elsewhere: 'unchanged' },
    },
  },
  {
    name: 'Excalidraw: fountain pen',
    desc: 'Calligraphy fountain nib for pen in Excalidraw, sleek pointer for mouse.',
    rules: {
      mouse: { excalidraw: 'virtual-mac', elsewhere: 'unchanged' },
      pen: { excalidraw: 'virtual-nib', elsewhere: 'unchanged' },
    },
  },
  {
    name: 'Excalidraw: precision CAD',
    desc: 'Virtual precision reticle in Excalidraw for pen and mouse.',
    rules: {
      mouse: { excalidraw: 'virtual-crosshair', elsewhere: 'unchanged' },
      pen: { excalidraw: 'virtual-crosshair', elsewhere: 'unchanged' },
    },
  },
  {
    name: 'Pen: virtual arrow everywhere',
    desc: 'Pen/touch gets a virtual Windows arrow in all of Obsidian. Mouse untouched.',
    rules: {
      mouse: { excalidraw: 'unchanged', elsewhere: 'unchanged' },
      pen: { excalidraw: 'virtual-arrow', elsewhere: 'virtual-arrow' },
    },
  },
  {
    name: 'Presentation laser',
    desc: 'Glowing laser pointer in Excalidraw for pen and mouse.',
    rules: {
      mouse: { excalidraw: 'virtual-laser', elsewhere: 'unchanged' },
      pen: { excalidraw: 'virtual-laser', elsewhere: 'unchanged' },
    },
  },
  {
    name: 'Off',
    desc: 'Leave every cursor as it is.',
    rules: {
      mouse: { excalidraw: 'unchanged', elsewhere: 'unchanged' },
      pen: { excalidraw: 'unchanged', elsewhere: 'unchanged' },
    },
  },
];

const clone = (o) => JSON.parse(JSON.stringify(o));

/** Convert hex color + opacity to rgba() string */
function hexToRgba(hex, alpha = 1) {
  const clean = String(hex || '#ffffff').replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Build the SVG inner markup for virtual cursors. */
function getCursorSvg(shape, colors) {
  const c = Object.assign({}, DEFAULT_COLORS, colors);
  switch (shape) {
    case 'virtual-arrow':
      return `<svg class="vpc-svg vpc-svg-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 13 20">
        <path d="M0.5 0.5V16.5L4.5 12.5L7 18.5L9.5 17.5L7 11.5H12.5Z" fill="${c.arrowFill}" stroke="${c.arrowStroke}" stroke-width="1.1" stroke-linejoin="miter"/>
      </svg>`;
    case 'virtual-brush':
      return `<svg class="vpc-svg vpc-svg-brush" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M20.7 3.3a2.4 2.4 0 0 0-3.4 0L9 11.6l3.4 3.4 8.3-8.3a2.4 2.4 0 0 0 0-3.4Z" fill="${c.brushHandle}" stroke="#1f2937" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M7.2 13.4 9 11.6l3.4 3.4-1.8 1.8Z" fill="${c.brushFerrule}" stroke="#1f2937" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M1 23c1.6-4.2 3.2-6.8 6.2-9.6l3.4 3.4C7.8 19.8 5.2 21.4 1 23Z" fill="${c.brushTip}" stroke="#1f2937" stroke-width="1.1" stroke-linejoin="round"/>
      </svg>`;
    case 'virtual-crosshair':
      return `<svg class="vpc-svg vpc-svg-crosshair" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="7" fill="none" stroke="${c.crosshairStroke}" stroke-width="1.5" opacity="0.85"/>
        <path d="M12 1v7M12 16v7M1 12h7M16 12h7" stroke="${c.crosshairStroke}" stroke-width="1.6" stroke-linecap="round"/>
        <circle cx="12" cy="12" r="1.8" fill="${c.crosshairCenter}"/>
      </svg>`;
    case 'virtual-nib':
      return `<svg class="vpc-svg vpc-svg-nib" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M15.5 3.5 20.5 8.5 17 12 12 7Z" fill="${c.nibAccent}" stroke="#0f172a" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M12 7 17 12 13.5 18.5 2 22 5.5 10.5Z" fill="${c.nibBody}" stroke="#0f172a" stroke-width="1.1" stroke-linejoin="round"/>
        <line x1="2" y1="22" x2="9.2" y2="14.8" stroke="${c.nibAccent}" stroke-width="1.2" stroke-linecap="round"/>
        <circle cx="9.8" cy="14.2" r="1.5" fill="${c.nibAccent}"/>
      </svg>`;
    case 'virtual-mac':
      return `<svg class="vpc-svg vpc-svg-mac" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 24">
        <path d="M1.2 1.4v16.4l4.1-3.9 2.7 6.3c.3.7 1.1 1 1.8.7l1.3-.6c.7-.3 1-1.1.7-1.8l-2.7-6.1h5.6L1.2 1.4Z" fill="${c.macFill}" stroke="${c.macStroke}" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`;
    case 'virtual-wand':
      return `<svg class="vpc-svg vpc-svg-wand" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M8.5 8.5 21.5 21.5" stroke="${c.wandShaft}" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M8.5 8.5 11.5 11.5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M4.5 1 5.7 3.3 8 4.5 5.7 5.7 4.5 8 3.3 5.7 1 4.5 3.3 3.3Z" fill="${c.wandStar}" stroke="#1f2937" stroke-width="0.8" stroke-linejoin="round"/>
        <circle cx="11" cy="3" r="1.1" fill="${c.wandStar}"/>
        <circle cx="3" cy="11" r="1.1" fill="${c.wandStar}"/>
      </svg>`;
    default:
      return '';
  }
}

/** Apply size, shape & color styling to any virtual cursor DOM element (live cursor or preview). */
function styleCursorElement(el, rule, settings) {
  const c = Object.assign({}, DEFAULT_COLORS, settings.colors);
  const scale = Number(settings.cursorScale) || 1;
  el.style.setProperty('--vpc-scale', String(scale));
  el.style.setProperty('--vpc-dot-border', c.dotBorder);
  el.style.setProperty('--vpc-dot-fill', hexToRgba(c.dotFill, c.dotFillOpacity));
  el.style.setProperty('--vpc-laser-core', c.laserCore);
  el.style.setProperty('--vpc-laser-glow', c.laserGlow);

  for (const cls of SHAPE_CLASSES) el.classList.remove(cls);
  if (rule !== 'virtual-dot' && VIRTUAL.includes(rule)) {
    el.classList.add(rule.replace('virtual-', 'vpc-shape-'));
  }

  const needsSvg = !['virtual-dot', 'virtual-laser'].includes(rule) && VIRTUAL.includes(rule);
  const svgKey = needsSvg
    ? `${rule}:${c.arrowFill}:${c.arrowStroke}:${c.brushTip}:${c.brushHandle}:${c.brushFerrule}:${c.crosshairStroke}:${c.crosshairCenter}:${c.nibBody}:${c.nibAccent}:${c.macFill}:${c.macStroke}:${c.wandStar}:${c.wandShaft}`
    : '';
  if (el._vpcSvgKey !== svgKey) {
    el._vpcSvgKey = svgKey;
    el.innerHTML = svgKey ? getCursorSvg(rule, c) : '';
  }
}

/** Spawn a transient click animation element at (x, y) inside container (or document.body). */
function spawnClickEffect(doc, x, y, clickAnim, isPreview = false, previewHost = null) {
  const anim = Object.assign({}, DEFAULT_CLICK_ANIM, clickAnim);
  if (!anim.effect || anim.effect === 'none' || anim.effect === 'shrink') return;
  const host = isPreview && previewHost ? previewHost : doc.body;
  if (!host || typeof doc.createElement !== 'function') return;

  const el = doc.createElement('div');
  el.className = `vpc-click-fx vpc-fx-${anim.effect}${isPreview ? ' is-preview' : ''}`;
  if (!isPreview) {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }
  el.style.setProperty('--vpc-fx-color', anim.color || '#7c3aed');
  el.style.setProperty('--vpc-fx-size', `${Number(anim.size) || 36}px`);
  const dur = Math.max(100, Number(anim.duration) || 400);
  el.style.setProperty('--vpc-fx-duration', `${dur}ms`);

  if (anim.effect === 'burst') {
    el.innerHTML = `<svg viewBox="0 0 40 40" class="vpc-fx-svg">
      <g stroke="${anim.color || '#7c3aed'}" stroke-width="2.2" stroke-linecap="round">
        <line x1="20" y1="3" x2="20" y2="10"/>
        <line x1="20" y1="30" x2="20" y2="37"/>
        <line x1="3" y1="20" x2="10" y2="20"/>
        <line x1="30" y1="20" x2="37" y2="20"/>
        <line x1="8" y1="8" x2="13" y2="13"/>
        <line x1="27" y1="27" x2="32" y2="32"/>
        <line x1="32" y1="8" x2="27" y2="13"/>
        <line x1="13" y1="27" x2="8" y2="32"/>
      </g>
    </svg>`;
  }

  host.appendChild(el);
  setTimeout(() => el.remove(), dur + 50);
}

/** Convert settings of plugin versions <= 1.2 (scope / style / devices) to per-device rules. */
function migrateLegacy(old) {
  const rules = clone(DEFAULT_SETTINGS.rules);
  const enabled = old.overrideEnabled !== false;
  const scope = old.overrideScope || 'excalidraw';
  const style = old.cursorStyle || 'virtual';
  const devices = old.inputDevices || 'both';
  const deviceAllowed = (d) => devices === 'both' || devices === d || (devices === 'ink' && d === 'pen');
  const inScope = (area, d) =>
    scope === 'both' ? area === 'excalidraw' || d === 'pen'
      : scope === 'ink' ? d === 'pen'
      : area === 'excalidraw';

  for (const d of DEVICES) {
    for (const a of AREAS) {
      let v = 'unchanged';
      if (inScope(a, d)) {
        if (style === 'virtual' || style === 'virtual-arrow') v = deviceAllowed(d) ? style.replace(/^virtual$/, 'virtual-dot') : 'hidden';
        else if (style === 'system' || style === 'crosshair') v = style;
      }
      rules[d][a] = enabled ? v : 'unchanged';
    }
  }
  return {
    rules,
    fadeDelay: old.fadeDelay,
    cursorScale: old.cursorScale,
  };
}

module.exports = class VirtualPenCursorPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    /** @type {Map<Window, object>} per-window state (main window + popouts) */
    this.windows = new Map();

    this.attachWindow(window);

    // Support Obsidian popout windows
    this.registerEvent(this.app.workspace.on('window-open', (_w, win) => this.attachWindow(win)));
    this.registerEvent(this.app.workspace.on('window-close', (_w, win) => this.detachWindow(win)));
    this.app.workspace.onLayoutReady(() => {
      this.app.workspace.iterateAllLeaves((leaf) => {
        const win = leaf.view && leaf.view.containerEl && leaf.view.containerEl.win;
        if (win) this.attachWindow(win);
      });
    });

    this.addSettingTab(new VirtualPenCursorSettingTab(this.app, this));
  }

  onunload() {
    for (const win of Array.from(this.windows.keys())) this.detachWindow(win);
  }

  async loadSettings() {
    let data = (await this.loadData()) || {};
    if (!data.rules && ('cursorStyle' in data || 'overrideScope' in data || 'overrideEnabled' in data)) {
      data = migrateLegacy(data);
    }
    const s = Object.assign({}, clone(DEFAULT_SETTINGS), data);
    // Validate rules (fill gaps, discard unknown values)
    const rules = clone(DEFAULT_SETTINGS.rules);
    for (const d of DEVICES) {
      for (const a of AREAS) {
        const v = data.rules && data.rules[d] && data.rules[d][a];
        if (v in CURSOR_OPTIONS) rules[d][a] = v;
      }
    }
    s.rules = rules;
    s.colors = Object.assign({}, DEFAULT_COLORS, data.colors || {});
    s.clickAnim = Object.assign({}, DEFAULT_CLICK_ANIM, data.clickAnim || {});
    if (!(s.clickAnim.effect in CLICK_EFFECTS)) s.clickAnim.effect = DEFAULT_CLICK_ANIM.effect;
    s.pressure = Object.assign({}, DEFAULT_PRESSURE, data.pressure || {});
    s.pressure.enabled = !!s.pressure.enabled;
    s.pressure.minScale = Number.isFinite(Number(s.pressure.minScale)) ? Number(s.pressure.minScale) : DEFAULT_PRESSURE.minScale;
    s.pressure.maxScale = Number.isFinite(Number(s.pressure.maxScale)) ? Number(s.pressure.maxScale) : DEFAULT_PRESSURE.maxScale;
    delete s.enabled; // legacy: Obsidian's own plugin toggle replaces it
    s.fadeDelay = Number.isFinite(Number(s.fadeDelay)) ? Number(s.fadeDelay) : DEFAULT_SETTINGS.fadeDelay;
    s.cursorScale = Number(s.cursorScale) || 1;
    this.settings = s;
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.applySettings();
  }

  // ---------------------------------------------------------------- windows

  attachWindow(win) {
    if (!win || this.windows.has(win)) return;
    const doc = win.document;

    const el = doc.createElement('div');
    el.id = 'virtual-pen-cursor';
    el.className = 'virtual-pen-cursor';
    doc.body.appendChild(el);

    const state = { win, doc, el, rafId: null, hideTimer: null, x: 0, y: 0, pScale: 1, inputType: 'mouse', lastPenTime: -Infinity, currentRule: 'virtual-dot' };
    this.windows.set(win, state);

    const opts = { passive: true, capture: true };
    this.registerDomEvent(win, 'pointermove', (e) => this.handlePointer(state, e, null), opts);
    this.registerDomEvent(win, 'pointerdown', (e) => this.handlePointer(state, e, 'down'), opts);
    this.registerDomEvent(win, 'pointerup', (e) => this.handlePointer(state, e, 'up'), opts);
    this.registerDomEvent(win, 'pointercancel', () => this.hideCursor(state), opts);
    this.registerDomEvent(doc.documentElement, 'pointerleave', () => this.hideCursor(state));
    this.registerDomEvent(win, 'blur', () => this.hideCursor(state));

    this.applyBodyState(state);
  }

  detachWindow(win) {
    const state = this.windows.get(win);
    if (!state) return;
    if (state.rafId) state.win.cancelAnimationFrame(state.rafId);
    clearTimeout(state.hideTimer);
    state.el.remove();
    const body = state.doc.body;
    body.classList.remove('vpc-ov-excalidraw', 'vpc-ov-elsewhere');
    body.style.removeProperty('--vpc-cursor-excalidraw');
    body.style.removeProperty('--vpc-cursor-elsewhere');
    this.windows.delete(win);
  }

  // ---------------------------------------------------------------- settings -> DOM

  applySettings() {
    for (const state of this.windows.values()) {
      this.applyBodyState(state);
      this.hideCursor(state);
    }
    if (this.settingTab && typeof this.settingTab.updatePreviews === 'function') {
      this.settingTab.updatePreviews();
    }
  }

  /** The rule that applies for the given device / area. */
  ruleFor(device, area) {
    return this.settings.rules[device][area];
  }

  /** True if the element is inside Obsidian's settings window (always keeps the default cursor). */
  isInSettingsWindow(target) {
    if (!target || typeof target.closest !== 'function') return false;
    if (target.closest('.modal.mod-settings') || target.closest('.mod-settings')) return true;
    const container = target.closest('.modal-container');
    if (container && container.querySelector('.mod-settings')) return true;
    return false;
  }

  /**
   * Native cursor override: for the device currently in use, expose the cursor for each area
   * through CSS variables + body classes (see styles.css).
   */
  applyBodyState(state) {
    const body = state.doc.body;
    for (const area of AREAS) {
      const css = CURSOR_CSS[this.ruleFor(state.inputType, area)];
      body.classList.toggle(`vpc-ov-${area}`, !!css);
      if (css) body.style.setProperty(`--vpc-cursor-${area}`, css);
      else body.style.removeProperty(`--vpc-cursor-${area}`);
    }
    styleCursorElement(state.el, state.currentRule || 'virtual-dot', this.settings);
  }

  // ---------------------------------------------------------------- pointer logic

  /** Compute the pressure multiplier (1 when disabled, hovering, or non-pen). */
  computePressureScale(e, phase) {
    const pr = this.settings.pressure || DEFAULT_PRESSURE;
    if (!pr.enabled || e.pointerType !== 'pen' || phase === 'up') return 1;
    const raw = Number(e.pressure);
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    const p = Math.max(0, Math.min(1, raw));
    return Number((pr.minScale + p * (pr.maxScale - pr.minScale)).toFixed(3));
  }

  handlePointer(state, e, phase) {
    const device = e.pointerType === 'pen' || e.pointerType === 'touch' ? 'pen'
      : e.pointerType === 'mouse' ? 'mouse' : null;
    if (!device) return;

    // Emulated mouse events right after pen activity must not switch to the mouse's rules
    const now = Date.now();
    if (device === 'pen') state.lastPenTime = now;
    else if (now - state.lastPenTime < PEN_GRACE_MS) return;

    if (device !== state.inputType) {
      state.inputType = device;
      this.applyBodyState(state);
    }

    // Feed live stylus pressure to the Settings tab meter if open
    if (e.pointerType === 'pen' && this.settingTab && typeof this.settingTab.onLivePenPressure === 'function') {
      this.settingTab.onLivePenPressure(phase === 'up' ? 0 : (Number(e.pressure) || 0));
    }

    const target = e.target;
    const inSettings = this.isInSettingsWindow(target);
    const inExcalidraw = !!(target && typeof target.closest === 'function' && target.closest('.excalidraw'));
    const rule = inSettings
      ? 'unchanged'
      : this.ruleFor(device, inExcalidraw ? 'excalidraw' : 'elsewhere');

    // Trigger click animation on pointerdown if allowed for this device and virtual cursor is active
    const anim = this.settings.clickAnim || DEFAULT_CLICK_ANIM;
    const animDeviceAllowed = anim.devices === 'both' || anim.devices === device;

    if (!VIRTUAL.includes(rule)) {
      this.hideCursor(state);
      return;
    }

    state.currentRule = rule;
    styleCursorElement(state.el, rule, this.settings);
    state.x = e.clientX;
    state.y = e.clientY;
    state.pScale = this.computePressureScale(e, phase);

    const pressureActive = !!(this.settings.pressure && this.settings.pressure.enabled && e.pointerType === 'pen');
    state.el.classList.toggle('is-pressure-active', pressureActive);

    // Visual feedback on contact: shrink/tilt cursor + spawn click animation
    if (phase === 'down') {
      if (anim.pressShrink !== false && anim.effect !== 'none') {
        state.el.classList.add('is-pressed');
      }
      if (animDeviceAllowed) {
        spawnClickEffect(state.doc, state.x, state.y, anim, false);
      }
    } else if (phase === 'up') {
      state.el.classList.remove('is-pressed');
    }

    if (state.rafId) state.win.cancelAnimationFrame(state.rafId);
    state.rafId = state.win.requestAnimationFrame(() => {
      state.rafId = null;
      state.el.style.left = `${state.x}px`;
      state.el.style.top = `${state.y}px`;
      state.el.style.setProperty('--vpc-pressure-scale', String(state.pScale));
      state.el.classList.add('is-visible');
    });

    // Auto-fade after inactivity
    clearTimeout(state.hideTimer);
    const delay = Number(this.settings.fadeDelay) || 0;
    if (delay > 0) {
      state.hideTimer = setTimeout(() => state.el.classList.remove('is-visible'), delay * 1000);
    }
  }

  hideCursor(state) {
    if (state.rafId) {
      state.win.cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    clearTimeout(state.hideTimer);
    state.pScale = 1;
    state.el.style.setProperty('--vpc-pressure-scale', '1');
    state.el.classList.remove('is-visible', 'is-pressed', 'is-pressure-active');
  }
};

// ==================================================================== settings tab

const PREVIEW_DEFS = [
  { rule: 'virtual-dot', title: 'Virtual dot', hotspot: 'Center' },
  { rule: 'virtual-arrow', title: 'Virtual arrow', hotspot: 'Top-left tip' },
  { rule: 'virtual-brush', title: 'Virtual brush', hotspot: 'Bottom-left bristles' },
  { rule: 'virtual-crosshair', title: 'Precision reticle', hotspot: 'Center crosshair' },
  { rule: 'virtual-nib', title: 'Fountain pen nib', hotspot: 'Bottom-left nib tip' },
  { rule: 'virtual-mac', title: 'Sleek pointer', hotspot: 'Top-left tip' },
  { rule: 'virtual-laser', title: 'Laser pointer', hotspot: 'Center beam' },
  { rule: 'virtual-wand', title: 'Sparkle wand', hotspot: 'Top-left star center' },
];

class VirtualPenCursorSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.plugin.settingTab = this;
    this.previewEls = {};
    this.previewStages = {};
    this.pressureFillEl = null;
    this.pressureTextEl = null;
  }

  updatePreviews() {
    for (const [rule, el] of Object.entries(this.previewEls)) {
      if (el) styleCursorElement(el, rule, this.plugin.settings);
    }
  }

  onLivePenPressure(pressure) {
    const p = Math.max(0, Math.min(1, Number(pressure) || 0));
    const pr = this.plugin.settings.pressure || DEFAULT_PRESSURE;
    const pScale = (pr.enabled && p > 0)
      ? Number((pr.minScale + p * (pr.maxScale - pr.minScale)).toFixed(2))
      : 1;

    if (this.pressureFillEl) {
      this.pressureFillEl.style.width = `${Math.round(p * 100)}%`;
    }
    if (this.pressureTextEl) {
      this.pressureTextEl.textContent = p > 0
        ? `Pressure: ${(p * 100).toFixed(0)}% → Scale: ${pScale}×`
        : 'Hovering / No pressure (1.00×)';
    }
    for (const el of Object.values(this.previewEls)) {
      if (el) el.style.setProperty('--vpc-pressure-scale', String(pScale));
    }
  }

  triggerPreviewClick(targetRule = null) {
    const anim = this.plugin.settings.clickAnim || DEFAULT_CLICK_ANIM;
    const rules = targetRule ? [targetRule] : Object.keys(this.previewEls);
    for (const rule of rules) {
      const el = this.previewEls[rule];
      const stage = this.previewStages[rule];
      if (!el || !stage) continue;
      if (anim.pressShrink !== false && anim.effect !== 'none') {
        el.classList.add('is-pressed');
        setTimeout(() => el.classList.remove('is-pressed'), Math.min(220, Number(anim.duration) || 220));
      }
      spawnClickEffect(stage.ownerDocument, 0, 0, anim, true, stage);
    }
  }

  display() {
    const { containerEl } = this;
    const s = this.plugin.settings;
    const redraw = async () => {
      await this.plugin.saveSettings();
      this.display();
    };

    containerEl.empty();
    this.previewEls = {};
    this.previewStages = {};
    this.pressureFillEl = null;
    this.pressureTextEl = null;

    // ---- presets
    new Setting(containerEl)
      .setName('Quick presets')
      .setDesc('Click a preset to apply it, then fine-tune the individual rules below.')
      .setHeading();

    const presetGrid = containerEl.createDiv({ cls: 'vpc-preset-grid' });
    for (const p of PRESETS) {
      const isActive = DEVICES.every((d) => AREAS.every((a) => s.rules[d][a] === p.rules[d][a]));
      const card = presetGrid.createEl('button', {
        cls: `vpc-preset-card${isActive ? ' is-active' : ''}`,
        attr: { type: 'button' },
      });
      card.createDiv({ cls: 'vpc-preset-card-title', text: p.name });
      card.createDiv({ cls: 'vpc-preset-card-desc', text: p.desc });
      card.addEventListener('click', async () => {
        s.rules = clone(p.rules);
        await redraw();
      });
    }

    // ---- rule matrix
    this.renderDevice(containerEl, 'mouse', 'Mouse',
      'Regular mouse or trackpad.');
    this.renderDevice(containerEl, 'pen', 'Pen / Windows Ink',
      'Stylus and touch input. Windows Ink hides native cursors while the pen touches the surface, so choose a virtual cursor to keep it visible.');

    // ---- appearance & live preview
    new Setting(containerEl)
      .setName('Virtual cursor gallery & live preview')
      .setDesc('Click any preview card to test the click animation on that cursor.')
      .setHeading();

    // Live preview cards (all 8 virtual cursors)
    const previewGrid = containerEl.createDiv({ cls: 'vpc-preview-grid' });
    for (const def of PREVIEW_DEFS) {
      const card = previewGrid.createDiv({ cls: 'vpc-preview-card', attr: { title: 'Click to preview click animation' } });
      card.createDiv({ cls: 'vpc-preview-title', text: def.title });
      const stage = card.createDiv({ cls: 'vpc-preview-stage' });
      stage.createDiv({ cls: 'vpc-preview-target' });
      const cursorEl = stage.createDiv({ cls: 'virtual-pen-cursor is-preview is-visible' });
      this.previewEls[def.rule] = cursorEl;
      this.previewStages[def.rule] = stage;
      styleCursorElement(cursorEl, def.rule, s);
      card.createDiv({ cls: 'vpc-preview-caption', text: `Hotspot: ${def.hotspot}` });
      card.addEventListener('click', () => this.triggerPreviewClick(def.rule));
    }

    new Setting(containerEl)
      .setName('Size')
      .setDesc('Multiplier for all virtual cursors (1 = default size).')
      .addSlider((sl) => sl
        .setLimits(0.5, 3, 0.25)
        .setValue(s.cursorScale)
        .setDynamicTooltip()
        .onChange(async (v) => {
          s.cursorScale = v;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Fade after inactivity')
      .setDesc('Seconds without movement before the virtual cursor fades out (0 = never fade).')
      .addSlider((sl) => sl
        .setLimits(0, 10, 1)
        .setValue(s.fadeDelay)
        .setDynamicTooltip()
        .onChange(async (v) => {
          s.fadeDelay = v;
          await this.plugin.saveSettings();
        }));

    // ---- stylus pressure sensitivity (Windows Ink)
    new Setting(containerEl)
      .setName('Stylus pressure sensitivity (Windows Ink)')
      .setDesc('Dynamically scale the virtual cursor based on how hard you press the stylus tip against the tablet/screen.')
      .setHeading()
      .addExtraButton((btn) => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset pressure settings to default')
        .onClick(async () => {
          s.pressure = Object.assign({}, DEFAULT_PRESSURE);
          await redraw();
        }));

    new Setting(containerEl)
      .setName('Enable pressure-sensitive size')
      .setDesc('When enabled, pressing harder with a Windows Ink stylus smoothly scales the cursor between the light-touch and max-pressure multipliers below.')
      .addToggle((t) => t
        .setValue(!!s.pressure.enabled)
        .onChange(async (v) => {
          s.pressure.enabled = v;
          await redraw();
        }));

    new Setting(containerEl)
      .setName('Light touch scale (min pressure)')
      .setDesc('Size multiplier at the lightest stylus contact (default 0.75×).')
      .setDisabled(!s.pressure.enabled)
      .addSlider((sl) => sl
        .setLimits(0.25, 2.0, 0.05)
        .setValue(s.pressure.minScale)
        .setDynamicTooltip()
        .setDisabled(!s.pressure.enabled)
        .onChange(async (v) => {
          s.pressure.minScale = v;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Full pressure scale (max pressure)')
      .setDesc('Size multiplier at 100% stylus pressure (default 1.85×). Set lower than light touch if you prefer the cursor to shrink under pressure.')
      .setDisabled(!s.pressure.enabled)
      .addSlider((sl) => sl
        .setLimits(0.25, 3.5, 0.05)
        .setValue(s.pressure.maxScale)
        .setDynamicTooltip()
        .setDisabled(!s.pressure.enabled)
        .onChange(async (v) => {
          s.pressure.maxScale = v;
          await this.plugin.saveSettings();
        }));

    // Live stylus pressure test pad & meter
    const meterBox = containerEl.createDiv({ cls: 'vpc-pressure-tester' });
    const meterHeader = meterBox.createDiv({ cls: 'vpc-pressure-header' });
    meterHeader.createSpan({ cls: 'vpc-pressure-label', text: 'Live stylus pressure tester (press here with your pen):' });
    this.pressureTextEl = meterHeader.createSpan({ cls: 'vpc-pressure-readout', text: 'Hovering / No pressure (1.00×)' });
    const barTrack = meterBox.createDiv({ cls: 'vpc-pressure-track' });
    this.pressureFillEl = barTrack.createDiv({ cls: 'vpc-pressure-fill' });
    meterBox.addEventListener('pointerup', () => this.onLivePenPressure(0));
    meterBox.addEventListener('pointerleave', () => this.onLivePenPressure(0));

    // ---- click animation configuration
    new Setting(containerEl)
      .setName('Click animation')
      .setDesc('Visual feedback when clicking or tapping with a virtual cursor.')
      .setHeading()
      .addButton((b) => b
        .setButtonText('Test animation')
        .onClick(() => this.triggerPreviewClick(null)))
      .addExtraButton((btn) => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset click animation to default')
        .onClick(async () => {
          s.clickAnim = Object.assign({}, DEFAULT_CLICK_ANIM);
          await redraw();
        }));

    new Setting(containerEl)
      .setName('Animation style')
      .setDesc('Effect spawned at the cursor tip when pressing down.')
      .addDropdown((d) => {
        for (const [k, label] of Object.entries(CLICK_EFFECTS)) d.addOption(k, label);
        d.setValue(s.clickAnim.effect).onChange(async (v) => {
          s.clickAnim.effect = v;
          await this.plugin.saveSettings();
          this.triggerPreviewClick(null);
        });
      });

    new Setting(containerEl)
      .setName('Press shrink / tilt feedback')
      .setDesc('Slightly shrink or tilt the cursor icon itself while pressed down.')
      .addToggle((t) => t
        .setValue(s.clickAnim.pressShrink !== false)
        .onChange(async (v) => {
          s.clickAnim.pressShrink = v;
          await this.plugin.saveSettings();
          this.triggerPreviewClick(null);
        }));

    new Setting(containerEl)
      .setName('Trigger for input devices')
      .setDesc('Which devices play the click animation when using a virtual cursor.')
      .addDropdown((d) => d
        .addOption('both', 'Both (Pen & Mouse)')
        .addOption('pen', 'Pen / Windows Ink only')
        .addOption('mouse', 'Mouse only')
        .setValue(s.clickAnim.devices || 'both')
        .onChange(async (v) => {
          s.clickAnim.devices = v;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Animation color, size & duration')
      .setDesc('Color picker, diameter (16–80 px), and duration (150–1000 ms) of the click burst.')
      .addColorPicker((cp) => cp
        .setValue(s.clickAnim.color)
        .onChange(async (v) => {
          s.clickAnim.color = v;
          await this.plugin.saveSettings();
          this.triggerPreviewClick(null);
        }))
      .addSlider((sl) => sl
        .setLimits(16, 80, 4)
        .setValue(s.clickAnim.size)
        .setDynamicTooltip()
        .onChange(async (v) => {
          s.clickAnim.size = v;
          await this.plugin.saveSettings();
          this.triggerPreviewClick(null);
        }))
      .addSlider((sl) => sl
        .setLimits(150, 1000, 50)
        .setValue(s.clickAnim.duration)
        .setDynamicTooltip()
        .onChange(async (v) => {
          s.clickAnim.duration = v;
          await this.plugin.saveSettings();
          this.triggerPreviewClick(null);
        }));

    // ---- color customization
    new Setting(containerEl)
      .setName('Virtual cursor colors')
      .setDesc('Customize the colors of each virtual cursor and see the result in the preview cards above.')
      .setHeading()
      .addExtraButton((btn) => btn
        .setIcon('rotate-ccw')
        .setTooltip('Reset all colors to default')
        .onClick(async () => {
          s.colors = Object.assign({}, DEFAULT_COLORS);
          await redraw();
        }));

    new Setting(containerEl)
      .setName('Dot colors')
      .setDesc('Border color, inner fill color, and fill opacity for the Virtual dot.')
      .addColorPicker((cp) => cp.setValue(s.colors.dotBorder).onChange(async (v) => { s.colors.dotBorder = v; await this.plugin.saveSettings(); }))
      .addColorPicker((cp) => cp.setValue(s.colors.dotFill).onChange(async (v) => { s.colors.dotFill = v; await this.plugin.saveSettings(); }))
      .addSlider((sl) => sl.setLimits(0, 1, 0.05).setValue(s.colors.dotFillOpacity).setDynamicTooltip().onChange(async (v) => { s.colors.dotFillOpacity = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Arrow colors')
      .setDesc('Body fill color and outline color for the Virtual arrow.')
      .addColorPicker((cp) => cp.setValue(s.colors.arrowFill).onChange(async (v) => { s.colors.arrowFill = v; await this.plugin.saveSettings(); }))
      .addColorPicker((cp) => cp.setValue(s.colors.arrowStroke).onChange(async (v) => { s.colors.arrowStroke = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Brush colors')
      .setDesc('Bristle tip color, wooden handle color, and metal ferrule color for the Virtual brush.')
      .addColorPicker((cp) => cp.setValue(s.colors.brushTip).onChange(async (v) => { s.colors.brushTip = v; await this.plugin.saveSettings(); }))
      .addColorPicker((cp) => cp.setValue(s.colors.brushHandle).onChange(async (v) => { s.colors.brushHandle = v; await this.plugin.saveSettings(); }))
      .addColorPicker((cp) => cp.setValue(s.colors.brushFerrule).onChange(async (v) => { s.colors.brushFerrule = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Precision reticle colors')
      .setDesc('Outer ring/crosshair color and center dot color.')
      .addColorPicker((cp) => cp.setValue(s.colors.crosshairStroke).onChange(async (v) => { s.colors.crosshairStroke = v; await this.plugin.saveSettings(); }))
      .addColorPicker((cp) => cp.setValue(s.colors.crosshairCenter).onChange(async (v) => { s.colors.crosshairCenter = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Fountain pen nib colors')
      .setDesc('Metallic nib body color and slit/collar accent color.')
      .addColorPicker((cp) => cp.setValue(s.colors.nibBody).onChange(async (v) => { s.colors.nibBody = v; await this.plugin.saveSettings(); }))
      .addColorPicker((cp) => cp.setValue(s.colors.nibAccent).onChange(async (v) => { s.colors.nibAccent = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Sleek pointer colors')
      .setDesc('Body fill color and smooth border color.')
      .addColorPicker((cp) => cp.setValue(s.colors.macFill).onChange(async (v) => { s.colors.macFill = v; await this.plugin.saveSettings(); }))
      .addColorPicker((cp) => cp.setValue(s.colors.macStroke).onChange(async (v) => { s.colors.macStroke = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Laser pointer colors')
      .setDesc('Inner bright core color and outer neon halo glow color.')
      .addColorPicker((cp) => cp.setValue(s.colors.laserCore).onChange(async (v) => { s.colors.laserCore = v; await this.plugin.saveSettings(); }))
      .addColorPicker((cp) => cp.setValue(s.colors.laserGlow).onChange(async (v) => { s.colors.laserGlow = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName('Sparkle wand colors')
      .setDesc('Starburst tip color and magic wand shaft color.')
      .addColorPicker((cp) => cp.setValue(s.colors.wandStar).onChange(async (v) => { s.colors.wandStar = v; await this.plugin.saveSettings(); }))
      .addColorPicker((cp) => cp.setValue(s.colors.wandShaft).onChange(async (v) => { s.colors.wandShaft = v; await this.plugin.saveSettings(); }));
  }

  renderDevice(containerEl, device, title, desc) {
    const s = this.plugin.settings;
    new Setting(containerEl).setName(title).setDesc(desc).setHeading();

    const rows = [
      ['excalidraw', 'In Excalidraw', 'Cursor over Excalidraw drawings.'],
      ['elsewhere', 'Everywhere else', 'Cursor over notes, sidebars, menus and the rest of Obsidian.'],
    ];
    for (const [area, name, areaDesc] of rows) {
      new Setting(containerEl)
        .setName(name)
        .setDesc(areaDesc)
        .addDropdown((d) => {
          for (const [value, label] of Object.entries(CURSOR_OPTIONS)) d.addOption(value, label);
          d.setValue(s.rules[device][area])
            .onChange(async (v) => {
              s.rules[device][area] = v;
              await this.plugin.saveSettings();
            });
        });
    }
  }
}
