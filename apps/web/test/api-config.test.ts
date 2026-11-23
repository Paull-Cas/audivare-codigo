import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getApiUrl } from '../src/config/api';

test('Railway exige destino explicito en produccion y conserva origen privado y restricciones', () => {
  const names = ['NODE_ENV', 'API_URL', 'VERCEL_ENV', 'PREVIEW_API_URL'] as const;
  const previous = names.map(name => [name, process.env[name]] as const);
  try {
    Object.assign(process.env, { NODE_ENV: 'production' });
    delete process.env.VERCEL_ENV;
    delete process.env.API_URL;
    assert.throws(getApiUrl, /obligatoria/);
    process.env.API_URL = 'http://audivare.railway.internal:8080';
    assert.equal(getApiUrl(), 'http://audivare.railway.internal:8080');
    process.env.API_URL = 'https://api.example.test/private';
    assert.throws(getApiUrl, /sin credenciales ni ruta/);
    process.env.API_URL = 'https://api.example.test';
    process.env.VERCEL_ENV = 'preview';
    delete process.env.PREVIEW_API_URL;
    assert.throws(getApiUrl, /obligatoria/);
    process.env.PREVIEW_API_URL = process.env.API_URL;
    assert.throws(getApiUrl, /independiente/);
    process.env.PREVIEW_API_URL = 'https://preview.example.test';
    assert.equal(getApiUrl(), 'https://preview.example.test');
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else Object.assign(process.env, { [name]: value });
    }
  }
});
