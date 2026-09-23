const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEYS={profile:'rc_profile_v1',goal:'rc_goal_v1',books:'rc_books_v1',reads:'rc_reads_v1',plan:'rc_plan_v1',scan:'rc_master_scan_v1',library:'rc_library_v1'};
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}, save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
let profile=load(KEYS.profile,{name:'',birthDate:''}), goal=load(KEYS.goal,{target:30000,targetDate:'',days:{1:true,2:true,3:true,4:true,5:true,6:false,0:false},excludeHolidays:true,baselineReads:0});
if(!goal.days){
 goal.days={0:!!goal.sunHoliday,1:!!goal.weekdays,2:!!goal.weekdays,3:!!goal.weekdays,4:!!goal.weekdays,5:!!goal.weekdays,6:!!goal.saturday};
 if(goal.excludeHolidays===undefined) goal.excludeHolidays=!goal.sunHoliday;
}
let books=load(KEYS.books,[]), reads=load(KEYS.reads,[]), plan=load(KEYS.plan,{focus:[],recommended:[]});
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function go(id){$$('.page').forEach(x=>x.classList.toggle('active',x.id===id));scrollTo(0,0);render()} $$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
function totalReads(){return (+goal.baselineReads||0)+reads.reduce((a,r)=>a+(+r.count||0),0)}
function ymd(d){return d.toISOString().slice(0,10)}
function nthMonday(y,m,n){let d=new Date(y,m-1,1,12),add=(8-d.getDay())%7;d.setDate(1+add+(n-1)*7);return ymd(d)}
function equinox(y,kind){let day=kind==='spring'?Math.floor(20.8431+0.242194*(y-1980)-Math.floor((y-1980)/4)):Math.floor(23.2488+0.242194*(y-1980)-Math.floor((y-1980)/4));return `${y}-${kind==='spring'?'03':'09'}-${String(day).padStart(2,'0')}`}
function jpHolidays(y){
 let s=new Set([`${y}-01-01`,nthMonday(y,1,2),`${y}-02-11`,`${y}-02-23`,equinox(y,'spring'),`${y}-04-29`,`${y}-05-03`,`${y}-05-04`,`${y}-05-05`,nthMonday(y,7,3),`${y}-08-11`,nthMonday(y,9,3),equinox(y,'autumn'),nthMonday(y,10,2),`${y}-11-03`,`${y}-11-23`]);
 for(let d=new Date(y,0,2,12);d.getFullYear()===y;d.setDate(d.getDate()+1)){let k=ymd(d),p=new Date(d),n=new Date(d);p.setDate(p.getDate()-1);n.setDate(n.getDate()+1);if(!s.has(k)&&s.has(ymd(p))&&s.has(ymd(n)))s.add(k)}
 for(let k of [...s]){let d=new Date(k+'T12:00:00');if(d.getDay()===0){do{d.setDate(d.getDate()+1)}while(s.has(ymd(d)));s.add(ymd(d))}}
 return s
}
function isHoliday(d){return jpHolidays(d.getFullYear()).has(ymd(d))}
function eligibleDate(d){if(goal.excludeHolidays&&isHoliday(d))return false;return !!(goal.days&&goal.days[d.getDay()])}
function eligibleDays(from,to){let n=0,d=new Date(from),end=new Date(to);d.setHours(12,0,0,0);end.setHours(12,0,0,0);if(d>end)return 0;for(;d<=end;d.setDate(d.getDate()+1))if(eligibleDate(d))n++;return n}
function genresForMonth(){let now=new Date(), ym=now.toISOString().slice(0,7), m={};reads.filter(r=>String(r.date||'').startsWith(ym)).forEach(r=>{let b=books.find(x=>x.id===r.bookId)||{};(b.genreTags||['未分類']).forEach(g=>m[g]=(m[g]||0)+(+r.count||0))});return m}
function renderGenres(el){let m=genresForMonth(),sum=Object.values(m).reduce((a,b)=>a+b,0)||1, arr=Object.entries(m).sort((a,b)=>b[1]-a[1]);el.innerHTML=arr.length?arr.map(([g,n])=>`<div class="genre"><span><b>${esc(g)}</b><small>${n}回・${Math.round(n/sum*100)}%</small></span><div class="mini"><i style="width:${n/sum*100}%"></i></div></div>`).join(''):'まだ今月の記録がありません。';return arr}
function render(){
 let total=totalReads(), target=(+goal.target||0), pct=target?Math.min(100,total/target*100):0;
 $('#totalReads').textContent=total.toLocaleString()+'回';$('#goalTotal').textContent=target.toLocaleString()+'回';$('#goalBar').style.width=pct+'%';$('#goalPercent').textContent=pct.toFixed(1)+'%';
 let today=new Date();today.setHours(12,0,0,0);let end=goal.targetDate?new Date(goal.targetDate+'T12:00:00'):null;
 let calendarDays=end&&end>=today?Math.floor((end-today)/86400000)+1:0, days=end?eligibleDays(today,end):0,remain=Math.max(0,target-total),pace=days?Math.ceil(remain/days):0;
 $('#goalRemain').textContent=remain.toLocaleString()+'回';$('#calendarRemain').textContent=end?calendarDays+'日':'—';$('#eligibleRemain').textContent=end?days+'日':'—';
 $('#goalPace').textContent=end?(remain===0?'🎉 目標を達成しました':days?`選んだ曜日で達成するには 1日平均 ${pace}回`:'読み聞かせする曜日を1つ以上選んでください'):'目標日を設定してください。';
 $('#goalToday').textContent=end&&eligibleDate(today)&&remain>0?`今日は読み聞かせ予定日です。目安 ${pace}回`:(end?'今日はお休み設定の日です。':'');
 let ym=new Date().toISOString().slice(0,7), monthReads=reads.filter(r=>String(r.date||'').startsWith(ym));
 $('#monthlyBooks').innerHTML=plan.recommended.length?plan.recommended.map(id=>{let b=books.find(x=>x.id===id)||{title:'不明'};let c=monthReads.filter(r=>r.bookId===id).reduce((a,r)=>a+(+r.count||0),0);return `<li>${esc(b.title)} — ${c?`✓ ${c}回`:'未読'}</li>`}).join(''):'<li>今月の推奨図書を設定すると表示されます。</li>';
 let done=plan.recommended.filter(id=>monthReads.some(r=>r.bookId===id)).length, reps=monthReads.filter(r=>plan.recommended.includes(r.bookId)).reduce((a,r)=>a+(+r.count||0),0);
 $('#bookProgress').textContent=`${done} / ${plan.recommended.length}冊`;$('#repeatProgress').textContent=reps+'回';
 let ga=renderGenres($('#genreBars'));$('#genreInsight').textContent=ga.length?`少ないジャンル：${ga.slice().sort((a,b)=>a[1]-b[1]).slice(0,2).map(x=>x[0]).join('・')}`:'';
 renderGenres($('#analysisGenres'));let unique=new Set(monthReads.map(r=>r.bookId)).size,totalM=monthReads.reduce((a,r)=>a+(+r.count||0),0);$('#breadthDepth').textContent=`今月 ${unique}冊 ／ ${totalM}回。冊数＝幅、回数＝繰り返しとして別々に評価します。`;
 $('#reflection').innerHTML=`今月は <b>${totalM}回</b>、<b>${unique}冊</b>。推奨図書は <b>${done}/${plan.recommended.length}冊</b> コンプリート、推奨図書の読み聞かせは <b>${reps}回</b>です。`;
 $('#bookCount').textContent=`${books.length}冊`; renderBookList(); renderFocus(); renderRecEditor(); fillSettings();
}
function renderBookList(){let q=($('#bookSearch')?.value||'').toLowerCase(),a=books.filter(b=>[b.title,b.author,b.publisher,b.isbn].join(' ').toLowerCase().includes(q));$('#bookList').innerHTML=a.map(b=>`<div class="book"><b>${esc(b.title)}</b><small>${esc(b.author||'作者未登録')}｜${esc(b.publisher||'出版社未登録')}</small></div>`).join('')}
$('#bookSearch').oninput=renderBookList;
function fillSettings(){$('#childName').value=profile.name||'';$('#birthDate').value=profile.birthDate||'';$('#goalInput').value=goal.target||30000;$('#goalDate').value=goal.targetDate||'';$('#baselineReads').value=goal.baselineReads||0;
$('#mon').checked=!!goal.days[1];$('#tue').checked=!!goal.days[2];$('#wed').checked=!!goal.days[3];$('#thu').checked=!!goal.days[4];$('#fri').checked=!!goal.days[5];$('#sat').checked=!!goal.days[6];$('#sun').checked=!!goal.days[0];$('#excludeHolidays').checked=!!goal.excludeHolidays;$('#libraryName').value=load(KEYS.library,{name:''}).name||''}
$('#thirdBirthday').onclick=()=>{let b=$('#birthDate').value;if(!b){alert('先に生年月日を入力してください。');return}let d=new Date(b+'T12:00:00');d.setFullYear(d.getFullYear()+3);$('#goalDate').value=ymd(d)};
$('#saveSettings').onclick=()=>{profile={name:$('#childName').value,birthDate:$('#birthDate').value};goal={target:+$('#goalInput').value||30000,targetDate:$('#goalDate').value,baselineReads:+$('#baselineReads').value||0,
days:{1:$('#mon').checked,2:$('#tue').checked,3:$('#wed').checked,4:$('#thu').checked,5:$('#fri').checked,6:$('#sat').checked,0:$('#sun').checked},
excludeHolidays:$('#excludeHolidays').checked};save(KEYS.profile,profile);save(KEYS.goal,goal);render()}
$('#saveLibrary').onclick=()=>save(KEYS.library,{name:$('#libraryName').value});
$('#addRead').onclick=()=>{let t=$('#manualTitle').value.trim();if(!t)return;let b=books.find(x=>x.title===t);if(!b){b={id:crypto.randomUUID(),title:t,author:'',publisher:'',isbn:'',genreTags:['未分類']};books.push(b);save(KEYS.books,books)}reads.push({id:crypto.randomUUID(),bookId:b.id,date:ymd(new Date()),count:+$('#manualCount').value||1,source:'manual'});save(KEYS.reads,reads);$('#manualTitle').value='';render()}
$('#pdfStub').onclick=()=>$('#pdfMsg').textContent=$('#mietePdf').files[0]?'PDFを選択しました。次工程で「抽出→確認→重複防止→取込」の専用アダプターを接続します。':'PDFを選択してください。';
const G=['昔話','ことば','生活','動物','自然・科学','数・かたち','季節','音楽・リズム','乗り物','社会・文化'];
function renderFocus(){$('#focusGenres').innerHTML=G.map(g=>`<label><input type="checkbox" data-focus="${g}" ${plan.focus.includes(g)?'checked':''}> ${g}</label>`).join('');$$('[data-focus]').forEach(x=>x.onchange=()=>{plan.focus=$$('[data-focus]:checked').slice(0,2).map(x=>x.dataset.focus);save(KEYS.plan,plan);render()})}
function renderRecEditor(){$('#recEditor').innerHTML=books.slice(0,100).map(b=>`<label><input type="checkbox" data-rec="${b.id}" ${plan.recommended.includes(b.id)?'checked':''}> ${esc(b.title)}</label>`).join('');$$('[data-rec]').forEach(x=>x.onchange=()=>{plan.recommended=$$('[data-rec]:checked').map(x=>x.dataset.rec);save(KEYS.plan,plan);render()})}
let ctl=null, pair={isbn:'',addon:null}, scanMode='master';
const C1={'0':'一般','1':'教養','2':'実用','3':'専門','5':'婦人','6':'学参I','7':'学参II','8':'児童','9':'雑誌扱い'},C2={'0':'単行本','1':'文庫','2':'新書','3':'全集・双書','4':'ムック等','5':'事・辞典','6':'図鑑','7':'絵本','9':'コミック'};
function parseAddon(s){s=String(s).replace(/\D/g,'');if(!s.startsWith('192')||s.length<12)return null;let c=s.slice(3,7),p=parseInt(s.slice(7,12));return {raw:s,cCode:'C'+c,basePrice:p,classification:`${C1[c[0]]||'未分類'}／${C2[c[1]]||'未分類'}／内容${c.slice(2)}`}}
function scanState(){ $('#scanState').textContent=`ISBN：${pair.isbn||'待機'} ｜ 下段192：${pair.addon?pair.addon.cCode+'・本体'+pair.addon.basePrice.toLocaleString()+'円':'待機'}` }
async function onCode(raw){let s=String(raw).replace(/\D/g,'');if(/^97[89]\d{10}$/.test(s))pair.isbn=s;else{let a=parseAddon(s);if(a)pair.addon=a;else return}scanState();if(pair.isbn&&pair.addon){let rec={isbn:pair.isbn,...pair.addon,at:new Date().toISOString()};$('#scanResult').innerHTML=`<b>${esc(rec.isbn)}</b><br>${esc(rec.cCode)}｜${esc(rec.classification)}｜本体${rec.basePrice.toLocaleString()}円`;if(scanMode==='master'){let a=load(KEYS.scan,[]);a.push(rec);save(KEYS.scan,a)}if(ctl){ctl.stop();ctl=null}}}
$('#startScan').onclick=async()=>{pair={isbn:'',addon:null};scanState();try{let r=new ZXingBrowser.BrowserMultiFormatReader();ctl=await r.decodeFromVideoDevice(undefined,'video',(res)=>{if(res)onCode(res.getText())})}catch(e){$('#scanState').textContent='カメラエラー：'+e.message}}
$('#stopScan').onclick=()=>{if(ctl)ctl.stop();ctl=null};$('#modeMaster').onclick=()=>{scanMode='master';$('#modeMaster').classList.add('on');$('#modeShop').classList.remove('on')};$('#modeShop').onclick=()=>{scanMode='shop';$('#modeShop').classList.add('on');$('#modeMaster').classList.remove('on')};
render();