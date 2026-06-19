declare module 'pdf-parse' {
    function pdfParse(
        dataBuffer: Buffer,
        options?: object
    ): Promise<{ text: string; numpages: number; info: object }>;
    export = pdfParse;
}