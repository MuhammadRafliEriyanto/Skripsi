import { type ReadonlyURLSearchParams } from "next/navigation";

const GURU_CONTEXT_QUERY_KEYS = ["academicYear", "semester"] as const;

type GuruSearchParams = ReadonlyURLSearchParams | URLSearchParams | null | undefined;

function appendGuruContextParams(
  params: URLSearchParams,
  searchParams: GuruSearchParams,
) {
  if (!searchParams) {
    return;
  }

  GURU_CONTEXT_QUERY_KEYS.forEach((key) => {
    const value = searchParams.get(key)?.trim();

    if (value) {
      params.set(key, value);
    }
  });
}

export function buildGuruUrl(
  path: string,
  searchParams: GuruSearchParams,
  additionalParams?: Record<string, string>,
) {
  const [basePath, existingQuery] = path.split("?");
  const params = new URLSearchParams(existingQuery || "");

  appendGuruContextParams(params, searchParams);

  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      params.set(key, value);
    });
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function buildGuruApiUrl(
  baseApiUrl: string,
  searchParams: GuruSearchParams,
) {
  return buildGuruUrl(baseApiUrl, searchParams);
}
