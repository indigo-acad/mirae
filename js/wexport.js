/* MIRAÉ · список слов: скопировать или скачать (KR.wexport).
   KR.wexport.open(cards, {title, file}) — окно с выбором формата:
   - «слово — перевод» (текст), можно с примером;
   - Quizlet / Anki: слово, Tab, перевод — так их импорт понимает список сразу;
   - CSV для Excel и Google Таблиц: слово, перевод, пример, перевод примера, язык.
   «Скопировать» кладёт текст в буфер обмена, «Скачать» сохраняет файл .txt или .csv.
   cards — карточки словаря (js/srs.js: l, w, t, d, ex, et) или простые {l, w, t}. Подключать после common.js. */
(function(){
"use strict";
var KR=window.KR;if(!KR)return;
var esc=KR.esc;
var FMT={
  dash:{n:"Слово — перевод",h:"Текстом: для заметок, мессенджера, распечатки",ext:"txt"},
  tab:{n:"Quizlet / Anki",h:"Слово, Tab, перевод — вставь в «Импорт» Quizlet или Anki",ext:"txt"},
  csv:{n:"Таблица (CSV)",h:"Для Excel и Google Таблиц: слово, перевод, пример, язык",ext:"csv"}
};
var LAST={f:"dash",ex:false};try{var s=JSON.parse(localStorage.getItem("kr_wexp")||"null");if(s&&FMT[s.f])LAST=s}catch(e){}
function tr(c){
  if(c.t)return String(c.t);
  var d=(c.d||[])[0];return d&&d.s?String(d.s):"";
}
function plural(n){return n%10===1&&n%100!==11?"слово":n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?"слова":"слов"}
function one(s){return String(s==null?"":s).replace(/[\t\r\n]+/g," ").trim()}
function csvCell(s){s=one(s);return /[",;\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function build(cards,f,ex){
  if(f==="csv"){
    var rows=[["Слово","Перевод","Пример","Перевод примера","Язык"]].concat(cards.map(function(c){return [c.w,tr(c),c.ex||"",c.et||"",(KR.LANGS[c.l]||{}).name||c.l||""]}));
    return rows.map(function(r){return r.map(csvCell).join(",")}).join("\r\n");
  }
  return cards.map(function(c){
    var w=one(c.w),t=one(tr(c)),e=ex&&c.ex?one(c.ex)+(c.et?" ("+one(c.et)+")":""):"";
    if(f==="tab")return w+"\t"+t+(e?"; "+e:"");
    return w+(t?" — "+t:"")+(e?" | "+e:"");
  }).join("\n");
}
async function copy(text){
  try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return true}}catch(e){}
  var a=document.createElement("textarea");a.value=text;a.setAttribute("readonly","");a.style.position="fixed";a.style.opacity="0";document.body.appendChild(a);a.select();
  var ok=false;try{ok=document.execCommand("copy")}catch(e){}a.remove();return ok;
}
function download(text,name,ext){
  var blob=new Blob([ext==="csv"?"﻿"+text:text],{type:ext==="csv"?"text/csv;charset=utf-8":"text/plain;charset=utf-8"});
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name+"."+ext;document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1500);
}
function fname(s){var d=new Date();return (String(s||"slova").replace(/[\\\/:*?"<>|]+/g,"").replace(/\s+/g,"-").slice(0,40)||"slova")+"-"+d.getFullYear()+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0")}
function open(cards,o){
  o=o||{};cards=(cards||[]).filter(function(c){return c&&c.w});
  var d=document.getElementById("wexp");
  if(!d){d=document.createElement("dialog");d.id="wexp";d.className="wdlg card wexp";d.setAttribute("aria-label","Скачать или скопировать слова");document.body.appendChild(d)}
  var st={f:LAST.f,ex:!!LAST.ex},hasEx=cards.some(function(c){return c.ex});
  function draw(){
    var text=build(cards,st.f,st.ex),lines=text.split("\n"),prev=lines.slice(0,st.f==="csv"?6:5).join("\n")+(lines.length>(st.f==="csv"?6:5)?"\n…":"");
    d.innerHTML='<div class="wexp-in"><div class="wdlg-top"><h3>'+KR.icon("abc",20)+' '+esc(o.title||"Мои слова")+' · '+cards.length+'</h3><button type="button" class="icb" data-we="close" aria-label="Закрыть">×</button></div>'+
      (cards.length?'<div class="opts wexp-f" role="radiogroup" aria-label="Формат">'+Object.keys(FMT).map(function(k){return '<button type="button" role="radio" data-wf="'+k+'" class="'+(st.f===k?"sel":"")+'" aria-checked="'+(st.f===k)+'"><b>'+FMT[k].n+'</b><small>'+FMT[k].h+'</small></button>'}).join("")+'</div>'+
      (hasEx&&st.f!=="csv"?'<label class="wexp-ex"><input type="checkbox" data-we="ex"'+(st.ex?" checked":"")+'> С примерами</label>':"")+
      '<pre class="wexp-pre" aria-label="Как будет выглядеть список">'+esc(prev)+'</pre>'+
      '<div class="done-row"><span class="muted" id="wexpmsg" role="status"></span><span class="wexp-btns"><button type="button" data-we="copy">'+KR.icon("check",15)+' Скопировать</button><button type="button" class="btn pri" data-we="dl">Скачать .'+FMT[st.f].ext+'</button></span></div>'
      :'<p class="muted">В списке нет слов.</p>')+'</div>';
  }
  d.onclick=async function(e){
    if(e.target===d){d.close();return}
    var b=e.target.closest("button");if(!b)return;
    if(b.dataset.wf){st.f=b.dataset.wf;remember();draw();var x=d.querySelector('[data-wf="'+st.f+'"]');if(x)x.focus();return}
    if(b.dataset.we==="close")return d.close();
    var text=build(cards,st.f,st.ex),m=d.querySelector("#wexpmsg");
    if(b.dataset.we==="copy"){var ok=await copy(text);if(m)m.textContent=ok?"Скопировано: "+cards.length+" "+plural(cards.length)+". Вставь в другое приложение.":"Не получилось скопировать: выдели текст и скопируй вручную.";return}
    if(b.dataset.we==="dl"){download(text,fname(o.file||o.title),FMT[st.f].ext);if(m)m.textContent="Файл сохранён в «Загрузки».";}
  };
  d.onchange=function(e){if(e.target.dataset.we==="ex"){st.ex=e.target.checked;remember();draw()}};
  function remember(){LAST={f:st.f,ex:st.ex};try{localStorage.setItem("kr_wexp",JSON.stringify(LAST))}catch(e){}}
  draw();if(!d.open)d.showModal();
}
KR.wexport={open:open,build:build};
})();
