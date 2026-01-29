import React, { useEffect } from 'react';
import { Settings as SettingsIcon, Shield, Palette, Database, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { SecuritySettings, AppearanceSettings, DataSettings, GeneralSettings } from '@/components/settings';

export default function Settings() {
  const { userId, isAuthLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !userId) {
      navigate('/login', { replace: true });
    }
  }, [isAuthLoading, userId, navigate]);

  // Show loading while auth is loading or redirecting
  if (isAuthLoading || !userId) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto animate-in fade-in duration-200 pb-24 lg:pb-6">
      {/* Header */}
      <PageHeader
        title="Einstellungen"
        subtitle="Verwalte deinen Vault"
        icon={<SettingsIcon className="w-5 h-5 text-primary" />}
        backTo="/dashboard"
      />

      {/* Tabs Navigation */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-auto p-1 bg-muted/50 rounded-xl">
          <TabsTrigger 
            value="general" 
            className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-1 sm:px-3 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg"
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Allgemein</span>
            <span className="sm:hidden">Allg.</span>
          </TabsTrigger>
          <TabsTrigger 
            value="security" 
            className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-1 sm:px-3 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg"
          >
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Sicherheit</span>
            <span className="sm:hidden">Sicher.</span>
          </TabsTrigger>
          <TabsTrigger 
            value="appearance" 
            className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-1 sm:px-3 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg"
          >
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Aussehen</span>
            <span className="sm:hidden">Design</span>
          </TabsTrigger>
          <TabsTrigger 
            value="data" 
            className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-1 sm:px-3 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg"
          >
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Daten</span>
            <span className="sm:hidden">Daten</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 sm:mt-6">
          <GeneralSettings />
        </TabsContent>

        <TabsContent value="security" className="mt-4 sm:mt-6">
          <SecuritySettings />
        </TabsContent>

        <TabsContent value="appearance" className="mt-4 sm:mt-6">
          <AppearanceSettings />
        </TabsContent>

        <TabsContent value="data" className="mt-4 sm:mt-6">
          <DataSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
