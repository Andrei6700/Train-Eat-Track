/**
 * firestoreHelpers.ts
 *
 * Shared Firestore utility functions to eliminate duplicated
 * doc/collection/get/set/update patterns across services.
 */

import { firestore } from "@/src/config/firebase";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    setDoc,
    Timestamp,
    updateDoc,
    where,
    type DocumentData,
    type QueryConstraint,
} from "firebase/firestore";

export const toDate = (value: unknown): Date => {
    if (value instanceof Date) return value;
    if (typeof value === "object" && value !== null && "toDate" in value) {
        const fn = (value as { toDate?: () => Date }).toDate;
        if (typeof fn === "function") {
            const parsed = fn();
            if (parsed instanceof Date) return parsed;
        }
    }
    if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
};

export const toMillis = (value: unknown): number | null => {
    if (!value) return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
    }
    return toDate(value).getTime();
};

export const fromDate = (date: Date): Timestamp => Timestamp.fromDate(date);

export const fetchDoc = async <T = DocumentData>(
    collectionName: string,
    docId: string,
): Promise<T | null> => {
    try {
        const ref = doc(firestore, collectionName, docId);
        const snap = await getDoc(ref);
        return snap.exists() ? (snap.data() as T) : null;
    } catch (error) {
        if (__DEV__) console.error(`[Firestore] fetchDoc failed:`, error);
        return null;
    }
};

export const fetchDocs = async <T = DocumentData>(
    collectionName: string,
    constraints: QueryConstraint[],
): Promise<T[]> => {
    try {
        const colRef = collection(firestore, collectionName);
        const q = query(colRef, ...constraints);
        const snap = await getDocs(q);
        return snap.docs.map((d) => d.data() as T);
    } catch (error) {
        if (__DEV__) console.error(`[Firestore] fetchDocs failed:`, error);
        return [];
    }
};

export const fetchUserDocs = async <T = DocumentData>(
    collectionName: string,
    userId: string,
    orderByField = "date",
    orderDir: "asc" | "desc" = "desc",
): Promise<T[]> => {
    return fetchDocs<T>(collectionName, [
        where("userID", "==", userId),
        orderBy(orderByField, orderDir),
    ]);
};

export const setDocument = async (
    collectionName: string,
    docId: string,
    data: DocumentData,
): Promise<boolean> => {
    try {
        const ref = doc(firestore, collectionName, docId);
        await setDoc(ref, data, { merge: true });
        return true;
    } catch (error) {
        if (__DEV__) console.error(`[Firestore] setDocument failed:`, error);
        return false;
    }
};

export const updateDocument = async (
    collectionName: string,
    docId: string,
    data: Partial<DocumentData>,
): Promise<boolean> => {
    try {
        const ref = doc(firestore, collectionName, docId);
        await updateDoc(ref, data as DocumentData);
        return true;
    } catch (error) {
        if (__DEV__) console.error(`[Firestore] updateDocument failed:`, error);
        return false;
    }
};

export {
    collection,
    doc,
    getDoc,
    getDocs, orderBy, query, setDoc, Timestamp, updateDoc, where
};
