import "@testing-library/jest-dom";
import { ReadableStream } from "node:stream/web";
import { TextEncoder, TextDecoder } from "node:util";
import { webcrypto } from "node:crypto";

// Expose Web Streams APIs that jsdom does not provide
const g = global as unknown as Record<string, unknown>;
if (!g["ReadableStream"]) g["ReadableStream"] = ReadableStream;
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
