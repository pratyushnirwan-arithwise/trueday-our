import React from 'react';
import { ArrowRight } from 'lucide-react';

const Navbar: React.FC = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md py-4 px-6 md:px-12 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Trueday
          </span>
        </div>
        
        <div className="hidden md:flex items-center space-x-8">
          <a href="#features" className="text-gray-700 hover:text-blue-600 transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="text-gray-700 hover:text-blue-600 transition-colors">
            How it Works
          </a>
          <a href="#contact" className="text-gray-700 hover:text-blue-600 transition-colors">
            Contact Us
          </a>
        </div>
        
        <div className="flex items-center gap-4">
          <a href="#" className="text-gray-700 hover:text-blue-600 transition-colors hidden md:block">
            Sign In
          </a>
          <a 
            href="#" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full flex items-center gap-2 transition-all hover:gap-3"
          >
            Get Started
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;