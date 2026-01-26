import { sendMessage, uuidv4 } from '../ws/websocket';
import type { BrowserResponse, FetchFormDataItem, FetchRequest, FetchResponse, NetHost, RawFetchResponse } from '../types/api/net';
import { arrayBufferToBase64, base64ToBytesArray } from '../helpers';
import { off, on } from '../browser/events';

/* Error */
function returnNetworkError(code: string, message: string) {
    return {
        code: code || 'NE_NW_UNKNOWN',
        message,
    }
}


/* Internal functions */

async function createNeutralinoRequest(input: URL | string, init?: RequestInit): Promise<FetchRequest> {
    const options = {
        // Default options
        body: null,
        headers: {},
        integrity: '',
        keepalive: true,
        method: 'GET',
        signal: null,
        redirect: 'follow' as const,

        ...init,

        // Non configurable options
        cache: 'no-store' as const,
        credentials: 'omit' as const,
        mode: 'cors' as const,
        priority: 'auto' as const,
        referrer: '',
        referrerPolicy: 'no-referrer' as const,
        window: null,
    };

    if (options.keepalive) {
        if (options.headers instanceof Headers) options.headers.set('Connection', 'keep-alive');
        else if (typeof options.headers === 'object') options.headers['Connection'] = 'keep-alive';
    }
    if (options.body && ['GET', 'HEAD'].includes(options.method.toUpperCase())) {
        throw new TypeError('Request with GET or HEAD method cannot have body.');
    }
    if (options.body instanceof URLSearchParams) {
        if (options.headers instanceof Headers) options.headers.set('Content-Type', 'application/x-www-form-urlencoded');
        else if (typeof options.headers === 'object') options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    // Only for internal validation
    let _headers = '';
    const request = new Request(input, options);
    const iterator = options.headers instanceof Headers
        ? options.headers.entries()
        : Object.entries(options.headers);

    for (const [key, value] of iterator) {
        _headers += `${key}: ${value}\r\n`;
    }

    const neutralinoFetch: FetchRequest = {
        uuidv4: uuidv4(),
        method: options.method,
        url: input.toString(),
        headers: _headers,
        isFormData: false,
        followRedirects: options.redirect === 'follow',
    };

    if (options.body instanceof FormData) {
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
    const body = neutralinoResponse?.body ? base64ToBytesArray(neutralinoResponse.body) : null;

    return new Response(body, {
        status: neutralinoResponse.status,
        statusText: neutralinoResponse.statusText,
        headers: headers
    });
}



/* Controllers */

export function resolveHost(hostname: string): Promise<NetHost[]> {
    return sendMessage('net.resolveHost', { hostname });
};

export function fetch(input: URL | string, init?: RequestInit): Promise<BrowserResponse> {
    return new Promise<BrowserResponse>((resolve, reject) => {
        (async () => {
            if (!input) return reject(returnNetworkError('NE_RT_NATRTER', 'The input provided is invalid.'));
            let aborted = init?.signal?.aborted;
            let neutralinoFetch: FetchRequest | null = null;

            const aborListener = () => {
                if (aborted) return;
                aborted = true;

                if (neutralinoFetch) off(`net.fetch:${neutralinoFetch.uuidv4}`, responseListener);
                reject(returnNetworkError('NE_NW_REQCANC', 'The user aborted the request.'));
            }

            const responseListener = (event: { detail: RawFetchResponse }) => {
                if (aborted) return;

                if (init?.signal) init.signal?.removeEventListener('abort', aborListener);
                if (neutralinoFetch) off(`net.fetch:${neutralinoFetch.uuidv4}`, responseListener);

                if (!event.detail.success) {
                    reject(returnNetworkError(event.detail.error.code, event.detail.error.message));
                    return;
                }

                if (init?.redirect === 'error' && event.detail.returnValue.status! >= 300 && event.detail.returnValue.status! < 400) {
                    reject(returnNetworkError('NE_NW_REDIRECT', 'Redirects are not allowed for this request.'));
                    return;
                }

                const response = parseNeutralinoResponse(event.detail.returnValue);
                resolve(response);
            }

            if (init?.signal) {
                if (aborted) return reject(returnNetworkError('NE_NW_REQCANC', 'The user aborted the request.'));
                init.signal.addEventListener('abort', aborListener, { once: true });
            }

            if (aborted) return;
            neutralinoFetch = await createNeutralinoRequest(input, init);

            if (aborted) return;
            await on(`net.fetch:${neutralinoFetch.uuidv4}`, responseListener);
            await sendMessage('net.fetch', neutralinoFetch);
        })().catch(reject);
    });
}