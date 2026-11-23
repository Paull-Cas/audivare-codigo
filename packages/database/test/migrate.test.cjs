const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const postgres = require('postgres');

test('El comando de despliegue migra sin seed y conserva permisos al repetirse', async () => {
  const destino = new URL(process.env.AUDIVARE_MIGRATION_TEST_DATABASE_URL || 'http://sin-destino');
  assert.ok(['postgres:', 'postgresql:'].includes(destino.protocol)
    && destino.hostname === '127.0.0.1' && destino.username === 'audivare_test'
    && /^\/audivare_migracion_\d+_test$/.test(destino.pathname), 'Requiere una BD nueva local dedicada');
  const sql = postgres(destino.href, { max: 1 });
  try {
    const tablas = await sql`select tablename from pg_tables where schemaname = 'public'`;
    assert.equal(tablas.length, 0, 'La prueba necesita una BD vacía; no modifica una BD existente');
    const pkg = require('../package.json');
    assert.equal(pkg.scripts['db:migrate'], 'tsx src/migrate.ts');
    const ejecutar = () => {
      const resultado = spawnSync(process.execPath, [require.resolve('tsx/cli'), resolve(__dirname, '../src/migrate.ts')], {
        cwd: resolve(__dirname, '..'), timeout: 60000, encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: destino.href },
      });
      assert.equal(resultado.status, 0, 'La migración debe terminar correctamente');
      assert.match(resultado.stdout, /no seed/);
    };
    ejecutar();
    assert.equal(Number((await sql`select count(*) as n from usuario`)[0].n), 0, 'No crea administrador');
    assert.equal(Number((await sql`select count(*) as n from permiso`)[0].n), 0, 'No carga permisos iniciales');
    await sql`insert into permiso (codigo_permiso, descripcion) values ('PERMISO_FICTICIO_CONSERVAR', 'Canario de despliegue')`;
    const antes = await sql`select * from permiso order by id`;
    const migraciones = await sql`select * from drizzle.__drizzle_migrations order by id`;
    ejecutar();
    assert.deepEqual(await sql`select * from permiso order by id`, antes, 'No elimina permisos ajenos al seed');
    assert.deepEqual(await sql`select * from drizzle.__drizzle_migrations order by id`, migraciones, 'No duplica migraciones');
    assert.equal(Number((await sql`select count(*) as n from usuario`)[0].n), 0);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
