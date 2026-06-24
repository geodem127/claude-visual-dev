import { create } from 'zustand';
import type { ElementContext, AttachedFile, VariantResult, GitHubTicket } from '../host/types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export interface VariantHistoryEntry {
  id: string;
  timestamp: number;
  element: ElementContext;
  instruction: string;
  variant: VariantResult;
  status: 'pending' | 'applied' | 'discarded';
}

interface State {
  // Left panel
  designReferenceBase64: string | null;
  designReferenceType: 'figma' | 'upload' | 'url' | null;
  attachedFiles: AttachedFile[];
  chatMessages: ChatMessage[];
  pinnedElement: ElementContext | null;
  githubTicket: GitHubTicket | null;

  // Center panel
  devServerUrl: string;
  viewport: 'desktop' | 'tablet' | 'mobile';
  annotationMode: boolean;
  activeTab: 'preview' | 'output';
  activeVariant: VariantResult | null;

  // Right panel
  selectedElement: ElementContext | null;
  variantHistory: VariantHistoryEntry[];

  // Actions
  setDesignReference: (base64: string, type: 'figma' | 'upload' | 'url') => void;
  clearDesignReference: () => void;
  addAttachedFile: (file: AttachedFile) => void;
  removeAttachedFile: (path: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  appendStreamChunk: (chunk: string) => void;
  finishStream: () => void;
  setPinnedElement: (el: ElementContext | null) => void;
  setGithubTicket: (ticket: GitHubTicket | null) => void;
  setDevServerUrl: (url: string) => void;
  setViewport: (v: 'desktop' | 'tablet' | 'mobile') => void;
  setAnnotationMode: (on: boolean) => void;
  setActiveTab: (tab: 'preview' | 'output') => void;
  setActiveVariant: (v: VariantResult | null) => void;
  setSelectedElement: (el: ElementContext | null) => void;
  addVariantHistory: (entry: VariantHistoryEntry) => void;
  updateVariantStatus: (id: string, status: VariantHistoryEntry['status']) => void;
}

export const useStore = create<State>((set) => ({
  designReferenceBase64: null,
  designReferenceType: null,
  attachedFiles: [],
  chatMessages: [],
  pinnedElement: null,
  githubTicket: null,
  devServerUrl: 'http://localhost:3000',
  viewport: 'desktop',
  annotationMode: false,
  activeTab: 'preview',
  activeVariant: null,
  selectedElement: null,
  variantHistory: [],

  setDesignReference: (base64, type) => set({ designReferenceBase64: base64, designReferenceType: type }),
  clearDesignReference: () => set({ designReferenceBase64: null, designReferenceType: null }),
  addAttachedFile: (file) => set(s => ({ attachedFiles: [...s.attachedFiles.filter(f => f.path !== file.path), file] })),
  removeAttachedFile: (path) => set(s => ({ attachedFiles: s.attachedFiles.filter(f => f.path !== path) })),
  addChatMessage: (msg) => set(s => ({ chatMessages: [...s.chatMessages, msg] })),
  appendStreamChunk: (chunk) => set(s => {
    const msgs = [...s.chatMessages];
    const last = msgs[msgs.length - 1];
    if (last?.streaming) {
      msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
    } else {
      msgs.push({ role: 'assistant', content: chunk, streaming: true });
    }
    return { chatMessages: msgs };
  }),
  finishStream: () => set(s => {
    const msgs = [...s.chatMessages];
    const last = msgs[msgs.length - 1];
    if (last?.streaming) msgs[msgs.length - 1] = { ...last, streaming: false };
    return { chatMessages: msgs };
  }),
  setPinnedElement: (el) => set({ pinnedElement: el }),
  setGithubTicket: (ticket) => set({ githubTicket: ticket }),
  setDevServerUrl: (url) => set({ devServerUrl: url }),
  setViewport: (v) => set({ viewport: v }),
  setAnnotationMode: (on) => set({ annotationMode: on }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveVariant: (v) => set({ activeVariant: v }),
  setSelectedElement: (el) => set({ selectedElement: el }),
  addVariantHistory: (entry) => set(s => ({ variantHistory: [entry, ...s.variantHistory] })),
  updateVariantStatus: (id, status) => set(s => ({
    variantHistory: s.variantHistory.map(e => e.id === id ? { ...e, status } : e),
  })),
}));
