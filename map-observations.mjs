import { VARIABLE_ORDER, datumFor, hasLevel } from './small-data.mjs';

export const GRAPHIC_SIZES = Object.freeze({ pequeno: 3.5, mediano: 5.7, grande: 8 });
export const GRAPHIC_LABELS = Object.freeze({ pequeno: 'Pequeño · bajo', mediano: 'Mediano · medio', grande: 'Grande · alto' });

function documentedPosition(base, datum, territory, local) {
  const position = local ? datum?.posicion_mapa_territorial : datum?.posicion_mapa_general;
  return hasLevel(datum) && datum.observacion && datum.origen &&
    position?.precision === 'ubicacion_documentada' &&
    position.imagen === (local ? territory.imagen : base.proyecto.mapa_general) &&
    [position.x, position.y].every(n => Number.isFinite(n) && n >= 0 && n <= 100) ? position : null;
}

export function territorialMapPoints(base, levels, territoryId) {
  const territory = base.territorios.find(t => t.id === territoryId);
  if (!territory || levels?.es_prueba || levels?.estado_archivo === 'prueba_tecnica') return [];
  return VARIABLE_ORDER.flatMap(variable => {
    const datum = datumFor(levels, territoryId, variable);
    const position = documentedPosition(base, datum, territory, true);
    return position ? [{variable, territory, datum, position}] : [];
  });
}

/** Graphic evidence stays separate from definitive territorial valuations. */
export function graphicMapPoints(base, document, levels, territoryId = null) {
  if (document?.estado !== 'transcripcion_grafica_pendiente') return [];
  const seen = new Set();
  return (document.puntos || []).flatMap(record => {
    const territory = base.territorios.find(t => t.id === record.territorio);
    const source = document.fuentes?.[record.fuente];
    const position = territoryId ? record.mapa_territorial : record.mapa_general;
    const image = territoryId ? territory?.imagen : base.proyecto.mapa_general;
    if (!territory || territoryId && territory.id !== territoryId ||
        !VARIABLE_ORDER.includes(record.variable) || !GRAPHIC_SIZES[record.tamano] ||
        record.estado !== 'transcripcion_grafica_pendiente' || !source?.archivo ||
        !Number.isFinite(record.marca_en_fuente?.x_px) || !Number.isFinite(record.marca_en_fuente?.y_px) ||
        position?.precision !== 'esquematica' || position.imagen !== image ||
        ![position.x, position.y].every(n => Number.isFinite(n) && n >= 0 && n <= 100) ||
        !record.id || seen.has(record.id) || documentedPosition(base, datumFor(levels, territory.id, record.variable), territory, !!territoryId)) return [];
    seen.add(record.id);
    return [{ record, territory, source, position }];
  });
}
