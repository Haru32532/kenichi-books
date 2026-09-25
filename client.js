const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEYS={profile:'rc_profile_v1',goal:'rc_goal_v1',books:'rc_books_v1',reads:'rc_reads_v1',plan:'rc_plan_v1',scan:'rc_master_scan_v1',library:'rc_library_v1'};
const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}}, save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
let profile=load(KEYS.profile,{name:'',birthDate:''}), goal=load(KEYS.goal,{target:30000,targetDate:'',weekdays:true,saturday:false,sunHoliday:false});
let books=load(KEYS.books,[]), reads=load(KEYS.reads,[]), plan=load(KEYS.plan,{focus:[],recommended:[]});
async function ensureMasterBooks(){
  const master=await fetch('/initial_books.json',{cache:'no-store'}).then(r=>r.json()).catch(()=>[]);
  if(!Array.isArray(master)||!master.length)return;
  const byId=new Map(books.map(b=>[b.id,b]));
  const byIsbn=new Map(books.filter(b=>b.isbn).map(b=>[String(b.isbn),b]));
  const byTitle=new Map(books.map(b=>[String(b.title||'').normalize('NFKC'),b]));
  for(const m of master){
    const hit=byId.get(m.id)||(m.isbn&&byIsbn.get(String(m.isbn)))||byTitle.get(String(m.title||'').normalize('NFKC'));
    if(hit) Object.assign(hit,m,{readCount:hit.readCount??m.readCount??0});
    else books.push({...m,readCount:0});
  }
  save(KEYS.books,books);
}
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function go(id){$$('.page').forEach(x=>x.classList.toggle('active',x.id===id));scrollTo(0,0);render()} $$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
function totalReads(){return reads.reduce((a,r)=>a+(+r.count||0),0)}
function ymd(d){return d.toISOString().slice(0,10)}
function isJPWeekday(d){let w=d.getDay();return w>=1&&w<=5} // Holiday calendar adapter plugs in here.
function eligibleDays(from,to){let n=0,d=new Date(from);d.setHours(12,0,0,0);let end=new Date(to);end.setHours(12,0,0,0);for(;d<=end;d.setDate(d.getDate()+1)){let w=d.getDay();if((w>=1&&w<=5&&goal.weekdays)||(w===6&&goal.saturday)||(w===0&&goal.sunHoliday))n++}return n}
function genresForMonth(){let now=new Date(), ym=now.toISOString().slice(0,7), m={};reads.filter(r=>String(r.date||'').startsWith(ym)).forEach(r=>{let b=books.find(x=>x.id===r.bookId)||{};(b.genreTags||['未分類']).forEach(g=>m[g]=(m[g]||0)+(+r.count||0))});return m}
function renderGenres(el){let m=genresForMonth(),sum=Object.values(m).reduce((a,b)=>a+b,0)||1, arr=Object.entries(m).sort((a,b)=>b[1]-a[1]);el.innerHTML=arr.length?arr.map(([g,n])=>`<div class="genre"><span><b>${esc(g)}</b><small>${n}回・${Math.round(n/sum*100)}%</small></span><div class="mini"><i style="width:${n/sum*100}%"></i></div></div>`).join(''):'まだ今月の記録がありません。';return arr}
async function boot(){await ensureMasterBooks();render()} 
function render(){
 let total=totalReads(); $('#totalReads').textContent=total.toLocaleString()+'回';$('#goalTotal').textContent=(+goal.target||0).toLocaleString()+'回';$('#goalBar').style.width=Math.min(100,total/(goal.target||1)*100)+'%';
 let days=goal.targetDate?eligibleDays(new Date(),goal.targetDate):0,remain=Math.max(0,(+goal.target||0)-total),pace=days?Math.ceil(remain/days):0;
 $('#goalPace').textContent=goal.targetDate?`目標日までの読み聞かせ予定日 ${days}日。あと${remain.toLocaleString()}回 → 1日平均 ${pace}回`:'目標日を設定してください。';
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
function fillSettings(){$('#childName').value=profile.name||'';$('#birthDate').value=profile.birthDate||'';$('#goalInput').value=goal.target||30000;$('#goalDate').value=goal.targetDate||'';$('#wk').checked=!!goal.weekdays;$('#sat').checked=!!goal.saturday;$('#hol').checked=!!goal.sunHoliday;$('#libraryName').value=load(KEYS.library,{name:''}).name||''}
$('#saveSettings').onclick=()=>{profile={name:$('#childName').value,birthDate:$('#birthDate').value};goal={target:+$('#goalInput').value||30000,targetDate:$('#goalDate').value,weekdays:$('#wk').checked,saturday:$('#sat').checked,sunHoliday:$('#hol').checked};save(KEYS.profile,profile);save(KEYS.goal,goal);render()}
$('#saveLibrary').onclick=()=>save(KEYS.library,{name:$('#libraryName').value});
$('#addRead').onclick=()=>{let t=$('#manualTitle').value.trim();if(!t)return;let b=books.find(x=>x.title===t);if(!b){b={id:crypto.randomUUID(),title:t,author:'',publisher:'',isbn:'',genreTags:['未分類']};books.push(b);save(KEYS.books,books)}reads.push({id:crypto.randomUUID(),bookId:b.id,date:ymd(new Date()),count:+$('#manualCount').value||1,source:'manual'});save(KEYS.reads,reads);$('#manualTitle').value='';render()}
$('#pdfStub').onclick=()=>$('#pdfMsg').textContent=$('#mietePdf').files[0]?'PDFを選択しました。次工程で「抽出→確認→重複防止→取込」の専用アダプターを接続します。':'PDFを選択してください。';
const G=['昔話','ことば','生活','動物','自然・科学','数・かたち','季節','音楽・リズム','乗り物','社会・文化'];
function renderFocus(){$('#focusGenres').innerHTML=G.map(g=>`<label><input type="checkbox" data-focus="${g}" ${plan.focus.includes(g)?'checked':''}> ${g}</label>`).join('');$$('[data-focus]').forEach(x=>x.onchange=()=>{plan.focus=$$('[data-focus]:checked').slice(0,2).map(x=>x.dataset.focus);save(KEYS.plan,plan);render()})}
function renderRecEditor(){$('#recEditor').innerHTML=books.slice(0,100).map(b=>`<label><input type="checkbox" data-rec="${b.id}" ${plan.recommended.includes(b.id)?'checked':''}> ${esc(b.title)}</label>`).join('');$$('[data-rec]').forEach(x=>x.onchange=()=>{plan.recommended=$$('[data-rec]:checked').map(x=>x.dataset.rec);save(KEYS.plan,plan);render()})}
let registerCtl=null, shopCtl=null;
const normalizeIsbn=s=>String(s||'').replace(/\D/g,'');
const findOwnedByIsbn=isbn=>books.find(b=>normalizeIsbn(b.isbn)===normalizeIsbn(isbn));
async function lookupBook(isbn){
  const hit=findOwnedByIsbn(isbn);
  if(hit)return hit;
  try{
    const j=await fetch(`https://api.openbd.jp/v1/get?isbn=${encodeURIComponent(isbn)}`).then(r=>r.json());
    const s=j?.[0]?.summary||{};
    return {id:crypto.randomUUID(),title:s.title||'書誌情報未取得',author:s.author||'',publisher:s.publisher||'',isbn,genreTags:[],owned:false};
  }catch{return {id:crypto.randomUUID(),title:'書誌情報未取得',author:'',publisher:'',isbn,genreTags:[],owned:false}}
}
async function handleRegister(isbn){
  isbn=normalizeIsbn(isbn); if(!/^97[89]\d{10}$/.test(isbn))return;
  const owned=findOwnedByIsbn(isbn);
  if(owned){
    $('#registerResult').innerHTML=`<div class="card"><b>✓ すでに持っています</b><p>${esc(owned.title)}</p><small>${esc(owned.author||'')} ${esc(owned.publisher||'')}</small></div>`;
    return;
  }
  const info=await lookupBook(isbn);
  $('#registerResult').innerHTML=`<div class="card"><b>未登録</b><h2>${esc(info.title)}</h2><p>${esc(info.author||'')}<br>${esc(info.publisher||'')}<br>${esc(isbn)}</p><button id="confirmRegister">所有本に追加</button></div>`;
  $('#confirmRegister').onclick=()=>{books.push({...info,owned:true});save(KEYS.books,books);render();$('#registerResult').innerHTML=`<div class="card"><b>✓ 登録しました</b><p>${esc(info.title)}</p></div>`};
}
async function handleShop(isbn){
  isbn=normalizeIsbn(isbn); if(!/^97[89]\d{10}$/.test(isbn))return;
  const owned=findOwnedByIsbn(isbn);
  const info=owned||await lookupBook(isbn);
  $('#shopResult').innerHTML=owned
   ? `<div class="card"><h2>✓ 所有済み</h2><p><b>${esc(info.title)}</b><br>${esc(info.author||'')}<br>${esc(info.publisher||'')}</p></div>`
   : `<div class="card"><h2>未所有</h2><p><b>${esc(info.title)}</b><br>${esc(info.author||'')}<br>${esc(info.publisher||'')}<br>${esc(isbn)}</p></div>`;
}
async function startScanner(videoId,onRead,stateId,kind){
  if(!window.ZXingBrowser){$('#'+stateId).textContent='バーコード機能を読み込めません。';return}
  try{
    const reader=new ZXingBrowser.BrowserMultiFormatReader();
    const ctl=await reader.decodeFromVideoDevice(undefined,videoId,async res=>{
      if(!res)return;
      const code=normalizeIsbn(res.getText());
      if(!/^97[89]\d{10}$/.test(code))return;
      ctl.stop();
      if(kind==='register')registerCtl=null;else shopCtl=null;
      $('#'+stateId).textContent='ISBN '+code+' を読み取りました';
      await onRead(code);
    });
    if(kind==='register')registerCtl=ctl;else shopCtl=ctl;
    $('#'+stateId).textContent='カメラを起動しました';
  }catch(e){$('#'+stateId).textContent='カメラエラー：'+e.message}
}
$('#startRegisterScan').onclick=()=>startScanner('registerVideo',handleRegister,'registerState','register');
$('#stopRegisterScan').onclick=()=>{if(registerCtl)registerCtl.stop();registerCtl=null;$('#registerState').textContent='停止しました'};
$('#startShopScan').onclick=()=>startScanner('shopVideo',handleShop,'shopState','shop');
$('#stopShopScan').onclick=()=>{if(shopCtl)shopCtl.stop();shopCtl=null;$('#shopState').textContent='停止しました'};
boot();
