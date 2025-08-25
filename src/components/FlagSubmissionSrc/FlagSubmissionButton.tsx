import React from 'react';
import { Button } from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';

interface FlagSubmissionButtonProps {
    instanceId: string;
    sceneInstanceId: string;
    instanceType: 'docker' | 'vm';
    isTarget: boolean;
    onClick: (instanceId: string, sceneInstanceId: string, instanceType: 'docker' | 'vm') => void;
}

const FlagSubmissionButton: React.FC<FlagSubmissionButtonProps> = ({
                                                                       instanceId,
                                                                       sceneInstanceId,
                                                                       instanceType,
                                                                       isTarget,
                                                                       onClick
                                                                   }) => {
    if (!isTarget) {
        return null;
    }

    return (
        <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<FlagIcon />}
            onClick={() => onClick(instanceId, sceneInstanceId, instanceType)}
        >
            提交 Flag
        </Button>
    );
};

export default FlagSubmissionButton;