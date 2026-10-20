import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../netlify/functions/api.mjs';
import { pool } from '../server/db.js';

const event = (path,method='GET',address='203.0.113.10',body=null) => ({
  httpMethod:method,path,headers:{host:'elementssrooms.netlify.app','x-nf-client-connection-ip':address,'content-type':'application/json'},
  queryStringParameters:null,multiValueQueryStringParameters:null,body,isBase64Encoded:false,
  requestContext:{identity:{sourceIp:'127.0.0.1'}}
});
test('Netlify function supports public rewrites and keeps private paths private',async()=>{
  for(const path of ['/api/config','/.netlify/functions/api/config']){
    const result=await handler(event(path),{});assert.equal(result.statusCode,200);
    assert.ok(Object.hasOwn(JSON.parse(result.body),'authReady'));
  }
  for(const path of ['/.env.local','/server/config.js','/scripts/set-admin-passwords.mjs'])assert.equal((await handler(event(path),{})).statusCode,404);
});
test('Netlify rate limiting identifies each client separately and blocks unknown admin access',async()=>{
  const previous=process.env.ADMIN_EMAILS;process.env.ADMIN_EMAILS='fixture@example.test';
  try{
    assert.equal((await handler(event('/api/admin/session'),{})).statusCode,401);
    for(let index=0;index<6;index++)assert.equal((await handler(event('/api/bookings','POST','203.0.113.20','{}'),{})).statusCode,400);
    assert.equal((await handler(event('/api/bookings','POST','203.0.113.20','{}'),{})).statusCode,429);
    assert.equal((await handler(event('/api/bookings','POST','203.0.113.21','{}'),{})).statusCode,400);
  }finally{process.env.ADMIN_EMAILS=previous||'';}
});
test.after(()=>pool.end());
