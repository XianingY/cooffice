/** Server-owned domain contracts mirroring the web core wire format. */
export type Role = "user" | "admin";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  createdAt: string;
}

export interface SalesRegion {
  id: string;
  name: string;
  previous: number;
  current: number;
  previousCell: string;
  currentCell: string;
}

export interface SalesData {
  regions: SalesRegion[];
}

export interface ReportConfig {
  blocks: ("summary" | "growthNarrative" | "leaderNarrative")[];
}

export interface ProjectRecord {
  id: string;
  ownerId: string;
  name: string;
  baseline: SalesData;
  draft: SalesData;
  config: ReportConfig;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
  };
}
