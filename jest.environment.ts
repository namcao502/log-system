/**
 * Custom Jest environment that extends jsdom with Node 18+ fetch globals.
 * This allows tests to use `new Response(...)`, `new Request(...)`, etc.
 */
import JSDOMEnvironment from "jest-environment-jsdom";

export default class CustomJsdomEnvironment extends JSDOMEnvironment {
  async setup(): Promise<void> {
    await super.setup();
    // Expose Node 18+ fetch globals that jsdom does not provide.
    // These are available on the Node process global but not in the jsdom vm context.
    const nodeGlobal = globalThis as unknown as Record<string, unknown>;
    const env = this.global as unknown as Record<string, unknown>;
    if (!env["Response"] && nodeGlobal["Response"]) {
      env["Response"] = nodeGlobal["Response"];
    }
    if (!env["Request"] && nodeGlobal["Request"]) {
      env["Request"] = nodeGlobal["Request"];
    }
    if (!env["Headers"] && nodeGlobal["Headers"]) {
      env["Headers"] = nodeGlobal["Headers"];
    }
    if (!env["fetch"] && nodeGlobal["fetch"]) {
      env["fetch"] = nodeGlobal["fetch"];
    }
  }
}
