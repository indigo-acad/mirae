/* MIRAÉ · слух и речь для тренажёра слов (words.html).
   - recognize: распознавание речи браузером (Chrome, Edge, Safari); ученик говорит слово, мы сравниваем с правильным.
   - heard: насколько сказанное похоже на слово (корейский сравнивается по буквам-чамо, английский по буквам).
   - alikes: слова, похожие на слух, для игры «Что прозвучало» (달/탈/딸, ship/chip).
   - cells: клеточки для диктанта: корейский — слог в клеточке, английский — буква.
   Расчёты без страницы и сети, их можно проверить в node (см. README). */
(function(root){
"use strict";
var KR=root.KR||(root.KR={});

// ---------- хангыль: слог ⇄ буквы ----------
var L0=0xAC00,LN=0xD7A3;
var CHO="ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ".split("");
var JUNG="ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ".split("");
var JONG=["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
function isSyl(ch){var c=ch.charCodeAt(0);return c>=L0&&c<=LN}
function split(ch){var n=ch.charCodeAt(0)-L0;return [Math.floor(n/588),Math.floor(n%588/28),n%28]}
function join(a){return String.fromCharCode(L0+a[0]*588+a[1]*28+a[2])}
/* слово → последовательность букв: 학교 → ㅎㅏㄱㄱㅛ */
function jamo(s){var out=[];String(s||"").normalize("NFC").split("").forEach(function(ch){
  if(isSyl(ch)){var p=split(ch);out.push(CHO[p[0]],JUNG[p[1]]);if(p[2])out.push(JONG[p[2]])}else out.push(ch)});return out}

// ---------- сравнение ----------
function clean(s){return String(s==null?"":s).normalize("NFC").toLowerCase().replace(/[\s.,!?·~'’"«»“”()\-–—:;…]/g,"")}
function lev(a,b){
  var m=a.length,n=b.length,d=[],i,j;if(!m)return n;if(!n)return m;
  for(j=0;j<=n;j++)d[j]=j;
  for(i=1;i<=m;i++){var prev=d[0];d[0]=i;for(j=1;j<=n;j++){var t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=t}}
  return d[n];
}
function units(s,lang){s=clean(s);return lang==="ko"?jamo(s):s.split("")}
/* похожесть 0…1 */
function sim(a,b,lang){var x=units(a,lang),y=units(b,lang),n=Math.max(x.length,y.length);return n?1-lev(x,y)/n:0}
/* Что сказал ученик (несколько вариантов распознавания) против правильного слова.
   ok — сказал верно; close — почти (не хватило звука или распознавание ослышалось); best — что лучше всего совпало. */
function heard(alts,target,lang){
  var t=clean(target),best="",score=0,ok=false;
  // корейский глагол можно сказать и без -다; английское слово — с артиклем
  var forms=[t];if(lang==="ko"&&t.length>2&&t.slice(-1)==="다")forms.push(t.slice(0,-1));
  if(lang==="en")forms.push(t.replace(/^(to|a|an|the)(?=\w{3})/,""));
  (alts||[]).forEach(function(a){
    var c=clean(a);if(!c)return;
    forms.forEach(function(f){
      var s=sim(c,f,lang);
      if(c===f||(f.length>=2&&c.indexOf(f)>=0&&c.length<=f.length+4))s=1;   // «가방이요», «a bag»
      if(s>score){score=s;best=String(a).trim()}
    });
  });
  ok=score>=0.999;
  return {ok:ok,close:!ok&&score>=0.7,score:score,best:best};
}

// ---------- похожие на слух ----------
/* Корейский: меняем один звук так, чтобы слово звучало иначе.
   Согласная в начале слога — только если перед ней нет патчхима: иначе её звук и так меняется (학교 [학꾜]).
   Гласные ㅐ/ㅔ, ㅚ/ㅙ/ㅞ и ㅢ не трогаем: на слух их почти не различают. Патчхим — только простые, звучащие по-разному. */
var CG=[[0,1,15],[3,4,16],[7,8,17],[12,13,14],[9,10],[2,5],[6,2],[11,18]];  // ㄱㄲㅋ ㄷㄸㅌ ㅂㅃㅍ ㅈㅉㅊ ㅅㅆ ㄴㄹ ㅁㄴ ㅇㅎ
var VG=[[4,8],[13,18],[0,4],[6,12],[2,6],[8,13],[17,13]];                 // ㅓㅗ ㅜㅡ ㅏㅓ ㅕㅛ ㅑㅕ ㅗㅜ ㅠㅜ
var FS=[0,1,4,8,16,17,21];                                                  // нет, ㄱ ㄴ ㄹ ㅁ ㅂ ㅇ
function koVariants(w){
  var ch=String(w).normalize("NFC").split(""),out={};
  ch.forEach(function(c,i){
    if(!isSyl(c))return;var p=split(c),prev=i>0&&isSyl(ch[i-1])?split(ch[i-1]):null,next=i+1<ch.length&&isSyl(ch[i+1])?split(ch[i+1]):null;
    var put=function(q){var s=ch.slice();s[i]=join(q);out[s.join("")]=1};
    if(!prev||!prev[2])CG.forEach(function(g){if(g.indexOf(p[0])>=0)g.forEach(function(x){if(x!==p[0])put([x,p[1],p[2]])})});
    VG.forEach(function(g){if(g.indexOf(p[1])>=0)g.forEach(function(x){if(x!==p[1])put([p[0],x,p[2]])})});
    // патчхим меняем, только если следующий слог не начинается с ㅇ (тогда он переходит в следующий слог и звучит иначе)
    if(FS.indexOf(p[2])>=0&&!(next&&next[0]===11))FS.forEach(function(x){if(x!==p[2])put([p[0],p[1],x])});
  });
  delete out[w];return Object.keys(out);
}
/* Английский: меняем одну согласную на близкую по звуку (ship → chip, very → wery). Гласные не трогаем:
   по написанию не угадать, изменится ли звук (see / sea). */
var EP=[["th","s"],["th","f"],["sh","s"],["ch","sh"],["b","p"],["d","t"],["v","w"],["l","r"],["f","v"],["g","k"],["m","n"],["s","z"],["j","ch"]];
function enVariants(w){
  var s=String(w).toLowerCase(),out={};
  EP.forEach(function(p){[[p[0],p[1]],[p[1],p[0]]].forEach(function(ab){
    var a=ab[0],b=ab[1],i=s.indexOf(a);
    while(i>=0){
      var before=s[i-1]||"",after=s[i+a.length]||"";
      // не трогаем немые и сочетания: kn, gn, wr, mb, ng, -le; и буквы внутри th/sh/ch, если меняем одну букву
      var bad=(a.length===1&&after==="h")||before===a||after===a||(i<2&&/^(kn|gn|wr|ps)/.test(s))||(a==="g"&&(after==="n"||before==="n"))||(a==="b"&&before==="m")||(a==="l"&&after==="e"&&i===s.length-2)||(a==="s"&&before==="s")||(a==="d"&&before==="e"&&i===s.length-1);
      if(!bad&&/[a-z]/.test(s)){var v=s.slice(0,i)+b+s.slice(i+a.length);if(v!==s)out[v]=1}
      i=s.indexOf(a,i+1);
    }
  })});
  return Object.keys(out);
}
/* n слов, похожих на word: сначала настоящие слова из словаря ученика (отличаются на 1–2 звука), потом придуманные. */
function alikes(word,lang,pool,n,rnd){
  rnd=rnd||Math.random;n=n||3;var w=String(word).trim(),cw=clean(w),seen={},out=[];seen[cw]=1;
  var lim=lang==="ko"?2:Math.max(1,Math.round(cw.length/4));
  var real=(pool||[]).filter(function(x){var c=clean(x);if(!c||seen[c])return false;var u=units(w,lang),v=units(x,lang);return Math.abs(u.length-v.length)<=1&&lev(u,v)<=lim});
  real.sort(function(){return rnd()-.5}).forEach(function(x){if(out.length<Math.min(n,2)&&!seen[clean(x)]){seen[clean(x)]=1;out.push(x)}});
  var fake=(lang==="ko"?koVariants(w):enVariants(w)).sort(function(){return rnd()-.5});
  fake.forEach(function(x){if(out.length<n&&!seen[clean(x)]){seen[clean(x)]=1;out.push(x)}});
  return out;
}

// ---------- клеточки ----------
/* Текст → клеточки по словам. Корейский: слог в клеточке; английский: буква. Знаки препинания уже вписаны. */
function cells(text,lang){
  var words=String(text||"").normalize("NFC").trim().split(/\s+/).filter(Boolean),k=0;
  return words.map(function(w){return w.split("").map(function(ch){
    var letter=/[\p{L}\p{N}]/u.test(ch);return letter?{ch:ch,k:k++}:{ch:ch,fix:1}})});
}
/* Что ученик вписал: только буквы (пробелы и знаки не важны) */
function typed(v){return String(v||"").normalize("NFC").replace(/[^\p{L}\p{N}]/gu,"").split("")}
/* Сравнение по клеточкам: для каждой клеточки — что вписано и верно ли. */
function check(text,lang,value){
  var cs=cells(text,lang),t=typed(value),flat=[];cs.forEach(function(w){w.forEach(function(c){if(!c.fix)flat.push(c)})});
  var same=function(a,b){return !!(a&&b&&a.toLowerCase()===b.toLowerCase())};
  var res=flat.map(function(c,i){return {ch:c.ch,got:t[i]||"",ok:same(t[i],c.ch)}});
  var bad=res.filter(function(r){return !r.ok}).length;
  return {cells:res,bad:bad,extra:Math.max(0,t.length-flat.length),total:flat.length,ok:!bad&&t.length===flat.length};
}
/* Подсказка: начало правильного текста до первой неверной клеточки включительно */
function hint(text,lang,value){
  var r=check(text,lang,value),i=0;while(i<r.cells.length&&r.cells[i].ok)i++;
  if(i>=r.cells.length)return text;var n=-1,s=String(text).normalize("NFC");
  for(var j=0;j<s.length;j++){if(/[\p{L}\p{N}]/u.test(s[j])){n++;if(n===i)return s.slice(0,j+1)}}
  return s;
}
/* сколько слов во фразе */
function count(text){return String(text||"").trim().split(/\s+/).filter(function(w){return /[\p{L}\p{N}]/u.test(w)}).length}

// ---------- распознавание речи ----------
var Rec=root.SpeechRecognition||root.webkitSpeechRecognition||null;
var blocked=false;   // микрофон запрещён или распознавание недоступно: до перезагрузки страницы не предлагаем говорить
function canHear(){return !!Rec&&!blocked}
var cur=null;
/* Слушает одну фразу. Возвращает варианты распознавания. Ошибки: no-speech, not-allowed, network, audio-capture, aborted. */
function recognize(lang,opt){
  opt=opt||{};
  return new Promise(function(res,rej){
    if(!Rec)return rej({error:"unsupported"});
    try{if(cur)cur.abort()}catch(e){}
    var r=new Rec(),done=false,alts=[];cur=r;
    r.lang=lang==="ko"?"ko-KR":opt.accent==="us"?"en-US":lang==="en"?"en-GB":lang;
    r.continuous=false;r.interimResults=false;r.maxAlternatives=5;
    r.onresult=function(e){var x=e.results&&e.results[0];if(x)for(var i=0;i<x.length;i++)if(x[i].transcript)alts.push(x[i].transcript)};
    r.onerror=function(e){if(done)return;done=true;cur=null;if(/not-allowed|service-not-allowed|language-not-supported/.test(e.error||""))blocked=true;rej({error:e.error||"error"})};
    r.onend=function(){if(done)return;done=true;cur=null;alts.length?res(alts):rej({error:"no-speech"})};
    if(opt.start)r.onaudiostart=opt.start;
    try{r.start()}catch(e){done=true;cur=null;rej({error:"start"})}
    setTimeout(function(){try{if(!done)r.stop()}catch(e){}},opt.max||7000);
  });
}
function stopHear(){try{if(cur)cur.abort()}catch(e){}cur=null}
var ERR={"not-allowed":"Нет доступа к микрофону. Разреши его в настройках браузера (значок замка у адреса сайта).","service-not-allowed":"Браузер не дал распознавать речь. Попробуй Chrome или Safari.",
  "no-speech":"Ничего не услышали. Нажми и скажи слово чуть громче.","audio-capture":"Микрофон не найден.","network":"Для распознавания речи нужен интернет.","unsupported":"В этом браузере нет распознавания речи. Подойдут Chrome, Edge или Safari.","start":"Микрофон занят. Попробуй ещё раз через секунду.","aborted":""};
function errText(e){var k=e&&e.error||"",t=k in ERR?ERR[k]:"Не получилось распознать. Попробуй ещё раз.";
  if(t&&/network|service-not-allowed|error/.test(k)&&KR.inRu&&KR.inRu())t+=" Из России распознавание речи может быть недоступно — ответь текстом.";return t}

KR.ear={jamo:jamo,clean:clean,lev:lev,sim:sim,heard:heard,koVariants:koVariants,enVariants:enVariants,alikes:alikes,
  cells:cells,typed:typed,check:check,hint:hint,count:count,canHear:canHear,recognize:recognize,stop:stopHear,errText:errText};
if(typeof module!=="undefined")module.exports=KR.ear;
})(typeof window!=="undefined"?window:globalThis);
