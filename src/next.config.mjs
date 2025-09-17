/** @type {import('next').NextConfig} */

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },//应确保 ssh2 相关的代码 仅在 Node.js 运行的服务端执行，不要被 Webpack 打包进客户端。
  webpack: (config, { isServer }) => {
    config.cache = true;
    if (isServer) {
      if (Array.isArray(config.externals)) {
        config.externals.push('ssh2');
      }
    }
    return config;
  },


};

export default nextConfig;



