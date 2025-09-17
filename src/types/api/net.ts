export enum NetFamilyType {
    IPv4 = 'ipv4',
    IPv6 = 'ipv6',
    Unknown = 'unknown'
}

export interface NetHost {
    address: string;
    family: NetFamilyType;
}
