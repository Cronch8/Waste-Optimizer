import os
import json
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


class InflowData(BaseModel):
    """Model for inflow and price data at each time step"""
    inflow: float = Field(..., description="Wastewater inflow volume in m³")
    priceNormal: float = Field(..., description="Normal electricity price")
    priceHigh: float = Field(..., description="High electricity price")


class PumpSpecification(BaseModel):
    """Simplified pump specification"""
    name: str
    type: Literal["small", "big"]
    flowRate: float = Field(..., description="Flow rate in m³/h")
    powerConsumption: float = Field(..., description="Power consumption in kW")


class PumpAction(BaseModel):
    """Action to take with a pump"""
    pumpName: str
    cycles: int = Field(0, ge=0, description="Number of cycles to run (0 or >= 8)")
    
    @field_validator('cycles')
    @classmethod
    def validate_cycles(cls, v):
        if v != 0 and v < 8:
            raise ValueError(f"Cycles must be 0 or >= 8, got {v}")
        return v


class SimulationState(BaseModel):
    """Current state of the simulation"""
    currentVolume: float = Field(..., description="Current tunnel volume in m³")
    timeStep: int = Field(0, description="Current time step (15min intervals)")
    totalCost: float = Field(0, description="Total electricity cost so far")
    hasEmptiedTo500: bool = Field(False, description="Has tunnel been emptied to 500m³ yet")
    
    def get_day(self) -> int:
        """Get current day (1-indexed)"""
        return (self.timeStep // 96) + 1
    
    def get_hour(self) -> float:
        """Get current hour of day"""
        return (self.timeStep % 96) * 0.25


class CycleResult(BaseModel):
    """Result of a single simulation cycle"""
    waterVolume: float = Field(..., description="Water volume in tunnel after cycle")
    inflow: float = Field(..., description="Inflow during this cycle")
    electricityPrice: float = Field(..., description="Electricity price used")
    outflow: float = Field(..., description="Total outflow from pumps")
    electricityCost: float = Field(..., description="Electricity cost for this cycle")
    pumpActions: List[PumpAction] = Field(..., description="Actions taken")
    violations: List[str] = Field(default_factory=list, description="Any rule violations")


class AIDecision(BaseModel):
    """Model for AI pump decision"""
    pumpActions: List[PumpAction] = Field(..., description="List of pump actions")
    reasoning: str = Field(..., description="Explanation of the decision")
    
    @field_validator('pumpActions')
    @classmethod
    def validate_pump_actions(cls, v):
        # Check that total flow rate of pumps running simultaneously doesn't exceed limit
        # Only check pumps that are actually running (cycles > 0)
        active_pumps = [action for action in v if action.cycles > 0]
        
        if not active_pumps:
            return v
        
        # Total flow rate when all active pumps run together
        total_flow_rate = sum(get_pump_flow_rate(action.pumpName) for action in active_pumps)
        
        if total_flow_rate > 16000:
            raise ValueError(f"Total simultaneous pump flow rate {total_flow_rate} m³/h exceeds max 16000 m³/h")
        return v


class Config(BaseModel):
    """Configuration settings"""
    initialVolume: float = Field(default=10_000, description="Initial tunnel volume in m³")
    maxVolume: float = Field(default=90_000, description="Maximum tunnel volume in m³")
    minEmptyVolume: float = Field(default=500, description="Must empty to this level once in first 4 days")
    maxTotalFlowRate: float = Field(default=16_000, description="Max total pump output in m³/h")
    minCycles: int = Field(default=8, description="Minimum cycles a pump must run")
    cyclesPerHour: int = Field(default=4, description="15min intervals per hour")
    priceType: Literal["normal", "high"] = Field(default="normal", description="Which price column to use")
    openaiModel: str = Field(default="gpt-4-turbo-preview", description="OpenAI model to use")
    temperature: float = Field(default=0.3, description="OpenAI temperature setting")


# Initialize pumps (2 small + 6 big)
PUMP_SPECS = [
    PumpSpecification(name="S1", type="small", flowRate=1560, powerConsumption=185),
    PumpSpecification(name="S2", type="small", flowRate=1560, powerConsumption=185),
    PumpSpecification(name="B1", type="big", flowRate=3170, powerConsumption=370),
    PumpSpecification(name="B2", type="big", flowRate=3170, powerConsumption=370),
    PumpSpecification(name="B3", type="big", flowRate=3170, powerConsumption=370),
    PumpSpecification(name="B4", type="big", flowRate=3170, powerConsumption=370),
    PumpSpecification(name="B5", type="big", flowRate=3170, powerConsumption=370),
    PumpSpecification(name="B6", type="big", flowRate=3170, powerConsumption=370),
]

def get_pump_flow_rate(pump_name: str) -> float:
    """Get flow rate for a pump"""
    for pump in PUMP_SPECS:
        if pump.name == pump_name:
            return pump.flowRate
    return 0

def get_pump_power(pump_name: str) -> float:
    """Get power consumption for a pump"""
    for pump in PUMP_SPECS:
        if pump.name == pump_name:
            return pump.powerConsumption
    return 0

# Sample data
dataArray = [
    InflowData(inflow=1454.531128, priceNormal=0.291, priceHigh=3.383),
    InflowData(inflow=1454.531128, priceNormal=0.291, priceHigh=3.383),
    InflowData(inflow=1782.514282, priceNormal=15.051, priceHigh=33.769),
    InflowData(inflow=1801.342773, priceNormal=18.443, priceHigh=35.321),
    InflowData(inflow=1702.649902, priceNormal=18.443, priceHigh=35.321),
    InflowData(inflow=1712.684448, priceNormal=18.443, priceHigh=35.321),
    InflowData(inflow=1727.95752, priceNormal=18.443, priceHigh=35.321),
    InflowData(inflow=1713.074951, priceNormal=13.607, priceHigh=24.181),
    InflowData(inflow=1708.863037, priceNormal=13.607, priceHigh=24.181),
    InflowData(inflow=1717.744019, priceNormal=13.607, priceHigh=24.181),
    InflowData(inflow=1707.849609, priceNormal=13.607, priceHigh=24.181),
]

config = Config()


def calculate_pump_output(pump_action: PumpAction) -> float:
    """
    Calculate actual water pumped considering first and last cycle at half power.
    Each cycle is 15 minutes = 0.25 hours.
    Average flow rate calculation with first and last cycle at half.
    """
    if pump_action.cycles == 0:
        return 0
    
    flow_rate_per_hour = get_pump_flow_rate(pump_action.pumpName)
    flow_rate_per_cycle = flow_rate_per_hour * 0.25  # 15min = 0.25h
    
    if pump_action.cycles == 1:
        # Only one cycle, runs at half power
        return flow_rate_per_cycle * 0.5
    
    # First cycle at half, last cycle at half, middle cycles at full
    full_cycles = pump_action.cycles - 2
    half_cycles = 2
    
    # Total water pumped (in m³)
    total_water = (full_cycles * flow_rate_per_cycle) + (half_cycles * flow_rate_per_cycle * 0.5)
    return total_water


def calculate_energy_cost(pump_action: PumpAction, price: float) -> float:
    """Calculate energy cost for pump action"""
    if pump_action.cycles == 0:
        return 0
    
    power = get_pump_power(pump_action.pumpName)
    
    if pump_action.cycles == 1:
        # Only one cycle at half power
        energy = power * 0.25 * 0.5  # kWh
        return energy * price
    
    # First and last at half, middle at full
    full_cycles = pump_action.cycles - 2
    half_cycles = 2
    
    energy = (full_cycles * power * 0.25) + (half_cycles * power * 0.25 * 0.5)
    return energy * price


def simulate_cycle(state: SimulationState, actions: List[PumpAction], 
                   current_data: InflowData, config: Config) -> CycleResult:
    """Simulate one cycle with given pump actions"""
    violations = []
    
    # Validate actions
    for action in actions:
        if action.cycles != 0 and action.cycles < config.minCycles:
            violations.append(f"Pump {action.pumpName} cycles {action.cycles} < minimum {config.minCycles}")
    
    # Calculate total outflow
    total_outflow = sum(calculate_pump_output(action) for action in actions)
    
    # Check max flow rate (simultaneous operation limit)
    active_pumps = [action for action in actions if action.cycles > 0]
    total_flow_rate = sum(get_pump_flow_rate(action.pumpName) for action in active_pumps)
    
    if total_flow_rate > config.maxTotalFlowRate:
        violations.append(f"Total simultaneous flow rate {total_flow_rate} m³/h exceeds max {config.maxTotalFlowRate} m³/h")
    
    # Calculate electricity cost
    price = current_data.priceHigh if config.priceType == "high" else current_data.priceNormal
    electricity_cost = sum(calculate_energy_cost(action, price) for action in actions)
    
    # Update volume
    new_volume = state.currentVolume + current_data.inflow - total_outflow
    
    # Check constraints
    if new_volume > config.maxVolume:
        violations.append(f"Volume {new_volume:.0f} exceeds max {config.maxVolume}")
        # Apply penalty
        electricity_cost += (new_volume - config.maxVolume) * 100
    
    if new_volume < 0:
        violations.append(f"Volume {new_volume:.0f} is negative!")
        new_volume = 0
    
    return CycleResult(
        waterVolume=new_volume,
        inflow=current_data.inflow,
        electricityPrice=price,
        outflow=total_outflow,
        electricityCost=electricity_cost,
        pumpActions=actions,
        violations=violations
    )


def get_ai_pump_decision(state: SimulationState, future_data: List[InflowData], 
                        config: Config) -> AIDecision:
    """Use OpenAI API to determine optimal pump configuration"""
    
    price = future_data[0].priceHigh if config.priceType == "high" else future_data[0].priceNormal
    
    context = {
        "current_state": {
            "volume": state.currentVolume,
            "max_volume": config.maxVolume,
            "day": state.get_day(),
            "hour": state.get_hour(),
            "has_emptied_to_500": state.hasEmptiedTo500,
            "total_cost_so_far": state.totalCost
        },
        "current_price": price,
        "pumps_available": [
            {
                "name": pump.name,
                "type": pump.type,
                "flow_rate_m3_per_h": pump.flowRate,
                "power_kw": pump.powerConsumption
            } for pump in PUMP_SPECS
        ],
        "pump_combinations_example": [
            {"combo": "1 small pump", "total_flow": "1,560 m³/h = 390 m³ per cycle", "valid": "✓"},
            {"combo": "2 small pumps", "total_flow": "3,120 m³/h = 780 m³ per cycle", "valid": "✓"},
            {"combo": "2 big pumps", "total_flow": "6,340 m³/h = 1,585 m³ per cycle", "valid": "✓"},
            {"combo": "3 big pumps", "total_flow": "9,510 m³/h = 2,378 m³ per cycle", "valid": "✓"},
            {"combo": "4 big pumps", "total_flow": "12,680 m³/h = 3,170 m³ per cycle", "valid": "✓"},
            {"combo": "5 big pumps", "total_flow": "15,850 m³/h = 3,963 m³ per cycle", "valid": "✓"},
            {"combo": "6 big pumps", "total_flow": "19,020 m³/h = 4,755 m³ per cycle", "valid": "✗ EXCEEDS 16,000 m³/h"},
            {"combo": "2 small + 4 big", "total_flow": "15,800 m³/h = 3,950 m³ per cycle", "valid": "✓"},
            {"combo": "Max safe: 5 big pumps", "per_15min": "3,963 m³", "note": "This is the maximum"}
        ],
        "forecast_next_24h": [
            {
                "inflow": d.inflow,
                "price": d.priceHigh if config.priceType == "high" else d.priceNormal
            } for d in future_data[:96]
        ],
        "rules": {
            "cycle_duration": "15 minutes",
            "min_cycles_per_pump": config.minCycles,
            "max_simultaneous_flow": f"{config.maxTotalFlowRate} m³/h - This is the TOTAL of all pumps running at the same time",
            "first_last_cycle_power": "First and last cycle run at 50% power/flow",
            "must_empty_to_500": f"Must empty tunnel to {config.minEmptyVolume}m³ once in first 4 days" if not state.hasEmptiedTo500 else "Already completed",
            "max_volume": f"{config.maxVolume}m³ - HUGE PENALTY if exceeded"
        }
    }
    
    prompt = f"""You are optimizing a wastewater pumping station. Choose which pumps to run and for how many cycles.

Current State:
{json.dumps(context, indent=2)}

CRITICAL RULES:
1. Each pump must run for 0 cycles OR >= {config.minCycles} cycles (no values between)
2. First and last cycle of each pump run at 50% power and pump 50% water
3. **MAXIMUM SIMULTANEOUS FLOW: {config.maxTotalFlowRate} m³/h = 4,000 m³ per 15-minute cycle**
   - This means: if you run multiple pumps at the same time, their flow rates add up
   - Example: Running 4 big pumps = 12,680 m³/h = 3,170 m³ per cycle ✓
   - Example: Running 5 big pumps = 15,850 m³/h = 3,963 m³ per cycle ✓ (close to max)
   - Example: Running 6 big pumps = 19,020 m³/h = 4,755 m³ per cycle ✗ EXCEEDS LIMIT
   - **Maximum safe combination: 5 big pumps OR 4 big + 2 small**
4. Must empty tunnel to {config.minEmptyVolume}m³ at least once in first 4 days (only needed once!)
5. NEVER exceed {config.maxVolume}m³ volume (massive penalty)
6. NEVER pump more than current volume (causes negative volume violation)

DECISION STRATEGY:
- **Minimize electricity cost** - this is the PRIMARY objective
- Pump during LOW price periods when possible
- Avoid pumping during HIGH price periods unless absolutely necessary
- High volume + risk of overflow = must pump (even if expensive)
- Low volume + low price = good time to pump toward empty requirement
- Consider forecast: if high prices coming and volume rising, pump preemptively at current lower price
- The empty-to-500 requirement only needs to be met ONCE in 4 days, don't over-optimize for it

Respond with ONLY a JSON object:
{{
  "pumpActions": [
    {{"pumpName": "S1", "cycles": 8}},
    {{"pumpName": "B1", "cycles": 8}}
  ],
  "reasoning": "Brief explanation focusing on cost optimization"
}}
"""

    try:
        response = client.chat.completions.create(
            model=config.openaiModel,
            messages=[
                {"role": "system", "content": "You are an expert optimizer for wastewater pump control systems."},
                {"role": "user", "content": prompt}
            ],
            temperature=config.temperature,
            response_format={"type": "json_object"}
        )
        
        decision_data = json.loads(response.choices[0].message.content)
        return AIDecision(**decision_data)
    
    except Exception as e:
        print(f"Error calling OpenAI API: {e}")
        # Fallback rule-based decision
        actions = []
        if state.currentVolume > 70000:
            actions = [PumpAction(pumpName="B1", cycles=8), PumpAction(pumpName="B2", cycles=8)]
        elif state.currentVolume > 50000:
            actions = [PumpAction(pumpName="B1", cycles=8)]
        elif state.currentVolume > 30000 and price < 5:
            actions = [PumpAction(pumpName="S1", cycles=8)]
        
        return AIDecision(pumpActions=actions, reasoning="Fallback rule-based decision")


def run_simulation(price_type: Literal["normal", "high"] = "normal"):
    """Run the full optimization simulation"""
    config.priceType = price_type
    state = SimulationState(currentVolume=config.initialVolume)
    
    results = []
    
    print(f"\n{'='*80}")
    print(f"Starting simulation with {price_type.upper()} prices")
    print(f"Initial volume: {state.currentVolume:.0f} m³")
    print(f"{'='*80}\n")
    
    while state.timeStep < len(dataArray):
        current_data = dataArray[state.timeStep]
        future_data = dataArray[state.timeStep:]
        
        # Get AI decision
        decision = get_ai_pump_decision(state, future_data, config)
        
        # Simulate cycle
        result = simulate_cycle(state, decision.pumpActions, current_data, config)
        
        # Check if we've emptied to 500
        if result.waterVolume <= config.minEmptyVolume and not state.hasEmptiedTo500:
            state.hasEmptiedTo500 = True
            print(f"✓ Emptied to {config.minEmptyVolume}m³ on day {state.get_day()}, hour {state.get_hour():.2f}")
        
        # Update state
        state.currentVolume = result.waterVolume
        state.totalCost += result.electricityCost
        state.timeStep += 1
        
        # Print status
        active_pumps = [a for a in decision.pumpActions if a.cycles > 0]
        pump_str = ", ".join([f"{a.pumpName}({a.cycles})" for a in active_pumps]) if active_pumps else "None"
        
        print(f"Day {state.get_day()}, Hour {state.get_hour():.2f}: "
              f"Vol={result.waterVolume:.0f}m³, "
              f"In={result.inflow:.0f}m³, "
              f"Out={result.outflow:.0f}m³, "
              f"Price={result.electricityPrice:.2f}, "
              f"Cost={result.electricityCost:.2f}€, "
              f"Pumps={pump_str}")
        
        if result.violations:
            print(f"  ⚠️ VIOLATIONS: {', '.join(result.violations)}")
        
        results.append(result)
    
    print(f"\n{'='*80}")
    print(f"FINAL RESULTS:")
    print(f"Total Cost: {state.totalCost:.2f}€")
    print(f"Final Volume: {state.currentVolume:.0f}m³")
    print(f"Emptied to 500m³: {'✓ Yes' if state.hasEmptiedTo500 else '✗ NO - CONSTRAINT VIOLATED'}")
    print(f"{'='*80}\n")
    
    return results, state


if __name__ == "__main__":
    if not os.getenv("OPENAI_API_KEY"):
        raise ValueError("OPENAI_API_KEY not found. Create a .env file with your API key.")
    
    # Run with normal prices
    print("\n" + "="*80)
    print("RUN 1: NORMAL PRICES")
    print("="*80)
    results_normal, final_state_normal = run_simulation(price_type="normal")
    
    # Uncomment to also run with high prices
    # print("\n" + "="*80)
    # print("RUN 2: HIGH PRICES")
    # print("="*80)
    # results_high, final_state_high = run_simulation(price_type="high")