export enum NetFamilyType {
    IPv4 = 'ipv4',
    IPv6 = 'ipv6',
    Unknown = 'unknown'
}

export interface NetHost {
    address: string;
    family: NetFamilyType;
}

export interface FetchFormDataItem {
  name: string;
  value: string;
  filename?: string;
  contentType?: string;
  contentLength?: number;
}

export interface FetchRequest {
  uuidv4: string;
  method: string;
  url: string;
  headers: string;
  isFormData?: boolean;
  body?: string | FetchFormDataItem[];
  followRedirects: boolean;
}

export type BrowserResponse = globalThis.Response;

export interface RawFetchResponse {
  success: boolean;
  returnValue?: FetchResponse;
  error?: {
    code: string;
    message: string;
  };
}

export interface FetchResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string; // Base64 encoded string
}