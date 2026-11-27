/* MIRAÉ · тест по словам: в начале урока с учителем или самостоятельно (страница test.html).
   Режимы (?mode=):
   - class — с учителем, как тесты «на уроке» (en-test-band9-class): вопрос на экране, ответ сразу проверяется,
     «Показать ответ», «Дальше», счёт ✅/❌, в конце ошибки и «Повторить ошибки». Без таймера. Клавиши: 1–4 — вариант, Enter — дальше;
   - self — самостоятельно: ответ сразу проверяется и не исправляется, может быть таймер. Ответы сдвигают повторение слов
     в словаре ученика (KR.vocab.practice), а тест из домашки записывает результат в ответы домашки.
   Словарь ученика: в обоих режимах ответы меняют расписание слов. Самостоятельно — сами (KR.vocab.practice).
   С учителем — у каждого ответа выбор «когда слово вернётся»: «авто» (ошибка сокращает интервал, верный ответ засчитывается,
   если слово пора повторять), «сегодня» (заново, как после «Снова») или «завтра» (SRS.send). Записывается в конце теста:
   с устройства преподавателя — в словарь ученика из SPEC.who (функции teacher_vocab и teacher_vocab_put, supabase/vocab.sql),
   с устройства ученика — в его словарь.
   Откуда слова: ?id=<ключ> — тест собрал преподаватель (localStorage kr_wtest:<ключ>); ?l=<урок> — слова урока;
   ?hw=<номер>&k=<блок> — тест из домашки.
   Вопросы (форматы отработки, их выбирает преподаватель): tr — слово → перевод (выбор); rev — перевод → слово (выбор);
   tf — верно или неверно (слово и перевод); ctc — слово в пропуск предложения (выбор); ctx — вписать слово в предложение
   (видны первые буквы или первый слог); wr — написать слово по переводу; fl — написать по первой букве (слогу) и числу
   клеточек; bld — собрать слово из букв (в корейском — из слогов); mch — найти пары (до 4 слов в одном задании);
   aud — на слух: выбрать перевод; dic — диктант: написать услышанное слово; say — сказать слово вслух (распознавание речи).
   Если формат на устройстве не работает (нет озвучки, микрофона) или слову не подходит (нет примера), задание
   заменяется похожим: aud → tr, dic/say/bld → wr, ctx/ctc → tr.
   Порядок слов: SPEC.ord — как прислал преподаватель (миксы «новые + повторение», новое слово может встретиться дважды
   в разных форматах), иначе случайный. У слова может быть метка g (new, rev, week, hard…) — итог показывает счёт по ним. */
(function(){
"use strict";
var KR=window.KR;if(!KR)return;
var Q=new URLSearchParams(location.search),$=function(s){return document.querySelector(s)},esc=KR.esc,ic=KR.icon;
var KINDS={tr:"Перевод (выбор)",rev:"Слово по переводу (выбор)",tf:"Верно или неверно",ctc:"Слово в предложение (выбор)",ctx:"Вставь в предложение",
  wr:"Напиши слово",fl:"По первой букве",bld:"Собери слово",mch:"Найди пары",aud:"На слух: перевод",dic:"Диктант на слух",say:"Скажи вслух"};
var TASK={tr:"Выбери перевод.",rev:"Выбери слово.",tf:"Перевод верный? 1 — верно, 2 — неверно.",ctc:"Выбери слово для пропуска.",
  ctx:"Вставь слово в предложение. Видны первые буквы, черта — буква (в корейском — слог).",wr:"Напиши слово по переводу.",
  fl:"Напиши слово по переводу. Видна первая буква (в корейском — первый слог), клеточки — сколько всего.",
  bld:"Собери слово: нажимай буквы по порядку (в корейском — слоги).",mch:"Найди пары: нажми на слово, потом на его перевод.",
  aud:"Послушай слово и выбери перевод.",dic:"Послушай и напиши слово.",say:"Скажи слово вслух: нажми на микрофон."};
var GN={new:"новые",rev:"повторение",week:"слова недели",hard:"сложные",due:"повторение",all:"другие",lesson:"слова урока"};
var EAR=KR.ear||null;
var canTTS=function(){return !!(KR.canSay&&KR.canSay())};
var canMic=function(){return !!(EAR&&EAR.canHear&&EAR.canHear())};
var MODE=Q.get("mode")==="class"?"class":"self";
var SPEC=null,QS=[],I=0,RES=[],locked=false,T0=0,tick=null,HWC=null,CH={},DONE={},SUM='';
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
function norm(s){return String(s==null?"":s).normalize("NFC").toLowerCase().replace(/[’']/g,"").replace(/[\s.,!?…«»"()\-–—]/g,"")}
var isKo=function(s){return /[ㄱ-ㆎ가-힣]/.test(s)};
var wl=function(w){return w&&w.l||(isKo(w&&w.w)?"ko":SPEC&&SPEC.lang||"ko")};   // язык слова: в тесте могут быть слова разных языков
var wcls=function(s){return isKo(s)?' class="ko" lang="ko"':""};

async function loadSpec(){
  var id=Q.get("id"),l=Q.get("l"),hw=Q.get("hw");
  if(id){try{return JSON.parse(localStorage.getItem("kr_wtest:"+id)||"null")}catch(e){return null}}
  if(l){if(!(window.LESSONS||{})[l]&&KR.lib)await KR.lib.ensure([l]);   // урок из библиотеки: lib-<номер>
    var L=(window.LESSONS||{})[l];if(!L)return null;
    return {title:"Слова урока · "+L.title,sub:L.course,lang:L.lang||"ko",words:KR.lessonWords(L),kinds:["tr","rev","ctx","wr"],n:15,min:0,back:"lesson.html?l="+encodeURIComponent(l),backT:"урок"}}
  if(hw){
    var list=await KR.homework(),rec=list&&list.find(function(x){return String(x.id)===String(hw)}),k=Q.get("k")||"",idx=+(k.split("-")[1]);
    var it=rec&&rec.items&&rec.items[idx];
    if(!rec||rec.status!=="active"||!it||!it.wt)return {gone:true,hw:hw};
    HWC={rec:rec,key:k};
    return {title:it.wt.title||"Тест по словам",sub:"домашка",lang:it.wt.lang||rec.lang||"ko",words:it.wt.w||[],kinds:it.wt.k,ord:!!it.wt.ord,n:(it.wt.w||[]).length,min:it.wt.min||0,back:"lesson.html?hw="+encodeURIComponent(rec.id),backT:"домашка"};
  }
  return null;
}

// ---------- вопросы ----------
function canCtx(w){var f=w.f||w.w;return !!(w.ex&&f&&w.ex.indexOf(f)>=0)}
function blank(f){
  if(isKo(f))return Array.from(f).map(function(c,i){return i===0||!isKo(c)?c:"＿"}).join("");
  return f.split(" ").map(function(p){return Array.from(p).map(function(c,i){return i===0||c==="-"?c:"_"}).join(" ")}).join("   ");
}
var unitsOf=function(w){return Array.from(String(w||"").normalize("NFC").replace(/\s+/g,""))};
function others(w,pool,k,n){
  var ok=function(x){return x.w!==w.w&&(k!=="tr"&&k!=="aud"&&k!=="tf"&&k!=="mch"||(x.t&&x.t!==w.t))},same=pool.filter(function(x){return ok(x)&&wl(x)===wl(w)});
  var seen={},out=[];shuffle(same.length>=n?same:pool.filter(ok)).forEach(function(x){var key=k==="rev"||k==="ctc"?x.w:x.t;if(!seen[key]&&out.length<n){seen[key]=1;out.push(x)}});   // варианты — из слов того же языка
  return out;
}
function fit(w,k,pool){   // формат, который подходит слову и работает на этом устройстве
  if((k==="aud"||k==="dic")&&!canTTS())k=k==="aud"?"tr":"wr";
  if(k==="say"&&!canMic())k="wr";
  if(k==="bld"){var u=unitsOf(w.w);if(u.length<2||u.length>16)k="wr"}
  if((k==="ctx"||k==="ctc")&&!canCtx(w))k=pool.length>=2?"tr":"wr";
  if(["tr","rev","tf","ctc","aud","mch"].indexOf(k)>=0&&others(w,pool,k,1).length<1)k="wr";
  return k;
}
function makeQ(w,k,pool,rest){
  k=fit(w,k,pool);
  if(k==="tr"||k==="aud"){var o=others(w,pool,k,3);return {k:k,w:w,ans:w.t,opts:shuffle([w.t].concat(o.map(function(x){return x.t})))}}
  if(k==="rev"){var o2=others(w,pool,k,3);return {k:k,w:w,ans:w.w,opts:shuffle([w.w].concat(o2.map(function(x){return x.w})))}}
  if(k==="tf"){var right=Math.random()<.5,x=others(w,pool,k,1)[0];return {k:k,w:w,shown:right?w.t:x.t,ans:right?"Верно":"Неверно",opts:["Верно","Неверно"]}}
  if(k==="ctc"){var f=w.f||w.w,i=w.ex.indexOf(f),o3=others(w,pool,k,3);return {k:k,w:w,ans:w.w,opts:shuffle([w.w].concat(o3.map(function(x){return x.w}))),before:w.ex.slice(0,i),after:w.ex.slice(i+f.length)}}
  if(k==="ctx"){var f2=w.f||w.w,j=w.ex.indexOf(f2);return {k:k,w:w,ans:f2,before:w.ex.slice(0,j),after:w.ex.slice(j+f2.length)}}
  if(k==="bld"){var u=unitsOf(w.w),t=shuffle(u);for(var a=0;a<5&&t.join("")===u.join("");a++)t=shuffle(u);return {k:k,w:w,ans:w.w,tiles:t,pick:[]}}
  if(k==="mch"){   // пары: слово и до трёх следующих слов теста (они тоже засчитываются), иначе слова из общего списка
    var used={},grp=[w];used[w.w]=1;used["t:"+w.t]=1;
    var take=function(x){if(!x||used[x.w]||used["t:"+x.t]||!x.t||grp.length>=4)return false;used[x.w]=1;used["t:"+x.t]=1;grp.push(x);return true};
    while(rest&&rest.length&&grp.length<4){var nx=rest[0];if(take(nx))rest.shift();else break}
    others(w,pool,k,6).forEach(take);
    if(grp.length<2)return makeQ(w,"tr",pool);
    return {k:k,w:w,ws:grp,ans:"",L:shuffle(grp),R:shuffle(grp),sel:null,got:{},bad:{}};
  }
  if(k==="say")return {k:k,w:w,ans:w.w,tries:0};
  return {k:k,w:w,ans:w.w};   // wr, fl, dic
}
function kinds(){var a=(SPEC.kinds||[]).filter(function(k){return KINDS[k]});return a.length?a:["tr","rev","ctx","wr"]}
function build(words,n){
  var pool=(SPEC.words||[]).filter(function(w){return w&&w.w&&w.t}),ks=kinds(),again=!!words;
  words=(words||pool).filter(function(w){return w&&w.w&&w.t});
  var list=(SPEC.ord&&!again?words.slice():shuffle(words)).slice(0,Math.min(n||words.length,words.length)),out=[],last={},ki=Math.floor(Math.random()*ks.length);
  while(list.length){
    var w=list.shift(),k=ks[ki++%ks.length];
    if(last[w.w]&&ks.length>1&&k===last[w.w])k=ks[ki++%ks.length];   // слово второй раз — в другом формате
    var q=makeQ(w,k,pool,list);last[w.w]=q.k;out.push(q);
  }
  return out;
}
var isWrite=function(q){return q.k==="ctx"||q.k==="wr"||q.k==="fl"||q.k==="dic"};
var qWords=function(q){return q.ws||[q.w]};
function okAns(q,a){if(a==null)return false;if(!isWrite(q)&&q.k!=="bld")return a===q.ans;var n=norm(a);return n===norm(q.ans)||n===norm(q.w.w)||String(q.w.w).split("/").some(function(v){return norm(v)===n})}
var qText=function(q){return q.k==="tr"||q.k==="aud"?q.w.w:q.k==="tf"?q.w.w+" = "+q.shown+"?":q.k==="ctx"||q.k==="ctc"?q.before+"(…)"+q.after:q.k==="mch"?"Пары: "+q.ws.map(function(x){return x.w}).join(", "):q.k==="dic"?"Диктант: "+q.w.w:q.w.t};

// ---------- экраны ----------
function head(){
  var back=SPEC.back||(MODE==="class"?"teacher.html":"cabinet.html"),bt=SPEC.backT||(MODE==="class"?"ученики":"кабинет");
  return '<header class="band slim"><div class="in"><a href="'+esc(back)+'">'+ic("back",14)+esc(bt)+'</a><small>'+(MODE==="class"?"Тест на начало урока · с учителем":"Тест по словам · самостоятельно")+(SPEC.sub?" · "+esc(SPEC.sub):"")+'</small><h1'+wcls(SPEC.title)+'>'+esc(SPEC.title)+'</h1><p>'+esc(SPEC.who?"Ученик: "+SPEC.who+" · ":"")+(SPEC.words||[]).length+' слов</p></div></header>';
}
function setup(){
  var ks=kinds(),tot=(SPEC.words||[]).length,n=Math.min(SPEC.n||15,tot),h=head()+'<main class="wt">';
  var counts=[5,10,15,20,30].filter(function(x){return x<tot}).concat([tot]);if(counts.indexOf(n)<0)counts.push(n);counts.sort(function(a,b){return a-b});
  if(MODE==="class"){
    h+='<section class="card glass wt-setup"><h3>'+ic("users",20)+' Проверка на уроке</h3><p class="muted">Делаем вместе: ответ сразу проверяется, ошибки обсуждаем. Без таймера. Клавиши: 1–4 — вариант, Enter — дальше.</p>'+
      '<p class="wt-lbl"><b>Типы заданий</b></p><div class="wt-kinds">'+Object.keys(KINDS).map(function(k){return '<label><input type="checkbox" data-kind="'+k+'"'+(ks.indexOf(k)>=0?' checked':'')+'> '+KINDS[k]+'</label>'}).join("")+'</div>'+
      '<label class="field" for="wtn">Сколько вопросов</label><select id="wtn">'+counts.map(function(v){return '<option value="'+v+'"'+(v===n?' selected':'')+'>'+v+(v===tot?' (все слова)':'')+'</option>'}).join("")+'</select>'+
      '<div class="done-row"><span class="muted">Слова: '+(SPEC.words||[]).slice(0,6).map(function(w){return '<span'+wcls(w.w)+'>'+esc(w.w)+'</span>'}).join(", ")+((SPEC.words||[]).length>6?" …":"")+'</span><button type="button" class="btn pri big" data-wt="start">Начать'+ic("arrow",18)+'</button></div></section>';
  }else{
    h+='<section class="card glass wt-setup"><h3>'+ic("pencil",20)+' Проверь себя</h3><p class="muted">'+n+' вопросов: '+ks.map(function(k){return KINDS[k].toLowerCase()}).join(", ")+'. Ответ сразу проверяется и не исправляется.'+(SPEC.min?' Время: '+SPEC.min+' мин.':' Без таймера.')+'</p>'+
      (HWC?'<p class="muted">Результат сохранится в домашке, а после «Сдать» уйдёт преподавателю.</p>':'')+
      '<div class="done-row"><span></span><button type="button" class="btn pri big" data-wt="start">Начать'+ic("arrow",18)+'</button></div></section>';
  }
  $("#app").innerHTML=h+'</main>';KR.topbar(MODE==="class"?"cabinet":"words");
}
function start(words){
  if(MODE==="class"){var ch=[].slice.call(document.querySelectorAll("[data-kind]")).filter(function(x){return x.checked}).map(function(x){return x.dataset.kind});if(ch.length)SPEC.kinds=ch}
  var nEl=$("#wtn"),n=words?words.length:nEl?+nEl.value:SPEC.n;
  QS=build(words,n);I=0;RES=[];
  if(!QS.length){$("#app").innerHTML=head()+'<main class="wt"><section class="card glass"><p>В тесте нет слов с переводом.</p></section></main>';return}
  T0=Date.now();clearInterval(tick);
  if(MODE==="self"&&SPEC.min&&!words)tick=setInterval(clock,1000);
  frame();show();
}
function frame(){
  $("#app").innerHTML=head()+'<main class="wt"><div class="wt-top"><span class="wt-score" id="wtsc"></span><span class="wt-clock" id="wtclock"></span></div>'+
    '<section class="card wt-q" id="wtq" aria-live="polite"></section></main>';
  score();clock();
}
function score(){var ok=RES.filter(function(r){return r&&r.ok}).length,bad=RES.filter(function(r){return r&&!r.ok}).length;
  var e=$("#wtsc");if(e)e.innerHTML=MODE==="class"?'<b class="g">'+ok+'</b> ✅ · <b class="r">'+bad+'</b> ❌':''}
function left(){return SPEC.min?Math.max(0,Math.round(SPEC.min*60-(Date.now()-T0)/1000)):0}
function clock(){var e=$("#wtclock");if(!e||MODE!=="self"||!SPEC.min||!tick)return;var l=left();e.textContent="⏱ "+Math.floor(l/60)+":"+String(l%60).padStart(2,"0");e.classList.toggle("low",l<=60);
  if(l<=0){clearInterval(tick);tick=null;for(var i=I;i<QS.length;i++)if(!RES[i])RES[i]={ok:false,given:""};finish()}}
function sayB(w,big){return '<button type="button" class="say'+(big?' wt-ear':'')+'" data-say="'+esc(w)+'" aria-label="Послушать">'+ic("volume",big?34:18)+'</button>'}
function promptHtml(q){
  if(q.k==="tr")return '<div class="wt-p"><span'+wcls(q.w.w)+'>'+esc(q.w.w)+'</span> '+sayB(q.w.w)+'</div>';
  if(q.k==="tf")return '<div class="wt-p"><span'+wcls(q.w.w)+'>'+esc(q.w.w)+'</span> '+sayB(q.w.w)+'</div><div class="wt-p wt-tr">= '+esc(q.shown)+' ?</div>';
  if(q.k==="aud"||q.k==="dic")return '<div class="wt-p wt-earp">'+sayB(q.w.w,true)+'<button type="button" class="wt-slow" data-slow="'+esc(q.w.w)+'">Медленно</button></div>'+
    (q.k==="dic"?'<p class="muted wt-et">'+(isKo(q.w.w)?'Слогов: ':'Букв: ')+unitsOf(q.w.w).length+(q.w.w.indexOf(" ")>=0?' · слов: '+q.w.w.split(/\s+/).length:'')+'</p>':'');
  if(q.k==="ctx")return '<div class="wt-p wt-ctx"><span'+wcls(q.w.ex)+'>'+esc(q.before)+'<b class="wt-blank">'+esc(blank(q.ans))+'</b>'+esc(q.after)+'</span></div>'+(q.w.et?'<p class="muted wt-et">'+esc(q.w.et)+'</p>':'');
  if(q.k==="ctc")return '<div class="wt-p wt-ctx"><span'+wcls(q.w.ex)+'>'+esc(q.before)+'<b class="wt-blank">＿＿＿</b>'+esc(q.after)+'</span></div>'+(q.w.et?'<p class="muted wt-et">'+esc(q.w.et)+'</p>':'');
  if(q.k==="fl"){var u=unitsOf(q.w.w);return '<div class="wt-p wt-tr">'+esc(q.w.t)+'</div><div class="wt-cells'+(isKo(q.w.w)?' ko':'')+'" aria-label="Первая буква '+esc(u[0])+', всего '+u.length+'">'+u.map(function(c,i){return '<i>'+(i===0?esc(c):'')+'</i>'}).join("")+'</div>'}
  if(q.k==="bld")return '<div class="wt-p wt-tr">'+esc(q.w.t)+'</div><div class="wt-cells'+(isKo(q.w.w)?' ko':'')+'" id="wtslots">'+q.tiles.map(function(c,i){return '<i>'+(q.pick[i]!=null?esc(q.tiles[q.pick[i]]):'')+'</i>'}).join("")+'</div>';
  if(q.k==="say")return '<div class="wt-p wt-tr">'+esc(q.w.t)+'</div><p class="muted wt-et">Скажи '+(isKo(q.w.w)?'по-корейски':'по-английски')+(isKo(q.w.w)?' · слогов: '+unitsOf(q.w.w).length:'')+'</p>'+(KR.ruNote?KR.ruNote('mic'):'');
  if(q.k==="mch")return '';
  return '<div class="wt-p wt-tr">'+esc(q.w.t)+'</div>';
}
function mchHtml(q){
  var col=function(side){return '<div class="wt-mcol">'+q[side].map(function(x,i){var key=side==="L"?x.w:x.t,done=q.got[x.w];
    return '<button type="button" data-mc="'+side+i+'" class="'+(done?'ok':'')+(side==="L"&&q.sel===i?' sel':'')+'"'+(done||locked?' disabled':'')+(side==="L"?wcls(x.w):'')+'>'+esc(key)+'</button>'}).join("")+'</div>'};
  return '<div class="wt-mch" id="wtmch">'+col("L")+col("R")+'</div>';
}
function show(){
  var q=QS[I];locked=false;score();
  var h='<div class="bar"><div style="width:'+Math.round(I/QS.length*100)+'%"></div></div><p class="muted wt-n">Вопрос '+(I+1)+' из '+QS.length+' · '+TASK[q.k]+'</p>'+promptHtml(q);
  if(isWrite(q)){var ko=isKo(q.ans);h+='<form class="wt-in" id="wtf" autocomplete="off"><input id="wta" class="name'+(ko?' ko':'')+'" lang="'+(ko?"ko":"en")+'" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Ответ"><button type="submit" class="btn pri">Проверить</button></form>'}
  else if(q.k==="bld")h+='<div class="wt-tiles'+(isKo(q.w.w)?' ko':'')+'" id="wttiles">'+q.tiles.map(function(c,i){return '<button type="button" data-tile="'+i+'"'+(q.pick.indexOf(i)>=0?' disabled':'')+'>'+esc(c)+'</button>'}).join("")+'</div><div class="wt-acts wt-l"><button type="button" data-wt="undo">⌫ Стереть</button></div>';
  else if(q.k==="mch")h+=mchHtml(q);
  else if(q.k==="say")h+='<div class="wt-earp"><button type="button" class="say wt-ear wt-mic" data-wt="mic" aria-label="Нажми и скажи слово">'+ic("mic",34)+'</button></div><p class="muted wt-et" id="wtmic" aria-live="polite">Нажми на микрофон и скажи слово. Две попытки.</p><div class="wt-acts wt-l"><button type="button" data-wt="say-type">Ответить текстом</button></div>';
  else h+='<div class="wt-opts'+(q.k==="tf"?' wt-tf':'')+'">'+q.opts.map(function(o,i){return '<button type="button" data-opt="'+i+'"'+wcls(o)+'><small>'+(i+1)+'</small>'+esc(o)+'</button>'}).join("")+'</div>';
  h+='<div class="wt-fb" id="wtfb" role="status"></div><div class="wt-acts">'+(MODE==="class"?'<button type="button" data-wt="reveal">👀 Показать ответ</button>':'<span></span>')+'<button type="button" class="btn pri" data-wt="next" hidden>Дальше'+ic("arrow",16)+'</button></div>';
  $("#wtq").innerHTML=h;
  var inp=$("#wta");if(inp)inp.focus({preventScroll:true});
  if(q.k==="aud"||q.k==="dic")setTimeout(function(){if(QS[I]===q&&!locked)KR.say(q.w.w,wl(q.w))},250);
}
// собери слово: нажатая буква встаёт в следующую клеточку; когда все клеточки заполнены, ответ проверяется
function tile(i){var q=QS[I];if(locked||q.k!=="bld"||q.pick.indexOf(i)>=0)return;q.pick.push(i);bldDraw(q);if(q.pick.length===q.tiles.length)answer(q.pick.map(function(j){return q.tiles[j]}).join(""),false)}
function bldDraw(q){var sl=$("#wtslots");if(sl)sl.innerHTML=q.tiles.map(function(c,i){return '<i>'+(q.pick[i]!=null?esc(q.tiles[q.pick[i]]):'')+'</i>'}).join("");
  [].forEach.call(document.querySelectorAll("#wttiles button"),function(b){b.disabled=locked||q.pick.indexOf(+b.dataset.tile)>=0})}
// пары: слово слева, потом перевод справа; ошибка отмечает оба слова пары
function mchTap(id){
  var q=QS[I];if(locked||q.k!=="mch")return;var side=id[0],i=+id.slice(1);
  if(side==="L"){q.sel=q.sel===i?null:i;$("#wtmch").outerHTML=mchHtml(q);var w0=q.L[i];if(q.sel!=null)KR.say(w0.w,wl(w0));return}
  if(q.sel==null){var fb=$("#wtfb");fb.className="wt-fb";fb.textContent="Сначала нажми на слово слева.";return}
  var a=q.L[q.sel],b=q.R[i];
  if(a===b||a.t===b.t){q.got[a.w]=1;q.sel=null;$("#wtmch").outerHTML=mchHtml(q);$("#wtfb").textContent="";
    if(q.ws.every(function(x){return q.got[x.w]}))answer("",false,!Object.keys(q.bad).length)}
  else{q.bad[a.w]=1;q.bad[b.w]=1;var fb2=$("#wtfb");fb2.className="wt-fb bad";fb2.textContent="Не пара, попробуй ещё.";
    var bt=document.querySelector('[data-mc="R'+i+'"]');if(bt){bt.classList.add("bad");setTimeout(function(){bt.classList.remove("bad")},600)}}
}
// скажи вслух: распознавание речи (js/ear.js), две попытки; «почти» на второй попытке — неверно, но видно, что услышали
async function micGo(b){
  var q=QS[I];if(locked||q.k!=="say"||q.busy)return;var st=$("#wtmic");q.busy=true;b.classList.add("on");if(st)st.textContent="Слушаю…";
  try{var alts=await EAR.recognize(wl(q.w),{accent:KR.accent&&KR.accent()});if(QS[I]!==q)return;
    var r=EAR.heard(alts,q.w.w,wl(q.w)),got="Услышали: «"+(r.best||alts[0])+"».";q.tries++;
    if(r.ok){if(st)st.textContent=got;return answer(r.best||alts[0],false,true)}
    if(q.tries>=2){if(st)st.textContent=got+(r.close?" Почти!":"");return answer(r.best||alts[0]||"",false,false)}
    if(st)st.textContent=got+" "+(r.close?"Почти. Послушай и скажи ещё раз.":"Попробуй ещё раз.");if(r.close)KR.say(q.w.w,wl(q.w));
  }catch(e){if(st)st.textContent=EAR.errText(e)||"Нажми на микрофон и скажи слово";if(!canMic()){q.k="wr";show()}}
  finally{q.busy=false;b.classList.remove("on")}
}
function answer(given,shown,force){
  if(locked)return;locked=true;var q=QS[I],ok=!shown&&(force!==undefined?!!force:okAns(q,given));RES[I]={ok:ok,given:shown?null:given};
  if(q.k==="mch"){RES[I].bad=shown?q.ws.map(function(x){return x.w}):Object.keys(q.bad);q.ws.forEach(function(x){q.got[x.w]=1});q.sel=null;var mm=$("#wtmch");if(mm)mm.outerHTML=mchHtml(q)}
  if(q.k==="bld"){if(shown)q.pick=q.tiles.map(function(c,i){return i});bldDraw(q);var sl=$("#wtslots");if(sl)sl.classList.add(ok?"ok":"bad")}
  [].forEach.call(document.querySelectorAll('[data-wt="undo"],[data-wt="mic"],[data-wt="say-type"]'),function(b){b.disabled=true});
  [].forEach.call(document.querySelectorAll(".wt-opts button"),function(b){b.disabled=true;var o=QS[I].opts[+b.dataset.opt];if(o===q.ans)b.classList.add("ok");else if(!shown&&o===given)b.classList.add("bad")});
  var inp=$("#wta");if(inp){inp.disabled=true;if(shown)inp.value=q.ans;inp.classList.add(ok?"ok":"bad")}
  var fb=$("#wtfb");fb.className="wt-fb "+(ok?"ok":"bad");
  if(q.k==="mch")fb.innerHTML=(ok?"✅ Все пары верно":shown?"👀 Пары":"❌ Были ошибки: "+RES[I].bad.map(function(w){return '<b'+wcls(w)+'>'+esc(w)+'</b>'}).join(", "))+
    '<div class="wt-ex">'+q.ws.map(function(x){return '<span'+wcls(x.w)+'>'+esc(x.w)+'</span> — '+esc(x.t)}).join("<br>")+'</div>';
  else fb.innerHTML=(ok?"✅ ":shown?"👀 ":"❌ Верно: ")+'<b'+wcls(q.w.w)+'>'+esc(q.w.w)+'</b> — '+esc(q.w.t)+' <button type="button" class="say" data-say="'+esc(q.w.w)+'" aria-label="Послушать">'+ic("volume",16)+'</button>'+
    (q.w.ex&&q.k!=="ctx"?'<div class="wt-ex"><span'+wcls(q.w.ex)+'>'+esc(q.w.ex)+'</span>'+(q.w.et?' <span class="muted">— '+esc(q.w.et)+'</span>':'')+'</div>':q.k==="ctx"&&!ok?'<div class="wt-ex muted">В предложении: '+esc(q.ans)+'</div>':'');
  if(MODE==="class"&&canSend())qWords(q).forEach(function(x){fb.insertAdjacentHTML("beforeend",sendRow(x.w,q.k==="mch"?RES[I].bad.indexOf(x.w)<0:ok,q.ws?x.w:""))});
  if(!ok&&!shown&&q.k!=="mch")KR.say(q.w.w,wl(q.w));
  var r=$('[data-wt="reveal"]');if(r)r.hidden=true;var f=$("#wtf button");if(f)f.hidden=true;
  var n=$('[data-wt="next"]');n.hidden=false;n.textContent="";n.insertAdjacentHTML("beforeend",(I+1<QS.length?"Дальше":"Итог")+ic("arrow",16));n.focus({preventScroll:true});
  score();
}
// ---------- словарь ученика ----------
/* верно ли ответил на слово w в вопросе i: в «парах» — не было ли ошибок именно с этим словом */
function wordOk(q,i,w){var r=RES[i];if(!r)return false;if(q.k==="mch")return r.given!==null&&(r.bad||[]).indexOf(w)<0;return !!r.ok}
function teacherDev(){return !!(KR.ctx&&KR.ctx.teacher)}
function canSend(){return teacherDev()?!!(SPEC&&SPEC.who):!!(KR.vocab&&KR.user())}
var SENDN={auto:"авто",today:"сегодня",tom:"завтра"};
function sendRow(w,ok,label){
  var ch=CH[w]||"auto";
  return '<div class="wt-send" data-w="'+esc(w)+'"><span class="muted">'+(label?'<b'+wcls(label)+'>'+esc(label)+'</b>:':'Вернуть слово:')+'</span>'+["auto","today","tom"].map(function(k){
    return '<button type="button" data-ws="'+k+'" class="'+(ch===k?"sel":"")+'" aria-pressed="'+(ch===k)+'" title="'+(k==="auto"?(ok?"по расписанию":"интервал сократится, слово придёт сегодня"):k==="today"?"заново, как после «Снова»":"повторить завтра")+'">'+SENDN[k]+(k==="auto"?(ok?" · по плану":" · раньше"):"")+'</button>'}).join("")+'</div>';
}
/* Записать результат теста в расписание слов. Слово меняется один раз за тест; выбор «сегодня» или «завтра»,
   сделанный позже (в «Повторить ошибки»), заменяет «авто». Возвращает текст для итога. */
async function applyWords(){
  var lang=SPEC.lang||"ko",by={};
  var LW={};QS.forEach(function(q){qWords(q).forEach(function(x){LW[x.w]=wl(x)})});
  QS.forEach(function(q,i){qWords(q).forEach(function(x){var w=x.w,ok=wordOk(q,i,w);by[w]=by[w]===false?false:ok})});
  var todo=Object.keys(by).filter(function(w){var ch=CH[w]||"auto";return !DONE[w]||(ch!=="auto"&&DONE[w]!==ch)});
  if(!todo.length)return SUM;
  var now=Date.now(),cards={},out=[],n={today:0,tom:0,back:0,rev:0,none:0,miss:0};
  if(teacherDev()){var list=await KR.api("teacher_vocab",{p_student:SPEC.who});(list||[]).forEach(function(c){if(c&&c.id)cards[c.id]=c})}
  else ["ko","en"].forEach(function(lg){KR.vocab.all(lg).forEach(function(c){cards[c.id]=c})});
  todo.forEach(function(w){
    var c=cards[SRS.id(LW[w]||lang,w)],ch=CH[w]||"auto";DONE[w]=ch;
    if(!c){n.miss++;return}
    if(ch!=="auto"){out.push({c:SRS.send(c,ch,null,now),ch:ch});n[ch]++;return}
    var x=SRS.practice(c,by[w],null,now);if(!x){n.none++;return}
    out.push({c:x,ch:"auto"});if(by[w])n.rev++;else n.back++;
  });
  if(out.length){
    if(teacherDev())await KR.api("teacher_vocab_put",{p_student:SPEC.who,p_words:out.map(function(x){return x.c})});
    else{var tl=out.filter(function(x){return x.ch!=="auto"});
      ["today","tom"].forEach(function(k){var ids=tl.filter(function(x){return x.ch===k}).map(function(x){return x.c.id});if(ids.length)KR.vocab.send(ids,k)});
      var res={};out.filter(function(x){return x.ch==="auto"}).forEach(function(x){res[x.c.id]=by[x.c.w]});KR.vocab.practice(res)}
  }
  var parts=[];
  if(n.today)parts.push("сегодня (заново): "+n.today);if(n.tom)parts.push("завтра: "+n.tom);if(n.back)parts.push("интервал сокращён, вернутся сегодня: "+n.back);
  if(n.rev)parts.push("засчитано как повторение: "+n.rev);if(n.miss)parts.push("нет в словаре: "+n.miss);
  SUM=(SUM?SUM+" · ":"")+(parts.length?parts.join(" · "):"расписание не изменилось");
  return SUM;
}
function sumBox(){
  if(MODE!=="class"||!canSend())return "";
  var who=teacherDev()?"Словарь ученика"+(SPEC.who?" ("+esc(SPEC.who)+")":""):"Твой словарь";
  return '<p class="muted wt-sum" id="wtsum">'+who+': записываем…</p>';
}
async function runApply(){
  var e=$("#wtsum");if(!e)return;
  try{var t=await applyWords();e.textContent=(teacherDev()?"Словарь ученика":"Твой словарь")+": "+t+"."}
  catch(x){DONE={};e.textContent=x&&x.status===404?"Расписание слов не записано: выполните в Supabase файл supabase/vocab.sql (функция teacher_vocab_put).":"Не получилось записать в словарь: "+(x&&x.message||"нет связи")+". Нажмите «Записать ещё раз».";
    e.insertAdjacentHTML("beforeend",' <button type="button" data-wt="apply">Записать ещё раз</button>')}
}
function next(){if(!locked)return;I++;if(I>=QS.length)finish();else show()}
function finish(){
  clearInterval(tick);tick=null;
  var ok=RES.filter(function(r){return r&&r.ok}).length,bad=QS.map(function(q,i){return [q,RES[i]||{ok:false,given:""}]}).filter(function(x){return !x[1].ok});
  var grp={};QS.forEach(function(q,i){qWords(q).forEach(function(x){if(!x.g)return;var g=grp[x.g]=grp[x.g]||{ok:0,n:0};g.n++;if(wordOk(q,i,x.w))g.ok++})});
  var gtx=Object.keys(grp).length>1?'<p class="muted wt-grp">'+Object.keys(grp).map(function(k){return (GN[k]||k)+': '+grp[k].ok+' из '+grp[k].n}).join(" · ")+'</p>':"";
  if(MODE==="self")saveSelf(ok,bad);
  var h='<section class="card wt-done"><h3>🎯 '+ok+' / '+QS.length+'</h3>'+gtx+sumBox()+(MODE==="self"&&SUM?'<p class="muted wt-sum">'+esc(SUM)+'</p>':'')+(bad.length?'<p class="muted">Повторить:</p><table class="wt-res">'+bad.map(function(x){var q=x[0],r=x[1];
    if(q.k==="mch")return q.ws.filter(function(y){return (r.bad||[]).indexOf(y.w)>=0||r.given==null}).map(function(y){return '<tr><td><b'+wcls(y.w)+'>'+esc(y.w)+'</b></td><td>'+esc(y.t)+'</td><td class="muted">'+(r.given==null?"👀 показан":"пары")+'</td></tr>'}).join("");
    return '<tr><td><b'+wcls(q.w.w)+'>'+esc(q.w.w)+'</b></td><td>'+esc(q.w.t)+'</td><td class="muted">'+(r.given==null?"👀 показан":r.given===""?"нет ответа":'<s>'+esc(r.given)+'</s>')+(KINDS[q.k]?' · '+KINDS[q.k].toLowerCase():'')+'</td></tr>'}).join("")+'</table>':'<p>🎉 Без ошибок!</p>');
  h+='<div class="wt-acts">';
  if(HWC)h+='<span class="muted">Результат сохранён в домашке.</span><a class="btn pri" href="'+esc(SPEC.back)+'">Вернуться к домашке'+ic("arrow",16)+'</a>';
  else h+=(bad.length?'<button type="button" class="btn pri" data-wt="again-bad">🔁 Повторить ошибки</button>':'')+'<button type="button" data-wt="restart">Сначала</button>';
  $("#wtq").outerHTML=h+'</div></section>';score();
  var c=$("#wtclock");if(c)c.textContent="";
  if(MODE==="class"&&canSend())runApply();
}
// самостоятельно: интервалы слов ученика и результат домашки
function saveSelf(ok,bad){
  if(KR.vocab&&!(KR.ctx&&KR.ctx.teacher)){var res={};QS.forEach(function(q,i){qWords(q).forEach(function(x){var c=KR.vocab.find(wl(x),x.w);if(c)res[c.id]=res[c.id]===false?false:wordOk(q,i,x.w)})});
    /* тест — одна сессия: слова без единой ошибки получают +1 день к повторению (KR.vocab.sessEnd) */
    try{if(KR.vocab.sessStart)KR.vocab.sessStart();var pr=KR.vocab.practice(res),pb=KR.vocab.sessEnd?KR.vocab.sessEnd():[],pt=[];if(pr.back.length)pt.push("вернутся на повторение сегодня: "+pr.back.length);if(pr.done.length)pt.push("засчитано как повторение: "+pr.done.length);
      if(pb.length)pt.push("без ошибок, повторение на день позже: "+pb.length);
      SUM=pt.length?"В словаре: "+pt.join(" · ")+".":""}catch(e){}}
  if(!HWC)return;
  var k="kr_progress:"+KR.user()+":hw-"+HWC.rec.id,P={};try{P=JSON.parse(localStorage.getItem(k)||"{}")}catch(e){}
  var prev=P[HWC.key]||{},wr=bad.slice(0,30).map(function(x){var q=x[0],r=x[1];return {q:String(qText(q)).slice(0,200),g:String(r.given==null?"":r.given).slice(0,100),a:String(q.ans).slice(0,100)}});
  P[HWC.key]={done:ok===QS.length,score:ok,total:QS.length,tries:(prev.tries||0)+1,t:Date.now(),wrong:wr,sec:Math.round((Date.now()-T0)/1000)};
  try{localStorage.setItem(k,JSON.stringify(P))}catch(e){}
  KR.push();
}
function gone(){
  $("#app").innerHTML='<main style="padding-top:30px"><div class="card glass"><h3>Тест недоступен</h3><p class="muted">'+(Q.get("hw")?'Домашку уже сдали или преподаватель её убрал.':'Тест не найден. Откройте его заново со страницы, где его собрали.')+'</p><a class="btn pri" href="cabinet.html">В кабинет'+ic("arrow",16)+'</a></div></main>';
  KR.topbar("cabinet");
}

// ---------- события ----------
document.addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b)return;var d=b.dataset;
  if(d.say!==undefined)return KR.say(d.say,isKo(d.say)?"ko":SPEC&&SPEC.lang||"en");
  if(d.opt!==undefined&&!locked){var q=QS[I];return answer(q.opts[+d.opt],false)}
  if(d.wt==="start")return start();
  if(d.ws){var row=b.closest(".wt-send");if(!row)return;CH[row.dataset.w]=d.ws;[].forEach.call(row.querySelectorAll("button"),function(x){var on=x.dataset.ws===d.ws;x.classList.toggle("sel",on);x.setAttribute("aria-pressed",on)});return}
  if(d.wt==="apply"){var ap=b.closest("p");b.remove();if(ap)ap.textContent="Записываем…";return runApply()}
  if(d.wt==="reveal")return answer(null,true);
  if(d.wt==="next")return next();
  if(d.wt==="restart"){clearInterval(tick);tick=null;return setup()}
  if(d.wt==="again-bad"){var w=[],seen={};QS.forEach(function(q,i){qWords(q).forEach(function(x){if(!wordOk(q,i,x.w)&&!seen[x.w]){seen[x.w]=1;w.push(x)}})});return start(w)}
  if(d.slow!==undefined){var q0=QS[I];return KR.say(d.slow,isKo(d.slow)?"ko":wl(q0&&q0.w),{rate:Math.max(.5,(KR.rate?KR.rate():1)*.7)})}
  if(d.tile!==undefined)return tile(+d.tile);
  if(d.wt==="undo"){var qb=QS[I];if(!locked&&qb&&qb.k==="bld"&&qb.pick.length){qb.pick.pop();bldDraw(qb)}return}
  if(d.mc)return mchTap(d.mc);
  if(d.wt==="mic")return micGo(b);
  if(d.wt==="say-type"){var qs=QS[I];if(!locked&&qs){qs.k="wr";show()}return}
});
document.addEventListener("submit",function(e){if(e.target.id!=="wtf")return;e.preventDefault();var a=($("#wta").value||"").trim();if(a)answer(a,false)});
document.addEventListener("keydown",function(e){
  if(!QS.length||!$("#wtq"))return;
  if(e.key==="Enter"&&locked){e.preventDefault();return next()}
  if(!locked&&/^[1-4]$/.test(e.key)&&!$("#wta")){var q=QS[I];if(q.opts&&q.opts[+e.key-1]!=null){e.preventDefault();answer(q.opts[+e.key-1],false)}}
});

(async function(){
  if(!KR.require())return;
  KR.topbar(MODE==="class"?"cabinet":"words");
  await KR.load();
  SPEC=await loadSpec();
  if(!SPEC||SPEC.gone||!(SPEC.words||[]).length)return gone();
  KR.theme&&KR.theme(SPEC.lang||"ko");
  document.title=(MODE==="class"?"На уроке · ":"Тест · ")+SPEC.title;
  setup();
})();
})();
