export default async function handler(req,res){
  try{
    const u="https://www.kumon.ne.jp/dokusho/pdf/suisen.pdf?20260401";
    const r=await fetch(u,{headers:{"User-Agent":"Mozilla/5.0"}});
    if(!r.ok)throw new Error(`KUMON PDF ${r.status}`);
    const b=Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type","application/pdf");
    res.setHeader("Cache-Control","public, max-age=86400");
    res.status(200).send(b);
  }catch(e){res.status(502).json({error:String(e)})}
}
