/**
 * Zero-dependency HTTP client for the QA suite.
 *
 * Cookies are tracked by hand rather than left to fetch: a production build
 * marks the session cookies `Secure`, and while browsers make an exception for
 * localhost, Node's fetch does not send them back over plain http.
 */
export class Client {
  constructor(baseUrl, label = "anon") {
    this.baseUrl = baseUrl;
    this.label = label;
    this.cookies = {};
  }

  async call(method, path, body, opts = {}) {
    const headers = { ...(opts.headers ?? {}) };
    let payload;

    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }

    const jar = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    if (jar) headers.Cookie = jar;

    let response;
    try {
      response = await fetch(this.baseUrl + path, { method, headers, body: payload, redirect: "manual" });
    } catch (error) {
      return { status: 0, body: { message: `network error: ${error.message}` } };
    }

    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const index = pair.indexOf("=");
      if (index < 0) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value) this.cookies[name] = value;
      else delete this.cookies[name];
    }

    const text = await response.text();
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text.slice(0, 200) };
    }
    return { status: response.status, body: parsed, data: parsed?.data, message: parsed?.message };
  }

  get = (p, o) => this.call("GET", p, undefined, o);
  post = (p, b, o) => this.call("POST", p, b, o);
  put = (p, b, o) => this.call("PUT", p, b, o);
  patch = (p, b, o) => this.call("PATCH", p, b, o);
  del = (p, b, o) => this.call("DELETE", p, b, o);
}

export async function staffLogin(baseUrl, email, password, label) {
  const client = new Client(baseUrl, label);
  const result = await client.post("/api/auth/login", { email, password });
  if (result.status !== 200) {
    throw new Error(`login failed for ${email}: ${result.status} ${result.message}`);
  }
  const me = await client.get("/api/auth/me");
  client.permissions = me.data?.permissions ?? [];
  client.role = me.data?.role;
  client.userId = me.data?.id;
  client.name = me.data?.name;
  return client;
}

/** Signs a shopper in with the OTP the API echoes back when no SMS gateway exists. */
export async function customerLogin(baseUrl, phone, name) {
  const client = new Client(baseUrl, `customer:${phone}`);
  const otp = await client.post("/api/shop/auth/otp", { phone });
  const code = otp.data?.devCode;
  if (!code) throw new Error(`no OTP echoed for ${phone} — is OTP_ECHO=true? (${otp.message})`);
  let verify = await client.post("/api/shop/auth/verify", { phone, code });
  if (verify.data?.needsName) {
    verify = await client.post("/api/shop/auth/verify", { phone, code, name });
  }
  if (verify.status !== 200) throw new Error(`OTP verify failed for ${phone}: ${verify.message}`);
  client.customer = verify.data?.customer;
  return client;
}
