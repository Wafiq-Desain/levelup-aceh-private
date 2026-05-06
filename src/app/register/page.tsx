
"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useAuth, useFirestore } from "@/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const db = useFirestore();

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

    if (!studentClass || !schoolName || !phoneNumber) {
      toast({
        variant: "destructive",
        title: "Biodata Belum Lengkap",
        description: "Silakan lengkapi seluruh biodata Anda (Kelas, Sekolah, dan Nomor WA).",
      });
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });

      await setDoc(doc(db, "userProfiles", user.uid), {
        id: user.uid,
        email: email,
        displayName: name,
        role: "student",
        class: studentClass,
        schoolName: schoolName,
        phoneNumber: phoneNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      toast({
        title: "Pendaftaran Berhasil",
        description: "Selamat datang di Level Up Aceh Private!",
      });
      
      router.push("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Pendaftaran Gagal",
        description: error.message || "Terjadi kesalahan saat mendaftar.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const profileRef = doc(db, "userProfiles", user.uid);
      const profileSnap = await getDoc(profileRef);
      
      if (!profileSnap.exists()) {
        await setDoc(profileRef, {
          id: user.uid,
          email: user.email,
          displayName: user.displayName || "Siswa Baru",
          role: "student",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Google Auth Error:", error);
      let message = "Gagal menyambungkan dengan Google.";
      
      if (error.code === 'auth/unauthorized-domain') {
        message = "Domain ini belum diizinkan di Firebase Console. Silakan tambahkan domain ini ke 'Authorized Domains' di Settings Authentication.";
      }
      
      toast({
        variant: "destructive",
        title: "Google Auth Gagal",
        description: message,
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
            data-ai-hint="university building"
          />
        </div>
      )}
      
      <Card className="relative z-10 w-full max-w-md shadow-2xl border-t-8 border-primary overflow-hidden">
        <CardHeader className="text-center space-y-4 pt-10">
          <div className="mx-auto w-24 h-24 relative rounded-full overflow-hidden bg-white p-1 shadow-inner">
            {logo?.imageUrl ? (
              <Image 
                src={logo.imageUrl} 
                alt="Level Up Aceh Logo" 
                fill 
                className="object-contain"
                data-ai-hint="educational logo"
              />
            ) : null}
          </div>
          <div>
            <CardTitle className="text-3xl font-bold text-primary">Daftar Akun Baru</CardTitle>
            <CardDescription className="text-sm">Bergabunglah untuk memulai persiapan ujian Anda</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-10 space-y-4">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="class">Pilih Kelas</Label>
                <Select value={studentClass} onValueChange={setStudentClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10 SMA">10 SMA</SelectItem>
                    <SelectItem value="11 SMA">11 SMA</SelectItem>
                    <SelectItem value="12 SMA">12 SMA</SelectItem>
                    <SelectItem value="Gapyear">Gapyear</SelectItem>
                    <SelectItem value="Kedinasan">Kedinasan</SelectItem>
                    <SelectItem value="Lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Nomor WA</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="0812..."
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schoolName">Asal Sekolah</Label>
              <Input
                id="schoolName"
                type="text"
                placeholder="Contoh: SMAN 1 Banda Aceh"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
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

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Atau daftar dengan Google</span>
            </div>
          </div>

          <Button 
            type="button"
            variant="outline" 
            className="w-full h-11 border-2 font-bold flex items-center justify-center gap-2 hover:bg-muted transition-colors"
            onClick={handleGoogleRegister}
            disabled={loading}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Daftar dengan Google
          </Button>
          
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Sudah punya akun? </span>
            <Link href="/login" className="text-primary font-bold hover:underline">
              Masuk di sini
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
