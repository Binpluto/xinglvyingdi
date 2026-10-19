import test from 'node:test';import assert from 'node:assert/strict';
import {config,seal,open,random,authorizationUrl,allowedIdentity} from '../lib/security.mjs';
import {readFileSync} from 'node:fs';
import handler from '../api/handler.mjs';
const env={APP_ORIGIN:'https://starcamp-calendar-test.vercel.app',DATABASE_URL:'postgresql://test:unused@test.neon.tech/starcamp_calendar_test',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-only',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),TEST_ALLOWED_EMAILS:'tester@example.invalid'};
test('missing configuration fails closed without returning secrets',()=>{assert.equal(config({}).ready,false);assert.ok(config({}).missing.includes('DATABASE_URL'));});
test('production origin and database rejected',()=>{assert.throws(()=>config({...env,APP_ORIGIN:'https://starcamp-life-adventure.vercel.app'}));assert.throws(()=>config({...env,DATABASE_URL:env.DATABASE_URL.replace('starcamp_calendar_test','production')}));});
test('encrypted refresh tokens are bound to identity and fail on tampering',()=>{const c=config(env),cipher=seal('test-refresh',c.key,'refresh:user1:sub1');assert.equal(open(cipher,c.key,'refresh:user1:sub1'),'test-refresh');assert.throws(()=>open(cipher,c.key,'refresh:user2:sub1'));assert.throws(()=>open(cipher.replace('v1','v2'),c.key,'refresh:user1:sub1'));assert.ok(!cipher.includes('test-refresh'));});
test('OAuth URL fixed callback, state and PKCE; never embeds client secret',()=>{const c=config(env),state=random(),u=new URL(authorizationUrl(c,state,random()));assert.equal(u.searchParams.get('state'),state);assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('redirect_uri'),c.origin+'/api/google-calendar/callback');assert.ok(!u.href.includes(c.clientSecret));});
test('only verified allowlisted Google identity accepted',()=>{const c=config(env);assert.equal(allowedIdentity({sub:'1',email:'tester@example.invalid',email_verified:true},c),true);assert.equal(allowedIdentity({sub:'1',email:'tester@example.invalid',email_verified:false},c),false);assert.equal(allowedIdentity({sub:'1',email:'someone@example.invalid',email_verified:true},c),false);});
test('form referrer policy preserves same-origin POST without leaking cross-origin referrers',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/<meta name="referrer" content="same-origin">/);assert.doesNotMatch(html,/<meta name="referrer" content="no-referrer">/);
});
test('POST continues to reject null and foreign origins before any database query',async()=>{
  const previous=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));Object.assign(process.env,env);
  try{for(const origin of ['null','https://untrusted.example']){let body;const res={setHeader(){},end(v){body=JSON.parse(v);}};await handler({method:'POST',url:'/api/google-calendar/connect',headers:{host:'starcamp-calendar-test.vercel.app',origin}},res);assert.equal(res.statusCode,403);assert.equal(body.error,'origin_rejected');}}
  finally{for(const [k,v] of Object.entries(previous))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
