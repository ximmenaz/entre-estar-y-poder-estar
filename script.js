import { HoldToListen, recordingsForTerritory, projectRecordings, audioFile, formatDuration } from './territorial-audio.mjs';
import { mountPhotoCarousel } from './field-gallery.mjs';
import { VARIABLE_ORDER, LEVEL_WIDTHS, hasLevel, datumFor, statusLabel, levelLabel, meaningFor, validateDocument, generalMapPoints } from './small-data.mjs';

'use strict';

const $ = selector => document.querySelector(selector);
const state = { projectSound: null, mapSound: null, smallData: null, revealObserver: null, levelAnnotation: null, data: null, territory: 'tlatelolco', change: 0, annotation: null, activeAudio: null, dismissedHotspot: null };
const levels = { bajo: 14, medio: 27, alto: 40 };
const levelNames = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };
const sourceNames = { oficial: 'Fuente oficial', observacion_propia: 'Observación propia', interpretacion: 'Interpretación del equipo' };
const mainCategories = VARIABLE_ORDER;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const scrollBehavior = () => reducedMotion.matches ? 'instant' : 'smooth';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function localResource(path) {
  return typeof path === 'string' && !/^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(path) && !path.split('/').includes('..');
}
function categoryById(id) { return state.data.categorias.find(c => c.id === id); }
function currentTerritory() { return state.data.territorios.find(t => t.id === state.territory); }
function sceneFor(t) { return state.data.escenas.find(s => s.id === t.escenas[0]); }
function recordsFor(territoryId, categoryId) {
  const territory = state.data.territorios.find(t => t.id === territoryId);
  return state.data.registros.filter(r => r.territorio === territoryId &&
    (!r.escena || territory.escenas.includes(r.escena)) &&
    (!categoryId || r.categoria === categoryId) && r.confirmado === true &&
    sourceNames[r.tipo_fuente] && (r.referencia || r.evidencia) && r.observacion)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
}
function valueLabel(record) {
  if (!record || !levels[record.nivel]) return 'Sin valoración registrada';
  const value = record.valor !== undefined && record.valor !== null ? ` · ${record.valor}${record.unidad ? ' ' + record.unidad : ''}` : '';
  return levelNames[record.nivel] + value;
}
function dataCircle(datum, category, {large = false} = {}) {
  const wrap = el('span', 'data-circle-wrap');
  wrap.setAttribute('aria-hidden', 'true');
  if (!hasLevel(datum)) {
    wrap.append(el('span', 'missing-mark', '—'));
    return wrap;
  }
  const glyph = el('span', 'datum-glyph');
  const shape = el('span', 'variable-circle');
  const path=state.smallData?.recursos_svg_niveles?.[datum.nivel];
  shape.style.setProperty('--level-shape',`url(${JSON.stringify(path)})`);
  shape.style.setProperty('--category',category.color);
  shape.style.setProperty('--glyph-width',`${LEVEL_WIDTHS[datum.nivel] * (large ? 1 : .64)}px`);
  shape.dataset.level=String(datum.nivel);shape.dataset.variable=category.id;
  glyph.append(shape); wrap.append(glyph);
  return wrap;
}
function territorialDatum(territoryId, categoryId) {
  return datumFor(state.smallData, territoryId, categoryId);
}
function contextualRecordsFor(territoryId) {
  const records = recordsFor(territoryId).map(r => ({...r, estado: r.tipo_fuente === 'interpretacion' ? 'hipotesis' : 'observacion_usuario'}));
  const territory = state.smallData?.territorios.find(t => t.id === territoryId);
  for (const record of territory?.contexto || []) {
    if (!['observacion_usuario','hipotesis'].includes(record.estado) || !record.observacion || !record.origen || !categoryById(record.categoria)) continue;
    if (record.audio && !localResource(record.audio)) continue;
    records.push({...record, territorio:territoryId, tipo_fuente:record.estado==='hipotesis'?'interpretacion':'observacion_propia', referencia:record.origen, confirmado:record.estado==='observacion_usuario'});
  }
  return records;
}
function closeLevelAnnotation(restoreFocus = false) {
  const current = state.levelAnnotation;
  if (!current) return;
  current.panel.remove(); current.trigger.setAttribute('aria-expanded', 'false');
  current.trigger.removeAttribute('aria-controls'); state.levelAnnotation = null;
  if (restoreFocus && current.trigger.isConnected) current.trigger.focus({preventScroll:true});
}
function appendReference(container, reference) {
  if (typeof reference === 'string') {
    container.append(el('p', 'source-detail', reference)); return;
  }
  if (!reference || typeof reference !== 'object') return;
  const title = reference.titulo || reference.nombre || reference.fuente || 'Referencia secundaria';
  const url = reference.url;
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    const link = el('a', 'source-detail reference-link', title); link.href = url;
    // Remain in this page's browsing context; no new windows are created.
    container.append(link);
  } else container.append(el('p', 'source-detail', title));
}
function openLevelAnnotation(datum, category, trigger, placement, {territory=currentTerritory(),focus=true}={}) {
  const same = state.levelAnnotation?.trigger === trigger;
  if(same&&state.levelAnnotation.fromHover&&focus){state.levelAnnotation.fromHover=false;state.levelAnnotation.panel.querySelector('button')?.focus({preventScroll:true});return;}
  if(same&&!focus)return;
  closeAnnotation(); closeLevelAnnotation();
  if (same) return;
  const panel = el('div', 'level-annotation'); panel.id = 'level-annotation';
  panel.setAttribute('role','region'); panel.setAttribute('aria-label','Registro de '+category.nombre);
  const close = el('button','annotation-close','Cerrar ×'); close.type='button';
  close.setAttribute('aria-label','Cerrar registro territorial'); close.addEventListener('click',()=>closeLevelAnnotation(true));
  const heading = el('div','level-annotation-heading');
  heading.append(el('h4','',category.nombre),el('span',`validation-label status-${datum.estado}`,statusLabel(datum)));
  panel.append(close,heading,el('p','datum-territory',territory.nombre),el('p','registered-level',levelLabel(datum)),el('p','',meaningFor(category.id,datum)));
  const observed = el('p','datum-observation');
  observed.append(el('span','finding-type',datum.estado==='hipotesis'?'OBSERVACIÓN CONTEXTUAL · HIPÓTESIS':'OBSERVACIÓN ASOCIADA'),document.createTextNode(datum.observacion));
  panel.append(observed);
  panel.append(el('p','source-detail','Origen: '+datum.origen));
  if (datum.fecha) panel.append(el('p','source-detail','Fecha: '+datum.fecha));
  if (datum.referencias_secundarias?.length) {
    panel.append(el('p','finding-type','REFERENCIAS SECUNDARIAS · CONTEXTO'));
    datum.referencias_secundarias.forEach(ref=>appendReference(panel,ref));
  }
  if (datum.informacion_pendiente?.length) {
    const pending=el('p','source-detail');pending.append(el('span','finding-type','PENDIENTE DE VALIDAR'));
    pending.append(document.createTextNode(Array.isArray(datum.informacion_pendiente)?datum.informacion_pendiente.join(' · '):datum.informacion_pendiente));panel.append(pending);
  }
  if (datum.estado==='hipotesis') panel.append(el('p','preliminary-note','Esta valoración es tentativa y no debe leerse como un dato confirmado.'));
  placement.append(panel);state.levelAnnotation={panel,trigger,fromHover:!focus};
  trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls',panel.id);
  if(focus)close.focus({preventScroll:true});
}
function renderMapIndicators(t) {
  const container=$('#map-indicators');container.replaceChildren();
  const missing=mainCategories.filter(id=>!hasLevel(territorialDatum(t.id,id)));
  const summary=$('#pending-levels');summary.hidden=!missing.length;
  summary.textContent=missing.length===mainCategories.length?'— Sin nivel registrado en las cinco variables.':`— Sin nivel: ${missing.map(id=>categoryById(id).etiqueta_corta || categoryById(id).nombre).join(', ')}.`;
  mainCategories.forEach((id,index)=>{
    const category=categoryById(id),datum=territorialDatum(t.id,id);
    if(!hasLevel(datum))return;
    const card=el('article',`map-datum${hasLevel(datum)?' has-record':''}`);
    card.dataset.variable=id;card.dataset.estado=datum?.estado || 'sin_dato';
    card.style.setProperty('--reveal-delay',`${(.45+index*.4).toFixed(2)}s`);
    card.style.setProperty('--pulse-delay',`${4+index*2.4}s`);
    const button=el(hasLevel(datum)?'button':'div','datum-button');
    if(hasLevel(datum)){
      button.type='button';button.dataset.level=String(datum.nivel);
      button.setAttribute('aria-expanded','false');
      button.setAttribute('aria-label',`${category.nombre}: ${levelLabel(datum)}. ${statusLabel(datum)}. Leer registro.`);
      button.addEventListener('click',()=>openLevelAnnotation(datum,category,button,container));
      button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&!state.levelAnnotation)openLevelAnnotation(datum,category,button,container,{focus:false});});
    }
    button.append(el('span','datum-name',category.nombre),dataCircle(datum,category,{large:true}),el('span','datum-level',hasLevel(datum)?levelLabel(datum):''),el('span',`datum-status status-${datum?.estado || 'sin_dato'}`,statusLabel(datum)));
    card.append(button);container.append(card);
  });
  container.hidden=!container.children.length;
  const context=$('#context-records');context.replaceChildren();
  const contextual=contextualRecordsFor(t.id);
  contextual.forEach((record,index)=>{
    const category=categoryById(record.categoria);
    // Only a real, associated audio enables the sound icon.
    const key=record.audio?'sonido':record.recurso_svg || category?.icono;
    if(!key || key==='sonido'&&!localResource(record.audio))return;
    const graphic=icon(key);if(!graphic)return;
    const button=el('button','context-record');button.type='button';button.append(graphic,el('span','',record.lugar || category.nombre));
    button.style.setProperty('--context-delay',`${(3.05+index*.22).toFixed(2)}s`);
    button.append(el('span',`context-validation status-${record.estado}`,record.estado==='hipotesis'?'Valoración preliminar':'Observación del equipo'));
    button.setAttribute('aria-label',`Leer registro contextual: ${record.lugar || category.nombre}`);
    button.addEventListener('click',()=>openAnnotation({category,records:[record],trigger:button}));context.append(button);
  });
  context.hidden=!context.children.length;
  $('#map-records .motion-note').hidden=!container.children.length&&!context.children.length;
}
function startTerritorySequence() {
  state.revealObserver?.disconnect();state.revealObserver=null;
  const column=$('.scene-column');column.classList.remove('sequence-running');
  if(reducedMotion.matches){column.classList.add('sequence-running');return;}
  const activate=()=>{column.classList.add('sequence-running');state.revealObserver?.disconnect();state.revealObserver=null;};
  if(!('IntersectionObserver' in window)){activate();return;}
  state.revealObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))activate();},{threshold:.15});
  state.revealObserver.observe($('#map-records'));
}
function icon(key, className = 'research-icon') {
  const path = state.data.recursos_svg[key];
  if (!localResource(path)) return null;
  const img = el('img', className);
  img.src = path; img.alt = ''; img.width = 42; img.height = 42;
  return img;
}
function comfortDrawing() {
  // No original SVG exists for comfort. A small seat illustrates this variable;
  // the five supplied SVG files remain untouched and are used for their own meanings.
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('class', 'comfort-drawing');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M8 22h24M10 22V11h20v11M13 12v10m7-10v10m7-10v10M8 26h24M11 26v7m18-7v7M7 17v9m26-9v9');
  svg.append(path); return svg;
}
function categoryIcon(category) { return category.icono ? icon(category.icono) : comfortDrawing(); }
function soundWaves() {
  const waves = el('span', 'sound-waves'); waves.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) waves.append(el('i'));
  return waves;
}
function pauseAudio(except=null) {
  if(state.mapSound && state.mapSound.audio!==except)state.mapSound.stop();
  if(state.projectSound && state.projectSound.audio!==except)state.projectSound.stop();
  document.querySelectorAll('audio').forEach(audio => {if(audio!==except)audio.pause();});
  if(state.activeAudio!==except)state.activeAudio=null;
}
function wireAudio(audio, host, status) {
  audio.addEventListener('play', () => {
    document.querySelectorAll('audio').forEach(other => { if (other !== audio) other.pause(); });
    state.activeAudio = audio; host.classList.add('is-playing');
    if (status) status.textContent = 'Reproduciendo la grabación.';
  });
  const stop = () => { host.classList.remove('is-playing'); if (status) status.textContent = 'Grabación en pausa.'; };
  audio.addEventListener('pause', stop);
  audio.addEventListener('ended', () => { stop(); if (status) status.textContent = 'Grabación finalizada.'; });
  audio.addEventListener('error', () => { stop(); if (status) status.textContent = 'No se pudo cargar esta grabación. Revisa el archivo de origen.'; });
}

function clearMapSound() {
  state.mapSound?.destroy();state.mapSound=null;
  $('#map-sound').replaceChildren();$('#map-sound').hidden=true;
}
function mountSoundPlayer(root, recordings, {prefix='map',territory=null,visibilityTarget=root,onSelect=()=>{}}={}) {
  root.replaceChildren();root.hidden=!recordings.length;if(!recordings.length)return null;
  const heading=el('div','map-sound-heading');heading.append(el('span','eyebrow','ESCUCHAR LA CIUDAD'),el('span','map-sound-scope',territory?'Registro del territorio':'Archivo sonoro general'));
  const label=el('label','map-sound-select-label','Elige una grabación');label.htmlFor=prefix+'-sound-select';
  const select=el('select','map-sound-select');select.id=prefix+'-sound-select';
  recordings.forEach((record,index)=>{const duration=formatDuration(record.duracion);const option=el('option','',`${record.titulo || record.id}${duration?' · '+duration:''}`);option.value=String(index);select.append(option);});
  const hold=el('button','map-sound-hold');hold.type='button';
  const visual=el('span','map-sound-visual');visual.append(icon('sonido'));
  const rings=el('span','map-sound-rings');rings.setAttribute('aria-hidden','true');for(let i=0;i<3;i++)rings.append(el('i'));visual.append(rings);
  hold.append(visual,el('span','','Mantén presionado para escuchar la ciudad'));
  hold.setAttribute('aria-label','Mantén presionado para escuchar la ciudad. También puedes mantener Espacio o Enter.');hold.setAttribute('aria-pressed','false');
  const toggle=el('button','map-sound-toggle','Reproducir sin mantener presionado');toggle.type='button';toggle.setAttribute('aria-pressed','false');
  const status=el('p','map-sound-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.id=prefix+'-sound-status';
  const caption=el('p','map-sound-caption');caption.id=prefix+'-sound-caption';hold.setAttribute('aria-describedby',status.id+' '+caption.id);
  const audio=el('audio');audio.preload='none';audio.hidden=true;
  root.append(heading,label,select,hold,toggle,status,caption,audio);
  let controller=null;
  const choose=()=>{
    controller?.destroy();
    const index=Number(select.value),record=recordings[index];audio.src=audioFile(record);root.dataset.audioScope=territory?'territorial':'general';
    caption.textContent=territory?`${record.lugar_registrado || territory.nombre} · ${record.procedencia_territorial}`:'Registro general del proyecto. Su territorio y lugar de grabación no están documentados.';
    controller=new HoldToListen({button:hold,toggle,audio,status,root,beforePlay:()=>pauseAudio(audio),onPlaybackChange:playing=>{if(playing)state.activeAudio=audio;else if(state.activeAudio===audio)state.activeAudio=null;}});
    onSelect(index);
  };
  select.addEventListener('change',choose);choose();
  const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{if(entries.some(entry=>!entry.isIntersecting))controller?.stop();},{threshold:0}):null;
  observer?.observe(visibilityTarget);
  return {get audio(){return audio;},stop(){controller?.stop();},selectRecording(index){select.value=String(index);choose();root.scrollIntoView({behavior:scrollBehavior(),block:'nearest'});hold.focus({preventScroll:true});},destroy(){observer?.disconnect();select.removeEventListener('change',choose);controller?.destroy();audio.removeAttribute('src');audio.load();}};
}
function renderMapSound(t) {
  clearMapSound();
  const recordings=recordingsForTerritory(state.data,t.id);
  $('#territory-sound-note').hidden=!!recordings.length;
  if(recordings.length)state.mapSound=mountSoundPlayer($('#map-sound'),recordings,{territory:t});
}

function buildGuide() {
  const container = $('#concepts');container.replaceChildren();
  const heroLegend=$('#hero-variable-legend');heroLegend.replaceChildren();
  mainCategories.forEach(id => {
    const category=categoryById(id);
    document.documentElement.style.setProperty('--variable-'+id,category.color);
    const button=el('button','concept');button.type='button';button.style.setProperty('--category',category.color);
    button.setAttribute('aria-pressed','false');button.setAttribute('aria-controls','concept-description');
    const color=el('span','variable-color-key');color.setAttribute('aria-hidden','true');
    button.append(color,el('span','concept-color-name',category.nombre_color),el('span','concept-name',category.etiqueta_corta || category.nombre));
    const explain=()=>{
      container.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      $('#concept-description').textContent=`${category.nombre_color} — ${category.nombre}: ${category.significado}`;
    };
    button.addEventListener('click',explain);button.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')explain();});
    container.append(button);
    const link=el('a','hero-variable-item');link.href='#datos';link.style.setProperty('--category',category.color);
    const swatch=el('span');swatch.setAttribute('aria-hidden','true');
    link.append(swatch,document.createTextNode(category.etiqueta_corta || category.nombre));heroLegend.append(link);
  });
  const symbols=$('#symbol-legend');symbols.replaceChildren();
  for(const [key,label] of [['dinerito','Consumo'],['cuidado','Precaución o restricción'],['transporte','Acceso al transporte'],['area_verde','Áreas verdes'],['sonido','Registros sonoros']]){
    const item=el('div','symbol-legend-item');item.append(icon(key),el('span','',label));symbols.append(item);
  }
}
function buildHeroPoints(){
  const layer=$('#hero-data-points');layer.replaceChildren();
  const points=generalMapPoints(state.data,state.smallData);
  for(const point of points){
    const category=categoryById(point.variable),button=el('button','hero-record-point');button.type='button';
    button.style.left=`${point.position.x}%`;button.style.top=`${point.position.y}%`;
    button.style.setProperty('--category',category.color);
    const order=mainCategories.indexOf(point.variable);
    button.style.setProperty('--point-delay',`${(.3+order*.43+points.filter(p=>p.variable===point.variable).indexOf(point)*.07).toFixed(2)}s`);
    button.style.setProperty('--halo-delay',`${4+order*2.3}s`);
    button.setAttribute('aria-label',`${category.nombre}: ${levelLabel(point.datum)}. ${point.territory.nombre}. ${statusLabel(point.datum)}.`);
    button.setAttribute('aria-expanded','false');
    if(point.integrated){button.classList.add('is-integrated');}
    else button.append(dataCircle(point.datum,category));
    const show=focus=>openLevelAnnotation(point.datum,category,button,$('#hero-observation-notes'),{territory:point.territory,focus});
    button.addEventListener('click',()=>show(true));button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&!state.levelAnnotation)show(false);});
    layer.append(button);
  }
}
function buildTerritories() {
  const list = $('#territory-list');
  const selector = $('#territory-select');
  state.data.territorios.forEach((t, index) => {
    const button = el('button', 'territory-button'); button.type = 'button';
    button.dataset.territory = t.id;
    button.style.setProperty('--territory-color', t.color);
    const color = el('span', 'territory-color'); color.setAttribute('aria-hidden', 'true');
    button.append(color, el('span', '', t.nombre), el('span', 'territory-number', String(index + 1).padStart(2, '0')));
    button.addEventListener('click', () => selectTerritory(t.id));
    list.append(button);
    const option = el('option', '', t.nombre); option.value = t.id; selector.append(option);
    const point = el('button', 'map-point', String(index + 1).padStart(2, '0'));
    point.type = 'button'; point.dataset.territory = t.id;
    point.style.left = `${t.punto_mapa.x}%`; point.style.top = `${t.punto_mapa.y}%`;
    point.setAttribute('aria-label', `Seleccionar ${t.nombre}`);
    point.addEventListener('click', () => selectTerritory(t.id));
    $('#map-points').append(point);
    const label = el('span', 'map-label', t.nombre.replace(' / ', ' — '));
    label.dataset.label = t.id; $('#map-labels').append(label);
  });
  selector.addEventListener('change', event => selectTerritory(event.target.value));
  // The original raster is the only geographic base. Clicks sample its actual
  // pixels, rather than placing invented geometry over the map.
  const image = $('#general-map');
  const canvas = document.createElement('canvas');
  const prepare = () => {
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    canvas.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0);
  };
  if (image.complete && image.naturalWidth) prepare(); else image.addEventListener('load', prepare, { once: true });
  const palette = [
    ['santa-maria', [246,223,68]], ['tlatelolco',[77,153,207]], ['morelos',[239,154,50]],
    ['juarez',[130,120,189]], ['centro',[217,83,160]], ['esperanza',[211,223,69]],
    ['obrera',[235,118,171]], ['roma',[121,190,166]]
  ];
  image.addEventListener('click', event => {
    if (!canvas.width) return;
    const rect = image.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((event.clientX - rect.left) / rect.width * canvas.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((event.clientY - rect.top) / rect.height * canvas.height)));
    const ctx = canvas.getContext('2d');
    const candidates = [];
    // White street lines are skipped by sampling a small surrounding patch.
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
      const px = Math.max(0, Math.min(canvas.width - 1, x + dx));
      const py = Math.max(0, Math.min(canvas.height - 1, y + dy));
      const rgb = ctx.getImageData(px, py, 1, 1).data;
      if (Math.max(...rgb.slice(0,3)) - Math.min(...rgb.slice(0,3)) < 40) continue;
      const nearest = palette.map(([id, color]) => ({id, distance:color.reduce((sum,c,i) => sum + (c-rgb[i])**2, 0)})).sort((a,b) => a.distance-b.distance)[0];
      if (nearest.distance < 9000) candidates.push(nearest.id);
    }
    if (!candidates.length) return;
    const counts = candidates.reduce((all,id) => (all[id]=(all[id]||0)+1,all),{});
    selectTerritory(Object.keys(counts).sort((a,b) => counts[b]-counts[a])[0]);
  });
}

function closeAnnotation(restoreFocus = false) {
  const trigger = state.annotation?.trigger;
  if (restoreFocus && trigger?.classList.contains('hotspot')) state.dismissedHotspot = trigger;
  $('#annotation').querySelectorAll('audio').forEach(a => a.pause());
  $('#annotation').replaceChildren(); $('#annotation').hidden = true;
  $('#annotation-connector').setAttribute('hidden', '');
  document.querySelectorAll('.hotspot').forEach(p => { p.classList.remove('is-selected'); p.setAttribute('aria-expanded','false'); });
  state.annotation = null;
  if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
}
function openAnnotation({category, records = [], trigger, anchor = null, focus = true}) {
  closeAnnotation();closeLevelAnnotation();
  const panel = $('#annotation');
  state.annotation = { trigger, anchor };
  if (anchor) { trigger.classList.add('is-selected'); trigger.setAttribute('aria-expanded','true'); }
  const close = el('button', 'annotation-close', 'Cerrar ×'); close.type = 'button'; close.setAttribute('aria-label', 'Cerrar anotación');
  close.addEventListener('click', () => closeAnnotation(true)); panel.append(close);
  if (!records.length) {
    panel.append(el('h4','',category.nombre), el('p','',category.significado), el('p','source-detail','Sin valoración registrada para este territorio. Esta explicación es la guía de la variable, no una observación de campo.'));
  }
  records.forEach(record => {
    const article = el('article');
    article.append(el('h4','',record.lugar || category.nombre));
    article.append(el('p','finding-type',record.estado ? (record.estado==='hipotesis'?'VALORACIÓN PRELIMINAR':'OBSERVACIÓN DEL EQUIPO') : sourceNames[record.tipo_fuente].toUpperCase()));
    article.append(el('p','',record.observacion));
    if (hasLevel(record)) article.append(el('p','',`Nivel registrado: ${levelLabel(record)}. ${meaningFor(category.id,record)}`));
    else if (levels[record.nivel]) article.append(el('p','',`Nivel documentado: ${valueLabel(record)}.`));
    else article.append(el('p','source-detail','Registro cualitativo · sin valoración de nivel.'));
    if (record.interpretacion) article.append(el('p','interpretation',`Lectura del equipo: ${record.interpretacion}`));
    article.append(el('p','source-detail',`Fuente: ${record.referencia || record.evidencia}${record.fecha ? ' · '+record.fecha : ' · Fecha de recorrido no registrada.'}`));
    if (record.fotografia && localResource(record.fotografia)) {
      const img = el('img'); img.src=record.fotografia; img.alt=record.alt_fotografia || 'Evidencia fotográfica del registro'; article.append(img);
    }
    if (record.audio && localResource(record.audio)) {
      const audio = el('audio'); audio.controls = true; audio.preload='none'; audio.src=record.audio;
      audio.setAttribute('aria-label','Grabación asociada a '+(record.lugar || category.nombre));
      const status = el('p','source-detail','Grabación disponible.'); status.setAttribute('role','status');
      wireAudio(audio,trigger,status); article.append(audio,status);
    }
    panel.append(article);
  });
  panel.hidden = false; positionAnnotation();
  if (focus) close.focus({preventScroll:true});
  if (!anchor) $('#scene-visual').scrollIntoView({behavior:scrollBehavior(),block:'nearest'});
}
function positionAnnotation() {
  if (!state.annotation || $('#annotation').hidden) return;
  const panel = $('#annotation'); const visual = $('#scene-visual');
  const {width, height} = visual.getBoundingClientRect();
  if (!width || !height) return;
  const anchor = state.annotation.anchor || {x:50,y:8};
  const x=anchor.x/100*width, y=anchor.y/100*height;
  const pw=panel.offsetWidth, ph=panel.offsetHeight;
  const left=Math.max(10,Math.min(x-pw/2,width-pw-10));
  const top=Math.max(10,Math.min(anchor.y>50?y-ph-25:y+25,height-ph-10));
  panel.style.left=`${left}px`;panel.style.top=`${top}px`;
  const line=$('#annotation-line');
  line.setAttribute('x1',anchor.x);line.setAttribute('y1',anchor.y);
  line.setAttribute('x2',Math.max(left,Math.min(x,left+pw))/width*100);
  line.setAttribute('y2',Math.max(top,Math.min(y,top+ph))/height*100);
  $('#annotation-connector').toggleAttribute('hidden', !state.annotation.anchor);
}
function renderHotspots(t, scene) {
  $('#hotspots').replaceChildren();
  contextualRecordsFor(t.id).forEach((record,index) => {
    const p=record.posicion;
    if (!p || p.precision!=='ubicacion_documentada' || p.imagen!==scene.imagen ||
      !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x<0 || p.x>100 || p.y<0 || p.y>100) return;
    const category=categoryById(record.categoria);
    const graphic=icon(record.recurso_svg || (record.audio ? 'sonido' : category?.icono));
    if (!graphic || !category) return;
    if (record.recurso_svg==='sonido' && !localResource(record.audio)) return;
    const button=el('button','hotspot'); button.type='button';button.append(graphic);
    if(record.estado==='hipotesis')button.classList.add('is-preliminary');
    button.style.left=`${p.x}%`;button.style.top=`${p.y}%`;
    button.style.setProperty('--pulse-delay',`${5+index*2.4}s`);
    button.style.setProperty('--context-delay',`${(3.05+index*.22).toFixed(2)}s`);
    button.setAttribute('aria-label',`Leer observación: ${record.lugar || category.nombre}`);
    button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','annotation');
    const show=(focus)=>openAnnotation({category,records:[record],trigger:button,anchor:p,focus});
    button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse' && !state.annotation && state.dismissedHotspot!==button)show(false);});
    button.addEventListener('click',()=>show(true));
    $('#hotspots').append(button);
  });
}
function renderIndicators(t) {
  const container=$('#indicators');container.replaceChildren();
  mainCategories.forEach(id=>{
    const category=categoryById(id),datum=territorialDatum(t.id,id);
    const row=el('div','indicator');row.style.setProperty('--category',category.color);
    row.dataset.variable=id;row.dataset.estado=datum?.estado || 'sin_dato';
    row.classList.toggle('is-unvalued',!hasLevel(datum));
    const visual=el('span','indicator-icon');
    const hasContext=contextualRecordsFor(t.id).some(record=>record.categoria===id);
    if(hasLevel(datum)||hasContext)visual.append(categoryIcon(category));
    else {visual.classList.add('is-unavailable');visual.setAttribute('aria-hidden','true');visual.hidden=!hasLevel(datum);}
    const body=el(hasLevel(datum)?'button':'div','indicator-body');
    if(hasLevel(datum)){
      body.type='button';body.setAttribute('aria-expanded','false');
      body.setAttribute('aria-label',`${category.nombre}: ${levelLabel(datum)}. ${statusLabel(datum)}. Consultar información.`);
      body.addEventListener('click',()=>openLevelAnnotation(datum,category,body,row));
    }
    body.append(el('h4','',category.nombre));
    if(hasLevel(datum))body.append(el('p','',levelLabel(datum)));
    else {body.append(el('span','sr-only','Sin valoración registrada'));row.title=category.nombre+': Sin valoración registrada';}
    row.classList.toggle('has-context',hasContext);
    if(hasLevel(datum))body.append(el('p',`validation-label status-${datum.estado}`,statusLabel(datum)));
    const circle=dataCircle(datum,category);
    if(hasLevel(datum)){
      const trigger=el('button','sidebar-glyph-trigger');trigger.type='button';trigger.append(circle);
      trigger.setAttribute('aria-label',`Abrir círculo de ${category.nombre}: ${levelLabel(datum)}. ${statusLabel(datum)}.`);
      trigger.addEventListener('click',()=>openLevelAnnotation(datum,category,trigger,row));row.append(visual,body,trigger);
    }else row.append(visual,body,circle);
    container.append(row);
  });
}
function renderObservations(t) {
  const records=contextualRecordsFor(t.id);const container=$('#territory-observations');container.replaceChildren();
  $('#data-status').textContent=records.length?'OBSERVACIÓN DESTACADA':'CUADERNO ABIERTO';
  const available=mainCategories.filter(id=>hasLevel(territorialDatum(t.id,id)));
  if(!records.length && available.length){
    $('#data-status').textContent='VALORACIONES DISPONIBLES';
    container.append(el('p','',`Hay ${available.length} ${available.length===1?'valoración territorial':'valoraciones territoriales'}. Selecciona un círculo para consultar su observación, origen y estado de validación.`));
  } else if (!records.length) {
    container.append(el('p','','Las observaciones específicas de esta zona están por incorporar.'));
    const link=el('a','read-record','Leer los hallazgos de nuestros recorridos ↗');link.href='#hallazgos';container.append(link);
  } else {
    const record=records[0];
    container.append(el('p','',record.observacion),el('p','source-detail',`${sourceNames[record.tipo_fuente]} · ${record.referencia || record.evidencia}`));
    const button=el('button','read-record',records.length>1?`Consultar ${records.length} registros →`:'Leer observación y contexto →');button.type='button';
    button.addEventListener('click',()=>openAnnotation({category:categoryById(record.categoria),records,trigger:button}));container.append(button);
  }
}
async function selectTerritory(id, scrollToDetail=false) {
  const t=state.data.territorios.find(item=>item.id===id);if(!t)return;
  state.territory=id;const scene=sceneFor(t);const revision=++state.change;
  closeAnnotation();closeLevelAnnotation();pauseAudio();clearMapSound();state.dismissedHotspot=null;
  state.revealObserver?.disconnect();state.revealObserver=null;$('.scene-column').classList.remove('sequence-running');$('#map-indicators').replaceChildren();$('#context-records').replaceChildren();$('#context-records').hidden=true;$('#indicators').replaceChildren();$('#territory-observations').replaceChildren();
  $('#territory-select').value=id;
  document.querySelectorAll('[data-territory]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.territory===id)));
  const visual=$('#scene-visual');visual.classList.add('is-changing');visual.setAttribute('aria-busy','true');
  $('.data-panel').classList.add('is-changing');$('#hotspots').replaceChildren();
  if(scrollToDetail)$('#recorrido').scrollIntoView({behavior:scrollBehavior(),block:'start'});
  const next=new Image();next.src=scene.imagen;
  try {
    await Promise.all([next.decode(),new Promise(resolve=>setTimeout(resolve,reducedMotion.matches?0:170))]);
    if(revision!==state.change)return;
    const image=$('#scene-image');image.src=scene.imagen;image.alt=scene.alt;image.width=scene.ancho;image.height=scene.alto;image.hidden=false;$('#empty-scene').hidden=true;
    renderHotspots(t,scene);
  }catch{
    if(revision!==state.change)return;
    $('#scene-image').hidden=true;$('#empty-scene').hidden=false;
  }
  $('#data-title').textContent=t.nombre;$('#territory-description').textContent=t.descripcion;
  $('#scene-counter').textContent=`${String(state.data.territorios.indexOf(t)+1).padStart(2,'0')} / 08`;
  $('#scene-kicker').textContent=`${String(state.data.territorios.indexOf(t)+1).padStart(2,'0')} — MAPA TERRITORIAL ILUSTRADO`;
  renderMapSound(t);renderMapIndicators(t);renderIndicators(t);renderObservations(t);
  visual.classList.remove('is-changing');visual.setAttribute('aria-busy','false');$('.data-panel').classList.remove('is-changing');startTerritorySequence();
  const available=mainCategories.filter(category=>hasLevel(territorialDatum(id,category)));
  $('#selection-status').textContent=`${t.nombre}. ${available.length} ${available.length===1?'valoración territorial':'valoraciones territoriales'} y ${contextualRecordsFor(id).length} ${contextualRecordsFor(id).length===1?'registro contextual disponible':'registros contextuales disponibles'}.`;
  // Warm only the next illustration, avoiding a large download on first load.
  const nextTerritory=state.data.territorios[(state.data.territorios.indexOf(t)+1)%8];
  const preload=new Image();preload.src=sceneFor(nextTerritory).imagen;
}
function navigate(direction) {
  const all=state.data.territorios;const index=all.findIndex(t=>t.id===state.territory);
  selectTerritory(all[(index+direction+all.length)%all.length].id);
}
function buildComparison() {
  const select=$('#compare-category');
  mainCategories.forEach(id=>{const option=el('option','',categoryById(id).nombre);option.value=id;select.append(option);});
  select.addEventListener('change',renderComparison);renderComparison();
}
function renderComparison() {
  const category=categoryById($('#compare-category').value),container=$('#comparison-maps');container.replaceChildren();
  let observed=0,preliminary=0;
  state.data.territorios.forEach(t=>{
    const scene=sceneFor(t),datum=territorialDatum(t.id,category.id);
    if(hasLevel(datum)){if(datum.estado==='observacion_usuario')observed++;else preliminary++;}
    const card=el('article','comparison-card');card.dataset.territory=t.id;card.dataset.estado=datum?.estado || 'sin_dato';
    const button=el('button');button.type='button';button.setAttribute('aria-label','Explorar '+t.nombre);
    const img=el('img');img.src=scene.miniatura || scene.imagen;img.alt=scene.alt;img.width=180;img.height=180;img.loading='lazy';
    button.append(img,el('h3','',t.nombre));button.addEventListener('click',()=>selectTerritory(t.id,true));
    card.append(button);
    if(hasLevel(datum))card.append(dataCircle(datum,category),el('span','comparison-label',levelLabel(datum)));
    else {const missing=el('span','comparison-missing','—');missing.setAttribute('aria-label',category.nombre+': Sin valoración registrada');missing.title='Sin valoración registrada';card.append(missing);}
    if(hasLevel(datum))card.append(el('span',`comparison-status status-${datum.estado}`,statusLabel(datum)));
    container.append(card);
  });
  $('#comparison-note').textContent=observed+preliminary?`${category.nombre}: ${observed} ${observed===1?'observación':'observaciones'} del equipo y ${preliminary} ${preliminary===1?'valoración preliminar':'valoraciones preliminares'}. Las hipótesis se identifican como «Valoración preliminar», conservando el color de su variable. Los guiones indican falta de valoración. Revisa origen, contexto y criterios antes de comparar; estos niveles no son índices oficiales ni un ranking.`:`${category.nombre}: no hay niveles registrados para comparar. El guion significa «Sin valoración registrada»; no equivale a un nivel bajo ni permite afirmar diferencias entre territorios.`;
}
function buildFindings() {
  const container=$('#findings');container.replaceChildren();
  state.data.hallazgos_transversales.forEach(f=>{
    const card=el('article','finding-card');card.dataset.finding=f.id;
    const top=el('div','finding-card-top');
    top.append(el('span','finding-card-number',f.numero),icon(f.icono,'finding-card-icon'));
    const title=el('h3','',f.titulo);title.id=`finding-title-${f.id}`;
    card.setAttribute('aria-labelledby',title.id);
    const firstSentence=f.introduccion || f.observacion.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || f.observacion;
    const intro=el('p','finding-card-intro',firstSentence);
    const toggle=el('button','finding-card-toggle');toggle.type='button';
    const label=el('span','','Descubrir hallazgo');toggle.append(label,el('span','finding-card-arrow','↗'));
    toggle.setAttribute('aria-label',`Descubrir hallazgo ${f.numero}: ${f.titulo}`);
    toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',`finding-body-${f.id}`);
    const body=el('div','finding-card-body');body.id=`finding-body-${f.id}`;body.setAttribute('aria-hidden','true');body.inert=true;
    const content=el('div','finding-card-content');
    const observation=el('p');observation.append(el('span','finding-type','OBSERVACIÓN DEL RECORRIDO'),document.createTextNode(f.observacion));
    content.append(observation);
    if(f.interpretacion){const interpretation=el('p','interpretation');interpretation.append(el('span','finding-type','LECTURA DEL EQUIPO'),document.createTextNode(f.interpretacion));content.append(interpretation);}
    if(f.anotacion)content.append(el('p','handwritten finding-card-note',f.anotacion));
    content.append(el('small','finding-card-source',`Fuente: ${f.fuente}. Hallazgo transversal; sin atribución a un territorio específico.`));
    body.append(content);
    const expand=()=>{
      const open=toggle.getAttribute('aria-expanded')!=='true';
      toggle.setAttribute('aria-expanded',String(open));body.setAttribute('aria-hidden',String(!open));body.inert=!open;card.classList.toggle('is-open',open);
      label.textContent=open?'Cerrar hallazgo':'Descubrir hallazgo';toggle.setAttribute('aria-label',`${open?'Cerrar':'Descubrir'} hallazgo ${f.numero}: ${f.titulo}`);
    };
    toggle.addEventListener('click',expand);
    card.addEventListener('click',event=>{if(!event.target.closest('button,a')&&!getSelection()?.toString())expand();});
    card.append(top,title,intro,toggle,body);container.append(card);
  });
}
function openFieldPhoto(photo) {
  pauseAudio();
  $('#photo-full').src=photo.original;$('#photo-full').alt=photo.alt || 'Fotografía del archivo de recorridos del equipo.';
  const territory=photo.territorio ? state.data.territorios.find(t=>t.id===photo.territorio)?.nombre || photo.territorio : 'Ubicación sin asociar';
  $('#photo-caption').textContent=`${photo.nombre || photo.id} · ${territory}. ${photo.descripcion || ''} ${photo.fuente || 'Archivo del equipo.'}`;
  $('#photo-dialog').showModal();
}
async function buildPhotoGallery() {
  const status=$('#gallery-status');
  try{
    const response=await fetch('data/galeria.json',{cache:'no-cache'});if(!response.ok)throw new Error('No se pudo leer el manifiesto.');
    const manifest=await response.json();
    const photos=(manifest.fotografias || []).filter(photo=>localResource(photo.original)&&localResource(photo.imagen || photo.original));
    if(!photos.length){status.textContent='El archivo fotográfico está preparado para incorporar las imágenes del equipo.';return;}
    mountPhotoCarousel({track:$('#photo-track'),previous:$('#photo-previous'),next:$('#photo-next'),counter:$('#photo-counter'),photos,onOpen:openFieldPhoto,territoryName:id=>state.data.territorios.find(t=>t.id===id)?.nombre,reducedMotion});
    status.textContent=`${photos.length} fotografías del archivo del equipo. Las ubicaciones se indican únicamente cuando están documentadas. Desliza o utiliza las flechas para recorrerlas.`;
  }catch(error){status.textContent='No se pudo abrir la galería. Comprueba el manifiesto del archivo fotográfico.';console.warn('Galería:',error.message);}
}
function buildArchive() {
  const archive=state.data.archivo;$('#archive-note').textContent=archive.nota;
  const recordings=projectRecordings(state.data),list=$('#audio-library');list.replaceChildren();
  const rows=[];
  recordings.forEach((record,index)=>{
    const article=el('article','audio-record'),button=el('button');button.type='button';
    button.setAttribute('aria-label','Seleccionar grabación general: '+record.titulo);
    button.append(icon('sonido'),el('span','',record.titulo),el('span','audio-duration',formatDuration(record.duracion)));
    button.addEventListener('click',()=>state.projectSound?.selectRecording(index));article.append(button);list.append(article);rows.push(article);
  });
  state.projectSound?.destroy();
  state.projectSound=mountSoundPlayer($('#project-sound'),recordings,{prefix:'project',visibilityTarget:$('#archivo'),onSelect:index=>rows.forEach((row,i)=>{row.classList.toggle('is-selected',i===index);if(i===index)row.firstElementChild.setAttribute('aria-current','true');else row.firstElementChild.removeAttribute('aria-current');})});
  $('#archivo').addEventListener('toggle',()=>{if(!$('#archivo').open)state.projectSound?.stop();});
}
function setupMotion() {
  if(!('IntersectionObserver' in window)||reducedMotion.matches)return;
  document.body.classList.add('motion-enabled');
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.07});
  document.querySelectorAll('.reveal').forEach(node=>observer.observe(node));
  const navObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting){document.querySelectorAll('.site-header nav a').forEach(link=>{if(link.hash==='#'+entry.target.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});}
  }),{rootMargin:'-10% 0px -70% 0px'});
  ['inicio','investigacion','explorar','reflexion'].forEach(id=>navObserver.observe(document.getElementById(id)));
}
async function initialize() {
  try {
    const response=await fetch('data/territorios.json',{cache:'no-cache'});if(!response.ok)throw new Error(`HTTP ${response.status}`);
    state.data=await response.json();
    if(!Array.isArray(state.data.territorios)||state.data.territorios.length!==8)throw new Error('Faltan territorios');
    const notice=$('#small-data-status');
    try {
      const levelsResponse=await fetch('data/territorios_small_data_preliminar.json',{cache:'no-cache'});
      if(!levelsResponse.ok)throw new Error('No se pudo leer el archivo de valoraciones.');
      const levelsDocument=await levelsResponse.json();
      const errors=validateDocument(levelsDocument,state.data.territorios.map(t=>t.id));
      if(errors.length)throw new Error(errors.join(' '));
      state.smallData=levelsDocument;
      notice.hidden=true;
    }catch(error){
      state.smallData=null;notice.textContent='Las valoraciones territoriales no están disponibles. Se conservan las ilustraciones y los registros cualitativos; no se asignan niveles.';notice.hidden=false;
      console.warn('Small Data:',error.message);
    }
    buildGuide();buildHeroPoints();buildTerritories();buildComparison();buildFindings();buildArchive();await buildPhotoGallery();
    $('#project-intro').textContent=state.data.proyecto.introduccion;
    $('#territory-overview').hidden=false;$('#recorrido').hidden=false;$('#load-status').hidden=true;
    await selectTerritory(state.territory);setupMotion();
  }catch(error){
    $('#load-status').hidden=false;$('#load-status').replaceChildren(el('p','','No se pudo abrir el atlas. Comprueba que el servidor local esté activo y que el JSON sea válido.'));
    const retry=el('button','','Volver a intentar');retry.type='button';retry.addEventListener('click',()=>location.reload());$('#load-status').append(retry);
    console.error('Error al cargar el atlas:',error.message);
  }
}
$('#previous-scene').addEventListener('click',()=>navigate(-1));
$('#next-scene').addEventListener('click',()=>navigate(1));
$('#next-bottom').addEventListener('click',()=>{navigate(1);$('#recorrido').scrollIntoView({behavior:scrollBehavior(),block:'start'});});
$('#close-photo').addEventListener('click',()=>$('#photo-dialog').close());
$('#photo-dialog').addEventListener('click',event=>{if(event.target===$('#photo-dialog')){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();}});
document.addEventListener('pointerdown',event=>{if(state.annotation && !$('#annotation').contains(event.target) && !state.annotation.trigger?.contains(event.target))closeAnnotation(true);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(state.levelAnnotation)closeLevelAnnotation(true);else if(!$('#annotation').hidden)closeAnnotation(true);}});
if('ResizeObserver' in window)new ResizeObserver(positionAnnotation).observe($('#scene-visual'));
window.addEventListener('resize',positionAnnotation);
window.addEventListener('hashchange',()=>pauseAudio());
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseAudio();});
window.addEventListener('blur',()=>pauseAudio());
document.addEventListener('click',event=>{if(event.target.closest('a[href^="#"]'))pauseAudio();});
if('IntersectionObserver' in window){
  const mediaSections=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting&&state.activeAudio&&entry.target.contains(state.activeAudio))pauseAudio();}));
  mediaSections.observe($('#recorrido'));mediaSections.observe($('#hallazgos'));
}
$('#map-records').addEventListener('focusin',()=>{if(!$('.scene-column').classList.contains('sequence-running')){$('.scene-column').classList.add('sequence-running');state.revealObserver?.disconnect();state.revealObserver=null;}});
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches){$('.scene-column').classList.add('sequence-running');state.revealObserver?.disconnect();state.revealObserver=null;}});
initialize();
