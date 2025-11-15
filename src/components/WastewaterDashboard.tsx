import { useWastewaterSystem } from '@/hooks/useWastewaterSystem';
import { PumpNetwork } from '@/components/PumpNetwork';
import { LevelIndicator } from '@/components/LevelIndicator';
import { EnergyChart } from '@/components/EnergyChart';
import { ElectricityPriceChart } from '@/components/ElectricityPriceChart';
import { Card } from '@/components/ui/card';
import EnergyComparisonChart from './EnergyComparisonChart';
import { graphuman } from '@/data/mockPumpSchedule';

const myschedule = [{
  Datetime: "12-15-2025 12:15:00",
  Pumps:
    [
      {id:1, active:true},
      {id:2, active:false},
      {id:3, active:true},
      {id:4, active:false},
      {id:5, active:false},
      {id:6, active:false},
      {id:7, active:false},
      {id:8, active:true},
    ]
  },
  {
  Datetime: "12-15-2025 12:30:00",
  Pumps:
    [
      {id:1, active:true},
      {id:2, active:false},
      {id:3, active:false},
      {id:4, active:true},
      {id:5, active:false},
      {id:6, active:false},
      {id:7, active:false},
      {id:8, active:false},
    ]
  },
  {
  Datetime: "12-15-2025 12:45:00",
  Pumps:
    [
      {id:1, active:true},
      {id:2, active:false},
      {id:3, active:false},
      {id:4, active:false},
      {id:5, active:false},
      {id:6, active:false},
      {id:7, active:true},
      {id:8, active:false},
    ]
  }];

export const WastewaterDashboard = () => {
  const systemState = useWastewaterSystem({ useSchedule: true, customSchedule: myschedule , scheduleInterval: 15000 });
  const humanData = graphuman.slice(0, 96); // First 24 hours of data
  const simulationData = humanData.map((value) => value * 0.4); // AI reduces by 10%

  // Combine data into the required format
  const chartData = humanData.map((value, index) => {
    const date = new Date(2025, 11, 15, 12, 18 + index * 60); 
    const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
      time: formattedTime,
      human: value,
      simulation: simulationData[index],
    };
  });
 
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-[1800px] mx-auto space-y-4">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Wastewater Management System</h1>
          <p className="text-muted-foreground">Real-time monitoring and AI-powered optimization</p>
        </header>

        {/* Main Visualization Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Pump Network */}
          <Card className="xl:col-span-2 p-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">System Network</h2>
            <PumpNetwork systemState={systemState} />
          </Card>

          {/* Level Indicators */}
          <div className="space-y-4">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 text-foreground">Tunnel (F1)</h2>
              <LevelIndicator
                level={systemState.tunnel.level}
                label="Wastewater Level"
                maxCapacity={systemState.tunnel.maxCapacity}
                inflow={systemState.tunnel.inflow}
                type="tunnel"
              />
            </Card>
            
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 text-foreground">Output Tank (F2)</h2>
              <LevelIndicator
                level={systemState.tank.level}
                label="Tank Level"
                maxCapacity={systemState.tank.maxCapacity}
                outflow={systemState.tank.outflow}
                type="tank"
              />
            </Card>
          </div>
        </div>

          <div>
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Energy Consumption Comparision</h2>
            <EnergyComparisonChart data={chartData} />
        </Card>
    </div>
        </div>

        
      </div>

  );
};
