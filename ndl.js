export default async function handler(req,res){
 const isbn=String(req.query?.isbn||'').replace(/\D/g,'');
 if(!/^97[89]\d{10}$/.test(isbn)) return res.status(400).json({error:'invalid isbn'});
 const queries=[`isbn="${isbn}"`,`isbn=${isbn}`];
 for(const query of queries){
  try{
   const url='https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&version=1.2&recordSchema=dcndl&maximumRecords=10&recordPacking=xml&query='+encodeURIComponent(query);
   const r=await fetch(url,{headers:{'Accept':'application/xml'}});
   const xml=await r.text();
   if(!r.ok) continue;
   const unesc=s=>String(s||'').replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
   const vals=tag=>[...xml.matchAll(new RegExp('<(?:[\\w-]+:)?'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?'+tag+'>','gi'))].map(m=>unesc(m[1])).filter(Boolean);
   const title=vals('title')[0]||'';
   if(title) return res.status(200).json({isbn,title,author:vals('creator').join('・'),publisher:vals('publisher')[0]||'',publishedDate:vals('date')[0]||'',source:'国立国会図書館サーチ',found:true,query});
  }catch(e){}
 }
 return res.status(200).json({isbn,found:false});
}