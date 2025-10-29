import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// 🔹 Páginas
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Minutes from "./pages/Minutes";
import Cells from "./pages/Cells";
import NewCell from "./pages/NewCell";
import CellDetails from "./pages/CellDetails";
import ProfilesAdmin from "./pages/ProfilesAdmin";
import UserProfile from "./pages/UserProfile";
import NotFound from "./pages/NotFound";
import Feed from "./pages/Feed";
import UserPublicProfile from "./pages/UserPublicProfile";



const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* 🔹 Rotas públicas */}
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />

          {/* 🔹 Rotas com Navbar (já integrada dentro de cada página) */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/atas" element={<Minutes />} />
          <Route path="/celulas" element={<Cells />} />
          <Route path="/celulas/nova" element={<NewCell />} />
          <Route path="/celulas/:id" element={<CellDetails />} />
          <Route path="/usuarios" element={<ProfilesAdmin />} />
          <Route path="/perfil" element={<UserProfile />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/perfil/:id" element={<UserPublicProfile />} />


          {/* 🚫 404 - Página não encontrada */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
