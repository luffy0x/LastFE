import "server-only";

type GitHubConfig = {
  token: string;
  owner: string;
  repo: string;
  apiBaseUrl?: string;
};

export type ServerConfig = {
  github: GitHubConfig;
  githubWebhookSecret: string;
  altchaHmacKey: string;
  altchaMaxNumber?: number;
  rateLimitHmacKey: string;
  sqlitePath: string;
};

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const optionalPositiveSafeInteger = (name: string): number | undefined => {
  const value = process.env[name];
  if (!value) return undefined;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return parsed;
};

const optionalGitHubApiBaseUrl = (): string | undefined => {
  const value = process.env.GITHUB_API_BASE_URL?.trim();
  if (!value) return undefined;
  if (process.env.NODE_ENV === "production") {
    throw new Error("GITHUB_API_BASE_URL is not allowed in production");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("GITHUB_API_BASE_URL must be an absolute URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("GITHUB_API_BASE_URL must use http or https");
  }
  return url.toString().replace(/\/$/, "");
};

export function getInternalAppOrigin(): string {
  const value = required("INTERNAL_APP_ORIGIN");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("INTERNAL_APP_ORIGIN must be an absolute URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("INTERNAL_APP_ORIGIN must use http or https");
  }
  if (
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("INTERNAL_APP_ORIGIN must be an origin");
  }
  return url.origin;
}

export function getSqlitePath(): string {
  return required("SQLITE_PATH");
}

export function getServerConfig(): ServerConfig {
  return {
    github: {
      token: required("GITHUB_TOKEN"),
      owner: required("GITHUB_OWNER"),
      repo: required("GITHUB_REPO"),
      apiBaseUrl: optionalGitHubApiBaseUrl(),
    },
    githubWebhookSecret: required("GITHUB_WEBHOOK_SECRET"),
    altchaHmacKey: required("ALTCHA_HMAC_KEY"),
    altchaMaxNumber: optionalPositiveSafeInteger("ALTCHA_MAX_NUMBER"),
    rateLimitHmacKey: required("RATE_LIMIT_HMAC_KEY"),
    sqlitePath: getSqlitePath(),
  };
}
