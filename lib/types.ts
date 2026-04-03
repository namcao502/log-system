export interface JiraVerifyResponse {
  valid: boolean;
  summary?: string;
  error?: string;
}

export interface LogResponse {
  success: boolean;
  cell?: string;
  error?: string;
  logs?: string[];
}

export interface LogRequestBody {
  ticket: string;
  dates?: string[];
}

export interface HrmLogRequestBody {
  tickets: string[];
  dates?: string[];
}

export interface HrmLogResponse {
  success: boolean;
  error?: string;
  logs?: string[];
}

export type LogStreamLine =
  | { type: "log"; data: string }
  | { type: "result"; success: true; cell: string }
  | { type: "result"; success: false; cell?: string; error: string };

export type HrmStreamLine =
  | { type: "log"; data: string }
  | { type: "result"; success: true }
  | { type: "result"; success: false; error: string };
