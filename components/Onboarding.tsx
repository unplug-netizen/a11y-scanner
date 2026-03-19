'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { 
  Shield, 
  Search, 
  Calendar, 
  BarChart3, 
  Bell,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const steps = [
  {
    id: 'welcome',
    title: 'Willkommen beim A11y Scanner!',
    description: 'Dein Tool für barrierefreie Websites. Lass uns in wenigen Schritten die wichtigsten Funktionen entdecken.',
    icon: Sparkles,
  },
  {
    id: 'scan',
    title: 'Websites scannen',
    description: 'Gib einfach eine URL ein und wähle zwischen Quick Scan (schnell) oder Deep Scan (gründlich). Wir analysieren deine Seite auf WCAG-Konformität.',
    icon: Search,
  },
  {
    id: 'scheduled',
    title: 'Geplante Scans',
    description: 'Richte automatische Scans ein, die täglich, wöchentlich oder monatlich laufen. So behältst du die Barrierefreiheit deiner Website im Blick.',
    icon: Calendar,
  },
  {
    id: 'bulk',
    title: 'Bulk Scan',
    description: 'Scanne bis zu 50 URLs auf einmal. Perfekt für große Websites oder nach Deployments.',
    icon: BarChart3,
  },
  {
    id: 'notifications',
    title: 'Benachrichtigungen',
    description: 'Verbinde Slack oder E-Mail, um bei neuen Issues sofort informiert zu werden.',
    icon: Bell,
  },
  {
    id: 'complete',
    title: 'Bereit loszulegen!',
    description: 'Du bist startklar. Beginne mit deinem ersten Scan oder erkunde die anderen Funktionen.',
    icon: CheckCircle,
  },
];

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const { session } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(true);

  useEffect(() => {
    // Check if user has seen onboarding
    const seen = localStorage.getItem('a11y-onboarding-seen');
    if (!seen && isOpen) {
      setHasSeenOnboarding(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    localStorage.setItem('a11y-onboarding-seen', 'true');
    onClose();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || hasSeenOnboarding) return null;

  const step = steps[currentStep];
  const Icon = step.icon;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-gray-100 dark:bg-gray-800">
          <div 
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="px-6 py-4 flex justify-end">
          <button
            onClick={handleSkip}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            Überspringen
          </button>
        </div>

        {/* Content */}
        <div className="px-8 pb-8 text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/30 mb-6">
            <Icon className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            {step.title}
          </h2>

          {/* Description */}
          <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
            {step.description}
          </p>

          {/* Step Indicators */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-blue-600 w-6'
                    : index < currentStep
                    ? 'bg-blue-400'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={isFirstStep}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isFirstStep
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </button>

            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isLastStep ? 'Los geht\'s!' : 'Weiter'}
              {!isLastStep && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook to check if onboarding should be shown
export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const checkOnboarding = () => {
      const hasSeen = localStorage.getItem('a11y-onboarding-seen');
      const isNewUser = localStorage.getItem('a11y-new-user');
      
      // Show onboarding for new users who haven't seen it
      if (isAuthenticated && !hasSeen && isNewUser === 'true') {
        setShowOnboarding(true);
      }
    };

    checkOnboarding();
  }, [isAuthenticated]);

  const markAsSeen = () => {
    localStorage.setItem('a11y-onboarding-seen', 'true');
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem('a11y-onboarding-seen');
    setShowOnboarding(true);
  };

  return { showOnboarding, setShowOnboarding, markAsSeen, resetOnboarding };
}
