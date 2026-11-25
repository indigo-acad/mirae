/* Шапка: анимации на GSAP (вход, бегущий индикатор под пунктами меню, магнитная кнопка, полоса прокрутки).
   Подключается сама из common.js после отрисовки шапки; GSAP грузится из js/vendor/gsap. */
(function(){
"use strict";
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const base=(document.currentScript&&document.currentScript.src||"").replace(/topbar-fx\.js.*$/,"");
let gsapReady=null;
function loadGsap(){
  if(window.gsap)return Promise.resolve(window.gsap);
  if(gsapReady)return gsapReady;
  gsapReady=new Promise((ok,no)=>{const s=document.createElement("script");s.src=base+"vendor/gsap/gsap.min.js";s.onload=()=>ok(window.gsap);s.onerror=no;document.head.appendChild(s)});
  return gsapReady;
}

// логотип: буквы по отдельности (для входа и перелива при наведении)
function splitLogo(top){
  const logo=top.querySelector(".logo:not(.brand)");if(!logo||logo.dataset.fx)return;
  logo.dataset.fx=1;
  const txt=logo.firstChild;if(!txt||txt.nodeType!==3)return;
  const w=document.createElement("b");w.className="lt";w.setAttribute("aria-hidden","true");
  w.innerHTML=[...txt.textContent].map(c=>"<i>"+c+"</i>").join("");
  logo.replaceChild(w,txt);
}

// бегущая подсветка под пунктами меню
function indicator(top,g){
  const nav=top.querySelector("nav");if(!nav)return;
  const pill=document.createElement("span");pill.className="nav-pill";pill.setAttribute("aria-hidden","true");nav.prepend(pill);
  const on=()=>nav.querySelector("a.on");
  const to=(a,instant)=>{
    if(!a){g.to(pill,{opacity:0,duration:.25});return}
    const r=a.getBoundingClientRect(),n=nav.getBoundingClientRect();
    const v={x:r.left-n.left+nav.scrollLeft-12,width:r.width+24,opacity:1};
    instant?g.set(pill,v):g.to(pill,{...v,duration:.5,ease:"expo.out"});
  };
  nav.querySelectorAll("a").forEach(a=>{a.addEventListener("pointerenter",()=>to(a));a.addEventListener("focus",()=>to(a))});
  nav.addEventListener("pointerleave",()=>to(on()));
  nav.addEventListener("focusout",e=>{if(!nav.contains(e.relatedTarget))to(on())});
  addEventListener("resize",()=>to(on(),true));
  requestAnimationFrame(()=>to(on(),true));
}

// магнитная кнопка «Войти» / кабинет
function magnet(top,g){
  const b=top.querySelector(".acc");if(!b||!matchMedia("(hover:hover)").matches)return;
  const xT=g.quickTo(b,"x",{duration:.5,ease:"power3.out"}),yT=g.quickTo(b,"y",{duration:.5,ease:"power3.out"});
  b.addEventListener("pointermove",e=>{const r=b.getBoundingClientRect();xT((e.clientX-r.left-r.width/2)*.3);yT((e.clientY-r.top-r.height/2)*.4)});
  b.addEventListener("pointerleave",()=>{xT(0);yT(0)});
}

// золотая нить прокрутки по нижнему краю шапки
function progress(top){
  const bar=document.createElement("i");bar.className="top-progress";bar.setAttribute("aria-hidden","true");top.appendChild(bar);
  const set=()=>{const h=document.documentElement.scrollHeight-innerHeight;bar.style.transform="scaleX("+(h>0?Math.min(1,scrollY/h):0)+")"};
  addEventListener("scroll",set,{passive:true});set();
}

// вход: один раз за сессию, дальше шапка появляется сразу
function intro(top,g){
  let seen=false;try{seen=sessionStorage.getItem("kr_topfx")==="1";sessionStorage.setItem("kr_topfx","1")}catch(e){}
  if(seen)return;
  const tl=g.timeline({defaults:{ease:"expo.out"}});
  const letters=top.querySelectorAll(".logo .lt i");
  if(letters.length)tl.from(letters,{yPercent:120,opacity:0,rotate:8,duration:1,stagger:.06});
  else tl.from(top.querySelector(".logo"),{x:-24,opacity:0,duration:.9});
  tl.from(top.querySelectorAll(".logo>span:not(.wm),.logo .emb,.logo .wm small"),{opacity:0,letterSpacing:"1em",duration:1.1},"<.25")
    .from(top.querySelectorAll("nav a"),{y:-18,opacity:0,duration:.8,stagger:.08},"<.1")
    .from(top.querySelectorAll(".top-r>*"),{scale:.6,opacity:0,duration:.9,ease:"back.out(2)",stagger:.08},"<.15");
}

window.KR_topfx=function(){
  const top=document.querySelector("#topbar .top");if(!top||top.dataset.fx)return;
  top.dataset.fx=1;top.classList.add("fx");
  progress(top);
  if(reduce)return;
  splitLogo(top);
  loadGsap().then(g=>{if(!top.isConnected)return;indicator(top,g);magnet(top,g);intro(top,g)}).catch(()=>{});
};
window.KR_topfx();
})();
