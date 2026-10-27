import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {VARIABLE_ORDER, LEVEL_WIDTHS, datumFor, hasLevel, levelLabel, statusLabel, meaningFor, validateDocument} from '../../small-data.mjs';
const template=JSON.parse(await readFile(new URL('../../data/territorios_small_data_preliminar.json',import.meta.url),'utf8'));
const ids=template.territorios.map(t=>t.id);
function fixture(nivel=1,estado='observacion_usuario'){
  return {nivel,estado,observacion:'Registro sintético exclusivo de prueba.',origen:'Fixture técnica; no es un hallazgo de investigación.',referencias_secundarias:[],informacion_pendiente:[]};
}
test('los ocho territorios conservan sus variables y la plantilla no inventa niveles',()=>{
  assert.equal(ids.length,8);assert.deepEqual(validateDocument(template,ids),[]);
  if(template.estado_archivo==='plantilla_sin_valoraciones')for(const id of ids)for(const variable of VARIABLE_ORDER){const datum=datumFor(template,id,variable);assert.equal(datum.nivel,null);assert.equal(datum.estado,'sin_dato');assert.equal(hasLevel(datum),false);}
});
test('1, 2 y 3 se representan sin alterar el nivel ni la fuente',()=>{
  for(const nivel of [1,2,3]){
    const datum=Object.freeze(fixture(nivel));const before=JSON.stringify(datum);
    assert.equal(hasLevel(datum),true);assert.match(levelLabel(datum),new RegExp(`Nivel ${nivel}`));assert.equal(statusLabel(datum),'Observación del equipo');
    assert.equal(JSON.stringify(datum),before);
  }
  assert.ok(LEVEL_WIDTHS[1]<LEVEL_WIDTHS[2]&&LEVEL_WIDTHS[2]<LEVEL_WIDTHS[3]);
});
test('una hipótesis conserva su nivel y nunca se rotula como observación confirmada',()=>{
  const datum=Object.freeze(fixture(3,'hipotesis'));
  assert.equal(hasLevel(datum),true);assert.equal(statusLabel(datum),'Valoración preliminar');assert.match(meaningFor('costo',datum),/tentativa/);assert.match(meaningFor('costo',datum),/pendiente de validación/);assert.equal(datum.nivel,3);
});
test('sin_dato y ausencia de registro nunca equivalen a nivel bajo',()=>{
  for(const datum of [null,undefined,{estado:'sin_dato',nivel:null}]){
    assert.equal(hasLevel(datum),false);assert.equal(levelLabel(datum),'Sin valoración registrada');assert.doesNotMatch(levelLabel(datum),/Bajo/);
  }
});
test('los valores inválidos y los estados incoherentes se rechazan, no se corrigen',()=>{
  for(const nivel of [0,4,-1,1.5,'2',null]){
    const document=structuredClone(template);document.territorios[0].variables.costo=fixture(nivel);
    assert.ok(validateDocument(document,ids).some(e=>e.includes('nivel')));assert.equal(document.territorios[0].variables.costo.nivel,nivel);
  }
  const document=structuredClone(template);document.territorios[0].variables.costo=fixture(3,'sin_dato');
  assert.ok(validateDocument(document,ids).some(e=>e.includes('requiere nivel null')));
});
test('procedencia y observación son necesarias para publicar una valoración',()=>{
  const document=structuredClone(template);document.territorios[0].variables.costo={nivel:2,estado:'hipotesis'};
  assert.ok(validateDocument(document,ids).some(e=>e.includes('falta observación u origen')));
});
test('no se mezclan los territorios y no se aceptan IDs duplicados',()=>{
  const document=structuredClone(template);document.territorios[0].variables.costo=fixture(1);document.territorios[1].variables.costo=fixture(3);
  assert.equal(datumFor(document,ids[0],'costo').nivel,1);assert.equal(datumFor(document,ids[1],'costo').nivel,3);
  document.territorios[1].id=ids[0];assert.ok(validateDocument(document,ids).some(e=>e.includes('duplicados')));
});
test('costo alto se explica como mayor gasto y no como una ventaja',()=>{
  assert.match(meaningFor('costo',fixture(3)),/Mayor gasto/);assert.match(meaningFor('costo',fixture(3)),/no significa una condición más favorable/);
});
test('solo se aceptan rutas locales para los SVG originales',()=>{
  const document=structuredClone(template);document.recursos_svg_niveles[1]='https://example.com/falso.svg';assert.ok(validateDocument(document,ids).some(e=>e.includes('SVG de nivel 1')));
});
