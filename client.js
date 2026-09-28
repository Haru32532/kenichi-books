(()=>{"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const MASTER=Array.isArray(window.MASTER_BOOKS)?window.MASTER_BOOKS:[];
const KEY="kenchan_clean_overrides_v1", TAGKEY="kenchan_clean_tags_v1";
let overrides={}, tags=[], filter="all", ageFilter="all", programFilter="all", completeFilter="all", bulk=false, selected=new Set();
try{overrides=JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){}
try{tags=JSON.parse(localStorage.getItem(TAGKEY)||"[]")||[]}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(overrides));localStorage.setItem(TAGKEY,JSON.stringify(tags))}catch(e){}};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const USER_BOOKS_KEY="kenchan_user_books_v1";let userBooks=[];try{userBooks=JSON.parse(localStorage.getItem(USER_BOOKS_KEY)||"[]");if(!Array.isArray(userBooks))userBooks=[]}catch(e){userBooks=[]}const saveUserBooks=()=>localStorage.setItem(USER_BOOKS_KEY,JSON.stringify(userBooks));const books=()=>[...MASTER,...userBooks].map(b=>({...b,...(overrides[b.id]||{}),tags:Array.isArray(overrides[b.id]?.tags)?overrides[b.id].tags:(b.tags||[])})).filter(b=>!b.deleted);
function allTags(){let s=new Set(tags);books().forEach(b=>(b.tags||[]).forEach(t=>s.add(t)));return [...s].filter(Boolean).sort((a,b)=>a.localeCompare(b,"ja"))}

const AGE_OPTIONS=["0歳","1歳","2歳","3歳","4歳","5歳","6歳"];
function agesOf(b){
  if(Array.isArray(b.ages))return b.ages;
  const raw=String(b.age||"");
  return AGE_OPTIONS.filter(a=>raw.includes(a));
}
function drawAges(){
  $("#ageTabs").innerHTML=[["all","全年齢"],...AGE_OPTIONS.map(a=>[a,a])].map(([v,l])=>`<button data-agefilter="${v}" class="${ageFilter===v?"active":""}">${l}</button>`).join("");
  $$("[data-agefilter]").forEach(x=>x.onclick=()=>{ageFilter=x.dataset.agefilter;draw()});
}
function renderEditChecks(b){
  $("#ageChecks").innerHTML=AGE_OPTIONS.map(a=>`<label><input type="checkbox" data-eage="${a}" ${agesOf(b).includes(a)?"checked":""}>${a}</label>`).join("");
  $("#editTagChecks").innerHTML=allTags().map(t=>`<label><input type="checkbox" data-etag="${esc(t)}" ${(b.tags||[]).includes(t)?"checked":""}>${esc(t)}</label>`).join("")||"<small>タグはまだありません。</small>";
}
function drawTags(){let a=allTags();$("#tagTabs").innerHTML=[["all","すべて"],["favorite","★お気に入り"],...a.map(t=>[t,t])].map(([v,l])=>`<button data-filter="${esc(v)}" class="${filter===v?"active":""}">${esc(l)}</button>`).join("");$("#bulkTag").innerHTML=a.map(t=>`<option>${esc(t)}</option>`).join("");$$("[data-filter]").forEach(x=>x.onclick=()=>{filter=x.dataset.filter;draw()})}
function dataComplete(b){if(b.dataComplete===true)return true;const i=normIsbn(b.isbn),j=normIsbn(b.jan2);return !!(b.title&&b.author&&b.publisher&&i.length===13&&(i.startsWith("978")||i.startsWith("979"))&&j.length===13&&j.startsWith("192"))}
function programBadges(b){let a=[];if(b.kumon)a.push(`<span class="program-badge">KUMON ${esc(b.kumon)}</span>`);if(b.kaho)a.push(`<span class="program-badge">${esc(b.kaho)}</span>`);if(b.ownership==="仮所有")a.push(`<span class="program-badge">仮所有</span>`);a.push(`<span class="data-badge ${dataComplete(b)?"complete":""}">${dataComplete(b)?"データ完了":"データ未完了"}</span>`);return `<div class="program-badges">${a.join("")}</div>`}
function draw(){let a=books(),q=$("#search").value.trim().toLowerCase();a=a.filter(b=>[b.title,b.author,b.publisher,b.isbn,b.jan2,b.ccode,b.listPrice,b.kumon,b.kaho,b.ownership,(b.tags||[]).join(" "),agesOf(b).join(" ")].join(" ").toLowerCase().includes(q));if(ageFilter!=="all")a=a.filter(b=>agesOf(b).includes(ageFilter));if(programFilter==="kumon")a=a.filter(b=>!!b.kumon);else if(programFilter==="kaho")a=a.filter(b=>!!b.kaho);else if(["5A","4A","3A","2A","A","B","C","D","E","F","G","H","I"].includes(programFilter))a=a.filter(b=>b.kumon===programFilter);else if(programFilter==="すくすく館"||programFilter==="なかよし館")a=a.filter(b=>(b.kaho||"").includes(programFilter));if(completeFilter==="incomplete")a=a.filter(b=>!dataComplete(b));else if(completeFilter==="complete")a=a.filter(dataComplete);if(filter==="favorite")a=a.filter(b=>b.favorite);else if(filter!=="all")a=a.filter(b=>(b.tags||[]).includes(filter));$("#count").textContent=`${books().length}冊（表示 ${a.length}冊）`;drawAges();$("#status").innerHTML="";$("#status").style.display="none";drawTags();$("#list").innerHTML=a.map(b=>`<div class="book">${bulk?`<input class="pick" type="checkbox" data-pick="${esc(b.id)}" ${selected.has(b.id)?"checked":""}>`:""}<div class="bookmain" data-edit="${esc(b.id)}"><b>${b.favorite?"★ ":""}${esc(b.title)}</b><small>${esc(b.author||"作者未登録")}｜${esc(b.publisher||"出版社未登録")}</small><small>ISBN：${esc(b.isbn||"ISBNなし／未確認")}</small>${programBadges(b)}${(b.tags||[]).length?`<div class="tagline">${b.tags.map(t=>"#"+esc(t)).join(" ")}</div>`:""}</div></div>`).join("");$$("[data-edit]").forEach(x=>x.onclick=()=>{if(!bulk)openEdit(x.dataset.edit)});$$("[data-pick]").forEach(x=>x.onchange=()=>{x.checked?selected.add(x.dataset.pick):selected.delete(x.dataset.pick);$("#selected").textContent=selected.size+"冊"})}
function parseJan2(n){n=normIsbn(n);if(n.length!==13||!n.startsWith("192"))return null;return {jan2:n,ccode:"C"+n.slice(3,7),price:String(parseInt(n.slice(7,12),10)||0)}}
function openEdit(id){let b=books().find(x=>x.id===id);if(!b)return;$("#eid").value=id;$("#etitle").value=b.title||"";$("#eauthor").value=b.author||"";$("#epublisher").value=b.publisher||"";$("#eisbn").value=b.isbn||"";$("#ejan2").value=b.jan2||"";$("#eccode").value=b.ccode||"";$("#eprice").value=b.listPrice||"";$("#editCodeMsg").textContent="";$("#programInfo").textContent=[b.kumon?"KUMON "+b.kumon:"",b.kaho||"",b.ownership||""].filter(Boolean).join(" ｜ ")||"推薦区分なし";renderEditChecks(b);$("#efav").checked=!!b.favorite;$("#enotes").value=b.notes||"";$("#edit").showModal()}
$("#save").onclick=()=>{let id=$("#eid").value, nt=$$("[data-etag]:checked").map(x=>x.dataset.etag), na=$$("[data-eage]:checked").map(x=>x.dataset.eage);nt.forEach(t=>{if(!tags.includes(t))tags.push(t)});overrides[id]={...(overrides[id]||{}),title:$("#etitle").value.trim(),author:$("#eauthor").value.trim(),publisher:$("#epublisher").value.trim(),isbn:$("#eisbn").value.replace(/\D/g,""),jan2:$("#ejan2").value.replace(/\D/g,""),ccode:$("#eccode").value.trim(),listPrice:$("#eprice").value.replace(/\D/g,""),ages:na,tags:nt,favorite:$("#efav").checked,notes:$("#enotes").value.trim()};save();$("#edit").close();draw()};
$("#cancel").onclick=async()=>{await stopEditCamera();$("#edit").close()};
$("#editNewTag").onclick=()=>{let t=(prompt("新しいタグ名")||"").trim();if(t&&!tags.includes(t)){tags.push(t);save()}let b=books().find(x=>x.id===$("#eid").value);if(b)renderEditChecks(b)};
$("#deleteBook").onclick=()=>{let id=$("#eid").value,b=books().find(x=>x.id===id);if(!b)return;if(confirm(`「${b.title}」を本棚から削除しますか？`)){overrides[id]={...(overrides[id]||{}),deleted:true};save();$("#edit").close();draw()}};$("#search").oninput=draw;$("#programFilter").onchange=e=>{programFilter=e.target.value;draw()};$("#completeFilter").onchange=e=>{completeFilter=e.target.value;draw()};
$("#newTag").onclick=()=>{let t=prompt("新しいタグ名");t=(t||"").trim();if(t&&!tags.includes(t)){tags.push(t);save();draw()}};
$("#bulkOn").onclick=()=>{bulk=true;selected.clear();$("#bulkBar").hidden=false;draw()};$("#bulkOff").onclick=()=>{bulk=false;selected.clear();$("#bulkBar").hidden=true;draw()};
function bulkAge(remove){let a=$("#bulkAge").value;if(!a)return;selected.forEach(id=>{let b=books().find(x=>x.id===id), ar=agesOf(b);ar=remove?ar.filter(x=>x!==a):[...new Set([...ar,a])];overrides[id]={...(overrides[id]||{}),ages:ar}});save();draw()}
$("#addAge").onclick=()=>bulkAge(false);$("#removeAge").onclick=()=>bulkAge(true);
function bulkTag(remove){let t=$("#bulkTag").value;if(!t)return;selected.forEach(id=>{let b=books().find(x=>x.id===id), a=[...(b?.tags||[])];a=remove?a.filter(x=>x!==t):[...new Set([...a,t])];overrides[id]={...(overrides[id]||{}),tags:a}});save();draw()}
$("#addTag").onclick=()=>bulkTag(false);$("#removeTag").onclick=()=>bulkTag(true);
$("#menuBtn").onclick=()=>$("#menu").hidden=!$("#menu").hidden;$("#menuShelf").onclick=()=>$("#menu").hidden=true;

function renderRegisterChecks(){$("#registerAgeChecks").innerHTML=AGE_OPTIONS.map(a=>`<label><input type="checkbox" data-rage="${a}">${a}</label>`).join("");$("#registerTagChecks").innerHTML=allTags().map(t=>`<label><input type="checkbox" data-rtag="${esc(t)}">${esc(t)}</label>`).join("")||"<small>タグはまだありません。</small>"}
function clearRegister(){["rIsbn","rTitle","rAuthor","rPublisher","rCcode","rPrice","rNotes"].forEach(id=>$("#"+id).value="");$("#rFav").checked=false;$("#registerMsg").innerHTML="";renderRegisterChecks()}
function openRegisterWithIsbn(isbn=""){stopShopCamera();if($("#shopCheck").open)$("#shopCheck").close();clearRegister();$("#rIsbn").value=normIsbn(isbn);$("#registerBook").showModal()}
$("#openRegister").onclick=()=>{$("#menu").hidden=true;openRegisterWithIsbn("")};$("#registerClose").onclick=()=>$("#registerBook").close();
async function lookupRegisterBib(){const n=normIsbn($("#rIsbn").value);if(!/^97[89]\d{10}$/.test(n)){$("#registerBibMsg").textContent="13桁のISBNを入力してください。";return}$("#registerBibMsg").textContent="書誌情報を検索中…";try{const b=window.fetchBibData?await window.fetchBibData(n):null;if(!b)throw 0;if(!$("#rTitle").value.trim())$("#rTitle").value=b.title||"";if(!$("#rAuthor").value.trim())$("#rAuthor").value=b.author||"";if(!$("#rPublisher").value.trim())$("#rPublisher").value=b.publisher||"";$("#registerBibMsg").textContent="書誌情報を取得しました。既に入力済みの項目は上書きしていません。"}catch(e){$("#registerBibMsg").textContent="書誌情報を取得できませんでした。"}}
$("#lookupRegisterBib").onclick=lookupRegisterBib;$("#rIsbn").addEventListener("change",()=>{if(/^97[89]\d{10}$/.test(normIsbn($("#rIsbn").value)))lookupRegisterBib()});
$("#registerSave").onclick=()=>{const title=$("#rTitle").value.trim(),isbn=normIsbn($("#rIsbn").value);if(!title){$("#registerMsg").innerHTML='<div class="shop-notowned">タイトルを入力してください。</div>';return}if(isbn&&books().some(b=>normIsbn(b.isbn)===isbn)){$("#registerMsg").innerHTML='<div class="shop-notowned">このISBNはすでに本棚に登録されています。</div>';return}userBooks.push({id:"USER-"+Date.now(),title,author:$("#rAuthor").value.trim(),publisher:$("#rPublisher").value.trim(),isbn,ccode:$("#rCcode").value.trim(),listPrice:$("#rPrice").value.replace(/\D/g,""),ages:$$("[data-rage]:checked").map(x=>x.dataset.rage),tags:$$("[data-rtag]:checked").map(x=>x.dataset.rtag),favorite:$("#rFav").checked,notes:$("#rNotes").value.trim()});saveUserBooks();$("#registerBook").close();draw();alert("本棚に登録しました。")};

let tesseractLoadPromise=null;
function loadTesseract(){if(window.Tesseract?.recognize)return Promise.resolve(true);if(tesseractLoadPromise)return tesseractLoadPromise;tesseractLoadPromise=new Promise(resolve=>{let s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';s.onload=()=>resolve(!!window.Tesseract?.recognize);s.onerror=()=>resolve(false);document.head.appendChild(s)});return tesseractLoadPromise}
function isbn10Valid(x){x=String(x).toUpperCase();if(!/^\\d{9}[\\dX]$/.test(x))return false;let sum=0;for(let i=0;i<10;i++)sum+=(10-i)*(x[i]==='X'?10:+x[i]);return sum%11===0}
function isbn13Valid(x){if(!/^\\d{13}$/.test(x))return false;let sum=0;for(let i=0;i<12;i++)sum+=(+x[i])*(i%2?3:1);return (10-sum%10)%10===+x[12]}
function isbn10to13(x){x=String(x).toUpperCase().replace(/[^0-9X]/g,'');if(!isbn10Valid(x))return'';let b='978'+x.slice(0,9),sum=0;for(let i=0;i<12;i++)sum+=(+b[i])*(i%2?3:1);return b+((10-sum%10)%10)}
function parsePrintedBookCodes(text){let t=String(text||'').normalize('NFKC').toUpperCase().replace(/[‐‑‒–—―−]/g,'-');let isbn='',m=t.match(/ISBN\\s*[:：]?\\s*([0-9X][0-9X\\s-]{8,20})/i);if(m){let raw=m[1].replace(/[^0-9X]/g,'');if(raw.length>=13){let a=raw.slice(0,13);if(isbn13Valid(a))isbn=a}else if(raw.length>=10){let a=raw.slice(0,10);if(isbn10Valid(a))isbn=isbn10to13(a)}}if(!isbn){for(let z of (t.match(/[0-9X][0-9X\\s-]{9,20}/g)||[])){let raw=z.replace(/[^0-9X]/g,'');if(raw.length===13&&isbn13Valid(raw)){isbn=raw;break}if(raw.length===10&&isbn10Valid(raw)){isbn=isbn10to13(raw);break}}}let cm=t.match(/C\\s*([0-9]{4})/),ccode=cm?'C'+cm[1]:'';let pm=t.match(/[¥￥]\\s*([0-9]{2,6})\\s*E?/i)||t.match(/([0-9]{2,6})\\s*円/),price=pm?pm[1]:'';return{isbn,ccode,price,text:t}}
function frameFromVideo(video){let c=document.createElement('canvas'),w=video.videoWidth||1280,h=video.videoHeight||720;c.width=w;c.height=h;c.getContext('2d').drawImage(video,0,0,w,h);return c}
async function ocrVideoCodes(video,msg){if(!video||!video.videoWidth){msg.textContent='カメラ映像がまだ準備できていません。';return null}msg.textContent='印刷文字を認識中… 数秒かかることがあります。';if(!(await loadTesseract())){msg.textContent='文字認識機能を読み込めませんでした。';return null}try{let r=await Tesseract.recognize(frameFromVideo(video),'eng'),p=parsePrintedBookCodes(r.data?.text||'');msg.textContent=p.isbn||p.ccode||p.price?`認識：${p.isbn?'ISBN '+p.isbn+' ':''}${p.ccode?p.ccode+' ':''}${p.price?'本体価格 '+p.price+'円':''}`:'ISBN/Cコード/価格を認識できませんでした。文字を大きく、水平に写して再度お試しください。';return p}catch(e){msg.textContent='文字認識に失敗しました。もう一度お試しください。';return null}}

let shopStream=null,shopScanning=false; let shopControls=null;
const normIsbn=s=>String(s||"").replace(/\D/g,"");
let zxingLoadPromise=null;
function loadZXing(){
  if(window.ZXingBrowser?.BrowserMultiFormatReader)return Promise.resolve(true);
  if(zxingLoadPromise)return zxingLoadPromise;
  const urls=[
    "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js",
    "https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js"
  ];
  zxingLoadPromise=new Promise(resolve=>{
    let i=0;
    const next=()=>{
      if(i>=urls.length){resolve(false);return;}
      const sc=document.createElement("script");
      sc.src=urls[i++];sc.async=true;
      sc.onload=()=>resolve(!!window.ZXingBrowser?.BrowserMultiFormatReader);
      sc.onerror=next;
      document.head.appendChild(sc);
    };
    next();
  });
  return zxingLoadPromise;
}
function shopTitleNorm(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/[\s　・･:：!?！？「」『』（）()【】\[\]ー\-]/g,'').replace(/新版|改訂版|新装版/g,'')}
function shopSimilarity(a,b){a=shopTitleNorm(a);b=shopTitleNorm(b);if(!a||!b)return 0;if(a===b)return 100;if(a.includes(b)||b.includes(a))return 90;let n=Math.min(a.length,b.length),same=0;for(let i=0;i<n;i++)if(a[i]===b[i])same++;return Math.round(same/Math.max(a.length,b.length)*100)}
function openExistingForMerge(id,isbn,bib){const b=books().find(x=>x.id===id);if(!b)return;overrides[id]={...(overrides[id]||{}),isbn:isbn||b.isbn||'',author:b.author||bib?.author||'',publisher:b.publisher||bib?.publisher||'',listPrice:b.listPrice||bib?.price||''};save();draw();if($('#shopCheck').open)$('#shopCheck').close();openEdit(id)}
function renderShelfSearch(isbn,bib){let q=$('#shopShelfQuery')?.value||bib?.title||'',n=shopTitleNorm(q),a=books().map(b=>({b,score:shopSimilarity(q,b.title)})).filter(x=>!n||shopTitleNorm(x.b.title).includes(n)||n.includes(shopTitleNorm(x.b.title))||x.score>=35).sort((x,y)=>y.score-x.score).slice(0,15);let el=$('#shopShelfResults');if(!el)return;el.innerHTML=a.length?a.map(x=>`<button type="button" class="shelfmatch" data-mergebook="${esc(x.b.id)}"><b>${esc(x.b.title)}</b><small>${esc(x.b.author||'作者未登録')}｜${esc(x.b.publisher||'出版社未登録')}</small><span>この本に情報を統合して編集</span></button>`).join(''):'<div class="shop-empty">本棚に候補がありません。検索語を短くしてみてください。</div>';$$('[data-mergebook]').forEach(btn=>btn.onclick=()=>openExistingForMerge(btn.dataset.mergebook,isbn,bib))}
async function showShopResult(isbn){
 const n=normIsbn(isbn);$('#shopIsbn').value=n;
 if(!(n.length===10||n.length===13)){ $('#shopResult').innerHTML='<div class="shop-empty">ISBNは10桁または13桁で入力してください。</div>';return}
 const exact=books().find(x=>normIsbn(x.isbn)===n);
 if(exact){$('#shopResult').innerHTML=`<div class="shop-owned"><div class="shop-status">✓ 所有済み</div><div class="shop-title">${esc(exact.title||'')}</div><div class="shop-meta">${esc(exact.author||'作者未登録')} ｜ ${esc(exact.publisher||'出版社未登録')}</div><button type="button" id="editOwnedShop" class="shop-register-btn">この本を編集</button></div>`;$('#editOwnedShop').onclick=()=>{$('#shopCheck').close();openEdit(exact.id)};return}
 $('#shopResult').innerHTML='<div class="shop-empty">書誌情報と本棚を照合中…</div>';
 let bib=null;try{bib=window.fetchBibData?await window.fetchBibData(n):null}catch(e){}
 let ranked=bib?.title?books().map(b=>({b,score:shopSimilarity(bib.title,b.title)})).filter(x=>x.score>=55).sort((a,b)=>b.score-a.score).slice(0,5):[];
 let candidates=ranked.map(x=>`<button type="button" class="shelfmatch" data-shopcandidate="${esc(x.b.id)}"><b>${esc(x.b.title)}</b><small>${esc(x.b.author||'作者未登録')}｜${esc(x.b.publisher||'出版社未登録')}　照合度 ${x.score}%</small><span>この本にISBN・書誌情報を統合</span></button>`).join('');
 $('#shopResult').innerHTML=`<div class="shop-notowned"><div class="shop-status">${ranked.length?'所有候補があります':'ISBN一致なし'}</div>${bib?.title?`<div class="shop-title">${esc(bib.title)}</div><div class="shop-meta">${esc(bib.author||'作者情報なし')}${bib.publisher?' ｜ '+esc(bib.publisher):''}</div>`:'<div>書誌情報を取得できませんでした。</div>'}<div class="shop-meta">ISBN ${esc(n)}</div>${ranked.length?`<h4>本棚の所有候補</h4>${candidates}`:''}<h4>本棚から検索して統合</h4><div class="shop-input-row"><input id="shopShelfQuery" value="${esc(bib?.title||'')}" placeholder="本棚のタイトルを検索"><button id="shopShelfSearchBtn" type="button">検索</button></div><div id="shopShelfResults"></div><button type="button" id="shopToRegister" class="shop-register-btn">本棚にないので新規登録</button></div>`;
 $$('[data-shopcandidate]').forEach(btn=>btn.onclick=()=>openExistingForMerge(btn.dataset.shopcandidate,n,bib));$('#shopShelfSearchBtn').onclick=()=>renderShelfSearch(n,bib);$('#shopShelfQuery').addEventListener('input',()=>renderShelfSearch(n,bib));renderShelfSearch(n,bib);$('#shopToRegister').onclick=async()=>{openRegisterWithIsbn(n);if(bib){if(!$('#rTitle').value)$('#rTitle').value=bib.title||'';if(!$('#rAuthor').value)$('#rAuthor').value=bib.author||'';if(!$('#rPublisher').value)$('#rPublisher').value=bib.publisher||''}}
}

async function stopShopCamera(){
  shopScanning=false;
  try{if(shopControls)shopControls.stop()}catch(e){}
  shopControls=null;
  if(shopStream){try{shopStream.getTracks().forEach(t=>t.stop())}catch(e){}shopStream=null}
  const v=$("#barcodeVideo");if(v){try{v.pause()}catch(e){}try{v.srcObject=null}catch(e){}}
  $("#cameraArea").hidden=true;if($("#shopOcrCode"))$("#shopOcrCode").hidden=true;
}
async function startShopCamera(){
  if(shopScanning)return;
  if(!navigator.mediaDevices?.getUserMedia){
    alert("このブラウザではカメラを利用できません。ISBNを手入力してください。");return;
  }
  if(!(await loadZXing())){
    alert("バーコード読取機能を読み込めませんでした。ISBNの手入力はそのまま利用できます。");return;
  }
  shopScanning=true;$("#cameraArea").hidden=false;$("#shopOcrCode").hidden=false;
  $("#shopResult").innerHTML='<div class="shop-neutral">カメラを本のISBNバーコードに向けてください。</div>';
  try{
    const reader=new ZXingBrowser.BrowserMultiFormatReader();
    shopControls=await reader.decodeFromConstraints(
      {audio:false,video:{facingMode:{ideal:"environment"}}},
      $("#barcodeVideo"),
      (result,error,controls)=>{
        if(!result)return;
        const n=normIsbn(typeof result.getText==="function"?result.getText():(result.text||""));
        if(n.length===13&&(n.startsWith("978")||n.startsWith("979"))){
          $("#shopIsbn").value=n;
          try{controls.stop()}catch(e){}
          shopControls=null;shopScanning=false;$("#cameraArea").hidden=true;
          showShopResult(n);
        }
      }
    );
  }catch(e){
    await stopShopCamera();
    alert("カメラを起動できませんでした。iPhoneのカメラ許可を確認してください。ISBNの手入力は利用できます。");
  }
}
const shopBtn=$("#openShopCheck");if(shopBtn)shopBtn.onclick=()=>{$("#menu").hidden=true;$("#shopCheck").showModal()};
$("#shopClose").onclick=async()=>{await stopShopCamera();$("#shopCheck").close()};
$("#shopSearch").onclick=()=>showShopResult($("#shopIsbn").value);
$("#shopIsbn").addEventListener("keydown",e=>{if(e.key==="Enter")showShopResult(e.target.value)});
$("#shopOcrCode").onclick=async()=>{let p=await ocrVideoCodes($("#barcodeVideo"),$("#shopCodeMsg"));if(p?.isbn){$("#shopIsbn").value=p.isbn;await stopShopCamera();showShopResult(p.isbn)}};
$("#startScan").onclick=()=>{try{Promise.resolve(startShopCamera()).catch(()=>alert("カメラ機能を開始できませんでした。ISBNの手入力は利用できます。"))}catch(e){alert("カメラ機能を開始できませんでした。ISBNの手入力は利用できます。")}};$("#shopCheck").addEventListener("close",stopShopCamera);

let editControls=null,editScanning=false;
async function stopEditCamera(){editScanning=false;try{if(editControls)editControls.stop()}catch(e){}editControls=null;const v=$("#editBarcodeVideo");if(v){try{v.pause()}catch(e){}try{v.srcObject=null}catch(e){}}const a=$("#editCameraArea");if(a)a.hidden=true;if($("#editOcrCode"))$("#editOcrCode").hidden=true}
async function startEditCamera(){
 if(editScanning)return;
 if(!navigator.mediaDevices?.getUserMedia){alert("このブラウザではカメラを利用できません。");return}
 if(!(await loadZXing())){alert("バーコード読取機能を読み込めませんでした。");return}
 editScanning=true;$("#editCameraArea").hidden=false;$("#editOcrCode").hidden=false;$("#editCodeMsg").textContent="978/979（ISBN）または192コードにカメラを向けてください。";
 try{
  const reader=new ZXingBrowser.BrowserMultiFormatReader();
  editControls=await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:"environment"}}},$("#editBarcodeVideo"),(result,error,controls)=>{
   if(!result)return;const n=normIsbn(typeof result.getText==="function"?result.getText():(result.text||""));
   if(n.length===13&&(n.startsWith("978")||n.startsWith("979"))){$("#eisbn").value=n;$("#editCodeMsg").textContent="ISBNを読み取りました。書誌情報を検索します。続けて192コードも読み取れます。";if(window.lookupBib)window.lookupBib(n);return}
   const p=parseJan2(n);if(p){$("#ejan2").value=p.jan2;$("#eccode").value=p.ccode;$("#eprice").value=p.price;$("#editCodeMsg").textContent=`192コードを読み取りました：${p.ccode}／本体価格 ${Number(p.price).toLocaleString()}円`;return}
  });
 }catch(e){await stopEditCamera();alert("カメラを起動できませんでした。iPhoneのカメラ許可を確認してください。");}
}
$("#editOcrCode").onclick=async()=>{let p=await ocrVideoCodes($("#editBarcodeVideo"),$("#editCodeMsg"));if(!p)return;if(p.isbn){$("#eisbn").value=p.isbn;if(window.lookupBib)window.lookupBib(p.isbn)}if(p.ccode)$("#eccode").value=p.ccode;if(p.price)$("#eprice").value=p.price};
const editScan=$("#editScanCode");if(editScan)editScan.onclick=()=>{try{Promise.resolve(startEditCamera()).catch(()=>alert("カメラ機能を開始できませんでした。"))}catch(e){alert("カメラ機能を開始できませんでした。")}};
$("#ejan2").addEventListener("input",e=>{const p=parseJan2(e.target.value);if(p){$("#eccode").value=p.ccode;$("#eprice").value=p.price}});
$("#edit").addEventListener("close",stopEditCamera);

let registerControls=null,registerScanning=false;
async function stopRegisterCamera(){registerScanning=false;try{if(registerControls)registerControls.stop()}catch(e){}registerControls=null;let v=$('#registerBarcodeVideo');if(v){try{v.pause()}catch(e){}try{v.srcObject=null}catch(e){}}$('#registerCameraArea').hidden=true;$('#registerOcrCode').hidden=true}
async function startRegisterCamera(){if(registerScanning)return;if(!(await loadZXing())){alert('バーコード読取機能を読み込めませんでした。');return}registerScanning=true;$('#registerCameraArea').hidden=false;$('#registerOcrCode').hidden=false;$('#registerCodeMsg').textContent='バーコード、または印刷されたISBN/Cコード/価格を読み取れます。';try{let reader=new ZXingBrowser.BrowserMultiFormatReader();registerControls=await reader.decodeFromConstraints({audio:false,video:{facingMode:{ideal:'environment'}}},$('#registerBarcodeVideo'),(result,error,controls)=>{if(!result)return;let n=normIsbn(typeof result.getText==='function'?result.getText():(result.text||''));if(n.length===13&&(n.startsWith('978')||n.startsWith('979'))){$('#rIsbn').value=n;$('#registerCodeMsg').textContent='ISBNバーコードを読み取りました。';lookupRegisterBib();return}let p=parseJan2(n);if(p){$('#rCcode').value=p.ccode;$('#rPrice').value=p.price;$('#registerCodeMsg').textContent=`192コード：${p.ccode}／本体価格 ${p.price}円`}})}catch(e){await stopRegisterCamera();alert('カメラを起動できませんでした。')}}
$('#registerScanCode').onclick=()=>startRegisterCamera();$('#registerOcrCode').onclick=async()=>{let p=await ocrVideoCodes($('#registerBarcodeVideo'),$('#registerCodeMsg'));if(!p)return;if(p.isbn){$('#rIsbn').value=p.isbn;lookupRegisterBib()}if(p.ccode)$('#rCcode').value=p.ccode;if(p.price)$('#rPrice').value=p.price};$('#registerBook').addEventListener('close',stopRegisterCamera);

draw();
})();