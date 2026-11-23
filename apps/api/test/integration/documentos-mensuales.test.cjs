const {test, before, after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const path=require('node:path');
const destino=new URL(process.env.AUDIVARE_TEST_DATABASE_URL||'http://sin-destino');
if(destino.hostname!=='127.0.0.1'||destino.pathname!=='/audivare_mensual_test'||destino.username!=='audivare_test')throw Error('Solo BD local mensual dedicada');
process.env.NODE_ENV='test';process.env.DATABASE_URL=destino.href;process.env.JWT_SECRET='audivare_mensual_ficticio_2026_very_long_secret';process.env.ANTIVIRUS_MODE='disabled';
process.env.MINIO_ENDPOINT='127.0.0.1';process.env.MINIO_PORT='9000';process.env.MINIO_USE_SSL='false';process.env.MINIO_ACCESS_KEY='audivare';process.env.MINIO_SECRET_KEY='public-review-fixture-only';process.env.MINIO_BUCKET='audivare-mensual-tests';
const {db,client,empresa,usuario,rol,usuarioInternoEmpresa,relacionEmpresaContador,documentoMensual,eventoDocumentoMensual,permiso,rolPermiso,notificacion,pagoSuscripcion}=require('@audivare/database');
const {eq,and,inArray}=require('drizzle-orm');const {migrate}=require('drizzle-orm/postgres-js/migrator');
const {PDFDocument}=require('pdf-lib');const sharp=require('sharp');
const {DocumentosMensualesService}=require('../../dist/documentos-mensuales/documentos-mensuales.service');
const {PdfMensualService}=require('../../dist/documentos-mensuales/pdf-mensual.service');
const {StorageService}=require('../../dist/storage/storage.service');
const {PermisosService}=require('../../dist/common/permisos/permisos.service');
const {NotificacionesService}=require('../../dist/notificaciones/notificaciones.service');
let c;
before(async()=>{
 await migrate(db,{migrationsFolder:path.resolve(__dirname,'../../../../packages/database/drizzle')});
 await db.insert(permiso).values({codigoPermiso:'DOCUMENTO_EMPRESA_MANAGE',descripcion:'Gestionar documentos generales'}).onConflictDoNothing();
 const eid=randomUUID(),otro=randomUUID(),uid=randomUUID(),cid=randomUUID(),lector=randomUUID(),rid=randomUUID(),lrid=randomUUID();
 await db.insert(empresa).values([{id:eid,emailRegistro:eid+'@example.test',ruc:'20'+String(Date.now()).slice(-9),razonSocial:'Empresa mensual ficticia'},
 {id:otro,emailRegistro:otro+'@example.test',ruc:'21'+String(Date.now()).slice(-9),razonSocial:'Empresa ajena ficticia'}]);
 await db.insert(usuario).values([{id:uid,email:uid+'@example.test',nombreCompleto:'Autora ficticia',tipoUsuario:'INTERNO'}, {id:cid,email:cid+'@example.test',nombreCompleto:'Contador de prueba',tipoUsuario:'CONTADOR_EXTERNO'}, {id:lector,email:lector+'@example.test',tipoUsuario:'INTERNO'}]);
 await db.insert(rol).values([{id:rid,empresaId:eid,nombreRol:'Administrador',esInmutable:true},{id:lrid,empresaId:eid,nombreRol:'Lector'}]);
 await db.insert(usuarioInternoEmpresa).values([{usuarioId:uid,empresaId:eid,rolId:rid},{usuarioId:lector,empresaId:eid,rolId:lrid}]);
 const [read]=await db.select().from(permiso).where(eq(permiso.codigoPermiso,'DOCUMENTO_MENSUAL_READ'));
 await db.insert(rolPermiso).values({rolId:lrid,permisoId:read.id});
 await db.insert(relacionEmpresaContador).values({empresaId:eid,contadorId:cid});
 const storage=new StorageService();for(let i=0;i<30;i++){try{await storage.listObjectInventory();break;}catch{await new Promise(r=>setTimeout(r,100));}}
 const service=new DocumentosMensualesService(new PermisosService(),storage,new NotificacionesService());
 c={eid,otro,uid,cid,lector,storage,service,pdf:new PdfMensualService(service),actor:{id:uid,tipo_usuario:'INTERNO'},contador:{id:cid,tipo_usuario:'CONTADOR_EXTERNO'},readActor:{id:lector,tipo_usuario:'INTERNO'}};
});
after(()=>client.end());
test('Carga real PDF/JPEG, selección mensual, descarga original y PDF combinado',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage([321,456]);const bytes=Buffer.from(await pdf.save());
 const factura=await c.service.subir(c.actor,{filename:'factura.pdf',mimetype:'application/pdf',buffer:bytes},{nota:"Referencia de prueba",anio:2026,mes:10,categoria:'FACTURA'});
 const foto=await sharp({create:{width:40,height:60,channels:3,background:'white'}}).jpeg().toBuffer();
 await c.service.subir(c.actor,{filename:'pago.jpg',mimetype:'image/jpeg',buffer:foto},{anio:2026,mes:10,categoria:'MEDIO_PAGO',nota:'Referencia opcional'});
 const lista=await c.service.listar(c.contador,{anio:2026,mes:10},c.eid);assert.equal(lista.total,2);assert.equal(lista.data.some(d=>'archivoPath'in d),false);
 const url=await c.service.descargar(c.actor,factura.id);const original=await fetch(url.url);assert.equal(original.status,200);assert.deepEqual(Buffer.from(await original.arrayBuffer()),bytes);
 assert.deepEqual((await c.service.descargarOriginal(c.actor,factura.id)).bytes,bytes);
 assert.deepEqual((await c.service.descargarOriginal(c.contador,factura.id,c.eid)).bytes,bytes);
 const solo=await c.pdf.exportar(c.contador,2026,10,'FACTURA',c.eid);assert.equal((await PDFDocument.load(solo.bytes)).getPageCount(),1);
 const ambos=await c.pdf.exportar(c.contador,2026,10,'FACTURA,MEDIO_PAGO',c.eid);assert.equal((await PDFDocument.load(ambos.bytes)).getPageCount(),2);
 c.factura=factura;
 assert.deepEqual(await c.service.resumen(c.actor),{facturas:1,sustentos:1,documentosEmpresa:0});
 assert.deepEqual(await c.service.resumen(c.readActor),{facturas:1,sustentos:1,documentosEmpresa:null});
 await assert.rejects(c.service.resumen(c.contador),e=>e.getStatus()===403);
});
test('Lista todos los periodos; exige año antes del mes manteniendo aislamiento y exportación estricta',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());const nuevos=[];
 try {
  for(const mes of [9,10])nuevos.push(await c.service.subir(c.actor,{filename:`periodo-${mes}.pdf`,mimetype:'application/pdf',buffer:bytes},{nota:"Referencia de prueba",anio:2025,mes,categoria:'FACTURA'}));
  assert.equal((await c.service.listar(c.actor,{})).total,4);
  assert.equal((await c.service.listar(c.contador,{},c.eid)).total,4);
  assert.equal((await c.service.listar(c.actor,{anio:'2025'})).total,2);
  await assert.rejects(c.service.listar(c.actor,{mes:'10'}),e=>e.getStatus()===400);
  await assert.rejects(c.service.listar(c.contador,{mes:'10'},c.eid),e=>e.getStatus()===400);
  assert.equal((await c.service.listar(c.actor,{anio:'2025',mes:'10'})).total,1);
  const filtrado=await c.service.listar(c.actor,{nota:"Referencia de prueba",anio:'2025',mes:'9',categoria:'FACTURA'});assert.equal(filtrado.total,1);assert.equal(filtrado.data[0].id,nuevos[0].id);
  assert.equal((await c.service.listar(c.actor,{categoria:'MEDIO_PAGO'})).total,1);
  await assert.rejects(c.service.listar(c.actor,{},c.otro),e=>e.getStatus()===403);
  await assert.rejects(c.service.documentosExport(c.contador,undefined,undefined,'FACTURA',c.eid),e=>e.getStatus()===400);
  await assert.rejects(c.service.listar(c.actor,{anio:'abc'}),e=>e.getStatus()===400);
 } finally {for(const d of nuevos)await c.service.eliminar(c.actor,d.id);}
});
test('Pagina a diez documentos sin repetir registros para empresa y contador',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());const nuevos=[];
 try {
  for(let i=0;i<11;i++)nuevos.push(await c.service.subir(c.actor,{filename:`pagina-${i}.pdf`,mimetype:'application/pdf',buffer:bytes},{nota:"Referencia de prueba",anio:2028,mes:1,categoria:'OTRO'}));
  const primera=await c.service.listar(c.actor,{anio:2028,mes:1,pagina:1});
  const segunda=await c.service.listar(c.actor,{anio:2028,mes:1,pagina:2});
  assert.equal(primera.total,11);assert.equal(primera.porPagina,10);assert.equal(primera.data.length,10);
  assert.equal(segunda.total,11);assert.equal(segunda.data.length,1);
  assert.equal(new Set([...primera.data,...segunda.data].map(d=>d.id)).size,11);
  assert.equal((await c.service.listar(c.actor,{anio:2028,mes:1,pagina:3})).data.length,0);
  assert.deepEqual((await c.service.listar(c.contador,{anio:2028,mes:1,pagina:2},c.eid)).data.map(d=>d.id),segunda.data.map(d=>d.id));
  const todas=await c.service.listar(c.actor,{});assert.equal(todas.porPagina,10);assert.equal(todas.data.length,10);
 } finally {for(const d of nuevos)await c.service.eliminar(c.actor,d.id);}
});

test('Reemplazo de archivo conserva ID/fecha, registra actividad y compensa fallos',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());
 const creado=await c.service.subir(c.actor,{filename:'antes.pdf',mimetype:'application/pdf',buffer:bytes},{nota:"Referencia de prueba",anio:2026,mes:12,categoria:'OTRO'});
 const [antes]=await db.select().from(documentoMensual).where(eq(documentoMensual.id,creado.id));
 const foto=await sharp({create:{width:30,height:40,channels:3,background:'white'}}).png().toBuffer();
 await assert.rejects(c.service.editar(c.readActor,creado.id,{nota:"Referencia de prueba",anio:2026,mes:12},{filename:'nuevo.png',mimetype:'image/png',buffer:foto}),e=>e.getStatus()===403);
 await assert.rejects(c.service.editar(c.actor,creado.id,{nota:"Referencia de prueba",anio:2026,mes:12},{filename:'no.txt',mimetype:'text/plain',buffer:Buffer.from('no')}),e=>e.getStatus()===400);
 const inventario=await c.storage.listObjectInventory();
 const fallo=new DocumentosMensualesService(new PermisosService(),c.storage,{crearNotificacion:async()=>{throw Error('Fallo transaccional intencional');}});
 await assert.rejects(fallo.editar(c.actor,creado.id,{nota:"Referencia de prueba",anio:2026,mes:12},{filename:'fallo.png',mimetype:'image/png',buffer:foto}));
 assert.equal((await c.storage.listObjectInventory()).length,inventario.length);
 assert.deepEqual((await c.service.descargarOriginal(c.actor,creado.id)).bytes,bytes);
 await c.service.editar(c.actor,creado.id,{anio:2026,mes:11,nota:'Archivo corregido'},{filename:'despues.png',mimetype:'image/png',buffer:foto});
 const [despues]=await db.select().from(documentoMensual).where(eq(documentoMensual.id,creado.id));
 assert.equal(despues.id,antes.id);assert.equal(despues.fechaCarga.getTime(),antes.fechaCarga.getTime());assert.equal(despues.archivoMime,'image/png');assert.notEqual(despues.archivoPath,antes.archivoPath);
 assert.deepEqual((await c.service.descargarOriginal(c.actor,creado.id)).bytes,foto);
 assert.equal((await fetch(await c.storage.getPresignedUrl(antes.archivoPath,60))).status,404);
 const historial=(await c.service.actividad(c.actor)).data.filter(e=>e.documentoId===creado.id);const edicion=historial.find(e=>e.accion==='EDICION');assert.equal(edicion.despues.archivoReemplazado,true);assert.equal(edicion.antes.archivoNombre,'antes.pdf');assert.equal(edicion.despues.archivoNombre,'despues.png');
 await c.service.eliminar(c.actor,creado.id);
});
test('Rechaza imágenes enormes y detecta reemplazo durante descarga original',async()=>{
 const enorme=await sharp({create:{width:5000,height:4001,channels:3,background:'white'}}).png().toBuffer();
 await assert.rejects(c.service.subir(c.actor,{filename:'enorme.png',mimetype:'image/png',buffer:enorme},{nota:"Referencia de prueba",anio:2026,mes:12,categoria:'OTRO'}),e=>e.getStatus()===400);
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());
 const creado=await c.service.subir(c.actor,{filename:'concurrente.pdf',mimetype:'application/pdf',buffer:bytes},{nota:"Referencia de prueba",anio:2026,mes:12,categoria:'OTRO'});
 const original=c.storage.getObjectStream.bind(c.storage);let disparado=false;
 c.storage.getObjectStream=async path=>{const stream=await original(path);if(!disparado){disparado=true;await c.service.editar(c.actor,creado.id,{nota:"Referencia de prueba",anio:2026,mes:12},{filename:'nuevo.pdf',mimetype:'application/pdf',buffer:bytes});}return stream;};
 try{await assert.rejects(c.service.descargarOriginal(c.actor,creado.id),e=>e.getStatus()===400);}finally{c.storage.getObjectStream=original;await c.service.eliminar(c.actor,creado.id);}
});
test('Edición conserva fecha de carga; baja registra evento y retira archivo real',async()=>{
 const [antes]=await db.select().from(documentoMensual).where(eq(documentoMensual.id,c.factura.id));
 await c.service.editar(c.actor,c.factura.id,{anio:2026,mes:9,nota:'Corregida'});
 const [despues]=await db.select().from(documentoMensual).where(eq(documentoMensual.id,c.factura.id));assert.equal(antes.fechaCarga.getTime(),despues.fechaCarga.getTime());
 assert.equal((await c.service.listar(c.actor,{anio:2026,mes:9})).total,1);
 await c.service.eliminar(c.actor,c.factura.id);assert.equal((await c.service.listar(c.actor,{anio:2026,mes:9})).total,0);
 assert.deepEqual(await c.service.resumen(c.actor),{facturas:0,sustentos:1,documentosEmpresa:0});
 await assert.rejects(c.service.descargar(c.actor,c.factura.id),e=>e.getStatus()===404);
 await assert.rejects(c.service.descargarOriginal(c.actor,c.factura.id),e=>e.getStatus()===404);
 assert.equal((await fetch((await c.storage.getPresignedUrl(antes.archivoPath,60)))).status,404);
 const eventos=await db.select().from(eventoDocumentoMensual).where(eq(eventoDocumentoMensual.documentoId,c.factura.id));assert.deepEqual(eventos.map(e=>e.accion),['CARGA','EDICION','ELIMINACION']);
 await assert.rejects(db.delete(eventoDocumentoMensual).where(eq(eventoDocumentoMensual.id,eventos[0].id)));
 const {SuperadminService}=require('../../dist/superadmin/superadmin.service');
 await assert.rejects(new SuperadminService(null,null,null,null).eliminarEmpresa(c.eid),e=>e.getStatus()===400);
});
test('Permisos, vínculo, suspensión y aislamiento se revalidan desde BD',async()=>{
 await assert.rejects(c.service.listar(c.contador,{anio:2026,mes:10},c.otro),e=>e.getStatus()===403);
 await assert.rejects(c.service.subir(c.readActor,{filename:'fake.pdf',mimetype:'application/pdf',buffer:Buffer.from('fake')},{nota:"Referencia de prueba",anio:2026,mes:10,categoria:'FACTURA'}),e=>e.getStatus()===403);
 await assert.rejects(c.service.eliminar(c.contador,c.factura.id),e=>e.getStatus()===403);
 const seleccionAntes=await c.service.documentosExport(c.contador,2026,10,'MEDIO_PAGO',c.eid);
 await db.delete(relacionEmpresaContador).where(and(eq(relacionEmpresaContador.empresaId,c.eid),eq(relacionEmpresaContador.contadorId,c.cid)));
 await assert.rejects(c.pdf.exportar(c.contador,2026,10,'MEDIO_PAGO',c.eid),e=>e.getStatus()===403);
 await assert.rejects(c.service.revalidarExport(c.contador,seleccionAntes.docs,c.eid),e=>e.getStatus()===403);
 await db.update(empresa).set({estadoSuscripcion:'SUSPENDIDO'}).where(eq(empresa.id,c.eid));
 await assert.rejects(c.service.listar(c.actor,{anio:2026,mes:10}),e=>e.getStatus()===403);
 await assert.rejects(c.service.resumen(c.actor),e=>e.getStatus()===403);
 await db.update(empresa).set({estadoSuscripcion:'ACTIVO'}).where(eq(empresa.id,c.eid));
});

test('Exportación detecta edición de periodo durante el ensamblado',async()=>{
 await assert.rejects(c.service.documentosExport(c.actor,2026,10,'MEDIO_PAGO'),e=>e.getStatus()===403);
 await db.insert(relacionEmpresaContador).values({empresaId:c.eid,contadorId:c.cid}).onConflictDoNothing();
 const seleccion=await c.service.documentosExport(c.contador,2026,10,'MEDIO_PAGO',c.eid);
 const doc=seleccion.docs[0];await c.service.editar(c.actor,doc.id,{nota:"Referencia de prueba",anio:2026,mes:11});
 await assert.rejects(c.service.revalidarExport(c.contador,seleccion.docs,c.eid),e=>e.getStatus()===400);
 await c.service.editar(c.actor,doc.id,{nota:"Referencia de prueba",anio:2026,mes:10});
});
test('Validación ocurre antes de almacenar y fallo SQL compensa archivo subido',async()=>{
 const antes=(await c.storage.listObjectInventory()).length;
 await assert.rejects(c.service.subir(c.actor,{filename:'invalido.pdf',mimetype:'application/pdf',buffer:Buffer.from('%PDF-1.7\ninvalid\n%%EOF')},{nota:"Referencia de prueba",anio:2026,mes:10,categoria:'FACTURA'}),e=>e.getStatus()===400);
 assert.equal((await c.storage.listObjectInventory()).length,antes);
 const otroService=new DocumentosMensualesService({checkPermiso:async()=>c.eid,getUsuariosConPermiso:async()=>[]},c.storage,{crearNotificacion:async()=>{throw Error('falla simulada');}});
 await db.insert(relacionEmpresaContador).values({empresaId:c.eid,contadorId:c.cid}).onConflictDoNothing();
 const pdf=await PDFDocument.create();pdf.addPage();
 await assert.rejects(otroService.subir(c.actor,{filename:'compensar.pdf',mimetype:'application/pdf',buffer:Buffer.from(await pdf.save())},{nota:"Referencia de prueba",anio:2026,mes:10,categoria:'FACTURA'}));
 assert.equal((await c.storage.listObjectInventory()).length,antes);
});

test('Referencia obligatoria, búsqueda parcial/literal y filtros antes de paginar sin fugas de empresa',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());const nuevos=[];
 const file={filename:'123456.pdf',mimetype:'application/pdf',buffer:bytes};
 const antes=(await c.storage.listObjectInventory()).length;
 for(const nota of [undefined,null,'','   '])await assert.rejects(c.service.subir(c.actor,file,{anio:2026,mes:10,categoria:'FACTURA',nota}),e=>e.getStatus()===400);
 assert.equal((await c.storage.listObjectInventory()).length,antes);
 try {
  for(const nota of ['Factura F001-13515 | Fierros Juanito','Boleta F002-20 | Otros insumos','Descuento 100%_literal','Referencia antigua'])nuevos.push(await c.service.subir(c.actor,file,{anio:2026,mes:10,categoria:'FACTURA',nota}));
  await db.update(documentoMensual).set({nota:null}).where(eq(documentoMensual.id,nuevos[3].id));
  for(const busqueda of ['fierros juanito','13515','F001']){
   const r=await c.service.listar(c.contador,{anio:2026,mes:10,categoria:'FACTURA',busqueda},c.eid);assert.equal(r.total,1);assert.equal(r.data[0].id,nuevos[0].id);
  }
  assert.equal((await c.service.listar(c.actor,{busqueda:'%_literal'})).total,1);
  assert.equal((await c.service.listar(c.actor,{busqueda:"' OR 1=1 --"})).total,0);
  assert.equal((await c.service.listar(c.actor,{anio:2025,busqueda:'Juanito'})).total,0);
  assert.equal((await c.service.listar(c.actor,{busqueda:'Juanito',pagina:2})).data.length,0);
  assert.equal((await c.service.listar(c.actor,{busqueda:'zzzz-sin-coincidencia'})).total,0);
  await assert.rejects(c.service.listar(c.contador,{busqueda:'Juanito'},c.otro),e=>e.getStatus()===403);
  await assert.rejects(c.service.editar(c.actor,nuevos[3].id,{anio:2026,mes:10,nota:'   '}),e=>e.getStatus()===400);
  await c.service.editar(c.actor,nuevos[3].id,{anio:2026,mes:10,nota:'Referencia completada'});
 }finally{for(const d of nuevos)await c.service.eliminar(c.actor,d.id);}
});

test('Contador carga factura/sustento y edita nota/archivo con avisos transaccionales e historial, sin eliminar ni cruzar empresas',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());const file={filename:'contador.pdf',mimetype:'application/pdf',buffer:bytes};const nuevos=[];
 const avisos=async(id,user)=> (await db.select().from(notificacion).where(eq(notificacion.usuarioId,user)).orderBy(notificacion.fechaCreacion)).filter(n=>n.metadata?.documento_id===id);
 try {
  await assert.rejects(c.service.subir(c.contador,file,{anio:2026,mes:10,categoria:'FACTURA',nota:'F001 prueba'}),e=>e.getStatus()===403);
  await assert.rejects(c.service.subir(c.contador,file,{anio:2026,mes:10,categoria:'FACTURA',nota:'F001 prueba'},c.otro),e=>e.getStatus()===403);
  for(const categoria of ['FACTURA','MEDIO_PAGO'])nuevos.push(await c.service.subir(c.contador,file,{anio:2026,mes:10,categoria,nota:'F001-123 Proveedor de prueba'},c.eid));
  const id=nuevos[0].id;const [original]=await db.select().from(documentoMensual).where(eq(documentoMensual.id,id));
  assert.equal((await avisos(id,c.uid)).length,1);assert.equal((await avisos(id,c.cid)).length,0);
  const foto=await sharp({create:{width:40,height:50,channels:3,background:'blue'}}).png().toBuffer();
  await c.service.editar(c.contador,id,{anio:2026,mes:9,nota:'F001-123 Fierros Juanito corregido'},{filename:'nueva.png',mimetype:'image/png',buffer:foto},c.eid);
  const [editado]=await db.select().from(documentoMensual).where(eq(documentoMensual.id,id));
  assert.equal(editado.creadoPor,c.cid);assert.equal(editado.fechaCarga.getTime(),original.fechaCarga.getTime());
  assert.deepEqual((await c.service.descargarOriginal(c.contador,id,c.eid)).bytes,foto);
  const propios=await avisos(id,c.uid);assert.equal(propios.length,2);assert.match(propios.at(-1).mensaje,/El contador Contador de prueba modificó la nota, el periodo, el archivo/);
  assert.equal((await avisos(id,c.lector)).length,2);assert.equal((await avisos(id,c.cid)).length,0);
  const eventos=await db.select().from(eventoDocumentoMensual).where(eq(eventoDocumentoMensual.documentoId,id));assert.equal(eventos.length,2);assert.equal(eventos[1].actorId,c.cid);assert.equal(eventos[1].despues.archivoReemplazado,true);
  await assert.rejects(c.service.editar(c.contador,id,{anio:2026,mes:9,nota:'Intento ajeno'},undefined,c.otro),e=>e.getStatus()===403);
  await assert.rejects(c.service.editar(c.contador,id,{anio:2026,mes:9,nota:'Sin contexto'}),e=>e.getStatus()===403);
  await assert.rejects(c.service.eliminar(c.contador,id),e=>e.getStatus()===403);
  const falla=new DocumentosMensualesService(new PermisosService(),c.storage,{crearNotificacion:async()=>{throw Error('Notificación fallida');}});
  const inventario=(await c.storage.listObjectInventory()).length;
  await assert.rejects(falla.editar(c.contador,id,{anio:2026,mes:9,nota:'No debe persistir'},file,c.eid),/Notificación fallida/);
  assert.equal((await c.storage.listObjectInventory()).length,inventario);
  const [sinCambio]=await db.select().from(documentoMensual).where(eq(documentoMensual.id,id));assert.equal(sinCambio.nota,editado.nota);assert.equal(sinCambio.archivoPath,editado.archivoPath);
  assert.equal((await avisos(id,c.uid)).length,2);
  await c.service.editar(c.actor,id,{anio:2026,mes:9,nota:'Referencia corregida por la empresa'});
  assert.match((await avisos(id,c.cid)).at(-1).mensaje,/El usuario de empresa Autora ficticia modificó la nota/);
  await db.delete(relacionEmpresaContador).where(and(eq(relacionEmpresaContador.empresaId,c.eid),eq(relacionEmpresaContador.contadorId,c.cid)));
  try{await assert.rejects(c.service.editar(c.contador,id,{anio:2026,mes:9,nota:'Vínculo retirado'},undefined,c.eid),e=>e.getStatus()===403);
   await assert.rejects(c.service.subir(c.contador,file,{anio:2026,mes:9,categoria:'OTRO',nota:'Vínculo retirado'},c.eid),e=>e.getStatus()===403);
  }finally{await db.insert(relacionEmpresaContador).values({empresaId:c.eid,contadorId:c.cid});}
 }finally{for(const d of nuevos)await c.service.eliminar(c.actor,d.id);}
});

test('Empresas del contador: diez por página, RUC/razón social, vigencia y vínculo sin fugas',async()=>{
 const {ContadoresService}=require('../../dist/contadores/contadores.service');
 const servicio=new ContadoresService(new PermisosService(),c.storage,new NotificacionesService());
 const tag=randomUUID();const ids=[];const rucBase=String(Date.now()).slice(-7);
 try {
  const filas=Array.from({length:16},(_,i)=>({id:randomUUID(),emailRegistro:`empresa-${i}-${tag}@example.test`,ruc:'28'+rucBase+String(i).padStart(2,'0'),razonSocial:`Empresa ${tag} ${String(i).padStart(2,'0')}`}));
  filas[11].estadoSuscripcion='SUSPENDIDO';filas[12].pruebaHasta=new Date('2000-01-01');filas[13].pruebaHasta=new Date('2100-01-01');filas[14].pruebaHasta=new Date('2000-01-01');filas[15].razonSocial='Empresa ajena '+tag;
  await db.insert(empresa).values(filas);ids.push(...filas.map(f=>f.id));
  await db.insert(relacionEmpresaContador).values(filas.slice(0,15).map(f=>({empresaId:f.id,contadorId:c.cid})));
  await db.insert(pagoSuscripcion).values({empresaId:filas[14].id,monto:'10.00',fechaPago:new Date().toISOString().slice(0,10),duracionMeses:1});
  const uno=await servicio.getMisEmpresas(c.cid,'CONTADOR_EXTERNO',{busqueda:tag,pagina:1});const dos=await servicio.getMisEmpresas(c.cid,'CONTADOR_EXTERNO',{busqueda:tag,pagina:2});
  assert.equal(uno.total,13);assert.equal(uno.data.length,10);assert.equal(dos.data.length,3);assert.equal(new Set([...uno.data,...dos.data].map(e=>e.id)).size,13);
  assert.equal(uno.data.some(e=>[filas[11].id,filas[12].id,filas[15].id].includes(e.id)),false);
  const ruc=await servicio.getMisEmpresas(c.cid,'CONTADOR_EXTERNO',{busqueda:filas[0].ruc});assert.equal(ruc.total,1);assert.equal(ruc.data[0].id,filas[0].id);
  assert.equal((await servicio.getMisEmpresas(c.cid,'CONTADOR_EXTERNO',{busqueda:'EMPRESA '+tag+' 00'})).total,1);
  await db.update(empresa).set({razonSocial:'Literal %_ '+tag}).where(eq(empresa.id,filas[0].id));assert.equal((await servicio.getMisEmpresas(c.cid,'CONTADOR_EXTERNO',{busqueda:'%_'})).total,1);
  assert.equal((await servicio.getMisEmpresas(c.cid,'CONTADOR_EXTERNO',{busqueda:"' OR 1=1 --"})).total,0);
  assert.equal((await servicio.getDetalleEmpresa(c.cid,'CONTADOR_EXTERNO',filas[0].id)).ruc,filas[0].ruc);
  for(const id of [filas[11].id,filas[12].id,filas[15].id])await assert.rejects(servicio.getDetalleEmpresa(c.cid,'CONTADOR_EXTERNO',id),e=>e.getStatus()===403);
  await assert.rejects(servicio.getMisEmpresas(c.uid,'INTERNO'),e=>e.getStatus()===403);
  await assert.rejects(servicio.getMisEmpresas(c.cid,'CONTADOR_EXTERNO',{pagina:'0'}),e=>e.getStatus()===400);
 }finally{if(ids.length)await db.delete(empresa).where(inArray(empresa.id,ids));}
});

test('HTTP real con JWT/sesión: multipart, permisos, listado, PDF y rutas retiradas',async()=>{
 require('reflect-metadata');
 const {Module}=require('@nestjs/common');const {NestFactory}=require('@nestjs/core');const {FastifyAdapter}=require('@nestjs/platform-fastify');const {JwtService}=require('@nestjs/jwt');
 const {JwtAuthGuard}=require('../../dist/auth/jwt-auth.guard');const {JwtStrategy}=require('../../dist/auth/jwt.strategy');const {SesionesService}=require('../../dist/auth/sesiones.service');
 const {DocumentosMensualesController}=require('../../dist/documentos-mensuales/documentos-mensuales.controller');const {registrarSeguridadHttp}=require('../../dist/common/seguridad-http');
 const {ContadorEmpresaController}=require('../../dist/contadores/contadores.controller');const {ContadoresService}=require('../../dist/contadores/contadores.service');
 const {ExportContadorService}=require('../../dist/contadores/export-contador.service');const {ImportacionService}=require('../../dist/contadores/importacion.service');const {EliminacionService}=require('../../dist/contadores/eliminacion.service');
 const sesiones=new SesionesService(new JwtService({secret:process.env.JWT_SECRET}),new PermisosService());
 const [u]=await db.select().from(usuario).where(eq(usuario.id,c.uid));const token=(await sesiones.crear(u)).access_token;
 class Ensayo{};Module({controllers:[DocumentosMensualesController,ContadorEmpresaController],providers:[JwtAuthGuard,{provide:JwtStrategy,useValue:new JwtStrategy(sesiones)},{provide:DocumentosMensualesService,useValue:c.service},{provide:PdfMensualService,useValue:c.pdf},{provide:ContadoresService,useValue:new ContadoresService(new PermisosService(),c.storage,new NotificacionesService())},{provide:ExportContadorService,useValue:{}},{provide:ImportacionService,useValue:{}},{provide:EliminacionService,useValue:{}}]})(Ensayo);
 const app=await NestFactory.create(Ensayo,new FastifyAdapter(),{logger:false});const server=app.getHttpAdapter().getInstance();registrarSeguridadHttp(server,()=>{});
 await app.register(require('@fastify/multipart'),{limits:{fileSize:10485760,files:1}});await app.init();
 try{
 const headers={authorization:'Bearer '+token};assert.equal((await server.inject('/documentos-mensuales?anio=2026&mes=10')).statusCode,401);
 const p=await PDFDocument.create();p.addPage();const binary=Buffer.from(await p.save());const boundary='audivareBoundary';
 const payload=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="anio"\r\n\r\n2026\r\n--${boundary}\r\nContent-Disposition: form-data; name="mes"\r\n\r\n8\r\n--${boundary}\r\nContent-Disposition: form-data; name="categoria"\r\n\r\nFACTURA\r\n--${boundary}\r\nContent-Disposition: form-data; name="nota"\r\n\r\nReferencia HTTP\r\n--${boundary}\r\nContent-Disposition: form-data; name="archivo"; filename="http.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),binary,Buffer.from(`\r\n--${boundary}--\r\n`)]);
 const carga=await server.inject({method:'POST',url:'/documentos-mensuales',headers:{...headers,'content-type':'multipart/form-data; boundary='+boundary},payload});assert.equal(carga.statusCode,201,carga.body);
 const id=carga.json().id;const lista=await server.inject({url:'/documentos-mensuales?anio=2026&mes=8',headers});assert.equal(lista.statusCode,200);assert.equal(lista.json().total,1);
 const original=await server.inject({url:'/documentos-mensuales/'+id+'/descarga',headers});assert.equal(original.statusCode,200);assert.deepEqual(original.rawPayload,binary);assert.match(original.headers['content-disposition'],/attachment/);
 assert.equal((await server.inject({url:'/documentos-mensuales/pdf?anio=2026&mes=8&categorias=FACTURA',headers})).statusCode,403);
 const [contadorUser]=await db.select().from(usuario).where(eq(usuario.id,c.cid));
 const contadorToken=(await sesiones.crear(contadorUser)).access_token;
 const pdf=await server.inject({url:'/documentos-mensuales/pdf?anio=2026&mes=8&categorias=FACTURA&empresaId='+c.eid,headers:{authorization:'Bearer '+contadorToken}});assert.equal(pdf.statusCode,200,pdf.body);assert.equal((await PDFDocument.load(pdf.rawPayload)).getPageCount(),1);
 const contadorHeaders={authorization:'Bearer '+contadorToken};
 const empresas=await server.inject({url:'/contador/empresas?busqueda='+encodeURIComponent('Empresa mensual'),headers:contadorHeaders});assert.equal(empresas.statusCode,200,empresas.body);assert.equal(empresas.json().porPagina,10);assert.equal(empresas.json().data[0].id,c.eid);
 assert.equal((await server.inject({url:'/contador/empresas/'+c.eid,headers:contadorHeaders})).statusCode,200);
 assert.equal((await server.inject({url:'/contador/empresas/'+c.otro,headers:contadorHeaders})).statusCode,403);
 const cargaContador=await server.inject({method:'POST',url:'/documentos-mensuales?empresaId='+c.eid,headers:{...contadorHeaders,'content-type':'multipart/form-data; boundary='+boundary},payload});assert.equal(cargaContador.statusCode,201,cargaContador.body);const contadorDoc=cargaContador.json().id;
 const cambioContador=await server.inject({method:'PATCH',url:'/documentos-mensuales/'+contadorDoc+'?empresaId='+c.eid,headers:contadorHeaders,payload:{anio:2026,mes:8,nota:'Cuenta contador F001-90'}});assert.equal(cambioContador.statusCode,200,cambioContador.body);
 const buscado=await server.inject({url:'/documentos-mensuales?empresaId='+c.eid+'&busqueda=F001-90',headers:contadorHeaders});assert.equal(buscado.json().total,1);assert.equal(buscado.json().data[0].id,contadorDoc);
 assert.equal((await server.inject({method:'PATCH',url:'/documentos-mensuales/'+contadorDoc+'?empresaId='+c.eid,headers:contadorHeaders,payload:{anio:2026,mes:8,nota:' '}})).statusCode,400);
 assert.equal((await server.inject({method:'DELETE',url:'/documentos-mensuales/'+contadorDoc+'?empresaId='+c.eid,headers:contadorHeaders})).statusCode,403);
 await c.service.eliminar(c.actor,contadorDoc);
 const edit=await server.inject({method:'PATCH',url:'/documentos-mensuales/'+id,headers,payload:{anio:2026,mes:7,nota:'Referencia HTTP corregida'}});assert.equal(edit.statusCode,200);
 assert.equal((await server.inject({url:'/documentos-mensuales/no-uuid/archivo',headers})).statusCode,400);
 assert.equal((await server.inject({method:'DELETE',url:'/documentos-mensuales/'+id,headers})).statusCode,200);
 assert.equal((await server.inject({url:'/documentos-mensuales/'+id+'/archivo',headers})).statusCode,404);
 }finally{await app.close();}
});
