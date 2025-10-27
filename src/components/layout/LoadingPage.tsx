import { getRandomTip } from "@/utils/loadingMessage";
import { Box, Typography } from "@mui/material";

const LoadingPage: React.FC = () => {
    return (
        <Box className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 p-4">
            <div className="text-center flex flex-col items-center">
                <div className="relative mb-6">
                    <div className="h-12 w-12 rounded-full border-4 border-primary-500 dark:border-primary-400 border-t-transparent animate-spin-slow flex items-center justify-center">
                        <div className="h-6 w-6 rounded-full bg-primary-500 dark:bg-primary-400 animate-pulse"></div>
                    </div>
                </div>
                <div className="space-y-2">
                    <Typography variant="body1" className="font-medium text-neutral-700 dark:text-neutral-200">
                        {getRandomTip()}
                    </Typography>
                </div>
                <div className="mt-8 w-32 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary-500 to-blue-500 animate-progress-bar"></div>
                </div>
            </div>
        </Box>
    );
};

export default LoadingPage;