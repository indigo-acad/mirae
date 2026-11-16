/* MIRAÉ · тест по словам: в начале урока с учителем или самостоятельно (страница test.html).
   Режимы (?mode=):
   - class — с учителем, как тесты «на уроке» (en-test-band9-class): вопрос на экране, ответ сразу проверяется,
     «Показать ответ», «Дальше», счёт ✅/❌, в конце ошибки и «Повторить ошибки». Без таймера. Клавиши: 1–4 — вариант, Enter — дальше;
   - self — самостоятельно: ответ сразу проверяется и не исправляется, может быть таймер. Ответы сдвигают повторение слов
     в словаре ученика (KR.vocab.practice), а тест из домашки записывает результат в ответы домашки.
   Откуда слова: ?id=<ключ> — тест собрал преподаватель (localStorage kr_wtest:<ключ>); ?l=<урок> — слова урока;
   ?hw=<номер>&k=<блок> — тест из домашки.
   Вопросы: tr — слово → перевод (выбор); rev — перевод → слово (выбор); ctx — вставить слово в предложение (видны первые
   буквы или первый слог); wr — написать слово по переводу. */
(function(){
"use strict";
var KR=window.KR;if(!KR)return;
var Q=new URLSearchParams(location.search),$=function(s){return document.querySelector(s)},esc=KR.esc,ic=KR.icon;
var KINDS={tr:"Перевод (выбор)",rev:"Слово по переводу (выбор)",ctx:"Вставь в предложение",wr:"Напиши слово"};
var TASK={tr:"Выбери перевод.",rev:"Выбери слово.",ctx:"Вставь слово в предложение. Видны первые буквы, черта — буква (в корейском — слог).",wr:"Напиши слово по переводу."};
var MODE=Q.get("mode")==="class"?"class":"self";
var SPEC=null,QS=[],I=0,RES=[],locked=false,T0=0,tick=null,HWC=null;
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
function norm(s){return String(s==null?"":s).normalize("NFC").toLowerCase().replace(/[’']/g,"").replace(/[\s.,!?…«»"()\-–—]/g,"")}
var isKo=function(s){return /[ㄱ-ㆎ가-힣]/.test(s)};
var wcls=function(s){return isKo(s)?' class="ko" lang="ko"':""};

async function loadSpec(){
  var id=Q.get("id"),l=Q.get("l"),hw=Q.get("hw");
  if(id){try{return JSON.parse(localStorage.getItem("kr_wtest:"+id)||"null")}catch(e){return null}}
  if(l){var L=(window.LESSONS||{})[l];if(!L)return null;
    return {title:"Слова урока · "+L.title,sub:L.course,lang:L.lang||"ko",words:KR.lessonWords(L),kinds:["tr","rev","ctx","wr"],n:15,min:0,back:"lesson.html?l="+encodeURIComponent(l),backT:"урок"}}
  if(hw){
    var list=await KR.homework(),rec=list&&list.find(function(x){return String(x.id)===String(hw)}),k=Q.get("k")||"",idx=+(k.split("-")[1]);
    var it=rec&&rec.items&&rec.items[idx];
    if(!rec||rec.status!=="active"||!it||!it.wt)return {gone:true,hw:hw};
    HWC={rec:rec,key:k};
    return {title:it.wt.title||"Тест по словам",sub:"домашка",lang:it.wt.lang||rec.lang||"ko",words:it.wt.w||[],kinds:it.wt.k,n:(it.wt.w||[]).length,min:it.wt.min||0,back:"lesson.html?hw="+encodeURIComponent(rec.id),backT:"домашка"};
  }
  return null;
}

// ---------- вопросы ----------
function canCtx(w){var f=w.f||w.w;return !!(w.ex&&f&&w.ex.indexOf(f)>=0)}
function blank(f){
  if(isKo(f))return Array.from(f).map(function(c,i){return i===0||!isKo(c)?c:"＿"}).join("");
  return f.split(" ").map(function(p){return Array.from(p).map(function(c,i){return i===0||c==="-"?c:"_"}).join(" ")}).join("   ");
}
function makeQ(w,k,pool){
  if((k==="tr"||k==="rev")&&pool.length<2)k="wr";
  if(k==="ctx"&&!canCtx(w))k=pool.length>=2?"tr":"wr";
  var others=shuffle(pool.filter(function(x){return x.w!==w.w&&(k!=="tr"||(x.t&&x.t!==w.t))})).slice(0,3);
  if(k==="tr")return {k:k,w:w,ans:w.t,opts:shuffle([w.t].concat(others.map(function(x){return x.t})))};
  if(k==="rev")return {k:k,w:w,ans:w.w,opts:shuffle([w.w].concat(others.map(function(x){return x.w})))};
  if(k==="ctx"){var f=w.f||w.w,i=w.ex.indexOf(f);return {k:k,w:w,ans:f,before:w.ex.slice(0,i),after:w.ex.slice(i+f.length)}}
  return {k:"wr",w:w,ans:w.w};
}
function kinds(){var a=(SPEC.kinds||[]).filter(function(k){return KINDS[k]});return a.length?a:["tr","rev","ctx","wr"]}
function build(words,n){
  var pool=(SPEC.words||[]).filter(function(w){return w&&w.w&&w.t}),ks=kinds();
  words=(words||pool).filter(function(w){return w&&w.w&&w.t});
  return shuffle(words).slice(0,Math.min(n||words.length,words.length)).map(function(w,i){return makeQ(w,ks[i%ks.length],pool)});
}
var isWrite=function(q){return q.k==="ctx"||q.k==="wr"};
function okAns(q,a){if(a==null)return false;if(!isWrite(q))return a===q.ans;return norm(a)===norm(q.ans)||(q.k==="ctx"&&norm(a)===norm(q.w.w))}
var qText=function(q){return q.k==="tr"?q.w.w:q.k==="ctx"?q.before+"(…)"+q.after:q.w.t};

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
function promptHtml(q){
  if(q.k==="tr")return '<div class="wt-p"><span'+wcls(q.w.w)+'>'+esc(q.w.w)+'</span> <button type="button" class="say" data-say="'+esc(q.w.w)+'" aria-label="Послушать">'+ic("volume",18)+'</button></div>';
  if(q.k==="ctx")return '<div class="wt-p wt-ctx"><span'+wcls(q.w.ex)+'>'+esc(q.before)+'<b class="wt-blank">'+esc(blank(q.ans))+'</b>'+esc(q.after)+'</span></div>'+(q.w.et?'<p class="muted wt-et">'+esc(q.w.et)+'</p>':'');
  return '<div class="wt-p wt-tr">'+esc(q.w.t)+'</div>';
}
function show(){
  var q=QS[I];locked=false;score();
  var h='<div class="bar"><div style="width:'+Math.round(I/QS.length*100)+'%"></div></div><p class="muted wt-n">Вопрос '+(I+1)+' из '+QS.length+' · '+TASK[q.k]+'</p>'+promptHtml(q);
  if(isWrite(q))h+='<form class="wt-in" id="wtf" autocomplete="off"><input id="wta" class="name'+(isKo(q.ans)?' ko':'')+'" lang="'+(isKo(q.ans)?"ko":"en")+'" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Ответ"><button type="submit" class="btn pri">Проверить</button></form>';
  else h+='<div class="wt-opts">'+q.opts.map(function(o,i){return '<button type="button" data-opt="'+i+'"'+wcls(o)+'><small>'+(i+1)+'</small>'+esc(o)+'</button>'}).join("")+'</div>';
  h+='<div class="wt-fb" id="wtfb" role="status"></div><div class="wt-acts">'+(MODE==="class"?'<button type="button" data-wt="reveal">👀 Показать ответ</button>':'<span></span>')+'<button type="button" class="btn pri" data-wt="next" hidden>Дальше'+ic("arrow",16)+'</button></div>';
  $("#wtq").innerHTML=h;
  var inp=$("#wta");if(inp)inp.focus({preventScroll:true});
}
function answer(given,shown){
  if(locked)return;locked=true;var q=QS[I],ok=!shown&&okAns(q,given);RES[I]={ok:ok,given:shown?null:given};
  [].forEach.call(document.querySelectorAll(".wt-opts button"),function(b){b.disabled=true;var o=QS[I].opts[+b.dataset.opt];if(o===q.ans)b.classList.add("ok");else if(!shown&&o===given)b.classList.add("bad")});
  var inp=$("#wta");if(inp){inp.disabled=true;if(shown)inp.value=q.ans;inp.classList.add(ok?"ok":"bad")}
  var fb=$("#wtfb");fb.className="wt-fb "+(ok?"ok":"bad");
  fb.innerHTML=(ok?"✅ ":shown?"👀 ":"❌ Верно: ")+'<b'+wcls(q.w.w)+'>'+esc(q.w.w)+'</b> — '+esc(q.w.t)+' <button type="button" class="say" data-say="'+esc(q.w.w)+'" aria-label="Послушать">'+ic("volume",16)+'</button>'+
    (q.w.ex&&q.k!=="ctx"?'<div class="wt-ex"><span'+wcls(q.w.ex)+'>'+esc(q.w.ex)+'</span>'+(q.w.et?' <span class="muted">— '+esc(q.w.et)+'</span>':'')+'</div>':q.k==="ctx"&&!ok?'<div class="wt-ex muted">В предложении: '+esc(q.ans)+'</div>':'');
  var r=$('[data-wt="reveal"]');if(r)r.hidden=true;var f=$("#wtf button");if(f)f.hidden=true;
  var n=$('[data-wt="next"]');n.hidden=false;n.textContent="";n.insertAdjacentHTML("beforeend",(I+1<QS.length?"Дальше":"Итог")+ic("arrow",16));n.focus({preventScroll:true});
  score();
}
function next(){if(!locked)return;I++;if(I>=QS.length)finish();else show()}
function finish(){
  clearInterval(tick);tick=null;
  var ok=RES.filter(function(r){return r&&r.ok}).length,bad=QS.map(function(q,i){return [q,RES[i]||{ok:false,given:""}]}).filter(function(x){return !x[1].ok});
  if(MODE==="self")saveSelf(ok,bad);
  var h='<section class="card wt-done"><h3>🎯 '+ok+' / '+QS.length+'</h3>'+(bad.length?'<p class="muted">Повторить:</p><table class="wt-res">'+bad.map(function(x){var q=x[0],r=x[1];return '<tr><td><b'+wcls(q.w.w)+'>'+esc(q.w.w)+'</b></td><td>'+esc(q.w.t)+'</td><td class="muted">'+(r.given==null?"👀 показан":r.given===""?"нет ответа":'<s>'+esc(r.given)+'</s>')+'</td></tr>'}).join("")+'</table>':'<p>🎉 Без ошибок!</p>');
  h+='<div class="wt-acts">';
  if(HWC)h+='<span class="muted">Результат сохранён в домашке.</span><a class="btn pri" href="'+esc(SPEC.back)+'">Вернуться к домашке'+ic("arrow",16)+'</a>';
  else h+=(bad.length?'<button type="button" class="btn pri" data-wt="again-bad">🔁 Повторить ошибки</button>':'')+'<button type="button" data-wt="restart">Сначала</button>';
  $("#wtq").outerHTML=h+'</div></section>';score();
  var c=$("#wtclock");if(c)c.textContent="";
}
// самостоятельно: интервалы слов ученика и результат домашки
function saveSelf(ok,bad){
  if(KR.vocab&&!(KR.ctx&&KR.ctx.teacher)){var res={};QS.forEach(function(q,i){var c=KR.vocab.find(SPEC.lang||"ko",q.w.w);if(c)res[c.id]=res[c.id]===false?false:!!(RES[i]&&RES[i].ok)});try{KR.vocab.practice(res)}catch(e){}}
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
  if(d.wt==="reveal")return answer(null,true);
  if(d.wt==="next")return next();
  if(d.wt==="restart"){clearInterval(tick);tick=null;return setup()}
  if(d.wt==="again-bad"){var w=QS.filter(function(q,i){return !(RES[i]&&RES[i].ok)}).map(function(q){return q.w});return start(w)}
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
