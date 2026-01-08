import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    List,
    ListItem,
    Typography,
    useMediaQuery,
    useTheme,
} from "@mui/material"
import { QuestionDisplayItem } from "./QuestionModalForm"
import { String2Array } from "@/utils/string";
import { ColorMap } from "@/utils/color";

type ViewQestionModalProps = {
    open: boolean,
    onCancle: () => void,
    initialData: QuestionDisplayItem
}

const typeOptions = {
    1: '单选题',
    2: '多选题',
    3: '判断题',
    4: '主观题',
};

const ViewQuestionModal: React.FC<ViewQestionModalProps> = ({
    open,
    onCancle,
    initialData
}) => {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

    return (
        <Dialog
            open={open}
            onClose={onCancle}
            fullWidth
            maxWidth="md"
            fullScreen={fullScreen}
            PaperProps={{ sx: { borderRadius: 2 } }}
        >
            <DialogTitle>
                试题详细
            </DialogTitle>
            <DialogContent>
                <Typography variant="h6">
                    题干信息： {initialData.c_question}
                </Typography>
                <Box sx={{ mt: 2 }}>
                    <Typography sx={{ fontWeight: 'bold' }}>标签:</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                        {String2Array(initialData.c_tag).map((role, index) => (
                            <Chip
                                key={role}
                                label={role}
                                size="small"
                                color={ColorMap[index % ColorMap.length]}
                                sx={{ m: 0.5 }}
                            />
                        ))}
                    </Box>
                </Box>
                <Typography sx={{fontWeight:"bold"}}>
                    课程ID ： {initialData.c_course_id}
                </Typography>
                <Typography sx={{fontWeight:"bold"}}>
                    类型： {typeOptions[initialData.c_type]}
                </Typography>
                <Box sx={{ mt: 2 }}>
                    <Typography sx={{fontWeight:"bold"}}>选项信息：</Typography>
                    {
                        initialData.c_type == 3 || initialData.c_type === 4 ? (<Typography sx={{pl:10}}>没有相关选项信息</Typography>) : (
                            <List>
                                {initialData.connect.length > 0 && initialData.connect.map((option, index) => (
                                    <ListItem key={index} sx={{ pl: 10 }}>
                                        <Typography>
                                            {option.c_id}:  {option.c_content}
                                        </Typography>
                                    </ListItem>
                                ))}
                            </List>
                        )
                    }
                </Box>
               <Typography sx={{fontWeight:"bold"}}>
    答案：
                    {
                        initialData.c_type == 4 ? 
                            (initialData.c_answer === "*" || !initialData.c_answer || initialData.c_answer.trim() === "" ? 
                                "（简答题答案需要人工批阅）" : 
                                initialData.c_answer
                            ) : 
                            initialData.c_answer
                    }
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancle} color="secondary">
                    关闭
                </Button>
            </DialogActions>
        </Dialog>
    )
};
export default ViewQuestionModal;