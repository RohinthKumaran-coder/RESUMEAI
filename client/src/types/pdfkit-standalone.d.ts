// src/types/pdfkit-standalone.d.ts
// Type declaration for pdfkit's standalone build.
// The standalone build embeds all font data in JS so no disk reads are needed —
// required for Vercel/Next.js where bundling strips node_modules asset files.
declare module 'pdfkit/js/pdfkit.standalone.js' {
    import PDFDocument from 'pdfkit';
    export default PDFDocument;
}