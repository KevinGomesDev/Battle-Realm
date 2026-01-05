import React, { useEffect, useRef, useState } from "react";
import type { Territory } from "../types/map.types";
import type { MatchKingdom } from "../../match/types/match.types";

interface MapCanvasProps {
  territories: Territory[];
  players: MatchKingdom[];
  width?: number;
  height?: number;
  onTerritoryClick?: (territory: Territory) => void;
}

const TERRAIN_COLORS: Record<string, string> = {
  ICE: "#a8dadc",
  MOUNTAIN: "#6c757d",
  FOREST: "#52b788",
  PLAINS: "#95d5b2",
  WASTELAND: "#8d7b68",
  DESERT: "#f4a261",
  OCEAN: "#023e8a",
};

const SIZE_STROKE_WIDTH: Record<string, number> = {
  SMALL: 1.5,
  MEDIUM: 2,
  LARGE: 2.5,
};

export const MapCanvas: React.FC<MapCanvasProps> = ({
  territories,
  players,
  width = 1200,
  height = 800,
  onTerritoryClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredTerritory, setHoveredTerritory] = useState<string | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(
    null
  );

  // Calcular bounds do mapa
  const calculateBounds = () => {
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    territories.forEach((territory) => {
      const points: [number, number][] = JSON.parse(territory.polygonData);
      points.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      });
    });

    return { minX, maxX, minY, maxY };
  };

  // Desenhar mapa
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Limpar canvas
    ctx.clearRect(0, 0, width, height);

    if (territories.length === 0) return;

    // Calcular escala para caber no canvas
    const bounds = calculateBounds();
    const mapWidth = bounds.maxX - bounds.minX;
    const mapHeight = bounds.maxY - bounds.minY;
    const scaleX = (width - 40) / mapWidth;
    const scaleY = (height - 40) / mapHeight;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (width - mapWidth * scale) / 2 - bounds.minX * scale;
    const offsetY = (height - mapHeight * scale) / 2 - bounds.minY * scale;

    // Separar territórios por tipo
    const waterTerritories = territories.filter((t) => t.type === "WATER");
    const landTerritories = territories.filter((t) => t.type === "LAND");

    // Desenhar água primeiro (fundo)
    waterTerritories.forEach((territory) => {
      drawTerritory(ctx, territory, scale, offsetX, offsetY, false);
    });

    // Desenhar terra por cima
    landTerritories.forEach((territory) => {
      drawTerritory(ctx, territory, scale, offsetX, offsetY, true);
    });

    // Destacar território hover
    if (hoveredTerritory) {
      const territory = territories.find((t) => t.id === hoveredTerritory);
      if (territory) {
        highlightTerritory(
          ctx,
          territory,
          scale,
          offsetX,
          offsetY,
          "#ffff00",
          3
        );
      }
    }

    // Destacar território selecionado
    if (selectedTerritory) {
      highlightTerritory(
        ctx,
        selectedTerritory,
        scale,
        offsetX,
        offsetY,
        "#ff0000",
        4
      );
    }
  }, [
    territories,
    players,
    width,
    height,
    hoveredTerritory,
    selectedTerritory,
  ]);

  const drawTerritory = (
    ctx: CanvasRenderingContext2D,
    territory: Territory,
    scale: number,
    offsetX: number,
    offsetY: number,
    drawLabel: boolean
  ) => {
    const points: [number, number][] = JSON.parse(territory.polygonData);

    // Cor base do terreno
    let fillColor = TERRAIN_COLORS[territory.terrainType] || "#cccccc";

    // Se tem dono, misturar com cor do jogador
    if (territory.ownerId) {
      const player = players.find((p) => p.id === territory.ownerId);
      if (player) {
        fillColor = blendColors(fillColor, player.playerColor, 0.3);
      }
    }

    // Desenhar polígono
    ctx.beginPath();
    const firstPoint = points[0];
    ctx.moveTo(
      firstPoint[0] * scale + offsetX,
      firstPoint[1] * scale + offsetY
    );

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(
        points[i][0] * scale + offsetX,
        points[i][1] * scale + offsetY
      );
    }
    ctx.closePath();

    // Preencher
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Borda
    const strokeWidth = SIZE_STROKE_WIDTH[territory.size] || 2;
    ctx.strokeStyle = territory.ownerId ? "#000000" : "#333333";
    ctx.lineWidth = strokeWidth;
    ctx.stroke();

    // Desenhar ícone de capital
    if (territory.isCapital && drawLabel) {
      const centerX = territory.centerX * scale + offsetX;
      const centerY = territory.centerY * scale + offsetY;

      ctx.font = "bold 20px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#FFD700";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.strokeText("👑", centerX, centerY);
      ctx.fillText("👑", centerX, centerY);
    }

    // Índice do território
    if (drawLabel && territory.type === "LAND") {
      const centerX = territory.centerX * scale + offsetX;
      const centerY =
        territory.centerY * scale + offsetY + (territory.isCapital ? 20 : 0);

      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = "#000000";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.strokeText(territory.mapIndex.toString(), centerX, centerY);
      ctx.fillText(territory.mapIndex.toString(), centerX, centerY);
    }
  };

  const highlightTerritory = (
    ctx: CanvasRenderingContext2D,
    territory: Territory,
    scale: number,
    offsetX: number,
    offsetY: number,
    color: string,
    lineWidth: number
  ) => {
    const points: [number, number][] = JSON.parse(territory.polygonData);

    ctx.beginPath();
    const firstPoint = points[0];
    ctx.moveTo(
      firstPoint[0] * scale + offsetX,
      firstPoint[1] * scale + offsetY
    );

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(
        points[i][0] * scale + offsetX,
        points[i][1] * scale + offsetY
      );
    }
    ctx.closePath();

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  const blendColors = (
    color1: string,
    color2: string,
    ratio: number
  ): string => {
    const hex1 = color1.replace("#", "");
    const hex2 = color2.replace("#", "");

    const r1 = parseInt(hex1.substring(0, 2), 16);
    const g1 = parseInt(hex1.substring(2, 4), 16);
    const b1 = parseInt(hex1.substring(4, 6), 16);

    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);

    const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
    const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
    const b = Math.round(b1 * (1 - ratio) + b2 * ratio);

    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || territories.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const bounds = calculateBounds();
    const mapWidth = bounds.maxX - bounds.minX;
    const mapHeight = bounds.maxY - bounds.minY;
    const scaleX = (width - 40) / mapWidth;
    const scaleY = (height - 40) / mapHeight;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (width - mapWidth * scale) / 2 - bounds.minX * scale;
    const offsetY = (height - mapHeight * scale) / 2 - bounds.minY * scale;

    const mapX = (x - offsetX) / scale;
    const mapY = (y - offsetY) / scale;

    let foundTerritory: string | null = null;

    for (const territory of territories) {
      const points: [number, number][] = JSON.parse(territory.polygonData);
      if (isPointInPolygon(mapX, mapY, points)) {
        foundTerritory = territory.id;
        break;
      }
    }

    setHoveredTerritory(foundTerritory);
  };

  const handleClick = () => {
    if (hoveredTerritory) {
      const territory = territories.find((t) => t.id === hoveredTerritory);
      if (territory) {
        setSelectedTerritory(territory);
        onTerritoryClick?.(territory);
      }
    }
  };

  const isPointInPolygon = (
    x: number,
    y: number,
    polygon: [number, number][]
  ): boolean => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0],
        yi = polygon[i][1];
      const xj = polygon[j][0],
        yj = polygon[j][1];

      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className="border border-slate-600 rounded-lg cursor-crosshair bg-slate-900"
      />

      {/* Territory Info */}
      {selectedTerritory && (
        <div className="absolute top-4 right-4 bg-slate-800/95 border border-slate-600 rounded-lg p-4 max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-bold">
              Território #{selectedTerritory.mapIndex}
            </h3>
            <button
              onClick={() => setSelectedTerritory(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="text-sm space-y-1">
            <div className="text-slate-300">
              <span className="text-slate-400">Tipo:</span>{" "}
              {selectedTerritory.terrainType}
            </div>
            <div className="text-slate-300">
              <span className="text-slate-400">Tamanho:</span>{" "}
              {selectedTerritory.size}
            </div>
            <div className="text-slate-300">
              <span className="text-slate-400">Slots:</span>{" "}
              {selectedTerritory.usedSlots}/{selectedTerritory.areaSlots}
            </div>
            {selectedTerritory.isCapital && (
              <div className="text-yellow-400 font-semibold">👑 Capital</div>
            )}
            {selectedTerritory.ownerId && (
              <div className="text-slate-300">
                <span className="text-slate-400">Dono:</span>{" "}
                {players.find((p) => p.id === selectedTerritory.ownerId)
                  ?.kingdomName || "Desconhecido"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-slate-800/95 border border-slate-600 rounded-lg p-3">
        <h4 className="text-white font-semibold text-sm mb-2">Legenda</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(TERRAIN_COLORS).map(([terrain, color]) => (
            <div key={terrain} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-slate-700"
                style={{ backgroundColor: color }}
              ></div>
              <span className="text-slate-300">{terrain}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
