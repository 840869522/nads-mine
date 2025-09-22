import {useEffect, useRef, useState} from "react";
import * as THREE from "three";
import {GLTFLoader, OrbitControls} from "three-stdlib";
import { BattlefieldInfo, LogInfo, TeamInfo } from "./team";
import FictionTeam from "./fictionTeam";
import { websocketClient } from "@/utils/websocket";
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

    const startTime = performance.now();
    const duration = 1000; // 2s 发射完成

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

interface VMItem {
    name: string;
    ip: string;
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
        const res = await fetch(`/back/api/visualization/vms/${instanceId}`);
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

async function fetchLogs(instanceId: string): Promise<FlagLog> {
    try {
        const res = await fetch(`/back/api/visualization/logs/${instanceId}`);
        if (!res.ok) throw new Error(`网络请求失败: ${res.status}`);

        const json = await res.json();
        // 直接返回 data 部分，前端拿到就是 { trueTargetList, falseTargetList }
        return json.data as FlagLog;
    } catch (err) {
        console.error("请求接口出错:", err);
        // 异常时返回空列表，保证类型安全
        return { redLogList: [], blueLogList: [] };
    }
}

export default function ThreeDimensional(adData: AdData){
    const initialized = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const battlefieldRef = useRef<HTMLDivElement>(null);
    const [vms, setVms] = useState<VMResult>({ trueTargetList: [], falseTargetList: [] });

    // const adData = data !== "" ? JSON.parse(data) : null;

    const blueTeam: BattlefieldInfo = {
        type: 0,
        teamId: adData ? adData.blueTeamId : 0,
        logInfo: blueLogInfos
    }

    const redTeam: BattlefieldInfo = {
        type: 1,
        teamId: adData ? adData.redTeamId : 0,
        logInfo: redLogInfos
    }

    const [redTeamState, setRedTeamState] = useState<BattlefieldInfo>(redTeam);
    const [blueTeamState, setBlueTeamState] = useState<BattlefieldInfo>(blueTeam);

    const scene = new THREE.Scene();
    const rings = new THREE.Group();  // 用于保存所有圆环线

    useEffect(() => {
        if (!containerRef.current) return;
        if (initialized.current) return; // 已经加载过了，直接退出
        initialized.current = true;      // 第一次加载时设置为 true
        
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        scene.background = new THREE.Color(0x000000);

        const camera = new THREE.PerspectiveCamera(60, width / height, 1, 5000);
        camera.position.set(0, 150, 400);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        containerRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        // 添加一个环境光，让场景有一个基础亮度，避免模型全黑
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // 颜色, 强度
        scene.add(ambientLight);

        // 添加一个平行光（像太阳光），可以产生阴影和高光
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 10, 7.5); // 从斜上方照射
        scene.add(directionalLight);

        // ---------- 太阳核心 ----------
        const sunRadius = 20; // 太阳核心半径
        const sunGeometry = new THREE.SphereGeometry(sunRadius, 64, 64);
        const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd55 });
        const sun = new THREE.Mesh(sunGeometry, sunMaterial);
        scene.add(sun);

        // ---------- 火焰球面 ----------
        const flameGeometry = new THREE.SphereGeometry(sunRadius * 1.2, 128, 128);
        const flameMaterial = new THREE.ShaderMaterial({
            vertexShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            void main() {
                vNormal = normal;
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
            }`,
            fragmentShader: `
            varying vec3 vNormal;
            varying vec3 vPosition;
            uniform float time;
            void main() {
                float intensity = length(vNormal.xy) + sin(time + length(vPosition)) * 0.5;
                intensity = clamp(intensity, 0.0, 1.0);
                vec3 color = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 0.0, 0.0), intensity);
                gl_FragColor = vec4(color, 1.0);
            }`,
            uniforms: {
                time: { value: 0 }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        const flames = new THREE.Mesh(flameGeometry, flameMaterial);
        scene.add(flames);

        // ---------- 星空背景 ----------
        const starCount = 1000;
        const starGeometry = new THREE.BufferGeometry();
        const starPositions = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            starPositions[i * 3] = (Math.random() - 0.5) * 2000; // 随机星星位置
            starPositions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
            starPositions[i * 3 + 2] = (Math.random() - 0.5) * 2000;
        }
        starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1 });
        const stars = new THREE.Points(starGeometry, starMaterial);
        scene.add(stars);

        // ---------- 云层贴图 ----------
        const cloudTextureUrl = "/mapdata/img/cloud.jpg"; // 替换为你的云层图URL
        const cloudTexture = new THREE.TextureLoader().load(cloudTextureUrl);

        // 创建云层几何体，包裹整个场景
        const cloudGeometry = new THREE.SphereGeometry(3000, 64, 64); // 云层球体，半径为 4000
        const cloudMaterial = new THREE.MeshBasicMaterial({
            map: cloudTexture,
            transparent: true,
            opacity: 0.35, // 透明度设置得很低，模拟远距离的云层
            side: THREE.DoubleSide,
            depthWrite: false, // 不写深度，避免遮挡
            blending: THREE.AdditiveBlending, // 混合模式
        });

        // 创建云层对象
        const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
        scene.add(cloud);

        // 创建轨道
        const ringCount = 6;  // 设置6个圆环
        

        // 生成圆环线并添加到场景中
        for (let i = 0; i < ringCount; i++) {
            // 每个圆环的半径：逐渐增大，确保不靠太近
            const radius = sunRadius * (3 + i * 3);  // 增大每个圆环的半径，确保它们之间有间距

            const segments = 64; // 圆环的分段数
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(segments * 3);  // 每个点(x, y, z)
            const uv = new Float32Array(segments * 2);  // 每个顶点的UV坐标，用于渐变颜色

            // 生成圆环的顶点和UV坐标
            for (let j = 0; j < segments; j++) {
                const angle = (j / segments) * Math.PI * 2;  // 计算每个顶点的角度
                positions[j * 3] = radius * Math.cos(angle);  // x 坐标
                positions[j * 3 + 1] = radius * Math.sin(angle);  // y 坐标
                positions[j * 3 + 2] = 0;  // z 坐标（平面上的圆环）

                // 给每个顶点设置UV坐标，0到1，用于后续渐变颜色
                uv[j * 2] = j / segments;  // UV的x坐标（用于渐变）
                uv[j * 2 + 1] = 0;  // 固定UV的y坐标
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));  // 设置UV坐标

            // 创建自定义材质：通过着色器进行颜色渐变
            const material = new THREE.ShaderMaterial({
                vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;  // 传递UV坐标
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
                fragmentShader: `
                varying vec2 vUv;
                void main() {
                    // 渐变效果：沿着圆环从浅蓝色到深蓝色
                    vec3 startColor = vec3(0.678, 0.847, 1.0);  // 浅蓝色
                    vec3 endColor = vec3(0.0, 0.0, 0.545);    // 深蓝色
                    vec3 color = mix(startColor, endColor, vUv.x);  // 根据UV坐标进行渐变

                    gl_FragColor = vec4(color, 1.0);  // 设定最终颜色
                }`,
                transparent: true,
                side: THREE.DoubleSide,  // 两面可见
            });

            // 创建圆环并应用自定义材质
            const ring = new THREE.LineLoop(geometry, material);  // 创建圆环线条
            ring.rotation.x = Math.PI / 2;  // 确保圆环是水平放置的
            ring.position.set(0, 0, 0);  // 设置圆环位置

            rings.add(ring);  // 将圆环添加到组中
        }

        scene.add(rings);  // 将所有圆环添加到场景中

        const redSpaceships: { ip: string; object: THREE.Object3D }[] = [];
        const blueSpaceships: { ip: string; object: THREE.Object3D }[] = [];

        async function fetchData() {
            const result = await fetchVMs(adData.id);
            setVms(result);
            if(redSpaceships.length === 0 && blueSpaceships.length === 0){
                for (let i = 0; i < result.falseTargetList.length; i++) {
                    createSpaceship(scene, rings, "/mapdata/model/redSpaceship.glb", 2, 1).then((spaceship) => {
                        redSpaceships.push({ip:result.falseTargetList[i].ip, object:spaceship});
                    });
                }

                for (let i = 0; i < result.trueTargetList.length; i++) {
                    createSpaceship(scene, rings, "/mapdata/model/blueSpaceship.glb", 18).then((spaceship) => {
                        blueSpaceships.push({ip:result.trueTargetList[i].ip, object:spaceship});
                    });
                }
            }

        }

        // 每 5 秒执行一次 fetchLogs
        let lastRedLogLength = 0;
        let lastBlueLogLength = 0;

        const fetchAndUpdateLogs = async () => {
            try {
                const logs = await fetchLogs(adData.id);

                if (logs.redLogList.length !== 0 && logs.redLogList.length !== lastRedLogLength) {
                    setRedTeamState(prev => ({
                        ...prev,
                        logInfo: logs.redLogList
                    }));
                    lastRedLogLength = logs.redLogList.length;
                }

                if (logs.blueLogList.length !== 0 && logs.blueLogList.length !== lastBlueLogLength) {
                    setBlueTeamState(prev => ({
                        ...prev,
                        logInfo: logs.blueLogList
                    }));
                    lastBlueLogLength = logs.blueLogList.length;
                }

            } catch (err) {
                console.error('fetchLogs error:', err);
            }
        };

        // 页面加载立即请求一次
        fetchAndUpdateLogs();

        // 然后每隔 5 秒轮询
        setInterval(fetchAndUpdateLogs, 5000);

        // let timer = "";

        // const handleMessage = (data: any) => {
        //     try {
        //         const msg = typeof data === "string" ? JSON.parse(data) : data;
        //         if (msg.type === "flag-log" && msg.timer !== timer && msg.data.scene_instance_id === adData.id) {
        //             timer = msg.timer;
        //             const now = new Date();
        //             const hours = now.getHours().toString().padStart(2, '0');
        //             const minutes = now.getMinutes().toString().padStart(2, '0');
        //             const seconds = now.getSeconds().toString().padStart(2, '0');

                    
        //             let logMessage = msg.data.success? `${msg.data.username}提交${msg.data.instance_name}的flag正确`
        //                 : `${msg.data.username}提交${msg.data.instance_name}的flag错误`

        //             let newLog: LogInfo = {
        //                 logId: Date.now(),
        //                 logTime: `${hours}:${minutes}:${seconds}`,
        //                 logContent: logMessage
        //             };

        //             if(msg.data.success){
        //                 setRedTeamState(prev => ({
        //                     ...prev,
        //                     logInfo: [...prev.logInfo, newLog]
        //                 }));
        //             }else{
        //                 setBlueTeamState(prev => ({
        //                     ...prev,
        //                     logInfo: [...prev.logInfo, newLog]
        //                 }));
        //             }
        //         }
        //     } catch (e) {
        //     console.error("解析 WebSocket 数据失败:", e, data);
        //     }
        // };

        if(adData && adData.id !== ""){
            fetchData();
            // websocketClient.onMessage(handleMessage);
        }

        let shootingPaused = false;

        document.addEventListener("visibilitychange", () => {
            shootingPaused = document.hidden;
        });


        if(adData.showAttack === 1){
            setTimeout(function shootLoop() {
                if(redSpaceships.length > 0 && blueSpaceships.length > 0){
                    const red = redSpaceships[Math.floor(Math.random() * redSpaceships.length)];
                    const blue = blueSpaceships[Math.floor(Math.random() * blueSpaceships.length)];

                    if (red && blue && !shootingPaused) {
                        shootRay(scene, red.object, blue.object);
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
            const time = clock.getElapsedTime();
            (flameMaterial.uniforms['time']).value = time;

            // 火焰球面微小变形
            const pos = flameGeometry.attributes.position as THREE.BufferAttribute;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                const z = pos.getZ(i);
                const len = Math.sqrt(x * x + y * y + z * z);
                const nx = x / len;
                const ny = y / len;
                const nz = z / len;
                const offset = Math.sin(time * 3 + i * 0.1) * 2.0;
                pos.setXYZ(i, nx * (sunRadius * 1.2 + offset), ny * (sunRadius * 1.2 + offset), nz * (sunRadius * 1.2 + offset));
            }
            pos.needsUpdate = true;

            // 动态云层效果：微小的漂浮，模拟自然运动
            cloud.rotation.y += 0.001;

            rings.rotation.y += 0.01;  // 让所有圆环沿y轴旋转

            controls.update();
            renderer.render(scene, camera);
        };
        animate();
       
        return () => {
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