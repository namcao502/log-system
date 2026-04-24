import "@testing-library/jest-dom";
import { ReadableStream } from "node:stream/web";
import { TextEncoder, TextDecoder } from "node:util";
import { webcrypto } from "node:crypto";

// Expose Web Streams APIs and Fetch APIs that jsdom does not provide
const g = global as unknown as Record<string, unknown>;
if (!g["ReadableStream"]) g["ReadableStream"] = ReadableStream;
// Node 18+ has Response/Request/Headers as globals; expose them to the jsdom test environment
if (!g["Response"]) g["Response"] = (globalThis as unknown as Record<string, unknown>)["Response"];
if (!g["Request"]) g["Request"] = (globalThis as unknown as Record<string, unknown>)["Request"];
if (!g["Headers"]) g["Headers"] = (globalThis as unknown as Record<string, unknown>)["Headers"];
if (!g["TextEncoder"]) g["TextEncoder"] = TextEncoder;
if (!g["TextDecoder"]) g["TextDecoder"] = TextDecoder;
if (!g["crypto"]) g["crypto"] = webcrypto;
// jsdom provides crypto but without randomUUID — patch it
const globalCrypto = g["crypto"] as Crypto;
if (typeof globalCrypto.randomUUID !== "function") {
  Object.defineProperty(globalCrypto, "randomUUID", {
    value: () => webcrypto.randomUUID(),
    writable: true,
    configurable: true,
  });
}
