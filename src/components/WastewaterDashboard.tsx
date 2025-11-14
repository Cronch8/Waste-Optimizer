import { useWastewaterSystem } from '@/hooks/useWastewaterSystem';
import { PumpNetwork } from '@/components/PumpNetwork';
import { LevelIndicator } from '@/components/LevelIndicator';
import { EnergyChart } from '@/components/EnergyChart';
import { ElectricityPriceChart } from '@/components/ElectricityPriceChart';
import { Card } from '@/components/ui/card';

export const WastewaterDashboard = () => {
  const systemState = useWastewaterSystem();

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

        {/* Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Electricity Price</h2>
            <ElectricityPriceChart prices={systemState.electricityPrices} />
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Energy Cost</h2>
            <EnergyChart 
              prices={systemState.electricityPrices}
              energyUsage={systemState.totalEnergyUsage}
            />
          </Card>
        </div>
      </div>
    </div>
  );
};
