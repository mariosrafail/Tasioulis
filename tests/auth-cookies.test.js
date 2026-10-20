import test from 'node:test';
import assert from 'node:assert/strict';
import { localizeAuthCookie } from '../server/auth-cookies.js';

test('Local Auth proxy cookies work across admin and API paths on HTTP localhost', () => {
  const upstream='__Secure-neon-auth.session_token=fixture; Domain=example.neon.tech; Path=/elements/auth; HttpOnly; Secure; SameSite=None; Partitioned';
  const cookie=localizeAuthCookie(upstream,'http://127.0.0.1:18764');
  assert.match(cookie,/^elements-secure-neon-auth.session_token=fixture;/);
  assert.match(cookie,/; Path=\/(?:;|$)/);
  assert.match(cookie,/; HttpOnly/);
  assert.match(cookie,/; SameSite=Lax/);
  assert.doesNotMatch(cookie,/; (Domain|Secure|Partitioned)|\/elements\/auth/);
});
test('HTTPS Auth proxy preserves Secure, HttpOnly and cookie expiration', () => {
  const cookie=localizeAuthCookie('__Host-neon-auth.session_token=; Path=/elements/auth; HttpOnly; Secure; Max-Age=0; SameSite=None; Partitioned','https://elements.example');
  assert.match(cookie,/^__Host-/);assert.match(cookie,/; Secure/);assert.match(cookie,/; HttpOnly/);assert.match(cookie,/; Max-Age=0/);assert.match(cookie,/; Path=\//);
  assert.doesNotMatch(cookie,/Partitioned|SameSite=None/);
});
