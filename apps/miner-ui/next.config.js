/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    transpilePackages: ['lucide-react', 'styled-jsx'],
    webpack: (config, { dev }) => {
        if (dev) {
            config.watchOptions = {
                ...config.watchOptions,
                ignored: [
                    '**/*.log',
                    '**/*.txt',
                    '**/dev_log.txt',
                    '**/dev_err.txt',
                    '**/build_error.log',
                    '**/build-ninja/**',
                    '**/build-vs/**',
                    '**/node_modules/**'
                ]
            };
        }
        return config;
    }
}

module.exports = nextConfig
