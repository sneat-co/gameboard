// Cloudflare Worker for the GameBoard Angular + Ionic app.
//
// Implements the Sneat Site Hosting & Auth Pattern
// (backstage: spec/features/site-hosting-pattern) for the `/app` prefix on
// gameboard.live. Mirrors specscore-studio-app's Worker.
//
//   1. Strip the `/app` route prefix before asset lookup. Assets are built
//      with baseHref `/app/` but stored under dist/apps/gameboard-app/browser
//      WITHOUT the `/app` path segment, so without stripping every resource
//      404s.
//   2. SPA fallback: on a 404 under the prefix, serve /index.html so Angular's
//      router can take over the route.
//   3. Set `Cross-Origin-Opener-Policy: same-origin-allow-popups` so Firebase
//      `signInWithPopup` can postMessage its result back to the opener
//      (REQ:popup-signin-baseline). MUST NOT be `same-origin`.
//   4. Transparently reverse-proxy the Firebase reserved path `/__/auth/*`
//      (route `gameboard.live/__/auth/*`) to the shared project's
//      `<project>.firebaseapp.com` handler so sign-in works with
//      `authDomain = gameboard.live` (REQ:redirect-signin-optional). The app
//      is on Cloudflare, not Firebase Hosting, so these endpoints aren't served
//      natively. This is a rewrite, NEVER a 3xx redirect.

const PREFIX = '/app';

// Shared Firebase project (backstage spec: shared-firebase-project).
const FIREBASE_AUTH_HOST = 'sneat-eur3-1.firebaseapp.com';
const AUTH_PREFIX = '/__/auth/';

const RESPONSE_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Referrer-Policy': 'strict-origin',
};

/** Clone a Response and append the standard headers. */
function withHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(RESPONSE_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const original = url.pathname;

    // Firebase Auth reserved path: transparently proxy to the project's
    // firebaseapp.com handler (a rewrite, not a redirect). Pass the upstream
    // response through unmodified — do NOT layer the app-shell headers on it.
    if (original.startsWith(AUTH_PREFIX)) {
      const target = new URL(request.url);
      target.hostname = FIREBASE_AUTH_HOST;
      target.port = '';
      return fetch(new Request(target, request));
    }

    // Strip the /app prefix for asset lookup. Exact `/app` and `/app/` map to
    // the app shell directly.
    if (original === PREFIX || original === PREFIX + '/') {
      url.pathname = '/index.html';
    } else if (original.startsWith(PREFIX + '/')) {
      url.pathname = original.slice(PREFIX.length); // drop '/app', keep '/...'
    }

    const assetResponse = await env.ASSETS.fetch(new Request(url, request));

    // SPA fallback so Angular's router can handle deep client-side routes.
    if (assetResponse.status === 404) {
      const indexUrl = new URL(request.url);
      indexUrl.pathname = '/index.html';
      const fallback = await env.ASSETS.fetch(new Request(indexUrl, request));
      return withHeaders(fallback);
    }

    return withHeaders(assetResponse);
  },
};
