/** Pure interpretation of the supplied Small Data. Never edits source values. */
export const VARIABLE_ORDER = Object.freeze(['costo', 'transporte', 'comodidad', 'seguridad', 'permanencia']);
export const VALIDATION_LABELS = Object.freeze({
  observacion_usuario: 'Observación del equipo',
  hipotesis: 'Valoración preliminar',
  sin_dato: 'Sin valoración registrada'
});
export const LEVEL_LABELS = Object.freeze({ 1: 'Bajo', 2: 'Medio', 3: 'Alto' });
// Widths preserve the proportions of the original SVG viewBoxes (111, 180, 248).
export const LEVEL_WIDTHS = Object.freeze({ 1: 28, 2: 45, 3: 62 });
export function hasLevel(datum) {
  return !!datum && datum.es_prueba !== true && ['observacion_usuario', 'hipotesis'].includes(datum.estado) &&
    Number.isInteger(datum.nivel) && datum.nivel >= 1 && datum.nivel <= 3;
}
export function datumFor(document, territoryId, variableId) {
  return document?.territorios?.find(t => t.id === territoryId)?.variables?.[variableId] || null;
}
export function statusLabel(datum) {
  return hasLevel(datum) ? VALIDATION_LABELS[datum.estado] : VALIDATION_LABELS.sin_dato;
}
export function levelLabel(datum) {
  return hasLevel(datum) ? `Nivel ${datum.nivel} · ${LEVEL_LABELS[datum.nivel]}` : VALIDATION_LABELS.sin_dato;
}
export function meaningFor(variableId, datum) {
  if (!hasLevel(datum)) return 'No hay información suficiente para asignar un nivel. La ausencia de valoración no equivale a un nivel bajo.';
  const meanings = {
    costo: {1:'Menor gasto para permanecer en el contexto del recorrido.',2:'Gasto intermedio para permanecer en el contexto del recorrido.',3:'Mayor gasto para permanecer en el contexto del recorrido; no significa una condición más favorable.'},
    transporte: {1:'Conectividad baja en el contexto del recorrido.',2:'Conectividad media en el contexto del recorrido.',3:'Conectividad alta en el contexto del recorrido.'},
    permanencia: {1:'Menores posibilidades de permanecer en el contexto del recorrido.',2:'Posibilidades intermedias de permanecer en el contexto del recorrido.',3:'Mayores posibilidades de permanecer en el contexto del recorrido.'},
    comodidad: {1:'Condiciones menos favorables de comodidad durante el recorrido.',2:'Condiciones intermedias de comodidad durante el recorrido.',3:'Condiciones más favorables de comodidad durante el recorrido.'},
    seguridad: {1:'Menor sensación de seguridad en el contexto del recorrido.',2:'Sensación intermedia de seguridad en el contexto del recorrido.',3:'Mayor sensación de seguridad en el contexto del recorrido. No mide delitos ni riesgo objetivo.'}
  };
  const text = meanings[variableId]?.[datum.nivel] || 'Mayor tamaño significa mayor nivel de esta variable.';
  return datum.estado === 'hipotesis' ? `Lectura tentativa: ${text} Esta valoración está pendiente de validación.` : text;
}
export function validateDocument(document, expectedTerritoryIds) {
  const errors = [];
  if (document?.es_prueba === true || document?.estado_archivo === 'prueba_tecnica') return ['Los ejemplos de prueba no se incorporan como valoraciones de campo.'];
  if (!Array.isArray(document?.territorios)) return ['Falta la lista de territorios.'];
  const ids = document.territorios.map(t => t.id);
  if (new Set(ids).size !== ids.length) errors.push('Hay territorios duplicados.');
  if (expectedTerritoryIds && (ids.length !== expectedTerritoryIds.length || expectedTerritoryIds.some(id => !ids.includes(id)))) errors.push('Los ocho IDs territoriales deben coincidir con el atlas.');
  for (const t of document.territorios) for (const variable of VARIABLE_ORDER) {
    const datum = t.variables?.[variable];
    const path = `${t.id}.${variable}`;
    if (!datum || !Object.hasOwn(VALIDATION_LABELS, datum.estado)) { errors.push(`${path}: estado no válido.`); continue; }
    if (datum.estado === 'sin_dato' && datum.nivel !== null) errors.push(`${path}: sin_dato requiere nivel null.`);
    if (datum.estado !== 'sin_dato' && !hasLevel(datum)) errors.push(`${path}: el nivel debe ser un entero entre 1 y 3.`);
    if (datum.estado !== 'sin_dato' && (!datum.observacion || !datum.origen)) errors.push(`${path}: falta observación u origen.`);
  }
  for (const level of [1,2,3]) {
    const path = document.recursos_svg_niveles?.[level];
    if (typeof path !== 'string' || /^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(path) || path.split('/').includes('..')) errors.push(`Falta una ruta local válida para el SVG de nivel ${level}.`);
  }
  return errors;
}

/** Only explicitly documented positions are placed over the general raster. */
export function generalMapPoints(base, document) {
  if(document?.es_prueba===true || document?.estado_archivo==='prueba_tecnica')return [];
  const points=[];
  for(const variable of VARIABLE_ORDER)for(const territory of base.territorios || []){
    const datum=datumFor(document,territory.id,variable),position=datum?.posicion_mapa_general;
    if(!hasLevel(datum)||!datum.observacion||!datum.origen||position?.precision!=='ubicacion_documentada'||position.imagen!==base.proyecto.mapa_general||!Number.isFinite(position.x)||!Number.isFinite(position.y)||position.x<0||position.x>100||position.y<0||position.y>100)continue;
    points.push({variable,territory,datum,position,integrated:position.integrado_en_imagen===true});
  }
  return points;
}
