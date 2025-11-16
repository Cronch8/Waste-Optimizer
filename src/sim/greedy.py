import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import List, Tuple, Optional
from enum import Enum
from datetime import datetime, timedelta

class PumpState(Enum):
    OFF = 0
    RUNNING = 1

@dataclass
class PumpSpec:
    id: str
    type: str  # 'small' or 'big'
    capacity: float  # m³/h
    power: float  # kW

class Pump:
    def __init__(self, spec: PumpSpec):
        self.spec = spec
        self.state = PumpState.OFF
        self.runtime_intervals = 0
        
    def can_stop(self) -> bool:
        """Check if pump has run minimum 8 intervals (2 hours)"""
        return self.runtime_intervals >= 8
    
    def turn_on(self):
        self.state = PumpState.RUNNING
        self.runtime_intervals = 0
        
    def turn_off(self):
        self.state = PumpState.OFF
        self.runtime_intervals = 0
        
    def step(self):
        """Increment runtime counter"""
        if self.state == PumpState.RUNNING:
            self.runtime_intervals += 1

class WaterSystem:
    def __init__(self, initial_volume: float, pump_specs: List[PumpSpec]):
        self.volume = initial_volume
        self.max_volume = 90000  # m³
        self.max_flow = 16000  # m³/h
        self.pumps = [Pump(spec) for spec in pump_specs]
        
    def get_active_pumps(self) -> List[Pump]:
        return [p for p in self.pumps if p.state == PumpState.RUNNING]
    
    def get_total_flow(self) -> float:
        """Get current total pumped flow (m³/h)"""
        return sum(p.spec.capacity for p in self.get_active_pumps())
    
    def get_total_power(self) -> float:
        """Get current total power consumption (kW)"""
        return sum(p.spec.power for p in self.get_active_pumps())
    
    def can_turn_on_pump(self, pump: Pump) -> bool:
        """Check if we can turn on this pump without exceeding max flow"""
        current_flow = self.get_total_flow()
        return (current_flow + pump.spec.capacity) <= self.max_flow
    
    def step(self, inflow_m3_per_15min: float, price_eur_per_kwh: float) -> Tuple[float, bool]:
        """
        Simulate one 15-minute interval
        Returns: (cost, overflow_occurred)
        """
        # Calculate outflow for 15 minutes (convert m³/h to m³/15min)
        outflow = self.get_total_flow() * 0.25  # 15min = 0.25 hours
        
        # Update volume
        self.volume += inflow_m3_per_15min - outflow
        
        # Check for overflow/underflow
        overflow = False
        if self.volume > self.max_volume:
            overflow = True
            self.volume = self.max_volume
        elif self.volume < 0:
            self.volume = 0
            
        # Calculate cost (power * time * price)
        power_kw = self.get_total_power()
        time_hours = 0.25
        cost = power_kw * time_hours * price_eur_per_kwh
        
        # Update pump runtime counters
        for pump in self.pumps:
            pump.step()
            
        return cost, overflow

class SmartOptimizer:
    """Optimizer with look-ahead and daily emptying logic"""
    
    def __init__(self, rain_threshold=2000, target_empty_volume=1000):
        self.rain_threshold = rain_threshold  # m³/15min
        self.target_empty_volume = target_empty_volume  # m³ (almost empty)
        self.last_empty_day = None
        
    def is_raining(self, inflow: float) -> bool:
        return inflow >= self.rain_threshold
    
    def needs_daily_empty(self, current_day: datetime, inflow: float) -> bool:
        """Check if we need to empty today and it's not raining"""
        if self.is_raining(inflow):
            return False
        
        current_date = current_day.date()
        if self.last_empty_day is None or self.last_empty_day < current_date:
            return True
        return False
    
    def find_cheapest_emptying_window(self, data_slice: pd.DataFrame, 
                                     start_idx: int, 
                                     current_volume: float) -> Optional[int]:
        """
        Find the cheapest time window to empty the tunnel in next 24 hours
        Returns: index offset from start_idx, or None if not found
        """
        # Look ahead 24 hours (96 intervals)
        look_ahead = min(96, len(data_slice))
        
        best_idx = None
        best_avg_price = float('inf')
        
        # Estimate how many intervals needed to empty (rough estimate)
        max_pump_flow = 16000  # m³/h
        volume_to_remove = current_volume - self.target_empty_volume
        hours_needed = volume_to_remove / max_pump_flow
        intervals_needed = int(np.ceil(hours_needed / 0.25))
        intervals_needed = max(8, intervals_needed)  # At least 2 hours
        
        # Find window with lowest average price where it's not raining
        for i in range(look_ahead - intervals_needed):
            window = data_slice.iloc[i:i+intervals_needed]
            
            # Check if it's raining in this window
            if any(window['inflow'] >= self.rain_threshold):
                continue
            
            # Calculate average price in this window
            avg_price = window['price'].mean()
            
            if avg_price < best_avg_price:
                best_avg_price = avg_price
                best_idx = i
        
        return best_idx
    
    def decide_pump_actions(self, 
                          system: WaterSystem,
                          current_timestamp: datetime,
                          current_volume: float,
                          inflow: float,
                          price: float,
                          future_data: pd.DataFrame = None) -> List[Tuple[Pump, str]]:
        """
        Decide pump actions with look-ahead
        """
        actions = []
        active_pumps = system.get_active_pumps()
        
        # Volume thresholds
        volume_ratio = current_volume / system.max_volume
        critical_high = 0.85  # 85% full - emergency pumping
        high_threshold = 0.70
        medium_threshold = 0.40
        low_threshold = 0.10
        
        # Check if we need daily emptying
        needs_empty = self.needs_daily_empty(current_timestamp, inflow)
        
        # Determine target pumping strategy
        if volume_ratio >= critical_high:
            # EMERGENCY: Pump maximum regardless of price
            target_pumps = 6  # Run many pumps
            
        elif needs_empty and future_data is not None:
            # Need to empty - find cheapest window
            empty_window_start = self.find_cheapest_emptying_window(
                future_data, 0, current_volume
            )
            
            if empty_window_start is not None and empty_window_start <= 4:
                # We're in or near the cheap window - pump hard
                target_pumps = 5
                if volume_ratio < low_threshold:
                    self.last_empty_day = current_timestamp.date()
            else:
                # Not in cheap window - pump conservatively
                target_pumps = self._conservative_pump_count(volume_ratio, price)
        else:
            # Normal operation - balance volume and price
            target_pumps = self._calculate_target_pumps(volume_ratio, price, inflow)
        
        # Ensure at least one pump running
        target_pumps = max(1, target_pumps)
        
        # Execute pump changes
        current_count = len(active_pumps)
        
        if current_count < target_pumps:
            # Need to start more pumps
            needed = target_pumps - current_count
            self._start_pumps(system, needed, actions)
            
        elif current_count > target_pumps:
            # Need to stop some pumps
            excess = current_count - target_pumps
            self._stop_pumps(system, excess, actions)
        
        return actions
    
    def _calculate_target_pumps(self, volume_ratio: float, 
                               price: float, inflow: float) -> int:
        """Calculate how many pumps should be running based on volume and price"""
        
        # Price thresholds (adjust based on your data)
        cheap_price = 5.0
        expensive_price = 20.0
        
        if volume_ratio > 0.70:
            # High volume - pump more regardless of price
            if price < expensive_price:
                return 4
            else:
                return 3
        elif volume_ratio > 0.40:
            # Medium volume - balance cost and volume
            if price < cheap_price:
                return 3
            elif price < expensive_price:
                return 2
            else:
                return 1
        else:
            # Low volume - pump minimally
            if price < cheap_price and inflow > 1000:
                return 2
            else:
                return 1
    
    def _conservative_pump_count(self, volume_ratio: float, price: float) -> int:
        """Conservative pumping when waiting for cheap period"""
        if volume_ratio > 0.60:
            return 2
        elif volume_ratio > 0.30:
            return 1
        else:
            return 1
    
    def _start_pumps(self, system: WaterSystem, count: int, 
                    actions: List[Tuple[Pump, str]]):
        """Start 'count' pumps, prioritizing big pumps"""
        started = 0
        
        # First try to start big pumps
        for pump in system.pumps:
            if started >= count:
                break
            if pump.state == PumpState.OFF and pump.spec.type == 'big':
                if system.can_turn_on_pump(pump):
                    actions.append((pump, 'start'))
                    pump.turn_on()
                    started += 1
        
        # Then small pumps if needed
        for pump in system.pumps:
            if started >= count:
                break
            if pump.state == PumpState.OFF and pump.spec.type == 'small':
                if system.can_turn_on_pump(pump):
                    actions.append((pump, 'start'))
                    pump.turn_on()
                    started += 1
    
    def _stop_pumps(self, system: WaterSystem, count: int,
                   actions: List[Tuple[Pump, str]]):
        """Stop 'count' pumps, prioritizing small pumps"""
        stopped = 0
        active = system.get_active_pumps()
        
        # Ensure we don't stop all pumps
        can_stop_count = len(active) - 1
        count = min(count, can_stop_count)
        
        # First try to stop small pumps
        for pump in active:
            if stopped >= count:
                break
            if pump.spec.type == 'small' and pump.can_stop():
                actions.append((pump, 'stop'))
                pump.turn_off()
                stopped += 1
        
        # Then big pumps if needed
        for pump in active:
            if stopped >= count:
                break
            if pump.spec.type == 'big' and pump.can_stop():
                actions.append((pump, 'stop'))
                pump.turn_off()
                stopped += 1

class Simulator:
    def __init__(self, initial_volume: float, pump_specs: List[PumpSpec],
                 optimizer: SmartOptimizer, price_type: str = 'high'):
        self.initial_volume = initial_volume
        self.pump_specs = pump_specs
        self.optimizer = optimizer
        self.price_type = price_type  # 'high' or 'normal'
        
    def run(self, data: pd.DataFrame) -> Tuple[pd.DataFrame, float]:
        """
        Run simulation over entire dataset
        Returns: (history_df, total_cost)
        """
        # Initialize system
        system = WaterSystem(self.initial_volume, self.pump_specs)
        history = []
        total_cost = 0
        
        # Select price column based on price_type
        price_col = 'price_high' if self.price_type == 'high' else 'price_normal'
        
        for idx in range(len(data)):
            row = data.iloc[idx]
            
            # Get current data
            timestamp = row['timestamp']
            inflow = row['inflow']
            price = row[price_col]
            
            # Get future data for look-ahead (remaining data)
            if idx < len(data):
                future_data = data.iloc[idx:].copy()
                future_data['price'] = future_data[price_col]  # Use same price type
            else:
                future_data = None
            
            # Optimizer decides actions
            actions = self.optimizer.decide_pump_actions(
                system,
                timestamp,
                system.volume,
                inflow,
                price,
                future_data
            )
            
            # Simulate this time step
            cost, overflow = system.step(inflow, price)
            total_cost += cost
            
            # Record state
            pump_states = {f'pump_{p.spec.id}': p.state.value 
                          for p in system.pumps}
            
            history.append({
                'timestamp': timestamp,
                'volume': system.volume,
                'inflow': inflow,
                'total_flow': system.get_total_flow(),
                'active_pumps': len(system.get_active_pumps()),
                'power': system.get_total_power(),
                'cost': cost,
                'cumulative_cost': total_cost,
                'price': price,
                'overflow': overflow,
                **pump_states
            })
        
        return pd.DataFrame(history), total_cost

def load_data(filepath: str) -> pd.DataFrame:
    """Load and preprocess the CSV data"""
    # Read with comma separator
    df = pd.read_csv(filepath, sep=',')
    
    # Remove unnamed columns (like the empty column in your data)
    df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
    
    # Rename - use exact column names from your file
    df.rename(columns={
        'Time stamp': 'timestamp',
        'Water volume in tunnel V': 'volume',
        'Sum of pumped flow to WWTP F2': 'pumped_flow',
        'Inflow to tunnel F1': 'inflow',
        'Electricity price 1: high': 'price_high',
        'Electricity price 2: normal': 'price_normal'
    }, inplace=True)
    
    # Convert timestamp
    df['timestamp'] = pd.to_datetime(df['timestamp'], format='%d.%m.%Y %H.%M.%S')
    
    # Don't select a default price here - we'll do it in the simulation
    
    # Ensure numeric columns
    numeric_cols = ['volume', 'pumped_flow', 'inflow', 'price_high', 'price_normal']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    return df

def create_pump_specs() -> List[PumpSpec]:
    """Create pump specifications based on historical data analysis"""
    return [
        PumpSpec(id='1.1', type='small', capacity=1550, power=49.3),
        PumpSpec(id='1.2', type='big', capacity=3150, power=370),
        PumpSpec(id='1.3', type='big', capacity=3150, power=370),
        PumpSpec(id='1.4', type='big', capacity=3150, power=370),
        PumpSpec(id='2.1', type='small', capacity=1550, power=49.3),
        PumpSpec(id='2.2', type='big', capacity=3150, power=370),
        PumpSpec(id='2.3', type='big', capacity=3150, power=370),
        PumpSpec(id='2.4', type='big', capacity=3150, power=370),
    ]

def print_daily_breakdown(history: pd.DataFrame, total_cost: float, price_type: str):
    """Print daily cost breakdown"""
    print(f"\n{'='*60}")
    print(f"COST BREAKDOWN BY DAY - {price_type.upper()} PRICE")
    print(f"{'='*60}")
    
    # Group by day
    history['date'] = history['timestamp'].dt.date
    daily_cost = history.groupby('date').agg({
        'cost': 'sum',
        'volume': ['min', 'max', 'mean'],
        'active_pumps': 'mean',
        'overflow': 'sum'
    }).round(2)
    
    print("\nDaily Costs:")
    print(f"{'Date':<12} {'Cost (€)':<12} {'Avg Volume':<15} {'Avg Pumps':<12} {'Overflows'}")
    print("-" * 70)
    
    for date in daily_cost.index:
        cost = daily_cost.loc[date, ('cost', 'sum')]
        avg_vol = daily_cost.loc[date, ('volume', 'mean')]
        avg_pumps = daily_cost.loc[date, ('active_pumps', 'mean')]
        overflows = daily_cost.loc[date, ('overflow', 'sum')]
        print(f"{date} €{cost:>10.2f}  {avg_vol:>10.0f} m³  {avg_pumps:>10.1f}  {overflows:>10.0f}")
    
    print("-" * 70)
    print(f"{'TOTAL':<12} €{total_cost:>10.2f}")

def main():
    """Main execution function"""
    print("="*60)
    print("WATER PUMPING OPTIMIZATION SIMULATOR")
    print("="*60)
    
    # Load data
    print("\nLoading data...")
    data = load_data('data.csv')  # Change to your CSV filename
    print(f"Loaded {len(data)} time intervals ({len(data)/96:.1f} days)")
    
    # Get initial volume from first row
    initial_volume = data.iloc[0]['volume']
    print(f"Initial volume: {initial_volume:.0f} m³")
    
    # Create pump specifications
    pump_specs = create_pump_specs()
    print(f"Configured {len(pump_specs)} pumps (2 small, 6 big)")
    
    print("\n" + "="*60)
    print("RUNNING TWO SIMULATIONS (HIGH PRICE vs NORMAL PRICE)")
    print("="*60)
    
    # =================================================================
    # SIMULATION 1: HIGH PRICE
    # =================================================================
    print("\n" + ">"*60)
    print("SIMULATION 1: HIGH PRICE TARIFF")
    print(">"*60)
    
    optimizer_high = SmartOptimizer(rain_threshold=2000, target_empty_volume=1000)
    simulator_high = Simulator(initial_volume, pump_specs, optimizer_high, price_type='high')
    
    print("Running simulation with HIGH price tariff...")
    history_high, total_cost_high = simulator_high.run(data)
    
    print(f"\nRESULTS - HIGH PRICE:")
    print(f"  Total Cost: €{total_cost_high:,.2f}")
    num_days = len(data) / 96
    print(f"  Average Cost per Day: €{total_cost_high / num_days:,.2f}")
    print(f"  Number of Overflows: {history_high['overflow'].sum()}")
    print(f"  Min Volume: {history_high['volume'].min():.0f} m³")
    print(f"  Max Volume: {history_high['volume'].max():.0f} m³")
    print(f"  Average Active Pumps: {history_high['active_pumps'].mean():.1f}")
    
    # =================================================================
    # SIMULATION 2: NORMAL PRICE
    # =================================================================
    print("\n" + ">"*60)
    print("SIMULATION 2: NORMAL PRICE TARIFF")
    print(">"*60)
    
    optimizer_normal = SmartOptimizer(rain_threshold=2000, target_empty_volume=1000)
    simulator_normal = Simulator(initial_volume, pump_specs, optimizer_normal, price_type='normal')
    
    print("Running simulation with NORMAL price tariff...")
    history_normal, total_cost_normal = simulator_normal.run(data)
    
    print(f"\nRESULTS - NORMAL PRICE:")
    print(f"  Total Cost: €{total_cost_normal:,.2f}")
    print(f"  Average Cost per Day: €{total_cost_normal / num_days:,.2f}")
    print(f"  Number of Overflows: {history_normal['overflow'].sum()}")
    print(f"  Min Volume: {history_normal['volume'].min():.0f} m³")
    print(f"  Max Volume: {history_normal['volume'].max():.0f} m³")
    print(f"  Average Active Pumps: {history_normal['active_pumps'].mean():.1f}")
    
    # =================================================================
    # COMPARISON
    # =================================================================
    print("\n" + "="*60)
    print("COST COMPARISON")
    print("="*60)
    
    savings = total_cost_high - total_cost_normal
    savings_pct = (savings / total_cost_high) * 100 if total_cost_high > 0 else 0
    
    print(f"\nHIGH Price Total:   €{total_cost_high:>12,.2f}")
    print(f"NORMAL Price Total: €{total_cost_normal:>12,.2f}")
    print(f"{'-'*40}")
    if savings > 0:
        print(f"SAVINGS (Normal):   €{savings:>12,.2f} ({savings_pct:.1f}% cheaper)")
    else:
        print(f"EXTRA COST (Normal):€{-savings:>12,.2f} ({-savings_pct:.1f}% more expensive)")
    
    # Print daily breakdowns
    print_daily_breakdown(history_high, total_cost_high, 'high')
    print_daily_breakdown(history_normal, total_cost_normal, 'normal')
    
    # Show price statistics
    print(f"\n{'='*60}")
    print(f"ELECTRICITY PRICE STATISTICS")
    print(f"{'='*60}")
    print(f"\nHIGH PRICE TARIFF:")
    print(f"  Min: €{data['price_high'].min():.3f}/kWh")
    print(f"  Max: €{data['price_high'].max():.3f}/kWh")
    print(f"  Avg: €{data['price_high'].mean():.3f}/kWh")
    
    print(f"\nNORMAL PRICE TARIFF:")
    print(f"  Min: €{data['price_normal'].min():.3f}/kWh")
    print(f"  Max: €{data['price_normal'].max():.3f}/kWh")
    print(f"  Avg: €{data['price_normal'].mean():.3f}/kWh")
    
    # Save results
    history_high.to_csv('simulation_results_high_price.csv', index=False)
    history_normal.to_csv('simulation_results_normal_price.csv', index=False)
    print(f"\nResults saved to:")
    print(f"  - simulation_results_high_price.csv")
    print(f"  - simulation_results_normal_price.csv")
    
    return (history_high, total_cost_high), (history_normal, total_cost_normal)

if __name__ == "__main__":
    results = main()