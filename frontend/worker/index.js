// Cloudflare Worker for the GameBoard Angular app.
//
// Implements the Sneat Site Hosting & Auth Pattern
// (backstage: spec/features/site-hosting-pattern) for the `/app` prefix on
// gameboard.live. Mirrors specscore-studio-app's Worker.
//
//   1. Strip the `/app` route prefix before asset lookup. Assets are built
//      with baseHref `/app/` but stored under dist/browser WITHOUT the
//      `/app` path segment, so without stripping every resource 404s.
//   2. SPA fallback: on a 404 under the prefix, serve /index.html so
//      Angular's client-side router can take over the route.
//   3. Set `Cross-Origin-Opener-Policy: same-origin-allow-popups` so
//      Firebase `signInWithPopup` can postMessage its result back to the
//      opener (REQ:popup-signin-baseline). MUST NOT be `same-origin`.
//
// Note: the `/__/auth/*` reverse proxy required by the optional
// signInWithRedirect path (REQ:redirect-signin-optional) is NOT here — that
// reserved path is at the apex (`/__/auth/*`), owned by the landing/root
// deployment, and is only needed once redirect sign-in is enabled.

const PREFIX = '/app';

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

    // Strip the /app prefix for asset lookup. Exact `/app` and `/app/` map
    // to the app shell directly.
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
