import { ContractError } from "./errors";

export type SubscriptionTarget = "mihomo" | "sing-box" | "v2rayn";

export interface SubscriptionRequestContract {
  token: string;
  tokenSource: "authorization" | "path";
  target: SubscriptionTarget;
  multihop: boolean;
}

export function parseSubscriptionRequest(input: {
  headers: Headers;
  searchParams: URLSearchParams;
  pathToken?: string;
}): SubscriptionRequestContract {
  const credential = parseCredential(input.headers, input.pathToken);
  const target = parseTarget(input.searchParams.get("target"), input.headers.get("user-agent"));
  const multihop = input.searchParams.get("multihop") === "1";

  if (target === "v2rayn" && multihop) {
    throw new ContractError("multihop_unsupported", "v2rayN cannot represent multihop chains");
  }

  return { ...credential, target, multihop };
}

export function parseCredential(
  headers: Headers,
  pathToken?: string,
): Pick<SubscriptionRequestContract, "token" | "tokenSource"> {
  if (headers.has("authorization")) {
    const authorization = headers.get("authorization")!;
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    if (!match) {
      throw new ContractError(
        "authorization_header_invalid",
        "Authorization must contain exactly one Bearer credential",
      );
    }
    return { token: match[1], tokenSource: "authorization" };
  }

  if (pathToken) {
    return { token: pathToken, tokenSource: "path" };
  }

  throw new ContractError("subscription_token_missing", "Subscription credential is required");
}

export function parseTarget(
  explicitTarget: string | null,
  userAgent: string | null,
): SubscriptionTarget {
  if (explicitTarget !== null) {
    if (explicitTarget === "mihomo" || explicitTarget === "sing-box" || explicitTarget === "v2rayn") {
      return explicitTarget;
    }
    throw new ContractError("target_unknown", "Unknown explicit subscription target");
  }

  if (userAgent === null) return "mihomo";
  const normalized = userAgent.toLowerCase();
  if (normalized.includes("sing-box")) return "sing-box";
  if (normalized.includes("v2rayn")) return "v2rayn";
  return "mihomo";
}
