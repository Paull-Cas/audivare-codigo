const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const { periodo, periodoConsulta, categoria, nota, seleccion } = require('../dist/documentos-mensuales/documento-datos');
const { ensamblarPdf } = require('../dist/documentos-mensuales/ensamblar-pdf');
const { rutaContableRetirada } = require('../dist/common/rutas-retiradas');
const { busquedaListado, patronBusqueda, paginaListado } = require('../dist/common/consulta-listado');

test('Buscadores acotan texto y tratan comodines como texto literal; paginación estricta',()=>{
 assert.equal(busquedaListado('  Fierros Juanito '),'Fierros Juanito');assert.equal(busquedaListado(undefined),'');
 assert.equal(patronBusqueda('100%_a\\b'),'%100\\%\\_a\\\\b%');
 for(const valor of [null,[],{},'x'.repeat(201),'texto\0'])assert.throws(()=>busquedaListado(valor));
 assert.equal(paginaListado(undefined),1);assert.equal(paginaListado('2'),2);
 for(const valor of [0,-1,1.5,'1e2','',null,100001])assert.throws(()=>paginaListado(valor));
});

test('Periodo y notas no admiten fechas inventadas, tipos incorrectos ni texto demasiado largo', () => {
  assert.deepEqual(periodo('2026','10'), {anio:2026,mes:10});
  for(const valores of [[null,10],[true,10],['2026e0',10],[2026,13],[1999,1],[2026,'']]) assert.throws(()=>periodo(...valores));
  for (const valor of ['   ', '', undefined, null]) assert.throws(()=>nota(valor)); assert.equal(nota(' F001-123 Juanito '),'F001-123 Juanito');
  assert.throws(()=>nota('a'.repeat(1001)));assert.throws(()=>nota({}));
  assert.throws(()=>categoria('GUIA'));assert.throws(()=>seleccion(''));assert.throws(()=>seleccion('FACTURA,BOLETA'));
  assert.deepEqual(seleccion('OTRO,FACTURA,FACTURA'),['FACTURA','OTRO']);
});
test('PDF combinado conserva páginas originales y orientación EXIF de fotos',async()=>{
  const original=await PDFDocument.create();original.addPage([300,500]);original.addPage([500,300]);
  const foto=await sharp({create:{width:30,height:60,channels:3,background:'white'}}).jpeg().withMetadata({orientation:6}).toBuffer();
  const bytes=await ensamblarPdf([{nombre:'original.pdf',mime:'application/pdf',bytes:await original.save()},{nombre:'foto.jpg',mime:'image/jpeg',bytes:foto}]);
  const combinado=await PDFDocument.load(bytes);assert.equal(combinado.getPageCount(),3);
  assert.deepEqual(combinado.getPage(0).getSize(),{width:300,height:500});
  assert.deepEqual(combinado.getPage(1).getSize(),{width:500,height:300});
  assert.deepEqual(combinado.getPage(2).getSize(),{width:842,height:595});
});
test('Consulta admite todos los periodos y exige año antes de filtrar mes; exportación conserva periodo obligatorio',()=>{
 assert.deepEqual(periodoConsulta(undefined,undefined),{});
 assert.deepEqual(periodoConsulta('',''),{});
 assert.deepEqual(periodoConsulta('2026',undefined),{anio:2026});
 assert.throws(()=>periodoConsulta(undefined,'10'),/Selecciona primero un año/);
 assert.throws(()=>periodoConsulta('','10'),/Selecciona primero un año/);
 assert.deepEqual(periodoConsulta('2025','9'),{anio:2025,mes:9});
 for(const datos of [[null,undefined],[undefined,null],['abc',undefined],[undefined,'13'],[1999,1]])assert.throws(()=>periodoConsulta(...datos));
 assert.throws(()=>periodo(undefined,undefined));assert.throws(()=>periodo('2026',undefined));
});
test('Cada foto o PDF de una página ocupa una página exclusiva al descargar',async()=>{
 const foto=await sharp({create:{width:40,height:60,channels:3,background:'blue'}}).png().toBuffer();
 const pdf=await PDFDocument.create();pdf.addPage([300,500]);
 const salida=await ensamblarPdf([{nombre:'factura.png',mime:'image/png',bytes:foto},{nombre:'medio.png',mime:'image/png',bytes:foto},{nombre:'guia.pdf',mime:'application/pdf',bytes:await pdf.save()}]);
 const doc=await PDFDocument.load(salida);assert.equal(doc.getPageCount(),3);assert.deepEqual(doc.getPage(2).getSize(),{width:300,height:500});
});
test('PDF falla completo ante corruptos, formatos inesperados y límites',async()=>{
  await assert.rejects(ensamblarPdf([]));
  await assert.rejects(ensamblarPdf([{nombre:'dañado.pdf',mime:'application/pdf',bytes:Buffer.from('invalid')}]),/dañado.pdf/);
  await assert.rejects(ensamblarPdf([{nombre:'word.docx',mime:'application/msword',bytes:Buffer.from('invalid')}]),/word.docx/);
  const doc=await PDFDocument.create();for(let i=0;i<501;i++)doc.addPage();
  await assert.rejects(ensamblarPdf([{nombre:'grande.pdf',mime:'application/pdf',bytes:await doc.save()}]),/grande.pdf/);
});
test('Rutas retiradas no bloquean nuevos documentos, usuarios, vínculos ni suscripciones',()=>{
  for(const ruta of ['/facturas','/pagos/:id','/proveedores','/contador/empresas/:empresaId/importar','/contador/empresas/:empresaId/exportar/zip'])assert.equal(rutaContableRetirada(ruta),true);
  for(const ruta of ['/documentos-empresa','/contador/empresas/id/documentos-empresa','/documentos-mensuales','/contador/empresas','/contadores/invitar','/usuarios','/superadmin/empresas/:id/pagos'])assert.equal(rutaContableRetirada(ruta),false);
});
