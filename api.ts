import loginForm from "./templates/loginForm";
import signupForm from "./templates/signupForm";
import { page, escapeHTML } from "./templates";
import {
  SESSION_MAX_AGE_SECONDS,
  accessUser,
  accessUserFromSession,
  newSession,
} from "./db";

import posts from "./db/posts";
import users from "./db/users";

import adminView from "./templates/admin";

const SESSION_KEY = "id";

const HX_ERRORS_HEADERS = {
  "HX-Retarget": "form .errors",
  "HX-Reswap": "innerHTML",
};

export const index = (req: Request) => {
  const cooki = req.headers.get("cookie");
  if (cooki) {
    const sid = cooki.split("=")[1];
    const user = accessUserFromSession(sid);
    if (user) {
      return redirect(req, "/admin");
    }
  }
  return newPage(loginForm);
};

export const logout = (req: Request) => {
  return expireCookie(req);
};

export const admin = (req: Request) => {
  const cooki = req.headers.get("cookie");
  if (!cooki) {
    return redirect(req, "/");
  }
  const sid = cooki.split("=")[1];
  const user = accessUserFromSession(sid);
  if (!user) {
    return expireCookie(req);
  }

  const ps = posts.getPosts(user.id);
  const res = newPage({
    html: adminView.render({ user, posts: ps, csrf: user.session_csrf }),
    css: adminView.css,
  });

  // IMPORTANT: Set cache-control to ensure that clients don't use cached pages.
  res.headers.set("Cache-Control", "no-cache, no-store, max-age=0");

  return res;
};

export const createPost = async (req: Request) => {
  const cooki = req.headers.get("cookie") ?? "";
  if (!cooki) {
    return expireCookie(req);
  }

  const sid = cooki.split("=")[1];
  const user = accessUserFromSession(sid);
  if (!user) {
    return expireCookie(req);
  }

  const form = await req.formData();
  const csrf = form.get("csrf")?.toString();
  const title = form.get("title")?.toString() ?? "";
  const content = form.get("content")?.toString() ?? "";

  if (csrf !== user.session_csrf) {
    return new Response("invalid request", { headers: HX_ERRORS_HEADERS });
  }

  posts.createPost(user.id, content, title);
  const ps = posts.getPosts(user.id);
  return new Response(`<div class="post">
    <h3>${escapeHTML(title)}</h3>
    ${escapeHTML(content)}
  </div>`);
};

export const login = async (req: Request) => {
  const form = await req.formData();
  const username = form.get("username")?.toString() || "";
  const inputPw = form.get("password")?.toString() || "";
  const user = await accessUser(username, inputPw);
  if (!user) {
    return new Response("authentication failed", {
      headers: HX_ERRORS_HEADERS,
    });
  }
  const resp = redirect(req, "/admin");
  const session = establishSession(user!.id);
  console.log({ session });
  resp.headers.set("Set-Cookie", session.cookie);
  return resp;
};

export const signupPage = (_: Request) => newPage(signupForm);

export const signup = async (req: Request) => {
  const form = await req.formData();
  const pw1 = form.get("password1")?.toString() || "";
  const pw2 = form.get("password2")?.toString() || "";
  const username = form.get("username")?.toString() ?? "";

  function _validate(): string | true {
    if (pw1.length < 3) {
      return "password must be at least 3 characters long";
    }
    if (pw1 !== pw2) {
      return "passwords don't match";
    }
    return true;
  }

  const passedOrError = _validate();

  if (passedOrError !== true) {
    return new Response(passedOrError, {
      headers: HX_ERRORS_HEADERS,
    });
  }

  try {
    const user = await users.createUser(username, pw1);
    if (user) {
      const resp = redirect(req, "/admin");
      const session = establishSession(user!.id);
      resp.headers.set("Set-Cookie", session.cookie);
      return resp;
    }
  } catch (e) {
    console.log(`ERROR CREATING USER: ${e}`);
  }

  return new Response("authentication failed", {
    headers: HX_ERRORS_HEADERS,
  });
};

// response helpers
function newPage(content: { html: string; css?: string }): Response {
  return new Response(page(content), {
    headers: { "Content-Type": "text/html" },
  });
}

// HTMX-aware redirection. HTMX requests always have an identifying header
function redirect(req: Request, newLocation: string): Response {
  const isHtmx = req.headers.get("HX-Request") === "true";
  return new Response(null, {
    status: 302,
    headers: isHtmx
      ? { "HX-Redirect": newLocation }
      : { Location: newLocation },
  });
}

function expireCookie(req: Request): Response {
  const res = redirect(req, "/");
  res.headers.set("Set-Cookie", `${SESSION_KEY}=; Max-Age=0`);
  return res;
}

function establishSession(userID: number): {
  cookie: string;
  csrf: string;
} {
  const session = newSession(userID);
  return {
    cookie: `${SESSION_KEY}=${session?.id}; Secure; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    csrf: session?.csrf ?? "",
  };
}
