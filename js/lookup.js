/* MIRAÉ · перевод по выделению. Ученик выделяет слово или фразу в уроке: рядом всплывает перевод,
   кнопка «послушать» и кнопка «В словарь» (слово попадает в интервальное повторение, js/vocab.js).
   Откуда берётся перевод, по порядку:
   1) слова уроков и словарь ученика (точно и сразу; у корейских слов узнаём основу: 지내지요 → 지내다);
   2) свой сервис перевода, если его адрес записан в CONFIG.TRANSLATE;
   3) иначе бесплатный машинный перевод MyMemory (CONFIG.TRANSLATE = "mymemory"); выключается значением false. */
(function(){
"use strict";
var KR=window.KR,SRS=window.SRS,CFG=window.CONFIG||{};if(!KR||!SRS)return;
var pop=null,cur=null,seq=0,timer=null;
var HANGUL=/[가-힣ㄱ-ㆎ]/,LATIN=/[A-Za-z]/,CYR=/[А-Яа-яЁё]/;
function langOf(t){return HANGUL.test(t)?"ko":LATIN.test(t)&&!CYR.test(t)?"en":null}
function clean(t){return String(t||"").replace(/\s+/g," ").replace(/^[\s.,!?;:«»"“”'()…·~-]+|[\s.,!?;:«»"“”'()…·~-]+$/g,"")}

// ---------- 1) свой глоссарий ----------
function glossary(){
  var g=[],Ls=window.LESSONS||{};
  Object.keys(Ls).forEach(function(id){(Ls[id].sections||[]).forEach(function(s){(s.blocks||[]).forEach(function(b){
    if(b.type==="words")b.items.forEach(function(w){g.push({w:w[0],t:w[1],l:Ls[id].lang||"ko"})})})})});
  if(KR.vocab)KR.vocab.all().forEach(function(c){if(c.t)g.push({w:c.w,t:c.t,l:c.l})});
  return g;
}
function local(text,lang){
  var n=SRS.norm(text),best=null;
  glossary().forEach(function(e){
    if(e.l!==lang)return;var w=SRS.norm(e.w);
    if(w===n){best={w:e.w,t:e.t,len:999};return}
    var st=lang==="ko"&&w.length>1&&w.slice(-1)==="다"?w.slice(0,-1):w;
    // форма слова: выделенное начинается с основы (지내지요 ← 지내다, places ← place); короткие основы не угадываем
    if(st.length>=2&&n.indexOf(st)===0&&n.length-st.length<=(lang==="ko"?6:3)&&(!best||st.length>best.len))best={w:e.w,t:e.t,len:st.length,form:true};
  });
  return best;
}

// ---------- 2–3) перевод из сети ----------
async function online(text,from){
  var mode=CFG.TRANSLATE===undefined?"mymemory":CFG.TRANSLATE;if(!mode)return null;
  var key="kr_tr:"+from+":"+text;
  try{var c=sessionStorage.getItem(key);if(c)return {t:c,mt:true}}catch(e){}
  var t=null;
  if(mode==="mymemory"){
    var r=await fetch("https://api.mymemory.translated.net/get?q="+encodeURIComponent(text)+"&langpair="+from+"|ru");
    var j=await r.json();t=j&&j.responseData&&j.responseData.translatedText;
    if(!t||String(j.responseStatus)!=="200"||/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t))t=null;
  }else{
    var r2=await fetch(mode,{method:"POST",headers:{"Content-Type":"application/json",apikey:CFG.SUPABASE_ANON_KEY,Authorization:"Bearer "+CFG.SUPABASE_ANON_KEY},body:JSON.stringify({text:text,from:from,to:"ru"})});
    var j2=await r2.json();t=j2&&(j2.text||j2.translation);
  }
  t=t?String(t).trim():"";
  if(!t||SRS.norm(t)===SRS.norm(text))return null;
  try{sessionStorage.setItem(key,t)}catch(e){}
  return {t:t,mt:true};
}

// ---------- всплывающее окно ----------
function close(){if(pop){pop.remove();pop=null}cur=null}
function place(rect){
  var w=pop.offsetWidth,vw=document.documentElement.clientWidth;
  var left=Math.max(8,Math.min(vw-w-8,rect.left+rect.width/2-w/2))+window.scrollX;
  var top=rect.bottom+window.scrollY+10;
  if(rect.bottom+pop.offsetHeight+16>window.innerHeight&&rect.top>pop.offsetHeight+20)top=rect.top+window.scrollY-pop.offsetHeight-10;   // не помещается снизу — показываем сверху
  pop.style.left=left+"px";pop.style.top=top+"px";
}
function render(){
  if(!pop||!cur)return;var c=cur,ko=c.lang==="ko"?' class="ko"':"";
  var have=KR.vocab&&KR.vocab.find(c.lang,c.word||c.text);
  var tr=c.state==="wait"?'<span class="muted">Ищу перевод…</span>':c.state==="none"?'<span class="muted">Перевод не нашёлся. Слово можно добавить в словарь и вписать перевод там.</span>':
    KR.esc(c.t)+(c.form?' <small>словарная форма: <b'+ko+' lang="'+c.lang+'">'+KR.esc(c.word)+"</b></small>":"")+(c.mt?" <small>машинный перевод</small>":"");
  pop.innerHTML='<div class="lk-w"><b'+ko+' lang="'+c.lang+'">'+KR.esc(c.text)+"</b>"+(KR.canSay()?'<button type="button" class="say" data-lk="say" aria-label="Послушать">'+KR.icon("volume",16)+"</button>":"")+
    '<button type="button" class="icb" data-lk="x" aria-label="Закрыть">'+KR.icon("x",16)+"</button></div>"+
    '<div class="lk-t">'+tr+"</div>"+
    (KR.vocab&&c.state!=="wait"?'<div class="lk-a"><button type="button" class="btn pri" data-lk="add"'+(c.added?" disabled":"")+">"+
      (c.added?KR.icon("check",16)+(c.added===2?"Уже в словаре: повторим раньше":"В словаре"):KR.icon("plus",16)+(have?"Повторить раньше":"В словарь"))+"</button></div>":"");
}
/* Предложение, в котором стоит выделенное слово, и его перевод (если он есть рядом в уроке). */
function context(node,text){
  var el=node&&(node.nodeType===1?node:node.parentElement);if(!el)return {};
  var line=el.closest(".line,.ex,.w,li,p,td");if(!line)return {};
  var src=line.querySelector(".kolg,.q")||line,ru=line.querySelector(".ru");
  var ex=clean(src.textContent);
  if(!ex||ex.indexOf(text)<0||ex.length>200||ex===text)return {};
  return {ex:ex,et:ru?clean(ru.textContent).replace(/^→\s*/,""):"",f:text};
}
async function show(text,lang,rect,node){
  close();var my=++seq;
  cur={text:text,lang:lang,state:"wait",ctx:context(node,text)};
  pop=document.createElement("div");pop.className="lookup glass frost";pop.setAttribute("role","dialog");pop.setAttribute("aria-label","Перевод");
  document.body.appendChild(pop);
  var l=local(text,lang);
  if(l){cur.state="ok";cur.t=l.t;cur.word=l.w;cur.form=!!l.form}
  render();place(rect);
  if(l)return;
  var r=null;try{r=await online(text,lang)}catch(e){}
  if(my!==seq||!cur)return;
  if(r){cur.state="ok";cur.t=r.t;cur.mt=true}else cur.state="none";
  render();place(rect);
}
function check(){
  var s=window.getSelection();if(!s||s.isCollapsed||!s.rangeCount)return;
  var node=s.anchorNode,el=node&&(node.nodeType===1?node:node.parentElement);
  if(!el||!el.closest("main")||el.closest(".lookup,input,textarea,button,.subnav"))return;
  var text=clean(s.toString());
  if(text.length<1||text.length>80||text.split(" ").length>8)return;
  var lang=langOf(text);if(!lang)return;
  if(cur&&cur.text===text)return;
  var rect=s.getRangeAt(0).getBoundingClientRect();if(!rect.width&&!rect.height)return;
  show(text,lang,rect,node);
}
document.addEventListener("selectionchange",function(){clearTimeout(timer);timer=setTimeout(check,450)});
document.addEventListener("mouseup",function(e){if(e.target.closest&&e.target.closest(".lookup"))return;clearTimeout(timer);timer=setTimeout(check,60)});
document.addEventListener("mousedown",function(e){if(pop&&!(e.target.closest&&e.target.closest(".lookup")))close()});
document.addEventListener("keydown",function(e){if(e.key==="Escape")close()});
document.addEventListener("click",function(e){
  var b=e.target.closest&&e.target.closest("[data-lk]");if(!b||!cur)return;var a=b.getAttribute("data-lk");
  if(a==="x")return close();
  if(a==="say")return KR.say(cur.text,cur.lang);
  if(a==="add"&&KR.vocab){
    var r=KR.vocab.add(cur.lang,cur.word||cur.text,cur.t||"",Object.assign({src:"sel",star:1},cur.ctx));
    cur.added=r.added?1:2;render();
    if(typeof KR.onVocab==="function")KR.onVocab();
  }
});
KR.lookup={close:close,local:local};
})();
