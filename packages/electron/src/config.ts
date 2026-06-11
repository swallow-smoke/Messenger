export const config = {
  isDev: process.env.NODE_ENV !== 'production',
  apiUrl: process.env.VITE_API_URL ?? 'http://localhost:4000/api/v1',
  devServerUrl: 'http://localhost:5173',
  mainWindowOptions: {
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
  },
  csp: `default-src 'self' http://localhost:4000 ws://localhost:4000 'unsafe-inline' 'unsafe-eval'`,
}
