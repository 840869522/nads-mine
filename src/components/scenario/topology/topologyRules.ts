import { TopologyNode, TopologyEdge } from '../../../types';
import { SPECIAL_IMAGES } from '../../../constants';

// 判断是否为特定镜像的容器
export const isSpecialImageContainer = (node?: TopologyNode): boolean => {
  if (!node || node.type !== 'container') return false;
  const image = node.config?.Image || '';
  return SPECIAL_IMAGES.some(img => image.includes(img));
};

// 判断两节点是否允许直连（至少一端为交换机，或特定镜像容器）
export const canDirectlyLinkNodes = (a?: TopologyNode, b?: TopologyNode): boolean => {
  if (!a || !b) return false;
  if (a.type === 'switch' || b.type === 'switch') return true;
  if (isSpecialImageContainer(a) || isSpecialImageContainer(b)) return true;
  return false;
};

// 是否为容器或虚拟机
export const isContainerOrVM = (n?: TopologyNode): boolean => !!n && (n.type === 'container' || n.type === 'virtual_machine');

// 单交换机（单边）限制：容器/虚拟机只能连接一条边；特定镜像容器不受此限
export const wouldViolateSingleSwitchRule = (
  a: TopologyNode | undefined,
  b: TopologyNode | undefined,
  edges: TopologyEdge[],
): boolean => {
  if (!a || !b) return true;
  // 特殊镜像容器放开限制
  if (isSpecialImageContainer(a) || isSpecialImageContainer(b)) return false;

  const aHasEdge = isContainerOrVM(a) && edges.some(e => e.source === a.id || e.target === a.id);
  const bHasEdge = isContainerOrVM(b) && edges.some(e => e.source === b.id || e.target === b.id);
  return !!(aHasEdge || bHasEdge);
};

