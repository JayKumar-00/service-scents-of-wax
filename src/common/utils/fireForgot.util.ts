export const fireAndForget = async (
  promise: Promise<any>,
  context?: string,
) => {
  try {
    await promise;
  } catch (err) {
    console.error(`[FireAndForget Error] ${context ?? ''}`, err);

    // Optional (recommended):
    // send to logger / queue / retry system
  }
};
