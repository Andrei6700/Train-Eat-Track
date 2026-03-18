import { auth, firestore } from "@/src/config/firebase";
import { clearNutritionCalendarSummaryCache } from "@/src/services/nutritionCalendarCacheService";
import { clearWorkoutHistoryCache } from "@/src/services/workoutHistoryCacheService";
import { AuthContextType, UserType } from '@/src/types/index';
import {
  checkAuthRateLimit,
  recordFailedAuthAttempt,
  recordSuccessfulAuth
} from "@/src/utils/rateLimit";
import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserType>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser?.uid,
          email: firebaseUser?.email,
          name: firebaseUser?.displayName,
        });
        updateUserData(firebaseUser.uid);
        router.replace("/(tabs)");
      } else {
        // no user
        setUser(null);
        void clearWorkoutHistoryCache();
        void clearNutritionCalendarSummaryCache();
        router.replace("/(auth)/welcome");
      }
    });
    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // Check rate limiting
      const rateLimitCheck = await checkAuthRateLimit();
      if (rateLimitCheck.isLocked) {
        return { success: false, msg: rateLimitCheck.message || "Too many attempts" };
      }

      await signInWithEmailAndPassword(auth, email, password);

      // Clear rate limit on successful login
      await recordSuccessfulAuth();

      return { success: true };
    } catch (error: any) {
      // Record failed attempt
      await recordFailedAuthAttempt();

      let msg = error.message;
      // Don't log the full error which may contain sensitive info
      console.error("[Auth] Login failed:", error.code || "unknown error");
      if (msg.includes("(auth/invalid-credential)")) msg = "Wrong credentials";
      if (msg.includes("(auth/invalid-email)")) msg = "Invalid email";
      if (msg.includes("(auth/network-request-failed)")) msg = "Network error, please try again";
      if (msg.includes("(auth/too-many-requests)")) msg = "Too many failed attempts. Please try again later";
      return { success: false, msg };
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      let response = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      await setDoc(doc(firestore, "users", response?.user?.uid), {
        name,
        email,
        uid: response?.user?.uid,
      });
      return { success: true };
    } catch (error: any) {
      let msg = error.message;
      // Don't log the full error which may contain sensitive info
      console.error("[Auth] Registration failed:", error.code || "unknown error");
      if (msg.includes("(auth/email-already-in-use)")) msg = "This email is already in use";
      if (msg.includes("(auth/invalid-email)")) msg = "Invalid email";
      if (msg.includes("(auth/weak-password)")) msg = "Password is too weak";
      if (msg.includes("(auth/network-request-failed)")) msg = "Network error, please try again";
      return { success: false, msg };
    }
  };

  const updateUserData = async (uid: string) => {
    try {
      const docRef = doc(firestore, "users", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const userData: UserType = {
          uid: data?.uid,
          email: data.email || null,
          name: data.name || null,
          image: data.image || null,
        };
        setUser({ ...userData });
      }
    } catch (error: any) {
      // Don't log sensitive user data
      console.error("[Auth] Failed to update user data:", error.code || "unknown error");
    }
  };

  const contextValue: AuthContextType = {
    user,
    setUser,
    login,
    register,
    updateUserData,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
