import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Card from '../components/ui/Card'; // Assuming Card is still Tailwind based
import { useAuth } from '../hooks/useAuth';
import { AcademicCapIcon, AdjustmentsHorizontalIcon, ShieldCheckIcon, ServerStackIcon // <-- 新增这个图标
} from '@heroicons/react/24/outline';
import MuiLink from '@mui/material/Link'; // MUI Link
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';


const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  const features = [
    {
      name: "人员测试分系统",
      description: "进行互动测验，获取AI反馈，并管理相关题库。",
      path: '/learn/quiz',
      icon: AcademicCapIcon,
      color: 'text-blue-500' // Tailwind color for HeroIcon
    },
    {
      name: "环境构建分系统",
      description: "配置网络拓扑，管理无人机节点和虚拟容器等基础设施。",
      path: '/scenario/envirments',
      icon: AdjustmentsHorizontalIcon,
      color: 'text-green-500' // Tailwind color for HeroIcon
    },
    {
      name: "安全使用分系统",
      description: "模拟网络攻防场景，进行红蓝对抗演练，检验安全防护能力。",
      path: '/drill',
      icon: ShieldCheckIcon,
      color: 'text-red-500' // Tailwind color for HeroIcon
    },
    // --- ↓↓↓ 在这里新增“基础支撑分系统” ↓↓↓ ---
    {
      name: "基础支撑分系统",
      description: "管理用户角色、权限分配、系统级镜像和全局配置。",
      path: '/admin/users', // 链接到人员管理下的成员管理页面
      icon: ServerStackIcon,
      color: 'text-yellow-500'
    },
    // --- ↑↑↑ 新增结束 ↑↑↑ ---
  ];

  return (
    <Box>
      <Box
        className="mb-8 p-6 bg-gradient-to-r from-primary-600 to-blue-500 dark:from-primary-700 dark:to-blue-600 rounded-lg shadow-xl text-white"
        // sx={{ mb: 4, p: 3, borderRadius: 2, color: 'common.white', bgcolor: 'primary.main', /* Can't do gradient with sx easily */ }}
      >
        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>{`欢迎来到无人机网络安全实验平台, ${user?.username || ''}!`}</Typography>
        <Typography variant="h6" component="p" sx={{ opacity: 0.9 }}>您的无人机攻击和防御模拟中心。选择下面的分系统开始探索。</Typography>
      </Box>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => {
          const IconComponent = feature.icon;
          return (
            // Card is Tailwind-based, MuiLink is used for navigation
            <MuiLink component={RouterLink} to={feature.path} key={feature.name} underline="none" className="group">
              <Card className="hover:shadow-2xl transition-shadow duration-300 h-full flex flex-col">
                <div className="flex items-center space-x-4 mb-4">
                  <IconComponent className={`h-12 w-12 ${feature.color} group-hover:scale-110 transition-transform`} />
                  <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">{feature.name}</h2>
                </div>
                <p className="text-neutral-600 dark:text-neutral-300 flex-grow">{feature.description}</p>
                <div className="mt-4 text-right">
                   <Typography
                      variant="body2"
                      component="span"
                      fontWeight="medium"
                      // The sx_DISABLED_because_tailwind_group_hover_needed prop was invalid and has been removed.
                      // The className prop below handles the styling, including group-hover.
                      className="text-sm font-medium text-primary-600 dark:text-primary-400 group-hover:underline"
                    >
                      {`前往 ${feature.name} →`}
                    </Typography>
                </div>
              </Card>
            </MuiLink>
          );
        })}
      </div>

      {/*{user?.role === 'admin' && (*/}
      {/*  <div className="mt-12">*/}
      {/*     <Card title="管理员面板 (概念)"> /!* Card is Tailwind-based *!/*/}
      {/*      <p className="text-neutral-600 dark:text-neutral-300">*/}
      {/*        未来的管理功能，如用户角色管理、系统设置和内容监督将在此处显示。*/}
      {/*      </p>*/}
      {/*     </Card>*/}
      {/*  </div>*/}
      {/*)}*/}
    </Box>
  );
};

export default DashboardPage;