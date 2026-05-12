
"use client";

import { ProtectedRoute } from "@/components/auth/Protected-route";
import { useAppAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, MapPin, LayoutList, Loader2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CompleteProfilePage() {
  const { user, role, loading: authLoading } = useAppAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [initialClass, setInitialClass] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    
    // Admin bypass biodata
    if (role === 'admin') {
      router.replace("/dashboard");
      return;
    }
    
    const fetchProfile = async () => {
      try {
        const docSnap = await getDoc(doc(db, "userProfiles", user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data?.displayName || user?.displayName || "");
          setSchoolName(data?.schoolName || "");
          setInitialClass(data?.initialClass || "");
          
          // Cek Kelengkapan (Harus sama dengan DashboardPage)
          const nameComplete = !!(data?.displayName || "").trim();
          const schoolComplete = !!(data?.schoolName || "").trim();
          const isMan2 = (data?.schoolName || "").trim().toLowerCase().includes("man 2");
          const initialComplete = isMan2 ? !!(data?.initialClass || "").trim() : true;

          if (nameComplete && schoolComplete && initialComplete) {
            router.replace("/dashboard");
            return;
          }
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setFetchingProfile(false);
      }
    };
    
    fetchProfile();
  }, [user, role, authLoading, db, router]);

  const isMan2 = (schoolName || "").trim().toLowerCase().includes("man 2");

  const handleSave = () => {
    if (!user) return;
    
    const cleanName = name.trim();
    const cleanSchool = schoolName.trim();
    const cleanInitial = initialClass.trim();

    if (!cleanName) {
      toast({ variant: "destructive", title: "Nama Lengkap wajib diisi" });
      return;
    }
    if (!cleanSchool) {
      toast({ variant: "destructive", title: "Asal Sekolah wajib diisi" });
      return;
    }

    if (isMan2 && !cleanInitial) {
      toast({ variant: "destructive", title: "Khusus siswa MAN 2, mohon isi Inisial Kelas (contoh: F1)" });
      return;
    }

    setSaving(true);
    const profileRef = doc(db, "userProfiles", user.uid);
    const updatedData = {
      displayName: cleanName,
      schoolName: cleanSchool,
      initialClass: isMan2 ? cleanInitial : "",
      updatedAt: new Date().toISOString()
    };

    setDocumentNonBlocking(profileRef, updatedData, { merge: true });
    
    toast({ title: "Profil Disimpan", description: "Terima kasih telah melengkapi data diri Anda." });
    
    setTimeout(() => {
      setSaving(false);
      router.replace("/dashboard");
    }, 1200);
  };

  if (authLoading || (fetchingProfile && role !== 'admin')) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Menyiapkan profil...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-t-8 border-primary bg-white">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <User className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-primary">Biodata Siswa</CardTitle>
            <CardDescription>
              Lengkapi data singkat berikut untuk memulai ujian.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-bold text-sm">
                <User className="h-4 w-4 text-primary" /> Nama Lengkap
              </Label>
              <Input 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Nama Sesuai Ijazah" 
                className="bg-white h-11 border-2 focus:border-primary/50" 
              />
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-bold text-sm">
                <MapPin className="h-4 w-4 text-primary" /> Asal Sekolah
              </Label>
              <Input 
                value={schoolName} 
                onChange={(e) => setSchoolName(e.target.value)} 
                placeholder="Contoh: MAN 2 Banda Aceh" 
                className="bg-white h-11 border-2 focus:border-primary/50" 
              />
              <p className="text-[10px] text-muted-foreground italic">
                Siswa MAN 2 wajib memasukkan "MAN 2" pada asal sekolah.
              </p>
            </div>

            {isMan2 && (
              <div className={cn("space-y-2 animate-in fade-in slide-in-from-top-1")}>
                <Label className="flex items-center gap-2 text-primary font-bold text-sm">
                  <LayoutList className="h-4 w-4" /> Inisial Kelas (Khusus MAN 2)
                </Label>
                <Input 
                  value={initialClass} 
                  onChange={(e) => setInitialClass(e.target.value)} 
                  placeholder="Contoh: F1, F2, F3..." 
                  className="border-primary bg-white h-11 ring-primary/20 border-2" 
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-2">
            <Button className="w-full h-12 text-lg font-bold bg-primary shadow-lg hover:shadow-xl transition-all" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Menyimpan...</> : <span className="flex items-center gap-2">Mulai Dashboard <ChevronRight className="h-5 w-5" /></span>}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
