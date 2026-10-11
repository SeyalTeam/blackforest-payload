export function corsHeaders(
  request?: Request | { headers?: Headers | { get?: (name: string) => string | null } } | null,
  methods = "GET,POST,OPTIONS"
) {
  const incomingOrigin =
    request && "headers" in request && request.headers && typeof request.headers.get === "function"
      ? request.headers.get("origin")
      : null;

  const allowedOrigins = [
    "https://theblackforestcakes.com",
    "https://superadmin.theblackforestcakes.com",
    "http://localhost:3001",
    "http://localhost:3000",
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  let origin = process.env.FRONTEND_URL || "https://theblackforestcakes.com";
  if (
    incomingOrigin &&
    (allowedOrigins.includes(incomingOrigin) ||
      incomingOrigin.includes("theblackforestcakes.com") ||
      incomingOrigin.includes("localhost") ||
      incomingOrigin.includes("127.0.0.1"))
  ) {
    origin = incomingOrigin;
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

export function handleOptions(request?: Request, methods = "GET,POST,OPTIONS") {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, methods),
  });
}
