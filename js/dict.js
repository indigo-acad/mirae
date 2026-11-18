/* MIRAÉ · словарь (KR.dict): статья словаря для слова — функция supabase/functions/dict-lookup.
   Корейский — 한국어기초사전 (определение по-корейски, переводы на английский и русский, примеры, синонимы, уровень),
   английский — Free Dictionary API / Викисловарь (определения, примеры, синонимы, транскрипция).
   get(word, lang) — статья (хранится на устройстве неделю); enrich(card, entry) — дописать в карточку то, чего в ней нет;
   put(entry) — положить в кэш статью, пришедшую вместе с переводом (translate-words).
   Перевод «словарь → DeepL» для списка слов и выделения в уроке — функция translate-words: база школы, словарь, DeepL. */
(function(){
"use strict";
var KR=window.KR;if(!KR)return;
var norm=function(s){return String(s==null?'':s).normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase()};
var DAY=86400000,DQ={},cfg=function(){return window.CONFIG||{}};
var key=function(w,l){return 'kr_dict2:'+l+':'+norm(String(w).split('/')[0])};
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
/* статья словаря → карточка: добавляем недостающее, своё ученика и преподавателя не трогаем */
function enrich(c,r){
  c=Object.assign({},c);c.dq=1;if(!r||!r.found)return c;
  var k=function(d){return d.l+':'+String(d.s).toLowerCase()};
  if(!c.t&&(r.tr_ru||[]).length)c.t=r.tr_ru.slice(0,3).join('; ');
  var have=(c.d||[]).map(k),per={};
  var nd=(r.defs||[]).filter(function(d){if(!d.s||have.indexOf(k(d))>=0||d.s===c.t)return false;per[d.l]=(per[d.l]||0)+1;return per[d.l]<=2});
  if(nd.length)c.d=(c.d||[]).concat(nd).slice(0,8);
  var own=(c.syn||[]).map(norm),sy=(c.syn||[]).concat((r.syn||[]).filter(function(x){return own.indexOf(norm(x))<0&&norm(x)!==norm(c.w)}));
  if(sy.length)c.syn=sy.slice(0,8);
  var co=(c.col||[]).concat((r.cols||[]).filter(function(x){return !(c.col||[]).some(function(y){return y.s===x.s})}));
  if(co.length)c.col=co.slice(0,6);
  var ex=(r.examples||[])[0];if(!c.ex&&ex&&ex.s){c.ex=ex.s;if(ex.t)c.et=ex.t}
  if(!c.ipa&&r.ipa)c.ipa=r.ipa;
  if(r.srcName)c.dsrc=r.srcName;
  if(r.audio&&Object.keys(r.audio).length&&!c.au)c.au=r.audio;
  return c;
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
KR.dict={rec:rec,get:get,put:put,cached:cached,translate:translate,enrich:enrich,SRC:SRC};
})();
