const {test}=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
process.env.NODE_ENV='test';process.env.DATABASE_URL='postgresql://test:test@127.0.0.1:1/audivare_test';
const {recursosSeguros}=require('../dist/privacidad/auditoria-http');
const {validarSolicitud}=require('../dist/privacidad/privacidad.service');
test('Auditoria solo conserva UUID de parámetros, nunca nombres/RUC/query/secreto',()=>{
const id=randomUUID();assert.deepEqual(recursosSeguros({empresaId:id,token:'clave',ruc:'12345678901',nombre:'persona',url:'/archivo?secret=123'}),{empresaId:id});
assert.deepEqual(recursosSeguros(null),{});
});
test('Solicitud minimiza y valida entradas sin conservar campos extras',()=>{
assert.deepEqual(validarSolicitud({tipo:'ACCESO',correo:' usuario1@example.invalid ',descripcion:' mi solicitud ',password:'public-review-fixture-only',dni:'12345678'}),{tipo:'ACCESO',correo:'usuario2@example.invalid',descripcion:'mi solicitud'});
for(const b of [null,{}, {tipo:'INCIDENTE',correo:'usuario3@example.invalid',descripcion:'x'}, {tipo:'ACCESO',correo:'invalido',descripcion:'x'}, {tipo:'ACCESO',correo:'usuario3@example.invalid',descripcion:'x'.repeat(2001)}])assert.throws(()=>validarSolicitud(b));
});
