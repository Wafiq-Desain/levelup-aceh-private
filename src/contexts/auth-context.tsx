
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useAuth, useFirestore } from "@/firebase";

interface AuthContextType {
  user: User | null;
  role: "admin" | "student" | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"admin" | "student" | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = useAuth();
  const db = useFirestore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          // Priority check: adminUsers collection
          const adminDoc = await getDoc(doc(db, "adminUsers", firebaseUser.uid));
          if (adminDoc.exists()) {
            setRole("admin");
          } else {
            // Fallback: check userProfiles
            const userDoc = await getDoc(doc(db, "userProfiles", firebaseUser.uid));
            if (userDoc.exists()) {
              setRole(userDoc.data().role === "admin" ? "admin" : "student");
            } else {
              setRole("student");
            }
          }
        } catch (error) {
          console.error("Error fetching role:", error);
          setRole("student");
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, db]);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAppAuth = () => useContext(AuthContext);
