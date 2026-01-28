import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { RealtimeSyncProvider } from "@/contexts/RealtimeSyncContext";
import { AutoLockProvider } from "@/components/AutoLockProvider";
import { MainLayout } from "@/components/layout/MainLayout";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import { PanicButton } from "@/components/PanicButton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingFallback } from "@/components/LoadingFallback";
import { RouteUIReset } from "@/components/RouteUIReset";

// Eagerly loaded pages (critical path)
import Index from "./pages/Index";
import Login from "./pages/Login";

// Lazily loaded pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Notes = lazy(() => import("./pages/Notes"));
const Photos = lazy(() => import("./pages/Photos"));
const Files = lazy(() => import("./pages/Files"));
const Settings = lazy(() => import("./pages/Settings"));
const SecretTexts = lazy(() => import("./pages/SecretTexts"));
const SecurityLogs = lazy(() => import("./pages/SecurityLogs"));
const Trash = lazy(() => import("./pages/Trash"));
const Favorites = lazy(() => import("./pages/Favorites"));
const RecentlyViewed = lazy(() => import("./pages/RecentlyViewed"));
const RecentlyAdded = lazy(() => import("./pages/RecentlyAdded"));
const TagsManagement = lazy(() => import("./pages/TagsManagement"));
const Links = lazy(() => import("./pages/Links"));
const TikTok = lazy(() => import("./pages/TikTok"));
const Admin = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SharedAlbum = lazy(() => import("./pages/SharedAlbum"));
const SharedAlbums = lazy(() => import("./pages/SharedAlbums"));
const SharedAlbumView = lazy(() => import("./pages/SharedAlbumView"));
const SharedItemView = lazy(() => import("./pages/SharedItemView"));
const BreakTracker = lazy(() => import("./pages/BreakTracker"));
const DuplicateFinder = lazy(() => import("./pages/DuplicateFinder"));
const StorageAnalysis = lazy(() => import("./pages/StorageAnalysis"));
const ActivityTimeline = lazy(() => import("./pages/ActivityTimeline"));
const UsageStats = lazy(() => import("./pages/UsageStats"));
const TagCloud = lazy(() => import("./pages/TagCloud"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (was cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <RealtimeSyncProvider>
          <AutoLockProvider>
            <ErrorBoundary>
              <Toaster />
              <Sonner />
              <PWAInstallPrompt />
              <PWAUpdatePrompt />
              <BrowserRouter>
                <RouteUIReset />
                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route element={<MainLayout />}>
                      <Route path="/dashboard" element={
                        <ErrorBoundary>
                          <Dashboard />
                        </ErrorBoundary>
                      } />
                      <Route path="/notes" element={
                        <ErrorBoundary>
                          <Notes />
                        </ErrorBoundary>
                      } />
                      <Route path="/photos" element={
                        <ErrorBoundary>
                          <Photos />
                        </ErrorBoundary>
                      } />
                      <Route path="/files" element={
                        <ErrorBoundary>
                          <Files />
                        </ErrorBoundary>
                      } />
                      <Route path="/secret-texts" element={
                        <ErrorBoundary>
                          <SecretTexts />
                        </ErrorBoundary>
                      } />
                      <Route path="/security-logs" element={
                        <ErrorBoundary>
                          <SecurityLogs />
                        </ErrorBoundary>
                      } />
                      <Route path="/trash" element={
                        <ErrorBoundary>
                          <Trash />
                        </ErrorBoundary>
                      } />
                      <Route path="/favorites" element={
                        <ErrorBoundary>
                          <Favorites />
                        </ErrorBoundary>
                      } />
                      <Route path="/recently-viewed" element={
                        <ErrorBoundary>
                          <RecentlyViewed />
                        </ErrorBoundary>
                      } />
                      <Route path="/recently-added" element={
                        <ErrorBoundary>
                          <RecentlyAdded />
                        </ErrorBoundary>
                      } />
                      <Route path="/tags" element={
                        <ErrorBoundary>
                          <TagsManagement />
                        </ErrorBoundary>
                      } />
                      <Route path="/tag-cloud" element={
                        <ErrorBoundary>
                          <TagCloud />
                        </ErrorBoundary>
                      } />
                      <Route path="/links" element={
                        <ErrorBoundary>
                          <Links />
                        </ErrorBoundary>
                      } />
                      <Route path="/tiktok" element={
                        <ErrorBoundary>
                          <TikTok />
                        </ErrorBoundary>
                      } />
                      <Route path="/shared-albums" element={
                        <ErrorBoundary>
                          <SharedAlbums />
                        </ErrorBoundary>
                      } />
                      <Route path="/shared-album/:albumId" element={
                        <ErrorBoundary>
                          <SharedAlbumView />
                        </ErrorBoundary>
                      } />
                      <Route path="/break-tracker" element={
                        <ErrorBoundary>
                          <BreakTracker />
                        </ErrorBoundary>
                      } />
                      <Route path="/duplicate-finder" element={
                        <ErrorBoundary>
                          <DuplicateFinder />
                        </ErrorBoundary>
                      } />
                      <Route path="/storage-analysis" element={
                        <ErrorBoundary>
                          <StorageAnalysis />
                        </ErrorBoundary>
                      } />
                      <Route path="/activity" element={
                        <ErrorBoundary>
                          <ActivityTimeline />
                        </ErrorBoundary>
                      } />
                      <Route path="/usage-stats" element={
                        <ErrorBoundary>
                          <UsageStats />
                        </ErrorBoundary>
                      } />
                      <Route path="/settings" element={
                        <ErrorBoundary>
                          <Settings />
                        </ErrorBoundary>
                      } />
                      <Route path="/admin" element={
                        <ErrorBoundary>
                          <Admin />
                        </ErrorBoundary>
                      } />
                    </Route>
                    <Route path="/shared/:token" element={
                      <ErrorBoundary>
                        <SharedAlbum />
                      </ErrorBoundary>
                    } />
                    <Route path="/share/:token" element={
                      <ErrorBoundary>
                        <SharedItemView />
                      </ErrorBoundary>
                    } />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                <PanicButton />
              </BrowserRouter>
            </ErrorBoundary>
          </AutoLockProvider>
        </RealtimeSyncProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
