export interface JiraVerifyResponse {
  valid: boolean;
  summary?: string;
  error?: string;
}

export interface LogResponse {
  success: boolean;
  cell?: string;
  error?: string;
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
}
