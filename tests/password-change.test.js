import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../server/app.js';

test('All three admins can change only their own password with a valid one-use email code', async () => {
  const emails=['one@example.test','two@example.test','three@example.test'];
  const pending=new Set(), forwarded=[];
  const upstream=createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json');
    const index=Number((req.headers.cookie||'').replace('session=',''));
    if(req.url==='/get-session')return res.end(JSON.stringify(index>=1&&index<=3?{session:{id:index},user:{email:emails[index-1],emailVerified:true}}:null));
    let raw='';for await(const chunk of req)raw+=chunk;
    const body=JSON.parse(raw||'{}');
    forwarded.push({path:req.url,email:body.email});
    if(req.url==='/forget-password/email-otp'){pending.add(body.email);return res.end('{"success":true}');}
    if(req.url==='/email-otp/reset-password'){
      if(body.otp!=='123456'||!pending.has(body.email)){res.statusCode=400;return res.end('{"message":"Invalid or expired code"}');}
      pending.delete(body.email);return res.end('{"success":true}');
    }
    res.statusCode=404;res.end('{}');
  }).listen(0,'127.0.0.1');await new Promise(resolve=>upstream.once('listening',resolve));
  const previous={auth:process.env.NEON_AUTH_BASE_URL,emails:process.env.ADMIN_EMAILS};
  process.env.NEON_AUTH_BASE_URL=`http://127.0.0.1:${upstream.address().port}`;process.env.ADMIN_EMAILS=emails.join(',');
  const app=createApp({}).listen(0,'127.0.0.1');await new Promise(resolve=>app.once('listening',resolve));
  const send=(path,body,cookie='')=>fetch(`http://127.0.0.1:${app.address().port}/api/auth/${path}`,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
  try{
    assert.equal((await send('forget-password/email-otp',{email:emails[0]})).status,401);
    assert.equal((await send('forget-password/email-otp',{email:emails[1]},'session=1')).status,403);
    assert.equal(forwarded.length,0);
    for(let i=0;i<3;i++){
      const email=emails[i],cookie=`session=${i+1}`;
      assert.equal((await send('forget-password/email-otp',{email},cookie)).status,200);
      assert.equal((await send('email-otp/reset-password',{email,otp:'000000',password:'Synthetic-test-passphrase'},cookie)).status,400);
      assert.equal((await send('email-otp/reset-password',{email,otp:'123456',password:'short'},cookie)).status,400);
      assert.equal((await send('email-otp/reset-password',{email,otp:'123456',password:'Synthetic-test-passphrase'},cookie)).status,200);
      assert.equal((await send('email-otp/reset-password',{email,otp:'123456',password:'Synthetic-test-passphrase'},cookie)).status,400);
    }
    assert.equal(pending.size,0);
  }finally{await new Promise(resolve=>app.close(resolve));await new Promise(resolve=>upstream.close(resolve));process.env.NEON_AUTH_BASE_URL=previous.auth||'';process.env.ADMIN_EMAILS=previous.emails||'';}
});
