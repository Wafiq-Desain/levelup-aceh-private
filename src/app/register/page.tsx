
"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase-config";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import Link from "next/link";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const logo = PlaceHolderImages.find(img => img.id === 'logo');
  const bg = PlaceHolderImages.find(img => img.id === 'login-bg');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Password Tidak Cocok",
        description: "Konfirmasi password harus sama dengan password.",
      });
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update auth profile
      await updateProfile(user, { displayName: name });

      // Create UserProfile in Firestore
      await setDoc(doc(db, "userProfiles", user.uid), {
        id: user.uid,
        email: email,
        displayName: name,
        role: "student",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Also ensure the auth context picks up the student role by default if not redirected yet
      // (The AuthProvider handles this logic, but setting the doc is primary)
      
      toast({
        title: "Pendaftaran Berhasil",
        description: "Selamat datang di Level Up Aceh Private!",
      });
      
      router.push("/dashboard");
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Pendaftaran Gagal",
        description: error.message || "Terjadi kesalahan saat mendaftar.",
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
            <CardTitle className="text-3xl font-bold font-headline text-primary">Daftar Akun Baru</CardTitle>
            <CardDescription className="text-sm">Bergabunglah untuk memulai persiapan ujian Anda</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-10">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input
                id="name"
                type="text"
                placeholder="Nama Lengkap"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Ulangi password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-11 text-lg font-semibold bg-primary hover:bg-primary/90 text-white transition-all shadow-md active:scale-[0.98] mt-4"
              disabled={loading}
            >
              {loading ? "Mendaftarkan..." : "Daftar Sekarang"}
            </Button>
          </form>
          
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Sudah punya akun? </span>
            <Link href="/login" className="text-primary font-bold hover:underline">
              Masuk di sini
            </Link>
          </div>
          
          <div className="mt-8 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Level Up Aceh Private. Seluruh hak cipta dilindungi.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
