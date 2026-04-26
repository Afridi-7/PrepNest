import { describe, it, expect } from "vitest";
import {
  PASSWORD_REQUIREMENTS,
  getPasswordRequirementStates,
  getPasswordValidationErrors,
  isStrongPassword,
  getPasswordStrength,
} from "@/lib/password";

describe("PASSWORD_REQUIREMENTS", () => {
  it("exposes the five required rules", () => {
    expect(PASSWORD_REQUIREMENTS).toHaveLength(5);
    expect(PASSWORD_REQUIREMENTS.map((r) => r.id)).toEqual([
      "length",
      "uppercase",
      "lowercase",
      "number",
      "special",
    ]);
  });
});

describe("getPasswordRequirementStates", () => {
  it("flags every rule as unmet for an empty password", () => {
    const states = getPasswordRequirementStates("");
    expect(states.every((s) => s.met === false)).toBe(true);
  });

  it("flags every rule as met for a fully valid password", () => {
    const states = getPasswordRequirementStates("Abcdefghi1!");
    expect(states.every((s) => s.met === true)).toBe(true);
  });

  it("detects which individual rules pass", () => {
    const states = getPasswordRequirementStates("abcdefghij");
    const byId = Object.fromEntries(states.map((s) => [s.id, s.met]));
    expect(byId["length"]).toBe(true); // 10 chars
    expect(byId.lowercase).toBe(true);
    expect(byId.uppercase).toBe(false);
    expect(byId.number).toBe(false);
    expect(byId.special).toBe(false);
  });
});

describe("getPasswordValidationErrors", () => {
  it("returns labels of all unmet requirements", () => {
    const errors = getPasswordValidationErrors("abc");
    expect(errors).toContain("At least 10 characters");
    expect(errors).toContain("One uppercase letter");
    expect(errors).toContain("One number");
    expect(errors).toContain("One special character");
  });

  it("returns an empty array for a strong password", () => {
    expect(getPasswordValidationErrors("Strong#Pass1")).toEqual([]);
  });
});

describe("isStrongPassword", () => {
  it.each([
    ["short", false],
    ["alllowercase1!", false], // missing uppercase
    ["ALLUPPERCASE1!", false], // missing lowercase
    ["NoNumberHere!", false],
    ["NoSpecial1Char", false],
    ["Abcdefghi1!", true],
    ["Sup3rSecret#Pwd", true],
  ])("returns %s -> %s", (pwd, expected) => {
    expect(isStrongPassword(pwd)).toBe(expected);
  });
});

describe("getPasswordStrength", () => {
  it("returns score 0 + 'Enter a password' for empty input", () => {
    const result = getPasswordStrength("");
    expect(result.score).toBe(0);
    expect(result.label).toBe("Enter a password");
  });

  it("returns Weak (score 1) when 1-2 rules pass", () => {
    const result = getPasswordStrength("abc");
    expect(result.score).toBe(1);
    expect(result.label).toBe("Weak");
  });

  it("returns Medium (score 2) when 3-4 rules pass", () => {
    // length + lowercase + uppercase + number = 4 met, no special
    const result = getPasswordStrength("Abcdefghi1");
    expect(result.score).toBe(2);
    expect(result.label).toBe("Medium");
  });

  it("returns Strong (score 3) when all rules pass", () => {
    const result = getPasswordStrength("Abcdefghi1!");
    expect(result.score).toBe(3);
    expect(result.label).toBe("Strong");
    expect(result.tone).toContain("emerald");
  });
});
