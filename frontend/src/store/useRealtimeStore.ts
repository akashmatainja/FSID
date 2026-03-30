"use client";
import { create } from "zustand";
import type { MachineStat } from "@/types";

const MAX_TIMESERIES = 200;
const MAX_FEED = 20;

interface TimeSeriesPoint {
  ts: string;
  value: number;
}

interface RealtimeStore {
  // Last value per machine per metric
  latestValues: Record<string, Record<string, number>>;
  // Time series buffer per machine per metric
  timeSeries: Record<string, Record<string, TimeSeriesPoint[]>>;
  // Live feed (last 20 events)
  liveFeed: MachineStat[];
  lastUpdated: Date | null;
  isLive: boolean;

  addStat: (stat: MachineStat) => void;
  setLive: (live: boolean) => void;
  reset: () => void;
}

export const useRealtimeStore = create<RealtimeStore>((set) => ({
  latestValues: {},
  timeSeries: {},
  liveFeed: [],
  lastUpdated: null,
  isLive: false,

  addStat: (stat) =>
    set((state) => {
      const machineKey = stat.machine_id;
      const metricKey = stat.metric_key;

      // Update latest values
      const latestValues = {
        ...state.latestValues,
        [machineKey]: {
          ...(state.latestValues[machineKey] || {}),
          [metricKey]: stat.metric_value,
        },
      };

      // Update time series (capped at MAX_TIMESERIES)
      const existing =
        state.timeSeries[machineKey]?.[metricKey] || [];
      const newPoint: TimeSeriesPoint = { ts: stat.ts, value: stat.metric_value };
      const updatedSeries = [...existing, newPoint].slice(-MAX_TIMESERIES);

      const timeSeries = {
        ...state.timeSeries,
        [machineKey]: {
          ...(state.timeSeries[machineKey] || {}),
          [metricKey]: updatedSeries,
        },
      };

      // Update live feed
      const liveFeed = [stat, ...state.liveFeed].slice(0, MAX_FEED);

      return { latestValues, timeSeries, liveFeed, lastUpdated: new Date(), isLive: true };
    }),

  setLive: (isLive) => set({ isLive }),
  reset: () =>
    set({ latestValues: {}, timeSeries: {}, liveFeed: [], lastUpdated: null, isLive: false }),
}));
