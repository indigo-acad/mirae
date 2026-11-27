/* MIRAÉ · словарь ученика (KR.vocab): хранение слов, синхронизация с облаком, очередь на сегодня.
   Слова лежат на устройстве и в Supabase (таблица vocab, см. supabase/vocab.sql). Пока серверная часть
   не установлена, словарь работает только на этом устройстве (status = "local").
   Расписание считает js/srs.js. */
(function(){
"use strict";
var KR=window.KR,SRS=window.SRS;if(!KR||!SRS)return;
var D={w:{},d:{},x:{},auto:{},s:null,st:0,sd:0,rv:null};   // w — слова, d — изменённые, x — удалённые, s — настройки
var key=function(){return "kr_vocab:"+KR.user()};
function load(){
  var v=null;try{v=JSON.parse(localStorage.getItem(key())||"null")}catch(e){}
  D=v&&typeof v==="object"?v:{};
  D.w=D.w||{};D.d=D.d||{};D.x=D.x||{};D.auto=D.auto||{};D.s=D.s||null;D.st=D.st||0;D.sd=D.sd||0;D.rv=D.rv||null;
}
function save(){try{localStorage.setItem(key(),JSON.stringify(D))}catch(e){}}
function put(c){D.w[c.id]=c;D.d[c.id]=1;delete D.x[c.id];save();push()}
function revToday(){var ds=SRS.dayStart(Date.now());return D.rv&&D.rv.d===ds?D.rv.n:0}
/* Сессия занятия (тренажёр, упражнения, тест): ответы по словам. 1 — пока без ошибок, 0 — была ошибка.
   В конце сессии (V.sessEnd) словам без единой ошибки добавляется день к следующему повторению (SRS.clean). */
var SESS=null;
function mark(id,ok){if(!SESS||!id)return;if(!ok)SESS[id]=0;else if(SESS[id]!==0)SESS[id]=1}
/* Новые слова сверх дневного лимита, взятые сегодня (после большого импорта): {d: начало дня, n: сколько} */
function extraToday(){var ds=SRS.dayStart(Date.now());return D.xn&&D.xn.d===ds?D.xn.n:0}
function changed(){if(typeof V.onchange==="function")try{V.onchange()}catch(e){}}
/* Журнал занятий словами по дням (kr_wlog:<ученик>): n — новых слов начато, r — повторений и шагов изучения,
   ok — верных ответов, t — время последнего ответа. Уходит в облако вместе с прогрессом ученика (js/common.js, ключ wl),
   преподаватель видит его в карточке ученика. Хранятся последние 60 дней. */
function dayKey(t){var d=new Date(t);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function logAnswer(wasNew,good,now){
  var k="kr_wlog:"+KR.user(),L={};try{L=JSON.parse(localStorage.getItem(k)||"{}")||{}}catch(e){}
  var d=dayKey(now),x=L[d]||{n:0,r:0,ok:0,t:0};
  if(wasNew)x.n++;else x.r++;if(good)x.ok++;x.t=now;L[d]=x;
  var keys=Object.keys(L).sort();while(keys.length>60)delete L[keys.shift()];
  try{localStorage.setItem(k,JSON.stringify(L))}catch(e){}
  if(KR.push)KR.push();
}

// ---------- синхронизация ----------
var timer=null,busy=false,again=false;
function push(){clearTimeout(timer);timer=setTimeout(sync,1200)}
function merge(r,sent,gone){
  var remote={};((r&&r.words)||[]).forEach(function(c){if(c&&c.id)remote[c.id]=c});
  sent.forEach(function(c){var l=D.w[c.id];if(!l||(l.u||0)<=(c.u||0))delete D.d[c.id]});   // не изменилось, пока шёл запрос
  gone.forEach(function(id){delete D.x[id]});
  Object.keys(remote).forEach(function(id){
    if(D.x[id])return;var l=D.w[id],c=remote[id];
    if(!l||!D.d[id]||(c.u||0)>(l.u||0))D.w[id]=c;       // берём облачную версию, если своя не новее
  });
  Object.keys(D.w).forEach(function(id){if(!remote[id]&&!D.d[id])delete D.w[id]});   // удалено на другом устройстве или учителем
  var rs=r&&r.settings;
  if(rs&&rs.t>D.st){D.s=rs.s||null;D.st=rs.t;D.auto=rs.auto||D.auto}
}
async function sync(){
  if(!KR.cloud.on||!KR.user())return V.status;
  if(busy){again=true;return V.status}
  busy=true;clearTimeout(timer);
  try{
    var sent=Object.keys(D.d).slice(0,300).map(function(id){return D.w[id]}).filter(Boolean),gone=Object.keys(D.x).slice(0,300),sd=D.sd;
    var r=await KR.api("vocab_sync",{p_words:sent,p_deleted:gone,p_settings:sd?{s:D.s,t:D.st,auto:D.auto}:null});
    if(sd)D.sd=0;merge(r,sent,gone);V.status="cloud";
  }catch(e){V.status=e.status===404?"local":"offline"}   // 404 — на сервере нет функции словаря
  busy=false;save();changed();
  if(V.status==="cloud"&&(again||Object.keys(D.d).length||Object.keys(D.x).length)){again=false;push()}
  return V.status;
}

var V={
  status:"local",onchange:null,
  all:function(lang){return Object.keys(D.w).map(function(k){return D.w[k]}).filter(function(c){return !lang||c.l===lang})},
  get:function(id){return D.w[id]||null},
  find:function(lang,word){return D.w[SRS.id(lang,word)]||null},
  settings:function(){return SRS.cfg(D.s)},
  setSettings:function(s){D.s=s;D.st=Date.now();D.sd=1;save();push()},
  /* Добавить слово. Если оно уже есть, интервал сокращается: слово вернётся раньше. */
  add:function(lang,word,tr,x){
    var now=Date.now(),c=D.w[SRS.id(lang,word)],fresh=!c;x=x||{};
    if(c){
      c=SRS.bump(c,now);if(x.star)c.star=1;if(!c.t&&tr)c.t=String(tr).trim();
      if(!c.ex&&x.ex){c.ex=x.ex;if(x.et)c.et=x.et;if(x.f)c.f=x.f}
    }else c=SRS.make(lang,word,tr,x,now);
    put(c);return {card:c,added:fresh};
  },
  /* Решение ученика о словах урока: undefined — ещё не решал, 1 — добавлены, "no" — не добавлять. */
  lessonState:function(lessonId){return D.auto[lessonId]},
  /* Слова урока добавляются один раз и без сокращения интервала. force — добавить, даже если раньше ученик отказался. */
  addLesson:function(lessonId,lang,items,force){
    if(D.auto[lessonId]&&!force)return 0;var now=Date.now(),n=0;
    items.forEach(function(it,i){var id=SRS.id(lang,it.w);if(!it.w||D.w[id])return;
      var c=SRS.make(lang,it.w,it.t,{ex:it.ex,et:it.et,f:it.f,src:"lesson:"+lessonId},now+i);D.w[id]=c;D.d[id]=1;n++});
    D.auto[lessonId]=1;D.st=Date.now();D.sd=1;save();push();changed();return n;
  },
  /* Ученик не хочет слова этого урока в словаре: больше не спрашиваем (решение синхронизируется с другими устройствами). */
  skipLesson:function(lessonId){D.auto[lessonId]="no";D.st=Date.now();D.sd=1;save();push()},
  update:function(c){c=Object.assign({},c,{u:Date.now()});put(c);return c},
  /* Исправить написание слова. id карточки зависит от написания (SRS.id), поэтому карточка переезжает под новый id,
     а расписание, звёздочка, заметка и история остаются. Возвращает новую карточку, null — слова нет,
     {exists: карточка} — слово с таким написанием уже есть в словаре. */
  rename:function(id,word){
    var c=D.w[id];word=String(word==null?"":word).normalize("NFC").trim().replace(/\s+/g," ");if(!c||!word)return null;
    var nid=SRS.id(c.l,word);if(nid!==id&&D.w[nid])return {exists:D.w[nid]};
    var n=Object.assign({},c,{id:nid,w:word,u:Date.now()});if(n.f&&n.ex&&n.ex.indexOf(n.f)<0)delete n.f;
    if(nid!==id){delete D.w[id];delete D.d[id];D.x[id]=1}
    put(n);return n;
  },
  star:function(id){var c=D.w[id];if(!c)return null;c=Object.assign({},c,{u:Date.now()});if(c.star)delete c.star;else{c.star=1;c=SRS.bump(c,Date.now())}put(c);return c},
  remove:function(id){delete D.w[id];delete D.d[id];D.x[id]=1;save();push()},
  /* game — код игры: тогда оценку ставит игра по правилам тренировки без карточек (SRS.game) */
  answer:function(id,grade,game){
    var c=D.w[id];if(!c)return null;var now=Date.now(),wasNew=!c.st;
    if(c.st===2){var ds=SRS.dayStart(now);D.rv=D.rv&&D.rv.d===ds?{d:ds,n:D.rv.n+1}:{d:ds,n:1}}
    mark(id,grade>1);c=game?SRS.game(c,game,grade,D.s,now):SRS.next(c,grade,D.s,now);put(c);logAnswer(wasNew,grade>=3,now);return c;
  },
  /* Ответ в упражнении вне тренажёра (см. SRS.practice). res: {id карточки: верно ли}; если слово было в двух заданиях
     и в одном из них ошибка, передавайте false. Возвращает {back: вернулись на повторение, done: засчитаны как повторение}. */
  practice:function(res){
    var now=Date.now(),ds=SRS.dayStart(now),out={back:[],done:[]};
    Object.keys(res||{}).forEach(function(id){
      var c=D.w[id];if(!c)return;mark(id,!!res[id]);var n=SRS.practice(c,!!res[id],D.s,now);if(!n)return;
      if(res[id]){if(c.st===2)D.rv=D.rv&&D.rv.d===ds?{d:ds,n:D.rv.n+1}:{d:ds,n:1};out.done.push(n)}else out.back.push(n);
      D.w[id]=n;D.d[id]=1;delete D.x[id];
    });
    if(out.back.length||out.done.length){save();push();changed()}
    return out;
  },
  /* Ответ в тренировке по выбору (см. SRS.train): слово «на сегодня» получает обычную оценку, слово «на потом» от ошибки
     возвращается раньше. Возвращает {c, k} или null, если расписание не изменилось. */
  train:function(id,grade){
    var c=D.w[id];if(!c)return null;mark(id,grade>1);var now=Date.now(),r=SRS.train(c,grade,D.s,now);
    if(!r)return null;
    if(r.k==="rev"){if(c.st===2){var ds=SRS.dayStart(now);D.rv=D.rv&&D.rv.d===ds?{d:ds,n:D.rv.n+1}:{d:ds,n:1}}logAnswer(!c.st,grade>=3,now)}
    put(r.c);changed();return r;
  },
  /* Показать слова снова сегодня (today) или завтра (tom) — так решил учитель или ученик (SRS.send). */
  send:function(ids,when){
    var now=Date.now(),out=[];(ids||[]).forEach(function(id){var c=D.w[id];if(!c)return;c=SRS.send(c,when,D.s,now);D.w[id]=c;D.d[id]=1;delete D.x[id];out.push(c)});
    if(out.length){save();push();changed()}return out;
  },
  /* Слова для тренировки по выбору: keys — области (SRS.SCOPES), по умолчанию из настроек. Сначала те, что пора повторить. */
  scope:function(lang,keys){
    var now=Date.now();keys=keys||V.settings().scope;
    return V.all(lang).filter(function(c){return keys.some(function(k){return SRS.inScope(c,k,now)})})
      .sort(function(a,b){return (SRS.isDue(b,now)?1:0)-(SRS.isDue(a,now)?1:0)||a.due-b.due});
  },
  /* Слова ученика, которые есть в тексте (ответ или предложение из упражнения). Английский: слово целиком и с простым
     окончанием (books, played, making, studies). Корейский: словарная форма или основа из двух и более слогов в начале
     слова; основа из одного слога (가다, 사다) узнаётся только в словарной форме, иначе было бы много ложных совпадений.
     Основа, которая меняется при спряжении (마시다 → 마셔요, 듣다 → 들어요), не узнаётся: такому заданию слово указывают явно.
     Запись из нескольких слов ищется целиком; head = true — текст и есть ответ, тогда запись узнаётся и по первому слову
     («사다 주다» по ответу «사다»). Варианты через «/» («갖다 주다 / 가져다 주다») проверяются по отдельности. */
  wordsIn:function(lang,text,head){
    var strip=function(t){return t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,"")};
    var toks=SRS.norm(text).split(" ").map(strip).filter(Boolean),whole=toks.join(" "),flat=" "+whole+" ";
    if(!toks.length)return [];
    var en=function(st,t){
      if(t.indexOf(st)===0&&/^(s|es|d|ed|ing|'s|’s)?$/.test(t.slice(st.length)))return true;
      var e=st.slice(-1),r=st.slice(0,-1);
      if(e==="e"&&(t===r+"ing"||t===r+"ed"))return true;
      if(e==="y"&&(t===r+"ies"||t===r+"ied"))return true;
      return st.length>2&&/[bdgmnprt]$/.test(st)&&(t===st+e+"ing"||t===st+e+"ed");
    };
    return V.all(lang).filter(function(c){
      return SRS.norm(c.w).split("/").some(function(w){
        w=w.trim();if(!w)return false;var st=V.stem(lang,w);
        if(w.indexOf(" ")>=0){
          if(head&&whole===w.split(" ")[0])return true;
          return lang==="ko"?flat.indexOf(" "+st)>=0:flat.indexOf(" "+w+" ")>=0;
        }
        if(lang==="ko"){
          // глаголы на 하다 меняют основу (공부하다 → 공부해요, 공부했어요, 공부합니다): перечисляем её частые виды
          var forms=/.하다$/.test(w)?["하","해","했","합","한","할"].map(function(x){return w.slice(0,-2)+x}):st.length>1?[st]:[];
          return toks.some(function(t){return t===w||forms.some(function(f){return t.indexOf(f)===0})});
        }
        return toks.some(function(t){return en(w,t)});
      });
    }).map(function(c){return c.id});
  },
  plan:function(lang){return SRS.plan(V.all(lang),D.s,Date.now(),revToday(),extraToday())},
  /* Взять сегодня ещё n новых слов сверх дневного лимита (n = Infinity — все новые слова сразу). Только на этот день
     и только на этом устройстве: завтра снова обычный лимит из настроек. */
  takeNew:function(lang,n){
    var p=V.plan(lang),left=p.allNew-p.fresh.length;if(left<=0)return 0;n=Math.min(left,n>0?n:left);
    var ds=SRS.dayStart(Date.now());D.xn={d:ds,n:extraToday()+n};save();changed();return n;
  },
  /* Начать сессию: дальше все ответы (answer, practice, train) запоминаются по словам. */
  sessStart:function(){SESS={}},
  /* Закончить сессию. apply = false — сессия брошена на середине, бонуса нет. Возвращает карточки, получившие бонус. */
  sessEnd:function(apply){var s=SESS;SESS=null;if(!s||apply===false)return [];return V.bonus(Object.keys(s).filter(function(id){return s[id]===1}))},
  /* Бонус +1 день словам, отработанным без ошибок (SRS.clean). Возвращает изменённые карточки. */
  bonus:function(ids){
    var now=Date.now(),out=[];(ids||[]).forEach(function(id){var c=D.w[id];if(!c)return;var n=SRS.clean(c,D.s,now);if(!n)return;D.w[id]=n;D.d[id]=1;delete D.x[id];out.push(n)});
    if(out.length){save();push();changed()}return out;
  },
  stats:function(lang){
    var p=V.plan(lang),all=V.all(lang),known=all.filter(function(c){return c.st===2}).length;
    return {total:all.length,known:known,fresh:p.fresh.length,learn:p.learn.length+p.soon.length,rev:p.rev.length,
      due:p.fresh.length+p.learn.length+p.soon.length+p.rev.length,nextAt:p.nextAt};
  },
  /* Основа слова для поиска в тексте: у корейских глаголов и прилагательных отбрасываем «다». */
  stem:function(lang,w){w=SRS.norm(w);return lang==="ko"&&w.length>1&&w.slice(-1)==="다"?w.slice(0,-1):w},
  sync:sync,
  reload:function(){load();return V}
};
/* Слова из материалов (папка materials/, кнопка «В словарь» от js/bridge.js) ждут в localStorage «kr_vinbox:<ученик>»,
   пока ученик не откроет страницу сайта со словарём. Добавляются как слова урока: уже знакомое слово не трогаем. */
function inbox(){
  var k="kr_vinbox:"+KR.user(),a=[];try{a=JSON.parse(localStorage.getItem(k)||"[]")||[]}catch(e){}
  if(!Array.isArray(a)||!a.length)return 0;
  var now=Date.now(),n=0;
  a.forEach(function(it,i){if(!it||!it.w||(it.l!=="ko"&&it.l!=="en"))return;var id=SRS.id(it.l,it.w);if(D.w[id])return;
    var x={ex:it.ex,et:it.et,src:it.src||"material"};if(Array.isArray(it.d))x.d=it.d;
    D.w[id]=SRS.make(it.l,it.w,it.t||"",x,now+i);D.d[id]=1;delete D.x[id];n++});
  try{localStorage.removeItem(k)}catch(e){}
  if(n)save();return n;
}
V.inbox=function(){var n=inbox();if(n){push();changed()}return n};
KR.vocab=V;
if(KR.user()){load();inbox();sync()}
})();
