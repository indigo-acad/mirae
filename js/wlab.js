/* MIRAÉ · «Практика» на странице «Слова»: отдельный блок, где ученик сам собирает занятие.
   Сначала выбор: язык (если учит несколько), направление (слово → значение, значение → слово, в обе стороны) и язык значения,
   какие слова (на сегодня, трудные, добавленные за неделю, на неделю, учу сейчас, выученные, все, словари преподавателя), сколько.
   Потом вид занятия:
   - по словам, без сети: упражнения (тренировка по выбору, SRS.train), тест (test.html, самостоятельно), подкаст из слов,
     диктант предложений с переводом (примеры слов; ошибка в диктанте сдвигает слово, KR.vocab.practice);
   - с генерацией (функция supabase/functions/gen, адрес CONFIG.GEN_URL): 듣기 / Listening (лекция, подкаст, диалог, новости),
     읽기 / Reading (рассказ, статья, письмо, чат, объявление, блог, новости), задания в формате экзаменов
     (TOPIK I и II — для корейского; IELTS, TOEFL, ЕГЭ, ОГЭ — для английского), лёгкое письмо (쓰기 / Writing) с чек-листом,
     автопроверкой, подсказками и «Отправить преподавателю», перевод предложений с русского с проверкой.
   Всё сгенерированное — по уровню ученика (KR.mean.level: «Настройки» → уровень) и с выбранными словами.
   Блок живёт во вкладке «Упражнения» (practice.html, раздел «Практика»). Упражнения, тест и подкаст по словам
   открывают «Слова» (words.html?lab=train | pod): там этот же файл берёт сохранённый выбор (kr_lab) и сразу запускает занятие.
   На странице «Слова» файл ничего не рисует, а пользуется её функциями (start, podStart, exOf …). */
(function(){
"use strict";
var KR=window.KR,V=KR&&KR.vocab;if(!V)return;var esc=KR.esc,ic=KR.icon,M=KR.mean,DAY=SRS.DAY;
var W=window,ONW=typeof W.start==="function"&&typeof W.podStart==="function";   // мы на странице «Слова»
/* то же, что в words.html, — для страницы «Упражнения» */
var INF=function(){if(W.INFO)return W.INFO;try{return (JSON.parse(localStorage.getItem("kr_winfo:"+KR.user())||"null")||{}).i||{}}catch(e){return {}}};
var SETS=function(){if(W.WSETS)return W.WSETS;try{return (JSON.parse(localStorage.getItem("kr_winfo:"+KR.user())||"null")||{}).s||[]}catch(e){return []}};
var setById=function(id){return SETS().filter(function(s){return String(s.id)===String(id)})[0]||null};
var trRu=W.trRu||function(c){var i=INF()[c.id];return c.t||(i&&i.tr_ru&&i.tr_ru[0])||((c.d||[])[0]||{}).s||""};
var exOf=W.exOf||function(c){if(c.ex)return {s:c.ex,t:c.et||""};var e=((INF()[c.id]||{}).examples||[])[0];return e&&e.s?{s:e.s,t:e.t||""}:null};
var addW=W.addW||function(l,w,t,x){return V.add(l,w,t,x||{})};
var gls=W.gls||function(l){var s=V.settings(),g=(s.gls||{})[l];if(g&&g.length)return g;var m=(s.ctxm||{})[l]||"ru";return m==="ctx"?["ctx"]:m==="mix"?["ru","ctx"]:["ru"]};
var $=function(s){return document.querySelector(s)};
var GEN=(window.CONFIG||{}).GEN_URL||((window.CONFIG||{}).SUPABASE_URL?window.CONFIG.SUPABASE_URL+"/functions/v1/gen":"");
var KEY=function(){return "kr_lab:"+(KR.user()||"")};
var L=load(),RUN=null;   // RUN — открытое занятие из сгенерированных (или диктант)

function load(){var d={l:"",dir:"both",gl:[],sc:["today"],n:20,lf:"podcast",ll:"s",rf:"story",rl:"s",ex:"",sec:"",ws:"s",base:{},topic:""};
  try{var x=JSON.parse(localStorage.getItem("kr_lab:"+(KR.user()||""))||"null");if(x)Object.keys(d).forEach(function(k){if(x[k]!==undefined)d[k]=x[k]})}catch(e){}return d}
function save(){try{localStorage.setItem(KEY(),JSON.stringify(L))}catch(e){}}

/* ---------- язык, слова, уровень ---------- */
function langs(){if(typeof W.wlangs==="function")return W.wlangs();var s={};KR.langs().forEach(function(l){s[l]=1});V.all().forEach(function(c){if(KR.LANGS[c.l])s[c.l]=1});return Object.keys(KR.LANGS).filter(function(l){return s[l]})}
function LG(){var a=langs();if(L.l&&a.indexOf(L.l)>=0)return L.l;var k=KR.lang();return a.indexOf(k)>=0?k:a[0]||"ko"}
var SC={today:"На сегодня",hard:"Трудные",d7:"Добавлены за неделю",week:"Повторение на неделю",learn:"Учу сейчас",known:"Выученные",fresh:"Новые",all:"Все слова"};
function inSc(c,k,now){
  if(k.indexOf("set:")===0){var s=setById(k.slice(4));return !!(s&&(s.cards||[]).indexOf(c.id)>=0)}
  var st=c.st||0;
  if(k==="d7")return (c.a||0)>=now-7*DAY;
  if(k==="learn")return st===1||st===3;
  if(k==="known")return st===2;
  if(k==="fresh")return !st;
  if(k==="all")return true;
  return SRS.inScope(c,k,now);
}
function scopes(){var a=Object.keys(SC);SETS().filter(function(s){return s.lang===LG()}).forEach(function(s){a.push("set:"+s.id)});return a}
function scName(k){if(k.indexOf("set:")===0){var s=setById(k.slice(4));return s?"Словарь: "+s.title:"Словарь"}return SC[k]}
function words(all){
  var now=Date.now(),l=LG(),sc=L.sc.filter(function(k){return scopes().indexOf(k)>=0});if(!sc.length)sc=["all"];
  var out=V.all(l).filter(function(c){return sc.some(function(k){return inSc(c,k,now)})});
  out.sort(function(a,b){return (SRS.isDue(b,now)?1:0)-(SRS.isDue(a,now)?1:0)||(b.lap||0)+(b.pe||0)-(a.lap||0)-(a.pe||0)||Math.random()-.5});
  return all?out:out.slice(0,L.n||20);
}
function level(){return M.level(LG())}
/* язык переводов и подсказок: русский или другой изучаемый язык (корейский через английский, английский через корейский) */
var BN={ru:"Русский",en:"English",ko:"한국어"},BNI={ru:"русский",en:"английский",ko:"корейский"};
function BASE(){var b=(L.base||{})[LG()];return b&&b!==LG()&&BN[b]?b:"ru"}
function bases(){return ["ru"].concat(["en","ko"].filter(function(x){return x!==LG()}))}
function glossB(c){var b=BASE();if(b==="ru")return trRu(c);if(W.glossOf){var g=W.glossOf(c,b);if(g)return g}
  var d=(c.d||[]).filter(function(x){return x.l===b})[0];if(d)return d.s;var a=(INF()[c.id]||{})["tr_"+b];return (Array.isArray(a)?a[0]:a)||trRu(c)}
/* журнал «Практики» для итога недели: что делали и с каким результатом */
function logLab(k,sc,max,t){var key="kr_labstat:"+KR.user(),a=[];try{a=JSON.parse(localStorage.getItem(key)||"[]")||[]}catch(e){}
  a.unshift({t:Date.now(),k:k,s:sc,m:max,x:t||""});a=a.filter(function(x){return x.t>Date.now()-60*DAY}).slice(0,300);try{localStorage.setItem(key,JSON.stringify(a))}catch(e){}}
function labLog(){try{return JSON.parse(localStorage.getItem("kr_labstat:"+KR.user())||"[]")||[]}catch(e){return []}}
function wl(list){return list.slice(0,30).map(function(c){return {w:c.w,t:glossB(c)}})}

/* ---------- генерация ---------- */
async function gen(kind,opts,list){
  if(!GEN)throw new Error("Генерация не настроена: нет адреса функции.");
  if(!KR.user())throw new Error("Войдите на сайт, чтобы создавать задания.");
  var r;try{r=await fetch(GEN,{method:"POST",headers:{"Content-Type":"application/json",apikey:CONFIG.SUPABASE_ANON_KEY,Authorization:"Bearer "+CONFIG.SUPABASE_ANON_KEY},
    body:JSON.stringify({p_name:KR.user(),p_pin:localStorage.getItem("kr_pin")||"",kind:kind,lang:LG(),base:BASE(),level:level(),words:list?wl(list):[],opts:opts||{}})})}catch(e){throw new Error("Нет связи с сервером заданий. Проверь интернет и попробуй ещё раз.")}
  var j=await r.json().catch(function(){return {}});
  if(!r.ok||!j.ok)throw new Error(j.message||("Функция генерации не ответила ("+r.status+")."));
  return j.data||{};
}

/* ---------- отправка преподавателю: отчёт в записи ученика (как «Отправить учителю» у материалов) + Telegram ---------- */
async function toTeacher(title,text){
  var x=("📝 "+title+"\n"+text).slice(0,8000),ok=false;
  try{var st=await KR.api("load_progress",{p_site:"school"});
    if(st){var rep=[{id:"words-lab-"+Date.now(),m:"Слова · Практика",t:Date.now(),x:x}].concat(st.rep||[]).slice(0,40);
      await KR.api("save_progress",{p_site:"school",p_state:Object.assign({},st,{rep:rep})});ok=true}}catch(e){}
  try{var c=window.CONFIG||{};if(c.TG_TOKEN&&c.TG_CHAT_ID){var b=new URLSearchParams({chat_id:c.TG_CHAT_ID,text:("Ученик: "+KR.user()+"\n"+x).slice(0,3900)});
    var r=await fetch("https://api.telegram.org/bot"+c.TG_TOKEN+"/sendMessage",{method:"POST",body:b});if(r.ok)ok=true}}catch(e){}
  return ok;
}
function canSend(){return !!KR.user()&&!(KR.ctx&&KR.ctx.teacher)}

/* ---------- меню ---------- */
function chip(attr,val,txt,on){return '<button type="button" '+attr+'="'+esc(val)+'" aria-pressed="'+!!on+'" class="'+(on?"sel":"")+'">'+(on?"✓ ":"")+txt+'</button>'}
function tile(k,icon,t,sub,dis){return '<button type="button" class="lab-t" data-lab="'+k+'"'+(dis?" disabled":"")+'>'+ic(icon,22)+'<b>'+t+'</b><small class="muted">'+sub+'</small></button>'}
var EXAMS={ko:[["topik1","TOPIK I",[["listen","듣기"],["read","읽기"]]],["topik2","TOPIK II",[["listen","듣기"],["read","읽기"],["write","쓰기"]]]],
  en:[["ielts","IELTS",[["listen","Listening"],["read","Reading"],["write","Writing"]]],["toefl","TOEFL",[["listen","Listening"],["read","Reading"],["write","Writing"]]],
    ["ege","ЕГЭ",[["listen","Аудирование"],["read","Чтение"],["gram","Грамматика и лексика"],["write","Письмо"]]],["oge","ОГЭ",[["listen","Аудирование"],["read","Чтение"],["gram","Грамматика и лексика"],["write","Письмо"]]]]};
var LF={lecture:"Лекция",podcast:"Подкаст",dialog:"Диалог",news:"Новости"},RF={story:"Рассказ",article:"Статья",letter:"Письмо",dialog:"Переписка",notice:"Объявление",blog:"Блог",news:"Новости"},LN={s:"Коротко",m:"Средне",l:"Длинно"};
function glOpts(l){return ["ru"].concat(["ko","en"].filter(function(x){return x!==l}),["ctx"])}
function gname2(g){return g==="ru"?"Русский":g==="ctx"?"В контексте":(KR.LANGS[g]||{}).name||g}
function curGl(){var l=LG(),g=(L.gl||[]).filter(function(x){return glOpts(l).indexOf(x)>=0});return g.length?g:BASE()!=="ru"?[BASE()]:gls(l)}
function exList(){return EXAMS[LG()]||[]}
function curEx(){var a=exList(),e=a.filter(function(x){return x[0]===L.ex})[0]||a[0];return e}

function draw(){
  var box=$("#lab");if(!box)return;
  if(!V.all().length){box.innerHTML='<div class="tb-h"><h3 id="lab-h">'+ic("sliders",20)+'Практика</h3></div><p class="muted">В словаре пока нет слов. Добавь их на странице <a href="words.html">«Слова»</a> — и здесь можно будет собрать занятие: упражнения, тест, тексты на слух и для чтения, задания как на экзамене, письмо.</p>';return}
  if(RUN)return drawRun();
  var l=LG(),ls=langs(),all=words(true),pick=all.slice(0,L.n||20),studied=pick.filter(function(c){return c.st}).length,lv=level(),ex=curEx();
  var wk=weekStats();
  var h='<div class="tb-h"><h3 id="lab-h">'+ic("sliders",20)+'Практика</h3></div>'+
    '<button type="button" class="lab-week" data-lab="week">'+ic("cal",18)+'<span><b>Итог недели</b><small class="muted">'+wk.days+' '+plural(wk.days,"день","дня","дней")+' занятий · '+wk.ans+' ответов'+(wk.ans?' · '+wk.acc+'% верно':'')+'</small></span>'+ic("arrow",16)+'</button>'+'<p class="muted tb-sub">Собери занятие сам: язык, направление, слова — и что делать. Тексты и задания подстраиваются под уровень: <b>'+esc(lv)+'</b> · <button type="button" class="linkish" data-x="cx-cfg">сменить</button></p>';
  if(ls.length>1)h+='<div class="lab-row"><span class="lab-k">Язык</span><div class="opts">'+ls.map(function(x){return chip("data-ll",x,esc(KR.LANGS[x].name),x===l)}).join("")+'</div></div>';
  h+='<div class="lab-row"><span class="lab-k">Перевод и подсказки</span><div class="opts">'+bases().map(function(b){return chip("data-lb",b,BN[b],BASE()===b)}).join("")+'</div><span class="muted">'+(BASE()==="ru"?"":esc(KR.LANGS[LG()].name)+" через "+BNI[BASE()])+'</span></div>';
  h+='<div class="lab-row"><span class="lab-k">Направление</span><div class="opts">'+chip("data-ld","fw","Слово → значение",L.dir==="fw")+chip("data-ld","bw","Значение → слово",L.dir==="bw")+chip("data-ld","both","В обе стороны",L.dir==="both")+'</div></div>';
  h+='<div class="lab-row"><span class="lab-k">Значение</span><div class="opts">'+glOpts(l).map(function(g){return chip("data-lg",g,gname2(g),curGl().indexOf(g)>=0)}).join("")+'</div></div>';
  h+='<div class="lab-row"><span class="lab-k">Слова</span><div class="opts">'+scopes().map(function(k){var n=V.all(l).filter(function(c){return inSc(c,k,Date.now())}).length;return chip("data-ls",k,esc(scName(k))+" · "+n,L.sc.indexOf(k)>=0)}).join("")+'</div></div>';
  h+='<div class="lab-row"><span class="lab-k">Сколько</span><div class="opts">'+[10,20,30,50].map(function(n){return chip("data-ln",n,String(n),L.n===n)}).join("")+'</div><span class="muted">выбрано: '+pick.length+(all.length>pick.length?" из "+all.length:"")+'</span></div>';
  if(pick.length)h+='<div class="tb-prev">'+pick.slice(0,10).map(function(c){return '<span class="chip"><b'+(c.l==="ko"?' class="ko"':"")+' lang="'+c.l+'">'+esc(c.w)+'</b></span>'}).join("")+(pick.length>10?'<span class="chip">ещё '+(pick.length-10)+'</span>':"")+'</div>';
  h+='<h4 class="lab-h4">По словам</h4><div class="lab-grid">'+
    tile("train","repeat","Упражнения","игры по выбранным словам"+(pick.length>studied?" · новые слова — в «Учить» или «Тренировать»":""),!studied)+
    tile("test","pencil","Тест","проверь себя, ответы сдвигают повторение",pick.length<4)+
    (KR.canSay()?tile("pod","play","Подкаст из слов","слово, пауза, перевод",!pick.length):"")+
    tile("dict","headphones","Диктант предложений","послушай, запиши и переведи",!pick.length)+'</div>';
  h+='<h4 class="lab-h4">Тексты и задания '+ic("spark",15)+'</h4><p class="muted tb-sub">Создаются под твой уровень и с выбранными словами. Нужен вход на сайт и связь.</p><div class="lab-grid">'+
    tile("listen","headphones",l==="ko"?"듣기 · Аудирование":"Listening","лекция, подкаст, диалог или новости + вопросы")+
    tile("read","book",l==="ko"?"읽기 · Чтение":"Reading","рассказ, статья, письмо… + вопросы и словарик")+
    (ex?tile("exam","target","Как на экзамене",exList().map(function(e){return e[1]}).join(", ")):"")+
    tile("write","pencil",l==="ko"?"쓰기 · Письмо":"Writing","лёгкое задание, чек-лист, подсказки, проверка")+
    tile("talk","speak","Разговор","диалог с собеседником голосом или текстом, цели и оценка")+
    tile("trans","chat","Перевод: "+BNI[BASE()]+" → "+(LG()==="ko"?"корейский":"английский"),"переведи предложения, проверка по смыслу")+'</div>';
  // настройки сгенерированных: формат и длина
  h+='<details class="lab-more"><summary>Формат текстов и экзамена</summary>'+
    '<div class="lab-row"><span class="lab-k">Аудио</span><div class="opts">'+Object.keys(LF).map(function(k){return chip("data-lf",k,LF[k],L.lf===k)}).join("")+'</div></div>'+
    '<div class="lab-row"><span class="lab-k">Чтение</span><div class="opts">'+Object.keys(RF).map(function(k){return chip("data-rf",k,RF[k],L.rf===k)}).join("")+'</div></div>'+
    '<div class="lab-row"><span class="lab-k">Тема</span><input class="name lab-topic" data-ltopic placeholder="своя тема разговора и текстов (необязательно)" value="'+esc(L.topic||"")+'"></div>'+
    '<div class="lab-row"><span class="lab-k">Длина</span><div class="opts">'+Object.keys(LN).map(function(k){return chip("data-lz",k,LN[k],L.ll===k)}).join("")+'</div></div>'+
    (ex?'<div class="lab-row"><span class="lab-k">Экзамен</span><div class="opts">'+exList().map(function(e){return chip("data-le",e[0],e[1],e===ex)}).join("")+'</div></div>'+
      '<div class="lab-row"><span class="lab-k">Раздел</span><div class="opts">'+ex[2].map(function(s){return chip("data-lc",s[0],s[1],(L.sec||ex[2][0][0])===s[0])}).join("")+'</div></div>':"")+
    '</details>';
  box.innerHTML=h;
}

/* ---------- запуск ---------- */
function testSpec(list){
  var k=L.dir==="fw"?["tr","tf","mch"].concat(KR.canSay()?["aud"]:[]):L.dir==="bw"?["rev","wr","fl","bld","ctx"]:["tr","rev","ctx","wr"];
  return {title:"Практика · "+KR.LANGS[LG()].name,sub:L.sc.map(scName).join(", "),lang:LG(),kinds:k,n:Math.min(15,list.length),back:"words.html",backT:"слова",
    words:list.map(function(c){var e=exOf(c)||{};return {w:c.w,t:glossB(c),l:c.l,ex:e.s||"",et:BASE()==="ru"?e.t||"":"",f:c.f}})};
}
function go(k){
  var list=words(),l=LG();
  if(!ONW&&(k==="train"||k==="pod")){location.href="words.html?lab="+k;return}
  if(k==="train"){var ids=list.filter(function(c){return c.st}).map(function(c){return c.id});if(!ids.length)return;
    if(typeof stopListen==="function")stopListen();return start("free",false,ids,{dir:L.dir,gl:curGl()})}
  if(k==="test"){var ts=testSpec(list);ts.back=ONW?"words.html":"practice.html#lab";ts.backT=ONW?"слова":"упражнения";
    try{Object.keys(localStorage).forEach(function(x){if(/^kr_wtest:lab/.test(x))localStorage.removeItem(x)});localStorage.setItem("kr_wtest:lab",JSON.stringify(ts))}catch(e){}
    location.href="test.html?mode=self&id=lab";return}
  if(k==="pod")return podStart(list.map(function(c){return c.id}),"практика");
  if(k==="dict")return dictStart(list);
  if(k==="week"){RUN={k:"week",w:{}};return drawRun()}
  RUN={k:k,busy:true,list:list,w:{}};drawRun();
  var o=k==="listen"?{format:L.lf,len:L.ll}:k==="read"?{format:L.rf,len:L.ll}:k==="exam"?{exam:curEx()[0],section:L.sec||curEx()[2][0][0],n:4}:k==="write"?{size:L.ws}:k==="trans"?{n:6}:k==="talk"?{topic:L.topic||""}:{};
  if(L.topic&&(k==="listen"||k==="read"))o.topic=L.topic;
  gen(k==="trans"?"sent":k,o,list).then(function(d){if(!RUN||RUN.k!==k)return;RUN.busy=false;RUN.d=d;RUN.ans={};
    if(k==="talk"){RUN.h=d.first?[{r:"P",s:d.first.s,t:d.first.t}]:[];RUN.reached=[];drawRun();if(d.first)KR.say(d.first.s,LG());return}drawRun()},
    function(e){if(!RUN||RUN.k!==k)return;RUN.busy=false;RUN.err=e.message;drawRun()});
}
function back(){KR.hush();RUN=null;draw();var b=$("#lab");if(b)b.scrollIntoView({block:"start"})}

/* ---------- открытое занятие ---------- */
function head(t){return '<div class="play-top"><span class="tag">'+t+'</span><span class="muted">'+esc(KR.LANGS[LG()].name)+' · '+esc(level())+(BASE()!=="ru"?' · через '+BNI[BASE()]:"")+'</span><button type="button" class="round" data-lab="back" aria-label="К выбору">'+ic("x",16)+'</button></div>'}
function L2(){return LG()==="ko"?' class="ko" lang="ko"':' lang="en"'}
function drawRun(){
  var box=$("#lab"),r=RUN,t={listen:LG()==="ko"?"듣기 · Аудирование":"Listening",read:LG()==="ko"?"읽기 · Чтение":"Reading",exam:"Как на экзамене · "+(curEx()||[])[1],write:LG()==="ko"?"쓰기 · Письмо":"Writing",trans:"Перевод",dict:"Диктант предложений",talk:LG()==="ko"?"말하기 · Разговор":"Speaking · Разговор",week:"Итог недели"}[r.k];
  var h=head(t);
  if(r.busy)h+='<p class="muted lab-wait">'+ic("spark",18)+' Готовлю задание под уровень '+esc(level())+'… обычно это 10–30 секунд.</p>';
  else if(r.err)h+='<p class="msg bad">'+esc(r.err)+'</p><div class="fin-acts"><button type="button" class="btn pri" data-lab="'+r.k+'">Ещё раз</button><button type="button" data-lab="back">К выбору</button></div>';
  else h+=({listen:vListen,read:vRead,exam:vExam,write:vWrite,trans:vTrans,dict:vDict,talk:vTalk,week:vWeek})[r.k](r);
  box.innerHTML=h;
}
/* вопросы с вариантами: общий вид для аудио, чтения, экзамена */
function qs(list,pre){
  return (list||[]).map(function(q,i){var a=RUN.ans[pre+i];
    return '<div class="lab-q"><p><b>'+(i+1)+'.</b> '+esc(q.q||"")+'</p><div class="opts">'+(q.opts||[]).map(function(o,j){
      var cls=a===undefined?"":j===+q.a?"ok":j===a?"bad":"";
      return '<button type="button" data-qa="'+pre+i+'" data-j="'+j+'" class="'+cls+'"'+(a!==undefined?" disabled":"")+'>'+esc(o)+'</button>'}).join("")+'</div>'+
      (a!==undefined&&q.why?'<p class="muted">'+esc(q.why)+'</p>':"")+'</div>'}).join("");
}
function score(list,pre){var n=0,k=0;(list||[]).forEach(function(q,i){var a=RUN.ans[pre+i];if(a!==undefined){n++;if(a===+q.a)k++}});
  if(n&&n===(list||[]).length&&!RUN.logged){RUN.logged=1;logLab(RUN.k,k,n,(RUN.d||{}).title)}return n?'<p class="lab-score">Верно: '+k+' из '+(list||[]).length+'</p>':""}
function voice(sp){return LG()==="en"?(sp==="B"?"en-us":"en-gb"):LG()}
function playLines(lines,from,rate){
  KR.hush();var i=from||0,tok=(RUN.tok=(RUN.tok||0)+1);
  var step=function(){if(!RUN||RUN.tok!==tok||i>=lines.length){if(RUN&&RUN.tok===tok){RUN.playing=-1;mark()}return}
    RUN.playing=i;mark();var ln=lines[i++];KR.say(ln.s,voice(ln.sp),{rate:rate,end:function(){setTimeout(step,ln.sp!==(lines[i]||{}).sp?500:250)}})};
  step();
}
function mark(){[].forEach.call(document.querySelectorAll(".lab-line"),function(e,j){e.classList.toggle("on",j===RUN.playing)})}
function lineHtml(ln,i,showT){var nm={A:"A",B:"B",N:""}[ln.sp]||"";return '<p class="lab-line"><button type="button" class="say" data-li="'+i+'" aria-label="Послушать">'+ic("volume",14)+'</button>'+(nm?'<b class="lab-sp">'+nm+':</b> ':"")+'<span'+L2()+'>'+esc(ln.s)+'</span>'+(showT&&ln.t?'<br><small class="muted">'+esc(ln.t)+'</small>':"")+'</p>'}
function vListen(r){
  var d=r.d,lines=d.lines||[];
  return '<h3>'+esc(d.title||"")+'</h3><p class="muted">Сначала послушай, не подглядывая в текст, потом ответь на вопросы.</p>'+
    '<div class="tb-more"><button type="button" class="btn pri" data-lab="play">'+ic("play",16)+'Слушать</button><button type="button" data-lab="slow">Медленнее</button><button type="button" data-lab="pause">'+ic("pause",16)+'Стоп</button>'+
    '<button type="button" data-lab="script">'+(r.script?"Скрыть текст":"Показать текст")+'</button>'+(r.script?'<button type="button" data-lab="trs">'+(r.trs?"Без перевода":"С переводом")+'</button>':"")+'</div>'+
    (r.script?'<div class="lab-text">'+lines.map(function(ln,i){return lineHtml(ln,i,r.trs)}).join("")+'</div>':"")+
    '<h4 class="lab-h4">Вопросы</h4>'+qs(d.questions,"q")+score(d.questions,"q")+usedHtml(d)+again();
}
function usedHtml(d){return (d.used||[]).length?'<p class="muted">Твои слова в тексте: '+d.used.map(function(w){return '<span'+L2()+'>'+esc(w)+'</span>'}).join(", ")+'</p>':""}
function again(){return '<div class="fin-acts"><button type="button" class="btn pri" data-lab="'+RUN.k+'">Новое задание</button><button type="button" data-lab="back">К выбору</button></div>'}
function vRead(r){
  var d=r.d;
  return '<h3'+L2()+'>'+esc(d.title||"")+'</h3><div class="lab-text">'+(d.paras||[]).map(function(p,i){return '<p><span'+L2()+'>'+esc(p.s)+'</span> '+(KR.canSay()?'<button type="button" class="say" data-say="'+esc(p.s)+'" data-l="'+LG()+'" aria-label="Послушать">'+ic("volume",14)+'</button>':"")+
    '<button type="button" class="linkish" data-pt="'+i+'">перевод</button>'+((r.pt||{})[i]?'<br><small class="muted">'+esc(p.t||"")+'</small>':"")+'</p>'}).join("")+'</div>'+
    ((d.glossary||[]).length?'<h4 class="lab-h4">Словарик</h4><div class="lab-gl">'+d.glossary.map(function(g,i){var have=V.get(SRS.id(LG(),g.w));return '<div><span'+L2()+'>'+esc(g.w)+'</span> — '+esc(g.t||"")+' '+(have?'<small class="muted">в словаре</small>':'<button type="button" class="linkish" data-gadd="'+i+'">в словарь</button>')+'</div>'}).join("")+'</div>':"")+
    '<h4 class="lab-h4">Вопросы</h4>'+qs(d.questions,"q")+score(d.questions,"q")+usedHtml(d)+again();
}
/* экзамен: варианты, ответ словом, письмо */
function vExam(r){
  var d=r.d;
  return '<h3>'+esc(d.title||"")+'</h3>'+(d.instructions?'<p class="muted">'+esc(d.instructions)+'</p>':"")+(d.tasks||[]).map(function(t,i){
    var h='<div class="lab-task"><p class="lab-k">Задание '+(i+1)+'</p>';
    if((t.audio||[]).length)h+='<div class="tb-more"><button type="button" class="btn pri" data-ea="'+i+'">'+ic("play",16)+'Слушать</button><button type="button" data-es="'+i+'">'+((r.es||{})[i]?"Скрыть текст":"Текст")+'</button></div>'+((r.es||{})[i]?'<div class="lab-text">'+t.audio.map(function(ln,j){return '<p><b class="lab-sp">'+esc(ln.sp==="N"?"":ln.sp+":")+'</b> <span'+L2()+'>'+esc(ln.s)+'</span></p>'}).join("")+'</div>':"");
    if(t.passage)h+='<div class="lab-text"><p'+L2()+'>'+esc(t.passage).replace(/\n/g,"<br>")+'</p></div>';
    if(t.type==="write")return h+writeBox(t,"e"+i)+'</div>';
    h+=(t.q?'<p>'+esc(t.q)+'</p>':"");
    if((t.opts||[]).length)h+=qs([{q:"",opts:t.opts,a:t.a,why:t.why}],"e"+i);
    else{var a=r.ans["e"+i];h+='<div class="lab-in"><input class="name"'+L2()+' data-et="'+i+'" value="'+esc(a&&a.v||"")+'"'+(a?" disabled":"")+'><button type="button" data-ec="'+i+'"'+(a?" disabled":"")+'>Проверить</button></div>'+
      (a?'<p class="'+(a.ok?"ok":"bad")+'">'+(a.ok?"Верно":"Ответ: "+esc(String(t.a)))+'</p>'+(t.why?'<p class="muted">'+esc(t.why)+'</p>':""):"")}
    return h+'</div>'}).join("")+again();
}
/* ---------- письмо ---------- */
function cnt(s){return LG()==="ko"?s.replace(/\s/g,"").length:(s.trim().match(/\S+/g)||[]).length}
function unit(){return LG()==="ko"?"знаков":"слов"}
function usedW(text,w){var st=V.stem(LG(),String(w).split(/[\s/]/)[0]);return !!st&&SRS.norm(text).indexOf(st)>=0}
function writeBox(t,id){
  var w=RUN.w[id]||(RUN.w[id]={text:"",hint:0,res:null,sent:false}),must=t.must||[],min=+t.min||0,n=cnt(w.text);
  var h=(t.task||t.prompt?'<p><b>'+esc(t.task||t.prompt)+'</b></p>':"")+(t.grammar?'<p class="muted">Грамматика: <span'+L2()+'>'+esc(t.grammar)+'</span></p>':"");
  h+='<div class="lab-check" data-wc="'+id+'">'+(must.length?'<div>Используй слова: '+must.map(function(m){var ok=usedW(w.text,m);return '<span class="chip'+(ok?" sel":"")+'"'+L2()+'>'+(ok?"✓ ":"")+esc(m)+'</span>'}).join(" ")+'</div>':"")+
    (min?'<div class="'+(n>=min?"ok":"muted")+'">'+(n>=min?"✓ ":"")+'Объём: '+n+' из '+min+' '+unit()+'</div>':'<div class="muted">'+n+' '+unit()+'</div>')+
    (t.checklist||[]).map(function(c,i){return '<label class="lab-cl"><input type="checkbox" data-cl="'+id+':'+i+'"'+((w.cl||{})[i]?" checked":"")+'> '+esc(c)+'</label>'}).join("")+'</div>';
  if(t.start&&!w.text)h+='<p class="muted">Можно начать так: <span'+L2()+'>'+esc(t.start)+'</span> <button type="button" class="linkish" data-ws="'+id+'">вставить</button></p>';
  h+='<textarea class="lab-ta" rows="7"'+L2()+' data-wt="'+id+'" placeholder="Пиши здесь…">'+esc(w.text)+'</textarea>';
  var hs=t.hints||[];
  if(w.hint)h+='<ul class="lab-hints">'+hs.slice(0,w.hint).map(function(x){return '<li>'+esc(x)+'</li>'}).join("")+'</ul>';
  if(w.ph&&(t.phrases||[]).length)h+='<div class="lab-gl">'+t.phrases.map(function(p){return '<div><span'+L2()+'>'+esc(p.s)+'</span> — '+esc(p.t||"")+'</div>'}).join("")+'</div>';
  h+='<div class="tb-more">'+(hs.length&&w.hint<hs.length?'<button type="button" data-wh="'+id+'">Подсказка'+(w.hint?" ещё":"")+'</button>':"")+((t.phrases||[]).length?'<button type="button" data-wp="'+id+'">'+(w.ph?"Скрыть фразы":"Полезные фразы")+'</button>':"")+
    '<button type="button" class="btn pri" data-wk="'+id+'"'+(w.busy?" disabled":"")+'>'+(w.busy?"Проверяю…":"Проверить")+'</button>'+
    (canSend()?'<button type="button" data-wsend="'+id+'"'+(w.sent||!w.text.trim()?" disabled":"")+'>'+(w.sent?"Отправлено":"Отправить преподавателю")+'</button>':"")+'</div>';
  if(w.err)h+='<p class="msg bad">'+esc(w.err)+'</p>';
  var r=w.res;
  if(r)h+='<div class="lab-res">'+resHead(r)+
    ((r.checks||[]).length?'<ul class="lab-ok">'+r.checks.map(function(c){return '<li class="'+(c.ok?"ok":"bad")+'">'+(c.ok?"✓ ":"✗ ")+esc(c.text)+(c.note?' <span class="muted">— '+esc(c.note)+'</span>':"")+'</li>'}).join("")+'</ul>':"")+
    ((r.errors||[]).length?'<h4 class="lab-h4">Ошибки</h4><ul class="lab-err">'+r.errors.map(function(e){return '<li><s'+L2()+'>'+esc(e.bad)+'</s> → <b'+L2()+'>'+esc(e.good)+'</b>'+(e.why?' <span class="muted">— '+esc(e.why)+'</span>':"")+'</li>'}).join("")+'</ul>':"")+
    (r.corrected?'<h4 class="lab-h4">Исправленный вариант</h4><p'+L2()+'>'+esc(r.corrected)+'</p>':"")+'</div>';
  return h;
}
/* итог проверки: общий балл, критерии (как на экзамене), уровень текста */
function resHead(r){var mx=+r.max||10;
  return '<p class="lab-score">'+(r.scale==="band"?"Band ":"Оценка: ")+(+r.score||0)+' из '+mx+(r.level_hint?' <small class="muted">· уровень текста: '+esc(r.level_hint)+'</small>':"")+'</p>'+
    ((r.criteria||[]).length?'<div class="lab-crit">'+r.criteria.map(function(c){var p=c.max?Math.round(100*(+c.score||0)/c.max):0;
      return '<div><span>'+esc(c.name)+'</span><b>'+(+c.score||0)+' / '+(+c.max||0)+'</b><i style="--p:'+p+'%"></i>'+(c.note?'<small class="muted">'+esc(c.note)+'</small>':"")+'</div>'}).join("")+'</div>':"")+
    (r.comment?'<p>'+esc(r.comment)+'</p>':"")}
function vWrite(r){r.w=r.w||{};return writeBox(r.d,"w")+again()}
function wTask(id){return id==="w"?RUN.d:(RUN.d.tasks||[])[+id.slice(1)]||{}}
async function wCheck(id){
  var t=wTask(id),w=RUN.w[id];if(!w||!w.text.trim()){w.err="Сначала напиши текст.";return drawRun()}
  w.busy=true;w.err="";drawRun();
  var ex=id==="w"?"easy":curEx()[0];
  try{w.res=await gen("check",{exam:ex,task:t.task||t.prompt,checklist:t.checklist||[],must:t.must||[],text:w.text});logLab(id==="w"?"write":"exam-write",+w.res.score||0,+w.res.max||10,t.task||t.prompt)}catch(e){w.err=e.message}
  w.busy=false;drawRun();
}
async function wSend(id){
  var t=wTask(id),w=RUN.w[id],r=w.res,txt="Задание: "+(t.task||t.prompt||"")+"\n\nТекст ученика:\n"+w.text+(r?"\n\nАвтопроверка: "+(r.score||0)+"/"+(r.max||10)+(r.criteria||[]).map(function(c){return "\n"+c.name+": "+c.score+"/"+c.max}).join("")+(r.errors||[]).map(function(e){return "\n• "+e.bad+" → "+e.good}).join(""):"");
  var ok=await toTeacher((LG()==="ko"?"쓰기":"Writing")+" · "+level(),txt);w.sent=ok;w.err=ok?"":"Не получилось отправить. Проверь связь и попробуй ещё раз.";drawRun();
}
/* ---------- перевод с русского ---------- */
function vTrans(r){
  var it=r.d.items||[],res=r.res;
  return '<p class="muted">Переведи с языка «'+BNI[BASE()]+'» на '+(LG()==="ko"?"корейский":"английский")+'. Проверка — по смыслу, разные верные варианты засчитываются.</p>'+it.map(function(x,i){var v=(res||[])[i];
    return '<div class="lab-task"><p><b>'+(i+1)+'.</b> '+esc(x.t)+'</p><div class="lab-in"><input class="name"'+L2()+' data-tr="'+i+'" value="'+esc((r.tv||{})[i]||"")+'"'+(res?" disabled":"")+'></div>'+
      (v?'<p class="'+(v.v==="ok"?"ok":v.v==="part"?"muted":"bad")+'">'+(v.v==="ok"?"✓ Верно":v.v==="part"?"Почти":"✗ Не так")+(v.why?" — "+esc(v.why):"")+'</p><p>'+(v.fix?'<span'+L2()+'>'+esc(v.fix)+'</span>':"")+' <small class="muted">пример: <span'+L2()+'>'+esc(x.s)+'</span></small></p>':"")+'</div>'}).join("")+
    (res?"":'<div class="tb-more"><button type="button" class="btn pri" data-lab="trcheck"'+(r.busy2?" disabled":"")+'>'+(r.busy2?"Проверяю…":"Проверить")+'</button></div>')+(r.err2?'<p class="msg bad">'+esc(r.err2)+'</p>':"")+again();
}
async function trCheck(){
  var r=RUN,it=r.d.items||[];r.busy2=true;r.err2="";drawRun();
  try{var d=await gen("trcheck",{items:it.map(function(x,i){return {src:x.t,ans:(r.tv||{})[i]||"",ref:x.s,dir:"from_ru"}})});r.res=d.res||[];
    logLab("trans",r.res.filter(function(v){return v.v==="ok"}).length,it.length);
    var pr={};it.forEach(function(x,i){var c=x.w&&V.get(SRS.id(LG(),x.w));if(c&&c.st)pr[c.id]=(r.res[i]||{}).v!=="no"});if(Object.keys(pr).length)V.practice(pr)}
  catch(e){r.err2=e.message}
  r.busy2=false;drawRun();
}
/* ---------- диктант предложений и перевод ---------- */
function dictStart(list){
  var items=[];list.forEach(function(c){var e=exOf(c);if(e&&e.s&&e.s.length<=90)items.push({s:e.s,t:BASE()==="ru"?e.t||"":"",id:c.id})});
  RUN={k:"dict",items:items.slice(0,8),i:0,ans:{},list:list};drawRun();
}
function lev(a,b){var m=a.length,n=b.length,d=[];for(var i=0;i<=m;i++){d[i]=[i]}for(var j=1;j<=n;j++)d[0][j]=j;
  for(i=1;i<=m;i++)for(j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n]}
function nrm(s){return SRS.norm(s).replace(/[\s.,!?·~'’"«»:;()-]/g,"")}
function vDict(r){
  if(!r.items.length)return '<p class="muted">У выбранных слов пока нет примеров. Можно взять предложения, созданные под твой уровень.</p><div class="fin-acts"><button type="button" class="btn pri" data-lab="dgen">Создать предложения</button><button type="button" data-lab="back">К выбору</button></div>';
  if(r.i>=r.items.length){var ok=r.items.filter(function(x){return x.ok}).length;
    if(!r.logged){r.logged=1;logLab("dict",ok,r.items.length)}
    return '<div class="fin"><h3>Диктант закончен</h3><p class="muted">Записано верно: '+ok+' из '+r.items.length+'.</p>'+r.items.map(function(x){return '<p'+L2()+'>'+(x.ok?"✓ ":"✗ ")+esc(x.s)+'<br><small class="muted">'+esc(x.t)+'</small></p>'}).join("")+
      '<div class="fin-acts"><button type="button" class="btn pri" data-lab="dict">Ещё раз</button><button type="button" data-lab="dgen">Новые предложения</button><button type="button" data-lab="back">К выбору</button></div></div>';}
  var x=r.items[r.i],st=x.stage||"w";
  var h='<p class="muted">Предложение '+(r.i+1)+' из '+r.items.length+'. Послушай и запиши, потом переведи на русский.</p><div class="tb-more"><button type="button" class="btn pri" data-lab="dsay">'+ic("play",16)+'Слушать</button><button type="button" data-lab="dslow">Медленно</button></div>';
  h+='<div class="lab-in"><input class="name"'+L2()+' id="ldin" autocomplete="off" value="'+esc(x.v||"")+'"'+(st!=="w"?" disabled":"")+'>'+(st==="w"?'<button type="button" data-lab="dchk">Проверить</button>':"")+'</div>';
  if(st!=="w")h+='<p class="'+(x.ok?"ok":"bad")+'">'+(x.ok?(x.typo?"Почти верно: ":"Верно: "):"Правильно: ")+'<span'+L2()+'>'+esc(x.s)+'</span></p>';
  if(st==="t"||st==="d"){h+='<p>Переведи ('+BNI[BASE()]+'):</p><div class="lab-in"><input class="name" id="ltin" value="'+esc(x.tv||"")+'"'+(st==="d"?" disabled":"")+'>'+(st==="t"?'<button type="button" data-lab="tchk">Сравнить</button>':"")+'</div>'}
  if(st==="d")h+='<p class="muted">Перевод: '+esc(x.t||"—")+'</p><div class="tb-more"><button type="button" class="btn pri" data-lab="dnext">Дальше'+ic("arrow",16)+'</button></div>';
  return h;
}
function dSay(rate){var x=RUN.items[RUN.i];if(x)KR.say(x.s,LG(),rate?{rate:rate}:undefined)}
function dCheck(){
  var x=RUN.items[RUN.i],v=($("#ldin")||{}).value||"";x.v=v;var a=nrm(v),b=nrm(x.s),d=lev(a,b);
  x.ok=!!a&&d<=Math.max(0,Math.floor(b.length*.08));x.typo=x.ok&&d>0;x.stage=x.t?"t":"d";
  if(x.id){var pr={};pr[x.id]=x.ok;V.practice(pr)}
  drawRun();var t=$("#ltin");if(t)t.focus();if(!x.ok)dSay();
}

/* ---------- разговор ----------
   Собеседник (генерация) задаёт сцену, цели и первую реплику. Ученик отвечает голосом (распознавание браузера, KR.ear)
   или текстом; на каждую реплику — ответ собеседника, мягкая поправка и отметка выполненных целей.
   «Закончить» — оценка по четырём критериям (задача, беглость, лексика, грамматика, по 5 баллов), исправления и фразы. */
function vTalk(r){
  var d=r.d,h=r.h||[],res=r.res,can=KR.ear&&KR.ear.canHear&&KR.ear.canHear();
  var o='<h3>'+esc(d.title||"")+'</h3><p class="muted">'+esc(d.scene||"")+(d.partner?' · Собеседник: '+esc(d.partner):"")+'</p>';
  o+='<ul class="lab-goals">'+(d.goals||[]).map(function(g,i){var ok=(r.reached||[]).indexOf(i)>=0;return '<li class="'+(ok?"ok":"")+'">'+(ok?"✓ ":"○ ")+esc(g)+'</li>'}).join("")+'</ul>';
  o+='<div class="lab-chat">'+h.map(function(m,i){
    if(m.r==="P")return '<div class="lab-msg p"><span'+L2()+'>'+esc(m.s)+'</span> <button type="button" class="say" data-tsay="'+i+'" aria-label="Послушать">'+ic("volume",14)+'</button>'+
      (m.t?'<button type="button" class="linkish" data-ttr="'+i+'">перевод</button>'+(m.open?'<br><small class="muted">'+esc(m.t)+'</small>':""):"")+'</div>';
    return '<div class="lab-msg s"><span'+L2()+'>'+esc(m.s)+'</span>'+(m.fix?'<small class="lab-fix"><s>'+esc(m.fix.bad)+'</s> → <b'+L2()+'>'+esc(m.fix.good)+'</b>'+(m.fix.why?' — '+esc(m.fix.why):"")+'</small>':"")+'</div>'}).join("")+
    (r.wait?'<div class="lab-msg p muted">…</div>':"")+'</div>';
  if(res){
    o+='<div class="lab-res">'+resHead(res)+((res.fixes||[]).length?'<h4 class="lab-h4">Как сказать лучше</h4><ul class="lab-err">'+res.fixes.map(function(e){return '<li><s'+L2()+'>'+esc(e.bad)+'</s> → <b'+L2()+'>'+esc(e.good)+'</b>'+(e.why?' <span class="muted">— '+esc(e.why)+'</span>':"")+'</li>'}).join("")+'</ul>':"")+
      ((res.learn||[]).length?'<h4 class="lab-h4">Фразы, которые стоит выучить</h4><div class="lab-gl">'+res.learn.map(function(x,i){return '<div><span'+L2()+'>'+esc(x.s)+'</span> — '+esc(x.t||"")+' '+(V.get(SRS.id(LG(),x.s))?'<small class="muted">в словаре</small>':'<button type="button" class="linkish" data-tadd="'+i+'">в словарь</button>')+'</div>'}).join("")+'</div>':"")+
      '<div class="tb-more">'+(canSend()?'<button type="button" data-lab="tteach"'+(r.sent?" disabled":"")+'>'+(r.sent?"Отправлено":"Отправить преподавателю")+'</button>':"")+'</div></div>'+again();
    return o;
  }
  if(r.ph&&(d.phrases||[]).length)o+='<div class="lab-gl">'+d.phrases.map(function(x){return '<div><span'+L2()+'>'+esc(x.s)+'</span> — '+esc(x.t||"")+'</div>'}).join("")+'</div>';
  o+='<div class="lab-in"><input class="name"'+L2()+' id="ttin" autocomplete="off" placeholder="'+(can?"Скажи в микрофон или напиши":"Напиши ответ")+'"'+(r.wait?" disabled":"")+'>'+
    (can?'<button type="button" class="say mic'+(r.listen?" on":"")+'" data-lab="tmic" aria-label="Сказать">'+ic("mic",16)+'</button>':"")+'<button type="button" class="btn pri" data-lab="tsend"'+(r.wait?" disabled":"")+'>Ответить</button></div>'+
    (r.msg?'<p class="muted">'+esc(r.msg)+'</p>':"")+(r.err?'<p class="msg bad">'+esc(r.err)+'</p>':"")+
    '<div class="tb-more">'+((d.phrases||[]).length?'<button type="button" data-lab="tph">'+(r.ph?"Скрыть фразы":"Полезные фразы")+'</button>':"")+
    '<button type="button"'+(h.filter(function(m){return m.r==="S"}).length?' class="btn pri"':"")+' data-lab="tend"'+(r.wait||!h.some(function(m){return m.r==="S"})?" disabled":"")+'>'+(r.done?"Цели выполнены — получить оценку":"Закончить и получить оценку")+'</button></div>';
  return o;
}
function hist(r){return (r.h||[]).slice(-16).map(function(m){return {who:m.r,s:m.s}})}
async function talkSend(){
  var r=RUN;if(!r||r.k!=="talk"||r.wait||r.res)return;var inp=$("#ttin"),v=(inp&&inp.value||"").trim();if(!v)return;
  r.h.push({r:"S",s:v});r.wait=true;r.err="";r.msg="";drawRun();
  try{var d=await gen("talk_turn",{scene:r.d.scene,partner:r.d.partner,goals:r.d.goals||[],history:hist(r)});
    if(RUN!==r)return;var last=r.h[r.h.length-1];if(d.fix&&d.fix.bad&&d.fix.good)last.fix=d.fix;
    (d.reached||[]).forEach(function(i){if(r.reached.indexOf(+i)<0)r.reached.push(+i)});
    if(d.s){r.h.push({r:"P",s:d.s,t:d.t});KR.say(d.s,LG())}r.done=!!d.done||r.h.filter(function(m){return m.r==="S"}).length>=10}
  catch(e){r.err=e.message}
  r.wait=false;drawRun();var i2=$("#ttin");if(i2)i2.focus();
}
async function talkMic(){
  var r=RUN;if(!r||r.listen||r.wait)return;KR.hush();r.listen=true;r.msg="Слушаю…";drawRun();
  try{var alts=await KR.ear.recognize(LG(),{accent:KR.accent&&KR.accent(),max:12000});var inp=$("#ttin");r.listen=false;r.msg="";drawRun();inp=$("#ttin");if(inp){inp.value=alts[0]||"";inp.focus()}}
  catch(e){r.listen=false;r.msg=KR.ear.errText(e);drawRun()}
}
async function talkEnd(){
  var r=RUN;if(!r||r.wait)return;r.wait=true;r.err="";drawRun();
  try{r.res=await gen("talk_end",{scene:r.d.scene,goals:r.d.goals||[],history:hist(r)});logLab("talk",+r.res.score||0,+r.res.max||20,r.d.title)}catch(e){r.err=e.message}
  r.wait=false;drawRun();
}
async function talkTeach(){
  var r=RUN,res=r.res||{},txt="Разговор: "+(r.d.title||"")+"\n"+(r.d.scene||"")+"\n\n"+(r.h||[]).map(function(m){return (m.r==="P"?"Собеседник: ":"Ученик: ")+m.s}).join("\n")+
    "\n\nОценка: "+(res.score||0)+"/"+(res.max||20)+(res.criteria||[]).map(function(c){return "\n"+c.name+": "+c.score+"/"+c.max}).join("")+(res.fixes||[]).map(function(e){return "\n• "+e.bad+" → "+e.good}).join("");
  r.sent=await toTeacher((LG()==="ko"?"말하기":"Speaking")+" · "+level(),txt);drawRun();
}

/* ---------- итог недели ----------
   Из журнала ответов (kr_wlog, js/vocab.js), словаря и журнала «Практики» (kr_labstat): дни занятий, ответы и точность,
   новые слова, что ждёт на следующей неделе, трудные слова, тексты, письмо и разговор с оценками, советы. */
function plural(n,a,b,c){n=Math.abs(n)%100;var m=n%10;return n>10&&n<20?c:m===1?a:m>=2&&m<=4?b:c}
function dk(t){var d=new Date(t);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function weekStats(){
  var now=Date.now(),from=SRS.dayStart(now)-6*DAY,log={};try{log=JSON.parse(localStorage.getItem("kr_wlog:"+KR.user())||"{}")||{}}catch(e){}
  var days=[],n=0,r=0,ok=0;for(var i=6;i>=0;i--){var k=dk(now-i*DAY),x=log[k]||{n:0,r:0,ok:0};days.push({k:k,a:x.n+x.r});n+=x.n;r+=x.r;ok+=x.ok}
  var lab=labLog().filter(function(x){return x.t>=from}),all=V.all(),l=LG();
  var act=days.filter(function(d){return d.a}).length;lab.forEach(function(x){var k=dk(x.t);if(!days.some(function(d){return d.k===k&&d.a}))act++});
  var hard=all.filter(function(c){return c.lr&&c.lr>=from&&((c.lap||0)+(c.pe||0)+(c.tc||0))>0}).sort(function(a,b){return (b.lap||0)+(b.pe||0)-(a.lap||0)-(a.pe||0)}).slice(0,10);
  var next=all.filter(function(c){return c.st&&c.due<SRS.dayStart(now)+8*DAY}).length;
  var added=all.filter(function(c){return (c.a||0)>=from}).length,learned=all.filter(function(c){return c.st===2&&(c.fr||0)>=from}).length;
  return {days:Math.min(7,act),bars:days,ans:n+r,acc:n+r?Math.round(ok/(n+r)*100):0,fresh:n,rev:r,lab:lab,hard:hard,next:next,added:added,learned:learned,total:all.length};
}
var LK={listen:"аудирование",read:"чтение",exam:"экзамен",write:"письмо","exam-write":"письмо (экзамен)",trans:"перевод",dict:"диктант",talk:"разговор"};
function advice(w){var a=[];
  if(w.days<4)a.push("Занимайся понемногу, но чаще: 10 минут каждый день работают лучше, чем час раз в неделю.");
  if(w.ans>=20&&w.acc<70)a.push("Точность ниже 70%: возьми меньше новых слов в день («Слова» → «Настройки») и повтори трудные.");
  if(w.ans>=20&&w.acc>=90)a.push("Отличная точность. Можно брать больше новых слов или перейти к текстам и разговору.");
  if(!w.lab.some(function(x){return x.k==="talk"}))a.push("Попробуй «Разговор»: так слова переходят в речь.");
  if(!w.lab.some(function(x){return x.k==="write"||x.k==="exam-write"}))a.push("Напиши короткий текст в «Письме» — с чек-листом и проверкой это 10 минут.");
  if(w.hard.length)a.push("Трудных слов на этой неделе: "+w.hard.length+". Повтори их отдельно — кнопка ниже.");
  return a.slice(0,4)}
function vWeek(){
  var w=weekStats(),mx=Math.max(1,Math.max.apply(null,w.bars.map(function(b){return b.a}))),DN=["вс","пн","вт","ср","чт","пт","сб"];
  var by={};w.lab.forEach(function(x){(by[x.k]=by[x.k]||[]).push(x)});
  var h='<div class="lab-stat">'+[[w.days+"/7","дней занятий"],[w.ans,"ответов"],[w.ans?w.acc+"%":"—","верно"],[w.learned,"слов выучено"],[w.added,"слов добавлено"],[w.next,"повторений на неделю вперёд"]].map(function(x){return '<div><b>'+x[0]+'</b><span class="muted">'+x[1]+'</span></div>'}).join("")+'</div>';
  h+='<div class="lab-bars">'+w.bars.map(function(b){return '<div><i style="--h:'+Math.round(b.a/mx*100)+'%"'+(b.a?"":' class="z"')+'></i><small>'+DN[new Date(b.k+"T00:00").getDay()]+'</small></div>'}).join("")+'</div>';
  if(Object.keys(by).length)h+='<h4 class="lab-h4">Практика</h4><ul class="lab-ok">'+Object.keys(by).map(function(k){var a=by[k],sc=a.filter(function(x){return x.m}),p=sc.length?Math.round(sc.reduce(function(s,x){return s+x.s/x.m},0)/sc.length*100):null;
    return '<li>'+esc(LK[k]||k)+': '+a.length+(p!==null?' · в среднем '+p+'%':"")+'</li>'}).join("")+'</ul>';
  if(w.hard.length)h+='<h4 class="lab-h4">Трудные слова недели</h4><div class="tb-prev">'+w.hard.map(function(c){return '<span class="chip"><b'+(c.l==="ko"?' class="ko"':"")+' lang="'+c.l+'">'+esc(c.w)+'</b>&nbsp;· '+esc(glossB(c))+'</span>'}).join("")+'</div>';
  var ad=advice(w);if(ad.length)h+='<h4 class="lab-h4">Советы</h4><ul class="lab-hints">'+ad.map(function(x){return '<li>'+esc(x)+'</li>'}).join("")+'</ul>';
  h+='<div class="fin-acts">'+(w.hard.length?'<button type="button" class="btn pri" data-lab="whard">Повторить трудные</button>':"")+(canSend()?'<button type="button" data-lab="wsend"'+(RUN.sent?" disabled":"")+'>'+(RUN.sent?"Отправлено":"Отправить преподавателю")+'</button>':"")+'<button type="button" data-lab="back">К выбору</button></div>';
  return h;
}
async function weekSend(){
  var w=weekStats(),by={};w.lab.forEach(function(x){(by[x.k]=by[x.k]||[]).push(x)});
  var t="Дней занятий: "+w.days+" из 7\nОтветов в словах: "+w.ans+(w.ans?" ("+w.acc+"% верно)":"")+"\nВыучено слов: "+w.learned+", добавлено: "+w.added+"\nПовторений на следующую неделю: "+w.next+
    (Object.keys(by).length?"\nПрактика: "+Object.keys(by).map(function(k){return (LK[k]||k)+" ×"+by[k].length}).join(", "):"")+
    (w.hard.length?"\nТрудные слова: "+w.hard.map(function(c){return c.w}).join(", "):"");
  RUN.sent=await toTeacher("Итог недели",t);drawRun();
}

/* ---------- события ---------- */
document.addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b||!b.closest("#lab"))return;var d=b.dataset;
  if(d.x==="cx-cfg"&&!ONW){location.href="words.html?tab=prefs";return}
  if(d.ll){L.l=d.ll;L.sc=L.sc.filter(function(k){return k.indexOf("set:")<0});save();return draw()}
  if(d.ld){L.dir=d.ld;save();return draw()}
  if(d.lb){L.base=Object.assign({},L.base);L.base[LG()]=d.lb;L.gl=[];save();return draw()}
  if(d.tadd!==undefined){var ta3=((RUN.res||{}).learn||[])[+d.tadd]||((RUN.d||{}).phrases||[])[+d.tadd];if(ta3){addW(LG(),ta3.s,ta3.t||"",{src:"lab"});drawRun()}return}
  if(d.tsay!==undefined){var hl=(RUN.h||[])[+d.tsay];if(hl)KR.say(hl.s,LG());return}
  if(d.ttr!==undefined){var ht=(RUN.h||[])[+d.ttr];if(ht){ht.open=!ht.open;drawRun()}return}
  if(d.lg){var g=curGl().slice(),i=g.indexOf(d.lg);if(i>=0){if(g.length>1)g.splice(i,1)}else g.push(d.lg);L.gl=g;save();return draw()}
  if(d.ls){var a=L.sc.slice(),j=a.indexOf(d.ls);if(j>=0){if(a.length>1)a.splice(j,1)}else a.push(d.ls);L.sc=a;save();return draw()}
  if(d.ln){L.n=+d.ln;save();return draw()}
  if(d.lf){L.lf=d.lf;save();return draw()}
  if(d.rf){L.rf=d.rf;save();return draw()}
  if(d.lz){L.ll=d.lz;save();return draw()}
  if(d.le){L.ex=d.le;L.sec="";save();return draw()}
  if(d.lc){L.sec=d.lc;save();return draw()}
  if(d.qa!==undefined){RUN.ans[d.qa]=+d.j;return drawRun()}
  if(d.li!==undefined){var ln=(RUN.d.lines||[])[+d.li];if(ln)KR.say(ln.s,voice(ln.sp));return}
  if(d.pt!==undefined){RUN.pt=RUN.pt||{};RUN.pt[d.pt]=!RUN.pt[d.pt];return drawRun()}
  if(d.gadd!==undefined){var gg=(RUN.d.glossary||[])[+d.gadd];if(gg){addW(LG(),gg.w,gg.t||"",{src:"lab"});drawRun()}return}
  if(d.ea!==undefined){var ta=(RUN.d.tasks||[])[+d.ea];if(ta)playLines(ta.audio||[],0);return}
  if(d.es!==undefined){RUN.es=RUN.es||{};RUN.es[d.es]=!RUN.es[d.es];return drawRun()}
  if(d.ec!==undefined){var tt=(RUN.d.tasks||[])[+d.ec],inp=$('[data-et="'+d.ec+'"]'),v=inp?inp.value:"";RUN.ans["e"+d.ec]={v:v,ok:nrm(v)===nrm(String(tt.a))};return drawRun()}
  if(d.wh){RUN.w[d.wh].hint++;return drawRun()}
  if(d.wp){RUN.w[d.wp].ph=!RUN.w[d.wp].ph;return drawRun()}
  if(d.ws){RUN.w[d.ws].text=wTask(d.ws).start+" ";drawRun();var ta2=$('[data-wt="'+d.ws+'"]');if(ta2){ta2.focus();ta2.setSelectionRange(ta2.value.length,ta2.value.length)}return}
  if(d.wk)return wCheck(d.wk);
  if(d.wsend)return wSend(d.wsend);
  var k=d.lab;if(!k)return;
  if(k==="back")return back();
  if(k==="tsend")return talkSend();
  if(k==="tmic")return talkMic();
  if(k==="tph"){RUN.ph=!RUN.ph;return drawRun()}
  if(k==="tend")return talkEnd();
  if(k==="tteach")return talkTeach();
  if(k==="wsend")return weekSend();
  if(k==="whard"){L.sc=["hard"];save();RUN=null;draw();return go("train")}
  if(k==="play"){KR.hush();return playLines(RUN.d.lines||[],0)}
  if(k==="slow"){KR.hush();return playLines(RUN.d.lines||[],0,.7)}
  if(k==="pause"){RUN.tok++;KR.hush();RUN.playing=-1;return mark()}
  if(k==="script"){RUN.script=!RUN.script;return drawRun()}
  if(k==="trs"){RUN.trs=!RUN.trs;return drawRun()}
  if(k==="trcheck"){RUN.tv={};[].forEach.call(document.querySelectorAll("[data-tr]"),function(x){RUN.tv[x.dataset.tr]=x.value});return trCheck()}
  if(k==="dsay")return dSay();
  if(k==="dslow")return dSay(.6);
  if(k==="dchk")return dCheck();
  if(k==="tchk"){var x=RUN.items[RUN.i];x.tv=($("#ltin")||{}).value||"";x.stage="d";return drawRun()}
  if(k==="dnext"){RUN.i++;drawRun();if(RUN.i<RUN.items.length){dSay();var di=$("#ldin");if(di)di.focus()}return}
  if(k==="dict"&&RUN&&RUN.k==="dict"){RUN.items.forEach(function(x){delete x.stage;delete x.v;delete x.tv;delete x.ok});RUN.i=0;drawRun();return dSay()}
  if(k==="dgen"){var list=RUN?RUN.list:words();RUN={k:"dict",busy:true,items:[],i:0,ans:{},list:list};drawRun();
    gen("sent",{n:6},list).then(function(dd){RUN.busy=false;RUN.items=(dd.items||[]).map(function(x){var c=x.w&&V.get(SRS.id(LG(),x.w));return {s:x.s,t:x.t,id:c&&c.st?c.id:null}});drawRun();dSay()},
      function(er){RUN.busy=false;RUN.err=er.message;drawRun()});return}
  go(k);
});
document.addEventListener("input",function(e){
  var t=e.target;if(!t.closest||!t.closest("#lab"))return;
  if(t.dataset.wt&&RUN&&RUN.w){var w=RUN.w[t.dataset.wt]||(RUN.w[t.dataset.wt]={text:"",hint:0});w.text=t.value;var box=document.querySelector('[data-wc="'+t.dataset.wt+'"]');if(box){var tmp=document.createElement("div");tmp.innerHTML=writeBox(wTask(t.dataset.wt),t.dataset.wt);var nb=tmp.querySelector(".lab-check");if(nb)box.innerHTML=nb.innerHTML}
    var sb=document.querySelector('[data-wsend="'+t.dataset.wt+'"]');if(sb&&!w.sent)sb.disabled=!w.text.trim()}
});
document.addEventListener("change",function(e){var t=e.target;if(t.dataset&&t.dataset.cl){var p=t.dataset.cl.split(":"),w=RUN.w[p[0]];w.cl=w.cl||{};w.cl[p[1]]=t.checked}});
document.addEventListener("change",function(e){var t=e.target;if(t.dataset&&t.dataset.ltopic!==undefined){L.topic=t.value.trim().slice(0,120);save()}});
document.addEventListener("keydown",function(e){
  if(e.key==="Enter"&&!e.shiftKey&&e.target&&e.target.id==="ttin"){e.preventDefault();return talkSend()}
  if(e.key!=="Enter"||!RUN||RUN.k!=="dict")return;var id=e.target&&e.target.id;
  if(id==="ldin"){e.preventDefault();dCheck()}else if(id==="ltin"){e.preventDefault();var x=RUN.items[RUN.i];x.tv=e.target.value;x.stage="d";drawRun();var nb=$('[data-lab="dnext"]');if(nb)nb.focus()}
});
KR.lab={draw:function(){if(!RUN)draw()},go:go};
/* «Слова»: ?lab=train | pod — пришли из «Практики», запускаем выбранное */
if(ONW){var q=new URLSearchParams(location.search).get("lab");
  if(q==="train"||q==="pod")KR.load().then(function(){try{history.replaceState(null,"",location.pathname)}catch(e){}setTimeout(function(){go(q)},50)})}
})();
