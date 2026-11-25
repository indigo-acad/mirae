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
  const line=document.createElement("i");line.className="top-sweep";line.setAttribute("aria-hidden","true");top.appendChild(line);
  tl.from(top.querySelectorAll(".logo>span:not(.wm),.logo .emb,.logo .wm small"),{opacity:0,letterSpacing:"1em",filter:"blur(6px)",duration:1.1},"<.25")
    .fromTo(line,{scaleX:0,opacity:1},{scaleX:1,duration:1.2,ease:"power3.inOut"},"<")
    .from(top.querySelectorAll("nav a"),{y:-26,opacity:0,filter:"blur(8px)",rotateX:-70,transformOrigin:"50% 0",duration:.9,stagger:.09},"<.15")
    .from(top.querySelectorAll(".top-r>*"),{scale:.4,opacity:0,duration:1,ease:"back.out(2.4)",stagger:.08},"<.2")
    .to(line,{opacity:0,duration:.8},">-.2")
    .set(top.querySelectorAll("nav a,.logo>span,.logo .wm small"),{clearProps:"filter"});
}

function roll(top){
  top.querySelectorAll("nav a").forEach(a=>{
    if(a.querySelector(".rl"))return;
    const ic=a.querySelector(".ic"),txt=[...a.childNodes].filter(n=>n!==ic&&!(n.nodeType===1&&n.classList.contains("ic")));
    const w=document.createElement("span");w.className="rl";
    const t1=document.createElement("span");t1.className="rl-a";txt.forEach(n=>t1.appendChild(n));
    const t2=t1.cloneNode(true);t2.className="rl-b";t2.setAttribute("aria-hidden","true");
    w.append(t1,t2);a.appendChild(w);
  });
}
function ambient(top,g){
  const L=top.querySelectorAll(".logo .lt i");
  if(L.length)g.timeline({repeat:-1,repeatDelay:7,delay:4}).to(L,{y:-3,duration:.35,ease:"sine.out",stagger:.05,yoyo:true,repeat:1});
  const acc=top.querySelector(".acc.enter");if(acc)acc.classList.add("pulse");
}

// ---------- шапка страницы с пейзажем: заголовок по словам, параллакс, мерцающие звёзды и огни ----------
function bandFx(g){
  const band=document.querySelector("header.band,header.hero");if(!band||band.dataset.fx)return;band.dataset.fx=1;
  const isHero=band.classList.contains("hero");
  // звёзды: мерцают вразнобой в небе над пейзажем
  const sky=document.createElement("div");sky.className="band-stars";sky.setAttribute("aria-hidden","true");
  for(let i=0;i<(isHero?0:26);i++){const s=document.createElement("i");s.style.left=(Math.random()*100)+"%";s.style.top=(Math.random()*55)+"%";s.style.setProperty("--s",(1+Math.random()*2).toFixed(1)+"px");sky.appendChild(s)}
  band.appendChild(sky);
  g.utils.toArray(sky.children).forEach(s=>g.to(s,{opacity:g.utils.random(.7,1),scale:g.utils.random(1.2,2),duration:g.utils.random(.8,2.4),repeat:-1,yoyo:true,ease:"sine.inOut",delay:g.utils.random(0,3)}));
  // тёплое «дыхание» горизонта
  const glow=document.createElement("div");glow.className="band-glow";glow.setAttribute("aria-hidden","true");band.appendChild(glow);
  g.to(glow,{opacity:.95,scaleX:1.08,duration:4,repeat:-1,yoyo:true,ease:"sine.inOut"});
  // заголовок: слова поднимаются из размытия
  const h=band.querySelector("h1");
  if(h&&!isHero&&!h.querySelector(".hw")&&h.children.length===0&&h.textContent.trim()){
    const words=h.textContent.trim().split(/\s+/);h.setAttribute("aria-label",h.textContent.trim());
    h.innerHTML=words.map(w=>'<span class="hw" aria-hidden="true"><span>'+w.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[c])+"</span></span>").join(" ");
  }
  const tl=g.timeline({defaults:{ease:"expo.out"}});
  const sm=band.querySelector(".in>small"),wd=band.querySelectorAll("h1 .hw>span"),rest=band.querySelectorAll(".in>p,.hero-cta>*");
  if(sm)tl.from(sm,{opacity:0,x:-30,letterSpacing:"0.6em",duration:1.1});
  if(wd.length)tl.from(wd,{yPercent:110,rotate:4,opacity:0,filter:"blur(10px)",duration:1.1,stagger:.08},"<.1").set(wd,{clearProps:"filter"});
  if(rest.length)tl.from(rest,{y:24,opacity:0,duration:.9,stagger:.1},"<.3");
  // пейзаж: один раз мягко выплывает снизу, дальше стоит на месте
  tl.fromTo(band,{"--rise":"24px","--fade":0},{"--rise":"0px","--fade":1,duration:1.4,ease:"power3.out"},0);
}

window.KR_topfx=function(){
  const top=document.querySelector("#topbar .top");if(!top||top.dataset.fx)return;
  top.dataset.fx=1;top.classList.add("fx");
  progress(top);
  if(reduce)return;
  splitLogo(top);
  roll(top);
  loadGsap().then(g=>{if(!top.isConnected)return;indicator(top,g);magnet(top,g);intro(top,g);ambient(top,g);try{bandFx(g)}catch(e){}}).catch(()=>{});
};
window.KR_topfx();
})();
