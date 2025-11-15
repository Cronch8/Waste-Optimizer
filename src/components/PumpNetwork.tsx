import { SystemState } from '@/types/wastewater';
import { Play, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PumpNetworkProps {
  systemState: SystemState;
}

export const PumpNetwork = ({ systemState }: PumpNetworkProps) => {
  const { pumps, tunnel, tank } = systemState;
  
  const totalPumpCapacity = pumps.reduce((sum, p) => sum + (p.active ? p.flowRate : 0), 0);

  return (
    <div className="relative w-full h-[600px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-cyan-500/20 rounded-xl overflow-hidden shadow-2xl shadow-cyan-500/10">
      <svg width="100%" height="100%" viewBox="0 0 800 600" className="absolute inset-0">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" className="fill-cyan-400" />
          </marker>
          <linearGradient id="pumpGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(6, 182, 212)" />
            <stop offset="100%" stopColor="rgb(8, 145, 178)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Tunnel (F1) */}
        <g transform="translate(50, 250)">
          <rect
            width="100"
            height="80"
            className="fill-cyan-950/50 stroke-cyan-400"
            strokeWidth="2.5"
            rx="8"
          />
          <text x="50" y="30" className="fill-cyan-300 text-sm" textAnchor="middle" fontWeight="bold">
            F1 TUNNEL
          </text>
          <text x="50" y="55" className="fill-cyan-400 text-3xl" textAnchor="middle" fontWeight="bold">
            {Math.round(tunnel.level)}%
          </text>
          {/* Inflow label */}
          <text x="50" y="95" className="fill-cyan-400/80 text-xs" textAnchor="middle">
            ↓ {tunnel.inflow.toFixed(1)} m³/h
          </text>
        </g>

        {/* Output Tank (F2) */}
        <g transform="translate(650, 50)">
          <rect
            width="120"
            height="100"
            className="fill-cyan-950/50 stroke-cyan-400"
            strokeWidth="2.5"
            rx="8"
          />
          <text x="60" y="35" className="fill-cyan-300 text-sm" textAnchor="middle" fontWeight="bold">
            F2 TANK
          </text>
          <text x="60" y="65" className="fill-cyan-400 text-3xl" textAnchor="middle" fontWeight="bold">
            {Math.round(tank.level)}%
          </text>
          {/* Outflow label */}
          <text x="60" y="120" className="fill-cyan-400/80 text-xs" textAnchor="middle">
            ↓ {tank.outflow.toFixed(1)} m³/h
          </text>
        </g>

        {/* Connection lines from tunnel to pumps - curved paths */}
        {pumps.slice(0, 8).map((pump) => {
          const startX = 150;
          const startY = 290;
          const endX = pump.x - 30;
          const endY = pump.y;
          const midX = (startX + endX) / 2;
          
          return (
            <path
              key={`tunnel-line-${pump.id}`}
              d={`M ${startX} ${startY} Q ${midX} ${startY} ${endX} ${endY}`}
              className={pump.active ? 'stroke-green-400' : 'stroke-slate-600'}
              strokeWidth="2.5"
              fill="none"
              opacity={pump.active ? 1 : 0.3}
            />
          );
        })}

        {/* Connection lines from pumps to tank - curved paths */}
        {pumps.map((pump) => {
          const startX = pump.x + 30;
          const startY = pump.y;
          const endX = 650;
          const endY = 100;
          const midX = (startX + endX) / 2;
          
          return (
            <path
              key={`pump-tank-${pump.id}`}
              d={`M ${startX} ${startY} Q ${midX} ${endY} ${endX} ${endY}`}
              className={pump.active ? 'stroke-green-400' : 'stroke-slate-600'}
              strokeWidth="2.5"
              fill="none"
              opacity={pump.active ? 1 : 0.3}
            />
          );
        })}

        {/* Pumps */}
        {pumps.map((pump) => (
          <g key={pump.id} transform={`translate(${pump.x}, ${pump.y})`}>
            <circle
              r="28"
              className={
                pump.active
                  ? 'stroke-green-400'
                  : 'stroke-slate-600'
              }
              strokeWidth="2.5"
              fill={pump.active ? 'url(#pumpGradient)' : 'slate-700'}
            />
            {pump.active ? (
              <g>
                <polygon
                  points="-8,-10 -8,10 10,0"
                  className="fill-slate-900"
                />
              </g>
            ) : (
              <rect
                x="-8"
                y="-8"
                width="16"
                height="16"
                className="fill-slate-500"
              />
            )}
            <text
              y="50"
              className={pump.active ? 'fill-green-600' : 'fill-slate-100'}
              textAnchor="middle"
              fontWeight="bold"
            >
              P{pump.number}
            </text>
            {pump.active && (
              <text
                y="65"
                className="fill-cyan-400/70 text-xs"
                textAnchor="middle"
              >
              </text>
            )}
          </g>
        ))}
      </svg>

    </div>
  );
};
