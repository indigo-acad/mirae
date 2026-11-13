/* MIRAÉ · помощник — пока заглушка: кнопка в углу и панель с местом для диалога, без ответов.
   Включается в js/config.js (ASSISTANT): false — выключен; "teacher" — виден только преподавателю,
   чтобы посмотреть, как это будет выглядеть; true — виден всем вошедшим ученикам.
   Когда появится серверная часть, нужно задать CONFIG.ASSISTANT_URL и дописать KR.assistant.ask(). */
(function(){
var KR=window.KR,CFG=window.CONFIG||{};if(!KR)return;
var btn=null,box=null;
function cached(){try{return JSON.parse(localStorage.getItem("kr_ctx:"+KR.user())||"null")}catch(e){return null}}
function allowed(){
  var f=CFG.ASSISTANT;if(!f||!KR.user())return false;
  if(f==="teacher"){var c=KR.ctx&&KR.ctx.ok?KR.ctx:cached();return !!(c&&c.teacher)}
  return true;
}
function open(){box.hidden=false;btn.setAttribute("aria-expanded","true");box.querySelector("button").focus()}
function close(){if(!box||box.hidden)return;box.hidden=true;btn.setAttribute("aria-expanded","false");btn.focus()}
function build(){
  btn=document.createElement("button");btn.type="button";btn.className="round glass frost asst-btn";
  btn.setAttribute("aria-label","Помощник");btn.setAttribute("aria-expanded","false");btn.innerHTML=KR.icon("spark",22);
  box=document.createElement("section");box.className="asst glass frost";box.hidden=true;box.setAttribute("aria-label","Помощник MIRAÉ");
  box.innerHTML='<div class="asst-head"><h3>Помощник</h3><button type="button" aria-label="Закрыть">'+KR.icon("x",16)+"</button></div>"+
    '<div class="asst-log" aria-live="polite"><p>Здесь появится помощник MIRAÉ. Он пока в разработке.</p></div>'+
    '<form><input class="name" placeholder="Скоро здесь можно будет задать вопрос" aria-label="Вопрос помощнику" disabled>'+
    '<button type="submit" class="round" aria-label="Отправить" disabled>'+KR.icon("send",18)+"</button></form>";
  btn.onclick=function(){box.hidden?open():close()};
  box.querySelector("button").onclick=close;
  box.querySelector("form").onsubmit=function(e){e.preventDefault()};
  document.addEventListener("keydown",function(e){if(e.key==="Escape")close()});
  document.body.appendChild(box);document.body.appendChild(btn);
}
KR.assistant={
  // вызывается после загрузки роли пользователя (KR.load) и при открытии страницы
  sync:function(){
    if(btn&&!document.body.contains(btn)){btn=null;box=null}   // страница урока перерисовывает body целиком
    var ok=allowed();if(ok&&!btn)build();if(btn){btn.hidden=!ok;if(!ok)box.hidden=true}
  },
  open:function(){if(btn)open()},close:close,
  // будущая точка входа: отправить вопрос на CONFIG.ASSISTANT_URL и показать ответ в .asst-log
  ask:function(){return Promise.reject(new Error("assistant_not_ready"))}
};
KR.assistant.sync();
})();
