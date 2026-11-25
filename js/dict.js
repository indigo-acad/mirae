/* MIRAÉ · словарь (KR.dict): статья словаря для слова — функция supabase/functions/dict-lookup.
   Корейский — 한국어기초사전 (определение по-корейски, переводы на английский и русский, примеры, синонимы, уровень),
   английский — Free Dictionary API / Викисловарь (определения, примеры, синонимы, транскрипция).
   get(word, lang) — статья (хранится на устройстве неделю); enrich(card, entry) — дописать в карточку то, чего в ней нет,
   только из значений, которые ученик учит; refit(card, entry) — поправить уже заполненную карточку;
   put(entry) — положить в кэш статью, пришедшую вместе с переводом (translate-words).
   Перевод «словарь → DeepL» для списка слов и выделения в уроке — функция translate-words: база школы, словарь, DeepL. */
(function(){
"use strict";
var KR=window.KR;if(!KR)return;
var norm=function(s){return String(s==null?'':s).normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase()};
var DAY=86400000,DQ={},cfg=function(){return window.CONFIG||{}};
var key=function(w,l){return 'kr_dict3:'+l+':'+norm(String(w).split('/')[0])};
function put(r){if(r&&r.word&&r.lang)try{localStorage.setItem(key(r.word,r.lang),JSON.stringify({at:Date.now(),r:r}))}catch(e){}}
function cached(w,l){try{var x=JSON.parse(localStorage.getItem(key(w,l))||'null');if(x&&Date.now()-x.at<7*DAY)return x.r}catch(e){}return null}
async function get(w,l){
  var c=cached(w,l);if(c)return c;var k=key(w,l);
  if(DQ[k])return DQ[k];
  DQ[k]=(async function(){
    var C=cfg(),res=await fetch(C.SUPABASE_URL+'/functions/v1/dict-lookup',{method:'POST',
      headers:{'Content-Type':'application/json',apikey:C.SUPABASE_ANON_KEY,Authorization:'Bearer '+C.SUPABASE_ANON_KEY},
      body:JSON.stringify({p_name:KR.user(),p_pin:localStorage.getItem('kr_pin')||'',word:String(w).split('/')[0].trim(),lang:l})});
    var r=await res.json().catch(function(){return {}});
    if(!res.ok)throw new Error(r.message||('ошибка '+res.status));
    put(r);return r;
  })();
  try{return await DQ[k]}finally{delete DQ[k]}
}
/* Перевод слова или короткой фразы: база школы → словарь → DeepL (translate-words).
   Возвращает {t, src: base|dict|deepl, entry} или null. */
async function translate(text,lang){
  var C=cfg();if(!C.SUPABASE_URL||!KR.user()||!localStorage.getItem('kr_pin'))return null;
  var res=await fetch(C.SUPABASE_URL+'/functions/v1/translate-words',{method:'POST',
    headers:{'Content-Type':'application/json',apikey:C.SUPABASE_ANON_KEY,Authorization:'Bearer '+C.SUPABASE_ANON_KEY},
    body:JSON.stringify({p_name:KR.user(),p_pin:localStorage.getItem('kr_pin')||'',words:[text],langs:[lang]})});
  var d=await res.json().catch(function(){return {}});
  var t=(d.translations||[])[0],e=(d.entries||[])[0]||null;if(e)put(e);
  if(!t)return null;
  return {t:t,src:(d.sources||[])[0]||'deepl',entry:e};
}
/* ---------- значения (senses) ----------
   У слова в словаре бывает несколько значений: 까먹다 — «чистить и есть», «растратить», «забыть». Определения, примеры,
   выражения и синонимы берём только из тех значений, которые ученик учит, — иначе «забывать» отрабатывается
   на примере про очистку каштанов. Какие значения учит — по переводу в карточке (c.t), или ученик выбрал сам (c.sn). */
function senses(r){
  if(!r||!r.found)return [];
  if(r.senses&&r.senses.length)return r.senses;
  return [{tr_ru:r.tr_ru||[],defs:r.defs||[],examples:r.examples||[],cols:r.cols||[],syn:r.syn||[]}];   // статья старого вида
}
var M=function(){return KR.mean};
/* основа русского слова для сравнения: «забывать» и «забыть» совпадут */
function stemEq(a,b){
  if(a===b)return true;if(a.length<4||b.length<4)return false;
  var i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;
  return i>=4&&i>=Math.min(a.length,b.length)*.6;
}
function words(s){return M().nm(s).split(' ').filter(function(w){return w.length>=4})}
/* перевод из карточки → номера значений. Сначала точные переводы словаря, потом слова в русских определениях.
   Значения разных омонимов (쓰다 «писать» и 쓰다 «использовать») не смешиваем: берём омоним первого совпадения. */
function pickSenses(c,r){
  var ss=senses(r);if(ss.length<2)return ss.length?[0]:[];
  if(Array.isArray(c.sn)){var own=c.sn.filter(function(i){return i>=0&&i<ss.length});if(own.length)return own}
  var parts=String(c.t||'').split(/[;\n,]/).map(function(x){return M().nm(x)}).filter(Boolean);
  if(!parts.length)return [0];
  var hit=function(test){var out=[];parts.forEach(function(p){ss.forEach(function(x,i){if(out.indexOf(i)<0&&test(p,x))out.push(i)})});return out};
  var exact=hit(function(p,x){return (x.tr_ru||[]).some(function(t){t=M().nm(t);return t===p||stemEq(t,p)||(p.indexOf(' ')<0&&t.split(' ').some(function(w){return stemEq(w,p)}))})});
  var out=exact.length?exact:hit(function(p,x){var pw=words(p);return pw.length&&(x.defs||[]).some(function(d){return d.l==='ru'&&words(d.s).some(function(w){return pw.some(function(q){return stemEq(w,q)})})})});
  if(!out.length)return [0];
  var h=ss[out[0]].h||0;return out.filter(function(i){return (ss[i].h||0)===h});
}
function chosen(c,r){var ss=senses(r);return pickSenses(c,r).map(function(i){return ss[i]})}
/* примеры выбранных значений по силам ученику; with — слово видно в примере (нужно для пропуска) */
function examplesFor(c,r,lv){
  var ex=[];chosen(c,r).forEach(function(x){(x.examples||[]).forEach(function(e){if(e&&e.s&&!ex.some(function(y){return y.s===e.s}))ex.push(e)})});
  return M().byLevel(ex,c.l,lv);
}
/* статья словаря → карточка: добавляем недостающее, своё ученика и преподавателя не трогаем */
function enrich(c,r){
  c=Object.assign({},c);c.dq=1;if(!r||!r.found)return c;
  var ss=senses(r);
  if(!c.t){var t0=[];chosen(c,r).forEach(function(x){(x.tr_ru||[]).forEach(function(t){if(t0.indexOf(t)<0)t0.push(t)})});if(t0.length)c.t=t0.slice(0,3).join('; ')}
  var idx=pickSenses(c,r),sel=idx.map(function(i){return ss[i]});
  if(r.senses)c.sv=2;
  var all=function(f){var o=[];sel.forEach(function(x){(x[f]||[]).forEach(function(y){o.push(y)})});return o};
  var k=function(d){return d.l+':'+String(d.s).toLowerCase()};
  var have=(c.d||[]).map(k),per={};
  var nd=all('defs').filter(function(d){if(!d.s||have.indexOf(k(d))>=0||d.s===c.t)return false;have.push(k(d));per[d.l]=(per[d.l]||0)+1;return per[d.l]<=2});
  if(nd.length)c.d=(c.d||[]).concat(nd).slice(0,8);
  var own=(c.syn||[]).map(norm),sy=(c.syn||[]).concat(all('syn').filter(function(x){var n=norm(x);if(own.indexOf(n)>=0||n===norm(c.w))return false;own.push(n);return true}));
  if(sy.length)c.syn=sy.slice(0,8);
  var co=(c.col||[]).concat(all('cols').filter(function(x){return !(c.col||[]).some(function(y){return y.s===x.s})}));
  if(co.length)c.col=co.slice(0,6);
  var ex=examplesFor(c,r)[0];if(!c.ex&&ex&&ex.s){c.ex=ex.s;if(ex.t)c.et=ex.t}
  if(!c.ipa&&r.ipa)c.ipa=r.ipa;
  if(r.srcName)c.dsrc=r.srcName;
  if(r.audio&&Object.keys(r.audio).length&&!c.au)c.au=r.audio;
  return c;
}
/* Поправить карточку, уже заполненную из словаря: убрать определения, выражения, синонимы и пример из чужих значений
   и пример не по уровню (только словарный — свой пример ученика или преподавателя не трогаем), добавить нужное.
   Ученик выбрал значения сам (карточка слова → «Какое значение учу») — sn: [номера], хранится в карточке;
   без него значения подбираются по переводу каждый раз заново, так что правка перевода сама меняет значение. */
function refit(c,r,sn){
  c=Object.assign({},c);if(sn)c.sn=sn;
  var ss=senses(r);if(!ss.length)return c;
  var idx=pickSenses(c,r),mine={},other={},key=function(x){return norm(x&&x.s!==undefined?x.s:x)};
  ss.forEach(function(x,i){var to=idx.indexOf(i)>=0?mine:other;
    ['defs','examples','cols'].forEach(function(f){(x[f]||[]).forEach(function(y){to[key(y)]=1})});(x.syn||[]).forEach(function(y){to[key(y)]=1})});
  var bad=function(x){var n=key(x);return other[n]&&!mine[n]};
  if(c.d){c.d=c.d.filter(function(d){return !bad(d)});if(!c.d.length)delete c.d}
  if(c.col){c.col=c.col.filter(function(x){return !bad(x)});if(!c.col.length)delete c.col}
  if(c.syn){c.syn=c.syn.filter(function(x){return !bad(x)});if(!c.syn.length)delete c.syn}
  if(c.ex&&(bad(c.ex)||((mine[key(c.ex)]||other[key(c.ex)])&&!M().fits(c.ex,c.l)))){delete c.ex;delete c.et;delete c.f}
  return enrich(c,r);
}
/* Запись произношения из словаря для слова: сначала из карточки ученика (c.au), потом из сохранённой статьи.
   en — по выбранному произношению (gb → британская запись, us → американская), если нужной нет — любая; ko — запись словаря. */
function rec(text,l,acc){
  var n=norm(text);if(!n||n.split(' ').length>3)return '';
  var a=null;
  if(KR.vocab){var c=KR.vocab.find(l,text);if(c&&c.au)a=c.au}
  if(!a){var x=cached(text,l);if(x&&x.audio)a=x.audio}
  if(!a)return '';
  if(l==='en'){var want=acc==='us'?'us':'uk';return a[want]||a.any||a[want==='us'?'uk':'us']||a.au||''}
  return a[l]||'';
}
KR.rec=rec;
/* подпись источника перевода */
var SRC={base:'база школы',dict:'словарь','dict+deepl':'словарь + DeepL',deepl:'DeepL'};
KR.dict={rec:rec,get:get,put:put,cached:cached,translate:translate,enrich:enrich,refit:refit,senses:senses,pickSenses:pickSenses,examplesFor:examplesFor,SRC:SRC};
})();
