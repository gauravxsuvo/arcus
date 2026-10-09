import { Pool, neonConfig } from "@neondatabase/serverless";

let configuredToken;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required to connect to Portways PostgreSQL.`);
  return value;
}

function configurePortwaysWebSocket(token) {
  if (configuredToken && configuredToken !== token) {
    throw new Error("The Portways database token changed after the PostgreSQL pool was initialized.");
  }

  if (configuredToken) return;

  neonConfig.wsProxy = () => "db.portways.app/v1";
  neonConfig.useSecureWebSocket = true;
  neonConfig.pipelineConnect = false; // the gateway's databases use SCRAM
  
  // The token rides in the WebSocket subprotocol, never in the URL.
  neonConfig.webSocketConstructor = class extends WebSocket {
    constructor(url) {
      super(url, ["portways-token." + token]);
    }
  };
  configuredToken = token;
}

export function createPortwaysPool({ max = 3 } = {}) {
  const token = requiredEnv("PORTWAYS_DB_TOKEN");
  const password = requiredEnv("PGPASSWORD");

  configurePortwaysWebSocket(token);

  const connectionString = "postgresql://remote_6:" + encodeURIComponent(password) + "@portways/arcus_postgres";

  return new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 5 * 60 * 1000,
    maxLifetimeSeconds: 60 * 60,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
    idle_in_transaction_session_timeout: 60_000,
    keepAlive: true,
  });
}
