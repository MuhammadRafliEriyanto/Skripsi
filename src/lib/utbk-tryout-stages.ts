export const UTBK_MAIN_TRYOUT_STAGE_COUNT = 3;

export const UTBK_TRYOUT_STAGE_META = [
  {
    stage: 1,
    label: "Tryout UTBK 1",
    shortLabel: "Tryout 1",
    description: "Simulasi soal UTBK tahap pertama.",
  },
  {
    stage: 2,
    label: "Tryout UTBK 2",
    shortLabel: "Tryout 2",
    description: "Simulasi soal UTBK tahap kedua.",
  },
  {
    stage: 3,
    label: "Tryout UTBK 3",
    shortLabel: "Tryout 3",
    description: "Simulasi soal UTBK tahap ketiga.",
  },
] as const;

export type UtbkTryoutStage = (typeof UTBK_TRYOUT_STAGE_META)[number]["stage"];

export function normalizeUtbkTryoutStage(
  value: number | string | null | undefined,
): UtbkTryoutStage | null {
  const parsedValue =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);

  if (parsedValue === 1 || parsedValue === 2 || parsedValue === 3) {
    return parsedValue;
  }

  return null;
}

export function getUtbkTryoutStageMeta(
  value: number | string | null | undefined,
) {
  const stage = normalizeUtbkTryoutStage(value);

  return UTBK_TRYOUT_STAGE_META.find((item) => item.stage === stage) ?? null;
}

export function formatUtbkTryoutStageLabel(
  value: number | string | null | undefined,
  fallback = "Tryout UTBK",
) {
  return getUtbkTryoutStageMeta(value)?.label ?? fallback;
}

export function formatUtbkTryoutStageShortLabel(
  value: number | string | null | undefined,
  fallback = "Tryout",
) {
  return getUtbkTryoutStageMeta(value)?.shortLabel ?? fallback;
}
