import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export interface CompanySettings {
  companyName: string;
  logoUrl: string;
  address: string;
  phone1: string;
  phone2: string;
  email: string;
  tin: string;
  website: string;
  currency: string;
  taxRate: number;
  defaultLowStockThreshold: number;
  receiptFooter: string;
  termsAndConditions: string;
}

const DEFAULT_SETTINGS: CompanySettings = {
  companyName: 'WONARK COMPANY LIMITED',
  logoUrl: '',
  address: 'Commercial Industrial Area, Greater Accra, Ghana',
  phone1: '+233 30 281 1200',
  phone2: '+233 24 455 6677',
  email: 'info@wonark.com',
  tin: 'C0001234567',
  website: 'www.wonark.com',
  currency: 'GHS',
  taxRate: 0,
  defaultLowStockThreshold: 10,
  receiptFooter: 'Thank you for your business!',
  termsAndConditions: 'Goods sold in good condition are not returnable after 7 days.',
};

const STORAGE_KEY = 'wonark_business_settings';

export interface CompanyContextType {
  settings: CompanySettings;
  companyName: string;
  companyLogo: string;
  companyAddress: string;
  companyPhone: string;
  currency: string;
  updateSettings: (newSettings: Partial<CompanySettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
  isLoading: boolean;
}

const CompanyContext = createContext<CompanyContextType>({
  settings: DEFAULT_SETTINGS,
  companyName: DEFAULT_SETTINGS.companyName,
  companyLogo: '',
  companyAddress: DEFAULT_SETTINGS.address,
  companyPhone: DEFAULT_SETTINGS.phone1,
  currency: DEFAULT_SETTINGS.currency,
  updateSettings: async () => {},
  refreshSettings: async () => {},
  isLoading: false,
});

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<CompanySettings>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(cached) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  const [isLoading, setIsLoading] = useState(false);

  const syncToState = (data: any) => {
    if (!data) return;
    const mapped: CompanySettings = {
      companyName: data.company_name || data.companyName || DEFAULT_SETTINGS.companyName,
      logoUrl: data.logo_url || data.logoUrl || '',
      address: data.address || DEFAULT_SETTINGS.address,
      phone1: data.phone1 || DEFAULT_SETTINGS.phone1,
      phone2: data.phone2 || DEFAULT_SETTINGS.phone2,
      email: data.email || DEFAULT_SETTINGS.email,
      tin: data.tin || DEFAULT_SETTINGS.tin,
      website: data.website || DEFAULT_SETTINGS.website,
      currency: data.currency || DEFAULT_SETTINGS.currency,
      taxRate: Number(data.tax_rate ?? data.taxRate ?? DEFAULT_SETTINGS.taxRate),
      defaultLowStockThreshold: Number(
        data.default_low_stock_threshold ??
          data.defaultLowStockThreshold ??
          DEFAULT_SETTINGS.defaultLowStockThreshold,
      ),
      receiptFooter: data.receipt_footer || data.receiptFooter || DEFAULT_SETTINGS.receiptFooter,
      termsAndConditions:
        data.terms_and_conditions || data.termsAndConditions || DEFAULT_SETTINGS.termsAndConditions,
    };
    setSettings(mapped);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
      // Also update any legacy keys
      localStorage.setItem('wonark_company_name', mapped.companyName);
      if (mapped.logoUrl) {
        localStorage.setItem('wonark_company_logo', mapped.logoUrl);
      }
    } catch {
      // ignore localStorage quota
    }
  };

  const refreshSettings = async () => {
    setIsLoading(true);
    try {
      const res = await api.getBusinessSettings();
      if (res && res.success && res.data) {
        syncToState(res.data);
      }
    } catch (err) {
      console.warn('Failed to load business settings from backend:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<CompanySettings>) => {
    const merged = { ...settings, ...newSettings };
    syncToState(merged);

    try {
      await api.updateBusinessSettings({
        company_name: merged.companyName,
        logo_url: merged.logoUrl,
        address: merged.address,
        phone1: merged.phone1,
        phone2: merged.phone2,
        email: merged.email,
        tin: merged.tin,
        website: merged.website,
        currency: merged.currency,
        tax_rate: merged.taxRate,
        default_low_stock_threshold: merged.defaultLowStockThreshold,
        receipt_footer: merged.receiptFooter,
        terms_and_conditions: merged.termsAndConditions,
      });
    } catch (err: any) {
      throw err;
    }
  };

  const value: CompanyContextType = {
    settings,
    companyName: settings.companyName,
    companyLogo: settings.logoUrl,
    companyAddress: settings.address,
    companyPhone: [settings.phone1, settings.phone2].filter(Boolean).join(' / ') || settings.phone1,
    currency: settings.currency,
    updateSettings,
    refreshSettings,
    isLoading,
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => useContext(CompanyContext);
