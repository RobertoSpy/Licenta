import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Maximize2, Home, CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { useNavigate } from 'react-router-dom';
import { Step1Location } from './Step1Location';
import { Step2Terrain } from './Step2Terrain';
import { Step3Regulations } from './Step3Regulations';
import { Step4HouseType } from './Step4HouseType';
import { api } from '../../api/axios';
import { useProjectGuard } from '../../hooks/useProjectGuard';

export interface ProjectFormData {
  title: string;
  lat: number | null;
  lng: number | null;
  plotCoordinates: { x: string; y: string }[];
  polygonLatLngs: [number, number][];
  soilType: string;
  slopePercent: number;
  streetOrientation: string;
  county?: string;
  locality?: string;
  seismicZone?: string;
  frostDepthCm?: number;
  maxAllowedFloors?: number;
  minFoundationDepthCm?: number;
  houseStyle: string;
  hasBasement: boolean;
  hasGroundFloor: boolean;
  upperFloorsCount: number;
  hasMansard: boolean;
}

const initialData: ProjectFormData = {
  title: '',
  lat: null,
  lng: null,
  plotCoordinates: [
    { x: '', y: '' },
    { x: '', y: '' },
    { x: '', y: '' },
    { x: '', y: '' },
  ],
  polygonLatLngs: [],
  soilType: 'Nu știu',
  slopePercent: 0,
  streetOrientation: 'N',
  houseStyle: 'Modern',
  hasBasement: false,
  hasGroundFloor: true,
  upperFloorsCount: 0,
  hasMansard: false,
};

const steps = [
  { id: 1, title: 'Date de Bază', icon: <MapPin className="w-5 h-5" /> },
  { id: 2, title: 'Parametrii Teren', icon: <Maximize2 className="w-5 h-5" /> },
  { id: 3, title: 'Reglementări', icon: <CheckCircle2 className="w-5 h-5" /> },
  { id: 4, title: 'Viziune Casă', icon: <Home className="w-5 h-5" /> },
];

interface ProjectWizardProps {
  onCancel: () => void;
}

export const ProjectWizard = ({ onCancel }: ProjectWizardProps) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ProjectFormData>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  
  const { projectId, isLoading, restoredData, restoredStep, clearProject } = useProjectGuard();

  useEffect(() => {
    if (restoredData) setFormData(prev => ({ ...prev, ...restoredData }));
    if (restoredStep) setCurrentStep(restoredStep);
  }, [restoredData, restoredStep]);

  const updateFormData = (fields: Partial<ProjectFormData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const handleNext = async () => {
    if (currentStep >= 1 && currentStep <= 3) {
      try {
        await api.patch(`/api/projects/${projectId}`, {
          ...formData, // Trimite toate datele strânse
          wizardStep: currentStep + 1 // Sincronizam cu pasul URMATOR
        });
        setCurrentStep(prev => prev + 1);
      } catch (err) {
        console.error(`Eroare la salvarea pasului ${currentStep}`, err);
        alert(`Nu am putut salva datele din pasul ${currentStep}`);
      }
    } else {
      if (currentStep < 4) setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  const handleFinish = async () => {
    if (!projectId) return;
    setIsSaving(true);
    try {
      await api.patch(`/api/projects/${projectId}`, {
        ...formData,
        wizardStep: 4,
        isCompleted: true,
      });
      clearProject();
      navigate(`/dashboard/projects/${projectId}`);
    } catch (err) {
      console.error('Eroare la finalizarea proiectului', err);
      alert('Nu am putut finaliza proiectul. Încearcă din nou.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[85vh] md:h-[800px] w-full max-w-5xl mx-auto">
        <div className="bg-slate-50 border-b border-slate-200 p-6 md:px-10">
          <div className="h-8 w-48 bg-slate-200 animate-pulse rounded-lg mb-6" />
          <div className="flex justify-between">
            {[1,2,3,4].map(i => <div key={i} className="h-12 w-12 rounded-full bg-slate-200 animate-pulse" />)}
          </div>
        </div>
        <div className="flex-1 p-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[85vh] md:h-[800px] w-full max-w-5xl mx-auto">
      {/* Header & Stepper */}
      <div className="bg-slate-50 border-b border-slate-200 p-6 md:px-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-slate-900">Configurator Casă</h2>
          <Button variant="ghost" onClick={onCancel} className="text-slate-500 hover:text-slate-900">
            Anulează
          </Button>
        </div>

        {/* Progress Dots / Steps */}
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 rounded-full z-0"></div>
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-buildorange rounded-full z-0 transition-all duration-500"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          ></div>

          {steps.map((step) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;

            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all duration-300 shadow-sm
                    ${isActive ? 'bg-buildorange text-white ring-4 ring-buildorange/20 scale-110' :
                      isCompleted ? 'bg-buildnavy text-white' : 'bg-white text-slate-400 border-2 border-slate-200'}`}
                >
                  {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : step.icon}
                </div>
                <span className={`text-sm font-bold ${isActive ? 'text-slate-900' : 'text-slate-500'} hidden md:block`}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Content Area */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 relative bg-slate-50/50">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {currentStep === 1 && <Step1Location data={formData} updateData={updateFormData} />}
            {currentStep === 2 && <Step2Terrain data={formData} updateData={updateFormData} />}
            {currentStep === 3 && <Step3Regulations data={formData} updateData={updateFormData} />}
            {currentStep === 4 && <Step4HouseType data={formData} updateData={updateFormData} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <div className="bg-white border-t border-slate-200 p-6 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 1}
          className="gap-2"
        >
          <ChevronLeft className="w-5 h-5" /> Înapoi
        </Button>

        {currentStep < 4 ? (
          <Button onClick={handleNext} className="gap-2 px-8">
            Următorul Pas <ChevronRight className="w-5 h-5" />
          </Button>
        ) : (
          <Button onClick={handleFinish} disabled={isSaving} className="gap-2 px-8 bg-buildnavy hover:bg-slate-800 text-white">
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {isSaving ? 'Se salvează...' : 'Finalizează și Creează Proiect'}
          </Button>
        )}
      </div>
    </div>
  );
};
