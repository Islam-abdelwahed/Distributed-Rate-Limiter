import * as grpc from "@grpc/grpc-js";

const { HealthImplementation } = require("grpc-health-check");

const SERVICE_NAME = "ratelimiter.RateLimiterService";

const SERVING = "SERVING";
const NOT_SERVING = "NOT_SERVING";

export function registerHealthService(
  server: grpc.Server,
  isReady: () => Promise<boolean>,
): void {
  const statusMap = {
    "": SERVING, // overall server status
    [SERVICE_NAME]: SERVING,
  };

  const health = new HealthImplementation(statusMap);
  health.addToServer(server);

  setInterval(async ()=>{
    const ready = await isReady();
    const status = ready? SERVING: NOT_SERVING;
    health.setStatus(SERVICE_NAME,status);
    health.setStatus('', status);
  },5000).unref()
}
