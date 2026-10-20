// Managed Auth cookies must be scoped to our same-origin proxy, not Neon's path.
export function localizeAuthCookie(cookie, origin) {
  let local = cookie
    .replace(/;\s*Domain=[^;]+/gi, '')
    .replace(/;\s*Path=[^;]*/gi, '')
    .replace(/;\s*SameSite=[^;]+/gi, '')
    .replace(/;\s*Partitioned/gi, '');
  local += '; Path=/; SameSite=Lax';
  if (!origin.startsWith('https://')) {
    local = local.replace(/__Secure-/g, 'elements-secure-').replace(/__Host-/g, 'elements-host-').replace(/;\s*Secure/gi, '');
  }
  return local;
}
