import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AutoLockProvider } from "@/components/AutoLockProvider";
import { MainLayout } from "@/components/layout/MainLayout";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Notes from "./pages/Notes";
import Photos from "./pages/Photos";
import Files from "./pages/Files";
import Settings from "./pages/Settings";
import SecretTexts from "./pages/SecretTexts";
import SecurityLogs from "./pages/SecurityLogs";
import Trash from "./pages/Trash";
import Favorites from "./pages/Favorites";
import RecentlyViewed from "./pages/RecentlyViewed";
import RecentlyAdded from "./pages/RecentlyAdded";
import TagsManagement from "./pages/TagsManagement";
import Links from "./pages/Links";
import TikTok from "./pages/TikTok";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import SharedAlbum from "./pages/SharedAlbum";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AutoLockProvider>
          <Toaster />
          <Sonner />
          <PWAInstallPrompt />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/notes" element={<Notes />} />
                <Route path="/photos" element={<Photos />} />
                <Route path="/files" element={<Files />} />
                <Route path="/secret-texts" element={<SecretTexts />} />
                <Route path="/security-logs" element={<SecurityLogs />} />
                <Route path="/trash" element={<Trash />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/recently-viewed" element={<RecentlyViewed />} />
                <Route path="/recently-added" element={<RecentlyAdded />} />
                <Route path="/tags" element={<TagsManagement />} />
                <Route path="/links" element={<Links />} />
                <Route path="/tiktok" element={<TikTok />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/admin" element={<Admin />} />
              </Route>
              <Route path="/shared/:token" element={<SharedAlbum />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AutoLockProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;