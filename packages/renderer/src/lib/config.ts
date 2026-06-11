export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1',
  wsUrl: import.meta.env.VITE_WS_URL ?? 'http://localhost:4000',
  isDev: import.meta.env.DEV,
}
