import * as Cesium from "cesium";
import {useLayoutEffect, useRef, useState} from "react";
import {Cartesian3, Color, Entity, HeadingPitchRoll, PolylineGlowMaterialProperty, Transforms, Viewer, Math as CesiumMath, Quaternion, CallbackProperty, ScreenSpaceEventHandler, Cartographic, ScreenSpaceEventType } from "cesium";
import Team, { BattlefieldInfo, LogInfo, TeamInfo } from "./team";
import { AdData } from "./page";
import { websocketClient } from "@/utils/websocket";

interface PlaneEntityOptions {
    viewer: Viewer;
    name?: string;
    position: [number, number, number];  // [lon, lat, height]
    orientationTarget?: [number, number, number]; // [lon, lat, height] 用于计算朝向
    heading?: number;  // 偏航角，度
    pitch?: number;    // 俯仰角，度
    roll?: number;     // 翻滚角，度
    modelUri?: string;
}

function generateRandomPositionsWithHeight(
    center: [number, number], // [lon, lat]
    latRange: number,          // 纬度范围
    lonRange: number,          // 经度范围
    heightRange: [number, number] = [500, 1500], // 高度范围
    count: number = 3
): [number, number, number][] {
    const [centerLon, centerLat] = center;
    const positions: [number, number, number][] = [];

    for (let i = 0; i < count; i++) {
        const lon = centerLon + (Math.random() - 0.5) * 2 * lonRange;
        const lat = centerLat + (Math.random() - 0.5) * 2 * latRange;
        const height = heightRange[0] + Math.random() * (heightRange[1] - heightRange[0]);
        positions.push([lon, lat, height]);
    }

    return positions;
}


function addPlaneEntity(options: PlaneEntityOptions) {
    const {
        viewer,
        name = '飞机',
        position,
        orientationTarget,
        heading = 0,
        pitch = 0,
        roll = 0,
        modelUri = '/mapdata/model/Cesium_Air.glb',
    } = options;

     const hpr = new HeadingPitchRoll(
        CesiumMath.toRadians(heading),
        CesiumMath.toRadians(pitch),
        CesiumMath.toRadians(roll)
    );

    const pos = Cartesian3.fromDegrees(position[0], position[1], position[2]);

    const entity = viewer.entities.add({
        name,
        position: pos,
        orientation: Transforms.headingPitchRollQuaternion(pos, hpr),
        model: {
            uri: modelUri,
            minimumPixelSize: 60,
            maximumScale: 10000,
            show: true,
        },
    });

    return entity;
}

// 加载地形的异步函数
async function addWorldTerrainAsync(viewer: Cesium.Viewer) {
    try {
        const terrainProvider = await Cesium.CesiumTerrainProvider.fromUrl('/mapdata/terrain/', {
            requestWaterMask: true,
            requestVertexNormals: true,
        });
        viewer.terrainProvider = terrainProvider;

        viewer.scene.globe.depthTestAgainstTerrain = true;

        console.log("地形加载成功");
    } catch (error) {
        // console.error(`地形加载失败: ${error}`);
        // alert('地形数据加载失败，请检查控制台日志');
    }
}

async function addWorldImageryAsync(viewer: Cesium.Viewer) {
    viewer.imageryLayers.removeAll();

    const tmsImageryProvider = new Cesium.UrlTemplateImageryProvider({
        url: '/mapdata/map4/laiwu/{z}/{x}/{y}.png',
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        minimumLevel: 0, 
        maximumLevel: 15,
    });

    viewer.scene.imageryLayers.addImageryProvider(tmsImageryProvider);
}

function shootLaser(viewer: Viewer, from: Cartesian3, to: Cartesian3, duration: number = 3000): Entity {
  const startTime = Date.now();

  // 用 CallbackProperty 动态返回 positions，保证每帧刷新
  const positions = new CallbackProperty(() => {
    const elapsed = Date.now() - startTime;
    if (elapsed >= duration) {
      // 超时移除实体
      if (viewer.entities.contains(laserEntity)) {
        viewer.entities.remove(laserEntity);
        viewer.scene.requestRender();
      }
      return undefined; // 返回 undefined 则不再渲染
    }
    return [from, to];
  }, false);

  const laserEntity = viewer.entities.add({
    name: "激光射线",
    polyline: {
      positions,
      width: 5.0,
      material: new PolylineGlowMaterialProperty({
        glowPower: 0.3,
        color: Color.RED.withAlpha(0.9),
      }),
      clampToGround: false,
    },
  });

  return laserEntity;
}

interface VMItem {
    name: string;
    ip: string;
}

interface VMResult {
    trueTargetList: VMItem[];
    falseTargetList: VMItem[];
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

export default function Battlefield (adData: AdData) {
    const containerRef = useRef<HTMLDivElement>(null);
    const battlefieldRef = useRef<HTMLDivElement>(null);

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
    const [vms, setVms] = useState<VMResult>({ trueTargetList: [], falseTargetList: [] });

    useLayoutEffect(() => {
        if (!containerRef.current) return;

        Cesium.Ion.defaultAccessToken = ''

        const viewer = new Cesium.Viewer(containerRef.current, {
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,         // 隐藏主视图控件
            animation: false,
            timeline: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            fullscreenButton: true,
            baseLayer: false,
            requestRenderMode: true, // 静态场景只在需要时渲染
        });

        viewer.resize();

        const container = document.getElementById('cesiumContainer');
        const canvas = container!.querySelector('canvas');
        if (canvas) {
            canvas.width = container!.clientWidth;
            canvas.height = container!.clientHeight;
        }


        addWorldImageryAsync(viewer).catch(err => {
            console.error('加载影像图层失败:', err);
        });

        // viewer.resolutionScale = window.devicePixelRatio;
        // viewer.scene.globe.maximumScreenSpaceError = 1;


        // 调用加载地形函数
        addWorldTerrainAsync(viewer);

        viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(
                117.58,
                36.08,
                10000
            ),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-45),
                roll: 0
            }
        });
 
        viewer.scene.postProcessStages.fxaa.enabled = true;

        const redPlanes: { ip: string; object: Cesium.Entity; pos: Cartesian3  }[] = [];
        const bluePlanes: { ip: string; object: Cesium.Entity; pos: Cartesian3 }[] = [];

        async function fetchData() {
            const result = await fetchVMs(adData.id);
            setVms(result);
            const randomPositions1 = generateRandomPositionsWithHeight(center1, latRange, lonRange, heightRange, result.trueTargetList.length);
            const randomPositions2 = generateRandomPositionsWithHeight(center2, latRange, lonRange, heightRange, result.falseTargetList.length);

            // 循环生成实体并存到 redPlans
            result.trueTargetList.forEach((item, index) => {
                const pos = randomPositions1[index];
                const entity = addPlaneEntity({
                    viewer,
                    name: `redPlane${index + 1}`,
                    position:  [pos[0], pos[1], pos[2]],
                    heading: 0,
                    pitch: 0,
                    roll: 0
                });

                bluePlanes.push({
                    ip: item.ip,  // 取对象中的 ip
                    object: entity,
                    pos: Cartesian3.fromDegrees(pos[0], pos[1], pos[2])
                });
            });

            // 循环生成实体并存到 redPlans
            result.falseTargetList.forEach((item, index) => {
                const pos = randomPositions2[index];
                const entity = addPlaneEntity({
                    viewer,
                    name: `bluePlane${index + 1}`,
                    position: [pos[0], pos[1], pos[2]],
                    heading: 180,
                    pitch: 0,
                    roll: 0
                });

                redPlanes.push({
                    ip: item.ip,  // 取对象中的 ip
                    object: entity,
                    pos: Cartesian3.fromDegrees(pos[0], pos[1], pos[2])
                });
            });
        }

        let timer: string = "";
        const handleMessage = (data: any) => {
            try {
                const msg = typeof data === "string" ? JSON.parse(data) : data;
                if (msg.type === "flag-log" && msg.timer !== timer && msg.data.scene_instance_id === adData.id) {
                    timer = msg.timer;
                    const now = new Date();
                    const hours = now.getHours().toString().padStart(2, '0');
                    const minutes = now.getMinutes().toString().padStart(2, '0');
                    const seconds = now.getSeconds().toString().padStart(2, '0');
                            
                    let logMessage = msg.data.success? `${msg.data.username}提交${msg.data.instance_name}的flag正确`
                        : `${msg.data.username}提交${msg.data.instance_name}的flag错误`
        
                    let newLog: LogInfo = {
                        logId: Date.now(),
                        logTime: `${hours}:${minutes}:${seconds}`,
                        logContent: logMessage
                    };
        
                    if(msg.data.success){
                        setRedTeamState(prev => ({
                            ...prev,
                            logInfo: [...prev.logInfo, newLog]
                        }));
                    }else{
                        setBlueTeamState(prev => ({
                            ...prev,
                            logInfo: [...prev.logInfo, newLog]
                        }));
                    }
                }
            } catch (e) {
                console.error("解析 WebSocket 数据失败:", e, data);
            }
        };
        
        if(adData && adData.id !== ""){
            fetchData();
            websocketClient.onMessage(handleMessage);
        }

        const center1: [number, number] = [117.54, 36.17];
        const latRange = 0.01;
        const lonRange = 0.01;
        const heightRange: [number, number] = [500, 1500];

        const center2: [number, number] = [117.61, 36.17];
        
        let canceled = false;

        const shootLoop = () => {
            if (canceled) return;

            // 数组为空，短轮询
            if (redPlanes.length === 0 || bluePlanes.length === 0) {
                setTimeout(shootLoop, 500); // 0.5 秒重试
                return;
            }

            // 随机选择红蓝实体
            const red = redPlanes[Math.floor(Math.random() * redPlanes.length)];
            const blue = bluePlanes[Math.floor(Math.random() * bluePlanes.length)];

            // 获取当前位置
            const fromPos = red.pos;
            const toPos = blue.pos;

            if (fromPos && toPos) {
                // 强制渲染一次，保证第一次能显示
                viewer.scene.requestRender();
                shootLaser(viewer, fromPos, toPos, 3000); // 射线持续 3 秒
            } else {
                // 位置未准备好，短时间重试
                setTimeout(shootLoop, 100);
                return;
            }

            viewer.scene.requestRender();
            // 下一次随机间隔 5–10 秒
            const nextDelay = (5 + Math.random() * 5) * 1000;
            setTimeout(shootLoop, nextDelay);
        };

        // 启动第一次
        if(adData.showAttack === 1)
            shootLoop();
        
        return () => {
            canceled = true;
            viewer.destroy();
            websocketClient.offMessage(handleMessage);
        };
    }, [adData.id]);
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
    
]