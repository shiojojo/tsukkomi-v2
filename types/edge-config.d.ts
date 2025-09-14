declare module '@vercel/edge-config' {
  export function get(key: string): Promise<any>;
}
