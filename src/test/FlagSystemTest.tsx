import React, { useState } from 'react';
import { 
    Box, 
    Typography, 
    Button, 
    Paper, 
    TextField,
    Alert,
    Divider,
    CircularProgress
} from '@mui/material';
import { apiClientWithToken } from '../utils/axios';
import { BACK_IP_PORT } from '@/constants.ts';

const FlagSystemTest: React.FC = () => {
    const [testResults, setTestResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // 测试场景实例API
    const testSceneInstances = async () => {
        try {
            const response = await apiClientWithToken.get(`${BACK_IP_PORT}/api/flag/scene-instances`);
            return {
                test: 'Scene Instances API',
                success: response.status === 200 && response.data.code === 200,
                data: response.data,
                error: null
            };
        } catch (error: any) {
            return {
                test: 'Scene Instances API',
                success: false,
                data: null,
                error: error.message || 'Unknown error'
            };
        }
    };

    // 测试靶机实例API（需要有场景ID）
    const testTargetInstances = async (sceneId: string) => {
        try {
            const response = await apiClientWithToken.get(`${BACK_IP_PORT}/api/flag/target-instances?scene_id=${sceneId}`);
            return {
                test: 'Target Instances API',
                success: response.status === 200,
                data: response.data,
                error: null
            };
        } catch (error: any) {
            return {
                test: 'Target Instances API',
                success: false,
                data: null,
                error: error.message || 'Unknown error'
            };
        }
    };

    // 测试Flag提交API
    const testFlagSubmission = async () => {
        try {
            const testFlag = 'flag{12345678-1234-1234-1234-123456789abc}';
            const response = await apiClientWithToken.post(`${BACK_IP_PORT}/api/flag/submit-flag`, {
                c_scene_instances_id: 'test-scene-id',
                instance_id: 'test-instance-id',
                instance_type: 'docker',
                flag: testFlag
            });
            return {
                test: 'Flag Submission API',
                success: response.status === 200,
                data: response.data,
                error: null
            };
        } catch (error: any) {
            return {
                test: 'Flag Submission API',
                success: false,
                data: null,
                error: error.message || 'Unknown error'
            };
        }
    };

    // 测试历史记录API
    const testSubmissionHistory = async () => {
        try {
            const response = await apiClientWithToken.get(`${BACK_IP_PORT}/api/flag/submission-history?scope=mine&target_scope=all_targets_in_all_scenes`);
            return {
                test: 'Submission History API',
                success: response.status === 200,
                data: response.data,
                error: null
            };
        } catch (error: any) {
            return {
                test: 'Submission History API',
                success: false,
                data: null,
                error: error.message || 'Unknown error'
            };
        }
    };

    // 运行所有测试
    const runAllTests = async () => {
        setIsLoading(true);
        const results: any[] = [];

        // 测试场景实例API
        const sceneTest = await testSceneInstances();
        results.push(sceneTest);

        // 如果场景实例API成功且有数据，测试靶机实例API
        if (sceneTest.success && sceneTest.data?.data?.length > 0) {
            const firstSceneId = sceneTest.data.data[0].c_scene_instances_id;
            const targetTest = await testTargetInstances(firstSceneId);
            results.push(targetTest);
        }

        // 测试Flag提交API（这个可能会失败因为是测试数据）
        const flagTest = await testFlagSubmission();
        results.push(flagTest);

        // 测试历史记录API
        const historyTest = await testSubmissionHistory();
        results.push(historyTest);

        setTestResults(results);
        setIsLoading(false);
    };

    return (
        <Box sx={{ p: 3, maxWidth: 1200, margin: 'auto' }}>
            <Typography variant="h4" component="h1" gutterBottom>
                Flag 系统测试
            </Typography>
            
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    系统测试面板
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                    这个页面可以帮助你测试Flag系统的各个API端点是否正常工作。
                </Typography>
                
                <Button 
                    variant="contained" 
                    onClick={runAllTests}
                    disabled={isLoading}
                    startIcon={isLoading ? <CircularProgress size={20} /> : null}
                >
                    {isLoading ? '测试中...' : '运行所有测试'}
                </Button>
            </Paper>

            {testResults.length > 0 && (
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        测试结果
                    </Typography>
                    
                    {testResults.map((result, index) => (
                        <Box key={index} sx={{ mb: 3 }}>
                            <Alert 
                                severity={result.success ? 'success' : 'error'}
                                sx={{ mb: 2 }}
                            >
                                <Typography variant="subtitle1">
                                    {result.test}
                                </Typography>
                                {result.success ? (
                                    <Typography variant="body2">
                                        ✅ 测试通过
                                    </Typography>
                                ) : (
                                    <Typography variant="body2">
                                        ❌ 测试失败: {result.error}
                                    </Typography>
                                )}
                            </Alert>
                            
                            {result.data && (
                                <Box sx={{ ml: 2 }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        响应数据:
                                    </Typography>
                                    <TextField
                                        multiline
                                        rows={8}
                                        fullWidth
                                        value={JSON.stringify(result.data, null, 2)}
                                        variant="outlined"
                                        size="small"
                                        InputProps={{
                                            readOnly: true,
                                            style: { fontSize: '12px', fontFamily: 'monospace' }
                                        }}
                                    />
                                </Box>
                            )}
                            
                            {index < testResults.length - 1 && <Divider sx={{ mt: 2 }} />}
                        </Box>
                    ))}
                </Paper>
            )}

            <Paper sx={{ p: 3, mt: 3, bgcolor: 'grey.50' }}>
                <Typography variant="h6" gutterBottom>
                    使用说明
                </Typography>
                <Typography variant="body2" paragraph>
                    1. 确保你已经登录并获得了有效的JWT token
                </Typography>
                <Typography variant="body2" paragraph>
                    2. 确保后端服务正在运行并且数据库中有相关测试数据
                </Typography>
                <Typography variant="body2" paragraph>
                    3. Flag提交测试使用的是虚假数据，所以很可能会失败，这是正常的
                </Typography>
                <Typography variant="body2" paragraph>
                    4. 如果所有API都返回401错误，请检查JWT认证配置
                </Typography>
            </Paper>
        </Box>
    );
};

export default FlagSystemTest;
