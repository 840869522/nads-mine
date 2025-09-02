"use client";
import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import {
  AcademicCapIcon,
  AdjustmentsHorizontalIcon,
  ShieldCheckIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline';
import MuiLink from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { getCookie } from '@/utils/cookie';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  const features = [
      {
          name: '基础支撑分系统',
          description: '管理用户角色、权限分配、系统级镜像和全局配置。',
          path: '/admin/users',
          icon: ServerStackIcon,
          color: 'text-yellow-500',
      },
    {
      name: '环境构建分系统',
      description: '配置网络拓扑，管理无人机节点和虚拟容器等基础设施。',
      path: '/scenario/envirments',
      icon: AdjustmentsHorizontalIcon,
      color: 'text-green-500',
    },
    {
      name: '安全实验分系统',
      description: '模拟网络攻防场景，进行红蓝对抗演练，检验安全防护能力。',
      path: '/drill',
      icon: ShieldCheckIcon,
      color: 'text-red-500',
    },
      {
          name: '人员测试分系统',
          description: '进行互动测验，获取AI反馈，并管理相关题库。',
          path: '/learn/quiz',
          icon: AcademicCapIcon,
          color: 'text-blue-500',
      },
  ];

  const router = useRouter();
  useEffect(() => {
    const token = getCookie("_auth");
    if (!token) {
      router.replace('/login');
    }
  }, [ router]);
  useEffect(() => {
    features.forEach((f) => router.prefetch(f.path));
  }, [router]);

  return (
    <Box>
      <Box className="mb-8 p-6 bg-gradient-to-r from-primary-600 to-blue-500 dark:from-primary-700 dark:to-blue-600 rounded-lg shadow-xl text-white">
        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>{`欢迎来到某网络安全实验平台, ${user?.user.c_username || ''}!`}</Typography>
        <Typography variant="h6" component="p" sx={{ opacity: 0.9 }}>
          您的攻击和防御模拟中心。选择下面的分系统开始探索。
        </Typography>
      </Box>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => {
          const IconComponent = feature.icon;
          return (
            <Link href={feature.path} key={feature.name} prefetch className="group block">
              <Card className="hover:shadow-2xl transition-shadow duration-300 h-full flex flex-col">
                <div className="flex items-center space-x-4 mb-4">
                  <IconComponent className={`h-12 w-12 ${feature.color} group-hover:scale-110 transition-transform`} />
                  <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">{feature.name}</h2>
                </div>
                <p className="text-neutral-600 dark:text-neutral-300 flex-grow">{feature.description}</p>
                <div className="mt-4 text-right">
                  <Typography variant="body2" component="span" fontWeight="medium" className="text-sm font-medium text-primary-600 dark:text-primary-400 group-hover:underline">
                    {`前往 ${feature.name} →`}
                  </Typography>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </Box>
  );
};

export default DashboardPage;

