const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');const path=require('node:path');
const u=new URL(process.env.AUDIVARE_TEST_DATABASE_URL||'http://sin-destino');
if(!['postgres:','postgresql:'].includes(u.protocol)||u.hostname!=='127.0.0.1'||u.username!=='audivare_test'||!/^\/audivare_.*_test$/.test(u.pathname))throw Error('Solo BD local dedicada');
process.env.NODE_ENV='test';process.env.DATABASE_URL=u.href;
const {db,client,usuario,auditoriaOperacion,expedientePrivacidad,expedienteEvento}=require('@audivare/database');const {eq,inArray,sql}=require('drizzle-orm');const {migrate}=require('drizzle-orm/postgres-js/migrator');
const {PrivacidadService}=require('../../dist/privacidad/privacidad.service');const {registrarAuditoriaHttp}=require('../../dist/privacidad/auditoria-http');const {registrarSeguridadHttp}=require('../../dist/common/seguridad-http');const fastify=require('fastify');
const principal=randomUUID(),otro=randomUUID(),contador=randomUUID();const s=new PrivacidadService();const expedientes=[];
before(async()=>{await migrate(db,{migrationsFolder:path.resolve(__dirname,'../../../../packages/database/drizzle')});await db.insert(usuario).values([{id:principal,email:principal+'@example.test',tipoUsuario:'SUPERADMIN',esSuperadminPrincipal:true},{id:otro,email:otro+'@example.test',tipoUsuario:'SUPERADMIN'},{id:contador,email:contador+'@example.test',tipoUsuario:'CONTADOR_EXTERNO'}]);});
after(async()=>{for(const id of expedientes){await db.delete(expedienteEvento).where(eq(expedienteEvento.expedienteId,id));await db.delete(expedientePrivacidad).where(eq(expedientePrivacidad.id,id));}await db.delete(usuario).where(inArray(usuario.id,[principal,otro,contador]));await client.end();});
async function crear(){const r=await s.recibir({tipo:'ACCESO',correo:'usuario1@example.invalid',descripcion:'Solicitud ficticia'});expedientes.push(r.referencia);return r.referencia;}
test('Recepción anónima persiste sin divulgación; solo principal puede leer',async()=>{
const id=await crear();assert.equal((await s.detalle(principal,id)).estado,'RECIBIDA');for(const a of [otro,contador,randomUUID()])await assert.rejects(s.detalle(a,id),/restringido/);
});
test('Cierre exige verificación; notas atómicas y cierre concurrente único',async()=>{
const id=await crear();await assert.rejects(s.actualizar(principal,id,{estado:'RESPONDIDA',nota:'No verificada'}),/Verifica/);
assert.equal((await s.detalle(principal,id)).eventos.length,0);
await s.actualizar(principal,id,{estado:'VERIFICADA',nota:'Identidad ficticia comprobada'});
const results=await Promise.allSettled([s.actualizar(principal,id,{estado:'RESPONDIDA',nota:'Constancia ficticia A'}),s.actualizar(principal,id,{estado:'RESPONDIDA',nota:'Constancia ficticia B'})]);
assert.equal(results.filter(x=>x.status==='fulfilled').length,1);const d=await s.detalle(principal,id);assert.equal(d.eventos.length,2);assert.equal(d.estado,'RESPONDIDA');
});
test('HTTP registra antes de ejecutar y finaliza sin contenido ni actor de headers',async()=>{
const app=fastify();let fallos=0;registrarAuditoriaHttp(app,()=>fallos++);app.post('/empresa/:id',async req=>{const pending=await db.select().from(auditoriaOperacion).where(sql`${auditoriaOperacion.recursos}->>'id' = ${req.params.id} AND ${auditoriaOperacion.estado} = 'PENDIENTE'`);assert.equal(pending.length,1);return {secreto:'no guardar'};});
const id=randomUUID();const res=await app.inject({method:'POST',url:'/empresa/'+id+'?token=secreto',headers:{'x-user-id':principal},payload:{password:'public-review-fixture-only'}});assert.equal(res.statusCode,200);
const [row]=await db.select().from(auditoriaOperacion).where(eq(auditoriaOperacion.id,res.headers['x-audit-id']));assert.equal(row.estado,'RESPONDIDA');assert.equal(row.actorId,null);assert.deepEqual(row.recursos,{id});assert.equal(row.ruta,'/empresa/:id');assert.equal(fallos,0);
await assert.rejects(db.delete(auditoriaOperacion).where(eq(auditoriaOperacion.id,row.id)),e=>/Retencion/.test(e.cause?.message));await assert.rejects(db.update(auditoriaOperacion).set({ruta:'falsificada'}).where(eq(auditoriaOperacion.id,row.id)),e=>/reescribir/.test(e.cause?.message));await app.close();
});
test('Fallo de auditoría inicial bloquea handler y no confirma operación',async()=>{
const app=fastify();let ejecutada=false,fallos=0;registrarAuditoriaHttp(app,()=>fallos++);app.get('/'.padEnd(260,'x'),()=>{ejecutada=true;return {ok:true};});
// Inyectar caída real del acceso a insert sin modificar conexión o filas.
const original=db.insert;db.insert=()=>{throw Error('BD no disponible');};
try{const r=await app.inject({url:'/'.padEnd(260,'x')});assert.equal(r.statusCode,503);assert.equal(ejecutada,false);assert.equal(fallos,1);}finally{db.insert=original;await app.close();}
});
test('Cuota pública rechaza exceso y no depende de sesión',async()=>{
const app=fastify();registrarSeguridadHttp(app,()=>{});app.post('/privacidad/solicitudes',()=>({ok:true}));
for(let i=0;i<5;i++)assert.equal((await app.inject({method:'POST',url:'/privacidad/solicitudes',payload:{correo:'usuario2@example.invalid'}})).statusCode,200);
assert.equal((await app.inject({method:'POST',url:'/privacidad/solicitudes',payload:{correo:'usuario2@example.invalid'}})).statusCode,429);
assert.equal((await app.inject({method:'POST',url:'/privacidad/solicitudes',payload:{correo:'usuario3@example.invalid'}})).statusCode,200);await app.close();
});
test('Fallo final conserva intención pendiente sin provocar reintento de un cambio confirmado',async()=>{
const app=fastify();let fallos=0,ejecutada=0;registrarAuditoriaHttp(app,()=>fallos++);app.post('/cambio',()=>{ejecutada++;return {ok:true};});
const original=db.update;db.update=()=>{throw Error('Fallo al completar');};let res;
try{res=await app.inject({method:'POST',url:'/cambio'});assert.equal(res.statusCode,200);assert.equal(ejecutada,1);assert.equal(fallos,1);}finally{db.update=original;await app.close();}
const [row]=await db.select().from(auditoriaOperacion).where(eq(auditoriaOperacion.id,res.headers['x-audit-id']));assert.equal(row.estado,'PENDIENTE');assert.equal(row.codigoHttp,null);
});
test('Incidente solo interno y notas durables; no requiere identidad de solicitante',async()=>{
await assert.rejects(s.incidente(contador,'Hechos ficticios'),/restringido/);const r=await s.incidente(principal,'Conocimiento 2026-10-08T20:00Z. Simulacro ficticio.');expedientes.push(r.id);
assert.equal(r.correo,null);await s.actualizar(principal,r.id,{estado:'RESPONDIDA',nota:'Simulacro cerrado sin impacto real; comunicaciones no aplicables.'});assert.equal((await s.detalle(principal,r.id)).eventos.length,2);
});
test('Paginación no pierde expedientes con idéntica fecha ni permite cursor inválido',async()=>{
const fecha=new Date('2026-10-08T00:00:00Z');const rows=Array.from({length:102},()=>({id:randomUUID(),tipo:'INFORMACION',correo:'usuario4@example.invalid',descripcion:'Ficticio',creadaEn:fecha}));expedientes.push(...rows.map(r=>r.id));await db.insert(expedientePrivacidad).values(rows);
const inicio=await s.listar(principal,'2026-10-08T00:00:01Z|ffffffff-ffff-ffff-ffff-ffffffffffff');const fin=inicio.at(-1);assert.equal(inicio.length,100);
const resto=await s.listar(principal,fin.creadaEn.toISOString()+'|'+fin.id);const encontrados=[...inicio,...resto].filter(r=>rows.some(x=>x.id===r.id));assert.equal(new Set(encontrados.map(r=>r.id)).size,102);
await assert.rejects(s.auditoria(principal,'invalido'),/página/);
});
test('Cambios SQL y rollback tienen evidencia atómica sin copiar contenido',async()=>{
const id=randomUUID(),r=randomUUID();
await assert.rejects(db.transaction(async tx=>{await tx.insert(expedientePrivacidad).values({id:r,tipo:'INFORMACION',correo:'usuario1@example.invalid',descripcion:'secreto de prueba'});throw Error('rollback ficticio');}),/rollback/);
assert.equal((await db.select().from(auditoriaOperacion).where(sql`${auditoriaOperacion.recursos}->>'id' = ${r}`)).length,0);
await db.insert(expedientePrivacidad).values({id,tipo:'INFORMACION',correo:'usuario1@example.invalid',descripcion:'secreto de prueba'});expedientes.push(id);
const rows=await db.select().from(auditoriaOperacion).where(sql`${auditoriaOperacion.recursos}->>'id' = ${id}`);assert.equal(rows.length,1);assert.equal(rows[0].ruta,'BD/expediente_privacidad');assert.equal(rows[0].metodo,'INSERT');assert.equal(JSON.stringify(rows).includes('secreto de prueba'),false);
});
test('API real exige JWT/sesión y principal; formulario sigue público sin permitir lectura',async()=>{
require('reflect-metadata');process.env.JWT_SECRET='clave-solo-para-ensayo-local-de-privacidad-2026';
const {Module}=require('@nestjs/common'),{NestFactory}=require('@nestjs/core'),{FastifyAdapter}=require('@nestjs/platform-fastify'),{JwtModule,JwtService}=require('@nestjs/jwt'),{PassportModule}=require('@nestjs/passport');
const {JwtStrategy}=require('../../dist/auth/jwt.strategy'),{SesionesService}=require('../../dist/auth/sesiones.service');
const {PrivacidadPublicaController,PrivacidadAdminController}=require('../../dist/privacidad/privacidad.controller');
class Ensayo{};Module({imports:[JwtModule.register({secret:process.env.JWT_SECRET}),PassportModule.register({defaultStrategy:'jwt'})],controllers:[PrivacidadPublicaController,PrivacidadAdminController],providers:[PrivacidadService,JwtStrategy,{provide:SesionesService,useFactory:jwt=>new SesionesService(jwt,{getEmpresaId:async()=>{throw Error('No se usa interno en este ensayo');}}),inject:[JwtService]}]})(Ensayo);
const app=await NestFactory.create(Ensayo,new FastifyAdapter(),{logger:false});const server=app.getHttpAdapter().getInstance();registrarAuditoriaHttp(server,()=>{});await app.init();await server.ready();
try{
assert.equal((await server.inject({url:'/superadmin/privacidad/solicitudes'})).statusCode,401);
const creado=await server.inject({method:'POST',url:'/privacidad/solicitudes',payload:{tipo:'ACCESO',correo:'usuario5@example.invalid',descripcion:'Solicitada sin sesión'}});assert.equal(creado.statusCode,201);expedientes.push(creado.json().referencia);
for(const id of [principal,otro,contador]){
const rol=id===contador?'CONTADOR_EXTERNO':'SUPERADMIN';const login=await app.get(SesionesService).crear({id,email:id+'@example.test',tipoUsuario:rol,nombreCompleto:'Ficticio'});
const r=await server.inject({url:'/superadmin/privacidad/solicitudes',headers:{authorization:'Bearer '+login.access_token}});assert.equal(r.statusCode,id===principal?200:403);
}
assert.equal((await server.inject({url:'/superadmin/privacidad/solicitudes/'+creado.json().referencia,headers:{'x-user-id':principal}})).statusCode,401);
}finally{await app.close();}
});
