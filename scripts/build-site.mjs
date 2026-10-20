import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const output = path.resolve(root,'dist');
if (path.dirname(output)!==root || path.basename(output)!=='dist') throw new Error('Invalid build output path.');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const file of ['index.html','styles.css','app.js','ui-controls.js','booking.js']) await cp(path.join(root,file),path.join(output,file));
await mkdir(path.join(output,'admin'),{recursive:true});
for(const file of ['index.html','app.js','password.js','styles.css','reset-password.html','reset-password.js']) await cp(path.join(root,'admin',file),path.join(output,'admin',file));
await mkdir(path.join(output,'public'),{recursive:true});
await cp(path.join(root,'public/admin-auth.js'),path.join(output,'public/admin-auth.js'));
await cp(path.join(root,'assets'),path.join(output,'assets'),{recursive:true,filter:source=>!source.split(path.sep).includes('originals')});
for(const forbidden of ['.env.local','server','scripts','migrations','node_modules','package.json']) {
  if(await stat(path.join(output,forbidden)).then(()=>true,()=>false))throw new Error('A private file entered the public build.');
}
console.log('Public site built in dist/. Server code and credentials are excluded.');
