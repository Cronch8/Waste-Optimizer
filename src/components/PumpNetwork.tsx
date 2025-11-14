import { SystemState } from '@/types/wastewater';
import { Play, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PumpNetworkProps {
  systemState: SystemState;
}

export const PumpNetwork = ({ systemState }: PumpNetworkProps) => {
  const { pumps, tunnel, tank } = systemState;

  return (
    <div className="relative w-full h-[600px] bg-card border border-border rounded-lg overflow-hidden">
      <svg width="100%" height="100%" viewBox="0 0 800 600" className="absolute inset-0">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            className="fill-primary"
          >
            <polygon points="0 0, 10 3, 0 6" className="fill-cyan-500" />
          </marker>
        </defs>

        {/* Tunnel (F1) */}
        <g transform="translate(50, 250)">
          <rect
            width="100"
            height="80"
            className="fill-cyan-900/30 stroke-cyan-500"
            strokeWidth="2"
            rx="4"
          />
          <text x="50" y="30" className="fill-cyan-400 text-xs" textAnchor="middle" fontWeight="bold">
            F1
          </text>
          <text x="50" y="55" className="fill-cyan-400 text-2xl" textAnchor="middle" fontWeight="bold">
            {Math.round(tunnel.level)}%
          </text>
        </g>

        {/* Output Tank (F2) */}
        <g transform="translate(650, 50)">
          <rect
            width="120"
            height="100"
            className="fill-cyan-900/30 stroke-cyan-500"
            strokeWidth="2"
            rx="4"
          />
          <text x="60" y="35" className="fill-cyan-400 text-xs" textAnchor="middle" fontWeight="bold">
            F2
          </text>
          <text x="60" y="65" className="fill-cyan-400 text-2xl" textAnchor="middle" fontWeight="bold">
            {Math.round(tank.level)}%
          </text>
        </g>

        {/* Connection lines from tunnel to pumps */}
        {pumps.slice(0, 4).map((pump, idx) => (
          <line
            key={`tunnel-line-${pump.id}`}
            x1="150"
            y1="290"
            x2={pump.x - 30}
            y2={pump.y + 20}
            className={pump.active ? 'stroke-cyan-500' : 'stroke-muted'}
            strokeWidth="2"
          />
        ))}

        {/* Connection lines from pumps to tank */}
        {pumps.map((pump) => (
          <line
            key={`pump-tank-${pump.id}`}
            x1={pump.x + 30}
            y1={pump.y + 20}
            x2="650"
            y2="100"
            className={pump.active ? 'stroke-cyan-500' : 'stroke-muted'}
            strokeWidth="2"
            markerEnd={pump.active ? 'url(#arrowhead)' : undefined}
          />
        ))}

        {/* Pumps */}
        {pumps.map((pump) => (
          <g key={pump.id} transform={`translate(${pump.x}, ${pump.y})`}>
            <circle
              r="25"
              className={
                pump.active
                  ? 'fill-cyan-500 stroke-cyan-400'
                  : 'fill-muted stroke-border'
              }
              strokeWidth="2"
            />
            {pump.active ? (
              <g>
                <polygon
                  points="-8,-10 -8,10 10,0"
                  className="fill-background"
                />
              </g>
            ) : (
              <rect
                x="-8"
                y="-8"
                width="16"
                height="16"
                className="fill-muted-foreground"
              />
            )}
            <text
              y="45"
              className="fill-foreground text-xs"
              textAnchor="middle"
              fontWeight="bold"
            >
              {pump.number}
            </text>
          </g>
        ))}
      </svg>

      {/* Pump Status Panel */}
      <div className="absolute bottom-4 left-4 right-4 bg-card/95 backdrop-blur border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3 text-foreground">Active Pumps</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {pumps
            .filter(p => p.active)
            .map((pump) => (
              <Badge key={pump.id} variant="default" className="justify-between bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
                <span className="flex items-center gap-1">
                  <Play className="w-3 h-3" />
                  P{pump.number}
                </span>
                <span className="text-xs">{pump.powerConsumption}kW</span>
              </Badge>
            ))}
        </div>
      </div>
    </div>
  );
};
