import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Users,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  UserCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NavbarProps {
  userRole?: "admin" | "leader" | "member";
  userName?: string;
  userPhoto?: string | null; // ✅ NOVO
}

const Navbar = ({ userRole, userName, userPhoto }: NavbarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);

  useEffect(() => {
    if (userRole === "admin") fetchActiveUsers();
  }, [userRole]);

  const fetchActiveUsers = async () => {
    const { count, error } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("status", "ativo");

    if (!error) setActiveUsers(count || 0);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", show: true },
    { to: "/atas", icon: FileText, label: "Atas", show: userRole === "admin" || userRole === "leader" },
    { to: "/celulas", icon: Users, label: "Células", show: true },
    {
      to: "/usuarios",
      icon: Shield,
      label: "Usuários",
      show: userRole === "admin",
      extra: activeUsers !== null ? (
        <Badge variant="outline" className="ml-2 text-xs">{activeUsers}</Badge>
      ) : null,
    },
  ];

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {navItems
        .filter((item) => item.show)
        .map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;

          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => mobile && setOpen(false)}
              className={`flex items-center justify-between px-4 py-2 rounded-lg transition-all ${isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent-light"
                }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </div>
              {item.extra && item.extra}
            </Link>
          );
        })}
    </>
  );

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <div className="font-bold text-xl text-primary">IPR Sinop</div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2">
            <NavLinks />
          </div>

          {/* User Info */}
          <div className="hidden md:flex items-center space-x-4">
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => navigate("/perfil")}
            >
              {/* ✅ Avatar com fallback */}
              <Avatar className="h-9 w-9 border">
                {userPhoto ? (
                  <AvatarImage src={userPhoto} alt={userName || "Usuário"} />
                ) : (
                  <AvatarFallback>
                    {userName
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>

              <div className="flex flex-col items-start">
                <p className="text-sm font-medium text-foreground flex items-center gap-1">
                  <UserCircle className="h-4 w-4 text-primary" />
                  {userName}
                </p>
                <Badge
                  variant={
                    userRole === "admin"
                      ? "default"
                      : userRole === "leader"
                        ? "secondary"
                        : "outline"
                  }
                  className="capitalize text-xs"
                >
                  {userRole}
                </Badge>
              </div>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={handleLogout}
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <div className="flex flex-col space-y-4 mt-8">
                  <div
                    className="pb-4 border-b border-border flex items-center gap-3 cursor-pointer"
                    onClick={() => {
                      setOpen(false);
                      navigate("/perfil");
                    }}
                  >
                    <Avatar className="h-10 w-10 border">
                      {userPhoto ? (
                        <AvatarImage src={userPhoto} alt={userName || "Usuário"} />
                      ) : (
                        <AvatarFallback>
                          {userName
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")
                            .substring(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{userName}</p>
                      <Badge
                        variant={
                          userRole === "admin"
                            ? "default"
                            : userRole === "leader"
                              ? "secondary"
                              : "outline"
                        }
                        className="capitalize text-xs mt-1"
                      >
                        {userRole}
                      </Badge>
                    </div>
                  </div>

                  <NavLinks mobile />

                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    className="w-full justify-start"
                  >
                    <LogOut className="h-5 w-5 mr-2" />
                    Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
