import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { validateStay, athensToday } from '../server/config.js';
import { createApp } from '../server/app.js';
import { pool } from '../server/db.js';
import { createReservation, updateReservation } from '../server/reservations.js';

const future = days => { const date = new Date(`${athensToday()}T12:00:00Z`); date.setUTCDate(date.getUTCDate()+days); return date.toISOString().slice(0,10); };
const input = (property='Pearl', start=150, end=153) => ({ property, checkin:future(start), checkout:future(end), kind:'block', note:'Automated integration test' });

test('Dates reject impossible, reversed, past dates and unknown properties', () => {
  assert.throws(() => validateStay({ ...input(), checkin:'2027-02-30' }));
  assert.throws(() => validateStay(input('Pearl',153,150)));
  assert.throws(() => validateStay({ ...input(), checkin:'2020-01-01' }));
  assert.throws(() => validateStay(input('Onyx')));
  assert.equal(validateStay(input()).property,'Pearl');
});

test('Private routes require login; secrets and backend sources are never served', async () => {
  const previous = { auth:process.env.NEON_AUTH_BASE_URL, emails:process.env.ADMIN_EMAILS };
  process.env.NEON_AUTH_BASE_URL='https://example.neon.tech/elements/auth'; process.env.ADMIN_EMAILS='owner@example.com';
  const server = createApp(pool).listen(0,'127.0.0.1'); await new Promise(resolve => server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of ['/api/admin/session','/api/admin/reservations']) assert.equal((await fetch(base+route)).status,401);
    for (const route of ['/.env.local','/server/config.js','/migrations/001-reservations.sql','/package.json']) assert.equal((await fetch(base+route)).status,404);
    assert.equal((await fetch(base+'/api/admin/reservations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input())})).status,401);
    assert.equal((await fetch(base+'/api/bookings',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:'{}'})).status,403);
    assert.equal((await fetch(base+'/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input(),name:'Test',email:'test@example.com',guests:9})})).status,400);
  } finally { await new Promise(resolve=>server.close(resolve)); process.env.NEON_AUTH_BASE_URL=previous.auth||'';process.env.ADMIN_EMAILS=previous.emails||''; }
});

test('Database prevents telephone/website conflicts, handles concurrent requests and releases cancelled nights', { skip:process.env.ENV_FILE!=='.env.development.local' }, async () => {
  const actor=`integration-${randomUUID()}`, created=[];
  const make=async body=>{ const reservation=await createReservation(pool,body,actor);created.push(reservation.id);return reservation; };
  try {
    const phone=await make({...input(),kind:'phone'});
    await assert.rejects(()=>make({...input(),kind:'request'}), error=>error.status===409);
    await make(input('Ivory'));
    await make(input('Pearl',153,155)); // An arrival on another guest's departure is valid.
    const race=await Promise.allSettled([make(input('SkouZen',160,163)),make(input('SkouZen',160,163))]);
    assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(race.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);
    await updateReservation(pool,phone.id,'cancel',actor);
    const request=await make({...input(),kind:'request'});
    await updateReservation(pool,request.id,'confirm',actor);
    const row=await pool.query('SELECT status FROM reservations WHERE id=$1',[request.id]);assert.equal(row.rows[0].status,'confirmed');
    await assert.rejects(()=>updateReservation(pool,request.id,'confirm',actor),error=>error.status===409);
    const occupied=await pool.query('SELECT count(*)::int AS nights FROM occupied_nights WHERE reservation_id=$1',[request.id]);assert.equal(occupied.rows[0].nights,3);
  } finally { for (const id of created) await updateReservation(pool,id,'cancel',actor); }
});

test('API stores a web request; private admin action blocks it and cancellation restores availability', { skip:process.env.ENV_FILE!=='.env.development.local' }, async () => {
  // Local stand-in tests authorization decisions without sending login emails.
  // The production code still validates sessions against Managed Neon Auth.
  const authServer=createServer((req,res)=>{
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify(req.headers.cookie==='session=admin' ? {session:{id:'test'},user:{email:'owner@example.com',emailVerified:true}} : req.headers.cookie==='session=outsider' ? {session:{id:'test'},user:{email:'other@example.com',emailVerified:true}} : null));
  }).listen(0,'127.0.0.1');await new Promise(resolve=>authServer.once('listening',resolve));
  const previous={auth:process.env.NEON_AUTH_BASE_URL,emails:process.env.ADMIN_EMAILS};
  process.env.NEON_AUTH_BASE_URL=`http://127.0.0.1:${authServer.address().port}`;process.env.ADMIN_EMAILS='owner@example.com';
  const server=createApp(pool).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`, created=[];
  const send=(route,body,cookie='session=admin',method='POST')=>fetch(base+route,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
  try {
    assert.equal((await fetch(base+'/api/admin/reservations',{headers:{Cookie:'session=outsider'}})).status,403);
    const stay=input('Pearl',170,172);
    let response=await send('/api/admin/reservations',stay);assert.equal(response.status,201);const block=await response.json();created.push(block.id);
    let availability=await (await fetch(base+'/api/availability?property=Pearl')).json();assert.ok(availability.dates.includes(stay.checkin));
    const web={...stay,name:'Test guest',email:'test@example.com',guests:2};
    assert.equal((await send('/api/bookings',web,'')).status,409);
    assert.equal((await send(`/api/admin/reservations/${block.id}`,{action:'cancel'},'session=admin','PATCH')).status,200);
    response=await send('/api/bookings',web,'');assert.equal(response.status,201);const request=await response.json();created.push(request.id);
    const entries=await (await fetch(base+'/api/admin/reservations',{headers:{Cookie:'session=admin'}})).json();assert.equal(entries.reservations.find(r=>r.id===request.id).status,'pending');
    availability=await (await fetch(base+'/api/availability?property=Pearl')).json();assert.deepEqual(Object.keys(availability).sort(),['dates','property']);assert.ok(!JSON.stringify(availability).includes('guest'));
  } finally {
    for (const id of created) await updateReservation(pool,id,'cancel','integration-test');
    await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>authServer.close(resolve));
    process.env.NEON_AUTH_BASE_URL=previous.auth||'';process.env.ADMIN_EMAILS=previous.emails||'';
  }
});
test.after(()=>pool.end());
