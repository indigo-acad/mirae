/* MIRAÉ · значения слова (KR.mean): несколько переводов и определений на любых языках, синонимы, устойчивые выражения,
   и проверка ответа, при которой синоним или другое значение слова не считается ошибкой.
   Поля карточки ученика (js/srs.js): t — переводы по-русски через «;», d — определения [{l, s}] (l — язык: ru, en, ko, ja…),
   syn — синонимы [строки], col — устойчивые выражения [{s, t}]. Из базы школы (INFO, js/words2.js) добавляются
   tr_ru, tr_ko, explanation, synonyms, examples.
   Расчёты без страницы и сети, их можно проверить в node (см. README). */
(function(root){
"use strict";
var KR=root.KR||(root.KR={});
var NAMES={ru:'рус',en:'англ',ko:'кор',ja:'яп',zh:'кит',de:'нем',fr:'фр',es:'исп',it:'ит',pt:'порт',tr:'тур',ar:'араб',vi:'вьет',th:'тай',uz:'узб',kk:'каз',uk:'укр',hy:'арм',ka:'груз'};
var FULL={ru:'по-русски',en:'по-английски',ko:'по-корейски',ja:'по-японски',zh:'по-китайски',de:'по-немецки',fr:'по-французски',es:'по-испански'};
function trim(s){return String(s==null?'':s).normalize('NFC').replace(/\s+/g,' ').trim()}
function uniq(a){var s={},r=[];a.forEach(function(x){x=trim(x);var k=x.toLowerCase();if(x&&!s[k]){s[k]=1;r.push(x)}});return r}
/* язык строки по буквам; «xx: текст» в начале — язык указан явно */
function langOf(s){
  s=String(s||'');
  if(/[ᄀ-ᇿ㄰-㆏가-힯]/.test(s))return 'ko';
  if(/[぀-ヿ]/.test(s))return 'ja';
  if(/[一-鿿]/.test(s))return 'zh';
  if(/[Ѐ-ӿ]/.test(s))return /[іїєґ]/i.test(s)?'uk':'ru';
  if(/[؀-ۿ]/.test(s))return 'ar';
  if(/[฀-๿]/.test(s))return 'th';
  if(/[Ա-֏]/.test(s))return 'hy';
  if(/[Ⴀ-ჿ]/.test(s))return 'ka';
  if(/[A-Za-zÀ-ɏ]/.test(s))return 'en';
  return '';
}
function tagged(line){
  var m=String(line).match(/^\s*([a-z]{2,3})\s*[:：]\s*(.+)$/i);
  if(m&&(NAMES[m[1].toLowerCase()]||m[1].length===2))return {l:m[1].toLowerCase(),s:trim(m[2])};
  line=trim(line);return {l:langOf(line)||'ru',s:line};
}
/* определения — по одному на строку: «en: a place to live», «살 곳», «место, где живут» */
function parseDefs(text){var seen={};return String(text||'').split(/\n/).map(tagged).filter(function(d){var k=d.l+':'+d.s.toLowerCase();if(!d.s||seen[k])return false;seen[k]=1;return true}).slice(0,12)}
function fmtDefs(a){return (a||[]).map(function(d){return (d.l&&d.l!==langOf(d.s)?d.l+': ':'')+d.s}).join('\n')}
/* устойчивые выражения — по одному на строку: «make a decision | принять решение» */
function parseCols(text){return String(text||'').split(/\n/).map(function(l){var p=l.split('|');return {s:trim(p[0]),t:trim(p.slice(1).join('|'))}}).filter(function(x){return x.s}).slice(0,12)}
function fmtCols(a){return (a||[]).map(function(x){return x.s+(x.t?' | '+x.t:'')}).join('\n')}
function parseSyn(text){return uniq(String(text||'').split(/[,;\n]/)).slice(0,12)}
/* Строка «перевод» из формы или списка: «жильё; place to live; 숙소» — русское идёт в переводы, остальное в определения. */
function splitTr(text,wordLang){
  var ru=[],d=[];
  String(text||'').split(/;|\n/).forEach(function(p){
    p=trim(p);if(!p)return;var x=tagged(p);
    if(x.l==='ru')ru.push(x.s);else d.push(x);
  });
  return {t:uniq(ru).join('; '),d:d};
}

// ---------- что известно о слове ----------
function trs(c,I){I=I||{};return uniq(String(c.t||'').split(/;|\n/).concat(I.tr_ru||[]))}
function defs(c,I){
  I=I||{};var out=(c.d||[]).slice();
  if(c.l!=='ko')(I.tr_ko||[]).forEach(function(s){out.push({l:'ko',s:s})});
  if(I.explanation)out.push({l:langOf(I.explanation)||'ru',s:I.explanation});
  var seen={};return out.filter(function(x){var k=x.l+':'+trim(x.s).toLowerCase();if(!x.s||seen[k])return false;seen[k]=1;return true});
}
function syns(c,I){I=I||{};return uniq((c.syn||[]).concat(I.synonyms||[]))}
function cols(c){return (c.col||[]).filter(function(x){return x&&x.s})}
/* определения на изучаемом языке (для отработки в контексте) */
function tdefs(c,I){return defs(c,I).filter(function(x){return x.l===c.l})}

// ---------- сравнение ----------
function lev(a,b){
  var m=a.length,n=b.length,d=[],i,j;if(!m)return n;if(!n)return m;
  for(j=0;j<=n;j++)d[j]=j;
  for(i=1;i<=m;i++){var prev=d[0];d[0]=i;for(j=1;j<=n;j++){var t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=t}}
  return d[n];
}
/* для сравнения значений: регистр, ё/е, знаки, скобки не важны */
function nm(s,keepPar){
  s=String(s==null?'':s).normalize('NFC').toLowerCase().replace(/ё/g,'е');
  if(!keepPar)s=s.replace(/\([^)]*\)|\[[^\]]*\]/g,' ');
  s=s.replace(/[()\[\]]/g,' ').replace(/[.,!?;:"'’«»“”…~·\/\\]/g,' ').replace(/[-–—]/g,' ').replace(/\s+/g,' ').trim();
  return s.replace(/^(to|a|an|the|что то|кто то|кого то|чего то|что-то|кого-то)\s+/,'');
}
/* для сравнения слов: пробелы и знаки тоже не важны */
function nw(s){return nm(s).replace(/\s+/g,'')}
/* варианты одного значения: «болеть, быть больным» → болеть / быть больным / целиком */
function pieces(list){
  var out=[];(list||[]).forEach(function(s){
    s=String(s||'');[s].concat(s.split(/[,;\/]|\s+или\s+|\s+or\s+/)).forEach(function(p){
      [nm(p),nm(p,true)].forEach(function(x){if(x&&out.indexOf(x)<0)out.push(x)});
    });
  });
  return out;
}
function tol(n){return n>=10?2:n>=5?1:0}
/* Ответ про значение (перевод, определение, синоним): ok — совпало с одним из значений, typo — с опечаткой. */
function meaningOk(answer,targets){
  var ps=pieces(targets),parts=pieces([answer]).filter(Boolean),best=null;
  if(!parts.length)return {ok:false};
  parts.forEach(function(a){ps.forEach(function(p){
    if(best&&!best.typo)return;
    if(a===p)best={ok:true,match:p};
    else if(!best&&p.length>=4&&lev(a,p)<=tol(p.length))best={ok:true,typo:true,match:p};
  })});
  return best||{ok:false};
}
/* формы самого слова: «갖다 주다 / 가져다 주다», «(to) borrow», «take off (clothes)» */
function forms(w){return uniq(String(w||'').split('/').map(function(x){return trim(x)})).map(nw).filter(Boolean)}
/* Значения пересекаются: одно слово — синоним другого или у них общий перевод. Такие слова не ставим вариантами
   в одно задание и засчитываем одно вместо другого. */
function related(a,b,Ia,Ib){
  if(!a||!b||a.id===b.id||a.l!==b.l)return false;
  var sa=syns(a,Ia).map(nw),sb=syns(b,Ib).map(nw);
  if(forms(b.w).some(function(f){return sa.indexOf(f)>=0})||forms(a.w).some(function(f){return sb.indexOf(f)>=0}))return true;
  var ta=trs(a,Ia).map(function(x){return nm(x)}),tb=trs(b,Ib).map(function(x){return nm(x)});
  return ta.some(function(x){return x&&x.length>1&&tb.indexOf(x)>=0});
}
/* Написанное или сказанное слово: kind — word (то самое слово), syn (синоним), rel (другое слово с тем же значением).
   others — [{c, I}] остальные слова словаря того же языка. */
function wordOk(answer,c,I,others){
  var a=nw(answer);if(!a)return {ok:false};
  if(forms(c.w).indexOf(a)>=0)return {ok:true,kind:'word',match:c.w};
  var s=syns(c,I).filter(function(x){return forms(x).indexOf(a)>=0})[0];
  if(s)return {ok:true,kind:'syn',match:s};
  var r=(others||[]).filter(function(o){return forms(o.c.w).indexOf(a)>=0&&related(c,o.c,I,o.I)})[0];
  if(r)return {ok:true,kind:'rel',match:r.c.w};
  return {ok:false};
}
// ---------- уровень ученика и сложность текста ----------
/* Примеры, определения и выражения в контексте — по уровню ученика, а не слова: даже у слова 4급 пример должен быть
   понятен ученику 2급. Сложность меряем длиной: корейский — слоги хангыля и слова (어절), английский — слова. */
var LV={ko:['1급','2급','3급','4급','5급','6급'],en:['A1','A2','B1','B2','C1','C2']};
var CAP={ko:{syl:[14,22,32,45,65,999],tok:[4,6,8,11,15,99]},en:{tok:[7,11,15,20,28,99]}};
function lvIdx(l,lv){var a=LV[l]||LV.en,i=a.indexOf(lv);return i<0?1:i}
/* уровень ученика: из настроек (Настройки → «Мой уровень»), иначе — по числу слов в словаре */
function level(l){
  var a=LV[l]||LV.en,V=root.KR&&root.KR.vocab,s=V&&V.settings?V.settings():{},v=(s.lv||{})[l];
  return a.indexOf(v)>=0?v:levelAuto(l);
}
function levelAuto(l){var a=LV[l]||LV.en,V=root.KR&&root.KR.vocab,n=V&&V.all?V.all(l).length:0;return a[n<120?0:n<400?1:n<900?2:3]}
function size(s){s=String(s||'');return {syl:(s.match(/[가-힯]/g)||[]).length,tok:s.split(/\s+/).filter(Boolean).length}}
/* текст по силам ученику; k — запас (определения чуть длиннее примеров) */
function fits(s,l,lv,k){
  var i=lvIdx(l==='ko'?'ko':'en',lv||level(l)),z=size(s),c=CAP[l==='ko'?'ko':'en'];k=k||1;
  return l==='ko'?z.syl<=c.syl[i]*k&&z.tok<=c.tok[i]*k:z.tok<=c.tok[i]*k;
}
/* примеры по силам ученику, лучшие первыми: не слишком короткие (от 3 слов) и не на пределе уровня */
function byLevel(list,l,lv){
  lv=lv||level(l);var i=lvIdx(l==='ko'?'ko':'en',lv),c=CAP[l==='ko'?'ko':'en'],aim=(l==='ko'?c.syl[i]:c.tok[i])*.55;
  return (list||[]).filter(function(x){return x&&fits(x.s||x,l,lv)}).map(function(x){var z=size(x.s||x),n=l==='ko'?z.syl:z.tok;
    return {x:x,k:(z.tok<3?100:0)+Math.abs(n-aim)}}).sort(function(a,b){return a.k-b.k}).map(function(o){return o.x});
}
KR.mean={LV:LV,level:level,levelAuto:levelAuto,fits:fits,byLevel:byLevel,NAMES:NAMES,FULL:FULL,langOf:langOf,parseDefs:parseDefs,fmtDefs:fmtDefs,parseCols:parseCols,fmtCols:fmtCols,parseSyn:parseSyn,splitTr:splitTr,
  trs:trs,defs:defs,tdefs:tdefs,syns:syns,cols:cols,nm:nm,nw:nw,forms:forms,meaningOk:meaningOk,wordOk:wordOk,related:related,lev:lev};
})(typeof window!=="undefined"?window:globalThis);
