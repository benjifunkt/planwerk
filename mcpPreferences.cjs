const crypto = require('crypto');

const MCP_ENABLED_KEY = 'mcpEnabled';
const MCP_TOKEN_KEY = 'mcpTokenEncrypted';

const createAccessToken = () => crypto.randomBytes(32).toString('base64url');

const createMcpPreferenceService = ({
  readPreferences,
  writePreferences,
  safeStorage,
  createToken = createAccessToken,
}) => {
  const assertSecureStorage = () => {
    if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure local storage is unavailable. MCP access could not be enabled.');
    }
  };

  const decryptToken = (preferences) => {
    if (!preferences[MCP_TOKEN_KEY]) return null;
    assertSecureStorage();
    return safeStorage.decryptString(Buffer.from(preferences[MCP_TOKEN_KEY], 'base64'));
  };

  const storeToken = (preferences, token) => {
    assertSecureStorage();
    return {
      ...preferences,
      [MCP_TOKEN_KEY]: safeStorage.encryptString(token).toString('base64'),
    };
  };

  const getAccess = async () => {
    const preferences = await readPreferences();
    if (preferences[MCP_ENABLED_KEY] !== true) {
      return { enabled: false, token: null };
    }

    return { enabled: true, token: decryptToken(preferences) };
  };

  const setEnabled = async (enabled) => {
    const preferences = await readPreferences();
    if (!enabled) {
      await writePreferences({ ...preferences, [MCP_ENABLED_KEY]: false });
      return { enabled: false, token: null };
    }

    const token = decryptToken(preferences) || createToken();
    const nextPreferences = {
      ...storeToken(preferences, token),
      [MCP_ENABLED_KEY]: true,
    };
    await writePreferences(nextPreferences);
    return { enabled: true, token };
  };

  const regenerateToken = async () => {
    const preferences = await readPreferences();
    const wasEnabled = preferences[MCP_ENABLED_KEY] === true;
    const { [MCP_TOKEN_KEY]: _oldToken, ...preferencesWithoutToken } = preferences;
    const disabledPreferences = {
      ...preferencesWithoutToken,
      [MCP_ENABLED_KEY]: false,
    };

    await writePreferences(disabledPreferences);
    const token = createToken();
    const nextPreferences = {
      ...storeToken(disabledPreferences, token),
      [MCP_ENABLED_KEY]: wasEnabled,
    };
    await writePreferences(nextPreferences);
    return {
      enabled: wasEnabled,
      token,
    };
  };

  return {
    getAccess,
    setEnabled,
    regenerateToken,
  };
};

module.exports = {
  MCP_ENABLED_KEY,
  MCP_TOKEN_KEY,
  createAccessToken,
  createMcpPreferenceService,
};
