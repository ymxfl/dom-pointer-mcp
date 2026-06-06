function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function formatTimezoneOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${pad(hours)}:${pad(minutes)}`;
}

export function formatLocalTimestamp(date: Date | number): string {
  const value = typeof date === 'number' ? new Date(date) : date;
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
    + `T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
    + `.${pad(value.getMilliseconds(), 3)}${formatTimezoneOffset(value)}`;
}
