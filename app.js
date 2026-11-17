let events=[],selected=new Date(),weekStart;
const $=id=>document.getElementById(id),pad=n=>String(n).padStart(2,'0');
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const monday=d=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-(x.getDay()+6)%7);return x};
const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const fmt=d=>d.toLocaleDateString('pl-PL',{day:'numeric',month:'long'});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cancelled=e=>/zaj[eę]cia odwo[lł]ane|odwo[lł]an[ae]/i.test(e.note||'');
const remote=e=>/distance learning|zdaln|online/i.test(e.note||'');
const slot=e=>[e.date,e.start,e.end,e.group,e.subject].join('|');
const identity=e=>[e.date,e.group,e.subject].join('|');
const exact=e=>[slot(e),e.room||'',e.note||'',e.assessment||''].join('|');
const sortEvents=arr=>arr.sort((a,b)=>(a.date+' '+a.start.padStart(5,'0')).localeCompare(b.date+' '+b.start.padStart(5,'0')));
function render(){
 weekStart=monday(selected);
 $('week').textContent=`${fmt(weekStart)} – ${fmt(add(weekStart,6))}`;
 $('days').innerHTML=Array.from({length:7},(_,i)=>{const d=add(weekStart,i),k=dateKey(d),has=events.some(e=>e.date===k);return `<button class="day ${k===dateKey(selected)?'active':''} ${has?'has':''}" data-date="${k}">${['Pon','Wt','Śr','Czw','Pt','Sob','Niedz'][i]}<b>${d.getDate()}</b></button>`}).join('');
 document.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{selected=new Date(b.dataset.date+'T12:00:00');render()});
 const list=events.filter(e=>e.date===dateKey(selected)).sort((a,b)=>a.start.localeCompare(b.start));
 $('heading').textContent=selected.toLocaleDateString('pl-PL',{weekday:'long',day:'numeric',month:'long'});
 $('count').textContent=`${list.length} zajęć`;
 $('events').innerHTML=list.length?list.map(e=>{
  const isCancelled=cancelled(e),isRemote=remote(e);
  const status=isCancelled?'<span class="tag cancelled-tag">ODWOŁANE</span>':isRemote?'<span class="tag remote-tag">ZDALNIE</span>':'';
  const room=isCancelled?'Zajęcia odwołane':isRemote?'Distance learning':(e.room||'Sala niepodana');
  const note=e.note&&!isCancelled&&!isRemote?' · '+esc(e.note):'';
  return `<article class="event ${e.group==='WykS'?'lecture':''} ${isCancelled?'cancelled':isRemote?'remote':''}"><div class="bar"></div><div><div class="time">${esc(e.start)}–${esc(e.end)}</div><h3>${esc(e.subject)}</h3><p>⌖ ${esc(room)}${note}</p><span class="tag">${e.group==='WykS'?'Wykład':'Ćwiczenia'}</span> ${status}</div></article>`;
 }).join(''):'<div class="empty">Brak zajęć w wybranym dniu ☕</div>';
}
$('prev').onclick=()=>{selected=add(weekStart,-7);render()};
$('next').onclick=()=>{selected=add(weekStart,7);render()};
function parseCSV(text){
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);let day=null;const out=[];
 for(const line of lines){
  const cols=line.split(';');
  if(cols[0]?.startsWith('Data Zajec:')){const m=cols[0].match(/(\d{4})\.(\d{2})\.(\d{2})/);day=m?`${m[1]}-${m[2]}-${m[3]}`:null;continue}
  const g=cols[4]?.trim().split(/\s+/).pop();
  if(day&&['Cw2S','WykS'].includes(g)&&/^\d{1,2}:\d{2}$/.test(cols[1]||'')){
   out.push({date:day,start:cols[1],end:cols[2],group:g,subject:cols[5]||'',room:cols[6]||'',assessment:cols[7]||'',note:cols[8]||''});
  }
 }
 return out;
}
const API='https://plan-zajec.m-nowicka2006.workers.dev/';
function applyNew(newer,origin){
 if(!newer.length)throw Error('Nie znaleziono zajęć Cw2S ani WykS.');
 // Nieobecność zajęć w częściowym eksporcie NIE jest dowodem ich odwołania.
 // Zmienione sale i adnotacje aktualizujemy dla tych samych zajęć i godzin.
 const map=new Map(events.map(e=>[slot(e),e]));
 const added=[],changed=[];
 for(const e of newer){
  const k=slot(e),previous=map.get(k);
  if(previous){if(exact(previous)!==exact(e))changed.push({before:previous,after:e});map.set(k,e);}
  else {map.set(k,e);added.push(e);}
 }
 events=sortEvents([...map.values()]);
 localStorage.setItem('dsw-plan',JSON.stringify(events));
 const stamp=new Date().toLocaleString('pl-PL');localStorage.setItem('dsw-updated',stamp);
 $('source').textContent=origin+' · '+stamp;
 $('changes').innerHTML=`<div class="good">Synchronizacja zakończona · ${esc(stamp)}</div><div class="changed">Pobrano: ${newer.length} · Nowe: ${added.length} · Zmienione: ${changed.length} · Łącznie: ${events.length}</div><div>Nie usuwamy zajęć, których brakuje w eksporcie. Zmiany godzin wymagają potwierdzenia w pełnym planie.</div>`+
 changed.slice(0,12).map(x=>`<div>✎ ${esc(x.after.date)} ${esc(x.after.start)} ${esc(x.after.subject)} — zmieniona sala lub status</div>`).join('')+
 added.slice(0,12).map(x=>`<div>＋ ${esc(x.date)} ${esc(x.start)} ${esc(x.subject)}</div>`).join('');
 render();
}
async function sync(){
 const b=$('sync');b.disabled=true;b.textContent='Sprawdzam…';
 try{
  const r=await fetch(API+'?t='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw Error('Serwer synchronizacji: HTTP '+r.status);
  const result=await r.json();
  if(!result.success||!result.csv)throw Error(result.error||'Serwer nie zwrócił danych CSV.');
  applyNew(parseCSV(result.csv),'IDEIS online');
 }catch(e){$('changes').textContent='Nie udało się odświeżyć: '+e.message+' Ostatni zapisany plan pozostaje dostępny.'}
 finally{b.disabled=false;b.textContent='↻ Sprawdź aktualny plan'}
}
$('sync').onclick=sync;
$('upload').onchange=async e=>{
 const f=e.target.files?.[0];if(!f)return;
 const bytes=await f.arrayBuffer();let text=new TextDecoder('windows-1250').decode(bytes);
 if(text.includes('�'))text=new TextDecoder('utf-8').decode(bytes);
 try{applyNew(parseCSV(text),'CSV ręcznie')}catch(err){$('changes').textContent=err.message}
};
(async()=>{try{
 const baseline=await(await fetch('plan.json',{cache:'no-store'})).json();
 const saved=localStorage.getItem('dsw-plan');
 const combined=new Map(baseline.map(e=>[slot(e),e]));
 if(saved){for(const e of JSON.parse(saved))combined.set(slot(e),e)}
 events=sortEvents([...combined.values()]);
 $('source').textContent=saved?'Zapisany plan: '+(localStorage.getItem('dsw-updated')||'offline'):'Plan z eksportu IDEIS';
 const today=dateKey(new Date());if(!events.some(e=>e.date===today)){const upcoming=events.find(e=>e.date>=today);if(upcoming)selected=new Date(upcoming.date+'T12:00:00')}
 render();await sync();
 }catch(err){$('events').textContent='Nie udało się wczytać planu: '+err.message}
})();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
