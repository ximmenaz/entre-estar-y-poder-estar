import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {VARIABLE_ORDER,LEVEL_WIDTHS,hasLevel,validateDocument,meaningFor,generalMapPoints} from '../../small-data.mjs';
const base=JSON.parse(await readFile(new URL('../../data/territorios.json',import.meta.url),'utf8'));
const levels=JSON.parse(await readFile(new URL('../../data/territorios_small_data_preliminar.json',import.meta.url),'utf8'));
test('los cinco colores siguen la correspondencia indicada por el equipo',()=>{
 assert.deepEqual(VARIABLE_ORDER,['costo','transporte','comodidad','seguridad','permanencia']);
 const expected={costo:'#4ca239',transporte:'#1f4fdf',comodidad:'#fcaa3f',seguridad:'#f14e4c',permanencia:'#8e55f5'};
 for(const [id,color]of Object.entries(expected))assert.equal(base.categorias.find(c=>c.id===id).color,color);
});
test('los tres tamaños permanecen distintos sin depender del territorio',()=>{
 assert.deepEqual(LEVEL_WIDTHS,{1:28,2:45,3:62});
 for(const t of base.territorios)assert.ok(t.color,'El color cartográfico se conserva por separado');
});
test('los registros pendientes no crean puntos sobre el hero',()=>{
 assert.deepEqual(generalMapPoints(base,levels),[]);
 assert.equal(levels.territorios.flatMap(t=>Object.values(t.variables)).filter(v=>v.nivel!==null).length,0);
});
test('ningún nivel general se convierte en una ubicación ficticia',()=>{
 const document=structuredClone(levels),datum=document.territorios[0].variables.costo;
 Object.assign(datum,{nivel:2,estado:'observacion_usuario',observacion:'Caso técnico aislado de unidad.',origen:'Solo prueba de la regla de posicionamiento.'});
 assert.equal(generalMapPoints(base,document).length,0);
 datum.posicion_mapa_general={x:20,y:30,precision:'ubicacion_documentada',imagen:base.proyecto.mapa_general,integrado_en_imagen:true};
 const points=generalMapPoints(base,document);assert.equal(points.length,1);assert.equal(points[0].integrated,true);assert.equal(points[0].datum.nivel,2);
 datum.posicion_mapa_general.imagen='otra-imagen.png';assert.equal(generalMapPoints(base,document).length,0);
});
test('los ejemplos declarados de prueba no se publican como observaciones',()=>{
 const document=structuredClone(levels);document.estado_archivo='prueba_tecnica';
 assert.ok(validateDocument(document,base.territorios.map(t=>t.id)).length);
 assert.equal(hasLevel({nivel:3,estado:'observacion_usuario',es_prueba:true}),false);
 assert.deepEqual(generalMapPoints(base,document),[]);
});
test('transporte se interpreta como conectividad y no como otro indicador',()=>{
 assert.match(meaningFor('transporte',{nivel:1,estado:'observacion_usuario'}),/Conectividad baja/);
 assert.match(meaningFor('transporte',{nivel:3,estado:'observacion_usuario'}),/Conectividad alta/);
});
test('la página publicada no contiene la barra de pruebas ni su generador',async()=>{
 const html=await readFile(new URL('../../index.html',import.meta.url),'utf8');
 const script=await readFile(new URL('../../script.js',import.meta.url),'utf8');
 assert.doesNotMatch(html,/PRUEBA TÉCNICA|NIVELES SINTÉTICOS|NO SON DATOS DE INVESTIGACIÓN/i);
 assert.doesNotMatch(script,/PRUEBA TÉCNICA · NIVELES SINTÉTICOS/);
 assert.match(html,/<body>\s*<a class="skip-link"[^>]*>[^<]*<\/a>\s*<header/);
});
