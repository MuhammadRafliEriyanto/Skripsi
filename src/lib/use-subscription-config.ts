"use client";

import { useEffect, useState } from "react";

import {
  emptySubscriptionConfig,
  membershipService,
  type SubscriptionConfigData,
} from "@/lib/subscription";

export function useSubscriptionConfig() {
  const [config, setConfig] = useState<SubscriptionConfigData>(
    emptySubscriptionConfig,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadConfig() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await membershipService.getSubscriptionConfig();

        if (!isMounted) {
          return;
        }

        setConfig(response.data ?? emptySubscriptionConfig);
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        setConfig(emptySubscriptionConfig);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Konfigurasi membership belum bisa dimuat.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  return { config, isLoading, error };
}
