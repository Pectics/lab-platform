export type ContractErrorCode =
  | "subscription_token_missing"
  | "authorization_header_invalid"
  | "target_unknown"
  | "multihop_unsupported";

export class ContractError extends Error {
  constructor(
    readonly code: ContractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ContractError";
  }
}
