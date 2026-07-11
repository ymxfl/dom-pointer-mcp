export default function parsePort(value: string | number): number {
  const port = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}. Expected an integer between 1 and 65535.`);
  }
  return port;
}
