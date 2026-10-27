import test from 'node:test';
import assert from 'node:assert/strict';
import {HoldToListen,recordingsForTerritory,projectRecordings,documentedAudioPosition,formatDuration} from '../../territorial-audio.mjs';
class Element extends EventTarget {
  constructor(){super();this.attrs={};this.classes=new Set();this.classList={toggle:(name,value)=>value?this.classes.add(name):this.classes.delete(name)};this.textContent='';this.captured=new Set();}
  setAttribute(k,v){this.attrs[k]=v;}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);}
  getBoundingClientRect(){return{left:0,top:0,right:100,bottom:100};}
}
class Audio extends EventTarget {
  constructor(){super();this.paused=true;this.currentTime=44;this.plays=0;this.deferred=false;this.rejection=null;}
  play(){this.plays++;if(this.rejection)return Promise.reject(this.rejection);if(this.deferred)return new Promise(resolve=>{this.resolve=resolve;});this.begin();return Promise.resolve();}
  begin(){this.paused=false;this.dispatchEvent(new Event('play'));if(!this.paused)this.dispatchEvent(new Event('playing'));}
  pause(){if(!this.paused){this.paused=true;this.dispatchEvent(new Event('pause'));}}
  complete(){this.begin();this.resolve?.();}
}
function send(target,type,props={}){const event=new Event(type,{cancelable:true});for(const [k,v]of Object.entries(props))Object.defineProperty(event,k,{value:v});target.dispatchEvent(event);return event;}
function fixture(){const button=new Element(),toggle=new Element(),audio=new Audio(),status=new Element(),root=new Element(),doc=new Element(),win=new Element();doc.hidden=false;const controller=new HoldToListen({button,toggle,audio,status,root,ownerDocument:doc,ownerWindow:win});return{button,toggle,audio,status,root,doc,win,controller};}
const down={pointerId:1,button:0,isPrimary:true};
test('mantener y soltar reproduce desde el comienzo, sin reinicio por el clic final',()=>{const f=fixture();send(f.button,'pointerdown',down);assert.equal(f.audio.currentTime,0);assert.equal(f.audio.paused,false);assert.equal(f.root.classes.has('is-playing'),true);send(f.button,'pointerup',down);send(f.button,'click');assert.equal(f.audio.paused,true);assert.equal(f.root.classes.has('is-playing'),false);assert.equal(f.audio.plays,1);f.controller.destroy();});
test('cancelar, salir del botón o perder foco detiene inmediatamente el audio',()=>{for(const type of ['pointercancel','pointerleave','lostpointercapture','blur']){const f=fixture();send(f.button,'pointerdown',down);send(f.button,type,down);assert.equal(f.audio.paused,true,type);assert.equal(f.controller.wanted,false);f.controller.destroy();}});
test('salir del rectángulo con captura activa también detiene el audio',()=>{const f=fixture();send(f.button,'pointerdown',down);send(f.button,'pointermove',{pointerId:1,clientX:200,clientY:50});assert.equal(f.audio.paused,true);f.controller.destroy();});
test('Espacio y Enter admiten mantener, ignoran repetición y pausan al soltar',()=>{for(const key of [' ','Enter']){const f=fixture();send(f.button,'keydown',{key,repeat:false});send(f.button,'keydown',{key,repeat:true});assert.equal(f.audio.plays,1);assert.equal(f.audio.paused,false);send(f.button,'keyup',{key});send(f.button,'click');assert.equal(f.audio.paused,true);assert.equal(f.audio.plays,1);f.controller.destroy();}});
test('la reproducción alternativa se activa y pausa con un clic',()=>{const f=fixture();send(f.toggle,'click');assert.equal(f.audio.paused,false);assert.equal(f.toggle.attrs['aria-pressed'],'true');send(f.toggle,'click');assert.equal(f.audio.paused,true);assert.equal(f.toggle.attrs['aria-pressed'],'false');f.controller.destroy();});
test('el cambio de visibilidad o de ventana cancela la reproducción',()=>{for(const type of ['visibilitychange','blur']){const f=fixture();send(f.toggle,'click');if(type==='visibilitychange'){f.doc.hidden=true;send(f.doc,type);}else send(f.win,type);assert.equal(f.audio.paused,true);f.controller.destroy();}});
test('soltar antes de que termine la carga no permite una reproducción tardía',async()=>{const f=fixture();f.audio.deferred=true;send(f.button,'pointerdown',down);send(f.button,'pointerup',down);f.audio.complete();await Promise.resolve();assert.equal(f.audio.paused,true);assert.equal(f.root.classes.has('is-playing'),false);f.controller.destroy();});
test('destruir un control cancela su carga pendiente y elimina los listeners',async()=>{const f=fixture();f.audio.deferred=true;send(f.button,'pointerdown',down);f.controller.destroy();f.audio.complete();await Promise.resolve();assert.equal(f.audio.paused,true);const plays=f.audio.plays;send(f.button,'pointerdown',down);assert.equal(f.audio.plays,plays);});
test('los errores de reproducción se comunican y no dejan ondas activas',async()=>{const f=fixture();f.audio.rejection=new Error('Archivo de prueba no disponible');send(f.toggle,'click');await Promise.resolve();await Promise.resolve();assert.equal(f.controller.wanted,false);assert.match(f.status.textContent,/No se pudo reproducir/);assert.equal(f.root.classes.has('is-playing'),false);f.controller.destroy();});
test('los audios generales permanecen en el archivo del proyecto y no se atribuyen a mapas',()=>{const data={territorios:[{id:'a'},{id:'b'}],archivo:{audios:[{id:'general',ruta:'audio/general.mp3',alcance:'general',territorio:null},{id:'a',ruta:'audio/a.mp3',alcance:'territorial',territorio:'a',procedencia_territorial:'Referencia territorial documentada de prueba.'},{id:'sin-asociar',ruta:'audio/otro.mp3',territorio:null}]}};assert.deepEqual(recordingsForTerritory(data,'a').map(r=>r.id),['a']);assert.deepEqual(recordingsForTerritory(data,'b'),[]);assert.deepEqual(projectRecordings(data).map(r=>r.id),['general','sin-asociar']);assert.equal(data.archivo.audios[0].territorio,null);assert.deepEqual(recordingsForTerritory(data,'desconocido'),[]);});
test('un nombre de territorio o un ID sin procedencia no habilitan un audio territorial',()=>{const data={territorios:[{id:'centro'}],archivo:{audios:[{id:'centro',ruta:'audio/centro.mp3',alcance:'territorial',territorio:'centro',procedencia_territorial:null}]}};assert.deepEqual(recordingsForTerritory(data,'centro'),[]);});
test('un audio general nunca se convierte en un punto geográfico',()=>{const record={alcance:'general',posicion:{x:20,y:30,precision:'ubicacion_documentada',imagen:'mapa.png'}};assert.equal(documentedAudioPosition(record,'mapa.png'),null);assert.equal(formatDuration(96.47),'1:36');assert.equal(formatDuration(null),'');});
