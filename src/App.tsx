import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
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
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;