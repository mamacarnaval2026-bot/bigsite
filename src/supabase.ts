import { createClient } from '@supabase/supabase-js'
const url=import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const key=import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
export const configured = /^https:\/\/[^ ]+\.supabase\.co$/.test(url) && !!key && !key.includes('COLE_')
export const supabase=configured ? createClient(url,key,{ auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true} }) : null
