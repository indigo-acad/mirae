/* MIRAÉ · словарь 2.0 (KR.W2): карточка слова из базы школы (supabase/vocab2.sql).
   Здесь общие подписи, разбор полей формы и разметка карточки — для страниц «Слова» (ученик) и «Словари» (преподаватель).
   Поля слова в базе: word, lang, pos, level, tr_ru[], tr_ko[], ipa_uk, ipa_us, examples[{s,t}], explanation,
   synonyms[], image, topics[], checked. */
(function(){
"use strict";
var KR=window.KR;if(!KR)return;
var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var trim=function(s){return String(s==null?'':s).replace(/\s+/g,' ').trim()};
var POS={noun:'существительное',verb:'глагол',adjective:'прилагательное',adverb:'наречие',pronoun:'местоимение',preposition:'предлог',
  conjunction:'союз',interjection:'междометие',phrase:'фраза',phrasal_verb:'фразовый глагол',idiom:'идиома',number:'числительное',
  particle:'частица',determiner:'определитель'};
var LEVELS={en:['A1','A2','B1','B2','C1','C2'],ko:['1급','2급','3급','4급','5급','6급']};
function uniq(a){var s={},r=[];a.forEach(function(x){x=trim(x);var k=x.toLowerCase();if(x&&!s[k]){s[k]=1;r.push(x)}});return r}
/* переводы — по одному на строку или через «;» (запятая бывает внутри перевода) */
function lines(s){return uniq(String(s||'').split(/\n|;/))}
/* синонимы и темы — через запятую */
function commas(s){return uniq(String(s||'').split(/[,;\n]/))}
/* примеры — по одному на строку: «пример | перевод» */
function exParse(s){return String(s||'').split('\n').map(function(l){var p=l.split('|');return {s:trim(p[0]),t:trim(p.slice(1).join('|'))}}).filter(function(x){return x.s})}
function exFormat(a){return (a||[]).map(function(x){return x.s+(x.t?' | '+x.t:'')}).join('\n')}
function chip(t,cls){return '<span class="chip'+(cls?' '+cls:'')+'">'+esc(t)+'</span>'}
function sayBtn(text,l,label){return KR.canSay()?'<button type="button" class="say" data-say="'+esc(text)+'" data-l="'+esc(l)+'" aria-label="'+esc(label||'Послушать')+'">'+KR.icon('volume',16)+'</button>':''}
/* откуда слово у ученика */
function source(src,setTitle){
  src=String(src||'');
  if(/^set:/.test(src))return setTitle?'из словаря «'+setTitle+'»':'из словаря преподавателя';
  if(/^lesson:/.test(src))return 'из урока';
  if(src==='teacher')return 'от преподавателя';
  return 'добавлено тобой';
}
/* Карточка слова. i — слово из базы школы (может не быть), c — карточка ученика из js/vocab.js (может не быть). */
function card(i,c){
  i=i||{};c=c||{};
  var l=i.lang||c.l||'en',w=i.word||c.w||'',ko=l==='ko',lk=ko?' class="ko" lang="ko"':' lang="'+esc(l)+'"';
  var tr=uniq([c.t||''].concat(i.tr_ru||[])),ex=(i.examples||[]).slice();
  if(c.ex&&!ex.some(function(x){return x.s===c.ex}))ex.unshift({s:c.ex,t:c.et||''});
  var meta=[i.pos?chip(POS[i.pos]||i.pos):'',i.level?chip(i.level,'lv'):''].join('');
  var h='<div class="wcard"><div class="wc-head"><div class="wc-title"><div class="wc-w"><b'+lk+'>'+esc(w)+'</b>'+(l==='en'&&(i.ipa_uk||i.ipa_us)?'':sayBtn(w,l))+'</div>'+
    (meta?'<div class="wc-meta">'+meta+'</div>':'')+'</div>'+
    (i.image?'<img class="wc-img" src="'+esc(i.image)+'" alt="'+esc(w)+'" loading="lazy" referrerpolicy="no-referrer">':'')+'</div>';
  if(l==='en'&&(i.ipa_uk||i.ipa_us)){
    h+='<div class="wc-ipa">'+[['gb','брит.',i.ipa_uk],['us','амер.',i.ipa_us]].filter(function(x){return x[2]}).map(function(x){
      return '<span class="ipa"><small>'+x[1]+'</small> <span lang="en">'+esc(x[2])+'</span>'+sayBtn(w,'en-'+x[0],'Послушать: '+(x[0]==='us'?'американское':'британское')+' произношение')+'</span>'}).join('')+'</div>';
  }
  h+='<div class="wc-sec"><h4>Перевод</h4><p>'+(tr.length?tr.map(esc).join('; '):'<span class="muted">перевод не указан</span>')+'</p>'+
    ((i.tr_ko||[]).length?'<p class="muted"><span class="ko" lang="ko">'+i.tr_ko.map(esc).join('; ')+'</span></p>':'')+'</div>';
  if(i.explanation)h+='<div class="wc-sec"><h4>Объяснение</h4><p>'+esc(i.explanation)+'</p></div>';
  if(ex.length)h+='<div class="wc-sec"><h4>'+(ex.length>1?'Примеры':'Пример')+'</h4>'+ex.slice(0,5).map(function(x){
    return '<div class="wc-ex"><p'+lk+'>'+esc(x.s)+sayBtn(x.s,l,'Послушать пример')+'</p>'+(x.t?'<p class="muted">'+esc(x.t)+'</p>':'')+'</div>'}).join('')+'</div>';
  if((i.synonyms||[]).length)h+='<div class="wc-sec"><h4>Синонимы</h4><p class="chips">'+i.synonyms.map(function(s){return chip(s,ko?'ko':'')}).join('')+'</p></div>';
  if((i.topics||[]).length)h+='<div class="wc-sec"><h4>Темы</h4><p class="chips">'+i.topics.map(function(s){return chip(s)}).join('')+'</p></div>';
  return h+'</div>';
}
KR.W2={POS:POS,LEVELS:LEVELS,lines:lines,commas:commas,exParse:exParse,exFormat:exFormat,card:card,source:source,chip:chip,esc:esc};
})();
