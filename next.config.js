/** @type {import('next').NextConfig} */
const nextConfig = {
    // Keep these as native require() — do NOT bundle them.
    // pdf-parse, mammoth, pdfreader rely on Node.js file system access.
    // pdfkit is NO LONGER USED — replaced by pdf-lib (pure JS, Vercel-safe).
    serverExternalPackages: ['pdf-parse', 'mammoth', 'pdfreader', 'sharp'],
};

module.exports = nextConfig;