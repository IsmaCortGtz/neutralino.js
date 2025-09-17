import { sendMessage } from '../ws/websocket';
import type { NetHost } from '../types/api/net';

export function resolveHost(hostname: string): Promise<NetHost[]> {
    return sendMessage('net.resolveHost', { hostname });
};

export function isOnline(): Promise<boolean> {
    return sendMessage('net.isOnline');
};

