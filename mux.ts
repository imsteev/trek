type Handler = [
  method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE",
  pattern: string,
  fn: (res: Request) => Response | Promise<Response>
];

class Mux {
  handlers!: Handler[];

  constructor() {
    this.handlers = [];
  }

  withHandlers(handlers: Handler[]) {
    this.handlers = handlers;
    return this;
  }

  get(pattern: Handler[1], fn: Handler[2]) {
    this.handlers.push(["GET", pattern, fn]);
    return this;
  }

  post(pattern: Handler[1], fn: Handler[2]) {
    this.handlers.push(["POST", pattern, fn]);
    return this;
  }

  patch(pattern: Handler[1], fn: Handler[2]) {
    this.handlers.push(["PATCH", pattern, fn]);
    return this;
  }

  delete(pattern: Handler[1], fn: Handler[2]) {
    this.handlers.push(["DELETE", pattern, fn]);
    return this;
  }

  put(pattern: Handler[1], fn: Handler[2]) {
    this.handlers.push(["PUT", pattern, fn]);
    return this;
  }

  serve(req: Request) {
    for (const handler of this.handlers) {
      if (req.method !== handler[0]) {
        continue;
      }
      const url = new URL(req.url);
      if (url.pathname !== handler[1]) {
        continue;
      }
      return handler[2](req);
    }

    return new Response("bad request", { status: 400 });
  }
}

export { Mux };
