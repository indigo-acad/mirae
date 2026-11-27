/* MIRAÉ · общий каркас сайта (window.KR).
   Разделы файла: облако (Supabase RPC) → состояние и синхронизация → вход и регистрация →
   языки разделов → озвучка → интерфейс (иконки, шапка, прогресс). Страницы подключают этот файл и вызывают KR.* */
(function(){
const CFG=window.CONFIG||{};
const U=()=>localStorage.getItem("kr_user");
const J=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||"");return v==null?d:v}catch(e){return d}};
const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}return null};
/* Тема оформления: «ночь» (по умолчанию) или «день». Выбор хранится на устройстве (kr_theme) и ставится
   атрибутом <html data-theme="day">, все дневные правила — в конце css/style.css. */
const theme=()=>LS("kr_theme")==="day"?"day":"night";
function applyTheme(){
  const t=theme(),el=document.documentElement;
  if(t==="day")el.setAttribute("data-theme","day");else el.removeAttribute("data-theme");
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="day"?"#F7F0E3":"#0B1535");
}
applyTheme();
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
// Материалы из папки materials/ пишут сюда через js/bridge.js: mat — открытия и время, rep — отчёты «Отправить учителю».
function matObj(u){const v=J("kr_mat:"+u,{});return{mat:v.mat||{},rep:Array.isArray(v.rep)?v.rep:[]}}
function collect(){
  const u=U(),pre="kr_progress:"+u+":",m=matObj(u),s={progress:{},taken:takenObj(u),mat:m.mat,rep:m.rep,wl:J("kr_wlog:"+u,{})};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(pre))s.progress[k.slice(pre.length)]=J(k,{})}
  return s;
}
function apply(s){
  const u=U();
  Object.entries(s.progress||{}).forEach(([id,P])=>localStorage.setItem("kr_progress:"+u+":"+id,JSON.stringify(P)));
  if(s.taken)localStorage.setItem("kr_taken:"+u,JSON.stringify(s.taken));
  if(s.mat||s.rep)localStorage.setItem("kr_mat:"+u,JSON.stringify({mat:s.mat||{},rep:s.rep||[]}));
  if(s.wl)localStorage.setItem("kr_wlog:"+u,JSON.stringify(s.wl));
}
// журнал слов по дням (js/vocab.js): с двух устройств за один день берём большие счётчики, храним 60 дней
function mergeWl(a,b){
  a=a||{};b=b||{};const out={};
  Object.keys(a).concat(Object.keys(b)).forEach(d=>{const x=a[d]||{},y=b[d]||{};out[d]={n:Math.max(x.n||0,y.n||0),r:Math.max(x.r||0,y.r||0),ok:Math.max(x.ok||0,y.ok||0),t:Math.max(x.t||0,y.t||0)}});
  Object.keys(out).sort().slice(0,-60).forEach(d=>{delete out[d]});
  return out;
}
// те же правила, что в js/bridge.js: счётчики берут большее, отчёты объединяются без повторов (новые сверху, до 40)
function mergeMat(a,b){
  a=a||{};b=b||{};const out={};
  Object.keys(a).concat(Object.keys(b)).forEach(id=>{const x=a[id]||{},y=b[id]||{};
    out[id]={o:Math.max(x.o||0,y.o||0),s:Math.max(x.s||0,y.s||0),l:Math.max(x.l||0,y.l||0),f:Math.min(x.f||Infinity,y.f||Infinity)};
    if(out[id].f===Infinity)out[id].f=out[id].l});
  return out;
}
function mergeRep(a,b){
  const seen={},out=[];
  (a||[]).concat(b||[]).forEach(r=>{if(!r||!r.id)return;const k=seen[r.id];
    if(k===undefined){seen[r.id]=out.length;out.push(r)}
    else if(r.u||out[k].u){if((r.u||0)>(out[k].u||0))out[k]=r}   // живой отчёт урока: берём более свежий
    else if((r.x||"").length>(out[k].x||"").length)out[k]=r});
  out.sort((x,y)=>(y.t||0)-(x.t||0));
  let total=0;return out.filter((r,i)=>{total+=(r.x||"").length;return i<40&&total<90000});
}
const newer=(x,y)=>!x?y:!y?x:((y.t||0)>(x.t||0)?y:x);
function mergeState(a,b){
  // незнакомые ключи состояния (например, будущий сюжет) не теряем: берём их из облака как есть
  a=a||{};b=b||{};const out=Object.assign({},b,a,{email:a.email||b.email,progress:{},taken:newer(a.taken,b.taken)||{l:[],t:0},mat:mergeMat(a.mat,b.mat),rep:mergeRep(a.rep,b.rep),wl:mergeWl(a.wl,b.wl)});
  const ids=new Set([...Object.keys(a.progress||{}),...Object.keys(b.progress||{})]);
  ids.forEach(id=>{const pa=(a.progress||{})[id]||{},pb=(b.progress||{})[id]||{},m={};
    new Set([...Object.keys(pa),...Object.keys(pb)]).forEach(k=>{m[k]=newer(pa[k],pb[k])});out.progress[id]=m});
  return out;
}
let timer;
/* Без интернета сайт работает из кэша (sw.js), прогресс копится на устройстве; когда связь вернулась — досылаем. */
if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost"))window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").catch(()=>{});
  // при первом открытии страница загрузилась ещё без кэша: передаём её файлы, чтобы они тоже сохранились
  navigator.serviceWorker.ready.then(r=>{if(r.active)r.active.postMessage({cache:[location.href].concat(performance.getEntriesByType("resource").map(e=>e.name))})}).catch(()=>{})});
window.addEventListener("online",()=>{if(window.KR){KR.push();if(KR.vocab&&KR.vocab.sync)KR.vocab.sync()}});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&navigator.onLine&&window.KR)KR.push()});
async function doPush(){
  const u=U(),pin=localStorage.getItem("kr_pin");if(!cloud.on||!u||!pin)return;
  try{const remote=await cloud.load(u,pin);const m=mergeState(collect(),remote||{});apply(m);await cloud.save(u,pin,m);setStatus("ok")}
  catch(e){setStatus("off")}
}
async function api(fn,extra){return cloud.rpc(fn,Object.assign({p_name:U(),p_pin:localStorage.getItem("kr_pin")||""},extra||{}))}

// ---------- языки разделов ----------
// Каждый язык — отдельная «школа» со своим оформлением, программой и словарём. Ученик видит только те языки,
// курсы которых ему открыл преподаватель (назначен хотя бы один материал языка); если открыт один язык, переключателя нет.
// Преподаватель видит все языки школы. Текущий раздел хранится на устройстве. Чтобы добавить язык, допишите его в LANGS,
// в SECT_LANG (разделы материалов) и в css/style.css (цвет и рисунки блока «языковые разделы»).
const LANGS={
  ko:{name:"한국어",short:"한",ru:"корейский",tts:"ko-KR",wm:"한국어",tag:"корейский"},
  en:{name:"English",short:"EN",ru:"английский",tts:"en-GB",wm:"English",tag:"английский"},
  ja:{name:"日本語",short:"日",ru:"японский",tts:"ja-JP",wm:"日本語",tag:"японский"},
  zh:{name:"中文",short:"中",ru:"китайский",tts:"zh-CN",wm:"中文",tag:"китайский"}
};
const ORDER=["ko","en","ja","zh"];
const SECT_LANG={korean:"ko",quests:"ko",course:"ko",english:"en",japanese:"ja",chinese:"zh"};
// язык материала: сначала по каталогу (data/materials.js), а на страницах без каталога — по началу идентификатора
const ID_LANG={en:"en",ko:"ko",qu:"ko",ja:"ja",zh:"zh"};
function langOf(id){
  id=String(id||"");
  if(/^(lesson|practice)-/.test(id))return "ko";
  const m=(window.MATERIALS||[]).find(x=>x.id===id);
  if(m)return SECT_LANG[m.section]||null;
  return ID_LANG[id.split("-")[0]]||null;
}
// языки, на которых у школы уже есть материалы: корейский и английский всегда, остальные — когда появятся их разделы
function avail(){
  const s={ko:1,en:1};(window.MATERIALS||[]).forEach(m=>{const l=SECT_LANG[m.section];if(l)s[l]=1});
  return ORDER.filter(l=>s[l]);
}
function langsOf(ctx){
  if(ctx.teacher)return avail();
  const s={};(ctx.items||[]).forEach(i=>{const l=langOf(i.id);if(l)s[l]=1});
  return ORDER.filter(l=>s[l]);
}
let lockLang=null,activeTab="";      // lockLang: страница сама задаёт язык оформления (урок)
// Нарядный шрифт для надписи «한국어» в шапке и на главной. Загружаем только три нужных знака (несколько килобайт).
let koFontOn=false;
function koFont(){
  if(koFontOn)return;koFontOn=true;
  const l=document.createElement("link");l.rel="stylesheet";
  l.href="https://fonts.googleapis.com/css2?family=Song+Myung&text="+encodeURIComponent("한국어")+"&display=swap";
  document.head.appendChild(l);
}
// язык, в котором сейчас показана страница: язык урока или выбранный раздел; null — у ученика пока нет открытых курсов
function curLang(){return lockLang||(U()&&window.KR.hasLang()?window.KR.lang():null)}
function applyLang(){
  const el=document.documentElement,l=curLang();
  if(l)el.setAttribute("data-lang",l);else el.removeAttribute("data-lang");
  if(l==="ko")koFont();
}

async function loadCtx(){
  const u=U();const prev=J("kr_ctx:"+u,null)||{teacher:false,items:[],ok:false};let ctx=prev;
  if(cloud.on&&u){
    try{
      // роль: owner, teacher, pending (заявка ждёт подтверждения) или student. my_role появляется с supabase/teachers.sql;
      // пока его нет, действует прежняя схема: единственный преподаватель — он же владелец школы
      let role=null;try{role=await api("my_role")}catch(e){if(e.code==="wrong_pin")throw e;role=null}
      const t=role?(role==="owner"||role==="teacher"):!!(await api("is_teacher"));
      const items=t?[]:(await api("my_assignments"))||[];
      ctx={teacher:t,owner:role?role==="owner":t,pending:role==="pending",role:role||(t?"owner":"student"),items,ok:true};
      ctx.langs=langsOf(ctx);
      // преподавателю на странице без каталога оставляем прежний список языков: он мог быть шире
      if(t&&!window.MATERIALS&&Array.isArray(prev.langs)&&prev.langs.length>ctx.langs.length)ctx.langs=prev.langs;
      localStorage.setItem("kr_ctx:"+u,JSON.stringify(ctx))}
    catch(e){ctx=Object.assign({},prev,{ok:false})}
  }
  window.KR.ctx=ctx;applyLang();
  window.KR.topbar(activeTab);          // роль и открытые языки могли измениться: шапка зависит от них
  if(window.KR.assistant)window.KR.assistant.sync();
  return ctx;
}
function finish(n,pin){localStorage.setItem("kr_user",n);localStorage.setItem("kr_pin",pin)}

// ---------- озвучка ----------
// Берём лучший голос, который есть на устройстве: сначала «живые» (Natural, Neural), потом улучшенные системные.
// Ученик может выбрать голос и скорость сам (KR.voices, KR.setVoice, KR.setRate).
// Если в config.js задан TTS_URL, фразы вошедшего ученика озвучивает облачный нейроголос (supabase/functions/tts),
// а голос устройства остаётся запасным: если облако не ответило, 10 минут говорим голосом устройства.
// Для английского ученик выбирает британский или американский вариант (KR.setAccent).
const V0=/Natural|Online|Neural|SunHi|InJoon|Hyunsu|Sonia|Libby|Ryan|Jenny|Aria/i,V1=/Google|Yuna|Siri|Premium|Enhanced|Improved|Samantha|Daniel|Karen|Serena|Kate/i;
const vRank=v=>V0.test(v.name)?0:V1.test(v.name)?1:2;
const vLang=v=>String(v.lang||"").replace("_","-");
const hasTTS=()=>("speechSynthesis" in window)&&!!window.SpeechSynthesisUtterance;
function voices(lang,ac){
  if(!hasTTS())return[];
  const p=String(lang||"ko").slice(0,2).toLowerCase(),chosen=p==="en"&&!!(ac||LS("kr_accent"));
  const want=p==="en"?((ac||accent())==="us"?"en-US":"en-GB"):(LANGS[p]||{}).tts||lang;
  const loc=(a,b)=>(vLang(b)===want)-(vLang(a)===want);
  // выбранное произношение важнее качества голоса: британский ученик не должен слышать американский голос
  return speechSynthesis.getVoices().filter(v=>vLang(v).toLowerCase().indexOf(p)===0)
    .sort((a,b)=>chosen?(loc(a,b)||vRank(a)-vRank(b)):(vRank(a)-vRank(b)||loc(a,b)));
}
// ac — произношение для одного слова ("gb" или "us"), например в карточке слова; без него — выбранное учеником
function pickVoice(lang,ac){
  const p=String(lang||"ko").slice(0,2),vs=voices(p,ac);
  const saved=LS("kr_voice:"+p)||(p==="ko"?LS("topik_voice"):null);   // topik_voice — выбор из старых тренажёров
  const want=ac==="us"?"en-US":"en-GB",mine=vs.find(v=>v.name===saved);
  return (ac&&p==="en"?(mine&&vLang(mine)===want?mine:vs[0]):(mine||vs[0]))||null;
}
function rate(){const r=parseFloat(LS("kr_rate"));return r>=.5&&r<=1.2?r:.9}
function accent(){return LS("kr_accent")==="us"?"us":"gb"}
// ttsOff — до какого времени не просить облачный голос (ошибка функции). Хранится до конца сеанса браузера,
// чтобы каждая страница не повторяла заведомо неудачный запрос: 503 — ключи голосов ещё не добавлены в Supabase.
const ttsCache=new Map();let ttsAudio=null,ttsOff=0;
// 503 — голоса в облаке не настроены: помним 20 минут на устройстве (localStorage); ключ kr_tts_off2 новый, старые записи на 6 часов не действуют, иначе каждая новая вкладка
// сначала ждёт облако, и голос устройства включается уже не по нажатию — iPhone и часть Android такой звук не пропускают.
try{localStorage.removeItem("kr_tts_off");ttsOff=Math.max(+sessionStorage.getItem("kr_tts_off")||0,+localStorage.getItem("kr_tts_off2")||0)}catch(e){}
// облачный голос: задан адрес, есть связь с базой и ученик вошёл (функция проверяет логин и PIN)
const cloudVoice=()=>!!(CFG.TTS_URL&&cloud.on&&U()&&localStorage.getItem("kr_pin")&&Date.now()>ttsOff);
async function cloudSay(text,lang,cb,acc){
  const ac=lang==="en"?(acc||accent()):"",key=lang+"|"+ac+"|"+text;let url=ttsCache.get(key);
  if(!url){
    let r;
    try{r=await fetch(CFG.TTS_URL,{method:"POST",headers:{"Content-Type":"application/json",apikey:CFG.SUPABASE_ANON_KEY,Authorization:"Bearer "+CFG.SUPABASE_ANON_KEY},
      body:JSON.stringify({text:text,lang:lang,accent:ac||undefined,p_name:U(),p_pin:localStorage.getItem("kr_pin")||""})})}
    catch(e){ttsOff=Date.now()+600000;throw e}   // нет связи с функцией: 10 минут говорит голос устройства
    if(!r.ok){ttsOff=Date.now()+(r.status===503?20*60000:600000);try{sessionStorage.setItem("kr_tts_off",String(ttsOff));if(r.status===503)localStorage.setItem("kr_tts_off2",String(ttsOff))}catch(e){}throw new Error("tts "+r.status)}
    url=URL.createObjectURL(await r.blob());if(ttsCache.size>300)ttsCache.clear();ttsCache.set(key,url);
  }
  if(!ttsAudio)ttsAudio=new Audio();
  ttsAudio.pause();ttsAudio.src=url;ttsAudio.playbackRate=cb.rate?Math.max(.5,cb.rate):Math.max(.75,rate()+.1);   // cb.rate — медленнее для тренировки на слух
  ttsAudio.onplay=()=>cb.start&&cb.start();ttsAudio.onended=ttsAudio.onerror=()=>cb.end&&cb.end();
  await ttsAudio.play();
}
// alt — повтор с другим голосом: облачные голоса устройства («Online», «Natural») иногда молча падают,
// если звук просят сразу после предыдущего (подкаст, озвучка подряд)
function localSay(text,lang,cb,acc,alt){
  if(!hasTTS()){cb.end&&cb.end();return}
  try{
    const p=String(lang||"ko").slice(0,2),u=new SpeechSynthesisUtterance(text);
    const v=alt?(voices(p,acc).find(x=>x!==alt&&x.localService)||voices(p,acc).find(x=>x!==alt)||null):pickVoice(p,acc);
    if(v){u.voice=v;u.lang=v.lang}else u.lang=(LANGS[p]||{}).tts||lang;
    let started=false;
    u.rate=cb.rate||rate();u.onstart=()=>{started=true;cb.start&&cb.start()};u.onend=()=>cb.end&&cb.end();
    u.onerror=e=>{const er=e&&e.error||"";
      if(!started&&!alt&&er!=="interrupted"&&er!=="canceled"){setTimeout(()=>localSay(text,lang,cb,acc,v||true),250);return}
      cb.end&&cb.end()};
    if(speechSynthesis.speaking||speechSynthesis.pending)speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }catch(e){cb.end&&cb.end()}
}
async function recSay(url,cb){
  if(hasTTS())speechSynthesis.cancel();
  if(!ttsAudio)ttsAudio=new Audio();
  ttsAudio.pause();ttsAudio.src=url;ttsAudio.playbackRate=cb.rate?Math.max(.5,cb.rate):1;
  ttsAudio.onplay=()=>cb.start&&cb.start();ttsAudio.onended=()=>cb.end&&cb.end();ttsAudio.onerror=null;
  await new Promise((ok,bad)=>{ttsAudio.onerror=()=>bad(new Error("rec"));ttsAudio.play().then(ok,bad)});
}
// lang: "ko", "en" или "en-gb" / "en-us" — английское слово с нужным произношением
function say(text,lang,cb){
  cb=cb||{};text=String(text||"").trim();if(!text)return;
  const m=String(lang||"ko").toLowerCase().match(/^([a-z]{2})(?:-(gb|us))?/)||[0,"ko"],acc=m[1]==="en"?m[2]||"":"";
  lang=m[1];
  if(ttsAudio)ttsAudio.pause();
  // запись произношения из словаря (js/dict.js): живой голос диктора для отдельного слова; не загрузилась — синтез
  const rec=typeof window.KR.rec==="function"?window.KR.rec(text,lang,acc||accent()):"";
  if(rec){recSay(rec,cb).catch(()=>{if(cloudVoice()&&(lang==="ko"||lang==="en"))cloudSay(text,lang,cb,acc).catch(()=>localSay(text,lang,cb,acc));else localSay(text,lang,cb,acc)});return}
  if(cloudVoice()&&(lang==="ko"||lang==="en")){cloudSay(text,lang,cb,acc).catch(()=>localSay(text,lang,cb,acc));return}
  localSay(text,lang,cb,acc);
}
function hush(){try{if(ttsAudio)ttsAudio.pause();if(hasTTS())speechSynthesis.cancel()}catch(e){}}
/* Разблокировка речи при первом касании — только iPhone и iPad: Safari пропускает речь, только если она впервые
   запущена прямо по нажатию; после этого озвучка работает и тогда, когда начинается чуть позже (подкаст, после проверки).
   На Android и компьютере не нужна: там беззвучная «пустая» фраза у части голосов слышна как шипение. */
const IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
let unlocked=!IOS;
function unlockAudio(){
  if(unlocked)return;unlocked=true;
  try{if(hasTTS()&&!speechSynthesis.speaking){const u=new SpeechSynthesisUtterance(" ");u.volume=0;speechSynthesis.speak(u)}}catch(e){}
}
["pointerdown","touchend","keydown"].forEach(ev=>document.addEventListener(ev,unlockAudio,{capture:true,passive:true}));

// ---------- иконки: контурные, одного семейства (вместо эмодзи) ----------
const IC={
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.5-6 8-6s7 1.5 8 6"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  book:'<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  lock:'<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  volume:'<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><path d="M12 18v4"/>',
  headphones:'<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
  skip:'<path d="m5 4 10 8-10 8z"/><path d="M19 5v14"/>',
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
  target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  star:'<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  sliders:'<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  cards:'<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  send:'<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'
};
/* Часть урока, к которой относится раздел: theory — объяснения, слова, примеры; practice — упражнения с проверкой
   и задания «поговорить»; hw — «Домашнее задание» из данных урока: в самом уроке не показывается и в прогресс не входит,
   домашку задаёт преподаватель (такой раздел он может выбрать в «Задать домашку»). Раздел может указать часть сам: part. */
const PRACTICE_T=["fill","choice","build","talk"];
function part(s){return s.part||(s.id==="hw"?"hw":s.blocks&&s.blocks.length&&s.blocks.every(b=>PRACTICE_T.indexOf(b.type)>=0)?"practice":"theory")}
/* Слова урока (блоки «Слова») с примером из диалогов и примеров того же урока: {w,t,ex,et,f} — f — форма слова
   в примере. У корейских глаголов пример ищется по основе без «다». Для тестов по словам (test.html, панель преподавателя). */
function lessonWords(L){
  const lang=L.lang||"ko",lines=[],out=[];
  const stem=w=>{w=String(w).normalize("NFC").trim().replace(/\s+/g," ").toLowerCase();return lang==="ko"&&w.length>1&&w.slice(-1)==="다"?w.slice(0,-1):w};
  const strip=t=>t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,"");
  L.sections.forEach(s=>s.blocks.forEach(b=>{
    if(b.type==="dialogue")b.lines.forEach(x=>lines.push([x[1],x[2]]));
    if(b.type==="examples")b.items.forEach(x=>lines.push([x[0],x[1]]));
  }));
  L.sections.forEach(s=>s.blocks.forEach(b=>{if(b.type!=="words")return;
    b.items.forEach(x=>{const st=stem(x[0]),it={w:x[0],t:x[1]};
      for(const l of lines){const tok=l[0].split(/\s+/).map(strip).find(t=>st.length>1?t.toLowerCase().indexOf(st)===0:t===st);if(tok){it.ex=l[0];it.et=l[1];it.f=tok;break}}
      if(!out.some(o=>o.w===it.w))out.push(it)})}));
  return out;
}
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
// анимации шапки (js/topbar-fx.js + GSAP) подгружаются отдельно, чтобы не трогать каждую страницу
const FX_BASE=(document.currentScript&&document.currentScript.src||"").replace(/common\.js.*$/,"");
function topfx(){
  if(window.KR_topfx)return window.KR_topfx();
  if(document.getElementById("topfx-js"))return;
  const s=document.createElement("script");s.id="topfx-js";s.src=FX_BASE+"topbar-fx.js";document.head.appendChild(s);
}

// ---------- шапка, переключатель языка, нижняя панель на телефоне ----------
// переключатель показываем, только если преподаватель открыл ученику курсы минимум на двух языках
function langSwitch(){
  const ls=window.KR.langs();if(!U()||ls.length<2)return "";
  const cur=curLang()||window.KR.lang();
  return '<div class="lang" role="group" aria-label="Язык раздела">'+ls.map(l=>'<button type="button" data-lang-set="'+l+'" lang="'+l+'" aria-pressed="'+(l===cur)+'" title="'+LANGS[l].name+'"><span class="lg-f">'+LANGS[l].name+'</span><span class="lg-s">'+LANGS[l].short+"</span></button>").join("")+"</div>";
}
function tabbar(active){
  let el=document.querySelector(".tabbar");const u=U();
  if(!u){if(el)el.remove();document.body.classList.remove("has-tabs");rail(active);return}
  if(!el){el=document.createElement("nav");el.className="tabbar";el.setAttribute("aria-label","Разделы");document.body.appendChild(el)}
  const cx=J("kr_ctx:"+u,null)||{};
  const t=(h,ic,tx,k)=>'<a href="'+h+'"'+(active===k?' class="on" aria-current="page"':"")+">"+icon(ic,22)+"<span>"+tx+"</span></a>";
  el.innerHTML=t("course.html","book","Курс","course")+t("words.html","abc","Слова","words")+t("practice.html","repeat","Упражнения","practice")+
    (stories()?t("story.html","chat","Истории","story"):"")+(cx.teacher?t("teacher.html","users","Ученики","teacher"):"")+t("cabinet.html","user","Кабинет","cabinet");
  el.classList.toggle("six",el.children.length>5);
  document.body.classList.add("has-tabs");
  rail(active);
}
// «Истории» — сюжетные диалоги на корейском: в меню, если открыт корейский раздел (у преподавателя — всегда)
function stories(){const c=window.KR&&window.KR.ctx,x=(c&&c.langs)||(J("kr_ctx:"+U(),null)||{}).langs||[];return !!(c&&c.teacher)||(J("kr_ctx:"+U(),null)||{}).teacher||x.indexOf("ko")>=0}
/* Боковая полоса разделов на компьютере (шире 900px): разделы переезжают из шапки в узкую полосу слева,
   в шапке остаются логотип, тема, язык и кабинет. На телефоне — нижняя панель (tabbar). */
function rail(active){
  let el=document.querySelector(".rail");const u=U();
  if(!u){if(el)el.remove();document.body.classList.remove("has-rail");return}
  if(!el){el=document.createElement("nav");el.className="rail";el.setAttribute("aria-label","Разделы сайта");document.body.appendChild(el)}
  const cx=J("kr_ctx:"+u,null)||{};
  const r=(h,ic,tx,k)=>'<a href="'+h+'" data-tip="'+tx+'" aria-label="'+tx+'"'+(active===k?' class="on" aria-current="page"':"")+">"+icon(ic,22)+"</a>";
  el.innerHTML='<a class="rail-logo" href="index.html" aria-label="MIRAÉ, на главную" data-tip="Главная"><i class="emb" aria-hidden="true"></i></a>'+
    r("index.html","home","Главная","home")+r("course.html","book","Курс","course")+r("words.html","abc","Слова","words")+r("practice.html","repeat","Упражнения","practice")+
    (stories()?r("story.html","chat","Истории","story"):"")+
    (cx.teacher?'<i class="rail-sep" aria-hidden="true"></i>'+r("teacher.html","users","Ученики","teacher")+r("library.html","cards","Библиотека","library"):"")+
    '<i class="rail-sep" aria-hidden="true"></i>'+r("cabinet.html","user","Кабинет","cabinet");
  document.body.classList.add("has-rail");
}
// падающие звёзды за страницей; на главной и на входе их рисует js/sky.js, там этот слой не нужен
function shooting(){
  const off=theme()==="day"||calm()||LS("kr_sky")==="off";
  const ex=document.querySelector(".shoot");if(off){if(ex)ex.remove();return}
  if(ex||document.querySelector("canvas.sky"))return;
  const d=document.createElement("div");d.className="shoot";d.setAttribute("aria-hidden","true");
  d.innerHTML='<i style="--x:72%;--y:6%;--d:9s;--w:1.5s"></i><i style="--x:36%;--y:13%;--d:13s;--w:5s"></i><i style="--x:96%;--y:30%;--d:17s;--w:9s"></i>';
  document.body.appendChild(d);
}

/* Дневной фон — пара к ночному небу: закатное небо в WebGL (как Млечный Путь ночью, только днём).
   Пара полупрозрачных разводов заката медленно переливаются (коралл, роза, золото, лаванда), по небу иногда
   проходит мягкий перелив света, мерцают блики и редкие золотые искорки; поверх падают лепестки.
   Включается только днём; «уменьшение движения» и кнопка паузы фона (kr_sky) останавливают движение —
   остаётся один неподвижный кадр. Без WebGL остаётся тёплый градиент из CSS. */
const DAY_FS=[
"precision mediump float;",
"uniform vec2 uR;uniform float uT;",
"float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
"float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
"  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}",
"float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*noise(p);p=p*2.03+vec2(17.3,9.1);a*=.5;}return s;}",
"vec3 sunset(float x){x=fract(x)*4.;",                // коралл → роза → золото → лаванда → коралл
"  vec3 c0=vec3(.94,.55,.48),c1=vec3(.92,.57,.68),c2=vec3(.98,.74,.46),c3=vec3(.66,.64,.88);",
"  return x<1.?mix(c0,c1,x):x<2.?mix(c1,c2,x-1.):x<3.?mix(c2,c3,x-2.):mix(c3,c0,x-3.);}",
"float bokeh(vec2 q,float sc,float th){",            // блики: мягкие круглые пятна света, медленно мерцают
"  vec2 g=q*sc,id=floor(g),f=fract(g)-.5;float h=hash(id);if(h<th)return 0.;",
"  vec2 o=(vec2(hash(id+7.1),hash(id+13.7))-.5)*.5;float r=length(f-o),sz=mix(.05,.13,hash(id+3.3));",
"  float tw=.5+.5*sin(uT*(.25+.5*hash(id+5.5))+h*40.);",
"  return smoothstep(sz,sz*.35,r)*tw*tw;}",
"float spark(vec2 q,float sc){",                       // редкие искорки: точка и четыре тонких луча
"  vec2 g=q*sc,id=floor(g),f=fract(g)-.5;float h=hash(id+2.2);if(h<.93)return 0.;",
"  vec2 d=f-(vec2(hash(id+4.1),hash(id+8.3))-.5)*.5;float r=length(d);",
"  float tw=max(0.,sin(uT*(.4+.9*hash(id+1.9))+h*60.));tw=tw*tw*tw;",
"  float ray=exp(-abs(d.x)*120.)*exp(-abs(d.y)*10.)+exp(-abs(d.y)*120.)*exp(-abs(d.x)*10.);",
"  return (smoothstep(.05,0.,r)+exp(-r*26.)*.5+ray*.7)*tw;}",
"void main(){",
"  vec2 uv=gl_FragCoord.xy/uR,p=(gl_FragCoord.xy-.5*uR)/uR.y;float t=uT;",
"  vec3 col=mix(vec3(.975,.945,.905),vec3(.985,.900,.840),smoothstep(.1,1.,uv.y));",   // тёплый кремовый фон, к верху персиковый
"  vec2 sp=vec2(.5*uR.x/uR.y+.05,.62);",                                                  // солнце за правым верхним углом
"  float sd=length(p-sp);col=mix(col,vec3(1.,.90,.76),exp(-sd*2.4)*.4);col+=vec3(1.,.82,.6)*exp(-sd*7.)*.12;",
"  float w1=.035*sin(p.x*2.3+t*.05),w2=.04*sin(p.x*1.7-t*.04+2.);",
"  float b1=exp(-pow((p.y-.18+p.x*.30+w1)*4.6,2.)),b2=exp(-pow((p.y+.28+p.x*.16+w2)*5.6,2.));",   // две полосы заката по диагонали
"  float n=fbm(vec2((p.x+p.y*.5)*1.7+t*.012,(p.y-p.x*.3)*4.2-t*.007)+1.6*fbm(p*1.25+vec2(t*.006,-t*.004)));",
"  float n2=fbm(vec2((p.x+p.y*.6)*3.2+t*.015,(p.y-p.x*.35)*10.)+n*1.3);float fil=pow(1.-abs(2.*n2-1.),7.);",   // тонкие волокна, как в Млечном Пути
"  float str=smoothstep(.38,.8,n)*.7+fil*.32;",                                          // разводы внутри полос
"  vec3 c1=sunset(t*.012+p.x*.18+n*.5),c2=sunset(t*.012+.45+p.x*.14-n*.4);",            // цвет медленно переливается
"  col=mix(col,c1,clamp(b1*(.14+.42*str),0.,.55));col=mix(col,c2,clamp(b2*(.10+.34*str),0.,.45));",
"  float sweep=mod(t*.035,3.4)-1.2,sh=exp(-pow((p.x*.9+p.y*.5-sweep*1.4)*2.6,2.));",    // мягкий перелив света проходит по небу
"  col+=vec3(1.,.95,.88)*sh*(b1+b2*.7)*.10;",
"  vec2 dr=vec2(t*.004,t*.006);",
"  float bk=bokeh(p+dr,8.,.88)*.6+bokeh(p*1.4+dr*1.6+3.,11.,.92)*.45;",
"  col+=vec3(1.,.93,.82)*bk*(.10+.18*(b1+b2));",
"  float sk=spark(p+dr*.5,9.)+spark(p*1.3+vec2(5.,t*.003),12.)*.7;",
"  col+=vec3(1.,.86,.6)*sk*(.25+.75*max(b1,b2))*.55;",
"  col+=(hash(gl_FragCoord.xy+fract(t)*61.)-.5)/200.;",
"  gl_FragColor=vec4(col,1.);",
"}"].join("\n");
function daySky(cv){
  let gl=null;try{gl=cv.getContext("webgl",{antialias:false,alpha:false,powerPreference:"low-power"})}catch(e){}
  if(!gl)return null;
  const sh=(ty,src)=>{const x=gl.createShader(ty);gl.shaderSource(x,src);gl.compileShader(x);return gl.getShaderParameter(x,gl.COMPILE_STATUS)?x:null};
  const v=sh(gl.VERTEX_SHADER,"attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}"),f=sh(gl.FRAGMENT_SHADER,DAY_FS);if(!v||!f)return null;
  const pr=gl.createProgram();gl.attachShader(pr,v);gl.attachShader(pr,f);gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return null;
  gl.useProgram(pr);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const a=gl.getAttribLocation(pr,"a");gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  const uR=gl.getUniformLocation(pr,"uR"),uT=gl.getUniformLocation(pr,"uT");
  let t=40+(Date.now()/1000%600),last=0,raf=0,still=false;
  function size(){const w=innerWidth,h=innerHeight,s=Math.min(.75,Math.sqrt(700000/(w*h)));   // мягкая картинка: хватает пониженного разрешения
    const W=Math.max(1,Math.round(w*s)),H=Math.max(1,Math.round(h*s));if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;gl.viewport(0,0,W,H)}}
  function draw(){gl.uniform2f(uR,cv.width,cv.height);gl.uniform1f(uT,t);gl.drawArrays(gl.TRIANGLES,0,3);cv.classList.add("on")}
  const live=()=>!still&&!document.hidden&&cv.isConnected&&theme()==="day";
  function frame(now){raf=0;if(!live())return;if(now-last>=33){t+=Math.min(.1,(now-last)/1000);last=now;draw()}raf=requestAnimationFrame(frame)}   // ~30 кадров в секунду
  function kick(){if(!raf&&live()){last=performance.now();raf=requestAnimationFrame(frame)}}
  addEventListener("resize",()=>{size();draw()});document.addEventListener("visibilitychange",kick);
  size();draw();
  return {set(st){still=st;draw();kick()}};
}
function dayfx(){
  let d=document.querySelector(".dayfx");
  if(theme()!=="day"){if(d)d.remove();return}
  const still=calm()||LS("kr_sky")==="off";
  if(d){d.classList.toggle("still",still);if(d._sky)d._sky.set(still);return}
  d=document.createElement("div");d.className="dayfx"+(still?" still":"");d.setAttribute("aria-hidden","true");
  let h='<canvas></canvas>';
  for(let i=0;i<12;i++){const L=(i*37+11)%96+2,dur=18+(i*7)%12,dl=-((i*5)%26),dx=[-120,-70,60,110][i%4];
    h+='<span class="pt" style="left:'+L+'%;animation-duration:'+dur+'s;animation-delay:'+dl+'s;--dx:'+dx+'px"><i style="animation-delay:'+(-(i%3))+'s"></i></span>'}
  d.innerHTML=h;document.body.appendChild(d);
  d._sky=daySky(d.querySelector("canvas"));if(d._sky)d._sky.set(still);
}
function setTheme(t){
  LS("kr_theme",t==="day"?"day":null);applyTheme();shooting();dayfx();
  document.querySelectorAll("[data-theme-set]").forEach(b=>b.setAttribute("aria-pressed",String(b.getAttribute("data-theme-set")===theme())));
  try{document.dispatchEvent(new CustomEvent("kr-theme",{detail:theme()}))}catch(e){}
}
function themeSwitch(){
  const t=theme();
  return '<div class="theme-t" role="group" aria-label="Тема оформления"><button type="button" data-theme-set="day" aria-pressed="'+(t==="day")+'" aria-label="Дневная тема" title="День">'+icon("sun",17)+'</button><button type="button" data-theme-set="night" aria-pressed="'+(t!=="day")+'" aria-label="Ночная тема" title="Ночь">'+icon("moon",16)+"</button></div>";
}
// нажатие на уже выбранную тему переключает на другую: на телефоне видна только одна кнопка
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-theme-set]");if(!b)return;const t=b.getAttribute("data-theme-set");setTheme(b.getAttribute("aria-pressed")==="true"?(t==="day"?"night":"day"):t)});
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-lang-set]");if(b)window.KR.setLang(b.getAttribute("data-lang-set"))});
// пока ученик печатает ответ, нижняя панель не должна вставать над клавиатурой
const typing=e=>{const t=e.target;return t&&(t.tagName==="TEXTAREA"||(t.tagName==="INPUT"&&!/^(checkbox|radio|range|button|submit)$/.test(t.type)))};
// Панель возвращается чуть позже, чем поле теряет фокус: иначе при нажатии на кнопку под полем («Проверить»)
// она появляется прямо под пальцем, и нажатие достаётся ей, а не кнопке.
let typingOff=0;
document.addEventListener("focusin",e=>{if(typing(e)){clearTimeout(typingOff);document.body.classList.add("typing")}});
document.addEventListener("focusout",e=>{if(typing(e)){clearTimeout(typingOff);typingOff=setTimeout(()=>document.body.classList.remove("typing"),400)}});

/* Пометка «в России может не работать»: распознавание речи в Chrome и Edge идёт через серверы Google и Microsoft,
   из России оно бывает недоступно. Видят ученики с часовым поясом России и всегда — преподаватели (чтобы знали). */
const RU_TZ=/^(Europe\/(Moscow|Kaliningrad|Samara|Volgograd|Kirov|Astrakhan|Saratov|Ulyanovsk|Simferopol)|Asia\/(Yekaterinburg|Omsk|Novosibirsk|Barnaul|Tomsk|Novokuznetsk|Krasnoyarsk|Irkutsk|Chita|Yakutsk|Khandyga|Vladivostok|Ust-Nera|Magadan|Sakhalin|Srednekolymsk|Kamchatka|Anadyr))$/;
function inRu(){try{return RU_TZ.test(Intl.DateTimeFormat().resolvedOptions().timeZone||"")}catch(e){return false}}
const RUN_T={mic:"Распознавание речи в Chrome и Edge работает через серверы Google и Microsoft — из России оно может быть недоступно. Если микрофон не отвечает, ответь текстом: на оценку это не влияет."};
function ruNote(k){const t=window.KR&&window.KR.ctx&&window.KR.ctx.teacher;if(!inRu()&&!t)return "";
  return '<p class="ru-note">'+icon("alert",14)+(t&&!inRu()?"Для учеников из России: ":"")+esc(RUN_T[k]||k)+'</p>'}
window.KR={
  user:U,
  inRu,ruNote,
  users:()=>J("kr_users",{}),
  cloud,
  status:()=>{try{return sessionStorage.getItem("kr_cloud")||""}catch(e){return ""}},
  require(){if(!U()){location.href="auth.html";return false}return true},
  progress(id){const u=U(),L=(window.LESSONS||{})[id];if(!L)return{n:0,tot:0,pct:0,P:{}};
    const P=J("kr_progress:"+u+":"+id,{});let tot=0,n=0;
    L.sections.forEach(s=>{if(part(s)==="hw")return;s.blocks.forEach((b,i)=>{tot++;const p=P[s.id+"-"+i];if(p&&p.done)n++})});
    return{n,tot,pct:tot?Math.round(n/tot*100):0,P}},
  part,lessonWords,
  /* Домашка от преподавателя (supabase/homework.sql): заданная и недавно сданная. null — на сервере ещё нет этих функций. */
  async homework(){try{const r=await api("my_homework");
      // язык домашки запоминаем: ученику без открытых курсов словарь показываем на этом языке, а не по умолчанию
      if(Array.isArray(r)&&U()){const c={};r.forEach(x=>{if(LANGS[x.lang])c[x.lang]=(c[x.lang]||0)+1});const t=Object.keys(c).sort((a,b)=>c[b]-c[a])[0];if(t)LS("kr_hwlang:"+U(),t)}
      return Array.isArray(r)?r:[]}
    catch(e){return e&&(e.status===404||/Could not find the function/.test(e.message||""))?null:[]}},
  taken:()=>takenObj(U()).l||[],
  // что известно о материале из папки materials/: открытия и время (act) и последний отчёт преподавателю (rep)
  matInfo(id){const m=matObj(U());return{act:m.mat[id]||null,rep:m.rep.filter(r=>r.m===id).sort((a,b)=>(b.t||0)-(a.t||0))[0]||null}},
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
  // teacher: true — владелец школы задал код преподавателя, и можно подать заявку (supabase/teachers.sql)
  async signupInfo(){
    if(!cloud.on)return{mode:"closed"};
    try{const r=await cloud.rpc("signup_info",{});return r&&r.mode?r:{mode:"closed"}}catch(e){return{mode:"closed"}}
  },
  async register(login,email,pin,code,teacher){
    const n=String(login||"").trim().toLowerCase();
    try{await cloud.rpc(teacher?"register_teacher":"register_student",{p_login:n,p_email:String(email||"").trim(),p_new_pin:pin,p_code:String(code||"").trim()})}
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
  LANGS,langOf,koFont,
  // языки, курсы которых открыл преподаватель этому ученику (преподавателю — все языки школы); у гостя пусто
  langs(){if(!U())return[];const c=window.KR.ctx,x=(c&&c.langs)||(J("kr_ctx:"+U(),null)||{}).langs;return Array.isArray(x)?x.filter(l=>LANGS[l]):[]},
  hasLang(){return KR.langs().length>0},
  // текущий раздел; пока ничего не открыто, возвращает "ko", чтобы страницы не падали (оформление при этом нейтральное)
  lang(){const ls=KR.langs(),l=LS("kr_lang:"+U());if(ls.indexOf(l)>=0)return l;if(ls[0])return ls[0];const h=LS("kr_hwlang:"+U());if(LANGS[h])return h;
    // нет ни курсов, ни домашки: язык, на котором больше всего слов в словаре ученика (слова от преподавателя)
    try{const w=(JSON.parse(localStorage.getItem("kr_vocab:"+U())||"{}").w)||{},c={};Object.keys(w).forEach(k=>{const l=k.split(":")[0];if(LANGS[l])c[l]=(c[l]||0)+1});
      const t=Object.keys(c).sort((a,b)=>c[b]-c[a])[0];if(t)return t}catch(e){}
    return "ko"},
  // карточка для ученика, которому ещё не открыли ни одного курса
  noCoursesCard(){
    if((window.KR.ctx||{}).pending)return '<div class="card glass nocourse"><h3>'+icon("users",20)+'Заявка преподавателя отправлена</h3><p class="muted">Владелец школы подтвердит её, и здесь откроется панель преподавателя. Обычно это занимает не больше дня.</p></div>';
    return '<div class="card glass nocourse"><h3>'+icon("lock",20)+'Курсы пока не открыты</h3><p class="muted">Доступ открывает преподаватель. Когда тебе назначат уроки и материалы, здесь появится страница твоего языка: курс, слова и упражнения.</p></div>';
  },
  // у вошедшего ученика курсы не открыты (учитываем, что роль уже загружена)
  noCourses(){const c=window.KR.ctx||{};return !!U()&&!c.teacher&&!!c.ok&&!KR.hasLang()},
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
  accent,setAccent(a){LS("kr_accent",a==="us"?"us":"gb");LS("kr_voice:en",null);ttsCache.clear()},cloudVoice,
  ttsCloud:()=>!!(CFG.TTS_URL&&cloud.on&&U()),
  setVoice(lang,name){LS("kr_voice:"+String(lang).slice(0,2),name||null)},

  // Шапка бывает трёх видов:
  //  гость — общая шапка школы языков (языки, как учим, как начать, «Войти»);
  //  вошёл, и преподаватель открыл курсы — шапка школы своего языка: эмблема и название языка, курс, слова, упражнения;
  //  вошёл, но курсов пока нет — общая шапка школы с кнопкой кабинета.
  topbar(active){
    activeTab=active;applyLang();
    const el=document.getElementById("topbar");if(!el)return;const u=U();
    const a=(h,t,k)=>'<a href="'+h+'"'+(active===k?' class="on" aria-current="page"':"")+">"+t+"</a>";
    const acc='<a href="'+(u?"cabinet.html":"auth.html")+'" class="acc glass frost'+(u?"":" enter")+(active==="cabinet"?" on":"")+'" aria-label="'+(u?"Личный кабинет: "+esc(u):"Войти в личный кабинет")+'"'+(active==="cabinet"?' aria-current="page"':"")+">"+icon("user",20)+'<span class="cap">'+(u?esc(u):"Войти")+"</span></a>";
    const logo='<a class="logo" href="index.html" aria-label="MIRAÉ, школа языков, на главную">MIRAÉ<span>Школа языков</span></a>';
    let h;
    if(!u){
      h='<div class="top guest">'+logo+'<nav aria-label="Разделы сайта">'+a("index.html#langs","Языки","")+a("index.html#how","Как учим","")+a("index.html#start","Как начать","")+"</nav>"+
        '<div class="top-r">'+themeSwitch()+acc+"</div></div>";
    }else{
      const l=curLang(),cx=J("kr_ctx:"+u,null)||{},tl=cx.teacher?a("teacher.html","Ученики","teacher")+a("library.html","Библиотека","library"):"";
      if(l){
        const L=LANGS[l];
        h='<div class="top user school"><a class="logo brand" href="index.html" aria-label="MIRAÉ, школа: '+L.tag+', на главную"><i class="emb" aria-hidden="true"></i>'+
          '<span class="wm"><b lang="'+l+'">'+L.wm+'</b><small>MIRAÉ · '+L.tag+'</small></span></a>'+
          '<nav aria-label="Разделы сайта">'+a("course.html",icon("book",17)+"Курс","course")+a("words.html",icon("cards",17)+"Слова","words")+a("practice.html",icon("pencil",17)+'<span class="xs-hide">Доп.&nbsp;</span>упражнения',"practice")+(cx.teacher?a("teacher.html",icon("users",17)+"Ученики","teacher")+a("library.html",icon("cards",17)+"Библиотека","library"):"")+"</nav>"+
          '<div class="top-r">'+themeSwitch()+langSwitch()+acc+"</div></div>";
      }else{
        h='<div class="top user">'+logo+"<nav aria-label=\"Разделы сайта\">"+a("words.html",icon("cards",17)+"Слова","words")+a("practice.html",icon("pencil",17)+'<span class="xs-hide">Доп.&nbsp;</span>упражнения',"practice")+tl+"</nav><div class=\"top-r\">"+themeSwitch()+acc+"</div></div>";
      }
    }
    el.innerHTML=h;
    tabbar(active);shooting();dayfx();onScroll();topfx();
  },
  esc,icon,icons,emo,bar,ring,count,reveal,calm,
  theme,setTheme,fx(){shooting();dayfx()}
};
if(hasTTS())try{speechSynthesis.getVoices()}catch(e){}   // голоса подгружаются не сразу: просим список заранее
icons();
})();
