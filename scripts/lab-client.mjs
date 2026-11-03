const defaultOrigin = process.env.MACOFU_TEST_URL || 'http://127.0.0.1:5080';

// Node's fetch does not retain cookies. Each client models one browser's cookie jar.
export function createLearner(cookie = '', origin = defaultOrigin) {
  return {
    get cookie() { return cookie; },
    async request(path, method = 'GET') {
      const response = await fetch(origin + path, {
        method, headers: cookie ? { Cookie: cookie } : {}, signal: AbortSignal.timeout(5000)
      });
      const issued = response.headers.getSetCookie().find(value => value.startsWith('macofu-learner='));
      if (issued) cookie = issued.split(';', 1)[0];
      const text = await response.text();
      return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
    }
  };
}
