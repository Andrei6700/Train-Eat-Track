import { formatDuration } from "@/src/utils/utils";

describe("formatDuration", () => {
  describe("seconds only (< 60)", () => {
    it("should format 0 seconds", () => {
      expect(formatDuration(0)).toBe("0 sec");
    });

    it("should format 1 second", () => {
      expect(formatDuration(1)).toBe("1 sec");
    });

    it("should format 59 seconds", () => {
      expect(formatDuration(59)).toBe("59 sec");
    });
  });

  describe("minutes only", () => {
    it("should format exactly 1 minute", () => {
      expect(formatDuration(60)).toBe("1 m");
    });

    it("should format exactly 5 minutes", () => {
      expect(formatDuration(300)).toBe("5 m");
    });
  });

  describe("minutes and seconds", () => {
    it("should format 1 minute 30 seconds", () => {
      expect(formatDuration(90)).toBe("1 m 30 s");
    });

    it("should format 59 minutes 59 seconds", () => {
      expect(formatDuration(3599)).toBe("59 m 59 s");
    });
  });

  describe("hours only", () => {
    it("should format exactly 1 hour", () => {
      expect(formatDuration(3600)).toBe("1 h");
    });
  });

  describe("hours and minutes", () => {
    it("should format 1 hour 30 minutes", () => {
      expect(formatDuration(5400)).toBe("1 h 30 m");
    });
  });

  describe("hours, minutes, and seconds", () => {
    it("should format 1 hour 1 minute 1 second", () => {
      expect(formatDuration(3661)).toBe("1 h 1 m 1 s");
    });

    it("should format 1 hour 0 minutes 30 seconds", () => {
      expect(formatDuration(3630)).toBe("1 h 0 m 30 s");
    });
  });
});
