/* MIRAÉ · живой фон: предрассветный горизонт в палитре школы (WebGL, без видеофайлов).
   Звёзды мерцают, редкие звёздочки медленно падают, время от времени пролетает падающая звезда.
   Sky.mount(canvas,{horizon,flat}) → {toggle(), refresh(), set(), paused} или null, если WebGL недоступен
   (тогда остаётся статичный градиент из CSS). horizon — высота линии горизонта от низа холста (0..1).
   Анимация встаёт на паузу, когда фон не виден или вкладка скрыта, и не запускается сама,
   если в системе включено «уменьшение движения». Выбор пользователя запоминается. */
(function(){
"use strict";
var VS="attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
var FS=[
"#ifdef GL_FRAGMENT_PRECISION_HIGH",
"precision highp float;",
"#else",
"precision mediump float;",
"#endif",
"uniform vec2 uR;uniform float uT;uniform float uH;uniform float uFlat;uniform float uLive;",
"float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}",
"float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
"  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}",
"float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*noise(p);p=p*2.03+vec2(17.3,9.1);a*=.5;}return s;}",
"float stars(vec2 q,float sc,float th){",
"  vec2 g=q*sc,id=floor(g),f=fract(g)-.5;float h=hash(id);if(h<th)return 0.;",
"  vec2 o=(vec2(hash(id+7.1),hash(id+13.7))-.5)*.6;",
"  float sz=mix(.03,.075,hash(id+3.3));",
"  float tw=.6+.4*sin(uT*(.5+1.8*hash(id+5.5))+h*40.);",
"  return smoothstep(sz,0.,length(f-o))*tw*(.35+.65*hash(id+9.9));}",
"float meteor(vec2 p,float seed){",
"  float T=6.+seed*3.,t=uT/T+seed*13.7,id=floor(t),f=fract(t),life=1.1/T;",
"  if(f>life)return 0.;",
"  float k=f/life,asp=uR.x/uR.y;",
"  vec2 a=vec2((hash(vec2(id,seed))*1.5-.6)*asp*.55,.2+.4*hash(vec2(seed,id)));",
"  vec2 dir=normalize(vec2(-.7-.4*hash(vec2(id*1.7,seed)),-.5));",
"  float len=.2+.2*hash(vec2(id,seed*3.1)),tail=.1*sin(3.14159*k)+.015;",
"  vec2 q=p-(a+dir*len*k);float h=clamp(dot(q,-dir)/tail,0.,1.);",
"  float w=mix(.0022,.0005,h);",
"  return smoothstep(w*2.5,0.,length(q+dir*tail*h))*(1.-h)*(1.-h)*sin(3.14159*k);}",
"void main(){",
"  vec2 uv=gl_FragCoord.xy/uR;",
"  vec2 p=(gl_FragCoord.xy-vec2(.5*uR.x,uH*uR.y))/uR.y;",
"  float rad=mix(mix(1.1,3.2,smoothstep(.5,1.6,uR.x/uR.y)),80.,uFlat);",   // на узких экранах дуга круче; в языковых разделах горизонт ровный (пейзаж)
"  float d=length(p-vec2(0.,-rad))-rad;",            // >0 небо, <0 планета
"  float sx=p.x-.05*sin(uT*.04);",
"  float s=exp(-sx*sx*1.5),hot=exp(-sx*sx*10.);",
"  vec3 deep=vec3(.024,.043,.118),bg=vec3(.043,.082,.208),navy=vec3(.118,.165,.337);",
"  vec3 indigo=vec3(.259,.329,.678),gold=vec3(.831,.686,.486),sun=vec3(1.,.9,.74);",
"  float dd=max(d,0.);",
"  float haze=exp(-dd*2.4),glow=exp(-dd*8.),rim=exp(-dd*70.);",
"  vec3 sky=mix(deep,bg,haze);",
"  vec3 warm=mix(gold,sun,hot);",                      // цвет кромки: золото, к центру светлее
"  sky+=navy*haze*.45*(.5+.5*s);",
"  sky+=indigo*glow*.22*(.3+.7*s)*(1.-.6*glow);",
"  float v=fbm(vec2(p.x*1.5+uT*.012,dd*4.-uT*.018)+2.*fbm(p*1.2+uT*.008));",
"  sky+=indigo*smoothstep(.42,.8,v)*haze*.28;",        // медленная «вуаль» света
"  sky=mix(sky,gold,glow*glow*.85*s);",                // тёплое зарево у самого горизонта
"  sky=mix(sky,warm,rim*(.35+.6*hot)*(.4+.6*s));",     // тонкая горящая линия
"  float st=stars(p+vec2(uT*.0012,0.),42.,.82)+.6*stars(p*1.7+vec2(uT*.0008,3.),60.,.88);",
"  st+=.8*stars(p*1.25+vec2(uT*.016,uT*.03),34.,.93);",          // редкие звёздочки, которые медленно падают
"  sky+=vec3(.95,.93,.88)*st*smoothstep(.03,.4,dd)*(1.-.8*glow);",
"  float mt=meteor(p,.13)+meteor(p,.57)+meteor(p,.91);",          // падающие звёзды
"  sky+=vec3(1.,.95,.84)*mt*uLive*smoothstep(.02,.2,dd);",
"  float k=max(-d,0.);",
"  vec3 body=mix(vec3(.02,.036,.1),bg,smoothstep(0.,.3,k));",
"  body=mix(body,warm,exp(-k*110.)*(.3+.55*hot)*(.4+.6*s));",
"  body+=gold*exp(-k*14.)*.07*s+indigo*exp(-k*9.)*.08*s;",
"  float c=fbm(vec2(p.x*4.+uT*.01,k*26.));",
"  body+=navy*smoothstep(.45,.8,c)*exp(-k*7.)*.35*(.4+.6*s);",
"  float px=1.5/uR.y;",
"  vec3 col=mix(body,sky,smoothstep(-px,px,d));",
"  col=mix(col,bg,smoothstep(.16,0.,uv.y));",
"  col+=(hash(gl_FragCoord.xy+fract(uT)*61.)-.5)/160.;",   // лёгкий шум против полос на градиенте
"  gl_FragColor=vec4(col,1.);",
"}"].join("\n");

function mount(cv,opts){
  opts=opts||{};
  var gl=null;
  try{gl=cv.getContext("webgl",{antialias:false,alpha:false,powerPreference:"low-power"})||cv.getContext("experimental-webgl")}catch(e){}
  if(!gl)return null;
  var uR,uT,uH,uFlat,uLive;
  function shader(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return gl.getShaderParameter(s,gl.COMPILE_STATUS)?s:null}
  function init(){
    var v=shader(gl.VERTEX_SHADER,VS),f=shader(gl.FRAGMENT_SHADER,FS);if(!v||!f)return false;
    var pr=gl.createProgram();gl.attachShader(pr,v);gl.attachShader(pr,f);gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return false;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    var a=gl.getAttribLocation(pr,"a");gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
    uR=gl.getUniformLocation(pr,"uR");uT=gl.getUniformLocation(pr,"uT");uH=gl.getUniformLocation(pr,"uH");
    uFlat=gl.getUniformLocation(pr,"uFlat");uLive=gl.getUniformLocation(pr,"uLive");
    return true;
  }
  if(!init())return null;

  var pref=null;try{pref=localStorage.getItem("kr_sky")}catch(e){}
  var reduce=false;try{reduce=matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){}
  var paused=pref?pref==="off":reduce,visible=true,lost=false,t=opts.start==null?37:opts.start,last=0,raf=0,hz=.3,peek=false;

  function size(){
    var w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;
    var s=Math.min(window.devicePixelRatio||1,1.5);s=Math.min(s,Math.sqrt(2200000/(w*h)));
    var W=Math.max(1,Math.round(w*s)),H=Math.max(1,Math.round(h*s));
    if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;gl.viewport(0,0,W,H)}
    var x=typeof opts.horizon==="function"?opts.horizon():opts.horizon;hz=x==null||isNaN(x)?.3:Math.max(.02,Math.min(.9,x));
  }
  function draw(){
    if(lost||!cv.width)return;
    gl.uniform2f(uR,cv.width,cv.height);gl.uniform1f(uT,t);gl.uniform1f(uH,hz);
    gl.uniform1f(uFlat,opts.flat?1:0);gl.uniform1f(uLive,paused&&!peek?0:1);   // на паузе падающие звёзды не «застывают» в кадре
    gl.drawArrays(gl.TRIANGLES,0,3);cv.classList.add("on");
  }
  function running(){return !paused&&visible&&!lost&&!document.hidden}
  function frame(now){
    raf=0;if(!running())return;
    if(now-last>=33){t+=Math.min(.1,(now-last)/1000);last=now;draw()}   // ~30 кадров в секунду достаточно
    raf=requestAnimationFrame(frame);
  }
  function kick(){if(!raf&&running())raf=requestAnimationFrame(frame)}
  function refresh(){size();draw();kick()}

  if("ResizeObserver" in window)new ResizeObserver(refresh).observe(cv);else window.addEventListener("resize",refresh);
  if("IntersectionObserver" in window)new IntersectionObserver(function(es){visible=es[es.length-1].isIntersecting;kick()}).observe(cv);
  document.addEventListener("visibilitychange",kick);
  cv.addEventListener("webglcontextlost",function(e){e.preventDefault();lost=true});
  cv.addEventListener("webglcontextrestored",function(){lost=!init();refresh()});
  refresh();

  return {
    get paused(){return paused},
    toggle:function(){paused=!paused;try{localStorage.setItem("kr_sky",paused?"off":"on")}catch(e){}last=0;draw();kick();return paused},
    set:function(o){for(var k in o)opts[k]=o[k];refresh()},
    peek:function(x){t=x;peek=true;draw();peek=false},   // один кадр в заданный момент (для проверки)
    refresh:refresh
  };
}
window.Sky={mount:mount};
})();
