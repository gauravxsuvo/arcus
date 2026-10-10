export type AdminIdentity = { id: string; email: string };

export type AdminUserRow = {
  id: string;
  username: string;
  name: string;
  email: string;
  createdAt: string;
  workoutCount: number;
  isBanned: boolean;
  isSuspended: boolean;
  suspendedUntil: string | null;
  role: "OWNER" | "MODERATOR" | "USER";
};

export type AdminExerciseRow = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  source: "built-in" | "custom";
  ownerUsername: string | null;
  ownerAccountId: string | null;
  libraryId: string | null;
};

export type AdminActivityRow = {
  id: string;
  action: string;
  targetType: "user" | "exercise";
  targetId: string;
  actorUsername: string;
  actorEmail: string;
  createdAt: string;
};

export type AdminPulseItem = {
  id: string;
  kind: "signup" | "workout" | "admin";
  username: string;
  summary: string;
  createdAt: string;
};

export type FeatureFlagKey = "social_feed" | "pro_tier" | "maintenance_mode";
export type AdminFeatureFlags = Record<FeatureFlagKey, boolean>;
export type AdminFeatureFlagState = { flags: AdminFeatureFlags; configured: boolean };
export type AdminAccessRow = { accountId: string; username: string; email: string; role: "MODERATOR"; grantedBy: string; grantedAt: string };
export type AdminAccessState = { admins: AdminAccessRow[]; configured: boolean };

export type AdminTablePage<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
};

export type AdminOverview = {
  totalUsers: number;
  workoutsToday: number;
  totalExercises: number;
  signupsThisWeek: number;
  growth: Array<{ date: string; users: number }>;
  asOf: string;
  builtInExercises: number;
  customExercises: number;
};
