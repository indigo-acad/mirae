/* Рандомайзер грамматики · grammar.html (данные — data/grammar-rand.js).
   «Звезда» задаёт вопрос, ученик отвечает с грамматикой в скобках. Разминка в начале занятия вместо «как дела?».
   Открывается вошедшим: преподавателю и ученикам, которым назначен материал ko-grammar-randomizer (KR.can). */
(function(){
  var MID="ko-grammar-randomizer";
  var R=window.GRAMMAR_RAND||{G:{},Q:[],V:{},STARS:[]},G=R.G,Q=R.Q,V=R.V,STARS=R.STARS;
  var esc=KR.esc,ic=KR.icon;
  var $=function(id){return document.getElementById(id)};
  var SKEY="snu_rand_sel_v2",OKEY="snu_rand_opt_v1";
  function LSget(k,d){try{var v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}}
  function LSset(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}

  // ---------- уроки и книги ----------
  var BOOKS=["1급","2A","2B","3A","3B"];
  var ORD={"1급":0,"2A":1,"2B":2,"3A":3,"3B":4};
  function bookOf(k){return k[0]==="1"?"1급":k.slice(0,2)}
  function numOf(k){return parseInt(k[0]==="1"?k.split("_")[1]:k.slice(2),10)||0}
  function klab(k){return bookOf(k)+" · "+numOf(k)+"단원"}
  var KEYS=[];
  Object.keys(G).forEach(function(i){if(KEYS.indexOf(G[i].k)<0)KEYS.push(G[i].k)});
  Object.keys(V).forEach(function(k){if(KEYS.indexOf(k)<0)KEYS.push(k)});
  KEYS.sort(function(a,b){return ORD[bookOf(a)]-ORD[bookOf(b)]||numOf(a)-numOf(b)});

  var sel=new Set(KEYS);
  (function(){var sv=LSget(SKEY,null);if(Array.isArray(sv)){var ok=sv.filter(function(k){return KEYS.indexOf(k)>=0});if(ok.length){sel.clear();ok.forEach(function(k){sel.add(k)})}}})();
  var OPT=Object.assign({tr:false,ru:true,w:true},LSget(OKEY,{}));

  var deck=[],pos=0,cur=null,lastStar=null,busy=false,open={tr:false,ans:false,cheat:false};
  function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
  function wordOf(k){var a=V[k]||[];return a.length?a[Math.floor(Math.random()*a.length)]:null}
  function vocabCards(){
    var out=[];
    KEYS.filter(function(k){return sel.has(k)&&V[k]}).forEach(function(k){
      var gs=Object.keys(G).filter(function(i){return G[i].k===k});
      shuffle(V[k]).slice(0,5).forEach(function(w){
        var gid=gs.length&&Math.random()<0.7?gs[Math.floor(Math.random()*gs.length)]:null;
        out.push({w:1,k:k,ko:w[0],ru:w[1],gid:gid,q:"이 단어로 문장을 만들어 보세요: "+w[0]});
      });
    });
    return out;
  }
  function pool(){var a=Q.filter(function(x){return G[x.g]&&sel.has(G[x.g].k)});return OPT.w?a.concat(vocabCards()):a}
  function newDeck(){deck=shuffle(pool());pos=0}

  // ---------- разметка ----------
  function shell(){
    var bookBtns='<button type="button" data-all="1">Все</button>'+BOOKS.map(function(b){return '<button type="button" data-book="'+b+'" lang="ko">'+b+'</button>'}).join("");
    var lessons=BOOKS.map(function(b){
      var ks=KEYS.filter(function(k){return bookOf(k)===b});
      return '<div class="gr-row"><span class="gr-bk" lang="ko">'+b+'</span><div class="gr-ls">'+ks.map(function(k){return '<button type="button" data-k="'+k+'" aria-label="'+esc(klab(k))+'">'+numOf(k)+'</button>'}).join("")+'</div></div>';
    }).join("");
    var opt=function(id,t){return '<label class="gr-opt"><input type="checkbox" id="'+id+'"'+(OPT[id.slice(3).toLowerCase()]?" checked":"")+'><span>'+t+'</span></label>'};
    $("gr").innerHTML=
      '<section class="card glass gr-filter">'+
        '<div class="gr-fhead"><h3>'+ic("book",20)+'Уроки</h3><span class="muted" id="grSel"></span></div>'+
        '<div class="opts gr-books">'+bookBtns+'</div>'+
        '<details class="gr-more"><summary>'+ic("sliders",17)+'Отдельные уроки и настройки</summary>'+
          '<div class="gr-lessons">'+lessons+'</div>'+
          '<div class="gr-opts">'+opt("optTr","Сразу показывать перевод вопроса")+opt("optRu","Показывать ситуацию и значение")+opt("optW","Слова урока: карточки и бонус-слово")+'</div>'+
        '</details>'+
      '</section>'+
      '<section class="card glass gr-stage" id="grStage" aria-live="polite">'+
        '<div class="gr-who"><div class="gr-av" id="grAv" aria-hidden="true">'+ic("spark",28)+'</div>'+
          '<div class="gr-nm"><b id="grNm">Звёзды ждут</b><small id="grJob">нажми «Следующий вопрос»</small></div>'+
          '<span class="gr-badge" id="grBadge" hidden></span></div>'+
        '<div class="gr-q ko" lang="ko"><p id="grQ">준비됐어요? 시작해 볼까요?</p>'+
          '<button type="button" class="say" id="grSay" aria-label="Послушать вопрос" hidden>'+ic("volume",18)+'</button></div>'+
        '<div class="gr-gram" id="grGram" hidden></div>'+
        '<div class="gr-box gr-sit" id="grSit" hidden></div>'+
        '<div class="gr-box gr-use" id="grUse" hidden></div>'+
        '<div class="gr-box gr-bonus" id="grBonus" hidden></div>'+
        '<div class="gr-rev" id="grTr" hidden></div>'+
        '<div class="gr-rev gr-ans" id="grAns" hidden></div>'+
        '<div class="gr-rev gr-cheat" id="grCheat" hidden></div>'+
        '<div class="gr-acts">'+
          '<button type="button" class="pri gr-next" id="grNext">'+ic("spark",19)+'Следующий вопрос</button>'+
          '<div class="gr-tog">'+
            '<button type="button" id="bTr" aria-pressed="false" hidden>Перевод</button>'+
            '<button type="button" id="bAns" aria-pressed="false" disabled>Пример ответа</button>'+
            '<button type="button" id="bCheat" aria-pressed="false" disabled>Памятка</button>'+
          '</div></div>'+
        '<div class="gr-cnt muted" id="grCnt"></div>'+
      '</section>'+
      '<details class="card glass gr-ref"><summary><h3>'+ic("cards",20)+'Вся грамматика 1급 – 3B</h3><span class="muted">шпаргалка по урокам</span></summary><div id="grRef"></div></details>'+
      '<p class="hint gr-foot">Звёзды — вымышленные персонажи. Вопросы не повторяются, пока не выпадут все выбранные. Пробел или → — следующий вопрос. Выбор уроков запоминается на этом устройстве.</p>';
  }

  function drawSel(){
    LSset(SKEY,Array.from(sel));
    document.querySelectorAll(".gr-ls button").forEach(function(b){var on=sel.has(b.dataset.k);b.classList.toggle("sel",on);b.setAttribute("aria-pressed",on)});
    document.querySelectorAll(".gr-books button[data-book]").forEach(function(b){
      var ks=KEYS.filter(function(k){return bookOf(k)===b.dataset.book}),on=sel.size<KEYS.length&&ks.every(function(k){return sel.has(k)}),part=!on&&sel.size<KEYS.length&&ks.some(function(k){return sel.has(k)});
      b.classList.toggle("sel",on);b.classList.toggle("part",part);b.setAttribute("aria-pressed",on)});
    var all=document.querySelector(".gr-books button[data-all]"),allOn=sel.size===KEYS.length;
    all.classList.toggle("sel",allOn);all.setAttribute("aria-pressed",allOn);
    var n=Q.filter(function(x){return G[x.g]&&sel.has(G[x.g].k)}).length;
    $("grSel").textContent=sel.size+" "+plural(sel.size,"урок","урока","уроков")+" · "+n+" "+plural(n,"вопрос","вопроса","вопросов");
  }
  function plural(n,a,b,c){var m=n%10,h=n%100;return m===1&&h!==11?a:m>=2&&m<=4&&(h<10||h>=20)?b:c}
  function changed(){drawSel();newDeck();$("grCnt").textContent=""}

  // ---------- карточка ----------
  function pickStar(item){
    var list=STARS.filter(function(s){return item.fr?s.fr:true});
    if(lastStar&&list.length>1)list=list.filter(function(s){return s!==lastStar});
    return list[Math.floor(Math.random()*list.length)];
  }
  function box(id,label,html){var e=$(id);if(html==null){e.hidden=true;return}e.innerHTML='<small>'+label+'</small>'+html;e.hidden=false}
  function setTog(id,key,on){var b=$(id);b.setAttribute("aria-pressed",on);b.classList.toggle("sel",on);open[key]=on}
  function render(item){
    cur=item;
    var isW=!!item.w,g=isW?(item.gid?G[item.gid]:null):G[item.g],st=pickStar(item);lastStar=st;
    var av=$("grAv");av.textContent=st.e;av.style.setProperty("--c",st.c);
    $("grNm").textContent=st.n;$("grJob").textContent=st.job;
    var bd=$("grBadge");bd.innerHTML=isW?ic("abc",14)+"слово · "+esc(klab(item.k)):esc(g.lab);bd.hidden=false;
    $("grQ").textContent=item.q;$("grSay").hidden=!KR.canSay||!KR.canSay();
    var gr=$("grGram");
    if(g){gr.innerHTML='<span lang="ko">['+esc(g.f)+']</span>'+(item.fr?'<small>отвечай в 반말</small>':'');gr.hidden=false}else gr.hidden=true;
    var ru=OPT.ru;
    if(isW){
      box("grSit","Задание","Составь предложение со словом <b lang=\"ko\">"+esc(item.ko)+"</b>"+(g?" и грамматикой <b lang=\"ko\">"+esc(g.f)+"</b>":"")+". Можно про себя.");
      box("grUse","",null);box("grBonus","",null);
      $("grTr").innerHTML="<small>Слово</small>"+esc(item.ko)+(item.ru?" — "+esc(item.ru):"");
      $("bTr").hidden=!item.ru;
      $("grAns").innerHTML="<small>Пример</small>Любое своё предложение"+(item.ru?". Проверь слово: "+esc(item.ko)+" = "+esc(item.ru):" со словом "+esc(item.ko)+".");
    }else{
      box("grSit","상황 · ситуация",item.s&&ru?esc(item.s):null);
      box("grUse","Какое значение",item.use&&ru?esc(item.use):null);
      if(item.bw===undefined)item.bw=Math.random()<0.6?wordOf(g.k):null;
      box("grBonus","Бонус-слово",item.bw&&OPT.w?'Добавь в ответ: <b lang="ko">'+esc(item.bw[0])+'</b>'+(item.bw[1]?' <span class="muted">('+esc(item.bw[1])+')</span>':""):null);
      $("grTr").innerHTML="<small>Перевод вопроса</small>"+esc(item.t||"");
      $("bTr").hidden=!item.t;
      $("grAns").innerHTML='<small>Пример ответа</small><span lang="ko">'+esc(item.a.replace("{job}",st.job))+'</span>';
    }
    $("grCheat").innerHTML=g?'<small>Памятка · <span lang="ko">'+esc(g.f)+'</span></small>'+esc(g.m)+'<div class="ex" lang="ko">'+esc(g.ex)+'</div>':"<small>Слово</small>"+esc(item.ko)+(item.ru?" — "+esc(item.ru):"");
    var trOn=OPT.tr&&!$("bTr").hidden;
    $("grTr").hidden=!trOn;setTog("bTr","tr",trOn);
    $("grAns").hidden=true;setTog("bAns","ans",false);
    $("grCheat").hidden=true;setTog("bCheat","cheat",false);
    $("bAns").disabled=false;$("bCheat").disabled=false;
    $("grCnt").textContent="Вопрос "+pos+" из "+deck.length;
  }
  function next(){
    if(busy)return;
    var note="";
    if(!deck.length||pos>=deck.length){if(deck.length)note="Все вопросы прошли — перемешиваю заново";newDeck()}
    if(!deck.length){$("grQ").textContent="Выбери хотя бы один урок.";return}
    var item=deck[pos++];busy=true;
    var stg=$("grStage");stg.classList.add("rolling");
    if(KR.calm&&KR.calm()){stg.classList.remove("rolling");busy=false;render(item);if(note)$("grCnt").textContent=note;return}
    var n=0,t=setInterval(function(){
      var s=STARS[Math.floor(Math.random()*STARS.length)];
      $("grAv").textContent=s.e;$("grNm").textContent=s.n;$("grQ").textContent=Q[Math.floor(Math.random()*Q.length)].q;
      if(++n>=7){clearInterval(t);stg.classList.remove("rolling");busy=false;render(item);if(note)$("grCnt").textContent=note+" · "+$("grCnt").textContent}
    },85);
  }
  function toggle(btn,boxId,key){if(!cur)return;var on=!open[key];$(boxId).hidden=!on;setTog(btn,key,on)}

  function ref(){
    var h="",bk="",k0="";
    Object.keys(G).sort(function(x,y){return KEYS.indexOf(G[x].k)-KEYS.indexOf(G[y].k)||x-y}).forEach(function(id){
      var g=G[id],b=bookOf(g.k);
      if(b!==bk){bk=b;h+='<h4 class="gr-rb" lang="ko">'+b+'</h4>'}
      if(g.k!==k0){k0=g.k;h+='<div class="gr-rl">'+numOf(g.k)+'단원</div>'}
      h+='<div class="gr-ri"><b lang="ko">'+esc(g.f)+'</b><span>'+esc(g.m)+'</span><span class="ex" lang="ko">'+esc(g.ex)+'</span></div>';
    });
    $("grRef").innerHTML=h;
  }

  // ---------- события ----------
  function bind(){
    $("gr").addEventListener("click",function(e){
      var b=e.target.closest("button");if(!b)return;
      if(b.dataset.all){KEYS.forEach(function(k){sel.add(k)});changed();return}
      if(b.dataset.book){
        var ks=KEYS.filter(function(k){return bookOf(k)===b.dataset.book}),allOn=ks.every(function(k){return sel.has(k)});
        if(sel.size===KEYS.length){sel.clear();ks.forEach(function(k){sel.add(k)})}           // из «Все» — сразу только эта книга
        else if(allOn){if(Array.from(sel).some(function(k){return bookOf(k)!==b.dataset.book}))ks.forEach(function(k){sel.delete(k)})}
        else ks.forEach(function(k){sel.add(k)});
        changed();return}
      if(b.dataset.k){if(sel.has(b.dataset.k)){if(sel.size>1)sel.delete(b.dataset.k)}else sel.add(b.dataset.k);changed();return}
      if(b.id==="grNext")return next();
      if(b.id==="bTr")return toggle("bTr","grTr","tr");
      if(b.id==="bAns")return toggle("bAns","grAns","ans");
      if(b.id==="bCheat")return toggle("bCheat","grCheat","cheat");
      if(b.id==="grSay"&&cur){KR.say(cur.q.replace(/\((전화|사진을 보여 줘요|문이 열렸어요)\)/g,""),"ko")}
    });
    $("gr").addEventListener("change",function(e){
      var id=e.target.id;if(!/^opt/.test(id))return;
      OPT[id.slice(3).toLowerCase()]=e.target.checked;LSset(OKEY,OPT);
      if(id==="optW"){newDeck();drawSel()}
      else if(cur&&!busy){var p=pos;render(cur);pos=p}
    });
    document.addEventListener("keydown",function(e){
      var t=e.target;if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="BUTTON"||t.tagName==="SUMMARY"))return;
      if(e.key===" "||e.key==="ArrowRight"){e.preventDefault();next()}
    });
  }

  function closed(){
    $("gr").innerHTML='<div class="card glass"><h3>'+ic("lock",20)+'Разминка пока закрыта</h3><p class="muted">Её открывает преподаватель. Когда доступ появится, она будет в личном кабинете и в «Доп. упражнениях».</p><a class="btn pri" href="cabinet.html">В кабинет'+ic("arrow",16)+'</a></div>';
  }
  function start(){shell();drawSel();ref();bind();newDeck()}

  if(!KR.require())return;
  KR.theme("ko");KR.topbar("practice");
  if(KR.can(MID))start();else $("gr").innerHTML='<p class="muted">Загрузка…</p>';
  KR.load().then(function(){
    KR.topbar("practice");
    if(!KR.can(MID)){closed();return}
    if(!$("grStage"))start();
  });
})();
