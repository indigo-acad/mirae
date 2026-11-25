/* MIRAÉ · библиотека упражнений и уроков (KR.lib). SQL — supabase/library.sql, страница — library.html.
   Блок библиотеки — блок урока в том же виде, что в data/*.js, плюс теги: язык, уровень, тема, источник.
   Урок из библиотеки хранит ссылки на блоки; на странице урока он открывается как lesson.html?l=lib-<номер>
   (KR.lib.ensure кладёт его в window.LESSONS) и задаётся домашкой так же, как уроки сайта. */
(function(){
if(!window.KR)return;
const api=(f,x)=>KR.api(f,x);
const missing=e=>!!(e&&(e.status===404||/Could not find the function/.test(e.message||"")));

// типы блоков: названия для фильтра и часть урока
const KINDS={
  fill:"Вписать ответ",choice:"Выбрать ответ",build:"Собрать из букв",match:"Сопоставить",order:"Собрать предложение",
  talk:"Поговорить",write:"Написать ответ",speak:"Прочитать вслух",
  dialogue:"Диалог",words:"Слова",examples:"Примеры",table:"Таблица",text:"Текст / объяснение",video:"Видео"
};
const PRACTICE=["fill","choice","build","match","order","talk","write","speak"];
const SKIP=["wtest","mat"];   // блоки, которые живут только внутри домашки

// уровень из подписи курса: «1급 · 12과» → 1급, «CLT-синтез · A1» → A1, «한글 · Занятие 2» → A0, «IELTS Band 4–5» → Band 4–5
function level(s){
  s=String(s||"");let m=s.match(/([1-6])\s*급/);if(m)return m[1]+"급";
  m=s.match(/\b([ABC][12])\b/);if(m)return m[1];
  if(/한글|хангыл/i.test(s))return "A0";   // «Хангыль с нуля» — модуль A0
  m=s.match(/band\s*([0-9.]+(?:\s*[–-]\s*[0-9.]+)?)/i);if(m)return "Band "+m[1].replace(/\s+/g,"");
  return "";
}
// копия блока без служебных полей, которые добавляет страница урока (_key, _part …)
function clean(b){const o={};Object.keys(b).forEach(k=>{if(k[0]!=="_"&&k!=="src"&&k!=="srcKey")o[k]=b[k]});return JSON.parse(JSON.stringify(o))}

// все блоки уроков сайта, которые загружены на странице (window.LESSONS)
function fromSite(){
  const out=[];
  Object.keys(window.LESSONS||{}).forEach(lid=>{
    const L=window.LESSONS[lid];if(!L||L.hw||L.lib||/^lib-/.test(lid)||!Array.isArray(L.sections))return;
    const lang=L.lang||"ko",lv=level(L.course),topic=String(L.title||"").slice(0,80);
    L.sections.forEach(s=>(s.blocks||[]).forEach((b,i)=>{
      if(!b||!b.type||SKIP.indexOf(b.type)>=0)return;
      const tags=[L.course,s.title,s.id==="hw"?"домашка":""].filter(Boolean).map(t=>String(t).slice(0,60));
      out.push({source:(lid+"/"+s.id+"-"+i).slice(0,120),lang,level:lv,topic,tags,block:clean(b)});
    }));
  });
  return out;
}
// собрать блоки уроков сайта в библиотеку: частями по 150, onStep(сделано, всего)
async function importSite(onStep){
  const all=fromSite(),res={added:0,updated:0,total:all.length};
  for(let i=0;i<all.length;i+=150){
    const r=await api("teacher_lib_import",{p_items:all.slice(i,i+150)});
    res.added+=r.added||0;res.updated+=r.updated||0;if(onStep)onStep(Math.min(i+150,all.length),all.length);
  }
  return res;
}

// урок из библиотеки → вид window.LESSONS
function toLesson(r){
  return {id:"lib-"+r.id,lib:r.id,lang:r.lang||"ko",course:"Библиотека"+(r.level?" · "+r.level:""),title:r.title,subtitle:r.subtitle||"",
    sections:(r.sections||[]).map(s=>({id:s.id,title:s.title,icon:s.icon||"",part:s.part||undefined,blocks:(s.blocks||[]).map(clean)}))};
}
// загрузить уроки библиотеки, которых ещё нет на странице: ensure(["lib-3","l12-jiyo", …]) — лишнее пропускается
async function ensure(ids){
  window.LESSONS=window.LESSONS||{};
  const need=[...new Set((ids||[]).filter(x=>/^lib-\d+$/.test(String(x))&&!window.LESSONS[x]))];
  await Promise.all(need.map(async k=>{
    try{const r=await api("lib_lesson_get",{p_id:+k.slice(4)});if(r&&r.sections)window.LESSONS[k]=toLesson(r)}catch(e){}
  }));
}
// все уроки библиотеки на странице (для панели преподавателя: «Задать домашку», прогресс, слова урока)
async function loadAll(){
  let ls=[];try{ls=await api("teacher_liblesson_list")||[]}catch(e){return []}
  await ensure(ls.map(l=>"lib-"+l.id));
  return ls.map(l=>window.LESSONS["lib-"+l.id]).filter(Boolean);
}
// блоки по номерам, с тегами (supabase/library2.sql); null — функции на сервере ещё нет
async function getBlocks(ids){
  try{return await api("teacher_lib_get",{p_ids:ids})||[]}catch(e){if(missing(e))return null;throw e}
}
// урок из выбранных блоков: теория и отработка — отдельными разделами, в порядке выбора
function sectionsFor(blocks){
  const th=blocks.filter(b=>PRACTICE.indexOf(b.kind)<0).map(b=>b.id),pr=blocks.filter(b=>PRACTICE.indexOf(b.kind)>=0).map(b=>b.id),s=[];
  if(th.length)s.push({id:"theory",title:"Теория",icon:"📘",part:"theory",b:th});
  if(pr.length)s.push({id:"practice",title:"Отработка",icon:"✏️",part:"practice",b:pr});
  return s;
}
// ключи блоков урока для домашки: {"l":"lib-3","b":["theory-0","practice-1"]}
function hwItem(r){
  const b=[];(r.sections||[]).forEach(s=>(s.b||[]).forEach((x,i)=>b.push(s.id+"-"+i)));
  return {l:"lib-"+r.id,b:b.slice(0,40)};
}

KR.lib={
  KINDS,PRACTICE,level,fromSite,importSite,toLesson,ensure,loadAll,getBlocks,sectionsFor,hwItem,missing,
  get:id=>api("lib_lesson_get",{p_id:id}),
  search:f=>api("teacher_lib_search",{p_f:f||{}}),
  facets:lang=>api("teacher_lib_facets",{p_lang:lang||""}),
  save:b=>api("teacher_lib_save",{p_b:b}),
  remove:id=>api("teacher_lib_delete",{p_id:id}),
  fav:(id,on)=>api("teacher_lib_fav",{p_id:id,p_on:!!on}),
  lessons:()=>api("teacher_liblesson_list"),
  saveLesson:l=>api("teacher_liblesson_save",{p_l:l}),
  removeLesson:id=>api("teacher_liblesson_delete",{p_id:id}),
  students:()=>api("teacher_students"),
  // задать урок из библиотеки ученику домашкой (supabase/homework.sql)
  assign:(student,r,due,note)=>api("teacher_hw_save",{p_student:student,p_hw:{title:r.title,lang:r.lang||"ko",items:[hwItem(r)],due:due||"",note:note||""}})
};
})();
