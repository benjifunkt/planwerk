const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createMcpPreferenceService,
} = require('../mcpPreferences.cjs');

const createHarness = (overrides = {}) => {
  let preferences = {};
  const service = createMcpPreferenceService({
    readPreferences: async () => preferences,
    writePreferences: async (nextPreferences) => {
      preferences = nextPreferences;
    },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(`encrypted:${value}`, 'utf8'),
      decryptString: (buffer) => buffer.toString('utf8').replace(/^encrypted:/, ''),
      ...overrides.safeStorage,
    },
    createToken: overrides.createToken || (() => 'generated-access-token-1234567890'),
  });

  return {
    service,
    readStoredPreferences: () => preferences,
  };
};

test('MCP preference service is disabled by default without a token', async () => {
  const { service } = createHarness();

  assert.deepEqual(await service.getAccess(), { enabled: false, token: null });
});

test('enabling MCP stores an encrypted stable token outside planwerk data', async () => {
  const { service, readStoredPreferences } = createHarness();

  const enabled = await service.setEnabled(true);
  const stored = readStoredPreferences();

  assert.deepEqual(enabled, { enabled: true, token: 'generated-access-token-1234567890' });
  assert.equal(stored.mcpEnabled, true);
  assert.equal(typeof stored.mcpTokenEncrypted, 'string');
  assert.doesNotMatch(JSON.stringify(stored), /generated-access-token-1234567890/);
  assert.deepEqual(await service.getAccess(), enabled);
});

test('regenerating MCP access replaces the token while leaving access enabled', async () => {
  const generatedTokens = ['first-generated-token-123456789', 'second-generated-token-12345678'];
  const { service } = createHarness({ createToken: () => generatedTokens.shift() });

  const initial = await service.setEnabled(true);
  const regenerated = await service.regenerateToken();

  assert.equal(initial.token, 'first-generated-token-123456789');
  assert.deepEqual(regenerated, { enabled: true, token: 'second-generated-token-12345678' });
});

test('MCP activation fails when secure local token storage is unavailable', async () => {
  const { service } = createHarness({
    safeStorage: { isEncryptionAvailable: () => false },
  });

  await assert.rejects(
    service.setEnabled(true),
    /Secure local storage is unavailable/
  );
});

test('failed token persistence leaves MCP disabled and removes the old bearer', async () => {
  let preferences = {};
  let writes = 0;
  const service = createMcpPreferenceService({
    readPreferences: async () => preferences,
    writePreferences: async (nextPreferences) => {
      writes += 1;
      if (writes === 3) throw new Error('disk full');
      preferences = nextPreferences;
    },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: value => Buffer.from(`encrypted:${value}`, 'utf8'),
      decryptString: buffer => buffer.toString('utf8').replace(/^encrypted:/, ''),
    },
    createToken: () => writes === 0 ? 'old-token' : 'new-token',
  });

  await service.setEnabled(true);
  await assert.rejects(service.regenerateToken(), /disk full/);
  assert.equal(preferences.mcpEnabled, false);
  assert.equal('mcpTokenEncrypted' in preferences, false);
  assert.deepEqual(await service.getAccess(), { enabled: false, token: null });
});

test('failed token encryption leaves MCP disabled and removes the old bearer', async () => {
  let preferences = {};
  let encryptions = 0;
  const service = createMcpPreferenceService({
    readPreferences: async () => preferences,
    writePreferences: async nextPreferences => {
      preferences = nextPreferences;
    },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: value => {
        encryptions += 1;
        if (encryptions === 2) throw new Error('encryption failed');
        return Buffer.from(`encrypted:${value}`, 'utf8');
      },
      decryptString: buffer => buffer.toString('utf8').replace(/^encrypted:/, ''),
    },
    createToken: () => 'generated-token',
  });

  await service.setEnabled(true);
  await assert.rejects(service.regenerateToken(), /encryption failed/);
  assert.equal(preferences.mcpEnabled, false);
  assert.equal('mcpTokenEncrypted' in preferences, false);
  assert.deepEqual(await service.getAccess(), { enabled: false, token: null });
});
