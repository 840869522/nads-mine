/** @type {import('next').NextConfig} */

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },//应确保 ssh2 相关的代码 仅在 Node.js 运行的服务端执行，不要被 Webpack 打包进客户端。
  webpack: (config, { isServer }) => {
    if (isServer) {
      if (Array.isArray(config.externals)) {
        config.externals.push('ssh2');
      }
    }
    return config;
  },

  async rewrites(){
    return [
      {
        source:"/back/:path*",
        destination:'http://127.0.0.1:8000/:path*',
      }
    ];
  },

};

export default nextConfig;



