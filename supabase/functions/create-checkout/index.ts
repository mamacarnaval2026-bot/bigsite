import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}})
const money=(cents:number)=>(cents/100).toFixed(2)

type Item = {id:string;quantity:number}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(req.method!=='POST')return reply({error:'Método não permitido.'},405)
 try{
  const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,mp=Deno.env.get('MERCADOPAGO_ACCESS_TOKEN'),site=Deno.env.get('SITE_URL')
  if(!mp||!site) return reply({error:'Credenciais do pagamento ainda não configuradas.'},503)
  const base=new URL(site);if(base.protocol!=='https:')return reply({error:'SITE_URL deve usar HTTPS.'},503)
  const bearer=req.headers.get('Authorization')||''
  if(!bearer.startsWith('Bearer '))return reply({error:'Entre na sua conta.'},401)
  const userClient=createClient(url,anon,{global:{headers:{Authorization:bearer}}})
  const {data:{user},error:authError}=await userClient.auth.getUser(bearer.slice(7))
  if(authError||!user?.email)return reply({error:'Sessão inválida. Faça login novamente.'},401)
  const body=await req.json()
  const items:Item[]=body?.items
  const a=body?.address
  const required=['name','phone','cep','street','number','neighborhood','city','state']
  if(!Array.isArray(items)||items.length<1||items.length>15||items.some(v=>!v||typeof v.id!=='string'||!Number.isInteger(v.quantity)||v.quantity<1||v.quantity>10)||!a||typeof a!=='object'||required.some(k=>typeof a[k]!=='string'||a[k].trim().length<2||a[k].length>180)||!/^\d{8}$/.test(String(a.cep).replace(/\D/g,''))||!Array.isArray(items) || new Set(items.map(x=>x.id)).size!==items.length){return reply({error:'Revise o carrinho e os dados de entrega.'},400)}
  if(!/^[a-zA-Z]{2}$/.test(a.state))return reply({error:'UF inválida.'},400)
  const admin=createClient(url,secret)
  const {data:records,error:dbError}=await admin.from('products').select('id,name,price_cents,stock,active').in('id',items.map(i=>i.id))
  if(dbError||!records||records.length!==items.length)return reply({error:'Um dos produtos não está disponível.'},400)
  let subtotal=0
  const lines=[] as {id:string;name:string;quantity:number;price_cents:number}[]
  for(const i of items){const record=records.find(r=>r.id===i.id);if(!record?.active||record.stock<i.quantity)return reply({error:'Estoque insuficiente para '+(record?.name||'um produto')+'.'},400);subtotal+=record.price_cents*i.quantity;lines.push({id:record.id,name:record.name,quantity:i.quantity,price_cents:record.price_cents})}
  const {data:settings,error:settingsError}=await admin.from('shop_settings').select('shipping_flat_cents').eq('id',1).single()
  if(settingsError||typeof settings?.shipping_flat_cents!=='number')return reply({error:'O frete ainda não está configurado.'},503)
  const total=subtotal+settings.shipping_flat_cents
  if(total<100||total>200000000)return reply({error:'Valor de pedido não permitido.'},400)
  const safeAddress=Object.fromEntries([...required,'complement'].map(k=>[k,String(a[k]||'').trim().slice(0,180)]))
  const {data:order,error:orderError}=await admin.from('orders').insert({user_id:user.id,items:lines,address:safeAddress,total_cents:total,shipping_cents:settings.shipping_flat_cents,status:'created'}).select('id').single()
  if(orderError||!order)return reply({error:'Não foi possível criar o pedido.'},500)
  const returnUrl=(state:string)=>{const u=new URL(site);u.searchParams.set('pagamento',state);return u.toString()}
  const mpItems=[...lines.map(x=>({title:x.name,quantity:x.quantity,unit_price:money(x.price_cents)})),...(settings.shipping_flat_cents>0?[{title:'Frete',quantity:1,unit_price:money(settings.shipping_flat_cents)}]:[])]
  const api=await fetch('https://api.mercadopago.com/v1/orders',{method:'POST',headers:{Authorization:`Bearer ${mp}`,'Content-Type':'application/json','X-Idempotency-Key':order.id},body:JSON.stringify({type:'online',processing_mode:'manual',total_amount:money(total),external_reference:order.id,payer:{email:user.email},items:mpItems,config:{online:{success_url:returnUrl('retorno'),pending_url:returnUrl('pendente'),failure_url:returnUrl('falha'),auto_return:'approved'}}})})
  const result=await api.json()
  if(!api.ok||typeof result.checkout_url!=='string'||!result.id){await admin.from('orders').update({status:'failed'}).eq('id',order.id);console.error('Mercado Pago não criou a order:',api.status,JSON.stringify(result).slice(0,800));return reply({error:'O provedor de pagamento não iniciou a cobrança. Tente mais tarde.'},502)}
  const {error:linkError}=await admin.from('orders').update({mp_order_id:result.id}).eq('id',order.id)
  if(linkError){console.error(linkError);return reply({error:'Falha ao salvar referência da cobrança. Contate o suporte.'},500)}
  return reply({checkout_url:result.checkout_url,order_id:order.id})
 }catch(e){console.error(e);return reply({error:'Não foi possível iniciar o pagamento.'},500)}
})
