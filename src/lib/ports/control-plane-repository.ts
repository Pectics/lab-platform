export interface ServerEntity {
  id: string;
  name: string;
  host: string;
  enabled: boolean;
  archivedAt: Date | null;
  generation: number;
}

export interface EndpointEntity {
  id: string;
  serverId: string;
  name: string;
  protocol: "shadowsocks_2022" | "hysteria_2";
  credentialMode: "shared" | "per_subscriber";
  address: string;
  port: number;
  enabled: boolean;
  archivedAt: Date | null;
  generation: number;
}

export interface ProfileEntity {
  id: string;
  name: string;
  enabled: boolean;
  archivedAt: Date | null;
  generation: number;
}

export interface CreateServerInput {
  name: string;
  host: string;
  provider?: string;
  region?: string;
  notes?: string;
}

export interface CreateEndpointInput {
  serverId: string;
  name: string;
  protocol: "shadowsocks_2022" | "hysteria_2";
  credentialMode: "shared" | "per_subscriber";
  address: string;
  port: number;
  publicConfig?: Record<string, unknown>;
  sortOrder?: number;
}

export interface CreateProfileInput {
  name: string;
  description?: string;
}

export interface ControlPlaneRepository {
  createServer(input: CreateServerInput): Promise<ServerEntity>;
  createEndpoint(input: CreateEndpointInput): Promise<EndpointEntity>;
  createProfile(input: CreateProfileInput): Promise<ProfileEntity>;
  attachEndpointToProfile(profileId: string, endpointId: string): Promise<void>;
  archiveServer(serverId: string, archivedAt: Date): Promise<ServerEntity | null>;
  listServers(options?: { includeArchived?: boolean }): Promise<ServerEntity[]>;
}
