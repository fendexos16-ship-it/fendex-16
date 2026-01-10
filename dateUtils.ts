
/**
 * FENDEX LOGISTICS OS - DATE ENFORCEMENT UTILITY
 * Strictly uses Asia/Kolkata (IST) for all operational locks.
 */

export const getTodayIST = (): string => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // Offset in milliseconds
  const istTime = new Date(now.getTime() + istOffset);
  return istTime.toISOString().split('T')[0]; // Returns YYYY-MM-DD
};

export const getTimestampIST = (): string => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset).toISOString();
};
