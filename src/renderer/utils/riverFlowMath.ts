import { VectorLine } from '../types';

export interface RiverSegment {
  points: number[];
  width: number;
  isTaper?: boolean;
}

export interface FlowResult {
  [lineId: string]: RiverSegment[];
}

interface Node {
  id: string;
  x: number;
  y: number;
  flow: number;
  inDegree: number;
  edges: Edge[];
}

interface Edge {
  id: string;
  lineId: string;
  segmentIndex: number;
  u: string;
  v: string;
}

function getNodeId(x: number, y: number): string {
  const precision = 10;
  return `${Math.round(x / precision) * precision},${Math.round(y / precision) * precision}`;
}

export function computeRiverFlows(riverLines: VectorLine[], baseWidth: number): FlowResult {
  const nodes = new Map<string, Node>();
  const edges: Edge[] = [];

  const getNode = (x: number, y: number): Node => {
    const id = getNodeId(x, y);
    if (!nodes.has(id)) {
      nodes.set(id, { id, x, y, flow: 0, inDegree: 0, edges: [] });
    }
    return nodes.get(id)!;
  };

  // 1. Build the graph using drawing order as explicit flow direction
  riverLines.forEach(line => {
    const pts = line.points;
    for (let i = 0; i < pts.length - 2; i += 2) {
      const u = getNode(pts[i], pts[i+1]);
      const v = getNode(pts[i+2], pts[i+3]);
      
      const edge: Edge = {
        id: `${line.id}-${i}`,
        lineId: line.id,
        segmentIndex: i,
        u: u.id,
        v: v.id
      };
      
      edges.push(edge);
      u.edges.push(edge);
      v.inDegree++;
    }
  });

  // 2. Topological Sort from Sources
  const topoQueue: string[] = [];
  for (const node of nodes.values()) {
    if (node.inDegree === 0) {
      node.flow = 1; // Base flow for sources
      topoQueue.push(node.id);
    }
  }

  // To handle cycles, keep track of remaining inDegree
  const remainingInDegree = new Map<string, number>();
  for (const node of nodes.values()) {
    remainingInDegree.set(node.id, node.inDegree);
  }

  const edgeFlows = new Map<string, number>();

  let topoIdx = 0;
  while (topoIdx < topoQueue.length) {
    const currId = topoQueue[topoIdx++];
    const curr = nodes.get(currId)!;
    
    const outEdges = curr.edges;
    if (outEdges.length > 0) {
      const flowToDistribute = curr.flow / outEdges.length;
      for (const edge of outEdges) {
        edgeFlows.set(edge.id, flowToDistribute);
        
        const target = nodes.get(edge.v)!;
        target.flow += flowToDistribute;
        
        const currentIn = remainingInDegree.get(target.id)! - 1;
        remainingInDegree.set(target.id, currentIn);
        
        if (currentIn === 0) {
          topoQueue.push(target.id);
        }
      }
    }
  }

  // Handle any nodes that were part of a cycle and not reached
  for (const edge of edges) {
    if (!edgeFlows.has(edge.id)) {
      edgeFlows.set(edge.id, 1);
    }
  }

  // 3. Map flows back to lines
  const result: FlowResult = {};
  
  const edgesByLineId = new Map<string, Edge[]>();
  for (const edge of edges) {
    if (!edgesByLineId.has(edge.lineId)) {
      edgesByLineId.set(edge.lineId, []);
    }
    edgesByLineId.get(edge.lineId)!.push(edge);
  }

  for (const line of riverLines) {
    result[line.id] = [];
    
    const lineEdges = (edgesByLineId.get(line.id) || []).sort((a,b) => a.segmentIndex - b.segmentIndex);
    
    let currentWidth = -1;
    let currentPoints: number[] = [];
    let currentIsTaper = false;

    for (const edge of lineEdges) {
      const u = nodes.get(edge.u)!;
      const flow = edgeFlows.get(edge.id)!;
      const edgeWidth = Math.min(10, baseWidth + (flow - 1) * 2);
      const edgeIsTaper = u.inDegree === 0;

      if (currentWidth === -1) {
        currentWidth = edgeWidth;
        currentIsTaper = edgeIsTaper;
        currentPoints = [line.points[edge.segmentIndex], line.points[edge.segmentIndex+1], line.points[edge.segmentIndex+2], line.points[edge.segmentIndex+3]];
      } else if (edgeWidth === currentWidth) {
        // Continue the same segment, even if the start was a taper, so the spline is continuous
        currentPoints.push(line.points[edge.segmentIndex+2], line.points[edge.segmentIndex+3]);
      } else {
        // Flush current
        result[line.id].push({ points: currentPoints, width: currentWidth, isTaper: currentIsTaper });
        currentWidth = edgeWidth;
        currentIsTaper = edgeIsTaper;
        currentPoints = [line.points[edge.segmentIndex], line.points[edge.segmentIndex+1], line.points[edge.segmentIndex+2], line.points[edge.segmentIndex+3]];
      }
    }
    if (currentPoints.length > 0) {
      result[line.id].push({ points: currentPoints, width: currentWidth, isTaper: currentIsTaper });
    }
  }

  return result;
}
