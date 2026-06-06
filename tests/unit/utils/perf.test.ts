import { measureAsync } from "@/src/utils/perf";

describe("measureAsync", () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it("should return the result of the operation on success", async () => {
    const operation = jest.fn().mockResolvedValue("success-value");
    const result = await measureAsync("test-metric", operation);

    expect(result).toBe("success-value");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should log the metric, latency, and success status on success when __DEV__ is true", async () => {
    const operation = jest.fn().mockResolvedValue("data");
    await measureAsync("test-metric", operation, { extra: "info" });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "test-metric",
      expect.objectContaining({
        extra: "info",
        success: true,
        latencyMs: expect.any(Number),
      })
    );
  });

  it("should resolve the metadata function with the result when meta is a function", async () => {
    const operation = jest.fn().mockResolvedValue("result-val");
    const metaBuilder = jest.fn().mockReturnValue({ success: true, count: 5 });

    await measureAsync("test-metric", operation, metaBuilder);

    expect(metaBuilder).toHaveBeenCalledWith("result-val");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "test-metric",
      expect.objectContaining({
        success: true,
        count: 5,
        latencyMs: expect.any(Number),
      })
    );
  });

  it("should log the failure and throw the error when the operation fails", async () => {
    const error = new Error("operation-failed");
    const operation = jest.fn().mockRejectedValue(error);

    await expect(measureAsync("test-metric", operation, { extra: "fail-info" })).rejects.toThrow("operation-failed");

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "test-metric",
      expect.objectContaining({
        extra: "fail-info",
        success: false,
        error: "operation-failed",
        latencyMs: expect.any(Number),
      })
    );
  });

  it("should handle non-Error throw objects properly in error logs", async () => {
    const operation = jest.fn().mockRejectedValue("string-error");

    await expect(measureAsync("test-metric", operation)).rejects.toBe("string-error");

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "test-metric",
      expect.objectContaining({
        success: false,
        error: "string-error",
      })
    );
  });

  it("should log unknown_error for random thrown objects", async () => {
    const operation = jest.fn().mockRejectedValue({});

    await expect(measureAsync("test-metric", operation)).rejects.toEqual({});

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "test-metric",
      expect.objectContaining({
        success: false,
        error: "unknown_error",
      })
    );
  });
});
