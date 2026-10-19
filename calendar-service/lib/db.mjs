import pg from 'pg';
let pool;
export function database(config){
  if(!pool){const url=new URL(config.dbUrl);for(const k of ['sslmode','sslcert','sslkey','sslrootcert','channel_binding'])url.searchParams.delete(k);
    pool=new pg.Pool({connectionString:url.href,ssl:{rejectUnauthorized:true},max:2,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,statement_timeout:10000});}
  return pool;
}
export async function transaction(db,fn){const client=await db.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
