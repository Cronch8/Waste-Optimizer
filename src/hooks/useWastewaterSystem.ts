import { useState, useEffect, useCallback } from 'react';
import { SystemState, Pump, ElectricityPrice } from '@/types/wastewater';

const TUNNEL_MAX_CAPACITY = 1000; // m³
const TANK_MAX_CAPACITY = 800; // m³
const UPDATE_INTERVAL = 2000; // 2 seconds
const TUNNEL_CRITICAL = 85; // %
const TANK_CRITICAL = 90; // %

// Generate initial pumps (10 pumps)
const generateInitialPumps = (): Pump[] => {
  const pumps: Pump[] = [];
  
  // Group 1: Pumps 1-4 (top group)
  for (let i = 1; i <= 4; i++) {
    pumps.push({
      id: `pump-1-${i}`,
      number: Number(`1${i}`),
      active: i === 1, // Only first pump active initially
      flowRate: 100,
      powerConsumption: 45,
      x: 250,
      y: 50 + (i - 1) * 80,
    });
  }
  
  // Group 2: Pumps 2-1 to 2-4 (middle group)
  for (let i = 1; i <= 4; i++) {
    pumps.push({
      id: `pump-2-${i}`,
      number: Number(`2${i}`),
      active: false,
      flowRate: 100,
      powerConsumption: 45,
      x: 350,
      y: 150 + (i - 1) * 80,
    });
  }
  
  // Group 3: Pumps 3-1 and 3-2 (bottom group)
  for (let i = 1; i <= 2; i++) {
    pumps.push({
      id: `pump-3-${i}`,
      number: Number(`3${i}`),
      active: false,
      flowRate: 100,
      powerConsumption: 45,
      x: 250,
      y: 450 + (i - 1) * 80,
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
    
    // Higher prices during peak hours (7-9 AM, 5-9 PM)
    let basePrice = 0.15;
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 21)) {
      basePrice = 0.35;
    } else if (hour >= 22 || hour <= 6) {
      basePrice = 0.08; // Cheap at night
    }
    
    // Add some randomness
    const price = basePrice + (Math.random() - 0.5) * 0.05;
    prices.push({ timestamp, price });
  }
  
  return prices;
};

// Predict inflow based on time of day
const predictInflow = (): number => {
  const hour = new Date().getHours();
  
  // Higher inflow during day, lower at night
  if (hour >= 6 && hour <= 22) {
    return 80 + Math.random() * 40; // 80-120 m³/h
  } else {
    return 30 + Math.random() * 20; // 30-50 m³/h
  }
};

export const useWastewaterSystem = () => {
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

  // AI Optimization Logic
  const optimizePumps = useCallback((state: SystemState): Pump[] => {
    const currentPrice = state.electricityPrices[state.electricityPrices.length - 1].price;
    const tunnelLevel = state.tunnel.level;
    const tankLevel = state.tank.level;
    const inflow = state.tunnel.inflow;
    
    let targetActivePumps = 1;
    
    // Emergency: Tunnel is filling up
    if (tunnelLevel > TUNNEL_CRITICAL) {
      targetActivePumps = Math.min(6, Math.ceil(tunnelLevel / 15));
    }
    // Tank is getting full
    else if (tankLevel > TANK_CRITICAL) {
      targetActivePumps = 1; // Minimum pumps to avoid overfilling tank
    }
    // Normal operation: balance cost and inflow
    else {
      if (currentPrice < 0.12) {
        // Cheap electricity: run more pumps to drain tunnel
        targetActivePumps = Math.max(2, Math.ceil(inflow / 100));
      } else if (currentPrice > 0.30) {
        // Expensive electricity: minimal pumps
        targetActivePumps = Math.max(1, Math.ceil(tunnelLevel / 40));
      } else {
        // Medium price: match inflow
        targetActivePumps = Math.max(1, Math.ceil(inflow / 120));
      }
    }
    
    // Activate the most efficient pumps first
    const newPumps = state.pumps.map((pump, index) => ({
      ...pump,
      active: index < targetActivePumps,
    }));
    
    return newPumps;
  }, []);

  // Simulation update
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemState((prev) => {
        const deltaTime = UPDATE_INTERVAL / 3600000; // Convert ms to hours
        
        // Update inflow
        const newInflow = predictInflow();
        
        // AI decides pump configuration
        const optimizedPumps = optimizePumps(prev);
        
        // Calculate total flow from active pumps
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
        
        // Calculate total energy usage
        const totalEnergy = optimizedPumps
          .filter(p => p.active)
          .reduce((sum, p) => sum + p.powerConsumption, 0);
        
        // Calculate current cost
        const currentPrice = prev.electricityPrices[prev.electricityPrices.length - 1].price;
        const currentCost = totalEnergy * currentPrice;
        
        // Determine AI status
        let aiStatus: 'optimizing' | 'stable' | 'warning' = 'stable';
        if (newTunnelLevel > TUNNEL_CRITICAL || newTankLevel > TANK_CRITICAL) {
          aiStatus = 'warning';
        } else if (currentPrice > 0.25 && optimizedPumps.filter(p => p.active).length > 2) {
          aiStatus = 'optimizing';
        }
        
        // Update electricity prices (roll forward)
        let newPrices = [...prev.electricityPrices];
        if (Math.random() < 0.1) { // 10% chance to add new price
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
  }, [optimizePumps]);

  return systemState;
};
