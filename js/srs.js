/* MIRAÉ · интервальное повторение слов (по образцу Anki): расписание карточек.
   Здесь только расчёты, без страницы и сети, поэтому их можно проверять отдельно (см. README).

   Карточка: id, l (язык), w (слово), t (перевод), ex / et (пример и его перевод), f (форма слова в примере),
   src (откуда слово), star (отмечено учеником), st (0 новое, 1 учу, 2 повторяю, 3 переучиваю),
   due (когда показать, мс), ivl (интервал, дни), ef (лёгкость), step (шаг изучения), reps, lap (забывания),
   b (сколько раз слово добавляли повторно), fr / lr (первый и последний показ), a / u (добавлено / изменено).

   Оценки: 1 «Снова», 2 «Трудно», 3 «Хорошо», 4 «Легко». */
(function(root){
"use strict";
var MIN=60000,DAY=86400000,AHEAD=20*MIN;
var GAMES=["cards","tr","ctx","wr","build","pairs"];
var DEF={
  steps:[1,10],   // шаги изучения нового слова, минуты
  relearn:[10],   // шаг для забытого слова, минуты
  grad:1,         // первый интервал после изучения, дни
  easy:4,         // интервал после «Легко» на новом слове, дни
  ease:2.5,       // стартовая лёгкость: во сколько раз растёт интервал после «Хорошо»
  hard:1.2,       // множитель после «Трудно»
  bonus:1.3,      // добавка после «Легко»
  lapse:0,        // какая доля интервала остаётся после «Снова» (0 = начать с одного дня)
  mod:1,          // общий множитель интервалов
  maxIvl:365,     // потолок интервала, дни
  newDay:10,      // новых слов в день
  revDay:100,     // повторений в день
  games:{cards:1,tr:1,ctx:1,wr:1,build:1,pairs:1}
};
function num(v,d,lo,hi){v=parseFloat(v);return isFinite(v)?Math.max(lo,Math.min(hi,v)):d}
function mins(a,d){
  if(typeof a==="string")a=a.split(/[\s,;]+/);
  a=(Array.isArray(a)?a:[]).map(function(x){return Math.round(parseFloat(x)*100)/100}).filter(function(x){return x>0&&x<=1440}).slice(0,6);
  return a.length?a:d.slice();
}
/* Настройки с подставленными значениями по умолчанию и разумными границами. */
function cfg(s){
  s=s||{};var g={},on=0;
  GAMES.forEach(function(k){g[k]=(s.games?s.games[k]:DEF.games[k])?1:0;on+=g[k]});
  if(!on)g.cards=1;                                     // хотя бы одна игра всегда включена
  return {steps:mins(s.steps,DEF.steps),relearn:mins(s.relearn,DEF.relearn),
    grad:Math.round(num(s.grad,DEF.grad,1,30)),easy:Math.round(num(s.easy,DEF.easy,1,60)),
    ease:num(s.ease,DEF.ease,1.3,4),hard:num(s.hard,DEF.hard,1,2),bonus:num(s.bonus,DEF.bonus,1,2),
    lapse:num(s.lapse,DEF.lapse,0,1),mod:num(s.mod,DEF.mod,.5,2),maxIvl:Math.round(num(s.maxIvl,DEF.maxIvl,7,3650)),
    newDay:Math.round(num(s.newDay,DEF.newDay,0,200)),revDay:Math.round(num(s.revDay,DEF.revDay,1,2000)),games:g};
}
function dayStart(t){var d=new Date(t);d.setHours(0,0,0,0);return d.getTime()}
function norm(w){return String(w==null?"":w).normalize("NFC").trim().replace(/\s+/g," ").toLowerCase()}
function makeId(lang,word){return lang+":"+norm(word)}
function make(lang,word,tr,x,now){
  x=x||{};var c={id:makeId(lang,word),l:lang,w:String(word).normalize("NFC").trim().replace(/\s+/g," "),t:String(tr||"").trim(),st:0,due:now,a:now,u:now};
  ["ex","et","f","src","pair"].forEach(function(k){if(x[k])c[k]=String(x[k]).trim()});
  if(x.star)c.star=1;
  return c;
}
/* Ответ на карточку: возвращает новую карточку с пересчитанным расписанием. */
function next(c,g,S,now){
  S=cfg(S);c=Object.assign({},c);var st=c.st||0;
  c.reps=(c.reps||0)+1;c.lr=now;if(!c.fr)c.fr=now;c.u=now;delete c.pri;
  if(st===2){
    var ivl=Math.max(1,c.ivl||1),ef=c.ef||S.ease,late=Math.max(0,Math.floor((now-c.due)/DAY)),n;
    if(g===1){                                          // забыл: интервал сбрасывается, слово уходит на переучивание
      c.lap=(c.lap||0)+1;c.ef=Math.max(1.3,ef-.2);c.ivl=Math.max(1,Math.round(ivl*S.lapse));
      c.st=3;c.step=0;c.due=now+S.relearn[0]*MIN;return c;
    }
    if(g===2){c.ef=Math.max(1.3,ef-.15);n=Math.max(ivl+1,Math.round(ivl*S.hard*S.mod))}
    else if(g===3){n=Math.max(ivl+1,Math.round((ivl+late/2)*ef*S.mod))}
    else{c.ef=ef+.15;n=Math.max(ivl+2,Math.round((ivl+late)*ef*S.bonus*S.mod))}
    c.ivl=Math.min(S.maxIvl,n);c.due=dayStart(now)+c.ivl*DAY;return c;
  }
  var steps=st===3?S.relearn:S.steps,i=st===0?0:Math.min(c.step||0,steps.length-1);
  if(st===0)c.st=1;
  if(g===1){c.step=0;c.due=now+steps[0]*MIN;return c}
  if(g===2){c.step=i;c.due=now+(i===0&&steps.length>1?(steps[0]+steps[1])/2:steps[i])*MIN;return c}   // «Трудно»: шаг повторяется
  if(g===3&&i+1<steps.length){c.step=i+1;c.due=now+steps[i+1]*MIN;return c}
  if(st===3){c.ivl=Math.max(1,c.ivl||1)+(g===4?1:0)}    // вернулось из переучивания
  else{c.ivl=g===4?S.easy:S.grad;c.ef=c.ef||S.ease}     // выучено: переходит в повторения
  c.st=2;c.step=0;c.due=dayStart(now)+c.ivl*DAY;return c;
}
/* Слово добавили ещё раз (ученик выделил его снова или учитель добавил повторно): оно вернётся раньше. */
function bump(c,now){
  c=Object.assign({},c);c.b=(c.b||0)+1;c.u=now;
  if(c.st===2){c.ivl=Math.max(1,Math.round((c.ivl||1)/2));c.due=Math.min(c.due,now)}
  else if(c.st===1||c.st===3){c.step=0;c.due=now}
  else c.pri=now;                                       // новое слово поднимается в начало очереди
  return c;
}
function span(ms){
  if(ms<MIN)return "<1 мин";
  if(ms<60*MIN)return Math.round(ms/MIN)+" мин";
  if(ms<DAY)return Math.round(ms/(60*MIN))+" ч";
  var d=Math.round(ms/DAY);
  return d<30?d+" дн":d<365?Math.round(d/30)+" мес":(Math.round(d/36.5)/10)+" г";
}
/* Подпись на кнопке оценки: через сколько карточка вернётся. */
function label(c,g,S,now){var n=next(c,g,S,now);return n.st===2?span(n.ivl*DAY):span(n.due-now)}
/* Очередь на сейчас. revDone — сколько повторений уже сделано сегодня. */
function plan(cards,S,now,revDone){
  S=cfg(S);var ds=dayStart(now),learn=[],wait=[],rev=[],fresh=[],newDone=0;
  cards.forEach(function(c){
    if(c.fr&&c.fr>=ds)newDone++;
    var st=c.st||0;
    if(st===0)fresh.push(c);
    else if(st===2){if(c.due<ds+DAY)rev.push(c)}
    else if(c.due<=now)learn.push(c);else wait.push(c);
  });
  var byDue=function(a,b){return a.due-b.due};
  learn.sort(byDue);wait.sort(byDue);rev.sort(byDue);
  fresh.sort(function(a,b){return (b.pri||0)-(a.pri||0)||(a.a||0)-(b.a||0)});
  var soon=wait.filter(function(c){return c.due<=now+AHEAD});
  return {learn:learn,soon:soon,rev:rev.slice(0,Math.max(0,S.revDay-(revDone||0))),fresh:fresh.slice(0,Math.max(0,S.newDay-newDone)),
    waiting:wait.length,nextAt:wait.length?wait[0].due:0,allNew:fresh.length,allRev:rev.length};
}
/* Следующая карточка: сначала то, что учим прямо сейчас, потом повторения, потом новые, потом ближайшие шаги. */
function pick(p){return p.learn[0]||p.rev[0]||p.fresh[0]||p.soon[0]||null}
root.SRS={DEF:DEF,GAMES:GAMES,MIN:MIN,DAY:DAY,cfg:cfg,norm:norm,id:makeId,make:make,next:next,bump:bump,label:label,span:span,plan:plan,pick:pick,dayStart:dayStart};
})(typeof window!=="undefined"?window:globalThis);
