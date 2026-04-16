export const PASSWORD_REQUIREMENTS = [
  { id: "length", label: "At least 10 characters", test: (value: string) => value.length >= 10 },
  { id: "uppercase", label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { id: "lowercase", label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { id: "number", label: "One number", test: (value: string) => /\d/.test(value) },
  { id: "special", label: "One special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
] as const;

export const getPasswordRequirementStates = (value: string) =>
  PASSWORD_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    met: requirement.test(value),
  }));

export const getPasswordValidationErrors = (value: string): string[] =>
  getPasswordRequirementStates(value)
    .filter((requirement) => !requirement.met)
    .map((requirement) => requirement.label);

export const isStrongPassword = (value: string): boolean =>
  getPasswordValidationErrors(value).length === 0;

export const getPasswordStrength = (value: string): {
  score: number;
  label: string;
  tone: string;
} => {
  const metCount = getPasswordRequirementStates(value).filter((item) => item.met).length;
  if (!value) {
    return { score: 0, label: "Enter a password", tone: "bg-slate-200 dark:bg-slate-700" };
  }
  if (metCount <= 2) {
    return { score: 1, label: "Weak", tone: "bg-rose-500" };
  }
  if (metCount <= 4) {
    return { score: 2, label: "Medium", tone: "bg-amber-500" };
  }
  return { score: 3, label: "Strong", tone: "bg-emerald-500" };
};
