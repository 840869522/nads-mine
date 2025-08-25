import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FlagSubmissionForm from './FlagSubmissionForm';
import SubmissionHistory from './SubmissionHistory';

interface FlagSubmissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    instanceId: string | null;
    sceneInstanceId: string | null;
    instanceType: 'docker' | 'vm' | null;
}

const FlagSubmissionModal: React.FC<FlagSubmissionModalProps> = ({
                                                                     isOpen,
                                                                     onClose,
                                                                     instanceId,
                                                                     sceneInstanceId,
                                                                     instanceType,
                                                                 }) => {
    if (!instanceId || !sceneInstanceId || !instanceType) {
        return null;
    }

    return (
        <Dialog open={isOpen} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                提交 Flag ({instanceType === 'docker' ? '容器' : '虚拟机'}: {instanceId})
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        color: (theme) => theme.palette.grey[500],
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <FlagSubmissionForm
                    instanceId={instanceId}
                    sceneInstanceId={sceneInstanceId}
                    instanceType={instanceType}
                />
                <SubmissionHistory
                    instanceId={instanceId}
                    sceneInstanceId={sceneInstanceId}
                    instanceType={instanceType}
                />
            </DialogContent>
        </Dialog>
    );
};

export default FlagSubmissionModal;