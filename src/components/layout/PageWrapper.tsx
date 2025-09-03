import React, { ReactNode } from 'react';
import Box from '@mui/material/Box';

interface PageWrapperProps {
  children: ReactNode;
}

const PageWrapper: React.FC<PageWrapperProps> = ({ children }) => {
  return (
    <Box
      sx={{
        flexGrow: 1,
        p: { xs: 2, sm: 3, lg: 4 }, // Responsive padding
        overflowY: 'auto', // Enable scrolling for page content
        // height: '100%', // Ensure it can grow within its flex container in App.tsx
        // The parent Box in App.tsx has height: 100vh and overflow:hidden,
        // so PageWrapper taking flexGrow:1 and overflowY: 'auto' is correct for scrolling content.
      }}
    >
      {children}
    </Box>
  );
};

export default PageWrapper;