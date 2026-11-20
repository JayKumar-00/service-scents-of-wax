export const setIfChanged = <T>(
  dtoValue: T | undefined,
  existingValue: T | null | undefined,
  field: string,
): Partial<Record<string, T | null>> => {
  if (dtoValue !== undefined && dtoValue !== existingValue) {
    return { [field]: dtoValue };
  }
  return {};
};
