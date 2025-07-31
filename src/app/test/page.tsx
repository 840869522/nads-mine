"use client";

import { Paper, Button } from "@mui/material"
import QuizDrawer from "@/components/learning/QuizDrawer"
import { useState } from "react"

const TestPage: React.FC = ()=>{
    const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
    return (
        <Paper>
            <Button
                onClick={()=>setDrawerOpen(true)}
            >
                open
            </Button>
            <QuizDrawer 
                open={drawerOpen}
                onClose={()=>setDrawerOpen(false)}
                initialData={null}
            />
        </Paper>
    )
};

export default TestPage;