/** Playback and association rules for the team's local sound archive. */
export function audioFile(record) { return record?.archivo || record?.ruta || null; }
export function isLocalAudio(path) {
  return typeof path==='string' && !/^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(path) && !path.split('/').includes('..') && /\.(mp3|wav|m4a|ogg)$/i.test(path);
}
export function recordingsForTerritory(data, territoryId) {
  if(!data?.territorios?.some(t=>t.id===territoryId))return [];
  const source=[...(data.audios_territoriales || []),...(data.archivo?.audios || [])];
  const selected=source.filter(r=>r?.id&&isLocalAudio(audioFile(r))&&r.alcance==='territorial'&&r.territorio===territoryId&&typeof r.procedencia_territorial==='string'&&r.procedencia_territorial.trim());
  const seen=new Set();return selected.filter(r=>{const path=audioFile(r);if(seen.has(path))return false;seen.add(path);return true;});
}
export function projectRecordings(data) {
  const source=[...(data.archivo?.audios || []),...(data.audios_territoriales || [])];
  const selected=source.filter(r=>r?.id&&isLocalAudio(audioFile(r))&&(r.alcance==='general'||!r.territorio));
  const seen=new Set();return selected.filter(r=>{const path=audioFile(r);if(seen.has(path))return false;seen.add(path);return true;});
}
export function documentedAudioPosition(record,scenePath) {
  const p=record?.posicion;
  return record?.alcance!=='general' && p?.precision==='ubicacion_documentada' && p.imagen===scenePath && Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100 ? p : null;
}
export function formatDuration(seconds) {
  if(!Number.isFinite(seconds)||seconds<0)return '';
  const total=Math.round(seconds);return `${Math.floor(total/60)}:${String(total%60).padStart(2,'0')}`;
}

export class HoldToListen {
  constructor({button,toggle,audio,status,root,beforePlay=()=>{},onPlaybackChange=()=>{},ownerDocument=document,ownerWindow=window}) {
    Object.assign(this,{button,toggle,audio,status,root,beforePlay,onPlaybackChange,ownerDocument,ownerWindow});
    this.wanted=false;this.playing=false;this.disposed=false;this.generation=0;this.mode=null;this.pointerId=null;this.key=null;this.listeners=[];
    const on=(target,type,fn,options)=>{target.addEventListener(type,fn,options);this.listeners.push(()=>target.removeEventListener(type,fn,options));};
    on(button,'pointerdown',e=>{
      if(e.isPrimary===false||e.button!==undefined&&e.button!==0)return;
      e.preventDefault();button.focus?.({preventScroll:true});if(this.wanted)return;
      this.pointerId=e.pointerId;
      try{button.setPointerCapture?.(e.pointerId);}catch{}
      this.start('hold');
    });
    const release=e=>{if(this.mode==='hold'&&this.pointerId!==null&&(e.pointerId===undefined||e.pointerId===this.pointerId))this.stop();};
    on(button,'pointerup',release);on(button,'pointercancel',release);on(button,'pointerleave',release);on(button,'lostpointercapture',release);
    on(ownerWindow,'pointerup',release);on(ownerWindow,'pointercancel',release);
    on(button,'pointermove',e=>{
      if(this.mode!=='hold'||this.pointerId!==e.pointerId||!Number.isFinite(e.clientX)||!Number.isFinite(e.clientY))return;
      const r=button.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)this.stop();
    });
    on(button,'keydown',e=>{
      if(![' ','Spacebar','Enter'].includes(e.key))return;
      e.preventDefault();if(e.repeat||this.wanted)return;
      this.key=e.key;this.start('hold');
    });
    on(button,'keyup',e=>{if([' ','Spacebar','Enter'].includes(e.key)){e.preventDefault();if(this.mode==='hold'&&this.key===e.key)this.stop();}});
    // A generated click must not restart playback after pointerup or keyup.
    on(button,'click',e=>e.preventDefault());
    on(button,'contextmenu',e=>e.preventDefault());on(button,'dragstart',e=>e.preventDefault());
    on(button,'blur',()=>this.stop());on(toggle,'blur',()=>this.stop());
    on(toggle,'click',()=>{if(this.wanted)this.stop();else this.start('toggle');});
    on(ownerWindow,'blur',()=>this.stop());
    on(ownerDocument,'visibilitychange',()=>{if(ownerDocument.hidden)this.stop();});
    on(audio,'play',()=>{if(!this.wanted)audio.pause();});
    on(audio,'playing',()=>{
      if(!this.wanted||this.disposed){audio.pause();return;}
      this.playing=true;this.message('Escuchando la grabación.');this.render();this.onPlaybackChange(true);
    });
    on(audio,'waiting',()=>{if(this.wanted){this.playing=false;this.message('Cargando la grabación…');this.render();this.onPlaybackChange(false);}});
    on(audio,'pause',()=>{if(this.wanted||this.playing)this.stop();});
    on(audio,'ended',()=>{this.stop();this.message('Grabación finalizada. Mantén presionado para escucharla de nuevo.');});
    on(audio,'error',()=>{this.stop();this.message('No se pudo cargar esta grabación. Prueba otra del archivo.');});
    this.message('Grabación en pausa.');this.render();
  }
  message(text){if(this.status)this.status.textContent=text;}
  render(){
    this.root?.classList.toggle('is-playing',this.playing);
    this.button.setAttribute('aria-pressed',String(this.playing&&this.mode==='hold'));
    this.toggle.setAttribute('aria-pressed',String(this.wanted&&this.mode==='toggle'));
    this.toggle.textContent=this.wanted&&this.mode==='toggle'?'Pausar grabación':'Reproducir sin mantener presionado';
  }
  start(mode='hold'){
    if(this.disposed||this.wanted)return;
    this.beforePlay(this.audio);
    this.wanted=true;this.mode=mode;const attempt=++this.generation;
    try{this.audio.currentTime=0;}catch{}
    this.message('Preparando la grabación…');this.render();
    try{
      Promise.resolve(this.audio.play()).then(()=>{
        if(!this.wanted||this.disposed)this.audio.pause();
      }).catch(error=>{
        if(this.generation!==attempt||!this.wanted||this.disposed)return;
        this.stop();this.message(error?.name==='NotAllowedError'?'No se pudo iniciar el audio. Pulsa la reproducción alternativa para intentarlo.':'No se pudo reproducir esta grabación. Prueba otra del archivo.');
      });
    }catch{
      if(this.generation===attempt){this.stop();this.message('No se pudo reproducir esta grabación.');}
    }
  }
  stop(){
    const hadActivity=this.wanted||this.playing;
    const pointer=this.pointerId;this.pointerId=null;this.key=null;this.wanted=false;this.playing=false;this.mode=null;++this.generation;
    if(!this.audio.paused)this.audio.pause();
    try{if(pointer!==null&&this.button.hasPointerCapture?.(pointer))this.button.releasePointerCapture(pointer);}catch{}
    this.render();this.onPlaybackChange(false);
    if(hadActivity)this.message('Grabación en pausa.');
  }
  destroy(){if(this.disposed)return;this.stop();this.disposed=true;this.listeners.forEach(remove=>remove());this.listeners=[];}
}
