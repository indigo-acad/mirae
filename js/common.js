(function(){
const CFG=window.CONFIG||{};
const U=()=>localStorage.getItem("kr_user");
const J=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k)||"");return v==null?d:v}catch(e){return d}};
const setStatus=s=>{try{sessionStorage.setItem("kr_cloud",s)}catch(e){}};

// ---------- облако ----------
const cloud={
  on:!!(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY),
  async rpc(fn,body){
    const r=await fetch(CFG.SUPABASE_URL+"/rest/v1/rpc/"+fn,{method:"POST",headers:{"Content-Type":"application/json",apikey:CFG.SUPABASE_ANON_KEY,Authorization:"Bearer "+CFG.SUPABASE_ANON_KEY},body:JSON.stringify(body)});
    const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(e){}
    if(!r.ok){const m=String((j&&(j.message||j.hint))||"");const e=new Error(m||("http "+r.status));e.code=/wrong_pin/.test(m)?"wrong_pin":/bad_input/.test(m)?"bad_input":"http";throw e}
    return j;
  },
  load:(n,p)=>cloud.rpc("load_progress",{p_site:CFG.SITE||"school",p_name:n,p_pin:p}),
  save:(n,p,s)=>cloud.rpc("save_progress",{p_site:CFG.SITE||"school",p_name:n,p_pin:p,p_state:s})
};

// ---------- локальное состояние и слияние ----------
function takenObj(u){const v=J("kr_taken:"+u,[]);return Array.isArray(v)?{l:v,t:0}:v}
function collect(){
  const u=U(),pre="kr_progress:"+u+":",s={progress:{},taken:takenObj(u)};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(pre))s.progress[k.slice(pre.length)]=J(k,{})}
  return s;
}
function apply(s){
  const u=U();
  Object.entries(s.progress||{}).forEach(([id,P])=>localStorage.setItem("kr_progress:"+u+":"+id,JSON.stringify(P)));
  if(s.taken)localStorage.setItem("kr_taken:"+u,JSON.stringify(s.taken));
}
const newer=(x,y)=>!x?y:!y?x:((y.t||0)>(x.t||0)?y:x);
function mergeState(a,b){
  a=a||{};b=b||{};const out={email:a.email||b.email,progress:{},taken:newer(a.taken,b.taken)||{l:[],t:0}};
  const ids=new Set([...Object.keys(a.progress||{}),...Object.keys(b.progress||{})]);
  ids.forEach(id=>{const pa=(a.progress||{})[id]||{},pb=(b.progress||{})[id]||{},m={};
    new Set([...Object.keys(pa),...Object.keys(pb)]).forEach(k=>{m[k]=newer(pa[k],pb[k])});out.progress[id]=m});
  return out;
}
let timer;
async function doPush(){
  const u=U(),pin=localStorage.getItem("kr_pin");if(!cloud.on||!u||!pin)return;
  try{const remote=await cloud.load(u,pin);const m=mergeState(collect(),remote||{});apply(m);await cloud.save(u,pin,m);setStatus("ok")}
  catch(e){setStatus("off")}
}
function finish(n,pin){localStorage.setItem("kr_user",n);localStorage.setItem("kr_pin",pin)}

window.KR={
  user:U,
  users:()=>J("kr_users",{}),
  cloud,
  status:()=>{try{return sessionStorage.getItem("kr_cloud")||""}catch(e){return ""}},
  require(){if(!U()){location.href="auth.html";return false}return true},
  progress(id){const u=U(),L=(window.LESSONS||{})[id];if(!L)return{n:0,tot:0,pct:0,P:{}};
    const P=J("kr_progress:"+u+":"+id,{});let tot=0,n=0;
    L.sections.forEach(s=>s.blocks.forEach((b,i)=>{tot++;const p=P[s.id+"-"+i];if(p&&p.done)n++}));
    return{n,tot,pct:tot?Math.round(n/tot*100):0,P}},
  taken:()=>takenObj(U()).l||[],
  setTaken(a){localStorage.setItem("kr_taken:"+U(),JSON.stringify({l:a,t:Date.now()}));KR.push()},
  push(){clearTimeout(timer);timer=setTimeout(doPush,600)},
  async register(name,pin,email){
    const n=name.trim().toLowerCase();
    if(cloud.on){
      try{const ex=await cloud.load(n,pin);if(ex!==null)return{err:"taken"};
        await cloud.save(n,pin,{email:email||"",progress:{},taken:{l:[],t:0}});finish(n,pin);setStatus("ok");return{ok:1}}
      catch(e){if(e.code==="wrong_pin")return{err:"taken"};if(e.code==="bad_input")return{err:"bad"}}
    }
    const u=KR.users();if(u[n])return{err:"taken"};
    u[n]={pin,email:email||""};localStorage.setItem("kr_users",JSON.stringify(u));finish(n,pin);setStatus("off");return{ok:1,offline:1};
  },
  async login(name,pin){
    const n=name.trim().toLowerCase(),local=KR.users()[n];
    if(cloud.on){
      try{const s=await cloud.load(n,pin);
        if(s===null){if(local&&local.pin===pin){finish(n,pin);setStatus("off");doPush();return{ok:1,offline:1}}return{err:"none"}}
        finish(n,pin);apply(mergeState(collect(),s));setStatus("ok");KR.push();return{ok:1}}
      catch(e){if(e.code==="wrong_pin")return{err:"pin"}}
    }
    if(local&&local.pin===pin){finish(n,pin);setStatus("off");return{ok:1,offline:1}}
    return{err:local?"pin":"none"};
  },
  logout(){localStorage.removeItem("kr_user");localStorage.removeItem("kr_pin")},
  topbar(active){
    const el=document.getElementById("topbar");if(!el)return;const u=U();
    const icon='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.5-6 8-6s7 1.5 8 6"/></svg>';
    const a=(h,t,k)=>`<a href="${h}" class="${active===k?"on":""}">${t}</a>`;
    el.innerHTML=`<div class="top"><a class="logo ko" href="index.html">한국어 <span>школа</span></a><nav>${a("course.html","Курс","course")}${a("practice.html","Доп. упражнения","practice")}<a href="${u?"cabinet.html":"auth.html"}" class="acc ${active==="cabinet"?"on":""}" title="Личный кабинет">${icon}<span class="cap">${u?u:"Войти"}</span></a></nav></div>`;
  },
  bar(p){return `<div class="bar"><div style="width:${p}%"></div></div>`}
};
})();
