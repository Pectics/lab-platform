import { z } from "zod";

const identifier = z.string().uuid();
const endpointBase = {
  id: identifier,
  serverId: identifier,
  name: z.string().min(1),
  address: z.string().min(1),
  port: z.number().int().min(1).max(65535),
};

export const canonicalEndpointSchema = z.discriminatedUnion("protocol", [
  z.object({
    ...endpointBase,
    protocol: z.literal("shadowsocks_2022"),
    credential: z.object({
      method: z.string().min(1),
      password: z.string().min(1),
    }),
  }),
  z.object({
    ...endpointBase,
    protocol: z.literal("hysteria_2"),
    credential: z.object({ auth: z.string().min(1) }),
    tls: z.object({
      serverName: z.string().min(1),
      insecure: z.boolean().default(false),
    }),
  }),
]);

export const canonicalChainSchema = z.object({
  id: identifier,
  name: z.string().min(1),
  hops: z.array(canonicalEndpointSchema).min(2),
});

export const canonicalSubscriptionProjectionSchema = z.object({
  subjectId: identifier,
  target: z.enum(["mihomo", "sing-box", "v2rayn"]),
  endpoints: z.array(canonicalEndpointSchema),
  chains: z.array(canonicalChainSchema),
  generatedAt: z.string().datetime({ offset: true }),
});

export type CanonicalEndpoint = z.infer<typeof canonicalEndpointSchema>;
export type CanonicalSubscriptionProjection = z.infer<
  typeof canonicalSubscriptionProjectionSchema
>;
