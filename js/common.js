/* MIRAÉ · общий каркас сайта (window.KR).
   Разделы файла: облако (Supabase RPC) → состояние и синхронизация → вход и регистрация →
   языки разделов → озвучка → интерфейс (иконки, шапка, прогресс). Страницы подключают этот файл и вызывают KR.* */
(function(){
const CFG=window.CONFIG||{};
const U=()=>localStorage.getItem("kr_user");
const J=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||"");return v==null?d:v}catch(e){return d}};
const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}return null};
const setStatus=s=>{try{sessionStorage.setItem("kr_cloud",s)}catch(e){}};
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const calm=()=>{try{return matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){return false}};

// ---------- облако ----------
const cloud={
  on:!!(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY),
  async rpc(fn,body){
    const r=await fetch(CFG.SUPABASE_URL+"/rest/v1/rpc/"+fn,{method:"POST",headers:{"Content-Type":"application/json",apikey:CFG.SUPABASE_ANON_KEY,Authorization:"Bearer "+CFG.SUPABASE_ANON_KEY},body:JSON.stringify(body)});
    const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(e){}
    if(!r.ok){const m=String((j&&(j.message||j.hint))||"");const e=new Error(m||("http "+r.status));e.status=r.status;e.code=/wrong_pin/.test(m)?"wrong_pin":/bad_input/.test(m)?"bad_input":"http";throw e}
    return j;
  },
  load:(n,p)=>cloud.rpc("load_progress",{p_site:CFG.SITE||"school",p_name:n,p_pin:p}),
  save:(n,p,s)=>cloud.rpc("save_progress",{p_site:CFG.SITE||"school",p_name:n,p_pin:p,p_state:s})
};

// ---------- локальное состояние и слияние ----------
function takenObj(u){const v=J("kr_taken:"+u,[]);return Array.isArray(v)?{l:v,t:0}:v}
function collect(){
  const u=U(),pre="kr_progress:"+u+":",s={progress:{},taken:takenObj(u)};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(pre))s.progress[k.slice(pre.length)]=J(k,{})}
  return s;
}
function apply(s){
  const u=U();
  Object.entries(s.progress||{}).forEach(([id,P])=>localStorage.setItem("kr_progress:"+u+":"+id,JSON.stringify(P)));
  if(s.taken)localStorage.setItem("kr_taken:"+u,JSON.stringify(s.taken));
}
const newer=(x,y)=>!x?y:!y?x:((y.t||0)>(x.t||0)?y:x);
function mergeState(a,b){
  // незнакомые ключи состояния (например, будущий сюжет) не теряем: берём их из облака как есть
  a=a||{};b=b||{};const out=Object.assign({},b,a,{email:a.email||b.email,progress:{},taken:newer(a.taken,b.taken)||{l:[],t:0}});
  const ids=new Set([...Object.keys(a.progress||{}),...Object.keys(b.progress||{})]);
  ids.forEach(id=>{const pa=(a.progress||{})[id]||{},pb=(b.progress||{})[id]||{},m={};
    new Set([...Object.keys(pa),...Object.keys(pb)]).forEach(k=>{m[k]=newer(pa[k],pb[k])});out.progress[id]=m});
  return out;
}
let timer;
async function doPush(){
  const u=U(),pin=localStorage.getItem("kr_pin");if(!cloud.on||!u||!pin)return;
  try{const remote=await cloud.load(u,pin);const m=mergeState(collect(),remote||{});apply(m);await cloud.save(u,pin,m);setStatus("ok")}
  catch(e){setStatus("off")}
}
async function api(fn,extra){return cloud.rpc(fn,Object.assign({p_name:U(),p_pin:localStorage.getItem("kr_pin")||""},extra||{}))}

// ---------- языки разделов ----------
// У школы два языковых раздела. Ученик «подписан» на язык, если ему назначен хотя бы один материал этого языка;
// преподаватель видит оба. Текущий раздел хранится на устройстве и задаёт оформление, программу и словарь.
const LANGS={ko:{name:"한국어",short:"한",ru:"корейский",tts:"ko-KR"},en:{name:"English",short:"EN",ru:"английский",tts:"en-GB"}};
const SECT_LANG={korean:"ko",quests:"ko",course:"ko",english:"en"};
function langOf(id){
  if(/^(lesson|practice)-/.test(id))return "ko";
  const m=(window.MATERIALS||[]).find(x=>x.id===id);return m?(SECT_LANG[m.section]||null):null;
}
function langsOf(ctx){
  if(ctx.teacher)return["ko","en"];
  const s={};(ctx.items||[]).forEach(i=>{const l=langOf(i.id);if(l)s[l]=1});
  return["ko","en"].filter(l=>s[l]);
}
let lockLang=null,activeTab="";      // lockLang: страница сама задаёт язык оформления (урок)
function applyLang(){
  const el=document.documentElement,l=lockLang||(U()?window.KR.lang():null);
  if(l)el.setAttribute("data-lang",l);else el.removeAttribute("data-lang");
}

async function loadCtx(){
  const u=U();const prev=J("kr_ctx:"+u,null)||{teacher:false,items:[],ok:false};let ctx=prev;
  if(cloud.on&&u){
    try{const t=await api("is_teacher");const items=t?[]:(await api("my_assignments"))||[];
      ctx={teacher:!!t,items,ok:true};
      ctx.langs=window.MATERIALS?langsOf(ctx):(prev.langs||langsOf(ctx));
      localStorage.setItem("kr_ctx:"+u,JSON.stringify(ctx))}
    catch(e){ctx=Object.assign({},prev,{ok:false})}
  }
  window.KR.ctx=ctx;applyLang();
  if(window.KR.assistant)window.KR.assistant.sync();
  return ctx;
}
function finish(n,pin){localStorage.setItem("kr_user",n);localStorage.setItem("kr_pin",pin)}

// ---------- озвучка ----------
// Берём лучший голос, который есть на устройстве: сначала «живые» (Natural, Neural), потом улучшенные системные.
// Ученик может выбрать голос и скорость сам (KR.voices, KR.setVoice, KR.setRate).
// Если в config.js задан TTS_URL, фразы озвучивает облачный голос, а встроенный остаётся запасным.
const V0=/Natural|Online|Neural|SunHi|InJoon|Hyunsu|Sonia|Libby|Ryan|Jenny|Aria/i,V1=/Google|Yuna|Siri|Premium|Enhanced|Improved|Samantha|Daniel|Karen|Serena|Kate/i;
const vRank=v=>V0.test(v.name)?0:V1.test(v.name)?1:2;
const vLang=v=>String(v.lang||"").replace("_","-");
const hasTTS=()=>("speechSynthesis" in window)&&!!window.SpeechSynthesisUtterance;
function voices(lang){
  if(!hasTTS())return[];
  const p=String(lang||"ko").slice(0,2).toLowerCase(),want=(LANGS[p]||{}).tts||lang;
  return speechSynthesis.getVoices().filter(v=>vLang(v).toLowerCase().indexOf(p)===0)
    .sort((a,b)=>vRank(a)-vRank(b)||((vLang(b)===want)-(vLang(a)===want)));
}
function pickVoice(lang){
  const p=String(lang||"ko").slice(0,2),vs=voices(p);
  const saved=LS("kr_voice:"+p)||(p==="ko"?LS("topik_voice"):null);   // topik_voice — выбор из старых тренажёров
  return vs.find(v=>v.name===saved)||vs[0]||null;
}
function rate(){const r=parseFloat(LS("kr_rate"));return r>=.5&&r<=1.2?r:.9}
const ttsCache=new Map();let ttsAudio=null;
async function cloudSay(text,lang,cb){
  const key=lang+"|"+text;let url=ttsCache.get(key);
  if(!url){
    const r=await fetch(CFG.TTS_URL,{method:"POST",headers:{"Content-Type":"application/json",apikey:CFG.SUPABASE_ANON_KEY,Authorization:"Bearer "+CFG.SUPABASE_ANON_KEY},body:JSON.stringify({text:text,lang:lang})});
    if(!r.ok)throw new Error("tts "+r.status);
    url=URL.createObjectURL(await r.blob());if(ttsCache.size>300)ttsCache.clear();ttsCache.set(key,url);
  }
  if(!ttsAudio)ttsAudio=new Audio();
  ttsAudio.pause();ttsAudio.src=url;ttsAudio.playbackRate=Math.max(.75,rate()+.1);
  ttsAudio.onplay=()=>cb.start&&cb.start();ttsAudio.onended=ttsAudio.onerror=()=>cb.end&&cb.end();
  await ttsAudio.play();
}
function localSay(text,lang,cb){
  if(!hasTTS()){cb.end&&cb.end();return}
  try{
    const p=String(lang||"ko").slice(0,2),u=new SpeechSynthesisUtterance(text),v=pickVoice(p);
    if(v){u.voice=v;u.lang=v.lang}else u.lang=(LANGS[p]||{}).tts||lang;
    u.rate=rate();u.onstart=()=>cb.start&&cb.start();u.onend=u.onerror=()=>cb.end&&cb.end();
    speechSynthesis.cancel();speechSynthesis.speak(u);
  }catch(e){cb.end&&cb.end()}
}
function say(text,lang,cb){
  cb=cb||{};text=String(text||"").trim();if(!text)return;
  lang=String(lang||"ko").slice(0,2);
  if(ttsAudio)ttsAudio.pause();
  if(CFG.TTS_URL&&cloud.on){cloudSay(text,lang,cb).catch(()=>localSay(text,lang,cb));return}
  localSay(text,lang,cb);
}
function hush(){try{if(ttsAudio)ttsAudio.pause();if(hasTTS())speechSynthesis.cancel()}catch(e){}}

// ---------- иконки: контурные, одного семейства (вместо эмодзи) ----------
const IC={
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.5-6 8-6s7 1.5 8 6"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  book:'<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  lock:'<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  volume:'<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  arrow:'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  back:'<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  arrowUp:'<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  pause:'<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  play:'<polygon points="6 3 20 12 6 21 6 3"/>',
  pin:'<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  home:'<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  cloud:'<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  pencil:'<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  chat:'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  abc:'<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  speak:'<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
  spark:'<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  star:'<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  sliders:'<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  cards:'<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  send:'<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'
};
function icon(n,s){s=s||20;return '<svg class="ic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(IC[n]||"")+"</svg>"}
// значки разделов в данных уроков заданы эмодзи: показываем их в общем стиле, незнакомые оставляем как есть
const EMO={"💬":"chat","🔤":"abc","📘":"book","✏":"pencil","🗣":"speak","🔁":"repeat","🏠":"home","📌":"pin","📝":"pencil"};
const VS16=String.fromCharCode(65039);   // вариационный селектор, который браузеры добавляют к эмодзи
function emo(e,s){const k=String(e||"").split(VS16).join("");return EMO[k]?icon(EMO[k],s):esc(e)}

// ---------- прогресс: полоса, кольцо, счётчик ----------
function bar(p){return '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+p+'"><div style="width:'+p+'%"></div></div>'}
function ring(p,size,inner){
  p=Math.max(0,Math.min(100,Math.round(p||0)));
  return '<span class="ring" style="--s:'+(size||96)+'px" role="img" aria-label="'+p+'%"><svg viewBox="0 0 36 36"><circle class="ring-bg" cx="18" cy="18" r="15.9155"/>'+
    (p?'<circle class="ring-fg" cx="18" cy="18" r="15.9155" pathLength="100" stroke-dasharray="100" stroke-dashoffset="'+(100-p)+'"/>':"")+
    "</svg><b>"+(inner!=null?inner:p+"<small>%</small>")+"</b></span>";
}
function count(root){
  (root||document).querySelectorAll("[data-count]").forEach(el=>{
    const to=+el.dataset.count||0,suf=el.dataset.suffix||"";
    if(calm()||!to){el.textContent=to+suf;return}
    const t0=performance.now(),d=900;
    (function f(t){const k=Math.min(1,(t-t0)/d);el.textContent=Math.round(to*(1-Math.pow(1-k,3)))+suf;if(k<1)requestAnimationFrame(f)})(t0);
  });
}
function reveal(){
  const els=document.querySelectorAll(".reveal");
  if(!("IntersectionObserver" in window)){els.forEach(e=>e.classList.add("in"));return}
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{rootMargin:"0px 0px -8% 0px"});
  els.forEach(e=>io.observe(e));
}
// значки в статичной разметке: <span data-ic="book" data-s="22"></span>
function icons(root){(root||document).querySelectorAll("[data-ic]").forEach(e=>{if(!e.firstChild)e.innerHTML=icon(e.dataset.ic,+e.dataset.s||20)})}
function onScroll(){const t=document.querySelector(".top");if(t)t.classList.toggle("scrolled",(window.scrollY||0)>8)}
window.addEventListener("scroll",onScroll,{passive:true});

// ---------- шапка, переключатель языка, нижняя панель на телефоне ----------
function langSwitch(){
  const ls=window.KR.langs();if(!U()||ls.length<2)return "";
  const cur=window.KR.lang();
  return '<div class="lang" role="group" aria-label="Язык раздела">'+ls.map(l=>'<button type="button" data-lang-set="'+l+'" lang="'+l+'" aria-pressed="'+(l===cur)+'" title="'+LANGS[l].name+'"><span class="lg-f">'+LANGS[l].name+'</span><span class="lg-s">'+LANGS[l].short+"</span></button>").join("")+"</div>";
}
function tabbar(active){
  let el=document.querySelector(".tabbar");const u=U();
  if(!u){if(el)el.remove();document.body.classList.remove("has-tabs");return}
  if(!el){el=document.createElement("nav");el.className="tabbar";el.setAttribute("aria-label","Разделы");document.body.appendChild(el)}
  const cx=J("kr_ctx:"+u,null)||{};
  const t=(h,ic,tx,k)=>'<a href="'+h+'"'+(active===k?' class="on" aria-current="page"':"")+">"+icon(ic,22)+"<span>"+tx+"</span></a>";
  el.innerHTML=t("course.html","book","Курс","course")+t("words.html","abc","Слова","words")+t("practice.html","repeat","Упражнения","practice")+
    (cx.teacher?t("teacher.html","users","Ученики","teacher"):"")+t("cabinet.html","user","Кабинет","cabinet");
  document.body.classList.add("has-tabs");
}
// падающие звёзды за страницей; на главной и на входе их рисует js/sky.js, там этот слой не нужен
function shooting(){
  if(document.querySelector(".shoot")||document.querySelector("canvas.sky")||calm()||LS("kr_sky")==="off")return;
  const d=document.createElement("div");d.className="shoot";d.setAttribute("aria-hidden","true");
  d.innerHTML='<i style="--x:72%;--y:6%;--d:9s;--w:1.5s"></i><i style="--x:36%;--y:13%;--d:13s;--w:5s"></i><i style="--x:96%;--y:30%;--d:17s;--w:9s"></i>';
  document.body.appendChild(d);
}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-lang-set]");if(b)window.KR.setLang(b.getAttribute("data-lang-set"))});
// пока ученик печатает ответ, нижняя панель не должна вставать над клавиатурой
const typing=e=>{const t=e.target;return t&&(t.tagName==="TEXTAREA"||(t.tagName==="INPUT"&&!/^(checkbox|radio|range|button|submit)$/.test(t.type)))};
document.addEventListener("focusin",e=>{if(typing(e))document.body.classList.add("typing")});
document.addEventListener("focusout",e=>{if(typing(e))document.body.classList.remove("typing")});

window.KR={
  user:U,
  users:()=>J("kr_users",{}),
  cloud,
  status:()=>{try{return sessionStorage.getItem("kr_cloud")||""}catch(e){return ""}},
  require(){if(!U()){location.href="auth.html";return false}return true},
  progress(id){const u=U(),L=(window.LESSONS||{})[id];if(!L)return{n:0,tot:0,pct:0,P:{}};
    const P=J("kr_progress:"+u+":"+id,{});let tot=0,n=0;
    L.sections.forEach(s=>s.blocks.forEach((b,i)=>{tot++;const p=P[s.id+"-"+i];if(p&&p.done)n++}));
    return{n,tot,pct:tot?Math.round(n/tot*100):0,P}},
  taken:()=>takenObj(U()).l||[],
  setTaken(a){localStorage.setItem("kr_taken:"+U(),JSON.stringify({l:a,t:Date.now()}));KR.push()},
  push(){clearTimeout(timer);timer=setTimeout(doPush,600)},
  async login(name,pin){
    const n=name.trim().toLowerCase(),local=KR.users()[n];
    if(cloud.on){
      try{const s=await cloud.load(n,pin);
        if(s===null){if(local&&local.pin===pin){finish(n,pin);setStatus("off");doPush();return{ok:1,offline:1}}return{err:"none"}}
        finish(n,pin);apply(mergeState(collect(),s));setStatus("ok");KR.push();return{ok:1}}
      catch(e){if(e.code==="wrong_pin")return{err:"pin"}}
    }
    if(local&&local.pin===pin){finish(n,pin);setStatus("off");return{ok:1,offline:1}}
    return{err:local?"pin":"none"};
  },
  // регистрация: режим задаёт преподаватель (closed | code | open), см. supabase/registration.sql
  async signupInfo(){
    if(!cloud.on)return{mode:"closed"};
    try{const r=await cloud.rpc("signup_info",{});return r&&r.mode?r:{mode:"closed"}}catch(e){return{mode:"closed"}}
  },
  async register(login,email,pin,code){
    const n=String(login||"").trim().toLowerCase();
    try{await cloud.rpc("register_student",{p_login:n,p_email:String(email||"").trim(),p_new_pin:pin,p_code:String(code||"").trim()})}
    catch(e){const m=String(e.message||"");return{err:(/exists|bad_code|signup_closed|too_many|bad_input/.exec(m)||["net"])[0]}}
    return KR.login(n,pin);
  },
  api,
  load:loadCtx,
  ctx:{teacher:false,items:[],ok:false},
  can(id){const x=window.KR.ctx;return !!(x&&(x.teacher||(x.items||[]).some(i=>i.id===id)))},
  assignedInfo(id){return ((window.KR.ctx||{}).items||[]).find(i=>i.id===id)},
  logout(){const u=U();localStorage.removeItem("kr_user");localStorage.removeItem("kr_pin");localStorage.removeItem("kr_ctx:"+u)},

  // языки разделов
  LANGS,langOf,
  langs(){const c=window.KR.ctx,x=(c&&c.langs)||((U()&&J("kr_ctx:"+U(),null))||{}).langs;return x&&x.length?x:["ko","en"]},
  lang(){const ls=KR.langs(),l=LS("kr_lang:"+U());return ls.indexOf(l)>=0?l:ls[0]},
  setLang(l){
    if(!LANGS[l]||l===KR.lang())return;
    LS("kr_lang:"+U(),l);hush();applyLang();KR.topbar(activeTab);
    if(typeof KR.onLang==="function")KR.onLang(l);
  },
  onLang:null,                                   // страница ставит сюда свою перерисовку
  theme(l){lockLang=l||null;applyLang()},        // урок закрепляет оформление своего языка

  // озвучка
  say,hush,voices,pickVoice,canSay:hasTTS,
  rate,setRate(r){LS("kr_rate",String(r))},
  setVoice(lang,name){LS("kr_voice:"+String(lang).slice(0,2),name||null)},

  topbar(active){
    activeTab=active;applyLang();
    const el=document.getElementById("topbar");if(!el)return;const u=U();
    const a=(h,t,k)=>'<a href="'+h+'"'+(active===k?' class="on" aria-current="page"':"")+">"+t+"</a>";
    const cx=(u&&J("kr_ctx:"+u,null))||{};const tl=cx.teacher?a("teacher.html","Ученики","teacher"):"";
    el.innerHTML='<div class="top '+(u?"user":"guest")+'"><a class="logo" href="index.html" aria-label="MIRAÉ, на главную">MIRAÉ<span>THE INDIGO LANGUAGE ACADEMY</span></a>'+
      '<nav aria-label="Разделы сайта">'+a("course.html","Курс","course")+a("words.html","Слова","words")+a("practice.html",'<span class="xs-hide">Доп.&nbsp;</span>упражнения',"practice")+tl+"</nav>"+
      '<div class="top-r">'+langSwitch()+
      '<a href="'+(u?"cabinet.html":"auth.html")+'" class="acc glass frost'+(active==="cabinet"?" on":"")+'" aria-label="'+(u?"Личный кабинет: "+esc(u):"Войти")+'"'+(active==="cabinet"?' aria-current="page"':"")+">"+icon("user",20)+'<span class="cap">'+(u?esc(u):"Войти")+"</span></a></div></div>";
    tabbar(active);shooting();onScroll();
  },
  esc,icon,icons,emo,bar,ring,count,reveal,calm
};
if(hasTTS())try{speechSynthesis.getVoices()}catch(e){}   // голоса подгружаются не сразу: просим список заранее
icons();
})();
