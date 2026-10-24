export type Product = {
 id:string; name:string; subtitle:string; description:string; price_cents:number; compare_at_cents:number|null; category:string; area:string; image_url:string|null; features:string[]; active:boolean; stock:number; featured:boolean; demo?:boolean;
}
export type Order = { id:string; created_at:string; status:string; total_cents:number; shipping_cents:number; address:Record<string,string>; items: {name:string;quantity:number;price_cents:number}[] }
export type Address = {name:string;phone:string;cep:string;street:string;number:string;complement:string;neighborhood:string;city:string;state:string}
