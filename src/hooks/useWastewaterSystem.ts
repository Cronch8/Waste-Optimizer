import { useState, useEffect, useCallback } from 'react';
import { SystemState, Pump, ElectricityPrice } from '@/types/wastewater';
import { generateMockPumpSchedule, PumpScheduleEntry } from '../data/mockPumpSchedule.ts';

const TUNNEL_MAX_CAPACITY = 1000; // m³
const TANK_MAX_CAPACITY = 800; // m³
const UPDATE_INTERVAL = 2000; // 2 seconds
const TUNNEL_CRITICAL = 85; // %
const TANK_CRITICAL = 90; // %

// Generate initial pumps (6 pumps total)
const generateInitialPumps = (): Pump[] => {
  const pumps: Pump[] = [];
  
  // Group 1: Pumps 1-3 (top group)
  for (let i = 1; i <= 4; i++) {
    pumps.push({
      id: `pump-1-${i}`,
      number: Number(`1${i}`),
      active: i === 1,
      flowRate: 100,
      powerConsumption: 45,
      x: 250,
      y: 50 + (i - 1) * 100,
    });
  }
  
  // Group 2: Pumps 4-6 (bottom group)
  for (let i = 1; i <= 4; i++) {
    pumps.push({
      id: `pump-2-${i}`,
      number: Number(`2${i}`),
      active: false,
      flowRate: 100,
      powerConsumption: 45,
      x: 350,
      y: 50 + (i - 1) * 100,
    });
  }
  
  return pumps;
};

// Generate synthetic electricity prices
const generateElectricityPrices = (): ElectricityPrice[] => {
  const prices: ElectricityPrice[] = [];
  const now = new Date();
  
  for (let i = -24; i <= 0; i++) {
    const timestamp = new Date(now.getTime() + i * 60 * 60 * 1000);
    const hour = timestamp.getHours();
    
    let basePrice = 0.15;
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 21)) {
      basePrice = 0.35;
    } else if (hour >= 22 || hour <= 6) {
      basePrice = 0.08;
    }
    
    const price = basePrice + (Math.random() - 0.5) * 0.05;
    prices.push({ timestamp, price });
  }
  
  return prices;
};

// Predict inflow based on time of day
const predictInflow = (): number => {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour <= 22) {
    return 80 + Math.random() * 40;
  } else {
    return 30 + Math.random() * 20;
  }
};

interface UseWastewaterSystemOptions {
  useSchedule?: boolean; // Toggle between AI optimization and schedule
  scheduleInterval?: number; // How often to switch to next schedule entry (ms)
  customSchedule?: PumpScheduleEntry[]; // Provide your own JSON schedule
}

export const useWastewaterSystem = (options: UseWastewaterSystemOptions = {}) => {
  const { 
    useSchedule = false, 
    scheduleInterval = 15000, // Default 15 seconds
    customSchedule 
  } = options;
  
  const [systemState, setSystemState] = useState<SystemState>({
    pumps: generateInitialPumps(),
    tunnel: {
      level: 45,
      maxCapacity: TUNNEL_MAX_CAPACITY,
      inflow: 90,
    },
    tank: {
      level: 35,
      maxCapacity: TANK_MAX_CAPACITY,
      outflow: 50,
    },
    totalEnergyUsage: 45,
    electricityPrices: generateElectricityPrices(),
    aiStatus: 'stable',
    currentCost: 0,
  });

  // Use custom schedule if provided, otherwise generate mock data
  const [pumpSchedule] = useState<PumpScheduleEntry[]>(() => 
    customSchedule || generateMockPumpSchedule()
  );
  const [scheduleIndex, setScheduleIndex] = useState(0);

  // AI Optimization Logic
  const optimizePumps = useCallback((state: SystemState): Pump[] => {
    const currentPrice = state.electricityPrices[state.electricityPrices.length - 1].price;
    const tunnelLevel = state.tunnel.level;
    const tankLevel = state.tank.level;
    const inflow = state.tunnel.inflow;
    
    let targetActivePumps = 1;
    
    if (tunnelLevel > TUNNEL_CRITICAL) {
      targetActivePumps = Math.min(6, Math.ceil(tunnelLevel / 15));
    } else if (tankLevel > TANK_CRITICAL) {
      targetActivePumps = 1;
    } else {
      if (currentPrice < 0.12) {
        targetActivePumps = Math.max(2, Math.ceil(inflow / 100));
      } else if (currentPrice > 0.30) {
        targetActivePumps = Math.max(1, Math.ceil(tunnelLevel / 40));
      } else {
        targetActivePumps = Math.max(1, Math.ceil(inflow / 120));
      }
    }
    
    const newPumps = state.pumps.map((pump, index) => ({
      ...pump,
      active: index < targetActivePumps,
    }));
    
    return newPumps;
  }, []);

  // Apply pump schedule from JSON
  const applyPumpSchedule = useCallback((state: SystemState, scheduleEntry: PumpScheduleEntry): Pump[] => {
    // Map the 6 pumps (indices 0-5) to the schedule IDs (1-6)
    return state.pumps.map((pump, index) => {
      // index 0 = pump id 1, index 1 = pump id 2, etc.
      const scheduledPump = scheduleEntry.Pumps[index]; // Direct array access by index
      console.log(`Pump ${index + 1} (${pump.id}): scheduled=${scheduledPump?.active}, current=${pump.active}`);
      return {
        ...pump,
        active: scheduledPump?.active ?? false,
      };
    });
  }, []);

  // Schedule interval effect - switches to next schedule entry
  useEffect(() => {
    if (!useSchedule) return;

    console.log(`Starting schedule mode. Total entries: ${pumpSchedule.length}`);
    console.log(`Current entry (${scheduleIndex}):`, pumpSchedule[scheduleIndex]);

    const scheduleTimer = setInterval(() => {
      setScheduleIndex((prev) => {
        const next = (prev + 1) % pumpSchedule.length;
        console.log(`Switching to schedule entry ${next}:`, pumpSchedule[next]);
        return next;
      });
    }, scheduleInterval);

    return () => clearInterval(scheduleTimer);
  }, [useSchedule, scheduleInterval, pumpSchedule, scheduleIndex]);

  // Main simulation update
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemState((prev) => {
        const deltaTime = UPDATE_INTERVAL / 3600000;
        const newInflow = predictInflow();
        
        // Choose pump configuration method
        const optimizedPumps = useSchedule 
          ? applyPumpSchedule(prev, pumpSchedule[scheduleIndex])
          : optimizePumps(prev);
        
        const totalPumpFlow = optimizedPumps
          .filter(p => p.active)
          .reduce((sum, p) => sum + p.flowRate, 0);
        
        // Update tunnel level
        const tunnelInflowVolume = newInflow * deltaTime;
        const tunnelOutflowVolume = totalPumpFlow * deltaTime;
        const tunnelVolumeChange = tunnelInflowVolume - tunnelOutflowVolume;
        const newTunnelVolume = Math.max(0, Math.min(
          TUNNEL_MAX_CAPACITY,
          (prev.tunnel.level / 100) * TUNNEL_MAX_CAPACITY + tunnelVolumeChange
        ));
        const newTunnelLevel = (newTunnelVolume / TUNNEL_MAX_CAPACITY) * 100;
        
        // Update tank level
        const tankInflowVolume = totalPumpFlow * deltaTime;
        const tankOutflowVolume = prev.tank.outflow * deltaTime;
        const tankVolumeChange = tankInflowVolume - tankOutflowVolume;
        const newTankVolume = Math.max(0, Math.min(
          TANK_MAX_CAPACITY,
          (prev.tank.level / 100) * TANK_MAX_CAPACITY + tankVolumeChange
        ));
        const newTankLevel = (newTankVolume / TANK_MAX_CAPACITY) * 100;
        
        const totalEnergy = optimizedPumps
          .filter(p => p.active)
          .reduce((sum, p) => sum + p.powerConsumption, 0);
        
        const currentPrice = prev.electricityPrices[prev.electricityPrices.length - 1].price;
        const currentCost = totalEnergy * currentPrice;
        
        let aiStatus: 'optimizing' | 'stable' | 'warning' = 'stable';
        if (newTunnelLevel > TUNNEL_CRITICAL || newTankLevel > TANK_CRITICAL) {
          aiStatus = 'warning';
        } else if (currentPrice > 0.25 && optimizedPumps.filter(p => p.active).length > 2) {
          aiStatus = 'optimizing';
        }
        
        let newPrices = [...prev.electricityPrices];
        if (Math.random() < 0.1) {
          const lastPrice = newPrices[newPrices.length - 1];
          newPrices.push({
            timestamp: new Date(lastPrice.timestamp.getTime() + 60 * 60 * 1000),
            price: Math.max(0.05, Math.min(0.5, lastPrice.price + (Math.random() - 0.5) * 0.1)),
          });
          if (newPrices.length > 25) {
            newPrices = newPrices.slice(-25);
          }
        }
        
        return {
          pumps: optimizedPumps,
          tunnel: {
            ...prev.tunnel,
            level: newTunnelLevel,
            inflow: newInflow,
          },
          tank: {
            ...prev.tank,
            level: newTankLevel,
          },
          totalEnergyUsage: totalEnergy,
          electricityPrices: newPrices,
          aiStatus,
          currentCost,
        };
      });
    }, UPDATE_INTERVAL);
    
    return () => clearInterval(interval);
  }, [optimizePumps, applyPumpSchedule, useSchedule, pumpSchedule, scheduleIndex]);

  return {
    ...systemState,
    currentScheduleEntry: useSchedule ? pumpSchedule[scheduleIndex] : null,
    scheduleIndex,
    totalScheduleEntries: pumpSchedule.length,
  };
};

// Usage examples:
// 1. AI optimization mode (default)
// const system = useWastewaterSystem();

// 2. Schedule mode with generated data (15s intervals)
// const system = useWastewaterSystem({ useSchedule: true });

// 3. Custom schedule from your JSON
// const mySchedule = [
//   {
//     Datetime: "12-15-2025 12:30:00",
//     Pumps: [
//       { id: 1, active: true },
//       { id: 2, active: true },
//       { id: 3, active: false },
//       { id: 4, active: false },
//       { id: 5, active: false },
//       { id: 6, active: false }
//     ]
//   },
//   // ... more entries
// ];
// const system = useWastewaterSystem({ 
//   useSchedule: true, 
//   customSchedule: mySchedule,
//   scheduleInterval: 5000 // 5 seconds
// });