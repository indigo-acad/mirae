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
/* Распознавание на сервере (функция supabase/functions/stt, Gemini): запись с микрофона, конец фразы — по паузе,
   перевод в WAV 16 кГц моно, расшифровка. Нужна там, где браузер сам не распознаёт: из России (Chrome и Edge распознают
   через серверы Google и Microsoft), в Firefox, после сетевой ошибки распознавания браузера (дальше в этой вкладке — сервер). */
var CF=function(){return root.CONFIG||{}};
function sttUrl(){var c=CF();return c.STT_URL||(c.SUPABASE_URL?c.SUPABASE_URL+"/functions/v1/stt":"")}
var sttOff=0,preferC=false,micDenied=false;try{sttOff=+sessionStorage.getItem("kr_stt_off")||0;preferC=sessionStorage.getItem("kr_stt_cloud")==="1"}catch(e){}
function canRecord(){var n=root.navigator;return !!(n&&n.mediaDevices&&n.mediaDevices.getUserMedia&&root.MediaRecorder)}
function cloudOk(){var pin="";try{pin=localStorage.getItem("kr_pin")||""}catch(e){}return !!(sttUrl()&&canRecord()&&KR.user&&KR.user()&&pin&&Date.now()>sttOff&&!micDenied)}
function useCloud(){return cloudOk()&&(!Rec||blocked||preferC||!!(KR.inRu&&KR.inRu()))}
function canHear(){return (!!Rec&&!blocked)||cloudOk()}
var cur=null;
function b64(buf){var u=new Uint8Array(buf),s="",i;for(i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)}
/* любая запись → WAV 16 кГц моно (этот формат сервер принимает всегда); не вышло — отправляем как есть */
async function toWav(blob){
  try{
    var AC=root.AudioContext||root.webkitAudioContext,OC=root.OfflineAudioContext||root.webkitOfflineAudioContext;if(!AC||!OC)throw 0;
    var ac=new AC(),data=await blob.arrayBuffer();
    var ab=await new Promise(function(ok,bad){var p=ac.decodeAudioData(data,ok,bad);if(p&&p.then)p.then(ok,bad)});try{ac.close()}catch(e){}
    var rate=16000,n=Math.max(1,Math.ceil(ab.duration*rate)),oc=new OC(1,n,rate),src=oc.createBufferSource();src.buffer=ab;src.connect(oc.destination);src.start(0);
    var out=(await oc.startRendering()).getChannelData(0),wav=new ArrayBuffer(44+out.length*2),v=new DataView(wav);
    var w=function(o,t){for(var i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i))};
    w(0,"RIFF");v.setUint32(4,36+out.length*2,true);w(8,"WAVE");w(12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
    v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,"data");v.setUint32(40,out.length*2,true);
    for(var i=0;i<out.length;i++){var x=Math.max(-1,Math.min(1,out[i]));v.setInt16(44+i*2,x<0?x*0x8000:x*0x7FFF,true)}
    return {mime:"audio/wav",data:b64(wav)};
  }catch(e){return {mime:(blob.type||"audio/webm").split(";")[0],data:b64(await blob.arrayBuffer())}}
}
/* запись → текст (сервер). Ошибки — как у браузера: network, unsupported */
async function transcribe(blob,lang,prompt){
  var a=await toWav(blob),c=CF(),r;
  try{r=await fetch(sttUrl(),{method:"POST",headers:{"Content-Type":"application/json",apikey:c.SUPABASE_ANON_KEY,Authorization:"Bearer "+c.SUPABASE_ANON_KEY},
    body:JSON.stringify({p_name:KR.user(),p_pin:localStorage.getItem("kr_pin")||"",lang:lang,audio:a.data,mime:a.mime,prompt:prompt||""})})}
  catch(e){throw {error:"network"}}
  if(r.status===503){sttOff=Date.now()+20*60000;try{sessionStorage.setItem("kr_stt_off",String(sttOff))}catch(e){}throw {error:"unsupported"}}
  if(!r.ok)throw {error:"network"};
  var j=await r.json().catch(function(){return {}});return String(j.text||"").trim();
}
/* одна фраза через сервер: пишем, пока ученик говорит; 1,1 с тишины после речи — конец фразы */
function cloudRec(lang,opt){
  opt=opt||{};
  // звуковой контекст — сразу, пока длится нажатие: созданный позже браузер оставляет «спящим»
  var ac0=null;try{ac0=new (root.AudioContext||root.webkitAudioContext)();if(ac0.resume)ac0.resume()}catch(e){ac0=null}
  return new Promise(async function(res,rej){
    var stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){try{if(ac0)ac0.close()}catch(x){}micDenied=true;return rej({error:"not-allowed"})}
    var mime=["audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/mp4","audio/webm"].filter(function(t){return MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t)})[0]||"";
    var mr,parts=[];try{mr=new MediaRecorder(stream,mime?{mimeType:mime}:undefined)}catch(e){stream.getTracks().forEach(function(t){t.stop()});return rej({error:"start"})}
    mr.ondataavailable=function(e){if(e.data&&e.data.size)parts.push(e.data)};
    var ac=ac0,an=null,buf=null,heard=false;try{if(!ac)throw 0;if(ac.resume)ac.resume();var src=ac.createMediaStreamSource(stream);an=ac.createAnalyser();an.fftSize=1024;src.connect(an);buf=new Float32Array(an.fftSize)}catch(e){an=null}
    var t0=Date.now(),last=t0,spoke=false,floor=.008,done=false,cancel=false,max=opt.max||7000,tm;
    var finish=function(){if(done)return;done=true;clearInterval(tm);try{if(mr.state!=="inactive")mr.stop()}catch(e){}};
    tm=setInterval(function(){var now=Date.now();
      if(an){an.getFloatTimeDomainData(buf);var q=0;for(var i=0;i<buf.length;i++)q+=buf[i]*buf[i];var l=Math.sqrt(q/buf.length);
        if(l>0)heard=true;if(l>Math.max(.02,floor*3)){spoke=true;last=now}else if(!spoke)floor=floor*.9+l*.1}
      // анализатор молчит совсем (контекст не проснулся) — тишину не ловим, пишем до max
      if((spoke&&now-last>1100)||now-t0>max||(heard&&!spoke&&now-t0>6000))finish()},100);
    var me={abort:function(){cancel=true;finish()}};cur=me;
    mr.onstop=async function(){stream.getTracks().forEach(function(t){t.stop()});try{if(ac)ac.close()}catch(e){}if(cur===me)cur=null;
      if(cancel)return rej({error:"aborted"});if(heard&&!spoke)return rej({error:"no-speech"});
      try{var t=await transcribe(new Blob(parts,{type:mr.mimeType||mime||"audio/webm"}),lang,opt.prompt);t?res([t]):rej({error:"no-speech"})}catch(e){rej(e&&e.error?e:{error:"network"})}};
    try{mr.start(250)}catch(e){finish();return rej({error:"start"})}
    if(opt.start)opt.start();
  });
}
/* Слушает одну фразу. Возвращает варианты распознавания. Ошибки: no-speech, not-allowed, network, audio-capture, aborted. */
function recognize(lang,opt){
  opt=opt||{};
  if(useCloud())return cloudRec(lang,opt);
  return new Promise(function(res,rej){
    if(!Rec)return rej({error:"unsupported"});
    try{if(cur)cur.abort()}catch(e){}
    var r=new Rec(),done=false,alts=[];cur=r;
    r.lang=lang==="ko"?"ko-KR":opt.accent==="us"?"en-US":lang==="en"?"en-GB":lang;
    r.continuous=false;r.interimResults=false;r.maxAlternatives=5;
    r.onresult=function(e){var x=e.results&&e.results[0];if(x)for(var i=0;i<x.length;i++)if(x[i].transcript)alts.push(x[i].transcript)};
    r.onerror=function(e){if(done)return;done=true;cur=null;var er=e.error||"error";
      // браузер не достучался до своего сервера распознавания (так бывает из России): дальше в этой вкладке — наш сервер, сразу
      if(/network|service-not-allowed|language-not-supported/.test(er)&&cloudOk()){preferC=true;try{sessionStorage.setItem("kr_stt_cloud","1")}catch(x){}return cloudRec(lang,opt).then(res,rej)}
      if(/not-allowed|service-not-allowed|language-not-supported/.test(er))blocked=true;rej({error:er})};
    r.onend=function(){if(done)return;done=true;cur=null;alts.length?res(alts):rej({error:"no-speech"})};
    if(opt.start)r.onaudiostart=opt.start;
    try{r.start()}catch(e){done=true;cur=null;rej({error:"start"})}
    setTimeout(function(){try{if(!done)r.stop()}catch(e){}},opt.max||7000);
  });
}
function stopHear(){try{if(cur)cur.abort()}catch(e){}cur=null}
var ERR={"not-allowed":"Нет доступа к микрофону. Разреши его в настройках браузера (значок замка у адреса сайта).","service-not-allowed":"Браузер не дал распознавать речь. Попробуй Chrome или Safari.",
  "no-speech":"Ничего не услышали. Нажми и скажи слово чуть громче.","audio-capture":"Микрофон не найден.","network":"Для распознавания речи нужен интернет.","unsupported":"Распознавание речи сейчас недоступно. Ответь текстом или попробуй позже.","start":"Микрофон занят. Попробуй ещё раз через секунду.","aborted":""};
function errText(e){var k=e&&e.error||"";return k in ERR?ERR[k]:"Не получилось распознать. Попробуй ещё раз."}

KR.ear={jamo:jamo,clean:clean,lev:lev,sim:sim,heard:heard,koVariants:koVariants,enVariants:enVariants,alikes:alikes,
  cells:cells,typed:typed,check:check,hint:hint,count:count,canHear:canHear,recognize:recognize,stop:stopHear,errText:errText,
  cloudOk:cloudOk,useCloud:useCloud,transcribe:transcribe};
if(typeof module!=="undefined")module.exports=KR.ear;
})(typeof window!=="undefined"?window:globalThis);
