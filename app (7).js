const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let books=[],targets=[],editId=null,session=null,pendingMiete=[],pendingKumon=null;
const coll=new Intl.Collator('ja',{numeric:true,sensitivity:'base'});
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\s　・･\-―ー!！?？。、,，:：;；「」『』（）()【】\[\]〈〉《》]/g,'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=v=>v==null||v===''?'未記録':`¥${Number(v).toLocaleString('ja-JP')}`;
const save=()=>localStorage.setItem('kb',JSON.stringify(books));
const readLog=()=>JSON.parse(localStorage.getItem('mieteLog')||'[]');
const saveReadLog=a=>localStorage.setItem('mieteLog',JSON.stringify(a));
const kumonMaster=()=>JSON.parse(localStorage.getItem('kumonMaster')||'{}');
const saveKumon=o=>localStorage.setItem('kumonMaster',JSON.stringify(o));
const KUMON_2026_URL='https://www.kumon.ne.jp/dokusho/pdf/suisen.pdf?20260401';

async function ensureKumon2026(){
  try{
    const r=await fetch('/kumon_2026_missing.json',{cache:'no-store'});
    if(!r.ok)throw new Error('bundled KUMON data '+r.status);
    const data=await r.json();
    const list=Array.isArray(data)?data:(data.entries||[]);
    if(!list.length)throw new Error('bundled KUMON data is empty');
    const master=kumonMaster();
    // v19: keep the missing-book screen independent of external PDF/CORS.
    // The bundled 5A–2A list is always available from the same Vercel origin.
    master['2026']=list.map(x=>({...x,year:2026}));
    saveKumon(master);
    applyKumonToOwned(master['2026']);
    return true;
  }catch(e){
    console.warn('KUMON 2026 bundled sync failed',e);
    return false;
  }
}

function parseKumon2026Table(text){
  // Official 2026 PDF is a fixed table: page 1 = 5A,4A,3A,2A,A,B / page 2 = C,D,E,F,G,H,I.
  // First try the existing parser. If PDF text order is usable this is the safest path.
  let a=parseKumon(text,2026);
  if(a.length>=600)return a.map(x=>({title:x.title,level:x.level,year:2026,comment:''}));
  // Position-preserving fallback: detect level markers then collect title-looking cells.
  const levels=['5A','4A','3A','2A','A','B','C','D','E','F','G','H','I'];
  const out=[], seen=new Set();
  let current='';
  for(const raw of text.split(/\n+/)){
    const cells=raw.split('\t').map(x=>x.trim()).filter(Boolean);
    for(const cell of cells){
      const lm=cell.match(/^(5A|4A|3A|2A|A|B|C|D|E|F|G|H|I)$/);
      if(lm){current=lm[1];continue}
      if(!current)continue;
      const title=cell.replace(/^\d+[\.．\s]*/,'').trim();
      if(title.length<2||title.length>80)continue;
      if(/年度版|すいせん図書|一覧表|出版社|教材|発行|©|Kumon|公文教育研究会/.test(title))continue;
      if(/^(福音館書店|偕成社|童心社|講談社|ポプラ社|岩波書店|新潮社|くもん出版|評論社|文研出版|金の星社|岩崎書店|小学館|KADOKAWA|角川書店)$/.test(title))continue;
      const k=current+'|'+norm(title);
      if(!seen.has(k)){seen.add(k);out.push({title,level:current,year:2026,comment:''})}
    }
  }
  return out;
}

async function parseOfficialKumonPdf(data){
  const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  const pdf=await pdfjs.getDocument({data}).promise,out=[];
  const pageLevels=[['5A','4A','3A','2A','A','B'],['C','D','E','F','G','H','I']];
  for(let pn=1;pn<=Math.min(2,pdf.numPages);pn++){
    const page=await pdf.getPage(pn),tc=await page.getTextContent(),items=tc.items.map(i=>({s:String(i.str||'').trim(),x:i.transform?.[4]||0,y:i.transform?.[5]||0,w:i.width||0,h:i.height||0})).filter(i=>i.s);
    const levels=pageLevels[pn-1];
    let heads=levels.map(l=>items.filter(i=>i.s===l).sort((a,b)=>b.y-a.y)[0]).filter(Boolean).sort((a,b)=>a.x-b.x);
    if(heads.length!==levels.length)throw new Error(`公式PDF ${pn}ページ目の級見出しを認識できませんでした`);
    const centers=heads.map(h=>h.x), bounds=[-Infinity]; for(let i=0;i<centers.length-1;i++)bounds.push((centers[i]+centers[i+1])/2); bounds.push(Infinity);
    for(let ci=0;ci<levels.length;ci++){
      const level=levels[ci], col=items.filter(i=>i.x>=bounds[ci]&&i.x<bounds[ci+1]);
      const nums=col.filter(i=>/^(?:[1-9]|[1-4][0-9]|50)$/.test(i.s)).sort((a,b)=>b.y-a.y);
      const unique=[]; for(const n of nums){if(!unique.some(x=>x.s===n.s))unique.push(n)}
      for(const n of unique){
        const row=+n.s;if(row<1||row>50)continue;
        const same=col.filter(i=>i!==n&&Math.abs(i.y-n.y)<1.8&&i.x>n.x+2).sort((a,b)=>a.x-b.x);
        if(!same.length)continue;
        const colWidth=(ci<centers.length-1?centers[ci+1]-centers[ci]:centers[ci]-centers[ci-1]);
        const maxX=n.x+colWidth*.72;
        let title=same.filter(i=>i.x<maxX).map(i=>i.s).join('').trim();
        title=title.replace(/^[●■□]+/,'').replace(/[●■□]+$/,'').trim();
        if(title.length>=1&&!/^(KUMON|R)$/.test(title))out.push({title,level,year:2026,row,comment:''});
      }
    }
  }
  const uniq=new Map();for(const x of out)uniq.set(x.level+'|'+x.row,x);
  return [...uniq.values()].sort((a,b)=>pageLevels.flat().indexOf(a.level)-pageLevels.flat().indexOf(b.level)||a.row-b.row);
}
async function syncOfficialKumon2026(show=true){
  const st=$('#kumonOfficialStatus'); if(show&&st)st.textContent='2026公式650冊を同期中…';
  try{
    const r=await fetch('/api/kumon-pdf',{cache:'no-store'});if(!r.ok)throw new Error('公式PDF取得 '+r.status);
    const list=await parseOfficialKumonPdf(await r.arrayBuffer());
    if(list.length<630)throw new Error(`認識 ${list.length}冊（650冊に不足）`);
    const master=kumonMaster();master['2026']=list;saveKumon(master);applyKumonToOwned(list);renderKumonYears();render();
    if(st)st.innerHTML=`2026公式一覧：<b>${list.length}冊</b> 同期済み（5A〜I）`;
    return true;
  }catch(e){if(st)st.innerHTML=`2026公式一覧：内蔵候補を使用中 <small>${esc(e.message)}</small>`;console.warn(e);return false}
}

function applyKumonToOwned(list){
  let changed=false;
  for(const x of list){
    const b=books.find(z=>norm(z.title)===norm(x.title));
    if(b && b.kumonLevel!==x.level){b.kumonLevel=x.level;changed=true}
  }
  if(changed)save();
}
const birth=()=>localStorage.getItem('birthDate')||'2025-04-05';

function migrate(){
 const a=JSON.parse(localStorage.getItem('kb')||'null'); if(!Array.isArray(a))return;
 const patches=[
  {titles:['14ひきのおつきみ'],title:'14ひきのおつきみ',isbn:'9784494006830'},
  {titles:['ハロウィンドキドキおばけの日 ますだゆうこ','ハロウィンドキドキおばけの日！','ハロウィンドキドキおばけの日'],title:'ハロウィンドキドキおばけの日！',isbn:'9784894236097',publisher:'文溪堂'}
 ];
 let changed=false;
 for(const p of patches){const b=a.find(x=>p.titles.some(t=>norm(x.title)===norm(t)));if(b){for(const [k,v] of Object.entries(p)){if(k==='titles')continue;if(k==='title'||!b[k]){b[k]=v;changed=true}}}}
 if(changed)localStorage.setItem('kb',JSON.stringify(a));
}

async function init(){
 migrate(); books=JSON.parse(localStorage.getItem('kb')||'null')||await fetch('/initial_books.json',{cache:'no-store'}).then(r=>r.json());
 $('#birthDate').value=birth(); recalcReadCounts(); render(); renderKumonYears(); renderAnalysis();
 ensureKumon2026().then(ok=>{if(ok){render();renderKumonYears();}});
}
function bookTags(b){let a=[];if(b.kumonLevel)a.push('くもん'+b.kumonLevel);if(Array.isArray(b.genreTags))a.push(...b.genreTags);else if(b.genre)a.push(b.genre);return[...new Set(a.filter(Boolean))]}
function cmp(a,b){let s=$('#sort').value;if(s==='author')return coll.compare(a.author||'ん',b.author||'ん');if(s==='publisher')return coll.compare(a.publisher||'ん',b.publisher||'ん');if(s==='readDesc')return(b.readCount||0)-(a.readCount||0);if(s==='priceAsc')return(a.usedMin??1e9)-(b.usedMin??1e9);if(s==='rarity')return'SABC'.indexOf(a.rarity||'Z')-'SABC'.indexOf(b.rarity||'Z');if(s==='priority')return'SABC'.indexOf(a.priority||'Z')-'SABC'.indexOf(b.priority||'Z');return coll.compare(a.title,b.title)}
function render(){
 let q=norm($('#q').value),gf=$('#genreFilter').value,a=books.filter(b=>(!q||norm([b.title,b.author,b.publisher,b.isbn,...bookTags(b)].join(' ')).includes(q))&&(!gf||bookTags(b).some(t=>t===gf||t.includes(gf)))).sort(cmp);
 $('#stats').innerHTML=`<div class=stat><b>${books.length}</b><br><small>蔵書</small></div><div class=stat><b>${books.filter(b=>b.isbn).length}</b><br><small>ISBN登録</small></div><div class=stat><b>${books.filter(b=>b.noCode).length}</b><br><small>コードなし確認済</small></div><div class=stat><b>${readLog().reduce((s,x)=>s+(+x.count||0),0)}</b><br><small>読み聞かせ</small></div>`;
 $('#list').innerHTML=a.map(b=>`<div class=book data-id="${b.id}"><div><b>${esc(b.title)}</b><div>${bookTags(b).map(t=>`<span class=tag>${esc(t)}</span>`).join('')}</div><small>${b.readCount||0}回${b.isbn?' ／ '+esc(b.isbn):''}</small></div><div>${esc(b.author||'')}<br><small>作者${b.illustrator?' ／ 絵：'+esc(b.illustrator):''}${b.translator?' ／ 訳：'+esc(b.translator):''}</small></div><div>${esc(b.publisher||'')}<br><small>${esc(b.publishedDate||'発売日未登録')}</small></div><div>${b.listPrice?`定価 ${yen(b.listPrice)}`:''}<br><small>${b.usedMin!=null?`中古 ${yen(b.usedMin)}〜${yen(b.usedMax??b.usedMin)}`:'相場未設定'}</small></div></div>`).join('');
 $$('.book[data-id]').forEach(x=>x.onclick=()=>openEdit(x.dataset.id)); missing();
}
$$('nav button').forEach(b=>b.onclick=()=>{$$('nav button,.tab').forEach(x=>x.classList.remove('on'));b.classList.add('on');$('#'+b.dataset.tab).classList.add('on');if(b.dataset.tab==='analysis')renderAnalysis()});
$('#q').oninput=render;$('#sort').onchange=render;$('#genreFilter').onchange=render;$('#pdf').onclick=()=>print();$('#add').onclick=()=>openEdit();$('#cancel').onclick=()=>$('#edit').close();
function openEdit(id){editId=id||null;let b=books.find(x=>x.id===id)||{},f=$('#edit form');['title','author','illustrator','translator','publisher','isbn','publishedDate','listPrice','usedMin','usedMax','mercariPrice','rakumaPrice','valuebooksPrice','rarity','priority','kumonLevel'].forEach(k=>f.elements[k].value=b[k]??'');f.elements.noCode.checked=!!b.noCode;f.elements.genreTagsText.value=(Array.isArray(b.genreTags)?b.genreTags:[b.genre].filter(Boolean)).join(',');$('#edit').showModal()}
$('#edit form').onsubmit=e=>{e.preventDefault();let f=e.target,v=Object.fromEntries(new FormData(f)),b=books.find(x=>x.id===editId);if(!b){b={id:crypto.randomUUID(),owned:true,readCount:0};books.push(b)}Object.assign(b,v,{noCode:f.elements.noCode.checked,genreTags:v.genreTagsText.split(/[,、]/).map(x=>x.trim()).filter(Boolean),listPrice:v.listPrice===''?null:+v.listPrice,usedMin:v.usedMin===''?null:+v.usedMin,usedMax:v.usedMax===''?null:+v.usedMax,mercariPrice:v.mercariPrice===''?null:+v.mercariPrice,rakumaPrice:v.rakumaPrice===''?null:+v.rakumaPrice,valuebooksPrice:v.valuebooksPrice===''?null:+v.valuebooksPrice});delete b.genreTagsText;if(b.noCode&&!b.codeStatus)b.codeStatus='no-code-confirmed';save();$('#edit').close();render();renderScanProgress()};

function deepValues(obj,key,out=[]){if(!obj||typeof obj!=='object')return out;for(const [k,v] of Object.entries(obj)){if(k.toLowerCase()===key.toLowerCase())out.push(v);if(v&&typeof v==='object')deepValues(v,key,out)}return out}
function firstScalar(vals){for(const v of vals.flat(Infinity)){if(v==null)continue;if(typeof v==='string'||typeof v==='number')return String(v);if(typeof v==='object'){for(const k of ['Date','PriceAmount','Amount','value','Value'])if(v[k]!=null)return String(v[k])}}return''}
function isbn13Valid(raw){let code=String(raw||'').replace(/[^0-9Xx]/g,'');if(!/^97[89]\d{10}$/.test(code))return false;let sum=0;for(let i=0;i<12;i++)sum+=(+code[i])*(i%2?3:1);return (10-(sum%10))%10===+code[12]}
function isbn10To13(raw){let x=String(raw||'').replace(/[^0-9Xx]/g,'').toUpperCase();if(!/^\d{9}[\dX]$/.test(x))return'';let sum=0;for(let i=0;i<10;i++)sum+=(10-i)*(x[i]==='X'?10:+x[i]);if(sum%11)return'';let base='978'+x.slice(0,9),s=0;for(let i=0;i<12;i++)s+=(+base[i])*(i%2?3:1);return base+((10-s%10)%10)}
function normalizeIsbn(raw){let x=String(raw||'').replace(/[^0-9Xx]/g,'');if(x.length===10)x=isbn10To13(x);if(!isbn13Valid(x))throw Error('有効なISBN-13（978/979）を入力してください。補助価格コードや一般JANは書籍ISBNとして登録しません。');return x}
function parseOpenBD(j,code,hit){let d=j?.[0]||{},s=d.summary||{},onix=d.onix||{};let date=firstScalar(deepValues(onix,'PublishingDate'))||s.pubdate||'';if(/^\d{8}$/.test(date))date=`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`;let prices=deepValues(onix,'Price'),amount='';for(const p of prices.flat()){if(p&&typeof p==='object'){amount=p.PriceAmount||p.Amount||amount;if(amount)break}}let price=amount?Number(String(amount).replace(/\D/g,'')):null;let related=[...new Set(deepValues(d,'kanrenshoisbn').flat(Infinity).map(String).filter(x=>/^97[89]\d{10}$/.test(x)))];return{isbn:code,title:s.title||hit?.title||'',author:s.author||hit?.author||'',publisher:s.publisher||hit?.publisher||'',publishedDate:date||hit?.publishedDate||'',listPrice:price||hit?.listPrice||null,cover:s.cover||'',relatedIsbns:related,language:hit?.language||'',metadataSource:s.title?'openBD':''}}
async function googleBooksLookup(code){try{let r=await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(code)}&maxResults=5&printType=books`);if(!r.ok)return null;let j=await r.json(),items=j.items||[];let item=items.find(x=>(x.volumeInfo?.industryIdentifiers||[]).some(i=>String(i.identifier||'').replace(/\D/g,'')===code))||items[0];if(!item)return null;let v=item.volumeInfo||{},sale=item.saleInfo||{},ids=v.industryIdentifiers||[];return{isbn:code,title:v.title||'',author:(v.authors||[]).join(' / '),publisher:v.publisher||'',publishedDate:v.publishedDate||'',listPrice:sale.listPrice?.amount??null,cover:v.imageLinks?.thumbnail||'',relatedIsbns:ids.map(i=>String(i.identifier||'').replace(/\D/g,'')).filter(x=>/^97[89]\d{10}$/.test(x)&&x!==code),language:v.language||'',metadataSource:'Google Books'}}catch(e){return null}}
async function lookup(code){code=normalizeIsbn(code);let hit=books.find(b=>String(b.isbn||'')===code),info={isbn:code,title:hit?.title||'',author:hit?.author||'',publisher:hit?.publisher||'',publishedDate:hit?.publishedDate||'',listPrice:hit?.listPrice||null,language:hit?.language||'',relatedIsbns:[]};try{let j=await fetch(`https://api.openbd.jp/v1/get?isbn=${code}`).then(r=>r.json());info=parseOpenBD(j,code,hit)}catch(e){}if(!info.title){let g=await googleBooksLookup(code);if(g)info={...info,...g}}else if(!info.author||!info.publisher||!info.publishedDate){let g=await googleBooksLookup(code);if(g)info={...g,...info,author:info.author||g.author,publisher:info.publisher||g.publisher,publishedDate:info.publishedDate||g.publishedDate,language:info.language||g.language,listPrice:info.listPrice||g.listPrice}}return{hit,info}}
function linkScannedIsbn(info){if(!info?.isbn||!info?.title)return null;let exact=books.find(b=>String(b.isbn||'')===String(info.isbn));if(exact)return exact;let b=safeCandidate(info);if(!b)return null;return enrichOwnedBook(b,info)}
function marketLinks(info){let term=encodeURIComponent([info.title,info.author].filter(Boolean).join(' ')),latest=encodeURIComponent([info.title,info.publisher,'新版 最新版'].filter(Boolean).join(' '));return{mercari:`https://jp.mercari.com/search?keyword=${term}`,rakuma:`https://fril.jp/s?query=${term}`,valuebooks:`https://search.rakuten.co.jp/search/mall/${term}%20VALUE%20BOOKS/`,rakutenNew:`https://search.rakuten.co.jp/search/mall/${latest}/`,amazonNew:`https://www.amazon.co.jp/s?k=${latest}`,googleNew:`https://www.google.com/search?q=${latest}`}}
function priceDecision(hit,store,max){let pairs=[['BOOKOFF',store],['メルカリ',hit?.mercariPrice],['ラクマ',hit?.rakumaPrice],['VALUE BOOKS',hit?.valuebooksPrice]].filter(x=>x[1]!=null&&x[1]!==''&&!Number.isNaN(+x[1])).map(x=>[x[0],+x[1]]);if(!pairs.length)return{cls:'unknown',text:'比較価格がまだありません',cheapest:''};pairs.sort((a,b)=>a[1]-b[1]);let cheapest=`最安記録：${pairs[0][0]} ${yen(pairs[0][1])}`;if(store!=null&&max!=null)return +store<=+max?{cls:'buy',text:`設定上限 ${yen(max)} 以下 → 購入候補`,cheapest}:{cls:'wait',text:`設定上限 ${yen(max)} を超過`,cheapest};return{cls:'unknown',text:'価格を比較できます',cheapest}}
function renderScanProgress(){let isbn=books.filter(b=>b.isbn).length,no=books.filter(b=>b.noCode).length,pending=books.filter(b=>!b.isbn&&!b.noCode).length;let el=$('#scanProgress');if(el)el.innerHTML=`<b>${books.length}冊中 ${isbn}冊 ISBN登録済</b> ／ ${no}冊 コードなし確認済 ／ <b>${pending}冊 未確認</b>`}
function safeCandidate(info){let title=norm(info.title),author=norm(info.author),publisher=norm(info.publisher);let c=books.filter(b=>b.owned===true&&!b.isbn&&!b.noCode&&norm(b.title)===title);if(c.length===1)return c[0];let scored=books.filter(b=>b.owned===true&&!b.isbn&&!b.noCode).map(b=>{let score=0;if(title&&norm(b.title)===title)score+=6;if(author&&norm(b.author)&&author.includes(norm(b.author)))score+=2;if(publisher&&norm(b.publisher)===publisher)score+=2;return{b,score}}).filter(x=>x.score>=8).sort((a,b)=>b.score-a.score);return scored.length===1?scored[0].b:null}
function enrichOwnedBook(b,info){if(!b||!info)return b;b.isbn=info.isbn||b.isbn;b.title=info.title||b.title;b.author=info.author||b.author;b.publisher=info.publisher||b.publisher;b.publishedDate=info.publishedDate||b.publishedDate;b.listPrice=info.listPrice||b.listPrice;b.codeStatus='isbn-verified';b.isbnCheckedAt=new Date().toISOString();save();return b}
async function findBook(code){try{let{hit,info}=await lookup(code);if(masterScanActive()){addMasterScan(info,code);$('#scanout').innerHTML=`<div class=result><h3>${esc(info.title||'書誌情報なし')}</h3><b>🧾 整備用に保存しました</b><p>${esc(info.author)}<br>${esc(info.publisher)}<br>ISBN：${esc(info.isbn||code)}</p><small>現在の本棚は変更していません。</small></div>`;if($('#bulkMode')?.checked)setTimeout(()=>startScanner(),650);return;}if(!hit)hit=linkScannedIsbn(info);
let autoAdded=false;
if(!hit && $('#scanAddMode')?.checked && info?.title){
  hit={...info,id:crypto.randomUUID(),owned:true,readCount:0,usedMin:null,usedMax:null,genreTags:[],kumonLevel:'',codeStatus:'isbn-verified',isbnCheckedAt:new Date().toISOString(),addedBy:'scan'};
  books.push(hit); save(); autoAdded=true;
}
if(hit){for(const k of ['author','publisher','publishedDate','listPrice'])if(!hit[k]&&info[k])hit[k]=info[k];save()}let links=marketLinks(info),store=$('#storePrice').value===''?null:+$('#storePrice').value,max=$('#maxPrice').value===''?null:+$('#maxPrice').value,d=priceDecision(hit,store,max),pct=store!=null&&info.listPrice?Math.round(store/info.listPrice*100):null;$('#scanout').innerHTML=`<div class=result><h3>${esc(info.title||'書誌情報なし')}</h3><b>${autoAdded?'✅ 蔵書に自動追加しました':(hit?'✅ 所有済み':'🟢 未所有')}</b><p>${esc(info.author)}<br>${esc(info.publisher)}<br>発売日：${esc(info.publishedDate||'不明')}<br>ISBN：${esc(info.isbn)}<br>定価（税込）：<b>${yen(info.listPrice)}</b></p>${store!=null?`<p>BOOKOFF：<b>${yen(store)}</b>${pct!=null?` ／ 定価の約${pct}% ／ 差額${yen(info.listPrice-store)}`:''}</p>`:''}<div class="decision ${d.cls}">${d.text}<br><small>${d.cheapest}</small></div><div class=market-grid>${[['メルカリ','mercari','mercariPrice'],['ラクマ','rakuma','rakumaPrice'],['VALUE BOOKS','valuebooks','valuebooksPrice']].map(([n,l,k])=>`<div class=market-card><b>${n}</b><p>${yen(hit?.[k])}</p><a target=_blank rel=noopener href="${links[l]}">検索</a>${hit?`<button onclick="saveMarketPrice('${code}','${k}')">価格を記録</button>`:''}</div>`).join('')}</div><div class=panel><b>🔄 新版・最新版の確認</b><p class=muted>図鑑・辞典などは改訂版がある場合があります。関連ISBNが取得できた場合は候補を表示し、それ以外は最新版検索リンクを表示します。</p>${info.relatedIsbns?.length?`<p>関連ISBN候補：${info.relatedIsbns.map(esc).join(' / ')}</p>`:''}<p><a target=_blank href="${links.rakutenNew}">楽天で最新版候補</a>　<a target=_blank href="${links.amazonNew}">Amazonで最新版候補</a>　<a target=_blank href="${links.googleNew}">Webで出版社情報を確認</a></p></div>${!hit?'<button id=reg>この本を蔵書登録</button>':'<button id=editmarket>本の情報を編集</button>'}</div>`;if(!hit)$('#reg').onclick=()=>{books.push({...info,id:crypto.randomUUID(),owned:true,readCount:0,usedMin:null,usedMax:null,genreTags:[],kumonLevel:''});save();render();findBook(code)};else{$('#editmarket').onclick=()=>openEdit(hit.id);if(store!=null){hit.purchasePrice=store;save()}}renderScanProgress();if($('#bulkMode')?.checked)setTimeout(()=>startScanner(),650)}catch(e){$('#scanout').textContent=e.message;if($('#bulkMode')?.checked)setTimeout(()=>startScanner(),900)}}
window.saveMarketPrice=(isbn,market)=>{let b=books.find(x=>x.isbn===isbn);if(!b)return alert('この本はまだ蔵書に登録されていません。');let v=prompt('価格を入力してください（円）',b[market]??'');if(v===null)return;let p=v.replace(/[^\d]/g,'');b[market]=p?+p:null;b.marketCheckedAt=new Date().toISOString();save();findBook(isbn)};
$('#lookup').onclick=()=>findBook($('#isbn').value);$('#storePrice').onchange=()=>$('#isbn').value&&findBook($('#isbn').value);$('#maxPrice').onchange=()=>$('#isbn').value&&findBook($('#isbn').value);
let zxingControls=null,scanBusy=false;
async function startScanner(){if(scanBusy||zxingControls)return;if(!window.ZXingBrowser)return alert('バーコード読取機能を読み込めませんでした。');try{scanBusy=true;let reader=new ZXingBrowser.BrowserMultiFormatReader();zxingControls=await reader.decodeFromVideoDevice(undefined,$('#video'),async(result,error,controls)=>{if(!result)return;let raw=result.getText(),code=String(raw||'').replace(/\D/g,'');if(!isbn13Valid(code))return;controls.stop();zxingControls=null;scanBusy=false;$('#isbn').value=code;await findBook(code)})}catch(e){scanBusy=false;zxingControls=null;alert('カメラを開始できませんでした。カメラ許可を確認してください。')}}
$('#camera').onclick=startScanner;
$('#stopCamera').onclick=()=>{if(zxingControls)zxingControls.stop();zxingControls=null;scanBusy=false};
$('#bulkMode').onchange=()=>{renderScanProgress();if($('#bulkMode').checked)startScanner()};
$('#showNoIsbn').onclick=()=>{let a=books.filter(b=>!b.isbn&&!b.noCode).sort(cmp);$('#scanout').innerHTML=`<div class=panel><h3>ISBN未登録・未確認 ${a.length}冊</h3>${a.map(b=>`<div class=book data-manual="${b.id}"><b>${esc(b.title)}</b><span>${esc(b.author||'')}</span><span>${esc(b.publisher||'')}</span><button>手入力</button></div>`).join('')}</div>`;$$('[data-manual]').forEach(x=>x.onclick=()=>openEdit(x.dataset.manual))};
$('#manualNoCode').onclick=()=>{openEdit();let f=$('#edit form');f.elements.noCode.checked=true};
$('#target').onchange=async e=>{let f=e.target.files[0];if(!f)return;let t=await f.text();targets=f.name.endsWith('.json')?JSON.parse(t):t.split(/\r?\n/).slice(1).filter(Boolean).map(l=>{let[title,author,publisher,isbn,priority,rarity,usedMin,usedMax]=l.split(',');return{title,author,publisher,isbn,priority,rarity,usedMin:+usedMin||null,usedMax:+usedMax||null}});missing()};
function missing(){if(!targets.length)return $('#miss').innerHTML='';let a=targets.filter(t=>!books.some(b=>(t.isbn&&b.isbn===t.isbn)||norm(b.title)===norm(t.title))).sort((a,b)=>coll.compare(a.title,b.title));$('#miss').innerHTML=`<p><b>${a.length}</b>冊 未所有</p>`+a.map(x=>`<div class=book><b>${esc(x.title)}</b><span>${esc(x.author||'')}</span><span>${esc(x.publisher||'')}</span><span>${x.usedMin?yen(x.usedMin):''}</span></div>`).join('')}

async function pdfText(file){let pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';let data=await file.arrayBuffer(),pdf=await pdfjs.getDocument({data}).promise,pages=[];for(let p=1;p<=pdf.numPages;p++){let page=await pdf.getPage(p),tc=await page.getTextContent(),rows=new Map();for(const it of tc.items){let y=Math.round(it.transform?.[5]||0);if(!rows.has(y))rows.set(y,[]);rows.get(y).push({x:it.transform?.[4]||0,s:it.str})}let lines=[...rows.entries()].sort((a,b)=>b[0]-a[0]).map(([,items])=>items.sort((a,b)=>a.x-b.x).map(i=>i.s).join(' ').trim()).filter(Boolean);pages.push(lines.join('\n'))}return pages.join('\n')}
function ageAt(date){let d=new Date(date+'T12:00:00'),b=new Date(birth()+'T12:00:00');let m=(d.getFullYear()-b.getFullYear())*12+d.getMonth()-b.getMonth();if(d.getDate()<b.getDate())m--;return{months:m,label:`${Math.floor(m/12)}歳${m%12}か月`}}
function parseMiete(text,fileName){let chunks=text.split(/(?=20\d{2}年\d{1,2}月\d{1,2}日)/),out=[];for(const ch of chunks){let dm=ch.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);if(!dm)continue;let date=`${dm[1]}-${String(dm[2]).padStart(2,'0')}-${String(dm[3]).padStart(2,'0')}`;let re=/(\d{1,2}:\d{2})\s+([\s\S]*?)\s+(\d+)回(?=\s|20\d{2}年|$)/g,m;while((m=re.exec(ch))){let raw=m[2].replace(/\s+/g,' ').trim();let title=raw.replace(/\s*[\(（【].*$/,'').trim();let known=bestBookMatch(title,raw);if(!known)continue;let count=+m[3]||1;out.push({id:`${date}|${m[1]}|${norm(known.title)}|${count}`,date,time:m[1],title:known.title,bookId:known.id,count,source:fileName,ageMonths:ageAt(date).months})}}return out}
function bestBookMatch(title,raw){let n=norm(title),nr=norm(raw);let exact=books.find(b=>norm(b.title)===n);if(exact)return exact;let c=books.filter(b=>{let x=norm(b.title);return x.length>=3&&(nr.includes(x)||x.includes(n))}).sort((a,b)=>norm(b.title).length-norm(a.title).length);return c[0]||null}
$('#mietefile').onchange=e=>{pendingMiete=[...e.target.files];$('#mieteout').textContent=`${pendingMiete.length}ファイル選択済み`};
$('#importMiete').onclick=async()=>{if(!pendingMiete.length)return alert('ミーテPDFを選択してください');$('#mieteout').textContent='解析中…';let parsed=[];for(const f of pendingMiete){let t=await pdfText(f);parsed.push(...parseMiete(t,f.name))}let old=readLog(),map=new Map(old.map(x=>[x.id,x]));let before=map.size;parsed.forEach(x=>map.set(x.id,x));let all=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));saveReadLog(all);recalcReadCounts();save();render();renderAnalysis();$('#mieteout').innerHTML=`<p><b>${parsed.length}</b>件をPDFから認識。新規 <b>${map.size-before}</b>件を保存しました。累計 <b>${all.reduce((s,x)=>s+x.count,0)}</b>回。</p>`;renderMieteRank()};
function recalcReadCounts(){let sums={};for(const x of readLog())sums[x.bookId]=(sums[x.bookId]||0)+(+x.count||0);for(const b of books)b.readCount=sums[b.id]||b.readCount||0}
function renderMieteRank(){let a=aggregateRanking(readLog());$('#mieterank').innerHTML='<h3>全期間ランキング</h3>'+rankHtml(a.slice(0,20))}
function aggregateRanking(log){let m=new Map();for(const x of log){let k=x.bookId||x.title,o=m.get(k)||{title:x.title,count:0};o.count+=+x.count||0;m.set(k,o)}return[...m.values()].sort((a,b)=>b.count-a.count)}
function rankHtml(a){return a.length?a.map((x,i)=>`<div class=rank><b>${i+1}位</b><span>${esc(x.title)}</span><b>${x.count}回</b></div>`).join(''):'<p class=muted>該当する記録がありません。</p>'}

function parseKumon(text,year){let levels=['5A','4A','3A','2A','A','B','C','D','E','F','G','H','I'],entries=[],current='';for(let line of text.split(/\n+/).map(x=>x.trim()).filter(Boolean)){let lm=line.match(/(?:^|\s)(5A|4A|3A|2A|A|B|C|D|E|F|G|H|I)(?:\s|$)/);if(lm&&line.length<40){current=lm[1];continue}if(!current)continue;let clean=line.replace(/^\d+[\.．\s]*/,'').trim();if(clean.length<2||/推薦図書|くもん|KUMON|一覧|年度/.test(clean))continue;let title=clean.split(/\s{2,}|　{2,}/)[0].trim();if(title.length>=2&&title.length<=80)entries.push({title,level:current,year})}let uniq=new Map();entries.forEach(x=>uniq.set(`${x.level}|${norm(x.title)}`,x));return[...uniq.values()]}
function diffKumon(year,newList){let master=kumonMaster(),prevYear=Math.max(...Object.keys(master).map(Number).filter(y=>y<year),0),prev=master[prevYear]||[],pm=new Map(prev.map(x=>[norm(x.title),x])),nm=new Map(newList.map(x=>[norm(x.title),x])),added=[],deleted=[],changed=[];for(const [k,x] of nm){if(!pm.has(k))added.push(x);else if(pm.get(k).level!==x.level)changed.push({title:x.title,from:pm.get(k).level,to:x.level})}for(const [k,x] of pm)if(!nm.has(k))deleted.push(x);return{prevYear,added,deleted,changed}}
$('#importKumon').onclick=async()=>{let f=$('#kumonPdf').files[0],year=+$('#kumonImportYear').value;if(!f||!year)return alert('PDFと年度を指定してください');$('#kumonDiff').textContent='解析中…';let text=await pdfText(f),list=parseKumon(text,year);if(!list.length){$('#kumonDiff').innerHTML='<p>級とタイトルを十分に抽出できませんでした。PDFのレイアウト確認が必要です。既存データは変更していません。</p>';return}let diff=diffKumon(year,list);pendingKumon={year,list,diff};$('#kumonDiff').innerHTML=`<p><b>${year}年度 ${list.length}冊</b>を抽出</p><p class=diff-add>追加 ${diff.added.length}冊</p><p class=diff-del>削除 ${diff.deleted.length}冊</p><p class=diff-change>級変更 ${diff.changed.length}冊</p><button id=confirmKumon>この内容で年度マスターを保存</button>`;$('#confirmKumon').onclick=confirmKumonImport};
function confirmKumonImport(){let{year,list,diff}=pendingKumon,master=kumonMaster();master[year]=list.map(x=>({...x,comment:diff.added.some(a=>norm(a.title)===norm(x.title))?`${year}年追加`:''}));if(diff.prevYear&&master[diff.prevYear])for(const d of diff.deleted){let old=master[diff.prevYear].find(x=>norm(x.title)===norm(d.title));if(old)old.removedComment=`${year}年削除`}for(const c of diff.changed){let x=master[year].find(z=>norm(z.title)===norm(c.title));if(x)x.comment=`${year}年 ${c.from}→${c.to}変更`}saveKumon(master);for(const x of master[year]){let b=books.find(z=>norm(z.title)===norm(x.title));if(b)b.kumonLevel=x.level}save();render();renderKumonYears();$('#kumonDiff').innerHTML+=`<p><b>保存しました。</b> 「${year}年追加／削除／級変更」の履歴を保持しています。</p>`}
function renderKumonYears(){let years=Object.keys(kumonMaster()).sort((a,b)=>b-a);$('#kumonYear').innerHTML=(years.length?years:['2026']).map(y=>`<option>${y}</option>`).join('')}
const publisherKana={
'福音館書店':'ふくいんかんしょてん','偕成社':'かいせいしゃ','童心社':'どうしんしゃ',
'文研出版':'ぶんけんしゅっぱん','ポプラ社':'ぽぷらしゃ','金の星社':'きんのほししゃ',
'評論社':'ひょうろんしゃ','文溪堂':'ぶんけいどう','文渓堂':'ぶんけいどう',
'こぐま社':'こぐましゃ','至光社':'しこうしゃ','ほるぷ出版':'ほるぷしゅっぱん',
'アリス館':'ありすかん','岩崎書店':'いわさきしょてん','講談社':'こうだんしゃ',
'白泉社':'はくせんしゃ','徳間書店':'とくましょてん','好学社':'こうがくしゃ',
'理論社':'りろんしゃ','らんか社':'らんかしゃ','BL出版':'びーえるしゅっぱん',
'PHP研究所':'ぴーえいちぴーけんきゅうじょ','教育画劇':'きょういくがげき',
'くもん出版':'くもんしゅっぱん','幻冬舎':'げんとうしゃ','戸田デザイン研究室':'とだでざいんけんきゅうしつ',
'あかね書房':'あかねしょぼう','鈴木出版':'すずきしゅっぱん','絵本館':'えほんかん',
'ブロンズ新社':'ぶろんずしんしゃ','冨山房':'ふざんぼう','佼成出版社':'こうせいしゅっぱん',
'ひさかたチャイルド':'ひさかたちゃいるど','のら書店':'のらしょてん'
};
let currentMissing=[];
function missingTitleKey(x){return String(x.title||'').normalize('NFKC')}
function missingPublisherKey(x){return publisherKana[x.publisher]||String(x.publisher||'').normalize('NFKC')}
function renderMissingList(){
  const year=$('#kumonYear').value||'2026',lv=$('#kumonLevelFilter').value;
  const q=norm($('#missingAuthorSearch')?.value||'');
  const rarity=$('#missingRarityFilter')?.value||'';
  const sort=$('#missingSort')?.value||'title';
  let a=currentMissing.filter(x=>{
    const authorOk=!q||norm(x.author).includes(q);
    const rv=String(x.rarity||'').trim().toUpperCase();
    const rarityOk=!rarity||(rarity==='none'?!rv:rv===rarity);
    return authorOk&&rarityOk;
  });
  a.sort((x,y)=>{
    if(sort==='publisher'){
      const p=coll.compare(missingPublisherKey(x),missingPublisherKey(y));
      if(p)return p;
    }
    return coll.compare(missingTitleKey(x),missingTitleKey(y));
  });
  $('#miss').innerHTML=`<h3>${year}年度 ${lv||'全級'}：未所有 ${a.length}冊</h3>`+
  a.map(x=>`<div class=book>
    <b>${esc(x.title)}</b><span class=tag>くもん${esc(x.level)}</span>
    <span>作者：${esc(x.author||'未登録')}</span>
    <span>出版社：${esc(x.publisher||'未登録')}</span>
    <span>発売・初版：${esc(x.publishedDate||'未確認')}</span>
    <span>レア度：${esc(x.rarity||'―')}</span>
    <span>参考中古価格：${esc(x.usedPriceGuide||'―')}</span>
  </div>`).join('');
}
function loadMissingList(){
  const year=$('#kumonYear').value,lv=$('#kumonLevelFilter').value,list=kumonMaster()[year]||[];
  currentMissing=list.filter(x=>(!lv||x.level===lv)&&!isOwnedCandidate(x));
  renderMissingList();
}
$('#showKumonMissing').onclick=loadMissingList;
if($('#syncKumonOfficial'))$('#syncKumonOfficial').onclick=()=>syncOfficialKumon2026(true).then(ok=>{if(ok)loadMissingList()});
$('#missingSort').onchange=()=>{if(currentMissing.length)renderMissingList()};
$('#missingAuthorSearch').oninput=()=>{if(currentMissing.length)renderMissingList()};
$('#missingRarityFilter').onchange=()=>{if(currentMissing.length)renderMissingList()};
$('#clearMissingSearch').onclick=()=>{$('#missingAuthorSearch').value='';$('#missingRarityFilter').value='';if(currentMissing.length)renderMissingList()};

function ageOptions(selected){
 let logs=readLog(),vals=[...new Set(logs.map(x=>Number(x.ageMonths)).filter(x=>Number.isFinite(x)&&x>=0))].sort((a,b)=>a-b);
 const sel=selected==null?($('#ageFilter')?.value||'all'):String(selected);
 $('#ageFilter').innerHTML='<option value="all">全期間</option>'+vals.map(m=>`<option value="${m}">${Math.floor(m/12)}歳${m%12}か月</option>`).join('');
 $('#ageFilter').value=(sel==='all'||vals.map(String).includes(sel))?sel:'all';
}
function barHtml(data){let arr=Object.entries(data).sort((a,b)=>b[1]-a[1]),max=Math.max(...arr.map(x=>x[1]),1),sum=arr.reduce((s,x)=>s+x[1],0)||1;return arr.map(([k,v])=>`<div class=barrow><span>${esc(k)}</span><div class=bar><i style="width:${Math.max(2,v/max*100)}%"></i></div><b>${Math.round(v/sum*100)}%</b></div>`).join('')}
function renderAnalysis(){
 const selected=$('#ageFilter')?.value||'all';
 ageOptions(selected);
 let v=$('#ageFilter').value||'all',logs=readLog().filter(x=>v==='all'||String(x.ageMonths)===v);
 const total=logs.reduce((s,x)=>s+(+x.count||0),0);
 const days=new Set(logs.map(x=>x.date).filter(Boolean)).size;
 $('#ranking').innerHTML=`<div class="panel"><b>${v==='all'?'全期間':ageAtLabel(+v)}の読み聞かせ</b><p><strong>${total}回</strong> ／ 記録日 ${days}日</p></div><h3>${v==='all'?'全期間':ageAtLabel(+v)} よく読んだ本</h3>`+rankHtml(aggregateRanking(logs).slice(0,20));
 let stock={},reads={};
 for(const b of books){let g=genreOf(b);stock[g]=(stock[g]||0)+1}
 for(const x of logs){let b=books.find(z=>z.id===x.bookId),g=b?genreOf(b):'未分類';reads[g]=(reads[g]||0)+(+x.count||0)}
 $('#genreChart').innerHTML=barHtml(stock);$('#readGenreChart').innerHTML=barHtml(reads);
 let sorted=Object.entries(stock).filter(([k])=>k!=='未分類').sort((a,b)=>a[1]-b[1]).slice(0,3);
 $('#genreAdvice').innerHTML=sorted.length?`<div class=panel><b>蔵書数が少ないジャンル</b><p>${sorted.map(([k,v])=>`${esc(k)} ${v}冊`).join(' ／ ')}</p><small>不足と断定するものではなく、追加購入を検討するときの参考表示です。</small></div>`:'';
}
function ageAtLabel(m){return`${Math.floor(m/12)}歳${m%12}か月`}
$('#ageFilter').onchange=renderAnalysis;$('#refreshAnalysis').onclick=renderAnalysis;

$('#saveSettings').onclick=()=>{saveProfile();localStorage.setItem('birthDate',$('#birthDate').value||'2025-04-05');let l=readLog();l.forEach(x=>x.ageMonths=ageAt(x.date).months);saveReadLog(l);renderAnalysis();alert('保存しました')};
$('#backup').onclick=()=>{let payload={app:'けんいちくんの本棚',version:'1.0',exportedAt:new Date().toISOString(),books,mieteLog:readLog(),kumonMaster:kumonMaster(),birthDate:birth()};let blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`kenichi-books-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);$('#backupout').textContent='バックアップを書き出しました。'};
$('#restore').onchange=async e=>{try{let j=JSON.parse(await e.target.files[0].text()),r=Array.isArray(j)?j:j.books;if(!Array.isArray(r))throw Error('本棚データがありません');books=r;save();if(j.mieteLog)saveReadLog(j.mieteLog);if(j.kumonMaster)saveKumon(j.kumonMaster);if(j.birthDate)localStorage.setItem('birthDate',j.birthDate);render();renderAnalysis();$('#backupout').textContent='復元しました。'}catch(err){$('#backupout').textContent='復元できませんでした: '+err.message}};


function bibliographyMissingBooks(field=''){
 let a=books.filter(b=>b.owned!==false);
 if(field)a=a.filter(b=>!String(b[field]||'').trim());
 return a.sort(cmp);
}
function nextBibliographyMissing(){
 const field=$('#bibMissingFilter')?.value||'';
 const a=bibliographyMissingBooks(field);
 if(!a.length){renderLibraryEnrichStatus('この条件の未整備本はありません。');return}
 openEdit(a[0].id);
}
if($('#nextBibMissing'))$('#nextBibMissing').onclick=nextBibliographyMissing;
if($('#bibMissingFilter'))$('#bibMissingFilter').onchange=()=>{
 const f=$('#bibMissingFilter').value,a=bibliographyMissingBooks(f);
 renderLibraryEnrichStatus(f?`${a.length}冊が「${$('#bibMissingFilter').selectedOptions[0].textContent}」です。`:'');
};

$('#ask').onclick=async()=>{let q=$('#aiq').value.trim();if(!q)return;$('#aiout').textContent='考え中…';$('#aiStatus').textContent='蔵書・ミーテ・くもんデータを参照しています';let c={books:books.map(({title,author,publisher,genre,isbn,readCount,kumonLevel,genreTags})=>({title,author,publisher,genre,isbn,readCount,kumonLevel,genreTags})),mieteLog:[],kumonMaster:kumonMaster(),birthDate:birth()};try{let r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,context:c})}),raw=await r.text(),j={};try{j=raw?JSON.parse(raw):{}}catch(_){throw Error(`AI APIが見つかりません (${r.status})。/api/ai のデプロイを確認してください。`)}if(!r.ok)throw Error(j.error||`AI通信エラー (${r.status})`);$('#aiout').textContent=j.text||'回答を生成できませんでした。';$('#aiStatus').textContent=''}catch(e){$('#aiStatus').textContent='AI接続エラー';$('#aiout').textContent=e.message||String(e)}};
function conf(){return{url:$('#sburl').value.replace(/\/$/,''),key:$('#sbkey').value,email:$('#email').value,password:$('#password').value}}['sburl','sbkey','email'].forEach(x=>$('#'+x).value=localStorage.getItem(x)||'');async function auth(path){let c=conf();['sburl','sbkey','email'].forEach(x=>localStorage.setItem(x,$('#'+x).value));try{let r=await fetch(`${c.url}/auth/v1/${path}`,{method:'POST',headers:{apikey:c.key,'Content-Type':'application/json'},body:JSON.stringify({email:c.email,password:c.password})}),j=await r.json();if(!r.ok)throw Error(j.msg||j.error_description||'認証失敗');session=j;localStorage.setItem('session',JSON.stringify(j));$('#syncout').textContent='ログインしました'}catch(e){$('#syncout').textContent=e.message}}$('#signup').onclick=()=>auth('signup');$('#login').onclick=()=>auth('token?grant_type=password');$('#sync').onclick=async()=>{$('#syncout').textContent='この版では蔵書同期設定を維持しています。既存Supabase設定を利用してください。'};



let libraryMetadata=[];


function mergeBibliographicMaster(){
 if(!Array.isArray(libraryMetadata)||!libraryMetadata.length)return 0;
 let n=0;
 const byTitle=new Map(libraryMetadata.map(x=>[titleMatchKey(x.title),x]));
 for(const b of books){
   const m=byTitle.get(titleMatchKey(b.title)); if(!m)continue;
   let changed=false;
   for(const k of ['author','illustrator','translator','publisher','publishedDate','genre','kumonLevel']){
     if(!b[k] && m[k]){b[k]=m[k];changed=true}
   }
   if((!Array.isArray(b.genreTags)||!b.genreTags.length) && m.genre){
     b.genreTags=[m.genre]; changed=true;
   }
   if(changed){b.bibliographyMergedAt=new Date().toISOString();n++}
 }
 if(n)save();
 return n;
}

function libraryCompletionStats(){
 const owned=books.filter(b=>b.owned!==false), fields=['author','illustrator','translator','publisher','publishedDate','isbn'];
 const counts=Object.fromEntries(fields.map(k=>[k,owned.filter(b=>String(b[k]||'').trim()).length]));
 return {total:owned.length,...counts};
}
function renderLibraryEnrichStatus(msg=''){
 if(!$('#libraryEnrichStatus'))return;
 const s=libraryCompletionStats();
 $('#libraryEnrichStatus').innerHTML=`<p><b>現在 ${s.total}冊</b> ／ 作者 ${s.author} ／ 絵 ${s.illustrator} ／ 訳 ${s.translator} ／ 出版社 ${s.publisher} ／ 発行情報 ${s.publishedDate} ／ ISBN ${s.isbn}</p>${msg?`<small>${esc(msg)}</small>`:''}`;
}
async function googleTitleMetadata(title,author=''){
 try{
   const q=`intitle:"${title}"${author?` inauthor:"${author}"`:''}`;
   const r=await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&printType=books`);
   if(!r.ok)return null;
   const j=await r.json(), key=titleMatchKey(title);
   const exact=(j.items||[]).filter(x=>titleMatchKey(x.volumeInfo?.title||'')===key);
   if(exact.length!==1)return null; // 同名複数版・曖昧候補は自動確定しない
   const v=exact[0].volumeInfo||{};
   return {author:(v.authors||[]).join(' / '),publisher:v.publisher||'',publishedDate:v.publishedDate||'',source:'Google Books（タイトル完全一致）'};
 }catch(e){return null}
}
async function enrichLibraryBatch(limit=25){
 const targets=books.filter(b=>b.owned!==false && (!b.author||!b.publisher||!b.publishedDate)).sort((a,b)=>(!a.author?-1:1)-(!b.author?-1:1)||cmp(a,b)).slice(0,limit);
 if(!targets.length){renderLibraryEnrichStatus('自動補完できる未確認本はありません。ISBN未登録本はスキャンで版を確定してください。');return}
 let changedBooks=0,checked=0;
 $('#enrichLibrary').disabled=true;
 for(const b of targets){
   renderLibraryEnrichStatus(`${checked+1}/${targets.length}冊目を確認中：${b.title}`);
   const m=await googleTitleMetadata(b.title,b.author||''); checked++;
   if(!m)continue;
   let changed=false;
   for(const k of ['author','publisher','publishedDate'])if(!b[k]&&m[k]){b[k]=m[k];changed=true}
   if(changed){b.metadataVerification='タイトル完全一致・版未確定';b.metadataSource=m.source;changedBooks++}
 }
 if(changedBooks)save();
 render(); renderLibraryEnrichStatus(`${checked}冊確認し、${changedBooks}冊の空欄を補完しました。ISBNはタイトル検索では付与せず、スキャン時だけ確定します。`);
 $('#enrichLibrary').disabled=false;
}
if($('#enrichLibrary'))$('#enrichLibrary').onclick=()=>enrichLibraryBatch(50);
if($('#exportBeforeEnrich'))$('#exportBeforeEnrich').onclick=()=>$('#backup')?.click();

function titleMatchKey(title){return norm(String(title||'').replace(/^(おでかけ版|ボードブック版)/,''))}
function findBookByTitle(title){const n=titleMatchKey(title);return books.find(b=>titleMatchKey(b.title)===n)}
function isOwnedCandidate(x){return books.some(b=>(x.isbn&&b.isbn&&String(x.isbn).replace(/\D/g,'')===String(b.isbn).replace(/\D/g,''))||titleMatchKey(b.title)===titleMatchKey(x.title))}
async function applyLibraryMetadata(){
 try{libraryMetadata=await fetch('/library_metadata.json',{cache:'no-store'}).then(r=>r.json())}catch(e){libraryMetadata=[]}
 let changed=0;
 for(const m of libraryMetadata){let b=findBookByTitle(m.title);if(!b)continue;
   for(const k of ['author','illustrator','translator','publisher','publishedDate','isbn'])if(!b[k]&&m[k]){b[k]=m[k];changed++}
   if(!b.genre&&m.genre)b.genre=m.genre;
 }
 if(changed)save();
}
function ageMonthsForDate(date){return ageAt(date).months}
async function mergeBundledMiete(){
 let j;try{j=await fetch('/miete_2026_import.json',{cache:'no-store'}).then(r=>r.json())}catch(e){return}
 const old=readLog(),map=new Map(old.map(x=>[x.id,x]));let added=0;
 for(const e of (j.events||[])){let b=findBookByTitle(e.title);if(!b)continue;let x={...e,bookId:b.id,ageMonths:ageMonthsForDate(e.date)};if(!map.has(x.id)){map.set(x.id,x);added++}}
 if(added){saveReadLog([...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)));recalcReadCounts();save()}
 window._mieteBundle=j;if($('#mieteout'))$('#mieteout').innerHTML=`<p><b>保存済みミーテPDFを自動反映</b>：2026年2・3・4・5・6・7・8月／蔵書と照合できた ${j.events.length}件</p><small>歌・Baby Kumon活動は絵本回数と分離しています。</small>`;
}
function metaLine(b){let bits=[];if(b.author)bits.push('作者：'+esc(b.author));if(b.illustrator)bits.push('絵：'+esc(b.illustrator));if(b.translator)bits.push('訳・再話：'+esc(b.translator));if(b.publisher)bits.push('出版社：'+esc(b.publisher));if(b.publishedDate)bits.push('発売・初版：'+esc(b.publishedDate));if(b.isbn)bits.push('ISBN：'+esc(b.isbn));return bits.join(' ／ ')}
function integratedSummary(){
 if(!$('#integratedStatus'))return;
 const logs=readLog(),total=logs.reduce((a,x)=>a+(+x.count||0),0),withMeta=books.filter(b=>b.author||b.publisher||b.publishedDate).length;
 const domains={'季節・行事':0,'日本文化・昔話':0,'自然・科学':0,'図鑑':0,'音楽・童謡':0,'日本語・ことば':0,'生活':0,'数・知育':0};
 for(const b of books){const z=(genreOf(b)+' '+bookTags(b).join(' ')+' '+b.title);if(/季節|行事|月|春|夏|秋|冬|クリスマス|ハロウィン/.test(z))domains['季節・行事']++;if(/日本文化|昔話|古典|論語|日本史|文学/.test(z))domains['日本文化・昔話']++;if(/自然|科学|動物|植物|虫|魚|鳥|からだ/.test(z))domains['自然・科学']++;if(/図鑑|絵辞典/.test(z))domains['図鑑']++;if(/音楽|うた|歌|童謡|リズム/.test(z))domains['音楽・童謡']++;if(/ことば|音読|日本語|あいうえお/.test(z))domains['日本語・ことば']++;if(/生活|食べ物|食事|ねんね|着替/.test(z))domains['生活']++;if(/算数|数・|時計|知育|形|九九/.test(z))domains['数・知育']++;}
 const weak=Object.entries(domains).sort((a,b)=>a[1]-b[1]).slice(0,4);
 $('#integratedStatus').innerHTML=`<b>統合状況</b><p>蔵書 ${books.length}冊 ／ 書誌情報あり ${withMeta}冊 ／ ミーテ反映 ${total}回</p><small>家庭保育園資料の働きかけも踏まえた補強候補分野：${weak.map(x=>esc(x[0])+' '+x[1]+'冊').join('・')}</small>`;
}

const OVERSEAS_FALLBACK=[{"category":"季節・行事","title":"はるにれ","reason":"四季の変化を写真で追える。海外生活でも日本の季節感を補いやすい。","priority":"S","basis":"季節・自然","author":"姉崎一馬","publisher":"福音館書店"},{"category":"季節・行事","title":"さくら","reason":"日本の春と桜を絵本で残せる。","priority":"A","basis":"季節・自然","author":"長谷川摂子／矢間芳子","publisher":"福音館書店"},{"category":"季節・行事","title":"おかしなゆき ふしぎなこおり","reason":"冬の自然現象を写真で観察できる。","priority":"A","basis":"季節・自然","author":"片平孝","publisher":"ポプラ社"},{"category":"日本文化・昔話","title":"三びきのこぶた","reason":"昔話の語りと物語構造に触れる定番。","priority":"A","basis":"日本文化・昔話","author":"瀬田貞二","publisher":"福音館書店"},{"category":"日本文化・昔話","title":"かえるをのんだととさん","reason":"日本の昔話・語りのリズムを海外でも継続できる。","priority":"A","basis":"日本文化・昔話","author":"日野十成／斎藤隆夫","publisher":"福音館書店"},{"category":"自然・科学","title":"はなをくんくん","reason":"季節の変化と動物を物語で結びつける。","priority":"S","basis":"自然・観察","author":"ルース・クラウス／マーク・シーモント","publisher":"福音館書店"},{"category":"自然・科学","title":"しっぽのはたらき","reason":"動物の体の働きを観察する科学絵本。","priority":"A","basis":"自然・観察","author":"川田健／藪内正幸","publisher":"福音館書店"},{"category":"自然・科学","title":"たべられるしょくぶつ","reason":"身近な食べ物と植物を結びつける。","priority":"A","basis":"自然・食べ物","author":"森谷憲／寺島龍一","publisher":"福音館書店"},{"category":"図鑑","title":"小学館の図鑑NEO 植物","reason":"海外で実物に触れにくい日本の植物も含め、長く参照できる。","priority":"A","basis":"図鑑補強"},{"category":"図鑑","title":"小学館の図鑑NEO 昆虫","reason":"季節の虫・日本の昆虫を体系的に確認できる。","priority":"A","basis":"図鑑補強"},{"category":"音楽・童謡","title":"くもんのうた200えほん","reason":"童謡・唱歌を家庭で継続し、日本語の歌とリズムを維持しやすい。","priority":"S","basis":"歌・リズム","author":"公文教育研究会","publisher":"くもん出版"},{"category":"日本語・ことば","title":"あいうえおの本","reason":"日本語の文字・音への導入を海外でも継続できる。","priority":"A","basis":"日本語","author":"安野光雅"},{"category":"数・知育","title":"あかたろうの1・2・3の3・4・5","reason":"生活場面と数を結びつける。","priority":"A","basis":"数・生活","author":"きたやまようこ","publisher":"偕成社"}];
let overseasRecs=[];
async function loadOverseasRecs(){
  try{
    const r=await fetch('/overseas_recommendations.json?v=27',{cache:'no-store'});
    if(!r.ok)throw new Error('recommendations '+r.status);
    const j=await r.json();
    overseasRecs=Array.isArray(j)&&j.length?j:OVERSEAS_FALLBACK;
  }catch(e){overseasRecs=OVERSEAS_FALLBACK}
  const cats=[...new Set(overseasRecs.map(x=>x.category))].sort(coll.compare);
  if($('#overseasCategory')) $('#overseasCategory').innerHTML='<option value="">全ジャンル</option>'+cats.map(x=>`<option>${esc(x)}</option>`).join('');
  renderOverseas();
}
function renderOverseas(){
  if(!$('#overseasList'))return;
  const cat=$('#overseasCategory')?.value||'', pri=$('#overseasPriority')?.value||'';
  const all=overseasRecs.filter(x=>(!cat||x.category===cat)&&(!pri||x.priority===pri));
  const missing=all.filter(x=>!isOwnedCandidate(x));
  const owned=all.filter(x=>isOwnedCandidate(x));
  $('#overseasSummary').innerHTML=`<div class="panel"><b>海外赴任前の購入候補</b><p><strong>${missing.length}冊</strong> ／ 所有済み候補 ${owned.length}冊 ／ 候補全体 ${all.length}冊</p><small>現在の本棚と照合し、所有済みは購入候補から除外しています。</small></div>`;
  const card=x=>`<div class=book><div><b>${esc(x.title)}</b><div><span class=tag>${esc(x.category)}</span><span class=tag>優先${esc(x.priority)}</span></div></div><span>${esc(x.reason||'')}</span><span>${[x.author&&'作者：'+esc(x.author),x.publisher&&'出版社：'+esc(x.publisher),x.publishedDate&&'発売・初版：'+esc(x.publishedDate)].filter(Boolean).join('<br>')||'書誌情報確認中'}</span><small>基準：${esc(x.basis||'')}</small></div>`;
  $('#overseasList').innerHTML=missing.length
    ? `<h3>これから揃えたい本</h3>${missing.map(card).join('')}${owned.length?`<details><summary>所有済みの候補本 ${owned.length}冊</summary>${owned.map(card).join('')}</details>`:''}`
    : `<div class="panel"><b>現在の候補はすべて所有済みです。</b><p>「ChatGPTで今買う本を優先判定」から追加候補を出せます。</p></div>${owned.length?`<details><summary>所有済みの候補本 ${owned.length}冊</summary>${owned.map(card).join('')}</details>`:''}`;
}
if($('#showOverseas'))$('#showOverseas').onclick=()=>{
  if(!overseasRecs.length)overseasRecs=OVERSEAS_FALLBACK;
  renderOverseas();
};
if($('#overseasCategory'))$('#overseasCategory').onchange=renderOverseas;
if($('#overseasPriority'))$('#overseasPriority').onchange=renderOverseas;


// 海外赴任準備は、蔵書・ミーテ等の初期化完了を待たずに候補を表示する。
(function showOverseasImmediately(){
  overseasRecs=OVERSEAS_FALLBACK;
  const cats=[...new Set(overseasRecs.map(x=>x.category))].sort(coll.compare);
  if($('#overseasCategory')) $('#overseasCategory').innerHTML='<option value="">全ジャンル</option>'+cats.map(x=>`<option>${esc(x)}</option>`).join('');
  renderOverseas();
  loadOverseasRecs().catch(()=>{overseasRecs=OVERSEAS_FALLBACK;renderOverseas()});
})();

function readingProfileForAI(){
 const log=readLog();
 const counts={};
 for(const e of log){
   const title=e.title||e.bookTitle||'';
   if(title)counts[title]=(counts[title]||0)+(Number(e.count)||1);
 }
 return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([title,count])=>({title,count}));
}
if($('#askOverseasAI'))$('#askOverseasAI').onclick=async()=>{
 const box=$('#overseasAI'); box.textContent='分析中…';
 const ownedSummary=books.filter(b=>b.owned!==false).map(b=>({title:b.title,author:b.author||'',publisher:b.publisher||'',publishedDate:b.publishedDate||'',genre:genreOf(b),readCount:b.readCount||0})).slice(0,400);
 const missing=overseasRecs.filter(x=>!isOwnedCandidate(x));
 try{
   const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
     task:'海外赴任前に今買う本を優先判定してください。季節、日本文化・昔話、自然・科学、図鑑、音楽・童謡、日本語・ことば、数・知育の分野、現在の蔵書、ミーテで実際によく読む本を統合してください。既所有は推薦しない。優先S/A/B、具体的タイトル、理由、補う分野を示す。家庭保育園資料に明記された本だと断定せず、資料で重視される絵本・歌・リズム・自然・生活語彙等の領域との整合として説明してください。',
     books:ownedSummary, missingCandidates:missing, readingTop:readingProfileForAI(), mieteLog:[]
   })});
   const j=await r.json();
   box.textContent=j.text||j.output||j.answer||j.error||JSON.stringify(j);
 }catch(e){box.textContent='AI分析に接続できませんでした：'+e.message}
};

// v21 Miete parser: keep books separate from songs/Baby Kumon activities.
// Existing PDF import UI continues to be used; this classifier is available to the parser/review.
function classifyMieteTitle(title){
 const t=String(title||'');
 if(/やりとりぶっく|やりとりカード|やりとりノート/.test(t))return 'activity';
 if(/^(チューリップ|はと|ぞうさん|おうま|ことりのうた|しゃぼん玉|きらきらぼし|ぶんぶんぶん|犬のおまわりさん|いぬのおまわりさん|とんぼの.?めがね|ゆりかごのうた|Happy Birthday to You|The Wheels on the Bus|Twinkle[,，]?Twinkle)/i.test(t))return 'song';
 return 'book';
}

init().then(async()=>{await applyLibraryMetadata();await mergeBundledMiete();await syncOfficialKumon2026(false);render();renderAnalysis();renderMieteRank();integratedSummary();renderLibraryEnrichStatus();integratedSummary()});setTimeout(renderScanProgress,0);
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js?v=39',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{}));


// ===== v35 sales foundation =====
const IMPORT_SOURCE={MIETE_PDF:'miete_pdf',MIETE_API:'miete_api',MANUAL:'manual',OTHER:'other'};
function getProfile(){try{return JSON.parse(localStorage.getItem('childProfile')||'{}')}catch{return {}}}
function saveProfile(){
 const p={name:$('#childName')?.value||'',birthDate:$('#birthDate')?.value||'',gender:$('#childGender')?.value||''};
 localStorage.setItem('childProfile',JSON.stringify(p)); return p;
}
function loadProfile(){
 const p=getProfile();
 if($('#childName'))$('#childName').value=p.name||'';
 if($('#childGender'))$('#childGender').value=p.gender||'';
 if(p.birthDate&&$('#birthDate'))$('#birthDate').value=p.birthDate;
}
function normalizeReadSource(){
 const log=readLog();
 let changed=false;
 for(const r of log){if(!r.source){r.source=IMPORT_SOURCE.MIETE_PDF;changed=true}}
 if(changed)localStorage.setItem('mieteLog',JSON.stringify(log));
}
function bookLine(b){return `<div class="bookline" data-id="${esc(b.id||'')}"><b>${esc(b.title||'（無題）')}</b>｜${esc(b.author||'作者未登録')}｜${esc(b.publisher||'出版社未登録')}</div>`}
function renderCompactOwned(){const el=$('#compactOwnedList');if(el)el.innerHTML=books.filter(b=>b.owned!==false).sort(cmp).map(bookLine).join('')}
function renderCompactMissing(){
 const el=$('#compactMissingList'); if(!el)return;
 const a=books.filter(b=>b.owned===false).sort(cmp);
 el.innerHTML=a.map(bookLine).join('')||'<p class="muted">未所有本データを読み込み後に表示します。</p>';
}
function genreOptions(){
 const s=new Set();
 for(const b of books){for(const g of (b.genreTags||[]))if(g)s.add(g);if(b.genre)s.add(b.genre)}
 return [...s].sort((a,b)=>a.localeCompare(b,'ja')).slice(0,80);
}
function getGenrePrefs(){try{return JSON.parse(localStorage.getItem('genrePrefs')||'{"low":[],"grow":[]}')}catch{return {low:[],grow:[]}}}
function renderGenrePrefs(){
 const el=$('#genrePreferenceSettings');if(!el)return;
 const p=getGenrePrefs(),opts=genreOptions();
 const sel=(id,label,val)=>`<label>${label}<select id="${id}"><option value="">未設定</option>${opts.map(x=>`<option ${x===val?'selected':''}>${esc(x)}</option>`).join('')}</select></label>`;
 el.innerHTML=sel('lowGenre1','少ないジャンル①',p.low?.[0])+sel('lowGenre2','少ないジャンル②',p.low?.[1])+sel('growGenre1','伸ばしたいジャンル①',p.grow?.[0])+sel('growGenre2','伸ばしたいジャンル②',p.grow?.[1]);
}
function saveGenrePrefs(){
 const low=[$('#lowGenre1')?.value,$('#lowGenre2')?.value].filter(Boolean).slice(0,2);
 const grow=[$('#growGenre1')?.value,$('#growGenre2')?.value].filter(Boolean).slice(0,2);
 localStorage.setItem('genrePrefs',JSON.stringify({low:[...new Set(low)],grow:[...new Set(grow)]}));
 renderRecommendationSummary();
}
function renderRecommendationSummary(){
 const el=$('#recommendationSummary');if(!el)return;
 const p=getGenrePrefs(), prof=getProfile();
 el.innerHTML=`<p><b>${esc(prof.name||'お子さん')}</b>への推薦条件</p><p>少ない：${esc((p.low||[]).join('・')||'未設定')}<br>伸ばしたい：${esc((p.grow||[]).join('・')||'未設定')}</p><p class="muted">年齢/月齢 × ジャンル × 未所有 × くもん推薦図書 × 家庭保育園の根拠確認済みデータ、の順で候補を絞る骨格です。</p>`;
}
function pie(canvasId,data){
 const c=document.getElementById(canvasId); if(!c||!c.getContext)return;
 const ctx=c.getContext('2d'), entries=Object.entries(data||{}).filter(x=>x[1]>0), total=entries.reduce((s,x)=>s+x[1],0);
 ctx.clearRect(0,0,c.width,c.height); if(!total){ctx.fillText('データなし',120,160);return}
 let a=-Math.PI/2; const colors=['#b96f63','#d89a7c','#e9bf91','#8da399','#7f8fa6','#b5a6bd','#c9b458','#93a8ac','#d6a2ad','#9db17c'];
 entries.forEach(([k,v],i)=>{const z=v/total*Math.PI*2;ctx.beginPath();ctx.moveTo(160,160);ctx.arc(160,160,120,a,a+z);ctx.closePath();ctx.fillStyle=colors[i%colors.length];ctx.fill();a+=z});
 ctx.fillStyle='#333';ctx.font='12px sans-serif';entries.slice(0,8).forEach(([k,v],i)=>ctx.fillText(`${k} ${Math.round(v/total*100)}%`,10,18+i*16));
}
function genreCountsOwned(){
 const d={};books.filter(b=>b.owned!==false).forEach(b=>(b.genreTags?.length?b.genreTags:[b.genre]).filter(Boolean).forEach(g=>d[g]=(d[g]||0)+1));return d
}
function genreCountsRead(){
 const d={};for(const r of readLog()){const b=books.find(x=>titleMatchKey(x.title)===titleMatchKey(r.title));if(!b)continue;for(const g of (b.genreTags?.length?b.genreTags:[b.genre]).filter(Boolean))d[g]=(d[g]||0)+(Number(r.count)||1)}return d
}
function renderSalesPies(){pie('genrePie',genreCountsOwned());pie('readGenrePie',genreCountsRead())}
function setScanMode(mode){
 const add=$('#scanAddMode'),help=$('#scanModeHelp'),head=$('#scanHeading');
 localStorage.setItem('scanMode',mode);
 if(mode==='shop'){if(add)add.checked=false;if(help)help.textContent='お店でチェック：所有済みか判定し、中古価格を確認します。スキャンだけでは蔵書登録しません。';if(head)head.textContent='お店で所有・価格チェック'}
 else {if(add)add.checked=true;if(help)help.textContent='蔵書整備：スキャンした本を蔵書登録・書誌補完します。';if(head)head.textContent='ISBN・蔵書整備スキャン'}
}
function initSalesFoundation(){
 loadProfile(); normalizeReadSource(); renderGenrePrefs();renderRecommendationSummary();renderSalesPies();
 if($('#compactOwned'))$('#compactOwned').onclick=renderCompactOwned;
 if($('#compactMissing'))$('#compactMissing').onclick=renderCompactMissing;
 if($('#saveGenrePrefs'))$('#saveGenrePrefs').onclick=saveGenrePrefs;
 if($('#scanModeLibrary'))$('#scanModeLibrary').onclick=()=>setScanMode('library');
 if($('#scanModeShop'))$('#scanModeShop').onclick=()=>setScanMode('shop');
 setScanMode(localStorage.getItem('scanMode')||'library');
}
setTimeout(initSalesFoundation,400);


// ===== v36 recommendation + library handoff =====
function childAgeMonths(){
 const d=$('#birthDate')?.value||getProfile().birthDate;if(!d)return null;
 const b=new Date(d+'T00:00:00'),n=new Date();return Math.max(0,(n.getFullYear()-b.getFullYear())*12+n.getMonth()-b.getMonth()-(n.getDate()<b.getDate()?1:0))
}
function recommendationCandidates(){
 const prefs=getGenrePrefs(), wanted=[...(prefs.low||[]),...(prefs.grow||[])];
 const age=childAgeMonths();
 let pool=books.filter(b=>b.owned===false);
 return pool.map(b=>{
   const gs=(b.genreTags?.length?b.genreTags:[b.genre]).filter(Boolean);
   let score=0,reasons=[];
   for(const g of wanted)if(gs.includes(g)){score+=4;reasons.push(g)}
   if(b.kumonLevel){score+=2;reasons.push('くもん推薦図書')}
   if(b.kateiHoikuenRecommended){score+=2;reasons.push('家庭保育園・根拠確認済み')}
   if(age!=null && b.ageMinMonths!=null && age>=b.ageMinMonths && (b.ageMaxMonths==null||age<=b.ageMaxMonths)){score+=3;reasons.push('現在の月齢に対応')}
   return {b,score,reasons:[...new Set(reasons)]}
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||cmp(a.b,b.b)).slice(0,20)
}
function librarySearchUrl(b){
 const cfg=localStorage.getItem('librarySearchBase')||'';
 if(!cfg)return '';
 const q=b.isbn||b.title||'';
 try{const u=new URL(cfg);u.searchParams.set('q',q);return u.toString()}catch{return cfg}
}
function renderRecommendations(){
 const el=$('#recommendationList');if(!el)return;
 const a=recommendationCandidates(),lib=localStorage.getItem('libraryName')||'登録した図書館';
 if(!a.length){el.innerHTML='<p class="muted">条件に合う未所有本がまだありません。ジャンル設定または未所有本データを確認してください。</p>';return}
 el.innerHTML=a.map(({b,reasons})=>`<div class="recbook"><b>${esc(b.title)}</b><br><span>${esc(b.author||'作者未登録')}｜${esc(b.publisher||'出版社未登録')}</span><br><small>${esc(reasons.join('・'))}</small>${librarySearchUrl(b)?`<br><a target="_blank" rel="noopener" href="${esc(librarySearchUrl(b))}">${esc(lib)}で探す・予約へ</a>`:''}</div>`).join('')
}
function loadLibrarySettings(){const e=$('#librarySearchBase'),n=$('#libraryName');if(e)e.value=localStorage.getItem('librarySearchBase')||'';if(n)n.value=localStorage.getItem('libraryName')||''}
function saveLibrarySettings(){localStorage.setItem('librarySearchBase',$('#librarySearchBase')?.value.trim()||'');localStorage.setItem('libraryName',$('#libraryName')?.value.trim()||'');renderRecommendations()}
setTimeout(()=>{
 loadLibrarySettings();
 if($('#makeRecommendations'))$('#makeRecommendations').onclick=renderRecommendations;
 if($('#saveLibrarySettings'))$('#saveLibrarySettings').onclick=saveLibrarySettings;
},500);


// ===== v38 verified book-master enrichment =====
function renderMasterQuality(){
 const el=$('#masterQuality');if(!el)return;
 const owned=books.filter(b=>b.owned!==false), n=owned.length||1;
 const c=f=>owned.filter(b=>String(b[f]||'').trim()).length;
 el.textContent=`書誌整備：作者 ${c('author')}/${owned.length}｜出版社 ${c('publisher')}/${owned.length}｜ISBN ${c('isbn')}/${owned.length}`;
}
setTimeout(renderMasterQuality,650);


// ===== v39 isolated master-scan workspace =====
const MASTER_SCAN_KEY='masterScanWorkspace_v1';
function masterScans(){try{return JSON.parse(localStorage.getItem(MASTER_SCAN_KEY)||'[]')}catch{return []}}
function saveMasterScans(a){localStorage.setItem(MASTER_SCAN_KEY,JSON.stringify(a))}
function masterScanActive(){return localStorage.getItem('scanMode')==='master'}
function renderMasterScans(){const el=$('#masterScanList'),st=$('#masterScanStatus');if(!el||!st)return;const a=masterScans();st.textContent=`整備用スキャン：${a.length}件（本棚には加算されません）`;el.innerHTML=a.slice().reverse().map(x=>`<div class="bookline"><b>${esc(x.title||'書誌未取得')}</b>｜${esc(x.isbn)}｜${esc(x.author||'作者未取得')}｜${esc(x.publisher||'出版社未取得')}</div>`).join('')}
function setMasterScanMode(){localStorage.setItem('scanMode','master');const a=$('#scanAddMode');if(a)a.checked=false;const h=$('#scanModeHelp');if(h)h.textContent='整備用：現物ISBNと取得書誌を別領域に保存します。現在の本棚は変更しません。';renderMasterScans()}
function addMasterScan(info,code){const isbn=String(info?.isbn||code||'').replace(/\D/g,'');if(!isbn)return;const a=masterScans(),o=a.find(x=>x.isbn===isbn),r={isbn,title:info?.title||'',author:info?.author||'',publisher:info?.publisher||'',publishedDate:info?.publishedDate||'',scannedAt:new Date().toISOString(),status:'現物ISBNスキャン'};if(o)Object.assign(o,r);else a.push(r);saveMasterScans(a);renderMasterScans()}
function exportMasterScans(){const a=masterScans(),h=['ISBN-13','取得タイトル','作者','出版社','発行情報','スキャン日時','確認状態'],q=v=>`"${String(v??'').replaceAll('"','""')}"`,csv='\ufeff'+[h,...a.map(x=>[x.isbn,x.title,x.author,x.publisher,x.publishedDate,x.scannedAt,x.status])].map(r=>r.map(q).join(',')).join('\r\n'),b=new Blob([csv],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(b),ln=document.createElement('a');ln.href=u;ln.download='蔵書マスター整備スキャン結果.csv';ln.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function clearMasterScans(){if(!confirm('整備用スキャン結果だけを全消去します。現在の本棚は変更しません。よろしいですか？'))return;localStorage.removeItem(MASTER_SCAN_KEY);renderMasterScans()}
setTimeout(()=>{if($('#masterScanMode'))$('#masterScanMode').onclick=setMasterScanMode;if($('#masterScanExport'))$('#masterScanExport').onclick=exportMasterScans;if($('#masterScanClear'))$('#masterScanClear').onclick=clearMasterScans;renderMasterScans()},550);
