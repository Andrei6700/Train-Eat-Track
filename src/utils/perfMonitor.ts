import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Platform } from "react-native";

const isDev = __DEV__;
const appStartTime = Date.now();

type Listener = (events: string[]) => void;
const listeners = new Set<Listener>();
const events: string[] = [];

const addEvent = (msg: string) => {
  if (!isDev) return;
  events.push(msg);
  if (events.length > 5) {
    events.shift();
  }
  listeners.forEach((l) => l([...events]));
};

export const subscribeToPerfEvents = (listener: Listener) => {
  listener([...events]);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const trackScreen = (screenName: string, durationMs?: number) => {
  if (isDev) {
    const elapsed = Date.now() - appStartTime;
    const value = durationMs !== undefined ? durationMs : elapsed;
    const msg = `[PERF] screen | ${screenName} | ${value}ms | mount`;
    console.log(msg);
    addEvent(msg);
  }
};

export const trackDataLoad = (
  key: string,
  source: string,
  durationMs: number,
  itemCount: number
) => {
  if (isDev) {
    const msg = `[PERF] data_load | ${key} | ${durationMs}ms | ${source} (items: ${itemCount})`;
    console.log(msg);
    addEvent(msg);
  }
};

export const trackCacheHit = (key: string, ageMs: number) => {
  if (isDev) {
    const msg = `[PERF] cache_hit | ${key} | ${ageMs}ms | cache`;
    console.log(msg);
    addEvent(msg);
  }
};

export const trackCacheMiss = (key: string) => {
  if (isDev) {
    const msg = `[PERF] cache_miss | ${key} | 0ms | cache`;
    console.log(msg);
    addEvent(msg);
  }
};

export const trackRender = (componentName: string, durationMs: number) => {
  if (isDev) {
    if (durationMs > 100) {
      const msg = `[PERF] render | ${componentName} | ${durationMs}ms | render`;
      console.log(msg);
      addEvent(msg);
    }
  }
};

// DEV performance monitoring overlay React component
export const PerfOverlay = () => {
  return null;
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    bottom: 95,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    padding: 6,
    borderRadius: 8,
    zIndex: 9999,
    alignItems: "center",
  },
  text: {
    color: "#00ff00",
    fontSize: 9,
    fontFamily: Platform.select({ ios: "Courier New", android: "monospace" }),
    textAlign: "center",
  },
});
