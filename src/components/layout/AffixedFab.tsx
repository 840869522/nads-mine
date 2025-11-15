"use client";
import { Fab, FabProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import AiIcon from '../icon/AiAnswer';


interface StyledFabProps extends FabProps { affixed?: boolean }

const StyledFab = styled(Fab, {
    shouldForwardProp: (prop) => prop !== 'affixed',
})<StyledFabProps>(({ theme, affixed }) => ({
    position: affixed ? 'fixed' : 'absolute',
    zIndex: 1000,
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': { backgroundColor: theme.palette.primary.dark },
}));

interface AffixedFabWrapperProps {
    onClick: ()=> void
}
const AffixedFabWrapper:React.FC<AffixedFabWrapperProps> = ({onClick}) => {
    return (
        <StyledFab
            affixed={false}
            onClick={onClick}
        >
            <AiIcon sx={{ color: 'primary.contrastText' }}/>
        </StyledFab>
    )
}

export {
    AffixedFabWrapper,
    StyledFab
};
