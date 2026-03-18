type PerfMeta = Record<string, unknown>;

type PerfMetaBuilder<T> = PerfMeta | ((result: T) => PerfMeta);

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "unknown_error";
};

export const measureAsync = async <T>(
  metricName: string,
  operation: () => Promise<T>,
  meta?: PerfMetaBuilder<T>,
): Promise<T> => {
  const startedAt = Date.now();

  try {
    const result = await operation();

    if (__DEV__) {
      const resolvedMeta =
        typeof meta === "function" ? meta(result) : (meta ?? {});
      const operationSuccess =
        typeof resolvedMeta.success === "boolean" ? resolvedMeta.success : true;
      console.log(metricName, {
        ...resolvedMeta,
        latencyMs: Date.now() - startedAt,
        success: operationSuccess,
      });
    }

    return result;
  } catch (error) {
    if (__DEV__) {
      console.log(metricName, {
        ...(typeof meta === "function" ? {} : (meta ?? {})),
        latencyMs: Date.now() - startedAt,
        success: false,
        error: toErrorMessage(error),
      });
    }

    throw error;
  }
};
