/* MIRAÉ · блоки личного кабинета ученика: «Продолжить», «Слова и домашка», «Путь по курсу», план «Сегодня / Неделя»,
   фраза дня, сложные слова, совет. Только разметка из настоящих данных (уроки, словарь, журнал повторений, домашка);
   события вешает сам модуль. Ночью путь и слова рисуются звёздами, днём — солнцами и цветами (обе формы в разметке,
   нужную показывает css/style.css по теме). Подключать после common.js, srs.js и vocab.js.

   KR.cab.html(o) → строка. o: {who, lang, pct, sub, name, stages:[{name, done}], next:{href, kicker, title, meta, pct}, hw:[…] | null}
   KR.cab.bind(root) — переключатели плана и перевода фразы. */
(function(){
"use strict";
var KR=window.KR;if(!KR)return;
var esc=KR.esc;
function plural(n,a,b,c){return n%10===1&&n%100!==11?a:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?b:c}
function day0(t){var d=new Date(t);d.setHours(0,0,0,0);return d}
function key(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function wlog(){try{return JSON.parse(localStorage.getItem("kr_wlog:"+KR.user())||"{}")||{}}catch(e){return {}}}
var view={period:"day",tr:false};   // состояние переключателей держится, пока открыта страница

/* ---------- значки: звезда (ночь) / солнце и цветок (день) ---------- */
var STAR='M12 0C12.9 7.6 16.4 11.1 24 12C16.4 12.9 12.9 16.4 12 24C11.1 16.4 7.6 12.9 0 12C7.6 11.1 11.1 7.6 12 0Z';
var RAYS='M12 1v3.2M12 19.8V23M1 12h3.2M19.8 12H23M4.2 4.2l2.3 2.3M17.5 17.5l2.3 2.3M4.2 19.8l2.3-2.3M17.5 6.5l2.3-2.3';
function mark(state,size){   // state: done | cur | todo
  return '<svg class="cb-mk '+state+'" viewBox="0 0 24 24" width="'+size+'" height="'+size+'" aria-hidden="true">'+
    '<path class="n" d="'+STAR+'"/><g class="d"><path class="r" d="'+RAYS+'"/><circle cx="12" cy="12" r="5.6"/></g></svg>';
}
function bloom(state){   // слова: l — выучено, w — в работе, n — новые
  var p=[[0,-4.6],[4.37,-1.42],[2.7,3.72],[-2.7,3.72],[-4.37,-1.42]].map(function(x){return '<circle cx="'+(12+x[0])+'" cy="'+(12+x[1])+'" r="3.5"/>'}).join("");
  return '<svg class="cb-bl bl-'+state+'" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path class="n" d="'+STAR+'"/><g class="d">'+p+'<circle class="c" cx="12" cy="12" r="2.2"/></g></svg>';
}

/* ---------- фраза дня и совет: по дню года ---------- */
var PHRASES={
  ko:[["천 리 길도 한 걸음부터","Дорога в тысячу ли начинается с одного шага."],["시작이 반이다","Начать — значит сделать половину дела."],
    ["티끌 모아 태산","Из пылинок собирается гора."],["고생 끝에 낙이 온다","После трудностей приходит радость."],
    ["백지장도 맞들면 낫다","Даже лист бумаги легче поднимать вдвоём."],["가는 말이 고와야 오는 말이 곱다","Как аукнется, так и откликнется."],
    ["원숭이도 나무에서 떨어진다","И обезьяна падает с дерева: ошибаются все."],["배움에는 끝이 없다","Учению нет конца."],
    ["하늘이 무너져도 솟아날 구멍이 있다","Даже если рухнет небо, найдётся выход."],["낮말은 새가 듣고 밤말은 쥐가 듣는다","Днём слова слышат птицы, ночью — мыши."]],
  en:[["Every cloud has a silver lining.","Нет худа без добра."],["Practice makes perfect.","Повторение — мать учения."],
    ["Rome wasn't built in a day.","Москва не сразу строилась."],["Better late than never.","Лучше поздно, чем никогда."],
    ["Actions speak louder than words.","Дела говорят громче слов."],["Where there's a will, there's a way.","Где есть желание, найдётся и способ."],
    ["Slow and steady wins the race.","Тише едешь — дальше будешь."],["Little by little, one travels far.","Понемногу можно уйти далеко."],
    ["Knowledge is power.","Знание — сила."],["The early bird catches the worm.","Кто рано встаёт, тому бог подаёт."]]
};
var TIPS=["Десять минут каждый день дают больше, чем час раз в неделю.","Повторяй слова вслух: так они запоминаются быстрее.",
  "Ошибка в упражнении возвращает слово на повторение — это нормально, так и должно быть.",
  "Выдели незнакомое слово в уроке — его можно сразу перевести и добавить в словарь.",
  "Сначала повтори старые слова, потом бери новые: так легче удержать всё в голове.",
  "Сложные слова лучше повторять в несколько коротких подходов, а не за один раз."];
function hasKo(){try{return KR.langs().indexOf("ko")>=0}catch(e){return false}}   // истории — только у кого открыт корейский
function doy(){var n=new Date(),s=new Date(n.getFullYear(),0,0);return Math.floor((n-s)/864e5)}

/* ---------- данные ---------- */
function words(lang){
  if(!KR.vocab)return null;
  var all=KR.vocab.all(lang),L=0,W=0,N=0;
  all.forEach(function(c){if(c.st===2)L++;else if(c.st===1||c.st===3)W++;else N++});
  var hard=all.map(function(c){return {c:c,e:(c.lap||0)+(c.pe||0)}}).filter(function(x){return x.e>0})
    .sort(function(a,b){return b.e-a.e}).slice(0,4).map(function(x){return {w:x.c.w,t:String(x.c.t||"").split(/[;,]/)[0].trim(),e:x.e}});
  var p=KR.vocab.plan(lang);
  return {total:all.length,L:L,W:W,N:N,hard:hard,due:p.fresh.length+p.learn.length+p.soon.length+p.rev.length,fresh:p.fresh.length};
}
function streak(){
  var L=wlog(),n=0,d=day0(Date.now());
  if(!L[key(d)])d.setDate(d.getDate()-1);   // сегодня ещё не занимался — серия не прерывается до конца дня
  while(L[key(d)]){n++;d.setDate(d.getDate()-1)}
  return n;
}

/* ---------- блоки ---------- */
function nextCard(o){
  if(!o.next)return "";var n=o.next;
  return '<a class="cb-next card glass" href="'+esc(n.href)+'"><span class="cb-art" aria-hidden="true"></span><span class="cb-tx">'+
    '<span class="cb-k">Продолжить · '+esc(n.kicker)+'</span><b class="cb-t">'+n.title+'</b><span class="cb-m">'+esc(n.meta)+'</span>'+
    (n.pct!=null?'<span class="cb-bar"><i style="width:'+n.pct+'%"></i></span>':"")+
    '<span class="cb-go">'+(n.pct?"Продолжить":"Начать")+KR.icon("arrow",17)+"</span></span></a>";
}
function wordsHw(o,W,HW){
  var h='<section class="cb-wh card glass" aria-label="Слова и домашка"><div class="cb-h"><h3>Слова и домашка</h3><a href="words.html">Словарь</a></div>';
  if(W&&W.total){
    var per=Math.max(1,Math.ceil(W.total/15)),nL=Math.round(W.L/per),nW=Math.round(W.W/per),nN=Math.max(0,Math.min(15,Math.ceil(W.total/per))-nL-nW),ic="";
    for(var i=0;i<nL;i++)ic+=bloom("l");for(i=0;i<nW;i++)ic+=bloom("w");for(i=0;i<nN;i++)ic+=bloom("n");
    h+='<div class="cb-sub" role="img" aria-label="Слова: выучено '+W.L+', в работе '+W.W+', новых '+W.N+'"><div class="cb-row"><b>Слова</b><span><em>'+W.L+'</em> / '+W.total+' выучено</span></div>'+
      '<div class="cb-ic" aria-hidden="true">'+ic+'</div><div class="cb-leg" aria-hidden="true"><span>'+bloom("l")+'<b>'+W.L+'</b> выучено</span><span>'+bloom("w")+'<b>'+W.W+'</b> в работе</span><span>'+bloom("n")+'<b>'+W.N+'</b> новых</span>'+
      '<span class="cb-note">'+(per>1?'один значок ≈ '+per+' '+plural(per,"слово","слова","слов"):"один значок — одно слово")+'</span></div></div>';
    h+='<div class="cb-acts"><a class="btn pri" href="words.html#day">'+(W.due?"Повторить "+W.due:"Учить слова")+KR.icon("arrow",15)+"</a>"+(KR.wexport?'<button type="button" class="btn" data-wexp>'+KR.icon("abc",15)+"Список слов</button>":"")+"</div>";
  }else{
    var em="";for(var q=0;q<15;q++)em+=bloom("n");
    h+='<div class="cb-sub"><div class="cb-row"><b>Слова</b><span><em>0</em> выучено</span></div><div class="cb-ic" aria-hidden="true">'+em+'</div>'+
      '<p class="cb-note">Каждое слово из уроков, от преподавателя или выделенное в тексте станет здесь '+'<span class="cb-n">звездой</span><span class="cb-d">цветком</span> — и зажжётся, когда выучите его.</p></div>';
  }
  if(HW&&HW.length){
    var list=HW.slice().sort(function(a,b){return (a.created||0)-(b.created||0)}),n=list.length,C=2*Math.PI*52,seg=C/n,gap=n>1?4:0,
      sent=list.filter(function(r){return r.status!=="active"}).length,chk=list.filter(function(r){return r.status==="done"}).length,
      act=list.filter(function(r){return r.status==="active"}),segs="",doneN=0;
    list.forEach(function(r,i){
      var t=r.status==="checked"?"c":r.status==="done"?"r":"a",L=(seg-gap).toFixed(1),dash=L+" 400";
      if(t==="a"){var k=Math.max(1,Math.floor((seg-gap)/7)),a=[];for(var j=0;j<k;j++)a.push("4 3");dash=a.join(" ")+" 0 400"}
      if(t!=="a")doneN=i+1;
      segs+='<circle class="sg '+t+'" cx="70" cy="70" r="52" transform="rotate('+(-90+i*360/n)+' 70 70)" stroke-dasharray="'+dash+'"/>';
    });
    var ang=(-90+sent*360/n-(gap/C)*180)*Math.PI/180,sx=(70+52*Math.cos(ang)).toFixed(1),sy=(70+52*Math.sin(ang)).toFixed(1);
    var soon=act.filter(function(r){return r.due}).sort(function(a,b){return a.due<b.due?-1:1})[0];
    var last=list.filter(function(r){return r.status==="checked"&&r.result&&r.result.max}).sort(function(a,b){return (b.checked_at||b.created||0)>(a.checked_at||a.created||0)?1:-1})[0];
    var rays="";for(i=0;i<36;i++)rays+='<path d="M70 3V'+(i%2?6:8)+'" transform="rotate('+(i*10)+' 70 70)"/>';
    h+='<div class="cb-sub" role="group" aria-label="Домашка: сдано '+sent+' из '+n+(chk?", на проверке "+chk:"")+(act.length?", задано "+act.length:"")+'"><div class="cb-row"><b>Домашка</b><a href="#hw">Все задания</a></div>'+
      '<div class="cb-hw" aria-hidden="true"><div class="cb-ring"><svg viewBox="0 0 140 140" width="140" height="140"><g class="rays">'+rays+'</g><circle class="tr" cx="70" cy="70" r="52"/>'+segs+
      '<circle class="in" cx="70" cy="70" r="40"/>'+(sent&&sent<n?'<g transform="translate('+sx+' '+sy+')"><svg x="-11" y="-11" width="22" height="22" viewBox="0 0 24 24" overflow="visible">'+mark("cur",22).replace(/^<svg[^>]*>|<\/svg>$/g,"")+"</svg></g>":"")+
      '</svg><span class="cb-c"><b>'+sent+'<small>/'+n+'</small></b><span>сдано</span></span></div>'+
      '<div class="cb-hl"><span><i class="kh c"></i><b>'+(sent-chk)+'</b> проверено</span>'+(chk?'<span><i class="kh r"></i><b>'+chk+'</b> на проверке</span>':"")+
      (act.length?'<span><i class="kh a"></i><b>'+act.length+'</b> задано'+(soon?" · ближайший срок "+new Date(soon.due+"T00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"long"}):"")+"</span>":"")+
      (last?'<span class="cb-note">Последняя оценка: '+last.result.score+" из "+last.result.max+"</span>":"")+"</div></div></div>";
  }
  return h+"</section>";
}
function path(o){
  var st=o.stages||[],empty=!st.length;
  if(empty){st=[0,1,2,3,4,5].map(function(){return {name:"",done:false}});o.pct=0}
  var cur=empty?-1:st.findIndex(function(s){return !s.done});if(!empty&&cur<0)cur=st.length;
  var n=st.length,YS=[56,26,50,22,46,24,52,28],pts=[],lit=[];
  st.forEach(function(s,i){var x=((i+.5)/n*1000).toFixed(0),y=YS[i%YS.length];pts.push(x+","+y);if(i<=cur&&i<n)lit.push(x+","+y)});
  var stars=st.map(function(s,i){var state=i<cur?"done":i===cur?"cur":"todo",sz=state==="cur"?46:state==="done"?34:22;
    return '<span class="cb-st '+state+'" style="left:'+((i+.5)/n*100).toFixed(2)+'%;top:'+YS[i%YS.length]+'px;--d:'+(i*.6).toFixed(1)+'s">'+mark(state,sz)+"</span>"}).join("");
  var labels=st.map(function(s,i){var state=i<cur?"done":i===cur?"cur":"todo";
    return '<div class="cb-lb '+state+'"><b>'+esc(s.name)+'</b><span>'+(state==="done"?"пройдено":state==="cur"?"сейчас":"впереди")+"</span></div>"}).join("");
  var rays="";for(var i=0;i<24;i++)rays+='<path d="M95 4V'+(i%2?10:14)+'" transform="rotate('+(i*15)+' 95 95)"/>';
  if(empty)labels='<p class="cb-pnone">Шкала заполнится, когда преподаватель откроет курс: каждый пройденный этап зажжёт '+'<span class="cb-n">звезду</span><span class="cb-d">солнце</span>.</p>';
  return '<section class="cb-path card glass'+(empty?" cb-empty":"")+'" aria-label="Путь по курсу: '+(empty?"курс ещё не открыт":esc(o.name)+", "+o.pct+" процентов")+'"><div class="cb-h"><div><span class="cb-k">Путь по курсу</span><h3>'+esc(empty?"Мой курс":o.name)+'</h3></div><span class="muted">'+esc(empty?"курс ещё не открыт":o.sub)+"</span></div>"+
    '<div class="cb-pw"><div class="cb-sun" aria-hidden="true"><svg viewBox="0 0 190 190"><g class="rays">'+rays+'</g><circle class="tr" cx="95" cy="95" r="72"/><circle class="arc" cx="95" cy="95" r="72" transform="rotate(-90 95 95)" stroke-dasharray="'+(452*o.pct/100).toFixed(0)+' 460"/><circle class="in" cx="95" cy="95" r="60"/></svg>'+
    '<span><b>'+o.pct+'%</b><small>прогресс курса</small></span></div>'+
    '<div class="cb-trail"><div class="cb-sky" aria-hidden="true"><svg viewBox="0 0 1000 80" preserveAspectRatio="none"><polyline class="all" points="'+pts.join(" ")+'"/><polyline class="lit" points="'+lit.join(" ")+'"/></svg>'+stars+'</div>'+
    (empty?labels:'<div class="cb-lbs" style="grid-template-columns:repeat('+n+',minmax(0,1fr))">'+labels+"</div>")+"</div></div></section>";
}
function plan(o,W,HW){
  var tasks=[],lang=o.lang;
  if(W&&W.total)tasks.push({k:"w",cta:"Начать",t:W.due?"Повторить слова":"Слова на сегодня",m:W.due?W.due+" "+plural(W.due,"карточка","карточки","карточек")+" · около "+Math.max(2,Math.round(W.due*.4))+" мин":"всё повторено",href:"words.html#day",done:!W.due});
  (HW||[]).filter(function(r){return r.status==="active"}).slice(0,2).forEach(function(r){
    tasks.push({k:"h",cta:"Открыть",t:"Домашка «"+r.title+"»",m:r.due?"от преподавателя · срок "+new Date(r.due+"T00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"long"}):"от преподавателя",href:"lesson.html?hw="+r.id,done:false})});
  if(o.next)tasks.push({k:"c",cta:"Дальше",t:o.next.plain||"Следующий урок",m:o.next.meta,href:o.next.href,done:false});
  if(lang==="ko"&&hasKo())tasks.push({k:"x",cta:"Играть",t:"История",m:"сюжетный диалог · по желанию",href:"story.html",done:false});
  var dn=tasks.filter(function(t){return t.done}).length,s=streak();
  /* неделя: понедельник — воскресенье; слова из журнала повторений, сроки домашки по датам */
  var L=wlog(),now=day0(Date.now()),mon=new Date(now);mon.setDate(now.getDate()-((now.getDay()+6)%7));
  var NM=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"],days=[],wd=0,wt=0;
  for(var i=0;i<7;i++){
    var d=new Date(mon);d.setDate(mon.getDate()+i);var k=key(d),past=d<now,today=+d===+now,it=[],x=L[k];
    if(x&&(x.n+x.r))it.push({k:"w",t:"Слова · "+(x.n+x.r),done:true});else if(today&&W&&W.due)it.push({k:"w",t:"Слова",done:false});else if(!past&&!today&&W&&W.total)it.push({k:"w",t:"Слова",done:false});
    (HW||[]).forEach(function(r){if(r.due===k)it.push({k:"h",t:"Срок: «"+r.title+"»",done:r.status!=="active"})});
    var f=it.length?it.filter(function(t){return t.done}).length/it.length:0;wd+=it.filter(function(t){return t.done}).length;wt+=it.length;
    days.push({n:NM[i],d:today?"сегодня":d.toLocaleDateString("ru-RU",{day:"numeric",month:"short"}),it:it,f:f,today:today});
  }
  var week='<div class="cb-week" role="img" aria-label="Неделя: '+wd+" из "+wt+' дел">'+days.map(function(d){
    return '<span class="'+(d.today?"now":"")+'"><i style="--f:'+Math.round(d.f*100)+'%"></i>'+d.n+"</span>"}).join("")+"</div>";
  var list=tasks.map(function(t){return '<a class="cb-task'+(t.done?" ok":"")+'" href="'+esc(t.href)+'"><span class="cb-ck" aria-hidden="true">'+(t.done?KR.icon("check",15):"")+'</span><i class="cb-dot k-'+t.k+'" aria-hidden="true"></i>'+
    '<span class="cb-tt"><b>'+esc(t.t)+'</b><span>'+esc(t.m)+'</span></span><span class="cb-tg'+(t.done?"":" cb-btn")+'">'+(t.done?"Готово":t.cta)+"</span></a>"}).join("");
  var wl=days.map(function(d){return '<div class="cb-day'+(d.today?" now":"")+'"><div class="cb-dn"><b>'+d.n+'</b><span>'+d.d+'</span></div><div class="cb-chips">'+
    (d.it.length?d.it.map(function(t){return '<span class="'+(t.done?"ok":"")+'"><i class="cb-dot k-'+t.k+'"></i>'+esc(t.t)+"</span>"}).join(""):'<span class="cb-none">—</span>')+
    '</div><b class="cb-dc">'+(d.it.length?d.it.filter(function(t){return t.done}).length+" из "+d.it.length:"")+"</b></div>"}).join("");
  return '<section class="cb-plan card glass" aria-label="План"><div class="cb-h"><h3>Мой план</h3>'+(s?'<span class="cb-streak">'+mark("done",16)+s+" "+plural(s,"день","дня","дней")+" подряд</span>":"")+
    '<div class="cb-seg" role="group" aria-label="Период"><button type="button" data-cbp="day" aria-pressed="'+(view.period==="day")+'">Сегодня</button><button type="button" data-cbp="week" aria-pressed="'+(view.period==="week")+'">Неделя</button></div></div>'+
    week+'<p class="muted cb-cnt"><b>'+(view.period==="day"?dn:wd)+"</b> из "+(view.period==="day"?tasks.length:wt)+(view.period==="day"?" на сегодня":" за неделю")+"</p>"+
    (view.period==="day"?'<div class="cb-tasks">'+(list||'<p class="muted">На сегодня дел нет.</p>')+"</div>":'<div class="cb-days">'+wl+"</div>")+
    '<div class="cb-keys" aria-hidden="true"><span><i class="cb-dot k-c"></i>курс</span><span><i class="cb-dot k-w"></i>слова</span><span><i class="cb-dot k-h"></i>домашка</span>'+(lang==="ko"&&hasKo()?'<span><i class="cb-dot k-x"></i>истории</span>':"")+"</div></section>";
}
function side(o,W){
  var P=PHRASES[o.lang]||PHRASES.ko,ph=P[doy()%P.length];
  var h='<section class="cb-phrase card glass" aria-label="Фраза дня"><div class="cb-h"><span class="cb-k">Фраза дня</span><button type="button" class="round" data-cbsay aria-label="Послушать фразу">'+KR.icon("volume",18)+"</button></div>"+
    '<p class="cb-ph" lang="'+o.lang+'">'+esc(ph[0])+"</p>"+(view.tr?'<p class="cb-pt">'+esc(ph[1])+"</p>":"")+
    '<button type="button" data-cbtr>'+(view.tr?"Скрыть перевод":"Показать перевод")+"</button></section>";
  if(W&&W.hard.length){
    h+='<section class="cb-hard card glass" aria-label="Сложные слова"><div class="cb-h"><h3>Сложные слова</h3><a href="words.html">Повторить</a></div>'+
      W.hard.map(function(x){return '<div class="cb-hw-row"><b lang="'+o.lang+'">'+esc(x.w)+"</b><span>"+esc(x.t)+"</span><em>"+x.e+" "+plural(x.e,"ошибка","ошибки","ошибок")+"</em></div>"}).join("")+"</section>";
  }
  return h;
}
var MOTTO=["Маленькие шаги ведут далеко.","Каждый день — немного ближе к цели.","Понемногу, но каждый день.","Сегодняшний урок — завтрашняя лёгкость.","Слово за словом складывается речь."];
/* приветствие: дата, время на сегодня, серия дней (солнца днём, звёзды ночью) */
function greet(o,W,HW){
  var now=new Date(),hr=now.getHours(),hi=hr<5?"Доброй ночи":hr<12?"Доброе утро":hr<18?"Добрый день":"Добрый вечер";
  var nm=String(o.who||"").trim();nm=nm?nm.charAt(0).toUpperCase()+nm.slice(1):"";
  var act=(HW||[]).filter(function(r){return r.status==="active"}).length,min=(W&&W.due?Math.max(2,Math.round(W.due*.4)):0)+(o.next?10:0)+act*10;
  var L=wlog(),d=day0(Date.now()),dots="";
  for(var i=6;i>=0;i--){var x=new Date(d);x.setDate(d.getDate()-i);dots+=mark(L[key(x)]?"done":"todo",18)}
  var s=streak(),date=now.toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"});
  return '<section class="cb-hello card glass"><span class="cb-hart" aria-hidden="true"></span><div class="cb-htx">'+
    '<span class="cb-k">'+mark("done",14)+esc(date)+'</span><h1>'+hi+(nm?", "+esc(nm):"")+'!</h1>'+
    '<p>'+(min?"На сегодня около "+min+" "+plural(min,"минуты","минут","минут")+". ":"")+'<i>'+esc(MOTTO[doy()%MOTTO.length])+'</i></p>'+
    '<span class="cb-streak2"><span class="cb-dots" aria-hidden="true">'+dots+'</span>'+(s?s+" "+plural(s,"день","дня","дней")+" подряд":"Начните серию сегодня")+"</span></div></section>";
}
/* три карточки быстрого доступа с рисунками */
function tiles(o,W,HW){
  var l=o.lang==="en"?"en":"ko",act=(HW||[]).filter(function(r){return r.status==="active"}).sort(function(a,b){return (a.due||"9999")<(b.due||"9999")?-1:1});
  function t(cls,img,title,sub,href,cta){return '<a class="cb-tile card glass '+cls+'" href="'+esc(href)+'"><span class="cb-tl"><b>'+title+'</b><span>'+esc(sub)+'</span><em>'+cta+KR.icon("arrow",15)+'</em></span><img src="img/spot-'+img+"-"+l+'.webp" alt="" loading="lazy" decoding="async"></a>'}
  var ws=W&&W.total?(W.due?W.due+" "+plural(W.due,"слово","слова","слов")+" повторить":"на сегодня всё повторено")+(W.fresh?" и "+W.fresh+" "+plural(W.fresh,"новое","новых","новых"):""):"слова появятся из уроков";
  var h=act[0],hs=HW===null||HW===undefined?"задания от преподавателя":h?"«"+h.title+"»"+(h.due?", срок "+new Date(h.due+"T00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"long"}):""):"заданий сейчас нет";
  return '<div class="cb-tiles">'+t("tw","words","Слова",ws,"words.html#day","Тренировка")+t("th","hw","Домашка",hs,h?"lesson.html?hw="+h.id:"#hw",h?"Открыть":"Все задания")+
    (l==="ko"&&hasKo()?t("ts","story","Истории","сюжетные диалоги по-корейски","story.html","Играть"):t("ts","story","Курс","материалы программы","course.html","Открыть"))+"</div>";
}
function html(o){
  var W=words(o.lang),HW=o.hw;
  return greet(o,W,HW)+'<div class="cb-r2">'+nextCard(o)+wordsHw(o,W,HW)+"</div>"+path(o)+tiles(o,W,HW)+'<div class="cb-r2 cb-r3">'+plan(o,W,HW)+'<div class="cb-col">'+side(o,W)+"</div></div>"+
    '<p class="cb-tip">'+mark("done",18)+"<span><b>Совет.</b> "+esc(TIPS[doy()%TIPS.length])+"</span></p>"+(o.hwCard?'<div id="hw" class="cb-hwlist">'+o.hwCard+"</div>":"");
}
var last=null,redraw=null;
function bind(root,again){
  redraw=again;
  root.addEventListener("click",function(e){
    var b=e.target.closest("[data-cbp]");if(b){view.period=b.getAttribute("data-cbp");if(redraw)redraw();return}
    if(e.target.closest("[data-cbtr]")){view.tr=!view.tr;if(redraw)redraw();return}
    var s=e.target.closest("[data-cbsay]");if(s){var p=root.querySelector(".cb-ph");if(p&&KR.say)KR.say(p.textContent,p.getAttribute("lang"))}
  });
}
KR.cab={html:html,bind:bind,streak:streak};
})();
