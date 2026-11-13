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
function changed(){if(typeof V.onchange==="function")try{V.onchange()}catch(e){}}

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
  /* Слова урока добавляются один раз и без сокращения интервала. */
  addLesson:function(lessonId,lang,items){
    if(D.auto[lessonId])return 0;var now=Date.now(),n=0;
    items.forEach(function(it,i){var id=SRS.id(lang,it.w);if(!it.w||D.w[id])return;
      var c=SRS.make(lang,it.w,it.t,{ex:it.ex,et:it.et,f:it.f,src:"lesson:"+lessonId},now+i);D.w[id]=c;D.d[id]=1;n++});
    D.auto[lessonId]=1;D.st=Date.now();D.sd=1;save();push();return n;
  },
  update:function(c){c=Object.assign({},c,{u:Date.now()});put(c);return c},
  star:function(id){var c=D.w[id];if(!c)return null;c=Object.assign({},c,{u:Date.now()});if(c.star)delete c.star;else{c.star=1;c=SRS.bump(c,Date.now())}put(c);return c},
  remove:function(id){delete D.w[id];delete D.d[id];D.x[id]=1;save();push()},
  answer:function(id,grade){
    var c=D.w[id];if(!c)return null;
    if(c.st===2){var ds=SRS.dayStart(Date.now());D.rv=D.rv&&D.rv.d===ds?{d:ds,n:D.rv.n+1}:{d:ds,n:1}}
    c=SRS.next(c,grade,D.s,Date.now());put(c);return c;
  },
  plan:function(lang){return SRS.plan(V.all(lang),D.s,Date.now(),revToday())},
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
KR.vocab=V;
if(KR.user()){load();sync()}
})();
