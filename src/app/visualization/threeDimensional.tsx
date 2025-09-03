import {useEffect, useRef, useState} from "react";
import * as THREE from "three";
import {OrbitControls} from "three-stdlib";
import Team, { BattlefieldInfo, LogInfo, TeamInfo } from "./team";

function createNetworkNodes(
    scene: THREE.Scene,
    gridSize: number,
    geometry: THREE.PlaneGeometry,
    redCount: number,
    blueCount: number
) {
    const nodeCount = redCount + blueCount;
    const redNodes: THREE.Group[] = [];
    const blueNodes: THREE.Group[] = [];

    for (let i = 0; i < nodeCount; i++) {
        // ---------- 找到底面高度 ----------
        const x = (Math.random() - 0.5) * gridSize * 0.9;
        const z = (Math.random() - 0.5) * gridSize * 0.9;

        let y = 0;
        {
            const posAttr = geometry.attributes.position as THREE.BufferAttribute;
            let nearestDist = Infinity;
            for (let j = 0; j < posAttr.count; j++) {
                const px = posAttr.getX(j);
                const pz = posAttr.getZ(j);
                const dist = (px - x) ** 2 + (pz - z) ** 2;
                if (dist < nearestDist) {
                    nearestDist = dist;
                    y = posAttr.getY(j);
                }
            }
        }

        const offset = 10;
        const nodeGroup = new THREE.Group();
        nodeGroup.position.set(x, y + offset, z);

        // 判断颜色类型
        const isRed = i < redCount;

        const baseColor = isRed ? 0x660000 : 0x003366;
        const emissiveColor = isRed ? 0xff0000 : 0x0066ff;
        const coreColor = isRed ? 0xcc0000 : 0x0066ff;
        const wireColor = isRed ? 0xff3333 : 0x0066ff;

        // ---------- 底座 ----------
        const baseGeo = new THREE.CylinderGeometry(12, 14, 6, 32, 1, true);
        const baseMat = new THREE.MeshStandardMaterial({
            color: baseColor,
            emissive: emissiveColor,
            emissiveIntensity: 1.0,
            metalness: 0.6,
            roughness: 0.2,
            transparent: true,
            opacity: 0.8,
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = -8;
        nodeGroup.add(base);

        // ---------- 底座发光边框 ----------
        const ringGeo = new THREE.RingGeometry(14, 16, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: emissiveColor,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
        });
        const baseRing = new THREE.Mesh(ringGeo, ringMat);
        baseRing.rotation.x = Math.PI / 2;
        baseRing.position.y = -5;
        nodeGroup.add(baseRing);

        // ---------- 核心球 ----------
        const coreGeo = new THREE.SphereGeometry(10, 20, 20);
        const coreMat = new THREE.MeshStandardMaterial({
            color: coreColor,
            emissive: emissiveColor,
            emissiveIntensity: 0.6,
            metalness: 0.3,
            roughness: 0.4,
            transparent: true,
            opacity: 0.7,
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        nodeGroup.add(core);

        // ---------- 外层线框 ----------
        const wireGeo = new THREE.IcosahedronGeometry(14, 1);
        const wireMat = new THREE.MeshBasicMaterial({
            color: wireColor,
            wireframe: true,
            transparent: true,
            opacity: 0.35,
        });
        const wire = new THREE.Mesh(wireGeo, wireMat);
        nodeGroup.add(wire);

        // ---------- 外层发光环 ----------
        const haloGeo = new THREE.RingGeometry(14, 16, 32);
        const haloMat = new THREE.MeshBasicMaterial({
            color: emissiveColor,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        halo.rotation.x = Math.PI / 2;
        nodeGroup.add(halo);

        scene.add(nodeGroup);

        if (isRed) {
            redNodes.push(nodeGroup);
        } else {
            blueNodes.push(nodeGroup);
        }
    }

    // ---------- 更新函数 ----------
    const update = () => {
        [...redNodes, ...blueNodes].forEach((node) => {
            node.children.forEach((child) => {
                if ((child as THREE.Mesh).geometry instanceof THREE.IcosahedronGeometry) {
                    child.rotation.y += 0.01;
                }
                if ((child as THREE.Mesh).geometry instanceof THREE.RingGeometry) {
                    child.rotation.z += 0.008;
                }
            });
        });
    };

    return { redNodes, blueNodes, update };
}

// 射线函数：沿抛物线延伸，完成后销毁
function shootRay(scene: THREE.Scene, startNode: THREE.Group, endNode: THREE.Group) {
    const start = startNode.position.clone();
    const end = endNode.position.clone();

    const steps = 100; // 分段数
    const height = 80 + Math.random() * 50; // 抛物线顶点高度

    // 二次贝塞尔控制点
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.y += height;

    // 生成完整轨迹数组
    const trajectory: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const point = start.clone().multiplyScalar((1 - t) ** 2)
            .add(mid.clone().multiplyScalar(2 * (1 - t) * t))
            .add(end.clone().multiplyScalar(t ** 2));
        trajectory.push(point);
    }

    // 初始化 geometry，把所有点放进去
    const geometry = new THREE.BufferGeometry().setFromPoints(trajectory);
    geometry.setDrawRange(0, 2);

    const material = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 1,
    });

    const line = new THREE.Line(geometry, material);
    scene.add(line);

    // let progress = 2;
    // let stopped = false;

    const startTime = performance.now();
    const duration = 2000; // 2s 发射完成

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

function startRandomRays(
    scene: THREE.Scene,
    redNodes: THREE.Group[],
    blueNodes: THREE.Group[]
) {
    setInterval(() => {
        if (redNodes.length === 0 || blueNodes.length === 0) return;

        // 起点：红节点
        const start = redNodes[Math.floor(Math.random() * redNodes.length)];
        // 终点：蓝节点
        const end = blueNodes[Math.floor(Math.random() * blueNodes.length)];

        shootRay(scene, start, end);
    }, 3000); // 每3秒发射一次
}

export default function ThreeDimensional(){
    const containerRef = useRef<HTMLDivElement>(null);
    const battlefieldRef = useRef<HTMLDivElement>(null);

    const blueTeam: BattlefieldInfo = {
        type: 0,
        teamInfo: blueTeamInfos,
        logInfo: blueLogInfos
    }

    const redTeam: BattlefieldInfo = {
        type: 1,
        teamInfo: redTeamInfos,
        logInfo: redLogInfos
    }

    const [redTeamState, setRedTeamState] = useState<BattlefieldInfo>(redTeam);
    const [blueTeamState, setBlueTeamState] = useState<BattlefieldInfo>(blueTeam);

    useEffect(() => {
        if (!containerRef.current) return;
        const width = containerRef.current!.clientWidth;
        const height = containerRef.current!.clientHeight;

        // ---------- 场景 ----------
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        // ---------- 相机 ----------
        const camera = new THREE.PerspectiveCamera(60, width / height, 1, 5000);
        camera.position.set(0, 400, 800);

        // ---------- 渲染器 ----------
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        containerRef.current!.appendChild(renderer.domElement);

        // ---------- 控制器 ----------
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        // ---------- 光照 ----------
        scene.add(new THREE.AmbientLight(0xffffff, 0.25));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.3);
        dirLight.position.set(200, 400, 200);
        scene.add(dirLight);

        // ---------- 凸起底面 ----------
        const gridSize = 1000;
        const segments = 100;
        const geometry = new THREE.PlaneGeometry(gridSize, gridSize, segments, segments);
        geometry.rotateX(-Math.PI / 2);

        for (let i = 0; i < geometry.attributes.position.count; i++) {
            const x = geometry.attributes.position.getX(i);
            const z = geometry.attributes.position.getZ(i);
            const distance = Math.sqrt(x * x + z * z);
            const maxR = gridSize / 2;
            const t = THREE.MathUtils.clamp(distance / maxR, 0, 1);

            // 中间高、周围低，凸起高度可调
            const maxHeight = 60;
            const y = Math.cos(t * Math.PI / 2) * maxHeight;
            geometry.attributes.position.setY(i, y);
        }
        geometry.computeVertexNormals();

        const colors = new Float32Array(geometry.attributes.position.count * 3);
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

        const floorMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            metalness: 0.3,
            roughness: 0.5,
            emissive: 0x330066,
            emissiveIntensity: 0.4,
        });

        const floor = new THREE.Mesh(geometry, floorMaterial);
        scene.add(floor);

        // ---------- 网格线 ----------
        const wireframe = new THREE.LineSegments(
            new THREE.WireframeGeometry(geometry),
            new THREE.LineBasicMaterial({
                color: 0x66ccff,
                opacity: 0.4,
                transparent: true,
            })
        );
        scene.add(wireframe);

        // ---------- 粒子 ----------
        const pointCount = 600;
        const pointsGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(pointCount * 3);
        const velocities = new Float32Array(pointCount * 3);

        for (let i = 0; i < pointCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * gridSize * 1.5;
            positions[i * 3 + 1] = Math.random() * 200 + 10;
            positions[i * 3 + 2] = (Math.random() - 0.5) * gridSize * 1.5;

            velocities[i * 3] = 0;
            velocities[i * 3 + 1] = 0.2 + Math.random() * 0.15; // 粒子上升速度稍快
            velocities[i * 3 + 2] = 0;
        }

        pointsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        pointsGeometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));

        const particleTexture = new THREE.TextureLoader().load(
            "data:image/svg+xml;base64," +
            btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
                <circle cx="32" cy="32" r="30" fill="white" />
              </svg>`)
        );

        const pointsMaterial = new THREE.PointsMaterial({
            map: particleTexture,
            color: 0x66ccff,
            size: 10,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
        });

        const points = new THREE.Points(pointsGeometry, pointsMaterial);
        scene.add(points);

        // 创建网络节点
        const { redNodes, blueNodes, update } = createNetworkNodes(scene, gridSize, geometry, 5, 5);
        // 启动射线
        startRandomRays(scene, redNodes, blueNodes);
        // ---------- 动画 ----------
        const animate = () => {
            requestAnimationFrame(animate);

            // 顶点颜色径向渐变
            for (let i = 0; i < geometry.attributes.position.count; i++) {
                const x = geometry.attributes.position.getX(i);
                const z = geometry.attributes.position.getZ(i);
                const distance = Math.sqrt(x * x + z * z);
                const maxR = gridSize / 2;
                const t = THREE.MathUtils.clamp(1 - distance / maxR, 0, 1);

                const hue = 0.65 - 0.25 * t;
                const saturation = 0.8;
                let lightness = 0.15 + 0.5 * t;

                const deepFactor = 0.3;
                lightness = Math.max(0, lightness - deepFactor);

                const color = new THREE.Color().setHSL(hue, saturation, lightness);

                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;
            }
            geometry.attributes.color.needsUpdate = true;

            // 粒子漂浮
            const posAttr = points.geometry.attributes.position as THREE.BufferAttribute;
            const velAttr = points.geometry.attributes.velocity as THREE.BufferAttribute;
            for (let i = 0; i < pointCount; i++) {
                let y = posAttr.getY(i) + velAttr.getY(i);
                if (y > 200) y = 10;
                posAttr.setY(i, y);
            }
            posAttr.needsUpdate = true;

            update();
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            renderer.dispose();
            // containerRef.current?.removeChild(renderer.domElement);
        };
    }, []);

    return (
        <div className="h-full col-start-2 row-start-2 bg-[rgba(0,10,20,0.8)] border border-[rgba(0,150,255,0.4)] rounded-lg relative shadow-[0_0_25px_rgba(0,100,255,0.3)]">
            <Team {...blueTeamState} />
            <Team {...redTeamState} />
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
        teamId: 1,
        teamName: '蓝方席位1',
        teamScore: 295
    },
    {
        teamId: 2,
        teamName: '蓝方席位2',
        teamScore: 285
    },
    {
        teamId: 3,
        teamName: '蓝方席位3',
        teamScore: 270
    },
]

const blueLogInfos: LogInfo[] = [
    {
        logId: 1,
        logTime: '12:45:01',
        logContent: '检测到异常网络流量，已启动深度分析'
    },
    {
        logId: 2,
        logTime: '12:42:33',
        logContent: '成功阻止针对Web服务器的SQL注入攻击'
    },
]

const redTeamInfos: TeamInfo[] = [
    {
        teamId: 1,
        teamName: '红方席位1',
        teamScore: 320
    },
    {
        teamId: 2,
        teamName: '红方席位2',
        teamScore: 300
    },
    {
        teamId: 3,
        teamName: '红方席位3',
        teamScore: 285
    },
    {
        teamId: 4,
        teamName: '红方席位4',
        teamScore: 270
    },
]

const redLogInfos: LogInfo[] = [
    {
        logId: 1,
        logTime: '12:44:50',
        logContent: '成功渗透目标数据库，提取敏感数据'
    },
    {
        logId: 2,
        logTime: '12:42:10',
        logContent: '绕过WAF防护，发起SQL注入攻击'
    },
    {
        logId: 3,
        logTime: '12:44:50',
        logContent: '成功渗透目标数据库，提取敏感数据'
    },
    {
        logId: 4,
        logTime: '12:42:10',
        logContent: '绕过WAF防护，发起SQL注入攻击'
    },
    {
        logId: 5,
        logTime: '12:44:50',
        logContent: '成功渗透目标数据库，提取敏感数据'
    },
    {
        logId: 6,
        logTime: '12:42:10',
        logContent: '绕过WAF防护，发起SQL注入攻击'
    },
]