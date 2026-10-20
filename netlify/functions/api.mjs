import serverless from 'serverless-http';
import { createApp } from '../../server/app.js';
import { pool } from '../../server/db.js';
const serve = serverless(createApp(pool,{serveStatic:false,netlify:true}));
export const handler = async (event,context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const prefix = '/.netlify/functions/api';
  const request = event.path?.startsWith(prefix) ? {...event,path:`/api${event.path.slice(prefix.length)}`} : event;
  return serve(request,context);
};
