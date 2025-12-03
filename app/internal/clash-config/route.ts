import { NextRequest, NextResponse } from "next/server";
import YAML from "yaml";
import type { ClashConfig, ClashProxyGroup } from "./types";

const flags: Record<string, string> = {
    HK: "🇭🇰",
    TW: "🇹🇼",
    SG: "🇸🇬",
    JP: "🇯🇵",
    US: "🇺🇸",
    MY: "🇲🇾",
    GB: "🇬🇧",
    TH: "🇹🇭",
    AR: "🇦🇷",
    BR: "🇧🇷",
};

function flagize(name: string): string {
    const region = name.match(/^([A-Z]{2})/);
    if (region && flags[region[1]])
        return name.replace(region[0], flags[region[1]]);
    return name;
}

function namechange(name: string): string {
    return flagize(name)
        .replace(/ (..(?:负载|路由)) (..加速) (\d+)/, " $3 $1$2")
        .replace("全局负载", "全局")
        .replace("混合负载", "混合")
        .replace("智能路由", "智能")
        .replace("动态加速", "D+")
        .replace("全球加速", "G+");
}

function processClashConfig(config: ClashConfig): ClashConfig {
    const proxies = Array.isArray(config.proxies) ? config.proxies : [];
    config.proxies = proxies;

    // 1. proxies：删前 4 个 + 重命名
    if (proxies.length > 0) {
        proxies.splice(0, 4);
        for (const proxy of proxies) {
            if (proxy.name) {
                proxy.name = namechange(proxy.name);
            }
        }
    }

    // 1.1 收集 🇺🇸 节点
    const usProxyNames = proxies
        .filter((p) => typeof p.name === "string" && p.name.startsWith("🇺🇸"))
        .map((p) => p.name as string);

    // 1.2 静态住宅代理注入
    const ispHost = process.env.CLASH_ISP_HOST;
    const ispPortRaw = process.env.CLASH_ISP_PORT;
    const ispUser = process.env.CLASH_ISP_USERNAME;
    const ispPass = process.env.CLASH_ISP_PASSWORD;

    const ispPort = ispPortRaw ? Number(ispPortRaw) : NaN;

    let dialerProxyForISP: string;

    if (usProxyNames.length > 0) {
        // 有 US 节点，用 ISP Dialer
        dialerProxyForISP = "ISP Dialer";
    } else {
        // 没有 US 节点，fallback 到 DIRECT
        dialerProxyForISP = "DIRECT";
    }

    if (!ispHost || !ispUser || !ispPass || Number.isNaN(ispPort)) {
        console.warn("静态住宅代理环境变量未配置完整，将跳过注入。");
    } else {
        proxies.unshift({
            name: "静态住宅代理",
            type: "socks5",
            server: ispHost,
            port: ispPort,
            username: ispUser,
            password: ispPass,
            udp: true,
            "dialer-proxy": dialerProxyForISP,
        });
    }

    // 2. proxy-groups
    const groups = Array.isArray(config["proxy-groups"])
        ? config["proxy-groups"]!
        : [];
    config["proxy-groups"] = groups;

    let brand = "";
    if (groups.length > 0) {
        // 2.1 前 3 个组的处理
        for (let i = 0; i < Math.min(3, groups.length); i++) {
            const group = groups[i];

            if (!Array.isArray(group.proxies)) continue;

            if (i === 0) {
                // 第一个组：记录品牌名 + 改名
                brand = group.name;
                group.name = "国际机场";

                // 去掉索引 2-5
                group.proxies.splice(2, 4);

                // 重命名组内代理名
                group.proxies = group.proxies.map((p) => namechange(p));
            } else if (i === 1 || i === 2) {
                // 第二、第三个组：删前 4 个 + 重命名
                group.proxies.splice(0, 4);
                group.proxies = group.proxies.map((p) => namechange(p));
            }
        }

        // 2.2 如果有 US 节点，就加 ISP Dialer 组（url-test）
        if (usProxyNames.length > 0) {
            const ispDialerGroup: ClashProxyGroup = {
                name: "ISP Dialer",
                type: "url-test",
                proxies: usProxyNames,
                url: "http://www.gstatic.com/generate_204",
                interval: 3600,
            };

            // 防止重复
            const existIndex = groups.findIndex((g) => g.name === "ISP Dialer");
            if (existIndex >= 0) {
                groups[existIndex] = ispDialerGroup;
            } else {
                groups.push(ispDialerGroup);
            }
        }

        // 2.3 在最前加 ChatGPT 代理组
        groups.unshift({
            name: "ChatGPT",
            type: "select",
            proxies: ["静态住宅代理", "国际机场", "DIRECT"],
        });
    }

    // 3. rules
    const rules = Array.isArray(config.rules) ? config.rules : [];
    config.rules = rules;

    if (brand) {
        const brandRegex = new RegExp(`(^|,)${brand}(,|$)`, "g");
        for (let i = 0; i < rules.length; i++) {
            rules[i] = rules[i].replace(brandRegex, (match) =>
                match.replace(brand, "国际机场")
            );
        }
    }

    // 3.1 ChatGPT 规则插到最前面
    rules.unshift(
        "DOMAIN-SUFFIX,auth.openai.com,ChatGPT",
        "DOMAIN-SUFFIX,chatgpt.com,ChatGPT",
        "DOMAIN-SUFFIX,ct.sendgrid.net,ChatGPT",
        "DOMAIN-SUFFIX,featuregates.org,ChatGPT",
        "DOMAIN-SUFFIX,intercom.io,ChatGPT",
        "DOMAIN-SUFFIX,intercomcdn.com,ChatGPT",
        "DOMAIN-SUFFIX,oaistatic.com,ChatGPT",
        "DOMAIN-SUFFIX,oaiusercontent.com,ChatGPT",
        "DOMAIN-SUFFIX,openai.com,ChatGPT",
        "DOMAIN-SUFFIX,statsig.com,ChatGPT",
        "DOMAIN,android.chat.openai.com,ChatGPT",
        "DOMAIN,auth0.openai.com,ChatGPT",
        "DOMAIN,cdn.openaimerge.com,ChatGPT",
        "DOMAIN,cdn.workos.com,ChatGPT",
        "DOMAIN,challenges.cloudflare.com,ChatGPT",
        "DOMAIN,chat.openai.com,ChatGPT",
        "DOMAIN,desktop.chat.openai.com,ChatGPT",
        "DOMAIN,events.statsigapi.net,ChatGPT",
        "DOMAIN,featureassets.org,ChatGPT",
        "DOMAIN,forwarder.workos.com,ChatGPT",
        "DOMAIN,humb.apple.com,ChatGPT",
        "DOMAIN,images.workoscdn.com,ChatGPT",
        "DOMAIN,ios.chat.openai.com,ChatGPT",
        "DOMAIN,js.intercomcdn.com,ChatGPT",
        "DOMAIN,js.stripe.com,ChatGPT",
        "DOMAIN,o207216.ingest.sentry.io,ChatGPT",
        "DOMAIN,o33249.ingest.sentry.io,ChatGPT",
        "DOMAIN,prodregistryv2.org,ChatGPT",
        "DOMAIN,rum.browser-intake-datadoghq.com,ChatGPT",
        "DOMAIN,setup.auth.openai.com,ChatGPT",
        "DOMAIN,setup.workos.com,ChatGPT",
        "DOMAIN,statsigapi.net,ChatGPT",
        "DOMAIN,tcr9i.chat.openai.com,ChatGPT",
        "DOMAIN,workos.imgix.net,ChatGPT",
    );

    return config;
}

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
    try {
        const baseUrl = process.env.CLASH_CONFIG_BASE_URL;
        if (!baseUrl) {
            return NextResponse.json(
                { ok: false, error: "CLASH_CONFIG_BASE_URL 未配置" },
                { status: 500 }
            );
        }

        const resp = await fetch(baseUrl, {
            cache: "no-store",
            headers: { "User-Agent": "clash-verge-rev/v2.3.2" },
        });

        if (!resp.ok) {
            return NextResponse.json(
                { ok: false, error: `拉取 Clash 配置失败: ${resp.status} ${resp.statusText}` },
                { status: 502 }
            );
        }

        const rawYaml = await resp.text();

        const config = YAML.parse(rawYaml) as ClashConfig;
        const processed = processClashConfig(config);

        const outYaml = YAML.stringify(processed);

        const headers = new Headers();
        headers.set("Content-Type", "text/yaml; charset=utf-8");
        headers.set("Content-Disposition", `attachment;filename*=UTF-8''${encodeURIComponent("国际机场")}` || "");
        headers.set("Profile-Update-Interval", resp.headers.get("Profile-Update-Interval") || "");
        headers.set("Profile-Web-Page-URL", "https://lab.pectics.me");
        headers.set("Subscription-Userinfo", resp.headers.get("Subscription-Userinfo") || "");

        return new NextResponse(outYaml, {
            status: 200,
            headers,
        });
    } catch (e: any) {
        console.error("处理 Clash 配置出错:", e);
        return NextResponse.json(
            { ok: false, error: "内部错误: " + (e?.message || String(e)) },
            { status: 500 }
        );
    }
}
