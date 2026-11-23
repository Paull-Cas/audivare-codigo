// Ensayo local exclusivamente ficticio: copia BD + dos objetos locales, no R2.
const {randomUUID,createHash}=require('node:crypto');const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');
const destino=new URL(process.env.AUDIVARE_TEST_DATABASE_URL||'http://sin-destino');
if(destino.hostname!=='127.0.0.1'||destino.username!=='audivare_test'||destino.password||!/^\/audivare_.*_test$/.test(destino.pathname))throw Error('Solo BD ficticia local dedicada');
process.env.NODE_ENV='test';process.env.DATABASE_URL=destino.href;
const {db,client,empresa,usuario,documentoEmpresa}=require('@audivare/database');const {eq}=require('drizzle-orm');
const postgres=require('node:module').createRequire(require.resolve('@audivare/database'))('postgres');
const root=path.resolve(__dirname,'../../../..'),base=path.resolve(root,'../.codex-tests'),folder=path.join(base,'recuperacion-'+randomUUID());
const eid=randomUUID(),uid=randomUUID();let restaurado;
function ejecutar(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error('Fallo del ensayo: '+(r.stderr||r.stdout));return r.stdout;}
async function conteos(c){const tablas=await c`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;const out={};for(const t of tablas){const [r]=await c`SELECT count(*)::text AS n FROM ${c(t.tablename)}`;out[t.tablename]=r.n;}return out;}
(async()=>{
try{
await db.insert(usuario).values({id:uid,email:uid+'@example.test',tipoUsuario:'CONTADOR_EXTERNO'});
await db.insert(empresa).values({id:eid,emailRegistro:eid+'@example.test',razonSocial:'Ensayo ficticio recuperación'});
const rutas=['empresa/'+eid+'/uno.pdf','empresa/'+eid+'/dos.pdf'];
for(const ruta of rutas)await db.insert(documentoEmpresa).values({empresaId:eid,titulo:'Documento ficticio',archivoStoragePath:ruta,archivoNombreOriginal:'ficticio.pdf',subidoPor:uid});
const antes=await conteos(client);
const origenObjetos=path.join(base,'objetos-origen-'+randomUUID());fs.mkdirSync(origenObjetos,{recursive:true});const manifest=[];
for(const ruta of rutas){const bytes=Buffer.from('Documento enteramente ficticio '+ruta);const file=path.join(origenObjetos,...ruta.split('/'));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);manifest.push({ruta,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
ejecutar('powershell.exe',['-NoProfile','-File',path.join(root,'infra/recuperacion/ensayo-postgres.ps1'),'-PgBin',process.env.AUDIVARE_TEST_PG_BIN||'C:/Program Files/PostgreSQL/18/bin','-Directorio',folder,'-Puerto',destino.port]);
const report=JSON.parse(fs.readFileSync(path.join(folder,'resultado.json'),'utf8').replace(/^\uFEFF/,''));
if(!/^audivare_restore_[a-f0-9]+_test$/.test(report.destino))throw Error('Destino de restauración inválido');
const url=new URL(destino);url.pathname='/'+report.destino;restaurado=postgres(url.href,{prepare:false});
const despues=await conteos(restaurado);require('node:assert/strict').deepEqual(despues,antes);
const docs=await restaurado`SELECT archivo_storage_path FROM documento_empresa WHERE empresa_id=${eid}`;
const objetos=path.join(folder,'objetos');fs.cpSync(origenObjetos,objetos,{recursive:true,errorOnExist:true,force:false});
require('node:assert/strict').deepEqual(docs.map(d=>d.archivo_storage_path).sort(),[...rutas].sort());
const m=path.join(folder,'manifiesto.json');fs.writeFileSync(m,JSON.stringify(manifest));
const resultado=JSON.parse(ejecutar('python',[path.join(root,'infra/recuperacion/verificar-objetos.py'),'--directorio',objetos,'--manifiesto',m]));if(resultado.objetos_verificados!==2)throw Error('Copia incompleta');
report.comprobaciones='Conteos de todas las tablas iguales; dos referencias y objetos ficticios SHA256 verificados';fs.writeFileSync(path.join(folder,'resultado.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({tablas_verificadas:Object.keys(antes).length,objetos_ficticios:2,restauracion:'correcta',alcance:'local, no producción/R2',carpeta:folder}));
}finally{await db.delete(documentoEmpresa).where(eq(documentoEmpresa.empresaId,eid));await db.delete(empresa).where(eq(empresa.id,eid));await db.delete(usuario).where(eq(usuario.id,uid));if(restaurado)await restaurado.end();await client.end();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
