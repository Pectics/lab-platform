import { z } from "zod";

const identifier = z.string().uuid();
const generation = z.number().int().nonnegative();

export const agentCapabilitySchema = z.enum(["reconcile", "probe"]);

export const agentDesiredStateSchema = z.object({
  serverId: identifier,
  generation,
  etag: z.string().min(1),
  credentials: z.array(
    z.discriminatedUnion("desired", [
      z.object({
        id: identifier,
        endpointId: identifier,
        protocol: z.enum(["shadowsocks_2022", "hysteria_2"]),
        desired: z.literal("present"),
        secret: z.string().min(1),
      }),
      z.object({
        id: identifier,
        endpointId: identifier,
        protocol: z.enum(["shadowsocks_2022", "hysteria_2"]),
        desired: z.literal("absent"),
      }),
    ]),
  ),
});

export const agentHeartbeatSchema = z.object({
  serverId: identifier,
  appliedGeneration: generation,
  capabilities: z
    .array(agentCapabilitySchema)
    .max(2)
    .refine((values) => new Set(values).size === values.length, "Capabilities must be unique"),
  healthy: z.boolean(),
  observedAt: z.string().datetime({ offset: true }),
});

export const agentApplyResultSchema = z.object({
  serverId: identifier,
  generation,
  status: z.enum(["complete", "partial", "failed"]),
  outcomes: z.array(
    z.discriminatedUnion("state", [
      z.object({ credentialId: identifier, state: z.literal("active") }),
      z.object({
        credentialId: identifier,
        state: z.literal("failed"),
        errorCode: z.string().min(1),
      }),
      z.object({ credentialId: identifier, state: z.literal("revoked") }),
    ]),
  ),
});

export const agentProbeTaskSchema = z.object({
  id: identifier,
  endpointId: identifier,
  address: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  deadline: z.string().datetime({ offset: true }),
});
