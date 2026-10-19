import {randomBytes,createHash,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
export const SCOPES=['openid','email','https://www.googleapis.com/auth/calendar.readonly'];
export const hash=v=>createHash('sha256').update(v).digest('hex');
export const random=()=>randomBytes(32).toString('base64url');
export function config(env=process.env){
  const required=['APP_ORIGIN','DATABASE_URL','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','TOKEN_ENCRYPTION_KEY','TEST_ALLOWED_EMAILS'];
  const missing=required.filter(k=>!env[k]?.trim());if(missing.length)return {ready:false,missing};
  const origin=new URL(env.APP_ORIGIN);
  if(origin.protocol!=='https:'||origin.origin!==env.APP_ORIGIN||origin.hostname==='starcamp-life-adventure.vercel.app'||origin.hostname.endsWith('.chatgpt.site'))throw new Error('test_origin_invalid');
  const db=new URL(env.DATABASE_URL);
  if(!['postgres:','postgresql:'].includes(db.protocol)||!db.hostname.endsWith('.neon.tech')||decodeURIComponent(db.pathname)!=='/starcamp_calendar_test')throw new Error('test_database_invalid');
  const key=Buffer.from(env.TOKEN_ENCRYPTION_KEY,'base64');if(key.length!==32)throw new Error('encryption_key_invalid');
  const allowed=env.TEST_ALLOWED_EMAILS.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if(!allowed.length||allowed.some(s=>!/^\S+@\S+\.\S+$/.test(s)))throw new Error('allowlist_invalid');
  return {ready:true,origin:origin.origin,dbUrl:env.DATABASE_URL,clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET,key,allowed,redirectUri:`${origin.origin}/api/google-calendar/callback`};
}
export function seal(value,key,aad){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from(aad));const encrypted=Buffer.concat([c.update(value,'utf8'),c.final()]);return ['v1',iv.toString('base64url'),encrypted.toString('base64url'),c.getAuthTag().toString('base64url')].join('.');}
export function open(value,key,aad){const [v,iv,encrypted,tag]=value.split('.');if(v!=='v1')throw new Error('cipher_invalid');const d=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));d.setAAD(Buffer.from(aad));d.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([d.update(Buffer.from(encrypted,'base64url')),d.final()]).toString('utf8');}
export function same(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y);}
export function cookieValue(req,name){const raw=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='));return raw?raw.slice(name.length+1):'';}
export function cookie(name,value,maxAge){return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;}
export function authorizationUrl(c,state,verifier){const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');u.search=new URLSearchParams({client_id:c.clientId,redirect_uri:c.redirectUri,response_type:'code',access_type:'offline',prompt:'consent',scope:SCOPES.join(' '),state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});return u.href;}
export function allowedIdentity(identity,c){return Boolean(identity?.sub&&identity.email_verified===true&&c.allowed.includes(String(identity.email||'').toLowerCase()));}
