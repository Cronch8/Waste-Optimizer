export interface Pump {
  id: string;
  number: number;
  active: boolean;
  flowRate: number; // m³/h
  powerConsumption: number; // kW
  x: number; // Position for visualization
  y: number;
}

export interface TunnelState {
  level: number; // percentage (0-100)
  maxCapacity: number; // m³
  inflow: number; // m³/h
}

export interface TankState {
  level: number; // percentage (0-100)
  maxCapacity: number; // m³
  outflow: number; // m³/h
}

export interface ElectricityPrice {
  timestamp: Date;
  price: number; // EUR/kWh
}

export interface SystemState {
  pumps: Pump[];
  tunnel: TunnelState;
  tank: TankState;
  totalEnergyUsage: number; // kW
  electricityPrices: ElectricityPrice[];
  aiStatus: 'optimizing' | 'stable' | 'warning';
  currentCost: number; // EUR/h
}
