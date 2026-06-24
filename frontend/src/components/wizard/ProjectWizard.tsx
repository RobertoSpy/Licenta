import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Maximize2, Home, CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { useNavigate } from 'react-router-dom';
import { Step1Location } from './Step1Location';
import { Step2Terrain } from './Step2Terrain';
import { Step3Regulations } from './Step3Regulations';
import { Step4HouseType } from './Step4HouseType';
import { apiPrivate } from '../../api/axios';
import { useProjectGuard } from '../../hooks/useProjectGuard';
import { useZidarioChat } from '../../hooks/useZidarioChat';
import { useScreenTutor } from '../../hooks/useScreenTutor';
import { AIChatBubble } from '../ai/AIChatBubble';

export interface ProjectFormData {
  title: string;
  buildingPurpose: string;
  lat: number | null;
  lng: number | null;
  plotCoordinates: { x: string; y: string }[];
  polygonLatLngs: [number, number][];
  soilType: string;
  slopePercent: number;
  streetOrientation: string;
  plotAreaSqm?: number;
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
  soilNotes?: string;
  zoningRestrictions?: string;
}

const initialData: ProjectFormData = {
  title: '',
  buildingPurpose: 'residential',
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
  soilNotes: '',
  zoningRestrictions: '',
  plotAreaSqm: 0,
};

const steps = [
  { id: 1, title: 'Date de Bază', icon: <MapPin className="w-5 h-5" /> },
  { id: 2, title: 'Parametrii Teren', icon: <Maximize2 className="w-5 h-5" /> },
  { id: 3, title: 'Viziune Casă', icon: <Home className="w-5 h-5" /> },
  { id: 4, title: 'Reglementări & Analiză', icon: <CheckCircle2 className="w-5 h-5" /> },
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

  const contextForAi = useMemo(() => {
    const context: Partial<ProjectFormData> = {
      title: formData.title,
      buildingPurpose: formData.buildingPurpose,
      lat: formData.lat,
      lng: formData.lng,
      plotAreaSqm: formData.plotAreaSqm,
      county: formData.county,
      locality: formData.locality,
      seismicZone: formData.seismicZone,
      frostDepthCm: formData.frostDepthCm,
    };
    if (currentStep >= 2) {
      context.soilType = formData.soilType;
      context.slopePercent = formData.slopePercent;
      context.streetOrientation = formData.streetOrientation;
      context.soilNotes = formData.soilNotes;
    }
    if (currentStep >= 3) {
      context.houseStyle = formData.houseStyle;
      context.hasBasement = formData.hasBasement;
      context.hasGroundFloor = formData.hasGroundFloor;
      context.upperFloorsCount = formData.upperFloorsCount;
      context.hasMansard = formData.hasMansard;
    }
    if (currentStep >= 4) {
      context.maxAllowedFloors = formData.maxAllowedFloors;
      context.minFoundationDepthCm = formData.minFoundationDepthCm;
      context.zoningRestrictions = formData.zoningRestrictions;
    }
    return context as Record<string, unknown>;
  }, [formData, currentStep]);

  // Chat Global pentru Wizard
  const { messages, isStreaming, sendMessage: originalSendMessage, addSystemMessage, unreadCount, markAsRead } = useZidarioChat('wizard', projectId || 0, contextForAi);
  // Tutor Educațional
  useScreenTutor({
    screenId: `step${currentStep}`,
    addSystemMessage
  });

  const sendMessage = async (text: string) => {
    await originalSendMessage(text);
  };

  const canGoNext = useMemo(() => {
    if (messages.length === 0) return false;

    // Must have at least one user message after the last system injection THAT REQUIRES AN ANSWER
    let lastSystemIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].isSystemInjection && messages[i].requiresAnswer) {
        lastSystemIndex = i;
        break;
      }
    }

    const hasUserReplyAfter = lastSystemIndex === -1 || messages.findIndex((m, idx) => idx > lastSystemIndex && m.role === 'user') !== -1;

    if (!hasUserReplyAfter) return false;

    if (currentStep === 1) {
      return formData.lat !== null && formData.lng !== null && !!formData.seismicZone;
    }
    // Reglementări (fostul pas 3, acum pasul 4) nu mai blochează butonul.
    return true;
  }, [messages, currentStep, formData.lat, formData.lng, formData.seismicZone, formData.zoningRestrictions]);

  // Auto-save în localStorage
  useEffect(() => {
    if (projectId) {
      const savedState = localStorage.getItem(`wizard_draft_${projectId}`);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          // Restaurăm doar dacă nu a venit ceva oficial de la API (restoredData suprascrie)
          if (!restoredData) setFormData(prev => ({ ...prev, ...parsed.formData }));
          if (!restoredStep) setCurrentStep(parsed.currentStep || 1);
        } catch (e) {
          console.error('Eroare la parsarea autosave-ului din localStorage', e);
        }
      }
    }
  }, [projectId]); // Rulează o singură dată la încărcarea projectId-ului

  useEffect(() => {
    if (restoredData) setFormData(prev => ({ ...prev, ...restoredData }));
    if (restoredStep) setCurrentStep(restoredStep);
  }, [restoredData, restoredStep]);

  useEffect(() => {
    // Salvăm mereu la schimbări în browser, ca măsură de siguranță
    if (projectId) {
      localStorage.setItem(`wizard_draft_${projectId}`, JSON.stringify({ formData, currentStep }));
    }
  }, [formData, currentStep, projectId]);

  const updateFormData = (fields: Partial<ProjectFormData>) => {
    setFormData((prev) => ({ ...prev, ...fields }));
  };

  const handleNext = async () => {
    if (currentStep >= 1 && currentStep <= 3) {
      try {
        await apiPrivate.patch(`/projects/${projectId}`, {
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
      await apiPrivate.patch(`/projects/${projectId}`, {
        ...formData,
        wizardStep: 4,
        isCompleted: true,
      });
      localStorage.removeItem(`wizard_draft_${projectId}`);
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
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 w-12 rounded-full bg-slate-200 animate-pulse" />)}
          </div>
        </div>
        <div className="flex-1 p-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <>
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
              {currentStep === 1 && <Step1Location data={formData} updateData={updateFormData} addSystemMessage={addSystemMessage} />}
              {currentStep === 2 && <Step2Terrain data={formData} updateData={updateFormData} addSystemMessage={addSystemMessage} />}
              {currentStep === 3 && <Step4HouseType data={formData} updateData={updateFormData} addSystemMessage={addSystemMessage} />}
              {currentStep === 4 && <Step3Regulations data={formData} updateData={updateFormData} addSystemMessage={addSystemMessage} />}
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
            <Button onClick={handleNext} disabled={!canGoNext} className="gap-2 px-8">
              Următorul Pas <ChevronRight className="w-5 h-5" />
            </Button>
          ) : (
            <Button onClick={handleFinish} disabled={isSaving || !canGoNext} className="gap-2 px-8 bg-buildnavy hover:bg-slate-800 text-white">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              {isSaving ? 'Se salvează...' : 'Finalizează și Creează Proiect'}
            </Button>
          )}
        </div>
      </div>

      <AIChatBubble
        messages={messages}
        isStreaming={isStreaming}
        onSendMessage={sendMessage}
        unreadCount={unreadCount}
        onMarkAsRead={markAsRead}
      />
    </>
  );
};
