'use client';

import { Shield, Github, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo & Copyright */}
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-900">A11y Scanner</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-gray-900 transition-colors"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
            <a
              href="mailto:contact@a11y-scanner.de"
              className="flex items-center gap-1.5 hover:text-gray-900 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Kontakt
            </a>
          </div>

          {/* Copyright */}
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} A11y Scanner
          </p>
        </div>
      </div>
    </footer>
  );
}
