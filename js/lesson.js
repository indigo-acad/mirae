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
const EXT=["fill","choice","build","match","order","sort"];   // упражнения с проверкой (кнопка «Проверить»)
const OWN=EXT.concat(["write","speak"]);   // блоки со своей строкой внизу (без «Отметить пройденным»)
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
  if(L.hw)h+=hwTop()+`<div id="hwwords"></div>`;   // слова уроков из домашки: кнопка «Добавить в словарь»
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
  drawNav();wire();refresh();vocabInit();if(L.hw)hwWords();
  if(!L.hw&&!L.back)hwHere();
}
// тест по словам урока (test.html): ученик проверяет себя, преподаватель проводит его на уроке
function testCard(){
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
  const all=lessonWords().length,n=freshWords().length,btn=`<button type="button" class="btn vadd" data-wadd>${ic("plus",15)}`;
  document.querySelectorAll(".vnote").forEach(p=>{
    p.innerHTML=!n?`Слова урока в твоём словаре и придут на повторение. Отметь звёздочкой трудные: они вернутся раньше. <a href="words.html">Открыть словарь</a>`
      :n<all?`В твоём словаре ${all-n} из ${all} слов урока. ${btn}Добавить в словарь ещё ${n}</button>`
      :`Слов урока пока нет в твоём словаре. ${btn}Добавить в словарь · ${n} ${wordsN(n)}</button>`;
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
  const interactive=EXT.includes(b.type);
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
    if(VOC&&!b._ro&&lessonWords().length)h+=`<p class="note vnote"></p>`;   // слова урока к видео: «Добавить в словарь»
  }
  else if(b.type==="examples"){
    if(b.note)h+=`<p class="muted">${esc(b.note)}</p>`;
    h+=b.items.map(l=>`<div class="line"><div><div class="kolg ko">${esc(l[0])} ${sayBtn(l[0])}</div><div class="ru">${esc(l[1])}</div></div></div>`).join("");
  }else if(b.type==="table"){
    if(b.note)h+=`<p class="muted">${b.note}</p>`;
    h+=`<div style="overflow-x:auto"><table class="ko"><tr>${b.head.map(x=>`<th>${x}</th>`).join("")}</tr>${b.rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("")}</table></div>`;
  }else if(b.type==="fill"&&Array.isArray(b.story)){   // скрипт с пропусками: story[i] — текст перед пропуском i, последний — хвост; ответ вписывается
    h+=`<p class="muted">${esc(b.instr)}</p><div class="reading ko">`+b.items.map((it,i)=>{
      const v=(P[b._key]&&P[b._key].v&&P[b._key].v[i])||"";
      return esc(b.story[i]||"").replace(/\n/g,"<br>")+`<span class="gap"><sup>${i+1}</sup><input class="ans ko" data-b="${b._key}" data-i="${i}" value="${esc(v)}" size="${Math.max(4,(it.n||String(it.a[0]).length)+1)}" aria-label="Пропуск ${i+1}" autocomplete="off" autocapitalize="off" spellcheck="false"><span class="fb" id="fb-${b._key}-${i}"></span></span>`}).join("")+esc(b.story[b.items.length]||"").replace(/\n/g,"<br>")+`</div>`+doneRow(b);
  }else if(b.type==="fill"){
    h+=`<p class="muted">${esc(b.instr)}</p>`+b.items.map((it,i)=>{
      const v=(P[b._key]&&P[b._key].v&&P[b._key].v[i])||"";
      const parts=it.q.split("___");
      const br=t=>esc(t).replace(/\n/g,"<br>");
      return `<div class="ex${it.q.indexOf("\n")>=0?" dlg":""}" data-i="${i}"><span class="q ko">${br(parts[0])}<input class="ans ko" data-b="${b._key}" data-i="${i}" value="${esc(v)}" aria-label="Ответ ${i+1}" autocomplete="off" autocapitalize="off" spellcheck="false">${br(parts[1]||"")}</span><span class="fb" id="fb-${b._key}-${i}"></span></div>`}).join("")+doneRow(b);
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
  }else if(b.type==="match"){   // сопоставление: слово ↔ определение (оба по-корейски). items: [{l,r}], в P.v[i] — номер выбранной правой карточки
    const v=(P[b._key]&&P[b._key].v)||{},R=b.items.map((x,j)=>j).sort((x,y)=>((x*7+3)%b.items.length)-((y*7+3)%b.items.length));
    h+=`<p class="muted">${esc(b.instr||"Нажми слово слева, потом подходящее объяснение справа.")}</p><div class="mt" data-mt="${b._key}"><div class="mt-col">`+
      b.items.map((it,i)=>`<button type="button" class="mt-l" data-ml="${i}"><b class="ko">${esc(it.l)}</b><span class="mt-to ko" id="mt-${b._key}-${i}">${v[i]!=null&&b.items[v[i]]?"→ "+esc(b.items[v[i]].r):""}</span><span class="fb" id="fb-${b._key}-${i}"></span></button>`).join("")+
      `</div><div class="mt-col">`+R.map(j=>`<button type="button" class="mt-r ko" data-mr="${j}">${esc(b.items[j].r)}</button>`).join("")+`</div></div>`+doneRow(b);
  }else if(b.type==="order"){   // собрать предложение из частей: items: [{p (подсказка), w: [части], a: ответ}]
    h+=`<p class="muted">${esc(b.instr||"Нажимай части по порядку. ⌫ — убрать последнюю.")}</p>`+b.items.map((it,i)=>{
      const v=(P[b._key]&&P[b._key].v&&P[b._key].v[i])||"",ch=it.w.map((w,j)=>j).sort((x,y)=>((x*5+i+1)%it.w.length)-((y*5+i+1)%it.w.length));
      return `<div class="ex od" data-i="${i}">${it.p?`<div class="q">${esc(it.p)}</div>`:""}<div class="bk-row"><output class="built ko" id="od-${b._key}-${i}">${esc(v.split("|").filter(Boolean).join(" "))}</output><span class="fb" id="fb-${b._key}-${i}"></span></div>
        <div class="kb od-kb ko" data-ob="${b._key}" data-i="${i}">${ch.map(j=>`<button type="button" data-ow="${esc(it.w[j])}">${esc(it.w[j])}</button>`).join("")}<button type="button" data-ow="⌫" class="kb-del" aria-label="Убрать последнюю часть">${ic("back",15)}</button></div></div>`}).join("")+doneRow(b);
  }else if(b.type==="write"){   // письменный ответ: prompts — вопросы, hints — подсказки, model — образцы (после сохранения), voice — можно сказать голосом
    const p=P[b._key]||{},v=p.v||{},sv=!!p.done,vo=!!b.voice&&voiceOk();
    h+=`<p class="muted">${esc(b.instr||"Напиши ответы полными предложениями.")}</p>`+(b.voice&&!vo?`<p class="note">Запись голоса работает в Chrome, Edge и Safari с микрофоном. Здесь можно ответить письменно.</p>`:"")+
      b.prompts.map((q,i)=>`<div class="ex wr"><label class="q ko" for="wr-${b._key}-${i}">${esc(q)}</label>`+
        (b.hints&&b.hints[i]?`<details class="wr-hint"><summary>${ic("spark",14)} Подсказка</summary><div>${esc(b.hints[i]).replace(/\n/g,"<br>")}</div></details>`:"")+
        `<textarea class="wr-in ko" id="wr-${b._key}-${i}" data-wb="${b._key}" data-i="${i}" rows="${b.rows||2}" placeholder="${esc(b.ph||(vo?"Скажи в микрофон или напиши…":"한국어로 쓰세요…"))}" spellcheck="false">${esc(v[i]||"")}</textarea>`+
        (vo?`<div class="vrow"><button type="button" class="btn vbtn" data-vrec="${b._key}" data-i="${i}">${ic("mic",16)} Сказать</button><span class="vtm muted" id="vt-${b._key}-${i}"></span></div><div class="vres" id="vr-${b._key}-${i}" aria-live="polite">${voiceRes(b._key,i)}</div>`:"")+
        (b.model&&b.model[i]?`<details class="wr-model"${sv?"":" hidden"}><summary>Образец ответа</summary><p class="ko">${esc(b.model[i])}</p></details>`:"")+`</div>`).join("")+
      `<div class="done-row"><span class="muted" id="sc-${b._key}"></span><button type="button" class="pri" data-wsave="${b._key}">${sv?"Сохранено ✓":vo?"Сохранить и отправить":"Сохранить ответы"}</button></div>`;
  }else if(b.type==="speak"){   // чтение вслух с проверкой произношения (js/ear.js): lines [[кто, текст, перевод?]], roles — выбор роли
    const p=P[b._key]||{},v=p.v||{},role=p.role||"",can=window.KR&&KR.ear&&KR.ear.canHear();
    h+=`<p class="muted">${esc(b.instr||"Послушай реплику, нажми микрофон и прочитай её вслух.")}</p>`+
      (b.roles?`<div class="seg sp-roles" role="group" aria-label="Роль">${b.roles.map(r=>`<button type="button" data-spr="${b._key}" data-r="${esc(r)}" aria-pressed="${role===r}" class="${role===r?"on":""}">Я — ${esc(r)}</button>`).join("")}<button type="button" data-spr="${b._key}" data-r="" aria-pressed="${!role}" class="${role?"":"on"}">Все реплики</button></div>`:"")+
      (can?"":`<p class="note">Проверка произношения работает в Chrome, Edge и Safari с микрофоном. Здесь можно послушать и прочитать вслух самостоятельно.</p>`)+
      b.lines.map((l,i)=>{const mine=!role||l[0]===role,r=v[i];
        return `<div class="line sp${mine?"":" sp-other"}"><span class="sp ko">${esc(l[0])}</span><div><div class="kolg ko">${esc(l[1])} ${sayBtn(l[1])}${mine&&can?`<button type="button" class="say mic" data-spm="${b._key}" data-i="${i}" title="Прочитать вслух" aria-label="Прочитать вслух">${ic("mic",16)}</button>`:""}</div>${l[2]?`<div class="ru">${esc(l[2])}</div>`:""}<div class="micfb ${r?r.c:""}" id="sp-${b._key}-${i}" aria-live="polite">${r?esc(r.m):""}</div></div></div>`}).join("")+
      `<div class="done-row"><span class="score" id="sc-${b._key}"></span>${b.rec&&can?`<button type="button" data-vsend="${b._key}">${ic("send",15)} Отправить записи</button>`:""}<button data-done="${b._key}">${doneLabel(!!p.done)}</button></div>`;
  }else if(b.type==="sort"){   // порядок событий перетаскиванием: items [{q}] в правильном порядке, в P.v — текущий порядок (номера items)
    const ord=sortOrder(b);
    h+=`<p class="muted">${esc(b.instr||"Перетаскивай карточки, пока история не сложится: сверху — то, что было раньше.")}</p><ol class="srt" data-srt="${b._key}">`+
      ord.map((j,pos)=>`<li class="srt-it" data-j="${j}"><span class="srt-h" aria-hidden="true">⠿</span><span class="srt-n">${pos+1}</span><span class="ko srt-q">${esc(b.items[j].q)}</span><span class="srt-mv"><button type="button" class="icb" data-smv="-1" aria-label="Выше">↑</button><button type="button" class="icb" data-smv="1" aria-label="Ниже">↓</button></span></li>`).join("")+`</ol>`+doneRow(b);
  }else if(b.type==="talk"){
    h+=`<p class="muted">${esc(b.instr)}</p>`+b.prompts.map(p=>`<div class="line"><div class="kolg ko">${esc(p)} ${sayBtn(p)}</div></div>`).join("");
  }else if(b.type==="wtest"){   // тест по словам внутри домашки: проходится на test.html, результат пишется сюда
    const t=b.wt,K={tr:"перевод",rev:"слово по переводу",tf:"верно или неверно",ctc:"слово в предложение (выбор)",ctx:"слово в предложении",wr:"написать слово",fl:"по первой букве",bld:"собрать слово",mch:"найти пары",aud:"на слух",dic:"диктант",say:"сказать вслух"};
    h+=`<p class="muted">${(t.w||[]).length} ${plural((t.w||[]).length,"вопрос","вопроса","вопросов")}: ${(t.k||[]).map(k=>K[k]||k).join(", ")}.${(t.k||[]).some(k=>k==="aud"||k==="dic"||k==="say")?" Включи звук"+((t.k||[]).indexOf("say")>=0?" и разреши микрофон":"")+".":""} ${t.min?`Время: ${t.min} мин.`:"Без таймера."} Ответ сразу проверяется и не исправляется.</p>`+
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
  if(!OWN.includes(b.type))h+=doneRow(b);
  return h+"</div>";
}
/* ---------- голос: запись + распознавание (блоки write с voice, speak с rec) ----------
   Запись (MediaRecorder) и распознавание (SpeechRecognition) идут одновременно: ученик видит, что услышал браузер,
   а преподавателю в Telegram уходит запись с тем, что ученик написал («хотел сказать») и что распознано («сказал»).
   Записи живут, пока открыта страница (VREC); распознанный текст сохраняется в прогрессе (P[блок].s). */
const SRc=window.SpeechRecognition||window.webkitSpeechRecognition||null;
const canRec=()=>!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder);
const voiceOk=()=>canRec()||!!SRc;
const VREC={};let VCUR=null;
const fmtS=x=>Math.floor(x/60)+":"+String(Math.floor(x%60)).padStart(2,"0");
async function voiceStart(opt){
  let stream=null,mr=null,mime="";const parts=[];
  if(canRec()){try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){if(!SRc)throw {error:"not-allowed"}}}
  if(stream){mime=["audio/ogg;codecs=opus","audio/webm;codecs=opus","audio/mp4","audio/webm"].find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t))||"";
    try{mr=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);mr.ondataavailable=e=>{if(e.data&&e.data.size)parts.push(e.data)};mr.start(1000)}catch(e){mr=null}}
  let fin="",on=true,r=null,err=null,stopped=false,fails=0,resolve;const alts=[],t0=Date.now(),done=new Promise(x=>resolve=x);
  function mk(){
    if(!SRc)return;r=new SRc();r.lang=opt.lang==="ko"?"ko-KR":"en-GB";r.continuous=!opt.auto;r.interimResults=true;r.maxAlternatives=opt.auto?5:1;
    r.onresult=e=>{let tmp="";for(let i=e.resultIndex;i<e.results.length;i++){const x=e.results[i];if(x.isFinal){fin+=x[0].transcript.trim()+" ";if(opt.auto)for(let j=0;j<x.length;j++)alts.push(x[j].transcript)}else tmp+=x[0].transcript}
      if(opt.onText)opt.onText((fin+tmp).trim())};
    r.onerror=e=>{err=e.error||"error";if(err!=="no-speech"&&err!=="aborted")fails++;if(fails>2||/not-allowed|service-not-allowed|audio-capture|language-not-supported/.test(err))r=null};
    r.onend=()=>{if(!on)return;if(opt.auto)return stop();if(!r)return mr?null:stop();try{mk()}catch(e){r=null;if(!mr)stop()}};
    try{r.start()}catch(e){err="start";r=null}
  }
  mk();
  if(!mr&&!r){if(stream)stream.getTracks().forEach(t=>t.stop());throw {error:err||"unsupported"}}
  const tick=setInterval(()=>{const x=(Date.now()-t0)/1000;if(opt.onTick)opt.onTick(x);if(x>=(opt.max||90))stop()},250);
  function stop(){
    if(stopped)return;stopped=true;on=false;clearInterval(tick);try{r&&r.stop()}catch(e){}
    const end=()=>{if(stream)stream.getTracks().forEach(t=>t.stop());const type=(mr&&mr.mimeType)||mime||"audio/webm";
      resolve({blob:parts.length?new Blob(parts,{type}):null,mime:type,dur:(Date.now()-t0)/1000,text:fin.trim(),alts,err})};
    setTimeout(()=>{if(mr&&mr.state!=="inactive"){mr.onstop=end;try{mr.stop()}catch(e){end()}}else end()},SRc?900:50);   // ждём последние слова распознавания
  }
  return {stop,done};
}
function voiceRes(k,i){
  const S=(P[k]&&P[k].s||{})[i],R=VREC[k+":"+i];if(!S)return "";
  return (S.s?`<div class="vheard"><span class="muted">Распознано:</span> <span class="ko">«${esc(S.s)}»</span></div>`:`<div class="vheard muted">${esc(S.e||"Распознать речь не получилось, но запись есть.")}</div>`)+
    (S.m!=null?`<div class="vmatch ${S.m>=85?"ok":S.m>=65?"":"bad"}">Совпадает с написанным на ${S.m}%${S.m>=85?" — отлично":S.m>=65?" — почти, проверь слова":" — сравни, что написано и что услышали"}</div>`:"")+
    (R?`<audio controls src="${R.url}" class="vaud"></audio>`:"")+
    `<div class="muted vsent">${S.sent?ic("check",14)+" отправлено преподавателю":R?"Запись уйдёт преподавателю, когда нажмёшь «Сохранить и отправить».":"Запись не сохранилась (страницу обновили). Запиши ещё раз, чтобы преподаватель её услышал."}</div>`;
}
function voiceMatch(k,i){
  const S=(P[k]&&P[k].s||{})[i],w=String((P[k]&&P[k].v||{})[i]||"").trim();if(!S)return;
  S.m=S.s&&w.length>=2&&window.KR&&KR.ear?Math.round(KR.ear.sim(w,S.s,LANG)*100):null;
}
async function voiceToggle(t){
  const k=t.dataset.vrec,i=+t.dataset.i,id=k+":"+i;
  if(VCUR){const same=VCUR.id===id;VCUR.stop();if(same)return;return}
  if(window.KR&&KR.hush)KR.hush();
  const tm=document.getElementById(`vt-${k}-${i}`),box=document.getElementById(`vr-${k}-${i}`);
  let c;
  try{c=await voiceStart({lang:LANG,max:(blocks.find(x=>x._key===k)||{}).max||90,
    onTick:x=>{if(tm)tm.textContent="● "+fmtS(x)},onText:x=>{if(box)box.innerHTML=`<div class="vheard"><span class="muted">Слышу:</span> <span class="ko">${esc(x)}</span></div>`}})}
  catch(e){if(tm)tm.textContent=window.KR&&KR.ear?KR.ear.errText(e):"Нет доступа к микрофону.";return}
  VCUR={id,stop:c.stop};t.classList.add("on");t.innerHTML=ic("mic",16)+" Стоп";if(box)box.innerHTML=`<div class="vheard muted">Говори… Нажми «Стоп», когда закончишь.</div>`;
  const r=await c.done;VCUR=null;t.classList.remove("on");t.innerHTML=ic("mic",16)+" Перезаписать";if(tm)tm.textContent=r.dur?"✓ "+fmtS(r.dur):"";
  const old=VREC[id];if(old)try{URL.revokeObjectURL(old.url)}catch(e){}
  if(r.blob)VREC[id]={blob:r.blob,mime:r.mime,dur:r.dur,url:URL.createObjectURL(r.blob)};else delete VREC[id];
  const p=P[k]=P[k]||{};p.s=p.s||{};
  p.s[i]={s:r.text,d:Math.round(r.dur),t:Date.now(),sent:false,e:r.text?"":r.err&&r.err!=="no-speech"?"Распознать речь здесь не получилось (нужны интернет и Chrome, Edge или Safari). Запись есть — преподаватель её послушает.":"Ничего не распознали. Говори чуть громче или ближе к микрофону."};
  if(!r.blob&&!r.text){delete p.s[i]}
  voiceMatch(k,i);p.t=Date.now();
  if(p.done){p.done=false;const sb=document.querySelector(`[data-wsave="${k}"]`);if(sb)sb.textContent="Сохранить и отправить"}
  if(box)box.innerHTML=voiceRes(k,i);save();refresh();
}
/* отправка в Telegram преподавателю (CONFIG.TG_TOKEN, CONFIG.TG_CHAT_ID — тот же бот, что у материалов сайта) */
async function tg(method,body){
  const c=window.CONFIG||{};if(!c.TG_TOKEN||!c.TG_CHAT_ID)throw new Error("не настроена отправка");
  const r=await fetch("https://api.telegram.org/bot"+c.TG_TOKEN+"/"+method,{method:"POST",body});const j=await r.json().catch(()=>({}));
  if(!j.ok)throw new Error(j.description||"ошибка "+r.status);
}
async function tgVoice(id,cap,name){
  const c=window.CONFIG||{},R=VREC[id];cap=cap.slice(0,1000);
  if(!R)return tg("sendMessage",new URLSearchParams({chat_id:c.TG_CHAT_ID,text:cap}));
  const fd=new FormData();fd.append("chat_id",c.TG_CHAT_ID);fd.append("caption",cap);
  if(/ogg/.test(R.mime)){fd.append("voice",R.blob,"answer.ogg");return tg("sendVoice",fd)}
  fd.append("document",R.blob,name+"."+(/mp4|aac|m4a/.test(R.mime)?"m4a":"webm"));return tg("sendDocument",fd);
}
const capHead=b=>`🎙 ${user} · ${(b.src&&(window.LESSONS||{})[b.src]||L).title}${L.hw?" · домашка":""}\n«${b.title}»`;
// неотправленные ответы блока write: запись или распознанный текст
async function voiceSendWrite(b){
  const k=b._key,p=P[k]||{},S=p.s||{},v=p.v||{};
  for(let i=0;i<b.prompts.length;i++){const x=S[i];if(!x||x.sent)continue;
    const w=String(v[i]||"").trim();
    await tgVoice(k+":"+i,[capHead(b),"❓ "+b.prompts[i],w?"✍️ Хотел(а) сказать: "+w:"","👂 Распознано: "+(x.s||"—"),x.m!=null?"Совпадение: "+x.m+"%":""].filter(Boolean).join("\n"),user+"_"+k+"_"+(i+1));
    x.sent=true;save();const box=document.getElementById(`vr-${k}-${i}`);if(box)box.innerHTML=voiceRes(k,i)}
}
async function voiceSendSpeak(t){
  const k=t.dataset.vsend,b=blocks.find(x=>x._key===k),v=(P[k]&&P[k].v)||{};
  const ids=Object.keys(v).filter(i=>VREC[k+":"+i]&&!v[i].sent),sc=document.getElementById("sc-"+k);
  if(!ids.length){if(sc)sc.textContent=Object.keys(v).some(i=>v[i].sent)?"Все записи уже отправлены.":"Сначала прочитай реплики в микрофон.";return}
  t.disabled=true;
  try{for(const i of ids){const l=b.lines[i];if(sc)sc.textContent=`Отправляю ${ids.indexOf(i)+1} из ${ids.length}…`;
      await tgVoice(k+":"+i,[capHead(b),"📜 "+l[1],"👂 Распознано: "+(v[i].h||"—"),"Совпадение: "+v[i].s+"%"].join("\n"),user+"_"+k+"_"+(+i+1));v[i].sent=true;save()}
    if(sc)sc.textContent="✓ Записи отправлены преподавателю";}
  catch(e){if(sc)sc.textContent="Не получилось отправить ("+e.message+"). Нажми ещё раз."}
  t.disabled=false;
}
/* порядок событий: текущий порядок карточек */
function sortOrder(b){
  const n=b.items.length,v=P[b._key]&&P[b._key].v;
  if(Array.isArray(v)&&v.length===n&&v.every(j=>j>=0&&j<n))return v.slice();
  let o=b.items.map((x,j)=>j).sort((x,y)=>((x*5+2)%n)-((y*5+2)%n));
  if(o.every((j,i)=>j===i))o.reverse();
  return o;
}
function sortSave(ol){
  const k=ol.dataset.srt,o=[...ol.children].map(li=>+li.dataset.j);P[k]=P[k]||{};P[k].v=o;P[k].t=Date.now();
  [...ol.children].forEach((li,i)=>{li.querySelector(".srt-n").textContent=i+1;li.classList.remove("ok","bad")});
  const sc=document.getElementById("sc-"+k);if(sc&&P[k].total==null)sc.textContent="";save();
}
function sortDrag(){
  let D=null;
  document.body.addEventListener("pointerdown",e=>{
    const li=e.target.closest(".srt-it");if(!li||e.target.closest("button"))return;
    if(e.pointerType!=="mouse"&&!e.target.closest(".srt-h"))return;   // на телефоне тянем за ⠿, чтобы страница прокручивалась
    e.preventDefault();D={li,ol:li.parentElement,id:e.pointerId};li.classList.add("drag");try{li.setPointerCapture(e.pointerId)}catch(x){}
  });
  document.body.addEventListener("pointermove",e=>{
    if(!D||e.pointerId!==D.id)return;e.preventDefault();
    const over=[...D.ol.children].find(x=>{if(x===D.li)return false;const r=x.getBoundingClientRect();return e.clientY>=r.top&&e.clientY<=r.bottom});
    if(over){const r=over.getBoundingClientRect();D.ol.insertBefore(D.li,e.clientY<r.top+r.height/2?over:over.nextSibling)}
    if(e.clientY<60)window.scrollBy(0,-12);else if(e.clientY>innerHeight-60)window.scrollBy(0,12);
  },{passive:false});
  const up=e=>{if(!D||e.pointerId!==D.id)return;D.li.classList.remove("drag");sortSave(D.ol);D=null};
  document.body.addEventListener("pointerup",up);document.body.addEventListener("pointercancel",up);
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
  const b=blocks.find(x=>x._key===key);
  if(b.type==="sort"){P[key]=P[key]||{};P[key].v=sortOrder(b)}
  const v=(P[key]=P[key]||{}).v=(P[key].v||{});
  let ok=0;const wr=[];
  if(b.type==="sort"){
    const ol=document.querySelector(`[data-srt="${key}"]`);
    v.forEach((j,pos)=>{const good=j===pos,li=ol&&ol.children[pos];if(li){li.classList.remove("ok","bad");li.classList.add(good?"ok":"bad")}if(good)ok++;else wr.push([j,String(pos+1)])});
    P[key].tries=(P[key].tries||0)+1;const ms=P[key].miss=P[key].miss||{};wr.forEach(w=>{ms[w[0]]=(ms[w[0]]||0)+1});
    const hs=P[key].hist=P[key].hist||[];hs.push({t:Date.now(),s:ok,n:b.items.length,w:wr});if(hs.length>10)hs.splice(0,hs.length-10);
    P[key].t=Date.now();P[key].score=ok;P[key].total=b.items.length;P[key].done=ok===b.items.length;
    save();refresh();const sc=document.getElementById("sc-"+key);if(sc&&!P[key].done)sc.textContent+=" · красные карточки стоят не на своём месте";return;
  }
  b.items.forEach((it,i)=>{
    let good=false;
    if(b.type==="fill"){const inp=document.querySelector(`input[data-b="${key}"][data-i="${i}"]`);v[i]=inp.value;good=it.a.some(a=>norm(a)===norm(inp.value));inp.className="ans ko "+(good?"ok":"bad")}
    else if(b.type==="match"){good=String(v[i])===String(i);const o=document.getElementById(`mt-${key}-${i}`);if(o)o.className="mt-to ko "+(good?"ok":"bad");
      const fb=document.getElementById(`fb-${key}-${i}`);if(fb){fb.textContent=good?"✓":"✗ "+it.r;fb.className="fb "+(good?"ok":"bad")}if(good)ok++;else wr.push(i);return}
    else if(b.type==="order"){good=norm(String(v[i]||"").split("|").join(""))===norm(Array.isArray(it.a)?it.a[0]:it.a)||(Array.isArray(it.a)&&it.a.some(a=>norm(a)===norm(String(v[i]||"").split("|").join(""))));const o=document.getElementById(`od-${key}-${i}`);if(o)o.className="built ko "+(good?"ok":"bad")}
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
/* чтение вслух: распознаём фразу (js/ear.js) и сравниваем с текстом реплики по буквам-чамо */
async function speakLine(t){
  const k=t.dataset.spm,i=+t.dataset.i,b=blocks.find(x=>x._key===k),line=b&&b.lines[i];if(!line||t.classList.contains("on"))return;
  const fb=document.getElementById(`sp-${k}-${i}`),E=KR.ear;if(window.KR&&KR.hush)KR.hush();
  t.classList.add("on");if(fb){fb.className="micfb";fb.textContent="Слушаю… прочитай реплику"}
  let r=null;
  try{let alts;
    if(b.rec){   // с записью для преподавателя: запись и распознавание вместе, останавливается само после фразы
      const c=await voiceStart({lang:"ko",auto:true,max:Math.min(20,4+line[1].length*.25)}),x=await c.done;
      const id=k+":"+i,old=VREC[id];if(old)try{URL.revokeObjectURL(old.url)}catch(e){}
      if(x.blob)VREC[id]={blob:x.blob,mime:x.mime,dur:x.dur,url:URL.createObjectURL(x.blob)};
      alts=x.alts.length?x.alts:x.text?[x.text]:[];if(!alts.length)throw {error:x.err||"no-speech"};
    }else alts=await E.recognize("ko",{max:Math.min(20000,4000+line[1].length*250)});
    const h=E.heard(alts,line[1],"ko");
    const sc=Math.round(h.score*100),c=sc>=85?"ok":sc>=65?"":"bad";
    r={s:sc,c,h:h.best||alts[0],m:(sc>=85?"Отлично! ":sc>=65?"Почти. ":"Ещё раз. ")+"Совпадение "+sc+"% · услышали: «"+(h.best||alts[0])+"»"};
    if(sc<65)setTimeout(()=>say(line[1]),400);
  }catch(e){if(fb){fb.className="micfb bad";fb.textContent=E.errText(e)}}
  t.classList.remove("on");if(!r)return;
  if(fb){fb.className="micfb "+r.c;fb.textContent=r.m}
  const p=P[k]=P[k]||{};p.v=p.v||{};const was=p.v[i];if(!was||r.s>=was.s||b.rec)p.v[i]=r;p.t=Date.now();
  const mine=b.lines.map((l,j)=>j).filter(j=>!p.role||b.lines[j][0]===p.role),got=mine.filter(j=>p.v[j]);
  const sc=document.getElementById("sc-"+k);if(sc)sc.textContent=`Прочитано ${got.length} из ${mine.length} · в среднем ${got.length?Math.round(got.reduce((a,j)=>a+p.v[j].s,0)/got.length):0}%`;
  if(got.length===mine.length&&!p.done){p.done=true;refresh()}
  save();
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
    if(t.dataset.ml!==undefined){const g=t.closest("[data-mt]");g.querySelectorAll(".mt-l").forEach(x=>x.classList.toggle("sel",x===t));g.dataset.sel=t.dataset.ml;return}
    if(t.dataset.mr!==undefined){const g=t.closest("[data-mt]"),k=g.dataset.mt,i=g.dataset.sel;if(i==null||i===""){t.classList.add("bad");setTimeout(()=>t.classList.remove("bad"),400);return}
      const b=blocks.find(x=>x._key===k);P[k]=P[k]||{};P[k].v=P[k].v||{};Object.keys(P[k].v).forEach(x=>{if(String(P[k].v[x])===t.dataset.mr){P[k].v[x]=null;const o=document.getElementById(`mt-${k}-${x}`);if(o){o.textContent="";o.className="mt-to ko"}}});
      P[k].v[i]=+t.dataset.mr;P[k].t=Date.now();const o=document.getElementById(`mt-${k}-${i}`);if(o){o.textContent="→ "+b.items[+t.dataset.mr].r;o.className="mt-to ko"}
      const f=document.getElementById(`fb-${k}-${i}`);if(f){f.textContent="";f.className="fb"}
      g.querySelectorAll(".mt-l").forEach(x=>x.classList.remove("sel"));g.dataset.sel="";save();return}
    if(t.dataset.ow!==undefined){const g=t.parentElement,k=g.dataset.ob,i=g.dataset.i;P[k]=P[k]||{};P[k].v=P[k].v||{};const a=String(P[k].v[i]||"").split("|").filter(Boolean);
      if(t.dataset.ow==="⌫")a.pop();else a.push(t.dataset.ow);P[k].v[i]=a.join("|");P[k].t=Date.now();
      const o=document.getElementById(`od-${k}-${i}`);if(o){o.textContent=a.join(" ");o.className="built ko"}const f=document.getElementById(`fb-${k}-${i}`);if(f){f.textContent="";f.className="fb"}save();return}
    if(t.dataset.wsave){const k=t.dataset.wsave,b=blocks.find(x=>x._key===k),v=(P[k]=P[k]||{}).v=P[k].v||{};
      b.prompts.forEach((x,i)=>{const e=document.getElementById(`wr-${k}-${i}`);if(e)v[i]=e.value});
      const n=b.prompts.filter((x,i)=>String(v[i]||"").trim().length>=2).length,sc=document.getElementById("sc-"+k);
      const S=P[k].s||{},n2=b.voice?b.prompts.filter((x,i)=>String(v[i]||"").trim().length>=2||S[i]).length:n;
      if(n2<b.prompts.length){if(sc)sc.textContent=`Ответь на все ${b.voice?"(письменно или голосом)":"вопросы"}: готово ${n2} из ${b.prompts.length}`;save();return}
      if(VCUR){if(sc)sc.textContent="Сначала останови запись.";return}
      b.prompts.forEach((x,i)=>voiceMatch(k,i));
      if(b.voice&&Object.keys(S).some(i=>!S[i].sent)){t.disabled=true;t.textContent="Отправляю…";
        voiceSendWrite(b).then(()=>{P[k].done=true;P[k].t=Date.now();t.textContent="Сохранено ✓";if(sc)sc.textContent="Записи отправлены преподавателю.";document.querySelectorAll(`#b-${k} .wr-model`).forEach(d=>d.hidden=false);save();refresh()})
          .catch(e=>{t.textContent="Сохранить и отправить";if(sc)sc.textContent="Не получилось отправить ("+e.message+"). Проверь интернет и нажми ещё раз — ответы сохранены."})
          .then(()=>{t.disabled=false});return}
      P[k].done=true;P[k].t=Date.now();t.textContent="Сохранено ✓";if(sc)sc.textContent="";
      document.querySelectorAll(`#b-${k} .wr-model`).forEach(d=>d.hidden=false);save();return refresh()}
    if(t.dataset.vrec!==undefined)return voiceToggle(t);
    if(t.dataset.vsend!==undefined)return voiceSendSpeak(t);
    if(t.dataset.smv!==undefined){const li=t.closest(".srt-it"),ol=li.parentElement;if(+t.dataset.smv<0&&li.previousElementSibling)ol.insertBefore(li,li.previousElementSibling);else if(+t.dataset.smv>0&&li.nextElementSibling)ol.insertBefore(li.nextElementSibling,li);sortSave(ol);t.focus();return}
    if(t.dataset.spr!==undefined){const k=t.dataset.spr;P[k]=P[k]||{};P[k].role=t.dataset.r;save();const c=document.getElementById("b-"+k),b=blocks.find(x=>x._key===k);if(c){c.outerHTML=block(b);refresh()}return}
    if(t.dataset.spm!==undefined)return speakLine(t);
    if(t.dataset.done){const k=t.dataset.done;P[k]=P[k]||{};P[k].done=!P[k].done;P[k].t=Date.now();save();return refresh()}
    if(t.dataset.o!==undefined){const g=t.parentElement,k=g.dataset.b;P[k]=P[k]||{};P[k].v=P[k].v||{};P[k].v[g.dataset.i]=t.dataset.o;P[k].t=Date.now();g.querySelectorAll("button").forEach(x=>x.classList.remove("sel","ok","bad"));t.classList.add("sel");save()}
  });
  document.body.addEventListener("input",e=>{const w=e.target;if(w.dataset&&w.dataset.wb){const k=w.dataset.wb;P[k]=P[k]||{};P[k].v=P[k].v||{};P[k].v[w.dataset.i]=w.value;P[k].t=Date.now();clearTimeout(window._wrT);window._wrT=setTimeout(save,800)}});
  document.body.addEventListener("input",e=>{const i=e.target;if(i.classList.contains("ans")){const k=i.dataset.b;P[k]=P[k]||{};P[k].v=P[k].v||{};P[k].v[i.dataset.i]=i.value;P[k].t=Date.now();i.className="ans ko";save()}});
  sortDrag();
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
/* Домашка: слова уроков, из которых задания, и слова теста — кнопка «Добавить в словарь» (как под словами урока). */
function hwWordGroups(){
  const V=window.KR&&KR.vocab,rec=L.hw,LS=window.LESSONS||{},out=[];if(!V||!rec)return out;
  (rec.items||[]).forEach(it=>{
    if(it.l&&LS[it.l]&&!out.some(g=>g.id===it.l)){const src=LS[it.l],ws=KR.lessonWords(src);if(ws.length)out.push({id:it.l,lang:src.lang||"ko",title:"Слова урока «"+src.title+"»",words:ws})}
    if(it.wt&&(it.wt.w||[]).length)out.push({id:"hw-"+rec.id+"-wt",lang:it.wt.lang||rec.lang||"ko",title:"Слова теста",words:it.wt.w,mixed:true});
  });
  return out;
}
function hwWords(){
  const box=document.getElementById("hwwords"),V=window.KR&&KR.vocab;if(!box||!V)return;
  const gs=hwWordGroups();if(!gs.length){box.innerHTML="";return}
  const lg=(g,w)=>g.mixed?(w.l||(/[가-힣]/.test(w.w)?"ko":"en")):g.lang;
  const fresh=g=>g.words.filter((w,i,a)=>w&&w.w&&a.findIndex(x=>x&&x.w===w.w)===i&&!V.find(lg(g,w),w.w));
  box.innerHTML=`<div class="card glass hw-words"><h3>${ic("abc",20)} Слова в словарь</h3>`+gs.map((g,i)=>{const n=fresh(g).length,all=g.words.length;
    return `<div class="line" style="align-items:center;justify-content:space-between;gap:10px"><div><b>${esc(g.title)}</b><div class="muted">${n?`${all-n?`в словаре ${all-n} из ${all}`:`${all} ${wordsN(all)}`}`:"все слова уже в твоём словаре"}</div></div>`+
      (n?`<button type="button" class="btn vadd" data-hwadd="${i}">${ic("plus",15)}Добавить в словарь · ${n}</button>`:`<span class="badge ok">${ic("check",14)} в словаре</span>`)+`</div>`}).join("")+
    `<p class="muted" style="margin:8px 0 0">Добавленные слова ждут на странице <a href="words.html">«Слова»</a>: сначала в блоке новых слов, потом в отработке.</p></div>`;
  box.onclick=e=>{const b=e.target.closest("[data-hwadd]");if(!b)return;const g=gs[+b.dataset.hwadd];if(!g)return;
    const now=Date.now();
    if(g.mixed)fresh(g).forEach((w,i)=>V.add(lg(g,w),w.w,w.t,{ex:w.ex,et:w.et,f:w.f,src:g.id}));
    else V.addLesson(g.id,g.lang,g.words.map(w=>({w:w.w,t:w.t,ex:w.ex,et:w.et,f:w.f})),true);
    hwWords()};
}
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
  const key=Array.isArray(b.items)&&EXT.includes(b.type)?"items":(b.type==="talk"||b.type==="write")&&Array.isArray(b.prompts)?"prompts":"";
  if(!key||!Array.isArray(idx))return b;
  const ok=[...new Set(idx)].filter(x=>Number.isInteger(x)&&x>=0&&x<b[key].length).sort((a,c)=>a-c);
  if(!ok.length||ok.length===b[key].length)return b;
  const sub={[key]:ok.map(x=>b[key][x]),subIdx:ok,subOf:b[key].length};
  if(key==="prompts")["hints","model"].forEach(f=>{if(Array.isArray(b[f]))sub[f]=ok.map(x=>b[f][x])});   // подсказки и образцы — по тем же номерам
  return Object.assign(b,sub);
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
    if(b.type==="write"){x.texts=b.prompts.map((q,i)=>{const o={q:String(q).slice(0,200),a:String((p.v||{})[i]||"").slice(0,2000)},S=(p.s||{})[i];
      if(S){o.s=String(S.s||"").slice(0,2000);if(S.m!=null)o.m=S.m;o.rec=!!S.sent}return o})}
    if(b.type==="speak"){const v=p.v||{},ks=Object.keys(v);x.read=ks.length;x.avg=ks.length?Math.round(ks.reduce((a,j)=>a+(v[j].s||0),0)/ks.length):0;
      x.lines=ks.slice(0,30).map(j=>({q:String((b.lines[j]||[])[1]||"").slice(0,200),h:String(v[j].h||"").slice(0,300),s:v[j].s||0,rec:!!v[j].sent}))}
    if(EXT.includes(b.type)){
      x.score=p.score||0;x.total=b.items.length;x.tries=p.tries||0;score+=x.score;max+=x.total;
      const last=p.hist&&p.hist[p.hist.length-1];
      x.wrong=(last?last.w:[]).slice(0,30).map(w=>{const it=b.items[w[0]]||{};return {q:String(it.q||it.p||it.l||it.say||"").slice(0,200),g:String(w[1]==null?"":w[1]).slice(0,100),a:String(b.type==="sort"?w[0]+1:Array.isArray(it.a)?it.a[0]:it.a).slice(0,100)}});
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
