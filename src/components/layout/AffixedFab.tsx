"use client";
import { Fab, FabProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import AiIcon from '../icon/AiAnswer';


interface StyledFabProps extends FabProps {
    affixed?: boolean
}

const StyledFab = styled<React.FC<StyledFabProps>>(
    (props) => <Fab {...props} />
)(({ theme, affixed }) => ({
    position: affixed ? 'fixed' : 'absolute',
    bottom: affixed ? 50 : 'auto',
    right: 50,
    zIndex: 1000,
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
        backgroundColor: theme.palette.primary.dark,
    },
}), {
    shouldForwardProp: (prop: string) => prop !== 'affixed',
});

interface AffixedFabWrapperProps {
    onClick: ()=>void
}
const AffixedFabWrapper:React.FC<AffixedFabWrapperProps> = ({onClick}) => {
    return (
        <StyledFab
            affixed={true}
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