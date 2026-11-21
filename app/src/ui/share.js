// «Поделиться»: a project, a set of mods, a set of themes — or all of it together — in one .sspack file, and opening
// such a file: mods are installed into the mods folder, the project opens, the theme is switched on.
// Bundle: {format: 'sspace-bundle', version: 1, name, author, created, app, campaign?, mods?: [{id, folder, name,
//          version, files: [{path, text} | {path, b64}]}], theme?}
import {h, slug} from '../core/util.js';
import {note, check, button} from './widgets.js';
import {serializeCampaign, parseCampaign} from '../space/campaign.js';

export const BUNDLE_FORMAT = 'sspace-bundle';

export function registerShare(ss) {
  const host = ss.host;
  const canFiles = !!(host && host.readModFiles && host.installMod);
  const modOfSource = (src) => (typeof src === 'string' && src.startsWith('мод ') ? src.slice(4) : null);
  const runningMods = () => (ss.mods || []).filter(m => m.status === 'on' || m.enabled);
  // mods that add a theme
  const themeMods = () => { const s = new Set(); for (const t of ss.reg.themes.list()) { const m = modOfSource(t.source); if (m) s.add(m); } return s; };
  // mods the project uses: generators and their add-ons on planets, plus what those mods need themselves
  function modsUsedByCampaign() {
    const out = new Set(), c = ss.space && ss.space.campaign; if (!c) return out;
    ss.space.commitPlanet && ss.space.commitPlanet();
    const addGen = (id) => { const g = id && ss.reg.generators.get(id); const m = g && modOfSource(g.source); if (m) out.add(m); };
    for (const g of c.galaxies) for (const s of g.systems) for (const p of s.planets) {
      addGen(p.gen);
      const meta = p.doc && p.doc.meta; if (!meta) continue;
      if (meta.gen) { addGen(meta.gen.id); for (const lid of Object.keys(meta.gen.layers || {})) { const L = ss.reg.genLayers.get(lid); const m = L && modOfSource(L.source); if (m) out.add(m); } }
      if (meta.orbit && meta.orbit.items && meta.orbit.items.length && ss.hasMod('orbitals')) out.add('orbitals');
    }
    // dependencies come along
    let grew = true;
    while (grew) { grew = false; for (const id of [...out]) { const m = (ss.mods || []).find(x => x.id === id); for (const d of (m && m.requires) || []) if (!out.has(d)) { out.add(d); grew = true; } } }
    return out;
  }

  async function packMods(ids) {
    const out = [];
    for (const id of ids) {
      const m = (ss.mods || []).find(x => x.id === id); if (!m) continue;
      const r = await host.readModFiles(m.folder);
      if (!r || r.error) throw new Error(`мод «${m.name}»: ${(r && r.error) || 'не прочитался'}`);
      out.push({id: m.id, folder: m.folder, name: m.name, version: m.version, author: m.author, files: r.files});
    }
    return out;
  }
  async function saveBundle({name, campaign, mods = [], theme = null}) {
    if (!campaign && !mods.length && !theme) return ss.ui.toast('Нечего сохранять — отметь хоть что-нибудь');
    const b = {format: BUNDLE_FORMAT, version: 1, name: name || 'Сборка', created: new Date().toISOString(), app: 'SSpace ' + (ss.VERSION || '')};
    try {
      if (campaign) { ss.space.commitPlanet(); b.campaign = JSON.parse(serializeCampaign(ss.space.campaign)); }
      if (mods.length) b.mods = await packMods(mods);
      if (theme) b.theme = theme;
    } catch (e) { return ss.ui.toast('Не получилось собрать: ' + e.message, 5000); }
    const text = JSON.stringify(b);
    const p = await host.saveFile({path: null, text, defaultName: slug(b.name) + '.sspack', filters: [{name: 'Сборка SSpace', extensions: ['sspack']}]});
    if (p === null && host.desktop) return;
    ss.ui.toast(`Сборка сохранена (${(text.length / 1048576).toFixed(text.length > 1048576 ? 1 : 2)} МБ)`);
  }

  // ---------- opening a bundle ----------
  async function importBundle(b) {
    if (!b || b.format !== BUNDLE_FORMAT) throw new Error('Это не сборка SSpace');
    const mods = Array.isArray(b.mods) ? b.mods.filter(m => m && m.folder && Array.isArray(m.files)) : [];
    const have = new Map((ss.mods || []).map(m => [m.folder, m]));
    const box = h('div', {class: 'share-import'});
    box.appendChild(h('div', {class: 'share-ititle'}, h('b', null, b.name || 'Сборка'), h('small', null, [b.app, b.created ? new Date(b.created).toLocaleDateString() : ''].filter(Boolean).join(' · '))));
    const want = {campaign: !!b.campaign, theme: !!b.theme, mods: new Set(mods.map(m => m.folder))};
    if (b.campaign) box.appendChild(check({id: 'shi_c', label: `Проект «${b.campaign.name || 'Кампания'}» — открыть вместо текущего`, checked: true, onChange: v => { want.campaign = v; }}));
    if (mods.length) {
      box.appendChild(h('div', {class: 'set-title'}, `Моды (${mods.length})`));
      for (const m of mods) {
        const old = have.get(m.folder), tag = !old ? 'новый' : old.version && m.version && old.version !== m.version ? `заменит ${old.version} → ${m.version}` : 'уже есть — заменит';
        box.appendChild(check({id: 'shi_m_' + m.folder, label: `${m.name || m.id}${m.version ? ' ' + m.version : ''} · ${tag}`, checked: true, onChange: v => { if (v) want.mods.add(m.folder); else want.mods.delete(m.folder); }}));
      }
      box.appendChild(h('div', {class: 'share-warn'}, 'Моды — это программы. Ставь сборки только от тех, кому доверяешь.'));
    }
    if (b.theme) box.appendChild(check({id: 'shi_t', label: `Включить тему «${(ss.reg.themes.get(b.theme) || {}).name || b.theme}»`, checked: true, onChange: v => { want.theme = v; }}));
    if (!b.campaign && !mods.length && !b.theme) throw new Error('Сборка пустая');
    const go = await new Promise(res => ss.ui.modal({title: 'Открыть сборку', body: box, width: 520, buttons: [{label: 'Отмена', action: () => res(false)}, {label: 'Установить и открыть', primary: true, action: () => res(true)}], onDismiss: () => res(false)}));
    if (!go) return false;
    if (want.campaign && ss.editor.dirty && !(await ss.ui.confirm('Несохранённые изменения текущего проекта пропадут. Продолжить?', 'Продолжить'))) return false;

    let installed = 0;
    const fails = [];
    if (want.mods.size) {
      if (!canFiles) throw new Error('Ставить моды можно только в настольной версии');
      for (const m of mods) {
        if (!want.mods.has(m.folder)) continue;
        const r = await host.installMod({folder: m.folder, files: m.files, overwrite: true});
        if (r && r.ok) installed++; else fails.push(`${m.name || m.id}: ${(r && r.error) || 'ошибка'}`);
      }
      // a newly installed mod is switched on
      const s = ss.settings || (ss.settings = {});
      const ids = new Set(mods.filter(m => want.mods.has(m.folder)).map(m => m.id));
      s.disabledMods = (s.disabledMods || []).filter(id => !ids.has(id));
      await ss.saveSettings();
    }
    if (want.theme && b.theme) ss.setPref('theme', b.theme);
    if (want.campaign && b.campaign) {
      const c = parseCampaign(b.campaign);
      if (installed) await host.writeAutosave({text: serializeCampaign(c), filePath: ''}); // opened after the restart
      else { ss.loadCampaign(c); ss.ui.toast('Проект открыт'); }
    }
    if (fails.length) ss.ui.toast('Не установились: ' + fails.join('; '), 8000);
    if (installed) {
      ss.ui.toast(`Установлено модов: ${installed}. Перезапускаю редактор…`, 2500);
      ss.autosavePaused = !!(want.campaign && b.campaign); // the restored project must not be overwritten on the way out
      setTimeout(() => (host.reload ? host.reload() : location.reload()), 900);
    } else if (want.theme && b.theme && ss.reg.themes.has(b.theme)) ss.themes.apply(b.theme);
    return true;
  }

  // ---------- the dialog ----------
  const st = {name: '', mods: null, themes: null, theme: true};
  const modRow = (m, set, extra) => {
    const c = check({id: 'shm_' + m.id, label: '', checked: set.has(m.id), onChange: v => { if (v) set.add(m.id); else set.delete(m.id); }});
    return h('div', {class: 'share-mod'}, c, h('div', {class: 'share-mtext'}, h('b', null, m.name + (m.version ? ' ' + m.version : '')), h('small', null, [extra, m.status === 'on' ? '' : 'выключен'].filter(Boolean).join(' · ') || (m.description || '').slice(0, 110))));
  };
  const nameField = (def) => { const f = h('input', {class: 'field', value: st.name || def, maxlength: 80}); f.addEventListener('input', () => { st.name = f.value; }); return h('div', {class: 'field-row'}, h('label', {class: 'lbl'}, 'Название сборки'), f); };
  const card = (title, ...body) => h('div', {class: 'set-card'}, title ? h('div', {class: 'set-title'}, title) : null, ...body);
  const needDesktop = () => (canFiles ? null : note('Моды и темы можно упаковать только в настольной версии SSpace.'));

  ss.reg.dialogs.register({id: 'share', title: 'Поделиться', icon: 'share', subtitle: 'проект, моды и темы — вместе или по отдельности, одним файлом .sspack', sections: [
    {id: 'all', label: 'Всё вместе', icon: 'sparkles', render(p) {
      const used = modsUsedByCampaign(), th = themeMods(), cur = ss.themes.current && ss.themes.current.id;
      const curMod = cur && modOfSource((ss.reg.themes.get(cur) || {}).source);
      const set = new Set([...used, ...(curMod ? [curMod] : [])]);
      p.append(note('Проект целиком, моды, без которых он не откроется как надо, и твоя тема. Получатель открывает файл через «Файл → Открыть» — всё ставится само.'),
        nameField(ss.space.campaign ? ss.space.campaign.name : 'Сборка'),
        card('Моды в сборке', note(used.size ? 'Отмечены моды, которые использует проект, и мод текущей темы.' : 'Проект не использует моды из папки mods — можно добавить любые.'), needDesktop(),
          ...runningMods().map(m => modRow(m, set, used.has(m.id) ? 'нужен проекту' : th.has(m.id) ? 'темы' : ''))),
        card('Тема', check({id: 'sh_theme', label: `Включить у получателя тему «${ss.themes.current ? ss.themes.current.name : 'Космос'}»`, checked: st.theme, onChange: v => { st.theme = v; }})),
        h('div', {class: 'btnrow share-go'}, button('Сохранить сборку…', () => saveBundle({name: st.name || ss.space.campaign.name, campaign: true, mods: [...set], theme: st.theme ? cur : null}), 'primary')));
    }},
    {id: 'project', label: 'Проект', icon: 'galaxy', render(p) {
      const used = modsUsedByCampaign();
      p.append(note('Только проект: галактики, системы, карты планет, орбиты и эффекты. Без модов — у получателя они должны уже быть.'),
        used.size ? card('Проект использует моды', h('div', {class: 'share-tags'}, [...used].map(id => h('span', {class: 'pill'}, ((ss.mods || []).find(m => m.id === id) || {name: id}).name))), note('Если у получателя их нет, планеты этих модов откроются, но часть вида пропадёт. Чтобы приложить моды — вкладка «Всё вместе».')) : null,
        h('div', {class: 'btnrow share-go'}, button('Сохранить проект (.sspace)…', () => ss.saveFile(true)), button('Сохранить как сборку (.sspack)…', () => saveBundle({name: ss.space.campaign.name, campaign: true}), 'primary')));
    }},
    {id: 'mods', label: 'Моды', icon: 'puzzle', render(p, api) {
      if (!st.mods) st.mods = new Set(runningMods().filter(m => m.status === 'on').map(m => m.id));
      p.append(note('Набор модов одним файлом. Получатель открывает его — моды ставятся в его папку mods и включаются.'), needDesktop(), nameField('Мои моды'),
        card('Какие моды', h('div', {class: 'btnrow'}, button('Все', () => { (ss.mods || []).forEach(m => st.mods.add(m.id)); api.refresh(); }), button('Ни одного', () => { st.mods.clear(); api.refresh(); })),
          ...(ss.mods || []).map(m => modRow(m, st.mods, themeMods().has(m.id) ? 'темы' : ''))),
        h('div', {class: 'btnrow share-go'}, button('Сохранить сборку модов…', () => saveBundle({name: st.name || 'Мои моды', mods: [...st.mods]}), 'primary')));
    }},
    {id: 'themes', label: 'Темы', icon: 'brush', render(p) {
      const th = themeMods(); if (!st.themes) st.themes = new Set(th);
      const cur = ss.themes.current && ss.themes.current.id;
      const list = (ss.mods || []).filter(m => th.has(m.id));
      p.append(note('Темы оформления живут в модах. Здесь — только моды с темами и выбранная тема.'), needDesktop(), nameField('Мои темы'),
        list.length ? card('Моды с темами', ...list.map(m => modRow(m, st.themes, ss.reg.themes.list().filter(t => modOfSource(t.source) === m.id).map(t => t.name).join(', ')))) : note('Ни один мод не добавляет тем.'),
        card('Тема', check({id: 'sh_theme2', label: `Включить у получателя тему «${ss.themes.current ? ss.themes.current.name : 'Космос'}»`, checked: st.theme, onChange: v => { st.theme = v; }})),
        h('div', {class: 'btnrow share-go'}, button('Сохранить сборку тем…', () => saveBundle({name: st.name || 'Мои темы', mods: [...st.themes], theme: st.theme ? cur : null}), 'primary')));
    }},
    {id: 'open', label: 'Открыть сборку', icon: 'folder', render(p) {
      p.append(note('Сборки (.sspack) открываются так же, как проекты: «Файл → Открыть…» или кнопкой ниже. Перед установкой покажется, что внутри, — можно снять лишнее.'),
        h('div', {class: 'btnrow share-go'}, button('Открыть сборку…', async () => { ss.ui.closeDialog(); await ss.openFile(); }, 'primary'), canFiles ? button('Папка модов', () => host.openModsFolder()) : null));
    }},
  ]});
  ss.reg.menus.register({id: 'file:share', menu: 'Файл', order: 130, label: 'Поделиться: проект, моды, темы…', action: () => ss.ui.openDialog('share')});
  ss.share = {saveBundle, importBundle, modsUsedByCampaign, themeMods, packMods};
}
