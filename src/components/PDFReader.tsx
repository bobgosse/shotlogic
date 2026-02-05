import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, Loader2, Copy, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { extractTextFromPDF } from '@/utils/screenplayParser';
import * as pdfjsLib from 'pdfjs-dist';
import { logger } from "@/utils/logger";

interface PDFReaderProps {
  onTextExtracted?: (text: string, filename: string) => void;
  showControls?: boolean;
  maxHeight?: string;
}

export const PDFReader = ({
  onTextExtracted,
  showControls = true,
  maxHeight = '600px'
}: PDFReaderProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [fileName, setFileName] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const { toast } = useToast();

  // Configure PDF.js worker
  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).href;
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid file type',
        description: 'Please select a PDF file',
        variant: 'destructive',
      });
      return;
    }

    await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsLoading(true);
    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Get page count
      const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
      setPageCount(pdf.numPages);

      // Extract text
      const text = await extractTextFromPDF(uint8Array);

      if (!text || text.trim().length === 0) {
        throw new Error('No text could be extracted from this PDF');
      }

      setExtractedText(text);

      toast({
        title: 'PDF processed successfully',
        description: `Extracted ${text.length} characters from ${pdf.numPages} pages`,
      });

      // Call the callback if provided
      if (onTextExtracted) {
        onTextExtracted(text, file.name);
      }
    } catch (error: any) {
      logger.error('PDF processing error:', error);
      toast({
        title: 'PDF processing failed',
        description: error.message || 'Could not extract text from PDF',
        variant: 'destructive',
      });
      setExtractedText('');
      setFileName('');
      setPageCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(extractedText);
    toast({
      title: 'Copied to clipboard',
      description: 'Text has been copied to your clipboard',
    });
  };

  const handleDownloadText = () => {
    const blob = new Blob([extractedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace('.pdf', '.txt');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Download started',
      description: 'Text file is being downloaded',
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          PDF Reader
        </CardTitle>
        <CardDescription>
          Upload a PDF file to extract and view its text content
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Upload */}
        <div className="flex items-center gap-4">
          <label htmlFor="pdf-upload">
            <Button disabled={isLoading} asChild>
              <span className="cursor-pointer">
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Select PDF
                  </>
                )}
              </span>
            </Button>
          </label>
          <input
            id="pdf-upload"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isLoading}
          />
          {fileName && (
            <span className="text-sm text-muted-foreground">
              {fileName} ({pageCount} pages)
            </span>
          )}
        </div>

        {/* Text Display */}
        {extractedText && (
          <>
            <Textarea
              value={extractedText}
              readOnly
              className="font-mono text-sm"
              style={{ minHeight: '300px', maxHeight }}
              placeholder="Extracted text will appear here..."
            />

            {/* Controls */}
            {showControls && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyToClipboard}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Text
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadText}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download as TXT
                </Button>
              </div>
            )}

            {/* Stats */}
            <div className="text-xs text-muted-foreground">
              {extractedText.length.toLocaleString()} characters •
              {extractedText.split(/\s+/).length.toLocaleString()} words •
              {extractedText.split('\n').length.toLocaleString()} lines
            </div>
          </>
        )}

        {/* Empty State */}
        {!extractedText && !isLoading && (
          <div className="border-2 border-dashed border-muted rounded-lg p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No PDF loaded. Click "Select PDF" to begin.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
