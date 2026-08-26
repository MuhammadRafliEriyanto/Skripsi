import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import backendApp from "../../backend/src/app";

type LocalBackendServer = {
  baseUrl: string;
  server: Server;
};

let serverPromise: Promise<LocalBackendServer> | null = null;

function startLocalBackendServer() {
  const server = createServer(backendApp);

  return new Promise<LocalBackendServer>((resolve, reject) => {
    const handleError = (error: Error) => {
      server.close();
      reject(error);
    };

    server.once("error", handleError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", handleError);

      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Gagal membuka port lokal untuk backend."));
        return;
      }

      resolve({
        baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
        server,
      });
    });
  }).catch((error) => {
    serverPromise = null;
    throw error;
  });
}

export async function getLocalBackendBaseUrl() {
  serverPromise ??= startLocalBackendServer();

  const { baseUrl } = await serverPromise;

  return baseUrl;
}
