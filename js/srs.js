/* MIRAÉ · интервальное повторение слов (по образцу Anki): расписание карточек.
   Здесь только расчёты, без страницы и сети, поэтому их можно проверять отдельно (см. README).

   Карточка: id, l (язык), w (слово), t (переводы через «;»), d / syn / col (определения на любых языках, синонимы,
   устойчивые выражения — см. js/meaning.js), ex / et (пример и его перевод), f (форма слова в примере),
   src (откуда слово), star (отмечено учеником), st (0 новое, 1 учу, 2 повторяю, 3 переучиваю),
   due (когда показать, мс), ivl (интервал, дни), ef (лёгкость), step (шаг изучения), reps, lap (забывания),
   b (сколько раз слово добавляли повторно), fr / lr (первый и последний показ), a / u (добавлено / изменено),
   pe / pm (ошибок в упражнениях уроков и день последней такой ошибки), sh (интервал сокращён тренажёром, тестом или учителем:
   следующее «Хорошо» растит его мягко, в полтора раза, а не в «лёгкость» раз), tc (сколько раз учитель возвращал слово),
   cb (срок повторения после бонуса за сессию без ошибок, см. clean).

   Оценки: 1 «Снова», 2 «Трудно», 3 «Хорошо», 4 «Легко». */
(function(root){
"use strict";
var MIN=60000,DAY=86400000,AHEAD=20*MIN,AGAIN=MIN;   // «Снова» — всегда через 1 минуту
var GAMES=["cards","tr","mean","ctx","wr","build","pairs","hear","dict","say"];   // hear, dict, say — на слух и вслух (js/ear.js)
var CTXM=["ru","ctx","mix"];
/* Тренировка по выбору: из каких слов собирать тренажёры. Можно отметить несколько, слова берутся из всех отмеченных.
   Новые (ещё не разобранные) слова сюда не попадают: они разбираются в своём блоке. */
var SCOPES=["today","tom","d3","week","hard","all"];   // как отрабатывать: с русским, в контексте (только изучаемый язык), вперемешку
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
  games:{cards:1,tr:1,mean:1,ctx:1,wr:1,build:1,pairs:1,hear:1,dict:1,say:1},
  ctxm:{},        // режим отработки по языкам: {ko: "ru", en: "ctx"}; нет языка — "ru" (прежняя настройка, см. gls)
  gls:{},         // направления: на каком языке значение слова. {ko: ["ru","en","ctx"]} — корейское слово отрабатывается
                  // с русским, с английским и в контексте вперемешку. Нет языка — берётся из ctxm
  lv:{},          // уровень ученика по языкам: {ko: "2급", en: "A2"}; нет языка — уровень подбирается сам (KR.mean.level)
  scope:["today","tom"],   // тренировка по выбору: какие слова отрабатывать в тренажёрах (см. SCOPES)
  lw:"ask",       // слова нового урока: ask — спросить ученика, auto — добавить сразу, off — не добавлять
  fuzz:1,         // разброс интервалов (±несколько дней), чтобы слова, выученные в один день, не возвращались все вместе
  clean:1         // +1 день к следующему повторению, если слово отработано за сессию без единой ошибки (SRS.clean)
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
  GAMES.forEach(function(k){g[k]=(s.games&&k in s.games?s.games[k]:DEF.games[k])?1:0;on+=g[k]});   // новая игра у старых настроек включена
  if(!on)g.cards=1;                                     // хотя бы одна игра всегда включена
  return {steps:mins(s.steps,DEF.steps),relearn:mins(s.relearn,DEF.relearn),
    grad:Math.round(num(s.grad,DEF.grad,1,30)),easy:Math.round(num(s.easy,DEF.easy,1,60)),
    ease:num(s.ease,DEF.ease,1.3,4),hard:num(s.hard,DEF.hard,1,2),bonus:num(s.bonus,DEF.bonus,1,2),
    lapse:num(s.lapse,DEF.lapse,0,1),mod:num(s.mod,DEF.mod,.5,2),maxIvl:Math.round(num(s.maxIvl,DEF.maxIvl,7,3650)),
    newDay:Math.round(num(s.newDay,DEF.newDay,0,200)),revDay:Math.round(num(s.revDay,DEF.revDay,1,2000)),games:g,
    lw:s.lw==="auto"||s.lw==="off"?s.lw:DEF.lw,ctxm:ctxm(s.ctxm),gls:gls(s.gls),lv:lvs(s.lv),scope:scope(s.scope),
    fuzz:s.fuzz===0?0:1,clean:s.clean===0?0:1};
}
/* Разброс интервала, как в Anki: 200 слов, выученных за один день, расходятся на несколько соседних дней.
   До 3 дней — без разброса, до недели — ±1 день, до месяца — ±15% (не меньше 2 дней), дальше ±5% (не меньше 4).
   lo — меньше этого интервал не становится (правило «каждое “Хорошо” хотя бы на день дольше»). */
function fuzz(n,lo,S){
  if(!S.fuzz||n<3)return n;
  var f=n<7?1:n<30?Math.max(2,Math.round(n*.15)):Math.max(4,Math.round(n*.05));
  var r=n+Math.floor(root.SRS.rnd()*(2*f+1))-f;
  return Math.min(S.maxIvl,Math.max(lo||1,r));
}
function scope(a){a=(Array.isArray(a)?a:[]).filter(function(x,i,arr){return SCOPES.indexOf(x)>=0&&arr.indexOf(x)===i});return a.length?a:DEF.scope.slice()}
/* Слово пора отрабатывать по расписанию: изучаемое (шаги в минутах) или повторение на сегодня. */
function isDue(c,now){var st=c.st||0;return (st===1||st===3||st===2)&&c.due<dayStart(now)+DAY}
/* Подходит ли слово под область тренировки. today — пора по расписанию; tom — по плану завтра; d3 / week — по плану
   в ближайшие 3 / 7 дней (без сегодняшних); hard — забывалось, ошибки в упражнениях, сокращал учитель или отмечено звёздочкой;
   all — все слова в работе. */
function inScope(c,k,now){
  var st=c.st||0,ds=dayStart(now);if(!st)return false;
  if(k==="all")return true;
  if(k==="today")return isDue(c,now);
  if(k==="hard")return !!(c.lap||c.pe||c.tc||c.star||(c.ef&&c.ef<2.2));
  if(isDue(c,now))return false;
  var to=ds+DAY*(k==="tom"?2:k==="d3"?4:k==="week"?8:0);
  return c.due<to;
}
function ctxm(m){var o={};if(m&&typeof m==="object")Object.keys(m).forEach(function(l){if(/^[a-z]{2,3}$/.test(l)&&CTXM.indexOf(m[l])>=0)o[l]=m[l]});return o
}
/* уровень ученика по языкам: только известные уровни */
var LVS={ko:["1급","2급","3급","4급","5급","6급"],en:["A1","A2","B1","B2","C1","C2"]};
function lvs(m){var o={};if(m&&typeof m==="object")Object.keys(LVS).forEach(function(l){if(LVS[l].indexOf(m[l])>=0)o[l]=m[l]});return o}
/* направления по языкам: "ru", "ctx" или код другого языка (не самого слова) */
function gls(m){
  var o={};if(!m||typeof m!=="object")return o;
  Object.keys(m).forEach(function(l){
    if(!/^[a-z]{2,3}$/.test(l)||!Array.isArray(m[l]))return;
    var a=m[l].filter(function(x,i,arr){return (x==="ru"||x==="ctx"||(/^[a-z]{2}$/.test(x)&&x!==l))&&arr.indexOf(x)===i}).slice(0,6);
    if(a.length)o[l]=a;
  });
  return o;
}
function dayStart(t){var d=new Date(t);d.setHours(0,0,0,0);return d.getTime()}
function norm(w){return String(w==null?"":w).normalize("NFC").trim().replace(/\s+/g," ").toLowerCase()}
function makeId(lang,word){return lang+":"+norm(word)}
function make(lang,word,tr,x,now){
  x=x||{};var c={id:makeId(lang,word),l:lang,w:String(word).normalize("NFC").trim().replace(/\s+/g," "),t:String(tr||"").trim(),st:0,due:now,a:now,u:now};
  ["ex","et","f","src","pair"].forEach(function(k){if(x[k])c[k]=String(x[k]).trim()});
  ["d","syn","col"].forEach(function(k){if(Array.isArray(x[k])&&x[k].length)c[k]=x[k].slice(0,12)});   // определения, синонимы, выражения (js/meaning.js)
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
      c.st=3;c.step=0;c.due=now+AGAIN;return c;
    }
    if(c.sh&&g<4){delete c.sh;                         // интервал недавно сократили за ошибку: растим осторожно
      if(g===2){c.ef=Math.max(1.3,ef-.15);n=ivl}else n=fuzz(Math.max(ivl+1,Math.round(ivl*1.5*S.mod)),ivl+1,S);
      c.ivl=Math.min(S.maxIvl,n);c.due=dayStart(now)+c.ivl*DAY;return c;
    }
    delete c.sh;
    if(g===2){c.ef=Math.max(1.3,ef-.15);n=fuzz(Math.max(ivl+1,Math.round(ivl*S.hard*S.mod)),ivl+1,S)}
    else if(g===3){n=fuzz(Math.max(ivl+1,Math.round((ivl+late/2)*ef*S.mod)),ivl+1,S)}
    else{c.ef=ef+.15;n=fuzz(Math.max(ivl+2,Math.round((ivl+late)*ef*S.bonus*S.mod)),ivl+2,S)}
    c.ivl=Math.min(S.maxIvl,n);c.due=dayStart(now)+c.ivl*DAY;return c;
  }
  var steps=st===3?S.relearn:S.steps,i=st===0?0:Math.min(c.step||0,steps.length-1);
  if(st===0)c.st=1;
  if(g===1){c.step=0;c.due=now+AGAIN;return c}            // «Снова»: через минуту, изучение заново
  /* «Трудно»: шаг повторяется. На первом шаге — между первым и вторым шагом; если шаг один — в полтора раза дольше
     (как в Anki). Всегда дольше «Снова», чтобы кнопки не показывали одно и то же. */
  if(g===2){var h=i===0&&steps.length>1?(steps[0]+steps[1])/2:i===0?steps[0]*1.5:steps[i];
    c.step=i;c.due=now+Math.max(h*MIN,AGAIN+MIN);return c}
  if(g===3&&i+1<steps.length){c.step=i+1;c.due=now+steps[i+1]*MIN;return c}
  if(st===3){c.ivl=Math.max(1,c.ivl||1)+(g===4?1:0)}    // вернулось из переучивания
  else{c.ivl=g===4?fuzz(S.easy,2,S):S.grad;c.ef=c.ef||S.ease}     // выучено: переходит в повторения
  c.st=2;c.step=0;c.due=dayStart(now)+c.ivl*DAY;return c;
}
/* Слово добавили ещё раз (ученик выделил его снова или учитель добавил повторно): оно вернётся раньше. */
function bump(c,now){
  c=Object.assign({},c);c.b=(c.b||0)+1;c.u=now;
  if(c.st===2){c.ivl=Math.max(1,Math.round((c.ivl||1)/2));c.due=Math.min(c.due,now);c.sh=1}
  else if(c.st===1||c.st===3){c.step=0;c.due=now}
  else c.pri=now;                                       // новое слово поднимается в начало очереди
  return c;
}
/* Слово встретилось в упражнении вне тренажёра (урок, отработка). Упражнение не заменяет повторение, но сдвигает его:
   ошибка — как повторное добавление слова: интервал вдвое короче, слово приходит на повторение сегодня;
   верный ответ засчитывается как «Хорошо», только если слово и так пора повторять. Новое и изучаемое слово
   от верного ответа не меняется: его сначала нужно пройти в тренажёре. Чтобы десять проверок одного упражнения
   не сдвигали слово десять раз, ошибка считается раз в день, а после ошибки верные ответы в этот день не засчитываются.
   Возвращает новую карточку или null, если менять нечего. pe — ошибок в упражнениях, pm — день последней ошибки. */
function practice(c,ok,S,now){
  var ds=dayStart(now),n;
  if(c.pm===ds)return null;
  if(!ok){n=bump(c,now);n.b=c.b;if(!n.b)delete n.b;n.pe=(c.pe||0)+1;n.pm=ds;return n}
  if((c.st||0)!==2||c.due>=ds+DAY)return null;
  return next(c,3,S,now);
}
/* Ответ в тренажёре по выбору (или в любой тренировке вне обычной отработки). Слово, которое и так пора отрабатывать,
   получает обычную оценку, как в Anki. Слово, которое по плану позже (завтра, через неделю), от верного ответа не меняется,
   а от ошибки возвращается раньше: интервал вдвое короче, слово приходит на повторение сегодня (см. practice).
   Возвращает {c: новая карточка, k: "rev" — засчитано как повторение, "back" — вернётся раньше} или null. */
function train(c,g,S,now){
  if(!c||!c.st)return null;
  if(isDue(c,now))return {c:next(c,g,S,now),k:"rev"};
  if(g>1)return null;
  var n=practice(c,false,S,now);return n?{c:n,k:"back"}:null;
}
/* Тренировка без карточек («Тренировать»): ученик не оценивает себя сам, оценку ставит игра. Правила:
   - ошибка — «Снова»; верно с подсказкой или со второй попытки — «Трудно»; верно сразу — «Хорошо». «Легко» игра не ставит
     (слово без ошибок за занятие получает свой день сверху — бонус за чистую сессию, см. clean);
   - игры делятся на вспоминание (RECALL: написать слово, сказать вслух, объяснить значение, карточки) и узнавание
     (выбрать перевод, слово в предложении, на слух, найти пару, собрать слово, диктант);
   - новое и изучаемое слово идёт по тем же шагам, что в карточках (1 мин → 10 мин → 1 день), но последний шаг
     (выпуск в повторение) засчитывается только за вспоминание: верное узнавание на последнем шаге — «Трудно», шаг повторяется;
   - слово в повторении с интервалом до недели — как обычно. С интервалом от недели верное узнавание растит интервал
     медленно (×«Трудно», 1.2), но лёгкость не снижает: узнать слово проще, чем вспомнить. Полный рост — за вспоминание.
   game — код игры из GAMES, g — оценка игры (1–3). Возвращает новую карточку, как next. */
var RECALL=["wr","say","mean","cards","rcards"];
function game(c,gm,g,S,now){
  var st=c.st||0,rc=RECALL.indexOf(gm)>=0;g=Math.min(3,g);
  if(g===1||rc)return next(c,g,S,now);
  var C=cfg(S);
  if(st!==2){var steps=st===3?C.relearn:C.steps,i=st===0?0:Math.min(c.step||0,steps.length-1);
    if(g===3&&st!==0&&i+1>=steps.length)g=2;
    return next(c,g,S,now)}
  if((c.ivl||0)<7)return next(c,g,S,now);
  var n=next(c,2,S,now);if(g===3)n.ef=c.ef||C.ease;return n;
}
/* слово на последнем шаге изучения: следующий верный ответ (вспоминание) выпустит его в повторение */
function lastStep(c,S){var st=c.st||0;if(st!==1&&st!==3)return false;var C=cfg(S),steps=st===3?C.relearn:C.steps;return Math.min(c.step||0,steps.length-1)+1>=steps.length}
/* Учитель (или сам ученик) решил, когда слово показать снова: today — сегодня, заново, как после «Снова»; tom — завтра.
   Ошибки в упражнениях в этот день слово больше не сдвигают (pm). */
function send(c,when,S,now){
  S=cfg(S);c=Object.assign({},c);var st=c.st||0,ds=dayStart(now);
  c.u=now;c.pm=ds;c.tc=(c.tc||0)+1;
  if(!st){c.pri=now;return c}                           // новое слово: в начало очереди новых
  if(when==="today"){
    if(st===2){c.lap=(c.lap||0)+1;c.ef=Math.max(1.3,(c.ef||S.ease)-.2);c.ivl=Math.max(1,Math.round((c.ivl||1)*S.lapse));c.st=3}
    c.step=0;c.due=now;delete c.sh;return c;
  }
  if(st===2){c.ef=Math.max(1.3,(c.ef||S.ease)-.15);c.ivl=1;c.sh=1}
  else c.step=0;
  c.due=ds+DAY;return c;
}
/* Слово отработано за сессию (тренажёр, упражнения, тест по домашке) без единой ошибки: следующее повторение
   на день позже. Только для слов в повторении (st 2), которые и так запланированы не на сегодня: слово «на сегодня»
   сначала нужно повторить. Бонус даётся один раз за цикл повторения: cb — срок, который получился после бонуса;
   пока срок тот же (слово ещё не повторяли), второй бонус не даётся, сколько бы тренажёров ни было за день.
   Возвращает новую карточку или null. */
function clean(c,S,now){
  S=cfg(S);if(!S.clean||!c||c.st!==2||c.due<dayStart(now)+DAY||c.cb===c.due)return null;
  c=Object.assign({},c);c.ivl=Math.min(S.maxIvl,Math.max(1,c.ivl||1)+1);c.due=c.due+DAY;c.cb=c.due;c.u=now;
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
function label(c,g,S,now){var R=root.SRS,r=R.rnd;R.rnd=function(){return .5};var n;try{n=next(c,g,S,now)}finally{R.rnd=r}return n.st===2?span(n.ivl*DAY):span(n.due-now)}
/* Очередь на сейчас. revDone — сколько повторений уже сделано сегодня; extra — сколько новых слов ученик сам взял
   сегодня сверх дневного лимита (после большого импорта можно выдать порцию или все сразу). */
function plan(cards,S,now,revDone,extra){
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
  return {learn:learn,soon:soon,rev:rev.slice(0,Math.max(0,S.revDay-(revDone||0))),fresh:fresh.slice(0,Math.max(0,S.newDay+(extra||0)-newDone)),
    waiting:wait.length,nextAt:wait.length?wait[0].due:0,allNew:fresh.length,allRev:rev.length};
}
/* Следующая карточка: сначала то, что учим прямо сейчас, потом повторения, потом новые, потом ближайшие шаги. */
function pick(p){return p.learn[0]||p.rev[0]||p.fresh[0]||p.soon[0]||null}
root.SRS={DEF:DEF,GAMES:GAMES,MIN:MIN,DAY:DAY,cfg:cfg,norm:norm,id:makeId,make:make,next:next,bump:bump,practice:practice,train:train,game:game,lastStep:lastStep,RECALL:RECALL,send:send,clean:clean,fuzz:fuzz,
  rnd:Math.random,   /* источник случайности для разброса; в проверках можно подменить */
  isDue:isDue,inScope:inScope,SCOPES:SCOPES,label:label,span:span,plan:plan,pick:pick,dayStart:dayStart};
})(typeof window!=="undefined"?window:globalThis);
