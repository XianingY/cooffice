import { createServer } from "node:net";

/**
 * Reserve a free loopback port by binding to port 0 and closing again.
 *
 * `listen({ port: 0 })` on the API would work too, but the origin has to be
 * known *before* the app is built (CORS allow-list and cookie scope are baked
 * into the config). The race window is a few microseconds on loopback.
 */
export async function findFreePort(host = "127.0.0.1"): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen({ host, port: 0, exclusive: true }, () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        probe.close(() => reject(new Error("Unable to determine a free loopback port")));
        return;
      }
      const { port } = address;
      probe.close(() => resolve(port));
    });
  });
}
