// Small UI building blocks shared by panels (and available to mods as ss.ui.w).
import {h} from '../core/util.js';

export function section(title, open, ...body) {
  const d = h('details', {class: 'sec', open: !!open}, h('summary', null, h('span', {class: 'sec-title'}, title)), h('div', {class: 'sec-body'}, ...body));
  return d;
}

export function slider({id, label, min, max, step = 1, value, format = (v) => v, onInput, onChange}) {
  const out = h('output', {for: id}, format(value));
  const inp = h('input', {type: 'range', id, min, max, step, value});
  inp.addEventListener('input', () => { out.textContent = format(+inp.value); onInput && onInput(+inp.value); });
  if (onChange) inp.addEventListener('change', () => onChange(+inp.value));
  const row = h('div', {class: 'field-row'}, h('div', {class: 'lbl'}, h('label', {for: id}, label), out), inp);
  row.set = (v) => { inp.value = v; out.textContent = format(+v); };
  return row;
}

export function select({id, label, options, value, onChange}) {
  const s = h('select', {id}, options.map(o => h('option', {value: o.value, selected: String(o.value) === String(value)}, o.label)));
  s.addEventListener('change', () => onChange(s.value));
  const row = h('div', {class: 'field-row'}, label ? h('label', {class: 'lbl', for: id}, label) : null, s);
  row.set = (v) => { s.value = v; };
  row.setOptions = (opts, v) => { s.innerHTML = ''; opts.forEach(o => s.appendChild(h('option', {value: o.value}, o.label))); s.value = v; };
  return row;
}

export function check({id, label, checked, onChange}) {
  const inp = h('input', {type: 'checkbox', id, checked: !!checked});
  inp.addEventListener('change', () => onChange(inp.checked));
  const row = h('label', {class: 'check', for: id}, inp, label);
  row.set = (v) => { inp.checked = !!v; };
  return row;
}

export function segmented({options, value, onChange}) {
  const wrap = h('div', {class: 'seg'});
  const render = (v) => {
    wrap.innerHTML = '';
    options.forEach(o => wrap.appendChild(h('button', {class: String(o.value) === String(v) ? 'on' : '', title: o.title || '', onclick: () => { render(o.value); onChange(o.value); }}, o.label)));
  };
  render(value);
  wrap.set = render;
  return wrap;
}

export function button(label, onclick, cls = '') { return h('button', {class: cls, onclick}, label); }
export function note(text) { return h('div', {class: 'note'}, text); }
