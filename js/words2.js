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
/* ---------- список слов с галочками: взять всё или часть ----------
   items: [{k: ключ, word, lang, tr: перевод строкой, badge, cls: ok|warn|new, off: нельзя выбрать, on: false — не отмечать сразу}].
   Отметки помнятся между перерисовками страницы; picked(name) — отмеченные ключи, pickReset(name) — забыть отметки. */
var PS={};
function cnt(n,all){return all?'Отмечено: '+n+' из '+all:'Выбрать нечего'}
function picker(name,items,o){
  o=o||{};var st=PS[name]||(PS[name]={});
  items.forEach(function(x){if(!x.off&&!(x.k in st))st[x.k]=x.on!==false});   // недоступную строку не запоминаем: она может стать доступной позже
  var live=items.filter(function(x){return !x.off}),n=live.filter(function(x){return st[x.k]}).length;
  return '<div class="wpick" data-pick="'+esc(name)+'"><div class="wpick-h">'+
    '<label class="pick"><input type="checkbox" data-pall'+(live.length&&n===live.length?' checked':'')+(live.length?'':' disabled')+(n&&n<live.length?' data-mixed':'')+'><span>Выбрать все</span></label>'+
    '<span class="muted" data-pcnt>'+cnt(n,live.length)+'</span></div><div class="wpick-l"'+(o.max?' style="max-height:'+(+o.max)+'px"':'')+'>'+
    items.map(function(x){
      return '<label class="wpick-i'+(x.off?' off':'')+'"><input type="checkbox" data-pk="'+esc(x.k)+'"'+(st[x.k]&&!x.off?' checked':'')+(x.off?' disabled':'')+'>'+
        '<span class="wpick-w"><b'+(x.lang==='ko'?' class="ko"':'')+' lang="'+esc(x.lang||'')+'">'+esc(x.word)+'</b>'+(x.tr?' <span class="muted">'+esc(x.tr)+'</span>':'')+'</span>'+
        (x.badge?'<span class="badge'+(x.cls?' '+esc(x.cls):'')+'">'+esc(x.badge)+'</span>':'')+'</label>'}).join('')+'</div></div>';
}
function pickBox(name){return [].filter.call(document.querySelectorAll('.wpick'),function(b){return b.dataset.pick===name})[0]||null}
function picked(name){var b=pickBox(name);return b?[].filter.call(b.querySelectorAll('input[data-pk]'),function(i){return i.checked&&!i.disabled}).map(function(i){return i.dataset.pk}):[]}
function pickReset(name){delete PS[name]}
/* сколько слов будет отмечено в списке items (до отрисовки) */
function pickCount(name,items){var st=PS[name]||{};return items.filter(function(x){return !x.off&&(x.k in st?st[x.k]:x.on!==false)}).length}
/* «Выбрать все» в промежуточном состоянии, когда отмечена часть (после перерисовки) */
function pickFix(){[].forEach.call(document.querySelectorAll('.wpick [data-pall][data-mixed]'),function(a){a.indeterminate=true})}
document.addEventListener('change',function(e){
  var t=e.target,box=t.closest&&t.closest('.wpick');if(!box)return;
  var name=box.dataset.pick,st=PS[name]||(PS[name]={}),all=[].filter.call(box.querySelectorAll('input[data-pk]'),function(i){return !i.disabled});
  if(t.dataset.pall!==undefined)all.forEach(function(i){i.checked=t.checked;st[i.dataset.pk]=t.checked});
  else if(t.dataset.pk!==undefined)st[t.dataset.pk]=t.checked;
  else return;
  var n=all.filter(function(i){return i.checked}).length,a=box.querySelector('[data-pall]'),c=box.querySelector('[data-pcnt]');
  if(a){a.checked=all.length>0&&n===all.length;a.indeterminate=n>0&&n<all.length}
  if(c)c.textContent=cnt(n,all.length);
  if(typeof KR.W2.onpick==='function')KR.W2.onpick(name,n,all.length);
});

/* ---------- список слов из Quizlet, таблицы или текста ----------
   Quizlet: «⋯ → Экспорт», между термином и определением Tab, между карточками новая строка (или точка с запятой).
   Таблица: столбцы слово, перевод, пример, перевод примера. Текст: «слово — перевод | пример | перевод примера».
   Если слово и перевод стоят наоборот (перевод слева), они меняются местами. Возвращает
   [{word, norm, tr: [...], ex: {s,t} | null, swapped, err}]; err — почему строку не взять. */
var CYR=/[А-Яа-яЁё]/,LAT=/[A-Za-z]/,HAN=/[ᄀ-ᇿ㄰-㆏가-힯]/;
function normW(s){return String(s||'').normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase()}
function isWord(s,lang){return lang==='ko'?HAN.test(s):LAT.test(s)&&!CYR.test(s)}
function cutRow(r){
  if(r.indexOf('\t')>=0)return r.split('\t');
  var m=r.match(/\s+[—–-]\s+|\s*=\s*/);
  if(m)return [r.slice(0,m.index),r.slice(m.index+m[0].length)];
  var c=r.indexOf(',');
  return c>0?[r.slice(0,c),r.slice(c+1)]:[r];
}
function parseList(text,lang){
  text=String(text||'').replace(/\r\n?/g,'\n').replace(/ /g,' ');
  var rows=text.split('\n').filter(function(r){return r.trim()});
  if(rows.length===1&&rows[0].indexOf(';')>0){
    var parts=rows[0].split(';').filter(function(r){return r.trim()});
    if(parts.length>1&&parts.every(function(p){return cutRow(p).length>1}))rows=parts;
  }
  var seen={};
  return rows.map(function(r){
    var c=cutRow(r).map(trim),a=c[0]||'',b=c[1]||'',ex=null,swapped=false;
    if(c.length<=2&&b.indexOf('|')>=0){var p=b.split('|').map(trim);b=p[0];c=[a,b,p[1]||'',p.slice(2).join(' | ')]}
    if(!isWord(a,lang)&&isWord(b,lang)){var t=a;a=b;b=t;swapped=true}
    if(c[2])ex={s:c[2].slice(0,300),t:(c[3]||'').slice(0,300)};
    var tr=lines(b).slice(0,10),it={word:a,norm:normW(a),tr:tr,ex:ex,swapped:swapped,err:''};
    if(!a)it.err='нет слова';
    else if(!isWord(a,lang))it.err=lang==='ko'?'не похоже на корейское слово':'не похоже на английское слово';
    else if(a.length>120)it.err='слово длиннее 120 знаков';
    else if(tr.some(function(x){return x.length>160}))it.err='перевод длиннее 160 знаков';
    else if(seen[it.norm])it.err='повтор';
    if(!it.err)seen[it.norm]=1;
    return it;
  });
}
KR.W2={POS:POS,LEVELS:LEVELS,lines:lines,commas:commas,exParse:exParse,exFormat:exFormat,card:card,source:source,chip:chip,esc:esc,
  picker:picker,picked:picked,pickReset:pickReset,pickCount:pickCount,pickFix:pickFix,parseList:parseList,norm:normW,onpick:null};
})();
