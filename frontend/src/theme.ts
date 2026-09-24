import { createTheme } from "@mui/material/styles";

export const FONT_STACK =
  "'Sora Variable', 'Sora', system-ui, -apple-system, 'Segoe UI', sans-serif";

/**
 * Tema MUI (dark). Dipakai untuk SwipeableDrawer, Snackbar/Alert,
 * dan indikator loading. Sengaja tanpa CssBaseline supaya tidak
 * bentrok dengan preflight Tailwind.
 */
export const muiTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#ffffff" },
    success: { main: "#34d399" },
    error: { main: "#f87171" },
    warning: { main: "#fbbf24" },
    info: { main: "#cbd5e1" },
    background: { default: "#020617", paper: "#020617" },
  },
  shape: { borderRadius: 20 },
  typography: { fontFamily: FONT_STACK },
});
