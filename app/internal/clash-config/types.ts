export interface ClashProxy {
    name: string;
    type: string;
    [key: string]: any;
}

export interface ClashProxyGroup {
    name: string;
    type: string;
    proxies?: string[];
    url?: string;
    interval?: number;
    tolerance?: number;
    [key: string]: any;
}

export interface ClashConfig {
    proxies?: ClashProxy[];
    "proxy-groups"?: ClashProxyGroup[];
    rules?: string[];
    [key: string]: any;
}
