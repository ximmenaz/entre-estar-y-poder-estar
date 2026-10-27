/** A native scrolling photo carousel. No autoplay, uploads, or inferred locations. */
export function mountPhotoCarousel({track, previous, next, counter, photos, onOpen, territoryName, reducedMotion}) {
  const slides=[];
  let current=0, frame=0;
  const fragment=document.createDocumentFragment();
  photos.forEach((photo,index)=>{
    const slide=document.createElement('figure');slide.className='photo-slide';
    slide.setAttribute('role','group');slide.setAttribute('aria-roledescription','fotografía');
    slide.setAttribute('aria-label',`${index+1} de ${photos.length}`);
    const button=document.createElement('button');button.type='button';button.className='photo-open';
    button.setAttribute('aria-label','Ampliar fotografía: '+photo.nombre);
    const image=document.createElement('img');image.src=photo.imagen || photo.original;
    image.alt=photo.alt || 'Fotografía del archivo de recorridos: '+photo.nombre;
    if(photo.ancho&&photo.alto){image.width=photo.ancho;image.height=photo.alto;}
    image.loading=index<2?'eager':'lazy';image.decoding='async';
    const missing=document.createElement('span');missing.className='photo-load-error';missing.hidden=true;missing.textContent='No se pudo cargar esta fotografía.';
    image.addEventListener('error',()=>{missing.hidden=false;slide.classList.add('has-error');});
    button.append(image,missing);button.addEventListener('click',()=>onOpen(photo));
    const caption=document.createElement('figcaption');
    const name=document.createElement('span');name.className='photo-filename';name.textContent=photo.nombre;
    const location=document.createElement('span');location.className='photo-location';
    location.textContent=photo.territorio ? territoryName(photo.territorio) || photo.territorio : 'Ubicación sin asociar';
    caption.append(name,location);
    if(photo.descripcion){const description=document.createElement('span');description.className='photo-description';description.textContent=photo.descripcion;caption.append(description);}
    slide.append(button,caption);fragment.append(slide);slides.push(slide);
  });
  track.replaceChildren(fragment);
  function update(index){
    current=Math.max(0,Math.min(slides.length-1,index));
    slides.forEach((slide,i)=>{slide.classList.toggle('is-current',i===current);if(i===current)slide.setAttribute('aria-current','true');else slide.removeAttribute('aria-current');});
    counter.textContent=slides.length?`${String(current+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}`:'00 / 00';
    counter.setAttribute('aria-label',slides.length?`Fotografía ${current+1} de ${slides.length}`:'No hay fotografías disponibles');
    previous.disabled=!slides.length||current===0;next.disabled=!slides.length||current===slides.length-1;
  }
  function go(index,smooth=true){
    if(!slides.length)return;
    index=Math.max(0,Math.min(slides.length-1,index));
    track.scrollTo({left:slides[index].offsetLeft-slides[0].offsetLeft,behavior:smooth&&!reducedMotion.matches?'smooth':'instant'});
    if(!smooth||reducedMotion.matches)update(index);
  }
  const onScroll=()=>{
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;let closest=0,best=Infinity;
      slides.forEach((slide,i)=>{const distance=Math.abs(slide.offsetLeft-slides[0].offsetLeft-track.scrollLeft);if(distance<best){best=distance;closest=i;}});
      update(closest);
    });
  };
  const onPrevious=()=>go(current-1),onNext=()=>go(current+1);
  const onKey=event=>{
    const index=event.key==='ArrowRight'?current+1:event.key==='ArrowLeft'?current-1:event.key==='Home'?0:event.key==='End'?slides.length-1:null;
    if(index!==null){event.preventDefault();go(index);}
  };
  track.addEventListener('scroll',onScroll,{passive:true});track.addEventListener('keydown',onKey);
  previous.addEventListener('click',onPrevious);next.addEventListener('click',onNext);
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>go(current,false)):null;observer?.observe(track);
  update(0);
  return {destroy(){if(frame)cancelAnimationFrame(frame);observer?.disconnect();track.removeEventListener('scroll',onScroll);track.removeEventListener('keydown',onKey);previous.removeEventListener('click',onPrevious);next.removeEventListener('click',onNext);}};
}
