export default async function handler(req,res){
const isbn=String(req.query?.isbn||'').replace(/\D/g,'');if(!/^97[89]\d{10}$/.test(isbn))return res.status(400).json({error:'invalid isbn'});
try{const url='https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&version=1.2&recordSchema=dc&maximumRecords=5&query='+encodeURIComponent('isbn="'+isbn+'"');
const r=await fetch(url);const xml=await r.text();if(!r.ok)return res.status(r.status).json({error:'ndl http '+r.status});
const clean=s=>String(s||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim();
const vals=tag=>[...xml.matchAll(new RegExp('<(?:\\w+:)?'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?'+tag+'>','gi'))].map(m=>clean(m[1])).filter(Boolean);
const title=vals('title')[0]||'',author=vals('creator').join('・'),publisher=vals('publisher')[0]||'',publishedDate=vals('date')[0]||'';
return res.status(200).json({isbn,title,author,publisher,publishedDate,source:'国立国会図書館サーチ',found:!!title});}catch(e){return res.status(500).json({error:String(e.message||e)})}}