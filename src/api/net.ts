import { sendMessage } from '../ws/websocket';
import type { BrowserResponse, FetchFormDataItem, FetchRequest, FetchResponse, NetHost } from '../types/api/net';
import { arrayBufferToBase64, base64ToBytesArray } from '../helpers';

export function resolveHost(hostname: string): Promise<NetHost[]> {
    return sendMessage('net.resolveHost', { hostname });
};

export function isOnline(): Promise<boolean> {
    return sendMessage('net.isOnline');
};

function createRequest(input: URL | string, init?: RequestInit): Request {
    const options = {
        // Default options
        body: null,
        headers: {},
        integrity: '',
        keepalive: true,
        method: 'GET',

        ...init,

        // Non configurable options
        cache: 'no-store',
        credentials: 'omit',
        mode: 'cors',
        priority: 'auto',
        redirect: 'manual',
        referrer: '',
        referrerPolicy: 'no-referrer',
        signal: null,
        window: null,
    };

    if (options.body && ['GET', 'HEAD'].includes(options.method.toUpperCase())) {
        throw new TypeError('Request with GET or HEAD method cannot have body.');
    }

    const req = new Request(input, init);
    if (options.keepalive) req.headers.set('Connection', 'keep-alive');
    return req;
}

async function createNeutralinoRequest(request: Request): Promise<FetchRequest> {
    let headers = "";
    for (const [key, value] of request.headers.entries()) {
        headers += `${key}: ${value}\r\n`;
    }

    const neutralinoFetch: FetchRequest = {
        method: request.method,
        url: request.url,
        headers,
        isFormData: false,
    };

    if (request.headers.get("Content-Type")?.includes("multipart/form-data")) {
        neutralinoFetch.isFormData = true;
        const formData = await request.formData();
        const formDataItems: FetchFormDataItem[] = [];

        for (const [key, value] of formData.entries()) {
            const item: FetchFormDataItem = { name: key, value: '' };
            if (value instanceof File) {
                item.filename = value.name;
                item.contentType = value.type;
                item.contentLength = value.size;
                item.value = arrayBufferToBase64(await value.arrayBuffer());
            } else {
                item.value = value.toString();
            }
            formDataItems.push(item);
        }

        neutralinoFetch.body = formDataItems;
    } else if (request.body) {
        const arrayBuffer = await request.arrayBuffer();
        neutralinoFetch.body = arrayBufferToBase64(arrayBuffer);
    }

    return neutralinoFetch;
}

function parseNeutralinoResponse(neutralinoResponse: FetchResponse): BrowserResponse {
    const headers = new Headers(neutralinoResponse.headers);
    const body = neutralinoResponse.body.trim() ? base64ToBytesArray(neutralinoResponse.body) : null;

    return new Response(body, {
        status: neutralinoResponse.status,
        statusText: neutralinoResponse.statusText,
        headers: headers
    });
}

export async function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<BrowserResponse> {
    const request = input instanceof Request ? input : createRequest(input, init);
    const neutralinoFetch = await createNeutralinoRequest(request);

    const rawResponse = await sendMessage('net.fetch', neutralinoFetch);
    return parseNeutralinoResponse(rawResponse);
}