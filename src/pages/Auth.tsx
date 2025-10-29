// src/pages/Auth.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, LogIn } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Verificar sessão ativa
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Verifica se o perfil está ativo antes de prosseguir
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", session.user.id)
          .maybeSingle();

        if (userProfile?.status === "ativo") {
          navigate("/dashboard");
        } else {
          await supabase.auth.signOut();
          toast({
            title: "Acesso negado",
            description: "Sua conta está inativa. Entre em contato com a secretaria.",
            variant: "destructive",
          });
        }
      }
      setChecking(false);
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          const { data: userProfile } = await supabase
            .from("profiles")
            .select("status")
            .eq("id", session.user.id)
            .maybeSingle();

          if (userProfile?.status === "ativo") {
            navigate("/dashboard");
          } else {
            await supabase.auth.signOut();
            toast({
              title: "Acesso negado",
              description: "Sua conta está inativa. Entre em contato com a secretaria.",
              variant: "destructive",
            });
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Login com Google
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl },
      });
      if (error) throw error;
    } catch (e: any) {
      toast({
        title: "Erro ao conectar com Google",
        description: e.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  // Login ou registro com e-mail/senha
  const handleEmailAuth = async () => {
    try {
      setLoading(true);

      if (!email || !password) {
        toast({
          title: "Preencha todos os campos",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // 🔒 Verifica se o perfil está ativo
        const { data: userProfile, error: profileError } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", data.user?.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (userProfile?.status !== "ativo") {
          await supabase.auth.signOut();
          toast({
            title: "Acesso negado",
            description:
              "Sua conta está inativa. Entre em contato com a secretaria.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        toast({ title: "Login realizado com sucesso!" });
        navigate("/dashboard");
      } else {
        // Registro
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        // Criação automática no perfil
        if (signUpData?.user) {
          await supabase.from("profiles").upsert({
            id: signUpData.user.id,
            full_name: signUpData.user.email?.split("@")[0] || "Novo membro",
            role: "member",
            status: "ativo",
          });
        }

        toast({
          title: "Conta criada!",
          description: "Verifique seu e-mail para confirmar o cadastro.",
        });
      }
    } catch (e: any) {
      toast({
        title: "Erro na autenticação",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <Loader2 className="h-8 w-8 animate-spin text-primary-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary via-primary-light to-primary p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary-foreground mb-2 drop-shadow">
            IPR Sinop
          </h1>
          <p className="text-lg text-primary-foreground/90">
            Sistema de Gestão Eclesiástica
          </p>
        </div>

        <Card className="shadow-2xl border-border/40 backdrop-blur-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {mode === "login" ? "Acesso ao Sistema" : "Criar Conta"}
            </CardTitle>
            <CardDescription className="text-center">
              {mode === "login"
                ? "Entre com sua conta ou use o Google"
                : "Cadastre-se com seu e-mail pessoal"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Campos de e-mail e senha */}
            <div className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Seu e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Button
                className="w-full h-12 text-base"
                disabled={loading}
                onClick={handleEmailAuth}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    {mode === "login" ? "Entrar" : "Cadastrar"}
                  </>
                )}
              </Button>
            </div>

            {/* Separador */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-muted" />
              <span className="text-xs text-muted-foreground">ou</span>
              <div className="flex-1 h-px bg-muted" />
            </div>

            {/* Login Google */}
            <Button
              variant="outline"
              className="w-full h-12 text-base"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <svg
                    className="mr-2 h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Entrar com Google
                </>
              )}
            </Button>

            {/* Alternância login/cadastro */}
            <div className="text-center text-sm text-muted-foreground pt-4">
              {mode === "login" ? (
                <>
                  Não tem conta?{" "}
                  <button
                    onClick={() => setMode("register")}
                    className="text-primary underline font-medium"
                  >
                    Criar agora
                  </button>
                </>
              ) : (
                <>
                  Já possui conta?{" "}
                  <button
                    onClick={() => setMode("login")}
                    className="text-primary underline font-medium"
                  >
                    Fazer login
                  </button>
                </>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center pt-2">
              Acesso restrito a membros autorizados da IPR Sinop. <br />
              Em caso de dúvida, entre em contato com a secretaria.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
