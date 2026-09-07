/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // El gateway y la service role key solo se usan desde el servidor.
  serverExternalPackages: [],
}

export default nextConfig
