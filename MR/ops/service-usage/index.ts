const base=Deno.env.get('SUPABASE_URL')!;
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const dbHeaders={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
const allowedOrigin='https://mrbusinesslab.github.io';
const cors={'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type','Content-Type':'application/json','Vary':'Origin'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function reply(status:number,data:unknown){return new Response(JSON.stringify(data),{status,headers:cors})}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
 if(req.headers.get('origin')!==allowedOrigin)return reply(403,{error:'origin_not_allowed'});
 try{
  const raw=await req.text();if(raw.length>1500)return reply(413,{error:'payload_too_large'});
  const b=JSON.parse(raw);
  if(b.service!=='outstanding_quote'||b.operation!=='pdf_export'||!uuid.test(b.id)||!uuid.test(b.session_id)||!['success','failure','partial'].includes(b.outcome)||!Number.isInteger(b.duration_ms)||b.duration_ms<0||b.duration_ms>3600000)return reply(400,{error:'invalid_event'});
  const rate=await fetch(base+'/rest/v1/service_usage_events?select=id&session_id=eq.'+b.session_id+'&created_at=gte.'+encodeURIComponent(new Date(Date.now()-60000).toISOString()),{headers:dbHeaders});
  if(!rate.ok)return reply(503,{error:'storage_unavailable'});
  if((await rate.json()).length>=30)return reply(429,{error:'rate_limit'});
  const row={id:b.id,session_id:b.session_id,service:'outstanding_quote',operation:'pdf_export',outcome:b.outcome,duration_ms:b.duration_ms,source:'browser',is_test:b.is_test===true,error_code:b.outcome==='failure'?'pdf_generation_failed':b.outcome==='partial'?'terms_unavailable':null};
  const r=await fetch(base+'/rest/v1/service_usage_events?on_conflict=id',{method:'POST',headers:{...dbHeaders,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(row)});
  return r.ok?reply(200,{ok:true}):reply(503,{error:'storage_unavailable'});
 }catch{return reply(400,{error:'invalid_request'})}
});