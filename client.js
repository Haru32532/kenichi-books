(()=>{"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const MASTER=Array.isArray(window.MASTER_333)?window.MASTER_333:[];
const KEY="kenchan_clean_overrides_v1", TAGKEY="kenchan_clean_tags_v1";
let overrides={}, tags=[], filter="all", bulk=false, selected=new Set();
try{overrides=JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){}
try{tags=JSON.parse(localStorage.getItem(TAGKEY)||"[]")||[]}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(overrides));localStorage.setItem(TAGKEY,JSON.stringify(tags))}catch(e){}};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const books=()=>MASTER.map(b=>({...b,...(overrides[b.id]||{}),tags:Array.isArray(overrides[b.id]?.tags)?overrides[b.id].tags:(b.tags||[])}));
function allTags(){let s=new Set(tags);books().forEach(b=>(b.tags||[]).forEach(t=>s.add(t)));return [...s].filter(Boolean).sort((a,b)=>a.localeCompare(b,"ja"))}
function drawTags(){let a=allTags();$("#tagTabs").innerHTML=[["all","すべて"],["favorite","★お気に入り"],...a.map(t=>[t,t])].map(([v,l])=>`<button data-filter="${esc(v)}" class="${filter===v?"active":""}">${esc(l)}</button>`).join("");$("#bulkTag").innerHTML=a.map(t=>`<option>${esc(t)}</option>`).join("");$$("[data-filter]").forEach(x=>x.onclick=()=>{filter=x.dataset.filter;draw()})}
function draw(){let a=books(),q=$("#search").value.trim().toLowerCase();a=a.filter(b=>[b.title,b.author,b.publisher,b.isbn,(b.tags||[]).join(" ")].join(" ").toLowerCase().includes(q));if(filter==="favorite")a=a.filter(b=>b.favorite);else if(filter!=="all")a=a.filter(b=>(b.tags||[]).includes(filter));$("#count").textContent=`${MASTER.length}冊（表示 ${a.length}冊）`;$("#status").innerHTML=MASTER.length===333?"✓ 333冊の蔵書マスターを読み込みました。":"蔵書マスターの読み込みに問題があります。";drawTags();$("#list").innerHTML=a.map(b=>`<div class="book">${bulk?`<input class="pick" type="checkbox" data-pick="${esc(b.id)}" ${selected.has(b.id)?"checked":""}>`:""}<div class="bookmain" data-edit="${esc(b.id)}"><b>${b.favorite?"★ ":""}${esc(b.title)}</b><small>${esc(b.author||"作者未登録")}｜${esc(b.publisher||"出版社未登録")}</small>${(b.tags||[]).length?`<div class="tagline">${b.tags.map(t=>"#"+esc(t)).join(" ")}</div>`:""}</div></div>`).join("");$$("[data-edit]").forEach(x=>x.onclick=()=>{if(!bulk)openEdit(x.dataset.edit)});$$("[data-pick]").forEach(x=>x.onchange=()=>{x.checked?selected.add(x.dataset.pick):selected.delete(x.dataset.pick);$("#selected").textContent=selected.size+"冊"})}
function openEdit(id){let b=books().find(x=>x.id===id);if(!b)return;$("#eid").value=id;$("#etitle").value=b.title||"";$("#eauthor").value=b.author||"";$("#epublisher").value=b.publisher||"";$("#eisbn").value=b.isbn||"";$("#eage").value=b.age||"";$("#etags").value=(b.tags||[]).join(", ");$("#efav").checked=!!b.favorite;$("#enotes").value=b.notes||"";$("#edit").showModal()}
$("#save").onclick=()=>{let id=$("#eid").value, nt=[...new Set($("#etags").value.split(/[,、]/).map(x=>x.trim()).filter(Boolean))];nt.forEach(t=>{if(!tags.includes(t))tags.push(t)});overrides[id]={...(overrides[id]||{}),title:$("#etitle").value.trim(),author:$("#eauthor").value.trim(),publisher:$("#epublisher").value.trim(),isbn:$("#eisbn").value.replace(/\D/g,""),age:$("#eage").value.trim(),tags:nt,favorite:$("#efav").checked,notes:$("#enotes").value.trim()};save();$("#edit").close();draw()};
$("#cancel").onclick=()=>$("#edit").close();$("#search").oninput=draw;
$("#newTag").onclick=()=>{let t=prompt("新しいタグ名");t=(t||"").trim();if(t&&!tags.includes(t)){tags.push(t);save();draw()}};
$("#bulkOn").onclick=()=>{bulk=true;selected.clear();$("#bulkBar").hidden=false;draw()};$("#bulkOff").onclick=()=>{bulk=false;selected.clear();$("#bulkBar").hidden=true;draw()};
function bulkTag(remove){let t=$("#bulkTag").value;if(!t)return;selected.forEach(id=>{let b=books().find(x=>x.id===id), a=[...(b?.tags||[])];a=remove?a.filter(x=>x!==t):[...new Set([...a,t])];overrides[id]={...(overrides[id]||{}),tags:a}});save();draw()}
$("#addTag").onclick=()=>bulkTag(false);$("#removeTag").onclick=()=>bulkTag(true);
$("#menuBtn").onclick=()=>$("#menu").hidden=!$("#menu").hidden;$("#menuShelf").onclick=()=>$("#menu").hidden=true;
draw();
})();