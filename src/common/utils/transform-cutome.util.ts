export const toArray = (value: any) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',').map((v) => v.trim());
  }
  return [];
};

export const toObject = (value: any) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
};

export const toBoolean = (value: any) => {
  if (value === undefined || value === null) return undefined;

  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }

  return undefined;
};
