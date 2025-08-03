import { Button, Drawer, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useState } from "react";

interface QuizDrawerProps {
    initialData: ({}) | null;
    onClose: () => void,
    open: boolean;
}

const QuizDrawer: React.FC<QuizDrawerProps> = ({
    open,
    onClose,
    initialData
}) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
    
    return (
        <Drawer
            open={open}
            onClose={onClose}
            anchor="right"
            PaperProps={{
                sx: {
                    width: "70vw"
                }
            }}
        >
            <Typography>
                父抽屉
            </Typography>
            <Button
                onClick={() => setDrawerOpen(true)}
            >
                打开
            </Button>
            <Drawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                anchor="right"
                PaperProps={{
                    sx: {
                        width:"40vw"
                    }
                }}
            >
                子抽屉
            </Drawer>
        </Drawer>
    )
};

export default QuizDrawer;