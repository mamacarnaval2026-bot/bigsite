import { createClient } from 'npm:@supabase/supabase-js@2'

// Função pública somente para notificações assinadas do Mercado Pago.
// Configurar --no-verify-jwt APENAS nesta função (a autenticação aqui é HMAC).
const json=(message:string,status=200)=>new Response(JSON.stringify({message}),{status,headers:{'Content-Type':'application/json'}})
function equalConstantTime(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
async function signatureOk(secret:string,signature:string,requestId:string,dataId:string){
 const fields=Object.fromEntries(signature.split(',').map(part=>part.trim().split('=')))
 const ts=fields.ts,v1=fields.v1
 if(!ts||!v1||!/^\d+$/.test(ts)||!/^[0-9a-f]{64}$/i.test(v1))return false
 if(Math.abs(Date.now()/1000-Number(ts))>600)return false
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
 // Alguns eventos usam ID alfanumérico; seguir o ID da requisição recebido no webhook.
 for(const id of [dataId,dataId.toLowerCase()]){
  const manifest=`id:${id};request-id:${requestId};ts:${ts};`
  const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(manifest)))
  const expected=Array.from(digest).map(b=>b.toString(16).padStart(2,'0')).join('')
  if(equalConstantTime(expected,v1.toLowerCase()))return true
 }
 return false
}
Deno.serve(async req=>{
 if(req.method!=='POST')return json('Method not allowed',405)
 try{
  const webhookSecret=Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET'),access=Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')
  if(!webhookSecret||!access)return json('Not configured',503)
  const url=new URL(req.url)
  const dataId=url.searchParams.get('data.id')||url.searchParams.get('data_id')||''
  const signature=req.headers.get('x-signature')||'',requestId=req.headers.get('x-request-id')||''
  if(!dataId||!requestId||!(await signatureOk(webhookSecret,signature,requestId,dataId)))return json('Invalid signature',401)
  const body=await req.json()
  if(body?.type!=='order'||body?.data?.id!==dataId)return json('Ignored')
  const response=await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(dataId)}`,{headers:{Authorization:`Bearer ${access}`}})
  if(!response.ok){console.error('Falha ao consultar order MP',response.status);return json('Temporary provider error',503)}
  const mp=await response.json()
  if(mp.id!==dataId||!mp.external_reference)return json('Not found',404)
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const {data:local,error}=await admin.from('orders').select('id,total_cents,mp_order_id,status').eq('id',mp.external_reference).maybeSingle()
  if(error)return json('Database unavailable',503)
  if(!local)return json('Order unknown',404)
  if(local.mp_order_id!==mp.id)return json('Reference mismatch',409)
  const total=Math.round(Number(mp.total_amount)*100),paid=Math.round(Number(mp.total_paid_amount)*100)
  if(!Number.isFinite(total)||total!==local.total_cents)return json('Amount mismatch',409)
  let next='pending'
  if(mp.status==='processed'&&mp.status_detail==='accredited'&&paid===total)next='processed'
  else if(mp.status==='cancelled'||mp.status==='canceled')next='cancelled'
  else if(mp.status==='failed'||mp.status==='rejected')next='failed'
  else if(mp.status==='refunded')next='refunded'
  const {error:rpcError}=await admin.rpc('set_payment_status',{p_order_id:local.id,p_status:next})
  if(rpcError){console.error('Falha ao atualizar pedido',rpcError);return json('Temporary database error',503)}
  return json('ok')
 }catch(e){console.error(e);return json('Error',500)}
})
