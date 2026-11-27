import assert from 'node:assert/strict';
import test from 'node:test';
import { localOrigin } from './local-origin.mjs';

test('integration endpoints must be loopback HTTP origins', () => {
  for (const origin of ['http://localhost:3020', 'http://127.0.0.1:54321', 'http://[::1]:54321']) {
    assert.equal(localOrigin(origin), origin);
  }
  for (const value of [undefined, 'https://example.invalid', 'http://localhost.example.invalid',
    'http://127.0.0.1@example.invalid', 'http://127.0.0.1/path']) {
    assert.throws(() => localOrigin(value));
  }
});
