import {config,random,hash,seal,open,cookieValue,cookie,authorizationUrl,allowedIdentity,SCOPES} from '../lib/security.mjs';
import {database,transaction} from '../lib/db.mjs';
import {googleJson,googleAccess,listGoogleCalendars} from '../lib/google-calendar.mjs';
import {savedCalendars,saveCalendarSelection,syncOneCalendar,eventPage} from '../lib/calendar-store.mjs';
import {verifyBridge,ownerOperation} from '../lib/owner-bridge.mjs';
const S='calendar_bridge_test',SESSION='__Host-calendar_test',STATE='__Host-calendar_oauth';
const send=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));};
const redirect=(res,to)=>{res.statusCode=303;res.setHeader('Location',to);res.end();};
function inputBody(req){const raw=req.body;if(typeof raw==='string'){if(raw.length>65536)throw new Error('invalid_request');return JSON.parse(raw);}if(!raw||typeof raw!=='object')throw new Error('invalid_request');return raw;}
async function userFor(req,db,c){const token=cookieValue(req,SESSION);if(!token)return null;const result=await db.query(`SELECT u.id,u.email FROM ${S}.sessions s JOIN ${S}.users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,[hash(token)]);const u=result.rows[0];return u&&c.allowed.includes(u.email.toLowerCase())?u:null;}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  let c;try{c=config();}catch{return send(res,503,{error:'test_configuration_invalid'});}
  const url=new URL(req.url,'https://test.invalid');
  const routed=req.query?.route;
  const path=routed?`/api/${Array.isArray(routed)?routed.join('/'):routed}`:url.pathname;
  if(req.method==='GET'&&path==='/api/status')return send(res,200,{environment:'isolated-test',configured:c.ready,missing:c.missing||[],productionConnected:false,taskWritesEnabled:false,testEventWritesEnabled:true,syncMode:'manual-full-window',googleCallback:c.ready?c.redirectUri:null});
  if(!c.ready)return send(res,503,{error:'test_not_configured',missing:c.missing});
  if(req.headers.host!==new URL(c.origin).host)return send(res,403,{error:'wrong_test_host'});
  const db=database(c);
  try{
    if(path==='/api/owner-bridge'){
      if(req.method!=='POST')return send(res,405,{error:'method_not_allowed'});
      const body=inputBody(req),raw=JSON.stringify(body);
      if(!verifyBridge(raw,req.headers,process.env.OWNER_PILOT_BRIDGE_KEY))return send(res,403,{error:'bridge_rejected'});
      return send(res,200,await ownerOperation(db,c,body));
    }
    if(req.method==='POST'&&path==='/api/google-calendar/connect'){
      if(req.headers.origin!==c.origin)return send(res,403,{error:'origin_rejected'});
      const state=random(),browser=random(),verifier=random();
      await db.query(`DELETE FROM ${S}.oauth_states WHERE expires_at<now()`);
      await db.query(`INSERT INTO ${S}.oauth_states(state_hash,browser_hash,verifier_ciphertext,redirect_uri,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 minutes')`,[hash(state),hash(browser),seal(verifier,c.key,`oauth:${hash(state)}`),c.redirectUri]);
      res.setHeader('Set-Cookie',cookie(STATE,browser,600));return redirect(res,authorizationUrl(c,state,verifier));
    }
    if(req.method==='GET'&&path==='/api/google-calendar/callback'){
      res.setHeader('Set-Cookie',cookie(STATE,'',0));
      const state=url.searchParams.get('state'),code=url.searchParams.get('code'),browser=cookieValue(req,STATE);
      if(!state||!browser)return redirect(res,'/?oauth=state_error');
      const result=await db.query(`DELETE FROM ${S}.oauth_states WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>now() AND redirect_uri=$3 RETURNING verifier_ciphertext`,[hash(state),hash(browser),c.redirectUri]);
      if(!result.rows[0])return redirect(res,'/?oauth=state_error');
      if(url.searchParams.has('error')||!code)return redirect(res,'/?oauth=cancelled');
      const verifier=open(result.rows[0].verifier_ciphertext,c.key,`oauth:${hash(state)}`);
      const tokens=await googleJson('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.clientId,client_secret:c.clientSecret,redirect_uri:c.redirectUri,code,code_verifier:verifier,grant_type:'authorization_code'})});
      if(!tokens.access_token||!tokens.refresh_token||!tokens.scope?.split(' ').includes(SCOPES[2]))return redirect(res,'/?oauth=scope_error');
      const identity=await googleJson('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`}});
      if(!allowedIdentity(identity,c))return redirect(res,'/?oauth=not_allowed');
      const session=random();
      await transaction(db,async tx=>{
        const result=await tx.query(`INSERT INTO ${S}.users(google_subject,email) VALUES($1,$2) ON CONFLICT(google_subject) DO UPDATE SET email=excluded.email,updated_at=now() RETURNING id`,[identity.sub,identity.email.toLowerCase()]);
        const id=result.rows[0].id;
        await tx.query(`INSERT INTO ${S}.connections(user_id,google_subject,google_email,refresh_token_ciphertext,granted_scopes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id,google_subject) DO UPDATE SET refresh_token_ciphertext=excluded.refresh_token_ciphertext,google_email=excluded.google_email,granted_scopes=excluded.granted_scopes,status='active',updated_at=now()`,[id,identity.sub,identity.email.toLowerCase(),seal(tokens.refresh_token,c.key,`refresh:${id}:${identity.sub}`),tokens.scope.split(' ')]);
        await tx.query(`INSERT INTO ${S}.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 day')`,[hash(session),id]);
      });
      res.setHeader('Set-Cookie',[cookie(STATE,'',0),cookie(SESSION,session,86400)]);return redirect(res,'/?oauth=connected');
    }
    const user=await userFor(req,db,c);if(!user)return send(res,401,{error:'test_login_required'});
    if(req.method==='GET'&&path==='/api/session')return send(res,200,{email:user.email,environment:'isolated-test',taskWritesEnabled:false});
    if(req.method==='POST'&&path==='/api/logout'){
      if(req.headers.origin!==c.origin)return send(res,403,{error:'origin_rejected'});
      await db.query(`DELETE FROM ${S}.sessions WHERE token_hash=$1`,[hash(cookieValue(req,SESSION))]);res.setHeader('Set-Cookie',cookie(SESSION,'',0));return redirect(res,'/');
    }
    // All calendar writes below target calendar_bridge_test only. No production task bridge.
    if(req.method==='GET'&&path==='/api/calendars'){
      const {getJson}=await googleAccess(db,c,user);
      return send(res,200,{calendars:await listGoogleCalendars(getJson),saved:await savedCalendars(db,user),productionConnected:false});
    }
    if(req.method==='GET'&&path==='/api/sync-state')return send(res,200,{calendars:await savedCalendars(db,user),productionConnected:false});
    if(req.method==='POST'&&['/api/calendar-selection','/api/calendar-sync'].includes(path)){
      if(req.headers.origin!==c.origin)return send(res,403,{error:'origin_rejected'});
      const input=inputBody(req),{connection,getJson}=await googleAccess(db,c,user);
      if(path==='/api/calendar-selection'){await saveCalendarSelection(db,user,connection,await listGoogleCalendars(getJson),input);return send(res,200,{calendars:await savedCalendars(db,user)});}
      if(typeof input.calendarId!=='string'||!/^[a-f0-9-]{36}$/i.test(input.calendarId))return send(res,400,{error:'invalid_calendar_id'});
      return send(res,200,await syncOneCalendar(db,user,input.calendarId,connection,getJson));
    }
    if(req.method==='GET'&&path==='/api/events'){
      const calendarId=url.searchParams.get('calendarId');
      const cal=(await db.query(`SELECT sync_query FROM ${S}.calendars WHERE id=$1 AND user_id=$2`,[calendarId,user.id])).rows[0];if(!cal)return send(res,404,{error:'calendar_not_found'});
      return send(res,200,await eventPage(db,user,{calendarId,...cal.sync_query,offset:url.searchParams.get('offset')||0,q:url.searchParams.get('q')||''}));
    }
    return send(res,404,{error:'test_route_not_found'});
  }catch(error){const safe=['invalid_request','invalid_date_range','invalid_time_zone','invalid_selection','calendar_not_readable','sync_in_progress','calendar_unselected_or_busy','google_permission_denied','google_rate_limited','google_reconnect_required','google_request_failed'];const code=safe.includes(error.message)?error.message:'test_operation_failed';return send(res,code.startsWith('invalid_')?400:code.includes('busy')||code==='sync_in_progress'?409:503,{error:code,message:'操作未完成：'+code+'。未写入线上任务。'});}
}
