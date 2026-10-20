import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../server/app.js';

test('Password-only admin access works without email verification; email and reset routes never reach Auth', async () => {
  const emails = ['one@example.test','two@example.test','three@example.test'];
  const forwarded = [];
  const upstream = createServer(async (req,res) => {
    res.setHeader('Content-Type','application/json');
    forwarded.push(req.url);
    if (req.url === '/get-session') {
      const identity = (req.headers.cookie || '').replace('session=','');
      const index = Number(identity);
      const user = identity === 'outsider' ? {email:'outsider@example.test'} : identity === 'banned' ? {email:emails[0],banned:true} : index>=1 && index<=3 ? {email:emails[index-1],emailVerified:false} : null;
      return res.end(JSON.stringify(user ? {session:{id:identity},user} : null));
    }
    if (req.url === '/sign-in/email') { res.setHeader('Set-Cookie','session=1; Path=/; HttpOnly'); return res.end('{"user":{"email":"one@example.test","emailVerified":false}}'); }
    if (req.url === '/sign-out') return res.end('{"success":true}');
    res.statusCode=500;res.end('{}');
  }).listen(0,'127.0.0.1');
  await new Promise(resolve=>upstream.once('listening',resolve));
  const previous = {auth:process.env.NEON_AUTH_BASE_URL,emails:process.env.ADMIN_EMAILS,db:process.env.DATABASE_URL};
  process.env.NEON_AUTH_BASE_URL=`http://127.0.0.1:${upstream.address().port}`;
  process.env.ADMIN_EMAILS=emails.join(','); process.env.DATABASE_URL='fixture';
  const app = createApp({}).listen(0,'127.0.0.1');
  await new Promise(resolve=>app.once('listening',resolve));
  const base=`http://127.0.0.1:${app.address().port}`;
  const post=(path,body={},cookie='')=>fetch(`${base}/api/auth/${path}`,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
  try {
    for (const route of ['sign-in/email-otp','email-otp/send-verification-otp','request-password-reset','reset-password','forget-password/email-otp','email-otp/reset-password','send-verification-email','sign-up/email']) {
      assert.equal((await post(route,{email:emails[0]},'session=1')).status,404,route);
    }
    assert.equal(forwarded.length,0,'Disabled endpoints must never contact the mail provider');
    assert.equal((await post('sign-in/email',{email:'outsider@example.test',password:'fixture'})).status,403);
    assert.equal(forwarded.length,0);
    assert.equal((await post('sign-in/email',{email:emails[0],password:'fixture'})).status,200);
    for(let index=1;index<=3;index++) {
      const response=await fetch(`${base}/api/admin/session`,{headers:{Cookie:`session=${index}`}});
      assert.equal(response.status,200);assert.equal((await response.json()).email,emails[index-1]);
    }
    for(const identity of ['outsider','banned','invalid']) assert.equal((await fetch(`${base}/api/admin/session`,{headers:{Cookie:`session=${identity}`}})).status,403);
    assert.equal((await fetch(`${base}/api/admin/session`)).status,401);
    assert.equal((await post('sign-out')).status,200);
    for(const route of ['/admin/reset-password','/admin/reset-password.html']) {
      const response=await fetch(base+route,{redirect:'manual'});assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/admin');
    }
  } finally {
    await new Promise(resolve=>app.close(resolve));await new Promise(resolve=>upstream.close(resolve));
    process.env.NEON_AUTH_BASE_URL=previous.auth||'';process.env.ADMIN_EMAILS=previous.emails||'';process.env.DATABASE_URL=previous.db||'';
  }
});
