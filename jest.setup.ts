import "@testing-library/jest-dom";
import { ReadableStream } from "node:stream/web";
import { TextEncoder, TextDecoder } from "node:util";

// Expose Web Streams APIs that jsdom does not provide
const g = global as unknown as Record<string, unknown>;
if (!g["ReadableStream"]) g["ReadableStream"] = ReadableStream;
if (!g["TextEncoder"]) g["TextEncoder"] = TextEncoder;
if (!g["TextDecoder"]) g["TextDecoder"] = TextDecoder;
