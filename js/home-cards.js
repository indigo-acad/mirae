/* MIRAÉ · карточки «Слова на сегодня» и «Домашка»: общие для главной и личного кабинета ученика.
   Не зависят от того, открыл ли преподаватель курсы: словарь и домашка есть у каждого вошедшего ученика.
   Подключать после common.js, srs.js и vocab.js. */
(function(){
"use strict";
var KR=window.KR;if(!KR)return;
var esc=KR.esc;
function plural(n,f1,f2,f5){return n%10===1&&n%100!==11?f1:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?f2:f5}
function dueText(d){
  var day=new Date(d+'T00:00'),t=new Date();t.setHours(0,0,0,0);var k=Math.round((day-t)/864e5),f=day.toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
  return k<0?['late','срок прошёл: '+f]:k===0?['soon','сдать сегодня']:k===1?['soon','сдать завтра']:['','сдать до '+f];
}
function active(HW){return (HW||[]).filter(function(r){return r.status==='active'}).sort(function(a,b){return (a.due||'9999')<(b.due||'9999')?-1:(a.due||'9999')>(b.due||'9999')?1:a.created-b.created})}
function row(r){
  var n=0;(r.items||[]).forEach(function(it){n+=it.m||it.wt?1:(it.b||[]).length});
  var P={};try{P=JSON.parse(localStorage.getItem('kr_progress:'+KR.user()+':hw-'+r.id)||'{}')}catch(e){}
  var d=Math.min(n,Object.keys(P).filter(function(k){var p=P[k];return p&&(p.done||p.total!=null)}).length);
  var du=r.due?dueText(r.due):['','срок не задан'],th=(r.theory||[])[0],other=r.lang&&r.lang!==KR.lang()&&KR.LANGS[r.lang];
  var thHref=th?(KR.can('lesson-'+th.l)?'lesson.html?l='+encodeURIComponent(th.l)+'&part=theory#'+encodeURIComponent(th.s):'lesson.html?hw='+r.id+'&th=1'):'';
  return '<div class="hw-row"><div class="hw-tx"><b>'+esc(r.title)+'</b><span class="muted"><span class="hw-due '+du[0]+'">'+du[1]+'</span> · '+(d?'сделано '+d+' из '+n:n+' '+plural(n,'задание','задания','заданий'))+(other?' · '+esc(other.name):'')+'</span>'+
    (r.note?'<span class="hw-nt">'+esc(r.note)+'</span>':'')+'</div><span class="hw-acts">'+(th?'<a class="btn" href="'+thHref+'">'+KR.icon('book',15)+'Теория</a>':'')+
    '<a class="btn pri" href="lesson.html?hw='+r.id+'">'+(d?'Продолжить':'Сделать')+KR.icon('arrow',15)+'</a></span></div>';
}
function homework(HW){
  var act=active(HW),notes=(HW||[]).filter(function(r){return r.status==='checked'&&r.comment&&!r.seen});
  var h='<section class="card glass hwc" aria-labelledby="hwc-h"><div class="tb-h"><h3 id="hwc-h">'+KR.icon('home',20)+'Домашка</h3>'+(act.length?'<span class="badge new">'+act.length+'</span>':'')+'</div>';
  h+=notes.map(function(r){return '<div class="hw-cm"><div><b>Преподаватель проверил «'+esc(r.title)+'»</b>'+(r.result&&r.result.max?' <span class="muted">· '+r.result.score+' из '+r.result.max+'</span>':'')+'<p>'+esc(r.comment)+'</p></div><button type="button" data-hwseen="'+r.id+'">Понятно</button></div>'}).join('');
  h+=act.length?act.map(row).join(''):'<p class="muted">Домашки сейчас нет. Когда преподаватель задаст, она появится здесь.</p>';
  return h+'</section>';
}
/* Слова на сегодня: новые слова и отработка отдельно; нажатие сразу открывает нужный блок страницы «Слова». */
function words(){
  if(!KR.vocab)return '';var lang=KR.lang(),p=KR.vocab.plan(lang),s=KR.vocab.stats(lang),nn=p.fresh.length,work=p.learn.length+p.soon.length+p.rev.length;
  return '<section class="card glass wcab" aria-labelledby="wcab-h"><div class="tb-h"><h3 id="wcab-h">'+KR.icon('abc',20)+'Слова · '+KR.LANGS[lang].name+'</h3></div><div class="wcab-2">'+
    '<a class="wcab-i" href="words.html#new"><span class="tag">'+KR.icon('spark',14)+'Новые слова</span><b>'+nn+'</b><span class="muted">'+(nn?'познакомиться':p.allNew?'на сегодня всё, ещё '+p.allNew+' завтра':'новых нет')+'</span></a>'+
    '<a class="wcab-i" href="words.html#rev"><span class="tag">'+KR.icon('repeat',14)+'Отработка</span><b>'+work+'</b><span class="muted">'+(work?'повторить сейчас':s.total?'на сегодня всё':'слов пока нет')+'</span></a></div>'+
    '<p class="muted wcab-f">'+(s.total?'В словаре: '+s.total+' · выучено: '+s.known+'. ':'Слова появятся из уроков, от преподавателя или по выделению в тексте. ')+'<a href="words.html">Открыть «Слова»</a></p></section>';
}
KR.cards={words:words,homework:homework,active:active,plural:plural};
})();
