import React, { useState, useEffect, useRef, useMemo } from 'react';
import { stratify, tree } from 'd3-hierarchy';
import {
  Network,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Plus,
  ExternalLink,
  HelpCircle,
  X,
  Sparkles,
} from 'lucide-react';
import type { Page } from '../../types';
import { buildGroundedContext } from '../../ai/contextBuilder';
import { generateMindMap, type MindMapNode, type MindMapEdge } from '../../ai/aiClient';
import { getMindMapByProject, saveMindMap, awardXpEvent, type MindMapRecord } from '../../db';

interface MindMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: Page[];
  currentPageId: string;
  onNavigateToPage: (pageNumber: number) => void;
  onExplainConcept: (concept: string) => void;
  onInsertAsCanvasPage: (title: string, svgContent: string, nodes: MindMapNode[]) => void;
}

const TOPIC_COLORS = [
  '#6366f1', // Indigo
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Violet
];

export const MindMapModal: React.FC<MindMapModalProps> = ({
  isOpen,
  onClose,
  pages,
  currentPageId,
  onNavigateToPage,
  onExplainConcept,
  onInsertAsCanvasPage,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [_edges, setEdges] = useState<MindMapEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [depthLimit, setDepthLimit] = useState(3);
  const [transform, setTransform] = useState({ scale: 1, panX: 250, panY: 250 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const projectId = pages[0]?.projectId || 'default';

  useEffect(() => {
    if (isOpen && pages.length > 0) {
      loadOrGenerateMindMap();
    }
  }, [isOpen, pages.length]);

  const loadOrGenerateMindMap = async () => {
    setIsLoading(true);
    try {
      const existing = await getMindMapByProject(projectId);
      if (existing && existing.nodes.length > 0) {
        setNodes(existing.nodes);
        setEdges(existing.edges);
        setSelectedNode(existing.nodes[0]);
        setIsLoading(false);
        return;
      }

      await handleRegenerate();
    } catch (err) {
      console.warn('Failed loading mind map:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setIsLoading(true);
    try {
      const context = await buildGroundedContext({
        pages,
        currentPageId,
        scope: 'project',
      });

      const res = await generateMindMap(context);
      setNodes(res.nodes);
      setEdges(res.edges);
      setSelectedNode(res.nodes[0] || null);

      const record: MindMapRecord = {
        id: `mm-${projectId}`,
        projectId,
        contentHash: `hash-${Date.now()}`,
        nodes: res.nodes,
        edges: res.edges,
        updatedAt: Date.now(),
      };
      await saveMindMap(record);

      await awardXpEvent({
        type: 'create_page',
        amount: 30,
        description: 'Generated interactive AI Mind Map',
        referenceId: projectId,
      });
    } catch (err) {
      console.error('Mind map generation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Build tree hierarchy using d3-hierarchy
  const layout = useMemo(() => {
    if (nodes.length === 0) return null;

    try {
      // Find root node (parentId is undefined or empty)
      const rootNode = nodes.find((n) => !n.parentId) || nodes[0];
      const validNodes = nodes.map((n) => ({
        ...n,
        parentId: n.id === rootNode.id ? undefined : n.parentId || rootNode.id,
      }));

      // Filter out collapsed descendants
      const visibleNodes = validNodes.filter((n) => {
        if (n.level > depthLimit) return false;
        let curr = n;
        while (curr.parentId) {
          if (collapsedNodeIds.has(curr.parentId)) return false;
          curr = validNodes.find((v) => v.id === curr.parentId) || curr;
          if (!curr.parentId) break;
        }
        return true;
      });

      const stratified = stratify<MindMapNode>()
        .id((d) => d.id)
        .parentId((d) => d.parentId)(visibleNodes);

      // Horizontal tree layout: width -> y, height -> x
      const treeLayout = tree<MindMapNode>().nodeSize([60, 220]);
      const root = treeLayout(stratified);

      return root;
    } catch (e) {
      console.warn('D3 stratify error:', e);
      return null;
    }
  }, [nodes, depthLimit, collapsedNodeIds]);

  const toggleCollapse = (nodeId: string) => {
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  // SVG Pan/Zoom Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - transform.panX, y: e.clientY - transform.panY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    setTransform((prev) => ({
      ...prev,
      panX: e.clientX - dragStartRef.current!.x,
      panY: e.clientY - dragStartRef.current!.y,
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoom = (delta: number) => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.4, Math.min(2.5, prev.scale + delta)),
    }));
  };

  const handleResetZoom = () => {
    setTransform({ scale: 1, panX: 250, panY: 250 });
  };

  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const svgStr = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmap-${projectId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col h-[90vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/80 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Interactive Study Mind Map
              </h2>
              <p className="text-xs text-slate-500">
                Hierarchical concept graph synthesized exclusively from your notes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search concepts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44"
              />
            </div>

            {/* Depth Slider */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <span>Depth: {depthLimit}</span>
              <input
                type="range"
                min="1"
                max="4"
                value={depthLimit}
                onChange={(e) => setDepthLimit(Number(e.target.value))}
                className="w-16 accent-indigo-600"
              />
            </div>

            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl border border-indigo-200 dark:border-indigo-800 transition"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Regenerate
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workspace: Graph SVG Canvas + Detail Sidebar */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* SVG Viewport */}
          <div
            className="flex-1 bg-slate-50 dark:bg-slate-950/60 overflow-hidden relative cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {/* Zoom Float Toolbar */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700 p-1 rounded-xl shadow-lg">
              <button
                type="button"
                onClick={() => handleZoom(0.15)}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleZoom(-0.15)}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                title="Reset Zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <svg
              ref={svgRef}
              className="w-full h-full select-none"
              style={{
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
            >
              <g
                transform={`translate(${transform.panX}, ${transform.panY}) scale(${transform.scale})`}
              >
                {/* Render Branch Links */}
                {layout &&
                  layout.links().map((link, idx) => {
                    const sourceX = link.source.y;
                    const sourceY = link.source.x;
                    const targetX = link.target.y;
                    const targetY = link.target.x;

                    // Smooth cubic bezier link
                    const pathData = `M ${sourceX} ${sourceY} C ${(sourceX + targetX) / 2} ${sourceY}, ${(sourceX + targetX) / 2} ${targetY}, ${targetX} ${targetY}`;

                    return (
                      <path
                        key={`link-${idx}`}
                        d={pathData}
                        fill="none"
                        stroke="var(--border-link, #cbd5e1)"
                        strokeWidth={2}
                        className="dark:stroke-slate-700 transition-all"
                      />
                    );
                  })}

                {/* Render Nodes */}
                {layout &&
                  layout.descendants().map((dNode) => {
                    const nodeData = dNode.data;
                    const isSelected = selectedNode?.id === nodeData.id;
                    const isMatch = searchQuery && nodeData.label.toLowerCase().includes(searchQuery.toLowerCase());
                    const colorIndex = (nodeData.level || 0) % TOPIC_COLORS.length;
                    const nodeColor = TOPIC_COLORS[colorIndex];
                    const hasChildren = dNode.children && dNode.children.length > 0;
                    const isCollapsed = collapsedNodeIds.has(nodeData.id);

                    return (
                      <g
                        key={nodeData.id}
                        transform={`translate(${dNode.y}, ${dNode.x})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(nodeData);
                        }}
                        className="cursor-pointer group"
                      >
                        {/* Node Card Bubble */}
                        <rect
                          x={-10}
                          y={-22}
                          width={Math.max(140, nodeData.label.length * 8 + 35)}
                          height={44}
                          rx={14}
                          fill="var(--bg-node, #ffffff)"
                          stroke={isMatch ? '#f59e0b' : isSelected ? nodeColor : '#e2e8f0'}
                          strokeWidth={isSelected || isMatch ? 2.5 : 1.5}
                          className="dark:fill-slate-800 dark:stroke-slate-700 shadow-md group-hover:scale-102 transition-all"
                        />

                        {/* Level color indicator dot */}
                        <circle cx={4} cy={0} r={5} fill={nodeColor} />

                        {/* Label text */}
                        <text
                          x={16}
                          y={-2}
                          className="text-xs font-semibold fill-slate-900 dark:fill-slate-100 font-sans pointer-events-none"
                        >
                          {nodeData.label.slice(0, 24)}
                        </text>

                        {/* Subtext: Page Ref */}
                        <text
                          x={16}
                          y={12}
                          className="text-[9px] fill-slate-400 dark:fill-slate-500 font-sans pointer-events-none"
                        >
                          Page {nodeData.pageRefs?.[0] || 1}
                        </text>

                        {/* Collapse/Expand Toggle Button */}
                        {hasChildren && (
                          <g
                            transform={`translate(${Math.max(140, nodeData.label.length * 8 + 35) - 22}, 0)`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCollapse(nodeData.id);
                            }}
                            className="cursor-pointer hover:opacity-80"
                          >
                            <circle cx={0} cy={0} r={7} fill="#e2e8f0" className="dark:fill-slate-700" />
                            <text
                              x={-3}
                              y={3.5}
                              className="text-[10px] font-bold fill-slate-700 dark:fill-slate-200"
                            >
                              {isCollapsed ? '+' : '−'}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
              </g>
            </svg>
          </div>

          {/* Right Concept Detail Inspector */}
          {selectedNode && (
            <div className="w-80 border-l border-slate-200 dark:border-slate-800 p-5 bg-white dark:bg-slate-900 flex flex-col justify-between overflow-y-auto">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                    Concept Details
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                    Level {selectedNode.level}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {selectedNode.label}
                </h3>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  {selectedNode.summary || 'Summary synthesized from canvas vector notes.'}
                </p>

                {/* Sourced Page References */}
                {selectedNode.pageRefs && selectedNode.pageRefs.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold text-slate-500 mb-1.5 block">
                      Sources in your notes:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedNode.pageRefs.map((pNum) => (
                        <button
                          key={pNum}
                          type="button"
                          onClick={() => {
                            onNavigateToPage(pNum);
                            onClose();
                          }}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Jump to Page {pNum}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Explain in Chat action */}
                <button
                  type="button"
                  onClick={() => {
                    onExplainConcept(selectedNode.label);
                    onClose();
                  }}
                  className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-medium transition"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                  Explain Concept in AI Chat
                </button>
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-col gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    onInsertAsCanvasPage(`Mind Map: ${pages[0]?.title || 'Overview'}`, '', nodes);
                    onClose();
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Insert as New Canvas Page
                </button>

                <button
                  type="button"
                  onClick={handleExportSvg}
                  className="w-full py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export as Vector SVG
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
