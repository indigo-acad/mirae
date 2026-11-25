/* MIRAÉ · группы учеников (groups.html, база — supabase/groups.sql).
   Группа — список учеников. Всё, что преподаватель делает с группой, раскладывается на каждого ученика
   прежними функциями: назначения (teacher_assign), словари (teacher_set_assign), слова урока (teacher_vocab_add),
   домашка «Догнать урок» (teacher_hw_save). Поэтому у ученика всё лежит там же, где и при занятиях один на один,
   а в группе хранятся состав, программа, словари группы и журнал занятий с посещаемостью.

   Алгоритм:
   · новый ученик в группе сразу получает открытые уроки программы и словари группы (прошлую домашку — нет);
   · урок, добавленный в программу, открывается всем сразу или — в режиме «по занятиям» — когда до него дойдёт группа;
   · «Пройден на занятии»: отметка присутствия (был / опоздал / не был), слова урока — всем как новые,
     пропустившим — домашка «Догнать урок», следующий урок программы открывается всем. */
(function(){
var $=function(s){return document.querySelector(s)};
var esc=KR.esc||function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var MAP={};(window.MATERIALS||[]).forEach(function(m){MAP[m.id]=m});
var LANG={ko:'корейский',en:'английский'};
var S={hw:[],hwb:'',review:false,list:null,students:[],cur:null,edit:null,sessions:[],sets:null,sess:null,gw:{id:null,words:null},busy:false,addm:''};

function plural(n,f1,f2,f5){return n%10===1&&n%100!==11?f1:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?f2:f5}
function today(){var d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)}
function fmtDay(s){if(!s)return '';var d=new Date(s+'T12:00:00');return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}
function missing(e){return e&&(e.status===404||/Could not find the function|does not exist/.test(e.message||''))}
function msg(t,ok){var e=$('#gmsg');if(!e)return;e.textContent=t;e.className='msg '+(ok?'ok':'bad');if(e.scrollIntoView)e.scrollIntoView({block:'nearest',behavior:'smooth'})}
function grp(){return (S.list||[]).filter(function(g){return g.id===S.cur})[0]||null}
function plan(g){var p=g&&g.plan||{};return {items:Array.isArray(p.items)?p.items:[],sets:Array.isArray(p.sets)?p.sets:[],step:p.step!==false}}
function members(g){return (g&&g.members||[]).map(function(m){return m.name})}
function title(id){var m=MAP[id];if(m)return m.title;var l=lid(id),L=l&&window.LESSONS[l];return L?L.course+' · '+L.title:id}
// урок сайта (lesson.html) за материалом каталога: lesson-l12-jiyo → l12-jiyo
function lid(id){var l=String(id||'').replace(/^lesson-/,'');return id&&id.indexOf('lesson-')===0&&window.LESSONS&&window.LESSONS[l]?l:null}
function langOf(id){try{return KR.langOf(id)}catch(e){return ''}}
function progMats(g){var lang=g&&g.lang;return (window.MATERIALS||[]).filter(function(m){return m.kind!=='practice'&&(!lang||langOf(m.id)===lang)})}

// ---------- загрузка ----------
async function boot(){
  if(!KR.require())return;KR.topbar('teacher');
  var ctx=await KR.load();KR.topbar('teacher');
  if(!ctx.ok){$('#m').innerHTML='<div class="card"><p>Нет связи с сервером. Группы работают только онлайн.</p></div>';return}
  if(!ctx.teacher){$('#m').innerHTML='<div class="card"><h3>Только для преподавателя</h3><p class="muted">Этот раздел открыт для аккаунта преподавателя.</p></div>';return}
  try{S.students=(await KR.api('teacher_students')||[]).filter(function(s){return s.name!==KR.user()})}catch(e){S.students=[]}
  try{S.list=await KR.api('teacher_groups')||[]}catch(e){S.list=missing(e)?null:[]}
  try{S.sets=await KR.api('teacher_sets')||[]}catch(e){S.sets=null}
  if(KR.lib)await KR.lib.loadAll();   // уроки из библиотеки: названия в домашке и результатах группы
  var h=(location.hash||'').match(/^#g(\d+)$/);if(h&&S.list&&S.list.some(function(g){return g.id===+h[1]}))S.cur=+h[1];
  else if(S.list&&S.list.length===1)S.cur=S.list[0].id;
  if(S.cur)await loadSessions();
  draw();
}
async function reload(){try{S.list=await KR.api('teacher_groups')||[]}catch(e){}if(S.cur)await loadSessions();draw()}
async function loadSessions(){try{S.sessions=await KR.api('teacher_group_sessions',{p_id:S.cur})||[]}catch(e){S.sessions=[]}S.sess=null;
  try{S.hw=await KR.api('teacher_group_hw',{p_group:S.cur})||[]}catch(e){S.hw=missing(e)?null:[]}}

// ---------- раскладка на учеников ----------
// открыть материалы ученикам: только тем, у кого их ещё нет (иначе затрутся срок и комментарий из личного назначения)
async function openFor(ids,who,g){
  var n=0,err=0;
  for(var i=0;i<who.length;i++){
    var have={};try{(await KR.api('teacher_assignments',{p_student:who[i]})||[]).forEach(function(a){have[a.id]=1})}catch(e){}
    for(var j=0;j<ids.length;j++){if(have[ids[j]])continue;
      try{await KR.api('teacher_assign',{p_student:who[i],p_material:ids[j],p_due:null,p_note:'Группа '+g.name});n++}catch(e){err++}}
  }
  return {n:n,err:err};
}
// словари группы: весь словарь или отмеченные слова
async function setsFor(sets,who){
  var n=0,err=0;
  for(var i=0;i<who.length;i++)for(var j=0;j<sets.length;j++){var s=sets[j],p={p_student:who[i],p_id:s.s,p_due:null,p_note:''};if(s.w)p.p_words=s.w;
    try{var r=await KR.api(s.w?'teacher_set_assign_words':'teacher_set_assign',p);n+=(r&&r.added)||0}catch(e){err++}}
  return {n:n,err:err};
}
// слова урока — в словарь учеников (придут как новые, у кого слово уже было — вернётся раньше)
async function wordsFor(l,who){
  var L=window.LESSONS[l];if(!L)return {n:0,err:0};
  var lang=L.lang||'ko',now=Date.now(),ws=KR.lessonWords(L).slice(0,300).map(function(x,i){return SRS.make(lang,x.w,x.t,{src:'teacher'},now+i)});
  if(!ws.length)return {n:0,err:0};
  var n=0,err=0;
  for(var i=0;i<who.length;i++){try{var r=await KR.api('teacher_vocab_add',{p_student:who[i],p_words:ws});n+=(r&&r.added)||0}catch(e){err++}}
  return {n:n,err:err,w:ws.length};
}
// «Догнать урок»: задания урока с занятия (отработка или ступень «на занятии») и ссылка на теорию
function catchUpHw(id,day,g){
  var l=lid(id),items=[],theory=[];
  if(l){var L=window.LESSONS[l],b=[];
    L.sections.forEach(function(s){var pt=KR.part(s);if(pt==='hw')return;
      if(L.stages){s.blocks.forEach(function(x,i){if(x.at==='class')b.push(s.id+'-'+i)});if(s.blocks.some(function(x){return !x.at}))theory.push({l:l,s:s.id});return}
      if(pt==='practice')s.blocks.forEach(function(x,i){b.push(s.id+'-'+i)});else theory.push({l:l,s:s.id})});
    if(b.length)items.push({l:l,b:b.slice(0,40)});
  }
  if(!items.length&&MAP[id])items.push({m:id});
  if(!items.length)return null;
  return {title:('Догнать урок: '+title(id)).slice(0,200),lang:g.lang||langOf(id)||'',items:items,theory:theory.slice(0,10),due:null,
    note:'Тебя не было на занятии группы '+g.name+' ('+fmtDay(day)+'). Пройди теорию урока и сделай задания с занятия.'};
}

// ---------- отрисовка ----------
function draw(){
  var h='';
  if(S.list===null){$('#m').innerHTML='<div class="card"><h3>Группы</h3><p class="muted">Чтобы работать с группами, выполните в Supabase файл supabase/groups.sql (SQL Editor → New query → вставить → Run) и обновите эту страницу.</p></div>';return}
  h+='<div class="card"><h3>Группы</h3>'+(S.list.length?'':'<p class="muted">Групп пока нет. Создайте первую: название, язык и ученики.</p>')+
    '<div class="opts">'+S.list.map(function(g){return '<button data-g="'+g.id+'" class="'+(S.cur===g.id&&!S.edit?'sel':'')+'">'+esc(g.name)+' <span class="badge">'+(g.members||[]).length+'</span>'+(KR.ctx.owner&&g.teacher!==KR.user()?'<span class="badge">'+esc(g.teacher)+'</span>':'')+'</button>'}).join('')+
    '<button data-gnew="1" class="'+(S.edit&&!S.edit.id?'sel':'')+'">'+KR.icon('plus',15)+' Новая группа</button></div></div>';
  if(S.edit)h+=editCard();
  else if(grp())h+=groupView(grp());
  h+='<p id="gmsg" class="msg" role="status" aria-live="polite"></p>';
  $('#m').innerHTML=h;
  if(!S.edit&&grp())KR.W2&&KR.W2.pickFix&&KR.W2.pickFix();
}
function editCard(){
  var e=S.edit;
  return '<div class="card"><h3>'+(e.id?'Группа «'+esc(e.name)+'»':'Новая группа')+'</h3>'+
    '<div class="frow"><input id="gname" class="name" maxlength="80" placeholder="Название, например 2724" value="'+esc(e.name)+'" aria-label="Название группы">'+
    '<select id="glang" aria-label="Язык"><option value="ko"'+(e.lang==='ko'?' selected':'')+'>Корейский</option><option value="en"'+(e.lang==='en'?' selected':'')+'>Английский</option></select></div>'+
    '<p style="margin:12px 0 4px"><b>Ученики</b> <span class="muted">· новый ученик сразу получит открытые уроки программы и словари группы</span></p>'+
    (S.students.length?S.students.map(function(s){return '<label class="line hwt-pick"><input type="checkbox" data-gm="'+esc(s.name)+'"'+(e.members[s.name]?' checked':'')+'><span class="cap">'+esc(s.name)+'</span></label>'}).join(''):'<p class="muted">Учеников пока нет: добавьте их в разделе «Ученики».</p>')+
    '<div class="done-row">'+(e.id?'<button data-gdel="'+e.id+'">'+KR.icon('trash',15)+' Удалить группу</button>':'<span></span>')+
    '<span style="display:inline-flex;gap:8px"><button data-gcancel="1">Отмена</button><button class="pri" id="gsave">Сохранить</button></span></div></div>';
}
function groupView(g){
  var p=plan(g),mem=members(g);
  var h='<div class="card"><div class="done-row" style="margin-top:0"><div><h3 style="margin:0">'+esc(g.name)+'</h3><div class="muted">'+(LANG[g.lang]||'')+' · '+mem.length+' '+plural(mem.length,'ученик','ученика','учеников')+' · занятий: '+(g.sessions||0)+(g.last?' · последнее '+fmtDay(g.last):'')+'</div></div>'+
    '<button data-gedit="1">'+KR.icon('pencil',15)+' Состав и название</button></div>'+
    (mem.length?attendance(g):'<p class="muted">В группе пока нет учеников: «Состав и название».</p>')+'</div>';
  h+=sessionCard(g)+hwCard(g)+programCard(g,p)+setsCard(g,p)+journal(g);
  return h;
}
// посещаемость: ученики по строкам, последние занятия по столбцам
function attendance(g){
  var ss=S.sessions.slice(0,8).reverse(),mem=members(g);
  if(!ss.length)return '<p class="muted" style="margin:10px 0 0">Посещаемость появится после первого занятия: «Пройден на занятии» ниже.</p>';
  var mark=function(s,n){return s.present.indexOf(n)>=0?'<span title="был" style="color:var(--ok)">✓</span>':s.late.indexOf(n)>=0?'<span title="опоздал">⏱</span>':s.absent.indexOf(n)>=0?'<span title="не был" style="color:var(--bad)">✗</span>':'<span class="muted" title="не в группе">·</span>'};
  return '<div style="overflow:auto;margin-top:12px"><table class="gatt"><tr><th>Ученик</th>'+ss.map(function(s){return '<th title="'+esc(title(s.lesson)||s.title)+'">'+fmtDay(s.day)+'</th>'}).join('')+'<th>Был</th></tr>'+
    mem.map(function(n){var all=S.sessions.filter(function(s){return s.present.indexOf(n)>=0||s.late.indexOf(n)>=0||s.absent.indexOf(n)>=0}),was=all.filter(function(s){return s.absent.indexOf(n)<0}).length;
      return '<tr><td class="cap">'+esc(n)+'</td>'+ss.map(function(s){return '<td style="text-align:center">'+mark(s,n)+'</td>'}).join('')+'<td>'+was+' из '+all.length+'</td></tr>'}).join('')+'</table></div>';
}
// уроки, которые группа уже прошла на занятии
function held(){var r={};S.sessions.forEach(function(s){if(s.lesson&&!r[s.lesson])r[s.lesson]=s.day});return r}
function nextLesson(g){var p=plan(g),hd=held(),it=p.items.filter(function(x){return !hd[x.m]&&x.open})[0]||p.items.filter(function(x){return !hd[x.m]})[0];return it?it.m:''}
function sessionCard(g){
  var mem=members(g);if(!mem.length)return '';
  if(!S.sess)S.sess={day:today(),lesson:nextLesson(g),st:{},words:true,catchup:true,next:plan(g).step,note:''};
  var x=S.sess,p=plan(g),opts=p.items.map(function(i){return i.m});
  if(x.lesson&&opts.indexOf(x.lesson)<0)opts.push(x.lesson);
  var L=lid(x.lesson)&&window.LESSONS[lid(x.lesson)],nw=L?KR.lessonWords(L).length:0;
  var ST=[['p','Был'],['l','Опоздал'],['a','Не был']];
  return '<details class="card gsess"'+(x.open?' open':'')+' id="gsess"><summary><h3 style="display:inline">'+KR.icon('check',18)+' Пройден на занятии</h3> <span class="muted">· отметить занятие и присутствие</span></summary>'+
    '<div class="frow" style="margin-top:10px"><input id="sday" type="date" class="name" value="'+esc(x.day)+'" aria-label="Дата занятия">'+
    '<select id="sles" aria-label="Урок"><option value="">Без урока из программы</option>'+opts.map(function(id){return '<option value="'+esc(id)+'"'+(id===x.lesson?' selected':'')+'>'+esc(title(id))+(held()[id]?' · уже было '+fmtDay(held()[id]):'')+'</option>'}).join('')+'</select></div>'+
    '<p style="margin:12px 0 4px"><b>Кто был</b></p>'+
    mem.map(function(n){var v=x.st[n]||'p';return '<div class="line" style="align-items:center;justify-content:space-between;gap:10px"><span class="cap">'+esc(n)+'</span><div class="seg am" role="group" aria-label="'+esc(n)+'" style="max-width:300px;flex:1">'+
      ST.map(function(s){return '<button type="button" data-sst="'+esc(n)+'" data-v="'+s[0]+'" class="'+(v===s[0]?'on':'')+'" aria-pressed="'+(v===s[0])+'">'+s[1]+'</button>'}).join('')+'</div></div>'}).join('')+
    (L&&nw?'<label class="line hwt-pick"><input type="checkbox" id="swords"'+(x.words?' checked':'')+'><span>Слова урока ('+nw+') — в словарь всем ученикам группы <span class="muted">(придут как новые)</span></span></label>':'')+
    (x.lesson?'<label class="line hwt-pick"><input type="checkbox" id="scatch"'+(x.catchup?' checked':'')+'><span>Кого не было — домашка «Догнать урок» <span class="muted">(теория и задания с занятия)</span></span></label>':'')+
    (p.items.length?'<label class="line hwt-pick"><input type="checkbox" id="snext"'+(x.next?' checked':'')+'><span>Открыть всем следующий урок программы</span></label>':'')+
    '<input id="snote" class="name" maxlength="1000" placeholder="Заметка о занятии (по желанию, видна только вам)" value="'+esc(x.note)+'">'+
    '<div class="done-row"><span class="muted">'+sessSummary(mem)+'</span><button class="pri" id="sgo">Записать занятие</button></div></details>';
}
function sessSummary(mem){var x=S.sess,c={p:0,l:0,a:0};mem.forEach(function(n){c[x.st[n]||'p']++});return 'был: '+c.p+(c.l?' · опоздал: '+c.l:'')+' · не был: '+c.a}
function programCard(g,p){
  var hd=held(),have={};p.items.forEach(function(i){have[i.m]=1});
  var avail=progMats(g).filter(function(m){return !have[m.id]});
  var h='<div class="card"><h3>Программа группы</h3><p class="muted" style="margin-top:0">Уроки и материалы по порядку. Открытый урок назначен всем ученикам группы.</p>'+
    '<label class="line hwt-pick"><input type="checkbox" id="pstep"'+(p.step?' checked':'')+'><span>Открывать уроки по мере занятий <span class="muted">(новый урок откроется, когда группа до него дойдёт)</span></span></label>';
  h+=p.items.length?p.items.map(function(i,k){var st=hd[i.m]?'<span class="badge ok">на занятии '+fmtDay(hd[i.m])+'</span>':i.open?'<span class="badge">открыт</span>':'<span class="badge warn">закрыт</span>';
    return '<div class="line" style="align-items:center;justify-content:space-between;gap:8px"><div style="min-width:0"><span class="muted">'+(k+1)+'.</span> '+esc(title(i.m))+' '+st+'</div>'+
      '<span style="display:inline-flex;gap:6px;flex-wrap:wrap">'+(i.open?'':'<button data-popen="'+k+'">Открыть всем</button>')+
      (k?'<button data-pup="'+k+'" aria-label="Выше">↑</button>':'')+'<button data-prm="'+k+'" aria-label="Убрать из программы">'+KR.icon('trash',14)+'</button></span></div>'}).join(''):'<p class="muted">В программе пока ничего нет.</p>';
  h+='<div class="frow" style="margin-top:10px"><select id="padd" aria-label="Добавить в программу"><option value="">Добавить урок или материал…</option>'+avail.map(function(m){return '<option value="'+esc(m.id)+'"'+(m.id===S.addm?' selected':'')+'>'+esc(m.title)+'</option>'}).join('')+'</select><button id="paddgo">Добавить</button></div>';
  return h+'</div>';
}
function setsCard(g,p){
  if(S.sets===null)return '';
  var mine=S.sets.filter(function(s){return !g.lang||s.lang===g.lang}),SM={};S.sets.forEach(function(s){SM[s.id]=s});
  var h='<div class="card"><h3>Словари группы</h3><p class="muted" style="margin-top:0">Слова словаря попадут в словарь каждого ученика группы, и новых учеников тоже.</p>';
  h+=p.sets.length?p.sets.map(function(s,k){var x=SM[s.s];return '<div class="line" style="align-items:center;justify-content:space-between"><span>'+esc(x?x.title:'словарь '+s.s)+' <span class="muted">· '+(s.w?s.w.length+' '+plural(s.w.length,'слово','слова','слов'):'весь, слов: '+(x?x.words:'?'))+'</span></span><button data-srm="'+k+'" aria-label="Убрать из группы">'+KR.icon('trash',14)+'</button></div>'}).join(''):'';
  if(!mine.length)return h+'<p class="muted">Словарей '+(g.lang?'этого языка ':'')+'пока нет. Создайте словарь на странице <a href="dict.html">«Словари»</a>.</p></div>';
  return h+'<div class="frow" style="margin-top:8px"><select id="gws" aria-label="Словарь">'+mine.map(function(s){return '<option value="'+s.id+'">'+esc(s.title)+' · слов: '+s.words+'</option>'}).join('')+'</select></div>'+
    '<details class="rep wpd" id="gwpk"><summary>Какие слова: <b id="gwwhat">все</b></summary><div id="gwbox"></div></details>'+
    '<div class="done-row"><span></span><button class="pri" id="gwgo">Назначить группе</button></div></div>';
}
function journal(g){
  if(!S.sessions.length)return '';
  return '<div class="card"><h3>Журнал занятий</h3>'+S.sessions.map(function(s){var ab=s.absent,la=s.late;
    return '<div class="line" style="align-items:center;justify-content:space-between;gap:8px"><div style="min-width:0"><b>'+fmtDay(s.day)+'</b> · '+esc(s.lesson?title(s.lesson):(s.title||'без урока'))+
      '<div class="muted">был: '+(s.present.length+la.length)+(la.length?' (опоздал: '+esc(la.join(', '))+')':'')+(ab.length?' · не был: '+esc(ab.join(', ')):'')+(s.note?' · '+esc(s.note):'')+'</div></div>'+
      '<button data-sdel="'+s.id+'" aria-label="Удалить запись">'+KR.icon('trash',14)+'</button></div>'}).join('')+'</div>';
}

// ---------- домашка группы: сводная таблица и общие ошибки ----------
// выдачи (batch) по порядку, новые первыми; в каждой — домашка каждого ученика
function batches(){var r=[],by={};(S.hw||[]).forEach(function(h){if(!h.batch)return;if(!by[h.batch]){by[h.batch]={id:h.batch,title:h.title,due:h.due,created:h.created,rows:{}};r.push(by[h.batch])}by[h.batch].rows[h.student]=h});return r}
function pct(h){var x=h.result||{};return x.max?Math.round(x.score/x.max*100)+'%':x.total?Math.round((x.done||0)/x.total*100)+'%':''}
function hwCell(h){
  if(!h)return '<span class="muted">—</span>';
  if(h.status==='active')return h.due&&h.due<today()?'<span class="badge warn" style="background:#fbe6e2;color:#8a2b1d">просрочено</span>':'<span class="badge">задано</span>';
  return '<span class="badge '+(h.status==='checked'?'ok':'warn')+'">'+(h.status==='checked'?'✓ ':'сдано ')+pct(h)+'</span>';
}
// общие ошибки выдачи: одинаковый вопрос и верный ответ у разных учеников
function commonErrors(bt){
  var by={},sub=0;
  Object.keys(bt.rows).forEach(function(n){var h=bt.rows[n];if(h.status==='active')return;sub++;
    ((h.result||{}).items||[]).forEach(function(x){(x.wrong||[]).forEach(function(w){var k=(x.t||'')+'|'+w.q+'|'+w.a;
      var e=by[k]=by[k]||{t:x.t||'',q:w.q,a:w.a,who:[],g:[]};if(e.who.indexOf(n)<0){e.who.push(n);e.g.push(w.g)}})})});
  return {sub:sub,list:Object.keys(by).map(function(k){return by[k]}).sort(function(a,b){return b.who.length-a.who.length})};
}
function hwCard(g){
  if(S.hw===null)return '<div class="card"><h3>Домашка группе</h3><p class="muted">Чтобы задавать домашку всей группе, выполните в Supabase файл supabase/groups.sql ещё раз (в нём появилась домашка группе) и обновите страницу.</p></div>';
  var mem=members(g);if(!mem.length)return '';
  var link=function(o){return 'teacher.html?st='+encodeURIComponent(mem[0])+'&grp='+g.id+'&open='+o};
  var h='<div class="card" id="ghw"><h3>Домашка группе</h3><p class="muted" style="margin-top:0">Тот же конструктор, что и для одного ученика: упражнения целиком или отдельные задания, тренажёры, теория. Тест по словам можно собрать каждому из его собственных слов.</p>'+
    '<div class="opts"><a class="btn pri" href="'+link('hw')+'">'+KR.icon('plus',15)+' Задать домашку группе</a><a class="btn" href="'+link('tg')+'">'+KR.icon('pencil',15)+' Тест по словам группе</a></div>';
  var bs=batches();
  if(!bs.length)return h+'<p class="muted" style="margin:12px 0 0">Домашки группе ещё не было. Здесь появится таблица: кто сдал, с каким результатом, и общие ошибки.</p></div>';
  var cols=bs.slice(0,6);
  h+='<div style="overflow:auto;margin-top:12px"><table class="gatt"><tr><th>Ученик</th>'+cols.map(function(b){return '<th title="'+esc(b.title)+'">'+esc(b.title.length>22?b.title.slice(0,21)+'…':b.title)+(b.due?'<br><span style="font-weight:400">до '+fmtDay(b.due)+'</span>':'')+'</th>'}).join('')+'</tr>'+
    mem.map(function(n){return '<tr><td class="cap">'+esc(n)+'</td>'+cols.map(function(b){return '<td>'+hwCell(b.rows[n])+'</td>'}).join('')+'</tr>'}).join('')+'</table></div>';
  if(!S.hwb||!bs.some(function(b){return b.id===S.hwb})){var w=bs.filter(function(b){return Object.keys(b.rows).some(function(n){return b.rows[n].status!=='active'})})[0];S.hwb=(w||bs[0]).id}
  var bt=bs.filter(function(b){return b.id===S.hwb})[0],ce=commonErrors(bt),tot=Object.keys(bt.rows).length,act=Object.keys(bt.rows).filter(function(n){return bt.rows[n].status==='active'}).length;
  h+='<p style="margin:16px 0 4px"><b>Ошибки</b></p><select id="ghwb" aria-label="Выдача">'+bs.map(function(b){return '<option value="'+b.id+'"'+(b.id===S.hwb?' selected':'')+'>'+esc(b.title)+' · '+fmtDay(new Date(b.created).toISOString().slice(0,10))+'</option>'}).join('')+'</select>'+
    '<p class="muted" style="margin:6px 0">Сдали '+ce.sub+' из '+tot+(act?' · ещё не сдали: '+esc(Object.keys(bt.rows).filter(function(n){return bt.rows[n].status==='active'}).join(', ')):'')+'</p>';
  if(!ce.sub)h+='<p class="muted">Пока никто не сдал: ошибки появятся после сдачи.</p>';
  else if(!ce.list.length)h+='<p class="muted">Ошибок нет.</p>';
  else{
    var com=ce.list.filter(function(e){return e.who.length>=2}),rest=ce.list.filter(function(e){return e.who.length<2});
    var row=function(e){return '<div class="ko" style="font-size:15px;padding:4px 0 4px 10px;margin:4px 0;border-left:3px solid '+(e.who.length>=2?'var(--bad)':'var(--gold)')+'"><b>'+e.who.length+' из '+ce.sub+'</b> · '+esc(e.q)+' → <b>'+esc(e.a)+'</b><br><span class="muted">'+esc(e.t)+' · '+e.who.map(function(n,i){return esc(n)+': «'+esc(e.g[i]===''?'пусто':e.g[i])+'»'}).join(', ')+'</span></div>'};
    h+=(com.length?'<p class="muted" style="margin:8px 0 2px">Общие — у двоих и больше:</p>'+com.map(row).join(''):'<p class="muted">Общих ошибок нет: у каждого свои.</p>')+
      (rest.length?'<details class="rep"><summary>Остальные ошибки · '+rest.length+'</summary>'+rest.map(row).join('')+'</details>':'');
    if(S.review&&com.length)h+='<div class="gt-box" style="margin-top:12px"><h3>Разбор на уроке</h3><p class="muted">Покажите экран группе: вопрос, ответы обсуждаете вместе, потом открываете верный.</p>'+
      com.map(function(e,i){return '<details class="rep"><summary class="ko" style="font-size:18px">'+(i+1)+'. '+esc(e.q)+'</summary><p class="ko" style="font-size:18px;margin:6px 14px"><b>'+esc(e.a)+'</b></p></details>'}).join('')+'</div>';
    h+='<div class="done-row">'+(com.length?'<button data-grev="1">'+KR.icon('users',15)+' '+(S.review?'Скрыть разбор':'Разобрать на уроке')+'</button>':'<span></span>')+'<button class="pri" data-gfix="1">Работа над ошибками</button></div>'+
      '<p class="muted" style="margin:6px 0 0">«Работа над ошибками» — каждому домашкой только те задания, в которых ошибся он сам.</p>';
  }
  if(act)h+='<div class="done-row"><span class="muted">Ещё не сдали: '+act+'</span><button data-gunhw="1">Убрать у тех, кто не сдал</button></div>';
  return h+'</div>';
}
// работа над ошибками: из сданной домашки — только задания с ошибками (вопросы упражнений, слова теста)
function itText(it){return String(it.q||it.p||it.l||it.say||'').slice(0,200)}
function fixHw(h){
  var by={},wts=[];
  ((h.result||{}).items||[]).forEach(function(x){var wr=x.wrong||[];if(!wr.length)return;
    if(x.l&&x.b&&window.LESSONS[x.l]){var L=window.LESSONS[x.l],j=x.b.lastIndexOf('-'),sec=L.sections.filter(function(q){return q.id===x.b.slice(0,j)})[0],bl=sec&&sec.blocks[+x.b.slice(j+1)];
      if(!bl||!Array.isArray(bl.items))return;var ix=[];bl.items.forEach(function(it,i){if(wr.some(function(w){return w.q===itText(it)})&&ix.indexOf(i)<0)ix.push(i)});
      if(ix.length){by[x.l]=by[x.l]||{};by[x.l][x.b]=ix.length<bl.items.length?ix:null}}
    else if(x.type==='wtest'){(h.items||[]).forEach(function(it){if(!it.wt)return;var ws=(it.wt.w||[]).filter(function(w){return wr.some(function(r){return r.a===w.w||r.a===w.t||String(r.q).indexOf(w.w)>=0})});
      if(ws.length>=2)wts.push(Object.assign({},it.wt,{title:'Ошибки: '+(it.wt.title||'слова'),w:ws.slice(0,40)}))})}});
  var items=[];
  Object.keys(by).forEach(function(l){var it={l:l,b:Object.keys(by[l]).slice(0,40)},i={};it.b.forEach(function(k){if(by[l][k])i[k]=by[l][k]});if(Object.keys(i).length)it.i=i;items.push(it)});
  wts.slice(0,2).forEach(function(wt){items.push({wt:wt})});
  if(!items.length)return null;
  return {title:('Работа над ошибками: '+h.title).slice(0,200),lang:h.lang||'',items:items,theory:(h.theory||[]).slice(0,10),due:null,note:'Здесь только задания, в которых были ошибки. Загляни в теорию, если не помнишь правило.'};
}

// ---------- сохранение ----------
async function savePlan(g,p){var r=await KR.api('teacher_group_save',{p_group:{id:g.id,name:g.name,lang:g.lang,plan:p}});g.plan=r.plan;return r}

async function saveGroup(b){
  var e=S.edit,name=($('#gname').value||'').trim();if(!name){msg('Впишите название группы');return}
  var lang=$('#glang').value,mem=Object.keys(e.members).filter(function(k){return e.members[k]});
  b.disabled=true;
  try{
    var old=e.id?grp():null,gp=old?plan(old):{items:[],sets:[],step:true};
    var r=await KR.api('teacher_group_save',{p_group:{id:e.id||null,name:name,lang:lang,plan:gp,members:mem}});
    S.edit=null;S.cur=r.id;location.hash='g'+r.id;
    var t='Группа сохранена: '+name,added=r.added||[];
    if(added.length&&(gp.items.some(function(i){return i.open})||gp.sets.length)){
      msg('Открываю новым ученикам уроки и словари группы…',true);
      var o=await openFor(gp.items.filter(function(i){return i.open}).map(function(i){return i.m}),added,r),w=await setsFor(gp.sets,added);
      t+='. Новым ученикам ('+added.join(', ')+'): открыто уроков и материалов '+o.n+', новых слов '+w.n+(o.err+w.err?' · не получилось: '+(o.err+w.err):'');
    }
    await reload();msg(t,true);
  }catch(x){b.disabled=false;msg(/no_student/.test(x.message||'')?'Одного из учеников ведёт другой преподаватель':missing(x)?'Выполните в Supabase файл supabase/groups.sql':'Не получилось сохранить группу')}
}

async function saveSession(b){
  var g=grp(),x=S.sess,mem=members(g);readSess();
  var pr=[],la=[],ab=[];mem.forEach(function(n){var v=x.st[n]||'p';(v==='l'?la:v==='a'?ab:pr).push(n)});
  if(!x.day){msg('Укажите дату занятия');return}
  b.disabled=true;var out=[];
  try{
    await KR.api('teacher_group_session_save',{p_group:g.id,p_s:{day:x.day,lesson:x.lesson,title:x.lesson?title(x.lesson):'',present:pr,late:la,absent:ab,note:x.note}});
    out.push('Занятие '+fmtDay(x.day)+' записано');
    var p=plan(g),l=lid(x.lesson);
    // урок занятия должен быть открыт всем: и тем, кто был, и тем, кому догонять
    if(x.lesson){var k=-1;p.items.forEach(function(i,j){if(i.m===x.lesson)k=j});
      if(k<0||!p.items[k].open){var o=await openFor([x.lesson],mem,g);if(k>=0)p.items[k].open=true;if(o.n)out.push('урок открыт: '+o.n)}}
    if(l&&x.words){msg('Добавляю слова урока…',true);var w=await wordsFor(l,mem);if(w.w)out.push('слова урока ('+w.w+') — в словарь '+(mem.length-w.err)+' '+plural(mem.length-w.err,'ученику','ученикам','ученикам')+(w.err?' (не получилось у '+w.err+')':''))}
    if(x.lesson&&x.catchup&&ab.length){var hw=catchUpHw(x.lesson,x.day,g),ok=0;
      if(hw)for(var i=0;i<ab.length;i++){try{await KR.api('teacher_hw_save',{p_student:ab[i],p_hw:hw});ok++}catch(e){}}
      out.push(hw?'«Догнать урок»: '+ok+' из '+ab.length:'«Догнать урок» не задан: в уроке нет заданий')}
    if(x.next&&p.items.length){var hd=held();hd[x.lesson]=x.day;var at=-1;p.items.forEach(function(i,j){if(i.m===x.lesson)at=j});
      var nx=p.items.filter(function(i,j){return j>at&&!i.open&&!hd[i.m]})[0];
      if(nx){var o2=await openFor([nx.m],mem,g);nx.open=true;out.push('следующий урок открыт: '+title(nx.m)+(o2.err?' (не получилось у '+o2.err+')':''))}}
    await savePlan(g,p);
    await reload();msg(out.join(' · '),true);
  }catch(e){b.disabled=false;msg(missing(e)?'Выполните в Supabase файл supabase/groups.sql':/no_student/.test(e.message||'')?'Одного из учеников ведёт другой преподаватель':'Не получилось записать занятие')}
}
function readSess(){var x=S.sess;if(!x)return;var v=function(id){return $(id)};
  if(v('#sday'))x.day=v('#sday').value;if(v('#sles'))x.lesson=v('#sles').value;if(v('#snote'))x.note=v('#snote').value;
  if(v('#swords'))x.words=v('#swords').checked;if(v('#scatch'))x.catchup=v('#scatch').checked;if(v('#snext'))x.next=v('#snext').checked;
  var d=v('#gsess');x.open=!!(d&&d.open)}

// ---------- словарь группы: выбор слов ----------
function gwSet(){var e=$('#gws');return e&&S.sets?S.sets.filter(function(x){return x.id===+e.value})[0]:null}
function gwSync(){var e=$('#gwwhat'),s=gwSet();if(!e||!s)return;var mine=S.gw.words&&S.gw.id===s.id,all=mine?S.gw.words.length:s.words,n=mine?KR.W2.picked('gw').length:all;e.textContent=n===all?'все '+all:n?n+' из '+all:'ни одного'}
async function gwLoad(){
  var s=gwSet(),box=$('#gwbox');if(!s||!box||!KR.W2)return;
  if(S.gw.id!==s.id||!S.gw.words){S.gw={id:s.id,words:null};KR.W2.pickReset('gw');box.innerHTML='<p class="muted" style="margin:0 14px 12px">Загрузка…</p>';
    try{S.gw.words=await KR.api('teacher_set_words',{p_id:s.id})||[]}catch(x){S.gw={id:null,words:null};box.innerHTML='<p class="muted" style="margin:0 14px 12px">Не получилось загрузить слова.</p>';return}}
  box.innerHTML=S.gw.words.length?KR.W2.picker('gw',S.gw.words.map(function(w){return {k:String(w.id),word:w.word+(w.sense?' «'+w.sense+'»':''),lang:w.lang,tr:(w.tr_ru||[]).join('; ')}}),{max:320}):'<p class="muted" style="margin:0 14px 12px">В словаре нет слов.</p>';
  KR.W2.pickFix();gwSync();
}
if(KR.W2){var prevPick=KR.W2.onpick;KR.W2.onpick=function(n){if(n==='gw')gwSync();else if(prevPick)prevPick(n)}}

// ---------- события ----------
document.addEventListener('toggle',function(e){if(e.target.id==='gwpk'&&e.target.open)gwLoad();if(e.target.id==='gsess'&&S.sess)S.sess.open=e.target.open},true);
document.addEventListener('change',async function(e){
  var t=e.target;
  if(t.dataset.gm&&S.edit){S.edit.members[t.dataset.gm]=t.checked;return}
  if(t.id==='gws'){var d=$('#gwpk');if(d&&d.open)gwLoad();else gwSync();return}
  if(t.id==='padd'){S.addm=t.value;return}
  if(t.id==='ghwb'){S.hwb=t.value;S.review=false;draw();var gh=$('#ghw');if(gh&&gh.scrollIntoView)gh.scrollIntoView({block:'start'});return}
  if(t.id==='sles'){readSess();S.sess.lesson=t.value;draw();return}
  if(t.id==='pstep'){var g=grp(),p=plan(g);p.step=t.checked;try{await savePlan(g,p);if(S.sess)S.sess.next=p.step;msg(p.step?'Уроки будут открываться по мере занятий':'Новые уроки программы будут открываться сразу',true)}catch(x){msg('Не получилось сохранить')}}
});
document.addEventListener('click',async function(e){
  var b=e.target.closest('button');if(!b||S.busy)return;
  var g=grp();
  if(b.dataset.g){S.cur=+b.dataset.g;S.edit=null;location.hash='g'+S.cur;await loadSessions();draw();return}
  if(b.dataset.gnew){S.edit={id:null,name:'',lang:KR.lang&&KR.lang()==='en'?'en':'ko',members:{}};draw();return}
  if(b.dataset.gedit&&g){var m={};members(g).forEach(function(n){m[n]=true});S.edit={id:g.id,name:g.name,lang:g.lang||'ko',members:m};draw();return}
  if(b.dataset.gcancel){S.edit=null;draw();return}
  if(b.id==='gsave'){S.busy=true;try{await saveGroup(b)}finally{S.busy=false}return}
  if(b.dataset.gdel){if(!confirm('Удалить группу? Ученики, их уроки, слова и домашка останутся; пропадут группа и журнал занятий.'))return;
    try{await KR.api('teacher_group_delete',{p_id:+b.dataset.gdel});S.cur=null;S.edit=null;location.hash='';await reload();msg('Группа удалена',true)}catch(x){msg('Не получилось удалить группу')}return}
  if(b.dataset.sst){readSess();S.sess.st[b.dataset.sst]=b.dataset.v;S.sess.open=true;draw();return}
  if(b.id==='sgo'){S.busy=true;try{await saveSession(b)}finally{S.busy=false}return}
  if(b.dataset.grev){S.review=!S.review;draw();var gh=$('#ghw');if(gh&&gh.scrollIntoView)gh.scrollIntoView({block:'start'});return}
  if(b.dataset.gfix&&g){var bt=batches().filter(function(x){return x.id===S.hwb})[0];if(!bt)return;
    var list=[];Object.keys(bt.rows).forEach(function(n){var h=bt.rows[n];if(h.status==='active')return;var hw=fixHw(h);if(hw)list.push({student:n,hw:hw})});
    if(!list.length){msg('Нет заданий для работы над ошибками: в упражнениях и тестах этой домашки не было ошибок (тренажёры сюда не входят)');return}
    if(!confirm('Задать «Работу над ошибками» '+list.length+' '+plural(list.length,'ученику','ученикам','ученикам')+': '+list.map(function(x){return x.student}).join(', ')+'?'))return;
    S.busy=true;b.disabled=true;
    try{await KR.api('teacher_group_hw_save',{p_group:g.id,p_list:list});await loadSessions();draw();msg('«Работа над ошибками» задана: '+list.map(function(x){return x.student}).join(', '),true)}
    catch(x){b.disabled=false;msg('Не получилось задать работу над ошибками')}finally{S.busy=false}return}
  if(b.dataset.gunhw&&g){if(!confirm('Убрать эту домашку у тех, кто её ещё не сдал? Сданная останется.'))return;
    try{var n=await KR.api('teacher_group_hw_delete',{p_group:g.id,p_batch:S.hwb});await loadSessions();draw();msg('Убрано у '+n,true)}catch(x){msg('Не получилось убрать')}return}
  if(b.dataset.sdel){if(!confirm('Удалить запись о занятии? Уроки, слова и домашка учеников останутся.'))return;
    try{await KR.api('teacher_group_session_delete',{p_id:+b.dataset.sdel});await reload();msg('Запись удалена',true)}catch(x){msg('Не получилось удалить')}return}
  if(!g)return;
  var p=plan(g);
  if(b.id==='paddgo'){var id=S.addm||($('#padd')||{}).value;if(!id){msg('Выберите урок или материал');return}
    S.busy=true;b.disabled=true;
    try{var it={m:id,open:false},hd=held();
      // сразу открываем, если уроки открываются не по занятиям или группа уже прошла всё открытое
      var openNow=!p.step||!p.items.some(function(i){return !hd[i.m]});
      if(openNow){msg('Открываю всем ученикам группы…',true);var o=await openFor([id],members(g),g);it.open=true}
      p.items.push(it);S.addm='';await savePlan(g,p);draw();msg('В программе: '+title(id)+(it.open?' · открыт всем':' · откроется, когда группа до него дойдёт'),true)}
    catch(x){msg('Не получилось добавить')}finally{S.busy=false}return}
  if(b.dataset.popen){var k=+b.dataset.popen,i2=p.items[k];if(!i2)return;S.busy=true;b.disabled=true;
    try{msg('Открываю всем ученикам группы…',true);var o3=await openFor([i2.m],members(g),g);i2.open=true;await savePlan(g,p);draw();msg('Открыт всем: '+title(i2.m)+(o3.err?' · не получилось у '+o3.err:''),true)}
    catch(x){msg('Не получилось открыть')}finally{S.busy=false}return}
  if(b.dataset.pup){var u=+b.dataset.pup,a=p.items;var tmp=a[u-1];a[u-1]=a[u];a[u]=tmp;try{await savePlan(g,p);draw()}catch(x){msg('Не получилось сохранить')}return}
  if(b.dataset.prm){var r=+b.dataset.prm,rm=p.items[r];if(!rm)return;
    if(!confirm('Убрать «'+title(rm.m)+'» из программы группы? У учеников, кому он уже открыт, урок останется.'))return;
    p.items.splice(r,1);try{await savePlan(g,p);draw();msg('Убрано из программы',true)}catch(x){msg('Не получилось сохранить')}return}
  if(b.dataset.srm){p.sets.splice(+b.dataset.srm,1);try{await savePlan(g,p);draw();msg('Словарь убран из группы. Слова у учеников остались.',true)}catch(x){msg('Не получилось сохранить')}return}
  if(b.id==='gwgo'){var s=gwSet();if(!s)return;if(!s.words){msg('В этом словаре пока нет слов');return}
    var part=S.gw.words&&S.gw.id===s.id&&$('#gwbox .wpick')?KR.W2.picked('gw').map(Number):null;
    if(part&&!part.length){msg('Отметьте хотя бы одно слово');return}
    if(part&&part.length===S.gw.words.length)part=null;
    S.busy=true;b.disabled=true;
    try{msg('Назначаю словарь ученикам группы…',true);var it2={s:s.id,w:part},w2=await setsFor([it2],members(g));
      p.sets=p.sets.filter(function(x){return x.s!==s.id});p.sets.push(it2);await savePlan(g,p);S.gw={id:null,words:null};KR.W2.pickReset('gw');draw();
      msg('Словарь «'+s.title+'» назначен группе. Новых слов у учеников: '+w2.n+(w2.err?' · не получилось: '+w2.err:''),true)}
    catch(x){b.disabled=false;msg('Не получилось назначить словарь')}finally{S.busy=false}return}
});
document.addEventListener('input',function(e){if(e.target.id==='snote'&&S.sess)S.sess.note=e.target.value;if(e.target.id==='gname'&&S.edit)S.edit.name=e.target.value});
document.addEventListener('change',function(e){if(e.target.id==='glang'&&S.edit)S.edit.lang=e.target.value;if(e.target.id==='sday'&&S.sess)S.sess.day=e.target.value;
  if(S.sess&&(e.target.id==='swords'||e.target.id==='scatch'||e.target.id==='snext'))readSess()});
KR.groups={catchUpHw:catchUpHw,lid:lid};
boot();
})();
