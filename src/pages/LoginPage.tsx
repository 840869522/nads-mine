import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Alert from '../components/ui/Alert';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login, loading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(username, password);
      // Navigation will be handled by App.tsx
    } catch (err) {
      setError(err instanceof Error ? "无效的凭据" : "登录失败");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-100 via-neutral-200 to-neutral-300 dark:from-neutral-800 dark:via-neutral-900 dark:to-black p-4">
      <Card className="w-full max-w-md" title="登录到 无人机网络安全实验平台">
        <form onSubmit={handleSubmit} className="space-y-6 p-2">
          {error && <Alert type="error" message={error} onClose={() => setError(null)} className="mb-4" />}
          <Input
            id="username"
            label="用户名"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
          <Input
            id="password"
            label="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Button type="submit" isLoading={loading} className="w-full" size="lg">
            {loading ? "登录中..." : "登录"}
          </Button>
        </form>
         <div className="mt-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
            <p>管理员: admin / admin123</p>
            <p>学生: student / student123</p>
          </div>
      </Card>
    </div>
  );
};

export default LoginPage;