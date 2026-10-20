import { createAuthClient } from '@neondatabase/auth';
// Keep the managed SDK and its plugins; the server forwards only our login methods.
export const auth = createAuthClient(`${location.origin}/api/auth`);
