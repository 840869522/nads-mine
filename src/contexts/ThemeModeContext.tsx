"use client";
import React, { createContext, useState, useMemo, useContext, ReactNode } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider, PaletteMode } from '@mui/material/styles';
import { zhCN } from '@mui/material/locale'; // Import Chinese locale
import { antdColors } from '@/utils/color';

interface ThemeModeContextType {
  mode: PaletteMode;
  toggleThemeMode: () => void;
}

export const ThemeModeContext = createContext<ThemeModeContextType>({
  mode: 'dark', // Default mode
  toggleThemeMode: () => console.warn('toggleThemeMode function not yet initialized'),
});

export const AppThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Read initial theme from localStorage or default to 'dark'
  const getInitialMode = (): PaletteMode => {
    try {
      const storedMode = localStorage.getItem('themeMode') as PaletteMode | null;
      if (storedMode) {
        return storedMode;
      }
      // If no stored mode, check system preference
      // const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      // For this app, we default to dark as per original App.tsx behavior
      return 'dark';
    } catch (error) {
      return 'dark';
    }
  };

  const [mode, setMode] = useState<PaletteMode>(getInitialMode());

  React.useEffect(() => {
    // This effect ensures the <html> tag gets the 'dark' class for any remaining Tailwind dark: styles
    // And for MUI components that might rely on it indirectly or for consistency.
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('themeMode', mode);
    } catch (error) {
      console.warn("Could not save theme mode to localStorage", error);
    }
  }, [mode]);


  const toggleThemeMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          processing: {
            light: antdColors.geekblue[4],
            main: antdColors.geekblue[5],
            dark: antdColors.geekblue[6],
            contrastText: "#FFF"
          },
          magenta: {
            light: antdColors.magenta[4],
            main: antdColors.magenta[5],
            dark: antdColors.magenta[6],
            contrastText: '#fff',
          },
          lime :{
            light: antdColors.lime[4],
            main: antdColors.lime[5],
            dark: antdColors.lime[6],
            contrastText : "#FFF",
          },
          purple: {
            light: antdColors.purple[4],
            main: antdColors.purple[5],
            dark: antdColors.purple[6],
            contrastText: '#fff',
          },
          volcano: {
            main: antdColors.volcano[5],
            light: antdColors.volcano[4],
            dark: antdColors.volcano[6],
            contrastText: "#fff",
          },
          cyan: {
            light: antdColors.cyan[4],
            main: antdColors.cyan[5],
            dark: antdColors.cyan[6],
            contrastText: "#fff",
          },
          primary: {
            main: '#3b82f6', // Tailwind primary-500
            light: '#60a5fa', // Tailwind primary-400
            dark: '#2563eb', // Tailwind primary-600
          },
          ochre: {
            main: '#E3D026',
            light: '#E9DB5D',
            dark: '#A29415',
            contrastText: '#242105',
          },
          secondary: {
            main: '#64748b', // Example: Slate 500
          },
          background: {
            default: mode === 'dark' ? '#0a0a0a' : '#fafafa', // Matching neutral-950 and neutral-50
            paper: mode === 'dark' ? '#262626' : '#ffffff', // Changed from #171717 (neutral-900) to #262626 (neutral-800)
          },
          text: {
            primary: mode === 'dark' ? '#f5f5f5' : '#171717', // neutral-100 and neutral-900
            secondary: mode === 'dark' ? '#a3a3a3' : '#525252', // neutral-400 and neutral-600
          }
        },
        // colorSchemes:{
        //   light:{

        //   },
        //   dark:{

        //   }
        // },
        typography: {
          fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
        },
        components: {
          MuiButtonBase: {
            defaultProps: {
              disableRipple: false, // Keep ripple effect
            }
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none', // Disable MUI's default gradient on Paper in dark mode
              }
            }
          },
          MuiCircularProgress: {
            styleOverrides: {
              root: {
                color: "#1976d2",
                opacity: 1,
              }
            }
          }
        }
      }, zhCN), // Apply Chinese locale
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={{ mode, toggleThemeMode }}>
      <MuiThemeProvider theme={theme}>
        {children}
      </MuiThemeProvider>
    </ThemeModeContext.Provider>
  );
};

export const useThemeMode = () => useContext(ThemeModeContext);
