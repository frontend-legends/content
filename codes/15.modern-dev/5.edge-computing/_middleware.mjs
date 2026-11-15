// Edge middleware магазина только на веб-API: Request, Response, URL, Headers, crypto.
// Один и тот же модуль запускается в workerd (рантайм Cloudflare Workers) и в Node.js.
const PRIVATE = ['/account', '/orders'];
let handled = 0; // глобальное состояние изолята — живёт между запросами, но не гарантированно

export default {
  async fetch(request) {
    handled++;
    const url = new URL(request.url);
    const country = request.cf?.country ?? request.headers.get('x-country') ?? 'RU';

    // 1. география: магазин для Казахстана на своём домене
    if (country === 'KZ' && !url.pathname.startsWith('/kz')) {
      return Response.redirect(new URL(`/kz${url.pathname}`, url), 302);
    }
    // 2. закрытые разделы без сессии — на вход, не доходя до приложения
    const cookies = Object.fromEntries((request.headers.get('cookie') ?? '').split(/;\s*/).filter(Boolean).map((c) => c.split('=')));
    if (PRIVATE.some((p) => url.pathname.startsWith(p)) && !cookies.session) {
      return Response.redirect(new URL(`/login?next=${encodeURIComponent(url.pathname)}`, url), 302);
    }
    // 3. A/B: стабильная группа по идентификатору посетителя
    const visitor = cookies.vid ?? crypto.randomUUID();
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`checkout:${visitor}`)));
    const variant = digest[0] % 2 === 0 ? 'A' : 'B';
    const headers = new Headers({ 'content-type': 'application/json', 'x-variant': variant });
    if (!cookies.vid) headers.append('set-cookie', `vid=${visitor}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`);
    return new Response(JSON.stringify({ path: url.pathname, country, variant, handled }), { headers });
  },
};
