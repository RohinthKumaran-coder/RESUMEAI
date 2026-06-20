/** @type {import('next').NextConfig} */
const nextConfig = {
    // Keep these packages as native require() — do NOT bundle them.
    // pdfkit reads font .afm files from disk at runtime; bundling strips them → blank PDF.
    // pdf-parse, mammoth, pdfreader also rely on native Node.js file system access.
    serverExternalPackages: ['pdfkit', 'pdf-parse', 'mammoth', 'pdfreader', 'sharp'],
};

module.exports = nextConfig;