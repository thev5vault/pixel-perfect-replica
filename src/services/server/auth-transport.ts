export function hasClerkSessionCredential(request: Pick<Request, "headers">): boolean {
  if (/^Bearer\s+\S+/i.test(request.headers.get("authorization") ?? "")) return true;

  return (request.headers.get("cookie") ?? "")
    .split(";")
    .some((cookie) => /^__session(?:_[A-Za-z0-9_-]+)?=/.test(cookie.trim()));
}
