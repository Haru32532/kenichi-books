(()=>{"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const MASTER=Array.isArray(window.MASTER_333)?window.MASTER_333:[];
const KEY="kenchan_clean_overrides_v1", TAGKEY="kenchan_clean_tags_v1";
let overrides={}, tags=[], filter="all", ageFilter="all", bulk=false, selected=new Set();
try{overrides=JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){}
try{tags=JSON.parse(localStorage.getItem(TAGKEY)||"[]")||[]}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(overrides));localStorage.setItem(TAGKEY,JSON.stringify(tags))}catch(e){}};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const books=()=>MASTER.map(b=>({...b,...(overrides[b.id]||{}),tags:Array.isArray(overrides[b.id]?.tags)?overrides[b.id].tags:(b.tags||[])})).filter(b=>!b.deleted);
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
function draw(){let a=books(),q=$("#search").value.trim().toLowerCase();a=a.filter(b=>[b.title,b.author,b.publisher,b.isbn,(b.tags||[]).join(" "),agesOf(b).join(" ")].join(" ").toLowerCase().includes(q));if(ageFilter!=="all")a=a.filter(b=>agesOf(b).includes(ageFilter));if(filter==="favorite")a=a.filter(b=>b.favorite);else if(filter!=="all")a=a.filter(b=>(b.tags||[]).includes(filter));$("#count").textContent=`${books().length}冊（表示 ${a.length}冊）`;drawAges();$("#status").innerHTML=MASTER.length===333?"✓ 333冊の蔵書マスターを読み込みました。":"蔵書マスターの読み込みに問題があります。";drawTags();$("#list").innerHTML=a.map(b=>`<div class="book">${bulk?`<input class="pick" type="checkbox" data-pick="${esc(b.id)}" ${selected.has(b.id)?"checked":""}>`:""}<div class="bookmain" data-edit="${esc(b.id)}"><b>${b.favorite?"★ ":""}${esc(b.title)}</b><small>${esc(b.author||"作者未登録")}｜${esc(b.publisher||"出版社未登録")}</small>${(b.tags||[]).length?`<div class="tagline">${b.tags.map(t=>"#"+esc(t)).join(" ")}</div>`:""}</div></div>`).join("");$$("[data-edit]").forEach(x=>x.onclick=()=>{if(!bulk)openEdit(x.dataset.edit)});$$("[data-pick]").forEach(x=>x.onchange=()=>{x.checked?selected.add(x.dataset.pick):selected.delete(x.dataset.pick);$("#selected").textContent=selected.size+"冊"})}
function openEdit(id){let b=books().find(x=>x.id===id);if(!b)return;$("#eid").value=id;$("#etitle").value=b.title||"";$("#eauthor").value=b.author||"";$("#epublisher").value=b.publisher||"";$("#eisbn").value=b.isbn||"";renderEditChecks(b);$("#efav").checked=!!b.favorite;$("#enotes").value=b.notes||"";$("#edit").showModal()}
$("#save").onclick=()=>{let id=$("#eid").value, nt=$$("[data-etag]:checked").map(x=>x.dataset.etag), na=$$("[data-eage]:checked").map(x=>x.dataset.eage);nt.forEach(t=>{if(!tags.includes(t))tags.push(t)});overrides[id]={...(overrides[id]||{}),title:$("#etitle").value.trim(),author:$("#eauthor").value.trim(),publisher:$("#epublisher").value.trim(),isbn:$("#eisbn").value.replace(/\D/g,""),ages:na,tags:nt,favorite:$("#efav").checked,notes:$("#enotes").value.trim()};save();$("#edit").close();draw()};
$("#cancel").onclick=()=>$("#edit").close();
$("#editNewTag").onclick=()=>{let t=(prompt("新しいタグ名")||"").trim();if(t&&!tags.includes(t)){tags.push(t);save()}let b=books().find(x=>x.id===$("#eid").value);if(b)renderEditChecks(b)};
$("#deleteBook").onclick=()=>{let id=$("#eid").value,b=books().find(x=>x.id===id);if(!b)return;if(confirm(`「${b.title}」を本棚から削除しますか？`)){overrides[id]={...(overrides[id]||{}),deleted:true};save();$("#edit").close();draw()}};$("#search").oninput=draw;
$("#newTag").onclick=()=>{let t=prompt("新しいタグ名");t=(t||"").trim();if(t&&!tags.includes(t)){tags.push(t);save();draw()}};
$("#bulkOn").onclick=()=>{bulk=true;selected.clear();$("#bulkBar").hidden=false;draw()};$("#bulkOff").onclick=()=>{bulk=false;selected.clear();$("#bulkBar").hidden=true;draw()};
function bulkAge(remove){let a=$("#bulkAge").value;if(!a)return;selected.forEach(id=>{let b=books().find(x=>x.id===id), ar=agesOf(b);ar=remove?ar.filter(x=>x!==a):[...new Set([...ar,a])];overrides[id]={...(overrides[id]||{}),ages:ar}});save();draw()}
$("#addAge").onclick=()=>bulkAge(false);$("#removeAge").onclick=()=>bulkAge(true);
function bulkTag(remove){let t=$("#bulkTag").value;if(!t)return;selected.forEach(id=>{let b=books().find(x=>x.id===id), a=[...(b?.tags||[])];a=remove?a.filter(x=>x!==t):[...new Set([...a,t])];overrides[id]={...(overrides[id]||{}),tags:a}});save();draw()}
$("#addTag").onclick=()=>bulkTag(false);$("#removeTag").onclick=()=>bulkTag(true);
$("#menuBtn").onclick=()=>$("#menu").hidden=!$("#menu").hidden;$("#menuShelf").onclick=()=>$("#menu").hidden=true;

let shopStream=null,shopScanning=false;
const normIsbn=s=>String(s||"").replace(/\D/g,"");
function showShopResult(isbn){
 const n=normIsbn(isbn);$("#shopIsbn").value=n;
 if(!(n.length===10||n.length===13)){ $("#shopResult").innerHTML='<div class="shop-empty">ISBNは10桁または13桁で入力してください。</div>';return}
 const b=books().find(x=>normIsbn(x.isbn)===n);
 $("#shopResult").innerHTML=b?`<div class="shop-owned"><div class="shop-status">✓ 所有済み</div><div class="shop-title">${esc(b.title||"")}</div><div class="shop-meta">${esc(b.author||"作者未登録")} ｜ ${esc(b.publisher||"出版社未登録")}</div><div class="shop-meta">ISBN ${esc(n)}</div></div>`:`<div class="shop-notowned"><div class="shop-status">未所有</div><div>このISBNは現在の本棚には登録されていません。</div><div class="shop-meta">ISBN ${esc(n)}</div></div>`;
}
async function stopShopCamera(){shopScanning=false;if(shopStream){shopStream.getTracks().forEach(t=>t.stop());shopStream=null}const v=$("#barcodeVideo");if(v)v.srcObject=null;$("#cameraArea").hidden=true}
async function startShopCamera(){
 if(!("BarcodeDetector" in window)){alert("このブラウザではバーコード自動読取に対応していません。ISBNを手入力してください。");return}
 try{const d=new BarcodeDetector({formats:["ean_13","ean_8"]});shopStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});const v=$("#barcodeVideo");v.srcObject=shopStream;await v.play();$("#cameraArea").hidden=false;shopScanning=true;
 const loop=async()=>{if(!shopScanning)return;try{const c=await d.detect(v);if(c.length){const raw=normIsbn(c[0].rawValue);if(raw.length===13&&(raw.startsWith("978")||raw.startsWith("979"))){showShopResult(raw);await stopShopCamera();return}}}catch(e){}requestAnimationFrame(loop)};loop()
 }catch(e){await stopShopCamera();alert("カメラを使用できませんでした。ISBNを手入力してください。")}
}
const shopBtn=$("#openShopCheck");if(shopBtn)shopBtn.onclick=()=>$("#shopCheck").showModal();
$("#shopClose").onclick=async()=>{await stopShopCamera();$("#shopCheck").close()};
$("#shopSearch").onclick=()=>showShopResult($("#shopIsbn").value);
$("#shopIsbn").addEventListener("keydown",e=>{if(e.key==="Enter")showShopResult(e.target.value)});
$("#startScan").onclick=startShopCamera;$("#shopCheck").addEventListener("close",stopShopCamera);

draw();
})();