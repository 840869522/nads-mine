import {useEffect, useRef, useState} from "react";
import * as THREE from "three";
import {CSS2DObject, CSS2DRenderer, GLTFLoader, OrbitControls} from "three-stdlib";
import { BattlefieldInfo, LogInfo, TeamInfo } from "./team";
import FictionTeam from "./fictionTeam";
import { AdData } from "./page";

function createSpaceship(
    scene: THREE.Scene,
    rings: THREE.Group,
    modelPath: string,
    scale: number = 6,
    idx: number = 0
): Promise<THREE.Object3D> {
    return new Promise((resolve) => {
        const loader = new GLTFLoader();
        loader.load(modelPath, (gltf) => {
            const spaceship = gltf.scene;
            spaceship.scale.set(scale, scale, scale);

            // 随机选择一个圆环
            const ringIndex = Math.floor(Math.random() * rings.children.length);
            const ring = rings.children[ringIndex];
            
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            const positions = ring.geometry.attributes.position.array;
            const segments = positions.length / 3;

            // 随机选择圆环上的一个顶点
            let vertexIndex: number;

            if (idx === 1) {
                // 取前半段 [0, Math.floor(segments / 2))
                vertexIndex = Math.floor(Math.random() * Math.floor(segments / 2));
            } else {
                // 取后半段 [Math.floor(segments / 2), segments)
                vertexIndex = Math.floor(Math.random() * Math.ceil(segments / 2)) + Math.floor(segments / 2);
            }

            const x = positions[vertexIndex * 3];
            const y = positions[vertexIndex * 3 + 1];
            const z = positions[vertexIndex * 3 + 2];

            spaceship.position.set(x, z, y);

            // 朝向圆心
            spaceship.lookAt(0, 0, 0);

            // 将飞船添加到场景中
            scene.add(spaceship);

            // 返回飞船对象
            resolve(spaceship);
        });
    });
}

function shootRay(scene: THREE.Scene, startNode: THREE.Object3D, endNode: THREE.Object3D) {
    const start = new THREE.Vector3();
    const end = new THREE.Vector3();

    // 1. 获取旋转后的世界坐标
    startNode.getWorldPosition(start);
    endNode.getWorldPosition(end);

    const steps = 100;

    const arcHeight = 5;

    const mid = start.clone().add(end).multiplyScalar(0.5);

    mid.y += arcHeight;

    // 生成完整轨迹数组 (使用二次贝塞尔曲线公式)
    const trajectory: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const point = start.clone().multiplyScalar((1 - t) ** 2)
            .add(mid.clone().multiplyScalar(2 * (1 - t) * t))
            .add(end.clone().multiplyScalar(t ** 2));
        trajectory.push(point);
    }

    // ... (剩余的 Line、Material、Animation 逻辑保持不变) ...
    const geometry = new THREE.BufferGeometry().setFromPoints(trajectory);
    geometry.setDrawRange(0, 2);

    const material = new THREE.LineBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 1,
    });

    const line = new THREE.Line(geometry, material);
    scene.add(line);

    const startTime = performance.now();
    const duration = 1000; // 1s 发射完成

    function animate() {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1); // 0 ~ 1
        const progress = Math.floor(t * steps);

        geometry.setDrawRange(0, progress + 1);

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            setTimeout(() => {
                scene.remove(line);
                geometry.dispose();
                material.dispose();
            }, 1000);
        }
    }

    animate();
}

function shootBalls(scene: THREE.Scene, startNode: THREE.Object3D, firstRingRadius: number) {

    const ballBaseRadius = 0.01;
    const ballMaxSize = 0.08;
    const singleBallLifespan = 4000;  // 单个小球的生命周期 (4秒)
    const emissionInterval = 150;     // 小球之间的发射间隔 (150ms)
    const arcHeight = 1;
    const ballColor = 0xADD8E6;
    const ringYPosition = 0;

    const streamDuration = singleBallLifespan;

    const pauseDuration = 2000;

    const totalBallsInStream = Math.floor(streamDuration / emissionInterval) + 1;

    const material = new THREE.MeshBasicMaterial({ color: ballColor });
    let isShooting = true;

    function emitSingleBall() {

        const start = new THREE.Vector3();
        startNode.getWorldPosition(start);

        const fixedTargetRadius = firstRingRadius * 0.75;
        const radialDirection = start.clone().setY(0).normalize();
        const end = radialDirection.multiplyScalar(fixedTargetRadius);
        end.y = ringYPosition;

        const mid = start.clone().add(end).multiplyScalar(0.5);
        const baseHeight = Math.max(start.y, end.y);
        mid.y = baseHeight + arcHeight;

        const geometry = new THREE.SphereGeometry(ballBaseRadius, 8, 8);
        const ballMesh = new THREE.Mesh(geometry, material);
        ballMesh.position.copy(start);
        scene.add(ballMesh);

        const ballStartTime = performance.now();

        function animateBall() {
            const elapsed = performance.now() - ballStartTime;
            const t = elapsed / singleBallLifespan;

            if (t < 1) {
                // 抛物线运动
                const position = start.clone().multiplyScalar((1 - t) ** 2)
                    .add(mid.clone().multiplyScalar(2 * (1 - t) * t))
                    .add(end.clone().multiplyScalar(t ** 2));
                ballMesh.position.copy(position);

                const scaleFactor = ballBaseRadius + (ballMaxSize - ballBaseRadius) * t;
                ballMesh.scale.set(scaleFactor / ballBaseRadius, scaleFactor / ballBaseRadius, scaleFactor / ballBaseRadius);

                requestAnimationFrame(animateBall);
            } else {
                scene.remove(ballMesh);
                geometry.dispose();
            }
        }

        animateBall();
    }

    function shootStream() {
        if (!isShooting) return;

        let ballCount = 0;

        function streamLoop() {
            if (!isShooting || ballCount >= totalBallsInStream) {

                const totalDelay = streamDuration + pauseDuration;
                setTimeout(shootStream, totalDelay);
                return;
            }

            emitSingleBall();
            ballCount++;

            setTimeout(streamLoop, emissionInterval);
        }

        streamLoop();
    }

    shootStream();

    return {
        stop: () => { isShooting = false; }
    };
}

// --- 节点几何体常量 ---
const GEOM_STAND_SIZE: number = 0.5;
const GEOM_STAND_HEIGHT: number = 0.025;
const GEOM_BASE_HEIGHT: number = 0.4;
const GEOM_BASE_BOTTOM_RADIUS: number = 0.15;
const GEOM_BASE_TOP_RADIUS: number = 0.05;
const GEOM_TOP_RADIUS: number = GEOM_BASE_BOTTOM_RADIUS;

// --- 通用节点创建函数 ---
function createNodeMesh(nodeMaterial: THREE.Material): { nodeGroup: THREE.Group, topMesh: THREE.Mesh } {
    const nodeGroup = new THREE.Group();

    // 1. 底部正方形台子
    const standGeometry = new THREE.BoxGeometry(GEOM_STAND_SIZE, GEOM_STAND_HEIGHT, GEOM_STAND_SIZE);
    const standMesh = new THREE.Mesh(standGeometry, nodeMaterial);
    standMesh.position.y = GEOM_STAND_HEIGHT / 2;
    nodeGroup.add(standMesh);

    // 2. 棋子底座（圆台）
    const basePoints: THREE.Vector2[] = [];
    for (let j = 0; j <= 20; j++) {
        const y = (j / 20) * GEOM_BASE_HEIGHT;
        const progress = j / 20;
        const radius = GEOM_BASE_BOTTOM_RADIUS + (GEOM_BASE_TOP_RADIUS - GEOM_BASE_BOTTOM_RADIUS) * Math.sin(progress * Math.PI / 2);
        basePoints.push(new THREE.Vector2(radius, y));
    }
    const baseGeometry = new THREE.LatheGeometry(basePoints, 32);
    const baseMesh = new THREE.Mesh(baseGeometry, nodeMaterial);
    baseMesh.position.y = GEOM_STAND_HEIGHT;
    nodeGroup.add(baseMesh);

    // 3. 棋子顶部（球体）
    const topGeometry = new THREE.SphereGeometry(GEOM_TOP_RADIUS, 32, 32);
    const topMesh = new THREE.Mesh(topGeometry, nodeMaterial);
    topMesh.position.y = GEOM_STAND_HEIGHT + GEOM_BASE_HEIGHT + GEOM_TOP_RADIUS;
    nodeGroup.add(topMesh);

    // 4. 底部一圈小球
    const blueBallMaterial = new THREE.MeshBasicMaterial({ color: 0xADD8E6 });
    const blackBallMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const ballRadius: number = 0.03;
    const standBallCount: number = 24;
    const ballCircleRadius: number = GEOM_STAND_SIZE / 2 - ballRadius;

    for (let j = 0; j < standBallCount; j++) {
        const ballAngle: number = (j / standBallCount) * Math.PI * 2;
        const ballGeometry = new THREE.SphereGeometry(ballRadius, 16, 16);
        const ballMesh: THREE.Mesh = new THREE.Mesh(
            ballGeometry,
            j % 2 === 0 ? blueBallMaterial : blackBallMaterial
        );

        ballMesh.position.set(
            Math.cos(ballAngle) * ballCircleRadius,
            GEOM_STAND_HEIGHT + ballRadius,
            Math.sin(ballAngle) * ballCircleRadius
        );
        nodeGroup.add(ballMesh);
    }

    return { nodeGroup, topMesh };
}

// --- 节点信息收集 Map ---
// 存储 { position: THREE.Vector3, isOccupied: boolean, ip: string (optional) }
const allNodePositions: Map<number, { position: THREE.Vector3, isOccupied: boolean, ip: string | null }> = new Map();


interface VMItem {
    name: string;
    ip: string;
    teamName: string;
}

interface VMResult {
    trueTargetList: VMItem[];
    falseTargetList: VMItem[];
}

interface FlagLog {
    redLogList: LogInfo[];
    blueLogList: LogInfo[];
}

/**
 * 获取 VM 列表并拆分 trueList / falseList
 */
async function fetchVMs(instanceId: string): Promise<VMResult> {
    try {
        const res = await fetch(`/back/api/visualization/${instanceId}/vms`);
        if (!res.ok) throw new Error(`网络请求失败: ${res.status}`);

        const json = await res.json();
        // 直接返回 data 部分，前端拿到就是 { trueTargetList, falseTargetList }
        return json.data as VMResult;
    } catch (err) {
        console.error("请求接口出错:", err);
        // 异常时返回空列表，保证类型安全
        return { trueTargetList: [], falseTargetList: [] };
    }
}

async function fetchLogs(instanceId: string): Promise<LogInfo[]> {
    try {
        const res = await fetch(`/back/api/visualization/${instanceId}/logs`);
        if (!res.ok) throw new Error(`网络请求失败: ${res.status}`);

        const json = await res.json();
        // 直接返回 data 部分，前端拿到就是 { trueTargetList, falseTargetList }
        return json.data as LogInfo[];
    } catch (err) {
        console.error("请求接口出错:", err);
        // 异常时返回空列表，保证类型安全
        return [];
    }
}

async function fetchAttackLogs(sceneId: string) {
    const res = await fetch(`/back/api/visualization/${sceneId}/att`);
    const result = await res.json();

    // if (result.code !== 200) {
    //     console.error(result.message);
    //     return [];
    // }

    return result; // 这里是对象数组 [{ userId, username }, ...]
}

export default function ThreeDimensional(adData: AdData){
    const initialized = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const battlefieldRef = useRef<HTMLDivElement>(null);
    const [vms, setVms] = useState<VMResult>({ trueTargetList: [], falseTargetList: [] });

    const blueTeam: BattlefieldInfo = {
        type: 0,
        sceneId: adData ? adData.id : "",
        logInfo: blueLogInfos
    }

    const redTeam: BattlefieldInfo = {
        type: 1,
        sceneId: adData ? adData.id : "",
        logInfo: redLogInfos
    }

    const [redTeamState, setRedTeamState] = useState<BattlefieldInfo>(redTeam);
    const [blueTeamState, setBlueTeamState] = useState<BattlefieldInfo>(blueTeam);

    useEffect(() => {
        if (!containerRef.current) return;
        if (initialized.current) return; // 已经加载过了，直接退出
        initialized.current = true;      // 第一次加载时设置为 true
        const container = containerRef.current;
        
        // 获取containerRef的当前宽高
        const width = container.clientWidth;
        const height = container.clientHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);
        container.style.backgroundColor = 'rgba(0, 50, 150, 0.6)';

        const labelRenderer = new CSS2DRenderer();
        labelRenderer.setSize(width, height); // 尺寸与 WebGL 渲染器一致

        // 设置样式，确保 HTML 标签浮动在 WebGL Canvas 上方
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.top = '0px';
        labelRenderer.domElement.style.pointerEvents = 'none'; // 允许鼠标点击穿透文字层到下面的 3D 场景
        labelRenderer.domElement.style.zIndex = '10'; // 强制文字层在最上层

        // 将 CSS2D 渲染器的 DOM 元素添加到与 Canvas 相同的容器中
        container.appendChild(labelRenderer.domElement);

        // --- 创建四个圆环 ---
        const rings: THREE.Mesh[] = [];
        const baseRadius = 5;
        const relativeRingRadii = [1, 2, 3, 4];
        const ringRadii = relativeRingRadii.map(r => r + baseRadius);

        const tubeRadius = 0.01;
        const radialSegments = 64;
        const tubularSegments = 64;
        const ringColor = new THREE.Color(0x87cefa);

        ringRadii.forEach((radius) => {
            const geometry = new THREE.TorusGeometry(
                radius,
                tubeRadius,
                radialSegments,
                tubularSegments
            );
            const material = new THREE.MeshBasicMaterial({ color: ringColor });
            const ring = new THREE.Mesh(geometry, material);
            ring.rotation.x = Math.PI / 2;
            rings.push(ring);
            scene.add(ring);
        });

        // 1. 获取第一个圆环的半径
        const firstRingRadius = ringRadii[0];

        // 定义梯形的半径：
        const trapOuterRadius = firstRingRadius * 0.90;
        const trapInnerRadius = firstRingRadius * 0.45;

        const trapezoidCount = 7;
        const trapezoidHeight = 0.005;

        // 关键修改：使用更亮、更鲜艳的颜色数组
        const trapezoidColors = [
            0xFF4500, // 亮橙色 (OrangeRed)
            0x32CD32, // 亮绿色 (LimeGreen)
            0x1E90FF, // 亮蓝色 (DodgerBlue)
            0xFFD700, // 金色 (Gold)
            0xBA55D3, // 中兰花紫 (MediumOrchid)
            0x00CED1, // 深绿松石 (DarkTurquoise)
            0xFA8072  // 鲑鱼色 (Salmon)
        ];

        // 间隙控制参数 (更窄的梯形)
        const gapFactor = 0.3;
        const fullAngleStep = Math.PI * 2 / trapezoidCount;

        for (let k = 0; k < trapezoidCount; k++) {
            const startAngle = (k / trapezoidCount) * Math.PI * 2;

            // 计算梯形实际开始和结束的角度
            const gapAngle = fullAngleStep * (1 - gapFactor) / 2;

            const currentAngle = startAngle + gapAngle;
            const nextAngle = startAngle + fullAngleStep - gapAngle;

            // 2. 定义梯形的四个顶点 (扇形计算)
            const points = [
                // 内侧短边
                new THREE.Vector2(Math.cos(currentAngle) * trapInnerRadius, Math.sin(currentAngle) * trapInnerRadius),
                new THREE.Vector2(Math.cos(nextAngle) * trapInnerRadius, Math.sin(nextAngle) * trapInnerRadius),

                // 外侧长边
                new THREE.Vector2(Math.cos(nextAngle) * trapOuterRadius, Math.sin(nextAngle) * trapOuterRadius),
                new THREE.Vector2(Math.cos(currentAngle) * trapOuterRadius, Math.sin(currentAngle) * trapOuterRadius),
            ];

            // 3. 创建 Shape 并挤压成几何体
            const trapezoidShape = new THREE.Shape(points);

            const extrudeSettings = {
                steps: 1,
                depth: trapezoidHeight,
                bevelEnabled: false
            };
            const trapezoidGeometry = new THREE.ExtrudeGeometry(trapezoidShape, extrudeSettings);

            // 关键修改：为每个梯形创建带有不同颜色且不透明的新材质
            const trapezoidMaterial = new THREE.MeshBasicMaterial({
                color: trapezoidColors[k % trapezoidColors.length] // 从颜色数组中获取更亮的颜色
                // transparent 和 opacity 属性已移除
            });

            const trapezoidMesh = new THREE.Mesh(trapezoidGeometry, trapezoidMaterial);

            // 4. 旋转和定位：平躺在 XZ 平面上
            trapezoidMesh.rotation.x = Math.PI / 2;
            trapezoidMesh.position.set(0, -trapezoidHeight / 2, 0);

            scene.add(trapezoidMesh);
        }

        // --- 添加第一个和第二个圆环之间的连接线 (扁平，有间距) ---
        const connectionPadding = 0.15;
        const firstRingOuterRadiusWithPadding = (ringRadii[0] + tubeRadius) + connectionPadding;
        const secondRingInnerRadiusWithPadding = (ringRadii[1] - tubeRadius) - connectionPadding;

        const connectingLineWidth = 0.1;
        const originalConnectingLineColor = new THREE.Color(0x87cefa);
        const whiteConnectingLineColor = new THREE.Color(0xffffff);

        const lineLength = secondRingInnerRadiusWithPadding - firstRingOuterRadiusWithPadding;

        if (lineLength <= 0) {
            console.warn("无法创建连接线：第一个圆环外边缘已超过第二个圆环内边缘，请检查半径和padding设置。");
            return;
        }

        const radialCenter = (firstRingOuterRadiusWithPadding + secondRingInnerRadiusWithPadding) / 2;
        const circumference = 2 * Math.PI * radialCenter;
        const segmentPlusGapWidth = connectingLineWidth * 2;
        const numberOfConnectingLines = Math.floor(circumference / segmentPlusGapWidth);

        const originalLineMaterial = new THREE.MeshBasicMaterial({
            color: originalConnectingLineColor,
            transparent: true,
            opacity: 0.3,
        });

        const whiteLineMaterial = new THREE.MeshBasicMaterial({
            color: whiteConnectingLineColor,
            transparent: true,
            opacity: 0.5,
        });

        for (let i = 0; i < numberOfConnectingLines; i++) {
            const angle = (i / numberOfConnectingLines) * Math.PI * 2;

            const startPoint = new THREE.Vector3(
                Math.cos(angle) * firstRingOuterRadiusWithPadding,
                0,
                Math.sin(angle) * firstRingOuterRadiusWithPadding
            );

            const endPoint = new THREE.Vector3(
                Math.cos(angle) * secondRingInnerRadiusWithPadding,
                0,
                Math.sin(angle) * secondRingInnerRadiusWithPadding
            );

            const segmentCenter = new THREE.Vector3().copy(startPoint).add(endPoint).divideScalar(2);
            const segmentDirection = new THREE.Vector3().copy(endPoint).sub(startPoint).normalize();

            if (i % 3 === 0) {
                const whiteSegmentLength = lineLength / 3;
                const whiteSegmentGeometry = new THREE.BoxGeometry(
                    connectingLineWidth,
                    whiteSegmentLength,
                    0.005
                );
                const whiteSegmentMesh = new THREE.Mesh(whiteSegmentGeometry, whiteLineMaterial);

                const whiteSegmentCenter = new THREE.Vector3()
                    .copy(startPoint)
                    .add(segmentDirection.clone().multiplyScalar(whiteSegmentLength / 2));

                whiteSegmentMesh.position.copy(whiteSegmentCenter);
                whiteSegmentMesh.lookAt(endPoint); 
                whiteSegmentMesh.rotateX(Math.PI / 2);

                scene.add(whiteSegmentMesh);

                const blueSegmentLength = lineLength * 2 / 3;
                const blueSegmentGeometry = new THREE.BoxGeometry(
                    connectingLineWidth,
                    blueSegmentLength,
                    0.005
                );
                const blueSegmentMesh = new THREE.Mesh(blueSegmentGeometry, originalLineMaterial);

                const blueSegmentCenter = new THREE.Vector3()
                    .copy(startPoint)
                    .add(segmentDirection.clone().multiplyScalar(whiteSegmentLength + blueSegmentLength / 2));

                blueSegmentMesh.position.copy(blueSegmentCenter);
                blueSegmentMesh.lookAt(endPoint);
                blueSegmentMesh.rotateX(Math.PI / 2);

                scene.add(blueSegmentMesh);
            } else {
                const lineGeometry = new THREE.BoxGeometry(
                    connectingLineWidth,
                    lineLength,
                    0.005
                );
                const lineMesh = new THREE.Mesh(lineGeometry, originalLineMaterial);

                lineMesh.position.copy(segmentCenter);
                lineMesh.lookAt(endPoint);
                lineMesh.rotateX(Math.PI / 2);

                scene.add(lineMesh);
            }
        }

        // --- 新增: 在第二个和第三个圆环之间创建3组独立的线段 ---
        const newDashedRings: THREE.Group[] = [];
        const secondRingRadius = ringRadii[1];
        const thirdRingRadius = ringRadii[2];

        // 新“圆环”的半径
        const newDashedRingRadii = [
            secondRingRadius + (thirdRingRadius - secondRingRadius) * 0.1,
            secondRingRadius + (thirdRingRadius - secondRingRadius) * 0.5,
            secondRingRadius + (thirdRingRadius - secondRingRadius) * 0.9,
        ];

        // 每一组线段的宽度
        const newSegmentWidths = [0.1, 0.5, 0.02];

        // 虚线参数：线段和间隙的长度
        const segmentLength = 0.2;
        const gapLength = 0.1;

        // 新增：为第一个线段创建更低的透明度材质
        const solidLineMaterial = new THREE.MeshBasicMaterial({
            color: originalLineMaterial.color,
            transparent: true,
            opacity: 0.9, // 透明度更高，看起来更实心
        });


        newDashedRingRadii.forEach((ringRadius, index) => {
            // 宽度：直接从数组中获取已修改的值
            const currentSegmentWidth = newSegmentWidths[index];

            let currentSegmentLength = segmentLength;

            // 长度：只将第一个和第二个圆环的长度增加5倍和8倍
            if (index === 0) {
                currentSegmentLength *= 8;
            } else if (index === 1) {
                currentSegmentLength *= 10;
            }

            const segmentTotalLength = currentSegmentLength + gapLength;

            // 修正：根据索引选择材质
            let material;
            if (index === 0) {
                material = solidLineMaterial; // 第一个线段使用更低的透明度
            } else {
                material = originalLineMaterial; // 其他线段使用原始材质
            }

            const group = new THREE.Group();

            const circumferenceAtRadius = 2 * Math.PI * ringRadius;
            const numberOfSegments = Math.floor(circumferenceAtRadius / segmentTotalLength);

            for (let i = 0; i < numberOfSegments; i++) {
                const angle = (i / numberOfSegments) * Math.PI * 2;

                const segmentGeometry = new THREE.BoxGeometry(
                    currentSegmentWidth,
                    0.005,
                    currentSegmentLength
                );
                const segmentMesh = new THREE.Mesh(segmentGeometry, material);

                segmentMesh.position.set(
                    Math.cos(angle) * ringRadius,
                    0,
                    Math.sin(angle) * ringRadius
                );

                segmentMesh.rotation.y = -angle;

                group.add(segmentMesh);
            }

            newDashedRings.push(group);
            scene.add(group);
        });

        const dotRadius = 0.05; // 实心圆的半径
        const dotSpacing = dotRadius * 5; // 实心圆的间距，设置为半径的2倍

        // 将圆点放在第二个和第三个圆环的正中间
        const dotRingRadius = secondRingRadius + (thirdRingRadius - secondRingRadius) / 2;

        const dotMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
        });

        const dotGroup = new THREE.Group();

        // 根据圆环周长和间距计算圆点的数量
        const circumference1 = 2 * Math.PI * dotRingRadius;
        const dotCount = Math.floor(circumference1 / dotSpacing);

        for (let i = 0; i < dotCount; i++) {
            const angle = (i / dotCount) * Math.PI * 2;

            // 修正：使用球体几何体，使其在任何角度都可见
            const dotGeometry = new THREE.SphereGeometry(dotRadius, 32, 32);
            const dotMesh = new THREE.Mesh(dotGeometry, dotMaterial);

            dotMesh.position.set(
                Math.cos(angle) * dotRingRadius,
                0,
                Math.sin(angle) * dotRingRadius
            );

            dotGroup.add(dotMesh);
        }

        scene.add(dotGroup);

        // --- 新增：在第四个圆环外面创建2组独立的线段 ---
        const fourthRingRadius = ringRadii[3];

        // 第三个样式的线段（短而细）
        const thirdStyleRadius = fourthRingRadius + 0.1; // 靠近第四个圆环
        const thirdStyleWidth = 0.005; // 保持原始的细度
        const thirdStyleLength = 0.2; // 保持原始的长度
        const thirdStyleGap = 0.1;
        const thirdStyleTotalLength = thirdStyleLength + thirdStyleGap;

        const thirdStyleMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6
        });

        const thirdStyleGroup = new THREE.Group();
        const thirdStyleCircumference = 2 * Math.PI * thirdStyleRadius;
        const thirdStyleSegments = Math.floor(thirdStyleCircumference / thirdStyleTotalLength);

        for (let i = 0; i < thirdStyleSegments; i++) {
            const angle = (i / thirdStyleSegments) * Math.PI * 2;
            const geometry = new THREE.BoxGeometry(
                thirdStyleWidth,
                0.005, 
                thirdStyleLength
            );
            const mesh = new THREE.Mesh(geometry, thirdStyleMaterial);

            mesh.position.set(
                Math.cos(angle) * thirdStyleRadius,
                0,
                Math.sin(angle) * thirdStyleRadius
            );
            
            mesh.rotation.y = -angle;
            thirdStyleGroup.add(mesh);
        }
        scene.add(thirdStyleGroup);

        // 第一个样式的线段（长而实心）
        const firstStyleRadius = fourthRingRadius + 0.3; // 放在最外面
        const firstStyleWidth = 0.2; // 保持第一个样式相同的宽度
        const firstStyleLength = 1.5; // 保持第一个样式相同的长度
        const firstStyleGap = 0.1;
        const firstStyleTotalLength = firstStyleLength + firstStyleGap;

        const firstStyleMaterial = new THREE.MeshBasicMaterial({
            color: 0x87cefa,
            transparent: true,
            opacity: 0.1 // 更实心
        });

        const firstStyleGroup = new THREE.Group();
        const firstStyleCircumference = 2 * Math.PI * firstStyleRadius;
        const firstStyleSegments = Math.floor(firstStyleCircumference / firstStyleTotalLength);

        for (let i = 0; i < firstStyleSegments; i++) {
            const angle = (i / firstStyleSegments) * Math.PI * 2;
            const geometry = new THREE.BoxGeometry(
                firstStyleWidth,
                0.005,
                firstStyleLength
            ); 
            const mesh = new THREE.Mesh(geometry, firstStyleMaterial);

            mesh.position.set(
                Math.cos(angle) * firstStyleRadius,
                0,
                Math.sin(angle) * firstStyleRadius
            );
            mesh.rotation.y = -angle;
            firstStyleGroup.add(mesh);
        }
        scene.add(firstStyleGroup);


        // 存储蓝色节点最上方的球体 (使用你要求的 'ip' 字段)
        const blueNodes: { object: THREE.Mesh; ip: string }[] = [];
        // 存储红色节点最上方的球体 (使用你要求的 'ip' 字段)
        const redNodes: { object: THREE.Mesh; ip: string }[] = [];


        async function fetchData() {
            const result = await fetchVMs(adData.id);
            setVms(result);
            const totalSelectedNodes = result.falseTargetList.length + result.trueTargetList.length; // 总是 4

            const selectedIndices: Set<number> = new Set();
            while (selectedIndices.size < totalSelectedNodes) {
                selectedIndices.add(Math.floor(Math.random() * firstStyleSegments));
            }
            // 将Set转换为数组，方便按索引分配颜色
            const indicesArray = Array.from(selectedIndices);

            // 定义白色材质
            const whiteNodeMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

            for (let i = 0; i < firstStyleSegments; i++) {
                const angle: number = (i / firstStyleSegments) * Math.PI * 2;
                const geometry = new THREE.BoxGeometry(firstStyleWidth, 0.005, firstStyleLength);
                const mesh = new THREE.Mesh(geometry, firstStyleMaterial);

                mesh.position.set(
                    Math.cos(angle) * firstStyleRadius,
                    0,
                    Math.sin(angle) * firstStyleRadius
                );
                mesh.rotation.y = -angle;
                firstStyleGroup.add(mesh);

                // 仅收集位置信息
                allNodePositions.set(i, {
                    position: mesh.position.clone(),
                    isOccupied: false,
                    ip: null
                });
            }
            if(blueNodes.length === 0 && redNodes.length === 0){
                const firstR: number = ringRadii[0]; // 假设 ringRadii[0] 存在

                // --- B1. 蓝色节点创建和保存 ---
                const blueColor: number = 0x0000FF;
                const blueNodeMaterial = new THREE.MeshBasicMaterial({ color: blueColor });

                for (let i = 0; i < result.trueTargetList.length; i++) {
                    const ip: string = result.trueTargetList[i].ip;
                    const teamName: string = result.trueTargetList[i].teamName;
                    const segmentIndex: number = indicesArray[i]; // 对应 indicesArray 中前 i 个索引
    
                    const info = allNodePositions.get(segmentIndex)!; // 使用 ! 假设索引存在

                    // 创建节点
                    const { nodeGroup, topMesh } = createNodeMesh(blueNodeMaterial);

                    const element = document.createElement('div');
                    element.className = 'node-label-blue';
                    element.textContent = teamName;
                    
                    // 标签样式 (确保可见和定位)
                    element.style.color = 'yellow';
                    element.style.fontWeight = 'bold';
                    element.style.backgroundColor = 'rgba(0, 0, 150, 0.7)'; // 蓝色背景
                    element.style.padding = '2px 4px';
                    element.style.borderRadius = '2px';
                    element.style.marginTop = '-50px'; // 向上偏移，使其悬浮在节点上方

                    const label = new CSS2DObject(element);
                    nodeGroup.add(label); // 将标签添加到节点分组，实现跟随移动

                    blueNodes.push({
                        object: topMesh,
                        ip: ip 
                    });

                    // 放置节点并标记已占据
                    nodeGroup.position.copy(info.position);
                    firstStyleGroup.add(nodeGroup);
                    
                    info.isOccupied = true;
                    info.ip = ip;
                }


                // --- B2. 红色节点创建和保存 ---
                const redColor: number = 0xFF0000;
                const redNodeMaterial = new THREE.MeshBasicMaterial({ color: redColor });
                const redStartOffset: number = result.trueTargetList.length; // 红色节点在 indicesArray 中的起始偏移量

                for (let i = 0; i < result.falseTargetList.length; i++) {
                    const ip: string = result.falseTargetList[i].ip;
                    const teamName: string = result.trueTargetList[i].teamName;
                    const segmentIndex: number = indicesArray[i + redStartOffset]; // 使用偏移后的索引
                    
                    const info = allNodePositions.get(segmentIndex)!; // 使用 ! 假设索引存在

                    // 创建节点
                    const { nodeGroup, topMesh } = createNodeMesh(redNodeMaterial);

                    const element = document.createElement('div');
                    element.className = 'node-label-blue';
                    element.textContent = teamName;
                    
                    // 标签样式 (确保可见和定位)
                    element.style.color = 'yellow';
                    element.style.fontWeight = 'bold';
                    element.style.backgroundColor = 'rgba(241, 11, 57, 0.7)'; // 蓝色背景
                    element.style.padding = '2px 4px';
                    element.style.borderRadius = '2px';
                    element.style.marginTop = '-50px'; // 向上偏移，使其悬浮在节点上方

                    const label = new CSS2DObject(element);
                    nodeGroup.add(label); // 将标签添加到节点分组，实现跟随移动

                    redNodes.push({
                        object: topMesh,
                        ip: ip 
                    });

                    // 放置节点并标记已占据
                    nodeGroup.position.copy(info.position);
                    firstStyleGroup.add(nodeGroup);
                    
                    info.isOccupied = true;
                    info.ip = ip;
                }

                // --- C. 独立循环：创建白色节点并启动发射逻辑 ---
                for (const [, info] of allNodePositions.entries()) {
                    // 检查该位置是否已经被红/蓝节点占据
                    if (!info.isOccupied) { 
                        
                        const { nodeGroup, topMesh } = createNodeMesh(whiteNodeMaterial); 

                        nodeGroup.position.copy(info.position);
                        firstStyleGroup.add(nodeGroup);
                        
                        // **关键步骤 1：初始化 userData**
                        topMesh.userData.hasEmitter = false; // 默认未发射
                        
                        const randomTargetRadius: number = firstR * (0.5 + Math.random() * 0.4); 
                        const randomDelay: number = Math.random() * 5000;

                        setTimeout(() => {
                            
                            // **关键步骤 2：在发射前检查标志位**
                            if (topMesh.userData.hasEmitter) {
                                // 如果已经被标记为已发射，则退出，不再重复启动
                                return;
                            }
                            
                            // 启动发射器
                            const emitter = shootBalls(scene, topMesh, randomTargetRadius);
                            
                            // **关键步骤 3：标记为已发射**
                            topMesh.userData.hasEmitter = true;
                            
                            // 如果你需要后续清理，可以将 emitter 存储在 topMesh.userData 中，而不是全局数组中
                            topMesh.userData.emitter = emitter; 

                        }, randomDelay);
                    }
                }
            }
        }

        if(adData && adData.id !== ""){
            fetchData();
            // websocketClient.onMessage(handleMessage);
        }

        setTimeout(function shootLoop() {
            console.log(blueNodes.length);
            if(blueNodes.length > 1){
                 const index1 = Math.floor(Math.random() * blueNodes.length);
                    const blue1 = blueNodes[index1];
                    let index2;
                    do {
                        index2 = Math.floor(Math.random() * blueNodes.length);
                    } while (index2 === index1);
                const blue2 = blueNodes[index2];

                if (blue1 && blue2) {
                    shootRay(scene, blue1.object, blue2.object);
                }

                // 下次间隔：5~10 秒
                const nextDelay = (5 + Math.random() * 5) * 1000;
                setTimeout(shootLoop, nextDelay);
            }
        }, (5 + Math.random() * 1) * 1000);

         camera.position.set(0.26, 5, 10.23);
        //camera.lookAt(0.01, -0.75, -0.66);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        // 将 lookAt 的目标点设置为 OrbitControls 的目标点
        controls.target.set(0, -0.5, 5);

        // 关键步骤：通知 OrbitControls 和相机立即更新
        controls.update();

        let hasBeenDragged = false; // 标志位：是否被拖动过

        controls.addEventListener('change', () => {
            // 只有在第一次拖动时才执行
            if (!hasBeenDragged) {

                // 1. 设置新的目标点：(0, 0, 0)
                controls.target.set(0, 0, 0);

                // 2. 设置标志位，确保以后拖动不会再进入这个逻辑
                hasBeenDragged = true;

                // 可选：输出提示信息，确认切换成功
                console.log("用户已开始操作，OrbitControls 目标点已切换到 (0, 0, 0)。");
            }

            // 注意：这里不需要再调用 controls.update()，
            // 因为 change 事件本身就是在 update() 内部触发的。
        });

        const redSpaceships: { ip: string; object: THREE.Object3D }[] = [];
        const blueSpaceships: { ip: string; object: THREE.Object3D }[] = [];


        // 每 5 秒执行一次 fetchLogs
        let lastRedLogLength = 0;
        let lastBlueLogLength = 0;

        const fetchAndUpdateLogs = async () => {
            try {
                const logs = await fetchLogs(adData.id);

                if (logs.length !== 0 && logs.length !== lastBlueLogLength) {
                    setBlueTeamState(prev => ({
                        ...prev,
                        logInfo: logs
                    }));
                    lastBlueLogLength = logs.length;
                }

            } catch (err) {
                console.error('fetchLogs error:', err);
            }
        };

        // 页面加载立即请求一次
        fetchAndUpdateLogs();

        // 然后每隔 5 秒轮询
        setInterval(fetchAndUpdateLogs, 5000);
        if(adData && adData.id !== ""){
            fetchData();
        }

        // setInterval(() => {
        //     fetchAttackLogs(adData.id).then(result => {
        //         //console.log(result);

        //         if (result.code !== 200) {
        //             const blue1 = blueNodes[0];
        //             const blue2 = blueNodes[1];

        //             if (blue1 && blue2) {
        //                 shootRay(scene, blue1.object, blue2.object);
        //             }
        //         } else {
        //             const data = result.data;
        //             for (let i = 0; i < data.length; ++i) {
        //                 const blue1 = blueNodes.find(n => n.ip === data[i][0]);
        //                 const blue2 = blueNodes.find(n => n.ip === data[i][1]);
        //                 if (blue1 && blue2) {
        //                     shootRay(scene, blue1.object, blue2.object);
        //                 }
        //             }
        //         }
        //     });
        // }, 10000); // 每10秒执行一次


        let shootingPaused = false;

        document.addEventListener("visibilitychange", () => {
            shootingPaused = document.hidden;
        });


        if(adData.showAttack === 1){
            console.log(redSpaceships.length);
            setTimeout(function shootLoop() {
                if(redSpaceships.length > 1){
                    debugger
                    const index1 = Math.floor(Math.random() * redSpaceships.length);
                    const blue1 = redSpaceships[index1];
                    let index2;
                    do {
                        index2 = Math.floor(Math.random() * redSpaceships.length);
                    } while (index2 === index1);
                    const blue2 = redSpaceships[index2];

                    if (blue1 && blue2 && !shootingPaused) {
                        shootRay(scene, blue1.object, blue2.object);
                    }

                    // 下次间隔：5~10 秒
                    const nextDelay = (5 + Math.random() * 5) * 1000;
                    setTimeout(shootLoop, nextDelay);
                }
            }, (5 + Math.random() * 10) * 1000);
        }
        // ---------- 动画 ----------
        const clock = new THREE.Clock();
        const animate = () => {
            requestAnimationFrame(animate);
            controls.update();

            // scene.rotation.y += 0.002;
            renderer.render(scene, camera);
            labelRenderer.render(scene, camera);
            
        };
        animate();
       
        return () => {
            //controls.dispose();
            renderer.dispose();
            if (containerRef.current?.contains(renderer.domElement)) {
                containerRef.current.removeChild(renderer.domElement);
            }
            // websocketClient.offMessage(handleMessage);
        };
    }, [adData]);

    return (
        <div className="h-full col-start-2 row-start-2 bg-[rgba(0,10,20,0.8)] border border-[rgba(0,150,255,0.4)] rounded-lg relative shadow-[0_0_25px_rgba(0,100,255,0.3)]">
            <FictionTeam {...blueTeamState} />
            <FictionTeam {...redTeamState} />
            <div className="relative w-full"
                    style={{
                        height: 'calc(100% - 60px)',
                        backgroundImage: `
                            linear-gradient(rgba(0,40,80,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(0,40,80,0.1) 1px, transparent 1px)`,
                        backgroundSize: '35px 35px',
                    }}
                    ref={battlefieldRef}>
                <div ref={containerRef} id={"cesiumContainer"} 
                        className="w-full min-w-[100px] min-h-[100px] m-0 p-0"
                        style={{ height: 'calc(100% - 20px)', bottom: '1px' }}>  
                </div>
            </div>
        </div>
    );    
}

const blueTeamInfos: TeamInfo[] = [
    {
        teamId: '1',
        teamName: '蓝方席位1',
        teamScore: 295
    },
    {
        teamId: '2',
        teamName: '蓝方席位2',
        teamScore: 285
    },
    {
        teamId: '3',
        teamName: '蓝方席位3',
        teamScore: 270
    },
]

const blueLogInfos: LogInfo[] = [
    // {
    //     logId: 1,
    //     logTime: '12:45:01',
    //     logContent: '检测到异常网络流量，已启动深度分析'
    // },
    // {
    //     logId: 2,
    //     logTime: '12:42:33',
    //     logContent: '成功阻止针对Web服务器的SQL注入攻击'
    // },
]

const redTeamInfos: TeamInfo[] = [
    {
        teamId: '1',
        teamName: '红方席位1',
        teamScore: 320
    },
    {
        teamId: '2',
        teamName: '红方席位2',
        teamScore: 300
    },
    {
        teamId: '3',
        teamName: '红方席位3',
        teamScore: 285
    },
    {
        teamId: '4',
        teamName: '红方席位4',
        teamScore: 270
    },
]

const redLogInfos: LogInfo[] = [
    // {
    //     logId: 1,
    //     logTime: '12:44:50',
    //     logContent: '成功渗透目标数据库，提取敏感数据'
    // },
    // {
    //     logId: 2,
    //     logTime: '12:42:10',
    //     logContent: '绕过WAF防护，发起SQL注入攻击'
    // },
    // {
    //     logId: 3,
    //     logTime: '12:44:50',
    //     logContent: '成功渗透目标数据库，提取敏感数据'
    // },
    // {
    //     logId: 4,
    //     logTime: '12:42:10',
    //     logContent: '绕过WAF防护，发起SQL注入攻击'
    // },
    // {
    //     logId: 5,
    //     logTime: '12:44:50',
    //     logContent: '成功渗透目标数据库，提取敏感数据'
    // },
    // {
    //     logId: 6,
    //     logTime: '12:42:10',
    //     logContent: '绕过WAF防护，发起SQL注入攻击'
    // },
]