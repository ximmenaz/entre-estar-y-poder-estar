import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {graphicMapPoints, territorialMapPoints, GRAPHIC_SIZES} from '../../map-observations.mjs';
const base=JSON.parse(await readFile(new URL('../../data/territorios.json',import.meta.url)));
const levels=JSON.parse(await readFile(new URL('../../data/territorios_small_data_preliminar.json',import.meta.url)));
const graphics=JSON.parse(await readFile(new URL('../../data/puntos_small_data_graficos.json',import.meta.url)));
test('la transcripción conserva su fuente y no rellena valoraciones definitivas',async()=>{
  const source=graphics.fuentes['lamina-equipo'];
  const bytes=await readFile(new URL('../../'+source.archivo,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),source.sha256);
  assert.ok(levels.territorios.every(t=>Object.values(t.variables).every(v=>v.nivel===null)));
});
test('el mapa general y los ocho mapas muestran únicamente registros gráficos trazables',()=>{
  const points=graphicMapPoints(base,graphics,levels);
  assert.equal(points.length,34);
  assert.equal(new Set(points.map(p=>p.record.id)).size,34);
  assert.deepEqual(new Set(points.map(p=>p.record.variable)),new Set(['costo','transporte','comodidad','seguridad','permanencia']));
  assert.deepEqual(new Set(points.map(p=>p.record.tamano)),new Set(Object.keys(GRAPHIC_SIZES)));
  for(const t of base.territorios) {
    const local=graphicMapPoints(base,graphics,levels,t.id);
    assert.ok(local.length>=3);
    assert.ok(local.every(p=>p.position.imagen===t.imagen&&p.position.precision==='esquematica'));
  }
});
test('no se duplican IDs ni se muestran puntos sin fuente o con imagen incorrecta',()=>{
  const document=structuredClone(graphics);
  document.puntos.push(document.puntos[0]);
  assert.equal(graphicMapPoints(base,document,levels).length,34);
  document.puntos[0]={...document.puntos[0],fuente:'inexistente'};
  document.puntos.pop();
  assert.equal(graphicMapPoints(base,document,levels).length,33);
  document.puntos[1].mapa_general.imagen='otra.png';
  assert.equal(graphicMapPoints(base,document,levels).length,32);
});
test('solo una valoración con posición documentada sustituye el punto gráfico',()=>{
  const actual=structuredClone(levels);
  const datum=actual.territorios[0].variables.costo;
  Object.assign(datum,{nivel:2,estado:'observacion_usuario',observacion:'Registro de unidad.',origen:'Prueba aislada.'});
  assert.equal(territorialMapPoints(base,actual,'santa-maria').length,0);
  assert.equal(graphicMapPoints(base,graphics,actual).length,34);
  datum.posicion_mapa_general={x:36,y:17,precision:'ubicacion_documentada',imagen:base.proyecto.mapa_general};
  datum.posicion_mapa_territorial={x:29,y:45,precision:'ubicacion_documentada',imagen:base.territorios[0].imagen};
  assert.equal(graphicMapPoints(base,graphics,actual).length,33);
  assert.equal(graphicMapPoints(base,graphics,actual,'santa-maria').length,3);
  assert.equal(territorialMapPoints(base,actual,'santa-maria').length,1);
  datum.posicion_mapa_territorial.imagen='otra.png';
  assert.equal(territorialMapPoints(base,actual,'santa-maria').length,0);
});
