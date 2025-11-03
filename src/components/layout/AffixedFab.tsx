"use client";
import { Fab, FabProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import AiIcon from '../icon/AiAnswer';


interface StyledFabProps extends FabProps { affixed?: boolean }

// 正确使用 MUI styled 的 shouldForwardProp 参数，避免将自定义 prop 透传到原生 DOM
const StyledFab = styled(Fab, {
    shouldForwardProp: (prop) => prop !== 'affixed',
})<StyledFabProps>(({ theme, affixed }) => ({
    position: affixed ? 'fixed' : 'absolute',
    bottom: affixed ? 50 : 'auto',
    right: 50,
    zIndex: 1000,
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': { backgroundColor: theme.palette.primary.dark },
}));

interface AffixedFabWrapperProps {
    
}
const AffixedFabWrapper:React.FC<AffixedFabWrapperProps> = () => {
    return (
        <StyledFab
            affixed={false}
        >
            <AiIcon sx={{ color: 'primary.contrastText' }}/>
        </StyledFab>
    )
}

export {
    AffixedFabWrapper,
    StyledFab
};
