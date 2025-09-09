export const theme = {
  colors: {
    primary: '#1565C0',
    primaryDark: '#0D47A1',
    success: '#2E7D32',
    warning: '#F9A825',
    background: '#F5F7FA',
    surface: '#FFFFFF',
    border: '#E6EEF8',
    text: '#1F2937',
    muted: '#6B7280',
    disabled: '#B0BEC5'
  },
  spacing: (n: number) => 8 * n,
  radii: { sm: 6, md: 10, lg: 14 },
  typography: { h1: 22, h2: 18, h3: 16, body: 14, caption: 12 }
};
export type Theme = typeof theme;
export default theme;
