
"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase-config";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const logo = PlaceHolderImages.find(img => img.id === 'logo');
  const bg = PlaceHolderImages.find(img => img.id === 'login-bg');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Gagal",
        description: "Email atau password salah. Silakan coba lagi.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted p-4">
      {bg?.imageUrl && (
        <div className="absolute inset-0 z-0">
          <Image 
            src={bg.imageUrl} 
            alt={bg.description} 
            fill 
            className="object-cover opacity-10" 
            priority
          />
        </div>
      )}
      
      <Card className="relative z-10 w-full max-w-md shadow-2xl border-t-8 border-primary overflow-hidden">
        <CardHeader className="text-center space-y-4 pt-10">
          <div className="mx-auto w-24 h-24 relative rounded-full overflow-hidden bg-white p-1 shadow-inner">
            {logo?.imageUrl && (
              <Image 
                src={logo.imageUrl} 
                alt="Level Up Aceh Logo" 
                fill 
                className="object-contain"
                data-ai-hint="educational logo"
              />
            )}
          </div>
          <div>
            <CardTitle className="text-3xl font-bold font-headline text-primary">Level Up Aceh Private</CardTitle>
            <CardDescription className="text-sm">Silakan login untuk mengakses ujian Anda</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-10">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-11 text-lg font-semibold bg-primary hover:bg-primary/90 text-white transition-all shadow-md active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? "Memproses..." : "Masuk Sekarang"}
            </Button>
          </form>
          
          <div className="mt-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Level Up Aceh Private. Seluruh hak cipta dilindungi.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
