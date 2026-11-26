const API='https://packaiwgsswrjvxdsejw.supabase.co/functions/v1/card-analytics-dashboard';
const selectedService=new URLSearchParams(location.search).get('service');
const el=id=>document.getElementById(id);
function esc(s){return String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))}
const labels={pdf_export:'正式 PDF 產出',gateway_draft:'待辦草稿',gateway_confirm:'確認待辦',gateway_confirm_tasks:'確認待辦',gateway_list:'待辦查詢',gateway_update:'修改待辦',gateway_calendar_draft:'日曆草稿',gateway_calendar_save:'日曆儲存',gateway_calendar_events:'日曆查詢',gateway_engineering_list:'工程案件查詢',gateway_engineering_create:'建立工程案件',gateway_engineering_detail:'工程案件詳情',gateway_engineering_stage:'案件階段調整',gateway_engineering_add_task:'工程待辦',gateway_engineering_workflow_status:'工程流程調整',gateway_engineering_workflow_note:'工程備註',gateway_engineering_workflow_finish:'工程完工'};
const resultLabels={success:'完成',failure:'失敗',partial:'已產出但缺條款',response:'已回應'};
function summary(rows){const out={total:0,success:0,failure:0,partial:0,ms:0};for(const r of rows){const n=Number(r.events);out.total+=n;if(r.outcome in out)out[r.outcome]+=n;out.ms+=Number(r.average_duration_ms)*n;}out.average=out.total?out.ms/out.total:0;return out}
function metrics(target,items){el(target).innerHTML=items.map(([label,value])=>'<div class="metric">'+esc(label)+'<strong>'+esc(value)+'</strong></div>').join('')}
function seconds(ms){return (Number(ms)/1000).toFixed(2)+' 秒'}
function render(rows){
 if(['outstanding_quote','lifeos'].includes(selectedService))rows=rows.filter(r=>r.service===selectedService);
 el('quoteMetrics').closest('section').hidden=selectedService==='lifeos';
 el('lifeosMetrics').closest('section').hidden=selectedService==='outstanding_quote';
 const quote=summary(rows.filter(r=>r.service==='outstanding_quote')),lifeos=summary(rows.filter(r=>r.service==='lifeos'));
 metrics('quoteMetrics',[['正式產出嘗試',quote.total],['完整產出／缺條款',quote.success+'／'+quote.partial],['失敗／平均耗時',quote.failure+'／'+seconds(quote.average)]]);
 metrics('lifeosMetrics',[['後端請求',lifeos.total],['後端失敗',lifeos.failure],['平均後端耗時',seconds(lifeos.average)]]);
 const grouped={};for(const r of rows.filter(x=>x.service==='lifeos'))(grouped[r.operation]??=[]).push(r);
 el('operations').innerHTML=Object.entries(grouped).map(([op,items])=>{const x=summary(items);return '<tr><td>'+esc(labels[op]||op)+'</td><td>'+x.total+'</td><td>'+x.failure+'</td><td>'+seconds(x.average)+'</td></tr>'}).join('')||'<tr><td colspan="4" class="empty">尚無正式後端紀錄。</td></tr>';
 el('daily').innerHTML=rows.map(r=>'<tr><td>'+esc(r.day)+'</td><td>'+(r.service==='lifeos'?'AI 秘書':'傑哥估價單')+'</td><td>'+esc(labels[r.operation]||r.operation)+'</td><td>'+esc(resultLabels[r.outcome]||r.outcome)+'</td><td>'+Number(r.events)+'</td><td>'+seconds(r.average_duration_ms)+'</td></tr>').join('')||'<tr><td colspan="6" class="empty">尚無正式使用紀錄，安裝後會自動累積。</td></tr>';
}
function showLogin(){el('login').classList.remove('hidden');el('app').classList.add('hidden')}
async function load(){
 try{const r=await fetch(API+'?scope=usage&days='+el('days').value,{headers:{Authorization:'Bearer '+(localStorage.getItem('mr_admin_token')||'')}});
 if(r.status===401){showLogin();return}if(!r.ok)throw Error('讀取失敗，請稍後重新整理。');
 const data=await r.json();render(data.rows||[]);el('notice').textContent='台灣時間統計；更新於 '+new Date(data.as_of).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'});
 }catch(e){el('notice').textContent=e.message;el('notice').className='error'}
}
el('loginBtn').onclick=async()=>{try{const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',password:el('password').value})});if(!r.ok)throw Error('登入失敗，請確認密碼。');const data=await r.json();localStorage.setItem('mr_admin_token',data.token);el('password').value='';el('login').classList.add('hidden');el('app').classList.remove('hidden');await load();}catch(e){el('loginError').textContent=e.message}};
el('password').addEventListener('keydown',e=>{if(e.key==='Enter')el('loginBtn').click()});
el('reload').onclick=load;el('days').onchange=load;el('logout').onclick=()=>{localStorage.removeItem('mr_admin_token');localStorage.removeItem('mr_admin_exp');showLogin()};
if(localStorage.getItem('mr_admin_token')){el('login').classList.add('hidden');el('app').classList.remove('hidden');load();}
