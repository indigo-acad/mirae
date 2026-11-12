(function(){
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
const norm=s=>String(s).normalize("NFC").replace(/[\s?.!,]/g,"").toLowerCase();
const user=localStorage.getItem("kr_user");
const id=new URLSearchParams(location.search).get("l")||"l12-jiyo";
const L=(window.LESSONS||{})[id];
if(!L){document.body.innerHTML="<p style='padding:20px'>Урок не найден.</p>";return}
if(!user){location.href="auth.html";return}
const KEY="kr_progress:"+user+":"+id;
let P={};try{P=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(P))}catch(e){}
  if(window.KR)KR.push();
  // сюда позже добавится запись в Supabase: window.syncProgress && window.syncProgress(user,id,P)
}
function say(t){try{const u=new SpeechSynthesisUtterance(t);u.lang="ko-KR";u.rate=.85;const v=speechSynthesis.getVoices().find(v=>v.lang&&v.lang.startsWith("ko"));if(v)u.voice=v;speechSynthesis.cancel();speechSynthesis.speak(u)}catch(e){}}
window.say=say;
const sayBtn=t=>`<button class="say" data-say="${esc(t)}" title="Послушать">🔊</button>`;

const blocks=[]; // flat list of {key,done}
L.sections.forEach(s=>s.blocks.forEach((b,i)=>{b._key=s.id+"-"+i;blocks.push(b)}));

function render(){
  document.title=L.course+" · "+L.title;
  let h=`<div id="topbar"></div><header class="band"><div class="in"><a href="${L.back||"course.html"}">← ${L.back?"доп. упражнения":"курс"}</a><br><small>${esc(L.course)} · ${esc(user)}</small><h1 class="ko">${esc(L.title)}</h1><p>${esc(L.subtitle)}</p></div></header><main>
  <div class="card"><b>Прогресс урока</b> <span id="pct" class="muted"></span><div class="bar"><div id="barfill"></div></div></div>
  <nav class="nav" id="nav">${L.sections.map(s=>`<a href="#${s.id}" data-sec="${s.id}">${s.icon} ${esc(s.title)}</a>`).join("")}</nav>`;
  L.sections.forEach(s=>{
    h+=`<h2 class="sec" id="${s.id}">${s.icon} ${esc(s.title)}</h2>`;
    s.blocks.forEach(b=>{h+=block(b)});
  });
  h+=extra();
  h+="</main>";
  document.body.innerHTML=h;
  if(window.KR)KR.topbar(L.back?"practice":"course");
  wire();refresh();
}
function extra(){
  if(L.back)return `<div class="card"><a class="btn pri" href="${L.back}">← К списку отработок</a></div>`;
  const hw=(window.HOMEWORK||[]).filter(h=>h.lesson===id);
  let h="";
  if(hw.length)h+=`<h2 class="sec">🏠 Домашка к уроку</h2><div class="card">${hw.map(x=>{const ok=x.blocks.every(k=>P[k]&&P[k].done);return `<div class="line" style="justify-content:space-between;align-items:center"><span>${esc(x.title)}</span><span class="badge ${ok?"ok":"warn"}">${ok?"сделано":"к выполнению"}</span></div>`}).join("")}</div>`;
  const cl=window.COURSE?COURSE.lessons.concat((window.COURSE2||{lessons:[]}).lessons).find(l=>l.id===id):null;const pno=cl?cl.no:"all";
  h+=`<div class="card"><h3>Не получилось закрепить?</h3><p class="muted">Если какие-то задания не удались, возьми дополнительную отработку к этому уроку.</p><a class="btn pri" href="practice.html?l=${pno}">🔁 Доп. упражнения</a></div>`;
  return h;
}
function doneRow(b){
  const interactive=["fill","choice"].includes(b.type);
  const d=P[b._key]&&P[b._key].done;
  if(interactive)return `<div class="done-row"><span class="score" id="sc-${b._key}"></span><button data-check="${b._key}" class="pri">Проверить</button></div>`;
  return `<div class="done-row"><span class="muted"></span><button data-done="${b._key}">${d?"✓ Пройдено":"Отметить пройденным"}</button></div>`;
}
function block(b){
  let h=`<div class="card" id="b-${b._key}"><h3>${esc(b.title)}</h3>`;
  if(b.type==="dialogue"){
    h+=b.lines.map(l=>`<div class="line"><span class="sp ko">${l[0]}</span><div><div class="kolg ko">${esc(l[1])} ${sayBtn(l[1])}</div><div class="ru">${esc(l[2])}</div></div></div>`).join("");
    if(b.task)h+=`<p class="muted">📝 ${esc(b.task)}</p>`;
  }else if(b.type==="words"){
    h+=`<div class="words">`+b.items.map(w=>`<div class="w"><span><b class="ko">${esc(w[0])}</b> ${sayBtn(w[0])}</span><span class="ru">${esc(w[1])}</span></div>`).join("")+`</div>`;
  }else if(b.type==="text"){h+=b.html}
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
      return `<div class="ex" data-i="${i}"><span class="q ko">${esc(parts[0])}<input class="ans ko" data-b="${b._key}" data-i="${i}" value="${esc(v)}" autocomplete="off" autocapitalize="off" spellcheck="false">${esc(parts[1]||"")}</span><span class="fb" id="fb-${b._key}-${i}"></span></div>`}).join("")+doneRow(b);
  }else if(b.type==="choice"){
    h+=`<p class="muted">${esc(b.instr)}</p>`;
    h+=b.items.map((it,i)=>{
      const sel=(P[b._key]&&P[b._key].v&&P[b._key].v[i])||"";
      return `<div class="ex"><div class="q ko">${esc(it.q)}</div>${it.r?`<div class="ru ko">→ ${esc(it.r)}</div>`:""}<div class="opts" data-b="${b._key}" data-i="${i}">${b.bank.map(o=>`<button class="${sel===o?"sel":""}" data-o="${esc(o)}">${esc(o)}</button>`).join("")}<span class="fb" id="fb-${b._key}-${i}"></span></div></div>`}).join("")+doneRow(b);
  }else if(b.type==="talk"){
    h+=`<p class="muted">${esc(b.instr)}</p>`+b.prompts.map(p=>`<div class="line"><div class="kolg ko">${esc(p)} ${sayBtn(p)}</div></div>`).join("");
  }
  if(!["fill","choice"].includes(b.type))h+=doneRow(b);
  return h+"</div>";
}
function getItems(b){return b.items}
function check(key){
  const b=blocks.find(x=>x._key===key);const v=(P[key]=P[key]||{}).v=(P[key].v||{});
  let ok=0;const wr=[];
  b.items.forEach((it,i)=>{
    let good=false;
    if(b.type==="fill"){const inp=document.querySelector(`input[data-b="${key}"][data-i="${i}"]`);v[i]=inp.value;good=it.a.some(a=>norm(a)===norm(inp.value));inp.className="ans ko "+(good?"ok":"bad")}
    else{const g=document.querySelector(`.opts[data-b="${key}"][data-i="${i}"]`);const sel=v[i];good=sel===it.a;g.querySelectorAll("button").forEach(bt=>{bt.classList.remove("ok","bad");if(bt.dataset.o===sel)bt.classList.add(good?"ok":"bad")})}
    const fb=document.getElementById(`fb-${key}-${i}`);
    if(fb){fb.textContent=good?"✓":"✗ "+it.a[0];fb.className="fb "+(good?"ok":"bad")}
    if(good)ok++;else wr.push(i);
  });
  P[key].tries=(P[key].tries||0)+1;
  const ms=P[key].miss=P[key].miss||{};wr.forEach(i=>{ms[i]=(ms[i]||0)+1});
  const hs=P[key].hist=P[key].hist||[];hs.push({t:Date.now(),s:ok,n:b.items.length,w:wr.map(i=>[i,String(v[i]==null?"":v[i])])});if(hs.length>10)hs.splice(0,hs.length-10);
  P[key].t=Date.now();P[key].score=ok;P[key].total=b.items.length;P[key].done=ok===b.items.length;
  save();refresh();
}
function refresh(){
  let n=0;
  blocks.forEach(b=>{
    const p=P[b._key];if(p&&p.done)n++;
    const sc=document.getElementById("sc-"+b._key);
    if(sc&&p&&p.total!=null)sc.textContent=`Результат: ${p.score} из ${p.total}`;
    const bd=document.querySelector(`[data-done="${b._key}"]`);if(bd)bd.textContent=p&&p.done?"✓ Пройдено":"Отметить пройденным";
  });
  const pct=Math.round(n/blocks.length*100);
  const f=document.getElementById("barfill");if(f)f.style.width=pct+"%";
  const t=document.getElementById("pct");if(t)t.textContent=`${n} из ${blocks.length} блоков · ${pct}%`;
  L.sections.forEach(s=>{const a=document.querySelector(`[data-sec="${s.id}"]`);if(a)a.classList.toggle("done",s.blocks.every(b=>P[b._key]&&P[b._key].done))});
}
function wire(){
  document.body.addEventListener("click",e=>{
    const t=e.target.closest("button");if(!t)return;
    if(t.dataset.say)return say(t.dataset.say);
    if(t.dataset.check)return check(t.dataset.check);
    if(t.dataset.done){const k=t.dataset.done;P[k]=P[k]||{};P[k].done=!P[k].done;P[k].t=Date.now();save();return refresh()}
    if(t.dataset.o!==undefined){const g=t.parentElement,k=g.dataset.b;P[k]=P[k]||{};P[k].v=P[k].v||{};P[k].v[g.dataset.i]=t.dataset.o;P[k].t=Date.now();g.querySelectorAll("button").forEach(x=>x.classList.remove("sel","ok","bad"));t.classList.add("sel");save()}
  });
  document.body.addEventListener("input",e=>{const i=e.target;if(i.classList.contains("ans")){const k=i.dataset.b;P[k]=P[k]||{};P[k].v=P[k].v||{};P[k].v[i.dataset.i]=i.value;P[k].t=Date.now();i.className="ans ko";save()}});
}
async function boot(){
  if(window.KR){
    const ctx=await KR.load();
    const mid=(L.back?"practice-":"lesson-")+id;
    if(!KR.can(mid)){
      document.body.innerHTML='<div id="topbar"></div><main style="padding-top:30px"><div class="card"><h3>Этот материал не назначен</h3><p class="muted">'+(ctx.ok?'Попроси преподавателя открыть доступ к этому уроку.':'Нет связи с сервером, задания не загружены.')+'</p><a class="btn pri" href="cabinet.html">В личный кабинет</a></div></main>';
      KR.topbar("course");return;
    }
  }
  render();
}
boot();
})();
