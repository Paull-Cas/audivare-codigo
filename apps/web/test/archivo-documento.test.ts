import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ACCEPT_DOCUMENTO, MAX_DOCUMENTO_BYTES, validarArchivoDocumento} from '../src/lib/archivo-documento';

test('Selector restringe extensiones concretas sin aceptar audio/video', () => {
  assert.equal(ACCEPT_DOCUMENTO,'.pdf,.jpg,.jpeg,.png');
  assert.doesNotMatch(ACCEPT_DOCUMENTO,/audio|video|\*/);
});
test('Admite PDF/JPG/PNG y normaliza MIME vacío del selector móvil',async()=>{
  for(const [nombre,tipo,bytes] of [
    ['factura.pdf','application/pdf',new TextEncoder().encode('%PDF-1.7')],
    ['foto.JPG','image/jpeg',new Uint8Array([255,216,255,224,0,0,0,0])],
    ['foto.png','image/png',new Uint8Array([137,80,78,71,13,10,26,10])],
  ] as const){
    const file=new File([bytes],nombre,{type:tipo});assert.equal(await validarArchivoDocumento(file),file);
    const movil=await validarArchivoDocumento(new File([bytes],nombre));assert.equal(movil.type,tipo);assert.equal(movil.name,nombre);
  }
});
test('Rechaza audio, video, MIME falso, extensiones engañosas y contenido renombrado',async()=>{
  for(const [nombre,tipo,bytes] of [
    ['audio.mp3','audio/mpeg','ID3'],['video.mp4','video/mp4','video'],
    ['video.jpg','video/mp4','video'],['factura.pdf.exe','application/pdf','%PDF-1.7'],
    ['falso.pdf','application/pdf','cualquier cosa'],['falso.png','image/png','no es png'],
  ]) await assert.rejects(validarArchivoDocumento(new File([bytes],nombre,{type:tipo})));
});
test('Rechaza vacío y exceso de tamaño antes de la vista previa',async()=>{
  await assert.rejects(validarArchivoDocumento(new File([],'vacio.pdf',{type:'application/pdf'})),/vacío/);
  await assert.rejects(validarArchivoDocumento(new File([new Uint8Array(MAX_DOCUMENTO_BYTES+1)],'grande.jpg',{type:'image/jpeg'})),/10 MB/);
});
