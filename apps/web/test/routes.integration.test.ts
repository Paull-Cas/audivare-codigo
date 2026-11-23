import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { SignJWT } from 'jose';

test('Next 15 sirve login, cookies, params multipart y revocación mediante HTTP local', async (t) => {
  const image = process.env.AUDIVARE_WEB_TEST_IMAGE;
  const containerName = 'audivare-web-http-' + process.pid;
  const secret = 'secreto-exclusivo-de-tests-con-32-caracteres';
  const token = await new SignJWT({ sub: '00000000-0000-4000-8000-000000000001',
    sid: '00000000-0000-4000-8000-000000000002', tipo_usuario: 'INTERNO' })
    .setProtectedHeader({ alg: 'HS256' }).setIssuer('audivare-api').setAudience('audivare-web')
    .setIssuedAt().setExpirationTime('8h').sign(new TextEncoder().encode(secret));
  const recibidas: { url?: string; authorization?: string; body: string }[] = [];
  let falloLogout = false;
  let limiteLogin = false;
  let empresaVencida = false;
  let vinculoRetirado = false;
  const empresasContador = Array.from({length:14},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,razon_social:`Empresa ficticia ${String(i+1).padStart(2,'0')}`,ruc:`20123456${String(i+1).padStart(3,'0')}`,fecha_vinculacion:'2026-10-27T12:00:00.000Z'}));
  const api = createServer(async (req, res) => {
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    recibidas.push({ url: req.url, authorization: req.headers.authorization, body: Buffer.concat(chunks).toString() });
    res.setHeader('content-type', 'application/json');
    const consulta = new URL(req.url || '/', 'http://api.example.test');
    if (consulta.pathname === '/contador/empresas') {
      const pagina = Number(consulta.searchParams.get('pagina') || 1);
      const busqueda = (consulta.searchParams.get('busqueda') || '').toLowerCase();
      const coincidencias = empresasContador.filter(e=>e.razon_social.toLowerCase().includes(busqueda)||e.ruc.includes(busqueda));
      res.end(JSON.stringify({data:coincidencias.slice((pagina-1)*10,pagina*10),total:coincidencias.length,pagina,porPagina:10}));return;
    }
    if (consulta.pathname.startsWith('/contador/empresas/')) {
      const e = empresasContador.find(e=>consulta.pathname===`/contador/empresas/${e.id}`);
      res.statusCode = !vinculoRetirado && e ? 200 : 403; res.end(JSON.stringify(e || {message:'Sin vínculo'}));return;
    }
    if (req.url === '/auth/login' && limiteLogin) { res.statusCode = 429; res.end('{}'); return; }
    if (req.url === '/auth/login' || req.url === '/auth/google/registro') {
      res.end(JSON.stringify({ access_token: token, tipo_usuario: 'INTERNO', expires_in: 28800 })); return;
    }
    if (empresaVencida && (req.url === '/perfil/permisos' || req.url === '/empresa')) {
      res.statusCode = 403; res.end(JSON.stringify({ message: 'El periodo de acceso de tu empresa terminó.' })); return;
    }
    if (req.url === '/auth/logout' && falloLogout) { res.statusCode = 503; res.end('{}'); return; }
    if (req.url === '/legal/aceptacion') {
      res.statusCode = req.method === 'POST' ? 201 : 200;
      res.end(JSON.stringify({ version: '2026-10-27.1', aceptada_en: req.method === 'POST' ? '2026-10-09T03:00:00.000Z' : null })); return;
    }
    if (req.url === '/privacidad/solicitudes') { res.statusCode = 201; res.end(JSON.stringify({ referencia:'ficticia-privacidad' })); return; }
    if (req.url === '/perfil/permisos') { res.end(JSON.stringify({ permisos: ['DOCUMENTO_MENSUAL_READ','DOCUMENTO_MENSUAL_CREATE','DOCUMENTO_MENSUAL_EXPORT'] })); return; }
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise<void>((resolve) => api.listen(0, image ? '0.0.0.0' : '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => { api.close(() => resolve()); api.closeAllConnections(); }));
  const apiAddress = api.address(); assert.ok(apiAddress && typeof apiAddress !== 'string');
  const reserva = createServer();
  await new Promise<void>((resolve) => reserva.listen(0, '127.0.0.1', resolve));
  const address = reserva.address(); assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>((resolve) => reserva.close(() => resolve()));
  const webRoot = path.resolve(__dirname, '..');
  const webRequire = createRequire(path.join(webRoot, 'package.json'));
  const command = image ? 'docker' : process.execPath;
  const args = image ? ['run', '--rm', '--name', containerName, '-p', `127.0.0.1:${port}:8080`,
    '-e', `JWT_SECRET=${secret}`, '-e', `API_URL=http://host.docker.internal:${apiAddress.port}`, image]
    : [webRequire.resolve('next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)];
  const child = spawn(command, args, {
    cwd: webRoot, windowsHide: true,
    env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: secret,
      API_URL: `http://127.0.0.1:${apiAddress.port}`, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (s: Buffer) => { logs = (logs + s.toString()).slice(-4000); });
  child.stderr.on('data', (s: Buffer) => { logs = (logs + s.toString()).slice(-4000); });
  t.after(async () => {
    if (image) spawnSync('docker', ['stop', containerName], { windowsHide: true, stdio: 'ignore', timeout: 15000 });
    if (child.exitCode !== null) return;
    const salida = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    child.kill(); await salida;
  });
  const base = `http://127.0.0.1:${port}`;
  let lista = false;
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`${base}/login`, { signal: AbortSignal.timeout(1000) }); lista = r.ok; if (lista) break; } catch { /* Arranque local. */ }
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(lista, `La web debe arrancar: ${logs}`);
  const portada = await fetch(`${base}/`, { redirect: 'manual' });
  assert.equal(portada.status, 200);
  assert.match(await portada.text(), /ordenados por mes/);
  for (const ruta of ['/dashboard', '/contador/dashboard', '/superadmin/dashboard']) {
    const privada = await fetch(`${base}${ruta}`, { redirect: 'manual' });
    assert.equal(privada.status, 307);
    assert.equal(new URL(privada.headers.get('location')!, base).pathname, '/login');
  }
  assert.equal((await fetch(`${base}/api/perfil`)).status, 401);
  assert.equal((await fetch(`${base}/privacidad`)).status,200);
  for (const ruta of ['/terminos', '/politica-privacidad']) {
    const respuesta = await fetch(`${base}${ruta}`, { redirect: 'manual' });
    assert.equal(respuesta.status, 200, `${ruta} debe ser publica sin sesion`);
    const html = await respuesta.text();
    assert.match(html, /Renzo Paull Casta\u00f1eda Cabanillas/);
    assert.match(html, /mailto:usuario1@example.invalid/);
    assert.match(html, /2026-10-27\.1/);
    assert.match(html, /30 d\u00edas/);
    assert.match(html, /90 d\u00edas/);
  }

  const solicitudPublica = await fetch(`${base}/api/privacidad/solicitudes`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo:'ACCESO',correo:'usuario2@example.invalid',descripcion:'Petici�n ficticia'})});
  assert.equal(solicitudPublica.status,201); assert.equal((await solicitudPublica.json()).referencia,'ficticia-privacidad');
  assert.equal(recibidas.find(r=>r.url==='/privacidad/solicitudes')?.authorization,undefined);
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'usuario3@example.invalid', password: 'public-review-fixture-only' }) });
  assert.equal(login.status, 200);
  assert.deepEqual(await login.json(), { success: true, redirectUrl: '/dashboard' });
  const cookieHeader = login.headers.get('set-cookie') || '';
  assert.match(cookieHeader, /HttpOnly/i); assert.match(cookieHeader, /Max-Age=28800/i); assert.match(cookieHeader, /Secure/i);
  const headers = { cookie: cookieHeader.split(';')[0] };
  const inicio = await fetch(`${base}/dashboard`,{headers});assert.equal(inicio.status,200);const inicioHtml=await inicio.text();assert.match(inicioHtml,/href="\/dashboard\/documentos-mensuales"[^>]*>(?:(?!<\/a>)[\s\S])*Ver documentos(?:(?!<\/a>)[\s\S])*<\/a>/);
  const tabla=await fetch(`${base}/dashboard/documentos-mensuales`,{headers});assert.equal(tabla.status,200);const tablaHtml=await tabla.text();
  assert.match(tablaHtml,/<option value="2026" selected="">2026<\/option>/);assert.match(tablaHtml,/<option value="0" selected="">Todos los meses<\/option>/);assert.doesNotMatch(tablaHtml,/<select[^>]*disabled=""/);assert.match(tablaHtml,/>Periodo<\/th>/);
  assert.match(tablaHtml,/>Referencia<\/th>/);assert.doesNotMatch(tablaHtml,/>Archivo y nota<\/th>/);assert.match(tablaHtml,/Buscar por referencia/);
  for (const pantalla of ['/dashboard/cargar-factura','/dashboard/cargar-sustento']) {
    const pagina = await fetch(`${base}${pantalla}`, {headers}); assert.equal(pagina.status,200);
    const html = await pagina.text(); assert.match(html,/accept="\.pdf,\.jpg,\.jpeg,\.png"/);
    assert.match(html,/Revisa la vista previa antes de guardar/); assert.doesNotMatch(html,/capture="|Tomar foto|Tomar nueva foto/);
    assert.match(html,/<textarea[^>]*required=""/);assert.match(html,/razón social del proveedor/);assert.doesNotMatch(html,/Nota \(opcional\)/);
  }
  const contadorToken = await new SignJWT({sub:'00000000-0000-4000-8000-000000000003',sid:'00000000-0000-4000-8000-000000000004',tipo_usuario:'CONTADOR_EXTERNO',email:'usuario4@example.invalid'})
    .setProtectedHeader({alg:'HS256'}).setIssuer('audivare-api').setAudience('audivare-web').setIssuedAt().setExpirationTime('8h').sign(new TextEncoder().encode(secret));
  const contadorHeaders = {cookie:`token=${contadorToken}`};
  const empresasPagina=await fetch(`${base}/contador/dashboard?busqueda=ficticia&pagina=2`,{headers:contadorHeaders});assert.equal(empresasPagina.status,200);
  const empresasHtml=await empresasPagina.text();assert.match(empresasHtml,/Mostrando 11 a 14 de 14 empresas/);assert.match(empresasHtml,/Empresa ficticia 11/);assert.doesNotMatch(empresasHtml,/>Empresa ficticia 01</);assert.match(empresasHtml,/RUC o razón social/);assert.match(empresasHtml,/busqueda=ficticia/);
  assert.doesNotMatch(empresasHtml,/href="\/contador\/empresa\/[^"\s]+\/descargas"/);
  const empresaId=empresasContador[0].id;
  for(const pantalla of [`/contador/empresa/${empresaId}`,`/contador/empresa/${empresaId}/cargar-factura`,`/contador/empresa/${empresaId}/cargar-sustento`]){
    const res=await fetch(`${base}${pantalla}`,{headers:contadorHeaders});assert.equal(res.status,200);const html=await res.text();assert.match(html,/Empresa ficticia 01/);
    if(pantalla.endsWith('/'+empresaId)){assert.match(html,/cargar-factura/);assert.match(html,/cargar-sustento/);assert.match(html,/Buscar por referencia/);}
    else {assert.match(html,/<textarea[^>]*required=""/);assert.match(html,/Seleccionar archivo/);}
  }
  const descargas=await fetch(`${base}/contador/empresa/${empresaId}/descargas`,{headers:contadorHeaders});assert.equal(descargas.status,200);const descargasHtml=await descargas.text();assert.match(descargasHtml,/Tipos de documentos a descargar/);assert.match(descargasHtml,/aria-current="page"/);assert.match(descargasHtml,/Descargar PDF/);
  vinculoRetirado=true;
  const bloqueada=await fetch(`${base}/contador/empresa/${empresaId}/cargar-factura`,{headers:contadorHeaders});const bloqueadaHtml=await bloqueada.text();assert.match(bloqueadaHtml,/No se pudo acceder a esta empresa/);assert.doesNotMatch(bloqueadaHtml,/<textarea/);
  vinculoRetirado=false;
  const origenAjeno = await fetch(`${base}/api/proxy`, {method:'POST',headers:{...headers,origin:'https://ajeno.example.test','content-type':'application/json'},body:JSON.stringify({path:'/roles',method:'GET'})});
  assert.equal(origenAjeno.status,403);
  assert.equal((await fetch(`${base}/api/auth/login`, {method:'POST',headers:{origin:'https://ajeno.example.test','content-type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(`${base}/api/proxy`, {method:'POST',headers:{...headers,origin:base,'content-type':'application/json'},body:JSON.stringify({path:'/roles',method:'GET'})})).status,200);
  for (const path of ['https://ajeno.example.test','//ajeno.example.test','/../roles','/%2e%2e/roles','/%2froles']) {
    assert.equal((await fetch(`${base}/api/proxy`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({path,method:'GET'})})).status,400,path);
  }
  const segura = await fetch(`${base}/login`);
  assert.equal(segura.headers.get('x-content-type-options'),'nosniff');
  assert.equal(segura.headers.get('x-frame-options'),'DENY');
  assert.equal((await fetch(`${base}/api/legal/aceptacion`)).status, 401);
  assert.equal((await fetch(`${base}/api/legal/aceptacion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  const revision = await fetch(`${base}/condiciones`, { headers });
  assert.equal(revision.status, 200);
  const revisionHtml = await revision.text();
  assert.match(revisionHtml, /Revisi\u00f3n de condiciones/);
  assert.match(revisionHtml, /periodos ya pagados/);
  const aceptacion = await fetch(`${base}/api/legal/aceptacion`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ acepta_terminos: true, privacidad_leida: true, version_legal: '2026-10-27.1' }) });
  assert.equal(aceptacion.status, 201);
  assert.equal((await aceptacion.json()).aceptada_en, '2026-10-09T03:00:00.000Z');
  assert.equal(recibidas.find(r => r.url === '/legal/aceptacion' && r.body)?.authorization, `Bearer ${token}`);

  const registro = await fetch(`${base}/api/auth/google/registro`, { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tipo: 'EMPRESA', credential: 'fixture' }) });
  assert.equal(registro.status, 200);
  assert.match(registro.headers.get('set-cookie') || '', /HttpOnly/);
  assert.equal((await registro.json()).access_token, undefined);
  empresaVencida = true;
  const bloqueado = await fetch(`${base}/dashboard`, { headers });
  assert.match(await bloqueado.text(), /Tu empresa no tiene acceso vigente/);
  assert.equal((await fetch(`${base}/api/empresa`, { headers })).status, 403);
  empresaVencida = false;
  limiteLogin = true;
  const limitado = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'usuario2@example.invalid', password: 'public-review-fixture-only' }) });
  assert.equal(limitado.status, 429); assert.equal(limitado.headers.get('retry-after'), '60'); assert.equal(limitado.headers.get('set-cookie'), null);
  limiteLogin = false;
  assert.equal((await fetch(`${base}/api/perfil`, { headers })).status, 200);
  const form = new FormData(); form.set('anio', '2026'); form.set('mes', '10'); form.set('categoria', 'FACTURA');
  form.set('archivo', new Blob(['ficticio'], { type: 'application/pdf' }), 'factura.pdf');
  const carga = await fetch(`${base}/api/documentos-mensuales`, { method: 'POST', headers, body: form });
  assert.equal(carga.status, 200);
  const reenviada = recibidas.find(r => r.url === '/documentos-mensuales');
  assert.ok(reenviada); assert.equal(reenviada.authorization, `Bearer ${token}`);
  assert.match(reenviada.body, /2026/); assert.match(reenviada.body, /factura\.pdf/);
  const formContador = new FormData();formContador.set('anio','2026');formContador.set('mes','10');formContador.set('categoria','MEDIO_PAGO');formContador.set('nota','F001-123 Juanito');formContador.set('archivo',new Blob(['ficticio'],{type:'application/pdf'}),'sustento.pdf');
  assert.equal((await fetch(`${base}/api/documentos-mensuales?empresaId=${empresaId}`,{method:'POST',headers:contadorHeaders,body:formContador})).status,200);
  const envioContador=recibidas.find(r=>r.url===`/documentos-mensuales?empresaId=${empresaId}`);assert.ok(envioContador);assert.equal(envioContador.authorization,`Bearer ${contadorToken}`);assert.match(envioContador.body,/F001-123 Juanito/);
  const rutaEdicion=`/documentos-mensuales/00000000-0000-4000-8000-000000000099?empresaId=${empresaId}`;
  assert.equal((await fetch(`${base}/api${rutaEdicion}`,{method:'PATCH',headers:{...contadorHeaders,'content-type':'application/json'},body:JSON.stringify({anio:2026,mes:10,nota:'Nota corregida'})})).status,200);
  assert.equal(recibidas.find(r=>r.url===rutaEdicion)?.authorization,`Bearer ${contadorToken}`);
  falloLogout = true;
  const fallido = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers });
  assert.equal(fallido.status, 503); assert.equal(fallido.headers.get('set-cookie'), null);
  falloLogout = false;
  const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers });
  assert.equal(logout.status, 200); assert.match(logout.headers.get('set-cookie') || '', /token=;/);
});
