// OCR Document Processor - Main Application Entry Point
// Following BMAD methodology for clean, maintainable web application

export interface DocumentType {
  id: string;
  type: 'business_card' | 'invoice';
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  extractedText?: any;
  createdAt: string;
  userId: string;
}

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

// Main application class following BMAD principles
export class OCRApp {
  private currentUser: User | null = null;
  
  constructor() {
    console.log('🚀 OCR Document Processor initialized');
    console.log('📋 Following BMAD methodology');
  }

  // Initialize the application
  async initialize(): Promise<void> {
    try {
      console.log('⚡ Initializing OCR application...');
      // Application initialization logic will go here
    } catch (error) {
      console.error('❌ Failed to initialize application:', error);
    }
  }
}

// Export for use in other modules
export default OCRApp;