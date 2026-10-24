import type { Product } from './types'
export default function Illustration({product,large=false}:{product:Product,large?:boolean}){
 if(product.image_url) return <img className="photo" src={product.image_url} alt={product.name} loading="lazy" onError={e=>{e.currentTarget.style.visibility='hidden'}}/>
 const tower=product.category==='Torre'; const compact=product.category==='Compactos'
 return <svg className={`unit-illustration ${large?'is-large':''}`} viewBox="0 0 320 300" role="img" aria-label="Ilustração genérica de climatizador, não representa um produto real">
 <defs><linearGradient id={`body-${product.id}`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#dce9e9"/></linearGradient><linearGradient id={`vents-${product.id}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#edf6f6"/><stop offset="1" stopColor="#b3c7cb"/></linearGradient></defs>
 <ellipse cx="160" cy="269" rx="91" ry="15" fill="#b1c8c7" opacity=".22"/>
 <g transform={tower?'translate(69 12)':'translate(0 0)'}>
 <rect x={tower?92:compact?99:81} y={tower?21:compact?76:49} width={tower?90:compact?122:158} height={tower?239:compact?161:198} rx={tower?42:compact?25:24} fill={`url(#body-${product.id})`} stroke="#bdd2d4" strokeWidth="3"/>
 <rect x={tower?105:compact?112:95} y={tower?54:compact?111:89} width={tower?64:compact?96:130} height={tower?150:compact?91:122} rx={tower?28:compact?12:16} fill={`url(#vents-${product.id})`}/>
 {Array.from({length:tower?18:compact?10:13},(_,i)=><path key={i} d={tower?`M${112} ${64+i*7.5}h49`:`M${compact?120:104} ${compact?120:99+i*0}h${compact?79:111}`} transform={tower?'':`translate(0 ${i*(compact?8:8.3)})`} stroke="#8eaeb4" strokeWidth="3.5" strokeLinecap="round" opacity=".8"/>)}
 <circle cx={tower?137:compact?159:160} cy={tower?38:compact?91:70} r="5" fill="#1f858a"/><circle cx={tower?137:compact?159:182} cy={tower?216:compact?214:225} r="3.5" fill="#c0d4d6"/>
 {!tower&&<><rect x={compact?120:103} y={compact?231:240} width={compact?80:115} height="9" rx="4" fill="#c7dada"/><circle cx={compact?121:105} cy="251" r="8" fill="#647b83"/><circle cx={compact?198:216} cy="251" r="8" fill="#647b83"/></>}
 {tower&&<rect x="118" y="255" width="38" height="10" rx="4" fill="#8fa4aa"/>}
 </g></svg>
}
