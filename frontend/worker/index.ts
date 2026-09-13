const backendPaths = ["/api", "/accounts", "/media", "/admin", "/static"];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!backendPaths.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) {
      return env.ASSETS.fetch(request);
    }

    // Keep the destination fixed; only the path and query come from the browser.
    const upstreamUrl = new URL(env.BACKEND_ORIGIN);
    upstreamUrl.pathname = url.pathname;
    upstreamUrl.search = url.search;
    const upstreamRequest = new Request(upstreamUrl, request);
    upstreamRequest.headers.delete("Host");
    upstreamRequest.headers.delete("X-Forwarded-Host");
    // Preserve Origin, Referer, CSRF headers and cookies for Django's checks.
    try {
      const upstream = await fetch(upstreamRequest, { redirect: "manual", cache: "no-store" });
      // Stream uploads/downloads and preserve separate Set-Cookie headers.
      const response = new Response(upstream.body, upstream);
      response.headers.set("Cache-Control", "private, no-store");
      const location = upstream.headers.get("Location");
      if (location) {
        const redirect = new URL(location, upstreamUrl);
        if (redirect.origin === upstreamUrl.origin) {
          response.headers.set("Location", `${url.origin}${redirect.pathname}${redirect.search}${redirect.hash}`);
        }
      }
      return response;
    } catch {
      console.error(JSON.stringify({ event: "backend_unreachable" }));
      return Response.json(
        { detail: "The server is temporarily unavailable. Please try again shortly." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
  },
} satisfies ExportedHandler<Env>;
