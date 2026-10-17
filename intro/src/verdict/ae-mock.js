// Minimal, strict model of the After Effects scripting DOM used by the ae/*.jsx templates.
// Unknown match names throw, so a typo in the .jsx fails here instead of inside AE.
// Expressions are evaluated with AE semantics (value of the last statement, `time`, `value`, `thisComp`).

const SPECS = {
  'ADBE Transform Group': () => [
    leaf('ADBE Anchor Point', 'Anchor Point', [0, 0]),
    leaf('ADBE Position', 'Position', [0, 0]),
    leaf('ADBE Scale', 'Scale', [100, 100]),
    leaf('ADBE Rotate Z', 'Rotation', 0),
    leaf('ADBE Opacity', 'Opacity', 100),
  ],
  'ADBE Vector Shape - Rect': () => [
    leaf('ADBE Vector Shape Direction', 'Shape Direction', 1),
    leaf('ADBE Vector Rect Size', 'Size', [100, 100]),
    leaf('ADBE Vector Rect Position', 'Position', [0, 0]),
    leaf('ADBE Vector Rect Roundness', 'Roundness', 0),
  ],
  'ADBE Vector Shape - Ellipse': () => [
    leaf('ADBE Vector Shape Direction', 'Shape Direction', 1),
    leaf('ADBE Vector Ellipse Size', 'Size', [100, 100]),
    leaf('ADBE Vector Ellipse Position', 'Position', [0, 0]),
  ],
  'ADBE Vector Graphic - Fill': () => [
    leaf('ADBE Vector Blend Mode', 'Blend Mode', 1),
    leaf('ADBE Vector Composite Order', 'Composite', 1),
    leaf('ADBE Vector Fill Rule', 'Fill Rule', 1),
    leaf('ADBE Vector Fill Color', 'Color', [1, 0, 0, 1]),
    leaf('ADBE Vector Fill Opacity', 'Opacity', 100),
  ],
  'ADBE Slider Control': () => [leaf('ADBE Slider Control-0001', 'Slider', 0)],
  'ADBE Text Selector': () => [
    leaf('ADBE Text Percent Start', 'Start', 0),
    leaf('ADBE Text Percent End', 'End', 100),
    leaf('ADBE Text Percent Offset', 'Offset', 0),
  ],
  'ADBE Text Expressible Selector': () => [
    leaf('ADBE Text Range Type2', 'Based On', 1),
    leaf('ADBE Text Expressible Amount', 'Amount', 100),
  ],
  // The UI adds a Range Selector to every new animator; assume scripting may too.
  'ADBE Text Animator': () => [
    group('ADBE Text Selectors', 'Selectors', [
      group('ADBE Text Selector', 'Range Selector 1', SPECS['ADBE Text Selector']()),
    ]),
    group('ADBE Text Animator Properties', 'Properties', []),
  ],
};

const LEAVES = {
  'ADBE Text Position 3D': ['Position', [0, 0, 0]],
  'ADBE Text Opacity': ['Opacity', 100],
  'ADBE Text Scale 3D': ['Scale', [100, 100, 100]],
};

const ADDABLE = {
  'ADBE Effect Parade': ['ADBE Slider Control'],
  'ADBE Root Vectors Group': ['ADBE Vector Group'],
  'ADBE Vectors Group': ['ADBE Vector Shape - Rect', 'ADBE Vector Shape - Ellipse', 'ADBE Vector Graphic - Fill'],
  'ADBE Text Animators': ['ADBE Text Animator'],
  'ADBE Text Selectors': ['ADBE Text Selector', 'ADBE Text Expressible Selector'],
  'ADBE Text Animator Properties': Object.keys(LEAVES),
};

const DISPLAY = {
  'ADBE Slider Control': 'Slider Control',
  'ADBE Vector Group': 'Group 1',
  'ADBE Vector Shape - Rect': 'Rectangle Path 1',
  'ADBE Vector Shape - Ellipse': 'Ellipse Path 1',
  'ADBE Vector Graphic - Fill': 'Fill 1',
  'ADBE Text Animator': 'Animator 1',
  'ADBE Text Selector': 'Range Selector 1',
  'ADBE Text Expressible Selector': 'Expression Selector 1',
};

class Property {
  constructor(matchName, name, value, children = null) {
    this.matchName = matchName;
    this.name = name;
    this.children = children;
    this.value = clone(value);
    this.expression = '';
    this.parentProperty = null;
    if (children) children.forEach((c) => (c.parentProperty = this));
  }
  get numProperties() {
    return this.children ? this.children.length : 0;
  }
  property(key) {
    if (!this.children) throw new Error(`"${this.matchName}" has no sub-properties`);
    if (typeof key === 'number') {
      if (key < 1 || key > this.children.length)
        throw new Error(`"${this.matchName}".property(${key}) is out of range`);
      return this.children[key - 1];
    }
    return this.children.find((c) => c.matchName === key || c.name === key) ?? null;
  }
  addProperty(matchName) {
    const allowed = ADDABLE[this.matchName];
    if (!allowed || !allowed.includes(matchName)) throw new Error(`cannot add "${matchName}" to "${this.matchName}"`);
    let p;
    if (LEAVES[matchName]) {
      p = leaf(matchName, ...LEAVES[matchName]);
    } else if (matchName === 'ADBE Vector Group') {
      p = group('ADBE Vector Group', DISPLAY[matchName], [
        leaf('ADBE Vector Blend Mode', 'Blend Mode', 1),
        group('ADBE Vectors Group', 'Contents', []),
        group('ADBE Vector Transform Group', 'Transform', []),
      ]);
    } else {
      p = group(matchName, DISPLAY[matchName], SPECS[matchName]());
    }
    p.parentProperty = this;
    this.children.push(p);
    return p;
  }
  remove() {
    const siblings = this.parentProperty?.children;
    if (!siblings) throw new Error(`cannot remove "${this.matchName}"`);
    siblings.splice(siblings.indexOf(this), 1);
  }
  setValue(v) {
    if (this.children) throw new Error(`setValue on group "${this.matchName}"`);
    if (Array.isArray(this.value) && (!Array.isArray(v) || v.length !== this.value.length))
      throw new Error(`"${this.matchName}" expects an array, got ${JSON.stringify(v)}`);
    this.value = clone(v);
  }
  addToMotionGraphicsTemplateAs(comp, label) {
    comp.essentialProperties.push({ label, prop: this });
    return true;
  }
  addToMotionGraphicsTemplate(comp) {
    return this.addToMotionGraphicsTemplateAs(comp, this.name);
  }
}

const leaf = (m, n, v) => new Property(m, n, v);
const group = (m, n, c) => new Property(m, n, null, c);
const clone = (v) =>
  v instanceof TextDocument ? v.copy() : Array.isArray(v) ? v.slice() : v && typeof v === 'object' ? { ...v } : v;

export class TextDocument {
  constructor(text) {
    this.text = text;
    this.font = 'ArialMT';
    this.fontSize = 36;
    this.applyFill = true;
    this.fillColor = [1, 1, 1];
    this.applyStroke = false;
    this.strokeColor = [0, 0, 0];
    this.strokeWidth = 1;
    this.strokeOverFill = true;
    this.tracking = 0;
    this.justification = 7413;
    this.autoLeading = true;
    this.leading = 43.2;
  }
  resetCharStyle() {}
  resetParagraphStyle() {}
  copy() {
    return Object.assign(new TextDocument(this.text), this);
  }
}

export const ParagraphJustification = { LEFT_JUSTIFY: 7413, RIGHT_JUSTIFY: 7414, CENTER_JUSTIFY: 7415 };
export const TrackMatteType = { NO_TRACK_MATTE: 0, ALPHA: 1, ALPHA_INVERTED: 2, LUMA: 3, LUMA_INVERTED: 4 };

class Layer {
  constructor(comp, kind, name) {
    this.comp = comp;
    this.kind = kind;
    this.name = name;
    this.enabled = true;
    this.motionBlur = false;
    this.trackMatteType = TrackMatteType.NO_TRACK_MATTE;
    this.trackMatteLayer = null;
    this.groups = [group('ADBE Transform Group', 'Transform', SPECS['ADBE Transform Group']())];
    this.groups.push(group('ADBE Effect Parade', 'Effects', []));
    this.property('ADBE Transform Group').property('ADBE Position').value = [comp.width / 2, comp.height / 2];
    if (kind === 'text')
      this.groups.push(
        group('ADBE Text Properties', 'Text', [
          leaf('ADBE Text Document', 'Source Text', null),
          group('ADBE Text Animators', 'Animators', []),
        ]),
      );
    if (kind === 'shape') this.groups.push(group('ADBE Root Vectors Group', 'Contents', []));
  }
  property(key) {
    const p = this.groups.find((g) => g.matchName === key || g.name === key);
    if (!p) throw new Error(`layer "${this.name}" (${this.kind}) has no property "${key}"`);
    return p;
  }
  get index() {
    return this.comp.layerList.indexOf(this) + 1;
  }
  moveBefore(other) {
    const list = this.comp.layerList;
    list.splice(list.indexOf(this), 1);
    list.splice(list.indexOf(other), 0, this);
  }
  moveToBeginning() {
    const list = this.comp.layerList;
    list.splice(list.indexOf(this), 1);
    list.unshift(this);
  }
}

class LayerCollection {
  constructor(comp) {
    this.comp = comp;
  }
  _add(layer) {
    this.comp.layerList.unshift(layer);
    return layer;
  }
  addText(str) {
    const l = new Layer(this.comp, 'text', str);
    l.property('ADBE Text Properties').property('ADBE Text Document').value = new TextDocument(str);
    return this._add(l);
  }
  addShape() {
    return this._add(new Layer(this.comp, 'shape', `Shape Layer ${this.comp.layerList.length + 1}`));
  }
  addSolid(color, name, w, h) {
    const l = new Layer(this.comp, 'solid', name);
    l.color = color;
    l.property('ADBE Transform Group').property('ADBE Anchor Point').value = [w / 2, h / 2];
    l.width = w;
    l.height = h;
    return this._add(l);
  }
  addNull() {
    const l = new Layer(this.comp, 'null', 'Null 1');
    l.property('ADBE Transform Group').property('ADBE Anchor Point').value = [50, 50];
    return this._add(l);
  }
}

class CompItem {
  constructor(name, w, h, pa, duration, fps) {
    Object.assign(this, { name, width: w, height: h, pixelAspect: pa, duration, frameRate: fps });
    this.layerList = [];
    this.layers = new LayerCollection(this);
    this.essentialProperties = [];
    this.bgColor = [0, 0, 0];
  }
  layer(key) {
    if (typeof key === 'number') return this.layerList[key - 1];
    return this.layerList.find((l) => l.name === key) ?? null;
  }
  get numLayers() {
    return this.layerList.length;
  }
  openInViewer() {
    this.opened = true;
  }
  duplicate() {
    const copy = new CompItem(this.name, this.width, this.height, this.pixelAspect, this.duration, this.frameRate);
    Object.assign(copy, {
      bgColor: this.bgColor.slice(),
      motionBlur: this.motionBlur,
      parentFolder: this.parentFolder,
    });
    copy.layerList = this.layerList.map((l) => cloneLayer(l, copy));
    copy.layerList.forEach((l, i) => {
      const src = this.layerList[i].trackMatteLayer;
      if (src) l.trackMatteLayer = copy.layerList[this.layerList.indexOf(src)];
    });
    copy.essentialProperties = [];
    this.project?.add(copy);
    return copy;
  }
}

function cloneProperty(p) {
  const c = new Property(p.matchName, p.name, p.value, p.children ? p.children.map(cloneProperty) : null);
  c.expression = p.expression;
  return c;
}

function cloneLayer(l, comp) {
  const c = Object.create(Layer.prototype);
  Object.assign(c, l, { comp, groups: l.groups.map(cloneProperty) });
  return c;
}

export function createApp({ modernTrackMattes = true, dialog = null } = {}) {
  const items = [];
  const queue = [];
  const project = {
    add(c) {
      c.project = project;
      items.push(c);
      return c;
    },
    items: {
      addComp: (...a) => project.add(new CompItem(...a)),
      addFolder: (name) => ({ name, folder: true }),
    },
    get numItems() {
      return items.length;
    },
    item: (i) => items[i - 1],
    activeItem: null,
    selection: [],
    renderQueue: { items: { add: (c) => queue.push(c) } },
  };
  if (modernTrackMattes) {
    Layer.prototype.setTrackMatte = function (matte, type) {
      this.trackMatteLayer = matte;
      this.trackMatteType = type;
    };
  } else {
    delete Layer.prototype.setTrackMatte;
  }
  const log = [];
  const app = {
    project,
    newProject() {},
    beginUndoGroup() {},
    endUndoGroup() {},
  };
  return { app, alert: (m) => log.push(String(m)), log, comps: items, queue, Window: mockWindow(dialog) };
}

// ScriptUI stand-in: show() answers like the user pressed the default button, with `dialog.text` typed in.
function mockWindow(dialog) {
  return class Window {
    constructor() {
      this.controls = [];
    }
    add(type, bounds, text) {
      const ctl = {
        type,
        text: type === 'edittext' && dialog?.text != null ? dialog.text : text,
        value: false,
        add: (...a) => this.add(...a),
      };
      this.controls.push(ctl);
      return ctl;
    }
    show() {
      return dialog?.ok === false ? 2 : 1;
    }
  };
}

export function runScript(env, source) {
  const fn = new Function('app', 'ParagraphJustification', 'TrackMatteType', 'alert', 'CompItem', 'Window', source);
  fn(env.app, ParagraphJustification, TrackMatteType, env.alert, CompItem, env.Window);
  const failed = env.log.find((m) => /^Jury \w+( batch)?: (?!done|created)/.test(m));
  if (failed) throw new Error(failed);
  return env;
}

// Runs the ExtendScript source against the mock and returns the built comps.
export function runJsx(source, opts) {
  return runScript(createApp(opts), source);
}

// Track matte of a layer, honouring both the AE 2023+ API and the legacy "layer above" rule.
export function matteOf(layer) {
  if (layer.trackMatteType === TrackMatteType.NO_TRACK_MATTE) return null;
  if (layer.trackMatteLayer) return layer.trackMatteLayer;
  return layer.comp.layerList[layer.comp.layerList.indexOf(layer) - 1] ?? null;
}

function expressionApi(comp, time) {
  return {
    layer(name) {
      const l = comp.layer(name);
      if (!l) throw new Error(`thisComp.layer("${name}") does not exist`);
      return {
        get text() {
          if (l.kind !== 'text') throw new Error(`"${name}" is not a text layer`);
          const doc = l.property('ADBE Text Properties').property('ADBE Text Document');
          return { sourceText: { toString: () => String(evaluate(doc, time).text) } };
        },
        effect(fxName) {
          const fx = l.property('ADBE Effect Parade').property(fxName);
          if (!fx) throw new Error(`effect("${fxName}") does not exist on "${name}"`);
          return (idx) => ({ value: evaluate(fx.property(idx), 0) });
        },
      };
    },
  };
}

// eslint-disable-next-line no-unused-vars
function runExpression(code, time, value, thisComp, textIndex, textTotal) {
  // eslint-disable-next-line no-eval
  return eval(code);
}

// Value of a property at `time`, with its expression applied.
// `chars` = { textIndex, textTotal } for expression selectors.
export function evaluate(prop, time, chars = {}) {
  if (!prop.expression) return prop.value;
  const comp = owningComp(prop);
  const v = prop.value instanceof TextDocument ? prop.value.text : prop.value;
  const out = runExpression(prop.expression, time, v, expressionApi(comp, time), chars.textIndex, chars.textTotal);
  if (prop.value instanceof TextDocument) return Object.assign(prop.value.copy(), { text: String(out) });
  if (Array.isArray(prop.value) && (!Array.isArray(out) || out.some((x) => !Number.isFinite(x))))
    throw new Error(`expression on "${prop.matchName}" returned ${JSON.stringify(out)}`);
  if (!Array.isArray(prop.value) && !Number.isFinite(out))
    throw new Error(`expression on "${prop.matchName}" returned ${out}`);
  return out;
}

const owners = new WeakMap();
function owningComp(prop) {
  if (owners.has(prop)) return owners.get(prop);
  throw new Error(`property "${prop.matchName}" is not attached to a comp`);
}

// Index every property back to its comp so expressions can resolve thisComp.
export function indexComp(comp) {
  const walk = (p) => {
    owners.set(p, comp);
    (p.children ?? []).forEach(walk);
  };
  comp.layerList.forEach((l) => l.groups.forEach(walk));
  return comp;
}
