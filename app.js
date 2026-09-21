const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];let books=[],targets=[],editId=null,session=null;const coll=new Intl.Collator("ja",{numeric:true}),norm=s=>(s||"").normalize("NFKC").toLowerCase().replace(/[\s　・･\-―ー]/g,""),esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));function save(){localStorage.setItem("kb",JSON.stringify(books))}
// 既存の蔵書データに不足しているISBNを補完
const savedBooks = JSON.parse(localStorage.getItem('kb') || 'null');

if (Array.isArray(savedBooks)) {
  const moonBook = savedBooks.find(b => b.title === '14ひきのおつきみ');

  if (moonBook && !moonBook.isbn) {
    moonBook.isbn = '9784494006830';
    localStorage.setItem('kb', JSON.stringify(savedBooks));
  }
const halloweenBook = savedBooks.find(
  b => b.title === 'ハロウィンドキドキおばけの日 ますだゆうこ'
);

if (halloweenBook) {
  halloweenBook.title = 'ハロウィンドキドキおばけの日！';
  localStorage.setItem('kb', JSON.stringify(savedBooks));
}
}
async function init(){books=JSON.parse(localStorage.getItem("kb")||"null")||await fetch("/initial_books.json").then(r=>r.json());render()}
function cmp(a,b){let s=$("#sort").value;if(s==="author")return coll.compare(a.author||"ん",b.author||"ん");if(s==="publisher")return coll.compare(a.publisher||"ん",b.publisher||"ん");if(s==="priceAsc")return(a.usedMin??1e9)-(b.usedMin??1e9);if(s==="priceDesc")return(b.usedMax??-1)-(a.usedMax??-1);if(s==="mercariAsc")return(a.mercariPrice??1e9)-(b.mercariPrice??1e9);if(s==="rakumaAsc")return(a.rakumaPrice??1e9)-(b.rakumaPrice??1e9);if(s==="valuebooksAsc")return(a.valuebooksPrice??1e9)-(b.valuebooksPrice??1e9);if(s==="rarity")return"SABC".indexOf(a.rarity||"Z")-"SABC".indexOf(b.rarity||"Z");if(s==="priority")return"SABC".indexOf(a.priority||"Z")-"SABC".indexOf(b.priority||"Z");return coll.compare(a.title,b.title)}
function bookTags(b){let a=[];if(b.kumonLevel)a.push("くもん"+b.kumonLevel);if(Array.isArray(b.genreTags))a.push(...b.genreTags);else if(b.genre)a.push(b.genre);return[...new Set(a.filter(Boolean))]}
function render(){let q=norm($("#q").value),gf=$("#genreFilter")?.value||"",a=books.filter(b=>(!q||norm([b.title,b.author,b.publisher,b.isbn,...bookTags(b)].join(" ")).includes(q))&&(!gf||bookTags(b).some(t=>t===gf||t.includes(gf)))).sort(cmp);$("#stats").innerHTML=`<div class=stat><b>${books.length}</b><br>所有タイトル</div><div class=stat><b>${books.filter(b=>b.isbn).length}</b><br>ISBN登録</div><div class=stat><b>${books.reduce((n,b)=>n+(+b.readCount||0),0)}</b><br>読み聞かせ</div><div class=stat><b>${books.filter(b=>b.rarity==="S").length}</b><br>レアS</div>`;$("#list").innerHTML=a.map(b=>`<div class=book data-id="${b.id}"><div><b>${esc(b.title)}</b><div class=tags>${bookTags(b).map(t=>`<span class=tag>${esc(t)}</span>`).join("")}</div></div><div>${esc(b.author||"")}<br><small>作者</small></div><div>${esc(b.publisher||"")}<br><small>出版社</small></div><div>${b.usedMin!=null?`中古 ¥${b.usedMin}〜${b.usedMax??b.usedMin}`:"相場未設定"}<br><small>${b.mercariPrice!=null?`メルカリ ¥${b.mercariPrice}`:""} ${b.rakumaPrice!=null?`/ ラクマ ¥${b.rakumaPrice}`:""} ${b.valuebooksPrice!=null?`/ VB ¥${b.valuebooksPrice}`:""}</small></div><div>${b.rarity?`レア${b.rarity}`:""}<br>${b.priority?`優先${b.priority}`:""}</div></div>`).join("");$$(".book").forEach(x=>x.onclick=()=>openEdit(x.dataset.id));missing()}
$$("nav button").forEach(b=>b.onclick=()=>{$$("nav button,.tab").forEach(x=>x.classList.remove("on"));b.classList.add("on");$("#"+b.dataset.tab).classList.add("on")});$("#q").oninput=render;$("#sort").onchange=render;$("#genreFilter").onchange=render;$("#pdf").onclick=()=>print();$("#add").onclick=()=>openEdit();$("#cancel").onclick=()=>$("#edit").close();
function openEdit(id){editId=id||null;let b=books.find(x=>x.id===id)||{},f=$("#edit form");["title","author","publisher","isbn","usedMin","usedMax","mercariPrice","rakumaPrice","valuebooksPrice","rarity","priority","kumonLevel"].forEach(k=>f.elements[k].value=b[k]??"");f.elements.genreTagsText.value=(Array.isArray(b.genreTags)?b.genreTags:[b.genre].filter(Boolean)).join(",");$("#edit").showModal()}$("#edit form").onsubmit=e=>{e.preventDefault();let f=e.target,v=Object.fromEntries(new FormData(f)),b=books.find(x=>x.id===editId);if(!b){b={id:crypto.randomUUID(),owned:true,readCount:0};books.push(b)}Object.assign(b,v,{genreTags:v.genreTagsText.split(/[,、]/).map(x=>x.trim()).filter(Boolean),usedMin:v.usedMin===""?null:+v.usedMin,usedMax:v.usedMax===""?null:+v.usedMax,mercariPrice:v.mercariPrice===""?null:+v.mercariPrice,rakumaPrice:v.rakumaPrice===""?null:+v.rakumaPrice,valuebooksPrice:v.valuebooksPrice===""?null:+v.valuebooksPrice,marketCheckedAt:new Date().toISOString()});delete b.genreTagsText;save();$("#edit").close();render()}
async function lookup(code){code=(code||"").replace(/\D/g,"");if(code.length!==13)throw Error("13桁で入力してください");let hit=books.find(b=>b.isbn===code),j=await fetch(`https://api.openbd.jp/v1/get?isbn=${code}`).then(r=>r.json()),s=j?.[0]?.summary||{};return{hit,info:{isbn:code,title:s.title||hit?.title||"",author:s.author||hit?.author||"",publisher:s.publisher||hit?.publisher||""}}}
function marketLinks(info){let term=encodeURIComponent([info.title,info.author].filter(Boolean).join(" "));return{
mercari:`https://jp.mercari.com/search?keyword=${term}`,
rakuma:`https://fril.jp/s?query=${term}`,
valuebooks:`https://search.rakuten.co.jp/search/mall/${term}%20VALUE%20BOOKS/`
}}
function yen(v){return v==null||v===""?"未記録":`¥${Number(v).toLocaleString("ja-JP")}`}
function priceDecision(hit,storePrice,maxPrice){
 let pairs=[
  ["BOOKOFF",storePrice],
  ["メルカリ",hit?.mercariPrice],
  ["ラクマ",hit?.rakumaPrice],
  ["VALUE BOOKS",hit?.valuebooksPrice]
 ].filter(x=>x[1]!=null&&x[1]!==""&&!Number.isNaN(+x[1])).map(x=>[x[0],+x[1]]);
 if(!pairs.length)return{cls:"unknown",text:"比較価格がまだありません",cheapest:""};
 pairs.sort((a,b)=>a[1]-b[1]);
 let cheapest=`最安記録：${pairs[0][0]} ${yen(pairs[0][1])}`;
 if(storePrice!=null&&storePrice!==""&&maxPrice!=null&&maxPrice!==""){
   return +storePrice<=+maxPrice?{cls:"buy",text:`設定上限 ${yen(maxPrice)} 以下 → 購入候補`,cheapest}:{cls:"wait",text:`設定上限 ${yen(maxPrice)} を超過 → 見送り候補`,cheapest};
 }
 if(storePrice!=null&&storePrice!==""&&pairs[0][0]==="BOOKOFF")return{cls:"buy",text:"登録済み比較価格の中ではBOOKOFFが最安",cheapest};
 return{cls:"unknown",text:"上限金額を入れると購入判定できます",cheapest};
}
async function findBook(code){
 try{
  let{hit,info}=await lookup(code),links=marketLinks(info);
  if (!hit) {
  hit = linkScannedIsbn(info);
　}
  let storePrice=$("#storePrice").value===""?null:+$("#storePrice").value;
  let maxPrice=$("#maxPrice").value===""?null:+$("#maxPrice").value;
  let d=priceDecision(hit,storePrice,maxPrice);
  let ceiling=maxPrice!=null?`&nbsp;／&nbsp;検索上限 <b>${yen(maxPrice)}</b>`:"";
  $("#scanout").innerHTML=`<div class=result><h3>${esc(info.title||"書誌情報なし")}</h3><b>${hit?"✅ 所有済み":"🟢 未所有"}</b>
  <p>${esc(info.author)}<br>${esc(info.publisher)}<br>${esc(info.isbn)}</p>
  <p>BOOKOFF店頭価格：<b>${yen(storePrice)}</b>${ceiling}</p>
  <div class="decision ${d.cls}">${d.text}<br><small>${d.cheapest}</small></div>
  <div class=market-grid>
  <div class="market-card">
  <b>メルカリ</b>
  <small>目立った傷や汚れなし以上</small>
  <p>${yen(hit?.mercariPrice)}</p>
  <a target="_blank" rel="noopener" href="${links.mercari}">メルカリで検索</a>
  ${hit ? `<button type="button" onclick="saveMarketPrice('${code}','mercariPrice')">価格を記録</button>` : ""}
</div>

<div class="market-card">
  <b>ラクマ</b>
  <small>目立った傷や汚れなし以上</small>
  <p>${yen(hit?.rakumaPrice)}</p>
  <a target="_blank" rel="noopener" href="${links.rakuma}">ラクマで検索</a>
  ${hit ? `<button type="button" onclick="saveMarketPrice('${code}','rakumaPrice')">価格を記録</button>` : ""}
</div>

<div class="market-card">
  <b>VALUE BOOKS</b>
  <small>「良い」以上</small>
  <p>${yen(hit?.valuebooksPrice)}</p>
  <a target="_blank" rel="noopener" href="${links.valuebooks}">楽天で検索</a>
  ${hit ? `<button type="button" onclick="saveMarketPrice('${code}','valuebooksPrice')">価格を記録</button>` : ""}
</div>
  <p><small>※検索上限金額はアプリ内の購入判定条件です。外部サイト側の検索結果をその金額以下に自動絞り込みできない場合があります。</small></p>
  ${hit?`<button id=editmarket>比較価格を入力・更新</button>`:`<button id=reg>所有本に登録</button>`}</div>`;
  if(!hit)$("#reg").onclick=()=>{
    books.push({...info,id:crypto.randomUUID(),owned:true,readCount:0,usedMin:null,usedMax:null,mercariPrice:null,rakumaPrice:null,valuebooksPrice:null,rarity:"",priority:"",genreTags:[],kumonLevel:"",purchasePrice:storePrice});
    save();render();findBook(code)
  };
  else{
    if(storePrice!=null){hit.purchasePrice=storePrice;save()}
    $("#editmarket").onclick=()=>openEdit(hit.id)
  }
 }catch(e){$("#scanout").textContent=e.message}
}// 中古価格を簡単に記録する
window.saveMarketPrice = function(isbn, market) {
  const book = books.find(b => b.isbn === isbn);

  if (!book) {
    alert("この本はまだ蔵書に登録されていません。");
    return;
  }

  const names = {
    mercariPrice: "メルカリ",
    rakumaPrice: "ラクマ",
    valuebooksPrice: "VALUE BOOKS"
  };

  const current = book[market] ?? "";
  const input = prompt(
    `${names[market]}の価格を入力してください（円）`,
    current
  );

  if (input === null) return;

  const price = input.replace(/[^\d]/g, "");

  if (!price) {
    book[market] = null;
  } else {
    book[market] = Number(price);
  }

  book.marketCheckedAt = new Date().toISOString();
  save();

  findBook(isbn);
};
$("#lookup").onclick=()=>findBook($("#isbn").value);$("#storePrice").onchange=()=>{$("#isbn").value&&findBook($("#isbn").value)};$("#maxPrice").onchange=()=>{$("#isbn").value&&findBook($("#isbn").value)};
$("#camera").onclick=async()=>{if(!("BarcodeDetector"in window))return alert("このブラウザはカメラ読取に未対応です。番号入力を使ってください。");let st=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}),v=$("#video");v.srcObject=st;await v.play();let d=new BarcodeDetector({formats:["ean_13"]}),t=setInterval(async()=>{let x=await d.detect(v).catch(()=>[]);if(x[0]){clearInterval(t);st.getTracks().forEach(y=>y.stop());$("#isbn").value=x[0].rawValue;findBook(x[0].rawValue)}},500)}
$("#target").onchange=async e=>{let f=e.target.files[0],t=await f.text();targets=f.name.endsWith(".json")?JSON.parse(t):t.split(/\r?\n/).slice(1).filter(Boolean).map(l=>{let[title,author,publisher,isbn,priority,rarity,usedMin,usedMax]=l.split(",");return{title,author,publisher,isbn,priority,rarity,usedMin:+usedMin||null,usedMax:+usedMax||null}});missing()};function missing(){if(!targets.length)return $("#miss").innerHTML="";let a=targets.filter(t=>!books.some(b=>(t.isbn&&b.isbn===t.isbn)||norm(b.title)===norm(t.title))).sort((a,b)=>coll.compare(a.title,b.title));$("#miss").innerHTML=`<p><b>${a.length}</b>冊 未所有</p>`+a.map(x=>`<div class=book><b>${esc(x.title)}</b><span>${esc(x.author||"")}</span><span>${esc(x.publisher||"")}</span><span>${x.usedMin?`¥${x.usedMin}〜${x.usedMax||x.usedMin}`:""}</span><span>${x.rarity?`レア${x.rarity}`:""} ${x.priority?`優先${x.priority}`:""}</span></div>`).join("")}
$("#mietefile").onchange=async e=>{let f=e.target.files[0];$("#mieteout").innerHTML=`<p>選択済み: <b>${esc(f.name)}</b></p><p>v0.1では安全のため自動回数加算はしません。PDFをサーバー側のPDF解析に接続するための入口を実装済みです。誤集計を避けるため、実際のミーテPDF様式に合わせて次段階で抽出ルールを固定します。</p>`}
$("#ask").onclick=async()=>{let q=$("#aiq").value.trim();if(!q)return;$("#aiout").textContent="考え中…";let c=books.map(({title,author,publisher,genre,isbn,usedMin,usedMax,rarity,priority,readCount})=>({title,author,publisher,genre,isbn,usedMin,usedMax,rarity,priority,readCount}));try{let r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q,context:c})}),j=await r.json();$("#aiout").textContent=j.text||j.error}catch(e){$("#aiout").textContent=e.message}}
function conf(){return{url:$("#sburl").value.replace(/\/$/,""),key:$("#sbkey").value,email:$("#email").value,password:$("#password").value}}["sburl","sbkey","email"].forEach(x=>$("#"+x).value=localStorage.getItem(x)||"");async function auth(path){let c=conf();["sburl","sbkey","email"].forEach(x=>localStorage.setItem(x,$("#"+x).value));try{let r=await fetch(`${c.url}/auth/v1/${path}`,{method:"POST",headers:{apikey:c.key,"Content-Type":"application/json"},body:JSON.stringify({email:c.email,password:c.password})}),j=await r.json();if(!r.ok)throw Error(j.msg||j.error_description||"認証失敗");session=j;localStorage.setItem("session",JSON.stringify(j));$("#syncout").textContent="ログインしました"}catch(e){$("#syncout").textContent=e.message}}$("#signup").onclick=()=>auth("signup");$("#login").onclick=()=>auth("token?grant_type=password");$("#sync").onclick=async()=>{let c=conf();session=session||JSON.parse(localStorage.getItem("session")||"null");if(!session?.access_token)return $("#syncout").textContent="ログインしてください";try{let h={apikey:c.key,Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json",Prefer:"resolution=merge-duplicates"},p=books.map(b=>({user_id:session.user.id,book_id:b.id,data:b,updated_at:new Date().toISOString()})),r=await fetch(`${c.url}/rest/v1/books`,{method:"POST",headers:h,body:JSON.stringify(p)});if(!r.ok)throw Error(await r.text());r=await fetch(`${c.url}/rest/v1/books?user_id=eq.${session.user.id}&select=data`,{headers:h});let a=await r.json(),m=new Map(books.map(b=>[b.id,b]));a.forEach(x=>m.set(x.data.id,x.data));books=[...m.values()];save();render();$("#syncout").textContent="同期完了"}catch(e){$("#syncout").textContent=e.message}};init();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
const ih=document.querySelector("#installHelp"),hi=document.querySelector("#hideInstall");
if(localStorage.getItem("hideInstall")==="1"&&ih)ih.style.display="none";
if(hi)hi.onclick=()=>{localStorage.setItem("hideInstall","1");ih.style.display="none"};

// v0.5 iPhone backup / restore
const backupBtn=document.querySelector("#backup"),restoreInput=document.querySelector("#restore"),backupOut=document.querySelector("#backupout");
if(backupBtn) backupBtn.onclick=()=>{
  const payload={app:"けんいちくんの本棚",version:"0.5",exportedAt:new Date().toISOString(),books};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=`kenichi-books-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  if(backupOut) backupOut.textContent="バックアップを書き出しました。iPhoneの「ファイル」に保存できます。";
};
if(restoreInput) restoreInput.onchange=async e=>{
  try{
    const f=e.target.files?.[0]; if(!f)return;
    const j=JSON.parse(await f.text());
    const restored=Array.isArray(j)?j:j.books;
    if(!Array.isArray(restored))throw Error("本棚データが見つかりません");
    books=restored; save(); render();
    if(backupOut) backupOut.textContent=`${books.length}件を復元しました。`;
  }catch(err){ if(backupOut) backupOut.textContent="復元できませんでした: "+err.message; }
};
// iPhone / Safari対応 ZXing バーコードスキャナー
let zxingControls = null;

$('#scan').onclick = async () => {
  const video = $('#video');

  if (!window.ZXingBrowser) {
    alert('バーコード読取機能を読み込めませんでした。ページを再読み込みしてください。');
    return;
  }

  try {
    if (zxingControls) {
      zxingControls.stop();
      zxingControls = null;
    }

    const codeReader = new ZXingBrowser.BrowserMultiFormatReader();

    zxingControls = await codeReader.decodeFromVideoDevice(
      undefined,
      video,
      async (result, error, controls) => {
        if (!result) return;

        const code = result.getText().replace(/\D/g, '');

        // 日本の書籍ISBN（978/979）または13桁JANを対象
        if (code.length !== 13) return;

        controls.stop();
        zxingControls = null;

        $('#isbn').value = code;

        try {
          await findBook(code);
        } catch (e) {
          console.error(e);
        }
      }
    );
  } catch (e) {
    console.error(e);
    alert('カメラを開始できませんでした。iPhoneのカメラ許可を確認してください。');
  }
};
