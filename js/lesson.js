(function(){
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const norm=s=>String(s).normalize("NFC").replace(/[\s?.!,]/g,"").toLowerCase();
const ic=(n,s)=>window.KR?KR.icon(n,s):"";          // контурный значок
const em=(e,s)=>window.KR?KR.emo(e,s)+" ":esc(e)+" "; // значок раздела из данных урока (там эмодзи)
const user=localStorage.getItem("kr_user");
const Q=new URLSearchParams(location.search);
const HWID=Q.get("hw");   // домашка от преподавателя: lesson.html?hw=<номер>
let id=Q.get("l")||"l12-jiyo";
let L=HWID?null:(window.LESSONS||{})[id];
if(!HWID&&!L&&!/^lib-\d+$/.test(id)){document.body.innerHTML="<p style='padding:20px'>Урок не найден.</p>";return}
if(!user){location.href="auth.html";return}
let KEY="",P={};
function save(){try{localStorage.setItem(KEY,JSON.stringify(P))}catch(e){}
  if(window.KR)KR.push();   // прогресс уходит в облако вместе с остальным состоянием ученика
}
let LANG="ko";   // язык урока: задаёт голос озвучки и оформление страницы
function say(t){if(window.KR)KR.say(t,LANG)}
window.say=say;
const sayBtn=t=>`<button class="say" data-say="${esc(t)}" title="Послушать" aria-label="Послушать">${ic("volume",16)}</button>`;

/* Сборка слогов из букв (для блока build): ㄱ ㅏ ㄴ → 간, ㄴ ㅏ ㅁ ㅜ → 나무, две гласные подряд сливаются (ㅗ+ㅏ → ㅘ). */
const CHO="ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ",JUNG="ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG=["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const VV={"ㅗㅏ":"ㅘ","ㅗㅐ":"ㅙ","ㅗㅣ":"ㅚ","ㅜㅓ":"ㅝ","ㅜㅔ":"ㅞ","ㅜㅣ":"ㅟ","ㅡㅣ":"ㅢ","ㅏㅣ":"ㅐ","ㅓㅣ":"ㅔ","ㅑㅣ":"ㅒ","ㅕㅣ":"ㅖ","ㅘㅣ":"ㅙ","ㅝㅣ":"ㅞ"};
const CC={"ㄱㅅ":"ㄳ","ㄴㅈ":"ㄵ","ㄴㅎ":"ㄶ","ㄹㄱ":"ㄺ","ㄹㅁ":"ㄻ","ㄹㅂ":"ㄼ","ㄹㅅ":"ㄽ","ㄹㅌ":"ㄾ","ㄹㅍ":"ㄿ","ㄹㅎ":"ㅀ","ㅂㅅ":"ㅄ"};
const isV=c=>JUNG.indexOf(c)>=0;
function compose(str){
  const a=[];for(const c of String(str||"")){const l=a[a.length-1];if(l&&isV(l)&&isV(c)&&VV[l+c])a[a.length-1]=VV[l+c];else a.push(c)}
  let out="",i=0;
  while(i<a.length){
    const c=a[i];
    if(CHO.indexOf(c)>=0&&isV(a[i+1])){
      const L0=CHO.indexOf(c),V0=JUNG.indexOf(a[i+1]);i+=2;let T=0;
      if(a[i]&&!isV(a[i])&&JONG.indexOf(a[i])>0&&!isV(a[i+1])){
        const two=a[i+1]&&CC[a[i]+a[i+1]];
        if(two&&!isV(a[i+2])){T=JONG.indexOf(two);i+=2}else{T=JONG.indexOf(a[i]);i++}
      }
      out+=String.fromCharCode(0xAC00+(L0*21+V0)*28+T);
    }else{out+=c;i++}
  }
  return out;
}
let VOC=null,PV=null;   // VOC — словарь ученика (слова урока, звёздочки); PV — ответы в упражнениях сдвигают повторение слов
let blocks=[];          // все блоки страницы по порядку
/* Урок из двух частей: «Теория» (объяснения, слова, примеры) и «Отработка» (упражнения и задания «поговорить»),
   часть раздела определяет KR.part (js/common.js). Раздел «Домашнее задание» в уроке не показывается: домашку задаёт
   преподаватель. Доп. упражнения (L.back) и домашка (L.hw) показываются одним списком. */
const partOf=s=>window.KR&&KR.part?KR.part(s):"theory";
let SECS=[],SPLIT=false,PART="theory";
const EXT=["fill","choice","build"];   // упражнения с проверкой
function setup(lid,lesson){
  id=lid;L=lesson;KEY="kr_progress:"+user+":"+id;
  P={};try{P=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){}
  LANG=L.lang||"ko";
  VOC=window.KR&&KR.vocab&&!L.back&&!L.hw?KR.vocab:null;
  PV=window.KR&&KR.vocab||null;
  SECS=L.hw?L.sections:L.sections.filter(s=>partOf(s)!=="hw");
  blocks=[];SECS.forEach(s=>{const pt=partOf(s);s.blocks.forEach((b,i)=>{b._key=s.id+"-"+i;b._part=pt;blocks.push(b)})});
  SPLIT=!L.stages&&!L.back&&!L.hw&&blocks.some(b=>b._part==="theory")&&blocks.some(b=>b._part==="practice");
}
// блок закрыт: пройден, а в домашке упражнение с проверкой и тест по словам засчитываются, когда их проверили (баллы видит преподаватель)
const closed=b=>{const p=P[b._key];return !!(p&&(p.done||(L.hw&&(EXT.includes(b.type)||b.type==="wtest")&&p.total!=null)))};
// с какой части открыть урок: ?part=…, раздел из адреса (#grammar) или там, где остались незакрытые блоки
function firstPart(){
  const q=Q.get("part");if(q==="theory"||q==="practice")return q;
  const s=SECS.find(x=>x.id===location.hash.slice(1));if(s)return partOf(s)==="practice"?"practice":"theory";
  const open=pt=>blocks.some(b=>b._part===pt&&!closed(b));
  return open("theory")||!open("practice")?"theory":"practice";
}
function render(){
  document.title=L.hw?"Домашка · "+L.title:L.course+" · "+L.title;
  PART=SPLIT?firstPart():"theory";
  const back=L.hw?"cabinet.html":L.lib?"library.html":L.back||"course.html",backT=L.hw?"кабинет":L.lib?"библиотека":L.back?"доп. упражнения":"курс";
  let h=`<div id="topbar"></div><header class="band slim"><div class="in"><a href="${back}">${ic("back",14)}${backT}</a><small>${esc(L.course)} · ${esc(user)}</small><h1${L.hw?"":' class="ko"'}>${esc(L.title)}</h1><p>${esc(L.subtitle||"")}</p></div></header><main>
  <div class="card glass"><b>${L.hw?"Сделано":"Прогресс урока"}</b> <span id="pct" class="muted"></span><div class="bar"><div id="barfill"></div></div></div>`;
  if(L.hw)h+=hwTop();
  if(SPLIT)h+=`<div class="seg lparts" role="tablist" aria-label="Части урока">${["theory","practice"].map(pt=>`<button type="button" role="tab" id="tab-${pt}" data-part="${pt}" aria-selected="${pt===PART}" aria-controls="part-${pt}">${ic(pt==="theory"?"book":"repeat",16)}${pt==="theory"?"Теория":"Отработка"}<small id="pc-${pt}"></small></button>`).join("")}</div>`;
  if(!L.hw&&!L.back)h+=`<div id="hwhere"></div>`;   // домашка по этому уроку, если её задал преподаватель
  if(!L.hw)h+=`<div class="subnav"><nav class="nav" id="nav" aria-label="Разделы урока"></nav><div class="subnav-bar"><i id="navfill"></i></div></div>`;
  // Ступени внутри раздела (урок с L.stages): у блока поле at — "class" (на занятии) или "home" (на дом), без поля — теория.
  // Перед первой карточкой каждой ступени ставится подзаголовок: 📘 Теория → 👥 На занятии → 🏠 Домашнее задание.
  const STG={theory:["book","Теория",""],class:["users","На занятии","Делаем вместе с преподавателем."],home:["home","Домашнее задание","Сделай дома: ответы проверятся и сохранятся, преподаватель увидит результат."]};
  const stage=(b,i,arr)=>{if(!L.stages||L.hw)return "";const st=STG[b.at]?b.at:"theory",pr=i?(STG[arr[i-1].at]?arr[i-1].at:"theory"):null;
    return st===pr?"":`<div class="stage stage-${st}">${ic(STG[st][0],16)}<b>${STG[st][1]}</b>${STG[st][2]?`<span>${STG[st][2]}</span>`:""}</div>`};
  const sec=s=>`<h2 class="sec" id="${s.id}">${em(s.icon,24)}${esc(s.title)}</h2>`+(s.from?`<p class="muted hw-from">${esc(s.from)}</p>`:"")+s.blocks.map((b,i,arr)=>stage(b,i,arr)+block(b)).join("");
  // появляется, когда закрыты все блоки: завершение главы
  const fin=`<div class="card glass fin" id="fin" hidden><span class="spark">${ic("spark",34)}</span><h3>${L.back?"Отработка пройдена":"Глава пройдена"}</h3><p class="muted">Все блоки закрыты, прогресс сохранён.</p>${L.back?"":`<a class="btn pri" href="course.html">Вернуться на путь${ic("arrow",16)}</a>`}</div>`;
  if(SPLIT){
    ["theory","practice"].forEach(pt=>{
      h+=`<div class="lpart" id="part-${pt}" data-lpart="${pt}" role="tabpanel" aria-labelledby="tab-${pt}"${pt===PART?"":" hidden"}>`+(pt==="practice"?testCard():"")+SECS.filter(s=>partOf(s)===pt).map(sec).join("");
      h+=pt==="theory"?`<div class="card glass to-prac"><h3>${ic("repeat",20)} Теперь отработка</h3><p class="muted">Упражнения с проверкой и задания «поговорить» по этому уроку. Теория останется рядом: вкладка «Теория» наверху.</p><div class="done-row"><span></span><button type="button" class="btn pri big" data-part="practice">Отработать${ic("arrow",18)}</button></div></div>`
        :fin+extra()+`<p class="to-th"><button type="button" class="linkish" data-part="theory">${ic("back",14)} Вернуться к теории</button></p>`;
      h+="</div>";
    });
  }else h+=SECS.map(sec).join("")+(L.hw?hwSend():fin+extra());
  h+="</main>";
  document.body.innerHTML=h;
  if(window.KR){KR.theme(LANG);KR.onLang=()=>{location.href=L.hw?"cabinet.html":"course.html"};KR.topbar(L.hw?"cabinet":L.back?"practice":"course");if(KR.assistant)KR.assistant.sync()}
  drawNav();wire();refresh();vocabInit();
  if(!L.hw&&!L.back)hwHere();
}
// тест по словам урока (test.html): ученик проверяет себя, преподаватель проводит его на уроке
function testCard(){
  if(L.lib)return "";   // test.html пока знает только уроки сайта
  const n=window.KR&&KR.lessonWords?KR.lessonWords(L).length:0;if(n<2)return "";
  const t=window.KR&&KR.ctx&&KR.ctx.teacher,q=encodeURIComponent(id);
  return `<div class="card glass wt-card"><h3>${ic("abc",20)} Тест по словам урока</h3><p class="muted">${n} ${plural(n,"слово","слова","слов")}: перевод, слово по переводу, слово в предложении, написание.${t?" «С учителем» — вопросы по одному на экране, ответы обсуждаете вместе.":""}</p>`+
    `<div class="done-row"><span></span><span class="wt-btns"><a class="btn${t?"":" pri"}" href="test.html?l=${q}&mode=self">Проверить себя${ic("arrow",16)}</a>${t?`<a class="btn pri" href="test.html?l=${q}&mode=class" target="_blank" rel="noopener">${ic("users",16)} С учителем ↗</a>`:""}</span></div></div>`;
}
// разделы в верхней навигации: только текущей части урока
function drawNav(){
  const nav=document.getElementById("nav");if(!nav)return;
  nav.innerHTML=SECS.filter(s=>!SPLIT||partOf(s)===PART).map(s=>`<a href="#${s.id}" data-sec="${s.id}">${em(s.icon,15)}${esc(s.title)}</a>`).join("");
}
function setPart(pt,go){
  if(!SPLIT||(pt!=="theory"&&pt!=="practice"))return;
  PART=pt;
  document.querySelectorAll("[data-lpart]").forEach(d=>{d.hidden=d.dataset.lpart!==pt});
  document.querySelectorAll(".lparts [role=tab]").forEach(b=>b.setAttribute("aria-selected",b.dataset.part===pt));
  drawNav();refresh();
  try{history.replaceState(null,"","?l="+encodeURIComponent(id)+"&part="+pt)}catch(e){}
  if(go){const t=document.querySelector(".lparts");if(t)t.scrollIntoView({block:"start",behavior:window.KR&&KR.calm()?"auto":"smooth"})}
}
/* Слова урока добавляются в словарь один раз. Пример берём из диалогов и примеров этого же урока. */
function lessonWords(){
  const lines=[];
  L.sections.forEach(s=>s.blocks.forEach(b=>{
    if(b.type==="dialogue")b.lines.forEach(l=>lines.push([l[1],l[2]]));
    if(b.type==="examples")b.items.forEach(l=>lines.push([l[0],l[1]]));
  }));
  const strip=t=>t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,""),out=[];
  L.sections.forEach(s=>s.blocks.forEach(b=>{
    if(b.type!=="words")return;
    b.items.forEach(w=>{
      const st=VOC.stem(LANG,w[0]),it={w:w[0],t:w[1]};
      for(const l of lines){
        const tok=l[0].split(/\s+/).map(strip).find(t=>st.length>1?t.toLowerCase().indexOf(st)===0:t===st);
        if(tok){it.ex=l[0];it.et=l[1];it.f=tok;break}
      }
      out.push(it);
    });
  }));
  return out;
}
function stars(){
  if(!VOC)return;
  document.querySelectorAll("[data-wstar]").forEach(b=>{const c=VOC.find(LANG,b.dataset.wstar),on=!!(c&&c.star);b.classList.toggle("on",on);b.setAttribute("aria-pressed",on)});
}
/* Слова урока попадают в словарь по выбору ученика (Слова → Настройки → «Слова из уроков»):
   спросить при первом открытии урока (по умолчанию), добавить сразу или не добавлять. Выбор по уроку запоминается
   и синхронизируется: если ученик уже ответил на другом устройстве, вопрос исчезнет после загрузки словаря. */
const wordsN=n=>n%10===1&&n%100!==11?"слово":n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?"слова":"слов";
const freshWords=()=>lessonWords().filter(it=>!VOC.find(LANG,it.w));
function vocabInit(){
  if(!VOC)return;
  VOC.onchange=()=>{askSync();stars();wordsNote()};KR.onVocab=VOC.onchange;VOC.onchange();
}
/* Показать, обновить или убрать вопрос о словах урока по текущему состоянию словаря. */
function askSync(){
  const q=document.getElementById("wq");
  if(q&&q.dataset.done)return;                                   // ученик ответил: остаётся подтверждение
  const fresh=freshWords(),mode=VOC.settings().lw;
  if(!fresh.length||VOC.lessonState(id)||mode!=="ask"){
    if(q)q.remove();
    if(fresh.length&&!VOC.lessonState(id)&&mode==="auto")VOC.addLesson(id,LANG,lessonWords());
    return;
  }
  askWords(fresh,q);
}
function askWords(fresh,box){
  const n=fresh.length,keep=document.getElementById("wq-keep"),kept=!!(keep&&keep.checked);
  if(!box){
    box=document.createElement("section");box.className="card glass wq";box.id="wq";box.setAttribute("aria-label","Слова урока");
    const anchor=document.querySelector("main>.card.glass");   // карточка прогресса урока
    if(!anchor)return;anchor.insertAdjacentElement("afterend",box);
  }
  box.innerHTML=`<h3>${ic("abc",20)} Слова урока · ${n}</h3><p class="muted">Добавить их в твой словарь? Тогда они придут на страницу «Слова»: сначала в блок новых слов, потом в отработку.</p>`+
    `<div class="wq-prev">${fresh.slice(0,8).map(it=>`<span class="chip"><b${LANG==="ko"?' class="ko"':""} lang="${LANG}">${esc(it.w)}</b>${it.t?"&nbsp;· "+esc(it.t):""}</span>`).join("")}${n>8?`<span class="chip">ещё ${n-8}</span>`:""}</div>`+
    `<label class="wq-keep"><input type="checkbox" id="wq-keep"${kept?" checked":""}> Запомнить выбор для следующих уроков</label>`+
    `<div class="done-row"><button type="button" data-wq="no">Не добавлять</button><button type="button" class="btn pri" data-wq="yes">Добавить ${n} ${wordsN(n)}</button></div>`;
}
function answerWords(yes){
  const keep=document.getElementById("wq-keep"),kept=!!(keep&&keep.checked),box=document.getElementById("wq");
  if(box)box.dataset.done=1;
  if(kept){const s=VOC.settings();s.lw=yes?"auto":"off";VOC.setSettings(s)}
  let n=0;
  if(yes)n=VOC.addLesson(id,LANG,lessonWords(),true);else VOC.skipLesson(id);
  if(box)box.innerHTML=`<p class="msg ok" role="status">`+(yes?`Добавлено в словарь: ${n} ${wordsN(n)}. Они ждут на странице «Слова», в блоке новых слов. <a href="words.html">Открыть «Слова»</a>`
    :`Слова урока не добавлены. Если передумаешь, кнопка есть под списком слов урока.`)+(kept?` Для следующих уроков выбор запомнен, поменять его можно в «Слова» → «Настройки».`:"")+`</p>`;
  stars();wordsNote();
}
/* Подпись под словами урока: все ли они в словаре; если нет — кнопка добавить недостающие. */
function wordsNote(){
  if(!VOC)return;
  const all=lessonWords().length,n=freshWords().length,btn=`<button type="button" class="linkish" data-wadd>`;
  document.querySelectorAll(".vnote").forEach(p=>{
    p.innerHTML=!n?`Слова урока в твоём словаре и придут на повторение. Отметь звёздочкой трудные: они вернутся раньше. <a href="words.html">Открыть словарь</a>`
      :n<all?`В твоём словаре ${all-n} из ${all} слов урока. ${btn}Добавить остальные ${n}</button> или отметь звёздочкой только нужные.`
      :`Этих слов пока нет в твоём словаре. ${btn}Добавить ${n} ${wordsN(n)}</button> или отметь звёздочкой только нужные.`;
  });
}
/* Внизу отработки: «Хочешь ещё?» — доп. упражнения или игры. Домашку здесь не показываем: её задаёт преподаватель. */
function extra(){
  if(L.lib)return "";   // урок из библиотеки: доп. упражнений к нему нет
  if(L.noExtra)return "";   // урок без доп. упражнений (например, видео-урок)
  if(L.back)return `<div class="card glass"><a class="btn pri" href="${L.back}">${ic("back",16)}К списку отработок</a></div>`;
  if(L.games)return `<div class="card"><h3>Хочешь ещё?</h3><p class="muted">Закрепи буквы в играх: бинго, звуковая охота, конструктор слогов, найди ошибку и Reading Challenge по всему алфавиту.</p><a class="btn pri" href="${L.games}">${ic("spark",16)}Игры хангыля</a></div>`;
  const cl=window.COURSE?COURSE.lessons.concat((window.COURSE2||{lessons:[]}).lessons).find(l=>l.id===id):null;const pno=cl?cl.no:"all";
  return `<div class="card"><h3>Хочешь ещё?</h3><p class="muted">Дополнительные упражнения к этому уроку: если что-то не получилось или хочется закрепить.</p><a class="btn pri" href="practice.html?l=${pno}">${ic("repeat",16)}Доп. упражнения</a></div>`;
}
const doneLabel=d=>d?ic("check",16)+" Пройдено":"Отметить пройденным";
function doneRow(b){
  if(b._ro)return "";   // теория внутри домашки: только почитать
  const interactive=["fill","choice","build"].includes(b.type);
  const d=P[b._key]&&P[b._key].done;
  if(interactive)return `<div class="done-row"><span class="score" id="sc-${b._key}"></span><button data-check="${b._key}" class="pri">Проверить</button></div>`;
  return `<div class="done-row"><span class="muted"></span><button data-done="${b._key}">${doneLabel(d)}</button></div>`;
}
function block(b){
  let h=`<div class="card" id="b-${b._key}"><h3>${esc(b.title)}</h3>`;
  if(b.type==="dialogue"){
    h+=b.lines.map(l=>`<div class="line"><span class="sp ko">${l[0]}</span><div><div class="kolg ko">${esc(l[1])} ${sayBtn(l[1])}</div><div class="ru">${esc(l[2])}</div></div></div>`).join("");
    if(b.task)h+=`<p class="muted">${ic("pencil",15)} ${esc(b.task)}</p>`;
  }else if(b.type==="words"){
    h+=`<div class="words">`+b.items.map(w=>`<div class="w"><span><b class="ko">${esc(w[0])}</b> ${sayBtn(w[0])}</span><span class="ru">${esc(w[1])}</span>${VOC?`<button class="icb" data-wstar="${esc(w[0])}" data-wt="${esc(w[1])}" aria-pressed="false" aria-label="Отметить слово: оно вернётся на повторение раньше">${ic("star",17)}</button>`:""}</div>`).join("")+`</div>`;
    if(VOC)h+=`<p class="note vnote"></p>`;   // текст ставит wordsNote(): в словаре слова урока или нет
  }else if(b.type==="text"){h+=b.html}
  else if(b.type==="video"){   // видео: общий плеер сайта (js/player.js), b.v = {file, alt, yt:{id,start,end}, cover, time}
    if(b.task)h+=`<p class="muted">${esc(b.task)}</p>`;
    h+=window.MIRAE_PLAYER?MIRAE_PLAYER.html(b.v||{}):`<p class="muted">Плеер не загрузился — обнови страницу.</p>`;
  }
  else if(b.type==="examples"){
    if(b.note)h+=`<p class="muted">${esc(b.note)}</p>`;
    h+=b.items.map(l=>`<div class="line"><div><div class="kolg ko">${esc(l[0])} ${sayBtn(l[0])}</div><div class="ru">${esc(l[1])}</div></div></div>`).join("");
  }else if(b.type==="table"){
    if(b.note)h+=`<p class="muted">${b.note}</p>`;
    h+=`<div style="overflow-x:auto"><table class="ko"><tr>${b.head.map(x=>`<th>${x}</th>`).join("")}</tr>${b.rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("")}</table></div>`;
  }else if(b.type==="fill"){
    h+=`<p class="muted">${esc(b.instr)}</p>`+b.items.map((it,i)=>{
      const v=(P[b._key]&&P[b._key].v&&P[b._key].v[i])||"";
      const parts=it.q.split("___");
      return `<div class="ex" data-i="${i}"><span class="q ko">${esc(parts[0])}<input class="ans ko" data-b="${b._key}" data-i="${i}" value="${esc(v)}" aria-label="Ответ ${i+1}" autocomplete="off" autocapitalize="off" spellcheck="false">${esc(parts[1]||"")}</span><span class="fb" id="fb-${b._key}-${i}"></span></div>`}).join("")+doneRow(b);
  }else if(b.type==="choice"&&Array.isArray(b.story)){   // текст с выбором прямо в строке: story[i] — текст перед пропуском i, последний — хвост
    h+=`<p class="muted">${esc(b.instr)}</p><div class="reading ko">`+b.items.map((it,i)=>{
      const sel=(P[b._key]&&P[b._key].v&&P[b._key].v[i])||"";
      return esc(b.story[i]||"").replace(/\n/g,"<br>")+`<span class="opts inl" data-b="${b._key}" data-i="${i}"><sup>${i+1})</sup>${it.opts.map(o=>`<button class="${sel===o?"sel":""}" data-o="${esc(o)}">${esc(o)}</button>`).join("")}<span class="fb" id="fb-${b._key}-${i}"></span></span>`}).join("")+esc(b.story[b.items.length]||"").replace(/\n/g,"<br>")+`</div>`+doneRow(b);
  }else if(b.type==="choice"){
    h+=`<p class="muted">${esc(b.instr)}</p>`;
    h+=b.items.map((it,i)=>{
      const sel=(P[b._key]&&P[b._key].v&&P[b._key].v[i])||"";
      return `<div class="ex">${it.say?`<div class="q">${sayBtn(it.say).replace('class="say"','class="say big"')}${it.q?` <span class="ko">${esc(it.q)}</span>`:""}</div>`:`<div class="q ko">${esc(it.q)}</div>`}${it.r?`<div class="ru ko">→ ${esc(it.r)}</div>`:""}<div class="opts" data-b="${b._key}" data-i="${i}">${(it.opts||b.bank).map(o=>`<button class="${sel===o?"sel":""}" data-o="${esc(o)}">${esc(o)}</button>`).join("")}<span class="fb" id="fb-${b._key}-${i}"></span></div></div>`}).join("")+doneRow(b);
  }else if(b.type==="build"){
    h+=`<p class="muted">${esc(b.instr)}</p>`+b.items.map((it,i)=>{
      const v=(P[b._key]&&P[b._key].v&&P[b._key].v[i])||"";
      return `<div class="ex build" data-i="${i}"><div class="q">${it.say?sayBtn(it.say).replace('class="say"','class="say big"')+" ":""}<span class="ko">${esc(it.p||"")}</span></div>
      <div class="bk-row"><output class="built ko" id="bt-${b._key}-${i}" aria-live="polite">${esc(compose(v))}</output><span class="fb" id="fb-${b._key}-${i}"></span></div>
      <div class="kb ko" data-b="${b._key}" data-i="${i}">${b.keys.map(k=>`<button data-k="${esc(k)}">${esc(k)}</button>`).join("")}<button data-k="⌫" class="kb-del" aria-label="Стереть букву">${ic("back",15)}</button></div></div>`}).join("")+doneRow(b);
  }else if(b.type==="talk"){
    h+=`<p class="muted">${esc(b.instr)}</p>`+b.prompts.map(p=>`<div class="line"><div class="kolg ko">${esc(p)} ${sayBtn(p)}</div></div>`).join("");
  }else if(b.type==="wtest"){   // тест по словам внутри домашки: проходится на test.html, результат пишется сюда
    const t=b.wt,K={tr:"перевод",rev:"слово по переводу",ctx:"слово в предложении",wr:"написать слово"};
    h+=`<p class="muted">${(t.w||[]).length} вопросов: ${(t.k||[]).map(k=>K[k]||k).join(", ")}. ${t.min?`Время: ${t.min} мин.`:"Без таймера."} Ответ сразу проверяется и не исправляется.</p>`+
      `<div class="done-row"><span class="score" id="sc-${b._key}"></span><a class="btn pri" href="test.html?hw=${encodeURIComponent(L.hw.id)}&k=${encodeURIComponent(b._key)}">${P[b._key]&&P[b._key].total!=null?"Пройти ещё раз":"Начать тест"}${ic("arrow",16)}</a></div>`;
    return h+"</div>";
  }else if(b.type==="mat"){   // тренажёр или тест из каталога внутри домашки
    const m=b.m,p=Array.isArray(b.p)&&b.p.length?b.p:null;
    // преподаватель выбрал отдельные задания: тренажёр откроется только с ними (?only=…, см. js/bridge.js)
    const href=p&&m.path!=="#"?m.path+(m.path.indexOf("?")<0?"?":"&")+"hw="+encodeURIComponent(L.hw.id)+"&only="+encodeURIComponent(p.join(",")):m.path;
    const names=p&&Array.isArray(b.pn)?b.pn.filter(x=>x&&x.t).map(x=>(x.g?`<b>${esc(x.g)}</b>: `:"")+esc(x.t)):[];   // названия заданий сохранил преподаватель
    h+=`<p class="muted">${esc((window.KINDS||{})[m.kind]||"Материал")}${m.level?" · "+esc(m.level):""}. ${p?`Не весь тренажёр, а только задания, которые выбрал преподаватель (${p.length}). `:""}Открой, пройди и нажми в нём «Отправить учителю»: задание отметится само. Можно отметить и вручную.</p>`+
      (names.length?`<details class="hw-mp"><summary>Какие задания</summary><ul>${names.map(n=>`<li>${n}</li>`).join("")}</ul></details>`:"")+
      `<div class="done-row"><a class="btn" href="${esc(href)}" target="_blank" rel="noopener">${ic("arrow",16)} Открыть</a><button data-done="${b._key}">${doneLabel(P[b._key]&&P[b._key].done)}</button></div>`;
    return h+"</div>";
  }
  if(!["fill","choice","build"].includes(b.type))h+=doneRow(b);
  return h+"</div>";
}
function getItems(b){return b.items}
/* Слова из словаря ученика, которые проверяет задание: явно (it.w — слово или список) или по правильному ответу. */
function itemWords(it){
  if(!PV)return [];
  if(it.w)return [].concat(it.w).map(w=>PV.find(LANG,w)).filter(Boolean).map(c=>c.id);
  const ids=[];
  [].concat(it.a==null?[]:it.a).forEach(a=>PV.wordsIn(LANG,String(a),true).forEach(id=>{if(ids.indexOf(id)<0)ids.push(id)}));
  return ids;
}
/* После проверки упражнения: ошибка возвращает слово на повторение сегодня, верный ответ засчитывает повторение,
   если слово уже пора повторять (правила — SRS.practice). Под результатом показываем, что изменилось. */
function practiceWords(b,key,wrong){
  if(!PV)return;
  const res={};
  b.items.forEach((it,i)=>{const good=wrong.indexOf(i)<0;itemWords(it).forEach(id=>{res[id]=res[id]===false?false:good})});
  const r=PV.practice(res),row=document.querySelector(`[data-check="${key}"]`),old=document.getElementById("pn-"+key);
  if(old)old.remove();
  if(!row||(!r.back.length&&!r.done.length))return;
  const list=a=>a.slice(0,6).map(c=>`<b class="ko" lang="${LANG}">${esc(c.w)}</b>`).join(", ")+(a.length>6?" и ещё "+(a.length-6):"");
  row.closest(".done-row").insertAdjacentHTML("afterend",`<p class="note pnote" id="pn-${key}" role="status">`+
    (r.back.length?`Вернутся на повторение сегодня: ${list(r.back)}. `:"")+(r.done.length?`Засчитано как повторение: ${list(r.done)}. `:"")+
    `<a href="words.html">Открыть «Слова»</a></p>`);
}
function check(key){
  const b=blocks.find(x=>x._key===key);const v=(P[key]=P[key]||{}).v=(P[key].v||{});
  let ok=0;const wr=[];
  b.items.forEach((it,i)=>{
    let good=false;
    if(b.type==="fill"){const inp=document.querySelector(`input[data-b="${key}"][data-i="${i}"]`);v[i]=inp.value;good=it.a.some(a=>norm(a)===norm(inp.value));inp.className="ans ko "+(good?"ok":"bad")}
    else if(b.type==="build"){good=compose(v[i]||"")===it.a;const o=document.getElementById(`bt-${key}-${i}`);if(o)o.className="built ko "+(good?"ok":"bad")}
    else{const g=document.querySelector(`.opts[data-b="${key}"][data-i="${i}"]`);const sel=v[i];good=sel===it.a;g.querySelectorAll("button").forEach(bt=>{bt.classList.remove("ok","bad");if(bt.dataset.o===sel)bt.classList.add(good?"ok":"bad")})}
    const fb=document.getElementById(`fb-${key}-${i}`);
    if(fb){fb.textContent=good?"✓":"✗ "+(Array.isArray(it.a)?it.a[0]:it.a);fb.className="fb "+(good?"ok":"bad")}
    if(good)ok++;else wr.push(i);
  });
  P[key].tries=(P[key].tries||0)+1;
  const ms=P[key].miss=P[key].miss||{};wr.forEach(i=>{ms[i]=(ms[i]||0)+1});
  const hs=P[key].hist=P[key].hist||[];hs.push({t:Date.now(),s:ok,n:b.items.length,w:wr.map(i=>[i,String(v[i]==null?"":v[i])])});if(hs.length>10)hs.splice(0,hs.length-10);
  P[key].t=Date.now();P[key].score=ok;P[key].total=b.items.length;P[key].done=ok===b.items.length;
  save();refresh();practiceWords(b,key,wr);
}
function refresh(){
  if(L.hw)matSync();
  let n=0;const pc={theory:[0,0],practice:[0,0]};
  blocks.forEach(b=>{
    const p=P[b._key],d=closed(b);if(d)n++;
    if(pc[b._part]){pc[b._part][1]++;if(d)pc[b._part][0]++}
    const sc=document.getElementById("sc-"+b._key);
    if(sc&&p&&p.total!=null)sc.textContent=`Результат: ${p.score} из ${p.total}`;
    const bd=document.querySelector(`[data-done="${b._key}"]`);if(bd)bd.innerHTML=doneLabel(!!(p&&p.done));
    const card=document.getElementById("b-"+b._key);if(card)card.classList.toggle("is-done",d);   // золотая отметка на пройденном блоке
  });
  const pct=blocks.length?Math.round(n/blocks.length*100):0,cur=SPLIT?pc[PART]:[n,blocks.length];
  const f=document.getElementById("barfill");if(f)f.style.width=pct+"%";
  const nf=document.getElementById("navfill");if(nf)nf.style.width=(cur[1]?Math.round(cur[0]/cur[1]*100):0)+"%";   // полоска под разделами — по текущей части
  const t=document.getElementById("pct");if(t)t.textContent=L.hw?`${n} из ${blocks.length} ${plural(blocks.length,"задания","заданий","заданий")} · ${pct}%`:`${n} из ${blocks.length} блоков · ${pct}%`;
  Object.keys(pc).forEach(k=>{const e=document.getElementById("pc-"+k);if(e)e.textContent=pc[k][1]?pc[k][0]+"/"+pc[k][1]:""});
  const fin=document.getElementById("fin");if(fin)fin.hidden=pct<100;
  SECS.forEach(s=>{const a=document.querySelector(`[data-sec="${s.id}"]`);if(a)a.classList.toggle("done",s.blocks.every(closed))});
  if(L.hw)hwState(n);
}
function wire(){
  document.body.addEventListener("click",e=>{
    const t=e.target.closest("button");if(!t)return;
    if(t.dataset.say)return say(t.dataset.say);
    if(t.dataset.part)return setPart(t.dataset.part,true);
    if(t.id==="hwsubmit")return hwSubmit(t);
    if(t.dataset.wstar!==undefined&&VOC){const c=VOC.find(LANG,t.dataset.wstar);if(c)VOC.star(c.id);else VOC.add(LANG,t.dataset.wstar,t.dataset.wt,{star:1,src:"lesson:"+id});return VOC.onchange()}
    if(t.dataset.check)return check(t.dataset.check);
    if(t.dataset.wq&&VOC)return answerWords(t.dataset.wq==="yes");
    if(t.dataset.wadd!==undefined&&VOC){const q=document.getElementById("wq");if(q)q.remove();VOC.addLesson(id,LANG,lessonWords(),true);return VOC.onchange()}
    if(t.dataset.k!==undefined){const g=t.parentElement,k=g.dataset.b,i=g.dataset.i;P[k]=P[k]||{};P[k].v=P[k].v||{};let v=P[k].v[i]||"";
      v=t.dataset.k==="⌫"?[...v].slice(0,-1).join(""):v+t.dataset.k;P[k].v[i]=v;P[k].t=Date.now();
      const o=document.getElementById(`bt-${k}-${i}`);if(o){o.textContent=compose(v);o.className="built ko"}
      const f=document.getElementById(`fb-${k}-${i}`);if(f){f.textContent="";f.className="fb"}
      if(t.dataset.k!=="⌫"&&/[가-힣]$/.test(compose(v)))say(compose(v).slice(-1));
      save();return}
    if(t.dataset.done){const k=t.dataset.done;P[k]=P[k]||{};P[k].done=!P[k].done;P[k].t=Date.now();save();return refresh()}
    if(t.dataset.o!==undefined){const g=t.parentElement,k=g.dataset.b;P[k]=P[k]||{};P[k].v=P[k].v||{};P[k].v[g.dataset.i]=t.dataset.o;P[k].t=Date.now();g.querySelectorAll("button").forEach(x=>x.classList.remove("sel","ok","bad"));t.classList.add("sel");save()}
  });
  document.body.addEventListener("input",e=>{const i=e.target;if(i.classList.contains("ans")){const k=i.dataset.b;P[k]=P[k]||{};P[k].v=P[k].v||{};P[k].v[i.dataset.i]=i.value;P[k].t=Date.now();i.className="ans ko";save()}});
  // ссылка на раздел другой части урока (#grammar из домашки или из закладки): открыть нужную часть
  window.addEventListener("hashchange",()=>{const s=SECS.find(x=>x.id===location.hash.slice(1));if(s&&SPLIT&&partOf(s)!==PART){setPart(partOf(s));const e=document.getElementById(s.id);if(e)e.scrollIntoView()}});
  // домашка: тренажёр открывается в новой вкладке; когда ученик вернулся, проверяем, отправил ли он отчёт
  if(L.hw)document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
}
/* ---------- домашка от преподавателя ---------- */
/* Домашку задаёт преподаватель (supabase/homework.sql): упражнения из уроков — ученик делает их заново, ответы
   хранятся отдельно от урока (kr_progress:<ученик>:hw-<номер>); тренажёры и тесты из каталога; разделы теории —
   подсказка «Посмотреть теорию». «Сдать преподавателю» отправляет баллы и ошибки, и домашка уходит из кабинета. */
const plural=(n,f1,f2,f5)=>n%10===1&&n%100!==11?f1:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?f2:f5;
const fmtDue=d=>new Date(d+"T00:00").toLocaleDateString("ru-RU",{day:"numeric",month:"long"});
function hwLesson(rec){
  const LS=window.LESSONS||{},MAT=window.MATERIALS||[],sections=[];let lang="",n=0;
  (rec.items||[]).forEach((it,idx)=>{
    if(it.wt){const t=it.wt;lang=lang||t.lang||"";
      sections.push({id:"wt-"+idx,title:++n+". Тест по словам",icon:"🔤",blocks:[{type:"wtest",title:t.title||"Тест по словам",wt:t,idx}]});return}
    if(it.m){const m=MAT.find(x=>x.id===it.m)||{id:it.m,title:it.m,kind:"",path:"#"};
      sections.push({id:"m--"+String(it.m).replace(/[^a-z0-9_-]/gi,"_"),title:++n+". "+((window.KINDS||{})[m.kind]||"Материал"),icon:"📌",blocks:[{type:"mat",title:m.title,m,p:Array.isArray(it.p)?it.p.filter(k=>typeof k==="string"&&k).slice(0,200):null,pn:it.pn}]});return}
    const src=LS[it.l];if(!src)return;lang=lang||src.lang||"ko";
    src.sections.forEach(s=>s.blocks.forEach((b,i)=>{const k=s.id+"-"+i;if((it.b||[]).indexOf(k)<0)return;
      sections.push({id:it.l+"--"+k,title:++n+". "+(b.title||s.title),icon:s.icon,from:src.course+" · "+src.title,blocks:[hwPick(Object.assign({},b,{src:it.l,srcKey:k}),it.i&&it.i[k])]})}));
  });
  const theory=[];(rec.theory||[]).forEach(t=>{const src=LS[t.l],s=src&&src.sections.find(x=>x.id===t.s);if(s)theory.push({l:t.l,src,s})});
  return {id:"hw-"+rec.id,lang:lang||rec.lang||"ko",course:"Домашка",title:rec.title,subtitle:rec.due?"Сдать до "+fmtDue(rec.due):"Срок не задан",sections,hw:rec,theory};
}
/* Преподаватель может задать не всё упражнение, а отдельные задания (it.i: {"<раздел>-<номер>": [номера]}):
   в домашке остаются только они, по порядку. Номера из урока — в b.subIdx (уходят в результат). */
function hwPick(b,idx){
  const key=Array.isArray(b.items)&&["fill","choice","build"].includes(b.type)?"items":b.type==="talk"&&Array.isArray(b.prompts)?"prompts":"";
  if(!key||!Array.isArray(idx))return b;
  const ok=[...new Set(idx)].filter(x=>Number.isInteger(x)&&x>=0&&x<b[key].length).sort((a,c)=>a-c);
  if(!ok.length||ok.length===b[key].length)return b;
  return Object.assign(b,{[key]:ok.map(x=>b[key][x]),subIdx:ok,subOf:b[key].length});
}
function hwTop(){
  const r=L.hw;let h="";
  if(r.note)h+=`<div class="card glass hw-note"><h3>${ic("chat",18)} От преподавателя</h3><p>${esc(r.note)}</p></div>`;
  if(L.theory.length)h+=`<div class="card glass hw-theory"><h3>${ic("book",18)} Подсказка</h3><p class="muted">Не помнишь, как это использовать? Загляни в теорию.</p>`+
    L.theory.map((t,i)=>`<details class="hw-th"${i===0&&Q.get("th")?" open":""}><summary>${ic("book",16)} Посмотреть теорию · ${esc(t.s.title)}</summary><div class="hw-th-in">`+
      t.s.blocks.map((b,j)=>block(Object.assign({},b,{_key:"th"+i+"-"+j,_ro:true}))).join("")+
      (window.KR&&KR.can("lesson-"+t.l)?`<p class="muted">${esc(t.src.course)} · <a href="lesson.html?l=${encodeURIComponent(t.l)}&part=theory#${encodeURIComponent(t.s.id)}">открыть урок «${esc(t.src.title)}»</a></p>`:"")+
      `</div></details>`).join("")+`</div>`;
  return h;
}
function hwSend(){
  return `<div class="card glass hw-send" id="hwsend"><h3>${ic("send",20)} Сдать домашку</h3><p class="muted" id="hwleft"></p>`+
    `<div class="done-row"><span></span><button type="button" class="btn pri big" id="hwsubmit" disabled>Сдать преподавателю${ic("arrow",18)}</button></div><p class="msg" id="hwmsg" role="status"></p></div>`;
}
// тренажёр из домашки засчитывается, когда ученик отправил из него отчёт после того, как домашку задали
function matSync(){
  blocks.forEach(b=>{if(b.type!=="mat"||!window.KR)return;const r=KR.matInfo(b.m.id).rep,p=P[b._key];
    if(r&&r.t>=L.hw.created&&!(p&&p.done)){P[b._key]={done:true,t:r.t,rep:r.t};save()}});
}
function hwState(n){
  const btn=document.getElementById("hwsubmit"),t=document.getElementById("hwleft");if(!btn||!t)return;
  const left=blocks.length-n,errs=blocks.filter(b=>EXT.includes(b.type)&&P[b._key]&&P[b._key].total!=null&&!P[b._key].done).length;
  btn.disabled=left>0;
  t.textContent=left?`Осталось: ${left} ${plural(left,"задание","задания","заданий")}. Когда всё будет сделано, кнопка станет активной.`
    :errs?`Всё сделано. В ${errs} ${plural(errs,"упражнении","упражнениях","упражнениях")} есть ошибки: их можно исправить и проверить ещё раз или сдать как есть.`
    :"Всё сделано. Нажми «Сдать преподавателю»: ответы уйдут преподавателю, а домашка исчезнет из кабинета.";
}
// что уходит преподавателю: по каждому заданию баллы, число проверок и ошибки последней проверки
function hwResult(){
  let score=0,max=0,done=0;
  const items=blocks.map(b=>{
    const p=P[b._key]||{},x={k:b._key,t:String(b.title||"").slice(0,200),type:b.type,done:closed(b)};
    if(x.done)done++;
    if(b.src){x.l=b.src;x.b=b.srcKey;if(b.subIdx){x.i=b.subIdx;x.of=b.subOf}}
    if(b.type==="mat"){x.m=b.m.id;if(b.p&&b.p.length)x.p=b.p.length;const r=window.KR&&KR.matInfo(b.m.id).rep;if(r&&r.t>=L.hw.created)x.rep=String(r.x||"").slice(0,8000)}
    if(b.type==="wtest"){x.score=p.score||0;x.total=p.total||(b.wt.w||[]).length;x.tries=p.tries||0;x.wrong=p.wrong||[];if(p.sec)x.sec=p.sec;score+=x.score;max+=x.total}
    if(EXT.includes(b.type)){
      x.score=p.score||0;x.total=b.items.length;x.tries=p.tries||0;score+=x.score;max+=x.total;
      const last=p.hist&&p.hist[p.hist.length-1];
      x.wrong=(last?last.w:[]).slice(0,30).map(w=>{const it=b.items[w[0]]||{};return {q:String(it.q||it.p||it.say||"").slice(0,200),g:String(w[1]==null?"":w[1]).slice(0,100),a:String(Array.isArray(it.a)?it.a[0]:it.a).slice(0,100)}});
    }
    return x;
  });
  return {v:1,t:Date.now(),done,total:blocks.length,score,max,items};
}
async function hwSubmit(btn){
  const m=document.getElementById("hwmsg");btn.disabled=true;
  const res=hwResult();
  try{
    await KR.api("hw_submit",{p_id:L.hw.id,p_result:res});
    document.querySelector("main").innerHTML=`<div class="card glass fin hw-done"><span class="spark">${ic("spark",34)}</span><h3>Домашка сдана</h3><p class="muted">${res.max?`Результат: ${res.score} из ${res.max}. `:""}Преподаватель увидит ответы и ошибки. В кабинете этой домашки больше нет.</p><a class="btn pri" href="cabinet.html">В кабинет${ic("arrow",16)}</a></div>`;
    window.scrollTo(0,0);
  }catch(e){
    btn.disabled=false;
    if(m){m.textContent=/no_homework/.test(e&&e.message||"")?"Эту домашку уже сдали или преподаватель её убрал. Обнови кабинет.":"Не получилось отправить. Проверь интернет и нажми ещё раз: ответы сохранены на этом устройстве.";m.className="msg bad"}
  }
}
// домашки нет среди заданных: сдана, убрана или сервер ещё не готов
function hwGone(rec,list){
  const card=list===null?`<h3>Домашка пока недоступна</h3><p class="muted">На сервере ещё не установлена часть сайта для домашки. Преподаватель знает, что сделать.</p>`
    :!rec?`<h3>Домашка не найдена</h3><p class="muted">Возможно, преподаватель её убрал или поменял. Вся заданная домашка — в кабинете.</p>`
    :`<h3>Домашка сдана</h3><p class="muted">«${esc(rec.title)}»${rec.submitted?" · "+new Date(rec.submitted).toLocaleDateString("ru-RU",{day:"numeric",month:"long"}):""}${rec.result&&rec.result.max?` · результат: ${rec.result.score} из ${rec.result.max}`:""}.</p>`+
      (rec.status==="checked"&&rec.comment?`<p><b>Преподаватель:</b> ${esc(rec.comment)}</p>`:rec.status==="checked"?`<p class="muted">Преподаватель проверил.</p>`:`<p class="muted">Преподаватель ещё не проверил.</p>`);
  document.body.innerHTML=`<div id="topbar"></div><main style="padding-top:30px"><div class="card glass">${card}<a class="btn pri" href="cabinet.html">В кабинет${ic("arrow",16)}</a></div></main>`;
  if(window.KR){KR.topbar("cabinet");if(KR.assistant)KR.assistant.sync()}
}
// в уроке: домашка по нему, если её задал преподаватель
async function hwHere(){
  if(!window.KR||!KR.homework)return;
  const list=await KR.homework();if(!list)return;
  const mine=list.filter(r=>r.status==="active"&&(r.items||[]).some(it=>it.l===id)),box=document.getElementById("hwhere");
  if(!box||!mine.length)return;
  box.innerHTML=mine.map(r=>`<a class="card glass hw-here" href="lesson.html?hw=${encodeURIComponent(r.id)}"><span class="tag">${ic("home",14)} Домашка по этому уроку</span><b>${esc(r.title)}</b><span class="muted">${r.due?"сдать до "+fmtDue(r.due):"срок не задан"}</span><span class="tile-go">${ic("arrow",18)}</span></a>`).join("");
}
async function boot(){
  if(HWID){
    if(!window.KR)return hwGone(null,null);
    await KR.load();
    const list=await KR.homework(),rec=list&&list.find(x=>String(x.id)===String(HWID));
    if(!rec||rec.status!=="active")return hwGone(rec,list);
    // уроки из библиотеки (lib-<номер>) приходят с сервера: js/library.js
    if(KR.lib)await KR.lib.ensure((rec.items||[]).map(i=>i.l).concat((rec.theory||[]).map(t=>t.l)));
    const hl=hwLesson(rec);setup(hl.id,hl);render();return;
  }
  if(window.KR){
    const ctx=await KR.load();
    if(!L&&KR.lib){await KR.lib.ensure([id]);L=(window.LESSONS||{})[id]}   // урок из библиотеки: lesson.html?l=lib-<номер>
    if(!L){document.body.innerHTML="<p style='padding:20px'>Урок не найден.</p>";return}
    const mid=(L.back?"practice-":"lesson-")+id;
    if(!L.lib&&!KR.can(mid)){
      document.body.innerHTML='<div id="topbar"></div><main style="padding-top:30px"><div class="card glass"><h3>Этот материал не назначен</h3><p class="muted">'+(ctx.ok?'Попроси преподавателя открыть доступ к этому уроку.':'Нет связи с сервером, задания не загружены.')+'</p><a class="btn pri" href="cabinet.html">В личный кабинет</a></div></main>';
      KR.topbar("course");if(KR.assistant)KR.assistant.sync();return;
    }
  }
  setup(id,L);render();
  const s=location.hash&&document.getElementById(location.hash.slice(1));if(s)s.scrollIntoView();   // ссылка на раздел: #grammar
}
boot();
})();
